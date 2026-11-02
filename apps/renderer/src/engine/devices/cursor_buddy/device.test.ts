import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, buddyState } from './index'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
// These device verbs require a shared EngineEventSchema extension outside this card's write scope.
const events = fixture.events as unknown as DeviceProps['events']
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const props = (frame: number, aspect: DeviceProps['aspect'] = '9:16'): DeviceProps => ({ object, events, frame, tokens, aspect,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } })
const at = (frame: number) => buddyState(props(frame))
const still = (p: DeviceProps) => renderToStaticMarkup(React.createElement(Device, p))
describe('cursor buddy', () => {
  it('draws nothing before enter, settles within twelve frames and exits completely', () => {
    expect(still(props(9))).toBe('')
    expect(at(22)).toMatchObject({ entry: 1, zip: 1, scaleX: 1, scaleY: 1, x: 0.5, y: 0.5 })
    expect(still(props(22))).not.toContain('stroke-linecap="round" opacity=')
    expect(still(props(186))).toBe('')
  })
  it('double hops and returns to rest height', () => {
    expect(at(44)!.mood).toBe('proud')
    expect(at(44)!.hop).toBeGreaterThan(0.8)
    expect(at(48)!.hop).toBeCloseTo(0)
    expect(at(52)!.hop).toBeGreaterThan(0.6)
    expect(at(56)!.hop).toBe(0)
  })
  it('slumps, changes eyes, and recoils briefly', () => {
    expect(at(72)!.recoil).toBeGreaterThan(0)
    expect(at(78)).toMatchObject({ mood: 'sulk', slump: 1, recoil: 0 })
    expect(still(props(78))).toContain('data-eyes="half-closed"')
    expect(at(22)!.slump).toBe(0)
  })
  it('waves with one tilt and wink and holds the final move', () => {
    const p = props(108); p.events = events.filter(e => String(e.verb) !== 'sulk')
    expect(still(p)).toContain('M -13 -12 q 6 6 12 0')
    expect(at(116)!.wave).toBeCloseTo(0)
    expect(at(142)).toMatchObject({ x: 0.75, y: 0.6 })
  })
  it('renders cool sunglasses and an optional blank card using only token colours', () => {
    const p = props(22); p.object = { ...object, params: { mood: 'cool', prop: 'card' } }
    const html = still(p)
    expect(html).toContain('data-eyes="sunglasses"')
    expect(html).toContain('data-prop="card"')
    expect(html).not.toContain('<text')
    for (const [, colour] of html.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      expect(['none', ...Object.values(tokens)]).toContain(colour)
    }
  })
  it('renders every fixture still in both separately authored slots deterministically', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) for (const frame of fixture.stills) {
      const p = props(frame, aspect)
      expect(still(p)).toBe(still({ ...p, events: [...events].reverse() }))
      expect(still(p)).not.toMatch(/NaN|Infinity/)
    }
  })
  it('rejects unknown params and out-of-slot move destinations', () => {
    expect(ParamsSchema.safeParse({ mood: 'angry' }).success).toBe(false)
    const p = props(150); p.events = [...events, { ...events[0]!, verb: 'move', atFrame: 145, toState: '{"x":2,"y":0}' }]
    expect(() => buddyState(p)).toThrow()
  })
  it('honours object lifetime and glides continuously when a move is interrupted', () => {
    expect(still({ ...props(22), object: { ...object, fromFrame: 30 } })).toBe('')
    expect(still(props(240))).toBe('')
    const p = props(135)
    const before = buddyState(p)!
    p.events = [...events, { ...events[0]!, id: 'interrupt', verb: 'move', atFrame: 135, toState: '{"x":0.2,"y":0.3}' }]
    expect(buddyState(p)).toMatchObject({ x: before.x, y: before.y })
    expect(buddyState({ ...p, frame: 147 })!.x).toBeCloseTo(0.2)
    expect(buddyState({ ...p, frame: 147 })!.y).toBeCloseTo(0.3)
  })
  it('resets on reentry and ignores unrelated objects', () => {
    const p = props(212); p.events = [...events, { ...events[0]!, id: 'again', atFrame: 200 }]
    expect(buddyState(p)).toMatchObject({ mood: 'eager', x: 0.5, y: 0.5, slump: 0 })
    expect(buddyState({ ...props(78), events: [...events, { ...events[0]!, obj: 'other', atFrame: 77 }] })).toEqual(at(78))
  })
})
