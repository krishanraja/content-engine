import { describe, expect, test } from 'vitest'
import { mandateWithoutCall } from '../../apps/control-plane/api/_mandate.js'

// The three venture_formats mandates still end with the close a 2026-10-02 migration appended
// (supabase/migrations/20261002090000_mandates_dated_prediction.sql). Until the rows are rewritten on Krish's yes,
// every reader takes it out (Ruling, Krish, 2026-11-24: "get rid of everything that suggests predictions, calls,
// dated, odds or scores").
const CLAUSE = 'THE CALL: every piece ends under the heading OUR PREDICTION with one dated prediction that can be checked, followed by Krish\'s confidence as "How sure we are: N%". Only Krish sets the number. On the date, the call is ruled held or broke. It forecasts what will happen and tells no one what to do.'
// The last sentences of each live mandate before the clause, as plan-week read them on 2026-11-23.
const FOLLOW = 'Diagram language: the money map, showing where the dollars enter and where they leave. HARD GATES, applied before scoring. NOT US: the subject is never Krish, mind/make, CTRL or his own accounts, however available the material. MATERIAL EXISTS: if the evidence has to be created rather than found, it is not commissioned, however good the idea.'
const UNDER = 'NO PREACHING: no closing moral, no lesson for leaders, no sentence telling the reader what to conclude. The verdict is the reader\'s to reach.'
const GAP = 'The not-us gate applies here too: the subject is never Krish, mind/make, CTRL or his own operating loop, however available the material.'

describe('mandateWithoutCall', () => {
  test('takes the appended close off each live mandate and keeps every other word', () => {
    for (const before of [FOLLOW, UNDER, GAP]) {
      expect(mandateWithoutCall(`${before} ${CLAUSE}`)).toBe(before)
    }
  })

  test('leaves a mandate without the clause exactly as it was, and is idempotent', () => {
    expect(mandateWithoutCall(FOLLOW)).toBe(FOLLOW)
    const once = mandateWithoutCall(`${UNDER} ${CLAUSE}`)
    expect(mandateWithoutCall(once)).toBe(once)
  })

  test('stops at the next labelled part when the clause sits mid-mandate', () => {
    const text = `${GAP} ${CLAUSE} NOT US: the subject is never his own work. THE READER is anyone at the invoice.`
    expect(mandateWithoutCall(text)).toBe(`${GAP} NOT US: the subject is never his own work. THE READER is anyone at the invoice.`)
  })

  test('takes out a confidence line or a prediction heading in its own paragraph, and keeps the paragraphs around it', () => {
    const text = `${FOLLOW}\n\nOUR PREDICTION closes every piece.\n\nHow sure we are: 70%.\n\n${UNDER}`
    expect(mandateWithoutCall(text)).toBe(`${FOLLOW}\n\n${UNDER}`)
  })

  test('never touches prose that only mentions a call to action', () => {
    const text = 'Every piece keeps the call to action. The reader decides.'
    expect(mandateWithoutCall(text)).toBe(text)
  })
})
