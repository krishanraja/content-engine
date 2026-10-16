import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import {
  MAX_FILED_SOURCES, MAX_MATERIALS, MaterialsFull, isFiledSource, withMaterial, type Material,
} from '../../apps/control-plane/api/_content.js'

// 2026-10-16: four filings on Friday's piece pushed OpenAI's release notes and
// Artificial Analysis's Haiku 5.5 page off its materials, because every route
// cut the list to the newest 40. The fact gate holds a piece to its filed
// sources, so none may go to make room.

const filed = (n: number): Material => ({
  id: `f${n}`, kind: 'paste', title: `source ${n}`, content: `the source's own words ${n}`,
  url: `https://example.test/${n}`, verbatim: true,
})
const research = (n: number): Material => ({ id: `r${n}`, kind: 'research', title: `dive ${n}`, content: `findings ${n}` })
const ids = (ms: Material[]) => ms.map(m => m.id)

describe('withMaterial never drops a filed source', () => {
  test('under the cap, the new material goes first and nothing goes', () => {
    const next = withMaterial([filed(1), research(1)], filed(2))
    assert.deepEqual(ids(next), ['f2', 'f1', 'r1'])
  })

  test('at the cap, the oldest research makes room, not the oldest filed source', () => {
    // Newest first, as stored: 20 research, then the 20 oldest are filed sources.
    const list = [...Array.from({ length: 20 }, (_, i) => research(i)), ...Array.from({ length: 20 }, (_, i) => filed(i))]
    const next = withMaterial(list, filed(99))
    assert.equal(next.length, MAX_MATERIALS)
    assert.equal(next.filter(isFiledSource).length, 21)
    assert.ok(!ids(next).includes('r19'), 'the oldest research went')
    assert.ok(ids(next).includes('f19'), 'the oldest filed source stayed')
  })

  test('a piece of filed sources only grows past the cap rather than lose one', () => {
    const list = Array.from({ length: MAX_MATERIALS }, (_, i) => filed(i))
    const next = withMaterial(list, filed(99))
    assert.equal(next.length, MAX_MATERIALS + 1)
    assert.deepEqual(ids(next).slice(1), ids(list))
  })

  test('new research is kept even when every other material is a filed source', () => {
    const list = Array.from({ length: MAX_MATERIALS }, (_, i) => filed(i))
    const next = withMaterial(list, research(1))
    assert.equal(next[0].id, 'r1')
    assert.equal(next.filter(isFiledSource).length, MAX_MATERIALS)
  })

  test('past MAX_FILED_SOURCES a new filed source is refused, with a reason, and nothing changes', () => {
    const list = Array.from({ length: MAX_FILED_SOURCES }, (_, i) => filed(i))
    assert.throws(() => withMaterial(list, filed(999)), MaterialsFull)
    assert.equal(list.length, MAX_FILED_SOURCES)
    assert.equal(withMaterial(list, research(1)).filter(isFiledSource).length, MAX_FILED_SOURCES)
  })

  test('a material marked verbatim without its words or page is not protected', () => {
    const half: Material = { id: 'h', kind: 'paste', content: '', url: 'https://example.test/h', verbatim: true }
    const list = [...Array.from({ length: MAX_MATERIALS - 1 }, (_, i) => filed(i)), half]
    assert.ok(!ids(withMaterial(list, filed(99))).includes('h'))
  })
})

describe('every route that adds a material goes through withMaterial', () => {
  for (const route of ['materials.ts', 'dive-deeper.ts', 'deepen.ts']) {
    test(route, () => {
      const src = readFileSync(new URL(`../../apps/control-plane/api/content-ideas/[id]/${route}`, import.meta.url), 'utf8')
      assert.match(src, /withMaterial\(/)
      assert.doesNotMatch(src, /\.slice\(0, 40\)/)
    })
  }
})

describe('a filed source past what the checkers read is named, never silently unseen', () => {
  test('filedSourcesCut lists only the filed sources that do not fit whole', async () => {
    const { filedSourcesCut, SOURCES_BUDGET } = await import('../../apps/control-plane/api/_factGate.js')
    const big = (n: number): Material => ({ ...filed(n), content: `${n} `.repeat(Math.ceil(SOURCES_BUDGET / 4)) })
    // Newest first: two large filed sources fill the budget, so the oldest is cut.
    const meta = { materials: [filed(1), big(2), big(3), filed(4)] }
    assert.deepEqual(filedSourcesCut(meta), ['source 3', 'source 4'])
    assert.deepEqual(filedSourcesCut({ materials: [filed(1), filed(2)] }), [])
  })
  test('the paid run refuses before any model call when a filed source is cut', () => {
    const src = readFileSync(new URL('../../apps/control-plane/api/content-ideas/[id]/fact-check.ts', import.meta.url), 'utf8')
    const refuse = src.indexOf("reason: 'sources_cut'")
    assert.ok(refuse > 0)
    assert.ok(refuse < src.indexOf('const run = new GateRun()'), 'the refusal comes before the run starts')
    assert.match(src, /filed_sources_cut: filedSourcesCut\(meta\)/)
  })
})
