import { createHash, randomUUID } from 'node:crypto'
import { withMaterial, readMaterials, MaterialsFull, type Material } from './_content.js'

// Board sessions and the piece materials store (docs/PUBLISH_BOARDS.md, "Sessions and materials";
// supabase/migrations/20261125093000_board_sessions_and_piece_store.sql).
//
// Krish, 2026-11-11: "If I copy a Claude prompt out of the content publish board ... that session should automatically
// update the board once it's done or as it's going. This system should be immune from multiple sessions working on
// stuff simultaneously and should have a rock-hard repository for everything it's drawing on. ... Even if I ran four
// separate sessions on one piece of content, it would know where everything was and then separately have a look at
// these two screen grabs."
//
// Every rule that keeps several sessions safe lives in the database functions, so it holds whichever door a write comes
// through (this file's routes, Control Centre's connector tools, scripts/post-pack/board_session.py):
//   - a report is one appended event, idempotent on the session's own key for it (a retry lands once);
//   - a field a session sets names the revision it read, and is refused when another landed first (set) or merged onto
//     it (append); nothing is overwritten silently;
//   - a material is kept by its sha256, every version side by side, archived and never deleted;
//   - presence is read from each session's latest lease, so nothing is updated in place.
// This file validates input, says who wrote, and moves bytes; it decides nothing the database does not check again.
//
// The piece's working set (content_ideas.meta.materials) stays what the writers ground on. A text or a link added to a
// piece goes there, guarded on the row's updated_at, and the capture trigger files it in the store in the same
// transaction; a file, a long corpus, a named version or a day with no piece goes to the store alone.

export const MATERIAL_KINDS = ['screenshot', 'image', 'pdf', 'corpus', 'research', 'paste', 'link', 'file', 'output', 'storyboard', 'note', 'video', 'audio', 'other'] as const
export type MaterialKind = (typeof MATERIAL_KINDS)[number]
export const REPORT_KINDS = ['start', 'progress', 'heartbeat', 'done', 'end', 'blocked'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** The most a text goes onto the working set with; longer stays in the store alone (the writers' own cap). */
export const WORKING_SET_MAX = 400_000
/** The most text the store keeps in one material (the database checks it too). */
export const STORE_TEXT_MAX = 2_000_000
/** The biggest file a session or the board files on a piece: every byte is read back and hashed before it counts. */
export const STORE_FILE_MAX = 64 * 1024 * 1024
const SIGNED_TTL = 300
// The library's bucket, its content-addressed keys (files/<sha256>.<ext>) and the types it takes, read when a file is
// moved: api/library/_library.ts opens the database client when it loads, which a pure caller (the view, a test) must not.
const library = () => import('./library/_library.js')
const UPLOAD_TTL_SECONDS = 2 * 60 * 60

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{3,79}$/
const CLIENT_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/
const SHA256 = /^[a-f0-9]{64}$/
const FIELD = /^[a-z][a-z0-9_.-]{0,59}$/
const ROLE = /^[a-z][a-z_]{0,40}$/

type Body = Record<string, unknown>
const obj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export class StoreError extends Error { constructor(public status: number, message: string, public extra: Body = {}) { super(message) } }

// The narrow part of a Supabase client this file uses, so a test can run it against a real database.
type Result<T> = { data: T | null; error: { message?: string; code?: string } | null }
export interface StoreDb {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Result<any>>
  from(table: string): any
  storage?: any
}

/** Where a write or a read lands: a piece, or a day of a week (with no piece yet), or the week itself. */
export type Scope = { piece_id: string; week?: undefined; day?: undefined } | { piece_id?: undefined; week: string; day: string | null }

export function parseScope(q: Body): Scope {
  const piece = typeof q.piece_id === 'string' ? q.piece_id : typeof q.piece === 'string' ? q.piece : ''
  if (piece) {
    if (!UUID.test(piece.toLowerCase())) throw new StoreError(400, 'invalid_piece')
    return { piece_id: piece.toLowerCase() }
  }
  const week = typeof q.week === 'string' ? q.week : ''
  const d = new Date(`${week}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || isNaN(+d) || d.getUTCDay() !== 1) throw new StoreError(400, 'invalid_scope')
  const day = typeof q.day === 'string' && q.day ? q.day.toLowerCase().slice(0, 3) : null
  if (day && !(DAYS as readonly string[]).includes(day)) throw new StoreError(400, 'invalid_day')
  return { week, day }
}

/** Who wrote: a session on the engine key names itself (Claude Code by default); Control Centre's connector names the
 *  session it carries; anything else on his login is Krish. */
export function writerOf(bearer: boolean, body: Body): string {
  const named = str(body.by, 80)
  if (bearer) return named || 'Claude Code'
  if (body.via === 'control_center' && named) return named
  return 'Krish'
}

async function call<T = any>(db: StoreDb, fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await db.rpc(fn, args)
  if (r.error) throw new StoreError(503, 'board_store_unavailable')
  return r.data as T
}
const refused = (r: Body): never => {
  const error = String(r.error || 'refused')
  const status = error === 'piece_not_found' ? 404 : /conflict$/.test(error) ? 409 : error === 'rate_limited' ? 429 : 400
  throw new StoreError(status, error, r)
}

// ── sessions ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ReportInput {
  scope: Scope
  session_id: string
  client_key: string
  kind: ReportKind
  step?: string | null
  summary?: string | null
  detail?: Body | null
  surface?: string | null
  label?: string | null
  lease_seconds?: number | null
  fields?: Array<{ name: string; value: unknown; base_revision?: number | null; mode?: 'set' | 'append' }>
}

/** A report's input from a request body, refused with a reason when it is not one. */
export function parseReport(body: Body): ReportInput {
  const scope = parseScope(body)
  const session = typeof body.session_id === 'string' ? body.session_id.trim() : ''
  if (!SESSION_ID.test(session)) throw new StoreError(400, 'invalid_session', { hint: 'a session id is 4 to 80 letters, digits, dots, dashes, colons or underscores, chosen once and reused' })
  const kind = String(body.kind || '') as ReportKind
  if (!(REPORT_KINDS as readonly string[]).includes(kind)) throw new StoreError(400, 'invalid_kind', { kinds: REPORT_KINDS })
  // A report with no key of its own gets one from what it says, so the same report sent twice lands once.
  const given = typeof body.client_key === 'string' ? body.client_key.trim() : ''
  if (given && !CLIENT_KEY.test(given)) throw new StoreError(400, 'invalid_client_key')
  const summary = str(body.summary, 600)
  const step = str(body.step, 60)
  const client_key = given || `${kind}-${createHash('sha256').update(JSON.stringify([kind, step, summary, body.fields ?? null, body.detail ?? null])).digest('hex').slice(0, 32)}`
  const fields = Array.isArray(body.fields) ? body.fields : body.fields === undefined || body.fields === null ? [] : null
  if (!fields || fields.length > 10) throw new StoreError(400, 'invalid_fields')
  for (const f of fields) {
    if (!obj(f) || typeof f.name !== 'string' || !FIELD.test(f.name) || !('value' in f)) throw new StoreError(400, 'invalid_field')
    if (f.mode !== undefined && f.mode !== 'set' && f.mode !== 'append') throw new StoreError(400, 'invalid_field_mode')
    if ((f.mode ?? 'set') === 'set' && !Number.isSafeInteger(f.base_revision)) throw new StoreError(400, 'base_revision_required', { field: f.name })
  }
  const lease = body.lease_seconds === undefined || body.lease_seconds === null ? null : Number(body.lease_seconds)
  if (lease !== null && !(Number.isFinite(lease) && lease >= 60 && lease <= 14_400)) throw new StoreError(400, 'invalid_lease')
  const detail = obj(body.detail) ? body.detail : null
  if (detail && Buffer.byteLength(JSON.stringify(detail)) > 16_000) throw new StoreError(413, 'detail_too_large')
  return { scope, session_id: session, client_key, kind, step, summary, detail, surface: str(body.surface, 40), label: str(body.label, 120),
    lease_seconds: lease, fields: fields as ReportInput['fields'] }
}

export async function report(db: StoreDb, input: ReportInput, by: string): Promise<Body> {
  const r = await call<Body>(db, 'board_session_report', { p: { ...input.scope, ...input, scope: undefined, by } })
  if (!r || r.ok !== true) refused(r || {})
  return r
}

// ── materials ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface MaterialInput {
  scope: Scope
  kind: MaterialKind
  title: string
  role?: string | null
  note?: string | null
  material_key?: string | null
  base_version?: number | null
  session_id?: string | null
  source: 'session' | 'board' | 'control_center' | 'upload' | 'backfill' | 'repo'
  source_ref?: string | null
}

function materialBase(body: Body, fallbackKind: MaterialKind): Omit<MaterialInput, 'source'> {
  const kind = (MATERIAL_KINDS as readonly string[]).includes(String(body.kind)) ? body.kind as MaterialKind : fallbackKind
  const role = str(body.role, 41)
  if (role && !ROLE.test(role)) throw new StoreError(400, 'invalid_role')
  const key = str(body.material_key, 200)
  const base = body.base_version === undefined || body.base_version === null ? null : Number(body.base_version)
  if (base !== null && !(Number.isSafeInteger(base) && base >= 0)) throw new StoreError(400, 'invalid_base_version')
  const session = str(body.session_id, 80)
  if (session && !SESSION_ID.test(session)) throw new StoreError(400, 'invalid_session')
  return { scope: parseScope(body), kind, title: str(body.title, 300) || '', role, note: str(body.note, 2000), material_key: key, base_version: base, session_id: session }
}
const sourceOf = (bearer: boolean, body: Body): MaterialInput['source'] =>
  bearer ? (body.source === 'repo' || body.source === 'backfill' ? body.source : 'session') : body.via === 'control_center' ? 'control_center' : 'board'

async function put(db: StoreDb, p: Body): Promise<Body> {
  const r = await call<Body>(db, 'board_material_put', { p })
  if (!r || r.ok !== true) refused(r || {})
  return r
}

/** The piece's working set with one material added first, guarded on the row's updated_at so a write that lands in
 *  between (a making record, another session's paste) is read again and kept, never overwritten. Returns false when
 *  it could not get through; the caller then files the material in the store alone, so nothing is lost either way. */
export async function addToWorkingSet(db: StoreDb, pieceId: string, material: Material, tries = 6): Promise<{ ok: true; materials: Material[] } | { ok: false; reason: string }> {
  for (let i = 0; i < tries; i++) {
    const read = await db.from('content_ideas').select('id,meta,updated_at').eq('id', pieceId).maybeSingle()
    if (read.error) return { ok: false, reason: 'unavailable' }
    if (!read.data) throw new StoreError(404, 'piece_not_found')
    const meta = (obj(read.data.meta) ? read.data.meta : {}) as Body
    let next: Material[]
    try { next = withMaterial(readMaterials(meta), material) } catch (e) {
      if (e instanceof MaterialsFull) return { ok: false, reason: 'materials_full' }
      throw e
    }
    const write = await db.from('content_ideas').update({ meta: { ...meta, materials: next }, updated_at: new Date().toISOString() })
      .eq('id', pieceId).eq('updated_at', read.data.updated_at).select('id')
    if (write.error) return { ok: false, reason: 'unavailable' }
    if (write.data?.length) return { ok: true, materials: next }
    await new Promise(r => setTimeout(r, 40 + Math.random() * 120 * (i + 1)))
  }
  return { ok: false, reason: 'busy' }
}

/** The working set with one material taken off, guarded the same way. The store keeps it (archive only). */
export async function removeFromWorkingSet(db: StoreDb, pieceId: string, materialId: string, tries = 6): Promise<{ ok: true; materials: Material[] } | { ok: false; reason: string }> {
  for (let i = 0; i < tries; i++) {
    const read = await db.from('content_ideas').select('id,meta,updated_at').eq('id', pieceId).maybeSingle()
    if (read.error) return { ok: false, reason: 'unavailable' }
    if (!read.data) throw new StoreError(404, 'piece_not_found')
    const meta = (obj(read.data.meta) ? read.data.meta : {}) as Body
    const next = readMaterials(meta).filter(m => m.id !== materialId)
    const write = await db.from('content_ideas').update({ meta: { ...meta, materials: next }, updated_at: new Date().toISOString() })
      .eq('id', pieceId).eq('updated_at', read.data.updated_at).select('id')
    if (write.error) return { ok: false, reason: 'unavailable' }
    if (write.data?.length) return { ok: true, materials: next }
    await new Promise(r => setTimeout(r, 40 + Math.random() * 120 * (i + 1)))
  }
  return { ok: false, reason: 'busy' }
}

/** Any change to a piece's meta, guarded the same way as the working set: read the row, apply `patch` to the meta as it
 *  is now, write only if the row has not changed since the read, and read again when it has. A route that spends
 *  seconds on a model between its read and its write (deepen, dive-deeper, the investigation) uses this, so a write
 *  landing in between (a making record, a board press, another session) is kept, never overwritten. `patch` may throw
 *  (MaterialsFull): the caller answers it. */
export async function patchMeta(db: StoreDb, pieceId: string, patch: (meta: Body) => Body, tries = 6): Promise<{ ok: true; meta: Body } | { ok: false; reason: string }> {
  for (let i = 0; i < tries; i++) {
    const read = await db.from('content_ideas').select('id,meta,updated_at').eq('id', pieceId).maybeSingle()
    if (read.error) return { ok: false, reason: 'unavailable' }
    if (!read.data) throw new StoreError(404, 'piece_not_found')
    const meta = patch((obj(read.data.meta) ? read.data.meta : {}) as Body)
    const write = await db.from('content_ideas').update({ meta, updated_at: new Date().toISOString() })
      .eq('id', pieceId).eq('updated_at', read.data.updated_at).select('id')
    if (write.error) return { ok: false, reason: 'unavailable' }
    if (write.data?.length) return { ok: true, meta }
    await new Promise(r => setTimeout(r, 40 + Math.random() * 120 * (i + 1)))
  }
  return { ok: false, reason: 'busy' }
}

/** A text or a link on a piece or a day. A piece's text up to WORKING_SET_MAX (and any link) also joins the working set
 *  every writer grounds on; the capture trigger files it in the store in the same write. Everything else is the store's alone. */
export async function addText(db: StoreDb, body: Body, bearer: boolean, by: string): Promise<Body> {
  const isLink = body.op === 'link' || (typeof body.url === 'string' && !body.content)
  const base = materialBase(body, isLink ? 'link' : 'corpus')
  const source = sourceOf(bearer, body)
  const content = typeof body.content === 'string' ? body.content : ''
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (isLink) { if (!/^https?:\/\//.test(url) || url.length > 2000) throw new StoreError(400, 'invalid_url') }
  else if (!content.trim()) throw new StoreError(400, 'empty_material')
  else if (Buffer.byteLength(content) > STORE_TEXT_MAX) throw new StoreError(413, 'material_too_large')
  const title = base.title || (isLink ? hostOf(url) : firstLine(content))
  const toWorkingSet = Boolean(base.scope.piece_id) && !base.material_key && (isLink || content.length <= WORKING_SET_MAX)
  if (toWorkingSet) {
    const id = randomUUID()
    const material = {
      id, kind: isLink ? 'link' : base.kind === 'research' ? 'research' : 'paste', title, content: isLink ? null : content, url: isLink ? url : null,
      bytes: isLink ? url.length : content.length, at: new Date().toISOString(), by,
      ...(base.role ? { role: base.role } : {}), ...(base.note ? { note: base.note } : {}), ...(base.session_id ? { session_id: base.session_id } : {}),
      // The store's own kind (a corpus, a storyboard, a note), which the working set's four kinds cannot say.
      store_kind: isLink ? 'link' : base.kind, source,
    } as Material & Body
    const added = await addToWorkingSet(db, base.scope.piece_id!, material)
    const key = `meta:${id}`
    const filed = await call<Body>(db, 'board_overlay', { p_pieces: [base.scope.piece_id], p_week: null, p_all_versions: true, p_archived: true })
    const row = (Array.isArray(filed?.materials) ? filed.materials as Body[] : []).find(m => m.key === key)
    // The capture trigger filed it with the working set. When the working set could not take it (or the capture did
    // not run), it is filed in the store directly under the same key, so it is on record either way.
    const stored = row ? { ok: true, duplicate: false, material: row } : await put(db, {
      piece_id: base.scope.piece_id, material_key: key, storage: isLink ? 'link' : 'text', content: isLink ? null : content, url: isLink ? url : null,
      kind: isLink ? 'link' : base.kind, role: base.role, title, note: base.note, source, source_ref: `meta.materials:${id}`, added_by: by, session_id: base.session_id,
    })
    return { ...stored, working_set: added.ok === true ? 'added' : added.reason }
  }
  const stored = await put(db, {
    ...base.scope, material_key: base.material_key, ...(base.base_version !== null ? { base_version: base.base_version } : {}),
    storage: isLink ? 'link' : 'text', content: isLink ? null : content, url: isLink ? url : null, kind: base.kind, role: base.role, title, note: base.note,
    source, source_ref: str(body.source_ref, 500), added_by: by, session_id: base.session_id,
  })
  return { ...stored, working_set: 'store_only' }
}

/** A file's extension and the type the library allows for it, or a refusal. */
export async function fileType(name: unknown): Promise<{ ext: string; contentType: string }> {
  const { LIBRARY_CONTENT_TYPES } = await library()
  const ext = typeof name === 'string' ? (name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || '') : ''
  const contentType = LIBRARY_CONTENT_TYPES[ext]
  if (!contentType) throw new StoreError(400, 'file_type_not_allowed', { allowed: Object.keys(LIBRARY_CONTENT_TYPES) })
  return { ext, contentType }
}
const kindOfFile = (contentType: string, name: string): MaterialKind =>
  contentType.startsWith('image/') ? (/screen[\s_-]?(shot|grab)|capture/i.test(name) ? 'screenshot' : 'image')
    : contentType === 'application/pdf' ? 'pdf' : contentType.startsWith('video/') ? 'video' : contentType.startsWith('audio/') ? 'audio'
    : contentType.startsWith('text/') || contentType === 'application/json' ? 'corpus' : 'file'

async function fileRequest(body: Body) {
  const sha = typeof body.sha256 === 'string' ? body.sha256.toLowerCase() : ''
  if (!SHA256.test(sha)) throw new StoreError(400, 'invalid_sha256')
  const bytes = Number(body.bytes)
  if (!Number.isSafeInteger(bytes) || bytes < 1) throw new StoreError(400, 'invalid_bytes')
  if (bytes > STORE_FILE_MAX) throw new StoreError(413, 'file_too_large', { max_bytes: STORE_FILE_MAX })
  const name = str(body.name, 200) || ''
  const { ext, contentType } = await fileType(name)
  const { LIBRARY_BUCKET, libraryObjectKey } = await library()
  return { sha, bytes, name, ext, contentType, objectKey: libraryObjectKey(sha, ext), bucket: LIBRARY_BUCKET }
}

async function pieceExists(db: StoreDb, scope: Scope) {
  if (!scope.piece_id) return
  const r = await db.from('content_ideas').select('id').eq('id', scope.piece_id).maybeSingle()
  if (r.error) throw new StoreError(503, 'board_store_unavailable')
  if (!r.data) throw new StoreError(404, 'piece_not_found')
}

/** Step one of a file: where to put its bytes (or nothing to send when the library already holds them). */
export async function uploadUrl(db: StoreDb, body: Body): Promise<Body> {
  const scope = parseScope(body)
  const f = await fileRequest(body)
  await pieceExists(db, scope)
  const bucket = db.storage.from(f.bucket)
  const info = await bucket.info(f.objectKey)
  if (!info.error && info.data) {
    const size = info.data.size ?? info.data.metadata?.size
    if (size === f.bytes) return { ok: true, object_key: f.objectKey, content_type: f.contentType, upload: null }
    throw new StoreError(409, 'stored_bytes_differ')
  }
  const signed = await bucket.createSignedUploadUrl(f.objectKey, { upsert: false })
  if (signed.error || !signed.data?.signedUrl) throw new StoreError(503, 'upload_unavailable')
  return { ok: true, object_key: f.objectKey, content_type: f.contentType,
    upload: { method: 'PUT', url: signed.data.signedUrl, headers: { 'Content-Type': f.contentType }, expires_at: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString() } }
}

type Fetcher = (url: string, init?: { signal?: AbortSignal; redirect?: 'error' }) => Promise<{ ok: boolean; body: ReadableStream<Uint8Array> | null }>

/** Step two: read every byte back, check its size and sha256, then file it. A file that does not match is refused. */
export async function confirmFile(db: StoreDb, body: Body, bearer: boolean, by: string, fetcher: Fetcher = fetch as unknown as Fetcher): Promise<Body> {
  const base = materialBase(body, 'file')
  const f = await fileRequest(body)
  await pieceExists(db, base.scope)
  const link = await db.storage.from(f.bucket).createSignedUrl(f.objectKey, SIGNED_TTL)
  if (link.error || !link.data?.signedUrl) throw new StoreError(409, 'file_not_uploaded')
  const response = await fetcher(link.data.signedUrl, { signal: AbortSignal.timeout(120_000), redirect: 'error' })
  if (!response.ok || !response.body) throw new StoreError(409, 'file_not_uploaded')
  const hash = createHash('sha256'); let n = 0
  const reader = response.body.getReader()
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break
      n += value.byteLength
      if (n > f.bytes) throw new StoreError(409, 'file_size_mismatch')
      hash.update(value)
    }
  } finally { await reader.cancel().catch(() => undefined) }
  if (n !== f.bytes) throw new StoreError(409, 'file_size_mismatch')
  if (hash.digest('hex') !== f.sha) throw new StoreError(409, 'file_hash_mismatch')
  const kind = (MATERIAL_KINDS as readonly string[]).includes(String(body.kind)) ? base.kind : kindOfFile(f.contentType, f.name)
  return put(db, {
    ...base.scope, material_key: base.material_key, ...(base.base_version !== null ? { base_version: base.base_version } : {}),
    storage: 'bucket', sha256: f.sha, bytes: f.bytes, object_key: f.objectKey, content_type: f.contentType, kind, role: base.role,
    title: base.title || f.name, note: base.note, source: sourceOf(bearer, body), source_ref: str(body.source_ref, 500), added_by: by, session_id: base.session_id,
  })
}

export async function archive(db: StoreDb, id: string, by: string, reason: string | null): Promise<Body> {
  if (!UUID.test(id)) throw new StoreError(400, 'invalid_material')
  const r = await call<Body>(db, 'board_material_archive', { p_id: id, p_by: by, p_reason: reason })
  if (!r || r.ok !== true) refused(r || {})
  return r
}

// ── reads ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const mondayOf = (date: string) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const dayOf = (date: string) => DAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7]

/** Everything on record for a piece (or a day): its materials, its day's and its week's, who is working on it and what
 *  each said, the latest value of each field, and the newest reports. Reading a piece first files anything on its
 *  working set the store does not hold yet, so a capture that ever failed heals on the next read. */
export async function listing(db: StoreDb, scope: Scope, opts: { all?: boolean; archived?: boolean } = {}): Promise<Body> {
  let week = scope.week ?? null, day = scope.day ?? null, piece: Body | null = null
  if (scope.piece_id) {
    const r = await db.from('content_ideas').select('id,idea,scheduled_for,lane_slot,meta').eq('id', scope.piece_id).maybeSingle()
    if (r.error) throw new StoreError(503, 'board_store_unavailable')
    if (!r.data) throw new StoreError(404, 'piece_not_found')
    const scheduled = typeof r.data.scheduled_for === 'string' ? r.data.scheduled_for.slice(0, 10) : null
    week = scheduled ? mondayOf(scheduled) : null; day = scheduled ? dayOf(scheduled) : null
    piece = { id: r.data.id, idea: r.data.idea, scheduled_for: scheduled, series: r.data.lane_slot ?? null, week, day }
    const working = obj(r.data.meta) && Array.isArray(r.data.meta.materials) ? r.data.meta.materials : []
    if (working.length) await db.rpc('board_capture_materials', { p_piece: scope.piece_id, p_materials: working, p_source: 'meta.materials' })
  }
  const all = await call<Body>(db, 'board_overlay', { p_pieces: scope.piece_id ? [scope.piece_id] : [], p_week: week, p_all_versions: Boolean(opts.all), p_archived: Boolean(opts.archived) })
  const dayScope = week ? `day:${week}/${day ?? 'week'}` : null
  const weekScope = week ? `day:${week}/week` : null
  const mine = (s: unknown) => s === scope.piece_id || s === dayScope || s === weekScope
  const materials = (Array.isArray(all?.materials) ? all.materials as Body[] : []).filter(m => mine(m.scope)).map(m => ({
    ...m, where: m.scope === scope.piece_id ? 'piece' : m.scope === weekScope ? 'week' : 'day',
    read: `/api/content-ideas/store?op=read&id=${m.id}`,
  }))
  const sessions = (Array.isArray(all?.sessions) ? all.sessions as Body[] : []).filter(s => mine(s.scope))
  const fields: Record<string, Body> = {}
  for (const f of (Array.isArray(all?.fields) ? all.fields as Body[] : []).filter(x => x.scope === (scope.piece_id ?? dayScope))) fields[String(f.name)] = f
  const events = (Array.isArray(all?.events) ? all.events as Body[] : []).filter(e => mine(e.scope))
  return { ok: true, as_of: all?.as_of ?? new Date().toISOString(), piece, scope: scope.piece_id ?? dayScope, week, day,
    working: sessions.filter(s => s.state === 'working' || s.state === 'blocked').length, sessions, materials, fields, events }
}

/** One material's bytes: a text as JSON, a link as its address, a file as a short signed link. */
export async function readMaterial(db: StoreDb, id: string): Promise<{ kind: 'text'; body: Body } | { kind: 'redirect'; url: string; body: Body }> {
  if (!UUID.test(id)) throw new StoreError(400, 'invalid_material')
  const r = await db.from('piece_materials').select('id,scope,piece_id,week,day,material_key,version,kind,role,title,note,sha256,bytes,content_type,storage,text_sha256,object_key,url,added_by,added_at,archived_at').eq('id', id).maybeSingle()
  if (r.error) throw new StoreError(503, 'board_store_unavailable')
  if (!r.data) throw new StoreError(404, 'material_not_found')
  const m = r.data as Body
  const about = { id: m.id, title: m.title, kind: m.kind, role: m.role, note: m.note, version: m.version, key: m.material_key, sha256: m.sha256, bytes: m.bytes, content_type: m.content_type, added_by: m.added_by, at: m.added_at, archived_at: m.archived_at }
  if (m.storage === 'text') {
    const t = await db.from('material_texts').select('content').eq('sha256', m.text_sha256).maybeSingle()
    if (t.error || !t.data) throw new StoreError(503, 'board_store_unavailable')
    return { kind: 'text', body: { ok: true, material: about, content: t.data.content } }
  }
  if (m.storage === 'link') return { kind: 'redirect', url: String(m.url), body: { ok: true, material: about, url: m.url } }
  const name = `${String(m.title).replace(/[^\w .-]+/g, '_').slice(0, 80) || 'material'}.${String(m.object_key).split('.').pop()}`
  const signed = await db.storage.from((await library()).LIBRARY_BUCKET).createSignedUrl(String(m.object_key), SIGNED_TTL, { download: name })
  if (signed.error || !signed.data?.signedUrl) throw new StoreError(503, 'board_file_unavailable')
  return { kind: 'redirect', url: signed.data.signedUrl, body: { ok: true, material: about, url: signed.data.signedUrl, expires_in: SIGNED_TTL } }
}

function hostOf(u: string) { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u.slice(0, 60) } }
function firstLine(s: string) { return (s.split('\n').map(x => x.replace(/^#+\s*/, '').trim()).find(Boolean) || 'Pasted material').slice(0, 120) }
