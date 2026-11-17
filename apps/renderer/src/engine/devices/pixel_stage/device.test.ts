import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import type { DeviceProps } from '../types'
import { labelWidth, palettePixels, pixelGeometry, StageSVG, stageLayout, stageState, drawCanvas } from './index'
import fixture from './fixture.json'
const tokens = { ink: 'navy', inkDeep: 'midnightblue', inkSoft: 'slategray', cream: 'ivory', mint: 'seagreen', channel: 'coral' }
function props(aspect: DeviceProps['aspect'] = '9:16'): DeviceProps {
  return { object: EngineObjectSchema.parse(fixture.objects[0]), events: fixture.events.map(e => EngineEventSchema.parse(e)), aspect, frame: 65, tokens,
    box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } }
}
function raster(p: DeviceProps) {
  const s = stageLayout(p).sprites[0]!
  return { proof: { width: s.w, height: s.h, data: new Uint8ClampedArray(s.w * s.h * 4).fill(255) } }
}
describe('pixel_stage', () => {
  it('fills at least one threshold in both aspects and image shapes using one sample per logical pixel', () => {
    for (const aspect of ['9:16', '16:9'] as const) for (const [w, h] of [[1280,720], [720,1280]]) {
      const p = props(aspect)
      p.object.params.images = { proof: { src: '/evidence/photo.png', pixelWidth: w, pixelHeight: h } }
      const g = stageLayout(p), s = g.sprites[0]!
      expect(s.w >= g.width * .6 - .5 || s.h >= g.height * .7 - .5).toBe(true)
      expect(s.w / s.h).toBeCloseTo(w! / h!, 1)
    }
  })
  it('maps opaque pixels to tokens and discards transparent evidence pixels', () => {
    const colors = palettePixels({ width: 4, height: 1, data: [0,0,0,255,128,128,128,255,255,255,255,255,0,0,0,0] }, tokens)
    expect(colors.map(q => q.color)).toEqual([tokens.ink, tokens.mint, tokens.cream])
  })
  it('moves on whole sprite cells and holds on twos', () => {
    const p = props()
    for (let frame = 30; frame < 48; frame++) {
      const s = stageState({ ...p, frame }).sprites[0]!
      expect(s.x / s.w).toBe(Math.round(s.x / s.w)); expect(s.y / s.h).toBe(Math.round(s.y / s.h))
    }
    expect(stageState({ ...p, frame: 36 })).toEqual(stageState({ ...p, frame: 37 }))
  })
  it('lands the six events and powers down completely', () => {
    const p = props()
    expect(stageState({ ...p, frame: 5 }).sprites[0]!.pop).toBe(0)
    expect(stageState({ ...p, frame: 24 }).sprites[0]!.pop).toBe(1)
    expect(stageState({ ...p, frame: 68 }).score).toBe(42)
    expect(stageState({ ...p, frame: 76 }).sprites[0]!.mint).toBe(true)
    expect(stageState({ ...p, frame: 94 }).sprites[0]!.mint).toBe(false)
    expect(stageState({ ...p, frame: 168 }).visible).toBe(false)
  })
  // Claude's check of the rebuild (17 Nov): on a wide frame the sprite lands on the first cell, under the count, and the
  // count was cream on the cream picture. It now has an ink backing that covers both lines, drawn above the sprites.
  it('draws the count and its source on an ink backing, above the sprites, in both shapes', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const p = props(aspect), rasters = raster(p), g = pixelGeometry(p, rasters)
      const svg = renderToStaticMarkup(React.createElement(StageSVG, { ...p, rasters }))
      const backing = /<rect data-label-backing="" x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"[^>]*fill="navy"/.exec(svg)
      expect(backing).not.toBeNull()
      const [x, y, w, h] = backing!.slice(1).map(Number)
      expect(x!).toBeLessThanOrEqual(g.labelX); expect(x! + w!).toBeGreaterThanOrEqual(g.labelX + labelWidth(g))
      expect(y!).toBeLessThanOrEqual(g.labelY - 30); expect(y! + h!).toBeGreaterThanOrEqual(g.labelY + 36)
      expect(svg.indexOf('data-label-backing')).toBeGreaterThan(svg.lastIndexOf('width="1" height="1"'))
    }
  })
  it('renders identical stills in both shapes with constant sixfold pixels and token-only surfaces', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const p = props(aspect), rasters = raster(p)
      const render = () => renderToStaticMarkup(React.createElement(StageSVG, { ...p, rasters }))
      const first = render(); expect(render()).toBe(first)
      expect(first).toContain('scale(6)'); expect(first).toContain('width="1" height="1"')
      for (const m of first.matchAll(/fill="([^"]+)"/g)) expect(Object.values(tokens)).toContain(m[1])
      const g = pixelGeometry(p, rasters)
      if (aspect === '9:16') { expect(g.labelX).toBeGreaterThanOrEqual(60); expect(g.labelX + 760).toBeLessThanOrEqual(860); expect(g.labelY + 30).toBeLessThan(1090) }
      const rects: number[][] = []
      const ctx = new Proxy({}, { get: (_, k) => k === 'fillRect' ? (...args: number[]) => rects.push(args) : () => {} , set: () => true }) as CanvasRenderingContext2D
      drawCanvas(ctx, p, rasters)
      expect(rects.length).toBe(g.pixels.length + 1)
      expect(rects.slice(1)).toEqual(g.pixels.map(q => [q.x, q.y, 1, 1]))
    }
  })
})
