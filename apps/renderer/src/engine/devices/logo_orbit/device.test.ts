import React from 'react'
import { staticFile } from 'remotion'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, orbitState } from './index'
import { ParamsSchema, resolveLogo } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const state = (frame: number, cues = events) => orbitState({ object, events: cues, frame }, 5, 2)
const still = (frame: number, aspect: DeviceProps['aspect'] = '9:16', cues = events) => renderToStaticMarkup(React.createElement(Device, {
  object, events: cues, frame, tokens, aspect, box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 },
}))
describe('logo_orbit', () => {
  it('reveals marks only on their enter stagger or individual add', () => {
    expect(still(9)).toBe('')
    expect(state(12)!.logos.map(l => l.visible)).toEqual([true, false, false, false, false])
    const add = [{ id: 'add', obj: 'orbit', verb: 'add' as const, toState: '3', atFrame: 20 }]
    expect(still(19, '9:16', add)).toBe('')
    expect(state(40, add)!.logos.map(l => l.visible)).toEqual([false, false, false, true, false])
    expect((still(40, '9:16', add).match(/<image /g) ?? []).length).toBe(1)
  })
  it('renders both authored aspects with real registry image hrefs and upright marks throughout motion', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      for (const frame of fixture.stills) {
        const html = still(frame, aspect)
        expect(html).toBe(still(frame, aspect))
        expect(html).not.toContain('rotate(')
      }
      const html = still(52, aspect)
      expect((html.match(/<image /g) ?? []).length).toBe(5)
      for (const logo of fixture.objects[0]!.params.logos) expect(html).toContain(`href="${staticFile(resolveLogo(logo.id))}"`)
      expect(html).toContain('Research')
      expect(html).not.toContain('Draft')
      expect(html).not.toContain('>Meta<')
    }
    expect(still(39)).not.toContain('Research')
  })
  it('highlights one mark, drifts positions, spins out and resets on reentry', () => {
    expect(state(65)!.logos.map(l => l.opacity)).toEqual([0.4, 0.4, 1, 0.4, 0.4])
    expect(state(65)!.logos[2]!.scale).toBe(1.15)
    expect(state(80)!.angle).toBeGreaterThan(state(65)!.angle)
    expect(state(103)!.out).toBeGreaterThan(0)
    expect(still(106)).toBe('')
    const again = [...events, { ...events[0]!, id: 'again', atFrame: 120 }]
    expect(state(155, again)!.logos.map(l => l.opacity)).toEqual([1, 1, 1, 1, 1])
    expect(state(65, [...events].reverse())).toEqual(state(65))
  })
  it('uses 160px rounded tiles, 96px aspect-fitted marks and visible ink rings in both slots', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      const html = still(52, aspect)
      expect((html.match(/data-tile=/g) ?? []).length).toBe(5)
      expect((html.match(/width="160" height="160" rx="28"/g) ?? []).length).toBe(5)
      expect((html.match(/data-mark=/g) ?? []).length).toBe(5)
      expect((html.match(/stroke="gray" stroke-width="6" opacity="0.65"/g) ?? []).length).toBe(3)
      expect(html).toContain('stroke-dasharray="0.018 0.018"')
      expect(html).toContain('feDropShadow')
      expect(html).toContain('font-size="' + (aspect === '9:16' ? 34 : 36) + '"')
      expect(html).toContain('r="5" fill="aqua"')
      expect(still(65, aspect)).toContain('data-highlight="2"')
    }
  })
  it('overshoots on arrival, draws three fading copies and settles without rotation', () => {
    const scales = Array.from({ length: 13 }, (_, age) => state(10 + age)!.logos[0]!.scale)
    expect(Math.max(...scales)).toBeGreaterThanOrEqual(1.12)
    expect(scales[12]).toBe(1)
    expect((still(14).match(/data-trail=/g) ?? []).length).toBe(6)
    expect(still(14)).not.toContain('rotate(')
    expect(still(52)).not.toContain('data-trail=')
  })
  it('refuses unregistered marks, bad counts and invalid event indices', () => {
    for (const params of [{ logos: [] }, { logos: Array(9).fill({ id: 'Meta' }) }, { logos: [{ id: 'invented' }] },
      { ...object.params, rings: 4 }, { ...object.params, chips: Array(7).fill('a') }]) expect(ParamsSchema.safeParse(params).success).toBe(false)
    expect(ParamsSchema.safeParse({ logos: Array(8).fill({ id: 'Meta' }), centre: 'buddy' }).success).toBe(true)
    expect(() => state(80, [...events, { ...events[2]!, toState: '5' }])).toThrow(/index/)
    expect(() => resolveLogo('invented')).toThrow(/Unregistered/)
  })
})

// Pixel checks use the real approved SVGs, including their transparent padding.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { Mark, MARK_BOUNDS } from './mark'
import { execFileSync } from 'node:child_process'
import houseProps from '../../../../../../docs/plans/2026-10-28-ve-format-h-proof/ve/props.proof-tall.json'
const probe = (svg: string, points: number[][] = []) => {
  const embedded = svg.replace(/href="\/?(assets\/logos\/[^\"]+)"/g, (_, path: string) =>
    `href="data:image/svg+xml;base64,${readFileSync(path).toString('base64')}"`)
  const result = spawnSync('python3', ['apps/renderer/src/engine/devices/logo_orbit/raster.py', ...points.map(p => p.join(','))], { input: embedded, encoding: 'utf8', timeout: 20000, env: { ...process.env, OMP_NUM_THREADS: '1' } })
  expect(result.status, result.stderr).toBe(0)
  return JSON.parse(result.stdout) as { bbox: number[]; pixels: number[][] }
}
const hasRsvg = (() => { try { execFileSync('python3', ['-c', "import ctypes.util,sys; sys.exit(0 if ctypes.util.find_library('rsvg-2') else 1)"], { stdio: 'ignore' }); return true } catch { return false } })()
const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0)

describe('logo_orbit pixel regressions', () => {
  it("fits every mark's measured drawn box to 96px on its long side, Meta's infinity included", () => {
    for (const { id } of fixture.objects[0]!.params.logos) {
      const [, , w, h] = MARK_BOUNDS[resolveLogo(id).split('/').at(-1)!]!.drawn
      const k = 96 / Math.max(w, h)
      expect(Math.max(w * k, h * k), id).toBeCloseTo(96, 5)
      if (id === 'Meta') expect(w / h).toBeCloseTo(1.5, 1)
    }
  })
  // The measured bounds are checked against the real logo files by rasterising them. That needs the system's librsvg,
  // which the Linux machines (and Ubuntu CI) have and Windows does not; the portable fit check above runs everywhere.
  it.runIf(hasRsvg)('measured bounds match the painted pixels of each approved logo file', () => {
    for (const { id } of fixture.objects[0]!.params.logos) {
      const markup = renderToStaticMarkup(React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 160, height: 160 }, React.createElement('g', { transform: 'translate(80 80)' }, React.createElement(Mark, { id, size: 96 }))))
      const { bbox } = probe(markup)
      const long = Math.max(bbox[2]! - bbox[0]!, bbox[3]! - bbox[1]!)
      expect(long, id).toBeGreaterThanOrEqual(96 * 0.9)
      expect(long, id).toBeLessThanOrEqual(96 * 1.1)
      if (id === 'Meta') expect((bbox[2]! - bbox[0]!) / (bbox[3]! - bbox[1]!)).toBeCloseTo(1.5, 1)
    }
  })
  it('holds all rings fully drawn on every frame until exit in both aspects', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      for (let frame = 22; frame < 100; frame++) {
        const html = still(frame, aspect)
        expect(state(frame)!.ring).toBe(1)
        expect(html).not.toContain('<mask')
        expect((html.match(/data-ring=/g) ?? []).length).toBe(3)
      }
    }
  })
  it('draws each ring above 1.6:1 contrast on the house cream in both aspects', () => {
    // The house tokens a real ve render passes (the format H proof's props).
    const t = houseProps.tokens
    const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      const markup = renderToStaticMarkup(React.createElement(Device, { object, events, frame: 52, tokens: t, aspect,
        box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } }))
      const rings = [...markup.matchAll(/<circle[^>]*data-ring="(\d)"[^>]*>/g)]
      expect(rings.length, aspect).toBe(3)
      for (const [tag, n] of rings) {
        const stroke = /stroke="([^"]+)"/.exec(tag)![1]!, alpha = Number(/opacity="([^"]+)"/.exec(tag)?.[1] ?? 1)
        const width = Number(/stroke-width="([^"]+)"/.exec(tag)![1])
        expect(width, `${aspect} ring ${n} width`).toBeGreaterThanOrEqual(6)
        const ground = rgb(t.cream), ink = rgb(stroke)
        const seen = ground.map((g, i) => g + (ink[i]! - g) * alpha)
        expect((luminance(ground) + 0.05) / (luminance(seen) + 0.05), `${aspect} ring ${n}`).toBeGreaterThanOrEqual(1.6)
      }
    }
  })
})
