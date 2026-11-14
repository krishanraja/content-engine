import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { markRegion } from '../../kit/layout'
import { stagingGeometry } from '../../kit/staging'
import type { DeviceProps } from '../types'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { burstFor, SLAM, slamWordState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aquamarine', channel: 'coral' }
const at = (frame: number) => slamWordState(object, events, frame)
const props = (frame: number, aspect: DeviceProps['aspect'] = '9:16'): DeviceProps => ({ object, events, frame, tokens, aspect,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } })
const still = (frame: number, aspect: DeviceProps['aspect'] = '9:16') => renderToStaticMarkup(React.createElement(Device, props(frame, aspect)))

describe('slam_word', () => {
  it('lands at exactly three frames with no undershoot or bounce', () => {
    expect(still(9)).toBe('')
    expect(at(10).scale).toBe(2.5)
    expect(at(11).scale).toBe(2)
    expect(at(12).scale).toBe(1.5)
    expect(at(13).scale).toBe(1)
    expect(at(40).scale).toBe(1)
    expect(still(10)).toContain('transform:scale(2.5)')
    expect(still(13)).toContain('transform:scale(1)')
  })
  it('fires one seeded burst on landing, never before, and retires it', () => {
    expect(at(12).burstVisible).toBe(false)
    expect(at(13)).toMatchObject({ burstVisible: true, burst: 0 })
    expect((still(13).match(/data-slip=/g) ?? [])).toHaveLength(SLAM.slips)
    expect(at(20).burst).toBeGreaterThan(0)
    expect(at(37).burstVisible).toBe(false)
    expect(still(37)).not.toContain('data-slip=')
    expect(burstFor(object.obj)).toEqual(burstFor(object.obj))
    expect(burstFor('different')).not.toEqual(burstFor(object.obj))
    expect(new Set(burstFor(object.obj).map(s => s.tone))).toEqual(new Set(['mint', 'cream', 'channel']))
  })
  it('drifts two mono series-colour tapes in opposing directions without looping', () => {
    expect(at(10).tapeDrift).toBe(0)
    expect(at(40).tapeDrift).toBeGreaterThan(at(20).tapeDrift)
    const html = still(40)
    expect((html.match(/data-caution-tape=/g) ?? [])).toHaveLength(2)
    expect(html).toContain('background:coral')
    expect(html).toContain(`data-tape-drift="${at(40).tapeDrift}"`)
    expect(html).toContain(`data-tape-drift="${-at(40).tapeDrift}"`)
    expect(still(40)).not.toBe(still(20))
  })
  it('fades the entire device to 30% and holds it until the cut', () => {
    expect(at(80).opacity).toBe(1)
    expect(at(84).opacity).toBeCloseTo(0.65)
    expect(at(88)).toMatchObject({ opacity: 0.3, visible: true })
    expect(still(99)).toContain('opacity:0.3')
    expect(still(100)).toBe('')
  })
  it('ignores other objects, event order and render order; a new enter resets the fade', () => {
    at(99)
    expect(slamWordState(object, [...events].reverse(), 20)).toEqual(at(20))
    expect(slamWordState(object, [...events, { ...events[0]!, obj: 'unrelated', atFrame: 15 }], 20)).toEqual(at(20))
    const again = { ...events[0]!, id: 'again', atFrame: 90 }
    expect(slamWordState(object, [...events, again], 90)).toMatchObject({ scale: 2.5, opacity: 1 })
    expect(slamWordState(object, [], 20).visible).toBe(false)
    const opening = [{ ...events[0]!, atFrame: 0 }]
    expect(slamWordState(object, opening, 0)).toMatchObject({ scale: 1, burstVisible: false })
  })
  it.each(['9:16', '16:9'] as const)('renders authored %s geometry and fits a staging region', aspect => {
    const p = props(20, aspect)
    p.box = markRegion(stagingGeometry('band', aspect, 'lower', true).region)
    const html = renderToStaticMarkup(React.createElement(Device, p))
    expect(html).toContain('data-region-fit=""')
    expect(html).toContain(aspect === '9:16' ? 'width:800px;height:480px' : 'width:1200px;height:440px')
    expect(html).toContain('EXPOSED')
    expect(html).toBe(renderToStaticMarkup(React.createElement(Device, p)))
  })
  it('rejects sentences, quantities and unknown parameters', () => {
    for (const word of ['two words', '', '250%', '123']) expect(ParamsSchema.safeParse({ word }).success).toBe(false)
    expect(ParamsSchema.safeParse({ word: 'EXPOSED', seed: 1 }).success).toBe(false)
  })
})
