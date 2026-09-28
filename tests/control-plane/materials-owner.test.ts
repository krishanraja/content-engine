import assert from 'node:assert/strict'
import { describe, test, vi } from 'vitest'

// ladder.ts imports the database client at load, and the client throws
// without these. A dead local address, so no test ever reaches a real
// database, and CI (which has neither variable) can load the module.
vi.hoisted(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})
import { FILED_SOURCES_BUDGET, materialOwner, materialsContext, type Material } from '../../apps/control-plane/api/_content.js'
import { curationBlock } from '../../apps/control-plane/api/_curation.js'
import { ownMaterials } from '../../apps/control-plane/api/judge/ladder.js'

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
    const engine = out.indexOf("THE ENGINE'S OWN SECONDARY RESEARCH")
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

// Walk log F36 (2026-09-28). The drafter and the rewriter saw 9,000
// characters of materials, newest first, stopping at the first item that did
// not fit, while the final pass read 16,000 and the fact gate 120,000. Piece
// 3's drafter saw seven of its eight filed excerpts and none of its four
// dives. And the engine's Perplexity dives reached the ladder's repair as
// "Research Krish brought himself".
describe('what a writer sees', () => {
  const excerpt = (n: number, chars: number): Material => ({
    id: `v${n}`, kind: 'paste', by: 'claude_code', verbatim: true, url: `https://source${n}.test/page`,
    title: `Source ${n} (verbatim)`, content: `Passage ${n}. ` + 'x'.repeat(chars),
  })
  const dive = (n: number): Material => ({ id: `d${n}`, kind: 'research', title: `Dive ${n}`, content: `Dive ${n} found this. ` + 'y'.repeat(3000) })

  test('filed sources come first and in full, then the summaries', () => {
    // Stored newest first, as dive-deeper and the filer prepend.
    const out = materialsContext([dive(1), excerpt(1, 5000), dive(2), excerpt(2, 300)])
    assert.ok(out.startsWith('FILED SOURCES'))
    assert.ok(out.includes('Passage 1. ' + 'x'.repeat(5000)), 'a 5,000 character excerpt is not cut to 2,400')
    assert.ok(out.indexOf('Passage 2.') < out.indexOf("THE ENGINE'S OWN SECONDARY RESEARCH"))
    assert.ok(out.indexOf('Dive 1 found this') > out.indexOf("THE ENGINE'S OWN SECONDARY RESEARCH"))
  })

  test('the writer sees at least what the final pass could, and an excerpt that does not fit does not hide the ones after it', () => {
    assert.ok(FILED_SOURCES_BUDGET >= 16_000)
    // Piece 3: eight excerpts, the eighth past the old 9,000 cut.
    const eight = Array.from({ length: 8 }, (_, i) => excerpt(i + 1, 1400))
    const out = materialsContext([dive(1), dive(2), ...eight])
    for (let i = 1; i <= 8; i++) assert.ok(out.includes(`Passage ${i}.`), `excerpt ${i} is shown`)
    const crowded = materialsContext([excerpt(1, FILED_SOURCES_BUDGET - 500), excerpt(2, 5000), excerpt(3, 200)])
    assert.ok(crowded.includes('Passage 3.'), 'a small excerpt after one that does not fit is still shown')
    assert.match(crowded, /filed but not shown, over the 24000 character budget: Source 2 \(verbatim\) \(5011 chars\)/)
  })

  test('the drafter\'s context carries every filed source of a piece like piece 3', () => {
    const eight = Array.from({ length: 8 }, (_, i) => excerpt(i + 1, 1400))
    const block = curationBlock({ idea: 'Koa', thesis: 'A retrained open model', meta: { materials: [dive(1), dive(2), dive(3), dive(4), ...eight] } }, null)
    for (let i = 1; i <= 8; i++) assert.ok(block.includes(`Passage ${i}.`), `the drafter sees excerpt ${i}`)
  })

  test('engine research is its own secondary research, never Krish\'s primary source, whoever pressed the button', () => {
    const out = materialsContext([dive(1), { ...dive(2), by: 'Krish' }, { id: 'n', kind: 'note' as Material['kind'], title: 'Shift dossier', content: 'SUMMARY: the engine wrote this' }])
    assert.equal(out.includes('Krish provided'), false)
    assert.equal(out.includes('treat as primary source'), false)
    assert.match(out, /THE ENGINE'S OWN SECONDARY RESEARCH/)
    assert.match(out, /Dive 2 found this/)
    assert.match(out, /SUMMARY: the engine wrote this/)
    assert.equal(materialOwner({ ...dive(1), by: 'Krish' }), 'engine')
  })

  test('only what Krish provided says so', () => {
    const out = materialsContext([m({ title: 'His note', content: 'Krish wrote this', by: 'Krish' }), dive(1)])
    assert.match(out, /BACKGROUND MATERIALS Krish provided \(his own research, treat as primary source/)
    assert.ok(out.indexOf('Krish wrote this') < out.indexOf("THE ENGINE'S OWN SECONDARY RESEARCH"))
  })

  test('the ladder\'s repair no longer calls the engine\'s dives Krish\'s own research', () => {
    const own = ownMaterials({ meta: { materials: [dive(1), excerpt(1, 200), m({ title: 'His note', content: 'Krish wrote this', by: 'Krish' })] } })
    const his = own.indexOf('## Research Krish brought himself')
    assert.ok(his >= 0 && own.indexOf('Krish wrote this') > his)
    assert.ok(own.indexOf('Dive 1 found this') > own.indexOf("## Research on file that is not Krish's"))
    assert.ok(own.indexOf('Passage 1.') > own.indexOf('## Sources filed on the piece'))
    assert.equal(ownMaterials({ meta: { materials: [dive(1)] } }).includes('Research Krish brought himself'), false)
  })
})
