import React from 'react'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { assertOverlayInvariants, overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { headlineState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => headlineState(object, events, frame)
describe('headline', () => {
  it('obeys the shared rendered brand invariants', () => {
    assertOverlayInvariants(Device, object, events, 'headline')
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
    expect(headlineState(object, [...events, again], 140)).toMatchObject({ visible: true, enter: 1, exit: 0 })
    expect(headlineState(object, [...events].reverse(), 40)).toEqual(at(40))
    at(140)
    expect(headlineState(object, [...events, { ...events[0]!, obj: 'other', atFrame: 35 }], 40)).toEqual(at(40))
  })
})

import { headlineLayout } from './index'
import { renderToStaticMarkup } from 'react-dom/server'
it('shrinks long headlines within the locked type range without overflow', () => {
  const short = headlineLayout(['HI'], 888)
  const long = headlineLayout(['COUNTRY TEST'], 888)
  expect(short.size).toBe(240)
  expect(long.size).toBeLessThan(short.size)
  expect(long.size).toBeGreaterThanOrEqual(150)
  expect(() => headlineLayout(['X'.repeat(100)], 888)).toThrow(/150px/)
  expect(() => headlineLayout(['HI'], 40)).toThrow(/150px/)
})
it('staggers two lines by three frames, colours just one word, and places its dek', () => {
  const render = (frame: number, params = object.params) => renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object: { ...object, params }, events, frame }))
  expect(render(11)).toContain('opacity:0;transform:translateY(24px)')
  expect(render(25)).toContain('14px 14px')
  expect((render(25).match(/skewX/g) ?? []).length).toBe(1)
  expect(render(25)).toContain('font-style:italic')
  expect(render(25, { lines: ['HI'], dek: 'A human line.' })).toContain('left:')
})

it('lets a splash title take a taller room, and nothing else', () => {
  const lines = ['TWO', 'PASSPORTS']
  const zone = headlineLayout(lines, 878, 0)
  const splash = headlineLayout(lines, 878, 0, 373)
  expect(zone.size).toBeLessThanOrEqual(153)
  expect(splash.size).toBeGreaterThanOrEqual(200)
  expect(splash.size).toBeLessThanOrEqual(240)
  expect(splash.height).toBeLessThanOrEqual(373)
  expect(() => headlineLayout(['X'.repeat(100)], 888, -1, 373)).toThrow(/150px/)
})

it('puts an ink panel behind the dek only when asked', () => {
  const withDek = (extra: object) => ({ ...object, params: { ...object.params, dek: 'A short human line.', dekAt: { x: 72, y: 460, w: 600 }, ...extra } })
  const html = (o: typeof object) => renderToStaticMarkup(React.createElement(Device, { object: o, events, tokens: { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }, box: { left: 0, top: 0, width: 1080, height: 1920 }, aspect: '9:16', frame: 60 }))
  expect(html(withDek({}))).not.toContain('data-dek-back')
  expect(html(withDek({ dekBack: true }))).toContain('data-dek-back')
})

import { createHash } from 'node:crypto'
import { setMotionProfile } from '../../clock'
import { resolveMotion } from '../../kit/motionProfiles'

it('preserves the original default markup at every frame in both shapes and motion styles', () => {
  const hash = createHash('sha256')
  try {
    for (const module of [undefined, 'living-ui']) {
      setMotionProfile(module ? resolveMotion({ style: module }) : undefined)
      for (const aspect of ['9:16', '16:9'] as const) {
        for (let frame = 0; frame <= 180; frame++) {
          hash.update(renderToStaticMarkup(React.createElement(Device, {
            ...overlayTestProps, aspect, object, events, frame,
          })))
        }
      }
    }
  } finally { setMotionProfile(undefined) }
  expect(hash.digest('hex')).toMatchInlineSnapshot(`"748db0650566c2fc32018ad05ca28be79c74e0fa3b5313d9830d08c25f103af5"`)
})

import { setActiveCanvas } from '../../kit/lock'
import { ParamsSchema } from './schema'
it('accepts only the explicit assemble reveal', () => {
  expect(ParamsSchema.safeParse({ lines: ['WORDS'], reveal: 'assemble' }).success).toBe(true)
  for (const reveal of ['word', 'typewriter', '', null, 1]) {
    expect(ParamsSchema.safeParse({ lines: ['WORDS'], reveal }).success).toBe(false)
  }
})
it('assembles every word once in reading order within ten frames, overriding typing in both shapes', () => {
  const params = { lines: ['WORDS LAND', 'IN PLACE'], reveal: 'assemble', swipe: { line: 0, word: 0 }, dek: 'A human line.' }
  try {
    setMotionProfile(resolveMotion({ style: 'living-ui' }))
    for (const aspect of ['9:16', '16:9'] as const) {
      setActiveCanvas(aspect === '9:16' ? 1080 : 1920, aspect === '9:16' ? 1920 : 1080)
      const render = (frame: number) => renderToStaticMarkup(React.createElement(Device, {
        ...overlayTestProps, aspect, object: { ...object, params }, events, frame,
        box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 },
      }))
      for (let age = 0; age <= 30; age++) {
        const html = render(10 + age)
        const words = [...html.matchAll(/data-assemble-word="(\d+)" style="([^"]+)"/g)]
        expect(words).toHaveLength(4)
        words.forEach(([, index, style]) => {
          const scale = Number(style!.match(/scale\(([^)]+)\)/)![1])
          const offset = Number(style!.match(/translateX\(([^p]+)px\)/)![1])
          expect(scale).toBeGreaterThanOrEqual(1)
          expect(scale).toBeLessThanOrEqual(1.3)
          expect(Math.abs(offset)).toBeLessThanOrEqual(24)
          if (age <= Number(index)) expect(style).toContain('opacity:0;')
          if (age >= Number(index) + 7) {
            expect(scale).toBe(1)
            expect(offset).toBe(0)
            expect(style).toContain('opacity:1;')
          }
        })
        if (age < 10) expect(html).not.toContain('skewX')
        else expect(html).toContain('skewX')
      }
      expect(render(20)).toBe(render(40))
      expect(render(106)).toBe('')
      const again = { ...events[0]!, id: 'again', atFrame: 120 }
      expect(renderToStaticMarkup(React.createElement(Device, {
        ...overlayTestProps, aspect, object: { ...object, params }, events: [...events, again], frame: 120,
      }))).toContain('scale(1.3)')
    }
  } finally { setMotionProfile(undefined); setActiveCanvas(1080, 1920) }
})
