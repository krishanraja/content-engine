import React from 'react'
import { cancelRender, continueRender, delayRender, Img, staticFile } from 'remotion'
import '../house/fonts.css'
import './fonts.css'

/** The stand-off's colours. Flat fills only: no gradients anywhere. */
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

export const DISPLAY = 'Story Archivo Black'
export const LABEL = 'MYMU Archivo'
export const FPS = 30

/** Hold the frame until both faces are loaded, then render the children, so
 *  every measurement (and so every frame) is taken in the real faces. */
export function useStoryFonts(): boolean {
  const [handle] = React.useState(() => delayRender('story stand-off fonts'))
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    Promise.all([
      document.fonts.load(`400 100px "${DISPLAY}"`, 'Aa?'),
      document.fonts.load(`800 40px "${LABEL}"`, 'Aa?'),
    ]).then(() => setReady(true)).catch((error: unknown) => cancelRender(error))
  }, [])
  React.useEffect(() => {
    if (ready) continueRender(handle)
  }, [ready, handle])
  return ready
}

let canvas: HTMLCanvasElement | null = null
/** The width of `text` set at `size` px in the display face (or the label
 *  face at weight 800). Pure for a given font, so deterministic per frame. */
export function textWidth(text: string, size: number, face: 'display' | 'label' = 'display'): number {
  canvas = canvas ?? document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return text.length * size * 0.7
  ctx.font = face === 'display' ? `400 ${size}px "${DISPLAY}"` : `800 ${size}px "${LABEL}"`
  return ctx.measureText(text).width
}

/** The largest size, up to `max`, at which every line fits `maxW`. */
export function fitSize(lines: string[], max: number, maxW: number, face: 'display' | 'label' = 'display', extraEm = 0): number {
  let size = max
  for (const line of lines) {
    const w = textWidth(line, 100, face) / 100 + extraEm
    if (w > 0) size = Math.min(size, maxW / w)
  }
  return Math.floor(size)
}

/** Greedy line breaks at `maxChars`, never splitting a protected group. */
export function breakLines(text: string, maxChars: number, keep?: string): string[] {
  const tokens: string[] = []
  let rest = text.trim()
  if (keep && rest.includes(keep)) {
    const i = rest.indexOf(keep)
    tokens.push(...rest.slice(0, i).trim().split(/\s+/).filter(Boolean), keep)
    rest = rest.slice(i + keep.length)
  }
  tokens.push(...rest.trim().split(/\s+/).filter(Boolean))
  const lines: string[] = []
  let cur = ''
  for (const t of tokens) {
    const next = cur ? `${cur} ${t}` : t
    if (cur && next.length > maxChars) {
      lines.push(cur)
      cur = t
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const backOut = (x: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
export const cubicOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
export const cubicIO = (x: number) => { const t = clamp(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
/** An entrance without a pop: from f0 it fades in over `fade` frames while
 *  its scale eases from `from` to 1 over `n` frames. null before f0. */
export function settle(f: number, f0: number, from = 1.2, n = 6, fade = 3): { scale: number; opacity: number } | null {
  const k = f - f0
  if (k < 0) return null
  return { scale: from + (1 - from) * cubicOut(k / n), opacity: clamp((k + 1) / fade) }
}
export const quadIO = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

const SLAM = [0.32, 0.12, -0.04, 0]
/** A hit: hidden before f0, then lands in four frames with one overshoot. */
export function slam(f: number, f0: number, amp = 1): number | null {
  const k = f - f0
  if (k < 0) return null
  return 1 + amp * (SLAM[Math.min(k, 3)] ?? 0)
}
/** A hard slide in over n frames with a little overshoot; null before f0. */
export function slideIn(f: number, f0: number, n = 5): number | null {
  const k = f - f0
  if (k < 0) return null
  return backOut(clamp(k / n))
}
/** The whole frame jolts on each hit. */
export function jolt(f: number, hits: number[], big: number[] = []): number {
  let y = 0
  for (const h of hits) {
    const k = f - h
    const a = big.includes(h) ? 2 : 1
    if (k === 0) y += 14 * a
    else if (k === 1) y -= 7 * a
    else if (k === 2) y += 2 * a
  }
  return y
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

export function Logo({ src, alt, ink, style }: { src: string; alt: string; ink?: boolean; style: React.CSSProperties }) {
  return (
    <div style={abs({ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style })}>
      <Img src={logoSrc(src)} alt={alt}
        style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain', ...(ink ? { filter: 'brightness(0)' } : {}) }} />
    </div>
  )
}

/** The brand's own image files, unaltered: never typed, recoloured,
 *  redrawn or cropped. Cream and mint on transparent, so always on ink. */
export const WORDMARK_PX: [number, number] = [3319, 391]
export const MASTHEAD_PX: [number, number] = [2415, 740]

export function BrandImage({ src, px, height, style, alt }: { src: string; px: [number, number]; height: number; style: React.CSSProperties; alt: string }) {
  const width = (height * px[0]) / px[1]
  return <Img src={logoSrc(src)} alt={alt} style={abs({ width, height, display: 'block', ...style })} />
}

export function Pill({ children, size, height, bg, fg, style }: { children: React.ReactNode; size: number; height: number; bg: string; fg: string; style: React.CSSProperties }) {
  return (
    <div style={abs({ fontFamily: LABEL, fontWeight: 800, fontSize: size, height, lineHeight: `${height}px`, padding: `0 ${Math.round(height * 0.42)}px`,
      borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap', ...style })}>
      {children}
    </div>
  )
}

/** The ink brand strip: the brand's one-line wordmark image and the series chip. */
export function BrandStrip({ top, width, height, seriesName, seriesColour, pad, wordmark }: {
  top: number; width: number; height: number; seriesName: string; seriesColour: string; pad: number; wordmark: string
}) {
  const wm = Math.round(height * 0.46)
  const ph = Math.round(height * 0.5)
  return (
    <div style={abs({ left: 0, top, width, height, background: C.ink })}>
      <BrandImage src={wordmark} px={WORDMARK_PX} height={wm} alt="makeyourmindup" style={{ left: pad, top: (height - wm) / 2 }} />
      <Pill size={Math.round(ph * 0.56)} height={ph} bg={seriesColour} fg={C.ink} style={{ right: pad, top: (height - ph) / 2 }}>{seriesName}</Pill>
    </div>
  )
}

export const stampBorder = (size: number) => Math.min(16, Math.max(4, Math.round(size * 0.15)))
/** A stamp's outer size: [width, height]. */
export const stampBox = (text: string, size: number): [number, number] =>
  [textWidth(text, size) + Math.round(size * 0.4) * 2 + stampBorder(size) * 2, size + Math.round(size * 0.26) * 2 + stampBorder(size) * 2]

/** A rubber stamp: Archivo Black on a flat colour, an ink border. */
export function Stamp({ text, size, bg, style }: { text: string; size: number; bg: string; style: React.CSSProperties }) {
  const border = stampBorder(size)
  return (
    <div style={abs({ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, whiteSpace: 'nowrap', color: C.ink, background: bg,
      border: `${border}px solid ${C.ink}`, borderRadius: Math.round(size * 0.3), padding: `${Math.round(size * 0.26)}px ${Math.round(size * 0.4)}px`,
      letterSpacing: '0.01em', ...style })}>
      {text}
    </div>
  )
}

/** A flat field that overhangs the frame, so the jolt never shows an edge. */
export function Field({ left, top, width, height, bg }: { left: number; top: number; width: number; height: number; bg: string }) {
  return <div style={abs({ left, top, width, height, background: bg })} />
}
