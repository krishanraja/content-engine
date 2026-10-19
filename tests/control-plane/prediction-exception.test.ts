import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { bodyHash, gateStatus } from '../../apps/control-plane/api/_factGate.js'
import { callHorizon, publishChecks, publishStatus } from '../../apps/control-plane/api/_publishChecks.js'

const evidence = 'docs/plans/2026-10-09-friday/article-fact-reconciliation-19oct/'
const piece = JSON.parse(readFileSync(evidence + 'piece-before.json', 'utf8')).piece
const report = JSON.parse(readFileSync(evidence + 'gate-before.json', 'utf8'))
const now = new Date('2026-10-19T18:00:00Z')
const gate = () => gateStatus({ fact_check: report.fact_check }, piece.body)

describe('the approved Friday prediction exception', () => {
  test('keeps the actual signed-through fact result and passes the unchanged piece', () => {
    assert.equal(report.fact_check.passed, false)
    assert.equal(report.fact_check.signed_off.length, 11)
    assert.equal(bodyHash(piece.body), report.fact_check.body_hash)
    assert.equal(gate().ok, true)
    const checks = publishChecks(piece.body, gate(), now, piece.id)
    assert.equal(publishStatus(checks).ok, true)
    assert.match(checks.find(c => c.id === 'CALL_HORIZON')!.detail, /Krish approved an exception/)
  })

  test('requires the piece identity even for identical copied words', () => {
    for (const id of [undefined, 'another-piece']) {
      assert.equal(callHorizon(piece.body, now, id)?.ok, false)
    }
  })

  test('cannot survive a changed forecast, deadline, confidence or falsifier', () => {
    for (const [before, after] of [
      ['will once again start free users', 'will once again start paid users'],
      ['30 June 2027', '30 July 2027'],
      ['85%.', '86%.'],
      ['you have to switch it on', 'you never have to switch it on'],
    ]) {
      const changed = piece.body.replace(before, after)
      assert.notEqual(changed, piece.body)
      assert.equal(callHorizon(changed, now, piece.id)?.ok, false)
    }
  })

  test('does not waive expiry, missing predictions, facts or other house rules', () => {
    assert.equal(callHorizon(piece.body, new Date('2027-06-30T12:00:00Z'), piece.id)?.ok, false)
    assert.equal(callHorizon('No prediction.', now, piece.id), null)
    const checks = publishChecks(piece.body + '\n\nDo this!', { ok: false, reason: 'stale' }, now, piece.id)
    assert.equal(checks.find(c => c.id === 'FACTS')!.ok, false)
    assert.equal(checks.find(c => c.id === 'NO_EXCLAMATION')!.ok, false)
    assert.equal(publishStatus(checks).ok, false)
  })
})
