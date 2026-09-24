import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { withContentRun } from '../_runs.js'
import { BatchBus, drainBatch, retrieveBatch, type BatchRef } from '../_judges/batch.js'
import type { PanelResult } from '../_judges/panel.js'
import { candidateQuery, needsJudging, panelRows, runLadder, type LadderDeps, type LadderReport } from './ladder.js'
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

interface SweepRow {
  id: string
  status: string
  idea_ids: string[]
  batches: BatchRef[]
  ticks: number
  counts: Record<string, unknown>
  dry_run: boolean
  note: string | null
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

async function createSweep(limit: number, ids: string[], dryRun: boolean): Promise<SweepRow | null> {
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
  const { data, error: iErr } = await supabase.from('judge_sweeps').insert({
    idea_ids: chosen, dry_run: dryRun,
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
  for (const ref of batches) {
    if (ref.read) continue
    const status = await retrieveBatch(ref.id)
    if (!status.ended) {
      return {
        ok: true, sweep_id: sweep.id, state: 'waiting',
        waiting_on: ref.id, processing: status.processing, succeeded: status.succeeded,
        ticks: sweep.ticks, batches: batches.length,
      }
    }
    const drained = await drainBatch(sweep.id, ref)
    drainedRows += drained.cached
    drainedErrors += drained.errored
    ref.read = true
  }

  // ── 3. Walk every idea from the top, against what is now in hand ──────────
  const bus = await BatchBus.open(sweep.id, sweep.dry_run)
  let report: LadderReport
  try {
    report = await runLadder({
      limit: sweep.idea_ids.length,
      ids: sweep.idea_ids,
      dryRun: sweep.dry_run,
      deps: batchDeps(bus),
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
  const done = !ref
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
    counts: {
      judged: report.judged, ready: report.ready, escalated: report.escalated,
      weak: report.weak, unjudged: report.unjudged, skipped: report.skipped,
      repairs: report.repairs, deferred: report.deferred,
    },
    note: overrun
      ? `stopped at the ${MAX_TICKS}-tick ceiling with ${report.deferred} ideas still deferring: something is not converging`
      : barren
        ? `stopped after ${ticks} ticks with ${report.deferred} ideas still deferring and nothing new arriving`
        : done ? null : sweep.note,
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

  const body = (req.body || {}) as { action?: string; limit?: number; ids?: string[]; dryRun?: boolean }
  const action = String(body.action || 'tick')
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

    const started = await createSweep(limit, ids, dryRun)
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
