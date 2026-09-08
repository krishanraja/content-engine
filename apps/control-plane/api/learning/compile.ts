import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { withContentRun } from '../_runs.js'
import { supabase } from '../_supabase.js'

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

const LOOKBACK_DAYS = 28
/** Below this a pattern is an anecdote. The studio spine uses the same floor
 *  for a performance claim, and for the same reason: three is the smallest
 *  number that can show a tendency rather than a coincidence. */
const MIN_INSTANCES = 3

interface EditRow {
  action: string
  mode: string | null
  value: string | null
  subject_id: string
  occurred_at: string
}

interface CalibrationRow {
  judge: string
  verdict: string
  agreed: boolean | null
}

export interface Proposal {
  proposal_class: 'taste' | 'performance' | 'engine_quality'
  assertion: string
  scope: Record<string, unknown>
  evidence_count: number
  counterexamples: string[]
  regression_cases: string[]
  proposed_change: Record<string, unknown>
}

/** Presets invoked often and kept rarely. The counterexamples are the times he
 *  did keep it, which is what stops a proposal reading as a verdict. */
export function presetProposals(rows: EditRow[]): Proposal[] {
  const byPreset = new Map<string, { invoked: number; accepted: number; rejected: number; kept: string[] }>()
  for (const row of rows) {
    if (!row.mode) continue
    const key = `${row.mode}:${row.value ?? ''}`
    const entry = byPreset.get(key) ?? { invoked: 0, accepted: 0, rejected: 0, kept: [] }
    if (row.action === 'magic_invoked') entry.invoked += 1
    if (row.action === 'magic_accepted') { entry.accepted += 1; entry.kept.push(row.subject_id) }
    if (row.action === 'magic_rejected') entry.rejected += 1
    byPreset.set(key, entry)
  }

  const proposals: Proposal[] = []
  for (const [key, e] of byPreset) {
    const resolved = e.accepted + e.rejected
    if (resolved < MIN_INSTANCES) continue
    const keepRate = e.accepted / resolved
    if (keepRate > 0.25) continue
    proposals.push({
      proposal_class: 'taste',
      assertion: `The "${key}" edit is invoked and then discarded: kept ${e.accepted} of ${resolved} times over ${LOOKBACK_DAYS} days. It costs a decision every time it appears in the palette.`,
      scope: { level: 'global', key },
      evidence_count: resolved,
      counterexamples: e.kept.slice(0, 5).map(id => `kept on ${id}`),
      regression_cases: [
        `If this preset is retired, the palette must still offer a way to do what it did; check the composer still has an edit for that intent.`,
      ],
      proposed_change: { kind: 'retire_preset', preset: key, keep_rate: Math.round(keepRate * 100) / 100 },
    })
  }
  return proposals
}

/** A judge that never predicts him, or never differs from the rest, is
 *  ceremony. This is the panel grading itself. */
export function judgeProposals(rows: CalibrationRow[]): Proposal[] {
  const byJudge = new Map<string, { settled: number; agreed: number; abstained: number }>()
  for (const row of rows) {
    const entry = byJudge.get(row.judge) ?? { settled: 0, agreed: 0, abstained: 0 }
    if (row.verdict === 'abstain') entry.abstained += 1
    if (row.agreed !== null) { entry.settled += 1; if (row.agreed) entry.agreed += 1 }
    byJudge.set(row.judge, entry)
  }

  const proposals: Proposal[] = []
  for (const [judge, e] of byJudge) {
    if (e.settled < MIN_INSTANCES) continue
    const rate = e.agreed / e.settled
    // Worse than a coin flip on a binary call is not a judge, it is noise with
    // a rubric. Said as a proposal, not applied: the fix might be the rubric.
    if (rate >= 0.5) continue
    proposals.push({
      proposal_class: 'engine_quality',
      assertion: `The "${judge}" judge predicted Krish's call ${e.agreed} of ${e.settled} times. Either its rubric is wrong or the axis does not matter to him.`,
      scope: { level: 'global', key: `judge:${judge}` },
      evidence_count: e.settled,
      counterexamples: [`it agreed ${e.agreed} times`, `it abstained ${e.abstained} times, which is not counted against it`],
      regression_cases: [
        `Before retiring it, check whether it is the only judge that ever surfaces its axis; a lone dissenter that is usually overruled may still be the reason a bad piece got caught once.`,
      ],
      proposed_change: { kind: 'review_judge', judge, agreement: Math.round(rate * 100) / 100 },
    })
  }
  return proposals
}

/** He accepted the machine's edit and then immediately rewrote it by hand.
 *  Whatever the rubric missed is right there. */
export function handRewriteProposals(rows: EditRow[]): Proposal[] {
  const bySubject = new Map<string, EditRow[]>()
  for (const row of rows) {
    const list = bySubject.get(row.subject_id) ?? []
    list.push(row)
    bySubject.set(row.subject_id, list)
  }
  const followed: string[] = []
  for (const [subject, list] of bySubject) {
    const ordered = [...list].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    for (let i = 0; i < ordered.length - 1; i += 1) {
      if (ordered[i]!.action === 'magic_accepted' && ordered[i + 1]!.action === 'manual_edit') {
        followed.push(subject)
        break
      }
    }
  }
  if (followed.length < MIN_INSTANCES) return []
  return [{
    proposal_class: 'taste',
    assertion: `On ${followed.length} pieces Krish accepted a machine edit and then rewrote it by hand. Whatever the rubric is missing is in those rewrites.`,
    scope: { level: 'global', key: 'accept_then_rewrite' },
    evidence_count: followed.length,
    counterexamples: ['pieces where an accepted edit was left alone are not counted here'],
    regression_cases: ['Read the diffs before changing a prompt: the fix may be one preset, not the voice block.'],
    proposed_change: { kind: 'review_rewrites', subjects: followed.slice(0, 10) },
  }]
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString()

  const [edits, calibration] = await Promise.all([
    supabase
      .from('content_edit_events')
      .select('action, mode, value, subject_id, occurred_at')
      .gte('occurred_at', since)
      .limit(5000),
    supabase
      .from('judge_calibration')
      .select('judge, verdict, agreed')
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

  const batch = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('mindmake_studio_learning_proposals').insert(proposals.map(p => ({
    weekly_batch_id: batch,
    proposal_class: p.proposal_class,
    assertion: p.assertion,
    scope: p.scope,
    evidence_event_ids: [],
    independent_session_count: p.evidence_count,
    independent_job_count: 0,
    counterexamples: p.counterexamples,
    regression_cases: p.regression_cases,
    proposed_change: p.proposed_change,
    status: 'proposed',
  })))
  if (error) return res.status(500).json({ ok: false, error: 'write_failed', proposals: proposals.length })

  return res.status(200).json({ ok: true, proposals: proposals.length, edits_read: editRows.length })
}

export default withContentRun('learning_compile', handler)
