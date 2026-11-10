import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('remotion', async importOriginal => {
  const actual = await importOriginal<typeof import('remotion')>()
  return { ...actual, Img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props) }
})
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { Device } from './index'
import { pageRect, wallState } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.object)
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', mint: 'green', cream: 'ivory', channel: 'coral' }
const at = (frame: number, ev = events) => wallState(object, ev, frame)
const markup = (frame: number, aspect: '9:16' | '16:9' = '16:9', obj = object) => renderToStaticMarkup(React.createElement(Device, {
  object: obj, events, tokens, frame, aspect,
  box: { left: 20, top: 40, width: aspect === '16:9' ? 1920 : 1080, height: aspect === '16:9' ? 1080 : 1920 },
}))
describe('wall screen', () => {
  it('is absent before enter, outside its life and after exit', () => {
    expect(markup(9)).toBe('')
    expect(markup(156)).toBe('')
    expect(markup(180)).toBe('')
    expect(at(10).light).toBe(0)
    expect(at(14).light).toBe(0.5)
    expect(at(18).light).toBe(1)
  })
  it('glides symmetrically for 18 frames and returns to its wall coordinates', () => {
    expect(pageRect(at(30).params.wall, at(30).full)).toEqual({ x: .6, y: .15, w: .3, h: .3, skew: -3 })
    expect(at(39).full).toBeCloseTo(.5)
    expect(at(48).full).toBe(1)
    expect(pageRect(at(48).params.wall, at(48).full)).toEqual({ x: 0, y: 0, w: 1, h: 1, skew: 0 })
    for (let f = 31; f <= 48; f++) expect(at(f).full).toBeGreaterThanOrEqual(at(f - 1).full)
    expect(at(109).full).toBeCloseTo(.5)
    expect(pageRect(at(118).params.wall, at(118).full)).toEqual(pageRect(at(18).params.wall, 0))
  })
  it('draws the highlighter only after mark, then draws the contained underline', () => {
    expect(markup(59)).not.toContain('data-line')
    expect(markup(60)).not.toContain('data-line')
    expect(at(66).highlight).toBeCloseTo(.5)
    expect(at(72).highlight).toBe(1)
    expect(markup(72)).not.toContain('data-underline')
    expect(at(77).underline).toBeCloseTo(.5)
    expect(at(82).underline).toBe(1)
    const html = markup(82)
    expect(html).toContain('left:10%;top:35%;width:75%;height:8%;overflow:hidden')
    expect(html).toContain('stroke-dashoffset="0"')
    expect(html).toContain('background:coral;opacity:0.22')
    // The underline control points plus half its stroke are strictly inside 0..100.
    expect(html).toContain('M 2 87 Q 23 82 47 87 T 98 85')
  })
  it.each(['16:9', '9:16'] as const)('renders fixture stills and full-page provenance in %s', aspect => {
    for (const frame of fixture.stills) {
      const html = markup(frame, aspect)
      if (frame >= 10 && frame < 156) expect(html).toContain('data-device="wall_screen"')
      if (frame >= 48 && frame < 100) {
        expect(html).toContain('left:0%;top:0%;width:100%;height:100%')
        expect(html).toContain('PRODUCER · 2026-11-10')
        expect(html).toContain('MYMU Plex Mono')
        expect(html).toContain('blur(6px)')
      }
      expect(html).not.toMatch(/#[\da-fA-F]{3,8}\b/)
    }
  })
  it('preserves the exact asset and shows an optional logo once without rotating it', () => {
    const html = markup(48, '16:9', { ...object, params: { ...object.params, logo: 'assets/logo.png' } })
    expect(html).toContain('src="assets/real-page.png"')
    expect(html.match(/src="assets\/logo.png"/g)).toHaveLength(1)
    expect(html).not.toContain('rotate(')
  })
  it('is seek-safe, isolates other objects, resets on reentry and interrupts smoothly', () => {
    at(170)
    expect(at(39, [...events].reverse())).toEqual(at(39))
    expect(at(39, [...events, { ...events[0]!, obj: 'other', verb: 'exit', atFrame: 35 }])).toEqual(at(39))
    const interrupt = [...events, { ...events[1]!, id: 'interrupt', toState: 'wall', atFrame: 39 }]
    expect(at(39, interrupt).full).toBeCloseTo(.5)
    expect(at(57, interrupt).full).toBe(0)
    const again = [...events, { ...events[0]!, id: 'again', atFrame: 160 }]
    expect(at(170, again).full).toBe(0)
    expect(at(170, again).highlight).toBe(0)
    expect(at(170, again).visible).toBe(true)
    expect(() => at(40, [...events, { ...events[1]!, toState: 'bad' }])).toThrow('unknown move')
  })
  it('rejects out-of-image lines and out-of-slot wall boxes', () => {
    expect(ParamsSchema.safeParse({ ...object.params, line: { x: .9, y: 0, w: .2, h: .1 } }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, wall: { x: 0, y: 0, w: 0, h: 1 } }).success).toBe(false)
  })
})
