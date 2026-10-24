// The content-watcher queue: what the home computers may claim, report and read, decided without a database.
//
// Krish, 2026-10-24, on cost: "The last thing I want is to burn all my AI Anthropic subscription tokens on watching a
// video." content-watcher (krishanraja/content-watcher, docs/WATCH_API.md) fetches the links he pastes on the
// Inspiration board and reads each piece of media into text on his own machine. These routes are its only door into
// the database: claim (`claim.ts`), report (`report.ts`) and readings of files he dropped by hand (`read.ts`). The
// tables are migration 20261109090000_content_watch.sql.
//
// Everything here is pure, so the tests run with no database: the routes pass in a WatchStore.

export const STALE_CLAIM_MS = 30 * 60 * 1000
export const MAX_ATTEMPTS = 3
export const MAX_CLAIM = 10
export const MAX_FILES = 50

const SHA256_RE = /^[a-f0-9]{64}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MACHINE_RE = /^[A-Za-z0-9._-]{1,80}$/
const CLASS_RE = /^[a-z_]{1,40}$/
const PLATFORMS = new Set(['instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'threads', 'facebook', 'web', 'own'])
const SHAPES = new Set(['video', 'carousel', 'image', 'text', 'document'])
const FOLDERS = new Set(['video_inspiration', 'cold_ideas'])

export interface WatchRequestRow {
  id: string
  url: string
  url_key: string
  platform: string
  lane: string | null
  note: string | null
  status: 'queued' | 'claimed' | 'filed' | 'read' | 'failed'
  attempts: number
  claimed_by: string | null
  claimed_at: string | null
  requested_at: string
}

export interface MediaEntry { name: string; sha256: string; mime: string; bytes: number; folder: string }

export interface ReadRow {
  sha256: string
  source_url: string | null
  platform: string | null
  shape: string
  engine_rev: string
  read: Record<string, unknown>
  read_md: string
}

export interface WatchStore {
  /** Requests that are queued, or claimed or filed before `staleBefore`, oldest first. */
  claimable(staleBefore: string, limit: number): Promise<WatchRequestRow[]>
  /** Update one request only while it still has the status and claim it had when read. Returns the new row, or null. */
  updateIf(id: string, was: { status: string; claimed_at: string | null }, patch: Record<string, unknown>): Promise<WatchRequestRow | null>
  get(id: string): Promise<WatchRequestRow | null>
  /** The engine revision and id of each reading already stored, by sha256. */
  readRevs(shas: string[]): Promise<Map<string, { id: string; engine_rev: string }>>
  /** Insert or replace readings by sha256; returns each one's id. */
  upsertReads(rows: ReadRow[]): Promise<Map<string, string>>
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

function obj(body: unknown): Record<string, unknown> | null {
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return null }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null
}

export function parseClaim(body: unknown): Parsed<{ machine: string; limit: number }> {
  const b = obj(body)
  if (!b || typeof b.machine !== 'string' || !MACHINE_RE.test(b.machine)) return { ok: false, error: 'invalid_machine' }
  const limit = b.limit === undefined ? 3 : Number(b.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CLAIM) return { ok: false, error: 'invalid_limit' }
  return { ok: true, value: { machine: b.machine, limit } }
}

export function parseMedia(value: unknown): MediaEntry[] | null {
  if (!Array.isArray(value) || value.length > MAX_FILES) return null
  const out: MediaEntry[] = []
  for (const item of value) {
    const m = obj(item)
    if (!m) return null
    const bytes = Number(m.bytes)
    if (
      typeof m.name !== 'string' || m.name.length < 1 || m.name.length > 255 || /[\\/]/.test(m.name)
      || typeof m.sha256 !== 'string' || !SHA256_RE.test(m.sha256)
      || typeof m.mime !== 'string' || m.mime.length < 3 || m.mime.length > 100
      || !Number.isSafeInteger(bytes) || bytes < 1
      || typeof m.folder !== 'string' || !FOLDERS.has(m.folder)
    ) return null
    out.push({ name: m.name, sha256: m.sha256, mime: m.mime, bytes, folder: m.folder })
  }
  return out
}

export function parseReads(value: unknown): ReadRow[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_FILES) return null
  const out: ReadRow[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const r = obj(item)
    if (!r) return null
    const read = obj(r.read)
    if (
      typeof r.sha256 !== 'string' || !SHA256_RE.test(r.sha256) || seen.has(r.sha256)
      || !(r.source_url === null || r.source_url === undefined
        || (typeof r.source_url === 'string' && r.source_url.length >= 8 && r.source_url.length <= 2000 && /^https?:\/\//i.test(r.source_url)))
      || !(r.platform === null || r.platform === undefined || (typeof r.platform === 'string' && PLATFORMS.has(r.platform)))
      || typeof r.shape !== 'string' || !SHAPES.has(r.shape)
      || typeof r.engine_rev !== 'string' || r.engine_rev.length < 1 || r.engine_rev.length > 40
      || !read
      || typeof r.read_md !== 'string' || r.read_md.length < 1 || r.read_md.length > 40000
    ) return null
    seen.add(r.sha256)
    out.push({
      sha256: r.sha256,
      source_url: (r.source_url as string | null | undefined) ?? null,
      platform: (r.platform as string | null | undefined) ?? null,
      shape: r.shape,
      engine_rev: r.engine_rev,
      read,
      read_md: r.read_md,
    })
  }
  return out
}

export interface ReportBody {
  id: string
  machine: string
  status: 'filed' | 'read' | 'failed'
  status_class: string | null
  shape: string | null
  media: MediaEntry[] | null
  reads: ReadRow[] | null
}

export function parseReport(body: unknown): Parsed<ReportBody> {
  const b = obj(body)
  if (!b) return { ok: false, error: 'invalid_body' }
  if (typeof b.id !== 'string' || !UUID_RE.test(b.id)) return { ok: false, error: 'invalid_id' }
  if (typeof b.machine !== 'string' || !MACHINE_RE.test(b.machine)) return { ok: false, error: 'invalid_machine' }
  if (b.status !== 'filed' && b.status !== 'read' && b.status !== 'failed') return { ok: false, error: 'invalid_status' }
  const shape = b.shape === undefined || b.shape === null ? null : b.shape
  if (shape !== null && (typeof shape !== 'string' || !SHAPES.has(shape))) return { ok: false, error: 'invalid_shape' }
  const media = b.media === undefined || b.media === null ? null : parseMedia(b.media)
  if (b.media !== undefined && b.media !== null && media === null) return { ok: false, error: 'invalid_media' }
  const reads = b.reads === undefined || b.reads === null ? null : parseReads(b.reads)
  if (b.reads !== undefined && b.reads !== null && reads === null) return { ok: false, error: 'invalid_reads' }
  const statusClass = b.status_class === undefined || b.status_class === null ? null : b.status_class
  if (statusClass !== null && (typeof statusClass !== 'string' || !CLASS_RE.test(statusClass))) return { ok: false, error: 'invalid_status_class' }
  if (b.status === 'failed' && !statusClass) return { ok: false, error: 'status_class_required' }
  if (b.status === 'filed' && (!shape || !media || media.length === 0)) return { ok: false, error: 'filed_needs_shape_and_media' }
  if (b.status === 'read' && !reads) return { ok: false, error: 'read_needs_reads' }
  return { ok: true, value: { id: b.id, machine: b.machine, status: b.status, status_class: statusClass as string | null, shape: shape as string | null, media, reads } }
}

export function parseReadOnly(body: unknown): Parsed<{ machine: string; reads: ReadRow[] }> {
  const b = obj(body)
  if (!b || typeof b.machine !== 'string' || !MACHINE_RE.test(b.machine)) return { ok: false, error: 'invalid_machine' }
  const reads = parseReads(b.reads)
  if (!reads) return { ok: false, error: 'invalid_reads' }
  return { ok: true, value: { machine: b.machine, reads } }
}

/** Revisions compare by their numbers, so cw-2026.10.24 is older than cw-2026.11.2. */
export function compareRev(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true })
}

export function claimView(row: WatchRequestRow) {
  return {
    id: row.id, url: row.url, url_key: row.url_key, platform: row.platform,
    lane: row.lane, note: row.note, attempts: row.attempts,
  }
}

/** Claim up to `limit` requests for one machine. A row another machine changed first is skipped, never taken twice. */
export async function claim(store: WatchStore, machine: string, limit: number, now = new Date()) {
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString()
  const candidates = await store.claimable(staleBefore, limit * 3)
  const claimed: WatchRequestRow[] = []
  let expired = 0
  for (const row of candidates) {
    if (claimed.length >= limit) break
    const was = { status: row.status, claimed_at: row.claimed_at }
    if (row.attempts >= MAX_ATTEMPTS) {
      // A claim that went stale on its last attempt: the machine died with it. It fails as a timeout.
      const failed = await store.updateIf(row.id, was, {
        status: 'failed', status_class: 'timeout', claimed_by: null, claimed_at: null, updated_at: now.toISOString(),
      })
      if (failed) expired += 1
      continue
    }
    const taken = await store.updateIf(row.id, was, {
      status: 'claimed', status_class: null, claimed_by: machine, claimed_at: now.toISOString(),
      attempts: row.attempts + 1, updated_at: now.toISOString(),
    })
    if (taken) claimed.push(taken)
  }
  return { requests: claimed.map(claimView), expired }
}

/** Write readings, never letting an older engine revision replace a newer one. */
export async function writeReads(store: WatchStore, rows: ReadRow[]) {
  const existing = await store.readRevs(rows.map(r => r.sha256))
  const toWrite = rows.filter(r => {
    const found = existing.get(r.sha256)
    return !found || compareRev(r.engine_rev, found.engine_rev) >= 0
  })
  const written = toWrite.length ? await store.upsertReads(toWrite) : new Map<string, string>()
  const ids = new Map<string, string>()
  for (const r of rows) {
    const id = written.get(r.sha256) ?? existing.get(r.sha256)?.id
    if (id) ids.set(r.sha256, id)
  }
  return { ids, written: toWrite.length, kept_newer: rows.length - toWrite.length }
}

export type ReportOutcome =
  | { ok: true; status: string; attempts: number; written?: number; kept_newer?: number }
  | { ok: false; code: number; error: string }

export async function report(store: WatchStore, body: ReportBody, now = new Date()): Promise<ReportOutcome> {
  const row = await store.get(body.id)
  if (!row) return { ok: false, code: 404, error: 'not_found' }
  if (row.claimed_by !== body.machine || (row.status !== 'claimed' && row.status !== 'filed')) {
    return { ok: false, code: 409, error: 'not_your_claim' }
  }
  const was = { status: row.status, claimed_at: row.claimed_at }
  const stamp = now.toISOString()
  let patch: Record<string, unknown>
  let extra: { written?: number; kept_newer?: number } = {}
  if (body.status === 'failed') {
    patch = row.attempts >= MAX_ATTEMPTS
      ? { status: 'failed', status_class: body.status_class, updated_at: stamp }
      : { status: 'queued', status_class: body.status_class, claimed_by: null, claimed_at: null, updated_at: stamp }
  } else if (body.status === 'filed') {
    patch = { status: 'filed', status_class: null, shape: body.shape, media: body.media, updated_at: stamp }
  } else {
    const result = await writeReads(store, body.reads!)
    const first = result.ids.get(body.reads![0].sha256)
    if (!first) return { ok: false, code: 503, error: 'read_not_stored' }
    patch = { status: 'read', status_class: null, read_id: first, updated_at: stamp }
    if (body.shape) patch.shape = body.shape
    if (body.media && body.media.length) patch.media = body.media
    extra = { written: result.written, kept_newer: result.kept_newer }
  }
  const updated = await store.updateIf(row.id, was, patch)
  if (!updated) return { ok: false, code: 409, error: 'changed_meanwhile' }
  return { ok: true, status: updated.status, attempts: updated.attempts, ...extra }
}
