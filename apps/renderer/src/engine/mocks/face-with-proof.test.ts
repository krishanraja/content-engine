import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FWP_MOCKS, FWP_SPLIT_SEAM_Y, FWP_STAGE_SCALE, FWP_SCALED_TARGETS, FWP_SPLIT_CAPTION_ZONE, FWP_POSTER_POSITIONS, FWP_TARGETS, type FWPMockProps } from './face-with-proof'
import { MARK_BOUNDS } from '../devices/logo_orbit/mark'
import registry from '../../../../../config/logo-registry.json'

const props: FWPMockProps = {
  tokens: { ink: 'ink', inkDeep: 'inkDeep', inkSoft: 'inkSoft', cream: 'cream', mint: 'mint', channel: 'coral' },
  posterSrc: 'fixture-recording-poster.jpg', logoSrc: 'house-logo.svg', series: 'mind.the.gap',
}
const render = (beat: keyof typeof FWP_MOCKS) => renderToStaticMarkup(React.createElement(FWP_MOCKS[beat], props))
describe('face-with-proof Gate 2 stills', () => {
  for (const beat of Object.keys(FWP_MOCKS) as (keyof typeof FWP_MOCKS)[]) {
    it(`${beat} is deterministic, dressed and uses the supplied camera image`, () => {
      const html = render(beat)
      expect(html).toBe(render(beat))
      expect(html).toContain('width:1080px;height:1920px')
      expect(html).toContain('src="fixture-recording-poster.jpg"')
      expect(html).toContain('src="house-logo.svg"')
      expect(html).toContain('mind.the.gap')
      expect(html).toContain(beat === 'face' ? 'left:72px;top:1180px;width:900px;height:320px'
        : 'left:72px;top:1460px;width:900px;height:180px')
      expect(html).not.toMatch(/ILLUSTRATIVE|PROVENANCE|Krish.s read|#[0-9a-f]{3,8}\b/i)
      expect(html.includes('data-proof-stage')).toBe(beat !== 'face')
    })
  }
  it('holds the full notification over a proud buddy at least 420px high', () => {
    const html = render('hook')
    expect(html).toContain('Done! Booked the team offsite in Ibiza')
    expect(html).toContain('Proactive AI is coming')
    expect(Number(html.match(/data-body-height="([\d.]+)"/)?.[1])).toBeGreaterThanOrEqual(420)
  })
  it('uses all five official marks in two large, unrotated rows', () => {
    const html = render('proof')
    for (const company of ['Meta', 'Amazon', 'Google', 'xAI', 'Anthropic']) {
      expect(html).toContain(`href="${registry.marks.find(m => m.company === company)!.file}"`)
    }
    const marks = [...html.matchAll(/<svg data-mark="([^"]+)"[^>]*width="([\d.]+)" height="([\d.]+)" viewBox="([^"]+)"/g)]
    expect(marks).toHaveLength(5)
    for (const mark of marks) {
      const file = registry.marks.find(m => m.company === mark[1])!.file.split('/').at(-1)!
      const bounds = MARK_BOUNDS[file]!
      expect(mark[4]).toBe(bounds.drawn.join(' '))
      const [, , w, h] = bounds.drawn
      const scale = Math.min(Number(mark[2]) / w, Number(mark[3]) / h)
      expect(Math.abs(Math.max(w * scale, h * scale) * FWP_STAGE_SCALE - 140 * 0.76)).toBeLessThanOrEqual(1)
    }
    expect(html.match(/<rect width="240" height="240" rx="24" fill="white"/g)).toHaveLength(5)
    expect(html.match(/translate\(\d+ 220\)/g)).toHaveLength(3)
    expect(html.match(/translate\(\d+ 570\)/g)).toHaveLength(2)
    expect(html).not.toMatch(/rotate\((?!0\))/)
  })
  it('uses mint answer slabs with 72px type and a sulking buddy', () => {
    const html = render('close')
    expect(html).toContain('NO SPENDING')
    expect(html).toContain('NO SENDING')
    expect(html.match(/data-scale="2.4"/g)).toHaveLength(2)
    expect(html.match(/background:mint/g)).toHaveLength(2)
    expect(html).toContain('data-eyes="half-closed"')
    expect(html).toContain('no spending, no sending')
  })
  it('leaves the face beat free of proof overlays', () => {
    const html = render('face')
    expect(html).not.toContain('data-device')
    expect(html).toContain('It doesn&#x27;t spend my money')
  })
})

// Check rendered layout as well as exported defaults so a disconnected constant cannot pass.
describe('round 3 geometry', () => {
  for (const beat of ['hook', 'proof', 'close'] as const) {
    it(`${beat} keeps caption and its shadow below the eye band`, () => {
      const html = render(beat)
      const zone = html.match(/data-caption-zone="true" style="([^"]+)"/)![1]!
      const top = Number(zone.match(/top:(\d+)px/)![1])
      expect(top).toBeGreaterThanOrEqual(1260)
      expect(top + FWP_SPLIT_CAPTION_ZONE.height).toBeLessThanOrEqual(1920)
      expect(top).toBe(FWP_SPLIT_CAPTION_ZONE.top)
      expect(top + FWP_SPLIT_CAPTION_ZONE.height).toBeLessThanOrEqual(1640)
      expect(html).toContain(`object-position:${FWP_POSTER_POSITIONS[beat]}`)
      const override = renderToStaticMarkup(React.createElement(FWP_MOCKS[beat], { ...props, posterPosition: '45% 20%' }))
      expect(override).toContain('object-position:45% 20%')
    })
  }
  it('gives exactly one annotation to each named element', () => {
    const elements = { done: { x: 120, y: 256, w: 126, h: 58 },
      amazon: { x: 420, y: 220, w: 240, h: 240 },
      noSending: { x: 72, y: 440, w: 828, h: 163.2 } }
    for (const [beat, name] of [['hook', 'done'], ['proof', 'amazon'], ['close', 'noSending']] as const) {
      const html = render(beat)
      expect(html.match(/data-device="scribble"/g)).toHaveLength(1)
      expect(html).toContain(`data-scribble-target="${name}"`)
      expect(html).toContain(`data-scribble-shape="${{ hook: 'underline', proof: 'loop', close: 'tick' }[beat]}"`)
      const encoded = html.match(/data-target-box="([^"]+)"/)![1]!
      const t = JSON.parse(encoded.replaceAll('&quot;', '"')), e = {
        x: (1080 - 1080 * FWP_STAGE_SCALE) / 2 + elements[name].x * FWP_STAGE_SCALE,
        y: elements[name].y * FWP_STAGE_SCALE,
        w: elements[name].w * FWP_STAGE_SCALE, h: elements[name].h * FWP_STAGE_SCALE,
      }
      expect(t).toEqual(FWP_SCALED_TARGETS[name])
      expect(FWP_TARGETS[name]).toEqual(elements[name])
      if (beat === 'proof') expect(html).toContain('data-logo-tile="Amazon" transform="translate(420 220)"')
      if (beat === 'close') expect(html).toContain('data-device="stamp-1" data-scale="2.4" style="position:absolute;left:72px;top:440px;')
      expect(Math.min(t.x + t.w, e.x + e.w)).toBeGreaterThan(Math.max(t.x, e.x))
      expect(Math.min(t.y + t.h, e.y + e.h)).toBeGreaterThan(Math.max(t.y, e.y))
    }
  })
})


describe('higher split and single stage transform', () => {
  for (const beat of ['hook', 'proof', 'close'] as const) {
    it(`${beat} fits its clipped graphics viewport above the 760px seam`, () => {
      const html = render(beat)
      expect(FWP_SPLIT_SEAM_Y).toBe(760)
      expect(FWP_STAGE_SCALE).toBe(0.76)
      expect(FWP_POSTER_POSITIONS[beat]).toBe('50% 88%')
      expect(html).toContain('data-camera-plate="true" src="fixture-recording-poster.jpg" alt="" style="position:absolute;left:0;top:760px;width:1080px;height:1160px;object-fit:cover;object-position:50% 88%')
      expect(html).toContain('data-proof-stage="true" style="position:absolute;left:0;top:0;width:1080px;height:760px;background:cream;overflow:hidden')
      const graphics = html.match(/data-stage-graphics="true" style="([^"]+)"/)![1]!
      const value = (key: string) => Number(graphics.match(new RegExp(`(?:^|;)${key}:([\\d.]+)(?:px)?(?:;|$)`))![1])
      const left = value('left'), top = value('top')
      expect(graphics).toContain('transform:scale(0.76);transform-origin:top left;overflow:hidden')
      // The clipping viewport contains every child's painted box, including
      // devices whose transparent SVG slot extends beyond the original stage.
      expect(left).toBeCloseTo((1080 - 1080 * 0.76) / 2)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left + value('width') * 0.76).toBeLessThanOrEqual(1080)
      expect(top).toBe(0)
      expect(top + value('height') * 0.76).toBe(760)
      expect(html.match(/data-stage-graphics/g)).toHaveLength(1)
      // Header remains outside the transformed wrapper, at round 2 geometry.
      expect(html).toContain('<header style="position:absolute;left:72px;top:79px;width:888px;height:56px;')
      expect(html.indexOf('<header')).toBeGreaterThan(html.indexOf('data-stage-graphics'))
      for (const target of Object.values(FWP_SCALED_TARGETS)) {
        expect(target.x).toBeGreaterThanOrEqual(0)
        expect(target.y).toBeGreaterThanOrEqual(0)
        expect(target.x + target.w).toBeLessThanOrEqual(1080)
        expect(target.y + target.h).toBeLessThanOrEqual(760)
      }
    })
  }
  it('preserves the seam-free face plate, crop and caption geometry', () => {
    const html = render('face')
    expect(FWP_POSTER_POSITIONS.face).toBe('50% 0%')
    expect(html).toContain('top:0;width:1080px;height:1920px;object-fit:cover;object-position:50% 0%')
    expect(html).toContain('left:72px;top:1180px;width:900px;height:320px')
    expect(html).not.toContain('data-stage-graphics')
    expect(html).not.toContain('data-proof-stage')
  })
})
