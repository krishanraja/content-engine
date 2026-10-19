import { describe, expect, it } from 'vitest'
import { activeManualReviews, bodyHash, gateStatus, reviewContradiction, signOff, sourcesHash, type FactCheck } from '../../apps/control-plane/api/_factGate.js'
import { makingSteps } from '../../apps/control-plane/api/_making.js'

const sentence = 'On 21 August the price was $4 for input and $20 for output.'
function fixture() {
  const fact_check: FactCheck = { version: 1, ran_at: '2026-10-19T12:00:00Z', body_hash: bodyHash(sentence), independent_checker: 'test', passed: false, blocking: 1, single_source: 0, set_aside: [], claims: [{ sentence, claim: sentence, kind: 'number', verdict: 'contradicted', on_file: { verdict: 'not_found', quote: null, note: null }, independent: { verdict: 'contradicted', evidence: 'Older launch price', url: 'https://example.test/launch', checker: 'test', correct_value: '$5' } }] }
  const meta: Record<string, any> = { fact_check, materials: [{ id: 'source', kind: 'paste', verbatim: true, url: 'https://example.test/changelog', content: sentence }] }
  const input = { decided_by: 'Krish', said: 'Approve the source-backed review', reason: 'The checker used the older launch price.', sentence, material_id: 'source', quote: sentence, expected_body_hash: fact_check.body_hash, expected_run_at: fact_check.ran_at, expected_sources_hash: sourcesHash(meta) }
  return { meta, input }
}
describe('auditable manual review of a contradicted claim', () => {
  it('preserves the automated verdict and exposes the separate human decision', () => {
    const { meta, input } = fixture(); const before = structuredClone(meta.fact_check)
    const result = reviewContradiction(meta, sentence, input)
    expect(result.ok).toBe(true); if (!result.ok) return
    meta.fact_manual_reviews = [result.review]
    expect(meta.fact_check).toEqual(before)
    expect(meta.fact_check.passed).toBe(false)
    expect(gateStatus(meta, sentence).ok).toBe(true)
    expect(makingSteps({meta, body: sentence}).find(s => s.key === 'draft')?.state).toBe('done')
    expect(makingSteps({meta, body: sentence + ' Changed.'}).find(s => s.key === 'draft')?.state).toBe('failed')
    expect(activeManualReviews(meta)).toHaveLength(1)
    expect(reviewContradiction(meta, sentence, input, 'later')).toMatchObject({review: {id: result.review.id}})
  })
  it('does not broaden ordinary sign-off', () => {
    const {meta} = fixture()
    expect(signOff(meta.fact_check, [{sentence, said: 'Approved'}]).ok).toBe(false)
  })
  it.each(['said', 'reason', 'quote', 'material_id', 'expected_body_hash', 'expected_run_at', 'expected_sources_hash', 'decided_by'])('refuses missing or stale %s', key => {
    const {meta, input} = fixture()
    expect(reviewContradiction(meta, sentence, {...input, [key]: ''}).ok).toBe(false)
  })
  it.each(['source', 'verbatim', 'run', 'claim', 'body'])('invalidates review after a changed %s', change => {
    const {meta, input} = fixture(); const result = reviewContradiction(meta, sentence, input)
    if (!result.ok) throw new Error(result.error)
    meta.fact_manual_reviews = [result.review]
    if (change === 'source') meta.materials[0].content += ' Revised.'
    if (change === 'verbatim') meta.materials[0].verbatim = false
    if (change === 'run') meta.fact_check.ran_at = 'later'
    if (change === 'claim') meta.fact_check.claims[0].independent.evidence = 'New evidence'
    const body = change === 'body' ? sentence + ' Changed.' : sentence
    expect(gateStatus(meta, body).ok).toBe(false)
  })
  it('cannot cover unchecked claims or other blocking claims', () => {
    const {meta, input} = fixture(); const result = reviewContradiction(meta, sentence, input)
    if (!result.ok) throw new Error(result.error)
    meta.fact_manual_reviews = [result.review]
    meta.fact_check.unchecked = 1; meta.fact_check.blocking = 2
    expect(gateStatus(meta, sentence).ok).toBe(false)
  })
})
