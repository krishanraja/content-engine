import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
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
  it('marks exactly the junk share and drains it over 18 frames, retaining useful heights', () => {
    const marked = at(130), moved = at(158)
    for (let i = 0; i < marked.bars.length; i++) {
      const b = marked.bars[i]!
      expect(b.junk / (b.solid + b.junk)).toBeCloseTo(marked.junkShare, 2)
      expect(moved.bars[i]!.solid).toBe(b.solid)
      expect(moved.bars[i]!.junk).toBe(0)
    }
    expect(at(140).target).toBe(.75)
    expect(at(149).target).toBeGreaterThan(.375)
    expect(moved.target).toBe(.375)
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
        expect(markup).toContain('SYNTHETIC TEST · 2026-11-10')
        expect(markup).toContain('data-device="quota_chart"')
        expect(markup).not.toContain('NaN')
      }
    }
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
