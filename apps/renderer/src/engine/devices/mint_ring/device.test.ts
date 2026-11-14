import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { MOTION } from '../../clock'
import { regionSlots } from '../../kit/layout'
import { SCRIBBLE } from '../../kit/lock'
import type { Box, DeviceProps } from '../types'
import { Device } from './index'
import { DRAW_FRAMES, mintRingState, ringGeometry } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }
const at = (frame: number) => mintRingState(object, events, frame)
const markup = (frame: number, aspect: DeviceProps['aspect'] = '9:16', box: Box = { left: 60, top: 280, width: 800, height: 676 }) =>
  renderToStaticMarkup(React.createElement(Device, { object, events, tokens, frame, aspect, box }))

// Ray casting tests the actual rendered polygon, rather than just its bounding rectangle.
function contains(points: { x: number; y: number }[], x: number, y: number) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

describe('mint_ring', () => {
  it('draws over eight frames, overshoots the endpoint slightly and holds without restarting', () => {
    expect(DRAW_FRAMES).toBe(8)
    expect(markup(9)).toBe('')
    expect(markup(10)).toBe('')
    const lengths = Array.from({ length: 9 }, (_, i) => at(10 + i).drawn * 2 * at(18).geometry.loopLength)
    const circumference = at(18).geometry.loopLength
    expect(lengths[0]).toBe(0)
    expect(lengths[1]).toBeGreaterThan(0)
    expect(lengths[2]).toBeGreaterThan(lengths[1]!)
    expect(Math.max(...lengths)).toBeGreaterThan(lengths[8]!)
    expect(Math.max(...lengths)).toBeLessThan(circumference * 1.08)
    expect(lengths[8]).toBeCloseTo(circumference * 1.03)
    expect(at(19).drawn).toBe(at(59).drawn)
  })

  it('encloses all four target corners, with clearance for its ink keyline', () => {
    for (const w of [1, 100, 800]) for (const h of [1, 100, 800]) for (const obj of ['a', 'other', 'chart-value-ring']) {
      const target = { x: 20, y: 30, w, h }
      const g = ringGeometry({ ...object, obj, params: { at: target } })
      const loop = g.points.slice(0, 256)
      const clearance = SCRIBBLE.keyline_px / 2
      for (const x of [target.x - clearance, target.x + w + clearance])
        for (const y of [target.y - clearance, target.y + h + clearance]) expect(contains(loop, x, y)).toBe(true)
    }
  })

  it('seeds the hand from object id and keeps geometry stable across frames and seeks', () => {
    expect(at(59).geometry).toEqual(at(12).geometry)
    expect(ringGeometry({ ...object, obj: 'another-ring' }).d).not.toBe(at(18).geometry.d)
    expect(mintRingState(object, [...events].reverse(), 62)).toEqual(at(62))
    expect(mintRingState(object, [...events, { ...events[1]!, obj: 'unrelated' }], 20)).toEqual(at(20))
    expect(markup(9)).toBe('')
  })

  it('fades on exit, freezes an interrupted pen, and supports an explicit redraw', () => {
    expect(at(60).opacity).toBe(1)
    expect(at(63).opacity).toBeGreaterThan(0)
    expect(at(63).opacity).toBeLessThan(1)
    expect(markup(60 + MOTION.exitFrames)).toBe('')
    expect(markup(120)).toBe('')
    const early = [events[0]!, { ...events[1]!, atFrame: 12 }]
    expect(mintRingState(object, early, 15).drawn).toBe(at(12).drawn)
    const redraw = [...events, { ...events[0]!, id: 'redraw', atFrame: 80 }]
    expect(mintRingState(object, redraw, 80).drawn).toBe(0)
    expect(mintRingState(object, redraw, 88).drawn).toBe(at(18).drawn)
  })

  it('renders fixture stills in both aspects using only supplied ink and mint', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const html = markup(18, aspect)
      expect(html.match(/<path /g)).toHaveLength(2)
      expect(html).toContain('stroke="green"')
      expect(html).toContain('stroke="black"')
      expect(html).toContain(`stroke-width="${SCRIBBLE.stroke_px}"`)
      expect(html).toContain('left:60px;top:280px')
      expect(html).not.toMatch(/#|NaN|coral/)
      const region = regionSlots({ left: 60, top: 280, width: 800, height: 676 }, 1)[0]!
      expect(markup(18, aspect, region)).toContain('data-region-fit=""')
      expect(html).not.toContain('data-region-fit')
    }
  })

  it('rejects malformed target boxes and extra styling parameters', () => {
    expect(ParamsSchema.safeParse({ at: { x: 0, y: 0, w: 0, h: 10 } }).success).toBe(false)
    expect(ParamsSchema.safeParse({ at: { x: Infinity, y: 0, w: 10, h: 10 } }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, colour: 'channel' }).success).toBe(false)
    expect(ParamsSchema.safeParse({}).success).toBe(false)
  })
})
