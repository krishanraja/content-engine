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
  action: string
  mode: string | null
  value: string | null
  subject_id: string
  occurred_at: string
}

export interface CalibrationRow {
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

