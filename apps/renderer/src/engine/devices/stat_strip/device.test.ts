import React from 'react'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { assertOverlayInvariants, overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { statStripState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => statStripState(object, events, frame)
describe('stat_strip', () => {
  it('obeys the shared rendered brand invariants', () => {
    assertOverlayInvariants(Device, object, events, 'stat_strip')
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
    expect(statStripState(object, [...events, again], 140)).toMatchObject({ visible: true, enter: 1, exit: 0 })
    expect(statStripState(object, [...events].reverse(), 40)).toEqual(at(40))
    at(140)
    expect(statStripState(object, [...events, { ...events[0]!, obj: 'other', atFrame: 35 }], 40)).toEqual(at(40))
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
it('holds an unknown then counts a dataset row with one slap and immutable units', () => {
  expect(at(29).numeral).toBe('?')
  expect(at(30)).toMatchObject({ numeral: '3', scale: 1.25, unit: '' })
  expect(at(35).scale).toBe(1)
  expect(at(99).numeral).toBe('3')
  expect(statStripState(object, [...events, { ...events[0]!, id: 'again', atFrame: 120 }], 140).numeral).toBe('?')
  expect(() => statStripState(object, [...events, { ...events[1]!, toState: 'invented' }], 40)).toThrow(/dataset row/)
  const html = renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object, events, frame: 40 }))
  expect(html).toContain('TEST RUN')
  expect(object.dataset?.denominator).toBe(3)
})
