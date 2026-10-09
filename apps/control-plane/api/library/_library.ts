import { supabase } from '../_supabase.js'
import { LIVE_SERIES, SHA256_RE } from '../video-studio/_contracts.js'
import { normalizedStorageMd5Etag } from '../video-studio/_previewStorage.js'

// The makeyourmindup asset library: the files a cloud session sends for
// Krish's Drive folder, held in a private bucket until his always-on Windows
// machine writes them there.
//
// Krish, 2026-10-06: "make sure the brand kit is always updated here [the
// library's Drive folder]", then "I want every single asset in there,
// permanent and for individual posts, categorized properly, clear what to use
// them for, and every new post gets its own new folder with all assets
// including the article HTML I can copy paste, video scripts, etc etc".
//
// A cloud session cannot write into Drive, so the session sends each file
// here (upload-url, then confirm, on the engine key) and the library sync on
// his machine takes them (pending, then written, on the runner bearer). The
// architecture doc's rule 0a.5 says agents never write into his Drive; this is
// his explicit instruction for this one folder, carried out by his own
// machine, and it covers that folder only.
//
// The path rule below is the boundary that keeps it to that folder. It is
// written once as cases in config/library-paths.cases.json, implemented here
// and in scripts/post-pack/library.py, and both are tested against every case.

export const LIBRARY_BUCKET = 'content-library'
/** 500 MiB: a two-minute 1080p master runs 35 to 75 MB, so this leaves room
 *  for a long master. The bucket's file_size_limit is set to exactly this by
 *  the migration and checked on every request, like the preview bucket's. */
export const LIBRARY_MAX_BYTES = 500 * 1024 * 1024
/** The library root on Windows is about 62 characters, and Windows stops a
 *  whole path at 260 unless long paths are switched on. */
export const LIBRARY_PATH_MAX = 180
export const LIBRARY_PART_MAX = 100
export const LIBRARY_BRAND_KIT = '1 Brand kit (permanent)'
export const LIBRARY_CHANNEL_ART = '2 Channel art (permanent)'
export const LIBRARY_POSTS = '3 Posts'
export const LIBRARY_TOP_FOLDERS = [LIBRARY_BRAND_KIT, LIBRARY_CHANNEL_ART, LIBRARY_POSTS] as const
export const LIBRARY_POST_SECTIONS = ['0 Publish', '1 Article', '2 Covers and images', '3 Video', '4 Social'] as const
export const LIBRARY_POST_README = 'READ ME.txt'
/** The live subchannels as the brand writes them, from the Studio's series. */
export const LIBRARY_SUBCHANNELS = LIVE_SERIES.map((id) => id.replace(/_/g, '.'))

// Every type a post, the brand kit or the channel art holds. The extension
// decides the type, so a sender cannot choose one; the bucket allows exactly
// these, and the migration's list is tested against this one.
export const LIBRARY_CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  html: 'text/html',
  md: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  css: 'text/css',
  js: 'text/javascript',
  cjs: 'text/javascript',
  mjs: 'text/javascript',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  zip: 'application/zip',
})

export function libraryMimeTypes(): string[] {
  return [...new Set(Object.values(LIBRARY_CONTENT_TYPES))].sort()
}

/** Types the bucket may also allow, added by a later migration for one lane:
 *  Matroska, for recordings from the Video Engine Inbox
 *  (20261006180000_content_library_recordings.sql). The library itself never
 *  holds them; the recordings lane takes one only once the bucket allows it. */
export const LIBRARY_OPTIONAL_MIME_TYPES: readonly string[] = Object.freeze(['video/x-matroska'])

export type LibraryPathRefusal =
  | 'path_not_text'
  | 'path_too_long'
  | 'path_not_nfc'
  | 'path_backslash'
  | 'path_absolute'
  | 'path_empty_part'
  | 'path_escapes_library'
  | 'path_hidden_part'
  | 'path_unsafe_character'
  | 'path_part_edge'
  | 'path_reserved_name'
  | 'path_part_too_long'
  | 'path_wrong_top_folder'
  | 'path_no_file'
  | 'path_post_folder_invalid'
  | 'path_post_section_invalid'
  | 'path_type_not_allowed'

export interface LibraryPath {
  path: string
  top: typeof LIBRARY_TOP_FOLDERS[number]
  extension: string
  contentType: string
}

export type LibraryPathCheck = ({ ok: true } & LibraryPath) | { ok: false; refusal: LibraryPathRefusal }

// What Windows refuses in a name ('/' is the separator here), and control
// characters, spelled out as archive-naming spells them.
export const WINDOWS_UNSAFE = /[<>:"\\|?*]/
export const CONTROL = /[\u0000-\u001f\u007f-\u009f]/
export const RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const POST_FOLDER = new RegExp(
  `^([0-9]{4})-([0-9]{2})-([0-9]{2}) (?:(${WEEKDAYS.join('|')}) (${LIBRARY_SUBCHANNELS.map((name) => name.replace(/\./g, '\\.')).join('|')})|Launch) - \\S`,
)

function refuse(refusal: LibraryPathRefusal): LibraryPathCheck {
  return { ok: false, refusal }
}

/** `2026-10-05 Mon follow.the.money - Who gets paid` or
 *  `2026-10-05 Launch - Hello`: a real date, and the day it fell on. */
export function isLibraryPostFolder(name: string): boolean {
  const match = POST_FOLDER.exec(name)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false
  return match[4] === undefined || match[4] === WEEKDAYS[date.getUTCDay()]
}

/** A path inside the library, relative and with forward slashes, confined to
 *  the brand kit, the channel art or one post's folder. Anything else is
 *  refused with the reason. */
export function checkLibraryPath(value: unknown): LibraryPathCheck {
  if (typeof value !== 'string' || !value) return refuse('path_not_text')
  if (value.length > LIBRARY_PATH_MAX) return refuse('path_too_long')
  if (value.normalize('NFC') !== value) return refuse('path_not_nfc')
  if (value.includes('\\')) return refuse('path_backslash')
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return refuse('path_absolute')
  const parts = value.split('/')
  for (const part of parts) {
    if (!part) return refuse('path_empty_part')
    if (part === '.' || part === '..') return refuse('path_escapes_library')
    if (part.startsWith('.')) return refuse('path_hidden_part')
    if (CONTROL.test(part) || WINDOWS_UNSAFE.test(part)) return refuse('path_unsafe_character')
    if (part.startsWith(' ') || part.endsWith(' ') || part.endsWith('.')) return refuse('path_part_edge')
    if (RESERVED.test(part)) return refuse('path_reserved_name')
    if (part.length > LIBRARY_PART_MAX) return refuse('path_part_too_long')
  }
  const top = LIBRARY_TOP_FOLDERS.find((folder) => folder === parts[0])
  if (!top) return refuse('path_wrong_top_folder')
  if (top === LIBRARY_POSTS) {
    if (parts.length < 3) return refuse('path_no_file')
    if (!isLibraryPostFolder(parts[1]!)) return refuse('path_post_folder_invalid')
    const inside = parts.slice(2)
    const placed = inside.length === 1
      ? inside[0] === LIBRARY_POST_README
      : (LIBRARY_POST_SECTIONS as readonly string[]).includes(inside[0]!)
    if (!placed) return refuse('path_post_section_invalid')
  } else if (parts.length < 2) {
    return refuse('path_no_file')
  }
  const name = parts[parts.length - 1]!
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  const contentType = Object.prototype.hasOwnProperty.call(LIBRARY_CONTENT_TYPES, extension)
    ? LIBRARY_CONTENT_TYPES[extension]
    : undefined
  if (!contentType) return refuse('path_type_not_allowed')
  return { ok: true, path: value, top, extension, contentType }
}

/** Content-addressed: the same bytes sent for two posts are one object. */
export function libraryObjectKey(sha256: string, extension: string): string {
  return `files/${sha256}.${extension}`
}

export const MD5_RE = /^[a-f0-9]{32}$/
const MACHINE_RE = /^[A-Za-z0-9:_-]{1,160}$/
const OBJECT_KEY_RE = /^files\/[a-f0-9]{64}\.[a-z0-9]{1,8}$/

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; code: string; reason?: LibraryPathRefusal }

export interface LibraryUploadRequest {
  path: LibraryPath
  sha256: string
  md5: string
  bytes: number
  purpose: string
}

/** What a file is for, in one line a person reads: "Paste into Substack's editor". */
export function libraryPurpose(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.length > 200 || CONTROL.test(text)) return null
  return text
}

export function parseLibraryUploadRequest(value: unknown): Parsed<LibraryUploadRequest> {
  const body = record(value)
  if (!body) return { ok: false, code: 'invalid_library_upload_request' }
  const path = checkLibraryPath(body.path)
  if (path.ok === false) return { ok: false, code: 'invalid_library_path', reason: path.refusal }
  const purpose = libraryPurpose(body.purpose)
  if (
    typeof body.sha256 !== 'string' || !SHA256_RE.test(body.sha256)
    || typeof body.md5 !== 'string' || !MD5_RE.test(body.md5)
    || !Number.isSafeInteger(body.bytes) || (body.bytes as number) < 1
    || !purpose
  ) return { ok: false, code: 'invalid_library_upload_request' }
  if ((body.bytes as number) > LIBRARY_MAX_BYTES) return { ok: false, code: 'library_file_too_large' }
  const { ok: _ok, ...checked } = path
  return { ok: true, value: { path: checked, sha256: body.sha256, md5: body.md5, bytes: body.bytes as number, purpose } }
}

export function parseLibraryConfirmRequest(value: unknown): Parsed<{ path: LibraryPath; sha256: string }> {
  const body = record(value)
  if (!body) return { ok: false, code: 'invalid_library_confirm_request' }
  const path = checkLibraryPath(body.path)
  if (path.ok === false) return { ok: false, code: 'invalid_library_path', reason: path.refusal }
  if (typeof body.sha256 !== 'string' || !SHA256_RE.test(body.sha256)) return { ok: false, code: 'invalid_library_confirm_request' }
  const { ok: _ok, ...checked } = path
  return { ok: true, value: { path: checked, sha256: body.sha256 } }
}

export const LIBRARY_PENDING_DEFAULT = 25
export const LIBRARY_PENDING_MAX = 100

export function parseLibraryPendingQuery(query: unknown): { machine: string; limit: number } | null {
  const q = record(query) ?? {}
  const machine = q.machine
  if (typeof machine !== 'string' || !MACHINE_RE.test(machine)) return null
  const rawLimit = q.limit
  if (rawLimit === undefined) return { machine, limit: LIBRARY_PENDING_DEFAULT }
  if (typeof rawLimit !== 'string' || !/^[0-9]{1,3}$/.test(rawLimit)) return null
  const limit = Number(rawLimit)
  if (limit < 1 || limit > LIBRARY_PENDING_MAX) return null
  return { machine, limit }
}

export interface LibraryWrittenItem { path: string; sha256: string; written_as: string | null }

/** The parent folder of a library path, with its trailing slash. */
function folderOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/') + 1)
}

/** The name the sync gives a new version it keeps beside a file someone else
 *  put there or Krish changed: "name (2).ext" to "name (99).ext", in the same
 *  folder (Get-BesideName in scripts/library-sync.ps1). It is derived from a
 *  path that passed the rule, so it is accepted even where the rule names one
 *  file only. A post's top folder holds only "READ ME.txt", so on 2026-10-06
 *  "READ ME (2).txt", kept beside a READ ME written by hand, failed the rule,
 *  the whole report was refused, and the sync wrote the same first batch again
 *  on every pass without recording it. */
export function isBesideName(path: string, candidate: unknown): candidate is string {
  if (typeof candidate !== 'string') return false
  const folder = folderOf(path)
  const name = path.slice(folder.length)
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  const m = candidate.startsWith(folder) && candidate.endsWith(extension)
    ? /^ \((\d{1,2})\)$/.exec(candidate.slice(folder.length + stem.length, candidate.length - extension.length))
    : null
  if (!m || candidate.slice(folder.length, folder.length + stem.length) !== stem) return false
  const copy = Number(m[1])
  return String(copy) === m[1] && copy >= 2 && copy <= 99
}

export function parseLibraryWrittenRequest(value: unknown): { machine: string; items: LibraryWrittenItem[] } | null {
  const body = record(value)
  if (!body || body.schema_version !== 1) return null
  if (typeof body.machine !== 'string' || !MACHINE_RE.test(body.machine)) return null
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > LIBRARY_PENDING_MAX) return null
  const items: LibraryWrittenItem[] = []
  for (const raw of body.items) {
    const item = record(raw)
    if (!item) return null
    const path = checkLibraryPath(item.path)
    if (!path.ok || typeof item.sha256 !== 'string' || !SHA256_RE.test(item.sha256)) return null
    let writtenAs: string | null = null
    if (item.written_as !== undefined && item.written_as !== null && item.written_as !== item.path) {
      // A file kept beside one Krish changed goes in the same folder, under the
      // sync's own "name (n)" and nothing else.
      if (!isBesideName(path.path, item.written_as)) return null
      writtenAs = item.written_as
    }
    items.push({ path: path.path, sha256: item.sha256, written_as: writtenAs })
  }
  return { machine: body.machine, items }
}

// ── the private bucket ──────────────────────────────────────────────────────

export type LibraryStoreError = 'library_store_unconfigured' | 'library_store_misconfigured' | 'library_store_unavailable'

export interface LibraryStoreConfig { bucket: string; supabaseOrigin: string; allowedTypes: readonly string[] }

/** The bucket as the migration made it: private, the size cap and the type
 *  list exactly, with or without the optional types a later migration adds.
 *  Anything else refuses, as the preview store does. */
export async function configuredLibraryStore(): Promise<{ config: LibraryStoreConfig | null; error: LibraryStoreError | null }> {
  let supabaseOrigin = ''
  try {
    supabaseOrigin = new URL(process.env.SUPABASE_URL || '').origin
  } catch {
    return { config: null, error: 'library_store_unconfigured' }
  }
  const result = await supabase.storage.getBucket(LIBRARY_BUCKET)
  if (result.error || !result.data) return { config: null, error: 'library_store_unavailable' }
  const allowed = [...(result.data.allowed_mime_types || [])].sort()
  const expected = libraryMimeTypes()
  const extra = allowed.filter((type) => !expected.includes(type))
  if (
    result.data.public
    || !Number.isSafeInteger(result.data.file_size_limit)
    || Number(result.data.file_size_limit) !== LIBRARY_MAX_BYTES
    || new Set(allowed).size !== allowed.length
    || expected.some((type) => !allowed.includes(type))
    || extra.some((type) => !LIBRARY_OPTIONAL_MIME_TYPES.includes(type))
  ) return { config: null, error: 'library_store_misconfigured' }
  return { config: { bucket: LIBRARY_BUCKET, supabaseOrigin, allowedTypes: allowed }, error: null }
}

function baseType(value: unknown): string | null {
  return typeof value === 'string' ? value.split(';', 1)[0]!.trim().toLowerCase() : null
}

/** The stored object against what the sender declared. Size and type always;
 *  the MD5 when the sender gave one and Storage reports a plain one (a large
 *  upload stored in parts reports a composite tag instead). The sha256 is
 *  checked end to end by whoever downloads it: the library sync before a file
 *  reaches Drive, scripts/post-pack/recording.py before a session uses a
 *  recording. */
export async function verifyStoredLibraryObject(
  bucket: string,
  objectKey: string,
  bytes: number,
  contentType: string,
  md5: string | null,
): Promise<'verified' | 'missing' | 'mismatch' | 'unavailable'> {
  const result = await supabase.storage.from(bucket).info(objectKey)
  if (result.error || !result.data) {
    const status = Number(result.error && 'status' in result.error ? result.error.status : 0)
    return status === 400 || status === 404 ? 'missing' : 'unavailable'
  }
  const info = result.data as typeof result.data & { etag?: unknown }
  const storedSize = info.size ?? info.metadata?.size
  const storedType = baseType(info.contentType ?? info.metadata?.mimetype)
  const storedMd5 = normalizedStorageMd5Etag(info.etag)
  if (storedSize !== bytes || storedType !== contentType) return 'mismatch'
  if (md5 && storedMd5 && storedMd5 !== md5) return 'mismatch'
  return 'verified'
}

// ── the index ───────────────────────────────────────────────────────────────

export const LIBRARY_FILE_COLUMNS = 'id, path, sha256, md5, bytes, content_type, object_key, purpose, sent_by, sent_at, state, ready_at'

export interface LibraryFileRow {
  id: string
  path: string
  sha256: string
  md5: string
  bytes: number
  content_type: string
  object_key: string
  purpose: string
  sent_by: string
  sent_at: string
  state: 'reserved' | 'ready'
  ready_at: string | null
}

export function libraryFileRow(value: unknown): LibraryFileRow | null {
  const row = record(value)
  if (!row) return null
  if (
    typeof row.id !== 'string'
    || typeof row.path !== 'string'
    || typeof row.sha256 !== 'string' || !SHA256_RE.test(row.sha256)
    || typeof row.md5 !== 'string' || !MD5_RE.test(row.md5)
    || !Number.isSafeInteger(Number(row.bytes))
    || typeof row.content_type !== 'string'
    || typeof row.object_key !== 'string' || !OBJECT_KEY_RE.test(row.object_key)
    || typeof row.purpose !== 'string'
    || typeof row.sent_by !== 'string'
    || typeof row.sent_at !== 'string'
    || (row.state !== 'reserved' && row.state !== 'ready')
  ) return null
  return {
    id: row.id,
    path: row.path,
    sha256: row.sha256,
    md5: row.md5,
    bytes: Number(row.bytes),
    content_type: row.content_type,
    object_key: row.object_key,
    purpose: row.purpose,
    sent_by: row.sent_by,
    sent_at: row.sent_at,
    state: row.state,
    ready_at: typeof row.ready_at === 'string' ? row.ready_at : null,
  }
}

/** What a sender is shown about a file: never the object key or the bucket. */
export function libraryFileView(row: LibraryFileRow) {
  return {
    path: row.path,
    sha256: row.sha256,
    bytes: row.bytes,
    content_type: row.content_type,
    purpose: row.purpose,
    sent_by: row.sent_by,
    sent_at: row.sent_at,
    state: row.state,
    ready_at: row.ready_at,
  }
}

export function isLibraryObjectKey(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_KEY_RE.test(value)
}
