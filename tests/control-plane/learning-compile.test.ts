import assert from 'node:assert/strict'
import { test } from 'vitest'
import { presetProposals, judgeProposals, handRewriteProposals } from '../../apps/control-plane/api/learning/compile.ts'

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
