import React from 'react'
import { F, LIFT, band, clamp, clean, hero, livePage, mix, outCubic, outExpo, scale, since, spoken, textWidth } from '../kit'
import { type Draw, exitStart, marked, root, upper } from '../draw'

/** rack-focus: focus travels along the line. Archivo Bold, as said; each word focuses in from a soft blur at the frame
 *  it is said, holds sharp while it is the word being said, and slips out of focus (blur, dimmer, a touch smaller) as
 *  the next word starts. The page's real hero (marked(hero): never the longest-word fallback) sits inline on the line, on the
 *  shared baseline, in Anton capitals at twice the size, arriving from a deep blur at 1.3x, and never defocuses. When
 *  the page has room to leave (the next page does not follow at once), the whole page racks out to a heavy blur, never
 *  before its last word has shown sharp; otherwise the next page's focus-in is the cut. Left-aligned in the lower and
 *  upper bands, centred in the centre. Source: instagram_DfkCOCLt7KZ ('THE AD' resolving from blur; phrases leaving by
 *  blur). */
const HERO_X = 2.0, HERO_IN = 1.3

export const rackFocus: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page, index } = live, k = scale(props.aspect), box = band(props), place = props.captionPlacement ?? 'lower'
  const now = spoken(page, frame), fps = props.fps
  const h = marked(hero(page))
  const words = page.words.map((w, i) => (i === h ? upper(w.text) : clean(w.text)))

  // sizes: the hero is twice the support size, capped so that even at its 1.3x entry it stays inside the band
  const heroSize = (S: number) => {
    if (h < 0) return 0
    const w1 = textWidth(words[h]!, 1, 'anton', true)
    return Math.min(HERO_X * S, (box.width / HERO_IN) / Math.max(w1, 0.01))
  }
  const widthOf = (i: number, S: number, H: number) => (i === h ? textWidth(words[i]!, H, 'anton', true) : textWidth(words[i]!, S, 'archivo700', false))
  // greedy wrap of every word (the hero inline) across the band; the hero is reserved at its 1.3x entry width, so its
  // entry never crosses the band edge wherever it sits on its row
  const layout = (S: number, H: number) => {
    const rows: number[][] = []; let row: number[] = [], used = 0
    words.forEach((_, i) => {
      const wd = widthOf(i, S, H) * (i === h ? HERO_IN : 1), gap = S * 0.26
      if (row.length && used + gap + wd > box.width) { rows.push(row); row = []; used = 0 }
      used += (row.length ? gap : 0) + wd; row.push(i)
    })
    if (row.length) rows.push(row)
    return rows
  }
  const rowH = (r: number[], S: number, H: number) => (r.includes(h) ? H * 0.98 : S * 1.08)
  let S = 92 * k, H = heroSize(S), rows = layout(S, H)
  while ((rows.length > 3 || rows.reduce((a, r) => a + rowH(r, S, H), 0) > box.height) && S > 34) {
    S -= 3; H = heroSize(S); rows = layout(S, H)
  }

  const align = place === 'centre' ? 'center' : 'flex-start'
  // the rack-out: only when the page has room to leave, and never before its last word has shown sharp
  const next = props.captions[index + 1]
  const cutsToNext = next !== undefined && next.fromFrame - page.toFrame <= 1
  const ex = cutsToNext ? undefined : exitStart(page, 5, fps, 0.2)
  const exit = ex === undefined ? 0 : clamp((frame - ex) / Math.max(1, page.toFrame - ex))

  const word = (i: number) => {
    const w = page.words[i]!
    if (i === h) {
      const shown = frame >= w.atFrame - 1
      const t = shown ? outExpo(since(frame, w.atFrame, fps) / 0.22) : 0
      const blur = (1 - t) * 22
      return <span key={i} style={{ fontFamily: F.display, fontSize: H, lineHeight: 0.98, letterSpacing: '0.005em', color: props.tokens.cream,
        textShadow: LIFT, display: 'inline-block', visibility: shown ? 'visible' : 'hidden', opacity: t,
        transformOrigin: place === 'centre' ? '50% 80%' : '0% 80%',
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined, transform: `scale(${mix(HERO_IN, 1, t).toFixed(4)})` }}>{words[i]}</span>
    }
    if (frame < w.atFrame - 1) return <span key={i} style={{ fontFamily: F.structure, fontWeight: 700, fontSize: S, lineHeight: 1.08, visibility: 'hidden' }}>{words[i]}</span>
    const t = outCubic(since(frame, w.atFrame, fps) / 0.16)
    const nw = page.words[i + 1]
    const d = i < now && nw ? outCubic(since(frame, nw.atFrame, fps) / 0.25) : 0
    const blur = (1 - t) * 12 + d * 3.5
    return <span key={i} style={{ fontFamily: F.structure, fontWeight: 700, fontSize: S, lineHeight: 1.08, letterSpacing: '-0.01em',
      color: props.tokens.cream, textShadow: LIFT, display: 'inline-block', transformOrigin: '50% 80%',
      opacity: t * mix(1, 0.55, d), filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      transform: `scale(${(mix(1.12, 1, t) * mix(1, 0.97, d)).toFixed(4)})` }}>{words[i]}</span>
  }

  const anchor: React.CSSProperties = place === 'upper' ? { top: 0 } : place === 'centre' ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: 0 }
  return root('rack-focus', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, ...anchor, display: 'flex', flexDirection: 'column',
      opacity: 1 - exit, filter: exit > 0 ? `blur(${(exit * 16).toFixed(2)}px)` : undefined }}>
      {rows.map((r, ri) => <div key={ri} style={{ display: 'flex', columnGap: S * 0.26, justifyContent: align, alignItems: 'baseline' }}>{r.map(word)}</div>)}
    </div>))
}
