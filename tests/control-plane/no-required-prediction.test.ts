import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { NO_PREDICTION_NEEDED, PREDICTION_CHECKS, predictionWanted, publishChecks, publishStatus } from '../../apps/control-plane/api/_publishChecks.js'
import { HOUSE_RULES } from '../../apps/control-plane/api/_houseRules.js'

// Ruling (Krish, 2026-11-19): "remove all traces that require predictions in every article, I am starting to really hate
// the prediction format, it's baseless, lame and has no value, and the predictions are dull and vanilla. If I want to
// predict something in a particular piece I will".
const facts = { ok: true, reason: null }
const now = new Date('2026-11-19T12:00:00Z')
const plain = '# A piece\n\nThe bank moved first. Then the rest followed, one by one, as the cost fell.\n\n## 3 things you can do tomorrow\n\n1. Ask.\n2. Check.\n3. Compare.\n'
const call = (pct: number, due = '1 January 2027') => `${plain}\n## OUR PREDICTION\n\nBy ${due}, a second bank follows.\n\nHow sure we are: ${pct}%.\n`

describe('no piece needs a prediction (Ruling, Krish, 2026-11-19)', () => {
  test('a piece with no prediction passes CALL, CALL_HORIZON and CLEAR_STANCE, for any piece', () => {
    for (const id of [undefined, 'any-piece']) {
      const checks = publishChecks(plain, facts, now, id)
      for (const c of checks.filter(c => PREDICTION_CHECKS.includes(c.id))) {
        assert.equal(c.ok, true, c.id)
        assert.equal(c.detail, NO_PREDICTION_NEEDED)
      }
      assert.equal(publishStatus(checks).failing.filter(c => PREDICTION_CHECKS.includes(c.id)).length, 0)
    }
  })
  test('a piece Krish asked a prediction of must carry one, held to the same standard', () => {
    const asked = { predictionWanted: true }
    assert.equal(publishChecks(plain, facts, now, 'p', asked).filter(c => PREDICTION_CHECKS.includes(c.id) && !c.ok).length, 3)
    assert.equal(publishChecks(call(85), facts, now, 'p', asked).filter(c => PREDICTION_CHECKS.includes(c.id) && !c.ok).length, 0)
  })
  test('a prediction in the body is still checked, so a weak one cannot slip through', () => {
    assert.equal(publishChecks(call(55), facts, now).find(c => c.id === 'CLEAR_STANCE')!.ok, false)
    assert.equal(publishChecks(call(85, '1 January 2028'), facts, now).find(c => c.id === 'CALL_HORIZON')!.ok, false)
  })
  test('the opt-in is his words on the piece and nothing else', () => {
    assert.equal(predictionWanted(undefined), false)
    assert.equal(predictionWanted({}), false)
    assert.equal(predictionWanted({ prediction: true }), false)
    assert.equal(predictionWanted({ prediction: { wanted: true } }), false)
    assert.equal(predictionWanted({ prediction: { wanted: true, said: '  ' } }), false)
    assert.equal(predictionWanted({ prediction: { wanted: true, said: 'call it on this one', on: '2026-11-20' } }), true)
  })
  test('no house rule asks a writer, a judge or the final pass for a prediction', () => {
    const prompting = new Set(['judge_idea', 'judge_draft', 'write', 'final_pass'])
    for (const id of ['CALL', 'CLEAR_STANCE', 'SHARP_PREDICTION']) {
      const rule = HOUSE_RULES.find(r => r.id === id)!
      assert.ok(rule, id)
      assert.deepEqual(rule.stages.filter(s => prompting.has(s)), [], `${id} still reaches a writer or judge`)
      assert.match(rule.text, /only when Krish asks/i, `${id} does not say it is his choice on the piece`)
    }
    for (const r of HOUSE_RULES.filter(r => r.stages.some(s => prompting.has(s)))) {
      assert.doesNotMatch(r.text, /every piece (?:ends with our prediction|makes a (?:dated )?(?:prediction|call))/i, r.id)
    }
  })
  test('the routes pass his opt-in through to the checks', () => {
    assert.match(readFileSync('apps/control-plane/api/content-ideas.ts', 'utf8'), /predictionWanted: predictionWanted\(jsonRecord\(current\.meta\)\)/)
    assert.match(readFileSync('apps/control-plane/api/content-ideas/[id]/fact-check.ts', 'utf8'), /predictionWanted: predictionWanted\(meta\)/)
  })
})
