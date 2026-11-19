import React from 'react'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { assertOverlayInvariants, overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { stampState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => stampState(object, events, frame)
describe('stamp', () => {
  it('obeys the shared rendered brand invariants', () => {
    assertOverlayInvariants(Device, object, events, 'stamp')
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
    expect(stampState(object, [...events, again], 140)).toMatchObject({ visible: true, enter: 1, exit: 0 })
    expect(stampState(object, [...events].reverse(), 40)).toEqual(at(40))
    at(140)
    expect(stampState(object, [...events, { ...events[0]!, obj: 'other', atFrame: 35 }], 40)).toEqual(at(40))
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
it('slaps only on stamp and renders all verdict treatments with a part leader', () => {
  expect(at(10).scale).toBe(1.25)
  expect(at(15).scale).toBe(1)
  const wrong = [{ ...events[0]!, verb: 'enter' as const }]
  expect(stampState(object, wrong, 40).visible).toBe(false)
  for (const kind of ['outline', 'block', 'dashed']) {
    const html = renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object: { ...object, params: { ...object.params, kind } }, events, frame: 40 }))
    expect(html).toContain('<line')
    expect(html).toContain('<circle')
    expect(html).toContain(`3px ${kind === 'dashed' ? 'dashed' : 'solid'}`)
  }
})

it('uses mint for answer blocks and preserves channel paint by default', () => {
  for (const paint of [undefined, 'channel', 'mint']) {
    const params = { ...object.params, kind: 'block', ...(paint ? { paint } : {}) }
    const html = renderToStaticMarkup(React.createElement(Device, {
      ...overlayTestProps, object: { ...object, params }, events, frame: 40,
    }))
    expect(html).toContain(`background:${paint === 'mint' ? overlayTestProps.tokens.mint : overlayTestProps.tokens.channel}`)
    const colour = paint === 'mint' ? overlayTestProps.tokens.mint : overlayTestProps.tokens.channel
    expect(html).toContain(`background-color:${colour}`)
    expect(html).toContain(`background-image:radial-gradient(circle at 7px 7px, color-mix(in srgb, ${overlayTestProps.tokens.ink} 38%, ${colour}) 1.5px, ${colour} 1.9px)`)
    if (paint === 'mint') expect(html).not.toContain(overlayTestProps.tokens.channel)

  }
})

it('lands a worn hero stamp on its cue and holds it until the usual exit', () => {
  const hero = { ...object, params: {
    kind: 'outline', size: 'hero', paint: 'mint', main: 'void', top: 'the ai did it', tiltDeg: -6,
    at: { x: 140, y: 640, w: 800, h: 380 },
  } }
  const state = (frame: number) => stampState(hero, events, frame)
  const draw = (frame: number, stamp = hero, cues = events) => renderToStaticMarkup(React.createElement(Device, {
    ...overlayTestProps, object: stamp, events: cues, frame,
  }))
  expect(draw(9)).toBe('')
  expect(state(10)).toMatchObject({ scale: 1.35, opacity: 0 })
  expect(state(11).opacity).toBeGreaterThan(0)
  expect(state(11).opacity).toBeLessThan(1)
  expect(state(13).scale).toBeLessThan(1)
  expect(state(14)).toMatchObject({ scale: 1, opacity: 1 })
  const settled = draw(14)
  expect(draw(99)).toBe(settled)
  expect(state(103).opacity).toBe(1 - at(103).exit)
  expect(draw(106)).toBe('')
  expect(settled).toContain('rotate(-6deg) scale(1)')
  expect(settled).toContain('12px solid aquamarine')
  expect(settled).toContain('2px solid aquamarine')
  expect(settled).toContain('mask-repeat:no-repeat')
  const texture = (markup: string) => decodeURIComponent(markup.match(/data:image\/svg\+xml,([^&]+)&quot;/)?.[1] ?? '')
  const mask = texture(settled)
  expect(mask.includes('stroke-opacity="0.85"')).toBe(true)
  expect(mask.includes('<feGaussianBlur')).toBe(true)
  expect(texture(draw(11)) === mask).toBe(true)
  const otherId = 'another-stamp'
  expect(texture(draw(14, { ...hero, obj: otherId }, events.map(event => ({ ...event, obj: otherId })))) === mask).toBe(false)
  expect(settled).toContain('font-weight:900')
  expect(settled).toContain('MYMU Archivo')
  expect(settled).toContain('IBM Plex Mono')
  expect(settled).toContain('font-size:44px;font-weight:700;letter-spacing:0.12em">THE AI DID IT<')
  expect(settled).toContain('gap:20px')
  expect(settled).toContain('>VOID<')
  expect(settled).not.toMatch(/ivory|text-shadow|text-stroke|Anton|Fraunces/)
})
