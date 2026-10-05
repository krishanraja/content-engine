import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { withContentRun } from '../_runs.js'
import { supabase } from '../_supabase.js'
import {
  LOOKBACK_DAYS, MIN_INSTANCES,
  presetProposals, judgeProposals, handRewriteProposals, toProposalRow,
  type CalibrationRow, type EditRow,
} from './_patterns.js'

// The weekly compiler ADR-017 deferred.
//
// It reads the two ledgers and proposes. It never changes anything: a pattern
// becomes a proposal with its evidence, its counterexamples and a regression
// case, and Krish rules on it in the Library. Approval is a receipt, not a
// config write. That boundary is the reason the learning is worth having at
// all, and it is the first thing that would erode if this route ever "just
// applied the obvious ones".
//
// What it looks for, and why each one is worth a proposal rather than a chart:
//
//   Presets he never keeps. An edit offered in the palette that is invoked and
//   then discarded most times is costing him a decision every time it appears.
//   The proposal is to retire it, and the counterexample is the times he did
//   keep it.
//
//   Judges that never change an outcome. The panel's own report card. A judge
//   whose verdict never differs from the rest, or never predicts his call, is
//   ceremony; retiring it makes the panel cheaper and its disagreement more
//   meaningful. This is the mechanism that stops the panel becoming theatre.
//
//   What he rewrites by hand after the machine writes it. The highest-signal
//   thing in the product: a manual edit immediately after an accepted machine
//   edit is him fixing something the machine got wrong in a way no rubric
//   caught.
//
// ANTI-ECHO. Everything here keys on FORM: the preset, the judge, the surface,
// the shape of the change. Nothing keys on subject. What he finds interesting
// must never become what ranks, which is the rule api/_arcScore.ts exists to
// hold and the reason the slate record is deliberately not an input to it.

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString()

  const [edits, calibration] = await Promise.all([
    supabase
      .from('content_edit_events')
      .select('event_id, action, mode, value, subject_id, occurred_at')
      // His hand only. An agent session's own drafts and rewrites are
      // recorded as observations (see operatorAttribution in _editEvents.ts)
      // and are never evidence of his taste.
      .eq('actor', 'Krish')
      .neq('confirmation_state', 'observation_only')
      .gte('occurred_at', since)
      .limit(5000),
    supabase
      .from('judge_calibration')
      .select('panel_run_id, judge, verdict, agreed')
      .limit(5000),
  ])

  if (edits.error || calibration.error) {
    return res.status(500).json({ ok: false, error: 'read_failed' })
  }

  const editRows = (edits.data || []) as EditRow[]
  const calibrationRows = (calibration.data || []) as CalibrationRow[]

  // Honest about a thin corpus. A compiler that invents a proposal from two
  // events teaches Krish to ignore the whole surface, which costs far more
  // than a quiet week.
  if (editRows.length < MIN_INSTANCES) {
    return res.status(200).json({
      ok: true,
      skipped: `only ${editRows.length} edit events in ${LOOKBACK_DAYS} days: too thin to propose anything`,
      proposals: 0,
    })
  }

  const proposals = [
    ...presetProposals(editRows),
    ...judgeProposals(calibrationRows),
    ...handRewriteProposals(editRows),
  ]

  if (!proposals.length) {
    return res.status(200).json({ ok: true, proposals: 0, edits_read: editRows.length, note: 'nothing recurred often enough to propose' })
  }

  // Every row is checked against the table's own rules before the insert, so
  // one malformed proposal is set aside by name instead of failing the batch.
  // The insert used to send an empty evidence list, which the table refuses,
  // so the week of 2026-09-27 wrote nothing and said only "write_failed".
  const batch = new Date().toISOString().slice(0, 10)
  const rows: Record<string, unknown>[] = []
  const setAside: string[] = []
  for (const p of proposals) {
    const shaped = toProposalRow(p, batch)
    if ('row' in shaped) rows.push(shaped.row)
    else setAside.push(`${String(p.scope.key ?? p.proposal_class)}: ${shaped.reason}`)
  }

  if (!rows.length) {
    return res.status(500).json({ ok: false, error: `no proposal could be stored: ${setAside.join('; ').slice(0, 400)}` })
  }
  const { error } = await supabase.from('mindmake_studio_learning_proposals').insert(rows)
  if (error) {
    return res.status(500).json({ ok: false, error: `write_failed: ${error.message}`.slice(0, 500), proposals: rows.length })
  }

  return res.status(200).json({ ok: true, proposals: rows.length, set_aside: setAside, edits_read: editRows.length })
}

export default withContentRun('learning_compile', handler)
