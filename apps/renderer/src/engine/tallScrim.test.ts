import { describe, expect, it } from 'vitest'
import { tallScrim } from './FormatMaster'

describe('the tall caption scrim (Tue 17, 19 Nov 2026)', () => {
  it('holds 72% ink behind the caption band and eases to nothing below it, never to the bottom edge', () => {
    const stops = tallScrim(1010, 1170, 1920)
    const at = (y: number) => {
      const f = y / 1920
      const i = stops.findIndex(([s]) => s >= f)
      const [a0, o0] = stops[Math.max(0, i - 1)]!, [a1, o1] = stops[i]!
      return a1 === a0 ? o1 : o0 + (o1 - o0) * (f - a0) / (a1 - a0)
    }
    expect(at(1010)).toBeCloseTo(0.72, 2)
    expect(at(1170)).toBeCloseTo(0.72, 2)
    expect(at(1400)).toBeLessThan(0.2)
    expect(stops.at(-1)).toEqual([1, 0])
  })
})
