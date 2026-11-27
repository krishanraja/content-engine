import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'
import { ProductionSpecV2Schema } from '../../../../../packages/contracts/src/production-spec'
import { isV5Id, v5Params } from '../../../../../packages/contracts/src/why-ladder-v5'
import fixture from '../../../../../fixtures/ve/why-ladder-v5/spec.json'
import recipe from '../../../../../config/ve/recipes/why-ladder-v5.json'
import retired from '../../../../../config/retired-styles.json'
import brand from '../../../../../config/ve/brand-tokens.json'
import devices from '../../../../../config/ve/devices.json'
import { DEVICES } from '../devices/registry'
import { Card, enter } from './Cards'
import { captionPages } from './HouseCaptions'

// Static markup exercises the card tree without a Remotion compositor or browser.
vi.mock('remotion', async (original) => ({ ...(await original<typeof import('remotion')>()), Img: 'img' }))

describe('Why ladder v5', () => {
  it('validates the production fixture and device parameters', () => {
    expect(ProductionSpecV2Schema.parse(fixture).cuts.wide?.aspect).toBe('16:9')
    expect(v5Params.v5_why.safeParse({ rung: 4, lines: ['Why?'], image: { src: 'x' } }).success).toBe(false)
    expect(v5Params.v5_evidence.safeParse({ note: 'Unsourced claim' }).success).toBe(false)
    for (const id of Object.keys(v5Params)) {
      expect(Object.hasOwn(devices.devices, id)).toBe(true)
      expect(DEVICES[id]).toBeTypeOf('function')
    }
    for (const { id } of retired)
      expect([
        fixture.format,
        recipe.style,
        ...recipe.caption_themes,
        ...fixture.objects.map((o) => o.device),
      ]).not.toContain(id)
  })
  it('settles monotonically over the specified intervals', () => {
    for (const duration of [6, 8, 9, 10, 12]) {
      const steps = Array.from({ length: duration + 1 }, (_, i) => enter(i, duration))
      expect(steps[0]).toBe(0)
      expect(steps.at(-1)).toBe(1)
      for (let i = 2; i < steps.length; i++) {
        expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]!)
        expect(steps[i]! - steps[i - 1]!).toBeLessThanOrEqual(steps[i - 1]! - steps[i - 2]! + 0.001)
      }
    }
    for (const format of ['9:16', '16:9'] as const) {
      const landing = fixture.objects.find((o) => o.device === 'v5_landing')!
      const html = (frame: number) =>
        renderToStaticMarkup(
          React.createElement(Card, { id: 'v5_landing', format, frame, params: landing.params }),
        )
      expect(html(12)).toContain('opacity:0')
      expect(html(20)).toContain('opacity:1')
      for (const object of fixture.objects) {
        if (isV5Id(object.device))
          expect(
            renderToStaticMarkup(
              React.createElement(Card, { id: object.device, format, frame: 20, params: object.params }),
            ),
          ).not.toBe('')
      }
    }
  })
  it('draws each evidence kind from the specified image, with the correct strength treatment', () => {
    const sample = fixture.objects.find(o => o.device === 'v5_evidence')!.params
    for (const kind of ['document', 'chart', 'place', 'creative-work', 'quote']) {
      for (const strength of ['documented','inferred','open']) {
        const html = renderToStaticMarkup(React.createElement(Card, {
          id:'v5_evidence', format:'9:16', frame:0, params:{...sample, kind, strength},
        }))
        expect(html).toContain('data-evidence-kind="'+kind+'"')
        expect(html).toContain('doc-spotify-streams.png')
        expect(html).toContain('translateX(120px)')
        expect(html.includes('stroke-dasharray="8 6"')).toBe(strength === 'open')
        expect(html.includes('opacity:0.7')).toBe(strength === 'inferred')
      }
    }
  })
  it('draws the callout leader before its tag and holds the closing mark in the ink band', () => {
    function at(id:'v5_callout'|'v5_close',frame:number) {
      const params=fixture.objects.find(o=>o.device===id)!.params
      return renderToStaticMarkup(React.createElement(Card,{id,params,frame,format:'16:9'}))
    }
    expect(at('v5_callout',0)).toContain('stroke-dashoffset="1"')
    expect(at('v5_callout',6)).toContain('stroke-dashoffset="0"')
    expect(at('v5_callout',6)).toContain('opacity:0')
    expect(at('v5_callout',10)).toContain('opacity:1')
    expect(at('v5_close',16)).toContain('Follow for more')
  })
  it('ends the close on S3h, its one wordmark, never the stacked V10 or V6 it replaced (ONE-MARK, Krish, 2026-11-25)', () => {
    const params = fixture.objects.find((o) => o.device === 'v5_close')!.params
    for (const format of ['9:16', '16:9'] as const) {
      const html = renderToStaticMarkup(React.createElement(Card, { id: 'v5_close', params, frame: 16, format }))
      expect(html.match(/<img[^>]*>/g)).toHaveLength(1)
      expect(html).toMatch(/<img[^>]*data-close-mark="s3h"[^>]*s3h\.svg/)
      for (const retired of ['v10.svg', 'v6.svg', 'v4.svg', 'v9.svg']) expect(html).not.toContain(retired)
      // No series name and no days row on the close (Krish, 2026-11-26: "the sub brands do not need to feature").
      for (const text of ['Mondays', 'Wednesdays', 'Fridays', 'follow.the.money', 'under.the.hood', 'mind.the.gap']) expect(html).not.toContain(text)
    }
  })
  it('draws no V4 on the title card of a cut dated from 27 Nov, and keeps it for one dated before (Ruling, Krish, 2026-11-27: "agree")', () => {
    const params = fixture.objects.find((o) => o.device === 'v5_title')!.params
    for (const format of ['9:16', '16:9'] as const) {
      const card = (titleMark?: boolean) =>
        renderToStaticMarkup(React.createElement(Card, { id: 'v5_title', params, frame: 40, format, ...(titleMark === undefined ? {} : { titleMark }) }))
      // S3h on the v5 outro is the cut's one wordmark: the title card carries no wordmark at all.
      expect(card(false)).not.toContain('v4.svg')
      for (const mark of ['v10.svg', 'v6.svg', 'v9.svg', 's3h.svg']) expect(card(false)).not.toContain(mark)
      // A cut dated before 27 Nov renders exactly as it was signed (F33): its title card keeps V4.
      expect(card()).toContain('v4.svg')
      expect(card(true)).toBe(card())
    }
  })
  it('keeps each phrase between two and five words', () => {
    for (let n = 2; n < 25; n++) {
      const words = Array.from({ length: n }, (_, i) => ({ text: 'word', atFrame: i * 3 }))
      const pages = captionPages([{ fromFrame: 0, toFrame: n * 3, words, swipeIndex: null }])
      expect(pages.flatMap((p) => p.words).map((w) => w.atFrame)).toEqual(words.map((w) => w.atFrame))
      expect(pages.every((p) => p.words.length >= 2 && p.words.length <= 5)).toBe(true)
    }
  })
  it('exceeds WCAG AA text contrast on each house ground', () => {
    function luminance(hex: string) {
      const [r, g, b] = hex
        .slice(1)
        .match(/../g)!
        .map((v) => parseInt(v, 16) / 255)
        .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    for (const background of [brand.colours.cream, brand.colours.mint, ...brand.colours.climb])
      expect((luminance(background) + 0.05) / (luminance(brand.colours.ink) + 0.05)).toBeGreaterThan(4.5)
  })
})
