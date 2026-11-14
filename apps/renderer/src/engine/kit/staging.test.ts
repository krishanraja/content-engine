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
    expect(stage.take.top).toBeLessThan(stage.panel.height)
    expect(stage.take.top + stage.take.height).toBeGreaterThan(stage.panel.height)
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
