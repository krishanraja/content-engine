import { createHash } from 'node:crypto'
import https from 'node:https'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { DRIVE_READONLY_SCOPE, googleAccessToken } from '../_google.js'
import { LIBRARY_MAX_BYTES } from './_library.js'
import { checkRecordingName, type RecordingManifest, type RecordingRequest } from './_recordings.js'

// The Video Engine Inbox, read from Google by its folder ID.
//
// Krish, 2026-10-24, after his folders were renamed and moved and both home
// computers went on looking for the Inbox at its old path for two days: "Isn't
// there a better way of doing this than the path name? Folders get renamed all
// the time and moved all the time. Surely, the whole point of having a Google
// Drive is that there's a specific ID for a specific folder." Offered A (the
// engine reads the Inbox from Google by its ID) or B (the machines find it by a
// marker file), he answered "A."
//
// So the engine lists the Inbox by ID through the Drive API, as the service
// account it already holds (GOOGLE_SERVICE_ACCOUNT_EMAIL, read-only scope,
// never impersonating), and copies each new recording into the same store the
// home computers send to: the bytes under recordings/<sha256>.<ext> and the
// manifest beside them, written exactly as /api/library/recordings/confirm
// writes it. recording.py, recording_match.py and produce-video change nothing.
// A rename or a move of the folder changes nothing either; a folder that is
// unshared or deleted fails the run, and the run ledger puts that in front of
// Krish in Control Center.
//
// It reads the Inbox and never writes, moves or renames anything there.

/** The Inbox, Video Engine > Inbox. Verified against live Drive on
 *  2026-10-24; config/studio.json drive_ids.media_inbox holds the same ID and a
 *  test keeps the two equal. system_config `recordings_inbox_folder_id`
 *  overrides it without a deploy. */
export const INBOX_FOLDER_ID = '1H-PWmcwLkKCPHShBL6SYzsLzEbpa6795'

/** A Drive listing reports a file as soon as its upload has finished; two
 *  minutes more covers Drive for desktop replacing a file in place. */
export const INBOX_SETTLE_MS = 2 * 60 * 1000

/** What one run is allowed: the function's maxDuration is 600 seconds. */
export const INBOX_RUN_BUDGET_MS = 540 * 1000
/** A copy is started only when it can finish inside the budget at this rate
 *  (bytes per millisecond: 4 MB a second, well under what Drive and Storage do). */
export const INBOX_COPY_RATE = 4_000

export interface InboxFile {
  id: string
  name?: string
  mimeType?: string
  size?: string
  md5Checksum?: string
  sha256Checksum?: string
  modifiedTime?: string
}

export type InboxSkip = 'not_recording' | 'too_large' | 'no_checksum' | 'settling'

export type InboxStep =
  | { kind: 'skip'; file: InboxFile; why: InboxSkip }
  | { kind: 'consider'; file: InboxFile; request: RecordingRequest; modifiedMs: number }

/** Each file in the listing, the newest first, as a skip with its reason or a
 *  recording request in the shape upload-url and confirm take. Pure. */
export function planInbox(files: readonly InboxFile[], now: number): InboxStep[] {
  const steps: InboxStep[] = []
  const sorted = [...files].sort((a, b) => Date.parse(b.modifiedTime || '') - Date.parse(a.modifiedTime || ''))
  for (const file of sorted) {
    const name = typeof file.name === 'string' ? file.name.normalize('NFC') : ''
    const checked = checkRecordingName(name)
    if (checked.ok === false || (file.mimeType || '').startsWith('application/vnd.google-apps.')) {
      steps.push({ kind: 'skip', file, why: 'not_recording' })
      continue
    }
    const bytes = Number(file.size)
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > LIBRARY_MAX_BYTES) {
      steps.push({ kind: 'skip', file, why: 'too_large' })
      continue
    }
    const sha256 = (file.sha256Checksum || '').toLowerCase()
    const md5 = (file.md5Checksum || '').toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      // Drive computes the checksums once the bytes are stored; a file without
      // one yet is looked at again on the next run.
      steps.push({ kind: 'skip', file, why: 'no_checksum' })
      continue
    }
    const modifiedMs = Date.parse(file.modifiedTime || '')
    if (!Number.isFinite(modifiedMs) || now - modifiedMs < INBOX_SETTLE_MS) {
      steps.push({ kind: 'skip', file, why: 'settling' })
      continue
    }
    const { ok: _ok, ...recording } = checked
    steps.push({
      kind: 'consider',
      file,
      modifiedMs,
      request: { recording, sha256, md5: /^[a-f0-9]{32}$/.test(md5) ? md5 : null, bytes },
    })
  }
  return steps
}

export type InboxAction = 'already_listed' | 'add_name' | 'copy'

/** What to do with one recording, given the manifest the store holds for its
 *  sha256 (null when none) and whether its bytes are stored. Pure. */
export function decideRecording(
  request: RecordingRequest,
  manifest: RecordingManifest | null,
  stored: 'verified' | 'missing',
): InboxAction {
  if (manifest && manifest.names.includes(request.recording.name)) return 'already_listed'
  return stored === 'verified' ? 'add_name' : 'copy'
}

/** Whether a copy of this size can start with this much of the run gone. */
export function copyFits(bytes: number, elapsedMs: number): boolean {
  return elapsedMs + bytes / INBOX_COPY_RATE < INBOX_RUN_BUDGET_MS
}

// ── Drive ───────────────────────────────────────────────────────────────────

export type InboxListing =
  | { ok: true; folderName: string; files: InboxFile[]; truncated: boolean }
  | { ok: false; reason: string; fix: string }

const NOT_SHARED_FIX = 'Share the Video Engine Inbox folder with the engine\'s service account (the address in GOOGLE_SERVICE_ACCOUNT_EMAIL, the one already on the Content Inspo folder) as Viewer. Moving or renaming the folder needs nothing.'

/** The folder itself (to prove it is there and readable), then every file in
 *  it. A folder that is gone, unshared or trashed is a failure with its fix,
 *  never an empty listing. */
export async function listInbox(folderId: string): Promise<InboxListing> {
  let why = 'google_service_account_not_configured'
  const token = await googleAccessToken([DRIVE_READONLY_SCOPE], { impersonate: false, onError: (r) => { why = r } })
  if (!token) return { ok: false, reason: `the engine could not sign in to Google: ${why}`, fix: 'Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY on the content-engine Vercel project.' }
  const headers = { Authorization: `Bearer ${token}` }
  const folder = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
    { headers },
  ).catch(() => null)
  if (!folder) return { ok: false, reason: 'Google Drive could not be reached', fix: 'Nothing to do; the next run tries again.' }
  const meta: any = await folder.json().catch(() => ({}))
  if (folder.status === 404 || folder.status === 403) {
    return { ok: false, reason: `the Inbox folder (by its ID) is not visible to the engine: it is not shared with the service account, or it was deleted (Drive answered ${folder.status})`, fix: NOT_SHARED_FIX }
  }
  if (!folder.ok) return { ok: false, reason: `Google Drive answered ${folder.status} for the Inbox folder`, fix: 'Nothing to do if it passes on the next run.' }
  if (meta?.mimeType !== 'application/vnd.google-apps.folder') {
    return { ok: false, reason: 'the Inbox ID no longer names a folder', fix: 'Put the Inbox folder\'s ID in config/studio.json drive_ids.media_inbox and INBOX_FOLDER_ID.' }
  }
  if (meta?.trashed === true) return { ok: false, reason: 'the Inbox folder is in the Drive bin', fix: 'Restore it from the bin, or give the engine the new Inbox\'s ID.' }

  const files: InboxFile[] = []
  let pageToken = ''
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size,md5Checksum,sha256Checksum,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers }).catch(() => null)
    if (!r || !r.ok) return { ok: false, reason: `listing the Inbox failed (${r ? r.status : 'no answer'})`, fix: 'Nothing to do if it passes on the next run.' }
    const j: any = await r.json().catch(() => ({}))
    if (Array.isArray(j?.files)) files.push(...j.files)
    pageToken = typeof j?.nextPageToken === 'string' ? j.nextPageToken : ''
    if (!pageToken) break
  }
  // The newest come first, so a cut listing drops only the oldest; it is
  // still said, never passed over.
  return { ok: true, folderName: String(meta?.name || ''), files, truncated: pageToken !== '' }
}

/** Streams one Drive file to a signed Storage upload URL, hashing it on the
 *  way. Returns the PUT's status and the sha256 of the bytes that passed.
 *  Nothing is held in memory but the chunk in flight. */
export async function copyDriveFile(fileId: string, uploadUrl: string, contentType: string, bytes: number, timeoutMs: number): Promise<{ status: number; sha256: string }> {
  const token = await googleAccessToken([DRIVE_READONLY_SCOPE], { impersonate: false })
  if (!token) throw new Error('the engine could not sign in to Google')
  // A copy that would outlast the function is stopped and counted as a
  // failure, so the run still records itself; killed by the platform it
  // would leave no ledger row and start again first every ten minutes.
  const signal = AbortSignal.timeout(Math.max(1, timeoutMs))
  const download = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!download.ok || !download.body) throw new Error(`Drive answered ${download.status} for the download`)
  const hash = createHash('sha256')
  const tap = new Transform({
    transform(chunk, _encoding, done) { hash.update(chunk); done(null, chunk) },
  })
  const target = new URL(uploadUrl)
  if (target.protocol !== 'https:') throw new Error('the upload address is not https')
  const status = await new Promise<number>((resolve, reject) => {
    const request = https.request(target, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Content-Length': String(bytes) },
    }, (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode || 0))
      response.on('error', reject)
    })
    // A hard deadline, not an idle timeout: a slow but steady copy never
    // goes idle, and a short body (the file replaced since it was listed)
    // leaves storage waiting. Destroying the PUT ends the pipeline and the
    // download, and the run records the failure.
    const deadline = setTimeout(() => request.destroy(new Error('the copy ran out of time; it is tried again next run')), Math.max(1, timeoutMs))
    request.on('close', () => clearTimeout(deadline))
    request.on('error', reject)
    pipeline(Readable.fromWeb(download.body as any), tap, request).catch(reject)
  })
  return { status, sha256: hash.digest('hex') }
}
