import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ANTON_CAP, CHAPTER_ARRANGEMENTS, IN_WORLD, chapterPlace, inWorldLayout, inWorldShare, slam, titleBox } from './depth'
import { DepthLayer, behind, liveItems, type DepthItem } from '../depth/DepthLayer'
import { anchorSlots, anchorScrim, realImage } from '../FormatMaster'
import { TitleMoment } from '../title/TitleMoment'
import { Device as KineticStat } from '../devices/kinetic_stat/index'
import { regionSlots } from './layout'

const head = { top: 560, left: 400, right: 700, centreY: 760 }
const tokens = { ink: '#0C1512', inkDeep: '#050a08', inkSoft: '#1b2a25', cream: '#F4EFE4', mint: '#7EF0C0', channel: '#B7A6FF' }

describe('the in-world number (study shot 5)', () => {
  it('stands 0.4 to 0.6 of the frame tall at head height, a short word or number only', () => {
    for (const text of ['8', 'NO', 'AI', '41']) {
      const share = inWorldShare(text, 1080, 1920)
      expect(share).toBeGreaterThanOrEqual(IN_WORLD.min)
      expect(share).toBeLessThanOrEqual(IN_WORLD.max)
      const at = inWorldLayout(text, 1080, 1920, head)
      expect(at.centreY).toBeCloseTo(head.centreY)
      expect(at.width).toBeLessThanOrEqual(1080 * 0.94 + 0.5)
      expect(at.capHeight / 1920).toBeCloseTo(share)
    }
    expect(inWorldShare('$195K', 1080, 1920)).toBeLessThan(IN_WORLD.min)
  })
  it('sits to the side of his head with more wall', () => {
    expect(inWorldLayout('8', 1080, 1920, head).centreX).toBeLessThan(540)
    expect(inWorldLayout('8', 1080, 1920, { ...head, left: 200, right: 480 }).centreX).toBeGreaterThan(540)
  })
  it('slams in on its word and cuts out at its end', () => {
    expect(slam(9, 10, 40).opacity).toBe(0)
    expect(slam(10, 10, 40).scale).toBeCloseTo(1.25)
    expect(slam(15, 10, 40)).toEqual({ scale: 1, opacity: 1 })
    expect(slam(40, 10, 40).opacity).toBe(0)
  })
})

describe('the chapter mark (study shot 6)', () => {
  it('has four arrangements, each in its own place', () => {
    const places = CHAPTER_ARRANGEMENTS.map(a => chapterPlace(a, 1080, 1920, head))
    expect(new Set(places.map(p => `${p.left}:${p.rotate}:${p.align}`)).size).toBe(4)
    expect(places[0]!.left).toBeLessThan(540)
    expect(places[1]!.left).toBeGreaterThan(540)
    expect(places[2]!.rotate).toBe(-90)
    expect(places[3]!.behind).toBe(true)
    expect(places[3]!.fontSize * ANTON_CAP / 1920).toBeCloseTo(IN_WORLD.target)
  })
})

describe('the depth layer', () => {
  const item = (kind: DepthItem['kind'], extra: Partial<DepthItem> = {}): DepthItem => ({ kind, text: '2', fromFrame: 0, atFrame: 5, toFrame: 30, head, ...extra })
  it('puts numbers and matted chapter marks behind him, a bare beside mark in front', () => {
    expect(behind(item('number'))).toBe(true)
    expect(behind(item('chapter', { arrangement: 'beside_left' }))).toBe(false)
    expect(behind(item('chapter', { arrangement: 'beside_left', behind: true }))).toBe(true)
    expect(behind(item('chapter', { arrangement: 'behind' }))).toBe(true)
    expect(liveItems([item('number')], 4, true)).toEqual([])
    expect(liveItems([item('number')], 5, true)).toHaveLength(1)
    expect(liveItems([item('number')], 30, true)).toEqual([])
  })
  it('draws the house type in ink with an accent drop', () => {
    const html = renderToStaticMarkup(h(DepthLayer, { items: [item('number', { text: 'NO' })], frame: 20, tokens, width: 1080, height: 1920, back: true }))
    expect(html).toContain('data-depth-number="NO"')
    expect(html).toContain('MYMU Anton')
    expect(html).toContain(tokens.mint)
    expect(renderToStaticMarkup(h(DepthLayer, { items: [item('number')], frame: 20, tokens, width: 1080, height: 1920, back: false }))).toBe('')
  })
})

describe('the anchor title behind his head', () => {
  it('builds in its box on his wall, wordmark tile at its head, no ink ground and no bars', () => {
    const box = titleBox(1080, 1920, head)
    expect(box.top).toBe(270)
    expect(box.top + box.height).toBeCloseTo(head.top + 1920 * 0.12)
    const words = [{ text: 'Find', atFrame: 0 }, { text: 'the', atFrame: 5 }, { text: 'money', atFrame: 10 }]
    const html = renderToStaticMarkup(h(TitleMoment, { words, fromFrame: 0, toFrame: 60, frame: 20, aspect: '9:16', width: 1080, height: 1920,
      tokens, wordmark: { src: 'w.png', pixelWidth: 400, pixelHeight: 160 }, behind: box }))
    expect(html).toContain('data-title-behind')
    expect(html).toContain('data-title-wordmark-tile')
    expect(html).not.toContain('data-title-ground')
    const full = renderToStaticMarkup(h(TitleMoment, { words, fromFrame: 0, toFrame: 60, frame: 20, aspect: '9:16', width: 1080, height: 1920, tokens }))
    expect(full).toContain('data-title-ground')
  })
})

describe('anchor slots and scrim', () => {
  const region = { left: 60, top: 280, width: 960, height: 220 }
  const prop = { left: 40, top: 860, width: 320, height: 252 }
  it('a real image stands beside him in the prop box; the rest share the space above his head', () => {
    const slots = anchorSlots(['stat', 'photo'], id => id === 'photo', { region, props: [prop] })
    expect(slots[1]).toEqual(prop)
    expect(slots[0]).toMatchObject(region)
    expect(realImage({ obj: 'p', device: 'evidence_card', meaning: 'm', variants: {}, params: { src: 'a.png' }, fromFrame: 0, toFrame: 1 })).toBe(true)
    expect(realImage({ obj: 'k', device: 'kinetic_stat', meaning: 'm', variants: {}, params: {}, fromFrame: 0, toFrame: 1 })).toBe(false)
  })
  it('scrims the space above his head only on an anchor beat with a device', () => {
    const beat = { id: 'a', role: 'anchor' as const, layout: 'P1' as const, uses: ['stat'], fromFrame: 0, toFrame: 10, transitionOut: 'cut' as const, sectionBeat: false }
    expect(anchorScrim({ region }, beat, 'anchor', tokens)).not.toBeNull()
    expect(anchorScrim({ region }, { ...beat, uses: [] }, 'anchor', tokens)).toBeNull()
    expect(anchorScrim({ region }, beat, 'stage', tokens)).toBeNull()
  })
})

describe('kinetic_stat in a region fills its width (step 5: the source line held the figure to half the panel)', () => {
  it('grows the figure to the region and shrinks the source line to it', () => {
    const region = regionSlots({ left: 60, top: 280, width: 800, height: 596 }, 1, 6, true)[0]!
    const object = { obj: 'k', device: 'kinetic_stat', meaning: 'the bill', variants: {}, fromFrame: 0, toFrame: 100, params: {},
      dataset: { unit: 'THOUSAND DOLLARS', denominator: null, producerLabel: "Tom's Hardware, 29 Oct 2025 (the family's account)", rows: [{ label: 'billed', value: 195 }] } }
    const events = [{ id: 'e', obj: 'k', verb: 'enter' as const, toState: 'visible', atFrame: 0 }]
    const html = renderToStaticMarkup(h(KineticStat, { object, events, box: region, tokens, aspect: '9:16', frame: 50 }))
    const sizes = [...html.matchAll(/font-size:([0-9.]+)px/g)].map(m => Number(m[1]))
    expect(sizes[0]).toBeGreaterThan(180)
    expect(Math.max(...sizes.slice(1))).toBeLessThan(sizes[0]!)
    // Band keeps the look Krish approved: its region does not stretch the figure past its source line.
    const band = regionSlots({ left: 60, top: 280, width: 800, height: 596 }, 1, 6)[0]!
    const banded = renderToStaticMarkup(h(KineticStat, { object, events, box: band, tokens, aspect: '9:16', frame: 50 }))
    expect(Number(banded.match(/font-size:([0-9.]+)px/)![1])).toBeLessThan(sizes[0]!)
  })
})
