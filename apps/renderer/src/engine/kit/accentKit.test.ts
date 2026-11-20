import { describe, expect, it } from 'vitest'
import { ACCENT_COLOURS, ACCENT_ROLES, accentGradient, accentKit, duotoneEmber } from './accentKit'

describe('the accent kit (Krish, 2026-11-20)', () => {
  it('carries the five approved colours, for three roles', () => {
    expect([ACCENT_COLOURS.ember, ACCENT_COLOURS.ember_deep, ACCENT_COLOURS.plum, ACCENT_COLOURS.plum_deep, ACCENT_COLOURS.peach])
      .toEqual(['#E2551F', '#B8321C', '#3B1232', '#1E0918', '#FFB48F'])
    expect(ACCENT_ROLES.sort()).toEqual(['big_moment', 'duotone_cutout', 'gradient'])
  })

  it('gives an off-day cut nothing', () => {
    expect(accentKit(false)).toBeNull()
    expect(accentGradient('moment', false)).toBeNull()
    expect(duotoneEmber(false)).toBeNull()
  })

  it('draws the moment gradient plum to ember to plum on a series day', () => {
    const css = accentGradient('moment', true)!
    expect(css.startsWith('linear-gradient(180deg, #1E0918 0%, #3B1232 12%, #B8321C 30%')).toBe(true)
    expect(css.endsWith('#1E0918 100%)')).toBe(true)
    expect(duotoneEmber(true)!.map((s) => s.colour)).toEqual(['#2A0C24', '#B8321C', '#FF8A5C', '#FFE3D1'])
  })
})
