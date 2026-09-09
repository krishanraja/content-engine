import { describe, expect, it } from 'vitest'
import {
  isUnjudged,
  parseEditorialLensResponse,
  type EditorialSignalV2,
} from '../../apps/control-plane/api/_editorialRadar.js'

// The failure this file exists for.
//
// The parser mapped every signal it was given, and for any signal the model had
// not returned an entry for it fabricated a `no_angle` with the truth, evidence
// and series_fit gates set false. A call that failed and a call that rejected
// the story produced byte-identical records.
//
// It failed on every run. `runLens` asked one call for 20 opportunities of
// roughly twenty fields each inside max_tokens 8000 with adaptive thinking
// sharing that budget, so the JSON truncated, `robustJson` returned null and
// the parser wrote 20 rejections. `needsRefresh` then saw a current
// generator_revision and source_hash and declined to retry for 20 hours, and a
// headline's source hash never changes, so the rejection was permanent. By
// 2026-09-09 all 35 judged ideas read no_angle on BOTH lenses, "Ideas ready to
// shape" could never list anything, and the job reported ok throughout.
//
// Nothing here tests the model. It tests that an absence is never recorded as
// a verdict, which is the part that made the outage silent and durable.

function signal(id: string): EditorialSignalV2 {
  return {
    id,
    title: `Signal ${id}`,
    summary: 'A thing happened that might be worth writing about.',
    occurred_at: '2026-09-08T10:00:00.000Z',
    source_urls: ['https://example.com/story'],
    corroboration: 2,
    category: 'economics',
  }
}

describe('parseEditorialLensResponse', () => {
  it('records a signal the lens skipped as unjudged, never as a rejection', () => {
    const signals = [signal('a'), signal('b')]
    const results = parseEditorialLensResponse(
      { opportunities: [{ signal_id: 'a', status: 'no_angle', no_angle_reason: 'Adoption statistics, nothing to build on.' }] },
      'built_with_ai',
      signals,
    )

    const [judged, skipped] = results
    expect(judged.status).toBe('no_angle')
    expect(judged.strongest_failure).toBe('Adoption statistics, nothing to build on.')

    // The whole point: b was never looked at, so it must not read as refused.
    expect(skipped.status).toBe('unjudged')
    expect(isUnjudged(skipped)).toBe(true)
    expect(results.some((r) => r.status === 'no_angle' && r.signal_id === 'b')).toBe(false)
  })

  it('marks every signal unjudged when the response did not parse at all', () => {
    // What a truncated 8000-token response actually reached the parser as.
    const signals = [signal('a'), signal('b'), signal('c')]
    const results = parseEditorialLensResponse(null, 'money_of_ai', signals)

    expect(results).toHaveLength(3)
    expect(results.every((r) => r.status === 'unjudged')).toBe(true)
    // A caller can therefore tell "the lens is broken" from "the lens said no",
    // which is what the refresh job's alarm and its retry both depend on.
    expect(results.every((r) => r.status === 'no_angle')).toBe(false)
  })

  it('still passes through a real verdict the lens did return', () => {
    const results = parseEditorialLensResponse(
      {
        opportunities: [{
          signal_id: 'a',
          status: 'candidate',
          title: 'What the pricing move actually says',
          angle: 'The packaging changed before the price did.',
          mechanism: 'Metering replaced seats, so expansion stopped tracking headcount.',
          strongest_failure: 'The figures come from one vendor.',
          credible_contradiction: 'Two rivals held seat pricing the same quarter.',
          editorial: { truth: true, evidence: true, confidentiality: true, rights: true, series_fit: true, meaningful_mechanism: true },
          growth: { first_beat_tension: 7, clarity: 8, surprise: 6, payoff: 7, delivery_strength: 7, visual_proof: 5, share_save_usefulness: 7, qualified_audience_fit: 8, novelty: 6 },
        }],
      },
      'money_of_ai',
      [signal('a')],
    )

    expect(results[0]?.status).not.toBe('unjudged')
    expect(results[0]?.title).toBe('What the pricing move actually says')
  })
})
