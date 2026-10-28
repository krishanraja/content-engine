import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CANVAS, SCRIBBLE, ZONES } from './lock'
import { scribblePath, type ScribbleSpec } from './scribblePath'

const lock = JSON.parse(readFileSync('config/ve/design-lock.json', 'utf8'))
const coords = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
const examples: ScribbleSpec[] = [
  { shape: 'loop', target: { x: 300, y: 400, w: 400, h: 200 } },
  { shape: 'underline', from: [200, 600], to: [800, 600] },
  { shape: 'arrow', from: [200, 500], to: [800, 700] },
  { shape: 'bracket', x: 300, y0: 500, y1: 900 },
  { shape: 'tick', cx: 500, cy: 700, size: 100 },
  { shape: 'cross', cx: 500, cy: 700, size: 100 },
]

describe('design lock constants', () => {
  it('matches every copied constant against the frozen JSON', () => {
    expect(CANVAS).toEqual(lock.canvas)
    expect(SCRIBBLE).toEqual(lock.scribble)
    expect(ZONES).toEqual(lock.zones)
  })
})
describe('approved scribble paths', () => {
  it.each(examples)('is deterministic and finite for $shape', spec => {
    const d = scribblePath(spec, 'one')
    expect(d).toBe(scribblePath(spec, 'one'))
    expect(d).not.toBe(scribblePath(spec, 'two'))
    expect(d.startsWith('M')).toBe(true)
    expect(d).not.toMatch(/NaN|Infinity/)
  })
  it('keeps loop control points within a target grown by 25 percent on each edge', () => {
    for (let seed = 0; seed < 100; seed++) {
      const points = coords(scribblePath(examples[0]!, String(seed)))
      points.forEach((n, i) => {
        expect(n).toBeGreaterThanOrEqual(i % 2 ? 350 : 200)
        expect(n).toBeLessThanOrEqual(i % 2 ? 650 : 800)
      })
    }
  })
  it('continues past a full revolution and grows beyond its starting radius', () => {
    const d = scribblePath({ shape: 'loop', cx: 0, cy: 0, u: [100, 0], v: [0, 100] }, 'one')
    expect(d.match(/ C/g)).toHaveLength(Math.floor(44 * 1.16))
    const p = coords(d)
    expect(Math.hypot(...p.slice(-2) as [number, number])).toBeGreaterThan(Math.hypot(p[0]!, p[1]!))
  })
  it('keeps the single underline within 20 px, and ports the double return pass', () => {
    const spec = { shape: 'underline', from: [200, 600], to: [800, 600] } as const
    for (let seed = 0; seed < 30; seed++) {
      coords(scribblePath({ ...spec, double: false }, String(seed))).forEach((n, i) => {
        if (i % 2) expect(Math.abs(n - 600)).toBeLessThan(20)
      })
    }
    expect(scribblePath(spec, 'one').match(/ C/g)!.length).toBeGreaterThan(scribblePath({ ...spec, double: false }, 'one').match(/ C/g)!.length)
    expect(scribblePath({ shape: 'underline', target: { x: 200, y: 400, w: 600, h: 190 } }, 'one')).toBe(scribblePath(spec, 'one'))
  })
  it('ends the arrow shaft at its destination and adds the reference head', () => {
    const d = scribblePath(examples[2]!, 'one')
    expect(d.split(' M')[0]).toMatch(/800\.0 700\.0$/)
    expect(d).toMatch(/ M[-\d.]+ [-\d.]+ L800\.0 700\.0 L[-\d.]+ [-\d.]+$/)
  })
  it('handles a skewed loop, either bracket side and degenerate lines without NaN', () => {
    for (const spec of [
      { shape: 'loop', cx: 500, cy: 600, u: [100, 30], v: [20, 200], sq: 3 },
      { shape: 'bracket', x: 300, y0: 500, y1: 900, side: -1 },
      { shape: 'arrow', from: [1, 1], to: [1, 1] },
      { shape: 'underline', from: [1, 1], to: [1, 1] },
    ] as ScribbleSpec[]) expect(scribblePath(spec, 'one')).not.toMatch(/NaN|Infinity/)
  })
})
