import { describe, expect, it } from 'vitest'
import { fitBox, fitScale } from '../fit'
import { REGIONS } from '../captions/kit'
import { LAYOUTS, MAX_GROW, freeRegion, isRegion, layoutSlots } from './layout'

/** The layout ingredient (Krish, 2026-11-13: "the use of the screen space is terrible"). docs/ve/INGREDIENTS.md. */

describe('layout', () => {
  it('changes nothing with no layout or the house layout', () => {
    expect(layoutSlots(undefined, '9:16', 'lower', true, 2)).toBeUndefined()
    expect(layoutSlots({ mode: 'house' }, '9:16', 'lower', true, 2)).toBeUndefined()
    const plain = { left: 0, top: 0, width: 1080, height: 1920 }
    expect(isRegion(plain)).toBe(false)
    expect(fitScale({ width: 100, height: 100 }, plain)).toBe(1)
    expect(fitBox({ width: 100, height: 100 }, plain).top).toBe(0)
  })

  it('lets a device grow to fill its region, up to MAX_GROW, centred in it', () => {
    const [box] = layoutSlots({ mode: 'fill' }, '9:16', 'lower', true, 1)!
    expect(isRegion(box!)).toBe(true)
    expect(fitScale({ width: 100, height: 100 }, box!)).toBe(MAX_GROW)
    const fitted = fitBox({ width: 400, height: 100 }, box!)
    expect(fitted.width).toBeCloseTo(box!.width, 6)          // width-limited: 400 x 2 = 800
    expect(fitted.top + fitted.height / 2).toBeCloseTo(box!.top + box!.height / 2, 6)
  })

  it('keeps every region inside the safe column and clear of the caption band it is given', () => {
    for (const placement of ['lower', 'centre', 'upper'] as const) {
      const r = freeRegion('9:16', placement, true)
      expect(r.top).toBeGreaterThanOrEqual(270)
      expect(r.top + r.height).toBeLessThanOrEqual(1320)
      expect(r.left + r.width).toBeLessThanOrEqual(880)
      const band = REGIONS['9:16'][placement]
      const overlap = Math.min(r.top + r.height, band.top + band.height) - Math.max(r.top, band.top)
      if (placement !== 'centre') expect(overlap).toBeLessThanOrEqual(0)
    }
    const house = freeRegion('9:16', undefined, false)
    expect(house.top + house.height).toBeLessThanOrEqual(1090)  // above the house caption box
  })

  it('shares the region top to bottom in stack, each share a region of its own', () => {
    const slots = layoutSlots({ mode: 'stack' }, '9:16', 'upper', true, 3)!
    expect(slots).toHaveLength(3)
    for (let i = 1; i < slots.length; i++) expect(slots[i]!.top).toBeGreaterThanOrEqual(slots[i - 1]!.top + slots[i - 1]!.height)
    expect(slots.every(isRegion)).toBe(true)
  })

  it('names the same modes the spec and compile accept', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('scripts/velib/compile.py', 'utf8')).toContain(`LAYOUTS = (${LAYOUTS.map(v => `'${v}'`).join(', ')})`)
    expect(readFileSync('packages/contracts/src/production-spec.ts', 'utf8')).toContain(LAYOUTS.map(v => `'${v}'`).join(', '))
  })
})
