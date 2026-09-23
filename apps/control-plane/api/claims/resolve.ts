import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { withContentRun } from '../_runs.js'

// Notice when a claim's falsifier comes due.
//
// investigation_claims has carried falsifier_due_on since 2026-08-05, and the
// migration that added it says what it is for: "A falsifier is a product, not
// just a gate: falsifier_due_on feeds the public corrections log, which turns
// an apology page into a scoreboard." The column has been written on every
// claim since and never once read. There was no job that woke up when a date
// passed, so there was no scoreboard.
//
// That is the most valuable thing this system was leaving on the floor.
// Gathering AI news is commodity work; anyone with GDELT and a model gets the
// same headlines. A dated, public record of calls this system made and whether
// they came true cannot be bought and cannot be caught up on. It only exists
// if something writes the date down the day it matures.
//
// This job does exactly that and no more. It records came_due, which is
// permanent and keyed one-per-claim, so a claim whose date passed and which
// nobody looked at stays visibly unjudged instead of vanishing. A scoreboard
// that quietly omits the awkward ones is worse than no scoreboard.
//
// It deliberately does NOT rule. Asking the system that made a claim to grade
// it produces a number nobody should trust, least of all published. The
// machine's job is to make the date impossible to miss and the record
// impossible to edit afterwards; the ruling is Krish's, through
// POST /api/claims/rule.
//
//   GET (CRON_SECRET) — daily 07:00 UTC   ·   POST — manual

// Past this, the log is no longer a claim about diligence that is true.
const OVERDUE_ALARM_DAYS = 30

async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (guardCronRoute(req, res)) return

  try {
    const { data: due, error: dueErr } = await supabase
      .from('claims_due')
      .select('claim_id, ref, claim, falsifier, falsifier_due_on, days_overdue, noticed_at')
      .order('falsifier_due_on', { ascending: true })
      .limit(500)
    if (dueErr) throw new Error(dueErr.message)

    const rows = (due || []).filter(d => !d.noticed_at).map(d => ({
      claim_id: d.claim_id,
      event: 'came_due',
      due_on: d.falsifier_due_on,
    }))

    let noticed = 0
    if (rows.length) {
      // ignoreDuplicates against the one-per-claim partial index, so a re-run
      // on the same day is free and can never write a second notice.
      const { error, count } = await supabase
        .from('claim_resolutions')
        .upsert(rows, { onConflict: 'claim_id', ignoreDuplicates: true, count: 'exact' })
      if (error) throw new Error(error.message)
      noticed = count ?? 0
    }

    const awaiting = (due || []).length
    const worstOverdue = (due || []).reduce(
      (worst, d) => Math.max(worst, Number(d.days_overdue) || 0), 0,
    )

    return res.json({
      ok: true,
      awaiting_ruling: awaiting,
      newly_noticed: noticed,
      worst_overdue_days: worstOverdue,
      // Said in the response, and therefore in content_engine_runs, rather
      // than only in a table nobody opens. A corrections log a month behind is
      // the kind of quiet failure that is embarrassing precisely when someone
      // finally looks at it.
      ...(worstOverdue > OVERDUE_ALARM_DAYS
        ? { attention: `a claim has been awaiting a ruling for ${worstOverdue} days` }
        : {}),
      claims: (due || []).slice(0, 20).map(d => ({
        ref: d.ref, due_on: d.falsifier_due_on, days_overdue: d.days_overdue,
        claim: typeof d.claim === 'string' ? d.claim.slice(0, 160) : null,
        falsifier: typeof d.falsifier === 'string' ? d.falsifier.slice(0, 160) : null,
      })),
    })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

export default withContentRun('claims_resolve', handler)
