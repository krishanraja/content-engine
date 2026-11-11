import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAPTION_THEMES } from './captions/names'
import { THEMES } from './captions/themes'
import { REGIONS, hero, heroScore, key } from './captions/kit'
import { ThemedCaption } from './chrome/ThemedCaption'
import { ART_REGION, ArtDirectedCaption, keyIndex } from './chrome/ArtDirectedCaption'
import { BrandFrame } from './BrandFrame'
import { EngineRenderPropsSchema } from './props'
import fixture from '../../../../fixtures/ve/engine-core/props.json'

const SAFE_TALL = { top: 270, right: 880, bottom: 1320 } // config/channel-safe-zones.json, every platform
const HOUSE_FACES = /MYMU (Anton|Archivo|Fraunces|Plex Mono)/
const page = (texts: string[], swipeIndex: number | null = null) =>
  ({ fromFrame: 0, toFrame: 60, words: texts.map((text, i) => ({ text, atFrame: i * 8 })), swipeIndex })
const render = (node: unknown) => JSON.stringify(node, (_k, v) => (typeof v === 'function' ? undefined : v))
/** Every string a style puts on screen at a frame: text under no hidden, zero-opacity or zero-width-clipped ancestor. */
function visibleText(node: any, out: string[] = [], hidden = false): string[] {
  if (node === null || node === undefined || node === false) return out
  if (typeof node === 'string' || typeof node === 'number') { if (!hidden) out.push(String(node)); return out }
  if (Array.isArray(node)) { node.forEach((n) => visibleText(n, out, hidden)); return out }
  const st = node.props?.style ?? {}
  const off = hidden || st.visibility === 'hidden' || st.opacity === 0 || /inset\(-20% calc\(100% - 0%\)/.test(st.clipPath ?? '')
  return visibleText(node.props?.children, out, off)
}

describe('the caption styles (Krish, 2026-11-11)', () => {
  it('draws every listed style, and the spec allows exactly those names', () => {
    expect([...CAPTION_THEMES].filter((n) => n !== 'art-directed').sort()).toEqual(Object.keys(THEMES).sort())
    const spec = readFileSync(new URL('../../../../packages/contracts/src/production-spec.ts', import.meta.url), 'utf8')
    for (const name of CAPTION_THEMES) expect(spec).toContain(`'${name}'`)
  })

  it('keeps every caption box inside every platform safe area on 9:16 and inside title-safe on 16:9', () => {
    for (const b of Object.values(REGIONS['9:16'])) {
      expect(b.top).toBeGreaterThanOrEqual(SAFE_TALL.top); expect(b.top + b.height).toBeLessThanOrEqual(SAFE_TALL.bottom)
      // the action rail starts at x 880 below y 520; above it the full width is safe
      expect(b.left + b.width).toBeLessThanOrEqual(b.top + b.height > 520 ? SAFE_TALL.right : 1010)
    }
    for (const b of Object.values(REGIONS['16:9'])) {
      expect(b.left).toBeGreaterThanOrEqual(192); expect(b.left + b.width).toBeLessThanOrEqual(1728)
      expect(b.top).toBeGreaterThanOrEqual(108); expect(b.top + b.height).toBeLessThanOrEqual(1026)
    }
  })

  it('scores heroes as Audrey does: a reversal or the stressed claim word, never filler, and a setup line has none', () => {
    expect(hero(page(['Cash', 'machines', 'should', 'have'], 3))).toBe(-1)
    expect(clean(hero(page(['ended', 'the', 'bank', 'teller.'], 3)), ['ended', 'the', 'bank', 'teller.'])).toBe('teller.')
    expect(hero(page(['They', "didn't."], 1))).toBe(1)
    expect(hero(page(['up', '40', 'percent']))).toBe(1)
    expect(heroScore(page(['the', 'bank']), 0)).toBeLessThan(0)
    expect(key(page(['Cash', 'machines', 'should', 'have'], null))).toBe(1)
  })

  it('draws every style in the house faces and colours only, and shows no word before it is said', () => {
    const fx = EngineRenderPropsSchema.parse(fixture)
    const base = { ...fx, captions: [page(['Banks', 'opened', 'more', 'branches.'], 3), ...fx.captions.slice(1).map((c) => ({ ...c, fromFrame: Math.max(c.fromFrame, 60) }))] }
    const allowed = new Set(Object.values(base.tokens))
    for (const [name, draw] of Object.entries(THEMES)) {
      const p0 = base.captions[0]!
      const at = p0.words[0]!.atFrame + 1
      const early = visibleText(draw(base, at)).join(' ').toLowerCase()
      // the probe can see a word: the first one, said already, is on screen (the terminal types it, so a prefix)
      expect(early, `${name} hides the first word`).toContain(p0.words[0]!.text.replace(/[,.;:]+$/, '').toLowerCase().slice(0, 1))
      if (name !== 'gaming-stream') expect(early, name).toContain(p0.words[0]!.text.replace(/[,.;:]+$/, '').toLowerCase())
      // karaoke sets the whole line quietly by design and fills each word as it is said; every other style holds a word back
      for (const w of p0.words.filter((w) => w.atFrame > at + 1)) {
        const word = w.text.replace(/[,.;:]+$/, '').toLowerCase()
        if (name !== 'karaoke' && name !== 'podcast') expect(early.split(/[\s>]+/), `${name} shows "${word}" early`).not.toContain(word)
      }
      const html = render(draw(base, p0.toFrame - 2))
      for (const f of html.matchAll(/"fontFamily":"((?:\\.|[^"\\])*)"/g)) expect(f[1], name).toMatch(HOUSE_FACES)
      for (const c of html.matchAll(/"(?:color|background)":"(rgb\([^"]+\))"/g)) expect(allowed.has(c[1]!), `${name} ${c[1]}`).toBe(true)
    }
  })

  it('replaces the house caption when a spec names a style', () => {
    const props = { ...EngineRenderPropsSchema.parse(fixture), captionTheme: 'cinematic' as const }
    const nodes = ([] as unknown[]).concat((BrandFrame({ props, beat: props.beats[0]!, frame: 5 }) as any).props.children).flat(3)
    const themed = nodes.find((n: any) => n?.type === ThemedCaption) as any
    expect(themed?.props.theme).toBe('cinematic')
  })

  it('cinematic: the hero lands as tinted glass at hero scale, and layout states rotate between pages', () => {
    const base = EngineRenderPropsSchema.parse(fixture)
    const props = { ...base, captionTheme: 'cinematic' as const, captions: [page(['They', "didn't."], 1), { ...page(['Banks', 'opened', 'more', 'branches.'], 3), fromFrame: 60, toFrame: 120, words: page(['Banks', 'opened', 'more', 'branches.'], 3).words.map((w) => ({ ...w, atFrame: w.atFrame + 60 })) }] }
    const a = render(THEMES.cinematic(props, 20)), b = render(THEMES.cinematic(props, 110))
    expect(a).toContain('"backgroundClip":"text"'); expect(a).toContain('"color":"transparent"')
    expect(Number(/"fontSize":(\d+)/.exec(a.slice(a.indexOf('backgroundClip') - 400))?.[1] ?? 0)).toBeGreaterThanOrEqual(150)
    expect(a).not.toEqual(b)
    expect(REGIONS['9:16'].upper.top).toBeGreaterThanOrEqual(SAFE_TALL.top)
  })

  it('art-directed: the key word alone at 168 px, the rest at 92, never coloured, inside the safe area', () => {
    const r = ART_REGION['9:16']
    expect(r.top).toBeGreaterThanOrEqual(SAFE_TALL.top); expect(r.left + r.width).toBeLessThanOrEqual(SAFE_TALL.right)
    expect(r.top + r.height).toBeLessThanOrEqual(SAFE_TALL.bottom)
    const base = EngineRenderPropsSchema.parse(fixture)
    const props = { ...base, captionTheme: 'art-directed' as const, captions: [page(['Banks', 'opened', 'more', 'branches.']), ...base.captions.slice(1)] }
    const html = render(ArtDirectedCaption({ props, frame: 40 }))
    expect(html).toContain('"fontSize":168'); expect(html).toContain('"fontSize":92')
    expect([...html.matchAll(/"color":"([^"]+)"/g)].map((m) => m[1]).every((c) => c === props.tokens.cream)).toBe(true)
    expect(keyIndex(props.captions[0]!)).toBe(3)
  })

  it('refuses a style name the engine does not have', () => {
    expect(EngineRenderPropsSchema.safeParse({ ...fixture, captionTheme: 'comic-sans' }).success).toBe(false)
  })
})

function clean(i: number, words: string[]) { return words[i] }
