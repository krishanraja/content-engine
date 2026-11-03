import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, bubbleState } from './index'
import { HOUSE_FONTS } from '../../../house/geometry'
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
  it('lands opening notifications with full text, while later type cues still reveal', () => {
    const p = props(0)
    const text = 'Done! Booked the team offsite in Ibiza'
    p.object = { ...object, params: { kind: 'notification', rows: [{ text }] } }
    p.events = events.map(e => e.verb === 'type' ? { ...e, atFrame: 0 } : e)
    expect(bubbleState(p)).toMatchObject({ enter: 1, rows: [{ text, visible: true, dots: false }] })
    expect(render(p)).toContain(text)
    expect(render(p)).toContain('opacity:1')
    expect(render(p)).toContain('translateY(0px) scale(1)')
    expect(render(p)).not.toContain('data-typing-dots')
    p.object = { ...p.object, params: { kind: 'chat', rows: [{ text }] } }
    expect(render(p)).not.toContain('data-typing-dots')
    expect(render(p)).toContain(text)
    p.events = p.events.map(e => e.verb === 'type' ? { ...e, atFrame: 30 } : e)
    expect(bubbleState({ ...p, frame: 30 })!.rows[0]).toMatchObject({ text: '', dots: true })
    const partial = bubbleState({ ...p, frame: 40 })!.rows[0]!.text
    expect(partial.length).toBeGreaterThan(0)
    expect(partial.length).toBeLessThan(text.length)
  })

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
  it('authors readable phone UI at both aspects with both bubble sides', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      const p = props(80, aspect)
      p.object = { ...object, params: { kind: 'chat', status: '09:41', rows: [
        { who: 'Mira Vale', text: 'Hello there!', side: 'left' },
        { text: 'All set.', side: 'right' },
      ] } }
      p.events = [...events, { id: 'reply', obj: 'bubble', verb: 'type', toState: '1', atFrame: 50 }]
      const html = render(p)
      expect(Number(html.match(/width:([0-9.]+)px/)![1])).toBeGreaterThanOrEqual(920)
      expect(html).toContain('data-chat-header')
      expect(html).toContain('data-avatar')
      expect(html).toContain('MV')
      expect(html).toContain('online')
      expect(html).toContain('Mira Vale')
      expect(html).toContain('data-bubble-side="left"')
      expect(html).toContain('data-bubble-side="right"')
      expect(html).toContain('background:ivory')
      expect(html).toContain('background:aqua')
      expect(html).toContain('data-timestamp')
      expect(html).toContain('09:41')
      expect(html).toContain(HOUSE_FONTS.structure.replaceAll('"', '&quot;'))
      for (const match of html.matchAll(/font-size:([0-9.]+)px/g)) expect(Number(match[1])).toBeGreaterThanOrEqual(44)
    }
    expect(render(props(46))).not.toContain('Delivered')
    expect(render(props(47))).toContain('Delivered')
    expect(render(props(52))).toContain('data-delivered-ticks')
  })
  it('gives order, email and choice their own app anatomy without adding copy fields', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      const p = props(80, aspect)
      p.object = { ...object, params: { kind: 'order', rows: [{ who: 'Notebook', text: 'Qty 2 · £24' }], status: 'Confirmed' } }
      expect(render(p)).toContain('Order placed')
      expect(render(p)).toContain('✓')
      expect(render(p)).toContain('data-product-row')
      expect(render(p)).toContain('Notebook')
      expect(render(p)).toContain('Qty 2 · £24')
      expect(render(p)).toContain('Confirmed')
      p.object = { ...object, params: { kind: 'email', rows: [
        { who: 'Your weekly update', text: 'Hello there!' },
        { who: '3,000 recipients', text: 'Preview' },
      ] } }
      p.events = [...events, { id: 'recipient', obj: 'bubble', verb: 'type', toState: '1', atFrame: 50 }]
      expect(render(p)).toContain('data-subject')
      expect(render(p)).toContain('Your weekly update')
      expect(render(p)).toContain('To: 3,000 recipients')
      expect(render(p)).toContain('Hello there!')
      p.object = { ...object, params: { kind: 'choice', rows: [{ text: 'Preferences' }], options: ['Allow', 'Ask', 'Deny'] } }
      p.events = [...events, { id: 'pick', obj: 'bubble', verb: 'pick', toState: '2', atFrame: 60 }]
      const html = render(p)
      expect(html.match(/data-section/g)).toHaveLength(3)
      for (const section of ['A', 'B', 'C']) expect(html).toContain('>' + section + '</div>')
      expect(html.match(/data-radio="/g)).toHaveLength(3)
      expect(html.match(/data-radio-dot/g)).toHaveLength(1)
      expect(html).toContain('data-radio-ring')
    }
  })
  it('uses 36px corners, a soft token shadow and a 0.92 entrance on every kind', () => {
    for (const kind of ['chat', 'notification', 'order', 'email', 'choice']) {
      const p = props(10)
      p.events = events.map(e => e.verb === 'enter' ? { ...e, atFrame: 10 } : e)
      p.object = { ...object, params: { ...object.params, kind, options: ['Allow', 'Ask'] } }
      const html = render(p)
      expect(html).toContain('border-radius:36px')
      expect(html).toContain('scale(0.92)')
      expect(html).toContain('box-shadow:0 28px 64px color-mix')
      expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(render({ ...p, frame: 22 })).toContain('scale(1)')
    }
  })
  it('moves all three typing dots deterministically using drift and removes them after the lead', () => {
    const a = render(props(20))
    const b = render(props(21))
    expect(a.match(/data-dot="/g)).toHaveLength(3)
    expect(a).not.toBe(b)
    expect(b).toBe(render(props(21)))
    expect(render(props(23))).not.toContain('data-typing-dots')
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
