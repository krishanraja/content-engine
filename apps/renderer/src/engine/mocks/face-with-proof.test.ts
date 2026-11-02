import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FWP_MOCKS, type FWPMockProps } from './face-with-proof'
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
      expect(html).toContain('left:72px;top:1180px;width:900px;height:320px')
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
    const images = [...html.matchAll(/<image[^>]+width="([\d.]+)" height="([\d.]+)"/g)]
    expect(images).toHaveLength(5)
    for (const image of images) {
      expect(Number(image[1])).toBeGreaterThanOrEqual(140)
      expect(Number(image[2])).toBeGreaterThanOrEqual(140)
    }
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
