import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { actor, canonical, collections, digest, hisOnlyRefusal, fileSpec, monday, revision, validBody, validSourceBody, validId, validManifest, views, type BoardFile, type Manifest, type View } from './_contracts.js'
import { PressError, afterPress, preparePress, type PressDeps } from './_presses.js'
import { MediaQualityError, qualifyBoard } from '../_mediaQuality.js'
import { mediaQualityEnforced, mediaQualityRollout } from '../../../../packages/core/src/media-rollout.js'

const BUCKET = 'content-library'
const TTL = 300
const scalar = (v: unknown) => typeof v === 'string' ? v : ''
const weekDate = (v: string | Date) => (v instanceof Date ? v.toISOString() : v).slice(0, 10)
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
    const op = scalar(req.query.op), collection = scalar(req.query.collection), id = scalar(req.query.id)
    const operatorOnly = ['uploads', 'imports', 'sources'].includes(op) || (!op && !collection && method === 'PUT')
    const who = actor(req, operatorOnly)
    if (!who) return res.status(401).json({ ok: false, error: 'unauthorized' })
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
      const week = scalar(req.query.week)
      if (!monday(week)) throw new BoardError(400, 'invalid_week')
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
        const body = await preparePress(collection, id, req.body.body)
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
        return res.redirect(303, await signed(db, file, true))
      }
      if (op === 'html') {
        const upstream = await fetch(await signed(db, state.manifest.html), { signal: AbortSignal.timeout(120000), redirect: 'error' })
        if (!upstream.ok || !upstream.body) throw new BoardError(503, 'board_html_unavailable')
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('X-Frame-Options', 'DENY')
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        res.setHeader('X-Board-Build', state.build_id)
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
