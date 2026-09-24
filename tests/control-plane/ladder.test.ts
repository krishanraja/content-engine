import { describe, expect, it } from 'vitest'
import { standing, READY_AT, ESCALATE_FLOOR, parseRouterVerdict } from '../../apps/control-plane/api/_judges/panel.js'
import { ROUTER_FIT_FLOOR } from '../../apps/control-plane/api/_judges/roster.js'

// The ladder decides, unattended, what Krish never sees. That is a new power
// for this panel: until 2026-09-24 its contract was "the panel does not
// decide". He changed it, and these are the cases where a wrong rule would
// quietly bury work or quietly waste his afternoon.

const v = (judge: string, score: number | null, fix: string | null = null, adversarial = false) => ({
  judge, score, verdict: (score === null ? 'abstain' : 'pass') as 'pass' | 'abstain',
  the_one_fix: fix, evidence: ['e'], confidence: 0.8, deterministic: false, model: 'm', adversarial,
})

describe('the score of a piece is its weakest judge', () => {
  it('takes the minimum, not the mean', () => {
    // A mean of these is 8.6, which would read as ready. The evidence judge
    // says there is nothing to stand on. It is a 4.
    const s = standing([v('novelty', 9), v('evidence', 4, 'name a source'), v('fun', 10), v('reader', 9), v('buyer', 9), v('connection', 9), v('consequence', 9), v('standing', 9)])
    expect(s.score).toBe(4)
    expect(s.weakest).toBe('evidence')
    expect(s.band).toBe('weak')
  })

  it('never lets the prosecutor set the score', () => {
    // The prosecutor scoring 9 means its objection is strong. Counting it as
    // the weakest axis would sink every piece it did its job on; counting it
    // at all would make a strong objection look like an endorsement.
    const s = standing([v('novelty', 9), v('evidence', 9), v('prosecutor', 2, 'derivative', true)])
    expect(s.score).toBe(9)
    expect(s.weakest).not.toBe('prosecutor')
  })

  // Relative to READY_AT, never to a literal. These two were written against
  // 9 and broke the moment the threshold was calibrated to Krish's actual
  // grades, which is the failure this repo already documents: a test pinned to
  // a number that is supposed to move.
  it('still carries the prosecutor into the repair brief, last', () => {
    const s = standing([
      v('evidence', READY_AT - 2, 'find a source'),
      v('prosecutor', 8, 'it dates badly', true),
    ])
    expect(s.brief.map(b => b.judge)).toEqual(['evidence', 'prosecutor'])
  })

  it('briefs the repair with every judge below ready, weakest first', () => {
    const s = standing([
      v('novelty', READY_AT + 2, 'nothing'),
      v('fun', READY_AT - 3, 'no line worth repeating'),
      v('evidence', READY_AT - 1, 'one more source'),
    ])
    expect(s.brief.map(b => b.judge)).toEqual(['fun', 'evidence'])
    expect(s.brief.map(b => b.fix)).toEqual(['no line worth repeating', 'one more source'])
  })

  it('excludes a judge at or above the bar from the repair brief', () => {
    // The brief is what to FIX. A judge that already cleared the bar has
    // nothing to contribute and would send the repair chasing a non-problem.
    const s = standing([v('fun', READY_AT - 1, 'sharpen it'), v('novelty', READY_AT, 'nothing to do')])
    expect(s.brief.map(b => b.judge)).toEqual(['fun'])
  })

  it('a whole panel abstaining is unjudged, never zero', () => {
    // A model outage must not read as eight judges hating it. Scoring this as
    // 0 would bury the piece on the ladder's weak branch.
    const s = standing([v('novelty', null), v('evidence', null)])
    expect(s.score).toBeNull()
    expect(s.band).toBe('unjudged')
  })

  it('bands on the thresholds Krish set', () => {
    expect(standing([v('a', READY_AT)]).band).toBe('ready')
    expect(standing([v('a', READY_AT - 0.1)]).band).toBe('repairable')
    expect(standing([v('a', ESCALATE_FLOOR)]).band).toBe('repairable')
    expect(standing([v('a', ESCALATE_FLOOR - 0.1)]).band).toBe('weak')
  })
})

describe('the router', () => {
  const slugs = ['split_the_bill', 'lift_the_lid', 'mind_the_gap']

  it('names a winner and reports every channel, losers included', () => {
    const r = parseRouterVerdict(JSON.stringify({ fits: { split_the_bill: 9, lift_the_lid: 4, mind_the_gap: 6 }, why: 'what it costs', confidence: 0.9 }), slugs)
    expect(r.winner).toBe('split_the_bill')
    expect(r.fits).toEqual({ split_the_bill: 9, lift_the_lid: 4, mind_the_gap: 6 })
  })

  it('calls a piece homeless rather than filing it under the least bad channel', () => {
    const r = parseRouterVerdict(JSON.stringify({ fits: { split_the_bill: 5, lift_the_lid: 4, mind_the_gap: 3 }, why: 'x' }), slugs)
    expect(r.winner).toBeNull()
    expect(ROUTER_FIT_FLOOR).toBe(6)
  })

  it('flags a contested piece instead of deciding it', () => {
    const r = parseRouterVerdict(JSON.stringify({ fits: { split_the_bill: 8.5, lift_the_lid: 8, mind_the_gap: 3 }, why: 'x' }), slugs)
    expect(r.winner).toBe('split_the_bill')
    expect(r.contested).toEqual(['lift_the_lid'])
  })

  it('treats a missing channel as malformed, not as a zero', () => {
    // A truncated reply that dropped a channel would otherwise read as
    // "definitely not that one" and route the piece confidently wrong.
    const r = parseRouterVerdict(JSON.stringify({ fits: { split_the_bill: 9, lift_the_lid: 4 }, why: 'x' }), slugs)
    expect(r.winner).toBeNull()
    expect(r.fits).toEqual({})
  })

  it('refuses a score outside 0 to 10 rather than clamping it', () => {
    const r = parseRouterVerdict(JSON.stringify({ fits: { split_the_bill: 42, lift_the_lid: 4, mind_the_gap: 3 }, why: 'x' }), slugs)
    expect(r.winner).toBeNull()
  })
})
