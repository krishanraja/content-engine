import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import studio from '../../../../../config/studio.json'
import { GradedBackdrop, type GradeProps } from './Grade'

const house = studio.brand_themes.find(theme => theme.theme_id === 'makeyourmindup-video-v1')!.publication!.house_style!.tokens
const tokens = { ink: house.ink, inkDeep: house.ink_deep, inkSoft: house.ink_soft, cream: house.cream, mint: house.mint }
const props: GradeProps = { src: 'server-hall.jpg', focus: 0, tokens, frame: 42, width: 1080, height: 1920 }
const markup = (patch: Partial<GradeProps> = {}) => renderToStaticMarkup(createElement(GradedBackdrop, { ...props, ...patch }))
const blur = (focus: number, width = 1080) => Number(markup({ focus, width }).match(/stdDeviation="([\d.]+)"/)?.[1])

describe('shared photograph and drawn-stage grade', () => {
  it('racks smoothly from sharp to a deeply blurred stage at canvas scale', () => {
    expect(blur(0)).toBe(0)
    expect(blur(1)).toBeGreaterThanOrEqual(16)
    expect(blur(0.5)).toBe(blur(1) / 2)
    expect(blur(1, 2160)).toBe(blur(1) * 2)
    for (let i = 0; i <= 12; i++) expect(blur(i / 12)).toBeCloseTo(18 * i / 12)
  })
  it('takes every colour from tokens, without literal colour values', () => {
    const source = readFileSync(new URL('./Grade.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/#[\da-f]{3,8}\b|rgba?\s*\(/i)
    const colours = [...markup({ focus: 1 }).matchAll(/(?:fill|stop-color|flood-color)="([^"]+)"/g)].map(m => m[1]!)
    expect(colours.length).toBeGreaterThan(0)
    for (const colour of colours) expect(colour.startsWith('url(') || Object.values(tokens).includes(colour)).toBe(true)
  })
  it('is repeatable, including fixed-seed grain, and drifts only from the supplied frame', () => {
    expect(markup()).toBe(markup())
    expect(markup()).toContain('seed="17"')
    expect(markup({ frame: 43 })).not.toBe(markup())
  })
  it('bounds the brightest stage pixel to at least 4.5:1 against cream so the place keeps its light (Krish, 18 Nov)', () => {
    const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    const luminance = (rgb: number[]) => rgb.reduce((sum, c, i) => sum + (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]!, 0)
    const cream = channels(tokens.cream)
    // White photograph under the ink veil, then maximum top light and grain.
    const ceiling = channels(tokens.ink).map((c, i) => {
      const veiled = 0.1 + 0.9 * c
      const lit = veiled * 0.975 + cream[i]! * 0.025
      return lit * 0.98 + cream[i]! * 0.02
    })
    expect(markup({ focus: 1 })).toContain(`fill="${tokens.ink}" opacity="0.45"`)
    expect((luminance(cream) + 0.05) / (luminance(ceiling) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })

  it('falls off in focus toward the bottom, so the ground under the graphics reads and is never a plain slab (Tue 17, 19 Nov)', () => {
    const svg = markup({ focus: 1 })
    const radii = [...svg.matchAll(/stdDeviation="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(radii).toContain(18)
    expect(Math.min(...radii.filter((r) => r > 0))).toBeLessThanOrEqual(18 * 0.15 + 1e-9)
    expect(svg).toMatch(/<mask[^>]*>/)
    expect(svg.match(/<image /g)?.length).toBe(2)
  })

  it('scales the photo from its top edge by the zoom compile measured, and not at all without one (Tue 17, 19 Nov)', () => {
    expect(markup({ focus: 1 })).not.toContain('scale(')
    expect(markup({ focus: 1, zoom: 1.6 })).toContain('translate(540 0) scale(1.6) translate(-540 0)')
  })
})
