import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineObjectSchema } from '../../props'
import type { EngineEvent } from '../../props'
import type { DeviceProps } from '../types'
import { Device, bubbleState } from './index'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
// These new verbs need the host EngineEventSchema extension. Keep that
// integration failure exposed in verbs.test.ts, rather than widening it here.
const events = fixture.events as unknown as EngineEvent[]
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const props = (frame: number, aspect: DeviceProps['aspect'] = '9:16'): DeviceProps => ({ object, events, frame, tokens, aspect,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } })
const at = (frame: number) => bubbleState(props(frame))
const render = (p: DeviceProps) => renderToStaticMarkup(React.createElement(Device, p))
const event = (verb: string, toState: string, atFrame: number): EngineEvent => ({ id: `${verb}-${atFrame}`, obj: object.obj, verb, toState, atFrame }) as EngineEvent

describe('typing_bubble', () => {
  it('keeps Unicode characters intact while typing', () => {
    const p = props(50)
    p.object = { ...object, params: { kind: 'email', rows: [{ text: 'Hi🙂!' }] } }
    p.events = [events[0]!, event('type', '0', 30), event('send', 'sent', 70)]
    expect(bubbleState(p)!.rows[0]!.shown).toBe('Hi')
    expect(bubbleState({ ...p, frame: 60 })!.rows[0]!.shown).toBe('Hi🙂')
  })
  it('uses supplied colour tokens and gives mint replies an ink keyline', () => {
    const html = render(props(115))
    expect(html).toContain(`background:${tokens.mint};border:2px solid ${tokens.ink}`)
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(html).not.toContain(tokens.channel)
  })
  it('hides until enter, and shows no row text before its type cue', () => {
    expect(render(props(9))).toBe('')
    expect(render(props(22))).not.toContain('Hello')
    expect(at(29)!.rows.every(r => !r.visible && r.shown === '')).toBe(true)
    expect(render(props(30))).toContain('data-typing-dots="true"')
    expect(at(39)!.rows[0]!.shown).toBe('')
    expect(at(55)!.rows[0]!.shown).toBe('Hello ')
    expect(at(70)!.rows[0]!.shown).toBe('Hello there!')
    expect(at(69)!.rows[1]!.visible).toBe(false)
  })
  it('types exactly half at the midpoint for non-chat, and holds completed text', () => {
    const p = props(50)
    p.object = { ...object, params: { ...object.params, kind: 'email' } }
    expect(bubbleState(p)!.rows[0]!.shown).toBe('Hello ')
    expect(bubbleState({ ...p, frame: 110 })!.rows[0]!.shown).toBe('Hello there!')
    expect(bubbleState({ ...p, events: [...events].reverse() })).toEqual(bubbleState(p))
    expect(bubbleState({ ...p, events: [...events, { ...events[0]!, obj: 'other', atFrame: 40 }] })).toEqual(bubbleState(p))
  })
  it('shows status only on send and exits in the house duration', () => {
    expect(render(props(109))).not.toContain('data-status')
    expect(render(props(115))).toContain('>Sent</div>')
    expect(at(115)!.sendProgress).toBe(1)
    expect(at(183)!.out).toBeGreaterThan(0)
    expect(render(props(186))).toBe('')
    const p = props(215)
    p.events = [...events, event('enter', 'visible', 200)]
    expect(bubbleState(p)).toMatchObject({ sent: false, picked: null })
    expect(bubbleState(p)!.rows.every(r => !r.visible)).toBe(true)
  })
  it('fills exactly one selected dot, only after a pick event', () => {
    const p = props(55)
    p.object = { ...object, params: { kind: 'choice', rows: [{ text: 'Choose a policy' }], options: ['A', 'B', 'C'], picked: 1 } }
    p.events = [events[0]!, event('type', '0', 25)]
    expect(render(p)).not.toContain('data-radio-dot')
    p.events = [...p.events, event('pick', '1', 40), event('pick', '2', 50)]
    const html = render(p)
    expect((html.match(/data-radio-dot=/g) ?? [])).toHaveLength(1)
    expect(html).toContain('data-radio-dot="2"')
    expect(bubbleState(p)!.pickProgress).toBe(1)
    expect(() => bubbleState({ ...p, events: [...p.events, event('pick', '3', 51)] })).toThrow(/index/)
  })
  it('renders all five simulated UI kinds in independently authored tall and wide slots', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) {
      for (const frame of fixture.stills) expect(render(props(frame, aspect))).toBe(render(props(frame, aspect)))
      for (const kind of ['chat', 'notification', 'order', 'email', 'choice']) {
        const p = props(115, aspect)
        p.object = { ...object, params: { ...object.params, kind, ...(kind === 'choice' ? { options: ['A', 'B'] } : {}) } }
        expect(render(p)).toContain(`data-kind="${kind}"`)
        expect(render(p)).not.toContain('coral')
      }
    }
    expect(render(props(115))).not.toBe(render(props(115, '16:9')))
  })
  it('validates row, status and choice limits', () => {
    for (const patch of [{ rows: [] }, { rows: Array(7).fill({ text: 'x' }) }, { rows: [{ text: 'x'.repeat(81) }] },
      { kind: 'choice' }, { kind: 'choice', options: ['A'] }, { kind: 'choice', options: ['A', 'B'], picked: 2 }]) {
      expect(ParamsSchema.safeParse({ ...object.params, ...patch }).success).toBe(false)
    }
  })
})
