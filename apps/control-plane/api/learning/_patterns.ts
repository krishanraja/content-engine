// What the compiler looks for, as pure functions.
//
// Separated from the route on purpose: these decide what Krish is asked to rule
// on, so they must be testable without a database, a network or a key. CI
// caught this the hard way. The first version exported them from the route
// itself, which imports the Supabase client at module load, so importing them
// in a test threw unless SUPABASE_URL happened to be set. It was set on my
// machine and not in CI, which is exactly the class of difference CI exists to
// find.
//
// ANTI-ECHO. Every key here is FORM: the preset, the judge, the surface, the
// shape of the change. Nothing keys on subject. What Krish finds interesting
// must never become what ranks.

export const LOOKBACK_DAYS = 28
/** Below this a pattern is an anecdote. The studio spine uses the same floor
 *  for a performance claim, and for the same reason: three is the smallest
 *  number that can show a tendency rather than a coincidence. */
export const MIN_INSTANCES = 3

export interface EditRow {
  /** content_edit_events.event_id: the evidence a proposal cites. */
  event_id?: string
  action: string
  mode: string | null
  value: string | null
  subject_id: string
  occurred_at: string
}

export interface CalibrationRow {
  /** judge_calibration.panel_run_id: the run whose verdict is the evidence. */
  panel_run_id?: string
  judge: string
  verdict: string
  agreed: boolean | null
}

export interface Proposal {
  proposal_class: 'taste' | 'performance' | 'engine_quality'
  assertion: string
  scope: Record<string, unknown>
  evidence_count: number
  /** The ledger rows the claim rests on. The proposals table refuses a row
   *  with none (`mindmake_studio_learning_evidence_nonempty`), and a claim
   *  that cannot point at its evidence should not reach Krish anyway. */
  evidence_ids: string[]
  counterexamples: string[]
  regression_cases: string[]
  proposed_change: Record<string, unknown>
}

/** Presets invoked often and kept rarely. The counterexamples are the times he
 *  did keep it, which is what stops a proposal reading as a verdict. */
export function presetProposals(rows: EditRow[]): Proposal[] {
  const byPreset = new Map<string, { invoked: number; accepted: number; rejected: number; kept: string[]; evidence: string[] }>()
  for (const row of rows) {
    if (!row.mode) continue
    const key = `${row.mode}:${row.value ?? ''}`
    const entry = byPreset.get(key) ?? { invoked: 0, accepted: 0, rejected: 0, kept: [], evidence: [] }
    if (row.action === 'magic_invoked') entry.invoked += 1
    if (row.action === 'magic_accepted') { entry.accepted += 1; entry.kept.push(row.subject_id) }
    if (row.action === 'magic_rejected') entry.rejected += 1
    if ((row.action === 'magic_accepted' || row.action === 'magic_rejected') && row.event_id) entry.evidence.push(row.event_id)
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
      evidence_ids: evidenceIds(e.evidence),
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
  const byJudge = new Map<string, { settled: number; agreed: number; abstained: number; evidence: string[] }>()
  for (const row of rows) {
    const entry = byJudge.get(row.judge) ?? { settled: 0, agreed: 0, abstained: 0, evidence: [] }
    if (row.verdict === 'abstain') entry.abstained += 1
    if (row.agreed !== null) {
      entry.settled += 1
      if (row.agreed) entry.agreed += 1
      if (row.panel_run_id) entry.evidence.push(row.panel_run_id)
    }
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
      evidence_ids: evidenceIds(e.evidence),
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
  const evidence: string[] = []
  for (const [subject, list] of bySubject) {
    const ordered = [...list].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    for (let i = 0; i < ordered.length - 1; i += 1) {
      if (ordered[i]!.action === 'magic_accepted' && ordered[i + 1]!.action === 'manual_edit') {
        followed.push(subject)
        for (const row of [ordered[i]!, ordered[i + 1]!]) if (row.event_id) evidence.push(row.event_id)
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
    evidence_ids: evidenceIds(evidence),
    counterexamples: ['pieces where an accepted edit was left alone are not counted here'],
    regression_cases: ['Read the diffs before changing a prompt: the fix may be one preset, not the voice block.'],
    proposed_change: { kind: 'review_rewrites', subjects: followed.slice(0, 10) },
  }]
}


/** The table holds 1 to 100 evidence ids. Unique, in the order observed, capped. */
export const MAX_EVIDENCE = 100
function evidenceIds(ids: string[]): string[] {
  return [...new Set(ids)].slice(0, MAX_EVIDENCE)
}

const BATCH_ID = /^[a-z0-9][a-z0-9_-]{1,95}$/

/** One proposal as the row `mindmake_studio_learning_proposals` stores, or the
 *  reason it cannot be stored. The checks mirror the table's own constraints
 *  so a shape the database would refuse is caught in a test, not by the
 *  Sunday run: the compiler failed exactly that way on 2026-09-27, because
 *  every row it wrote carried an empty evidence list. */
export function toProposalRow(p: Proposal, batch: string):
  { ok: true; row: Record<string, unknown> } | { ok: false; reason: string } {
  if (!BATCH_ID.test(batch)) return { ok: false, reason: `batch id ${batch} is not a valid weekly batch id` }
  if (!['taste', 'performance', 'engine_quality'].includes(p.proposal_class)) return { ok: false, reason: `unknown class ${p.proposal_class}` }
  if (p.proposal_class === 'performance') return { ok: false, reason: 'a performance proposal needs three comparable jobs, which this compiler does not count' }
  if (!p.assertion || p.assertion.length > 1600) return { ok: false, reason: 'assertion must be 1 to 1600 characters' }
  if (p.evidence_ids.length < 1) return { ok: false, reason: 'no evidence ids to cite' }
  if (p.evidence_ids.length > MAX_EVIDENCE) return { ok: false, reason: 'more than 100 evidence ids' }
  if (p.evidence_count < 1) return { ok: false, reason: 'evidence count must be positive' }
  if (!p.regression_cases.length) return { ok: false, reason: 'a proposal without a regression case is an opinion' }
  return {
    ok: true,
    row: {
      weekly_batch_id: batch,
      proposal_class: p.proposal_class,
      assertion: p.assertion,
      scope: p.scope,
      evidence_event_ids: p.evidence_ids,
      independent_session_count: p.evidence_count,
      independent_job_count: 0,
      counterexamples: p.counterexamples,
      regression_cases: p.regression_cases,
      proposed_change: p.proposed_change,
      status: 'proposed',
    },
  }
}
