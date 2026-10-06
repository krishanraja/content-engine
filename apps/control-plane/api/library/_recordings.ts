import { supabase } from '../_supabase.js'
import { hashVideoStudioIdentity } from '../_videoStudioAuth.js'
import { SHA256_RE } from '../video-studio/_contracts.js'
import { CONTROL, LIBRARY_MAX_BYTES, MD5_RE, RESERVED, WINDOWS_UNSAFE, type Parsed } from './_library.js'

// The recordings lane: every recording that lands in the Video Engine Inbox
// on Krish's Windows machine reaches the engine's private storage, so a cloud
// session can fetch it with one command (scripts/post-pack/recording.py).
//
// Krish, 2026-10-06, after a session told him it could not reach his file:
// "figure out how to never make that error again". The Drive connector caps a
// download at 10 MB and a recording runs 100 to 500 MB, and he must never have
// to move a file by hand.
//
// The recordings upload (scripts/recordings-upload.ps1) runs on both runner
// machines at once, so whichever is online does the work (Krish: "just use
// whichever machine is online at the time? the runner exists on both"). It
// reads the Inbox, never writes there, and sends each finished recording here
// on the runner bearer (recordings/upload-url, then recordings/confirm). Two
// machines sending the same recording end with one object: the key is the
// sha256, the signed upload never overwrites, and the second confirm finds the
// first one's bytes. Sessions list and download them on the engine key
// (GET /api/library/recordings).
//
// No table: each recording is two objects in the library's private bucket,
// under recordings/. The bytes are keyed by their sha256, and beside them a
// small JSON manifest (recordings/<sha256>.json) holds the names it came in
// under and when it arrived. The asset library's own files are under files/
// and its index never sees these, so nothing here reaches Drive.

export const RECORDING_PREFIX = 'recordings'
export const RECORDING_NAME_MAX = 200
export const RECORDING_NAMES_KEPT = 20
export const RECORDINGS_LIST_DEFAULT = 50
export const RECORDINGS_LIST_MAX = 200
/** One rate-limit identity for the lane: the runner bearer is one sender. */
export const RECORDINGS_SENDER = hashVideoStudioIdentity('library', 'recordings')

/** The video and audio types a recording comes in. The extension decides the
 *  type. Matroska (mkv) is taken only once the bucket allows it. */
export const RECORDING_CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
})

export type RecordingNameRefusal =
  | 'name_not_text'
  | 'name_too_long'
  | 'name_not_nfc'
  | 'name_has_folder'
  | 'name_hidden'
  | 'name_unsafe_character'
  | 'name_edge'
  | 'name_reserved'
  | 'name_type_not_recording'

export interface RecordingName { name: string; extension: string; contentType: string }

/** A file name as it sits in the Inbox: one name, no folder, safe on Windows,
 *  with a video or audio extension. */
export function checkRecordingName(value: unknown): ({ ok: true } & RecordingName) | { ok: false; refusal: RecordingNameRefusal } {
  if (typeof value !== 'string' || !value) return { ok: false, refusal: 'name_not_text' }
  if (value.length > RECORDING_NAME_MAX) return { ok: false, refusal: 'name_too_long' }
  if (value.normalize('NFC') !== value) return { ok: false, refusal: 'name_not_nfc' }
  if (value.includes('/') || value.includes('\\')) return { ok: false, refusal: 'name_has_folder' }
  if (value.startsWith('.')) return { ok: false, refusal: 'name_hidden' }
  if (CONTROL.test(value) || WINDOWS_UNSAFE.test(value)) return { ok: false, refusal: 'name_unsafe_character' }
  if (value.startsWith(' ') || value.endsWith(' ') || value.endsWith('.')) return { ok: false, refusal: 'name_edge' }
  if (RESERVED.test(value)) return { ok: false, refusal: 'name_reserved' }
  const dot = value.lastIndexOf('.')
  const extension = dot > 0 ? value.slice(dot + 1).toLowerCase() : ''
  const contentType = Object.prototype.hasOwnProperty.call(RECORDING_CONTENT_TYPES, extension)
    ? RECORDING_CONTENT_TYPES[extension]
    : undefined
  if (!contentType) return { ok: false, refusal: 'name_type_not_recording' }
  return { ok: true, name: value, extension, contentType }
}

export function recordingObjectKey(sha256: string, extension: string): string {
  return `${RECORDING_PREFIX}/${sha256}.${extension}`
}

export function recordingManifestKey(sha256: string): string {
  return `${RECORDING_PREFIX}/${sha256}.json`
}

const MANIFEST_NAME_RE = /^[a-f0-9]{64}\.json$/
const OBJECT_KEY_RE = /^recordings\/[a-f0-9]{64}\.(mp4|mov|webm|mkv|m4a|wav|mp3)$/

export function isRecordingManifestName(value: unknown): value is string {
  return typeof value === 'string' && MANIFEST_NAME_RE.test(value)
}

export interface RecordingRequest { recording: RecordingName; sha256: string; md5: string | null; bytes: number }

/** { name, sha256, md5?, bytes }, for upload-url and confirm alike. */
export function parseRecordingRequest(value: unknown): Parsed<RecordingRequest> & { refusal?: RecordingNameRefusal } {
  const body = value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  if (!body) return { ok: false, code: 'invalid_recording_request' }
  const name = checkRecordingName(body.name)
  if (name.ok === false) return { ok: false, code: 'invalid_recording_name', refusal: name.refusal }
  const md5 = body.md5 === undefined || body.md5 === null ? null : body.md5
  if (
    typeof body.sha256 !== 'string' || !SHA256_RE.test(body.sha256)
    || (md5 !== null && (typeof md5 !== 'string' || !MD5_RE.test(md5)))
    || !Number.isSafeInteger(body.bytes) || (body.bytes as number) < 1
  ) return { ok: false, code: 'invalid_recording_request' }
  if ((body.bytes as number) > LIBRARY_MAX_BYTES) return { ok: false, code: 'recording_too_large' }
  const { ok: _ok, ...recording } = name
  return { ok: true, value: { recording, sha256: body.sha256, md5: md5 as string | null, bytes: body.bytes as number } }
}

export function parseRecordingsQuery(query: unknown): { limit: number } | null {
  const q = query !== null && typeof query === 'object' ? query as Record<string, unknown> : {}
  if (q.limit === undefined) return { limit: RECORDINGS_LIST_DEFAULT }
  if (typeof q.limit !== 'string' || !/^[0-9]{1,3}$/.test(q.limit)) return null
  const limit = Number(q.limit)
  return limit >= 1 && limit <= RECORDINGS_LIST_MAX ? { limit } : null
}

// ── the manifest beside each recording ──────────────────────────────────────

export interface RecordingManifest {
  schema_version: 1
  sha256: string
  md5: string | null
  bytes: number
  content_type: string
  object_key: string
  /** Every name these bytes came in under, the newest first. */
  names: string[]
  /** When the bytes first arrived, and when a name was last added. */
  uploaded_at: string
  named_at: string
}

export function parseRecordingManifest(value: unknown): RecordingManifest | null {
  const m = value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  if (
    !m
    || m.schema_version !== 1
    || typeof m.sha256 !== 'string' || !SHA256_RE.test(m.sha256)
    || !(m.md5 === null || (typeof m.md5 === 'string' && MD5_RE.test(m.md5)))
    || !Number.isSafeInteger(m.bytes) || (m.bytes as number) < 1
    || typeof m.content_type !== 'string'
    || typeof m.object_key !== 'string' || !OBJECT_KEY_RE.test(m.object_key)
    || !m.object_key.startsWith(`${RECORDING_PREFIX}/${m.sha256}.`)
    || !Array.isArray(m.names) || m.names.length < 1
    || m.names.some((name) => !checkRecordingName(name).ok)
    || typeof m.uploaded_at !== 'string' || Number.isNaN(Date.parse(m.uploaded_at))
    || typeof m.named_at !== 'string' || Number.isNaN(Date.parse(m.named_at))
  ) return null
  const extension = m.object_key.slice(m.object_key.lastIndexOf('.') + 1)
  if (RECORDING_CONTENT_TYPES[extension] !== m.content_type) return null
  return {
    schema_version: 1,
    sha256: m.sha256,
    md5: m.md5 as string | null,
    bytes: m.bytes as number,
    content_type: m.content_type,
    object_key: m.object_key,
    names: (m.names as string[]).slice(0, RECORDING_NAMES_KEPT),
    uploaded_at: m.uploaded_at,
    named_at: m.named_at,
  }
}

/** The manifest for these bytes; null when there is none yet. */
export async function readRecordingManifest(bucket: string, sha256: string): Promise<{ manifest: RecordingManifest | null; error: boolean }> {
  const result = await supabase.storage.from(bucket).download(recordingManifestKey(sha256))
  if (result.error || !result.data) {
    const status = Number(result.error && 'status' in result.error ? result.error.status : 0)
    const statusCode = Number(result.error && 'statusCode' in result.error ? (result.error as { statusCode?: unknown }).statusCode : 0)
    return status === 400 || status === 404 || statusCode === 400 || statusCode === 404
      ? { manifest: null, error: false }
      : { manifest: null, error: true }
  }
  try {
    const manifest = parseRecordingManifest(JSON.parse(await result.data.text()))
    return manifest && manifest.sha256 === sha256 ? { manifest, error: false } : { manifest: null, error: true }
  } catch {
    return { manifest: null, error: true }
  }
}

export async function writeRecordingManifest(bucket: string, manifest: RecordingManifest): Promise<boolean> {
  const body = Buffer.from(JSON.stringify(manifest), 'utf8')
  const result = await supabase.storage
    .from(bucket)
    .upload(recordingManifestKey(manifest.sha256), body, { contentType: 'application/json', upsert: true })
  return !result.error
}

/** The manifest with this name added as the newest, and the sender's MD5 kept
 *  when there was none. */
export function withName(
  previous: RecordingManifest | null,
  request: RecordingRequest,
  now: string,
): RecordingManifest {
  const names = [request.recording.name, ...(previous?.names ?? []).filter((name) => name !== request.recording.name)]
  return {
    schema_version: 1,
    sha256: request.sha256,
    md5: previous?.md5 ?? request.md5,
    bytes: request.bytes,
    content_type: request.recording.contentType,
    object_key: recordingObjectKey(request.sha256, request.recording.extension),
    names: names.slice(0, RECORDING_NAMES_KEPT),
    uploaded_at: previous?.uploaded_at ?? now,
    named_at: previous && previous.names[0] === request.recording.name ? previous.named_at : now,
  }
}

/** What a session is shown: never the bucket or the object key. */
export function recordingView(manifest: RecordingManifest) {
  return {
    name: manifest.names[0]!,
    names: manifest.names,
    bytes: manifest.bytes,
    sha256: manifest.sha256,
    content_type: manifest.content_type,
    uploaded_at: manifest.uploaded_at,
  }
}
