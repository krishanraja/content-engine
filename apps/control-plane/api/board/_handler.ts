import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LIVE_ID, actor, growthWriter, collections, hisOnlyRefusal, monday, revision, validBody, validManifest, views, type Manifest, type View } from './_contracts.js'
import { PressError, afterPress, preparePress, type PressDeps } from './_presses.js'
import { readPieces, recordPosted } from './_posted.js'
import { carryDay } from './_carry.js'
import { branchSha, readView, readWeekIdeas } from './_view.js'
import { signMedia } from './_media.js'
import { ManifestBindError, checkPublishBind } from './_manifest.js'
import { DRIVE_ID, boardDrive, filesOfPosts } from './_drivePosts.js'
import { notModified, viewEtag } from './_viewContract.js'
import { dispatchJob, isJob } from './_run.js'
import { MaterialError, fileMaterial, recentResearch, researchForPiece, saveLook } from './_research.js'
import { researchPrompt } from './_prompts.js'
import { StyleError, needsMotion, saveStyle, stylePick } from './_style.js'
import { CUT_OP, CutError, cutPick, fileCutLearning, saveCut } from './_cuts.js'
import { LIVE_OP, recordLive } from './_itsLive.js'
import { SIGN_OFF_OP, SignOffError, checkAgainst, readSignOffPresses, readSignOffSources, recordSignOff, signOffFiles, signOffPick } from './_signOffs.js'
import { readLater } from './_later.js'
import { liveBoardUrl } from './_liveBoard.js'
import { StandardsError, decideStandard, readStandards, renderStandards } from './_standards.js'
import { operatorBearerAllowed } from '../_auth.js'
import { qualifyBoard } from '../_mediaQuality.js'
import { mediaQualityEnforced, mediaQualityRollout } from '../../../../packages/core/src/media-rollout.js'

/** The presses posted to /api/board/<Monday>/<op> that reach the handler as a collection (no rewrite of their own). */
const POST_OPS: ReadonlySet<string> = new Set(['style', CUT_OP, LIVE_OP, SIGN_OFF_OP, 'replace'])
/** The ops vercel.json gives the old board pages' addresses (/board/<Monday>, /board, /board/next[/<Monday>]): each is
 *  a permanent redirect to the live board now (Ruling, Krish, 2026-11-13). */
const OLD_PAGES: ReadonlySet<string> = new Set(['html', 'next', 'latest'])
const scalar = (v: unknown) => typeof v === 'string' ? v : ''
const weekDate = (v: string | Date) => (v instanceof Date ? v.toISOString() : v).slice(0, 10)
/** The standards page's content security policy (the old board pages that also wore it are retired: Ruling, Krish,
 *  2026-11-13). img-src and media-src name the engine's file store's origin; nothing else widens. */
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
    const result = await query.order(table === 'board_ticks' ? 'tick_id' : 'doc_id').range(offset, offset + PAGE_SIZE - 1)
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
/** The post folders' renamer for a move (_offdayItems.ts followDrive), as the owner of his Drive with the `drive` scope
 *  the research library signs in with; null when the engine cannot sign in to Google. */
async function moveRenamer() {
  const { googleAccessToken } = await import('../_google.js')
  const token = await googleAccessToken(['https://www.googleapis.com/auth/drive'], { subject: process.env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co' }).catch(() => null)
  if (!token) return null
  const { googleDriveRenamer } = await import('./_offdayItems.js')
  return googleDriveRenamer(token)
}
/** The research library's index rows of a piece he records follow its new day (_offdayLibrary.ts). */
async function moveLibrary(db: SupabaseClient) {
  const { libraryFollower } = await import('./_offdayLibrary.js')
  return libraryFollower(db)
}

/** A view read that does not need the week's posts in Drive (the gate, a research prompt). */
const NO_DRIVE = async () => null

export function createBoardHandler(getDb: () => Promise<SupabaseClient>, deps: PressDeps = {}) {
  /** The board's Drive (_drivePosts.ts), as the folder's owner; a test passes its own. */
  const driveOf = (db: SupabaseClient) => (deps.drive ? deps.drive(db) : boardDrive(db as never))
  /** The sign-off cards (config/ve/sign-offs.json and the configs it writes), from main at the commit it points at now. */
  const signOffSources = () => (deps.signOffs ? deps.signOffs()
    : branchSha(fetch as never, process.env, 'main').then(sha => readSignOffSources(fetch as never, sha)))
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Vary', 'Cookie, Authorization')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    const method = req.method || ''
    let op = scalar(req.query.op), collection = scalar(req.query.collection)
    if (OLD_PAGES.has(op)) {
      // The old publish boards are retired for good (Ruling, Krish, 2026-11-13: "We need to retire the old publish
      // boards now permanently"): every address of one, a week (/board/<Monday>, ?archive=1 included), the newest
      // (/board) and the desk (/board/next, /board/next/<Monday>), answers a permanent redirect to the live board in
      // Control Centre at the same week. No page is served and nothing is read.
      const week = scalar(req.query.week)
      return res.redirect(308, liveBoardUrl(monday(week) ? week : null, scalar(req.query.day) || null))
    }
    if (!['GET', 'PUT', 'POST'].includes(method)) return res.status(405).json({ ok: false, error: 'method_not_allowed' })
    const id = scalar(req.query.id)
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
    if (op === 'offdays' || op === 'offday-posts') {
      // Growth's half of the one place an off-day item's day lives (_offdayItems.ts; Ruling, Krish, 2026-11-12): GET
      // offdays reads the week's items where they are now; POST offdays offers Growth's own options for the week (they
      // reach the board offered, his press approves them); POST offday-posts writes back what Growth made, scheduled
      // (with its time) and posted (with its link) for each, from its own record, so the board shows it out and says
      // plainly what is still scheduled for a day an item left. Growth's key only.
      if (!growthWriter(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
      const week = scalar(req.query.week)
      if (!monday(week)) return res.status(400).json({ ok: false, error: 'invalid_week' })
      try {
        const db = await getDb()
        const { itemsForGrowth, offerGrowth, readItems, reportPosts } = await import('./_offdayItems.js')
        if (op === 'offdays' && method === 'GET') {
          const items = await readItems(db, week)
          if (!items) return res.status(503).json({ ok: false, error: 'board_store_unavailable' })
          return res.status(200).json({ ok: true, week, items: itemsForGrowth(items, week) })
        }
        if (method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
        const result = op === 'offdays' ? await offerGrowth(db, week, req.body, await (deps.ideas ?? readWeekIdeas)(week)) : await reportPosts(db, week, req.body, deps.now ? new Date(deps.now()) : new Date())
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
    if (op === 'judge') {
      // content-engine's 10/10 judges on Growth's carousels and Shorts (_judge.ts; Ruling, Krish, 2026-11-12: "Judge
      // them; count passes."): judge one post, bind a pass to its Buffer post, or mark posts live. Growth's key only.
      if (!growthWriter(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
      if (method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
      const week = scalar(req.query.week)
      if (!monday(week)) return res.status(400).json({ ok: false, error: 'invalid_week' })
      try {
        const { judgeAsset } = await import('./_judge.js')
        const result = await judgeAsset(await getDb(), week, req.body, { ...(deps.judgePanel ? { panel: deps.judgePanel } : {}), ...(deps.now ? { now: () => new Date(deps.now!()) } : {}) })
        return res.status(result.status).json(result.body)
      } catch { return res.status(503).json({ ok: false, error: 'judgements_unavailable' }) }
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
    const operatorOnly = op === 'outcomes'
    const who = actor(req, operatorOnly)
    if (!who) return res.status(401).json({ ok: false, error: 'unauthorized' })
    try {
      const db = await getDb()
      if (op === 'weeks' && method === 'GET') {
        const result = await db.from('board_weeks').select('week').order('week', { ascending: false })
        must(result)
        return res.status(200).json({ ok: true, weeks: result.data.map(r => weekDate(r.week)) })
      }
      if (op === 'later') {
        // Ideas for later (_later.ts): every option on every ideas board he neither approved nor rejected, grouped,
        // each with the five presses of the ideas gate. Read-only; his login or the operator's key.
        if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
        try {
          const later = await readLater(db)
          res.setHeader('Cache-Control', 'private, no-cache')
          return res.status(200).json(later)
        } catch { throw new BoardError(503, 'board_store_unavailable') }
      }
      if (op === 'sign-offs') {
        // The video sign-off cards (_signOffs.ts, contract 1.11.0), on no week: his presses for the job that writes the
        // configs (signoff-apply.yml, the engine key), and one sample's bytes by its Drive id (?file=), only a sample a
        // card shows, as a short signed link (302, or {url} with link=1) to the board's copy of it. Read-only.
        if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
        const file = scalar(req.query.file)
        if (file) {
          let url: string | null
          try {
            const { manifest } = await signOffSources()
            if (!manifest) throw new BoardError(503, 'sign_offs_unavailable')
            if (!signOffFiles(manifest).has(file)) throw new BoardError(404, 'sample_not_found')
            url = await driveOf(db).serve(file)
          } catch (e) { if (e instanceof BoardError) throw e; throw new BoardError(503, 'drive_unavailable') }
          if (!url) throw new BoardError(404, 'sample_not_found')
          res.setHeader('Cache-Control', 'private, max-age=300')
          if (scalar(req.query.link) === '1') return res.status(200).json({ ok: true, url })
          return res.redirect(302, url)
        }
        const presses = await readSignOffPresses(db)
        if (!presses) throw new BoardError(503, 'board_store_unavailable')
        return res.status(200).json({ ok: true, presses })
      }
      const week = scalar(req.query.week)
      if (!monday(week)) throw new BoardError(400, 'invalid_week')
      if (op === 'view') {
        // The week as it stands now, each day with its next step and the actions that start it (_view.ts).
        if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
        // Its entity tag names what it says (_viewContract.ts), so Control Centre can ask every few seconds and a read
        // that finds nothing new is a 304 with no body. no-cache, not no-store: a browser may keep it but always asks.
        const view = { ok: true, ...(await readView(db, week, process.env, undefined, undefined, w => driveOf(db).posts(w))) }
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
        const view = await readView(db, week, process.env, undefined, undefined, NO_DRIVE)
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
        // The library's copy first; a file the library lacks is served from its Drive copy (_media.ts, contract 1.7.0).
        try { url = await signMedia(db, week, end.toISOString().slice(0, 10), id, fileId => driveOf(db).serve(fileId)) } catch { throw new BoardError(503, 'board_store_unavailable') }
        if (!url) throw new BoardError(404, 'media_not_found')
        res.setHeader('Cache-Control', 'private, max-age=300')
        return res.redirect(302, url)
      }
      if (op === 'drive') {
        // One file of the week's posts in Drive (_drivePosts.ts; contract 1.7.0): only a file the view lists for this
        // week (an asset, a slide or a version of one), answered with a short signed link to the board's copy of it.
        if (method !== 'GET') throw new BoardError(405, 'method_not_allowed')
        if (!DRIVE_ID.test(id)) throw new BoardError(404, 'drive_file_not_found')
        const drive = driveOf(db)
        let url: string | null
        try {
          const posts = await drive.posts(week)
          if (!posts) throw new BoardError(503, 'drive_unavailable')
          if (!filesOfPosts(posts).has(id)) throw new BoardError(404, 'drive_file_not_found')
          url = await drive.serve(id)
        } catch (e) { if (e instanceof BoardError) throw e; throw new BoardError(503, 'drive_unavailable') }
        if (!url) throw new BoardError(404, 'drive_file_not_found')
        res.setHeader('Cache-Control', 'private, max-age=300')
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
            const view = await readView(db, week, process.env, undefined, undefined, NO_DRIVE)
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
      if (op === LIVE_OP) {
        // "It's live" (_itsLive.ts, contract 1.7.0): a post he marked live, with its link and channels, appended to
        // picks/live-<day> and copied onto the piece's making record. His press only, never a session's or Growth's.
        if (method !== 'POST') throw new BoardError(405, 'method_not_allowed')
        if (who !== 'Krish') throw new BoardError(403, 'live_is_his')
        const result = await recordLive(db, week, req.body, who, (deps.now ?? (() => new Date().toISOString()))())
        return res.status(result.status).json(result.body)
      }
      if (op === SIGN_OFF_OP) {
        // His Approve or Not this on a sign-off card's sample (_signOffs.ts, contract 1.11.0; Ruling, Krish, 2026-11-12:
        // only his presses write the configs). His login only; kept append only on picks/signoff-<card> of this week.
        // It writes no config itself: it starts signoff-apply.yml, which reads his presses back from the board.
        if (method !== 'POST') throw new BoardError(405, 'method_not_allowed')
        if (who !== 'Krish') throw new BoardError(403, 'his_press')
        try {
          const pick = signOffPick(req.body)
          const { manifest } = await signOffSources()
          checkAgainst(manifest, pick)
          const saved = await recordSignOff(db, week, pick, (deps.now ?? (() => new Date().toISOString()))())
          const apply = saved.already ? null : await (deps.dispatch ?? dispatchJob)('signoff-apply', {})
          return res.status(200).json({ ok: true, press: saved.press, already: saved.already, ...(apply ? { apply } : {}) })
        } catch (e) {
          if (e instanceof SignOffError) throw new BoardError(e.status, e.message)
          throw e
        }
      }
      if (op === 'move') {
        // "Move to…" (Ruling, Krish, 2026-11-12: any off-day post or idea moves to any day at his press, and the move
        // updates every place that names its day): the one write (_offdayItems.ts moveItem). His press only. The week in
        // the address is the board he pressed on; the item says where it is, and the move updates both weeks.
        if (method !== 'POST') throw new BoardError(405, 'method_not_allowed')
        if (who !== 'Krish') throw new BoardError(403, 'his_press')
        const { moveInput, moveItem } = await import('./_offdayItems.js')
        const { input, problem } = moveInput(req.body)
        if (!input) throw new BoardError(400, problem || 'invalid_move')
        if (input.item.startsWith('piece:')) {
          // Move to… on a series piece (contract 1.13.0, _seriesMoves.ts): the same press, one transaction.
          const { moveSeriesPiece } = await import('./_seriesMoves.js')
          const moved = await moveSeriesPiece(db, input, { now: deps.now ? new Date(deps.now()) : new Date(), library: deps.library ? deps.library(db) : await moveLibrary(db) })
          return res.status(moved.status).json(moved.body)
        }
        const result = await moveItem(db, input, { now: deps.now ? new Date(deps.now()) : new Date(), ideas: deps.ideas ?? (w => readWeekIdeas(w)),
          drive: deps.renamer ? deps.renamer() : await moveRenamer(), library: deps.library ? deps.library(db) : await moveLibrary(db) })
        if (result.status === 200 && (result.body.followed as Record<string, unknown> | undefined)?.drive === 'renamed') {
          const { resetDrivePostsCache } = await import('./_drivePosts.js')
          resetDrivePostsCache()
        }
        return res.status(result.status).json(result.body)
      }
      if (op === 'replace') {
        // His Approve on a day that already holds a piece (contract 1.13.0, _seriesMoves.ts): his new pick for the day,
        // and the piece it replaces to the day he chose, his Ideas for Later, or alongside it, in one transaction.
        if (method !== 'POST') throw new BoardError(405, 'method_not_allowed')
        if (who !== 'Krish') throw new BoardError(403, 'his_press')
        const { replaceInput, replacePick } = await import('./_seriesMoves.js')
        const { input, problem } = replaceInput(req.body)
        if (!input) throw new BoardError(400, problem || 'invalid_replace')
        const result = await replacePick(db, week, input, { now: deps.now ? new Date(deps.now()) : new Date(), library: deps.library ? deps.library(db) : await moveLibrary(db) })
        return res.status(result.status).json(result.body)
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
        // His live posts are appended by their own route only, so none is ever changed or taken away by a plain write.
        if (method === 'PUT' && collection === 'picks' && LIVE_ID.test(id)) throw new BoardError(400, 'live_is_its_own_press')
        // A series piece's placement on a day is written only by its move or a replacing Approve, with the piece.
        if (method === 'PUT' && collection === 'picks' && /^place-/.test(id)) throw new BoardError(400, 'place_is_its_own_press')
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
        // His Approve for publish binds the piece's manifest as it stands now (1.8.0, _manifest.ts).
        if (collection === 'picks' && /-publish$/.test(id)) {
          try { await checkPublishBind(db, incoming) } catch (e) { if (e instanceof ManifestBindError) throw new BoardError(e.status, e.message); throw e }
        }
        const body = await preparePress(collection, id, incoming)
        const result = await db.rpc('board_save', { p_week: week, p_collection: collection, p_id: id, p_body: body, p_revision: req.body.revision, p_actor: who })
        must(result)
        const after = await afterPress(db, { week, collection, id, body, who, saved: result.data }, deps)
        return res.status(result.data.ok ? 200 : 409).json(after || result.data)
      }
      const build = scalar(req.query.build)
      if (build && !/^[a-f0-9]{64}$/.test(build)) throw new BoardError(400, 'invalid_build')
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
      // The week's last published build, read-only: Control Centre's list and Growth's ledger still read the manifests
      // the retired board pages were built from. Nothing publishes a build any more (Ruling, Krish, 2026-11-13).
      if (!op) return res.status(200).json({ ok: true, ...state, media_qualification: quality, media_quality_rollout: mediaQualityRollout().status })
      throw new BoardError(404, 'board_route_not_found')
    } catch (error) {
      if (res.headersSent) { res.end(); return }
      const known = error instanceof BoardError || error instanceof PressError
      return res.status(known ? error.status : 503).json({ ok: false, error: known ? error.message : 'board_unavailable' })
    }
  }
}
