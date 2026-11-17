import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { Device } from './index'
import { filmState, grainSample } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => filmState(object, events, frame)
const tokens = { ink: 'black', inkDeep: 'navy', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }
const still = (frame: number, aspect: '9:16' | '16:9') => renderToStaticMarkup(React.createElement(Device, { object, events, frame, aspect, tokens, box: aspect === '9:16' ? { left: 60, top: 270, width: 800, height: 1050 } : { left: 96, top: 208, width: 1728, height: 700 } }))

describe('film_frame', () => {
  it('warms up, rings and lifts only on cues, cuts plates and collapses within 18 frames', () => {
    expect(at(9).visible).toBe(false)
    expect(at(10).warm).toBe(0)
    expect(at(28).warm).toBe(1)
    expect(at(29).mark).toBeUndefined()
    expect(at(35).marked).toBe(1)
    expect(at(44).region).toBeUndefined()
    expect(at(63).lifted).toBe(1)
    expect(at(69).plateIndex).toBe(0)
    expect(at(70)).toMatchObject({ plateIndex: 1, mark: undefined, region: undefined })
    expect(at(106).visible).toBe(false)
    expect(at(50).push).toBeGreaterThan(at(49).push)
  })
  it('has deterministic frame-seeded grain and weave, including backward seeking', () => {
    const first = at(49)
    at(90)
    expect(at(49)).toEqual(first)
    expect(Array.from({ length: 40 }, (_, i) => grainSample(49, i))).not.toEqual(Array.from({ length: 40 }, (_, i) => grainSample(50, i)))
    expect(at(49).weaveX).not.toBe(at(50).weaveX)
  })
  it.each(['9:16', '16:9'] as const)('renders deterministic %s stills and provenance for each plate', aspect => {
    expect(still(40, aspect)).toBe(still(40, aspect))
    expect(still(40, aspect)).not.toBe(still(41, aspect))
    expect(still(40, aspect)).toContain('1991')
    expect(still(40, aspect)).toContain('Archive photo')
    expect(still(80, aspect)).toContain('2001')
    expect(still(80, aspect)).toContain('Archived screenshot')
    expect(still(50, aspect)).toContain('data-present')
    // Texture lives inside the picture; provenance and clean evidence are sibling layers above it.
    expect(still(40, aspect).indexOf('data-provenance')).toBeGreaterThan(still(40, aspect).indexOf('data-texture'))
    for (const match of still(50, aspect).matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      expect(['none', ...Object.values(tokens)]).toContain(match[1])
    }
  })
  it('requires real image inputs, provenance and bounded named regions', () => {
    expect(ParamsSchema.safeParse({ plates: [{ image: '', date: '1991', source: 'Archive' }] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ plates: [{ image: 'a.png', date: '1991' }] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, regions: { bad: { x: 0.9, y: 0, width: 0.5, height: 1 } } }).success).toBe(false)
    expect(() => filmState(object, [...events, { ...events[0]!, verb: 'move', toState: '99', atFrame: 80 }], 80)).toThrow('plate index')
  })
})
