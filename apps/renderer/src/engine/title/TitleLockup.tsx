import React, { type JSX } from 'react'
import { Img, interpolate, spring } from 'remotion'
import { HOUSE_FONTS } from '../../house/geometry'
import { textWidth } from '../../house/metrics'
import type { TitleWord } from './TitleMoment'

/** The one full-frame title (config/brand-palette.json logo_rule.title_frame; the reference is Wed 11 Nov's "AI MUSIC or
 *  HUMAN MUSIC?", docs/plans/2026-11-11-wednesday/short-composite/brand_frames.py title_full). Krish, 19 Nov 2026: "It
 *  should animate in and all be one feature, aligned properly. not a wordmark temporarily in the bottom right,
 *  disconnected from the title." Two angled bands slam in from opposite sides as he says their words, each word lands on
 *  its own spoken frame, bars pulse behind, a light sweeps across, and the stacked logo lands centred beneath as the
 *  last beat of the same unit. Cut-clock only: no Remotion context, random values or state. */
export type TitleLockupProps = {
  words: TitleWord[]; fromFrame: number; toFrame: number; frame: number
  width: number; height: number; tokens: Record<string, string>
  stacked: { src: string; pixelWidth: number; pixelHeight: number }
}
const unit = (v: number) => Math.max(0, Math.min(1, v))
const mix = (a: number, b: number, t: number) => interpolate(t, [0, 1], [a, b])
const upper = (s: string) => s.toUpperCase()

/** Band one carries the question's core (through the word after "or" when there is one: BUILD OR BUY); band two the rest,
 *  on one line or two, whichever keeps its type at least 60% of band one's. Pure, so tests and QC can read the geometry. */
export function lockupLayout(words: TitleWord[], width: number, height: number) {
  const tall = height > width
  const or = words.findIndex((w, i) => i > 0 && i < words.length - 2 && /^or$/i.test(w.text.replace(/\W/g, '')))
  let cut = or > 0 ? or + 2 : Math.ceil(words.length / 2)
  if (cut >= words.length) cut = Math.ceil(words.length / 2)
  const gap = 0.24
  const span = (ws: TitleWord[]) => ws.reduce((s, w) => s + textWidth('anton', upper(w.text), 100), 0) + gap * 100 * Math.max(0, ws.length - 1)
  const bandW = width * 0.9, inner = bandW * 0.88
  const maxSize = tall ? width * 0.2 : height * 0.2
  const size1 = Math.min(maxSize, 100 * inner / span(words.slice(0, cut)))
  const rest = words.slice(cut)
  const oneLine = 100 * inner / span(rest)
  let lines2: TitleWord[][] = [rest], size2 = Math.min(size1 * 0.86, oneLine)
  if (oneLine < size1 * 0.6 && rest.length > 1) {
    let best = 1, bestW = Infinity
    for (let k = 1; k < rest.length; k++) { const w = Math.max(span(rest.slice(0, k)), span(rest.slice(k))); if (w < bestW) { bestW = w; best = k } }
    lines2 = [rest.slice(0, best), rest.slice(best)]
    size2 = Math.min(size1 * 0.86, 100 * inner / bestW)
  }
  const h1 = size1 * 1.3, h2 = size2 * (1.3 + 1.08 * (lines2.length - 1))
  const logoW = width * (tall ? 0.46 : 0.22)
  const cy1 = height * (tall ? 0.3 : 0.27)
  const cy2 = cy1 + h1 / 2 + height * 0.035 + h2 / 2
  const logoTop = cy2 + h2 / 2 + height * (tall ? 0.07 : 0.08)
  const place = (ws: TitleWord[], size: number, cy: number, offset: number) => {
    const total = span(ws) * size / 100
    let x = width / 2 - total / 2
    return ws.map((w, i) => {
      const wd = textWidth('anton', upper(w.text), size)
      const r = { index: offset + i, x, width: wd, size, cy }
      x += wd + gap * size
      return r
    })
  }
  const glyphs = [
    ...place(words.slice(0, cut), size1, cy1, 0),
    ...lines2.flatMap((ln, li) => place(ln, size2, cy2 - (lines2.length - 1) * size2 * 0.54 + li * size2 * 1.08,
      cut + lines2.slice(0, li).reduce((s, l) => s + l.length, 0))),
  ]
  return { cut, bandW, bands: [{ cy: cy1, height: h1, rot: -3 }, { cy: cy2, height: h2, rot: 3 }], glyphs, logo: { width: logoW, top: logoTop } }
}

export function TitleLockup(props: TitleLockupProps): JSX.Element | null {
  const { words, frame, fromFrame, toFrame, width, height, tokens } = props
  if (frame < fromFrame || frame >= toFrame || !words.length) return null
  const L = lockupLayout(words, width, height)
  const k = frame - fromFrame
  const last = Math.max(...words.map(w => w.atFrame))
  const inkDeep = tokens.inkDeep ?? tokens.ink ?? '#070D0B', ink = tokens.ink ?? inkDeep, inkSoft = tokens.inkSoft ?? ink
  const cream = tokens.cream ?? '#F4EFE4', mint = tokens.mint ?? tokens.brand ?? cream
  const exit = unit((frame - (toFrame - 9)) / 9), out = exit * exit * (3 - 2 * exit)
  const veil = unit(k / 4) * (1 - out)
  const push = 1 + 0.04 * unit(k / Math.max(1, toFrame - fromFrame))
  const bandStart = [words[0]!.atFrame, Math.max(fromFrame, words[L.cut]!.atFrame - 3)]
  const pulse = 0.5 + 0.5 * Math.cos(k * 2 * Math.PI * 2.1 / 30)
  const bars = 36
  const sweepK = unit((frame - last + 2) / 22)
  const sweepX = mix(-0.3, 1.3, sweepK * sweepK * (3 - 2 * sweepK)) * width
  const logoK = spring({ frame: Math.max(0, frame - last - 4), fps: 30, config: { damping: 14, stiffness: 220, mass: 0.6 } })
  const logoH = L.logo.width * props.stacked.pixelHeight / props.stacked.pixelWidth
  return <div data-title-lockup="" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', opacity: 1 - out }}>
    <div style={{ position: 'absolute', inset: 0, background: inkDeep, opacity: veil }} />
    {Array.from({ length: bars }, (_, i) => {
      const bw = width / bars
      const amp = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + k * 0.21)) * (0.6 + 0.4 * pulse)
      const h = height * 0.5 * amp
      return <div key={`bar${i}`} style={{ position: 'absolute', left: i * bw + bw * 0.2, width: bw * 0.6, top: height * 0.47 - h / 2, height: h,
        background: mint, opacity: 0.09 * veil, borderRadius: bw * 0.3 }} />
    })}
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${push.toFixed(4)})`, transformOrigin: '50% 45%' }}>
      {L.bands.map((b, bi) => {
        const p = spring({ frame: Math.max(0, frame - bandStart[bi]!), fps: 30, config: { damping: 12, stiffness: 300, mass: 0.6 } })
        if (frame < bandStart[bi]!) return null
        const dx = (1 - p) * width * (bi === 0 ? -1 : 1)
        const sc = mix(1.35, 1, unit(p))
        const shake = (1 - unit((frame - bandStart[bi]!) / 10)) * 14
        const fill = bi === 0
          // The ink band stands off the ink veil: a lifted hatch, a mint edge and a cream hairline.
          ? { backgroundColor: inkSoft, backgroundImage: `repeating-linear-gradient(135deg, ${ink} 0 ${b.height * 0.06}px, transparent ${b.height * 0.06}px ${b.height * 0.12}px)`,
            backgroundPosition: `${(k * 2) % 200}px 0`, borderLeft: `${b.height * 0.07}px solid ${mint}`,
            outline: `${Math.max(2, b.height * 0.012)}px solid ${cream}33`, boxSizing: 'border-box' as const }
          : { background: mint }
        return <div key={`band${bi}`} data-title-band={bi} style={{ position: 'absolute', left: (width - L.bandW) / 2, top: b.cy - b.height / 2,
          width: L.bandW, height: b.height, transformOrigin: '50% 50%',
          transform: `translate(${(dx + shake * Math.sin(k * 3)).toFixed(2)}px, ${(shake * Math.cos(k * 2.6)).toFixed(2)}px) rotate(${b.rot}deg) scale(${sc.toFixed(4)})`,
          boxShadow: `0 ${b.height * 0.12}px ${b.height * 0.4}px rgba(0,0,0,0.5)`, ...fill }}>
          {L.glyphs.filter(g => (bi === 0 ? g.index < L.cut : g.index >= L.cut)).map(g => {
            const w = words[g.index]!
            if (frame < w.atFrame) return null
            const t = unit((frame - w.atFrame) / 5), pop = mix(1.4, 1, 1 - (1 - t) ** 3)
            const isOr = /^or$/i.test(w.text.replace(/\W/g, '')) && bi === 0
            return <span key={g.index} data-title-word={g.index} style={{ position: 'absolute',
              left: g.x - (width - L.bandW) / 2, top: g.cy - (b.cy - b.height / 2) - g.size * 0.6, fontFamily: HOUSE_FONTS.display,
              fontWeight: 400, fontSize: g.size, lineHeight: 1.2, whiteSpace: 'pre', textTransform: 'uppercase',
              color: bi === 0 ? (isOr ? mint : cream) : ink, opacity: t, display: 'inline-block',
              transform: `scale(${pop.toFixed(4)})`, transformOrigin: '50% 60%' }}>{w.text}</span>
          })}
        </div>
      })}
      <div data-title-sweep="" style={{ position: 'absolute', top: -height * 0.2, height: height * 1.4, left: sweepX - width * 0.03, width: width * 0.06,
        transform: 'rotate(18deg)', background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)`,
        opacity: sweepK > 0 && sweepK < 1 ? 1 : 0, filter: `blur(${width * 0.012}px)` }} />
      {frame >= last + 4 ? <Img data-title-wordmark="" src={props.stacked.src} style={{ position: 'absolute', left: (width - L.logo.width) / 2,
        top: L.logo.top + (1 - logoK) * height * 0.04, width: L.logo.width, height: logoH, opacity: unit(logoK * 1.4),
        transform: `scale(${mix(0.86, 1, unit(logoK)).toFixed(4)})` }} /> : null}
    </div>
  </div>
}
