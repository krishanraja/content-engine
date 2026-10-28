import React from 'react'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { assertOverlayInvariants, overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { stickerState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => stickerState(object, events, frame)
describe('sticker', () => {
  it('obeys the shared rendered brand invariants', () => {
    assertOverlayInvariants(Device, object, events, 'sticker')
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
    expect(stickerState(object, [...events, again], 140)).toMatchObject({ visible: true, enter: 1, exit: 0 })
    expect(stickerState(object, [...events].reverse(), 40)).toEqual(at(40))
    at(140)
    expect(stickerState(object, [...events, { ...events[0]!, obj: 'other', atFrame: 35 }], 40)).toEqual(at(40))
  })
})

it('drops sixty pixels and settles its rotation in eight frames', () => {
  expect(at(10)).toMatchObject({ drop: -60, rotation: 8 })
  expect(at(18)).toMatchObject({ drop: 0, rotation: -4 })
  expect(at(14).drop).toBeGreaterThan(-60)
  expect(at(14).drop).toBeLessThan(0)
})
import { ParamsSchema } from './schema'
it('rejects out of range tilts and off-canvas placement', () => {
  expect(ParamsSchema.safeParse({ ...object.params, tiltDeg: 6 }).success).toBe(false)
  expect(ParamsSchema.safeParse({ ...object.params, tiltDeg: -9 }).success).toBe(false)
  expect(() => Device({ ...overlayTestProps, object: { ...object, params: { ...object.params, at: { x: 1079, y: 500 } } }, events, frame: 40 })).toThrow(/canvas/)
})
