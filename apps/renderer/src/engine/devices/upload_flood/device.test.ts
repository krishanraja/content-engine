import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, floodState, gridGeometry, tileHash } from './index'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const props = (frame: number): DeviceProps => ({ object, events, frame, tokens, aspect: '16:9', box: fixture.boxes[1]! })
const html = (p: DeviceProps) => renderToStaticMarkup(React.createElement(Device, p))
describe('upload_flood', () => {
  it('waits for cues, pours exactly the declared population and preserves AI count', () => {
    expect(html(props(4))).toBe('')
    expect(html(props(19))).not.toContain('data-tile=')
    const halfway = (html(props(28)).match(/data-tile=/g) ?? []).length
    expect(halfway).toBeGreaterThan(0)
    expect(halfway).toBeLessThan(300)
    const full = html(props(56))
    expect(full.match(/data-tile=/g)).toHaveLength(300)
    expect(full.match(/data-ai="true"/g)).toHaveLength(Array.from({ length: 300 }, (_, i) => i).filter(i => tileHash(i) < .5).length)
    expect(html(props(186))).toBe('')
    expect(floodState({ ...props(200), events: [...events, { ...events[0]!, atFrame: 190 }] })!.fillAge).toBe(-1)
  })
  it('reads numbers from dataset, with provenance and conditional plus', () => {
    expect(html(props(76))).toContain('50%+')
    expect(html(props(76))).toContain('Deezer, July 2026')
    const p = props(76)
    p.object = { ...object, params: { ...object.params, aiShare: .9 } }
    expect(() => floodState(p)).toThrow(/disagrees/)
    p.object = { ...object, dataset: { ...object.dataset!, rows: [{ label: 'aiShare', value: .33 }, { label: 'listensShare', value: .02 }] } }
    expect(html(p)).toContain('33%')
    expect(html(p)).not.toContain('33%+')
  })
  it('stops meter at the dataset fraction and flickers once per AI tile', () => {
    const g = gridGeometry(300, 1920, 1080, false)
    expect(html(props(110))).toContain(`data-meter-width="${g.w * .02}"`)
    expect(floodState(props(110))!.meter).toBe(.02)
    expect(floodState(props(119))!.meter).toBe(.02)
    expect(html(props(85))).toContain('data-play="on"')
    expect(html(props(110))).not.toContain('data-play="on"')
  })
  it('types two characters per frame and lands one mint answer', () => {
    expect(floodState(props(124))!.query).toBe('what is ')
    expect(html(props(144))).not.toContain('data-result')
    const landed = html(props(164))
    expect(landed).toContain('opacity="0.4"')
    expect(landed.match(/data-result/g)).toHaveLength(1)
    expect(landed).toContain('Movin’ To The Sun')
    expect(landed).toContain('fill="aqua"')
    expect(landed.match(/data-tile=/g)).toHaveLength(299)
  })
  it('scatters AI songs, fills the width, and uses a mint listens fill on cream', () => {
    const first = Array.from({ length: 40 }, (_, i) => tileHash(i) < .5)
    expect(first).toContain(true)
    expect(first).toContain(false)
    expect(first.slice(1).filter((v, i) => v !== first[i]).length).toBeGreaterThan(8)
    for (const box of fixture.boxes) {
      const g = gridGeometry(box.height > box.width ? 360 : 300, box.width, box.height, box.height > box.width)
      expect(g.w).toBeGreaterThanOrEqual(box.width * .8)
      expect(g.tile(0).w).toBe(g.tile(0).h)
    }
    const markup = html(props(110))
    expect(markup).toMatch(/data-meter-track="true"[^>]*fill="ivory"/)
    expect(markup).toMatch(/data-meter-width="[^"]+"[^>]*fill="aqua"/)
    expect(html({ ...props(76), aspect: '9:16', box: fixture.boxes[0]! }).match(/data-tile=/g)).toHaveLength(360)
    expect(html(props(164))).toContain('Imael Angel')
    expect(markup).toContain('1-3% of listens')
  })
  it('renders named goldens in tall, full wide and face-column slots; clips motion to box', () => {
    expect(Object.values(fixture.goldenFrames)).toEqual(fixture.stills)
    for (const box of fixture.boxes) for (const frame of fixture.stills) {
      const p = { ...props(frame), box, aspect: (box.height > box.width ? '9:16' : '16:9') as DeviceProps['aspect'] }
      const markup = html(p)
      expect(markup).toContain('overflow:hidden')
      expect(markup).toContain('clip-path=')
      expect(markup).toContain('patternTransform="rotate(45)"')
      expect(markup).toContain('width="6" height="6"')
      expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      const g = gridGeometry(300, box.width, box.height, p.aspect === '9:16')
      for (let i = 0; i < 200; i++) {
        const t = g.tile(i)
        expect(t.x).toBeGreaterThanOrEqual(0)
        expect(t.y).toBeGreaterThanOrEqual(0)
        expect(t.x + t.w).toBeLessThanOrEqual(box.width)
        expect(t.y + t.h).toBeLessThanOrEqual(box.height)
      }
    }
  })
})
