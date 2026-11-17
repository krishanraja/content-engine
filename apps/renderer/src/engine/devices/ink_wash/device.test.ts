import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { washState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'navy', inkDeep: 'navy', inkSoft: 'slategray', cream: 'ivory', mint: 'seagreen', channel: 'coral' }
const markup = (frame: number, aspect: '9:16' | '16:9' = '9:16') => renderToStaticMarkup(React.createElement(Device, { object, events, tokens, frame, aspect, box: { left: 60, top: 270, width: aspect === '9:16' ? 800 : 1800, height: 1000 } }))

describe('ink_wash', () => {
  it('preserves the supplied picture as the subject in both authored aspects', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const svg = markup(55, aspect)
      expect(svg).toContain('href="/evidence/reflective-portrait.jpg"')
      expect(svg).toContain('preserveAspectRatio="xMidYMid meet"')
      expect(svg).toContain(`data-aspect="${aspect}"`)
      expect(svg).not.toMatch(/NaN|undefined|<text|caption/)
    }
  })
  it('repeated frames and backward seeks reproduce the identical stroke and texture', () => {
    const first = markup(25)
    markup(80)
    expect(markup(25)).toBe(first)
    expect(markup(26)).not.toBe(first)
    expect(first).toContain('seed="26"')
  })
  it('blooms, draws, fills, highlights and dries on their events within 18 frames', () => {
    expect(markup(3)).toBe('')
    const at = (f: number) => washState(object, events, f)
    expect(at(4).bloom).toBe(0)
    expect(at(22).bloom).toBe(1)
    expect(at(38).amount(events[1])).toBe(1)
    expect(at(48).amount(events[2])).toBe(1)
    expect(at(58).amount(events[3])).toBe(1)
    expect(at(89).dry).toBe(0)
    expect(at(108).dry).toBe(1)
    expect(markup(108)).toContain('rx="0"')
    expect(markup(180)).toBe('')
    expect(washState(object, [...events].reverse(), 45).fired).toEqual(at(45).fired)
  })
  it('uses supplied token colours for all painted surfaces', () => {
    const svg = markup(55)
    for (const match of svg.matchAll(/(?:fill|stroke|stop-color)="([^"]+)"/g)) {
      expect([...Object.values(tokens), 'none'].includes(match[1]!) || match[1]!.startsWith('url(')).toBe(true)
    }
  })
  it('requires evidence, rejects arbitrary colours and duplicate targets', () => {
    expect(ParamsSchema.safeParse({ images: [] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, colour: 'pink' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, strokes: [{ id: 'a', d: 'M0 0' }, { id: 'a', d: 'M1 1' }] }).success).toBe(false)
  })
})
