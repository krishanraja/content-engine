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

describe('the score of a piece is the median of its judges', () => {
  // This test used to assert the opposite, and the rule it asserted was
  // Krish's own. It was overturned by measurement on 2026-09-24: over the same
  // ten ideas he had graded himself, the minimum came in 2.8 points low and
  // agreed with him on 2 of 10; the lower median 0.4 low and 8 of 10. Rewriting
  // the judge that was doing the killing moved nothing, because with eight
  // noisy rubrics the next one took over immediately. A minimum samples the
  // tail rather than the quality.
  it('one outlier judge cannot veto a piece the other seven passed', () => {
    const s = standing([v('novelty', 9), v('evidence', 4, 'name a source'), v('fun', 10), v('reader', 9), v('buyer', 9), v('connection', 9), v('consequence', 9), v('standing', 9)])
    expect(s.score).toBe(9)
    expect(s.band).toBe('ready')
    // The score and the fix are two questions. The old rule answered both with
    // one number; the weakest judge still names what a repair aims at.
    expect(s.weakest).toBe('evidence')
    expect(s.brief.map(b => b.judge)).toContain('evidence')
  })

  it('a panel that mostly says weak still scores weak', () => {
    // The change must not become "ignore the low scores". Five of eight below
    // the floor is the piece's real standing, not an outlier.
    const s = standing([v('novelty', 2), v('evidence', 3, 'no source'), v('fun', 3), v('reader', 4), v('buyer', 9), v('connection', 9), v('consequence', 9), v('standing', 9)])
    expect(s.score).toBe(4)
    expect(s.band).toBe('weak')
  })

  it('never interpolates: the score is always a judge\'s real number', () => {
    // An even panel's true median is the mean of the two middle scores, which
    // is an average of two judges and the one thing this panel may not do.
    // 6 and 9 sit in the middle here; a true median would invent 7.5.
    const s = standing([v('novelty', 2), v('evidence', 4), v('fun', 6), v('reader', 9), v('buyer', 9), v('connection', 9)])
    expect(s.score).toBe(6)
    expect([2, 4, 6, 9]).toContain(s.score)
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
  const slugs = ['follow_the_money', 'under_the_hood', 'mind_the_gap']

  it('names a winner and reports every channel, losers included', () => {
    const r = parseRouterVerdict(JSON.stringify({ fits: { follow_the_money: 9, under_the_hood: 4, mind_the_gap: 6 }, why: 'what it costs', confidence: 0.9 }), slugs)
    expect(r.winner).toBe('follow_the_money')
    expect(r.fits).toEqual({ follow_the_money: 9, under_the_hood: 4, mind_the_gap: 6 })
  })

  it('calls a piece homeless rather than filing it under the least bad channel', () => {
    const r = parseRouterVerdict(JSON.stringify({ fits: { follow_the_money: 5, under_the_hood: 4, mind_the_gap: 3 }, why: 'x' }), slugs)
    expect(r.winner).toBeNull()
    expect(ROUTER_FIT_FLOOR).toBe(6)
  })

  it('flags a contested piece instead of deciding it', () => {
    const r = parseRouterVerdict(JSON.stringify({ fits: { follow_the_money: 8.5, under_the_hood: 8, mind_the_gap: 3 }, why: 'x' }), slugs)
    expect(r.winner).toBe('follow_the_money')
    expect(r.contested).toEqual(['under_the_hood'])
  })

  it('treats a missing channel as malformed, not as a zero', () => {
    // A truncated reply that dropped a channel would otherwise read as
    // "definitely not that one" and route the piece confidently wrong.
    const r = parseRouterVerdict(JSON.stringify({ fits: { follow_the_money: 9, under_the_hood: 4 }, why: 'x' }), slugs)
    expect(r.winner).toBeNull()
    expect(r.fits).toEqual({})
  })

  it('refuses a score outside 0 to 10 rather than clamping it', () => {
    const r = parseRouterVerdict(JSON.stringify({ fits: { follow_the_money: 42, under_the_hood: 4, mind_the_gap: 3 }, why: 'x' }), slugs)
    expect(r.winner).toBeNull()
  })
})
