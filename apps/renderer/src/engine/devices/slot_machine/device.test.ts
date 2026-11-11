import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, slotState } from './index'
import { material } from './hatch'
import { slotLayout } from './layout'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const props = (frame: number): DeviceProps => ({ object, events, frame, tokens, aspect: '9:16',
  box: { left: 70, top: 80, width: 1080, height: 1920 } })
const state = (frame: number) => slotState(props(frame))!
const render = (p: DeviceProps) => renderToStaticMarkup(React.createElement(Device, p))
describe('slot_machine', () => {
  it('enters empty, types exactly two characters per elapsed frame and blinks every fifteen frames', () => {
    expect(render(props(4))).toBe('')
    expect(state(18).texts).toEqual(['', ''])
    for (let f = 20; f < 55; f++) expect(state(f).texts[0]).toBe(String(object.params.lyrics).slice(0, Math.min(String(object.params.lyrics).length, 2 * (f - 20))))
    expect(state(30).zoom).toBeCloseTo(1.6)
    expect(state(72).texts[1]).toBe('deep house, female singer, summer')
    expect(state(14).caret).not.toBe(state(15).caret)
    expect(state(30).caret).toBe(state(14).caret)
  })
  it('morphs, moves the lever, stops reels in order, and pays out only on fill', () => {
    expect(state(92).morph).toBeGreaterThan(0)
    expect(state(92).morph).toBeLessThan(1)
    expect(state(116).lever).not.toBe(state(115).lever)
    expect(state(127).reels.map(r => r.spinning)).toEqual([true, true])
    expect(state(128).reels.map(r => r.spinning)).toEqual([false, true])
    expect(state(136).reels.map(r => r.spinning)).toEqual([false, false])
    expect(render(props(144))).not.toContain('data-song')
    expect(state(145).cards.map(c => c.visible)).toEqual([true, false])
    expect(state(160).cards.map(c => c.visible)).toEqual([true, true])
    expect(state(180).cards.map(c => c.dim)).toEqual([1, 0.4])
    expect(state(180).cards[0]!.lift).toBe(1)
    expect(state(196).reels.every(r => r.spinning)).toBe(true)
    expect(state(202).cards.every(c => !c.visible)).toBe(true)
    expect(state(251)).toBeNull()
  })
  it('renders all named golden stills in all three bounded slots', () => {
    expect(Object.values(fixture.golden_frames)).toEqual(fixture.stills)
    for (const slot of fixture.slots) for (const frame of fixture.stills) {
      const p = props(frame)
      p.box = { ...p.box, ...slot }
      p.aspect = slot.height > slot.width ? '9:16' : '16:9'
      const html = render(p)
      expect(html).toContain('overflow:hidden')
      expect(html).toContain('rebuilt from suno.com, Nov 2026')
      expect(html).toContain('data-device="slot_machine"')
      expect(html).not.toContain('NaN')
    }
  })
  it('uses semantic token materials and rejects invalid params and event targets', () => {
    expect(material('human', tokens).background).toBe(tokens.mint)
    expect(material('ai', tokens)).toMatchObject({ backgroundColor: tokens.ink })
    expect(material('ai', tokens).backgroundImage).toContain('45deg')
    expect(material('ai', tokens).backgroundImage).toContain('6px')
    expect(material('synth', tokens)).toEqual(material('sample', tokens))
    for (const file of ['index.tsx', 'hatch.ts', 'state.ts']) expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toMatch(/#[\da-f]{3,8}\b/i)
    expect(ParamsSchema.safeParse({ ...object.params, lyrics: 'a\nb\nc\nd\ne' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, songs: [] }).success).toBe(false)
    expect(() => slotState({ ...props(180), events: [...events, { ...events[0]!, verb: 'highlight', toState: '3', atFrame: 179 }] })).toThrow()
  })
})

describe('polished slot geometry', () => {
  for (const slot of fixture.slots) {
    it(`keeps typing and rotated payouts inside ${slot.width}x${slot.height}`, () => {
      for (const frame of [30, 72, 145, 148, 150, 160, 180]) {
        const p = { ...props(frame), box: { ...props(frame).box, ...slot } }
        const s = slotState(p)!
        const l = slotLayout(p, s)
        for (const input of l.inputs) for (const x of input.charXs) {
          expect(x).toBeGreaterThanOrEqual(60)
          expect(x + input.font * 0.61 * input.zoom).toBeLessThanOrEqual(l.w - 60)
        }
        for (const c of l.cards) {
          expect(c.bounds.left).toBeGreaterThanOrEqual(60)
          expect(c.bounds.left + c.bounds.width).toBeLessThanOrEqual(l.w - 60)
          expect(c.bounds.top).toBeGreaterThanOrEqual(l.h * 0.06)
          expect(c.bounds.top + c.bounds.height).toBeLessThanOrEqual(l.h * 0.94)
        }
      }
    })
  }
  it('keeps the source outside the camera and clears inputs before reels grow', () => {
    for (let frame = 5; frame < 251; frame++) {
      if (!slotState(props(frame))) continue
      expect(render(props(frame))).toContain('data-source')
      const s = state(frame)
      if (s.reelGrow > 0) expect(s.inputCollapse).toBe(1)
    }
    expect(state(fixture.golden_frames.G4).lever).toBeGreaterThanOrEqual(60)
  })
})

describe('round 3 framing and cabinet', () => {
  for (const slot of fixture.slots) {
    it(`contains complete typed lines and the lever ball in ${slot.width}x${slot.height}`, () => {
      for (const frame of [fixture.golden_frames.G1, fixture.golden_frames.G2]) {
        const p = { ...props(frame), box: { ...props(frame).box, ...slot } }
        const l = slotLayout(p, slotState(p)!)
        for (const input of l.inputs) {
          expect(input.lines.length).toBeLessThanOrEqual(4)
          for (const x of input.charXs) {
            expect(x).toBeGreaterThanOrEqual(l.left + l.width * 0.06)
            expect(x + input.advance).toBeLessThanOrEqual(l.left + l.width * 0.94)
          }
          expect(48 + input.lines.length * input.font * input.zoom * 1.4)
            .toBeLessThanOrEqual(l.h * (input === l.inputs[0] ? 0.2 : 0.14))
        }
      }
      const p = { ...props(fixture.golden_frames.G4), box: { ...props(116).box, ...slot } }
      const s = slotState(p)!, l = slotLayout(p, s)
      expect(s.lever).toBeGreaterThanOrEqual(60)
      expect(l.ball.x - l.ball.radius).toBeGreaterThanOrEqual(0)
      expect(l.ball.x + l.ball.radius).toBeLessThanOrEqual(l.w)
      expect(l.ball.y - l.ball.radius).toBeGreaterThanOrEqual(0)
      expect(l.ball.y + l.ball.radius).toBeLessThanOrEqual(l.h)
      expect(render(p)).toContain('data-ball')
    })
  }
  it('draws a cream cabinet with an ink outline after pick', () => {
    for (const frame of [96, 116, 160, 180]) {
      const cabinet = render(props(frame)).match(/data-cabinet[^>]+/)![0]
      expect(cabinet).toContain('background:ivory')
      expect(cabinet).toContain('border:3px solid black')
      expect(cabinet).toContain('box-shadow:')
    }
  })
})
