import React, { type JSX } from 'react'
import { interpolate, spring } from 'remotion'
import { HOUSE_FONTS } from '../../house/geometry'
import { textWidth } from '../../house/metrics'

/** The episode title as ONE full-frame lockup with the wordmark inside it (Ruling, Krish, 2026-11-19: "I expect the title
 *  card to enter as I am talking, and the title of the piece is woven in to my script at the start. This is a good example
 *  of what actually was a good build for the title card", of Wed 11's "AI MUSIC or HUMAN MUSIC?"). Wed 18's title was
 *  squeezed into his 608 px panel or a top band (about 70 px type) with the wordmark as a separate layer that came and went
 *  on its own (config/failures.json title-card-split-logo-and-squeezed). Wed 11's craft, taken from its one-piece script
 *  (docs/plans/2026-11-11-wednesday/short-composite/brand_frames.py title_full) into the engine:
 *   - the whole frame: the piece's own picture under an ink scrim. Whatever the beats under the title show (a plate, a page, his
 *     face) keeps playing beneath it, so the card always matches its piece and never leaves a plain dark band (Ruling, Krish,
 *     2026-11-19: "yes change for all moving forward - but bear in mind that the audio waveform visual behind it was made for
 *     a piece about AI music specifically. In the future, the engine needs to find its own visual that matches the piece.");
 *   - two angled bands that slam in from opposite sides as he says them: a hatched ink band in cream, then a mint band in ink;
 *   - the connector word ("or", "vs", "and") in mint between them;
 *   - a light sweep across both once the last word lands;
 *   - the stacked wordmark centred underneath, part of the same picture: it enters and leaves with the lockup.
 *  Each word still lands on the frame he says it; the captions leave those words out and stay away while it holds. */

export type TitleWord = { text: string; atFrame: number }
export type Box = { left: number; top: number; width: number; height: number }
export type TitleImage = { src: string; pixelWidth: number; pixelHeight: number }
export type TitleMomentProps = {
  words: TitleWord[]; fromFrame: number; toFrame: number; frame: number
  aspect: '9:16' | '16:9'; width: number; height: number
  tokens: Record<string, string>
  /** The stacked wordmark from config/brand-palette.json through the props' brand (props.brand.stacked), never typed text. */
  wordmark?: TitleImage
  /** How the wordmark is drawn: Remotion's Img in a render, a plain img in a test. */
  Image?: React.ElementType
  /** Accepted for older props; the lockup always fades where it stands, over the whole frame. */
  release?: 'captions' | 'fade'
  card?: boolean
  stage?: Box
  captionBox?: Box
}

const unit = (v: number) => Math.max(0, Math.min(1, v))
const mix = (a: number, b: number, t: number) => interpolate(unit(t), [0, 1], [a, b])
const back = (x: number) => { const t = unit(x), c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2 }
const ease = (x: number) => 1 - (1 - unit(x)) ** 3
const CONNECTOR = /^(or|vs\.?|versus|and|v\.?|&)$/i
const upper = (s: string) => s.toUpperCase()

/** Split the spoken title into its two bands and the connector between them, by rule: a connector word ("or", "vs",
 *  "and") nearest the middle (never first or last); else the two halves closest in measured width; one word is one band. */
export function lockupParts(words: TitleWord[]): { a: number[]; connector: number | null; b: number[] } {
  const n = words.length
  if (n <= 1) return { a: n ? [0] : [], connector: null, b: [] }
  const middle = (n - 1) / 2
  const connectors = words.map((w, i) => i).filter(i => i > 0 && i < n - 1 && CONNECTOR.test(words[i]!.text.replace(/[^a-z.&]/gi, '')))
  if (connectors.length) {
    const c = connectors.reduce((best, i) => Math.abs(i - middle) < Math.abs(best - middle) ? i : best)
    return { a: words.slice(0, c).map((_, i) => i), connector: c, b: words.slice(c + 1).map((_, i) => c + 1 + i) }
  }
  const widths = words.map(w => textWidth('anton', upper(w.text), 100))
  const total = widths.reduce((s, x) => s + x, 0)
  let best = 1, gap = Infinity, run = 0
  for (let i = 1; i < n; i++) { run += widths[i - 1]!; const d = Math.abs(total - 2 * run); if (d < gap) { gap = d; best = i } }
  return { a: words.slice(0, best).map((_, i) => i), connector: null, b: words.slice(best).map((_, i) => best + i) }
}

export type LockupBand = { indices: number[]; cx: number; cy: number; width: number; height: number; size: number; rot: number
  words: { index: number; x: number; y: number; width: number }[] }
export type LockupGeometry = { bands: LockupBand[]; connector: { index: number; cx: number; cy: number; size: number } | null
  wordmark: { left: number; top: number; width: number; height: number } | null
  box: { left: number; top: number; right: number; bottom: number }; typeSize: number }

/** Where everything sits, pure: the bands span 92% of the frame, the type fills its band (up to 17% of a tall frame's width
 *  or 18% of a wide frame's height, Wed 11's sizes; a long band takes a second line before its type shrinks), the lockup is
 *  centred, and the wordmark sits inside its box. */
export function lockupGeometry(words: TitleWord[], width: number, height: number, aspect: TitleMomentProps['aspect'], wordmark?: TitleImage): LockupGeometry {
  const tall = aspect === '9:16'
  const parts = lockupParts(words)
  const bandWidth = width * 0.92
  const base = tall ? width * 0.17 : height * 0.18
  const gap = (size: number) => size * 0.22
  const lineWidth = (indices: number[], size: number) =>
    indices.reduce((s, i) => s + textWidth('anton', upper(words[i]!.text), size), 0) + gap(size) * Math.max(0, indices.length - 1)
  // One line, or two balanced lines when that gives bigger type (never more than two: it is a title, not a paragraph).
  const shape = (indices: number[], scale: number) => {
    const fit = (lines: number[][]) => Math.min(base * scale, ...lines.map(l => 100 * bandWidth * 0.88 / Math.max(1, lineWidth(l, 100))))
    let best = { lines: [indices], size: fit([indices]) }
    for (let cut = 1; cut < indices.length; cut++) {
      const lines = [indices.slice(0, cut), indices.slice(cut)]
      // A second line costs height: it must beat one line by a clear margin.
      const size = fit(lines)
      if (size > best.size * 1.15) best = { lines, size }
    }
    return best
  }
  const two = parts.b.length > 0
  const shapes = [shape(parts.a, 1), ...(two ? [shape(parts.b, 0.86)] : [])]
  // A very long title shrinks to fit above the wordmark, never off the top of the frame.
  const tallest = shapes.reduce((s, sh) => s + sh.size * (1.15 * sh.lines.length + 0.1), 0) + (two ? shapes[0]!.size * 0.9 : 0)
  const room = height * (tall ? 0.62 : 0.66)
  if (tallest > room) for (const sh of shapes) sh.size *= room / tallest
  const heights = shapes.map(sh => sh.size * (1.15 * sh.lines.length + 0.1))
  const connectorSize = shapes[0]!.size * 0.7
  const between = two ? (parts.connector === null ? shapes[0]!.size * 0.25 : connectorSize * 1.25) : 0
  const stack = heights.reduce((s, h) => s + h, 0) + between
  const centre = tall ? height * 0.44 : height * 0.43
  let y = centre - stack / 2
  const bands: LockupBand[] = shapes.map((sh, k) => {
    const h = heights[k]!, top = y
    y += h + between
    const placed = sh.lines.flatMap((line, li) => {
      let x = width / 2 - lineWidth(line, sh.size) / 2
      return line.map(index => {
        const w = textWidth('anton', upper(words[index]!.text), sh.size)
        const at = { index, x, y: sh.size * 0.05 + li * sh.size * 1.15, width: w }
        x += w + gap(sh.size)
        return at
      })
    })
    return { indices: [parts.a, parts.b][k]!, cx: width / 2, cy: top + h / 2, width: bandWidth, height: h, size: sh.size, rot: k === 0 ? -3 : 3, words: placed }
  })
  const connector = parts.connector === null ? null
    : { index: parts.connector, cx: width / 2, cy: bands[0]!.cy + heights[0]! / 2 + between / 2, size: connectorSize }
  const markWidth = width * (tall ? 0.42 : 0.2)
  const mark = wordmark ? { width: markWidth, height: markWidth * wordmark.pixelHeight / wordmark.pixelWidth } : null
  const below = bands.at(-1)!.cy + bands.at(-1)!.height / 2 + bandWidth / 2 * Math.sin(3 * Math.PI / 180)
  const markTop = mark ? Math.min(Math.max(below + height * 0.04, height * (tall ? 0.78 : 0.8)), height * 0.97 - mark.height) : 0
  const placedMark = mark ? { left: (width - mark.width) / 2, top: markTop, ...mark } : null
  // The lockup's box: the bands (rotated by at most 3 degrees, so their corners lift by half a band's sine) and the wordmark.
  const lift = (b: LockupBand) => b.width / 2 * Math.sin(3 * Math.PI / 180)
  const top = Math.min(...bands.map(b => b.cy - b.height / 2 - lift(b)))
  const bottom = Math.max(...bands.map(b => b.cy + b.height / 2 + lift(b)), placedMark ? placedMark.top + placedMark.height : 0)
  return { bands, connector, wordmark: placedMark, box: { left: (width - bandWidth) / 2, top, right: (width + bandWidth) / 2, bottom },
    typeSize: Math.min(...bands.map(b => b.size)) }
}

/** The lockup's own opacity: in over 3 frames as the first word starts, out over its last 10. The wordmark uses the same
 *  number, so it can never come or go on its own. */
export function lockupOpacity(frame: number, fromFrame: number, toFrame: number): number {
  if (frame < fromFrame || frame >= toFrame) return 0
  const fadeIn = unit((frame - fromFrame + 1) / 3)
  const out = Math.min(10, toFrame - fromFrame)
  return Math.min(fadeIn, 1 - unit((frame - (toFrame - out)) / out))
}

/** How much ink lies over the piece's own picture under the title: the bands stay legible and the picture still reads. */
export const TITLE_SCRIM = 0.62

/** Cut-clock only; deliberately no Remotion context, clocks, random values or persistent state. */
export function TitleMoment(props: TitleMomentProps): JSX.Element | null {
  const { words, frame, fromFrame, toFrame, width, height, tokens } = props
  if (frame < fromFrame || frame >= toFrame || !words.length || width <= 0 || height <= 0) return null
  const geo = lockupGeometry(words, width, height, props.aspect, props.wordmark)
  const opacity = lockupOpacity(frame, fromFrame, toFrame)
  const cream = tokens.cream ?? tokens.text ?? 'white'
  const ink = tokens.ink ?? tokens.background ?? 'black'
  const inkSoft = tokens.inkSoft ?? ink
  const mint = tokens.mint ?? tokens.brand ?? cream
  const last = Math.max(...words.map(w => w.atFrame))
  const k = frame - fromFrame
  const push = 1 + 0.03 * unit(k / Math.max(1, toFrame - fromFrame))
  const shake = (1 - ease(k / 10)) * 14
  const Image = props.Image ?? 'img'
  // The motion under the lockup is the piece's own: the beat beneath plays on through the scrim (TITLE_SCRIM). The pulsing
  // music bars were Wed 11's AI-music picture and are gone from the house card.
  const bandFill = (index: number) => index === 0
    ? { background: `repeating-linear-gradient(45deg, ${ink} 0px, ${ink} 14px, ${inkSoft} 14px, ${inkSoft} 22px)`, color: cream }
    : { background: mint, color: ink }
  const bandsDrawn = geo.bands.map((band, bi) => {
    const first = Math.min(...band.indices.map(i => words[i]!.atFrame))
    if (frame < first) return null
    const p = back((frame - first) / 9)
    const side = bi === 0 ? -1 : 1
    const dx = (1 - Math.min(1, p)) * width * side + shake * Math.sin(k * 3)
    const scale = (1.35 - 0.35 * Math.min(1, p)) * push
    const fill = bandFill(bi)
    return <div key={`band-${bi}`} data-title-band={bi} style={{ position: 'absolute', left: band.cx - band.width / 2, top: band.cy - band.height / 2,
      width: band.width, height: band.height, background: fill.background, overflow: 'hidden',
      transform: `translateX(${dx.toFixed(2)}px) rotate(${band.rot}deg) scale(${scale.toFixed(4)})`, transformOrigin: '50% 50%' }}>
      {band.words.map(w => frame < words[w.index]!.atFrame ? null
        : <span key={w.index} data-title-word={w.index} data-title-row={bi} style={{ position: 'absolute', left: w.x - (band.cx - band.width / 2),
          top: w.y, fontFamily: HOUSE_FONTS.display, fontWeight: 400, fontSize: band.size, lineHeight: 1.15,
          whiteSpace: 'pre', color: fill.color, textTransform: 'uppercase',
          opacity: ease((frame - words[w.index]!.atFrame + 1) / 3) }}>{words[w.index]!.text}</span>)}
    </div>
  })
  const c = geo.connector
  const connector = c && frame >= words[c.index]!.atFrame ? <span key="connector" data-title-word={c.index} data-title-connector=""
    style={{ position: 'absolute', left: 0, width, top: c.cy - c.size * 0.6, textAlign: 'center', fontFamily: HOUSE_FONTS.display,
      fontSize: c.size, lineHeight: 1.15, color: mint, textTransform: 'lowercase',
      opacity: ease((frame - words[c.index]!.atFrame + 1) / 6), transform: `scale(${mix(1.4, 1, (frame - words[c.index]!.atFrame) / 8).toFixed(4)})` }}>
    {words[c.index]!.text}</span> : null
  // The light sweep crosses both bands once the last word lands.
  const sweep = frame >= last ? mix(-30, 130, (frame - last) / 27) : -60
  const mark = geo.wordmark && props.wordmark
    ? <Image key="wordmark" data-title-wordmark="" src={props.wordmark.src}
      style={{ position: 'absolute', left: geo.wordmark.left, top: geo.wordmark.top, width: geo.wordmark.width, height: geo.wordmark.height }} />
    : null
  return <div data-title-moment="" data-title-lockup="" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity }}>
    <div data-title-ground="" style={{ position: 'absolute', inset: 0, background: `color-mix(in srgb, ${ink} ${Math.round(TITLE_SCRIM * 100)}%, transparent)` }} />
    {bandsDrawn}
    {connector}
    <div data-title-sweep="" style={{ position: 'absolute', inset: 0,
      background: `linear-gradient(115deg, transparent ${sweep - 6}%, rgba(255,255,255,0.28) ${sweep}%, transparent ${sweep + 6}%)` }} />
    {mark}
  </div>
}
