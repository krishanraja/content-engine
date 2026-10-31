import assert from 'node:assert/strict'
import { describe, expect, it, test } from 'vitest'
import { presetProposals, judgeProposals, handRewriteProposals, repeatedEditClassProposals, spokenProposals, likeness, plainer, toProposalRow, MAX_EVIDENCE } from '../../apps/control-plane/api/learning/_patterns.ts'

// What the compiler is allowed to say, and what it must stay quiet about.
//
// The failure mode worth guarding is not a missed pattern, it is a confident
// proposal from two events. A surface that cries wolf gets ignored, and then
// the real proposal is ignored too.

const at = (n: number) => new Date(Date.UTC(2026, 8, n)).toISOString()

test('a preset he keeps is not proposed for retirement', () => {
  const rows = Array.from({ length: 6 }, (_, i) => ([
    { action: 'magic_invoked', mode: 'tone', value: 'punchier', subject_id: `s${i}`, occurred_at: at(i + 1) },
    { action: 'magic_accepted', mode: 'tone', value: 'punchier', subject_id: `s${i}`, occurred_at: at(i + 1) },
  ])).flat()
  assert.deepEqual(presetProposals(rows), [])
})

test('a preset he almost never keeps is proposed, with the times he did as counterexamples', () => {
  const rows = [
    ...Array.from({ length: 7 }, (_, i) => ({ action: 'magic_rejected', mode: 'humor', value: 'dry', subject_id: `r${i}`, occurred_at: at(i + 1) })),
    { action: 'magic_accepted', mode: 'humor', value: 'dry', subject_id: 'kept-1', occurred_at: at(9) },
  ]
  const [proposal] = presetProposals(rows)
  assert.ok(proposal, 'a preset kept once in eight is worth raising')
  assert.equal(proposal.proposal_class, 'taste')
  assert.match(proposal.assertion, /humor:dry/)
  assert.deepEqual(proposal.counterexamples, ['kept on kept-1'])
  assert.ok(proposal.regression_cases.length, 'a proposal without a regression case is an opinion')
})

test('two events are an anecdote and produce nothing', () => {
  const rows = [
    { action: 'magic_invoked', mode: 'tone', value: 'warmer', subject_id: 'a', occurred_at: at(1) },
    { action: 'magic_rejected', mode: 'tone', value: 'warmer', subject_id: 'a', occurred_at: at(1) },
    { action: 'magic_rejected', mode: 'tone', value: 'warmer', subject_id: 'b', occurred_at: at(2) },
  ]
  assert.deepEqual(presetProposals(rows), [], 'below the floor the compiler stays quiet')
})

test('an abstaining judge is never proposed for retirement on its abstentions', () => {
  const rows = [
    ...Array.from({ length: 6 }, () => ({ judge: 'evidence', verdict: 'abstain', agreed: null })),
    ...Array.from({ length: 4 }, () => ({ judge: 'evidence', verdict: 'pass', agreed: true })),
  ]
  assert.deepEqual(judgeProposals(rows), [], 'declining to judge is not being wrong')
})

test('a judge that loses more often than a coin flip is raised, and the abstentions are named as not counted', () => {
  const rows = [
    ...Array.from({ length: 5 }, () => ({ judge: 'buyer', verdict: 'kill', agreed: false })),
    { judge: 'buyer', verdict: 'pass', agreed: true },
    { judge: 'buyer', verdict: 'abstain', agreed: null },
  ]
  const [proposal] = judgeProposals(rows)
  assert.ok(proposal)
  assert.equal(proposal.proposal_class, 'engine_quality')
  assert.match(proposal.assertion, /predicted Krish's call 1 of 6/)
  assert.ok(proposal.counterexamples.some(c => /abstained/.test(c)), 'abstentions must be named as excluded, not hidden')
  assert.match(proposal.regression_cases[0]!, /lone dissenter/, 'a judge that is usually overruled may still be why one bad piece was caught')
})

test('accepting the machine then rewriting by hand is the pattern worth surfacing', () => {
  const rows = ['a', 'b', 'c'].flatMap(s => ([
    { action: 'magic_accepted', mode: 'tone', value: 'punchier', subject_id: s, occurred_at: at(1) },
    { action: 'manual_edit', mode: null, value: null, subject_id: s, occurred_at: at(2) },
  ]))
  const [proposal] = handRewriteProposals(rows)
  assert.ok(proposal)
  assert.match(proposal.assertion, /accepted a machine edit and then rewrote it by hand/)
  assert.equal(proposal.evidence_count, 3)
})

test('a manual edit before an accept is not the pattern', () => {
  const rows = ['a', 'b', 'c'].flatMap(s => ([
    { action: 'manual_edit', mode: null, value: null, subject_id: s, occurred_at: at(1) },
    { action: 'magic_accepted', mode: 'tone', value: 'punchier', subject_id: s, occurred_at: at(2) },
  ]))
  assert.deepEqual(handRewriteProposals(rows), [], 'order is the whole signal')
})


// The table's own rules, so a shape it would refuse fails here and not on a
// Sunday. On 2026-09-27 every row carried an empty evidence list, the table's
// `mindmake_studio_learning_evidence_nonempty` check refused the batch, and the
// run said only "write_failed".

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('every pattern cites the ledger rows it rests on', () => {
  const presetRows = [
    ...Array.from({ length: 7 }, (_, i) => ({ event_id: uuid(i), action: 'magic_rejected', mode: 'humor', value: 'dry', subject_id: `r${i}`, occurred_at: at(i + 1) })),
    { event_id: uuid(50), action: 'magic_accepted', mode: 'humor', value: 'dry', subject_id: 'kept-1', occurred_at: at(9) },
  ]
  const [preset] = presetProposals(presetRows)
  assert.equal(preset!.evidence_ids.length, 8)

  const judgeRows = [
    ...Array.from({ length: 5 }, (_, i) => ({ panel_run_id: uuid(100 + i), judge: 'buyer', verdict: 'kill', agreed: false })),
    { panel_run_id: uuid(110), judge: 'buyer', verdict: 'abstain', agreed: null },
  ]
  const [judge] = judgeProposals(judgeRows)
  assert.equal(judge!.evidence_ids.length, 5, 'abstentions are not evidence of being wrong, so they are not cited')

  const rewriteRows = ['a', 'b', 'c'].flatMap((s, i) => ([
    { event_id: uuid(200 + i * 2), action: 'magic_accepted', mode: 'tone', value: 'punchier', subject_id: s, occurred_at: at(1) },
    { event_id: uuid(201 + i * 2), action: 'manual_edit', mode: null, value: null, subject_id: s, occurred_at: at(2) },
  ]))
  const [rewrite] = handRewriteProposals(rewriteRows)
  assert.equal(rewrite!.evidence_ids.length, 6)
})

test('a proposal the table would refuse is set aside by name, never sent', () => {
  const base = judgeProposals(Array.from({ length: 4 }, (_, i) => ({ panel_run_id: uuid(i), judge: 'buyer', verdict: 'kill', agreed: false })))[0]!
  const stored = toProposalRow(base, '2026-10-04')
  assert.ok(stored.ok)
  if (stored.ok) {
    const ids = stored.row.evidence_event_ids as string[]
    assert.ok(ids.length >= 1 && ids.length <= 100)
    assert.ok((stored.row.independent_session_count as number) > 0)
    assert.ok(Array.isArray(stored.row.regression_cases) && (stored.row.regression_cases as unknown[]).length > 0)
  }
  const empty = toProposalRow({ ...base, evidence_ids: [] }, '2026-10-04')
  assert.equal(empty.ok, false)
  if (!empty.ok) assert.match(empty.reason, /no evidence/)
  assert.equal(toProposalRow(base, 'Week 40').ok, false, 'the batch id must match the table pattern')
  assert.equal(toProposalRow({ ...base, regression_cases: [] }, '2026-10-04').ok, false)
})

// The repeated edit class (Krish, 2026-10-21: "learn why I'm giving that feedback and figure out what patterns it's
// observing"): three board edits of one class in the lookback is a proposal, never a rule, and nothing else counts.
const NOW = Date.UTC(2026, 9, 30)
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()
const board = (i: number, cls: string, extra: Record<string, unknown> = {}) => ({
  event_id: uuid(500 + i), action: 'manual_edit', mode: null, value: null, subject_id: `piece-${i % 2}`, occurred_at: daysAgo(i + 1),
  surface: 'publish_board', reason_code: cls, ...extra,
})

test('three board edits of one class in 28 days become one proposal, with its evidence, waiting for his yes', () => {
  const rows = [board(0, 'number_fact'), board(1, 'number_fact'), board(2, 'number_fact'), board(3, 'tone')]
  const proposals = repeatedEditClassProposals(rows, NOW)
  assert.equal(proposals.length, 1)
  const [p] = proposals
  assert.equal(p!.proposal_class, 'taste')
  assert.deepEqual(p!.scope, { level: 'global', key: 'board_edit:number_fact' })
  assert.equal(p!.evidence_count, 3)
  assert.equal(p!.evidence_ids.length, 3)
  assert.match(p!.assertion, /3 number or fact edits/)
  assert.match(p!.assertion, /stays a proposal until he approves it/)
  assert.doesNotMatch(p!.assertion, /[—–]/, 'no long dashes in what he reads')
  assert.equal((p!.proposed_change as { edit_class: string }).edit_class, 'number_fact')
  assert.ok(toProposalRow(p!, '2026-10-30').ok, 'the learning store would take it')
})

test('two of a class, old edits, other surfaces and the session\'s own rewrites are not a pattern', () => {
  assert.deepEqual(repeatedEditClassProposals([board(0, 'tone'), board(1, 'tone')], NOW), [])
  assert.deepEqual(repeatedEditClassProposals([board(0, 'tone'), board(1, 'tone'), board(40, 'tone')], NOW), [], 'outside 28 days')
  assert.deepEqual(repeatedEditClassProposals([0, 1, 2].map(i => board(i, 'tone', { surface: 'composer' })), NOW), [])
  assert.deepEqual(repeatedEditClassProposals([0, 1, 2].map(i => board(i, 'tone', { action: 'magic_accepted' })), NOW), [])
  assert.deepEqual(repeatedEditClassProposals([0, 1, 2].map(i => board(i, 'mood')), NOW), [], 'an unknown class is not counted')
})

test('evidence is unique and capped at what the table holds', () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ panel_run_id: uuid(i % 120), judge: 'buyer', verdict: 'kill', agreed: false }))
  const [proposal] = judgeProposals(rows)
  assert.equal(proposal!.evidence_ids.length, MAX_EVIDENCE)
  assert.equal(new Set(proposal!.evidence_ids).size, MAX_EVIDENCE)
})

// What he changes reading his scripts aloud (Krish, 2026-10-31: "build the learner proposals onto my list").
describe('spoken proposals: kinds of change he makes reading aloud', () => {
  const piece = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
  const delta = (examples: Record<string, { script: string; said: string }[]>) =>
    ({ words_script: 200, swapped: 2, added: 2, cut: 0, contracted: 0, expanded: 0, examples })
  const plain = delta({ swapped: [{ script: 'dollars', said: 'bucks' }, { script: 'polished', said: 'really nice' }] })

  it('proposes saying it plainer when three pieces swap to everyday words, citing the pieces', () => {
    const got = spokenProposals([1, 2, 3].map(n => ({ piece_id: piece(n), cuts: { long: plain } })))
    expect(got).toHaveLength(1)
    expect(got[0]!.scope).toMatchObject({ key: 'spoken:plainer', venture: 'publication', lane: 'voice' })
    expect(got[0]!.evidence_ids).toEqual([piece(1), piece(2), piece(3)])
    expect(got[0]!.assertion).toContain('"dollars" said as "bucks"')
    expect(toProposalRow(got[0]!, '2026-11-01').ok).toBe(true)
  })
  it('never proposes from two pieces, from a mishearing, or from filler', () => {
    expect(spokenProposals([1, 2].map(n => ({ piece_id: piece(n), cuts: { long: plain } })))).toEqual([])
    const misheard = delta({ swapped: [{ script: 'krish', said: 'chris' }, { script: 'qwen', said: 'quinn' }], added: [{ script: '', said: 'so' }, { script: '', said: 'the' }] })
    expect(spokenProposals([1, 2, 3].map(n => ({ piece_id: piece(n), cuts: { short: misheard } })))).toEqual([])
  })
  it('proposes an aside and a phrase he always drops, each once', () => {
    const d = delta({ added: [{ script: '', said: 'which is fair enough' }, { script: '', said: 'and you can guess who' }],
                      cut: [{ script: 'i have been reading', said: '' }] })
    const keys = spokenProposals([1, 2, 3].map(n => ({ piece_id: piece(n), cuts: { long: d } }))).map(p => p.scope.key)
    expect(keys.sort()).toEqual(['spoken:aside', 'spoken:drops:i have been reading'])
  })
  it('reads likeness the way the mishearing guard needs', () => {
    expect(likeness('krish', 'chris')).toBeGreaterThanOrEqual(0.6)
    expect(likeness('dollars', 'bucks')).toBeLessThan(0.6)
    expect(plainer('looking', 'having a look')).toBe(true)
  })
})
