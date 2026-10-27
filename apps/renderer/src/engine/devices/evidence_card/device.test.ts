import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import fixture from './fixture.json'
import { ParamsSchema } from './schema'
import { evidenceState } from './state'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map((event) => EngineEventSchema.parse(event))
const at = (frame: number) => evidenceState(object, events, frame)

describe('evidence_card frame state', () => {
  it('enters from its cell over twelve frames and fills only on cue', () => {
    expect(at(9).visible).toBe(false)
    expect(at(10)).toMatchObject({ visible: true, enter: 0, text: '' })
    expect(at(22).enter).toBe(1)
    expect(at(24).text).toBe('')
    expect(at(25).text).toBe('')
    expect(at(30).text).toBe('Check')
    expect(at(49).text).toBe('Checked source')
  })
  it('strikes and collapses in six frames, then types the marked replacement', () => {
    expect(at(50)).toMatchObject({ struck: true, collapse: 0, text: 'Checked source' })
    expect(at(53).collapse).toBeCloseTo(0.5)
    expect(at(56)).toMatchObject({ struck: true, collapse: 1, media: false })
    expect(at(65)).toMatchObject({ struck: false, collapse: 0, text: '' })
    expect(at(69).text).toBe('New ')
    expect(at(73).text).toBe('New line')
    expect(at(120).text).toBe('New line')
  })
  it('preserves provenance through all states and backward seeks', () => {
    for (const frame of [10, 25, 50, 56, 65, 100]) expect(at(frame).params).toMatchObject({ outlet: 'Fixture source', date: '2026-10-27' })
    at(120)
    expect(at(30).text).toBe('Check')
    expect(evidenceState(object, [...events].reverse(), 73)).toEqual(at(73))
    expect(at(180).visible).toBe(false)
  })
  it('starts recording playback at fill with its authored source trim', () => {
    const video = { ...object, params: { kind: 'recording', src: 'fixture.mp4', outlet: 'Fixture camera', date: '2026-10-27', trimBefore: 42 } }
    expect(evidenceState(video, events, 24).media).toBe(false)
    expect(evidenceState(video, events, 25)).toMatchObject({ media: true, playbackFrom: 25, params: { trimBefore: 42 } })
    expect(evidenceState(video, events, 56).media).toBe(false)
    expect(evidenceState(video, events, 73)).toMatchObject({ media: false, text: 'New line' })
  })
  it('requires provenance and the content appropriate to each kind', () => {
    expect(ParamsSchema.safeParse({ kind: 'screenshot', src: 'proof.png', date: 'today' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ kind: 'quote', outlet: 'Source', date: 'today' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ kind: 'recording', outlet: 'Source', date: 'today' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ kind: 'document', src: 'proof.png', outlet: 'Source', date: 'today' }).success).toBe(true)
  })
  it('shows still evidence on enter, keeps its source on stamp, and clears it for a mark', () => {
    const still = { ...object, params: { kind: 'screenshot', src: 'proof.png', outlet: 'Fixture source', date: '2026-10-27' } }
    expect(evidenceState(still, events, 9).media).toBe(false)
    expect(evidenceState(still, events, 22).media).toBe(true)
    expect(evidenceState(still, events, 56)).toMatchObject({ media: false, struck: true, params: { outlet: 'Fixture source' } })
    expect(evidenceState(still, events, 73)).toMatchObject({ media: false, text: 'New line' })
  })
  it('uses event order for a stamp and mark on the same frame', () => {
    const commands = events.map((event) => event.verb === 'mark' ? { ...event, atFrame: 50 } : event)
    expect(evidenceState(object, commands, 58)).toMatchObject({ struck: false, text: 'New line' })
    const exit = { ...events[0]!, id: 'exit', verb: 'exit' as const, atFrame: 80 }
    expect(evidenceState(object, [...events, exit], 90).visible).toBe(false)
  })
})
