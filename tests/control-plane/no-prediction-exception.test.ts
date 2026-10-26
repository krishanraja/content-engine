import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { publishChecks } from '../../apps/control-plane/api/_publishChecks.js'

const wednesday = 'b63d2507-dbb4-449d-bce4-f21e859ee2ad'
const friday = '9a0c97af-f0d6-4d12-a7ce-773c622d4b67'
const body = readFileSync('docs/plans/2026-10-28-draft-body.md', 'utf8').replace(/\r\n/g, '\n')
const ids = new Set(['CALL', 'CALL_HORIZON', 'CLEAR_STANCE'])
const facts = { ok: true, reason: null }
const call = '\n\n## OUR PREDICTION\n\nBy 1 December 2026, Duet reaches the UK.\n\nHow sure we are: 85%\n'

describe('Krish-approved no-prediction pieces (26 October 2026)', () => {
  test('waives only the three forecast checks on the two named pieces', () => {
    for (const piece of [wednesday, friday]) {
      const checks = publishChecks(body, facts, undefined, piece)
      const waived = checks.filter(c => ids.has(c.id))
      assert.equal(waived.length, 3)
      for (const c of waived) {
        assert.equal(c.ok, true)
        assert.match(c.detail, /Exempt by Krish on 26 October 2026/)
      }
      assert.equal(publishChecks(body, { ok: false, reason: 'Unresolved claims' }, undefined, piece).find(c => c.id === 'FACTS')?.ok, false)
    }
  })
  test('does not carry to another piece or an unnamed one', () => {
    for (const id of [undefined, 'another-piece', 'd7a20885-7001-4661-b444-9d7ca1043416']) {
      assert.equal(publishChecks(body, facts, undefined, id).filter(c => ids.has(c.id) && !c.ok).length, 3)
    }
  })
  test('a body that makes a prediction is checked as any other', () => {
    const checks = publishChecks(body + call, facts, new Date('2026-10-26T00:00:00Z'), wednesday)
    for (const c of checks.filter(c => ids.has(c.id))) assert.doesNotMatch(c.detail, /Exempt by Krish/)
    const unsure = publishChecks(body + call.replace('85%', '55%'), facts, new Date('2026-10-26T00:00:00Z'), friday)
    assert.equal(unsure.find(c => c.id === 'CLEAR_STANCE')?.ok, false)
  })
})
