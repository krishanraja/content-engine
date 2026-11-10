import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { chartLayout, Device } from './index'
import { quotaState } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (f: number) => quotaState(object, events, f)
const html = (f: number, aspect: '9:16' | '16:9' = '9:16') => renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object, events, frame: f, aspect,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } }))

describe('quota chart', () => {
  it('waits for enter, grows from zero and exits', () => {
    expect(html(9)).toBe('')
    expect(at(29).bars.every(b => b.solid === 0)).toBe(true)
    expect(at(31).bars[6]!.solid).toBeGreaterThan(0)
    expect(at(31).bars[6]!.solid).toBeLessThan(1)
    expect(at(65).bars[6]!.solid).toBe(1)
    expect(Math.floor(at(65).target * 8)).toBe(6)
    expect(html(320)).toBe('')
  })
  it('marks exactly the junk share and drains it with a three-frame stagger, retaining useful heights', () => {
    const marked = at(130), moved = at(180)
    for (let i = 0; i < marked.bars.length; i++) {
      const b = marked.bars[i]!
      expect(b.junk / (b.solid + b.junk)).toBeCloseTo(marked.junkShare, 2)
      expect(moved.bars[i]!.solid).toBe(b.solid)
      expect(moved.bars[i]!.junk).toBe(0)
    }
    expect(at(140).target).toBe(.75)
    expect(at(149).target).toBeGreaterThan(.375)
    expect(at(158).target).toBe(.375)
    expect(Math.floor(moved.bars[6]!.x * 8)).toBe(3)
    expect(moved.bars.every(b => b.x > 0 && b.x < 1)).toBe(true)
  })
  it('reveals sales last and counts to the supplied ratio', () => {
    expect(at(179).sales).toEqual([0, 0])
    expect(at(250).sales[1]! / at(250).sales[0]!).toBeCloseTo(1.07, 4)
    expect(html(250)).toContain('+7%')
  })
  it('renders both aspects and the dated source', () => {
    for (const aspect of ['9:16','16:9'] as const) for (const f of fixture.stills) {
      const markup = html(f, aspect)
      if (markup) {
        expect(markup).toContain('GONG ET AL. · ARXIV 2609.32859')
        expect(markup).toContain('data-device="quota_chart"')
        expect(markup).not.toContain('NaN')
      }
    }
  })
  it('fills both boxes and keeps type phone legible', () => {
    for (const tall of [true, false]) {
      const w = tall ? 1080 : 1920, h = tall ? 1920 : 1080
      const layout = chartLayout(w, h, tall)
      expect(layout.width / w).toBeGreaterThanOrEqual(.8)
      expect(layout.x + layout.width).toBeLessThanOrEqual(w)
      for (const frame of [65, 130, 149, 250]) {
        const markup = html(frame, tall ? '9:16' : '16:9')
        for (const match of markup.matchAll(/font-size="(\d+)"/g)) expect(Number(match[1])).toBeGreaterThanOrEqual(30)
      }
    }
  })
  it('keeps hatch area proportional and removes every hatch after move', () => {
    const marked = at(130)
    const junk = marked.bars.reduce((n, b) => n + b.junk, 0)
    const total = marked.bars.reduce((n, b) => n + b.junk + b.solid, 0)
    expect(Math.abs(junk / total - .31)).toBeLessThan(.02)
    expect(at(143).bars[0]!.junk).toBeLessThan(marked.bars[0]!.junk)
    expect(at(143).bars[2]!.junk).toBe(marked.bars[2]!.junk)
    expect(html(180)).not.toContain('data-junk=')
  })
  it('resets on reentry and ignores unrelated cues and event ordering', () => {
    expect(quotaState(object, [...events].reverse(), 250)).toEqual(at(250))
    expect(quotaState(object, [...events, {...events[0]!, id: 'again', atFrame: 330}], 350).fill).toBe(0)
    expect(quotaState(object, [...events, {...events[4]!, obj:'other', atFrame:50}], 130)).toEqual(at(130))
  })
  it('refuses invalid data and move states', () => {
    expect(ParamsSchema.safeParse({...object.params, junkShare: 2}).success).toBe(false)
    expect(ParamsSchema.safeParse({...object.params, bins: [1,0]}).success).toBe(false)
    expect(() => quotaState(object, [...events, {...events[4]!, id:'bad', toState:'unknown', atFrame:150}], 170)).toThrow('expects half')
  })
})
