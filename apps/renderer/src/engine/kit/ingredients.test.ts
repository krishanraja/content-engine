import { describe, expect, it } from 'vitest'
import { CAPTION_THEMES } from '../captions/names'
import { REGIONS, band } from '../captions/kit'
import { CAMERAS, ENERGIES, TRANSITIONS, cameraAt, cameraStyle, flashAt, hitFrames, type EngineIngredients } from './ingredients'

/** The ingredients chosen apart from the motion style (Krish, 2026-11-13: "the captions should be decoupled from the
 *  animation styles ... the motion is 10X too slow, not immersive and engaging at all"). docs/ve/INGREDIENTS.md. */

const beats = [{ fromFrame: 0, toFrame: 90 }, { fromFrame: 90, toFrame: 180 }]
const ing = (over: Partial<EngineIngredients> = {}): EngineIngredients => ({ energy: 'high', transition: 'cut', camera: 'none', hits: false, ...over })

describe('ingredients', () => {
  it('draw nothing when every ingredient is off', () => {
    for (let f = 0; f < 180; f += 7) {
      const s = cameraAt(ing(), beats, [], f, 1080)
      expect(cameraStyle(s, 1080, 1920)).toEqual({})
      expect(flashAt(ing(), beats, [], f)).toBe(0)
    }
  })

  it('hand over on the chosen transition, faster as the energy rises, and settle by its end', () => {
    for (const transition of ['whip', 'zoom-through', 'push', 'punch'] as const) {
      const at = (energy: EngineIngredients['energy'], f: number) => cameraAt(ing({ transition, energy }), beats, [], f, 1080)
      const moved = (s: ReturnType<typeof at>) => Math.abs(s.tx) + Math.abs(s.ty) + Math.abs(s.scale - 1) * 1000
      expect(moved(at('high', 90))).toBeGreaterThan(50)
      expect(moved(at('high', 96))).toBeLessThan(0.01)               // high: 6 frames
      expect(moved(at('calm', 96))).toBeGreaterThan(moved(at('high', 96)))
      expect(moved(at('high', 89))).toBeLessThan(0.01)               // nothing before the handover
    }
  })

  it('kick the camera on device events, with a shake only above calm, and never twice inside 3 frames', () => {
    expect(hitFrames([{ atFrame: 30 }, { atFrame: 31 }, { atFrame: 40 }])).toEqual([30, 40])
    const hit = (energy: EngineIngredients['energy'], f: number) => cameraAt(ing({ camera: 'punch', hits: true, energy }), beats, [30], f, 1080)
    expect(hit('high', 30).scale).toBeGreaterThan(hit('high', 29).scale + 0.05)
    expect(hit('calm', 30).scale - hit('calm', 29).scale).toBeLessThan(hit('high', 30).scale - hit('high', 29).scale)
    const drift = (f: number) => cameraAt(ing({ camera: 'punch', hits: true, energy: 'calm' }), beats, [], f, 1080)
    expect(hit('calm', 31).tx).toBeCloseTo(drift(31).tx, 6)          // calm: no shake
    expect(Math.abs(hit('high', 31).tx - drift(31).tx)).toBeGreaterThan(0)
  })

  it('keep headroom under any camera move, so no edge of the picture shows', () => {
    for (const camera of CAMERAS.filter((c) => c !== 'none')) {
      for (let f = 0; f < 180; f += 5) {
        const s = cameraAt(ing({ camera, energy: 'medium' }), beats, [], f, 1080)
        const room = (s.scale - 1) * 540
        expect(Math.abs(s.tx)).toBeLessThanOrEqual(room + 1e-6)
      }
    }
  })

  it('are the same on every render of a frame', () => {
    const a = cameraAt(ing({ camera: 'phased', hits: true, transition: 'whip' }), beats, [40, 100], 101, 1080)
    const b = cameraAt(ing({ camera: 'phased', hits: true, transition: 'whip' }), beats, [40, 100], 101, 1080)
    expect(a).toEqual(b)
  })

  it('name the same choices the spec and compile accept', async () => {
    const { readFileSync } = await import('node:fs')
    const compile = readFileSync('scripts/velib/compile.py', 'utf8')
    const spec = readFileSync('packages/contracts/src/production-spec.ts', 'utf8')
    for (const [list, name] of [[ENERGIES, 'ENERGIES'], [TRANSITIONS, 'TRANSITIONS'], [CAMERAS, 'CAMERAS']] as const) {
      expect(compile).toContain(`${name} = (${list.map((v) => `'${v}'`).join(', ')})`)
      expect(spec).toContain(list.map((v) => `'${v}'`).join(', '))
    }
    expect(spec).toContain(CAPTION_THEMES.map((v) => `'${v}'`).slice(-3).join(', '))
  })
})

describe('caption placement is the captions’ own choice', () => {
  it('defaults to the lower band and moves only when the piece places it', () => {
    expect(band({ aspect: '9:16' })).toEqual(REGIONS['9:16'].lower)
    expect(band({ aspect: '9:16', captionPlacement: 'centre' })).toEqual(REGIONS['9:16'].centre)
    expect(band({ aspect: '16:9', captionPlacement: 'upper' })).toEqual(REGIONS['16:9'].upper)
  })

  it('keeps every tall place inside every channel safe area (top 270, rail x 880 below y 520, bottom 1320)', () => {
    for (const box of Object.values(REGIONS['9:16'])) {
      expect(box.top).toBeGreaterThanOrEqual(270)
      expect(box.top + box.height).toBeLessThanOrEqual(1320)
      if (box.top + box.height > 520) expect(box.left + box.width).toBeLessThanOrEqual(880)
    }
  })
})
