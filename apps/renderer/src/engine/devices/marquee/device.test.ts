import React from 'react'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { assertOverlayInvariants, overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { marqueeState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => marqueeState(object, events, frame)
describe('marquee', () => {
  it('obeys the shared rendered brand invariants', () => {
    assertOverlayInvariants(Device, object, events, 'marquee')
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
    expect(marqueeState(object, [...events, again], 140)).toMatchObject({ visible: true, enter: 1, exit: 0 })
    expect(marqueeState(object, [...events].reverse(), 40)).toEqual(at(40))
    at(140)
    expect(marqueeState(object, [...events, { ...events[0]!, obj: 'other', atFrame: 35 }], 40)).toEqual(at(40))
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
it('scrolls constantly relative to object lifetime without wrapping or blanking', () => {
  expect(at(40).offset - at(39).offset).toBe(2)
  expect(at(99).offset - at(98).offset).toBe(2)
  const shifted = { ...object, fromFrame: 20 }
  expect(marqueeState(shifted, events, 40).offset).toBe(40)
  const html = renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object, events, frame: 99 }))
  expect(html).toContain('overflow:hidden')
  expect(html).toContain('aria-hidden="true"')
  expect(html).toContain('<svg')
  expect((html.match(/MAKE YOUR MIND UP/g) ?? []).length).toBeGreaterThan(1)
})
