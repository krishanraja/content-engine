import React from 'react'
import { cancelRender, continueRender, delayRender, Img, staticFile, useCurrentFrame } from 'remotion'
import '../house/fonts.css'
import { fitError, fitLine, type Measure } from './fit'
import type { StoryPlayer, StoryTone } from './props'

/** The stand-off's colours: the house tokens (config/studio.json) and the
 *  three series colours. Flat fills only: no gradients anywhere. */
export const C = {
  ink: '#0C1512',
  cream: '#F4EFE4',
  mint: '#7EF0C0',
  coral: '#FF6A4D',
  yellow: '#FFD84D',
  lilac: '#B7A6FF',
} as const

export const SERIES_COLOURS: Record<string, string> = {
  'follow.the.money': C.yellow,
  'under.the.hood': C.lilac,
  'mind.the.gap': C.coral,
}

/** The brand's faces by role (brand book v1.4, p. 08; scripts/pages/brand.py),
 *  loaded from the repository's own @fontsource files by ../house/fonts.css:
 *  Anton for headlines, Archivo for interface text, IBM Plex Mono for labels.
 *  No fallback family is ever named, so a missing face cannot quietly turn
 *  into a system font: useStoryFonts stops the render instead. */
export const FACE = { display: 'MYMU Anton', ui: 'MYMU Archivo', mono: 'MYMU Plex Mono' } as const
export type Face = keyof typeof FACE
export const FPS = 30

/** Where text and logos may go (story_io.py checks every frame against the
 *  same numbers in config/story-intro-outro.json, `safe_areas`). 9:16 keeps
 *  clear of the Shorts, Reels and TikTok top bar, bottom caption block and
 *  right-hand buttons; 16:9 is the 5 % title-safe margin. */
export const SAFE = {
  '16x9': { x0: 96, y0: 54, x1: 1824, y1: 1026 },
  '9x16': { x0: 120, y0: 250, x1: 960, y1: 1480 },
} as const
export type Shape = keyof typeof SAFE

const FACES_TO_LOAD = [`400 100px "${FACE.display}"`, `800 100px "${FACE.ui}"`, `700 100px "${FACE.ui}"`, `600 100px "${FACE.mono}"`]

/** Hold the frame until every brand face is loaded, then render, so every
 *  measurement (and so every frame) is taken in the real faces. A face that
 *  does not load stops the render (STORY_FONT), never falls back. */
export function useStoryFonts(): boolean {
  const [handle] = React.useState(() => delayRender('story stand-off fonts'))
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    Promise.all(FACES_TO_LOAD.map((f) => document.fonts.load(f, 'Aa?'))).then((loaded) => {
      const missing = FACES_TO_LOAD.filter((f, i) => !(loaded[i] ?? []).length || !document.fonts.check(f, 'Aa?'))
      if (missing.length) {
        cancelRender(new Error(`STORY_FONT: the brand face(s) ${missing.join(', ')} did not load (apps/renderer/src/house/fonts.css; run npm ci)`))
        return
      }
      setReady(true)
    }).catch((error: unknown) => cancelRender(error))
  }, [])
  React.useEffect(() => {
    if (ready) continueRender(handle)
  }, [ready, handle])
  return ready
}

let canvas: HTMLCanvasElement | null = null
/** The width of `text` at `size` px in a brand face. */
export function textWidth(text: string, size: number, face: Face = 'display', weight?: number): number {
  canvas = canvas ?? document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('STORY_FONT: no canvas to measure type with')
  ctx.font = `${weight ?? WEIGHT[face]} ${size}px "${FACE[face]}"`
  return ctx.measureText(text).width
}
export const WEIGHT: Record<Face, number> = { display: 400, ui: 800, mono: 600 }
export const measureWith = (face: Face, weight?: number): Measure => (text, size) => textWidth(text, size, face, weight)

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const cubicOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
export const cubicIO = (x: number) => { const t = clamp(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
export const quadIO = (x: number) => { const t = clamp(x); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 }
/** An entrance in place: from f0 it fades in over `fade` frames while its
 *  scale eases from `from` to 1 over `n` frames. null before f0. */
export function settle(f: number, f0: number, from = 1.06, n = 6, fade = 4): { scale: number; opacity: number } | null {
  const k = f - f0
  if (k < 0) return null
  return { scale: from + (1 - from) * cubicOut(k / n), opacity: clamp((k + 1) / fade) }
}

/** A flat, darker version of a colour, for the hard drop shadows. */
export function shade(hex: string, k = 0.62): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(v * k).toString(16).padStart(2, '0')
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`
}

/** A data URI, a URL, or an imported asset's served path (starting "/")
 *  is used as it is; any other string is a file in the bundle's public
 *  folder, passed to staticFile. */
export function logoSrc(logo: string): string {
  return /^(data:|https?:|blob:|\/)/.test(logo) ? logo : staticFile(logo)
}

export const abs = (style: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', ...style })

/** Text in a brand face, marked for the safe-area check. */
export function Txt({ id, group, face, weight, size, color, style, children, lineHeight = 1 }: {
  id: string; group: string; face: Face; weight?: number; size: number; color: string; style: React.CSSProperties; children: React.ReactNode; lineHeight?: number
}) {
  return (
    <div data-safe="text" data-id={id} data-group={group}
      style={abs({ fontFamily: `"${FACE[face]}"`, fontWeight: weight ?? WEIGHT[face], fontSize: size, lineHeight, color, whiteSpace: 'pre', ...style })}>
      {children}
    </div>
  )
}

/** A real logo file, unaltered, fitted inside its box; marked for the check. */
export function Logo({ id, group, src, alt, style }: { id: string; group: string; src: string; alt: string; style: React.CSSProperties }) {
  return (
    <div data-safe="logo" data-id={id} data-group={group} style={abs({ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style })}>
      <Img src={logoSrc(src)} alt={alt} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
    </div>
  )
}

/** The brand's own image files, unaltered: never typed, recoloured,
 *  redrawn or cropped. Cream and mint on transparent, so always on ink. */
export const WORDMARK_PX: [number, number] = [3319, 391]
export const MASTHEAD_PX: [number, number] = [2415, 740]

export function BrandImage({ id, group, src, px, height, style, alt }: { id: string; group: string; src: string; px: [number, number]; height: number; style: React.CSSProperties; alt: string }) {
  const width = (height * px[0]) / px[1]
  return (
    <div data-safe="logo" data-id={id} data-group={group} style={abs({ width, height, ...style })}>
      <Img src={logoSrc(src)} alt={alt} style={{ width, height, display: 'block' }} />
    </div>
  )
}

/** A pill label: IBM Plex Mono on a flat fill. Returns its width with it. */
export function pillWidth(text: string, size: number, height: number): number {
  return textWidth(text, size, 'mono') + Math.round(height * 0.42) * 2
}
export function Pill({ id, group, text, size, height, bg, fg, style }: {
  id: string; group: string; text: string; size: number; height: number; bg: string; fg: string; style: React.CSSProperties
}) {
  return (
    <div data-safe="text" data-id={id} data-group={group}
      style={abs({ fontFamily: `"${FACE.mono}"`, fontWeight: 600, fontSize: size, height, lineHeight: `${height}px`, padding: `0 ${Math.round(height * 0.42)}px`,
        borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap', ...style })}>
      {text}
    </div>
  )
}

/** The header row, the same on every card that has one: the brand's wordmark
 *  on an ink plate at the top left of the safe area and the series chip at
 *  the top right. The wordmark is set at the house minimum or above
 *  (config/studio.json, minimum_effective: letters at least 50 px tall on
 *  the 1080 x 1920 canvas). */
export const HEADER: Record<Shape, number> = { '16x9': 76, '9x16': 92 }
const WORDMARK_H: Record<Shape, number> = { '16x9': 44, '9x16': 56 }
export function headerH(shape: Shape): number { return HEADER[shape] }
export function Header({ shape, seriesName, seriesColour, wordmark, opacity = 1 }: {
  shape: Shape; seriesName: string; seriesColour: string; wordmark: string; opacity?: number
}) {
  const S = SAFE[shape]
  const h = HEADER[shape]
  const wm = WORDMARK_H[shape]
  const wmW = (wm * WORDMARK_PX[0]) / WORDMARK_PX[1]
  if (shape === '9x16') {
    // One ink bar across the safe width: the wordmark at its left, the
    // series chip (in its own colour) at its right.
    const ch = 56, cs = 26, pad = 20
    const cw = pillWidth(seriesName, cs, ch)
    if (wmW + cw + 2 * pad + 24 > S.x1 - S.x0) throw new Error(`STORY_FIT: the series name "${seriesName}" does not fit the 9x16 header beside the wordmark`)
    return (
      <div style={abs({ left: 0, top: 0, width: '100%', height: '100%', opacity })}>
        <div style={abs({ left: S.x0, top: S.y0, width: S.x1 - S.x0, height: h, background: C.ink, borderRadius: 14 })}>
          <BrandImage id="header-wordmark" group="header-wordmark" src={wordmark} px={WORDMARK_PX} height={wm} alt="makeyourmindup" style={{ left: pad, top: (h - wm) / 2 }} />
          <Pill id="header-series" group="header-series" text={seriesName} size={cs} height={ch} bg={seriesColour} fg={C.ink}
            style={{ left: S.x1 - S.x0 - pad - cw, top: (h - ch) / 2 }} />
        </div>
      </div>
    )
  }
  const padX = Math.round(h * 0.3)
  const cs = Math.round(h * 0.36)
  const cw = pillWidth(seriesName, cs, h)
  return (
    <div style={abs({ left: 0, top: 0, width: '100%', height: '100%', opacity })}>
      <div style={abs({ left: S.x0, top: S.y0, width: wmW + padX * 2, height: h, background: C.ink, borderRadius: 12 })}>
        <BrandImage id="header-wordmark" group="header-wordmark" src={wordmark} px={WORDMARK_PX} height={wm} alt="makeyourmindup" style={{ left: padX, top: (h - wm) / 2 }} />
      </div>
      <Pill id="header-series" group="header-series" text={seriesName} size={cs} height={h} bg={C.ink} fg={seriesColour} style={{ left: S.x1 - cw, top: S.y0 }} />
    </div>
  )
}

// ---------------------------------------------------------------- the badge

/** The one badge every player gets, on either side: an ink card with the
 *  player's logos in a row, its name in type, and its tag. `stack` puts the
 *  three on top of each other (one player a side); `row` puts the logos
 *  beside the name and tag (more players). */
export type BadgeMode = 'stack' | 'row'
export interface BadgeMetrics {
  mode: BadgeMode; pad: number; logoH: number; logoGap: number; gapX: number; nameMax: number; nameMin: number; gap1: number; gap2: number
  tagSize: number; tagH: number; radius: number
}
export function badgeMetrics(mode: BadgeMode, shape: Shape): BadgeMetrics {
  const tall = shape === '9x16'
  return mode === 'stack'
    ? { mode, pad: 44, logoH: tall ? 150 : 168, logoGap: 34, gapX: 0, nameMax: tall ? 84 : 92, nameMin: 48, gap1: 30, gap2: 24, tagSize: tall ? 32 : 34, tagH: tall ? 60 : 64, radius: 20 }
    : { mode, pad: tall ? 24 : 28, logoH: tall ? 84 : 96, logoGap: 22, gapX: 32, nameMax: tall ? 52 : 58, nameMin: 32, gap1: 0, gap2: 14, tagSize: 24, tagH: 46, radius: 18 }
}

/** A logo's box in a row of marks: equal optical weight, so a wide wordmark
 *  is set lower than a square mark. */
export function logoBox(aspect: number, logoH: number): [number, number] {
  const h = Math.min(logoH, logoH * 0.86 * Math.pow(aspect, -0.25))
  return [h * aspect, h]
}

export interface BadgeLayout {
  w: number; h: number
  /** Each logo's box, relative to the card. */
  logos: { x: number; y: number; w: number; h: number }[]
  name: { x: number; y: number; size: number; w: number }
  tag: { x: number; y: number } | null
  centred: boolean
}

const tagText = (t: string) => t.toUpperCase()

/** The badge's natural width for a player (before the shared width is set). */
export function badgeNaturalWidth(p: StoryPlayer, m: BadgeMetrics, maxW: number, shape: Shape, logoCol = 0): number {
  const inner = maxW - 2 * m.pad
  const logosW = Math.max(logoCol, logoRowWidth(p, m))
  const tags = [p.tag, p.tagAfter].filter((t): t is string => !!t)
  const tagW = Math.max(0, ...tags.map((t) => pillWidth(tagText(t), m.tagSize, m.tagH)))
  if (m.mode === 'stack') {
    const size = nameSize(p, m, inner, shape)
    return Math.min(maxW, Math.max(logosW, textWidth(p.name, size, 'ui'), tagW) + 2 * m.pad)
  }
  const textMax = inner - logosW - m.gapX
  const size = nameSize(p, m, textMax, shape)
  return Math.min(maxW, logosW + m.gapX + Math.max(textWidth(p.name, size, 'ui'), tagW) + 2 * m.pad)
}

export function logoRowWidth(p: StoryPlayer, m: BadgeMetrics): number {
  return p.logos.reduce((s, l, i) => s + logoBox(l.aspect, m.logoH)[0] + (i ? m.logoGap : 0), 0)
}

function nameSize(p: StoryPlayer, m: BadgeMetrics, maxW: number, shape: Shape): number {
  const size = fitLine(p.name, measureWith('ui'), maxW, m.nameMax, m.nameMin)
  if (size === null) throw fitError('player name', p.name, shape, { maxWidth: maxW }, m.nameMin, 'Shorten the name in cover-facts.json (standoff), or use fewer logos.')
  return size
}

/** Where everything sits inside a badge of width `w`. */
/** `logoCol`: in a row, the logo column's width shared by every badge, so
 *  every name starts at the same place. */
export function badgeLayout(p: StoryPlayer, m: BadgeMetrics, w: number, hasTag: boolean, shape: Shape, logoCol = 0): BadgeLayout {
  const inner = w - 2 * m.pad
  const logosW = logoRowWidth(p, m)
  if (m.mode === 'stack') {
    const size = nameSize(p, m, inner, shape)
    const nameH = size * 1.1
    const h = m.pad + m.logoH + m.gap1 + nameH + (hasTag ? m.gap2 + m.tagH : 0) + m.pad
    let x = (w - logosW) / 2
    const logos = p.logos.map((l) => {
      const [lw, lh] = logoBox(l.aspect, m.logoH)
      const box = { x, y: m.pad + (m.logoH - lh) / 2, w: lw, h: lh }
      x += lw + m.logoGap
      return box
    })
    const nw = textWidth(p.name, size, 'ui')
    return { w, h, logos, name: { x: (w - nw) / 2, y: m.pad + m.logoH + m.gap1, size, w: nw },
      tag: hasTag ? { x: w / 2, y: m.pad + m.logoH + m.gap1 + nameH + m.gap2 } : null, centred: true }
  }
  const textX = m.pad + Math.max(logoCol, logosW) + m.gapX
  const size = nameSize(p, m, w - m.pad - textX, shape)
  const textH = size * 1.1 + (hasTag ? m.gap2 + m.tagH : 0)
  const bodyH = Math.max(m.logoH, textH)
  const h = bodyH + 2 * m.pad
  let x = m.pad + (Math.max(logoCol, logosW) - logosW) / 2
  const logos = p.logos.map((l) => {
    const [lw, lh] = logoBox(l.aspect, m.logoH)
    const box = { x, y: m.pad + (bodyH - lh) / 2, w: lw, h: lh }
    x += lw + m.logoGap
    return box
  })
  const ty = m.pad + (bodyH - textH) / 2
  return { w, h, logos, name: { x: textX, y: ty, size, w: textWidth(p.name, size, 'ui') },
    tag: hasTag ? { x: textX, y: ty + size * 1.1 + m.gap2 } : null, centred: false }
}

const TONE: Record<StoryTone, string> = { cream: C.cream, mint: C.mint, coral: C.coral }

/** The badge itself. `t` is frames since it started to build: the card, then
 *  its logos one by one, then the name, then the tag. */
export function Badge({ id, p, m, L, x, y, t, shadow, z = 2, opacity = 1, tag, tagTone, tagPop }: {
  id: string; p: StoryPlayer; m: BadgeMetrics; L: BadgeLayout; x: number; y: number; t: number; shadow: string; z?: number; opacity?: number
  tag: string | null; tagTone: StoryTone; tagPop: number
}) {
  const card = settle(t, 0, 0.96, 6, 4)
  if (!card) return null
  const part = (k: number) => settle(t, k, 0.92, 5, 4)
  const nameS = part(3 + p.logos.length * 2)
  const tagS = part(6 + p.logos.length * 2)
  const tw = tag ? pillWidth(tagText(tag), m.tagSize, m.tagH) : 0
  return (
    <div data-safe="box" data-id={`${id}-card`} data-group={id}
      style={abs({ left: x, top: y, width: L.w, height: L.h, background: C.ink, borderRadius: m.radius, zIndex: z,
        boxShadow: `10px 10px 0 ${shadow}`, opacity: card.opacity * opacity, transform: `scale(${card.scale})` })}>
      {p.logos.map((l, i) => {
        const s = part(2 + i * 2)
        const b = L.logos[i]!
        return s && (
          <div key={i} style={abs({ left: b.x, top: b.y, width: b.w, height: b.h, opacity: s.opacity, transform: `scale(${s.scale})` })}>
            <Logo id={`${id}-logo-${i}`} group={id} src={l.src} alt={`${p.name} logo ${i + 1}`} style={{ left: 0, top: 0, width: b.w, height: b.h }} />
          </div>
        )
      })}
      {nameS && (
        <Txt id={`${id}-name`} group={id} face="ui" size={L.name.size} color={C.cream} lineHeight={1.1}
          style={{ left: L.name.x, top: L.name.y, opacity: nameS.opacity, transform: `scale(${nameS.scale})`, transformOrigin: L.centred ? '50% 50%' : '0 50%' }}>
          {p.name}
        </Txt>
      )}
      {tag && L.tag && tagS && (
        <Pill id={`${id}-tag`} group={id} text={tagText(tag)} size={m.tagSize} height={m.tagH} bg={TONE[tagTone]} fg={C.ink}
          style={{ left: L.centred ? L.tag.x - tw / 2 : L.tag.x, top: L.tag.y, opacity: tagS.opacity,
            transform: `scale(${tagS.scale * tagPop})`, transformOrigin: L.centred ? '50% 50%' : '0 50%' }} />
      )}
    </div>
  )
}

/** A flat field that overhangs the frame. */
export function Field({ left, top, width, height, bg, z }: { left: number; top: number; width: number; height: number; bg: string; z?: number }) {
  return <div style={abs({ left, top, width, height, background: bg, ...(z === undefined ? {} : { zIndex: z }) })} />
}

// ---------------------------------------------------------------- the check

/** With `on`, logs the bounds of every visible marked text, logo and box on
 *  every frame ("STORYCHECK {...}"), with each text's face and whether that
 *  face is loaded. story_io.py collects these while it renders and fails the
 *  render when anything leaves the safe area or a face is not the brand's.
 *  Nothing on screen changes. Render it last, so it measures the whole frame. */
export function SafeProbe({ on, shape, clip }: { on: boolean; shape: Shape; clip: string }) {
  const frame = useCurrentFrame()
  React.useLayoutEffect(() => {
    if (!on) return
    const items: unknown[] = []
    const r1 = (v: number) => Math.round(v * 10) / 10
    document.querySelectorAll<HTMLElement>('[data-safe]').forEach((el) => {
      let op = 1
      for (let e: HTMLElement | null = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity || '1')
      if (op < 0.02) return
      const r = el.getBoundingClientRect()
      let x0 = r.left, x1 = r.right
      const kind = el.dataset.safe
      let family: string | null = null, fontOk: boolean | null = null
      if (kind === 'text') {
        const range = document.createRange()
        range.selectNodeContents(el)
        const rr = range.getBoundingClientRect()
        if (rr.width > 0) { x0 = Math.min(rr.left, x1); x1 = Math.max(rr.right, x0) }
        const cs = getComputedStyle(el)
        family = cs.fontFamily
        fontOk = document.fonts.check(`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, el.textContent || 'A')
      }
      items.push({ id: el.dataset.id, group: el.dataset.group, kind, op: Math.round(op * 1000) / 1000, r: [r1(x0), r1(r.top), r1(x1), r1(r.bottom)],
        family, fontOk, text: kind === 'text' ? (el.textContent || '').slice(0, 80) : null })
    })
    // eslint-disable-next-line no-console
    console.log('STORYCHECK ' + JSON.stringify({ clip, frame, shape, items }))
  }, [frame, on, shape, clip])
  return null
}
