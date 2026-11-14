import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('remotion', async importOriginal => {
  const actual = await importOriginal<typeof import('remotion')>()
  return { ...actual,
    Img: (p: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', p),
    Sequence: ({ from, children }: { from: number; children: React.ReactNode }) => React.createElement('div', { 'data-sequence-from': from }, children),
    OffthreadVideo: ({ src, muted, trimBefore }: { src: string; muted: boolean; trimBefore: number }) =>
      React.createElement('video', { src, muted, 'data-trim': trimBefore }),
  }
})
import { MOTION, setMotionProfile } from '../../clock'
import { resolveMotion } from '../../kit/motionProfiles'
import { markRegion, MAX_GROW } from '../../kit/layout'
import { DEVICES } from '../registry'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { EngineEvent } from '../../props'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { videoWallState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }
const state = (frame: number, ev = events, obj = object) => videoWallState(obj, ev, frame)
const markup = (frame: number, aspect: '9:16' | '16:9' = '9:16', obj = object, region = false) => {
  const box = { left: 60, top: 280, width: 800, height: 676 }
  return renderToStaticMarkup(React.createElement(Device, { object: obj, events, frame, aspect, tokens,
    box: region ? markRegion(box) : box }))
}
afterEach(() => setMotionProfile(undefined))
describe('video_wall', () => {
  it('registers the device and validates the fixture, clip limits and placement rules', () => {
    expect(DEVICES.video_wall).toBe(Device)
    expect(ParamsSchema.safeParse(object.params).success).toBe(true)
    const p = ParamsSchema.parse(object.params)
    expect(ParamsSchema.safeParse({ ...p, intervalFrames: 5 }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...p, clips: [...p.clips, p.clips[0]] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...p, clips: [p.clips[0], p.clips[0]] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...p, mode: 'placed' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ clips: [{ ...p.clips[0], tilt: 0 }] }).success).toBe(false)
  })
  it.each([6, 7])('reveals one tile every %i frames, including a frame-zero opening', intervalFrames => {
    for (const atFrame of [0, 10]) {
      const obj = { ...object, params: { ...object.params, intervalFrames } }
      const ev = [{ ...events[0]!, atFrame }]
      for (let i = 0; i < 6; i++) {
        const cue = atFrame + i * intervalFrames
        expect(state(cue - 1, ev, obj).tiles.filter(t => t.visible)).toHaveLength(i)
        expect(state(cue, ev, obj).tiles.filter(t => t.visible)).toHaveLength(i + 1)
        expect(state(cue, ev, obj).tiles[i]!.slam).toBe(0)
      }
    }
  })
  it('dims only on its cue and holds at one third, independent of adds', () => {
    expect(state(69).opacity).toBe(1)
    expect(state(70).opacity).toBe(1)
    expect(state(70 + MOTION.exitFrames / 2).opacity).toBeCloseTo(2 / 3)
    expect(state(70 + MOTION.exitFrames).opacity).toBeCloseTo(1 / 3)
    expect(state(150).opacity).toBeCloseTo(1 / 3)
    expect(markup(90)).toContain('opacity:0.33333333333333337')
    expect(state(90, [...events, { ...events[0]!, id: 'add', verb: 'add', toState: 'clip6', atFrame: 85 }]).opacity).toBeCloseTo(1 / 3)
  })
  it('places named clips only on enter/add and preserves media paths and trims', () => {
    const p = ParamsSchema.parse(object.params)
    const placed = { ...object, params: { mode: 'placed', clips: p.clips.slice(0, 2).map(c => ({ ...c, kind: 'video', trimBeforeFrames: 42,
      placement: { x: .1, y: .1, w: .4, h: .4 } })) } }
    const ev: EngineEvent[] = [{ ...events[0]!, toState: 'clip1' },
      { ...events[0]!, id: 'add', verb: 'add', toState: 'clip2', atFrame: 30 }]
    expect(state(29, ev, placed).tiles.filter(t => t.visible)).toHaveLength(1)
    expect(state(30, ev, placed).tiles[1]).toMatchObject({ start: 30, visible: true, slam: 0 })
    const html = renderToStaticMarkup(React.createElement(Device, { object: placed, events: ev, frame: 45, aspect: '16:9', tokens,
      box: { left: 0, top: 0, width: 1440, height: 720 } }))
    expect(html).toContain('data-sequence-from="30"')
    expect(html).toContain('data-trim="42"')
    expect(html).toContain('muted=""')
    expect(html).toContain('src="assets/proof-2.jpg"')
    expect(() => state(30, [{ ...events[0]!, toState: 'missing' }], placed)).toThrow('unknown clip')
  })
  it('is seek-safe, ignores other objects, resets on reentry and obeys object lifetime', () => {
    state(170)
    expect(state(32, [...events].reverse())).toEqual(state(32))
    expect(state(32, [...events, { ...events[1]!, obj: 'other', atFrame: 20 }])).toEqual(state(32))
    const ev = [...events, { ...events[0]!, id: 'again', atFrame: 100 }]
    expect(state(100, ev).tiles.filter(t => t.visible)).toHaveLength(1)
    expect(state(100, ev).opacity).toBe(1)
    expect(markup(9)).toBe('')
    expect(markup(180)).toBe('')
  })
  it.each(['9:16', '16:9'] as const)('draws tilted, bordered fixture stills and uses region growth in %s', aspect => {
    for (const f of fixture.stills) {
      const html = markup(f, aspect)
      expect(html).not.toMatch(/#[\da-fA-F]{3,8}\b/)
      expect(html).not.toContain('coral')
      if (f >= 10) expect(html).toContain('data-device="video_wall"')
    }
    const html = markup(65, aspect, object, true)
    expect(html).toContain('data-region-fit')
    expect(html.match(/data-tile=/g)).toHaveLength(6)
    expect(html).toContain('rotate(-3deg)')
    expect(html).toContain('border:6px solid ivory')
    expect(html).toContain('box-shadow:8px 10px 0 black')
    expect(html).toContain('SOURCE A')
    expect(state(110).push).toBeGreaterThan(state(65).push)
  })
  it('slams using the chosen profile and settles with a 2 to 4 degree tilt', () => {
    setMotionProfile(resolveMotion({ style: 'ai-music-slam' }))
    const samples = Array.from({ length: MOTION.enterFrames + 1 }, (_, i) => state(10 + i).tiles[0]!.slam)
    expect(Math.max(...samples)).toBeGreaterThan(1)
    expect(Math.max(...samples)).toBeLessThanOrEqual(1.12)
    expect(samples.at(-1)).toBe(1)
    const p = ParamsSchema.parse(object.params)
    expect(p.clips.every(c => Math.abs(c.tilt) >= 2 && Math.abs(c.tilt) <= 4)).toBe(true)
  })
})


describe('region fit bounds', () => {
  it.each(['9:16', '16:9'] as const)('grows and centres the rendered %s device inside its region at every fixture frame', aspect => {
    const box = markRegion({ left: 72, top: 96, width: 2400, height: 2200 })
    let drawn = 0
    for (let frame = object.fromFrame; frame < object.toFrame; frame++) {
      const markup = renderToStaticMarkup(Device({ object, events, box, tokens: tokens, aspect, frame }))
      if (!markup) continue
      const wrapper = markup.match(/data-region-fit="" style="([^"]+)"/)
      expect(wrapper, `frame ${frame}`).not.toBeNull()
      const css = wrapper![1]!
      const px = (key: string) => Number(css.match(new RegExp(`(?:^|;)${key}:([\\d.e+-]+)px`))![1])
      const scale = Number(css.match(/transform:scale\(([^)]+)\)/)![1])
      const width = px('width') * scale, height = px('height') * scale
      expect(scale).toBeGreaterThan(1)
      expect(scale).toBeLessThanOrEqual(MAX_GROW)
      expect(px('left')).toBeGreaterThanOrEqual(box.left - 1e-8)
      expect(px('top')).toBeGreaterThanOrEqual(box.top - 1e-8)
      expect(px('left') + width).toBeLessThanOrEqual(box.left + box.width + 1e-8)
      expect(px('top') + height).toBeLessThanOrEqual(box.top + box.height + 1e-8)
      expect(px('left') + width / 2).toBeCloseTo(box.left + box.width / 2)
      expect(px('top') + height / 2).toBeCloseTo(box.top + box.height / 2)
      // It fills one dimension unless the shared growth ceiling is reached.
      expect(Math.min(Math.abs(width - box.width), Math.abs(height - box.height), Math.abs(scale - MAX_GROW))).toBeLessThan(1e-8)
      drawn++
    }
    expect(drawn).toBeGreaterThan(0)
  })
})
