import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, orbitState } from './index'
import { ParamsSchema, resolveLogo } from './schema'
import fixture from './fixture.json'

vi.mock('../../../../../../config/logo-registry.json', () => ({ default: {
  marks: ['Meta', 'Google', 'Amazon', 'xAI', 'Anthropic'].map(company => ({
    company, variant: 'full_colour', file: `test-assets/${company}.svg`,
  })),
} }))
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const props = (frame: number, aspect: DeviceProps['aspect'] = '9:16'): DeviceProps => ({
  object, events, frame, tokens, aspect, box: { left: 0, top: 0,
    width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 },
})
const still = (p: DeviceProps) => renderToStaticMarkup(React.createElement(Device, p))
const at = (frame: number, cues = events) => orbitState({ object, events: cues, frame }, 5, 2)
describe('logo_orbit', () => {
  it('draws rings and staggers registry images, never rotating marks', () => {
    expect(still(props(9))).toBe('')
    for (let i = 0; i < 5; i++) {
      expect(at(10 + 3 * i)!.logos.filter(l => l.visible)).toHaveLength(i + 1)
    }
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      for (const frame of fixture.stills) expect(still(props(frame, aspect))).toBe(still(props(frame, aspect)))
      const html = still(props(40, aspect))
      expect((html.match(/<image /g) ?? [])).toHaveLength(5)
      for (const logo of object.params.logos as {id: string}[]) expect(html).toContain(`href="${resolveLogo(logo.id)}"`)
      expect(html).not.toContain('rotate(')
      expect(html).not.toContain('<text')
      expect((html.match(/<circle /g) ?? [])).toHaveLength(3)
      expect(html).toContain('data-centre-slot="buddy"')
      expect(html).not.toBe(still(props(55, aspect)))
    }
  })
  it('supports isolated add cues with no premature logos and no implicit chips', () => {
    const cues = [0, 1, 2].map(i => EngineEventSchema.parse({
      id: `add-${i}`, obj: object.obj, verb: 'add', toState: String(i), atFrame: 20 + i * 30,
    }))
    expect(at(19, cues)).toBeNull()
    expect(at(49, cues)!.logos.map(l => l.visible)).toEqual([true, false, false, false, false])
    expect(at(50, cues)!.logos.map(l => l.visible)).toEqual([true, true, false, false, false])
    expect(at(99, cues)!.logos.map(l => l.visible)).toEqual([true, true, true, false, false])
    expect(at(99, cues)!.chips.every(c => !c.visible)).toBe(true)
  })
  it('flies chips only on cues and lifts the selected mark to 1.1', () => {
    expect(still(props(44))).not.toContain('<text')
    expect(still(props(57))).toContain('No spending')
    expect(still(props(57))).not.toContain('No sending')
    expect(at(65)!.logos.map(l => l.opacity)).toEqual([0.4, 0.4, 1, 0.4, 0.4])
    expect(at(65)!.logos.map(l => l.scale)).toEqual([1, 1, 1.1, 1, 1])
    expect(at(65, [...events].reverse())).toEqual(at(65))
  })
  it('spins out, holds hidden, and resets on reentry', () => {
    expect(at(103)!.out).toBeGreaterThan(0)
    expect(still(props(106))).toBe('')
    const again = [...events, { ...events[0]!, id: 'again', atFrame: 120 }]
    expect(at(120, again)!.logos.filter(l => l.visible)).toHaveLength(1)
    expect(at(150, again)!.logos.every(l => l.opacity === 1)).toBe(true)
    expect(at(150, again)!.chips.every(c => !c.visible)).toBe(true)
  })
  it('refuses invalid registry ids, bounds, and cue indices', () => {
    expect(() => resolveLogo('invented')).toThrow(/Unregistered/)
    for (const patch of [{logos:[]}, {logos:Array(9).fill({id:'Meta'})}, {logos:[{id:'invented'}]},
      {rings:0}, {rings:4}, {chips:Array(7).fill('label')}, {chips:['a'.repeat(25)]}]) {
      expect(ParamsSchema.safeParse({ ...object.params, ...patch }).success).toBe(false)
    }
    for (const verb of ['add', 'chip', 'highlight'] as const) {
      expect(() => at(90, [...events, {id:'bad', obj:object.obj, verb, toState:'8', atFrame:80}])).toThrow(/index/)
    }
    expect(ParamsSchema.safeParse({logos:Array(8).fill({id:'Meta'}),rings:1}).success).toBe(true)
  })
})
