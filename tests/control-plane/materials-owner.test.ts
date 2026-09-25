import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { materialOwner, materialsContext, type Material } from '../../apps/control-plane/api/_content.js'

// Walk finding F12 (2026-09-24): every material reached the writer as
// "BACKGROUND MATERIALS Krish provided (his own research)", including research
// the engine fetched and anything an agent session attached. A writer told a
// claim is Krish's own research treats it as his position.
const m = (over: Partial<Material>): Material => ({ id: 'x', kind: 'paste', title: 'T', content: 'C', ...over })

describe('materials carry who put them on the piece', () => {
  test('what Krish added is his, including rows written before the field existed', () => {
    assert.equal(materialOwner(m({ by: 'Krish' })), 'krish')
    assert.equal(materialOwner(m({})), 'krish')
    assert.equal(materialOwner(m({ kind: 'link', url: 'https://x.test' })), 'krish')
  })

  test("the engine's research and an agent's uploads are never his", () => {
    assert.equal(materialOwner(m({ kind: 'research' })), 'engine')
    assert.equal(materialOwner(m({ by: 'claude_code' })), 'claude_code')
  })

  test('the writer sees each group under its own label', () => {
    const out = materialsContext([
      m({ title: 'His note', content: 'Krish wrote this' }),
      m({ title: 'Dive', kind: 'research', content: 'Engine found this' }),
      m({ title: 'Session', by: 'claude_code', content: 'Agent found this' }),
    ])
    const krish = out.indexOf('BACKGROUND MATERIALS Krish provided')
    const engine = out.indexOf('RESEARCH ON FILE, gathered by the engine, not by Krish')
    const agent = out.indexOf('RESEARCH ON FILE, gathered by an agent session (claude_code), not by Krish')
    assert.ok(krish >= 0 && engine > krish && agent > krish)
    assert.ok(out.indexOf('Krish wrote this') < engine)
    assert.ok(out.indexOf('Engine found this') > engine)
    assert.ok(out.indexOf('Agent found this') > agent)
  })

  test('with nothing of his on the piece, nothing is labelled as his', () => {
    const out = materialsContext([m({ kind: 'research', content: 'Engine found this' })])
    assert.equal(out.includes('Krish provided'), false)
  })
})
