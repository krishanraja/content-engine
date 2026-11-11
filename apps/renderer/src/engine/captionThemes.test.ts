import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { themeRegistry } from './captionThemes/registry'
import { CAPTION_THEMES } from './captionThemes/names'
import { THEME_REGION, ThemedCaption, themeData } from './chrome/ThemedCaption'
import { ART_REGION, ArtDirectedCaption, keyIndex } from './chrome/ArtDirectedCaption'
import { BrandFrame } from './BrandFrame'
import { EngineRenderPropsSchema } from './props'
import fixture from '../../../../fixtures/ve/engine-core/props.json'

const SAFE_TALL = { top: 270, right: 880, bottom: 1320 } // config/channel-safe-zones.json, every platform

describe('the caption themes (Krish, 2026-11-11)', () => {
  it('lists every vendored theme, and the spec allows exactly those names', () => {
    expect([...CAPTION_THEMES].filter((n) => n !== 'art-directed').sort()).toEqual(Object.keys(themeRegistry).sort())
    const spec = readFileSync(new URL('../../../../packages/contracts/src/production-spec.ts', import.meta.url), 'utf8')
    for (const name of CAPTION_THEMES) expect(spec).toContain(`'${name}'`)
  })

  it('draws inside every platform safe area on 9:16 and inside title-safe on 16:9', () => {
    const t = THEME_REGION['9:16']
    expect(t.top).toBeGreaterThanOrEqual(SAFE_TALL.top)
    expect(t.left + t.width).toBeLessThanOrEqual(SAFE_TALL.right)
    expect(t.top + t.height).toBeLessThanOrEqual(SAFE_TALL.bottom)
    const w = THEME_REGION['16:9']
    expect(w.left).toBeGreaterThanOrEqual(192); expect(w.left + w.width).toBeLessThanOrEqual(1728)
    expect(w.top).toBeGreaterThanOrEqual(108); expect(w.top + w.height).toBeLessThanOrEqual(1026)
  })

  it('times each word from its own frame to the next, the page swipe as emphasis', () => {
    const props = EngineRenderPropsSchema.parse(fixture)
    const data = themeData(props)
    expect(data.lines).toHaveLength(props.captions.length)
    const page = props.captions[0]!
    expect(data.lines[0]!.words[0]!.start).toBeCloseTo(page.words[0]!.atFrame / 30)
    expect(data.lines[0]!.words.at(-1)!.end).toBeCloseTo(page.toFrame / 30)
    for (const line of data.lines) for (const w of line.words) expect(w.end).toBeGreaterThanOrEqual(w.start)
  })

  it('replaces the house caption when a spec names a theme, in the house colours', () => {
    const props = { ...EngineRenderPropsSchema.parse(fixture), captionTheme: 'karaoke' as const }
    const nodes = ([] as unknown[]).concat((BrandFrame({ props, beat: props.beats[0]!, frame: 5 }) as any).props.children).flat(3)
    const themed = nodes.find((n: any) => n?.type === ThemedCaption) as any
    expect(themed?.props.theme).toBe('karaoke')
    const inner = ThemedCaption({ props, theme: 'karaoke' }) as any
    expect(inner.props.children.props).toMatchObject({ primaryColor: props.tokens.cream, secondaryColor: props.tokens.channel })
  })

  it('art-directed: the key word alone at 168 px, the rest at 92, phrases alternating sides, inside the safe area', () => {
    const r = ART_REGION['9:16']
    expect(r.top).toBeGreaterThanOrEqual(SAFE_TALL.top); expect(r.left + r.width).toBeLessThanOrEqual(SAFE_TALL.right)
    expect(r.top + r.height).toBeLessThanOrEqual(SAFE_TALL.bottom)
    const base = EngineRenderPropsSchema.parse(fixture)
    const words = [{ text: 'Banks', atFrame: 0 }, { text: 'opened', atFrame: 6 }, { text: 'more', atFrame: 12 }, { text: 'branches.', atFrame: 18 }]
    const props = { ...base, captionTheme: 'art-directed' as const, captions: [{ fromFrame: 0, toFrame: 60, words, swipeIndex: null }, ...base.captions.slice(1)] }
    const page = props.captions[0]!
    const last = page.words.at(-1)!.atFrame + 10
    const out = ArtDirectedCaption({ props, frame: last }) as any
    const html = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? undefined : v))
    expect(html).toContain('"fontSize":168'); expect(html).toContain('"fontSize":92')
    // Never coloured: every colour is the house cream token.
    expect([...html.matchAll(/"color":"([^"]+)"/g)].map((m) => m[1]).every((c) => c === props.tokens.cream)).toBe(true)
    expect(keyIndex({ ...page, swipeIndex: null })).toBe(page.words.reduce((b, w, i, a) => (w.text.length > a[b]!.text.length ? i : b), 0))
  })

  it('refuses a theme name the engine does not have', () => {
    expect(EngineRenderPropsSchema.safeParse({ ...fixture, captionTheme: 'comic-sans' }).success).toBe(false)
  })
})
