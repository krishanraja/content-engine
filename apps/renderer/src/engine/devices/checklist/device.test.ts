import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { fitBox, fitScale } from '../../fit'
import { markRegion } from '../../kit/layout'
import { DEVICES } from '../registry'
import manifest from '../../../../../../config/ve/devices.json'
import { Device, checklistLayout } from './index'
import { ParamsSchema } from './schema'
import { checklistState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(event => EngineEventSchema.parse(event))
const at = (frame: number) => checklistState(object, events, frame)
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aquamarine', channel: 'coral' }
const box = { left: 60, top: 280, width: 800, height: 780 }
const still = (frame: number) => renderToStaticMarkup(Device({ object, events, box, tokens, frame, aspect: '9:16' }))

describe('checklist blank arrival and event-driven fill', () => {
  it('arrives blank with each numbered slot starting exactly two frames apart', () => {
    expect(at(9).visible).toBe(false)
    for (let index = 0; index < 4; index++) {
      const start = 10 + index * 2
      expect(at(start).slots[index]!.arrival).toBe(0)
      expect(at(start + 1).slots[index]!.arrival).toBeGreaterThan(0)
      expect(at(start + 7).slots[index]!.arrival).toBe(1)
    }
    expect(at(29).slots.map(slot => slot.line)).toEqual(['', '', '', ''])
    expect(still(29)).not.toContain('data-tick')
    expect(still(29)).not.toContain('Data rights')
    expect(still(29)).toContain('Fixture editorial checklist')
    expect(at(29).slots.map(slot => slot.number)).toEqual(object.dataset!.rows.map(row => row.value))
  })

  it('fills only the named slot on each event, independent of visual order', () => {
    for (const [frame, ids] of [[29, []], [30, ['slot-3']], [50, ['slot-1', 'slot-3']],
      [70, ['slot-1', 'slot-3', 'slot-4']], [90, ['slot-1', 'slot-2', 'slot-3', 'slot-4']]] as const) {
      expect(at(frame).slots.filter(slot => slot.filled).map(slot => slot.id)).toEqual(ids)
    }
    expect(at(30).slots[2]).toMatchObject({ line: 'Exit costs', dissolve: 0 })
    expect(at(34).slots[2]!.dissolve).toBe(0.5)
    expect(at(38).slots[2]!.dissolve).toBe(1)
    expect(still(34)).toContain('stroke-dashoffset="0.5"')
    expect(still(38)).toContain('stroke-dashoffset="0"')
    expect(still(38)).toContain('stroke="aquamarine"')
    expect((still(38).match(/data-tick/g) ?? []).length).toBe(1)
  })

  it('is deterministic on seeks, ignores other objects and retains provenance', () => {
    at(140)
    expect(checklistState(object, [...events].reverse(), 34)).toEqual(at(34))
    const foreign = { ...events[1]!, obj: 'other', toState: 'slot-2', atFrame: 20 }
    expect(checklistState(object, [...events, foreign], 29)).toEqual(at(29))
    for (const frame of [10, 30, 50, 90, 150]) {
      expect(at(frame)).toMatchObject({ producerLabel: 'Fixture editorial checklist', unit: 'question', denominator: 4 })
    }
    expect(still(9)).toBe('')
    expect(at(154).exit).toBe(0.5)
    expect(still(158)).toBe('')
    expect(at(180).visible).toBe(false)
  })

  it('clears on re-entry and does not restart a filled slot on duplicate or unknown cues', () => {
    const duplicate = { ...events[1]!, id: 'repeat', atFrame: 40 }
    expect(checklistState(object, [...events, duplicate], 42).slots[2]!.dissolve).toBe(1)
    const unknown = { ...duplicate, toState: 'missing' }
    expect(checklistState(object, [...events, unknown], 42)).toEqual(at(42))
    const reenter = { ...events[0]!, id: 'again', atFrame: 160 }
    expect(checklistState(object, [...events, reenter], 170).slots.every(slot => !slot.filled)).toBe(true)
  })

  it('supports six slots and refuses missing provenance or invalid slot definitions', () => {
    const slots = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, line: `Answer ${i}` }))
    expect(ParamsSchema.safeParse({ slots }).success).toBe(true)
    expect(ParamsSchema.safeParse({ slots: [] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ slots: [...slots, { id: 'extra', line: 'Extra' }] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ slots: [slots[0], slots[0]] }).success).toBe(false)
    expect(() => checklistState({ ...object, dataset: undefined }, events, 20)).toThrow('dataset.rows')
    const six = { ...object, params: { slots }, dataset: { ...object.dataset!, rows: slots.map((slot, i) => ({ label: slot.id, value: i + 1 })) } }
    expect(checklistState(six, events, 21).slots[5]!.arrival).toBeGreaterThan(0)
    expect(checklistState(six, events, 20).slots[5]!.arrival).toBe(0)
    expect(DEVICES.checklist).toBe(Device)
    expect(manifest.devices.checklist.verbs).toEqual(['enter', 'fill', 'exit'])
  })

  it.each(['9:16', '16:9'] as const)('fits stable final geometry and grows in a %s region', aspect => {
    const region = markRegion({ left: 60, top: 280, width: 1400, height: 1000 })
    const layout = checklistLayout(region, object, aspect)
    const fitted = fitBox(layout.natural, region)
    expect(fitScale(layout.natural, region)).toBeGreaterThan(1)
    expect(fitted.left).toBeGreaterThanOrEqual(region.left)
    expect(fitted.top).toBeGreaterThanOrEqual(region.top)
    expect(fitted.left + fitted.width).toBeLessThanOrEqual(region.left + region.width + 1e-8)
    expect(fitted.top + fitted.height).toBeLessThanOrEqual(region.top + region.height + 1e-8)
    const render = (frame: number) => renderToStaticMarkup(Device({ object, events, box: region, tokens, aspect, frame }))
    expect(render(29)).toContain('data-region-fit')
    const sizing = render(29).split('data-device')[0]
    expect(render(100).split('data-device')[0]).toBe(sizing)
    const long = { ...object, params: { slots: [{ id: 'long', line: 'LongUnbrokenText'.repeat(12) }] } }
    expect(checklistLayout(box, long, aspect).heights[0]).toBeGreaterThan(layout.heights[0]!)
  })
})
