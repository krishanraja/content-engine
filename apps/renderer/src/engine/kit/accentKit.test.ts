import { describe, expect, it } from 'vitest'
import { ACCENT_COLOURS, ACCENT_ROLES, accentGradient, accentKit, duotoneEmber } from './accentKit'

describe('the accent kit (Krish, 2026-11-20)', () => {
  it('carries the five approved colours, for three roles', () => {
    expect([ACCENT_COLOURS.ember, ACCENT_COLOURS.ember_deep, ACCENT_COLOURS.plum, ACCENT_COLOURS.plum_deep, ACCENT_COLOURS.peach])
      .toEqual(['#E2551F', '#B8321C', '#3B1232', '#1E0918', '#FFB48F'])
    expect(ACCENT_ROLES.sort()).toEqual(['big_moment', 'duotone_cutout', 'gradient'])
  })

  it.each([true, false])('withholds the retired colours, gradients and duotone (series day %s)', (seriesDay) => {
    expect(accentKit(seriesDay)).toBeNull()
    expect(accentGradient('moment', seriesDay)).toBeNull()
    expect(accentGradient('title', seriesDay)).toBeNull()
    expect(duotoneEmber(seriesDay)).toBeNull()
  })
})
