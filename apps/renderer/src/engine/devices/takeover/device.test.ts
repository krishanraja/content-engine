import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { MOTION, setMotionProfile } from '../../clock'
import { EngineBeatSchema, EngineEventSchema, EngineObjectSchema } from '../../props'
import { layoutSlots } from '../../kit/layout'
import { fitBox } from '../../fit'
import { MOTION_PROFILES } from '../../kit/motionProfiles'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { DEVICES } from '../registry'
import manifest from '../../../../../../config/ve/devices.json'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { takeoverState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => takeoverState(object, events, frame)
const html = (frame: number, extra = {}) => renderToStaticMarkup(React.createElement(Device,
  { ...overlayTestProps, object, events, frame, ...extra }))
afterEach(() => setMotionProfile(undefined))

describe('takeover', () => {
  it('registers only enter/exit and supplies a graphics-only STAGE beat', () => {
    expect(DEVICES.takeover).toBe(Device)
    expect(manifest.devices.takeover.verbs).toEqual(['enter', 'exit'])
    expect(EngineBeatSchema.parse(fixture.beats[0])).toMatchObject({ layout: 'STAGE', face: 'off', plate: { source: 'none' } })
    expect(ParamsSchema.safeParse({ lines: [] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ lines: ['AI'], colour: 'red' }).success).toBe(false)
  })

  it('renders exactly three split frames on the entrance cue, then keeps clean type', () => {
    expect(html(9)).toBe('')
    expect([10, 11, 12, 13].map(f => at(f).split)).toEqual([12, -8, 4, 0])
    for (const f of [10, 11, 12]) {
      expect((html(f).match(/data-split=/g) ?? []).length).toBe(2)
      expect(html(f)).toContain('color:coral')
      expect(html(f)).toContain('color:aquamarine')
    }
    for (let f = 13; f < 100; f++) {
      expect(html(f)).not.toContain('data-split')
      expect(html(f)).not.toContain('coral')
    }
    expect(html(40)).toContain('font-family:')
    expect(html(40)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  })

  it('sweeps once, monotonically, after the flicker, without returning on a hold', () => {
    expect(html(12)).not.toContain('data-streak')
    const frames = Array.from({ length: 90 }, (_, i) => i + 10).filter(f => at(f).streakVisible)
    expect(frames).toEqual(Array.from({ length: MOTION.enterFrames }, (_, i) => i + 13))
    const positions = frames.map(f => at(f).streak)
    expect(positions[0]).toBe(0)
    expect(positions.every((p, i) => i === 0 || p > positions[i - 1]!)).toBe(true)
    expect(html(19).match(/data-streak=/g)).toHaveLength(1)
    expect(html(25)).not.toContain('data-streak')
    expect(html(90)).not.toContain('data-streak')
    expect(at(90).push).toBeGreaterThan(at(40).push)
  })

  it('slides out, stays absent, and restarts effects only on an explicit reentry', () => {
    expect(at(100).exit).toBe(0)
    expect(at(103).exit).toBeGreaterThan(0)
    expect(html(103)).toContain('translateX(-')
    expect(html(106)).toBe('')
    expect(html(180)).toBe('')
    expect(html(40, { events: [] })).toBe('')
    const again = [...events, { ...events[0]!, id: 'again', atFrame: 120 }]
    expect(takeoverState(object, again, 120)).toMatchObject({ visible: true, split: 12, streakVisible: false })
    expect(takeoverState(object, again, 123).streakVisible).toBe(true)
    expect(takeoverState(object, [...events].reverse(), 40)).toEqual(at(40))
    expect(takeoverState(object, [...events, { ...events[0]!, obj: 'other', atFrame: 38 }], 40)).toEqual(at(40))
    expect(takeoverState(object, events, 40)).toEqual(at(40))
  })

  it('follows profile timing while keeping the three flicker frames, and prerolls opening entrances', () => {
    setMotionProfile(MOTION_PROFILES['ai-music-slam'])
    const frames = Array.from({ length: 90 }, (_, i) => i + 10).filter(f => at(f).streakVisible)
    expect(frames).toHaveLength(MOTION.enterFrames)
    expect(at(12).split).toBe(4)
    expect(at(13).split).toBe(0)
    const opening = [{ ...events[0]!, atFrame: 0 }]
    expect(takeoverState(object, opening, 0)).toMatchObject({ visible: true, enter: 1, split: 0, streakVisible: false })
  })

  it.each(['9:16', '16:9'] as const)('fills the %s frame but fits the title inside its marked region', aspect => {
    const box = layoutSlots({ mode: 'fill' }, aspect, 'lower', true, 1)![0]!
    const output = html(40, { aspect, box })
    expect(output).toContain(aspect === '9:16' ? 'width:1080px;height:1920px' : 'width:1920px;height:1080px')
    expect(output).toContain('data-region-fit')
    const natural = output.match(/data-title="takeover" style="position:relative;width:([\d.]+)px;height:([\d.]+)px/)
    expect(natural).not.toBeNull()
    const fitted = fitBox({ width: Number(natural![1]), height: Number(natural![2]) }, box)
    expect(fitted.left).toBeGreaterThanOrEqual(box.left)
    expect(fitted.top).toBeGreaterThanOrEqual(box.top)
    expect(fitted.left + fitted.width).toBeLessThanOrEqual(box.left + box.width)
    expect(fitted.top + fitted.height).toBeLessThanOrEqual(box.top + box.height)
  })

  it('refuses unsourced figures and prints the dataset producer beside a sourced figure', () => {
    const numeric = { ...object, params: { lines: ['NO. 2'] } }
    expect(() => html(40, { object: numeric })).toThrow(/dataset/)
    const dataset = { unit: 'rank', denominator: null, producerLabel: 'Official Charts', rows: [{ label: 'rank', value: 2 }] }
    expect(html(40, { object: { ...numeric, dataset } })).toContain('Official Charts')
    expect(() => html(40, { object: { ...numeric, dataset: { ...dataset, rows: [] } } })).toThrow(/dataset/)
  })
})
