import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, orbitState } from './index'
import { ParamsSchema, resolveLogo } from './schema'
import fixture from './fixture.json'
vi.mock('../../../../../../config/logo-registry.json', () => ({ default: { marks:
  ['Meta', 'Google', 'Amazon', 'xAI', 'Anthropic'].map(company => ({ company, variant: 'full_colour', file: `test-assets/${company}.svg` })) } }))
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
      for (const logo of fixture.objects[0]!.params.logos) expect(html).toContain(`href="${resolveLogo(logo.id)}"`)
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
  it('uses 160px rounded tiles, 96px aspect-fitted marks and stronger mint rings in both slots', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      const html = still(52, aspect)
      expect((html.match(/data-tile=/g) ?? []).length).toBe(5)
      expect((html.match(/width="160" height="160" rx="28"/g) ?? []).length).toBe(5)
      expect((html.match(/width="96" height="96" preserveAspectRatio="xMidYMid meet"/g) ?? []).length).toBe(5)
      expect((html.match(/stroke="aqua" stroke-width="5" opacity="0.5"/g) ?? []).length).toBe(3)
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
