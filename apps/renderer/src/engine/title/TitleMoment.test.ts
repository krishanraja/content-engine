import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TitleMoment, lockupGeometry, lockupOpacity, lockupParts, type TitleMomentProps } from './TitleMoment'

// Krish, 2026-11-19, of Wed 18's title: the wordmark was a separate layer and the title was squeezed into his panel. The
// lockup is one full-frame picture with the wordmark inside it, Wed 11's "AI MUSIC or HUMAN MUSIC?" build.
const said = (line: string, from = 10) => line.split(' ').map((text, i) => ({ text, atFrame: from + i * 6 }))
const versus = said('AI music or human music?')
const plain = said('Build or buy your tools in an AI world?'.replace(' or ', ' versus-not '))
const stacked = { src: 'stacked.png', pixelWidth: 1200, pixelHeight: 520 }
const base: TitleMomentProps = {
  words: versus, fromFrame: 10, toFrame: 130, frame: 100, aspect: '9:16', width: 1080, height: 1920,
  tokens: { cream: 'ivory', ink: 'black', inkSoft: 'grey', mint: 'aquamarine' }, wordmark: stacked,
}
const draw = (p: Partial<TitleMomentProps> = {}) => renderToStaticMarkup(React.createElement(TitleMoment, { ...base, ...p }))
const sizes = [['9:16', 1080, 1920], ['16:9', 1920, 1080]] as const

describe('the title lockup', () => {
  it('splits on the connector nearest the middle, else into two halves of equal width, one word into one band', () => {
    expect(lockupParts(versus)).toEqual({ a: [0, 1], connector: 2, b: [3, 4] })
    expect(lockupParts(said('Build or buy your tools'))).toEqual({ a: [0], connector: 1, b: [2, 3, 4] })
    const halves = lockupParts(said('Where does AI get built'))
    expect(halves.connector).toBeNull()
    expect(halves.a.length + halves.b.length).toBe(5)
    expect(lockupParts(said('Why'))).toEqual({ a: [0], connector: null, b: [] })
    // "or" first or last is a word of the title, never the connector.
    expect(lockupParts(said('Or else')).connector).toBeNull()
  })

  it.each(sizes)('fills the %s frame, centred, with the wordmark inside its box', (aspect, width, height) => {
    for (const words of [versus, plain, said('Where does AI get built'), said('Why')]) {
      const g = lockupGeometry(words, width, height, aspect, stacked)
      // The bands span the frame, never a panel or a band of it.
      expect(g.box.right - g.box.left).toBeGreaterThanOrEqual(width * 0.9)
      expect(Math.abs((g.box.left + g.box.right) / 2 - width / 2)).toBeLessThan(1)
      for (const band of g.bands) expect(Math.abs(band.cx - width / 2)).toBeLessThan(1)
      // Type no smaller than 5.5% of a tall frame's height or 9% of a wide one's (config/ve/frame-checks.json title_lockup).
      expect(g.typeSize / height).toBeGreaterThanOrEqual(aspect === '9:16' ? 0.055 : 0.09)
      const m = g.wordmark!
      expect(Math.abs(m.left + m.width / 2 - width / 2)).toBeLessThan(1)
      expect(m.top).toBeGreaterThanOrEqual(g.box.top)
      expect(m.top + m.height).toBeLessThanOrEqual(g.box.bottom + 0.5)
      expect(m.top + m.height).toBeLessThanOrEqual(height)
    }
  })

  it('includes each word only from its spoken frame', () => {
    for (let frame = base.fromFrame; frame <= versus.at(-1)!.atFrame; frame++) {
      const html = draw({ frame })
      versus.forEach((w, i) => expect(html.includes(`data-title-word="${i}"`)).toBe(frame >= w.atFrame))
    }
  })

  it('draws the connector in mint and the second band on mint', () => {
    const html = draw()
    expect(html).toMatch(/data-title-connector=""[^>]*color:aquamarine/)
    expect(html).toMatch(/data-title-band="1"[^>]*background:aquamarine/)
  })

  it('renders the wordmark inside the lockup, never as typed text, and with the lockup or not at all', () => {
    for (const frame of [9, 10, 11, 40, 100, 125, 129, 130]) {
      const html = draw({ frame })
      const shown = frame >= base.fromFrame && frame < base.toFrame
      expect(html.includes('data-title-wordmark')).toBe(shown)
      // The wordmark sits inside the lockup's element, so it shares the lockup's one opacity at every frame.
      if (shown) expect(html.indexOf('data-title-lockup')).toBeLessThan(html.indexOf('data-title-wordmark'))
      if (shown) expect(html).toContain(`opacity:${lockupOpacity(frame, base.fromFrame, base.toFrame)}`)
    }
    expect(draw()).not.toMatch(/makeyourmindup/i)
  })

  it('renders nothing outside the half-open interval or for empty words', () => {
    expect(draw({ frame: 9 })).toBe('')
    expect(draw({ frame: 130 })).toBe('')
    expect(draw({ words: [] })).toBe('')
  })

  it('is deterministic and fades out where it stands', () => {
    for (const frame of [10, 32, 76, 100, 125, 129]) expect(draw({ frame })).toBe(draw({ frame }))
    expect(lockupOpacity(100, 10, 130)).toBe(1)
    expect(lockupOpacity(125, 10, 130)).toBeCloseTo(0.5)
    expect(lockupOpacity(10, 10, 130)).toBeGreaterThan(0)
  })

  it('ignores an old stage or caption box: the lockup is always the whole frame', () => {
    const panel = { left: 1300, top: 100, width: 608, height: 600 }
    expect(draw({ aspect: '16:9', width: 1920, height: 1080, stage: panel }))
      .toBe(draw({ aspect: '16:9', width: 1920, height: 1080 }))
  })
})
