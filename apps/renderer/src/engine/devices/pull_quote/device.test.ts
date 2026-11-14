import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { markRegion, MAX_GROW } from '../../kit/layout'
import { assertOverlayMarkup, overlayTestProps } from '../../kit/overlayInvariants'
import { DEVICES } from '../registry'
import type { DeviceProps } from '../types'
import manifest from '../../../../../../config/ve/devices.json'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { pullQuoteState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const state = (frame: number) => pullQuoteState(object, events, frame)
const render = (frame: number, extra: Partial<DeviceProps> = {}) => renderToStaticMarkup(
  React.createElement(Device, { ...overlayTestProps, object, events, frame, ...extra }))

describe('pull_quote', () => {
  it('registers exactly the two authored verbs and validates its fixture', () => {
    expect(DEVICES.pull_quote).toBe(Device)
    expect(manifest.devices.pull_quote.verbs).toEqual(['enter', 'highlight'])
    expect(ParamsSchema.safeParse(object.params).success).toBe(true)
    expect(ParamsSchema.safeParse({ ...object.params, quote: '   ' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, date: '' }).success).toBe(false)
  })

  it('shows grey first, then reveals each word only on its own spoken cue', () => {
    expect(render(9)).toBe('')
    expect(state(19).words.map(w => w.reveal)).toEqual([0, 0, 0, 0, 0])
    expect(state(20).words[0]!.reveal).toBe(0)
    expect(state(25).words[0]!.reveal).toBeCloseTo(0.5)
    expect(state(30).words.map(w => w.reveal)).toEqual([1, 0.1, 0, 0, 0])
    // The authored pause between makes and the is preserved; no fixed word stagger.
    expect(state(46).words.map(w => w.reveal)).toEqual([1, 1, 0, 0, 0])
    expect(state(85).words.map(w => w.reveal)).toEqual([1, 1, 1, 1, 1])
    const grey = render(19)
    expect(grey.match(/data-reveal="0"/g)).toHaveLength(5)
    expect(grey.match(/color:gray/g)).toHaveLength(5)
    expect(grey.match(/color:ivory;opacity:0/g)).toHaveLength(5)
    const spoken = render(85)
    expect(spoken.match(/color:ivory;opacity:1/g)).toHaveLength(5)
    expect(render(25)).toContain('data-reveal="0.5" style="position:absolute;inset:0;color:ivory;opacity:0.5"')
  })

  it('sweeps mint behind only the answer words in three frames each, retaining ink type', () => {
    expect(state(99).words.map(w => w.highlight)).toEqual([0, 0, 0, 0, 0])
    expect(state(101).words[3]!.highlight).toBeCloseTo(1 / 3)
    expect(state(103).words.map(w => w.highlight)).toEqual([0, 0, 0, 1, 0])
    expect(state(106).words.map(w => w.highlight)).toEqual([0, 0, 0, 1, 1])
    expect(render(101)).toContain('background:aquamarine;color:black;clip-path:inset(0 66.66666666666667% 0 0)')
    expect(render(106).match(/data-highlight="1"/g)).toHaveLength(2)
    expect(render(106)).not.toContain('coral')
  })

  it('draws source and date in mono separately from the word reveal', () => {
    expect(state(84).attributionProgress).toBe(0)
    expect(state(90).attributionProgress).toBe(0.5)
    expect(state(95).attributionProgress).toBe(1)
    expect(render(90)).toContain('Research team · November 2026')
    expect(render(90)).toContain('MYMU Plex Mono')
    expect(render(90)).toContain('clip-path:inset(0 50% 0 0)')
    assertOverlayMarkup(render(106), 'pull_quote')
  })

  it('is scoped, deterministic on random access, and bounded by object lifetime', () => {
    const before = state(30)
    state(160)
    expect(state(30)).toEqual(before)
    expect(pullQuoteState(object, [...events].reverse(), 106)).toEqual(state(106))
    expect(render(50, { events: events.map(e => ({ ...e, obj: 'other' })) })).toBe('')
    expect(render(180)).toBe('')
    expect(state(160).push).toBeGreaterThan(state(110).push)
    const opening = events.map(e => e.id === 'show' ? { ...e, atFrame: 0 } : e)
    const first = pullQuoteState(object, opening, 0)
    expect(first.opacity).toBe(1)
    expect(first.words.map(w => w.reveal)).toEqual([0, 0, 0, 0, 0])
  })

  it.each(['9:16', '16:9'] as const)('authors %s and fills marked regions at natural size', aspect => {
    const box = markRegion(aspect === '9:16'
      ? { left: 60, top: 280, width: 800, height: 700 }
      : { left: 96, top: 140, width: 1728, height: 600 })
    const html = render(106, { aspect, box })
    expect(html).toContain('data-region-fit=""')
    expect(html).toContain(`font-size:${aspect === '9:16' ? 64 : 72}px`)
    expect(html).toContain('expert')
    expect(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).toContain('November 2026')
    assertOverlayMarkup(html, 'pull_quote', aspect)
    expect(render(106, { aspect, box: { ...box } })).not.toContain('data-region-fit')
  })

  it('requires a producer for numerical evidence and renders the supplied producer', () => {
    const numeric = { ...object, params: { ...object.params, quote: 'Training grew 27%' } }
    expect(() => pullQuoteState(numeric, events, 40)).toThrow('dataset and producerLabel')
    const dataset = { unit: '%', denominator: null, producerLabel: 'Research report', rows: [{ label: 'Training', value: 27 }] }
    const html = render(106, { object: { ...numeric, dataset } })
    expect(html).toContain('Research report')
    const original = JSON.stringify(dataset)
    for (const frame of [10, 40, 106, 179]) pullQuoteState({ ...numeric, dataset }, events, frame)
    expect(JSON.stringify(dataset)).toBe(original)
  })
})


describe('region fit bounds', () => {
  it.each(['9:16', '16:9'] as const)('grows and centres the rendered %s device inside its region at every fixture frame', aspect => {
    const box = markRegion({ left: 72, top: 96, width: 2400, height: 2200 })
    let drawn = 0
    for (let frame = object.fromFrame; frame < object.toFrame; frame++) {
      const markup = renderToStaticMarkup(Device({ object, events, box, tokens: overlayTestProps.tokens, aspect, frame }))
      if (!markup) continue
      const wrapper = markup.match(/data-region-fit="" style="([^"]+)"/)
      expect(wrapper, `frame ${frame}`).not.toBeNull()
      const css = wrapper![1]!
      const px = (key: string) => Number(css.match(new RegExp(`(?:^|;)${key}:([\\d.e+-]+)px`))![1])
      const scale = Number(css.match(/transform:scale\(([^)]+)\)/)![1])
      const width = px('width') * scale, height = px('height') * scale
      expect(scale).toBeGreaterThan(1)
      expect(scale).toBeLessThanOrEqual(MAX_GROW)
      expect(px('left')).toBeGreaterThanOrEqual(box.left - 1e-8)
      expect(px('top')).toBeGreaterThanOrEqual(box.top - 1e-8)
      expect(px('left') + width).toBeLessThanOrEqual(box.left + box.width + 1e-8)
      expect(px('top') + height).toBeLessThanOrEqual(box.top + box.height + 1e-8)
      expect(px('left') + width / 2).toBeCloseTo(box.left + box.width / 2)
      expect(px('top') + height / 2).toBeCloseTo(box.top + box.height / 2)
      // It fills one dimension unless the shared growth ceiling is reached.
      expect(Math.min(Math.abs(width - box.width), Math.abs(height - box.height), Math.abs(scale - MAX_GROW))).toBeLessThan(1e-8)
      drawn++
    }
    expect(drawn).toBeGreaterThan(0)
  })
})
