// The cloud backup's way into Krish's two Inspiration folders.
//
// Krish, 2026-10-28: "yes build the cloud backup". A home computer files a fetched post by copying it into the
// synced Drive folder. The cloud backup (content-watcher on GitHub's machine, a machine named cloud...) has no synced
// folder, so it asks this route for a Drive upload session in the folder its lane names and sends the bytes straight
// to Google. The engine holds the Google credential; the cloud machine never does.
//
// The rules are the home computers' (content-watcher filing.file_one, docs/DRIVE.md): add only. The same bytes already
// under the name, or under one of its _v2.._v9 names, is a no-op; a different file keeps its name free by taking the
// next _vN. Nothing here deletes, moves, renames or overwrites.
//
// A service account has no Drive storage of its own, so a file it made would be refused: the session is opened as
// GOOGLE_IMPERSONATE_SUBJECT through domain-wide delegation, narrowest scope first (drive.file, then drive). Whether
// either scope is delegated is a fact only Google answers; `probe` asks it without writing anything.
//
// Everything here is pure, so the tests run with no Google and no database: the route passes in a DriveWriter.

import { isCloudMachine, type Parsed, type WatchStore } from './_watch.js'

/** The two folders in Ventures > Inspiration, by the contract's folder names (docs/DRIVE.md). */
export const WATCH_FOLDER_IDS: Record<string, string> = {
  video_inspiration: '1QxrzxISYFXq0er0DG0XSapm7qhvuRmh-', // Production Inspo
  cold_ideas: '1FNztJOU82M8zb6IIbUAbvuI6Kr0pF5Hu', // Content Inspo
}
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024
const MAX_VERSION = 9

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MACHINE_RE = /^[A-Za-z0-9._-]{1,80}$/
const SHA256_RE = /^[a-f0-9]{64}$/
const MIME_RE = /^(?:(?:video|image|audio)\/[a-z0-9.+-]{1,60}|text\/(?:plain|markdown)|application\/pdf)$/
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,199}$/

export interface UploadBody { id: string; machine: string; folder: string; name: string; sha256: string; bytes: number; mime: string }

export interface DriveFile { name: string; sha256: string | null }

/** What the route needs from Google. The real one is `googleDriveWriter` in upload.ts. */
export interface DriveWriter {
  /** Files in the folder whose name is one of `names` (not trashed). */
  filesNamed(folderId: string, names: string[]): Promise<DriveFile[]>
  /** Open a resumable upload session for a new file; returns the session URL the bytes are PUT to. */
  startUpload(folderId: string, name: string, mime: string, bytes: number): Promise<string>
}

export type UploadOutcome =
  | { ok: true; exists: true; name: string }
  | { ok: true; exists: false; name: string; upload_url: string }
  | { ok: false; status: number; error: string }

function obj(body: unknown): Record<string, unknown> | null {
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return null }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null
}

export function parseUpload(body: unknown): Parsed<UploadBody> {
  const b = obj(body)
  if (!b) return { ok: false, error: 'invalid_body' }
  if (typeof b.id !== 'string' || !UUID_RE.test(b.id)) return { ok: false, error: 'invalid_id' }
  if (typeof b.machine !== 'string' || !MACHINE_RE.test(b.machine)) return { ok: false, error: 'invalid_machine' }
  if (typeof b.folder !== 'string' || !Object.prototype.hasOwnProperty.call(WATCH_FOLDER_IDS, b.folder)) return { ok: false, error: 'invalid_folder' }
  if (typeof b.name !== 'string' || !NAME_RE.test(b.name) || b.name.includes('..')) return { ok: false, error: 'invalid_name' }
  if (typeof b.sha256 !== 'string' || !SHA256_RE.test(b.sha256)) return { ok: false, error: 'invalid_sha256' }
  const bytes = Number(b.bytes)
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_UPLOAD_BYTES) return { ok: false, error: 'invalid_bytes' }
  if (typeof b.mime !== 'string' || !MIME_RE.test(b.mime)) return { ok: false, error: 'invalid_mime' }
  return { ok: true, value: { id: b.id, machine: b.machine, folder: b.folder, name: b.name, sha256: b.sha256, bytes, mime: b.mime } }
}

/** The name and its _v2.._v9 names, in the order filing.file_one tries them. */
export function candidateNames(name: string): string[] {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  const out = [name]
  for (let n = 2; n <= MAX_VERSION; n++) out.push(`${stem}_v${n}${ext}`)
  return out
}

/** Open an upload for one fetched file, only for a cloud machine holding the request's claim. */
export async function planUpload(store: WatchStore, drive: DriveWriter, body: UploadBody): Promise<UploadOutcome> {
  if (!isCloudMachine(body.machine)) return { ok: false, status: 403, error: 'cloud_machines_only' }
  const row = await store.get(body.id)
  if (!row) return { ok: false, status: 404, error: 'not_found' }
  if (row.status !== 'claimed' || row.claimed_by !== body.machine) return { ok: false, status: 409, error: 'not_claimed_by_machine' }
  const folderId = WATCH_FOLDER_IDS[body.folder]
  const names = candidateNames(body.name)
  const present = await drive.filesNamed(folderId, names)
  const same = present.find(f => f.sha256 === body.sha256)
  if (same) return { ok: true, exists: true, name: same.name }
  const taken = new Set(present.map(f => f.name))
  const free = names.find(n => !taken.has(n))
  if (!free) return { ok: false, status: 409, error: 'name_exhausted' }
  const uploadUrl = await drive.startUpload(folderId, free, body.mime, body.bytes)
  return { ok: true, exists: false, name: free, upload_url: uploadUrl }
}

/** A Drive query string literal: backslash and single quote escaped. */
export function driveLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}
