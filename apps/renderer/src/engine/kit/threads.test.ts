import { describe, expect, it } from 'vitest'
import { parted, pennant, twisted, weave } from './threadPath'

const coordinates = (path: string) => (path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? []).map(Number)

describe('thread geometry', () => {
  it('weaves a seeded S curve with exact authored endpoints', () => {
    const from = { x: 72, y: 336 }, to = { x: 902, y: 436 }
    const path = weave(from, to, { seed: 42 })
    expect(path).toBe(weave(from, to, { seed: 42 }))
    expect(path).not.toBe(weave(from, to, { seed: 43 }))
    const values = coordinates(path)
    expect(values.slice(0, 2)).toEqual([72, 336])
    expect(values.slice(-2)).toEqual([902, 436])
    const horizontal = coordinates(weave(from, { x: 902, y: 336 }))
    expect(horizontal[3]!).toBeGreaterThan(336)
    expect(horizontal[5]!).toBeLessThan(336)
  })

  it('twists opposite-phase strands across the centre line', () => {
    const [a, b] = twisted(522, 1108, 1620, 0, 9, 96).map(coordinates)
    const differences = a!.filter((_, i) => i % 2 === 0).map((x, i) => x - b![i * 2]!)
    expect(differences.some(x => x > 1)).toBe(true)
    expect(differences.some(x => x < -1)).toBe(true)
    for (let i = 0; i < a!.length; i += 2) {
      expect((a![i]! + b![i]!) / 2).toBeCloseTo(522)
      expect(a![i + 1]).toBe(b![i + 1])
    }
    expect(a!.at(-1)).toBe(1620)
    expect(() => twisted(0, 0, 100, 0, 9, 0)).toThrow()
  })

  it('parts the thread around a ring with clearance on both sides', () => {
    const split = parted({ x: 400, y: 536 }, { x: 902, y: 536 }, { center: { x: 690, y: 536 }, radius: 16 })
    expect(split.left).toEqual({ x: 640, y: 536 })
    expect(split.right).toEqual({ x: 740, y: 536 })
    expect(coordinates(split.paths[0]!).slice(-2)).toEqual([640, 536])
    expect(coordinates(split.paths[1]!).slice(0, 2)).toEqual([740, 536])
    for (const path of split.paths) {
      const values = coordinates(path)
      for (let i = 0; i < values.length; i += 2) expect(Math.hypot(values[i]! - 690, values[i + 1]! - 536)).toBeGreaterThan(16)
    }
    expect(() => parted({ x: 0, y: 0 }, { x: 100, y: 0 }, { center: { x: 10, y: 0 }, radius: 16 })).toThrow()
  })

  it('uses the same pole and a dashed ghost for an unplanted pennant', () => {
    const planted = pennant(true), bare = pennant(false)
    expect(planted.pole).toBe(bare.pole)
    expect(planted.dash).toBeUndefined()
    expect(bare.dash).toBe('5 6')
    expect(bare.opacity).toBeLessThan(planted.opacity)
    expect(pennant(true, 100).pole).toContain('-100')
  })
})
