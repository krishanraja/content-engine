import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import retiredStyles from '../../../../config/retired-styles.json'
import { CAPTION_THEMES } from './captions/names'
import { THEMES } from './captions/themes'
import { REGIONS, hero, heroScore, key, textWidth } from './captions/kit'
import { ThemedCaption } from './chrome/ThemedCaption'
import { ART_REGION, ArtDirectedCaption, artLayout, cutHeight, keyIndex } from './chrome/ArtDirectedCaption'
import { BrandFrame } from './BrandFrame'
import { exitProgress } from './captions/draw'
import { EngineRenderPropsSchema } from './props'
import fixture from '../../../../fixtures/ve/engine-core/props.json'

const SAFE_TALL = { top: 270, right: 880, bottom: 1320 } // config/channel-safe-zones.json, every platform
const HOUSE_FACES = /MYMU (Anton|Archivo|Fraunces)|DM Mono/
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

/** The strongest opacity any string on screen is drawn at (ancestors multiply). */
function peakTextOpacity(node: any, up = 1): number {
  if (node === null || node === undefined || node === false) return 0
  if (typeof node === 'string' || typeof node === 'number') return up
  if (Array.isArray(node)) return Math.max(0, ...node.map((n) => peakTextOpacity(n, up)))
  const st = node.props?.style ?? {}
  return peakTextOpacity(node.props?.children, st.visibility === 'hidden' ? 0 : up * (typeof st.opacity === 'number' ? st.opacity : 1))
}

describe('the caption styles (Krish, 2026-11-11)', () => {
  it('draws every listed style, and the spec allows exactly those names', () => {
    expect([...CAPTION_THEMES].filter((n) => n !== 'art-directed').sort()).toEqual(Object.keys(THEMES).sort())
    const spec = readFileSync(new URL('../../../../packages/contracts/src/production-spec.ts', import.meta.url), 'utf8')
    for (const name of CAPTION_THEMES) expect(spec).toContain(`'${name}'`)
  })

  it('describes every style for the publish board, once and in the same order (config/caption-themes.json)', () => {
    const themes = JSON.parse(readFileSync(new URL('../../../../config/caption-themes.json', import.meta.url), 'utf8')) as Record<string, unknown>
    expect(Object.keys(themes).filter((k) => !k.startsWith('_'))).toEqual([...CAPTION_THEMES])
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

  it('draws live styles in the house faces and colours and respects their word timing', () => {
    const fx = EngineRenderPropsSchema.parse(fixture)
    const base = { ...fx, captions: [page(['Banks', 'opened', 'more', 'branches.'], 3), ...fx.captions.slice(1).map((c) => ({ ...c, fromFrame: Math.max(c.fromFrame, 60) }))] }
    const allowed = new Set(Object.values(base.tokens))
    const retired = new Set(retiredStyles.filter(s => s.kind === 'caption_theme').map(s => s.id))
    for (const [name, draw] of Object.entries(THEMES)) {
      if (retired.has(name)) continue
      const p0 = base.captions[0]!
      const at = p0.words[0]!.atFrame + 1
      const early = visibleText(draw(base, at)).join(' ').toLowerCase()
      expect(early, name).toContain(p0.words[0]!.text.replace(/[,.;:]+$/, '').toLowerCase())
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

  it('an outgoing page is gone on its last live frame, the frame the next page first word lands', () => {
    const fx = EngineRenderPropsSchema.parse(fixture)
    const next = { ...page(['Then', 'they', 'closed.']), fromFrame: 60, toFrame: 120 }
    next.words = next.words.map((w) => ({ ...w, atFrame: w.atFrame + 60 }))
    const alone = { ...fx, captions: [page(['Banks', 'opened', 'more', 'branches.'], 3)] }
    const abut = { ...fx, captions: [page(['Banks', 'opened', 'more', 'branches.'], 3), next] }
    expect(exitProgress({ toFrame: 60 }, 55, 59)).toBe(1)
    expect(exitProgress({ toFrame: 60 }, undefined, 59)).toBe(0)
    for (const name of ['rack-focus', 'stair-flash', 'tuck-stack', 'flip-hinge', 'receipt-chip']) {
      const draw = (THEMES as Record<string, (p: unknown, f: number) => unknown>)[name]!
      expect(peakTextOpacity(draw(alone, 58)), `${name} is still drawing before its exit ends`).toBeGreaterThan(0)
      expect(peakTextOpacity(draw(alone, 59)), `${name} still shows the old page on its last frame`).toBe(0)
      // abutting pages: on the frame the new page's first word lands, only the new page is drawn
      const both = visibleText(draw(abut, 59)).join(' ').toLowerCase()
      expect(both, `${name} draws the old page over the new one`).not.toMatch(/banks|opened|branches/)
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

  // The three caption rules (Krish, 2026-11-18, of the Tue 17 data-centres short, one word a page: "They are really
  // jolty, and each word moving from left to right is really hard to look at and stressful. We can't have each new word
  // appear somewhere else on the screen, and we need the previous word to stick around for a tiny bit longer."):
  // 1 a new word never appears somewhere else, 2 the previous page stays a little longer, 3 nothing jolts.
  const oneWord = (texts: string[], per = 6, emphasised: number[] = []) => texts.map((text, i) =>
    ({ fromFrame: i * per, toFrame: (i + 1) * per, words: [{ text, atFrame: i * per }], swipeIndex: emphasised.includes(i) ? 0 : null }))
  const artProps = (captions: ReturnType<typeof oneWord>) =>
    ({ ...EngineRenderPropsSchema.parse(fixture), captionTheme: 'art-directed' as const, captions })
  /** Every element of a React tree that satisfies `pred`. */
  const elements = (node: any, pred: (el: any) => boolean, out: any[] = []): any[] => {
    if (!node || typeof node !== 'object') return out
    if (Array.isArray(node)) { node.forEach((n) => elements(n, pred, out)); return out }
    if (node.props && pred(node)) out.push(node)
    elements(node.props?.children, pred, out)
    return out
  }
  const flat = (el: any) => (typeof el.props.children === 'string' ? el.props.children : [el.props.children].flat(9).filter((c: unknown) => typeof c === 'string').join(''))
  const words = (node: any) => elements(node, (e) => e.props['data-art-word'] !== undefined)
  const stack = (node: any) => elements(node, (e) => e.props['data-art-stack'])[0]
  const ghost = (node: any) => elements(node, (e) => e.props['data-caption-ghost'])[0]
  const echoes = (node: any) => elements(node, (e) => e.props['data-caption-echo'])

  it('art-directed rule 1: every one-word page lands in the same place, left aligned from one corner, never alternating', () => {
    const props = artProps(oneWord(['Secretly', 'they', 'charge', 'you', 'more', 'than', 'you', 'would', 'pay']))
    const anchors = props.captions.map((p) => {
      const drawn = ArtDirectedCaption({ props, frame: p.words[0]!.atFrame + 2 })
      const s = stack(drawn).props.style
      const [w] = words(drawn)
      return { left: s.left, top: s.top, align: s.alignItems, size: w.props.style.fontSize, row: artLayout(p, '9:16').rows.length }
    })
    expect(new Set(anchors.map((a) => JSON.stringify(a))).size).toBe(1)
    // one row of 168 px at 0.96, hanging from the foot of the region (y 1320 on the tall frame)
    expect(anchors[0]).toMatchObject({ left: 0, align: 'flex-start', size: 168, row: 1 })
    expect(anchors[0]!.top + 168 * 0.96).toBeCloseTo(ART_REGION['9:16'].height, 5)
    // phrase pages too: page after page is drawn from the same corner, whatever its words
    const phrases = { ...props, captions: [page(['Banks', 'opened', 'more', 'branches.']),
      { ...page(['Then', 'they', 'closed.']), fromFrame: 60, toFrame: 120, words: page(['Then', 'they', 'closed.']).words.map((w) => ({ ...w, atFrame: w.atFrame + 60 })) }] }
    const a = JSON.stringify(stack(ArtDirectedCaption({ props: phrases, frame: 40 })).props.style)
    const b = JSON.stringify(stack(ArtDirectedCaption({ props: phrases, frame: 100 })).props.style)
    expect(a).toBe(b)
    expect(render(ArtDirectedCaption({ props: phrases, frame: 100 }))).not.toContain('flex-end')
  })

  it('art-directed rule 1, phrase pages: the first word of every page lands at the same point, whatever its row count', () => {
    const at = (from: number, texts: string[], swipe: number | null = null) =>
      ({ fromFrame: from, toFrame: from + 40, words: texts.map((text, i) => ({ text, atFrame: from + i * 7 })), swipeIndex: swipe })
    const captions = [at(0, ['Banks', 'opened', 'more', 'branches.'], 3), at(40, ['Then', 'the', 'quiet', 'lender', 'closed.'], 4), at(80, ['Why?'], 0)]
    const props = { ...EngineRenderPropsSchema.parse(fixture), captionTheme: 'art-directed' as const, captions }
    const heights = captions.map((p) => artLayout(p, '9:16').height)
    expect(heights[1]!).toBeGreaterThan(heights[0]!)           // a taller page than the first...
    expect(cutHeight(captions, '9:16')).toBeCloseTo(Math.max(...heights), 5)  // ...so the stack hangs from the tallest
    const first = captions.map((p) => {
      const drawn = ArtDirectedCaption({ props, frame: p.fromFrame + 2 })
      return { top: stack(drawn).props.style.top, left: stack(drawn).props.style.left, ghostBottom: ghost(drawn)?.props.style.bottom }
    })
    expect(first[0]!.top).toBe(first[1]!.top); expect(first[1]!.top).toBe(first[2]!.top)
    expect(first[1]!.ghostBottom).toBe(first[2]!.ghostBottom)  // the ghost line never moves either
    // and the tallest page never runs past the foot of the region into the platforms' bottom band (y 1320)
    expect(first[0]!.top + Math.max(...heights)).toBeCloseTo(ART_REGION['9:16'].height, 5)
  })

  it('art-directed: a page is laid out whole before its words are said, so a word lands where it was reserved', () => {
    const p = { ...artProps([]), captions: [page(['Banks', 'opened', 'more', 'branches.'])] }
    const before = ArtDirectedCaption({ props: p, frame: 0 }), after = ArtDirectedCaption({ props: p, frame: 40 })
    const rows = (n: any) => JSON.stringify(elements(n, (e) => typeof e.props.style?.height === 'number').map((e) => e.props.style.height))
    expect(rows(before)).toBe(rows(after))
    expect(words(before)).toHaveLength(4); expect(words(after)).toHaveLength(4)
    expect(words(before).filter((e) => e.props.style.visibility === 'hidden')).toHaveLength(3)
    expect(words(after).filter((e) => e.props.style.visibility === 'hidden')).toHaveLength(0)
    expect(artLayout(p.captions[0]!, '9:16').rows.map((r) => r.size)).toEqual([92, 168])
  })

  it('art-directed: a long key word shrinks to the region, a short one stays at 168', () => {
    const long = artLayout(page(['infrastructure.']), '9:16').rows[0]!
    expect(long.size).toBeLessThan(168); expect(long.size * 'infrastructure'.length * 0.47).toBeLessThanOrEqual(ART_REGION['9:16'].width + 1)
    expect(artLayout(page(['pay']), '9:16').rows[0]!.size).toBe(168)
  })

  it('art-directed rule 2: the previous word stays, smaller and dimmed on the line above, for a few hundred ms, then fades', () => {
    const props = artProps(oneWord(['charge', 'you'], 6).map((p, i) => i === 1 ? { ...p, toFrame: 90 } : p)) // "you" runs 2.8 s
    const at = (frame: number) => ArtDirectedCaption({ props, frame })
    const g0 = ghost(at(6))
    expect(g0, 'the previous word is there on the frame the next is said').toBeTruthy()
    expect(flat(elements(g0, (e) => e.props.style?.fontSize === 52)[0])).toBe('CHARGE')
    const size = (n: any) => n.props.style.fontSize
    expect(size(elements(g0, (e) => e.props.style?.fontSize === 52)[0])).toBeLessThan(size(words(at(6))[0]))
    // dimmer than the word being said, above it, and still there 0.3 s on
    expect(g0.props.style.opacity).toBeLessThanOrEqual(0.5)
    expect(g0.props.style.bottom).toBeGreaterThan(168 * 0.96) // above the stack of one 168 px row
    const mid = ghost(at(6 + 9)); expect(mid.props.style.opacity).toBeCloseTo(0.5, 2)
    // gone after the hold (0.6 s), not before it, and its last 0.2 s is a fade rather than a cut
    expect(ghost(at(6 + 14))?.props.style.opacity).toBeLessThan(0.5)
    expect(ghost(at(6 + 19))).toBeFalsy()
    // the first page has nothing before it
    expect(ghost(at(2))).toBeFalsy()
  })

  it('art-directed rule 3: nothing jolts: no scale or turn, a new word is never invisible, the echo and ghost only fade', () => {
    const props = artProps(oneWord(['Secretly', 'they', 'charge', 'you', 'more'], 5, [2]))
    let echoSeen = 0
    for (let frame = 0; frame < 28; frame++) {
      const drawn = ArtDirectedCaption({ props, frame })
      if (!drawn) continue
      expect(render(drawn), `frame ${frame}`).not.toMatch(/scale|rotate|skew/)
      for (const w of words(drawn)) expect(w.props.style.transform).toMatch(/^translateY\(/)
      for (const w of words(drawn).filter((e) => e.props.style.visibility === 'visible')) expect(w.props.style.opacity, `frame ${frame}`).toBeGreaterThanOrEqual(0.7)
      for (const e of echoes(drawn)) { echoSeen++; expect(e.props.style.opacity).toBeLessThanOrEqual(0.07 + 1e-9) }
    }
    expect(echoSeen).toBeGreaterThan(0)
    // the word said on frame 10 is already on screen on frame 9, one frame early, so it never pops on late
    expect(words(ArtDirectedCaption({ props, frame: 9 }))[0]!.props.style.visibility).toBe('visible')
  })

  it('art-directed: the echo goes to an emphasised word or a phrase, never flickers behind every word of a one-word page', () => {
    const plain = artProps(oneWord(['Secretly', 'they', 'charge']))
    for (let frame = 0; frame < 18; frame++) expect(echoes(ArtDirectedCaption({ props: plain, frame }))).toHaveLength(0)
    const emphasised = artProps(oneWord(['Secretly', 'they', 'charge'], 6, [1]))
    expect(echoes(ArtDirectedCaption({ props: emphasised, frame: 9 })).map(flat)).toEqual(['THEY'])
    // and when the next page begins the last echo fades out under it instead of cutting
    const handover = echoes(ArtDirectedCaption({ props: emphasised, frame: 13 }))
    expect(handover.map(flat)).toEqual(['THEY']); expect(handover[0].props.style.opacity).toBeLessThan(0.07)
    expect(echoes(ArtDirectedCaption({ props: { ...plain, captions: [page(['Banks', 'opened', 'more', 'branches.'])] }, frame: 40 })).map(flat)).toEqual(['BRANCHES'])
  })

  it('refuses a style name the engine does not have', () => {
    expect(EngineRenderPropsSchema.safeParse({ ...fixture, captionTheme: 'comic-sans' }).success).toBe(false)
  })
})

function clean(i: number, words: string[]) { return words[i] }

describe('a word wider than the house line on an art-directed cut', () => {
  it('the site address alone on its page fits the 9:16 region (compile FITS_LONE_WORD_THEMES)', () => {
    const page = { fromFrame: 0, toFrame: 30, words: [{ text: 'makeyourmindup.ai', atFrame: 0 }] } as unknown as Parameters<typeof artLayout>[0]
    const layout = artLayout(page, '9:16')
    expect(layout.rows).toHaveLength(1)
    const size = layout.rows[0]!.size
    expect(size).toBeGreaterThanOrEqual(72)
    expect(textWidth('makeyourmindup.ai', size, 'anton', true)).toBeLessThanOrEqual(ART_REGION['9:16'].width)
  })
})
