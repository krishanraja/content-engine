import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HOUSE } from '../../house/geometry'
import { boxFor, chromeZone, TALL, WIDE } from '../geometry'
import type { EngineRenderProps } from '../props'
import { CaptionTrack, captionLines, captionPageAt, type CaptionPage } from './CaptionTrack'

const first: CaptionPage = {
  fromFrame: 10, toFrame: 20,
  words: [{ text: 'First', atFrame: 10 }, { text: 'answer', atFrame: 15 }], swipeIndex: 1,
}
const adjacent: CaptionPage = { fromFrame: 20, toFrame: 25, words: [{ text: 'Next', atFrame: 20 }], swipeIndex: null }
const later: CaptionPage = { fromFrame: 30, toFrame: 40, words: [{ text: 'Later', atFrame: 30 }], swipeIndex: null }
const image = { src: 'mark.png', pixelWidth: 96, pixelHeight: 96 }
const props: EngineRenderProps = {
  pieceId: 'chrome-test', cutId: 'short', format: 'face-with-proof', aspect: '9:16', fps: 30, durationFrames: 50,
  tokens: { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aquamarine', channel: 'coral' },
  series: { label: 'mind.the.gap', day: 'Friday', promise: 'Patterns', site: 'makeyourmindup.ai' },
  brand: { mark: image, logo: image, stacked: image }, segments: [],
  audio: { stem: { src: 'stem.wav', trimBeforeFrames: 0 }, sfx: [] },
  captions: [first, adjacent, later], beats: [], objects: [], events: [], illustrationLabels: [],
}

describe('chrome geometry', () => {
  it('re-exports the unchanged tall house kit and keeps two caption lines above Y 1500', () => {
    expect(TALL).toBe(HOUSE)
    const box = boxFor('caption', '9:16')
    expect(box.top).toBe(1180)
    expect(box.top + box.height + HOUSE.caption.shadow).toBeLessThanOrEqual(1500)
    expect(boxFor('mark', '9:16')).toEqual({ left: 72, top: 140, width: 136, height: 136 })
  })

  it('centres the wide caption inside 10% title-safe, including its shadow', () => {
    const box = boxFor('caption', '16:9')
    expect(box.width).toBe(1400)
    expect(box.left + box.width / 2).toBe(WIDE.width / 2)
    expect(box.top + box.height).toBe(960)
    expect(box.left).toBeGreaterThanOrEqual(WIDE.width * 0.1)
    expect(box.left + box.width + WIDE.caption.shadow).toBeLessThanOrEqual(WIDE.width * 0.9)
    expect(box.top).toBeGreaterThanOrEqual(WIDE.height * 0.1)
    expect(box.top + box.height + WIDE.caption.shadow).toBeLessThanOrEqual(WIDE.height * 0.9)
    expect(boxFor('mark', '16:9')).toEqual({ left: 64, top: 56, width: 112, height: 112 })
    expect(boxFor('pill', '16:9').left).toBeGreaterThan(64 + 112)
  })
})

describe('caption timing', () => {
  it('selects exactly one page for every covered frame and none in gaps', () => {
    const pages = [first, adjacent, later]
    for (let frame = 0; frame <= 50; frame++) {
      const matches = pages.filter((page) => page.fromFrame <= frame && frame < page.toFrame)
      const selected = captionPageAt(pages, frame)
      expect(selected).toBe(matches[0] ?? null)
      expect(selected ? [selected] : []).toHaveLength(matches.length)
    }
    expect(captionPageAt(pages, 20)).toBe(adjacent)
    expect(captionPageAt(pages, 25)).toBeNull()
    expect(captionPageAt(pages, 40)).toBeNull()
    expect(captionPageAt([], 10)).toBeNull()
  })

  it('renders at most one page even when malformed intervals overlap', () => {
    expect(captionPageAt([first, { ...later, fromFrame: 12 }], 15)).toBe(first)
  })

  it('reveals words on their exact frame without changing the page layout', () => {
    const before = renderToStaticMarkup(createElement(CaptionTrack, { props, frame: 14 }))
    const on = renderToStaticMarkup(createElement(CaptionTrack, { props, frame: 15 }))
    expect(before).toContain('visibility:hidden')
    expect(on).not.toContain('visibility:hidden')
    expect(on).toContain('background:aquamarine')
    expect(on).toContain('12px 12px 0 coral')
    expect(before).toContain('answer') // Hidden space is reserved before the word appears.
    expect(renderToStaticMarkup(createElement(CaptionTrack, { props, frame: 25 }))).toBe('')
    expect(renderToStaticMarkup(createElement(CaptionTrack, { props: { ...props, captions: [{ ...first, fromFrame: 0 }] }, frame: 0 }))).toBe('')
  })

  it('keeps word indexes when wrapping and refuses more than two lines', () => {
    const page = { ...first, words: Array.from({ length: 4 }, (_, index) => ({ text: 'Answer', atFrame: index })) }
    for (const aspect of ['9:16', '16:9'] as const) {
      const lines = captionLines(page, aspect)
      expect(lines.length).toBeLessThanOrEqual(2)
      expect(lines.flat()).toEqual([0, 1, 2, 3])
    }
    expect(() => captionLines({ ...page, words: Array.from({ length: 30 }, () => ({ text: 'Answer', atFrame: 0 })) }, '9:16')).toThrow('two house lines')
    expect(() => captionLines({ ...first, words: [{ text: 'W'.repeat(50), atFrame: 10 }] }, '9:16')).toThrow('caption width')
  })
})

describe('chrome zone', () => {
  it.each(['9:16', '16:9'] as const)('contains the mark including its shadow and the pill in %s', (aspect) => {
    const zone = chromeZone(aspect)
    for (const kind of ['mark', 'pill'] as const) {
      const box = boxFor(kind, aspect)
      expect(box.left).toBeGreaterThanOrEqual(zone.left)
      expect(box.top).toBeGreaterThanOrEqual(zone.top)
      expect(box.left + box.width + (kind === 'mark' ? 10 : 0)).toBeLessThanOrEqual(zone.left + zone.width)
      expect(box.top + box.height + (kind === 'mark' ? 10 : 0)).toBeLessThanOrEqual(zone.top + zone.height)
    }
    if (aspect === '9:16') expect(zone.top + zone.height).toBeLessThan(288)
    else expect(zone).toEqual({ left: 48, top: 40, width: 812, height: 152 })
  })
})
