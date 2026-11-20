import { describe, expect, it } from 'vitest'
import { REGIONS } from '../captions/kit'
import { STAGINGS, isStaging, staged, stagingGeometry, trayRise } from './staging'
import { LAYOUTS } from './layout'

const inside = (b: { left: number; top: number; width: number; height: number }, w: number, h: number) =>
  b.left >= 0 && b.top >= 0 && b.left + b.width <= w && b.top + b.height <= h

describe('stagings (kit/staging.ts)', () => {
  it('are layout modes', () => {
    for (const mode of STAGINGS) expect(LAYOUTS).toContain(mode)
    expect(isStaging('fill')).toBe(false)
    expect(isStaging('band')).toBe(true)
  })

  it('keep every box inside the frame and the device region clear of the caption band', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const [w, h] = aspect === '9:16' ? [1080, 1920] : [1920, 1080]
      for (const mode of STAGINGS) for (const placement of ['lower', 'centre', 'upper'] as const) {
        const g = stagingGeometry(mode, aspect, placement, true)
        expect(inside(g.take, w, h)).toBe(true)
        expect(inside(g.panel, w, h)).toBe(true)
        expect(inside(g.region, w, h)).toBe(true)
        const band = REGIONS[aspect][placement]
        const overlaps = g.region.height > 0 && g.region.top < band.top + band.height && g.region.top + g.region.height > band.top
        expect(overlaps).toBe(false)
      }
    }
  })

  it('band puts the take under the panel; stage crosses the stage edge; tray leaves the take full frame', () => {
    const band = stagingGeometry('band', '9:16', 'lower', true)
    expect(band.take.top).toBe(band.panel.top + band.panel.height)
    const stage = stagingGeometry('stage', '9:16', 'lower', true)
    expect(stage.take.top + stage.take.height).toBe(1920)
    const tray = stagingGeometry('tray', '9:16', 'upper', true)
    expect(tray.take).toMatchObject({ left: 0, top: 0, width: 1080, height: 1920 })
    expect(tray.panel.top).toBeGreaterThanOrEqual(900)
  })

  it('stages only beats that show his take and keep no lock', () => {
    expect(staged({ layout: 'P1', plate: { source: 'take' } })).toBe(true)
    expect(staged({ layout: 'SPLIT', plate: { source: 'take' } })).toBe(false)
    expect(staged({ layout: 'WINDOW' })).toBe(false)
    expect(staged({ layout: 'STAGE', plate: { source: 'none' } })).toBe(false)
  })

  it('the tray lands in 9 frames and stays landed', () => {
    expect(trayRise(0, 0).scale).toBeCloseTo(0.6)
    expect(trayRise(9, 0)).toEqual({ scale: 1, ty: 0, opacity: 1 })
    expect(trayRise(40, 0)).toEqual({ scale: 1, ty: 0, opacity: 1 })
  })
})

describe('the pillar staging (Krish, 19 Nov 2026: "Pillar: whole take on the right")', () => {
  it('draws a vertical take whole at the wide frame\'s full height, the panel beside it, nothing overlapping', () => {
    const g = stagingGeometry('pillar', '16:9', 'lower', true)
    expect(g.take.height).toBe(1080)
    expect(Math.abs(g.take.width / g.take.height - 1080 / 1920)).toBeLessThan(0.002)
    expect(g.take.left + g.take.width).toBe(1920)
    expect(g.panel.left + g.panel.width).toBe(g.take.left)
    expect(g.region.left + g.region.width).toBeLessThanOrEqual(g.take.left)
  })
  it('never stages a tall cut: a pillar piece\'s 9:16 cut draws exactly as fill', () => {
    expect(isStaging('pillar', '9:16')).toBe(false)
    expect(isStaging('pillar', '16:9')).toBe(true)
    expect(isStaging('band', '9:16')).toBe(true)
  })
})

describe('the stage and anchor fixes (shot grammar step 5, 20 Nov 2026)', () => {
  it('stage: the ink panel is the whole frame, no cream band, him large bottom right', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const [w, h] = aspect === '9:16' ? [1080, 1920] : [1920, 1080]
      for (const cutout of [false, true]) {
        const g = stagingGeometry('stage', aspect, 'seam', true, cutout)
        expect(g.under).toBeUndefined()
        expect(g.panel).toMatchObject({ left: 0, top: 0, width: w, height: h })
        expect(g.take.left + g.take.width).toBe(w)
        expect(g.take.top + g.take.height).toBe(h)
        expect(g.take.radius).toBe(cutout ? 0 : 44)
        expect(g.cutout).toBe(cutout)
      }
    }
    // As a window the region ends above his take; cut out by the matte it reaches down to his head.
    const window = stagingGeometry('stage', '9:16', 'lower', false, false)
    expect(window.region.top + window.region.height).toBeLessThanOrEqual(740 - 24)
    const cut = stagingGeometry('stage', '9:16', 'seam', true, true)
    expect(cut.region.top + cut.region.height).toBe(REGIONS['9:16'].seam.top - 24)
    expect(cut.region.height).toBeGreaterThan(window.region.height)
    // His corner's edge runs below the top of his head (near y 1175 as drawn on his takes), so his head crosses it.
    expect(cut.corner!.top).toBeGreaterThan(1175)
    expect(cut.corner!.left + cut.corner!.width).toBe(1080)
  })

  it('anchor: graphics only above his head, a prop box beside him, nothing on his chest', () => {
    const g = stagingGeometry('anchor', '9:16', 'chin', true)
    expect(g.region).toMatchObject({ left: 60, top: 280, width: 960, height: 220 })
    expect(g.region.top + g.region.height).toBeLessThanOrEqual(512)
    expect(g.props).toEqual([{ left: 40, top: 860, width: 320, height: 252 }])
    expect(REGIONS['9:16'].chin.top).toBeGreaterThan(g.region.top + g.region.height)
  })
})
