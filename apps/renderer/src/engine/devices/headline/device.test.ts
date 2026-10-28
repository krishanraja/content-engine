import React from 'react'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { assertOverlayInvariants, overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { headlineState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => headlineState(object, events, frame)
describe('headline', () => {
  it('obeys the shared rendered brand invariants', () => {
    assertOverlayInvariants(Device, object, events, 'headline')
  })
  it('appears only on its cue, exits and reenters deterministically', () => {
    expect(at(9).visible).toBe(false)
    expect(at(10).visible).toBe(true)
    expect(at(10).enter).toBe(0)
    expect(at(25).enter).toBe(1)
    expect(at(100).exit).toBe(0)
    expect(at(106).visible).toBe(false)
    expect(at(180).visible).toBe(false)
    const again = { ...events[0]!, id: 'again', atFrame: 120 }
    expect(headlineState(object, [...events, again], 140)).toMatchObject({ visible: true, enter: 1, exit: 0 })
    expect(headlineState(object, [...events].reverse(), 40)).toEqual(at(40))
    at(140)
    expect(headlineState(object, [...events, { ...events[0]!, obj: 'other', atFrame: 35 }], 40)).toEqual(at(40))
  })
})

import { headlineLayout } from './index'
import { renderToStaticMarkup } from 'react-dom/server'
it('shrinks long headlines within the locked type range without overflow', () => {
  const short = headlineLayout(['HI'], 888)
  const long = headlineLayout(['COUNTRY TEST'], 888)
  expect(short.size).toBe(240)
  expect(long.size).toBeLessThan(short.size)
  expect(long.size).toBeGreaterThanOrEqual(150)
  expect(() => headlineLayout(['X'.repeat(100)], 888)).toThrow(/150px/)
  expect(() => headlineLayout(['HI'], 40)).toThrow(/150px/)
})
it('staggers two lines by three frames, colours just one word, and places its dek', () => {
  const render = (frame: number, params = object.params) => renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object: { ...object, params }, events, frame }))
  expect(render(11)).toContain('opacity:0;transform:translateY(24px)')
  expect(render(25)).toContain('14px 14px')
  expect((render(25).match(/skewX/g) ?? []).length).toBe(1)
  expect(render(25)).toContain('font-style:italic')
  expect(render(25, { lines: ['HI'], dek: 'A human line.' })).toContain('left:')
})

it('lets a splash title take a taller room, and nothing else', () => {
  const lines = ['TWO', 'PASSPORTS']
  const zone = headlineLayout(lines, 878, 0)
  const splash = headlineLayout(lines, 878, 0, 373)
  expect(zone.size).toBeLessThanOrEqual(153)
  expect(splash.size).toBeGreaterThanOrEqual(200)
  expect(splash.size).toBeLessThanOrEqual(240)
  expect(splash.height).toBeLessThanOrEqual(373)
  expect(() => headlineLayout(['X'.repeat(100)], 888, -1, 373)).toThrow(/150px/)
})
