import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { confidenceOf, predictionCheck, publishChecks, publishStatus } from '../../apps/control-plane/api/_publishChecks.js'
import { readPieceCall } from '../../packages/contracts/src/call.js'

// predictionCheck and confidenceOf now read the call with the Studio's reader
// (packages/contracts/src/call.ts). They must give every publish check the
// same result as before. These are the two functions exactly as they stood
// before the change (predictionCheck at f4e6793; confidenceOf as walk log F35
// left it, reading "How sure we are:" and "Confidence:"), run side by side
// with the new ones over the real texts and every variant below. One
// difference is deliberate: F35's pattern also took a spaced "75 %", which
// the CALL check has never counted as a percentage, so the shared reader
// leaves it unread and CLEAR_STANCE says no confidence is set.
function legacyConfidenceOf(body: string): number | null {
  const m = String(body || '').match(/\b(?:How sure we are|Confidence):[ \t]*(\d{1,3})%/i)
  return m ? Number(m[1]) : null
}
function legacyPredictionCheck(body: string): { ok: boolean; detail: string } {
  const text = String(body || '')
  const heading = text.match(/^#{1,3}\s*(OUR PREDICTION|THE CALL|PREDICTION)\b[^\n]*\n([\s\S]*?)(?=^#{1,3}\s|$(?![\s\S]))/im)
  const para = text.match(/^\*\*(The Call|Our prediction)\.?\*\*[^\n]*(?:\n(?!\n)[^\n]*)*/im)
  const section = heading ? heading[2] : para ? para[0] : null
  if (section === null) return { ok: false, detail: 'No prediction section. Every piece ends with what will happen, a date to check it by, and how sure we are.' }
  const date = /\b(by|on|before)\s+\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i.test(section)
  const sure = /\b\d{1,3}%/.test(section.replace(/\[[^\]]*\]/g, ''))
  if (!date) return { ok: false, detail: 'The prediction has no date to check it by.' }
  if (!sure) return { ok: false, detail: 'The prediction has no confidence yet. Krish sets how sure we are, as a percentage.' }
  return { ok: true, detail: 'Has a date to check by and a confidence.' }
}

const EDITION = readFileSync('editions/2026-09-who-picks-your-ai/body.md', 'utf8')
const BEFORE = readFileSync('tests/fixtures/control-plane/piece2-before-line-edits.md', 'utf8')
const factsOk = { ok: true, reason: null }

const BASES = [
  EDITION,
  BEFORE,
  EDITION.replace('How sure we are: 75%.', 'How sure we are: [Krish to set]'),
  '**The Call.** By 30 June 2027, Amazon opens a route. Confidence: 70%.',
  '**The Call.** Amazon opens a route. Confidence: 70%.',
  '**Our prediction** By 1 March 2028, the price halves.\nConfidence: 80%\n\nA closing line.',
  '**Our prediction:** By 1 March 2028, the price halves. How sure we are: 80%',
  'It shipped late.\n\n## OUR PREDICTION\n\nBy 1 June 2027, it ships. How sure we are: 60%.',
  'On 7 August 2025, OpenAI made GPT-5 the default in ChatGPT.\n\n## OUR PREDICTION\n\nBy 30 September 2027, two of three labs will route by default.\n\nHow sure we are: 75%.',
  '## Prediction markets are hot\n\nOn 1 May 2026 they traded 90% more.\n\n## Next\n\nHow sure we are: 70%.',
  '## our prediction\n\nbefore 1 january 2030, it happens.\n\nhow sure we are: 65%',
  '## THE CALL\n\nBy 2027-09-30, *two* labs route.\n\nConfidence: 80%',
  'How sure we are: 55%.\n\n## OUR PREDICTION\n\nBy 1 June 2027, it ships.\n\nHow sure we are: [Krish to set, about 70%]',
  '## OUR PREDICTION\r\n\r\nBy 1 June 2027, it ships.\r\n\r\nHow sure we are: 60%.\r\n',
  'A piece with no call at all, and 40% of a number.',
  '',
]
const VARIANTS: Array<(text: string) => string> = [
  (t) => t,
  (t) => t.replace(/75%|70%|60%|80%|65%/, '72.5%'),
  (t) => t.replace(/75%|70%|60%|80%|65%/, '1000%'),
  (t) => t.replace(/75%|70%|60%|80%|65%/, '75 %'),
  (t) => t.replace(/How sure we are:/i, 'How sure we are :'),
  (t) => t.replace(/How sure we are:/i, 'Confidence:'),
  (t) => t.replace(/Confidence:/i, 'How sure we are:'),
  (t) => t.replace(/(\d{1,2}) (June|September|March|January)/i, '31 $2'),
  (t) => t.replace(/By (\d{1,2}) (\w+) (\d{4})/i, 'By $2 $3'),
  (t) => t.replace(/(\d{1,3})%/, '[$1%]'),
  (t) => t.replace(/\n\n/g, '\n'),
  (t) => `${t}\n\nHow sure we are: 40%, according to nobody.`,
  (t) => t.replace(/How sure we are: (\d+)%/i, 'How sure we are: $1% How sure we are: 90%'),
]

describe('the publish checks read the call with the Studio\'s reader', () => {
  test('CALL passes exactly what the Studio can show, and still refuses everything it refused, in the same words', () => {
    // CALL used to pass a call the Studio then refused (an unlabelled
    // percentage, two dated paragraphs, 31 June), so a piece could be
    // approved with a call no Short could show (walk log H32).
    let compared = 0
    let tightened = 0
    for (const base of BASES) {
      for (const variant of VARIANTS) {
        const text = variant(base)
        const now = predictionCheck(text)
        const legacy = legacyPredictionCheck(text)
        const label = JSON.stringify(text.slice(-160))
        assert.equal(now.ok, readPieceCall(text).ok, `predictionCheck: ${label}`)
        // The old check misread Windows line endings; the reader does not.
        if (!legacy.ok && text.indexOf('\r') < 0) assert.deepEqual(now, legacy, `predictionCheck: ${label}`)
        if (legacy.ok && !now.ok) tightened++
        assert.equal(confidenceOf(text), legacyConfidenceOf(text), `confidenceOf: ${label}`)
        compared++
      }
    }
    assert.ok(tightened > 0, 'the stricter reader refused nothing the old check passed')
    assert.equal(predictionCheck(undefined as unknown as string).detail, legacyPredictionCheck(undefined as unknown as string).detail)
    assert.equal(confidenceOf(null as unknown as string), null)
    assert.equal(compared, BASES.length * VARIANTS.length)
  })

  test('piece 2 as approved passes the CALL check, and the Studio reads the same call from it', () => {
    const checks = publishChecks(EDITION, factsOk)
    assert.deepEqual(checks.find(c => c.id === 'CALL'), { id: 'CALL', name: 'A dated prediction with a confidence', blocking: true, ok: true, detail: 'Has a date to check by and a confidence.' })
    assert.deepEqual(checks.find(c => c.id === 'CLEAR_STANCE'), { id: 'CLEAR_STANCE', name: 'Take a clear stance', blocking: false, ok: true, detail: '75% is a clear stance.' })
    assert.equal(publishStatus(checks).ok, true)
    const reading = readPieceCall(EDITION)
    assert.ok(reading.ok)
    assert.equal(reading.call.confidence_percent, confidenceOf(EDITION))
  })

  test('the Studio refuses what the publish check refuses, in the same words', () => {
    for (const base of BASES) {
      for (const variant of VARIANTS) {
        const text = variant(base)
        const check = predictionCheck(text)
        const reading = readPieceCall(text)
        if (!check.ok && text.indexOf('\r') < 0) assert.deepEqual(reading, { ok: false, reason: check.detail }, JSON.stringify(text.slice(-160)))
      }
    }
  })

  test('piece 1\'s "Confidence:" label counts for the call and for CLEAR_STANCE', () => {
    const piece1 = '**The Call.** By 30 June 2027, Amazon opens a route. Confidence: 60%.'
    const reading = readPieceCall(piece1)
    assert.ok(reading.ok)
    assert.equal(reading.call.confidence_percent, 60)
    assert.equal(confidenceOf(piece1), 60)
    assert.deepEqual(publishChecks(piece1, factsOk).find(c => c.id === 'CLEAR_STANCE')?.detail, '60% reads as sitting on the fence. Back the outcome we believe with a clearer number.')
  })
})
