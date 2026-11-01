import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, logoCardState } from './index'
import { ParamsSchema, resolveLogo } from './schema'
import fixture from './fixture.json'

// Production registry is empty. These entries exercise resolution without
// registering invented artwork or bypassing the production refusal.
vi.mock('../../../../../../config/logo-registry.json', () => ({ default: {
  marks: ['OpenAI', 'Anthropic', 'Google', 'Microsoft'].map(company => ({
    company, variant: 'full_colour', file: `test-assets/${company}.svg`,
  })),
} }))
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => logoCardState({ object, events, frame }, 3)
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const props = (frame: number, aspect: DeviceProps['aspect']): DeviceProps => ({ object, events, frame, tokens, aspect,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } })
const still = (frame: number, aspect: DeviceProps['aspect'] = '9:16') => renderToStaticMarkup(React.createElement(Device, props(frame, aspect)))
describe('logo_card', () => {
  it('enters on stagger cues and settles twelve frames after each cue', () => {
    expect(still(9)).toBe('')
    for (let i = 0; i < 3; i++) {
      const cue = 10 + 3 * i
      if (i) expect(at(cue - 1)!.logos[i]!.visible).toBe(false)
      expect(at(cue)!.logos[i]).toMatchObject({ visible: true, scale: 0.35, rotation: -6, opacity: 0 })
      expect(at(cue + 12)!.logos[i]).toMatchObject({ scale: 1, rotation: 0, opacity: 1 })
    }
  })
  it('renders registry image hrefs in equal cells in both aspects at fixture frames', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      for (const frame of fixture.stills) expect(still(frame, aspect)).toBe(still(frame, aspect))
      const html = still(40, aspect)
      expect((html.match(/<image /g) ?? []).length).toBe(3)
      for (const { id } of object.params.logos as {id: string}[]) expect(html).toContain(`href="${resolveLogo(id)}"`)
      const cells = [...html.matchAll(/data-cell-width="([^"]+)"/g)].map(m => m[1])
      expect(cells).toHaveLength(3)
      expect(new Set(cells).size).toBe(1)
      expect((html.match(/rotate\(0\)/g) ?? []).length).toBe(3)
    }
  })
  it('types the label only after the last mark settles', () => {
    expect(at(28)!.labelProgress).toBe(0)
    expect(still(28)).not.toContain('<text')
    expect(still(40)).toContain('DEC 2025')
  })
  it('lifts only the highlighted logo and dims the rest', () => {
    expect(at(55)!.logos.map(l => l.opacity)).toEqual([0.4, 1, 0.4])
    expect(at(55)!.logos.map(l => l.scale)).toEqual([1, 1.08, 1])
    expect(at(55)!.logos.map(l => l.rotation)).toEqual([0, 0, 0])
    expect(() => logoCardState({ object, events: [...events, { ...events[1]!, toState: '3' }], frame: 55 }, 3)).toThrow(/index/)
  })
  it('slides out together, holds hidden, and resets on reentry', () => {
    expect(at(103)!.out).toBeGreaterThan(0)
    expect(still(106)).toBe('')
    const again = [...events, { ...events[0]!, id: 'again', atFrame: 120 }]
    expect(logoCardState({ object, events: again, frame: 150 }, 3)!.logos.map(l => l.opacity)).toEqual([1, 1, 1])
    expect(logoCardState({ object, events: [...events].reverse(), frame: 55 }, 3)).toEqual(at(55))
  })
  it('accepts one through four marks and refuses unknown or missing assets', () => {
    for (const logos of [[], Array(5).fill({ id: 'OpenAI' }), [{ id: 'invented' }]]) {
      expect(ParamsSchema.safeParse({ logos }).success).toBe(false)
    }
    for (const ids of [['OpenAI'], ['OpenAI', 'Anthropic', 'Google', 'Microsoft']]) {
      const p = props(40, '16:9')
      p.object = { ...object, params: { logos: ids.map(id => ({ id })) } }
      expect((renderToStaticMarkup(React.createElement(Device, p)).match(/<image /g) ?? []).length).toBe(ids.length)
    }
    expect(() => resolveLogo('invented')).toThrow(/Unregistered/)
  })
})
