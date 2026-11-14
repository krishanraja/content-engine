import React from 'react'
import { type Draw, exitProgress, exitStart, marked, root } from '../draw'
import { F, band, clamp, clean, hero, livePage, outBack, outCubic, scale, spoken } from '../kit'

/** receipt-chip, from Krish's Character.ai cut (26 Oct 2026), where the evidence prints onto an ink desk: the line
 *  prints like a till receipt. Plex Mono SemiBold, lower case as said, cream on a deep-ink paper strip with a torn,
 *  perforated top edge and a dashed rule between lines, rising out of a cream printer slot at the foot of the strip.
 *  Active: each word types on one character per step (a hard step, no blur) behind a mint print head; each new line
 *  feeds the paper up out of the slot with an overshoot, and every landing kicks the whole strip down 10 px with an
 *  eased return, the till's jolt. The spoken figure (else the page's real hero) prints on a mint fill in ink. At most
 *  two lines; the strip tears off upward once the last word has shown sharp. Centred, the slot at the band's foot
 *  (the middle of the band in `centre`). */

const MONO = 0.6 // Plex Mono's advance, em
const LINE = 1.14 // line height, em
const JOLT = 10 // px, the till's kick on each landing
const TYPE = 4 // frames a word takes to type out, at most

/** The page's marked word: the first spoken figure, else the real hero, else none. */
function figure(words: { text: string }[], heroIndex: number): number {
  const fig = words.findIndex((w) => /\d/.test(w.text))
  return fig >= 0 ? fig : marked(heroIndex)
}

export const receiptChip: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), now = spoken(page, frame)
  if (now < 0) return null
  const t = props.tokens, fps = props.fps
  const words = page.words.map((w) => clean(w.text).toLowerCase())
  const mk = figure(page.words, hero(page))

  // Size: the largest at which the page wraps to two lines at most and the strip, with its edge, slot and jolt, fits.
  const room = box.width - 16
  const layout = (S: number) => {
    const gap = S * MONO, padX = S * 0.34, rows: number[][] = []
    let row: number[] = [], used = 0
    words.forEach((w, i) => {
      const wd = (w.length + (i === mk ? 0.4 : 0)) * S * MONO
      if (row.length && used + gap + wd > room - padX * 2) { rows.push(row); row = []; used = 0 }
      used += (row.length ? gap : 0) + wd; row.push(i)
    })
    if (row.length) rows.push(row)
    return rows
  }
  const chrome = (S: number) => S * 0.42 + 14 + 10 + JOLT // padding, torn edge, slot, jolt
  let S = Math.round(90 * k), rows = layout(S)
  while (S > 36 && (rows.length > 2 || rows.length * S * LINE + chrome(S) > box.height
    || rows.some((r) => r.length === 1 && words[r[0]!]!.length * S * MONO > room - S * 0.68))) { S -= 2; rows = layout(S) }
  const gap = S * MONO, padX = S * 0.34

  const last = page.words[now]!
  const tl = frame - (last.atFrame - 1) // frames since the latest word began to print
  const jolt = JOLT * (1 - outCubic(tl / 5)) * (tl >= 0 ? 1 : 0)
  const es = exitStart(page, 6, fps)
  const out = exitProgress(page, es, frame)
  const centre = props.captionPlacement === 'centre'
  // a hard 2 px cream rim round the paper (torn top included), so it reads on near-black footage
  const rim = [[2, 0], [-2, 0], [0, -2]].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${t.cream})`).join(' ')

  const line = (r: number[], ri: number) => {
    const first = page.words[r[0]!]!
    const f = frame - (first.atFrame - 1)
    if (f < 0) return null
    // The paper feeds: a new line opens from nothing to its full height with an overshoot over 5 frames.
    const feed = Math.max(ri === 0 ? 0.35 : 0, outBack(f / 5, 2.2))
    return <div key={ri} style={{ position: 'relative', height: S * LINE * feed, overflow: 'hidden',
      borderTop: ri ? `2px dashed ${t.inkSoft}` : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', height: S * LINE, whiteSpace: 'nowrap' }}>
        {r.map((i, j) => {
          const w = page.words[i]!; const wf = frame - (w.atFrame - 1)
          if (wf < 0) return null
          const text = words[i]!, n = text.length
          // a hard step each frame: a short word one character a frame, a long one several, done in TYPE frames
          const shown = Math.min(n, Math.ceil(((wf + 1) * n) / TYPE))
          const typing = shown < n
          const isMark = i === mk
          return <span key={i} style={{ position: 'relative', display: 'inline-block', marginLeft: j ? gap : 0,
            width: (n + (isMark ? 0.4 : 0)) * S * MONO, height: S * LINE, verticalAlign: 'top' }}>
            {isMark && <span style={{ position: 'absolute', left: 0, top: S * 0.1, bottom: S * 0.08, background: t.mint,
              width: `${((shown + (typing ? 0 : 0.4)) / (n + 0.4)) * 100}%` }} />}
            <span style={{ position: 'absolute', left: isMark ? S * MONO * 0.2 : 0, top: 0, fontFamily: F.data, fontWeight: 600,
              fontSize: S, lineHeight: LINE, color: isMark ? t.ink : t.cream,
              clipPath: `inset(-10% calc(100% - ${(shown * S * MONO).toFixed(1)}px) -10% 0)` }}>{text}</span>
            {typing && <span style={{ position: 'absolute', top: S * 0.14, height: S * 0.86, width: S * MONO * 0.9, background: t.mint,
              left: (isMark ? S * MONO * 0.2 : 0) + shown * S * MONO }} />}
          </span>
        })}
      </div>
    </div>
  }

  return root('receipt-chip', box, (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: centre ? 'center' : 'flex-end', paddingBottom: centre ? 0 : JOLT }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - out }}>
        {/* the paper: torn top edge, then the lines; it jolts and tears off, the slot stays put */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: S * 2.4, filter: rim,
          transform: `translateY(${(jolt - out * S * 0.8).toFixed(1)}px)` }}>
          <div style={{ height: 14, backgroundImage: `radial-gradient(circle at 50% 0, transparent 6px, ${t.inkDeep} 6.5px)`,
            backgroundSize: '18px 14px', backgroundRepeat: 'repeat-x' }} />
          <div style={{ background: t.inkDeep, borderLeft: `2px solid ${t.inkSoft}`, borderRight: `2px solid ${t.inkSoft}`,
            padding: `${S * 0.06}px ${padX}px ${S * 0.16}px` }}>
            {rows.map(line)}
          </div>
        </div>
        {/* the printer slot the paper feeds out of */}
        <div style={{ position: 'relative', zIndex: 1, height: 10, alignSelf: 'stretch', margin: '0 -18px', background: t.cream, borderRadius: 3 }} />
      </div>
    </div>))
}
