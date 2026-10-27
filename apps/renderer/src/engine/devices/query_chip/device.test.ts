import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import fixture from './fixture.json'
import { queryState } from './state'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map((event) => EngineEventSchema.parse(event))
const at = (frame: number) => queryState(object, events, frame)

describe('query_chip frame state', () => {
  it('slides in over twelve frames', () => {
    expect(at(9).visible).toBe(false)
    expect(at(10)).toMatchObject({ visible: true, enter: 0 })
    expect(at(16).enter).toBeGreaterThan(0)
    expect(at(22).enter).toBe(1)
  })
  it('pulses once, peaks at 1.05 and settles after eight frames', () => {
    expect(at(29).scale).toBe(1)
    expect(at(30).scale).toBe(1)
    expect(at(34).scale).toBeCloseTo(1.05)
    expect(at(36).scale).toBeGreaterThan(1)
    expect(at(38).scale).toBe(1)
    expect(at(49).scale).toBe(1)
  })
  it('slides out over six frames and can reenter without replaying the pulse', () => {
    expect(at(50)).toMatchObject({ visible: true, exit: 0 })
    expect(at(53).exit).toBeGreaterThan(0)
    expect(at(56)).toMatchObject({ visible: false, exit: 1 })
    const reenter = { ...events[0]!, id: 'again', atFrame: 70 }
    expect(queryState(object, [...events, reenter], 82)).toMatchObject({ visible: true, enter: 1, exit: 0, scale: 1 })
    expect(at(180).visible).toBe(false)
  })
  it('is deterministic for out-of-order events, other objects and backward seeks', () => {
    expect(queryState(object, [...events].reverse(), 34)).toEqual(at(34))
    expect(queryState(object, [...events, { ...events[1]!, obj: 'other', atFrame: 45 }], 49)).toEqual(at(49))
    at(60)
    expect(at(20).text).toBe(object.params.text)
    expect(at(20).scale).toBe(1)
  })
})
