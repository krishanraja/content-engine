import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { withContentRun } from '../_runs.js'
import { BatchBus, cancelBatch, drainBatch, retrieveBatch, type BatchRef } from '../_judges/batch.js'
import type { PanelResult } from '../_judges/panel.js'
import { candidateQuery, liveDeps, needsJudging, panelRows, runLadder, type LadderDeps, type LadderReport } from './ladder.js'
import { webResearch } from '../_enrich.js'
import { randomUUID } from 'node:crypto'

// The batched sweep: the same ladder, half the bill, paid for in latency.
//
// Krish, 2026-09-24: "we need this to not cost an arm and a leg once the system
// is up and running."
//
// Measured that day, the ladder's own meter rows: $12.07 for 38 ideas judged,
// two thirds of it the nine-judge fan-out. The Batches API bills every token
// type at half, and a nightly cron does not care when it finishes.
//
// ── HOW ONE TICK WORKS ────────────────────────────────────────────────────
//
//   1. Every batch this sweep has out is polled. If ANY is still processing the
//      tick stops there and reports what it is waiting on. Nothing half-read.
//   2. Finished batches are drained into judge_sweep_cache and metered once,
//      at half price.
//   3. The ladder walks every idea in the sweep FROM THE TOP, with a transport
//      that answers from the cache and throws "not yet" for anything it has not
//      got. An idea therefore advances exactly one stage per tick.
//   4. Everything thrown this tick goes out as one batch, and the tick ends.
//   5. A tick that deferred nothing is the last one.
//
// A typical idea takes four ticks (expand, judge, confirm-or-route, route) and
// a repaired one up to eight. With a ten-minute cron that is under two hours
// for a whole backlog, all ideas moving in parallel.
//
// ── WHY THE LADDER IS NOT RESTAGED ────────────────────────────────────────
//
// The obvious build is a pipeline — expand everything, then judge everything,
// then repair what needs it. It is the wrong one. The banding, the two-attempt
// cap, the keep-the-better rule and the bury confirmation were every one of
// them fixed in place this week after a live run proved them wrong, and a
// pipeline would be a second copy of all four. This route owns the transport
// and the bookkeeping. It owns no decision about an idea.
//
//   GET (CRON_SECRET) — tick   ·   POST — { action, ids, limit, dryRun }

const DEFAULT_LIMIT = 80

// ── LIVE BY DEFAULT, AND THE MEASUREMENT IS WHY ───────────────────────────
//
// This route was built batch-first on an estimate of $0.32 an idea. That was
// wrong, and wrong in the direction that flattered the design: it divided the
// day's $12.07 by the 38 ideas that SETTLED before the spend cap, when
// `ladder-router` — one call per idea that completes a walk — ran 113 times.
// The real figure is about $0.107, so at 46 ideas a week the batch discount is
// worth roughly $95 a year.
//
// Ruling (Krish, 2026-09-24): fast turnaround and cost efficiency both, and
// six to eighteen hours of latency does not buy either.
//
// So the cron runs LIVE: caching already took the larger share of the bill at
// no latency cost, and a live sweep of a night's ideas finishes in minutes.
// The batch path stays, unchanged and tested, for the one case it genuinely
// suits — a hundred-idea catch-up where nothing is waiting on the answer. It
// is asked for explicitly, never chosen by default.
type SweepMode = 'live' | 'batch'
const DEFAULT_MODE: SweepMode = 'live'
/** A tick that has advanced nothing this many times running has stalled: a
 *  batch that keeps erroring, or a request whose reply never satisfies the
 *  walk. Stopping and saying so beats resubmitting the same work nightly. */
const MAX_BARREN_TICKS = 3
/**
 * A hard ceiling on productive ticks. A circuit breaker, not a tuning knob.
 *
 * The longest an idea can legitimately take is nine stages: expand, judge,
 * repair, judge, repair, judge, confirm-expand, confirm-judge, route. Past
 * about twice that, something is not converging — a request whose reply never
 * comes back under the custom_id it was sent with would be re-deferred and
 * RESUBMITTED on every tick, forever, and because each of those ticks still
 * drains rows the barren check would never see it. On a half-hourly cron that
 * bills quietly for days.
 */
const MAX_TICKS = 20

// ── HOW LONG ONE BATCH MAY HOLD THE WHOLE BACKLOG ─────────────────────────
//
// The tick ceiling above counts PRODUCTIVE ticks, so it cannot see this: a
// batch that simply never ends parks the sweep forever while every poll
// dutifully reports "waiting" and the run ledger records a healthy `ok`. A
// nightly sweep that silently does nothing for twenty hours is the same shape
// as every other bug found this week — success reported for work that did not
// happen — and capping runaway ticks did nothing about it.
//
// Measured 2026-09-24: an expansion batch of 64 requests sat at 0 of 64
// completed for over two hours. Anthropic's own envelope is "usually within
// an hour, up to 24", so two hours is slow rather than broken. Hence two
// thresholds and not one:

/** Past this, the sweep says so — on the row, in the tick, in the ledger —
 *  and keeps waiting. Slow is not broken and a cancel here would throw away
 *  work that is about to land. */
const BATCH_OVERDUE_MIN = 120

/**
 * Past this, it stops waiting and finishes the stage live.
 *
 * Six hours, not the twenty this was first set to. Twenty was calibrated
 * against the API's 24h expiry — the wrong reference. The right one is what
 * the discount is FOR: batching is opt-in because it trades hours for money,
 * and a batch that has not landed in six hours has stopped being a trade. It
 * is just a parked backlog with a cost saving nobody can spend.
 *
 * Still short of the expiry, which matters independently: a batch left to
 * expire bills for whatever it completed and hands back nothing usable for the
 * rest, so the sweep would lose the day AND the money. Cancelling keeps the
 * replies that did finish — they reach judge_sweep_cache as soon as the
 * cancelled batch ends — and the live fallback pays list price for the
 * remainder rather than leaving the work parked.
 */
const BATCH_GIVE_UP_MIN = 360

/**
 * How long a live tick may spend walking, inside a 300s function.
 *
 * A wall-clock budget rather than a count of ideas, because the ideas are
 * wildly uneven: a ready piece is one router call, a repairable one is
 * research plus two rewrites plus three panels. A fixed count either wastes
 * most of the budget or overruns it.
 *
 * Overrunning is cheap here — every reply is cached the moment it arrives and
 * an idea commits only when its walk completes — so this protects the ledger
 * row, not the work.
 */
const LIVE_TICK_MS = 240_000

interface SweepRow {
  id: string
  status: string
  idea_ids: string[]
  batches: BatchRef[]
  ticks: number
  counts: Record<string, unknown>
  dry_run: boolean
  note: string | null
  /** Set once a batch has been given up on. From then the sweep runs live, a
   *  few ideas per tick, until it finishes. Everything already paid for stays
   *  in judge_sweep_cache and is still served from it. */
  live_fallback: boolean
}

/**
 * The live fallback transport: the same bookkeeping, real calls.
 *
 * Built from liveDeps so there is one definition of what a live call is, with
 * the two things the sweep owns swapped in — the cache, so nothing already
 * paid for is bought twice, and the held panel rows, so a walk that throws
 * part-way leaves nothing half-written.
 */
function liveWithCache(bus: BatchBus, dryRun: boolean): LadderDeps {
  const base = liveDeps(dryRun)
  return {
    ...base,
    call: bus.liveCall,
    research: query => bus.research(query, () => base.research(query)),
    persist: async (subjectId, panel) => {
      const runId = randomUUID()
      const { run, verdicts } = panelRows(subjectId, panel, runId)
      bus.hold('panel_runs', [run])
      bus.hold('judge_verdicts', verdicts)
      return runId
    },
    commit: () => bus.commit(),
    abandon: () => bus.abandon(),
    // A live call never defers, so a deferral here would be a bug and must
    // surface rather than be counted.
    deferrable: false,
  }
}

/** The batched transport, as the ladder's own dependency shape. */
function batchDeps(bus: BatchBus): LadderDeps {
  return {
    call: bus.call,
    research: query => bus.research(query, async () => {
      try {
        const r = await webResearch(query)
        if (!r.text || r.text.trim().length < 80) return null
        return { text: r.text.trim().slice(0, 6000), sources: r.sources.slice(0, 12) }
      } catch (e) {
        console.warn(`[sweep] research failed: ${(e as Error)?.message?.slice(0, 160) || 'unknown'}`)
        return null
      }
    }),
    persist: async (subjectId: string, panel: PanelResult) => {
      // Held, not written. The idea is re-walked next tick if it defers, and a
      // panel that wrote itself on sight would land in panel_runs once per
      // tick — so judge_calibration would join a single reading against five
      // copies of itself and every agreement rate would be wrong.
      const runId = randomUUID()
      const { run, verdicts } = panelRows(subjectId, panel, runId)
      bus.hold('panel_runs', [run])
      bus.hold('judge_verdicts', verdicts)
      return runId
    },
    commit: () => bus.commit(),
    abandon: () => bus.abandon(),
    deferrable: true,
  }
}

async function loadRunning(): Promise<SweepRow | null> {
  const { data, error } = await supabase
    .from('judge_sweeps').select('*').eq('status', 'running')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`sweeps unreadable: ${error.message}`)
  return (data as SweepRow | null) || null
}

async function createSweep(limit: number, ids: string[], dryRun: boolean, mode: SweepMode): Promise<SweepRow | null> {
  const { data: rows, error } = await candidateQuery(limit, ids)
  if (error) throw new Error(error.message)
  // The same eligibility the walk applies, applied once up front so the sweep
  // knows what it is responsible for. An already-judged row would be skipped
  // inside the walk anyway; including it would just make every tick's numbers
  // read as if there were more work than there is.
  const chosen = (rows || [])
    .filter(r => needsJudging(r as never))
    .slice(0, limit)
    .map(r => String((r as Record<string, unknown>).id))
  if (!chosen.length) return null
  // A live sweep is simply one that starts where a given-up batch sweep ends:
  // same walk, same cache, same held rows, real calls. One mechanism, two
  // entry points, rather than a second runner to keep in step.
  const { data, error: iErr } = await supabase.from('judge_sweeps').insert({
    idea_ids: chosen, dry_run: dryRun, live_fallback: mode === 'live',
  }).select('*').single()
  if (iErr || !data) throw new Error(`could not start a sweep: ${iErr?.message || 'no row'}`)
  return data as SweepRow
}

async function saveSweep(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('judge_sweeps').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) console.warn(`[sweep] could not save ${id}: ${error.message}`)
}

async function tick(sweep: SweepRow): Promise<Record<string, unknown>> {
  const batches = [...(sweep.batches || [])]

  // ── 1 and 2. Nothing is read until everything has landed ──────────────────
  //
  // Half-reading would mean re-walking with a partial cache, deferring requests
  // that are already in flight in the unread batch, and submitting them a
  // second time. Waiting is free; paying twice is not.
  let drainedRows = 0, drainedErrors = 0
  let live = sweep.live_fallback === true
  let gaveUp: string | null = null
  let overdue: { batch: string; minutes: number } | null = null

  for (const ref of batches) {
    if (ref.read) continue
    const status = await retrieveBatch(ref.id)
    if (!status.ended) {
      const ageMin = Math.round((Date.now() - Date.parse(ref.submitted_at)) / 60_000)

      // Past patience entirely: stop waiting on it and finish live.
      //
      // Cancelled rather than abandoned. A batch left alone until its 24h
      // expiry bills for whatever it completed and returns nothing usable for
      // the rest, so the sweep would lose the day AND the money. Cancelling
      // ends it promptly, and the next tick drains the replies that DID
      // finish into the cache, so none of what was paid for is thrown away.
      if (ageMin >= BATCH_GIVE_UP_MIN) {
        try {
          await cancelBatch(ref.id)
          gaveUp = `gave up on ${ref.id} after ${ageMin} minutes and switched to live calls; replies that did finish are still used`
        } catch (e) {
          gaveUp = `could not cancel ${ref.id} after ${ageMin} minutes (${(e as Error)?.message?.slice(0, 120)}); switching to live calls anyway`
        }
        live = true
        // NOT marked read. Its results are drained on a later tick once the
        // cancel takes effect, and everything already paid for is then served
        // from the cache exactly as if it had landed on time.
        break
      }

      // Slow, not broken. Said out loud and still waited on: a cancel here
      // would throw away work that is very likely about to land.
      if (ageMin >= BATCH_OVERDUE_MIN) {
        overdue = { batch: ref.id, minutes: ageMin }
        await saveSweep(sweep.id, {
          note: `batch ${ref.id} has been processing ${ageMin} minutes (${status.succeeded} of ${ref.requests} done). Still waiting; gives up at ${BATCH_GIVE_UP_MIN}.`,
        })
      }

      return {
        ok: true, sweep_id: sweep.id, state: 'waiting',
        waiting_on: ref.id, processing: status.processing, succeeded: status.succeeded,
        age_minutes: ageMin,
        ...(overdue ? { overdue: true, gives_up_at_minutes: BATCH_GIVE_UP_MIN } : {}),
        ticks: sweep.ticks, batches: batches.length,
      }
    }
    const drained = await drainBatch(sweep.id, ref)
    drainedRows += drained.cached
    drainedErrors += drained.errored
    ref.read = true
  }

  // ── 3. Walk every idea from the top, against what is now in hand ──────────
  //
  // Live mode still opens the bus, and that is the point: everything already
  // paid for is served from judge_sweep_cache exactly as before, and only what
  // is genuinely missing costs a live call. Giving up on a batch loses the
  // discount on the remainder, never the work.
  const bus = await BatchBus.open(sweep.id, sweep.dry_run)
  let report: LadderReport
  try {
    report = await runLadder({
      limit: sweep.idea_ids.length,
      ids: sweep.idea_ids,
      dryRun: sweep.dry_run,
      deps: live ? liveWithCache(bus, sweep.dry_run) : batchDeps(bus),
      ...(live ? { deadlineMs: LIVE_TICK_MS } : {}),
    })
  } catch (e) {
    await saveSweep(sweep.id, {
      status: 'failed', batches, ticks: sweep.ticks + 1,
      note: `the walk threw: ${(e as Error)?.message?.slice(0, 400) || 'unknown'}`,
    })
    throw e
  }

  // ── 4. Everything deferred goes out as one batch ──────────────────────────
  const wanted = bus.wantedByAgent()
  const ref = await bus.flush()
  if (ref) batches.push(ref)

  // ── 5. A tick that deferred nothing is the last one ───────────────────────
  //
  // `settled` is counted from the walk rather than assumed from the absence of
  // deferrals, because those are two different claims and only one of them is
  // evidence. A sweep can also finish with ideas it never managed to judge —
  // it says so rather than reporting the shape of a clean run.
  // In live mode nothing defers, so `ref` is always null — which would read as
  // "finished" on the very first fallback tick while most of the backlog was
  // still untouched. Completion there means every idea settled, which the walk
  // reports as skipped (already judged) plus the bands it just produced.
  // Live mode never defers, so `ref` is always null there — which would read as
  // "finished" on the first tick while most of the backlog was untouched. It is
  // done when the walk reached the end of the list rather than the end of its
  // clock, which the walk now reports rather than leaving to be inferred.
  const done = live ? !report.ran_out_of_time : !ref
  // Counted from the walk's own band tallies, which are only incremented at the
  // END of a walk that completed. `judged - deferred` would have read -64 on the
  // first tick, where every idea defers at the expansion before any panel runs.
  const settled = report.ready + report.escalated + report.weak
  const ticks = sweep.ticks + 1
  const barren = ref && report.deferred > 0 && drainedRows === 0 && ticks > MAX_BARREN_TICKS
  const overrun = Boolean(ref) && ticks >= MAX_TICKS
  const stalled = barren || overrun

  await saveSweep(sweep.id, {
    status: done ? 'finished' : stalled ? 'failed' : 'running',
    batches,
    ticks,
    live_fallback: live,
    counts: {
      judged: report.judged, ready: report.ready, escalated: report.escalated,
      weak: report.weak, unjudged: report.unjudged, skipped: report.skipped,
      repairs: report.repairs, deferred: report.deferred,
    },
    note: overrun
      ? `stopped at the ${MAX_TICKS}-tick ceiling with ${report.deferred} ideas still deferring: something is not converging`
      : barren
        ? `stopped after ${ticks} ticks with ${report.deferred} ideas still deferring and nothing new arriving`
        // A give-up is the note worth keeping over an earlier overdue warning:
        // it says what was done about it, not merely that something was slow.
        : gaveUp || (done ? null : sweep.note),
  })

  return {
    ok: true,
    sweep_id: sweep.id,
    state: done ? 'finished' : stalled ? 'failed' : 'submitted',
    ticks,
    ideas: sweep.idea_ids.length,
    settled,
    deferred: report.deferred,
    waiting_for: ref ? { batch: ref.id, requests: ref.requests, by_agent: wanted } : null,
    ...(live ? { mode: 'live', ran_out_of_time: report.ran_out_of_time } : { mode: 'batch' }),
    ...(gaveUp ? { gave_up: gaveUp } : {}),
    drained: { replies: drainedRows, errored: drainedErrors },
    cached_before_walk: bus.cached,
    judged: report.judged, ready: report.ready, escalated: report.escalated,
    weak: report.weak, unjudged: report.unjudged, skipped: report.skipped, repairs: report.repairs,
    ...(report.warning ? { warning: report.warning } : {}),
    ...(done ? { results: report.results } : {}),
  }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return

  const body = (req.body || {}) as { action?: string; limit?: number; ids?: string[]; dryRun?: boolean; mode?: string }
  const action = String(body.action || 'tick')
  // Batch is opt-in and never inferred. It halves the bill and costs hours, and
  // the hours are only free when nothing is waiting on the answer.
  const mode: SweepMode = body.mode === 'batch' ? 'batch' : DEFAULT_MODE
  const limit = Math.max(1, Math.min(200, Number(body.limit) || DEFAULT_LIMIT))
  const dryRun = body.dryRun === true
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 200)
    : []

  try {
    const running = await loadRunning()

    if (action === 'cancel') {
      if (!running) return res.json({ ok: true, state: 'idle', note: 'nothing was running' })
      await saveSweep(running.id, { status: 'cancelled', note: 'cancelled by hand' })
      return res.json({ ok: true, state: 'cancelled', sweep_id: running.id })
    }

    if (action === 'status') {
      return res.json({ ok: true, state: running ? 'running' : 'idle', sweep: running })
    }

    // One sweep at a time, enforced by a partial unique index as well as here.
    // Two sweeps over the same ideas would each submit the other's deferred
    // work and pay for it twice.
    if (running) return res.json(await tick(running))

    const started = await createSweep(limit, ids, dryRun, mode)
    // `ok`, not `skipped`. A tick that looked and found nothing to judge is a
    // tick that did its job, and contentEngineAttention measures staleness from
    // the last OK run only — so recording an idle half-hourly tick as skipped
    // would have the dashboard report a working sweep as not having succeeded
    // in a day, every quiet day.
    if (!started) return res.json({ ok: true, state: 'idle', ideas: 0 })
    return res.json(await tick(started))
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

export default withContentRun('judge_sweep', handler)
export const config = { maxDuration: 300 }
