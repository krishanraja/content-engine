import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import fixture from './fixture.json'
import { kineticLayout } from './index'
import { slotsFor } from '../../layouts'
import { kineticState } from './state'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map((event) => EngineEventSchema.parse(event))
const at = (frame: number) => kineticState(object, events, frame)

describe('kinetic_stat frame state', () => {
  it('counts from zero on its cue and reaches the dataset value at eighteen frames', () => {
    expect(at(9).visible).toBe(false)
    expect(at(10)).toMatchObject({ visible: true, value: 0 })
    expect(at(29).value).toBe(0)
    expect(at(30).value).toBe(0)
    expect(at(39).value).toBeGreaterThan(36)
    expect(at(39).value).toBeLessThan(72)
    expect(at(48).value).toBe(72)
    expect(at(120).value).toBe(72)
    expect(at(180).visible).toBe(false)
  })
  it('keeps the unit, denominator and producer label unchanged at every frame', () => {
    for (let frame = 0; frame < 180; frame++) expect(at(frame)).toMatchObject({ denominator: 100, unit: 'checks', producerLabel: 'Fixture audit' })
    expect(at(30).text).toBe('0/100')
    expect(at(48).text).toBe('72/100')
    expect(kineticState({ ...object, dataset: { ...object.dataset!, denominator: 0 } }, events, 48).text).toBe('72/0')
    expect(kineticState({ ...object, dataset: { ...object.dataset!, denominator: null } }, events, 48).text).toBe('72')
  })
  it('reads authored rows, never numbers invented in an event', () => {
    const altered = events.map((event) => event.verb === 'count_to' ? { ...event, toState: '9999' } : event)
    expect(kineticState(object, altered, 48).value).toBe(72)
    const rows = [...object.dataset!.rows, { label: 'other', value: -2.5 }]
    const selected = events.map((event) => event.verb === 'count_to' ? { ...event, toState: 'other' } : event)
    expect(kineticState({ ...object, dataset: { ...object.dataset!, rows } }, selected, 48).value).toBe(-2.5)
    expect(kineticState(object, [...events].reverse(), 39)).toEqual(at(39))
    expect(at(29).value).toBe(0)
  })
  it('requires a dataset instead of manufacturing evidence', () => {
    const { dataset: _dataset, ...missing } = object
    expect(() => kineticState(missing, events, 48)).toThrow('nonempty dataset')
    expect(() => kineticState({ ...object, dataset: { ...object.dataset!, rows: [] } }, events, 48)).toThrow('nonempty dataset')
  })
  it('can repeat a count on a new event and stays hidden after exit', () => {
    const repeat = { ...events[1]!, id: 'repeat', atFrame: 80 }
    expect(kineticState(object, [...events, repeat], 80).value).toBe(0)
    expect(kineticState(object, [...events, repeat], 98).value).toBe(72)
    const exit = { ...events[0]!, id: 'exit', verb: 'exit' as const, atFrame: 100 }
    expect(kineticState(object, [...events, repeat, exit], 120).visible).toBe(false)
  })
})

describe('kinetic stat stacked geometry', () => {
  it.each(['9:16', '16:9'] as const)('stacks number, unit and producer without overlap in %s', (aspect) => {
    const box = slotsFor('F1', aspect)[2]!
    const l = kineticLayout(box, '3/3', 'runs where DeepSeek deleted its Xinjiang answer', "KRISH'S TEST · 23 OCT", aspect)
    const rects = [l.number, l.unit, l.producer]
    for (const [i, rect] of rects.entries()) {
      expect(rect.left).toBeGreaterThanOrEqual(box.left)
      expect(rect.top).toBeGreaterThanOrEqual(box.top)
      expect(rect.left + rect.width).toBeLessThanOrEqual(box.left + box.width + 1e-8)
      expect(rect.top + rect.height).toBeLessThanOrEqual(box.top + box.height + 1e-8)
      if (i) expect(rect.top).toBeGreaterThanOrEqual(rects[i - 1]!.top + rects[i - 1]!.height)
    }
  })
})
