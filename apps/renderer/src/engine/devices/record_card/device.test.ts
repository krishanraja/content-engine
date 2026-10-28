import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import fixture from './fixture.json'
import { ParamsSchema } from './schema'
import { recordState } from './state'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map((event) => EngineEventSchema.parse(event))
const at = (frame: number) => recordState(object, events, frame)

describe('record_card frame state', () => {
  it('drops on enter and holds through unrelated events', () => {
    expect(at(9).visible).toBe(false)
    expect(at(10)).toMatchObject({ visible: true, drop: 0 })
    expect(at(14).drop).toBeGreaterThan(0)
    expect(at(18).drop).toBe(1)
    expect(at(100).drop).toBe(1)
    expect(at(180).visible).toBe(false)
  })
  it('restamps only the named field with a five-frame slap', () => {
    expect(at(29).fields.map((field) => field.value)).toEqual(['Pending', 'Team'])
    expect(at(30).fields[0]).toMatchObject({ value: 'Checked', scale: 1.12 })
    expect(at(32).fields[0]!.scale).toBeGreaterThan(1)
    expect(at(35).fields[0]).toMatchObject({ value: 'Checked', scale: 1 })
    expect(at(100).fields[1]).toMatchObject({ value: 'Team', scale: 1, stamped: false })
  })
  it('ignores other objects and unknown keys, preserves equals signs in values, and supports seek', () => {
    const extra = [
      { ...events[1]!, id: 'foreign', obj: 'other', toState: 'owner=Wrong', atFrame: 40 },
      { ...events[1]!, id: 'unknown', toState: 'missing=Wrong', atFrame: 40 },
      { ...events[1]!, id: 'replace', toState: 'cost=A=B', atFrame: 45 },
    ]
    expect(recordState(object, [...events, ...extra].reverse(), 60).fields.map((field) => field.value)).toEqual(['A=B', 'Team'])
    expect(at(29).fields[0]!.value).toBe('Pending')
    expect(object.params).toEqual(fixture.objects[0]!.params)
  })
  it('refuses ambiguous duplicate keys', () => {
    expect(ParamsSchema.safeParse({ fields: [{ key: 'x', label: 'One', value: '' }, { key: 'x', label: 'Two', value: '' }] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ fields: [{ key: 'a=b', label: 'Ambiguous', value: '' }] }).success).toBe(false)
  })
  it('stays hidden after exit even if another field is stamped', () => {
    const exit = { ...events[0]!, id: 'exit', verb: 'exit' as const, atFrame: 60 }
    const stamp = { ...events[1]!, id: 'later-stamp', atFrame: 70 }
    expect(recordState(object, [...events, exit, stamp], 80).visible).toBe(false)
  })
})
