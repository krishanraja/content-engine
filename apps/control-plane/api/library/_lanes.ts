import { supabase } from '../_supabase.js'

// What each home computer's recordings upload found on its last pass, kept so
// a problem on a machine reaches Control Center instead of only a hidden log.
//
// From 22 to 24 October 2026 both machines logged "the Inbox ... cannot be
// reached" every five minutes into recordings-upload.log, and nothing else saw
// it: a stale MINDMAKE_MEDIA_INBOX pointed at a folder Krish had renamed. Now
// each pass sends a short report (POST /api/library/recordings/lane, on the
// runner bearer) and the Inbox job (recordings_drive_inbox), which runs every
// ten minutes and is in the run ledger, fails with the machine and the problem
// named while that machine's last report holds one. Control Center shows a
// failed job.
//
// No table: one small JSON object per machine in the library's private
// bucket, under lanes/, beside nothing the library's index or the recordings
// list reads.

export const LANE_PREFIX = 'lanes'

/** The problems a pass may report, each with the words Krish reads. */
export const LANE_PROBLEMS: Readonly<Record<string, string>> = Object.freeze({
  inbox_unreachable: 'cannot reach the Video Engine Inbox on its H: drive (Google Drive not running, or the folder path is wrong)',
  inbox_env_stale: 'has a MINDMAKE_MEDIA_INBOX setting that points at a folder that is not there; it used config/studio.json instead. Delete the setting',
  drive_root_env_stale: 'has a MINDMAKE_DRIVE_ROOT setting that points at a folder that is not there. Delete the setting',
  archive_env_stale: 'has a MINDMAKE_ARCHIVE_ROOT setting that points at a folder that is not there. Delete the setting',
  sending_failed: 'could not send one or more recordings to the engine',
  pass_stopped: 'had its recordings pass stop part way (recordings-upload.log on that machine says why)',
  placing_failed: 'could not place takes on their piece',
  pinned_python_missing: 'has no pinned Python, so it cannot place takes or publish music, references or working files (npm run bootstrap:python)',
  music_publish_failed: 'could not publish the licensed music to the library',
  references_publish_failed: 'could not publish the style references to the library',
  working_publish_failed: 'could not publish the working files to the library',
  library_root_missing: 'cannot find the asset library (makeyourmindup) folder on its H: drive',
  library_env_stale: 'has a MINDMAKE_LIBRARY_ROOT setting that points at a folder that is not there; it used config/studio.json instead. Delete the setting',
  library_sync_failed: 'could not file the asset library into Drive on its last pass (library-sync.log on that machine says why)',
  // The content watcher on the same machine (krishanraja/content-watcher), kept running and up to date by this pass.
  // Krish, 2026-10-28: "i should never really need to copy and paste log files to you like this, ever, this is
  // ridiculous". Its health travels in the report's `watch` block; GET /api/library/recordings/lane reads it back.
  watch_not_installed: 'has no content watcher installed, so the links you paste are left to the other computer and the cloud backup',
  watch_update_failed: 'could not bring its content watcher up to date',
  watch_cannot_reach_engine: 'has a content watcher that cannot reach the engine (its health report names the cause)',
  watch_key_problem: 'has a content watcher with no engine key, or one the engine refuses',
  watch_run_failed: 'has a content watcher whose runs fail (its health report names the cause)',
  watch_not_running: 'has a content watcher that has not run for 15 minutes even after this pass started it',
  watch_task_broken: 'has a content watcher whose task cannot start, and this pass could not install it again (its log says why)',
})

/** A report older than this no longer fails the job: a machine that is off is
 *  not a fault, the other one does the work. */
export const LANE_REPORT_FRESH_HOURS = 6

/** The content watcher's health on one machine, as its recordings pass read it: class names, counts and times only,
 *  never a link, a caption, a file name or a message. */
export interface WatchHealth {
  last_run_at: string | null
  counts: Record<string, number>
  /** Every watcher run of the last 6 hours, summed, by the same keys as counts. */
  recent?: Record<string, number>
  stage: string | null
  stage_at: string | null
  task_state: string | null
  task_result: number | null
  head: string | null
  repaired: string[]
}

/** Whether the machine's scheduled tasks open windows, as its recordings pass found them (scripts/windowless.ps1):
 *  the launcher that hides them built and proved, tasks already hidden, tasks changed this pass, tasks that could not
 *  be changed. Counts only, never a task's name or command. Krish, 2026-10-28: "HIDE ALL CONSOLE POP UPS FOREVER FROM
 *  EVERY REPO AND LOCAL TASK". */
export interface WindowsHealth {
  launcher: 'ok' | 'failed'
  hidden: number
  wrapped: number
  left: number
  /** Why each task left was not changed, by class: elevated, access_denied or other. */
  left_by?: Record<string, number>
  /** Our own tasks among them, by name ("Mindmake ..."); anyone else's task is only counted. */
  left_ours?: string[]
}

export interface LaneReport {
  schema_version: 1
  machine: string
  at: string
  problems: string[]
  watch?: WatchHealth
  windows?: WindowsHealth
}

const COUNT_KEY_RE = /^[a-z0-9_.]{1,80}$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const isoOrNull = (v: unknown) => (typeof v === 'string' && ISO_RE.test(v) ? v : null)
const wordOrNull = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : null)

/** A watch block with anything outside its shape dropped; a block that is not an object is no block. */
export function parseWatchHealth(value: unknown): WatchHealth | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const w = value as Record<string, unknown>
  const countsOf = (value: unknown): Record<string, number> => {
    const out: Record<string, number> = {}
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, n] of Object.entries(value as Record<string, unknown>).slice(0, 60)) {
        if (COUNT_KEY_RE.test(key) && Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 1_000_000) out[key] = n as number
      }
    }
    return out
  }
  const counts = countsOf(w.counts)
  // Every run of the last 6 hours, summed: the last line alone hides a failure the next minute's empty run covers.
  // On 28 October an Instagram post spent its three tries in five minutes and the report showed only claimed: 0.
  const recent = countsOf(w.recent)
  const repaired = Array.isArray(w.repaired)
    ? [...new Set(w.repaired.filter((r): r is string => typeof r === 'string' && /^[a-z_]{1,40}$/.test(r)))].slice(0, 10)
    : []
  return {
    last_run_at: isoOrNull(w.last_run_at),
    counts,
    ...(Object.keys(recent).length ? { recent } : {}),
    stage: wordOrNull(w.stage, /^[a-z_]{1,20}$/),
    stage_at: isoOrNull(w.stage_at),
    task_state: wordOrNull(w.task_state, /^[A-Za-z]{1,20}$/),
    task_result: Number.isInteger(w.task_result) ? (w.task_result as number) : null,
    head: wordOrNull(w.head, /^[0-9a-f]{7,40}$/),
    repaired,
  }
}

export function parseWindowsHealth(value: unknown): WindowsHealth | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const w = value as Record<string, unknown>
  if (w.launcher !== 'ok' && w.launcher !== 'failed') return undefined
  const count = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 10_000 ? n as number : 0)
  const ours = Array.isArray(w.left_ours)
    ? [...new Set(w.left_ours.filter((n): n is string => typeof n === 'string' && /^Mindmake [A-Za-z0-9 ._-]{1,60}$/.test(n)))].slice(0, 10)
    : []
  const leftBy: Record<string, number> = {}
  if (w.left_by && typeof w.left_by === 'object' && !Array.isArray(w.left_by)) {
    for (const [why, n] of Object.entries(w.left_by as Record<string, unknown>)) {
      if (['elevated', 'access_denied', 'other'].includes(why) && count(n)) leftBy[why] = count(n)
    }
  }
  return {
    launcher: w.launcher, hidden: count(w.hidden), wrapped: count(w.wrapped), left: count(w.left),
    ...(Object.keys(leftBy).length ? { left_by: leftBy } : {}),
    ...(ours.length ? { left_ours: ours } : {}),
  }
}

const MACHINE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/

export function parseLaneReport(value: unknown, now: string): LaneReport | null {
  const body = value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  if (!body || typeof body.machine !== 'string' || !MACHINE_RE.test(body.machine)) return null
  if (!Array.isArray(body.problems) || body.problems.length > 20) return null
  const problems = [...new Set(body.problems)]
  if (problems.some((p) => typeof p !== 'string' || !Object.prototype.hasOwnProperty.call(LANE_PROBLEMS, p))) return null
  const watch = parseWatchHealth(body.watch)
  const windows = parseWindowsHealth(body.windows)
  return {
    schema_version: 1, machine: body.machine, at: now, problems: (problems as string[]).sort(),
    ...(watch ? { watch } : {}), ...(windows ? { windows } : {}),
  }
}

export function laneKey(machine: string): string {
  return `${LANE_PREFIX}/recordings-${machine.toLowerCase()}.json`
}

/** The problems every machine reported on its last pass, in plain words, for
 *  reports newer than LANE_REPORT_FRESH_HOURS. Pure. */
export function lanePlainProblems(reports: readonly LaneReport[], now: number): string[] {
  const out: string[] = []
  for (const report of reports) {
    const at = Date.parse(report.at)
    if (!Number.isFinite(at) || now - at > LANE_REPORT_FRESH_HOURS * 3_600_000) continue
    for (const problem of report.problems) out.push(`home computer ${report.machine} ${LANE_PROBLEMS[problem]}`)
  }
  return out
}

export async function writeLaneReport(bucket: string, report: LaneReport): Promise<boolean> {
  const body = Buffer.from(JSON.stringify(report), 'utf8')
  const result = await supabase.storage.from(bucket).upload(laneKey(report.machine), body, { contentType: 'application/json', upsert: true })
  return !result.error
}

export async function readLaneReports(bucket: string): Promise<{ reports: LaneReport[]; error: boolean }> {
  const listing = await supabase.storage.from(bucket).list(LANE_PREFIX, { limit: 50 })
  if (listing.error) return { reports: [], error: true }
  const reports: LaneReport[] = []
  for (const entry of listing.data || []) {
    if (!/^recordings-[a-z0-9_-]+\.json$/.test(entry.name)) continue
    const file = await supabase.storage.from(bucket).download(`${LANE_PREFIX}/${entry.name}`)
    if (file.error || !file.data) continue
    try {
      const raw = JSON.parse(await file.data.text())
      const parsed = parseLaneReport(raw, typeof raw?.at === 'string' ? raw.at : '')
      if (parsed) reports.push(parsed)
    } catch { /* a broken report is ignored; the next pass rewrites it */ }
  }
  return { reports, error: false }
}
