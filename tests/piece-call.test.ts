import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CALL_MISSING, callDateMentions, callSectionOf, labelledConfidences, readPieceCall } from '@mindmake/contracts'

// The one reader of a piece's call (packages/contracts/src/call.ts). The real
// texts first: piece 2 as approved (its edition), piece 2 before its line
// edits (a gloss paragraph between the call and the confidence), piece 1's
// bold paragraph, and the shapes the control plane's tests hold.
const EDITION = readFileSync('editions/2026-09-who-picks-your-ai/body.md', 'utf8')
const BEFORE_LINE_EDITS = readFileSync('tests/fixtures/control-plane/piece2-before-line-edits.md', 'utf8')
const PIECE_2_CALL = 'By 30 September 2027, at least two of OpenAI, Anthropic and Google will have their software pick the brain automatically, by default, for businesses that build apps on their AI.'

const call = (text: string) => {
  const reading = readPieceCall(text)
  if (!reading.ok) throw new Error(`refused: ${reading.reason}`)
  return reading.call
}
const reason = (text: string) => {
  const reading = readPieceCall(text)
  if (reading.ok) throw new Error(`read a call: ${JSON.stringify(reading.call)}`)
  return reading.reason
}

describe('the call, read from the approved text', () => {
  it('reads piece 2 exactly as Krish approved it: the statement, 30 September 2027 and 75%', () => {
    expect(call(EDITION)).toEqual({ statement: PIECE_2_CALL, due: '2027-09-30', confidence_percent: 75 })
  })

  it('leaves out a gloss paragraph between the call and how sure we are', () => {
    expect(BEFORE_LINE_EDITS).toContain('In the jargon: automatic model routing becomes the default on their main API.')
    expect(call(BEFORE_LINE_EDITS)).toEqual({ statement: PIECE_2_CALL, due: '2027-09-30', confidence_percent: 75 })
  })

  it('reads piece 1\'s bold paragraph, label and confidence taken off the statement', () => {
    expect(call('**The Call.** By 30 June 2027, Amazon opens a route. Confidence: 70%.')).toEqual({ statement: 'By 30 June 2027, Amazon opens a route.', due: '2027-06-30', confidence_percent: 70 })
    expect(call('Some body.\n\n**Our prediction** By 1 March 2028, the price halves.\nConfidence: 80%\n\nA closing line.')).toEqual({ statement: 'By 1 March 2028, the price halves.', due: '2028-03-01', confidence_percent: 80 })
  })

  it('reads a call and its confidence in one paragraph under the heading', () => {
    expect(call('It shipped late.\n\n## OUR PREDICTION\n\nBy 1 June 2027, it ships. How sure we are: 60%.')).toEqual({ statement: 'By 1 June 2027, it ships.', due: '2027-06-01', confidence_percent: 60 })
  })

  it('reads the fact gate\'s test body, with a dated claim above the heading', () => {
    const body = 'On 7 August 2025, OpenAI made GPT-5 the default in ChatGPT.\n\n## OUR PREDICTION\n\nBy 30 September 2027, two of three labs will route by default.\n\nHow sure we are: 75%.'
    expect(call(body)).toEqual({ statement: 'By 30 September 2027, two of three labs will route by default.', due: '2027-09-30', confidence_percent: 75 })
  })

  it('takes the other headings, an ISO date, a date later in the sentence, and plain text from markdown', () => {
    expect(call('## THE CALL\n\nBy 2027-09-30, *two* of the **three** labs route by [default](https://example.com).\n\nConfidence: 80%')).toEqual({ statement: 'By 2027-09-30, two of the three labs route by default.', due: '2027-09-30', confidence_percent: 80 })
    expect(call('## Prediction\n\nOpenAI makes routing\nthe default by 31 December 2027.\n\nHow sure we are: 72%')).toEqual({ statement: 'OpenAI makes routing the default by 31 December 2027.', due: '2027-12-31', confidence_percent: 72 })
    // The date the call opens with wins over a later one in the same sentence.
    expect(call('## OUR PREDICTION\n\nBy 30 September 2027, the switch OpenAI made on 7 August 2025 is everywhere.\n\nHow sure we are: 75%.').due).toBe('2027-09-30')
  })

  it('ignores what comes after the confidence line, dates included', () => {
    const tail = `${EDITION.trim()}\n\nWe mark every call on its day, starting on 1 October 2027.`
    expect(call(tail)).toEqual({ statement: PIECE_2_CALL, due: '2027-09-30', confidence_percent: 75 })
  })

  it('keeps a percentage in the statement apart from how sure we are', () => {
    expect(call('## OUR PREDICTION\n\nBy 30 June 2027, 40% of buyers route by default.\n\nHow sure we are: 75%.')).toEqual({ statement: 'By 30 June 2027, 40% of buyers route by default.', due: '2027-06-30', confidence_percent: 75 })
  })
})

describe('the call reader refuses rather than guess', () => {
  it('refuses a piece with no prediction section', () => {
    expect(reason('A piece that ends without a call.')).toBe(CALL_MISSING.section)
    expect(reason('')).toBe(CALL_MISSING.section)
  })

  it('refuses a call with no date to check it by', () => {
    expect(reason('**The Call.** Amazon opens a route. Confidence: 70%.')).toBe(CALL_MISSING.date)
    expect(reason('## OUR PREDICTION\n\nBy September 2027, it ships.\n\nHow sure we are: 70%.')).toBe(CALL_MISSING.date)
  })

  it('refuses a call with no percentage, as piece 2 stood before Krish set 75%', () => {
    expect(reason(EDITION.replace('How sure we are: 75%.', 'How sure we are: [Krish to set]'))).toBe(CALL_MISSING.confidence)
    expect(reason('## OUR PREDICTION\n\nBy 1 June 2027, it ships.')).toBe(CALL_MISSING.confidence)
  })

  it('refuses a percentage that is only inside square brackets', () => {
    expect(reason('## OUR PREDICTION\n\nBy 1 June 2027, it ships.\n\nHow sure we are: [Krish to set, about 70%]')).toBe(CALL_MISSING.confidence)
    expect(reason('## OUR PREDICTION\n\nBy 1 June 2027, it ships. [70%]')).toBe(CALL_MISSING.confidence)
  })

  it('refuses a percentage without its label, two confidences, a fraction and a certainty', () => {
    expect(reason('## OUR PREDICTION\n\nBy 1 June 2027, it ships. We are 70% sure.')).toMatch(/without "How sure we are:" in front of it/)
    expect(reason('## OUR PREDICTION\n\nBy 1 June 2027, it ships.\n\nHow sure we are: 70%.\n\nConfidence: 80%')).toBe('The prediction gives more than one confidence (70%, 80%).')
    expect(reason('## OUR PREDICTION\n\nBy 1 June 2027, it ships.\n\nHow sure we are: 72.5%.')).toMatch(/whole percentage\. The prediction says 72\.5%/)
    expect(reason('## OUR PREDICTION\n\nBy 1 June 2027, it ships.\n\nHow sure we are: 100%.')).toMatch(/between 1% and 99%\. The prediction says 100%/)
    expect(reason('## OUR PREDICTION\n\nBy 1 June 2027, it ships.\n\nHow sure we are: 0%.')).toMatch(/between 1% and 99%/)
  })

  it('refuses a date that is not on the calendar', () => {
    expect(reason('## OUR PREDICTION\n\nBy 31 June 2027, it ships.\n\nHow sure we are: 70%.')).toBe('The call\'s date, "By 31 June 2027", is not a day on the calendar.')
    expect(reason('## OUR PREDICTION\n\nBy 2027-02-30, it ships.\n\nHow sure we are: 70%.')).toMatch(/"2027-02-30", is not a day on the calendar/)
  })

  it('refuses a call it cannot tell apart', () => {
    expect(reason('## OUR PREDICTION\n\nOn 7 August 2025, OpenAI switched.\n\nBy 30 September 2027, everyone has.\n\nHow sure we are: 75%.')).toMatch(/More than one paragraph of the prediction has a date/)
    expect(reason('## OUR PREDICTION\n\nEveryone routes by 30 September 2027, or by 31 December 2027 at the latest.\n\nHow sure we are: 75%.')).toMatch(/more than one date \(by 30 September 2027; by 31 December 2027\) and opens with none of them/)
    expect(reason('## OUR PREDICTION\n\nBy 30 September 2027, [two or three] labs route by default.\n\nHow sure we are: 75%.')).toMatch(/square brackets/)
  })
})

describe('the pieces the publish check reads', () => {
  it('finds the section, the dates and the labelled confidences it always has', () => {
    expect(callSectionOf(EDITION)).toContain(PIECE_2_CALL)
    expect(callSectionOf('no call here')).toBeNull()
    expect(callDateMentions('by 30 September 2027 and 2028-01-02, on 31 June 2027').map((mention) => mention.iso)).toEqual(['2027-09-30', '2028-01-02', null])
    expect(labelledConfidences('How sure we are: 75%. Confidence: 72.5%').map(({ label, value, whole }) => ({ label, value, whole }))).toEqual([
      { label: 'how_sure_we_are', value: '75', whole: true },
      { label: 'confidence', value: '72.5', whole: false },
    ])
  })
})
