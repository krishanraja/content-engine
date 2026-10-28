// Feedback videos Krish records on his phone about one of his own products: what a home computer may claim, where
// the stills and the feedback go, and the email he gets.
//
// Krish, 2026-10-28: "somewhere in my control centre where I can specifically add a feedback video that's not
// inspiration ... It would trigger only this one part of the system", then "specify which venture this feedback is
// for (because it's usually me providing real-world mobile UX feedback on a particular mobile experience of mine in
// one of the ventures)", with the outputs "in the right places inside the Ventures folder (not the inspiration
// folder)", and the input a link: "videos I'll take on my phone as MP4 and upload them to Google Drive ... I probably
// want to send the link to the MP4 or the video file, which is stored in my Google Drive."
//
// So: Control Center (api/feedback-videos.ts) checks his Drive link and writes the row with the venture (migration
// 20261116090000_ux_feedback_recordings.sql). content-watcher on a home computer claims it here, reads the video from
// his synced Drive (no copy, no download link, no Drive key on the machine), makes the timeline, and asks for upload
// sessions in Ventures > Bugs & Issues > <venture> > <day> <name> (filearchives D-033: "If I notice bugs or issues
// while on my phone, I put them in Bugs and Issues"). The report writes the Claude Code prompt into that folder and
// emails it to him. Nothing here touches the Inspiration queue, content_reads or the Inspiration folders, and nothing
// moves, copies or deletes his recording.
//
// Everything here is pure, so the tests run with no database and no Google: the routes pass in a store, a Drive and a
// mailer.

import { isCloudMachine, type Parsed } from '../watch/_watch.js'

// A recording is transcribed on a home computer's CPU: a claim is stale after an hour.
export const STALE_CLAIM_MS = 60 * 60 * 1000
// A try that failed (most often a recording his Drive has not synced to the computer yet) waits this long, times the
// tries so far, before anyone may claim it again.
export const RETRY_AFTER_MS = 10 * 60 * 1000
export const MAX_ATTEMPTS = 3
export const MAX_DRIVE_FILES = 150
export const MAX_DRIVE_FILE_BYTES = 50 * 1024 * 1024
export const MAX_SIGNALS = 100
export const STILLS_FOLDER = 'Stills'
export const PROMPT_FILE = 'Claude Code prompt.md'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MACHINE_RE = /^[A-Za-z0-9._-]{1,80}$/
const CLASS_RE = /^[a-z_]{1,40}$/
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/
const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,199}$/
const PLACES: Record<string, string> = { 'image/jpeg': 'stills', 'text/markdown': 'folder' }
const SIGNALS = new Set(['friction', 'confusion', 'expectation', 'delight'])

export interface FeedbackRow {
  id: string
  name: string
  note: string | null
  drive_file_id: string
  drive_path: string
  mime: string
  bytes: number
  md5: string | null
  duration_ms: number | null
  venture: string
  venture_label: string
  repo: string | null
  domain: string | null
  status: 'queued' | 'claimed' | 'done' | 'failed'
  status_class: string | null
  attempts: number
  claimed_by: string | null
  claimed_at: string | null
  drive_folder_id: string | null
  stills_folder_id: string | null
  feedback_file_id: string | null
  prompt_file_id: string | null
  requested_at: string
  updated_at: string | null
}

export interface FeedbackStore {
  /** Recordings that are queued, or claimed before `staleBefore`, oldest first. */
  claimable(staleBefore: string, limit: number): Promise<FeedbackRow[]>
  /** Update one recording only while it still has the status and claim it had when read. Returns the new row, or null. */
  updateIf(id: string, was: { status: string; claimed_at: string | null }, patch: Record<string, unknown>): Promise<FeedbackRow | null>
  get(id: string): Promise<FeedbackRow | null>
}

export interface FeedbackDrive {
  /** Ventures > Bugs & Issues, from the Drive map (system_config drive_destinations `bugs_and_issues`), or null. */
  bugsAndIssues(): Promise<string | null>
  /** The folders directly inside a folder: id and name. */
  folders(parentId: string): Promise<Array<{ id: string; name: string }>>
  createFolder(parentId: string, name: string): Promise<string>
  /** Open a resumable upload session for a new file; returns the session URL the bytes are PUT to. */
  startUpload(folderId: string, name: string, mime: string, bytes: number): Promise<string>
  /** Make a small text file in one request; returns its id. */
  writeText(folderId: string, name: string, text: string): Promise<string>
}

export type Mailer = (subject: string, body: string) => Promise<{ sent: boolean; via: 'send' | 'draft' | null }>

export interface Signal { t: number; signal: string; term: string; said: string; still: number }
export interface Summary {
  duration_s: number; stills: number; images: number; signals: Signal[]
  width: number | null; height: number | null; portrait: boolean | null
}

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

/** What a machine gets for a claimed recording: where it sits in his Drive, so the machine reads its synced copy. */
export function claimView(row: FeedbackRow) {
  return {
    id: row.id, name: row.name, note: row.note, mime: row.mime, bytes: row.bytes, md5: row.md5,
    drive_file_id: row.drive_file_id, drive_path: row.drive_path, venture: row.venture,
    venture_label: row.venture_label, attempts: row.attempts,
  }
}

/** Whether a recording may be claimed now: a failed try waits before anyone takes it again. */
export function claimableNow(row: FeedbackRow, now: Date): boolean {
  if (row.status === 'queued' && row.attempts > 0 && row.updated_at) {
    return Date.parse(row.updated_at) <= now.getTime() - RETRY_AFTER_MS * row.attempts
  }
  return true
}

export async function waiting(store: FeedbackStore, now = new Date()): Promise<number> {
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString()
  return (await store.claimable(staleBefore, 30)).filter(row => claimableNow(row, now)).length
}

export type ClaimOutcome =
  | { ok: true; recording: ReturnType<typeof claimView> | null; expired: number }
  | { ok: false; code: number; error: string }

/** Claim one recording for one machine. Only a home computer: its Drive is synced there, and the video stays there. */
export async function claimOne(store: FeedbackStore, machine: string, now = new Date()): Promise<ClaimOutcome> {
  if (isCloudMachine(machine)) return { ok: false, code: 403, error: 'home_machines_only' }
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString()
  let expired = 0
  for (const row of (await store.claimable(staleBefore, 10)).filter(r => claimableNow(r, now))) {
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
    if (taken) return { ok: true, recording: claimView(taken), expired }
  }
  return { ok: true, recording: null, expired }
}

function holds(row: FeedbackRow | null, machine: string): row is FeedbackRow {
  return !!row && row.status === 'claimed' && row.claimed_by === machine
}

export interface DriveFileAsk { name: string; mime: string; bytes: number; place: 'stills' | 'folder' }
export interface DriveBody { id: string; machine: string; files: DriveFileAsk[] }

/** Stills (image/jpeg) go in the Stills folder; feedback.md (text/markdown) in the recording's folder. */
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
    const place = typeof f?.mime === 'string' ? PLACES[f.mime] : undefined
    if (
      !f || typeof f.name !== 'string' || !FILE_NAME_RE.test(f.name) || names.has(f.name) || !place
      || (f.place !== undefined && f.place !== place) || f.name === PROMPT_FILE
      || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_DRIVE_FILE_BYTES
    ) return { ok: false, error: 'invalid_files' }
    names.add(f.name)
    files.push({ name: f.name, mime: f.mime as string, bytes, place: place as 'stills' | 'folder' })
  }
  return { ok: true, value: { id: b.id, machine: b.machine, files } }
}

/** The recording's own folder: the day he added it, for him to find it by, then its name. */
export function folderName(row: Pick<FeedbackRow, 'name' | 'requested_at'>): string {
  const day = row.requested_at.slice(0, 10)
  const stem = row.name.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[^A-Za-z0-9 ._()-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  return `${day} ${stem || 'feedback'}`
}

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** His folder for a venture inside Bugs & Issues: one named by its slug or its label in any case or spacing (he made
 *  `mindmake` by hand on 24 October), else none. */
export function ventureFolder(folders: Array<{ id: string; name: string }>, row: Pick<FeedbackRow, 'venture' | 'venture_label'>): string | null {
  const wanted = new Set([fold(row.venture), fold(row.venture_label)])
  return folders.find(f => wanted.has(fold(f.name)))?.id ?? null
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`
export const fileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`

export type DriveOutcome =
  | { ok: true; folder_id: string; folder_url: string; stills_folder_id: string | null; uploads: Array<{ name: string; upload_url: string }> }
  | { ok: false; code: number; error: string }

/** Upload sessions for the stills and the feedback file, in the recording's own folder under its venture in Bugs &
 *  Issues. Each folder is made once and kept on the row; nothing is ever made at the top of his Drive. */
export async function planDrive(store: FeedbackStore, drive: FeedbackDrive, body: DriveBody, now = new Date()): Promise<DriveOutcome> {
  let row = await store.get(body.id)
  if (!holds(row, body.machine)) return { ok: false, code: 409, error: 'not_your_claim' }
  const save = async (patch: Record<string, unknown>) => {
    const saved = await store.updateIf(row!.id, { status: 'claimed', claimed_at: row!.claimed_at }, { ...patch, updated_at: iso(now) })
    if (saved) row = saved
    return !!saved
  }
  if (!row.drive_folder_id) {
    const area = await drive.bugsAndIssues()
    if (!area) return { ok: false, code: 503, error: 'no_drive_destination' }
    const venture = ventureFolder(await drive.folders(area), row) ?? await drive.createFolder(area, row.venture_label)
    if (!await save({ drive_folder_id: await drive.createFolder(venture, folderName(row)) })) return { ok: false, code: 409, error: 'not_your_claim' }
  }
  if (!row.stills_folder_id && body.files.some(f => f.place === 'stills')) {
    if (!await save({ stills_folder_id: await drive.createFolder(row.drive_folder_id as string, STILLS_FOLDER) })) {
      return { ok: false, code: 409, error: 'not_your_claim' }
    }
  }
  const uploads = []
  for (const file of body.files) {
    const into = file.place === 'stills' ? row.stills_folder_id as string : row.drive_folder_id as string
    uploads.push({ name: file.name, upload_url: await drive.startUpload(into, file.name, file.mime, file.bytes) })
  }
  return {
    ok: true, folder_id: row.drive_folder_id as string, folder_url: folderUrl(row.drive_folder_id as string),
    stills_folder_id: row.stills_folder_id, uploads,
  }
}

export interface ReportBody {
  id: string
  machine: string
  status: 'done' | 'failed'
  status_class: string | null
  feedback_file_id: string | null
  summary: Summary | null
}

const dimension = (v: unknown): number | null => {
  const n = Number(v)
  return v === undefined || v === null || !Number.isInteger(n) || n < 1 || n > 20000 ? null : n
}

function parseSummary(value: unknown): Summary | null {
  const s = obj(value)
  if (!s || !Array.isArray(s.signals) || s.signals.length > MAX_SIGNALS) return null
  const duration = Number(s.duration_s)
  const stills = Number(s.stills)
  const images = Number(s.images)
  if (!Number.isFinite(duration) || duration < 0 || !Number.isInteger(stills) || stills < 0 || !Number.isInteger(images) || images < 0) return null
  if (s.portrait !== undefined && s.portrait !== null && typeof s.portrait !== 'boolean') return null
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
  return {
    duration_s: duration, stills, images, signals, width: dimension(s.width), height: dimension(s.height),
    portrait: typeof s.portrait === 'boolean' ? s.portrait : null,
  }
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

/** The Claude Code prompt, as he pastes it: the product, where its code is, the links, and the moments he flagged. */
export function composePrompt(row: FeedbackRow, summary: Summary, links: { folder: string; feedback: string }): string {
  const product = row.domain ? `${row.venture_label} (${row.domain})` : row.venture_label
  const recorded = summary.portrait === true ? 'recorded on my phone' : summary.portrait === false ? 'recorded on screen' : 'recorded'
  const minutes = summary.duration_s >= 60 ? `${Math.round(summary.duration_s / 60)} min` : `${Math.round(summary.duration_s)} s`
  const flagged = summary.signals.length
    ? summary.signals.map(s => `- ${clock(s.t)} ${s.signal} ("${s.term}"), still ${String(s.still).padStart(2, '0')}: "${s.said}"`).join('\n')
    : '- No friction, confusion, expectation or delight words were heard; read the whole timeline.'
  return [
    `This is real-world UX feedback on ${product}, ${recorded} (${minutes}) while I used it and said what I found.`,
    ...(row.repo ? [`Work in the ${row.repo} repository.`] : []),
    ...(row.note ? [`What it is about, in my words: ${row.note}`] : []),
    'Content Watcher turned the recording into a timestamped feedback file on my own machine: each line is a moment, with',
    'what I said around it, the words on screen and a link to the still of that moment. The tags are rules over my words',
    'and the screen text, not a judgement of the screen.',
    '',
    `Feedback file: ${links.feedback}`,
    `Stills and the feedback, in Drive: ${links.folder}`,
    `The recording: ${fileUrl(row.drive_file_id)}`,
    '',
    'The moments I flagged out loud:',
    flagged,
    '',
    `Work through this as UX feedback on ${row.venture_label}:`,
    '1. Read the feedback file in full, and open every still you cite before saying what it shows.',
    '2. Group the moments into distinct problems, worst first, each with its timestamps and stills.',
    '3. For each problem, find the code that renders that screen, propose the smallest fix, and say how you will check it.',
    '4. Ask me before changing anything that is not clearly one of these problems.',
  ].join('\n')
}

/** The one email: the links first, then the prompt he can paste as it is. */
export function composeEmail(row: FeedbackRow, summary: Summary, links: { folder: string; feedback: string; prompt: string | null }, prompt: string): { subject: string; body: string } {
  const body = [
    `Your feedback recording on ${row.venture_label}, "${row.name}", is ready: ${summary.stills} stills (${summary.images} pictures), ${summary.signals.length} moments flagged.`,
    '',
    `Folder (Ventures > Bugs & Issues > ${row.venture_label}): ${links.folder}`,
    `Feedback file: ${links.feedback}`,
    ...(links.prompt ? [`The prompt, in the folder: ${links.prompt}`] : []),
    '',
    '--- Claude Code prompt: copy from here ---',
    prompt,
    '--- end of prompt ---',
  ].join('\n')
  return { subject: `UX feedback: ${row.venture_label}, ${row.name}`, body }
}

export type ReportOutcome =
  | { ok: true; status: 'done'; emailed_via: 'send' | 'draft' | 'failed'; prompt_file_id: string | null }
  | { ok: true; status: 'queued' | 'failed' }
  | { ok: false; code: number; error: string }

/** The machine holding the claim reports. Done writes the prompt into the folder and sends the email; a failure goes
 *  back to the queue below 3 attempts. */
export async function report(store: FeedbackStore, drive: FeedbackDrive | null, mailer: Mailer, body: ReportBody, now = new Date()): Promise<ReportOutcome> {
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
  const summary = body.summary as Summary
  const links = { folder: folderUrl(row.drive_folder_id), feedback: fileUrl(body.feedback_file_id as string) }
  const prompt = composePrompt(row, summary, links)
  let promptFileId: string | null = null
  try {
    promptFileId = drive ? await drive.writeText(row.drive_folder_id, PROMPT_FILE, `${prompt}\n`) : null
  } catch { /* the email still carries the prompt */ }
  const done = await store.updateIf(row.id, was, {
    status: 'done', status_class: null, feedback_file_id: body.feedback_file_id, prompt_file_id: promptFileId,
    summary, updated_at: iso(now),
  })
  if (!done) return { ok: false, code: 409, error: 'not_your_claim' }
  const { subject, body: text } = composeEmail(row, summary, { ...links, prompt: promptFileId ? fileUrl(promptFileId) : null }, prompt)
  let via: 'send' | 'draft' | 'failed' = 'failed'
  try {
    const mailed = await mailer(subject, text)
    via = mailed.sent && mailed.via ? mailed.via : 'failed'
  } catch { /* recorded as failed: the recording is done either way */ }
  await store.updateIf(row.id, { status: 'done', claimed_at: done.claimed_at }, { emailed_via: via, emailed_at: iso(now) })
  return { ok: true, status: 'done', emailed_via: via, prompt_file_id: promptFileId }
}
