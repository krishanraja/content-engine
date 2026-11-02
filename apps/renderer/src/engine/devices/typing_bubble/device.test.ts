import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, bubbleState } from './index'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const state = (frame: number) => bubbleState({ object, events, frame })!
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const props = (frame: number, aspect: DeviceProps['aspect'] = '9:16'): DeviceProps => ({ object, events, frame, aspect, tokens,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } })
const render = (p: DeviceProps) => renderToStaticMarkup(React.createElement(Device, p))
describe('typing_bubble', () => {
  it('reveals no row before type, leads with dots, then types linearly', () => {
    expect(render(props(19))).not.toContain('Mira Vale')
    expect(state(19).rows[0]!.text).toBe('')
    expect(state(20).rows[0]!.dots).toBe(true)
    expect(state(35).rows[0]!.text).toBe('Hello ')
    expect(state(47).rows[0]!.text).toBe('Hello there!')
    expect(state(35)).toEqual(state(35))
  })
  it('sends only at its cue, falls away and resets on reentry', () => {
    expect(render(props(46))).not.toContain('data-status')
    expect(render(props(52))).toContain('Sent')
    expect(state(103).out).toBeGreaterThan(0)
    expect(render(props(106))).toBe('')
    const p = props(132)
    p.events = [...events, { ...events[0]!, atFrame: 120 }]
    expect(render(p)).not.toContain('Sent')
    expect(render(p)).not.toContain('Hello')
  })
  it('picks exactly one option and replaces the previous selection', () => {
    const p = props(65)
    p.object = { ...object, params: { kind: 'choice', rows: [{ text: 'Policy' }], options: ['Section A', 'Section B', 'Section C'], picked: 1 } }
    p.events = [...events, { id: 'pick-a', obj: 'bubble', verb: 'pick', toState: '0', atFrame: 55 },
      { id: 'pick-b', obj: 'bubble', verb: 'pick', toState: '1', atFrame: 60 }]
    expect((render(p).match(/data-radio-dot/g) ?? [])).toHaveLength(1)
    expect(bubbleState(p)!.picked).toBe(1)
    expect(bubbleState({ ...p, frame: 54 })!.picked).toBeNull()
    expect(() => bubbleState({ ...p, events: [...p.events, { id: 'bad', obj: 'bubble', verb: 'pick', toState: '3', atFrame: 64 }] })).toThrow(/index/)
  })
  it('renders every kind in tall and wide slots with token colours and supplied copy', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      for (const frame of fixture.stills) expect(() => render(props(frame, aspect))).not.toThrow()
      for (const kind of ['chat', 'notification', 'order', 'email', 'choice']) {
        const p = props(52, aspect)
        p.object = { ...object, params: { ...object.params, kind, ...(kind === 'choice' ? { options: ['Allow', 'Ask'] } : {}) } }
        const html = render(p)
        expect(html).toContain('Hello there!')
        expect(html).toContain('background:ivory')
        expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      }
    }
  })
  it('rejects invalid bounds and ignores other objects and input event ordering', () => {
    for (const params of [{ ...object.params, rows: [] }, { ...object.params, rows: [{ text: 'x'.repeat(81) }] },
      { ...object.params, kind: 'choice', options: ['one'] }, { ...object.params, options: ['a', 'b'], picked: 2 }]) {
      expect(ParamsSchema.safeParse(params).success).toBe(false)
    }
    expect(bubbleState({ object, frame: 35, events: [...events].reverse() })).toEqual(state(35))
    expect(bubbleState({ object, frame: 35, events: [...events, { ...events[2]!, obj: 'other', atFrame: 30 }] })).toEqual(state(35))
  })
})
