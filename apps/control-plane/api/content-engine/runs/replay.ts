import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard } from '../../_auth.js'
import { JOBS, JOB_NAMES, replayUrl, resolveReplay } from '../_jobs.js'

// Run one cron job again, now.
//
//   GET  /api/content-engine/runs/replay              what can be replayed
//   POST /api/content-engine/runs/replay {"job":"…"}  run it
//
// Before this, a weekly job that failed on Friday waited until the next Friday.
// The obligation strip could say a job was stale and offer nothing to do about
// it, which is a dashboard that reports weather.
//
// The replayed job records its own ledger row under the `manual` trigger, so
// the distinction between "ran on its own" and "ran because someone pressed a
// button" survives the recovery. That matters: a job only ever green because it
// is replayed by hand is a broken schedule wearing a working one's clothes.

const REPLAY_TIMEOUT_MS = 60_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      jobs: JOB_NAMES.map(job => ({ job, ...JOBS[job] })),
      note: 'POST {"job":"<name>"} to run one now. Optional "since" is an ISO timestamp for jobs that backfill.',
    })
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
  // `resolved.ok === false` rather than `!resolved.ok`: this app compiles with
  // strict off, where the negation does not narrow the union reliably.
  const resolved = resolveReplay(body)
  if (resolved.ok === false) return res.status(resolved.error === 'unknown_job' ? 404 : 400).json(resolved)

  const secret = process.env.CRON_SECRET || ''
  // Fail closed and say so. Replaying without the secret would reach the target
  // route's POST arm, which accepts an operator cookie this request cannot
  // forward, so the failure would otherwise surface as a confusing 401 from a
  // route the operator can reach perfectly well in a browser.
  if (!secret) return res.status(503).json({ ok: false, error: 'cron_secret_not_configured' })

  let url: string
  try {
    url = replayUrl(resolved.target.path, resolved.since, process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL)
  } catch (error) {
    return res.status(503).json({ ok: false, error: 'deployment_host_unknown', reason: (error as Error).message })
  }

  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REPLAY_TIMEOUT_MS)
  try {
    // GET, because that is the arm the scheduler uses and the arm the secret
    // authenticates. A replay should exercise the same path the cron does, or
    // it proves the wrong thing.
    const response = await fetch(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${secret}`, 'user-agent': 'content-engine-replay' },
      signal: controller.signal,
    })
    const text = await response.text()
    let parsed: unknown = null
    try { parsed = JSON.parse(text) } catch { parsed = { raw: text.slice(0, 400) } }

    return res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      job: resolved.target.job,
      path: resolved.target.path,
      since: resolved.since,
      upstream_status: response.status,
      elapsed_ms: Date.now() - startedAt,
      result: parsed,
      note: 'The job recorded its own content_engine_runs row under the manual trigger.',
    })
  } catch (error) {
    const aborted = (error as Error).name === 'AbortError'
    // A long job that outlives the replay call has not failed: briefs/assemble
    // and investigations both routinely outrun sixty seconds. Saying "timed
    // out" without saying that would send someone chasing a healthy run.
    return res.status(aborted ? 202 : 502).json({
      ok: false,
      job: resolved.target.job,
      path: resolved.target.path,
      error: aborted ? 'still_running' : 'replay_failed',
      elapsed_ms: Date.now() - startedAt,
      reason: aborted
        ? 'The job outlived this request and is still running. Its ledger row will appear when it finishes.'
        : (error as Error).message.slice(0, 200),
    })
  } finally {
    clearTimeout(timer)
  }
}
