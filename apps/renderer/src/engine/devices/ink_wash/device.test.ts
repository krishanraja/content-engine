import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import { Device, INK_MATRIX, TALL_PICTURE, washLayout } from './index'
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
  // Claude's check of the Codex build (17 Nov): drawn in brand colours, the first build stretched a square drawing over
  // the slot (a tall picture squashed nearly two to one), flooded the space round a picture with solid ink, and left a
  // bare cream frame after its exit. Each test below fails on that build.
  it('draws at one scale: the viewBox is the box, and every picture keeps its own aspect in both shapes', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const box = aspect === '9:16' ? { left: 0, top: 0, width: 1080, height: 1920 } : { left: 0, top: 0, width: 1920, height: 1080 }
      const svg = renderToStaticMarkup(React.createElement(Device, { object, events, tokens, frame: 55, aspect, box }))
      expect(svg).toContain(`viewBox="0 0 ${box.width} ${box.height}"`)
      expect(svg).not.toContain('preserveAspectRatio="none"')
      for (const { image, rect } of washLayout({ object, box, aspect }).pictures) expect(rect.w / rect.h).toBeCloseTo(image.pixelWidth / image.pixelHeight)
    }
  })
  it('fills a tall slot from y 270 to the caption box foot at y 1320, edge to edge', () => {
    const { paper } = washLayout({ object, aspect: '9:16', box: { left: 0, top: 0, width: 1080, height: 1920 } })
    expect(paper).toEqual({ x: TALL_PICTURE.left, y: TALL_PICTURE.top, w: TALL_PICTURE.right - TALL_PICTURE.left, h: TALL_PICTURE.bottom - TALL_PICTURE.top })
  })
  it('turns dark pixels to ink and leaves empty and light pixels clear', () => {
    const row = INK_MATRIX.trim().split(/\s+/).map(Number).slice(15)
    const alpha = (r: number, g: number, b: number, a: number) => row[0]! * r + row[1]! * g + row[2]! * b + row[3]! * a + row[4]!
    expect(alpha(0, 0, 0, 0)).toBe(0)
    expect(alpha(1, 1, 1, 1)).toBeCloseTo(0)
    expect(alpha(0, 0, 0, 1)).toBe(1)
    expect(markup(55)).toContain(`values="${INK_MATRIX}"`)
  })
  it('keeps the paper inside the bloom, so nothing is left on screen once it has dried', () => {
    for (const frame of [5, 55, 108]) expect(markup(frame).split('</defs>')[1]!.startsWith('<g clip-path=')).toBe(true)
  })
  it('places washes and marks on the picture as drawn, not on the slot', () => {
    const box = { left: 0, top: 0, width: 1080, height: 1920 }
    const { pictures, marks } = washLayout({ object, aspect: '9:16', box })
    expect(marks).toEqual(pictures[0]!.rect)
    const svg = renderToStaticMarkup(React.createElement(Device, { object, events, tokens, frame: 55, aspect: '9:16', box }))
    const focus = fixture.objects[0]!.params.regions[0]!
    expect(svg).toContain(`cx="${marks.x + focus.x * marks.w}" cy="${marks.y + focus.y * marks.h}"`)
  })
  it('requires evidence, rejects arbitrary colours and duplicate targets', () => {
    expect(ParamsSchema.safeParse({ images: [] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, colour: 'pink' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, strokes: [{ id: 'a', d: 'M0 0' }, { id: 'a', d: 'M1 1' }] }).success).toBe(false)
  })
})
