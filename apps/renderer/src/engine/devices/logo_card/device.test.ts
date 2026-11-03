import React from 'react'
import { staticFile } from 'remotion'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, logoCardState } from './index'
import { MARK_BOUNDS } from '../logo_orbit/mark'
import { ParamsSchema, resolveLogo } from './schema'
import fixture from './fixture.json'

// Keep legacy fixture marks and exercise the measured production mark assets.
vi.mock('../../../../../../config/logo-registry.json', () => ({ default: {
  marks: ['OpenAI', 'Anthropic', 'Google', 'Microsoft'].map(company => ({
    company, variant: 'full_colour', file: company === 'Google' ? 'assets/logos/google-symbol.svg' : company === 'Anthropic' ? 'assets/logos/anthropic-symbol.svg' : `test-assets/${company}.svg`,
  })).concat(Object.entries({ Meta: 'meta-logo.svg', Amazon: 'amazon-symbol.svg', Google: 'google-symbol.svg', xAI: 'xai-logo.svg', Anthropic: 'anthropic-symbol.svg' }).map(([company, file]) => ({ company, variant: 'full_colour', file: `assets/logos/${file}` }))),
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
      for (const { id } of object.params.logos as {id: string}[]) expect(html).toContain(`href="${staticFile(resolveLogo(id))}"`)
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

const tileIds = ['Meta', 'Amazon', 'Google', 'xAI', 'Anthropic']
const tiles = (frame: number, aspect: DeviceProps['aspect'] = '9:16', ids = tileIds) => {
  const p = props(frame, aspect)
  p.object = { ...object, params: { tiles: true, logos: ids.map(id => ({ id })) } }
  return renderToStaticMarkup(React.createElement(Device, p))
}
describe('logo_card tiles', () => {
  it('accepts one to six tiles, refuses seven and preserves the legacy limit', () => {
    for (let n = 1; n <= 6; n++) {
      expect(ParamsSchema.safeParse({ tiles: true, logos: Array(n).fill({ id: 'Meta' }) }).success).toBe(true)
    }
    expect(ParamsSchema.safeParse({ tiles: true, logos: Array(7).fill({ id: 'Meta' }) }).success).toBe(false)
    expect(ParamsSchema.safeParse({ logos: tileIds.map(id => ({ id })) }).success).toBe(false)
  })
  it('draws equal tiles in centred rows of three then two in both aspects', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const html = tiles(40, aspect)
      for (const id of tileIds) expect(html).toContain(`href="${staticFile(resolveLogo(id))}"`)
      const sides = [...html.matchAll(/data-tile-side="([^"]+)"/g)].map(m => Number(m[1]))
      expect(sides).toHaveLength(5)
      expect(new Set(sides).size).toBe(1)
      expect([...html.matchAll(/data-row="(\d)"/g)].map(m => Number(m[1]))).toEqual([0, 0, 0, 1, 1])
      const positions = [...html.matchAll(/data-row="\d" opacity="1" transform="translate\(([^ ]+) ([^)]+)\)/g)].map(m => [Number(m[1]), Number(m[2])])
      const width = props(40, aspect).box.width
      expect(positions[0]![0]! + positions[2]![0]!).toBeCloseTo(width)
      expect(positions[3]![0]! + positions[4]![0]!).toBeCloseTo(width)
      expect(positions[3]![1]).toBe(positions[4]![1])
      expect(positions[3]![1]).toBeGreaterThan(positions[0]![1]!)
      expect(positions[1]![0]! - positions[0]![0]!).toBeCloseTo(sides[0]! * 300 / 240)
      expect(html).toContain(`rx="${sides[0]! / 10}" fill="white"`)
    }
  })
  it('fits every painted long side to 140/240 of the tile, cropping Meta to its symbol', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const html = tiles(40, aspect)
      const side = Number(html.match(/data-tile-side="([^"]+)"/)![1])
      const marks = [...html.matchAll(/data-mark="([^"]+)"[^>]*width="([^"]+)" height="([^"]+)" viewBox="([^"]+)"/g)]
      expect(marks).toHaveLength(5)
      for (const mark of marks) {
        const bounds = MARK_BOUNDS[resolveLogo(mark[1]!).split('/').at(-1)!]!
        expect(mark[4]).toBe(bounds.drawn.join(' '))
        const [, , w, h] = bounds.drawn
        const scale = Math.min(Number(mark[2]) / w, Number(mark[3]) / h)
        expect(Math.abs(Math.max(w, h) * scale - side * 140 / 240)).toBeLessThan(1)
      }
      expect(html).toContain('viewBox="999.9949 1000 1504.8278 1000"')
      expect(html).not.toContain('rotate(')
    }
  })
  it('staggers, highlights and exits using the existing motion state', () => {
    expect(tiles(9)).toBe('')
    expect((tiles(13).match(/data-tile-side=/g) ?? []).length).toBe(2)
    expect((tiles(55).match(/scale\(1.08\)/g) ?? []).length).toBe(1)
    expect((tiles(55).match(/opacity="0.4"/g) ?? []).length).toBe(4)
    expect(tiles(103)).toContain(`translate(${-1080 * at(103)!.out} 0)`)
    expect(tiles(106)).toBe('')
  })
  it('keeps the legacy fixture markup unchanged', () => {
    expect(still(40)).toMatchInlineSnapshot(`"<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;left:0;top:0;overflow:hidden"><g transform="translate(0 0)"><g data-cell-width="324" opacity="1" transform="translate(216 844.8) rotate(0) scale(1)"><image href="/test-assets/OpenAI.svg" x="-129.6" y="-403.2" width="259.2" height="806.4" preserveAspectRatio="xMidYMid meet"></image></g><g data-cell-width="324" opacity="1" transform="translate(540 844.8) rotate(0) scale(1)"><image href="/assets/logos/anthropic-symbol.svg" x="-129.6" y="-403.2" width="259.2" height="806.4" preserveAspectRatio="xMidYMid meet"></image></g><g data-cell-width="324" opacity="1" transform="translate(864 844.8) rotate(0) scale(1)"><image href="/assets/logos/google-symbol.svg" x="-129.6" y="-403.2" width="259.2" height="806.4" preserveAspectRatio="xMidYMid meet"></image></g><text x="540" y="1478.4" text-anchor="middle" fill="ivory" font-family="&quot;MYMU Plex Mono&quot;, ui-monospace, monospace" font-size="32" letter-spacing="0.14em">DEC 2025</text></g></svg>"`)
  })
})
