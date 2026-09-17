import type { VercelRequest, VercelResponse } from '@vercel/node'

// The run ledger for the Content Engine's crons.
//
// Every scheduled content job wraps its handler in withContentRun(). The
// wrapper records one content_engine_runs row per invocation: ok, skipped
// (the handler answered with a `skipped` reason), or failed (a non-2xx, an
// `ok: false` body, or a throw). Unauthorised and wrong-method calls are not
// runs and are not recorded. The Content tab reads the ledger and says, in
// the obligation strip, when a job has not succeeded inside its schedule.
//
// A cron that cannot record itself must still run: ledger writes are
// best-effort and never change the handler's response.

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown

export type ContentRunStatus = 'ok' | 'skipped' | 'failed'

export interface ContentRunRecord {
  job: string
  trigger: 'cron' | 'manual' | 'watch'
  status: ContentRunStatus
  reason: string | null
  counts: Record<string, number>
  started_at: string
  finished_at: string
}

const JOB_PATTERN = /^[a-z][a-z0-9_]{1,63}$/

/** Pull the numeric fields off a response body so the ledger carries counts,
 *  never payloads. Nested objects are skipped; the row stays small. */
export function countsFrom(body: unknown): Record<string, number> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && key !== 'schema_version') out[key] = value
  }
  return out
}

/** Decide what a finished handler amounted to. Exported so it can be tested
 *  without a request. */
export function classifyRun(statusCode: number, body: unknown, threw: Error | null): { status: ContentRunStatus; reason: string | null } {
  if (threw) return { status: 'failed', reason: threw.message.slice(0, 600) }
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  if (statusCode >= 400 || record.ok === false) {
    // `http_${statusCode}` is the right fallback for a TRANSPORT failure: a 503
    // with no body says what it can, and the number is the useful fact.
    //
    // It is exactly the wrong fallback for a 200 that answered `ok: false` with
    // no `error` field. There the transport succeeded, and stringifying its
    // status produced `http_200` — the status code of a SUCCESSFUL request,
    // written into content_engine_runs.reason and rendered to Krish on
    // 2026-09-17 as "Investigations failed on its last run: http_200." A number
    // that says nothing, cannot be searched for, and cannot be acted on.
    //
    // A refusal with no reason is still worth recording, but it should say what
    // it is. Control Center's `apiErrorMessage` (src/lib/apiFetch.ts) makes the
    // same distinction on the reading side.
    const reason = typeof record.error === 'string' ? record.error
      : typeof record.skipped === 'string' ? record.skipped
      : statusCode >= 400 ? `http_${statusCode}`
      : 'the job reported failure without a reason'
    return { status: 'failed', reason: reason.slice(0, 600) }
  }
  if (typeof record.skipped === 'string') return { status: 'skipped', reason: record.skipped.slice(0, 600) }
  if (record.skipped === true) return { status: 'skipped', reason: typeof record.reason === 'string' ? record.reason.slice(0, 600) : null }
  return { status: 'ok', reason: null }
}

export async function recordContentRun(row: ContentRunRecord, body: unknown = null): Promise<void> {
  try {
    // Loaded here, not at module top: _supabase.js throws at import when the
    // env is unset, which is correct for a route and fatal for the pure
    // halves (classifyRun, countsFrom) that tests and guards import.
    const { supabase } = await import('./_supabase.js')
    const { data, error } = await supabase.from('content_engine_runs').insert(row).select('id').single()
    if (error || !data) return

    // A failure that records only "something broke" costs a reproduction
    // against live data to fix. The artifact is bounded and redacted by
    // _runArtifacts.ts, and is written after the run row so a failure to store
    // evidence can never lose the run itself.
    const { artifactForFailure } = await import('./_runArtifacts.js')
    const artifact = artifactForFailure(row.job, row.status, row.reason, body)
    if (!artifact) return
    await supabase.from('content_engine_run_artifacts').insert({ run_id: (data as { id: string }).id, ...artifact })
  } catch {
    // Best effort by design: the ledger must never be the reason a cron fails.
  }
}

/** Did the platform's scheduler make this request, or did a person?
 *
 *  The first live scheduled run after the cutover recorded itself as `manual`,
 *  because this read only `x-vercel-cron` and the request did not carry it.
 *  Vercel's scheduler identifies itself two ways and does not promise both;
 *  reading one made the column that exists to tell cron from hand useless, and
 *  a ledger that cannot tell them apart cannot answer "did that job run on its
 *  own, or only because someone poked it".
 *
 *  Nothing else depends on this: an unauthenticated caller is refused long
 *  before here, so the worst a wrong answer costs is a mislabel. */
export function isScheduled(req: { headers: Record<string, unknown> }): boolean {
  if (req.headers['x-vercel-cron']) return true
  const agent = req.headers['user-agent']
  return typeof agent === 'string' && /vercel-cron/i.test(agent)
}

export function withContentRun(job: string, handler: Handler): Handler {
  if (!JOB_PATTERN.test(job)) throw new Error(`content run job name is invalid: ${job}`)
  return async (req, res) => {
    const startedAt = new Date()
    let payload: unknown = null
    let answered = false

    // The response is BUFFERED, not sent, until the ledger row is written.
    //
    // This used to send first and record after, which is a race: a serverless
    // function may be frozen the moment its response is finished, and anything
    // after that is work the platform is under no obligation to let you finish.
    //
    // Honest about the evidence, because the first version of this comment was
    // not: no run has been observed lost. A 113 second scan looked unrecorded
    // and was simply read too early, while its insert was still in flight. The
    // ordering is worth fixing anyway, because the failure it risks is the one
    // the ledger exists to prevent: a job that runs and does not record is
    // worse than one that does not run, since the obligation strip then says
    // it is stale and the ledger agrees with it. The cost is that a cron's HTTP
    // response waits on one insert, and nothing waits on that response.
    const originalJson = res.json.bind(res)
    res.json = ((body: unknown) => { payload = body; answered = true; return res }) as VercelResponse['json']
    const flush = () => { if (answered) originalJson(payload) }

    let threw: Error | null = null
    try {
      await handler(req, res)
    } catch (error) {
      threw = error instanceof Error ? error : new Error(String(error))
    }
    const statusCode = res.statusCode
    // Not a run: the caller was refused before the job did anything.
    if (!threw && (statusCode === 401 || statusCode === 403 || statusCode === 405 || statusCode === 204)) {
      flush()
      return
    }
    const { status, reason } = classifyRun(threw ? 500 : statusCode, payload, threw)
    await recordContentRun({
      job,
      trigger: isScheduled(req) ? 'cron' : 'manual',
      status,
      reason,
      counts: countsFrom(payload),
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
    }, threw ?? payload)
    flush()
    if (threw) throw threw
  }
}
