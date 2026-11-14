import { markRegion, MAX_GROW } from '../../kit/layout'
import React from 'react'
import { textWidth } from '../../../house/metrics'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineBeatSchema, EngineEventSchema, EngineObjectSchema } from '../../props'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { entranceFrames, throughLineState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number, cues = events) => throughLineState(object, cues, frame)
const part = (frame: number, id: string) => at(frame).parts.find(p => p.id === id)!
const html = (frame: number, aspect: '9:16' | '16:9' = '9:16') => renderToStaticMarkup(React.createElement(Device, {
  ...overlayTestProps, object, events, frame, aspect,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 800 : 1600, height: aspect === '9:16' ? 850 : 800 },
}))

describe('through_line', () => {
  it('carries exactly one object and the same ordered parts across all six beats', () => {
    expect(fixture.objects).toHaveLength(1)
    for (const raw of fixture.beats) {
      const beat = EngineBeatSchema.parse(raw)
      expect(beat.uses).toEqual([object.obj])
      const state = at(beat.fromFrame + 40)
      expect(state.obj).toBe(object.obj)
      expect(state.parts.map(p => p.id)).toEqual((object.params.parts as { id: string }[]).map(p => p.id))
      expect(html(beat.fromFrame + 40).match(/data-object=/g)).toHaveLength(1)
    }
    expect(part(400, 'junior').number?.value).toBe(9)
    expect(part(400, 'agents').size).toBe(6)
  })
  it('counts 27 to 9 while thinning the junior rung in one second', () => {
    expect(part(9, 'junior').number?.value).toBe(27)
    expect(part(10, 'junior').thickness).toBe(1)
    expect(part(25, 'junior').number?.value).toBeGreaterThan(9)
    expect(part(25, 'junior').number?.value).toBeLessThan(27)
    expect(part(25, 'junior').thickness).toBeLessThan(1)
    expect(part(40, 'junior').number?.value).toBe(9)
    expect(part(40, 'junior').thickness).toBeCloseTo(.12)
  })
  it('grows a linear, zero-based agent bar to six times staff', () => {
    expect(part(99, 'agents').size).toBe(1)
    expect(part(115, 'agents').size).toBeGreaterThan(1)
    expect(part(130, 'agents').size / part(130, 'staff').size).toBe(6)
    expect(html(130)).toContain('ANTHROPIC · AUG 2026')
  })
  it('loses seven of the original marks, then copies the remaining units without rounding', () => {
    expect(part(189, 'tellers').count).toBe(20)
    expect(part(220, 'tellers').count).toBe(13)
    expect(part(260, 'tellers').count).toBeCloseTo(13 * 1.43)
    expect(part(260, 'branches').number?.value).toBe(43)
    const fractions = [...html(260).matchAll(/data-fraction="([\d.]+)"/g)].map(m => Number(m[1]))
    expect(fractions.reduce((sum, n) => sum + n, 0)).toBeCloseTo(18.59)
    expect(html(220)).toContain('IMF · BESSEN 2015')
    expect(html(260)).toContain('NPR PLANET MONEY · 2015')
  })
  it('keeps the dropped rung as a gap and rests the camera on it through the quiet beat', () => {
    expect(part(279, 'junior').opacity).toBe(1)
    expect(part(287, 'junior').opacity).toBe(0)
    expect(at(290).camera[0]).toBe(0)
    expect(at(297).camera[0]).toBe(1)
    expect(at(400).camera).toEqual(at(297).camera)
    expect(part(400, 'junior').opacity).toBe(0)
    expect(at(400).parts).toHaveLength(at(0).parts.length)
  })
  it('lights 2030 and connects the senior rung back to the missing junior rung', () => {
    expect(part(459, 'senior').lit).toBe(0)
    expect(part(467, 'senior').lit).toBe(1)
    expect(part(490, 'senior').number?.value).toBe(2030)
    expect(at(469).connections).toEqual([])
    expect(at(500).connections).toEqual([{ from: 'senior', to: 'junior', amount: 1 }])
    expect(html(500)).toContain('HOSSEINI &amp; LICHTINGER · 2025')
  })
  it('renders both aspects, one sourced number per frame and stable unit identities', () => {
    for (const aspect of ['9:16', '16:9'] as const) for (const frame of fixture.stills) {
      const markup = html(frame, aspect)
      expect(markup).toContain('data-device="through_line"')
      expect(markup).not.toMatch(/NaN|Infinity/)
      expect(markup.match(/data-number-on=/g) ?? []).toHaveLength(frame >= 287 && frame < 460 ? 0 : 1)
    }
    expect(html(540)).toBe('')
  })
  it('is independent of input order, unrelated cues and repeated evaluation', () => {
    expect(at(500, [...events].reverse())).toEqual(at(500))
    expect(at(260, [...events, { ...events[0]!, obj: 'elsewhere', atFrame: 100 }])).toEqual(at(260))
    expect(at(25)).toEqual(at(25))
    const before = JSON.stringify({ object, events })
    at(500)
    expect(JSON.stringify({ object, events })).toBe(before)
  })
  it('starts an interrupted count from its reached value and carries it over a later entrance', () => {
    const interrupted = [...events.filter(e => e.atFrame <= 10), { ...events[1]!, id: 'interrupt', atFrame: 25 }]
    expect(at(25, interrupted).parts[0]!.number?.value).toBe(part(25, 'junior').number?.value)
    expect(at(55, interrupted).parts[0]!.number?.value).toBe(9)
    expect(part(400, 'agents').size).toBe(at(400, [...events, { ...events[0]!, id: 'again', atFrame: 350 }]).parts[2]!.size)
  })
  it('settles later entrances in 4–7 frames and exits without clearing state', () => {
    expect(entranceFrames()).toBeGreaterThanOrEqual(4)
    expect(entranceFrames()).toBeLessThanOrEqual(7)
    const later = events.map(e => e.verb === 'enter' ? { ...e, atFrame: 5 } : e)
    expect(at(4, later).visible).toBe(false)
    expect(at(5, later).opacity).toBe(0)
    expect(at(12, later).opacity).toBe(1)
    const exited = [...events, { ...events[0]!, id: 'exit', verb: 'exit' as const, atFrame: 510 }]
    expect(at(517, exited).visible).toBe(false)
    expect(at(517, exited).parts[2]!.size).toBe(6)
  })
  it('refuses unknown parts, units, unsourced numbers and unsupported commands', () => {
    expect(ParamsSchema.safeParse({ ...object.params, parts: [] }).success).toBe(false)
    expect(() => throughLineState({ ...object, dataset: undefined }, events, 40)).toThrow('dataset')
    expect(() => at(500, [...events, { ...events[1]!, id: 'bad', toState: 'absent', atFrame: 480 }])).toThrow('invalid')
    const p = ParamsSchema.parse(object.params)
    expect(ParamsSchema.safeParse({ ...p, states: { bad: { verb: 'connect', part: 'senior', to: 'absent' } } }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...p, states: { bad: { verb: 'count_to', part: 'junior', number: { value: 9, unit: 'hours', producer: 'ANTHROPIC', date: '2026' } } } }).success).toBe(false)
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


it.each(['9:16', '16:9'] as const)('keeps the number box and every label box disjoint throughout the %s fixture', aspect => {
  // Check the actual SVG positions, including the camera transform, rather than a parallel layout model.
  for (const box of [markRegion({ left: 60, top: 280, width: 800, height: 780 }),
    markRegion({ left: 96, top: 140, width: 1728, height: 600 })]) {
    for (let frame = object.fromFrame; frame < object.toFrame; frame++) {
      const markup = renderToStaticMarkup(Device({ ...overlayTestProps, object, events, frame, aspect, box }))
      const stack = [{ scale: 1, x: 0, y: 0 }]
      const boxes: { number: boolean; text: string; left: number; top: number; right: number; bottom: number }[] = []
      for (const match of markup.matchAll(/<g\b([^>]*)>|<\/g>|<text\b([^>]*)>(.*?)<\/text>/g)) {
        if (match[0] === '</g>') { stack.pop(); continue }
        const parent = stack.at(-1)!
        if (match[1] !== undefined) {
          const transform = match[1].match(/transform="translate\(([^ ]+) ([^)]+)\) scale\(([^)]+)\) translate\(([^ ]+) ([^)]+)\)"/)
          const scale = transform ? Number(transform[3]) : 1
          stack.push(transform ? { scale: parent.scale * scale,
            x: parent.x + parent.scale * (Number(transform[1]) + scale * Number(transform[4])),
            y: parent.y + parent.scale * (Number(transform[2]) + scale * Number(transform[5])) } : parent)
          continue
        }
        const attrs = match[2]!, text = match[3]!.replace(/&amp;/g, '&')
        const attr = (key: string) => Number(attrs.match(new RegExp(`(?:^| )${key}="([^"]+)"`))![1])
        const number = attrs.includes('data-number-row')
        const size = attr('font-size')
        const face = number ? 'anton' : attrs.includes('Plex Mono') ? 'mono' : 'fraunces'
        const left = parent.x + parent.scale * attr('x'), baseline = parent.y + parent.scale * attr('y')
        // Conservative ascender/descender envelope, wider than the house face's ink bounds.
        boxes.push({ number, text, left, right: left + parent.scale * textWidth(face, text, size),
          top: baseline - parent.scale * size * 1.1, bottom: baseline + parent.scale * size * .25 })
      }
      expect(boxes.some(b => b.number)).toBe(frame < 287 || frame >= 460)
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const x = boxes[a]!, y = boxes[b]!
        const intersects = x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top
        expect(intersects, `frame ${frame}: ${x.text} / ${y.text}`).toBe(false)
      }
    }
  }
})

it.each(['9:16', '16:9'] as const)('separates every text box from rungs, bars, dot grids and strokes at every %s fixture frame', aspect => {
  type Bounds = { name: string; left: number; top: number; right: number; bottom: number }
  const intersects = (a: Bounds, b: Bounds) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  // Include the fixture's key frames and every intervening camera/count frame. Inspect the
  // emitted geometry, not layout constants, in both ordinary slots and RegionFit regions.
  for (const box of [
    { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 },
    { left: 0, top: 0, width: aspect === '9:16' ? 800 : 1600, height: aspect === '9:16' ? 850 : 800 },
    markRegion({ left: 60, top: 280, width: 800, height: 780 }),
    markRegion({ left: 96, top: 140, width: 1728, height: 600 }),
  ]) for (let frame = object.fromFrame; frame < object.toFrame; frame++) {
    const markup = renderToStaticMarkup(Device({ ...overlayTestProps, object, events, frame, aspect, box }))
    const stack = [{ scale: 1, x: 0, y: 0, part: '' }]
    const labels: Bounds[] = [], shapes: Bounds[] = []
    const grids = new Map<string, Bounds>()
    for (const match of markup.matchAll(/<g\b([^>]*)>|<\/g>|<(text|rect|circle|line|path)\b([^>]*?)(?:\/>|>)([^<]*)/g)) {
      if (match[0] === '</g>') { stack.pop(); continue }
      const parent = stack.at(-1)!
      if (match[1] !== undefined) {
        const attrs = match[1]
        const transform = attrs.match(/transform="translate\(([^ ]+) ([^)]+)\) scale\(([^)]+)\) translate\(([^ ]+) ([^)]+)\)"/)
        const scale = transform ? Number(transform[3]) : 1
        stack.push({ scale: parent.scale * scale,
          x: parent.x + (transform ? parent.scale * (Number(transform[1]) + scale * Number(transform[4])) : 0),
          y: parent.y + (transform ? parent.scale * (Number(transform[2]) + scale * Number(transform[5])) : 0),
          part: attrs.match(/data-part="([^"]+)"/)?.[1] ?? parent.part })
        continue
      }
      const tag = match[2]!, attrs = match[3]!
      const value = (key: string) => attrs.match(new RegExp(`(?:^| )${key}="([^"]*)"`))?.[1]
      const n = (key: string) => Number(value(key) ?? 0)
      const bounds = (name: string, left: number, top: number, right: number, bottom: number): Bounds => ({ name,
        left: parent.x + parent.scale * left, right: parent.x + parent.scale * right,
        top: parent.y + parent.scale * top, bottom: parent.y + parent.scale * bottom })
      if (tag === 'text') {
        const text = match[4]!.replace(/&amp;/g, '&'), size = n('font-size')
        const face = value('font-family')!.includes('Anton') ? 'anton' : value('font-family')!.includes('Plex Mono') ? 'mono' : 'fraunces'
        labels.push(bounds(text, n('x'), n('y') - size * 1.1,
          n('x') + textWidth(face, text, size), n('y') + size * .25))
      } else if (tag === 'rect') {
        shapes.push(bounds(`${parent.part} rung/bar`, n('x'), n('y'), n('x') + n('width'), n('y') + n('height')))
      } else if (tag === 'circle') {
        // Bound the entire grid, including the reserved zero-area marks, so a label
        // cannot slip into an empty position and collide when those marks grow.
        const dot = bounds(`${parent.part} dot grid`, n('cx') - n('r'), n('cy') - n('r'), n('cx') + n('r'), n('cy') + n('r'))
        const grid = grids.get(parent.part)
        grids.set(parent.part, grid ? { name: dot.name, left: Math.min(grid.left, dot.left), top: Math.min(grid.top, dot.top),
          right: Math.max(grid.right, dot.right), bottom: Math.max(grid.bottom, dot.bottom) } : dot)
      } else {
        const halfStroke = n('stroke-width') / 2
        const segment = (x1: number, y1: number, x2: number, y2: number) => shapes.push(bounds(tag,
          Math.min(x1, x2) - halfStroke, Math.min(y1, y2) - halfStroke,
          Math.max(x1, x2) + halfStroke, Math.max(y1, y2) + halfStroke))
        if (tag === 'line') segment(n('x1'), n('y1'), n('x2'), n('y2'))
        else {
          let x = 0, y = 0
          for (const command of value('d')!.matchAll(/([MLHV])([^MLHV]+)/g)) {
            const args = command[2]!.trim().split(/[ ,]+/).map(Number)
            const nx = command[1] === 'V' ? x : args[0]!
            const ny = command[1] === 'H' ? y : command[1] === 'V' ? args[0]! : args[1]!
            if (command[1] !== 'M') segment(x, y, nx, ny)
            x = nx; y = ny
          }
        }
      }
    }
    shapes.push(...grids.values())
    expect(labels.length).toBeGreaterThanOrEqual(6)
    expect(shapes.length).toBeGreaterThanOrEqual(8)
    for (const label of labels) {
      for (const shape of shapes) expect(intersects(label, shape),
        `${aspect} ${box.width}x${box.height} frame ${frame}: ${label.name} / ${shape.name}`).toBe(false)
      for (const other of labels) if (other !== label) expect(intersects(label, other),
        `frame ${frame}: ${label.name} / ${other.name}`).toBe(false)
    }
    const svgHeight = Number(markup.match(/<svg[^>]* height="([^"]+)"/)![1])
    const credit = labels.find(label => label.name.includes(' · '))
    if (credit) expect(credit.bottom).toBeLessThan(svgHeight)
  }
})
