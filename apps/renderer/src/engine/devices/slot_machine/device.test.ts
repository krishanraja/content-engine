import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, slotState } from './index'
import { material } from './hatch'
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
