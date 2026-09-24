import { describe, expect, it } from 'vitest'
import { parseExpansion, expansionArtifact } from '../../apps/control-plane/api/_judges/expand.js'

// The expansion is what the judges now read instead of the headline. If it
// silently produces a blank, or quietly drops the line between what is known
// and what is guessed, the panel scores something nobody wrote.

const full = {
  ok: true,
  angle: 'The menu is the price list, and the tier you are on is a decision somebody made for you.',
  implications: [
    { party: 'the AI lab', effect: 'segments buyers without raising headline price' },
    { party: 'the business', effect: 'pays for capability it cannot measure' },
  ],
  scenarios: ['tiers collapse back to one model', 'tiers multiply until routing becomes a product'],
  decision_rule: 'If you cannot name which tier each customer is on, you are the one being segmented.',
  known: ['Anthropic published Opus 5.5 pricing at 40% below Opus 5'],
  inferred: ['That segmentation is deliberate, resting on the timing against the GPT-6 cut'],
}

describe('parsing an expansion', () => {
  it('keeps the parts Krish asked for by name', () => {
    const e = parseExpansion(JSON.stringify(full))
    expect(e.ok).toBe(true)
    expect(e.implications.map(i => i.party)).toEqual(['the AI lab', 'the business'])
    expect(e.scenarios).toHaveLength(2)
    expect(e.decision_rule).toContain('which tier')
  })

  it('refuses an expansion with no angle rather than passing a blank to the panel', () => {
    // This is the one that would put a confident score on nothing.
    const e = parseExpansion(JSON.stringify({ ...full, angle: '   ' }))
    expect(e.ok).toBe(false)
    expect(e.why_not).toBe('the expansion produced no angle')
  })

  it('takes an honest refusal at its word', () => {
    const e = parseExpansion(JSON.stringify({ ok: false, why_not: 'the seed is a truncated fragment' }))
    expect(e.ok).toBe(false)
    expect(e.why_not).toBe('the seed is a truncated fragment')
  })

  it('survives unparseable output without throwing', () => {
    expect(parseExpansion('I am afraid I cannot do that').ok).toBe(false)
    expect(parseExpansion('').why_not).toBeTruthy()
  })

  it('drops a half-written implication rather than rendering an empty bullet', () => {
    const e = parseExpansion(JSON.stringify({
      ...full, implications: [{ party: 'the customer' }, { effect: 'orphaned' }, ...full.implications],
    }))
    expect(e.implications.map(i => i.party)).toEqual(['the AI lab', 'the business'])
  })
})

describe('what the judges actually read', () => {
  it('keeps the seed at the top so novelty and standing see where it came from', () => {
    const out = expansionArtifact('Opus 5.5 is 40% cheaper', parseExpansion(JSON.stringify(full)))
    expect(out.startsWith('## The seed, as it arrived\nOpus 5.5 is 40% cheaper')).toBe(true)
  })

  it('keeps established and inferred under separate headings', () => {
    // Krish: "In the absence of tons of evidence, we need to look at
    // hypotheticals and sense-backed predictions." Legitimate when labelled;
    // a prediction dressed as a finding is the thing the evidence judge now
    // exists to catch, and it can only catch it if the labels survive.
    const out = expansionArtifact('seed', parseExpansion(JSON.stringify(full)))
    expect(out).toContain('## Established')
    expect(out).toContain('## Inferred, and what it rests on')
    expect(out.indexOf('## Established')).toBeLessThan(out.indexOf('## Inferred'))
  })

  it('falls back to the bare seed when the expansion failed', () => {
    const out = expansionArtifact('just the seed', parseExpansion('garbage'))
    expect(out).toBe('just the seed')
  })
})
