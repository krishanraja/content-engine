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
  placing_failed: 'could not place takes on their piece',
  pinned_python_missing: 'has no pinned Python, so it cannot place takes or publish music, references or working files (npm run bootstrap:python)',
  music_publish_failed: 'could not publish the licensed music to the library',
  references_publish_failed: 'could not publish the style references to the library',
  working_publish_failed: 'could not publish the working files to the library',
  library_root_missing: 'cannot find the asset library (makeyourmindup) folder on its H: drive',
  library_env_stale: 'has a MINDMAKE_LIBRARY_ROOT setting that points at a folder that is not there; it used config/studio.json instead. Delete the setting',
  library_sync_failed: 'could not file the asset library into Drive on its last pass (library-sync.log on that machine says why)',
})

/** A report older than this no longer fails the job: a machine that is off is
 *  not a fault, the other one does the work. */
export const LANE_REPORT_FRESH_HOURS = 6

export interface LaneReport {
  schema_version: 1
  machine: string
  at: string
  problems: string[]
}

const MACHINE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/

export function parseLaneReport(value: unknown, now: string): LaneReport | null {
  const body = value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  if (!body || typeof body.machine !== 'string' || !MACHINE_RE.test(body.machine)) return null
  if (!Array.isArray(body.problems) || body.problems.length > 20) return null
  const problems = [...new Set(body.problems)]
  if (problems.some((p) => typeof p !== 'string' || !Object.prototype.hasOwnProperty.call(LANE_PROBLEMS, p))) return null
  return { schema_version: 1, machine: body.machine, at: now, problems: (problems as string[]).sort() }
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
