import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import manifest from '../../../../../../config/ve/devices.json'
import { MOTION, setMotionProfile } from '../../clock'
import { fitBox, fitScale } from '../../fit'
import { markRegion, MAX_GROW } from '../../kit/layout'
import { resolveMotion } from '../../kit/motionProfiles'
import { EngineBeatSchema, EngineEventSchema, EngineObjectSchema } from '../../props'
import type { Box, DeviceProps } from '../types'
import { DEVICES } from '../registry'
import fixture from './fixture.json'
import { Device, receiptLayout } from './index'
import { ParamsSchema } from './schema'
import { receiptState } from './state'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(event => EngineEventSchema.parse(event))
const at = (frame: number) => receiptState(object, events, frame)
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aquamarine', channel: 'coral' }
const box: Box = { left: 60, top: 280, width: 800, height: 680 }
const props = (frame: number, aspect: DeviceProps['aspect'] = '9:16'): DeviceProps => ({ object, events, frame, aspect, box, tokens })
const still = (frame: number) => renderToStaticMarkup(React.createElement(Device, props(frame)))

afterEach(() => setMotionProfile(undefined))

describe('receipt_print', () => {
  it('registers the device and authors five sourced lines over one beat', () => {
    expect(DEVICES.receipt_print).toBe(Device)
    expect(manifest.devices.receipt_print.verbs).toEqual(['enter', 'add', 'fill', 'highlight', 'count_to', 'stamp', 'exit'])
    expect(EngineBeatSchema.parse(fixture.beats[0]).uses).toEqual([object.obj])
    expect(at(100).lines.filter(line => line.printed)).toHaveLength(5)
    expect(still(100)).toContain(object.dataset!.producerLabel)
  })

  it('rises 250 px without overshoot, tilts and settles once, then holds', () => {
    expect(at(9).visible).toBe(false)
    expect(at(10)).toMatchObject({ visible: true, y: 250, tilt: -3, opacity: 0.4 })
    let previous = 250
    for (let frame = 10; frame <= 20; frame++) {
      expect(at(frame).y).toBeGreaterThanOrEqual(0)
      expect(at(frame).y).toBeLessThanOrEqual(previous)
      previous = at(frame).y
    }
    expect(at(20)).toMatchObject({ y: 0, tilt: -1.5, opacity: 1 })
    expect(at(22).tilt).toBe(-0.5)
    expect(at(25).tilt).toBe(-2)
    expect(at(28).tilt).toBe(-1.5)
    expect(at(140).tilt).toBe(-1.5)
    expect(still(9)).toBe('')
    expect(still(150)).toBe('')
  })

  it('prints precisely one line per cue, with a three-frame jolt and visible doubled ink', () => {
    for (const cue of events.filter(event => event.verb === 'add' || event.verb === 'fill')) {
      const lineAt = (frame: number) => at(frame).lines.find(line => line.key === cue.toState)!
      expect(lineAt(cue.atFrame - 1)).toMatchObject({ printed: false, opacity: 0 })
      expect(lineAt(cue.atFrame)).toMatchObject({ printed: true, opacity: 0.25 })
      expect(lineAt(cue.atFrame + 3).opacity).toBe(1)
      expect([0, 1, 2, 3].map(delta => at(cue.atFrame + delta).jolt)).toEqual([2, -2, 2, 0])
      for (let delta = 0; delta < 3; delta++) {
        const html = still(cue.atFrame + delta)
        expect(html).toContain('data-print-ghost=""')
        expect(html).toContain('transform="translate(2 2)"')
        // Doubled ink sits above the opaque paper, so it can actually be seen.
        expect(html.indexOf('data-print-ghost')).toBeGreaterThan(html.indexOf('data-current-layout'))
      }
      expect(still(cue.atFrame + 3)).not.toContain('data-print-ghost')
    }
    expect(still(29)).not.toContain('data-figure-fill')
    expect(still(30)).toContain('data-figure-fill=""')
    expect(still(30)).toContain('fill="aquamarine"')
    expect(at(54).lines.filter(line => line.printed)).toHaveLength(3)
  })

  it('treats fill and add as the same idempotent print cue, including jolt and ghost', () => {
    const filled = events.map(event => event.verb === 'add' ? { ...event, verb: 'fill' as const } : event)
    for (const frame of [29, 30, 31, 32, 33, 42, 78, 100]) {
      expect(renderToStaticMarkup(React.createElement(Device, { ...props(frame), events: filled }))).toBe(still(frame))
    }
    const duplicate = { ...events[1]!, id: 'fill-again', verb: 'fill' as const, atFrame: 105 }
    expect(receiptState(object, [...events, duplicate], 106)).toEqual(at(106))
  })

  it('counts a sourced total from zero to its target over the house frames with mono type and provenance', () => {
    expect(at(101).total).toBeUndefined()
    expect(still(101)).not.toContain('data-receipt-total')
    expect(at(102).total).toMatchObject({ value: 0, target: 320, figure: '0 USD' })
    expect(at(102 + MOTION.countFrames / 2).total!.value).toBe(160)
    let previous = 0
    for (let frame = 102; frame <= 102 + MOTION.countFrames; frame++) {
      const state = at(frame)
      expect(state.total!.value).toBeGreaterThanOrEqual(previous)
      expect(state.total!.value).toBeLessThanOrEqual(320)
      previous = state.total!.value
      const html = still(frame)
      expect(html).toContain('data-receipt-total=""')
      expect(html).toContain(state.producerLabel)
      expect(html).toContain('MYMU Plex Mono')
      expect(receiptLayout(state, '9:16')).toEqual(receiptLayout(at(101), '9:16'))
    }
    expect(at(120).total!.figure).toBe('320 USD')
    const divided = { ...object, dataset: { ...object.dataset!, denominator: 500 } }
    expect(receiptState(divided, events, 120).total!.figure).toBe('320/500 USD')
    for (const toState of ['320', 'Total']) {
      expect(receiptState(object, events.map(event => event.verb === 'count_to' ? { ...event, toState } : event), 120).total!.value).toBe(320)
    }
    expect(receiptState(object, events.map(event => event.verb === 'count_to' ? { ...event, toState: 'licence' } : event), 120).total!.value).toBe(120)
    expect(() => receiptState(object, events.map(event => event.verb === 'count_to' ? { ...event, toState: '999' } : event), 120)).toThrow(/dataset value/)
  })

  it('seeks interrupted counts deterministically and reads count timing from the active profile', () => {
    const next = { ...events[7]!, id: 'count-again', atFrame: 111, toState: 'Licence' }
    const interrupted = [...events, next]
    expect(receiptState(object, interrupted, 111).total!.value).toBe(160)
    expect(receiptState(object, interrupted, 129).total!.value).toBe(120)
    expect(receiptState(object, interrupted.reverse(), 115)).toEqual(receiptState(object, [...events, next], 115))
    const profile = resolveMotion({ style: 'character-ai-receipts' })!
    setMotionProfile({ ...profile, countFrames: 10, exitFrames: 4 })
    expect(at(107).total!.value).toBe(160)
    expect(at(112).total!.value).toBe(320)
    expect(at(143).visible).toBe(true)
    expect(at(144).visible).toBe(false)
  })

  it('lands a rotated channel-colour VOID or custom stamp and holds it in both aspects', () => {
    expect(at(123).stamped).toBe(false)
    expect(still(123)).not.toContain('data-receipt-stamp')
    expect(at(124)).toMatchObject({ stamped: true, stampProgress: 0 })
    expect(at(124 + MOTION.slapFrames).stampProgress).toBe(1)
    for (const aspect of ['9:16', '16:9'] as const) {
      const html = renderToStaticMarkup(React.createElement(Device, props(130, aspect)))
      expect(html).toContain('data-receipt-stamp=""')
      expect(html).toContain('rotate(-8) scale(1)')
      expect(html).toContain('fill="coral" stroke="coral"')
      expect(html).toContain('>VOID</text>')
      const custom = { ...object, params: { ...object.params, stampText: 'CANCELLED' } }
      expect(renderToStaticMarkup(React.createElement(Device, { ...props(130, aspect), object: custom }))).toContain('>CANCELLED</text>')
    }
  })

  it('fades and drops over the house exit frames, then can enter again', () => {
    expect(at(139)).toMatchObject({ visible: true, y: 0, opacity: 1 })
    expect(at(140)).toMatchObject({ visible: true, y: 0, opacity: 1 })
    let y = 0, opacity = 1
    for (let frame = 141; frame < 140 + MOTION.exitFrames; frame++) {
      const state = at(frame)
      expect(state.visible).toBe(true)
      expect(state.y).toBeGreaterThan(y)
      expect(state.opacity).toBeLessThan(opacity)
      expect(still(frame)).toContain('data-current-layout')
      y = state.y; opacity = state.opacity
    }
    expect(at(140 + MOTION.exitFrames)).toMatchObject({ visible: false, y: 250, opacity: 0 })
    expect(still(140 + MOTION.exitFrames)).toBe('')
    const reenter = { ...events[0]!, id: 'reenter', atFrame: 147 }
    expect(receiptState(object, [...events, reenter], 147)).toMatchObject({ visible: true, y: 250, opacity: 0.4 })
  })

  it('dissolves a highlight for eight frames and never reprints a line', () => {
    expect(at(89).highlighted).toBeUndefined()
    expect(at(90)).toMatchObject({ highlighted: 'review', dissolve: 0, ghost: false })
    expect(at(94).dissolve).toBe(0.5)
    expect(still(94)).toContain('data-previous-layout=""')
    expect(still(98)).not.toContain('data-previous-layout')
    const next = { ...events[6]!, id: 'h2', atFrame: 105, toState: 'licence' }
    expect(receiptState(object, [...events, next], 109)).toMatchObject({ highlighted: 'licence', previousHighlight: 'review', dissolve: 0.5 })
  })

  it('ignores foreign, unknown, premature and duplicate cues; seeks deterministically', () => {
    const extra = [
      { ...events[1]!, id: 'foreign', obj: 'another', atFrame: 15 },
      { ...events[1]!, id: 'unknown', toState: 'missing', atFrame: 25 },
      { ...events[6]!, id: 'premature', atFrame: 26 },
      { ...events[1]!, id: 'duplicate', atFrame: 105 },
    ]
    expect(receiptState(object, [...events, ...extra].reverse(), 106)).toEqual(at(106))
    expect(receiptState(object, [...events, ...extra], 26).ghost).toBe(false)
    expect(at(29).lines.every(line => !line.printed)).toBe(true)
    expect(object.params).toEqual(fixture.objects[0]!.params)
  })

  it('keeps unit, denominator and producer on every figure and refuses ambiguous data', () => {
    const divided = { ...object, dataset: { ...object.dataset!, denominator: 200 } }
    for (const frame of [0, 30, 100]) {
      const state = receiptState(divided, events, frame)
      expect(state.lines[0]!.figure).toBe('120/200 USD')
      expect(state.producerLabel).toBe(object.dataset!.producerLabel)
    }
    expect(() => receiptState({ ...object, dataset: undefined }, events, 50)).toThrow(/dataset/)
    expect(() => receiptState({ ...object, params: { lines: [{ key: 'x', row: 'missing' }] } }, events, 50)).toThrow(/missing dataset row/)
    expect(() => receiptState({ ...object, dataset: { ...object.dataset!, rows: [object.dataset!.rows[0]!, object.dataset!.rows[0]!] } }, events, 50)).toThrow(/unique/)
    expect(ParamsSchema.safeParse({ lines: [{ key: 'x', row: 'A' }, { key: 'x', row: 'B' }] }).success).toBe(false)
  })

  it('lands opening entrances and reads later entrance timing from the active profile', () => {
    const opening = [{ ...events[0]!, atFrame: 0 }]
    expect(receiptState(object, opening, 0)).toMatchObject({ y: 0, tilt: -1.5, opacity: 1 })
    setMotionProfile(resolveMotion({ style: 'character-ai-receipts' }))
    expect(at(19).y).toBe(0)
    expect(at(18).y).toBeGreaterThan(0)
    expect(at(27).tilt).toBe(-1.5)
  })

  it('contains every rotated paper and ghost corner in both aspects, ordinary slots and growing regions', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      for (const slot of [box, { left: 96, top: 140, width: 1728, height: 600 },
        { left: 20, top: 30, width: 180, height: 130 }, markRegion({ left: 0, top: 0, width: 3000, height: 3000 })]) {
        for (let frame = 10; frame < 150; frame++) {
          const state = at(frame), l = receiptLayout(state, aspect)
          const fitted = fitBox(l, slot), scale = fitScale(l, slot)
          const rad = state.tilt * Math.PI / 180
          for (const offset of state.ghost ? [0, 2] : [0]) {
            for (const x of [0, l.paper.width]) for (const y of [0, l.paper.height]) {
              const dx = x + offset - l.paper.width / 2, dy = y + offset - l.paper.height / 2
              const px = fitted.left + scale * (l.left + l.paper.width / 2 + dx * Math.cos(rad) - dy * Math.sin(rad))
              const py = fitted.top + scale * (l.top + state.y + state.jolt + l.paper.height / 2 + dx * Math.sin(rad) + dy * Math.cos(rad))
              expect(px).toBeGreaterThanOrEqual(slot.left)
              expect(px).toBeLessThanOrEqual(slot.left + slot.width)
              expect(py).toBeGreaterThanOrEqual(slot.top)
              expect(py).toBeLessThanOrEqual(slot.top + slot.height)
            }
          }
        }
        const html = renderToStaticMarkup(React.createElement(Device, { ...props(30, aspect), box: slot }))
        expect(html).toContain(`transform="translate(${receiptLayout(at(30), aspect).left} `)
        expect(html).toContain('data-region-fit=""')
      }
    }
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
