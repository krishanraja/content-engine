import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as contracts from '@mindmake/contracts'
import { callSectionOf, labelledConfidences } from '@mindmake/contracts'

// The dormant reader of an old dated call (packages/contracts/src/call.ts).
//
// Ruling (Krish, 2026-11-17): "I don't do dated-and-scored make-your-mind-up pieces because it felt quite tacky and
// gimmicky. I don't really have the clout such that my opinion can hold up in official scores." Ruling (Krish,
// 2026-11-18): "get rid of that - i have abandoned the prediction format, it feels lame". No piece makes a dated
// prediction, nothing requires, checks or draws one, and the whole-call reader the publish checks and the Studio's
// call card used is gone. What stays is what the fact gate's hash still reads, so every check stored before the
// ruling keeps matching its text: piece 2 as approved (its edition) is such a record.
const EDITION = readFileSync('editions/2026-09-who-picks-your-ai/body.md', 'utf8')
const PIECE_2_CALL = 'By 30 September 2027, at least two of OpenAI, Anthropic and Google will have their software pick the brain automatically, by default, for businesses that build apps on their AI.'

describe('the dormant call reader', () => {
  it('still finds an old piece\'s call section and its labelled confidences, for the fact gate\'s hash', () => {
    expect(callSectionOf(EDITION)).toContain(PIECE_2_CALL)
    expect(callSectionOf('**The Call.** By 30 June 2027, Amazon opens a route. Confidence: 70%.')).toContain('Confidence: 70%.')
    expect(labelledConfidences('How sure we are: 75%. Confidence: 72.5%').map(({ label, value, whole }) => ({ label, value, whole }))).toEqual([
      { label: 'how_sure_we_are', value: '75', whole: true },
      { label: 'confidence', value: '72.5', whole: false },
    ])
  })

  it('finds nothing in a piece written without a prediction', () => {
    const piece = 'A shop pays less for its AI helper.\n\n## Where it leads\n\nMore shops shop around each year.\n\n## 3 things you can do tomorrow\n\n- List your tools.\n- Ask the price per reply.\n- Try one cheaper helper.'
    expect(callSectionOf(piece)).toBeNull()
    expect(labelledConfidences(piece)).toEqual([])
  })

  it('reads no whole call any more: readPieceCall and its refusals are gone', () => {
    expect(contracts).not.toHaveProperty('readPieceCall')
    expect(contracts).not.toHaveProperty('CALL_MISSING')
  })
})
