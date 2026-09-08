// Which route runs which job, and whether replaying it is safe.
//
// The ledger records a job name; the scheduler knows a path. Nothing joined
// them, so "feed_ingest failed on Thursday" could be read in the obligation
// strip and not acted on without someone grepping for the string. A failed
// weekly job then waits a week, which is the fragility this closes.
//
// Pure by construction: this decides what may be replayed and imports nothing
// outside node:, so the guard and the tests run with no database, no network
// and no key. check-run-recovery.ts enforces both that purity and that this
// registry and the cron list in vercel.json stay in step.

export type JobSafety = 'replayable' | 'manual_only'

export interface JobEntry {
  /** The route that runs it, exactly as vercel.json schedules it. */
  path: string
  /** How the job behaves when run a second time over the same window. */
  safety: JobSafety
  /** Why, in one line, said to whoever is deciding at 2am whether to press it. */
  note: string
}

/** Every job that wraps itself in withContentRun, keyed by the name it records.
 *
 *  `manual_only` is not a lock: it is the honest answer to "is running this
 *  again free". purge deletes, and its replay path is purge/restore, not a
 *  second delete. The two ingest jobs cost real money per run. */
export const JOBS: Readonly<Record<string, JobEntry>> = Object.freeze({
  inspiration_scan: { path: '/api/inspiration/drive-scan', safety: 'replayable', note: 'Dedupes on the Drive file ledger; a second scan reads nothing new.' },
  triage_sweep: { path: '/api/triage/sweep', safety: 'replayable', note: 'Idempotent sweep over expiry windows.' },
  content_cluster: { path: '/api/content-ideas/cluster', safety: 'replayable', note: 'Recomputes clusters from current rows.' },
  archive_stale: { path: '/api/content-ideas/archive-stale', safety: 'replayable', note: 'Archives by age; a second pass finds nothing left.' },
  editorial_radar: { path: '/api/content-opportunities/refresh', safety: 'replayable', note: 'Refreshes opportunities in place.' },
  lens_radar: { path: '/api/discover-lens-radar', safety: 'replayable', note: 'Deduped on source_ref before insert.' },
  creator_posts: { path: '/api/discover-creator-posts', safety: 'replayable', note: 'Unique index on creator move URL; costs Apify credit.' },
  build_signals: { path: '/api/discover-build-signals', safety: 'replayable', note: 'Reads the repo registry; deduped on commit.' },
  feed_ingest: { path: '/api/feed/ingest', safety: 'replayable', note: 'Deduped on source_ref.' },
  shifts_detect: { path: '/api/shifts/detect', safety: 'replayable', note: 'Recomputes the week; overwrites its own output.' },
  arcs_surface: { path: '/api/arcs/surface', safety: 'replayable', note: 'Recomputes surfacing for the week.' },
  briefs_assemble: { path: '/api/briefs/assemble', safety: 'replayable', note: 'Appends a brief version rather than replacing one.' },
  investigations: { path: '/api/investigations/run', safety: 'replayable', note: 'Resumes the ladder from its recorded gate.' },
  learning_compile: { path: '/api/learning/compile', safety: 'replayable', note: 'Proposes; it never writes config.' },
  runner_watch: { path: '/api/video-studio/runner/watch', safety: 'replayable', note: 'Read-only over heartbeats and queues.' },
  aeo_ingest: { path: '/api/aeo/ingest', safety: 'manual_only', note: 'Spends roughly $0.70 of probe budget per run and has no schedule.' },
  purge: { path: '/api/purge/run', safety: 'manual_only', note: 'Hard-deletes. To undo a purge use POST /api/purge/restore, never a second run.' },
})

export const JOB_NAMES: readonly string[] = Object.freeze(Object.keys(JOBS).sort())

export interface ReplayTarget {
  job: string
  path: string
  note: string
}

export type ReplayRefusal =
  | { ok: false; error: 'job_required' }
  | { ok: false; error: 'unknown_job'; known: readonly string[] }
  | { ok: false; error: 'job_is_manual_only'; note: string }
  | { ok: false; error: 'since_must_be_iso8601' }

/** Resolve a replay request, or say precisely why not.
 *
 *  `since` is passed through to jobs that accept a backfill window. It is
 *  validated here rather than at the target because a malformed value should
 *  cost nothing: refusing before the invocation is the difference between a
 *  400 and a job that runs over the wrong window and records itself as ok. */
export function resolveReplay(
  input: { job?: unknown; since?: unknown },
  registry: Readonly<Record<string, JobEntry>> = JOBS,
): { ok: true; target: ReplayTarget; since: string | null } | ReplayRefusal {
  const job = typeof input.job === 'string' ? input.job.trim() : ''
  if (!job) return { ok: false, error: 'job_required' }

  const entry = registry[job]
  // Object.freeze does not stop a lookup of 'constructor' or '__proto__'
  // returning something truthy, and a path taken off Object.prototype is a
  // request this route would then make against itself.
  if (!entry || !Object.prototype.hasOwnProperty.call(registry, job)) {
    return { ok: false, error: 'unknown_job', known: JOB_NAMES }
  }
  if (entry.safety === 'manual_only') {
    return { ok: false, error: 'job_is_manual_only', note: entry.note }
  }

  let since: string | null = null
  if (input.since !== undefined && input.since !== null && input.since !== '') {
    if (typeof input.since !== 'string') return { ok: false, error: 'since_must_be_iso8601' }
    const parsed = Date.parse(input.since)
    if (!Number.isFinite(parsed)) return { ok: false, error: 'since_must_be_iso8601' }
    since = new Date(parsed).toISOString()
  }

  return { ok: true, target: { job, path: entry.path, note: entry.note }, since }
}

/** Build the absolute URL a replay calls.
 *
 *  The engine invokes its own route over HTTP rather than importing the
 *  handler: each route is a separate serverless function with its own memory
 *  and duration budget, and importing one into another would run a fifteen
 *  minute brief assembly inside the replay's own timeout.
 *
 *  The host is taken from the platform, never from the request, because a
 *  Host header is attacker-controlled and this call carries CRON_SECRET. */
export function replayUrl(path: string, since: string | null, deploymentHost: string | undefined): string {
  const host = (deploymentHost || '').trim()
  if (!host) throw new Error('deployment host is unknown; refusing to guess where to send a secret')
  if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error('deployment host is not a hostname')
  const query = since ? `?since=${encodeURIComponent(since)}` : ''
  return `https://${host}${path}${query}`
}
