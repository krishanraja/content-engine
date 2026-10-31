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
  /** Where his hand was, and the class a board edit was given (edit_sweep.py). Optional: older reads lack them. */
  surface?: string | null
  reason_code?: string | null
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


// The classes edit_sweep.py gives a saved board edit, in the board's own words (week_board.py EDIT_KINDS).
const BOARD_EDIT_LABELS: Record<string, string> = {
  number_fact: 'number or fact', claim: 'claim', structure: 'structure', tone: 'tone', wording: 'wording',
}

/** The same class of change, made by his hand on the publish board three or more times in the lookback: a
 *  candidate standing rule, so the drafts make that change before he has to. Krish, 2026-10-21: "learn why I'm
 *  giving that feedback and figure out what patterns it's observing", and his ruling that a change becomes a
 *  standing rule only when he approves it. So this proposes and never applies; the proposal waits in the
 *  learning store and on the board's "What I learned from your edits" until he rules. Keyed on the class (form),
 *  never on what the piece was about (ANTI-ECHO). */
export function repeatedEditClassProposals(rows: EditRow[], now: number = Date.now()): Proposal[] {
  const since = now - LOOKBACK_DAYS * 86_400_000
  const byClass = new Map<string, { n: number; pieces: Set<string>; evidence: string[] }>()
  for (const row of rows) {
    if (row.surface !== 'publish_board' || row.action !== 'manual_edit') continue
    const cls = row.reason_code || ''
    if (!(cls in BOARD_EDIT_LABELS)) continue
    const at = Date.parse(row.occurred_at)
    if (!Number.isFinite(at) || at < since || at > now) continue
    const entry = byClass.get(cls) ?? { n: 0, pieces: new Set<string>(), evidence: [] }
    entry.n += 1
    entry.pieces.add(row.subject_id)
    if (row.event_id) entry.evidence.push(row.event_id)
    byClass.set(cls, entry)
  }
  const proposals: Proposal[] = []
  for (const [cls, e] of byClass) {
    if (e.n < MIN_INSTANCES) continue
    const label = BOARD_EDIT_LABELS[cls]!
    const pieces = e.pieces.size
    proposals.push({
      proposal_class: 'taste',
      assertion: `On the publish board Krish made ${e.n} ${label} edits in ${LOOKBACK_DAYS} days, on ${pieces} piece${pieces === 1 ? '' : 's'}. `
        + `Proposed: the drafts make this kind of change before he sees them. It stays a proposal until he approves it.`,
      scope: { level: 'global', key: `board_edit:${cls}` },
      evidence_count: e.n,
      evidence_ids: evidenceIds(e.evidence),
      counterexamples: [
        pieces === 1 ? 'every one of these edits was on one piece, which may be that piece and not a habit' : `spread over ${pieces} pieces`,
        'pieces he did not edit this way are not counted here',
      ],
      regression_cases: [
        `Read the changes themselves (delta_features) before writing the rule: the class alone is too broad to be the rule.`,
        `Once a rule is approved, the next drafts should need fewer ${label} edits on the board; if they do not, the rule is not the cause.`,
      ],
      proposed_change: { kind: 'standing_rule_from_board_edits', edit_class: cls, edits: e.n, pieces },
    })
  }
  return proposals
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

// ── What he changes reading his scripts aloud ──────────────────────────────
//
// Krish, 2026-10-31: "build the learner proposals onto my list". The place-takes job records, on each piece, what
// he changed reading the exact script he was given (making.spoken_delta.<cut>, scripts/voice/spoken_delta.py): counts
// and a few short examples a kind, never a transcript. A kind of change he makes in MIN_INSTANCES pieces or more
// becomes a taste proposal for Make Your Mind Up on his list, citing the pieces. Approving one changes nothing by
// itself: the rule is then reviewed into ai-harness krish-voice's voice profile (spoken script register). Keyed on
// the form of the change (plainer words, an aside, a phrase he drops), never on what a piece was about (ANTI-ECHO).

export interface SpokenExample { script: string; said: string }
export interface SpokenDelta {
  words_script: number
  swapped: number
  added: number
  cut: number
  contracted: number
  expanded: number
  examples?: Partial<Record<'swapped' | 'added' | 'cut' | 'contracted' | 'expanded', SpokenExample[]>>
}
export interface SpokenRow {
  /** content_ideas.id: the piece the takes belong to, cited as the evidence. */
  piece_id: string
  cuts: Partial<Record<string, SpokenDelta>>
  /** His own narrative score for the piece out of 10 (piece_scores_current), when he gave one. */
  narrative?: number | null
}

/** What his own scores say beside a kind of change: the mean narrative score of the pieces that show it against the
 *  pieces that do not, only when both sides hold scored pieces. A correlation on a handful of pieces, so it is said
 *  as context for his decision, never as a reason. */
export function scoreContext(rows: SpokenRow[], showing: Set<string>): string {
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const scored = rows.filter(r => typeof r.narrative === 'number')
  const yes = scored.filter(r => showing.has(r.piece_id)).map(r => r.narrative as number)
  const no = scored.filter(r => !showing.has(r.piece_id)).map(r => r.narrative as number)
  if (!yes.length || !no.length) return ''
  return ` Your narrative scores: ${mean(yes).toFixed(1)} out of 10 on these pieces against ${mean(no).toFixed(1)} on the others (${yes.length} and ${no.length} scored; context, not proof).`
}

const ASIDE_OPENERS = ['which is', 'obviously', 'basically', 'you know', 'i mean', 'kind of', 'to be fair', 'of course']
const FILLER = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'is', 'it', 'that', 'this', 'for', 'on', 'with', 'as', 'at', 'be',
  'are', 'was', 'or', 'but', 'by', 'from', 'i', 'you', 'we', 'they', 'he', 'she', 'which', 'what', 'who', 'its', 'their', 'his', 'her',
  'our', 'your', 'my', 'me', 'us', 'them', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'just', 'there',
  'here', 'then', 'than', 'if', 'not', 'no', 'all', 'about', 'up', 'out', 'so', 'now', 'really', 'actually', 'well'])
/** A piece shows a kind of change when its examples hold it this many times. */
export const SPOKEN_PER_PIECE = 2

function clean(text: string): string {
  return String(text || '').replace(/ \.\.\.$/, '').split(/\s+/).filter(Boolean).join(' ').toLowerCase()
}
function meaningful(phrase: string): boolean {
  const words = phrase.split(' ').filter(Boolean)
  return words.length > 0 && !words.every(w => FILLER.has(w))
}
/** How alike two strings sound on paper, 0 to 1: twice the longest common subsequence over both lengths. */
export function likeness(a: string, b: string): number {
  const x = a.replace(/ /g, ''), y = b.replace(/ /g, '')
  if (!x.length && !y.length) return 1
  let prev = new Array(y.length + 1).fill(0)
  for (let i = 1; i <= x.length; i++) {
    const row = new Array(y.length + 1).fill(0)
    for (let j = 1; j <= y.length; j++) row[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1])
    prev = row
  }
  return (2 * prev[y.length]) / (x.length + y.length)
}
const meanLength = (p: string) => { const w = p.split(' ').filter(Boolean); return w.reduce((n, s) => n + s.length, 0) / w.length }
/** Said in shorter, everyday words; a swap that sounds like the script word is the transcriber mishearing him. */
export function plainer(script: string, said: string): boolean {
  if (!script || !said || !meaningful(script) || !meaningful(said) || likeness(script, said) >= 0.6) return false
  return meanLength(said) <= meanLength(script) - 0.5
}
export function aside(said: string): boolean {
  return said.split(' ').filter(Boolean).length >= 3 || ASIDE_OPENERS.some(o => said.startsWith(o))
}

/** The kinds of change he makes reading aloud in MIN_INSTANCES pieces or more, as taste proposals. Pure. */
export function spokenProposals(rows: SpokenRow[]): Proposal[] {
  const kinds: Record<string, { rule: string; pieces: Map<string, string[]> }> = {
    plainer: { rule: 'He says it plainer than the script. Proposed: spoken scripts use the everyday word first.', pieces: new Map() },
    aside: { rule: 'He adds a short spoken aside. Proposed: spoken scripts leave room for one where a name or number needs explaining.', pieces: new Map() },
  }
  const dropped = new Map<string, Set<string>>()
  for (const row of rows) {
    for (const d of Object.values(row.cuts)) {
      if (!d) continue
      for (const e of d.examples?.swapped ?? []) {
        const [sc, sd] = [clean(e.script), clean(e.said)]
        if (plainer(sc, sd)) kinds.plainer!.pieces.set(row.piece_id, [...(kinds.plainer!.pieces.get(row.piece_id) ?? []), `"${sc}" said as "${sd}"`])
      }
      for (const e of d.examples?.added ?? []) {
        const sd = clean(e.said)
        if (aside(sd)) kinds.aside!.pieces.set(row.piece_id, [...(kinds.aside!.pieces.get(row.piece_id) ?? []), `"${sd}"`])
      }
      for (const e of d.examples?.cut ?? []) {
        const sc = clean(e.script)
        if (meaningful(sc) && sc.split(' ').length >= 2) dropped.set(sc, (dropped.get(sc) ?? new Set()).add(row.piece_id))
      }
    }
  }
  const proposals: Proposal[] = []
  for (const [kind, k] of Object.entries(kinds)) {
    const pieces = [...k.pieces].filter(([, hits]) => hits.length >= SPOKEN_PER_PIECE)
    if (pieces.length < MIN_INSTANCES) continue
    const shown = [...new Set(pieces.flatMap(([, hits]) => hits))].slice(0, 4)
    proposals.push(spokenProposal(`spoken:${kind}`, `${k.rule} Seen in ${pieces.length} pieces, for example ${shown.join('; ')}.`
      + scoreContext(rows, new Set(pieces.map(([id]) => id))),
      pieces.map(([id]) => id), { kind: 'spoken_register', change: kind }))
  }
  for (const [phrase, pieces] of dropped) {
    if (pieces.size < MIN_INSTANCES) continue
    proposals.push(spokenProposal(`spoken:drops:${phrase.slice(0, 60)}`,
      `He leaves out "${phrase}" when he reads his scripts, in ${pieces.size} pieces. Proposed: spoken scripts do not write it.`,
      [...pieces], { kind: 'spoken_register', change: 'drop_phrase', phrase }))
  }
  return proposals
}

function spokenProposal(key: string, assertion: string, pieceIds: string[], change: Record<string, unknown>): Proposal {
  return {
    proposal_class: 'taste',
    assertion: `${assertion} It stays a proposal until he approves it.`.slice(0, 1600),
    scope: { level: 'global', key, venture: 'publication', lane: 'voice' },
    evidence_count: pieceIds.length,
    evidence_ids: evidenceIds(pieceIds),
    counterexamples: ['takes read from a script not matched by its hash are not counted', 'a transcriber mishearing can look like a change'],
    regression_cases: [
      'Once approved, the next scripts drafted in the spoken register should draw fewer of these changes when he reads them; if they do not, the rule is not the cause.',
      'Approving it changes no draft by itself: it is reviewed into ai-harness krish-voice (references/voice-profile.md, Spoken script).',
    ],
    proposed_change: { ...change, target: 'ai-harness skills/krish-voice/references/voice-profile.md#spoken-script' },
  }
}
