import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { assertOverlayInvariants } from '../../kit/overlayInvariants'
import { Device } from './index'
import { quoteCardState } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
describe('quote_card', () => {
  it('obeys the shared rendered brand invariants', () => {
    assertOverlayInvariants(Device, object, events, 'quote_card')
  })
  it('appears on its cue, rises 24 px while entering and exits', () => {
    expect(quoteCardState(object, events, 9).visible).toBe(false)
    expect(quoteCardState(object, events, 10).rise).toBe(24)
    expect(quoteCardState(object, events, 40).rise).toBe(0)
  })
  it('rejects a card too narrow to hold 44 px type', () => {
    expect(ParamsSchema.safeParse({ ...object.params, at: { x: 72, y: 1516, w: 200 } }).success).toBe(false)
  })
})
