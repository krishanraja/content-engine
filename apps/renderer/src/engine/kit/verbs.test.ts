import { describe, expect, it } from 'vitest'
import { countTo, cursorPath, drawPath, mix, typeOn } from './verbs'
import { setMotionProfile } from '../clock'
import { MOTION_PROFILES } from './motionProfiles'

describe('pure motion verbs', () => {
  it('depends only on its arguments, independent of the active motion profile', () => {
    const sample = () => [countTo(15, 10, 0, 100), drawPath(15, 10, 120),
      mix(13, 10, 'red', 'blue'), cursorPath(15, 10, [{ x: 0, y: 0 }, { x: 100, y: 0 }])]
    setMotionProfile(undefined)
    const expected = sample()
    try {
      for (const profile of Object.values(MOTION_PROFILES)) {
        setMotionProfile(profile)
        expect(sample()).toEqual(expected)
      }
    } finally {
      setMotionProfile(undefined)
    }
  })

  it('lands an instantaneous count exactly on its cue', () => {
    expect(countTo(9, 10, 1, 2, { frames: 0 })).toBe(1)
    expect(countTo(10, 10, 1, 2, { frames: 0 })).toBe(2)
  })

  it('counts deterministically and holds exact endpoints, including descending counts', () => {
    for (const [from, to] of ([[0.123, 99.456], [100, -50]] as const)) {
      expect(countTo(9, 10, from, to)).toBe(from)
      expect(countTo(10, 10, from, to)).toBe(from)
      expect(countTo(28, 10, from, to)).toBe(to)
      expect(countTo(100, 10, from, to)).toBe(to)
      expect(countTo(15, 10, from, to)).toBe(countTo(15, 10, from, to))
      expect(countTo(15, 10, from, to, { jitter: 0, decimals: 2 })).not.toBe(from)
    }
  })

  it('types at 30fps with clamped speed and complete Unicode characters', () => {
    const text = 'The whole sentence.'
    for (const cps of [25, 30, 40]) {
      expect(typeOn(9, 10, text, { cps })).toBe('')
      expect(typeOn(10 + Math.ceil(text.length / cps * 30), 10, text, { cps })).toBe(text)
    }
    expect(typeOn(15, 10, text, { cps: 1 })).toBe(typeOn(15, 10, text, { cps: 25 }))
    expect(typeOn(15, 10, text, { cps: 100 })).toBe(typeOn(15, 10, text, { cps: 40 }))
    expect(typeOn(11, 10, '😀ok')).toBe('😀')
  })

  it('draws a path once and holds', () => {
    expect(drawPath(9, 10, 120)).toBe(120)
    expect(drawPath(16, 10, 120)).toBeGreaterThan(0)
    expect(drawPath(16, 10, 120)).toBeLessThan(120)
    expect(drawPath(22, 10, 120)).toBe(0)
    expect(drawPath(100, 10, 120)).toBe(0)
    expect(drawPath(10, 10, 120, { frames: 0 })).toBe(0)
  })

  it('mixes named colours and token expressions without parsing them', () => {
    expect(mix(9, 10, 'red', 'blue')).toBe('red')
    expect(mix(13, 10, 'red', 'blue')).toMatch(/^color-mix\(in srgb, red .*%, blue .*%\)$/)
    expect(mix(16, 10, 'red', 'blue')).toBe('blue')
    expect(mix(100, 10, 'red', 'blue')).toBe('blue')
    expect(mix(13, 10, 'var(--brand)', 'mintcream')).toContain('var(--brand)')
  })

  it('travels in arcs, rests before pressing, releases and finishes exactly', () => {
    const points = Object.freeze([Object.freeze({ x: 0, y: 0 }), Object.freeze({ x: 100, y: 0 }), Object.freeze({ x: 100, y: 100 })])
    expect(cursorPath(9, 10, points)).toEqual({ x: 0, y: 0, pressed: false })
    expect(cursorPath(15, 10, points).y).toBeGreaterThan(0)
    expect(cursorPath(20, 10, points)).toEqual({ x: 100, y: 0, pressed: false })
    expect(cursorPath(23, 10, points)).toEqual({ x: 100, y: 0, pressed: true })
    for (let f = 10; f < 50; f++) {
      const state = cursorPath(f, 10, points)
      if (state.pressed) expect([23, 37]).toContain(f)
    }
    expect(cursorPath(38, 10, points)).toEqual({ x: 100, y: 100, pressed: false })
    expect(cursorPath(100, 10, points)).toEqual({ x: 100, y: 100, pressed: false })
    expect(cursorPath(100, 10, [points[0]!])).toEqual({ ...points[0], pressed: false })
    expect(() => cursorPath(10, 10, [])).toThrow(RangeError)
    expect(cursorPath(30, 10, points, { restFrames: 0 }).pressed).toBe(false)
  })
})
