import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema, EngineTokensSchema } from '../../props'
import type { EngineEvent } from '../../props'
import { slotsFor } from '../../layouts'
import { gridLayout, TestGrid } from './index'
import { TestGridParamsSchema } from './schema'
import { testGridStateAt } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.object)
const events = fixture.events.map((event) => EngineEventSchema.parse(event))
const at = (frame: number, cues: readonly EngineEvent[] = events) => testGridStateAt(object, cues, frame)

describe('test_grid persistent scoreboard', () => {
  it('has no tick before its own stamp and a complete tick six frames after it', () => {
    const stamps = [
      { frame: 60, ids: ['claude:xinjiang', 'claude:turkmenistan'] },
      { frame: 90, ids: ['chatgpt:xinjiang', 'chatgpt:turkmenistan'] },
      { frame: 120, ids: ['deepseek:turkmenistan'] },
    ]
    for (const stamp of stamps) for (const id of stamp.ids) {
      expect(at(stamp.frame - 1).cells.find((cell) => cell.id === id)?.tick).toBe(false)
      const after = at(stamp.frame + 6).cells.find((cell) => cell.id === id)
      expect(after?.tick).toBe(true)
      expect(after?.stampProgress).toBe(1)
    }
    expect(at(126).cells.filter((cell) => cell.tick)).toHaveLength(5)
    expect(at(126).cells.find((cell) => cell.id === 'deepseek:xinjiang')?.ghost).toBe(true)
  })

  it('shows ghost ticks only after mark, staggered by three frames', () => {
    expect(at(29).cells.every((cell) => !cell.ghost)).toBe(true)
    expect(at(30).cells.filter((cell) => cell.ghost)).toHaveLength(1)
    expect(at(32).cells.filter((cell) => cell.ghost)).toHaveLength(1)
    expect(at(33).cells.filter((cell) => cell.ghost)).toHaveLength(2)
    expect(at(45).cells.filter((cell) => cell.ghost)).toHaveLength(6)
    expect(at(66).cells.filter((cell) => cell.ghost)).toHaveLength(4)
    expect(at(100, events.filter((event) => event.verb !== 'mark')).cells.every((cell) => !cell.ghost)).toBe(true)
    const noKey = { ...object, params: { ...object.params, answerKey: false } }
    expect(testGridStateAt(noKey, events, 50).cells.every((cell) => !cell.ghost)).toBe(true)
  })

  it('keeps all coordinates, values, unit and denominator at every frame, including outside its life', () => {
    const baseline = at(-1)
    for (let frame = -1; frame <= 241; frame++) {
      const state = at(frame)
      expect(state.cells).toHaveLength(6)
      expect(state.cells.map(({ id, value }) => ({ id, value }))).toEqual(baseline.cells.map(({ id, value }) => ({ id, value })))
      expect(state.unit).toBe(baseline.unit)
      expect(state.denominator).toBe(2)
      expect(state.producerLabel).toBe("KRISH'S TEST · 23 OCT")
    }
  })

  it('retains ticks and emphasis through highlight, carry, exit and repeated entry', () => {
    const focused = at(156)
    const held = at(186)
    expect(held.cells).toEqual(focused.cells)
    expect(held.cells.find((cell) => cell.id === 'deepseek:xinjiang')).toMatchObject({ opacity: 1, scale: 1.08, tick: false })
    expect(held.cells.filter((cell) => cell.opacity === 0.35)).toHaveLength(5)
    expect(at(216).cells.filter((cell) => cell.tick)).toHaveLength(5)
    const reentered: EngineEvent = { id: 'again', obj: object.obj, verb: 'enter', toState: 'hold results', atFrame: 220 }
    expect(at(230, [...events, reentered]).cells.filter((cell) => cell.tick)).toHaveLength(5)
  })

  it('drops for eight frames, fades for six, and hides outside the object lifespan', () => {
    expect(at(0).dropY).toBe(-48)
    expect(at(4).dropY).toBeGreaterThan(-48)
    expect(at(8).dropY).toBeCloseTo(0, 6)
    expect(at(210).opacity).toBe(1)
    expect(at(213).opacity).toBeGreaterThan(0)
    expect(at(213).opacity).toBeLessThan(1)
    expect(at(216).opacity).toBe(0)
    expect(at(-1).opacity).toBe(0)
    expect(at(240).opacity).toBe(0)
  })

  it('is seekable, sorts events, ignores other objects and never restarts a stamp', () => {
    const repeated: EngineEvent = { id: 'repeat', obj: object.obj, verb: 'stamp', toState: 'claude:*', atFrame: 70 }
    const unrelated: EngineEvent = { ...repeated, id: 'foreign', obj: 'other', toState: '*:*', atFrame: 1 }
    const cues = [...events, repeated, unrelated].reverse()
    expect(at(72, cues)).toEqual(at(72))
    at(230, cues)
    expect(at(59, cues)).toEqual(at(59))
  })

  it('uses label-matched data and reveals a zero without inventing a success tick', () => {
    const reordered = { ...object, dataset: { ...object.dataset!, rows: [...object.dataset!.rows].reverse() } }
    expect(testGridStateAt(reordered, events, 126).cells).toEqual(at(126).cells)
    const zero: EngineEvent = { id: 'zero', obj: object.obj, verb: 'stamp', toState: 'deepseek:xinjiang', atFrame: 140 }
    expect(at(146, [...events, zero]).cells.find((cell) => cell.id === 'deepseek:xinjiang')).toMatchObject({ stamped: true, value: 0, tick: false, ghost: false })
  })

  it('rejects incomplete grids, duplicate ids, unknown coordinates and missing or ambiguous data', () => {
    const params = TestGridParamsSchema.parse(object.params)
    expect(TestGridParamsSchema.safeParse({ ...params, cells: params.cells.slice(1) }).success).toBe(false)
    expect(TestGridParamsSchema.safeParse({ ...params, rows: [...params.rows, params.rows[0]] }).success).toBe(false)
    expect(TestGridParamsSchema.safeParse({ ...params, cells: [...params.cells.slice(1), { row: 'missing', col: 'xinjiang', datasetLabel: 'missing' }] }).success).toBe(false)
    const absent = { ...object, dataset: { ...object.dataset!, rows: [] } }
    expect(() => testGridStateAt(absent, events, 0)).toThrow('one finite dataset value')
    const duplicated = { ...object, dataset: { ...object.dataset!, rows: [...object.dataset!.rows, object.dataset!.rows[0]!] } }
    expect(() => testGridStateAt(duplicated, events, 0)).toThrow('one finite dataset value')
    const prose: EngineEvent = { id: 'bad', obj: object.obj, verb: 'stamp', toState: 'Claude row: two solid mint ticks', atFrame: 10 }
    expect(() => at(20, [...events, prose])).toThrow('row:column selectors')
  })

  for (const aspect of ['9:16', '16:9'] as const) {
    it(`renders six persistent cells and provenance in the ${aspect} slot`, () => {
      for (const frame of [0, 29, 48, 66, 126, 156, 186, 216]) {
        const html = renderToStaticMarkup(createElement(TestGrid, {
          object, events, frame, aspect, tokens: EngineTokensSchema.parse(fixture.tokens),
          box: aspect === '9:16' ? fixture.boxes.tall : fixture.boxes.wide,
        }))
        expect(html.match(/role="cell"/g)).toHaveLength(6)
        expect(html).toContain('KRISH&#x27;S TEST · 23 OCT')
        expect(html).toContain('OUT OF 2')
        expect(html).toContain('MYMU Plex Mono')
      }
    })
  }
})

describe('grid fitted geometry', () => {
  it.each(['9:16', '16:9'] as const)('fits every grid element inside F1 context in %s', (aspect) => {
    const box = slotsFor('F1', aspect)[0]!
    const l = gridLayout(box, 3, 2, aspect)
    expect(l.cells).toHaveLength(6)
    const rects = [...l.header, ...l.rowLabels, ...l.cells, l.outOf, l.producerFooter]
    for (const rect of rects) {
      expect(rect.left).toBeGreaterThanOrEqual(box.left)
      expect(rect.top).toBeGreaterThanOrEqual(box.top)
      expect(rect.left + rect.width).toBeLessThanOrEqual(box.left + box.width + 1e-8)
      expect(rect.top + rect.height).toBeLessThanOrEqual(box.top + box.height + 1e-8)
    }
    const before = at(156).cells.map(({ id, stamped, value }) => ({ id, stamped, value }))
    gridLayout(slotsFor('F3', aspect)[0]!, 3, 2, aspect)
    expect(at(216).cells.map(({ id, stamped, value }) => ({ id, stamped, value }))).toEqual(before)
  })
})
