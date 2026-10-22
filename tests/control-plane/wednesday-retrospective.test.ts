import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { publishChecks } from '../../apps/control-plane/api/_publishChecks.js'

const body = readFileSync('docs/plans/2026-10-19-week/wednesday-article-draft.md', 'utf8').replace(/\r\n/g, '\n')
const piece = 'd7a20885-7001-4661-b444-9d7ca1043416'
const ids = new Set(['CALL', 'CALL_HORIZON', 'CLEAR_STANCE'])
const facts = { ok: true, reason: null }

describe('Krish-approved Wednesday retrospective exception', () => {
  test('waives only the three forecast requirements on the exact approved piece/body', () => {
    const checks = publishChecks(body, facts, undefined, piece)
    assert.equal(checks.filter(c => ids.has(c.id)).length, 3)
    for (const c of checks.filter(c => ids.has(c.id))) {
      assert.equal(c.ok, true)
      assert.match(c.detail, /Exempt by Krish/)
      assert.match(c.detail, /no future prediction or confidence is asserted/)
    }
    assert.equal(publishChecks(body, { ok: false, reason: 'Unresolved claims' }, undefined, piece).find(c => c.id === 'FACTS')?.ok, false)
  })
  test('cannot carry to another article, an unspecified piece or an edited body', () => {
    for (const [text, id] of [[body, undefined], [body, 'another-piece'], [body + '\nChanged.', piece]] as const) {
      assert.equal(publishChecks(text, facts, undefined, id).filter(c => ids.has(c.id) && !c.ok).length, 3)
    }
  })
})
