import React from 'react'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { assertOverlayInvariants, overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { stampState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => stampState(object, events, frame)
describe('stamp', () => {
  it('obeys the shared rendered brand invariants', () => {
    assertOverlayInvariants(Device, object, events, 'stamp')
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
    expect(stampState(object, [...events, again], 140)).toMatchObject({ visible: true, enter: 1, exit: 0 })
    expect(stampState(object, [...events].reverse(), 40)).toEqual(at(40))
    at(140)
    expect(stampState(object, [...events, { ...events[0]!, obj: 'other', atFrame: 35 }], 40)).toEqual(at(40))
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
it('slaps only on stamp and renders all verdict treatments with a part leader', () => {
  expect(at(10).scale).toBe(1.25)
  expect(at(15).scale).toBe(1)
  const wrong = [{ ...events[0]!, verb: 'enter' as const }]
  expect(stampState(object, wrong, 40).visible).toBe(false)
  for (const kind of ['outline', 'block', 'dashed']) {
    const html = renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object: { ...object, params: { ...object.params, kind } }, events, frame: 40 }))
    expect(html).toContain('<line')
    expect(html).toContain('<circle')
    expect(html).toContain(`3px ${kind === 'dashed' ? 'dashed' : 'solid'}`)
  }
})
