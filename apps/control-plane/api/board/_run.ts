// Every board button starts the machine that does the work (Krish, 2026-11-09: "Absolutely everything that isn't 100%
// complete needs an action button", and "Are you sure that all the buttons are as actionable as possible, given what is
// actually running the machinery?"). docs/plans/2026-11-09-board-desk/PLAN.md, "Every button starts the real machine".
//
// A press asks GitHub to run one allow-listed workflow in this repository, as a repository_dispatch: the same way, and
// with the same token, as the Improve press already starts offday-revise (_offdayRevise.ts; OFFDAY_REVISE_DISPATCH_TOKEN
// or PLACE_TAKES_DISPATCH_TOKEN, Contents: read and write, docs/INTEGRATIONS.md). No new token. Nothing here publishes,
// posts or sends: each workflow keeps its own fences (no-claude-routines, the publish guard, his presses).
//
// The repository is public, so the runs' status is read from GitHub's public API (readRuns), with the same token when
// one is set (a higher rate limit). The board shows each job's latest run: queued, running, done or failed.

export type JobName = 'make-piece' | 'offday-revise' | 'saturday-goodnews' | 'sunday-ideas' | 'produce-day' | 'repair-round' | 'signoff-apply'

interface Job {
  workflow: string
  /** What the press may carry, checked before anything is sent. */
  payload(input: Record<string, unknown>): Record<string, unknown> | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const isMonday = (v: unknown) => typeof v === 'string' && DATE.test(v) && new Date(`${v}T00:00:00Z`).getUTCDay() === 1
const OPTION = /^off-(mon|tue|wed|thu|fri|sat|sun)-[A-Za-z0-9][A-Za-z0-9_.:-]{0,59}$/
const CUT = /^(mon|wed|fri)-(long|short)$/

export const JOBS: Record<JobName, Job> = {
  'make-piece': {
    workflow: 'make-piece.yml',
    payload: i => (typeof i.piece_id === 'string' && UUID.test(i.piece_id) ? { piece_id: i.piece_id.toLowerCase() } : null),
  },
  'offday-revise': {
    workflow: 'offday-revise.yml',
    payload: i => (isMonday(i.week) && (i.option === undefined || OPTION.test(String(i.option)))
      ? { week: i.week, ...(i.option ? { option: i.option } : {}) } : null),
  },
  // A press means now: the run finds the week's stories again, by hand (saturday_goodnews.py check --force); the Sunday
  // ideas run finds them each week (Ruling, Krish, 2026-11-11).
  // `fill` (Ruling, Krish, 2026-11-13: the Saturday carousel is five good-news stories on one topic): the good-news post
  // he approved holds fewer than five, so the run finds the rest on its topic and writes them onto that option.
  'saturday-goodnews': { workflow: 'saturday-goodnews.yml', payload: i => (isMonday(i.week) && (i.fill === undefined || OPTION.test(String(i.fill)))
    ? { week: i.week, force: true, ...(i.fill ? { fill: i.fill } : {}) } : null) },
  'sunday-ideas': { workflow: 'sunday-ideas.yml', payload: i => (isMonday(i.week) ? { week: i.week } : null) },
  'produce-day': {
    workflow: 'produce-day.yml',
    payload: i => (typeof i.date === 'string' && DATE.test(i.date) && (i.piece === undefined || UUID.test(String(i.piece)))
      ? { date: i.date, ...(i.piece ? { piece: String(i.piece).toLowerCase() } : {}) } : null),
  },
  'repair-round': {
    workflow: 'repair-round.yml',
    // repair-round.yml reads cuts as one line, day-cut pairs joined by commas, at most six.
    payload: i => (isMonday(i.week) && Array.isArray(i.cuts) && i.cuts.length > 0 && i.cuts.length <= 6 && i.cuts.every(c => CUT.test(String(c)))
      ? { week: i.week, cuts: i.cuts.map(String).join(',') } : null),
  },
  // His press on a sign-off card (_signOffs.ts) starts the job that writes the configs from his presses, read back from
  // the board, never from this payload (Ruling, Krish, 2026-11-12: only his presses write the configs). No Claude runs.
  'signoff-apply': { workflow: 'signoff-apply.yml', payload: () => ({}) },
}

export const isJob = (v: unknown): v is JobName => typeof v === 'string' && Object.hasOwn(JOBS, v)
export const ENGINE_REPO = 'krishanraja/content-engine'

export type Dispatched = { sent: true; job: JobName; workflow: string; at: string }
  | { sent: false; job: JobName; reason: 'invalid_input' | 'not_configured' | 'failed'; error?: string }
type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; text(): Promise<string>; json?(): Promise<unknown> }>

const token = (env: Record<string, string | undefined>) => String(env.OFFDAY_REVISE_DISPATCH_TOKEN || env.PLACE_TAKES_DISPATCH_TOKEN || '').trim()
const repoOf = (env: Record<string, string | undefined>) => String(env.CONTENT_ENGINE_REPO || '').trim() || ENGINE_REPO
const headers = (t: string) => ({ ...(t ? { Authorization: `Bearer ${t}` } : {}), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' })

/** Send one allow-listed job to GitHub. The event type is the job's name; each workflow lists it under repository_dispatch. */
export async function dispatchJob(job: JobName, input: Record<string, unknown>, env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch as unknown as Fetcher, now = () => new Date()): Promise<Dispatched> {
  const payload = JOBS[job].payload(input || {})
  if (!payload) return { sent: false, job, reason: 'invalid_input' }
  const t = token(env)
  if (!t) return { sent: false, job, reason: 'not_configured' }
  try {
    const r = await fetcher(`https://api.github.com/repos/${repoOf(env)}/dispatches`, {
      method: 'POST', headers: { ...headers(t), 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: job, client_payload: payload }),
    })
    if (r.status === 204) return { sent: true, job, workflow: JOBS[job].workflow, at: now().toISOString() }
    const text = await r.text().catch(() => '')
    return { sent: false, job, reason: 'failed', error: `github ${r.status}: ${text.slice(0, 120)}` }
  } catch (e: unknown) {
    return { sent: false, job, reason: 'failed', error: (e as Error)?.message?.slice(0, 120) || 'dispatch failed' }
  }
}

export type RunState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
export interface RunInfo { job: JobName; workflow: string; state: RunState; started_at: string; updated_at: string; url: string; event: string }

/** The latest run of each job's workflow, newest first, from GitHub's public API. A read that fails gives no runs. */
export async function readRuns(env: Record<string, string | undefined> = process.env, fetcher: Fetcher = fetch as unknown as Fetcher,
  jobs: JobName[] = Object.keys(JOBS) as JobName[]): Promise<Partial<Record<JobName, RunInfo>>> {
  const out: Partial<Record<JobName, RunInfo>> = {}
  const t = token(env)
  await Promise.all(jobs.map(async job => {
    try {
      const r = await fetcher(`https://api.github.com/repos/${repoOf(env)}/actions/workflows/${JOBS[job].workflow}/runs?per_page=1`, { method: 'GET', headers: headers(t) })
      if (r.status !== 200) return
      const data = JSON.parse(await r.text()) as { workflow_runs?: Array<Record<string, unknown>> }
      const run = data.workflow_runs?.[0]
      if (!run) return
      const status = String(run.status), conclusion = String(run.conclusion)
      const state: RunState = status !== 'completed' ? (status === 'in_progress' ? 'running' : 'queued')
        : conclusion === 'success' ? 'done' : conclusion === 'cancelled' || conclusion === 'skipped' ? 'cancelled' : 'failed'
      out[job] = { job, workflow: JOBS[job].workflow, state, started_at: String(run.run_started_at || run.created_at),
        updated_at: String(run.updated_at), url: String(run.html_url), event: String(run.event) }
    } catch { /* a run that cannot be read is left out; the board says it does not know */ }
  }))
  return out
}
