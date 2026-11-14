import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import fixture from './fixture.json'
import { Device, kineticLayout } from './index'
import { HOUSE_FONTS } from '../../../house/geometry'
import { MOTION } from '../../clock'
import { ParamsSchema } from './schema'
import { slotsFor } from '../../layouts'
import { kineticState } from './state'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map((event) => EngineEventSchema.parse(event))
const at = (frame: number) => kineticState(object, events, frame)

describe('optional count-down ghost', () => {
  const ghostObject = { ...object, params: { ghost: true }, dataset: { ...object.dataset!, rows: [
    { label: 'passed', value: 72 }, { label: 'lower', value: 24 }, { label: 'lowest', value: 12 },
  ] } }
  const down = EngineEventSchema.parse({ id: 'down', obj: object.obj, verb: 'count_to', toState: 'lower', atFrame: 80 })
  const timeline = [...events, down]
  const state = (frame: number) => kineticState(ghostObject, timeline, frame)

  it('accepts only an optional boolean', () => {
    expect(ParamsSchema.parse({})).toEqual({})
    expect(ParamsSchema.parse({ ghost: false })).toEqual({ ghost: false })
    expect(() => ParamsSchema.parse({ ghost: 'true' })).toThrow()
  })
  it('appears only after a downward count and holds through carry to the end', () => {
    for (const frame of [10, 29, 30, 48, 79, 80]) expect(state(frame).ghostText).toBeNull()
    expect(state(80).value).toBe(72)
    expect(state(81).value).toBeLessThan(72)
    expect(state(81).value).toBeGreaterThan(24)
    for (const frame of [81, 98, 179]) expect(state(frame).ghostText).toBe('72/100')
    expect(state(98).value).toBe(24)
    expect(state(180).visible).toBe(false)
    const carry = { ...events[2]!, atFrame: 100 }
    expect(kineticState(ghostObject, [...timeline, carry], 120).ghostText).toBe('72/100')
    expect(kineticState(ghostObject, [...timeline].reverse(), 90)).toEqual(state(90))
  })
  it('preserves the old count and markup when absent or false', () => {
    for (const params of [{}, { ghost: false }]) {
      const legacy = { ...ghostObject, params }
      expect(kineticState(legacy, timeline, 80)).toMatchObject({ value: 0, ghostText: null })
      expect(kineticState(legacy, timeline, 98)).toMatchObject({ value: 24, ghostText: null })
    }
  })
  it('uses the displayed value for interrupted counts and the latest value for repeated drops', () => {
    const early = { ...down, atFrame: 35 }
    const previous = kineticState(ghostObject, events, 35).value
    expect(kineticState(ghostObject, [...events, early], 36).ghostText).toBe(`${previous}/100`)
    const next = { ...down, id: 'next', toState: 'lowest', atFrame: 120 }
    expect(kineticState(ghostObject, [...timeline, next], 121).ghostText).toBe('24/100')
    const reenter = { ...events[0]!, id: 'new-beat', atFrame: 120 }
    expect(kineticState(ghostObject, [...timeline, reenter], 121).ghostText).toBeNull()
  })
  it('preserves signed decimals and optional denominators', () => {
    const decimal = { ...ghostObject, dataset: { ...ghostObject.dataset, denominator: null, rows: [
      { label: 'passed', value: -2.5 }, { label: 'lower', value: -8.25 },
    ] } }
    expect(kineticState(decimal, timeline, 98)).toMatchObject({ value: -8.25, ghostText: '-2.5', unit: 'checks', producerLabel: 'Fixture audit' })
    expect(kineticState(ghostObject, timeline, 80 + MOTION.countFrames).value).toBe(24)
  })
  it.each(['9:16', '16:9'] as const)('renders a mono strike at 25 percent opacity, eight natural pixels up in %s', aspect => {
    const box = { left: 0, top: 0, width: 1920, height: 1920 }
    const props = { object: ghostObject, events: timeline, box, aspect, frame: 98,
      tokens: { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' } }
    const html = renderToStaticMarkup(createElement(Device, props))
    const ghost = html.match(/<div data-kinetic-ghost=""[^>]*>72\/100<\/div>/)?.[0]
    expect(ghost).toBeDefined()
    expect(ghost).toContain('opacity:0.25')
    expect(ghost).toContain('text-decoration:line-through')
    expect(ghost).toContain(`font-family:${HOUSE_FONTS.data.replaceAll('"', '&quot;')}`)   // markup escapes the quotes
    const l = kineticLayout(box, '24/100', 'checks', 'Fixture audit', aspect, ['72/100', '24/100', '12/100'])
    const top = l.number.top - 8 * l.scale
    expect(ghost).toContain(top === 0 ? 'top:0;' : `top:${top}px`)   // React writes a zero without its unit
    for (const frame of [79, 80, 180]) expect(renderToStaticMarkup(createElement(Device, { ...props, frame }))).not.toContain('data-kinetic-ghost')
    for (const params of [{}, { ghost: false }]) expect(renderToStaticMarkup(createElement(Device, {
      ...props, object: { ...ghostObject, params },
    }))).not.toContain('data-kinetic-ghost')
  })
})

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
    const l = kineticLayout(box, '3/3', 'runs where DeepSeek deleted its Xinjiang answer', "OUR TEST · 23 OCT", aspect)
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
