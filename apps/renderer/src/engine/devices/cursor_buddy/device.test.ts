import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { buddyState, Device } from './index'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aquamarine', channel: 'coral' }
const state = (frame: number) => buddyState({ object, events, frame })
const props: DeviceProps = { object, events, tokens, frame: 22, aspect: '9:16', box: fixture.slots[0]!.box }
const render = (p: DeviceProps) => renderToStaticMarkup(React.createElement(Device, p))
describe('cursor buddy', () => {
  it('waits for enter and settles exactly twelve frames later', () => {
    expect(state(9)).toBeNull()
    expect(render({ ...props, frame: 9 })).toBe('')
    expect(state(10)?.arrival).toBe(0)
    expect(state(22)).toMatchObject({ arrival: 1, stretch: 0, x: 0.5, y: 0.5 })
  })
  it('double hops and returns to rest', () => {
    expect(state(33)!.hop).toBeCloseTo(1)
    expect(state(36)!.hop).toBe(0)
    expect(state(39)!.hop).toBeCloseTo(0.7)
    expect(state(42)!.hop).toBeCloseTo(0)
  })
  it('slumps with half closed eyes and a finite recoil', () => {
    expect(state(54)).toMatchObject({ mood: 'sulk', slump: 1 })
    expect(state(54)!.recoil).toBeGreaterThan(0)
    expect(state(62)!.recoil).toBeCloseTo(0)
    expect(render({ ...props, frame: 54 })).toContain('data-eyes="half-closed"')
  })
  it('winks during its tilt, then opens its eye', () => {
    const eager = events.filter(e => e.verb !== 'sulk')
    expect(render({ ...props, events: eager, frame: 76 })).toContain('M -7 -9 Q -2 -14 3 -9')
    expect(render({ ...props, events: eager, frame: 82 })).toContain('cx="-2"')
  })
  it('glides to fractions, exits, and supports reentry', () => {
    expect(state(96)!.x).toBeGreaterThan(0.5)
    expect(state(102)).toMatchObject({ x: 0.7, y: 0.4 })
    expect(state(126)).toBeNull()
    expect(buddyState({ object, events: [...events, { ...events[0]!, atFrame: 140 }], frame: 152 })).toMatchObject({ arrival: 1, x: 0.5 })
    expect(buddyState({ object, events: [...events].reverse(), frame: 96 })).toEqual(state(96))
  })
  it('keeps interrupted moves continuous', () => {
    const interrupted = [...events, { ...events[4]!, id: 'interrupt', atFrame: 96, toState: '{"x":0.2,"y":0.7}' }]
    expect(buddyState({ object, events: interrupted, frame: 96 })!.x).toBe(state(96)!.x)
  })
  it('draws sunglasses, optional card and only token colours', () => {
    const markup = render({ ...props, object: { ...object, params: { mood: 'cool' } } })
    expect(markup).toContain('data-sunglasses="true"')
    expect(markup).not.toContain('data-prop')
    expect(render(props)).toContain('data-prop="card"')
    for (const m of markup.matchAll(/(?:fill|stroke)="([^"]+)"/g)) expect(['none', ...Object.values(tokens)]).toContain(m[1])
    expect(ParamsSchema.safeParse({ mood: 'angry' }).success).toBe(false)
  })
  it('renders every fixture still in independently authored tall and wide slots', () => {
    for (const slot of fixture.slots) for (const frame of fixture.stills) {
      const markup = render({ ...props, ...slot, aspect: slot.aspect as DeviceProps['aspect'], frame })
      expect(markup).not.toMatch(/NaN|Infinity/)
      if (frame >= 10 && frame < 126) expect(markup).toContain(`viewBox="0 0 ${slot.box.width} ${slot.box.height}"`)
    }
  })
})
