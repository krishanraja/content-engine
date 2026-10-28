// Feedback videos Krish records himself: what a home computer may claim, where its stills go, and the email he gets.
//
// Krish, 2026-10-28: "somewhere in my control centre where I can specifically add a feedback video that's not
// inspiration from Instagram or a YouTube reel, but just me recording a video. It would trigger only this one part of
// the system." And: "an email sent to me with the timestamped feedback file and the link to the Google Drive folder
// where all the still images are stored ... wrapped into a neat and tidy Claude Code prompt."
//
// Control Center writes the row and uploads the bytes (migration 20261116090000_ux_feedback_recordings.sql).
// content-watcher (krishanraja/content-watcher, content_watcher/feedback.py) claims it here, makes the timeline on the
// machine, puts the stills and the feedback file in a Drive folder of their own, and reports. Nothing here touches the
// Inspiration queue, content_reads or the Inspiration folders.
//
// Everything here is pure, so the tests run with no database and no Google: the routes pass in a store, a Drive and a
// mailer.

import { isCloudMachine, type Parsed } from '../watch/_watch.js'

// A recording takes a while to read (transcription on a home computer's CPU): a claim is stale after an hour.
export const STALE_CLAIM_MS = 60 * 60 * 1000
export const MAX_ATTEMPTS = 3
export const MAX_DRIVE_FILES = 150
export const MAX_DRIVE_FILE_BYTES = 50 * 1024 * 1024
export const MAX_SIGNALS = 100
export const DOWNLOAD_TTL_SECONDS = 60 * 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MACHINE_RE = /^[A-Za-z0-9._-]{1,80}$/
const CLASS_RE = /^[a-z_]{1,40}$/
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/
const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,199}$/
const DRIVE_MIMES = new Set(['image/jpeg', 'text/markdown'])
const SIGNALS = new Set(['friction', 'confusion', 'expectation', 'delight'])

export interface FeedbackRow {
  id: string
  name: string
  note: string | null
  object_path: string
  mime: string
  bytes: number
  status: 'uploading' | 'queued' | 'claimed' | 'done' | 'failed'
  status_class: string | null
  attempts: number
  claimed_by: string | null
  claimed_at: string | null
  drive_folder_id: string | null
  feedback_file_id: string | null
  requested_at: string
  updated_at: string | null
}

export interface FeedbackStore {
  /** Recordings that are queued, or claimed before `staleBefore`, oldest first. */
  claimable(staleBefore: string, limit: number): Promise<FeedbackRow[]>
  /** Update one recording only while it still has the status and claim it had when read. Returns the new row, or null. */
  updateIf(id: string, was: { status: string; claimed_at: string | null }, patch: Record<string, unknown>): Promise<FeedbackRow | null>
  get(id: string): Promise<FeedbackRow | null>
  /** A signed URL the machine downloads the recording from, with no key. */
  downloadUrl(objectPath: string): Promise<string | null>
}

export interface FeedbackDrive {
  /** The folder every recording's own folder goes in: UX_FEEDBACK_DRIVE_FOLDER_ID, or "UX Feedback" in his Drive. */
  parentFolder(): Promise<string>
  createFolder(parentId: string, name: string): Promise<string>
  /** Open a resumable upload session for a new file; returns the session URL the bytes are PUT to. */
  startUpload(folderId: string, name: string, mime: string, bytes: number): Promise<string>
}

export type Mailer = (subject: string, body: string) => Promise<{ sent: boolean; via: 'send' | 'draft' | null }>

export interface Signal { t: number; signal: string; term: string; said: string; still: number }
export interface Summary { duration_s: number; stills: number; images: number; signals: Signal[] }

function obj(body: unknown): Record<string, unknown> | null {
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return null }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null
}

const iso = (now: Date) => now.toISOString()

export function parseMachine(body: unknown): Parsed<{ machine: string }> {
  const b = obj(body)
  if (!b || typeof b.machine !== 'string' || !MACHINE_RE.test(b.machine)) return { ok: false, error: 'invalid_machine' }
  return { ok: true, value: { machine: b.machine } }
}

/** What a machine gets for a claimed recording. */
export function claimView(row: FeedbackRow, downloadUrl: string) {
  return {
    id: row.id, name: row.name, note: row.note, mime: row.mime, bytes: row.bytes, attempts: row.attempts,
    download_url: downloadUrl,
  }
}

export async function waiting(store: FeedbackStore, now = new Date()): Promise<number> {
  return (await store.claimable(new Date(now.getTime() - STALE_CLAIM_MS).toISOString(), 30)).length
}

export type ClaimOutcome =
  | { ok: true; recording: ReturnType<typeof claimView> | null; expired: number }
  | { ok: false; code: number; error: string }

/** Claim one recording for one machine. Only a home computer: a feedback video is read on his own machine. */
export async function claimOne(store: FeedbackStore, machine: string, now = new Date()): Promise<ClaimOutcome> {
  if (isCloudMachine(machine)) return { ok: false, code: 403, error: 'home_machines_only' }
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString()
  let expired = 0
  for (const row of await store.claimable(staleBefore, 5)) {
    const was = { status: row.status, claimed_at: row.claimed_at }
    if (row.attempts >= MAX_ATTEMPTS) {
      // A claim that went stale on its last attempt: the machine died with it.
      const failed = await store.updateIf(row.id, was, {
        status: 'failed', status_class: 'timeout', claimed_by: null, claimed_at: null, updated_at: iso(now),
      })
      if (failed) expired += 1
      continue
    }
    const taken = await store.updateIf(row.id, was, {
      status: 'claimed', status_class: null, claimed_by: machine, claimed_at: iso(now),
      attempts: row.attempts + 1, updated_at: iso(now),
    })
    if (!taken) continue
    const url = await store.downloadUrl(taken.object_path)
    if (!url) {
      await store.updateIf(taken.id, { status: 'claimed', claimed_at: taken.claimed_at }, {
        status: 'queued', status_class: 'download_unavailable', claimed_by: null, claimed_at: null, updated_at: iso(now),
      })
      return { ok: false, code: 503, error: 'download_unavailable' }
    }
    return { ok: true, recording: claimView(taken, url), expired }
  }
  return { ok: true, recording: null, expired }
}

function holds(row: FeedbackRow | null, machine: string): row is FeedbackRow {
  return !!row && row.status === 'claimed' && row.claimed_by === machine
}

export interface DriveFileAsk { name: string; mime: string; bytes: number }
export interface DriveBody { id: string; machine: string; files: DriveFileAsk[] }

export function parseDrive(body: unknown): Parsed<DriveBody> {
  const b = obj(body)
  if (!b || typeof b.id !== 'string' || !UUID_RE.test(b.id)) return { ok: false, error: 'invalid_id' }
  if (typeof b.machine !== 'string' || !MACHINE_RE.test(b.machine)) return { ok: false, error: 'invalid_machine' }
  if (!Array.isArray(b.files) || b.files.length < 1 || b.files.length > MAX_DRIVE_FILES) return { ok: false, error: 'invalid_files' }
  const files: DriveFileAsk[] = []
  const names = new Set<string>()
  for (const item of b.files) {
    const f = obj(item)
    const bytes = Number(f?.bytes)
    if (
      !f || typeof f.name !== 'string' || !FILE_NAME_RE.test(f.name) || names.has(f.name)
      || typeof f.mime !== 'string' || !DRIVE_MIMES.has(f.mime)
      || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_DRIVE_FILE_BYTES
    ) return { ok: false, error: 'invalid_files' }
    names.add(f.name)
    files.push({ name: f.name, mime: f.mime, bytes })
  }
  return { ok: true, value: { id: b.id, machine: b.machine, files } }
}

/** The recording's own Drive folder: the day it was recorded for him to find it by, then its name. */
export function folderName(row: FeedbackRow): string {
  const day = row.requested_at.slice(0, 10)
  const stem = row.name.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[^A-Za-z0-9 ._()-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  return `${day} ${stem || 'feedback'}`
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`
export const fileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`

export type DriveOutcome =
  | { ok: true; folder_id: string; folder_url: string; uploads: Array<{ name: string; upload_url: string }> }
  | { ok: false; code: number; error: string }

/** Upload sessions for the stills and the feedback file, in the recording's own folder (made once, on first ask). */
export async function planDrive(store: FeedbackStore, drive: FeedbackDrive, body: DriveBody, now = new Date()): Promise<DriveOutcome> {
  const row = await store.get(body.id)
  if (!holds(row, body.machine)) return { ok: false, code: 409, error: 'not_your_claim' }
  let folderId = row.drive_folder_id
  if (!folderId) {
    folderId = await drive.createFolder(await drive.parentFolder(), folderName(row))
    const saved = await store.updateIf(row.id, { status: 'claimed', claimed_at: row.claimed_at }, {
      drive_folder_id: folderId, updated_at: iso(now),
    })
    if (!saved) return { ok: false, code: 409, error: 'not_your_claim' }
  }
  const uploads = []
  for (const file of body.files) {
    uploads.push({ name: file.name, upload_url: await drive.startUpload(folderId, file.name, file.mime, file.bytes) })
  }
  return { ok: true, folder_id: folderId, folder_url: folderUrl(folderId), uploads }
}

export interface ReportBody {
  id: string
  machine: string
  status: 'done' | 'failed'
  status_class: string | null
  feedback_file_id: string | null
  summary: Summary | null
}

function parseSummary(value: unknown): Summary | null {
  const s = obj(value)
  if (!s || !Array.isArray(s.signals) || s.signals.length > MAX_SIGNALS) return null
  const duration = Number(s.duration_s)
  const stills = Number(s.stills)
  const images = Number(s.images)
  if (!Number.isFinite(duration) || duration < 0 || !Number.isInteger(stills) || stills < 0 || !Number.isInteger(images) || images < 0) return null
  const signals: Signal[] = []
  for (const item of s.signals) {
    const g = obj(item)
    const t = Number(g?.t)
    const still = Number(g?.still)
    if (
      !g || !Number.isFinite(t) || t < 0 || typeof g.signal !== 'string' || !SIGNALS.has(g.signal)
      || typeof g.term !== 'string' || g.term.length < 1 || g.term.length > 60
      || typeof g.said !== 'string' || g.said.length > 400 || !Number.isInteger(still) || still < 1
    ) return null
    signals.push({ t, signal: g.signal, term: g.term, said: g.said, still })
  }
  return { duration_s: duration, stills, images, signals }
}

export function parseReport(body: unknown): Parsed<ReportBody> {
  const b = obj(body)
  if (!b || typeof b.id !== 'string' || !UUID_RE.test(b.id)) return { ok: false, error: 'invalid_id' }
  if (typeof b.machine !== 'string' || !MACHINE_RE.test(b.machine)) return { ok: false, error: 'invalid_machine' }
  if (b.status === 'failed') {
    if (typeof b.status_class !== 'string' || !CLASS_RE.test(b.status_class)) return { ok: false, error: 'invalid_status_class' }
    return { ok: true, value: { id: b.id, machine: b.machine, status: 'failed', status_class: b.status_class, feedback_file_id: null, summary: null } }
  }
  if (b.status !== 'done') return { ok: false, error: 'invalid_status' }
  if (typeof b.feedback_file_id !== 'string' || !DRIVE_ID_RE.test(b.feedback_file_id)) return { ok: false, error: 'invalid_feedback_file_id' }
  const summary = parseSummary(b.summary)
  if (!summary) return { ok: false, error: 'invalid_summary' }
  return { ok: true, value: { id: b.id, machine: b.machine, status: 'done', status_class: null, feedback_file_id: b.feedback_file_id, summary } }
}

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

/** The one email: a Claude Code prompt he can paste as it is, with the feedback file's and the folder's links. */
export function composeEmail(row: FeedbackRow, summary: Summary, folderId: string, feedbackFileId: string): { subject: string; body: string } {
  const subject = `UX feedback ready: ${row.name}`
  const on = row.note ? row.note : 'the product in this recording'
  const minutes = summary.duration_s >= 60 ? `${Math.round(summary.duration_s / 60)} min` : `${Math.round(summary.duration_s)} s`
  const flagged = summary.signals.length
    ? summary.signals.map(s => `- ${clock(s.t)} ${s.signal} ("${s.term}"), still ${String(s.still).padStart(2, '0')}: "${s.said}"`).join('\n')
    : '- No friction, confusion, expectation or delight words were heard; read the whole timeline.'
  const links = `Feedback file: ${fileUrl(feedbackFileId)}\nStills folder: ${folderUrl(folderId)}`
  const prompt = [
    `I recorded myself using ${on} and narrating what I found (${minutes}). Content Watcher turned the recording into a`,
    'timestamped feedback file on my own machine: each line is a moment, with what I said around it, the words on',
    'screen and a link to the still of that moment. The tags are rules over my words and the screen text, not a judgement',
    'of the screen.',
    '',
    links,
    '',
    'The moments I flagged out loud:',
    flagged,
    '',
    `Work through this as UX feedback on ${on}:`,
    '1. Read the feedback file in full, and open every still you cite before saying what it shows.',
    '2. Group the moments into distinct problems, worst first, each with its timestamps and stills.',
    '3. For each problem, find the code that renders that screen, propose the smallest fix, and say how you will check it.',
    '4. Ask me before changing anything that is not clearly one of these problems.',
  ].join('\n')
  const body = [
    `Your feedback recording "${row.name}" is ready: ${summary.stills} stills (${summary.images} pictures), ${summary.signals.length} moments flagged.`,
    '',
    links,
    '',
    '--- Claude Code prompt: copy from here ---',
    prompt,
    '--- end of prompt ---',
  ].join('\n')
  return { subject, body }
}

export type ReportOutcome =
  | { ok: true; status: 'done'; emailed_via: 'send' | 'draft' | 'failed' }
  | { ok: true; status: 'queued' | 'failed' }
  | { ok: false; code: number; error: string }

/** The machine holding the claim reports. Done sends the email; a failure goes back to the queue below 3 attempts. */
export async function report(store: FeedbackStore, mailer: Mailer, body: ReportBody, now = new Date()): Promise<ReportOutcome> {
  const row = await store.get(body.id)
  if (!holds(row, body.machine)) return { ok: false, code: 409, error: 'not_your_claim' }
  const was = { status: 'claimed', claimed_at: row.claimed_at }
  if (body.status === 'failed') {
    const again = row.attempts < MAX_ATTEMPTS
    const updated = await store.updateIf(row.id, was, {
      status: again ? 'queued' : 'failed', status_class: body.status_class,
      ...(again ? { claimed_by: null, claimed_at: null } : {}), updated_at: iso(now),
    })
    if (!updated) return { ok: false, code: 409, error: 'not_your_claim' }
    return { ok: true, status: again ? 'queued' : 'failed' }
  }
  if (!row.drive_folder_id) return { ok: false, code: 409, error: 'no_drive_folder' }
  const done = await store.updateIf(row.id, was, {
    status: 'done', status_class: null, feedback_file_id: body.feedback_file_id, summary: body.summary, updated_at: iso(now),
  })
  if (!done) return { ok: false, code: 409, error: 'not_your_claim' }
  const { subject, body: text } = composeEmail(row, body.summary as Summary, row.drive_folder_id, body.feedback_file_id as string)
  let via: 'send' | 'draft' | 'failed' = 'failed'
  try {
    const mailed = await mailer(subject, text)
    via = mailed.sent && mailed.via ? mailed.via : 'failed'
  } catch { /* recorded as failed: the recording is done either way */ }
  await store.updateIf(row.id, { status: 'done', claimed_at: done.claimed_at }, { emailed_via: via, emailed_at: iso(now) })
  return { ok: true, status: 'done', emailed_via: via }
}
