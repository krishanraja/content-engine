import { yesByDay, type YesRow } from './_yes.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { actor, canonical, growthWriter, collections, digest, hisOnlyRefusal, fileSpec, monday, revision, validBody, validSourceBody, validId, validManifest, views, type BoardFile, type Manifest, type View } from './_contracts.js'
import { PressError, afterPress, preparePress, type PressDeps } from './_presses.js'
import { readArchive } from './_archive.js'
import { readPieces, recordPosted } from './_posted.js'
import { carryDay } from './_carry.js'
import { weekLive } from './_live.js'
import { readView } from './_view.js'
import { signMedia } from './_media.js'
import { notModified, viewEtag } from './_viewContract.js'
import { dispatchJob, isJob } from './_run.js'
import { MaterialError, fileMaterial, recentResearch, researchForPiece, saveLook } from './_research.js'
import { researchPrompt } from './_prompts.js'
import { StyleError, needsMotion, saveStyle, stylePick } from './_style.js'
import { CUT_OP, CutError, cutPick, fileCutLearning, saveCut } from './_cuts.js'
import { DESK_PAGE } from './_deskPage.js'
import { liveBoardUrl } from './_liveBoard.js'
import { ARCHIVE_REFERRER_POLICY, fromArchivePage, readOnlyArchive } from './_readOnly.js'
import { StandardsError, decideStandard, readStandards, renderStandards } from './_standards.js'
import { operatorBearerAllowed } from '../_auth.js'
import { MediaQualityError, qualifyBoard } from '../_mediaQuality.js'
import { mediaQualityEnforced, mediaQualityRollout } from '../../../../packages/core/src/media-rollout.js'

const BUCKET = 'content-library'
/** The presses posted to /api/board/<Monday>/<op> that reach the handler as a collection (no rewrite of their own). */
const POST_OPS: ReadonlySet<string> = new Set(['style', CUT_OP])
const TTL = 300
const scalar = (v: unknown) => typeof v === 'string' ? v : ''
const weekDate = (v: string | Date) => (v instanceof Date ? v.toISOString() : v).slice(0, 10)
/** The board page's content security policy. A board picture or video is served at /api/board/<week>/assets/<id>,
 *  which redirects to a signed link on the engine's file store, so img-src and media-src name that store's origin
 *  too: without it every image on the board is blocked (Krish, 2026-11-03, of the Saturday mock: "Permanently ensure
 *  the publish board doesn't look as stupid and shitty as this when a carousel is complete"). Nothing else widens. */
export function boardPolicy(storeUrl?: string) {
  let store = ''
  try { const u = new URL(storeUrl || ''); if (u.protocol === 'https:') store = ' ' + u.origin } catch { /* no store: same-site only */ }
  return "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    + `img-src 'self' data: blob:${store}; media-src 'self' blob:${store}; connect-src 'self'; font-src 'self' data: https://fonts.gstatic.com; `
    + "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
}
class BoardError extends Error { constructor(public status: number, message: string) { super(message) } }
function must(result: { error?: unknown }) { if (result.error) throw new BoardError(503, 'board_store_unavailable') }

// Ten maximum-sized documents stay safely below the host's buffered JSON limit.
const PAGE_SIZE = 10
async function rows(db: SupabaseClient, table: string, week: string, collection: string | undefined, offset: number, kind?: string) {
    let query = db.from(table).select('*').eq('week', week)
    if (collection) query = query.eq('collection', collection)
    if (kind) query = query.eq('body->>kind', kind)
    const result = await query.order(table === 'board_ticks' ? 'tick_id' : table === 'board_imports' ? 'source_sha256' : 'doc_id').range(offset, offset + PAGE_SIZE - 1)
    must(result)
    return result.data
}
async function current(db: SupabaseClient, week: string, build?: string) {
  const pointer = await db.from('board_weeks').select('*').eq('week', week).maybeSingle()
  must(pointer)
  const id = build || pointer.data?.build_id
  if (!id) return { manifest: null, revision: 0, build_id: null }
  const result = await db.from('board_builds').select('manifest').eq('week', week).eq('build_id', id).maybeSingle()
  must(result)
  if (!result.data || !validManifest(week, result.data.manifest)) throw new BoardError(404, 'board_build_not_found')
  return { manifest: result.data.manifest as Manifest, revision: pointer.data?.revision || 0, build_id: id }
}
/** When the week's live build was made (board_builds.created_at), or null when the week has none. */
async function builtAt(db: SupabaseClient, week: string, build: string | null): Promise<string | null> {
  if (!build) return null
  const result = await db.from('board_builds').select('created_at').eq('week', week).eq('build_id', build).maybeSingle()
  must(result)
  const at = result.data?.created_at
  return typeof at === 'string' && Number.isFinite(Date.parse(at)) ? at : at instanceof Date ? at.toISOString() : null
}
async function signed(db: SupabaseClient, file: BoardFile, download = false) {
  const result = await db.storage.from(BUCKET).createSignedUrl(file.key, TTL, download ? { download: file.name } : undefined)
  if (result.error || !result.data?.signedUrl) throw new BoardError(503, 'board_file_unavailable')
  return result.data.signedUrl
}
async function verifyFile(db: SupabaseClient, file: BoardFile) {
  const response = await fetch(await signed(db, file), { signal: AbortSignal.timeout(120000), redirect: 'error' })
  if (!response.ok || !response.body) throw new BoardError(422, 'board_file_missing')
  const hash = createHash('sha256'); let bytes = 0
  const reader = response.body.getReader()
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break
      bytes += value.byteLength
      if (bytes > file.bytes) throw new BoardError(422, 'board_file_size_mismatch')
      hash.update(value)
    }
  } finally { await reader.cancel() }
  if (bytes !== file.bytes || hash.digest('hex') !== file.sha256) throw new BoardError(422, 'board_file_hash_mismatch')
  const type = (response.headers.get('content-type') || '').split(';')[0]
  // Supabase deliberately serves stored HTML as text/plain. The authenticated
  // board route supplies text/html only after the immutable bytes were verified.
  if (type !== file.type && !(file.type === 'text/html' && type === 'text/plain')) throw new BoardError(422, 'board_file_type_mismatch')
}

export function createBoardHandler(getDb: () => Promise<SupabaseClient>, deps: PressDeps = {}) {
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Vary', 'Cookie, Authorization')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    const method = req.method || ''
    if (!['GET', 'PUT', 'POST'].includes(method)) return res.status(405).json({ ok: false, error: 'method_not_allowed' })
    const id = scalar(req.query.id)
    let op = scalar(req.query.op), collection = scalar(req.query.collection)
    // A press posted to /api/board/<Monday>/<op> whose op has no rewrite of its own arrives as a collection
    // (vercel.json: /api/board/:week/:collection). `style` cannot have one, since GET /api/board/<Monday>/style is the
    // read-only view of his Pick a style documents, so a POST there is the style press; `cut-verdict` the same.
    if (!op && !id && method === 'POST' && POST_OPS.has(collection)) { op = collection; collection = '' }
    if (op === 'carry') {
      // The cross-week carry (_carry.ts): the engine operator's key only.
      if (!operatorBearerAllowed(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
      if (method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
      const week = scalar(req.query.week)
      if (!monday(week)) return res.status(400).json({ ok: false, error: 'invalid_week' })
      try {
        const result = await carryDay(await getDb(), week, req.body)
        return res.status(result.status).json(result.body)
      } catch { return res.status(503).json({ ok: false, error: 'board_store_unavailable' }) }
    }
    if (op === 'touch') {
      // The week's change signal, bumped by a writer whose change lives outside the board's tables (the week's plan
      // files on GitHub: the good-news run, the revise run, the Sunday ideas run), so the live board reads the
      // view again at once instead of at its next poll. The engine operator's key only; it changes nothing it shows.
      if (!operatorBearerAllowed(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
      if (method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
      const week = scalar(req.query.week)
      if (!monday(week)) return res.status(400).json({ ok: false, error: 'invalid_week' })
      const source = typeof req.body?.source === 'string' && /^[a-z][a-z_-]{0,39}$/.test(req.body.source) ? req.body.source : 'plan'
      try {
        const bumped = await (await getDb()).rpc('board_signal_bump', { p_week: week, p_source: source })
        if (bumped.error) return res.status(503).json({ ok: false, error: 'signal_unavailable' })
        return res.status(200).json({ ok: true, week, revision: bumped.data })
      } catch { return res.status(503).json({ ok: false, error: 'signal_unavailable' }) }
    }
    if (op === 'pieces') {
      // Growth's read (_posted.ts readPieces): which piece sits on which day, and its boxes. The same key; read-only.
      if (!growthWriter(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
      if (method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
      const week = scalar(req.query.week)
      if (!monday(week)) return res.status(400).json({ ok: false, error: 'invalid_week' })
      try {
        const result = await readPieces(await getDb(), week)
        return res.status(result.status).json(result.body)
      } catch { return res.status(503).json({ ok: false, error: 'board_store_unavailable' }) }
    }
    if (op === 'build') {
      // Growth's ledger read (Krish, 2026-11-01: "fix the board manifest unauthorized read"): the week's published
      // build {build_id, revision, manifest}, read-only, on Growth's key or the operator's; never a browser.
      if (!growthWriter(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
      if (method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
      const week = scalar(req.query.week)
      if (!monday(week)) return res.status(400).json({ ok: false, error: 'invalid_week' })
      try {
        const state = await current(await getDb(), week)
        if (!state.build_id) return res.status(404).json({ ok: false, error: 'board_not_published' })
        return res.status(200).json({ ok: true, week, build_id: state.build_id, revision: state.revision, manifest: state.manifest })
      } catch (error) {
        if (error instanceof BoardError) return res.status(error.status).json({ ok: false, error: error.message })
        return res.status(503).json({ ok: false, error: 'board_store_unavailable' })
      }
    }
    if (op === 'posted') {
      // Growth's write-back (_posted.ts): its own key, or the engine operator's; never a browser.
      if (!growthWriter(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
      if (method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
      const week = scalar(req.query.week)
      if (!monday(week)) return res.status(400).json({ ok: false, error: 'invalid_week' })
      try {
        const result = await recordPosted(await getDb(), week, req.body, (deps.now ?? (() => new Date().toISOString()))())
        return res.status(result.status).json(result.body)
      } catch { return res.status(503).json({ ok: false, error: 'board_store_unavailable' }) }
    }
    if (op === 'standards') {
      // The standards page (_standards.ts): the rejection floor in about 20 decisions, on the board's own login. It reads
      // for the board's login or the operator's key; only his login presses (never a session answering for him).
      const who = actor(req)
      if (!who) return res.status(401).json({ ok: false, error: 'unauthorized' })
      try {
        const db = await getDb()
        if (method === 'GET') {
          const page = renderStandards(await readStandards(db))
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.setHeader('X-Frame-Options', 'DENY')
          res.setHeader('Content-Security-Policy', boardPolicy(process.env.SUPABASE_URL))
          return res.status(200).send(page)
        }
        if (method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
        if (who !== 'Krish') return res.status(403).json({ ok: false, error: 'his_decision' })
        const result = await decideStandard(db, req.body)
        return res.status(result.status).json(result.body)
      } catch (error) {
        const status = error instanceof StandardsError ? error.status : 503
        return res.status(status).json({ ok: false, error: error instanceof StandardsError ? error.message : 'standards_unavailable' })
      }
    }
    // The week's board link opens the live board (Krish, 2026-11-10: "Switch fully, move the old board to an archive
    // link"): /board/<Monday> and /board/next/<Monday> serve it; the old baked board is /board/<Monday>?archive=1.
    // Control Centre passes only /board/<Monday> through to the engine, which is why the live board lives there.
    if ((op === 'next' || (op === 'html' && scalar(req.query.archive) !== '1')) && method === 'GET' && monday(scalar(req.query.week))) {
      // The live board's page holds no data, so it is served before the access check: without his cookie it opens on
      // its own "Unlock the board" line instead of a bare 401.
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Frame-Options', 'DENY')
      res.setHeader('Content-Security-Policy', boardPolicy(process.env.SUPABASE_URL))
      // The archive (Ruling, Krish, 2026-11-11): its own requests name the page, so the board refuses its writes.
      res.setHeader('Referrer-Policy', ARCHIVE_REFERRER_POLICY)
      return res.status(200).send(DESK_PAGE)
    }
    const operatorOnly = ['uploads', 'imports', 'sources', 'outcomes'].includes(op) || (!op && !collection && method === 'PUT')
    const who = actor(req, operatorOnly)
    if (!who) return res.status(401).json({ ok: false, error: 'unauthorized' })
    // One live board (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old board is a read-only
    // archive): a press made on one of the engine's own board pages is refused, and says where to make it.
    if (who === 'Krish' && method !== 'GET' && fromArchivePage(req.headers.referer)) {
      return res.status(423).json({ ok: false, error: 'archive_read_only', live: liveBoardUrl(monday(scalar(req.query.week)) ? scalar(req.query.week) : null) })
    }
    try {
      const db = await getDb()
      if (op === 'weeks' && method === 'GET') {
        const result = await db.from('board_weeks').select('week').order('week', { ascending: false })
        must(result)
        return res.status(200).json({ ok: true, weeks: result.data.map(r => weekDate(r.week)) })
      }
      if (op === 'latest' && method === 'GET') {
        const result = await db.from('board_weeks').select('week').order('week', { ascending: false }).limit(1)
        must(result)
        if (!result.data.length) throw new BoardError(404, 'no_published_board')
        return res.redirect(303, `/board/${weekDate(result.data[0].week)}`)
      }
      if (op === 'next' && method === 'GET' && !scalar(req.query.week)) {
        // The live board without a week opens on the newest one (docs/plans/2026-11-09-board-desk/PLAN.md).
        const result = await db.from('board_weeks').select('week').order('week', { ascending: false }).limit(1)
        must(result)
        if (!result.data.length) throw new BoardError(404, 'no_published_board')
        return res.redirect(303, `/board/${weekDate(result.data[0].week)}`)
      }
      const week = scalar(req.query.week)
      if (!monday(week)) throw new BoardError(400, 'invalid_week')
      if (op === 'next') throw new BoardError(405, 'method_not_allowed')
      if (op === 'view') {
        // The week as it stands now, each day with its next step and the actions that start it (_view.ts).
        if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
        // Its entity tag names what it says (_viewContract.ts), so Control Centre can ask every few seconds and a read
        // that finds nothing new is a 304 with no body. no-cache, not no-store: a browser may keep it but always asks.
        const view = { ok: true, ...(await readView(db, week)) }
        const etag = viewEtag(view)
        res.setHeader('Cache-Control', 'private, no-cache')
        res.setHeader('ETag', etag)
        if (notModified(req.headers['if-none-match'], etag)) return res.status(304).end()
        return res.status(200).json(view)
      }
      if (op === 'gate') {
        // The ideas gate for the week (_gate.ts): every piece on a day with the approval that holds it there, and every
        // piece or option held because none does. Read-only; the same view the live board draws.
        if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
        const view = await readView(db, week)
        return res.status(200).json({ ok: true, week, approvals_read: view.sources.approvals === true,
          days: view.days.map(d => ({ day: d.day, date: d.date, pieces: d.pieces.map(p => ({ id: p.id, title: p.title, approval: p.approval ?? null })),
            held: d.held, options: d.options.map(o => ({ id: o.id, doc_id: o.doc_id, title: o.title, status: o.status, outcome: o.outcome ?? null, held: o.held ?? null })) })) })
      }
      if (op === 'outcomes') {
        // His answers on the week's ideas board, for its scorecard (scripts/post-pack/board_feed.py scorecard; the ideas
        // quality plan, item 11): every idea_outcomes row of the week (append only, his words), and for a board from
        // before the ideas gate its board_history presses, the triage marks filed from it and the pieces scheduled from
        // its options. Read-only, the engine key only.
        if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
        // A cue counts only on one of this board's own options (presses_from), so its window can be wide.
        const from = new Date(`${week}T00:00:00Z`); from.setUTCDate(from.getUTCDate() - 10)
        const until = new Date(`${week}T00:00:00Z`); until.setUTCDate(until.getUTCDate() + 14)
        const [outcomes, history, triage, scheduled, cues] = await Promise.all([
          db.from('idea_outcomes').select('id,week,day,date,idea_id,option_ref,doc,outcome,via,words,decided_by,decided_at,source').eq('week', week)
            .order('decided_at', { ascending: true }).limit(2000),
          db.from('board_history').select('collection,doc_id,revision,body,updated_at,updated_by').eq('week', week).in('collection', ['picks', 'queue'])
            .order('updated_at', { ascending: true }).limit(2000),
          db.from('content_ideas').select('id,meta').eq('meta->queue->>from_week', week).limit(300),
          db.from('content_ideas').select('id,scheduled_for,updated_at,meta').eq('meta->week_option->>week_start', week).not('scheduled_for', 'is', null).limit(50),
          // His words on the board's ideas filed as cues from the queue (the 26 Oct board's "Ditch 4" is only here).
          db.from('feedback_cues').select('subject_ref,use,said,said_at,use_origin').eq('venture', 'publication').eq('source', 'idea_queue')
            .gte('said_at', from.toISOString()).lt('said_at', until.toISOString()).limit(500),
        ])
        must(outcomes); must(history); must(triage); must(scheduled)
        const meta = (r: Record<string, any>) => (r.meta && typeof r.meta === 'object' ? r.meta : {})
        return res.status(200).json({ ok: true, week, outcomes: outcomes.data || [], history: history.data || [],
          triage: (triage.data || []).map((r: Record<string, any>) => ({ id: r.id, triage: meta(r).queue?.triage ?? null, from_pick: meta(r).queue?.from_pick ?? null })),
          scheduled: (scheduled.data || []).map((r: Record<string, any>) => ({ id: r.id, week_option: meta(r).week_option ?? null, picked_at: meta(r).week_option?.at ?? null })),
          cues: cues.error ? [] : cues.data || [] })
      }
      if (op === 'media') {
        // One rendered file of this week's pieces (_media.ts): its id from the view, answered with a short signed link.
        if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
        if (!/^[a-f0-9]{64}$/.test(id)) throw new BoardError(404, 'media_not_found')
        const end = new Date(`${week}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 6)
        let url: string | null
        try { url = await signMedia(db, week, end.toISOString().slice(0, 10), id) } catch { throw new BoardError(503, 'board_store_unavailable') }
        if (!url) throw new BoardError(404, 'media_not_found')
        return res.redirect(302, url)
      }
      if (op === 'research' || op === 'material' || op === 'look' || op === 'style' || op === CUT_OP) {
        // The day path's presses on a piece of this week (_research.ts): research it now (sonar-pro), file research he
        // dropped, his pick of the look, his pick or "Not this" of a motion or caption style (_style.ts, contract
        // 1.4.0), and his Yes or Not this on one of its cuts (_cuts.ts, contract 1.6.0). His press only; the piece must
        // be scheduled inside this week.
        if (method !== 'POST') throw new BoardError(405, 'method_not_allowed')
        if (who !== 'Krish') throw new BoardError(403, 'his_press')
        const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
        const pieceId = String(body.piece_id || '').toLowerCase()
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(pieceId)) throw new BoardError(400, 'invalid_piece')
        const row = await db.from('content_ideas').select('id,idea,scheduled_for,lane_slot').eq('id', pieceId).single()
        const end = new Date(`${week}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 6)
        if (row.error || !row.data || !row.data.scheduled_for || row.data.scheduled_for < week || row.data.scheduled_for > end.toISOString().slice(0, 10))
          throw new BoardError(404, 'piece_not_in_week')
        try {
          if (op === 'material') {
            const name = String(body.title || 'Research').slice(0, 180)
            // A storyboard the session made is filed with its role in the title, so the day knows one is on file.
            const title = body.role === 'storyboard' && !/^Storyboard:/.test(name) ? `Storyboard: ${name}` : name
            const filed = await fileMaterial(db, pieceId, { kind: 'file', title, content: String(body.content || ''), by: 'Krish' })
            return res.status(201).json({ ok: true, material: filed })
          }
          if (op === 'research') {
            if (await recentResearch(db, pieceId)) throw new MaterialError(409, 'research_just_ran')
            const view = await readView(db, week)
            const day = view.days.find(d => d.piece_id === pieceId)
            const prompt = day?.path?.prompts.research || researchPrompt({ week, day: '', dayName: '', date: String(row.data.scheduled_for), series: String(row.data.lane_slot || ''),
              pieceId, idea: String(row.data.idea || ''), materials: [], lock: null })
            const found = await researchForPiece(pieceId, prompt)
            if (!found.text) throw new MaterialError(502, 'research_failed')
            const filed = await fileMaterial(db, pieceId, { kind: 'research', title: `Engine research (sonar-pro), ${new Date().toISOString().slice(0, 10)}`, content: found.text, by: 'Krish' })
            return res.status(201).json({ ok: true, material: filed, sources: found.sources.length })
          }
          if (op === CUT_OP) {
            // His answer on one cut, kept append only on the piece (meta.cut_verdicts). It never changes the cut. A Not
            // this also goes where his other rejections go (his taste ledger, the rejection inbox, the failure loop),
            // once, never blocking the press (fileCutLearning).
            const saved = await saveCut(db, pieceId, cutPick(body))
            const learned = saved.already ? null : await fileCutLearning(db, { week, date: String(row.data.scheduled_for), pieceId }, saved.verdict)
            return res.status(200).json({ ok: true, cut_verdict: saved.verdict, already: saved.already, ...(learned ? { learned } : {}) })
          }
          if (op === 'style') {
            // The motion styles are the bank's motion layer, read from main only when the press names one; the caption
            // styles are config/caption-themes.json. It writes meta.style beside meta.look and never edits a spec.
            const motion = needsMotion(body) ? await fetch(`https://raw.githubusercontent.com/krishanraja/content-engine/main/config/style-references.json`, { signal: AbortSignal.timeout(15_000) })
              .then(r => (r.ok ? r.json() : null)).catch(() => null)
              .then((b: { bank?: Array<{ id?: unknown; layer?: unknown }> } | null) => new Set((b?.bank || []).filter(m => m.layer === 'motion' && typeof m.id === 'string').map(m => String(m.id))))
              : null
            const style = await saveStyle(db, pieceId, stylePick(body, motion))
            return res.status(200).json({ ok: true, style })
          }
          // The looks the engine can make, read once from the style bank: a production format, and any format as the experiment.
          const bank = await fetch(`https://raw.githubusercontent.com/krishanraja/content-engine/main/config/style-references.json`, { signal: AbortSignal.timeout(15_000) })
            .then(r => (r.ok ? r.json() : null)).catch(() => null) as { formats?: { production?: Array<{ id: string }>; script?: Array<{ id: string }> } } | null
          const production = new Set((bank?.formats?.production || []).map(f => f.id))
          if (!production.size) throw new MaterialError(503, 'styles_unavailable')
          const any = new Set([...production, ...(bank?.formats?.script || []).map(f => f.id)])
          const experiment = body.experiment ? String(body.experiment) : null
          if (experiment && !any.has(experiment)) throw new MaterialError(400, 'unknown_format')
          const look = await saveLook(db, pieceId, { production: String(body.production || ''), experiment,
            inspiration: Array.isArray(body.inspiration) ? body.inspiration.map(String) : [] }, new Set([...production, ...(experiment ? [experiment] : [])]))
          return res.status(200).json({ ok: true, look })
        } catch (e) {
          if (e instanceof MaterialError || e instanceof StyleError || e instanceof CutError) throw new BoardError(e.status, e.message)
          throw e
        }
      }
      if (op === 'run') {
        // A press that starts the machine that does the work (_run.ts): his press only, an allow-listed job only.
        if (method !== 'POST') throw new BoardError(405, 'method_not_allowed')
        if (who !== 'Krish') throw new BoardError(403, 'his_press')
        const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
        if (!isJob(body.job)) throw new BoardError(400, 'unknown_job')
        const input = body.input && typeof body.input === 'object' && !Array.isArray(body.input) ? body.input as Record<string, unknown> : {}
        const sent = await dispatchJob(body.job, input)
        if (sent.sent) return res.status(202).json({ ok: true, ...sent })
        return res.status('reason' in sent && sent.reason === 'invalid_input' ? 400 : 503).json({ ok: false, ...sent })
      }
      const offset = Number(req.query.offset || 0)
      if (!Number.isSafeInteger(offset) || offset < 0) throw new BoardError(400, 'invalid_offset')
      if (op === 'state') {
        // The live state the Today view reads on every poll (Krish, 2026-11-02: "the whole Today board seems totally
        // outdated, and I can barely ever see what the current state of things are there"): his yes for each day
        // (_yes.ts), what Growth has posted (its ticks), and the build that is live, so an open tab can say it is old.
        // And the live overlay (_live.ts; Ruling, Krish, 2026-11-03: "The Publish Board should just be makeyourmindup
        // weekly content calendar, always up to date"): each day's piece as its making record holds it now, and
        // whether any piece was written after the live build was made (rebuild_needed).
        if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
        const said = await db.from('board_documents').select('doc_id,body,updated_by').eq('week', week).eq('collection', 'picks')
          .or('doc_id.like.yes-%,doc_id.like.%-publish')
        must(said)
        const ticks = await db.from('board_ticks').select('tick_id,body,updated_by').eq('week', week)
        must(ticks)
        const posted: Record<string, string[]> = {}
        for (const t of ticks.data || []) {
          const b = t.body as Record<string, unknown> | null
          if (!b || b.done !== true || t.updated_by !== 'growth' || typeof b.day !== 'string' || typeof b.step !== 'string') continue
          ;(posted[b.day] ||= []).push(b.step)
        }
        const active = await current(db, week)
        const built_at = await builtAt(db, week, active.build_id)
        // An overlay that cannot be read never costs him his yes or Growth's ticks: live is null, and the page keeps
        // what it was built with until the next poll.
        const overlay = await weekLive(db, week, built_at).catch(() => ({ live: null, rebuild_needed: false }))
        return res.status(200).json({ ok: true, week, build_id: active.build_id, built_at, yes: yesByDay((said.data || []) as YesRow[]), posted,
          live: overlay.live, rebuild_needed: overlay.rebuild_needed })
      }
      if (collection === 'archive') {
        // The Archive (_archive.ts): every published piece and his scores, read-only.
        if (method !== 'GET' || id) throw new BoardError(400, 'read_only_view')
        const archive = await readArchive(db).catch(() => { throw new BoardError(503, 'board_store_unavailable') })
        return res.status(200).json({ ok: true, week, collection, ...archive })
      }
      if (collection && Object.hasOwn(views, collection)) {
        // A read-only view of his day decisions in picks (views in _contracts.ts): listed, never written.
        if (method !== 'GET' || id) throw new BoardError(400, 'read_only_view')
        const data = await rows(db, 'board_documents', week, 'picks', offset, views[collection as View])
        return res.status(200).json({ ok: true, week, collection, next_offset: data.length === PAGE_SIZE ? offset + PAGE_SIZE : null, documents: data.map(r => ({ id: r.doc_id, body: r.body, revision: r.revision, updated_at: r.updated_at, updated_by: r.updated_by })) })
      }
      if (collection) {
        if (!collections.includes(collection as typeof collections[number])) throw new BoardError(400, 'invalid_collection')
        if (method === 'GET' && !id) {
          const data = await rows(db, collection === 'ticks' ? 'board_ticks' : 'board_documents', week, collection === 'ticks' ? undefined : collection, offset)
          return res.status(200).json({ ok: true, week, collection, next_offset: data.length === PAGE_SIZE ? offset + PAGE_SIZE : null, documents: data.map(r => ({ id: r.tick_id || r.doc_id, body: r.body, revision: r.revision, updated_at: r.updated_at, updated_by: r.updated_by })) })
        }
        if (method !== 'PUT' || !validBody(collection, id, req.body?.body) || !revision(req.body?.revision)) throw new BoardError(400, 'invalid_document_write')
        const refused = hisOnlyRefusal(collection, req.body.body, who)
        if (refused) throw new BoardError(403, refused)
        // A pick or a press he saved stays his: any other writer is refused it, whatever its new body carries, since a
        // body without his marks would erase his press, and every reader skips a document he did not write. A save he
        // makes between this read and the write below changes the revision, so that write is refused as a conflict.
        if (who !== 'Krish' && (collection === 'picks' || collection === 'queue')) {
          const held = await db.from('board_documents').select('updated_by').eq('week', week).eq('collection', collection).eq('doc_id', id).maybeSingle()
          must(held)
          if (held.data?.updated_by === 'Krish') throw new BoardError(403, 'his_document')
        }
        if (collection === 'comments' && req.body.body.thread_id !== id) {
          const parent = await db.from('board_documents').select('body').eq('week', week).eq('collection', 'comments').eq('doc_id', req.body.body.thread_id).maybeSingle()
          must(parent)
          if (!parent.data || parent.data.body.thread_id !== req.body.body.thread_id || parent.data.body.anchor !== req.body.body.anchor) throw new BoardError(400, 'comment_thread_not_found')
        }
        // His presses (_presses.ts): an approval of scripts binds the hash of the words he saw, then sends them to
        // Teleprompter once they are checked and read back; a rejected asset files his reason in the rejection inbox.
        let incoming = req.body.body
        if (collection === 'queue' && incoming.use === 'offday' && incoming.note_only === true) {
          // His comment added to an off-day option he already pressed: the press stays exactly as saved (its send
          // included) and only his note changes; afterPress then does nothing again.
          const stored = await db.from('board_documents').select('body').eq('week', week).eq('collection', 'queue').eq('doc_id', id).maybeSingle()
          must(stored)
          const was = stored.data?.body
          if (!was || was.use !== 'offday' || typeof was.approved !== 'boolean') throw new BoardError(409, 'offday_press_not_found')
          incoming = { ...was, note: incoming.note, at: incoming.at ?? was.at, note_only: true }
        }
        const body = await preparePress(collection, id, incoming)
        const result = await db.rpc('board_save', { p_week: week, p_collection: collection, p_id: id, p_body: body, p_revision: req.body.revision, p_actor: who })
        must(result)
        const after = await afterPress(db, { week, collection, id, body, who, saved: result.data }, deps)
        return res.status(result.data.ok ? 200 : 409).json(after || result.data)
      }
      if (op === 'uploads' && method === 'POST') {
        const file = req.body?.file
        if (!fileSpec(week, file, file?.type === 'text/html')) throw new BoardError(400, 'invalid_file')
        const bucket = await db.storage.getBucket(BUCKET)
        if (bucket.error || !bucket.data || bucket.data.public) throw new BoardError(503, 'private_library_required')
        // An existing object is immutable. Its bytes are verified at activation.
        const info = await db.storage.from(BUCKET).info(file.key)
        if (!info.error) return res.status(200).json({ ok: true, exists: true })
        const upload = await db.storage.from(BUCKET).createSignedUploadUrl(file.key, { upsert: false })
        if (upload.error || !upload.data?.signedUrl) throw new BoardError(503, 'board_upload_unavailable')
        return res.status(200).json({ ok: true, upload_url: upload.data.signedUrl })
      }
      if (op === 'imports') {
        if (method === 'GET') {
          const records = await rows(db, 'board_imports', week, undefined, offset)
          return res.status(200).json({ ok: true, records, next_offset: records.length === PAGE_SIZE ? offset + PAGE_SIZE : null })
        }
        const records = req.body?.records
        if (method !== 'POST' || !Array.isArray(records) || records.length > 100 || Buffer.byteLength(JSON.stringify(records)) > 1024 * 1024) throw new BoardError(400, 'invalid_import')
        const values = records.map(r => {
          if (!r || !/^https:\/\/claude\.ai\/artifact\/[a-zA-Z0-9]+$/.test(r.source || '') || !validSourceBody(r.collection, r.id, r.body)) throw new BoardError(400, 'invalid_import_record')
          const raw = { week, source: r.source, collection: r.collection, id: r.id, body: r.body }
          return { week, source: r.source, collection: r.collection, doc_id: r.id, body: r.body, source_sha256: digest(canonical(raw)) }
        })
        const result = await db.from('board_imports').upsert(values, { onConflict: 'source_sha256', ignoreDuplicates: true })
        must(result)
        return res.status(200).json({ ok: true, hashes: values.map(r => r.source_sha256) })
      }
      if (op === 'sources') {
        if (method === 'GET') {
          const found = await db.from('board_sources').select('*').eq('week', week)
          must(found); return res.status(200).json({ ok: true, sources: found.data })
        }
        const { source, files } = req.body || {}
        const unavailable = files?.manifest_unavailable
        const manifestRecorded = files?.manifest
          ? fileSpec(week, files.manifest) && !unavailable
          : unavailable?.accessible === false && typeof unavailable.reason === 'string' && unavailable.reason.trim().length > 0 && Buffer.byteLength(JSON.stringify(unavailable)) < 10000
        if (method !== 'POST' || !/^https:\/\/claude\.ai\/artifact\/[a-zA-Z0-9]+$/.test(source || '') || !files
          || !fileSpec(week, files.export) || !fileSpec(week, files.html, true) || !manifestRecorded) throw new BoardError(400, 'invalid_source_archive')
        for (const f of [files.export, files.html, ...(files.manifest ? [files.manifest] : [])]) await verifyFile(db, f)
        const stored = await db.from('board_sources').upsert({ export_sha256: files.export.sha256, week, source, files }, { onConflict: 'export_sha256', ignoreDuplicates: true })
        must(stored); return res.status(200).json({ ok: true, export_sha256: files.export.sha256 })
      }
      const build = scalar(req.query.build)
      if (build && !/^[a-f0-9]{64}$/.test(build)) throw new BoardError(400, 'invalid_build')
      if (!op && method === 'PUT') {
        const manifest = req.body?.manifest
        if (!validManifest(week, manifest) || !revision(req.body?.revision)) throw new BoardError(400, 'invalid_manifest')
        const { delivery_review, ...reviewedManifest } = manifest
        try { if (mediaQualityEnforced()) await qualifyBoard(db, reviewedManifest, delivery_review) }
        catch (e) { throw new BoardError(e instanceof MediaQualityError ? 409 : 503, e instanceof MediaQualityError ? e.message : 'media_quality_unavailable') }
        const buildId = digest(canonical(manifest))
        // Even a replay verifies retrievability; metadata alone is not proof.
        for (const file of [manifest.html, ...Object.values(manifest.assets)]) await verifyFile(db, file)
        const result = await db.rpc('board_activate', { p_week: week, p_build: buildId, p_manifest: manifest, p_revision: req.body.revision, p_actor: who })
        must(result)
        return res.status(result.data.ok ? 200 : 409).json({ ...result.data, media_quality_rollout: mediaQualityRollout().status })
      }
      if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
      const state = await current(db, week, build)
      const enforced = mediaQualityEnforced()
      let quality: 'qualified' | 'unqualified' | 'historical' | 'candidate_pending_calibration' = enforced ? 'historical' : 'candidate_pending_calibration'
      if (enforced && !build && state.manifest?.delivery_review) {
        const { delivery_review, ...reviewedManifest } = state.manifest
        try { await qualifyBoard(db, reviewedManifest, delivery_review); quality = 'qualified' }
        catch { quality = 'unqualified' }
      }
      // Metadata remains readable for repair. Explicit build reads are historical;
      // a revoked current build cannot continue presenting itself as ready.
      res.setHeader('X-Media-Qualification', quality)
      if (!op) return res.status(200).json({ ok: true, ...state, media_qualification: quality, media_quality_rollout: mediaQualityRollout().status })
      if (quality === 'unqualified') throw new BoardError(409, 'board_media_review_no_longer_valid')
      if (!state.manifest) throw new BoardError(404, 'board_not_published')
      if (op === 'assets') {
        if (!validId(id)) throw new BoardError(404, 'asset_not_found')
        const sha = scalar(req.query.sha)
        let file = state.manifest.assets[id]
        if (sha && (!file || file.sha256 !== sha)) {
          if (!/^[a-f0-9]{64}$/.test(sha)) throw new BoardError(400, 'invalid_asset_hash')
          const old = await db.from('board_builds').select('manifest').eq('week', week).contains('manifest', { assets: { [id]: { sha256: sha } } }).limit(1)
          must(old)
          file = old.data[0]?.manifest?.assets?.[id]
        }
        if (!file || !fileSpec(week, file)) throw new BoardError(404, 'asset_not_found')
        // ?link=1: the same signed link the redirect gives, as JSON, for Copy article to hand Substack. The board page may
        // only connect to its own site, so it cannot follow the redirect to read it. A picture only, never a download.
        if (scalar(req.query.link) === '1') {
          if (!file.type.startsWith('image/')) throw new BoardError(404, 'asset_not_found')
          res.setHeader('Cache-Control', 'private, no-store')
          return res.status(200).json({ ok: true, url: await signed(db, file) })
        }
        return res.redirect(303, await signed(db, file, true))
      }
      if (op === 'html') {
        const upstream = await fetch(await signed(db, state.manifest.html), { signal: AbortSignal.timeout(120000), redirect: 'error' })
        if (!upstream.ok || !upstream.body) throw new BoardError(503, 'board_html_unavailable')
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('X-Frame-Options', 'DENY')
        res.setHeader('Content-Security-Policy', boardPolicy(process.env.SUPABASE_URL))
        res.setHeader('X-Board-Build', state.build_id)
        // The baked board is the archive (Ruling, Krish, 2026-11-11): Krish reads it with the banner and the read-only
        // guard; a session's download (the operator's key, week_board.py --previous) gets the bytes as built.
        if (who === 'Krish') {
          res.setHeader('Referrer-Policy', ARCHIVE_REFERRER_POLICY)
          return res.status(200).send(readOnlyArchive(await upstream.text(), week))
        }
        res.status(200)
        await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), res)
        return
      }
      throw new BoardError(404, 'board_route_not_found')
    } catch (error) {
      if (res.headersSent) { res.end(); return }
      const known = error instanceof BoardError || error instanceof PressError
      return res.status(known ? error.status : 503).json({ ok: false, error: known ? error.message : 'board_unavailable' })
    }
  }
}
