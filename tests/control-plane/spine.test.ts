import { describe, expect, test } from 'vitest'
import { readVerdicts, sectionsOf, spineResult, spineStatus } from '../../apps/control-plane/api/_spine'

// House rule ONE_SPINE. Krish, 2026-10-14: "we ended up with an absolute ton
// of drift here ... the engine cannot do this again."
const BODY = 'Opening line.\n\n## THE MENU IS ALREADY GOING\nA.\n\n## WHY SIRI, OF ALL THINGS?\nB.\n\n## MY PREDICTION\nC.\n'

describe('the spine check', () => {
  test('reads the opening and every section', () => {
    expect(sectionsOf(BODY).map(s => s.heading)).toEqual(['OPENING', 'THE MENU IS ALREADY GOING', 'WHY SIRI, OF ALL THINGS?', 'MY PREDICTION'])
  })

  test('one section off the spine fails the piece, and the reason names it', () => {
    const verdicts = readVerdicts({ sections: [
      { heading: 'OPENING', answers: true, why: 'raises it' },
      { heading: 'THE MENU IS ALREADY GOING', answers: true, why: 'proves it' },
      { heading: 'WHY SIRI, OF ALL THINGS?', answers: false, why: 'answers why Siri is a contender, a different question' },
      { heading: 'MY PREDICTION', answers: true, why: 'the call' },
    ] }, sectionsOf(BODY))
    const r = spineResult('Who picks your AI?', 'The app does.', BODY, verdicts)
    expect(r.passed).toBe(false)
    const s = spineStatus({ spine_check: r }, BODY)
    expect(s.ok).toBe(false)
    expect(s.reason).toContain('WHY SIRI')
  })

  test('a section the judge left out counts as off the spine, never as a pass', () => {
    const verdicts = readVerdicts({ sections: [{ heading: 'OPENING', answers: true, why: '' }] }, sectionsOf(BODY))
    expect(verdicts.filter(v => !v.answers).length).toBe(3)
  })

  test('a passing check covers only the words it read', () => {
    const all = sectionsOf(BODY).map(s => ({ heading: s.heading, answers: true, why: 'yes' }))
    const r = spineResult('Who picks your AI?', 'The app does.', BODY, all)
    expect(spineStatus({ spine_check: r }, BODY).ok).toBe(true)
    expect(spineStatus({ spine_check: r }, BODY + '\nOne more line.').reason).toContain('words changed')
    expect(spineStatus({}, BODY).ok).toBe(false)
  })
})
