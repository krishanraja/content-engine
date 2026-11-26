import { describe, expect, it } from 'vitest'
import { falsifierIsWellFormed, gateAnalogy, gateInterest } from '../../apps/control-plane/api/_gates.js'

// Ruling, Krish, 2026-11-24: "get rid of everything that suggests predictions,
// calls, dated, odds or scores". A falsifier states what evidence would knock
// the answer down; it no longer has to carry a date, quarter or duration.
describe('falsifier carries no forecast horizon', () => {
  const claim = 'Anthropic has not filed to list its shares.'
  const undated = 'SEC EDGAR filing index showing a Form S-1 from Anthropic, PBC.'

  it('passes an undated, observable, sourced falsifier', () => {
    const r = falsifierIsWellFormed(claim, undated)
    expect(r.ok).toBe(true)
    expect(r.checks.map(c => c.id)).not.toContain('falsifier_horizon')
  })

  it('still blocks a vacuous falsifier', () => {
    expect(falsifierIsWellFormed(claim, 'This would be wrong if it turns out the filing says otherwise.').ok).toBe(false)
  })

  it('G3 interest passes without a horizon check', () => {
    const r = gateInterest({ ref: 'c1', text: claim, surprise: 5, verifiability: 5, falsifier: undated })
    expect(r.verdict.action).toBe('pass')
    expect(r.verdict.checks.map(c => c.id)).not.toContain('falsifier_horizon')
  })

  it('analogy breaks_if has no horizon check', () => {
    const r = gateAnalogy({ ref: 'a1', text: 'This rhymes with the 2000 telecom build-out.', sharedMechanism: null, breaksIf: undated })
    expect(r.verdict.checks.map(c => c.id)).not.toContain('breaks_if_horizon')
  })
})
