import React from 'react'
import type { Draw } from '../draw'
import { exitProgress, exitStart, marked, root } from '../draw'
import { F, LIFT, band, clamp, clean, hero, livePage, mix, outBack, outCubic, outExpo, scale, since, textWidth } from '../kit'

/** tuck-stack: small lead words tuck tight above big lowercase-as-said words, so each phrase sets as a mixed-scale
 *  lockup ('this / airbnb / in portugal'). Every content word is a head in Archivo ExtraBold; the stop words just
 *  before it are its tuck, set tight on the head's cap line (clear of its ascenders). The key head (only a real hero;
 *  a setup line has none) is a size up in the series colour. The tuck is the event: its words show as they are said,
 *  large and sitting where their head will land; when the head lands it springs up from below and knocks the tuck up
 *  onto its cap line, shrinking to tuck size, so every tucked head is a two-part landing. The stack lifts away over
 *  its last four frames, never before its last word has shown sharp. */

const STOPW = new Set(('a an the to of in on at for and but or so it is was be are that this with as if by from i we you ' +
  'they he she my your our its not no do').split(' '))

/** A head word and the stop words before it; head -1 for stop words that close a page with no head after them. */
type Group = { tuck: number[]; head: number }

function groups(words: string[], kw: number): Group[] {
  const out: Group[] = []
  let tuck: number[] = []
  words.forEach((w, i) => {
    // The key word is always a head, even when it is a stop word ('not', 'no').
    if (STOPW.has(w.toLowerCase()) && i !== kw) tuck.push(i)
    else { out.push({ tuck, head: i }); tuck = [] }
  })
  if (tuck.length) out.push({ tuck, head: -1 })
  return out
}

/** Tuck size and closing-stop-word size at head size H (k is the aspect scale): never below a phone-readable floor. */
const TUCK = (H: number, k: number) => Math.max(30 * k, 0.34 * H)
const CLOSE = (H: number, k: number) => Math.max(36 * k, 0.46 * H)

export const tuckStack: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), kw = marked(hero(page))
  const words = page.words.map((w) => clean(w.text))
  const gs = groups(words, kw)
  const width = Math.min((props.aspect === '16:9' ? 1100 : 760) * k, box.width)
  const placement = props.captionPlacement ?? 'lower'
  const centre = placement === 'centre'

  const headW = (g: Group, H: number) => g.head < 0 ? 0 : textWidth(words[g.head]!, H * (g.head === kw ? 1.25 : 1), 'archivo700', false) * 1.03
  const tuckW = (g: Group, H: number) => {
    const sz = g.head < 0 ? CLOSE(H, k) : TUCK(H, k)
    return g.tuck.reduce((s, i, j) => s + textWidth(words[i]!, sz, 'archivo500', false) + (j ? 0.09 * H : 0), 0)
  }
  // Widths at a head size H: a group is as wide as its head or its tuck line, whichever is wider.
  const gw = (g: Group, H: number) => Math.max(headW(g, H), tuckW(g, H))
  const layout = (H: number) => {
    const rows: number[][] = []
    let used = 0
    gs.forEach((g, gi) => {
      const wd = gw(g, H), gap = 0.22 * H
      // A tucked head starts its own row; an untucked head joins the row before when it fits. Closing stop words with
      // no head always join the row before (the size shrinks to make room), so they never sit orphaned on a row alone.
      const joins = rows.length > 0 && (g.head < 0 || (g.tuck.length === 0 && used + gap + wd <= width))
      if (joins) { rows[rows.length - 1]!.push(gi); used += gap + wd } else { rows.push([gi]); used = wd }
    })
    const rowH = (r: number[]) => Math.max(...r.map((gi) => { const g = gs[gi]!; return (g.head === kw ? 1.25 : 1) * H * 0.86 + (g.tuck.length && g.head >= 0 ? TUCK(H, k) * 0.9 : 0) }))
    const widest = Math.max(...rows.map((r) => r.reduce((s, gi, j) => s + gw(gs[gi]!, H) + (j ? 0.22 * H : 0), 0)))
    return { rows, ok: widest <= width && rows.reduce((s, r) => s + rowH(r), 0) <= box.height }
  }
  let H = 118 * k, L = layout(H)
  while (!L.ok && H > 40 * k) { H -= 4 * k; L = layout(H) }

  const xs = exitStart(page, 4, props.fps)
  const exitT = exitProgress(page, xs, frame), exitE = exitT * exitT * exitT
  const vpos: React.CSSProperties = placement === 'upper' ? { top: 0 } : centre ? { top: '50%', transform: `translateY(calc(-50% - ${(exitE * 24).toFixed(1)}px))` } : { bottom: 0 }
  const lift = centre ? undefined : `translateY(${(-exitE * 24).toFixed(1)}px)`

  const tuckSpan = (i: number, size: number) => {
    const at = page.words[i]!.atFrame - 1, shown = frame >= at, t = since(frame, at, props.fps)
    return <span key={i} style={{ display: 'inline-block', fontFamily: F.structure, fontWeight: 600, fontSize: size, lineHeight: 1,
      letterSpacing: '-0.01em', color: props.tokens.cream, textShadow: LIFT, whiteSpace: 'nowrap',
      visibility: shown ? 'visible' : 'hidden', opacity: shown ? clamp((frame - at + 1) / 2) : 0,
      transform: `translateY(${((1 - outCubic(t / 0.16)) * 10).toFixed(2)}px)` }}>{words[i]}</span>
  }

  return root('tuck-stack', box, (
    <div style={{ position: 'absolute', left: centre ? (box.width - width) / 2 : 0, width, ...vpos, transform: vpos.transform ?? lift,
      opacity: 1 - exitT, display: 'flex', flexDirection: 'column', alignItems: centre ? 'center' : 'flex-start' }}>
      {L.rows.map((r, ri) => <div key={ri} style={{ display: 'flex', alignItems: 'flex-end', columnGap: 0.22 * H }}>
        {r.map((gi) => {
          const g = gs[gi]!
          if (g.head < 0) {
            // Closing stop words with no head after them sit on the row's baseline, nearly half head size.
            return <div key={gi} style={{ display: 'flex', columnGap: 0.09 * H, paddingBottom: 0.04 * H }}>
              {g.tuck.map((i) => tuckSpan(i, CLOSE(H, k)))}</div>
          }
          const i = g.head, w = page.words[i]!, at = w.atFrame - 1, shown = frame >= at, t = since(frame, at, props.fps)
          const isKey = i === kw, size = H * (isKey ? 1.25 : 1)
          // Before its head lands, the tuck sits large where the head will be (scaled to fill at most the head's slot);
          // as the head lands the tuck is knocked up onto the cap line and down to tuck size over about six frames.
          const pend = Math.max(1, Math.min(1.8, headW(g, H) / Math.max(1, tuckW(g, H))))
          const knock = shown ? outExpo(t / 0.18) : 0
          const tuckScale = mix(pend, 1, knock), tuckDrop = mix(size * 0.86 * 0.62, 0, knock)
          const origin = centre ? '50% 100%' : '0% 100%'
          // The head: rises 0.3H from below, stretched tall, and springs to rest with a slight overshoot.
          const rise = (1 - outExpo(t / 0.18)) * 0.3 * H
          const sy = mix(1.22, 1, outBack(t / 0.22, 2)), sx = mix(0.9, 1, outCubic(t / 0.18))
          return <div key={gi} style={{ display: 'flex', flexDirection: 'column', alignItems: centre ? 'center' : 'flex-start' }}>
            {g.tuck.length > 0 && <div style={{ display: 'flex', columnGap: 0.09 * H, justifyContent: centre ? 'center' : 'flex-start',
              position: 'relative', zIndex: 1, marginBottom: -0.03 * H, paddingLeft: centre ? 0 : 0.04 * H,
              transform: `translateY(${tuckDrop.toFixed(2)}px) scale(${tuckScale.toFixed(4)})`, transformOrigin: origin }}>
              {g.tuck.map((j) => tuckSpan(j, TUCK(H, k)))}</div>}
            <span style={{ display: 'inline-block', fontFamily: F.structure, fontWeight: 800, fontSize: size, lineHeight: 0.86,
              letterSpacing: '-0.035em', whiteSpace: 'nowrap',
              color: isKey ? props.tokens.channel : props.tokens.cream, textShadow: LIFT,
              visibility: shown ? 'visible' : 'hidden', opacity: shown ? clamp((frame - at + 1) / 2) : 0,
              transform: `translateY(${rise.toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`, transformOrigin: origin }}>{words[i]}</span>
          </div>
        })}
      </div>)}
    </div>))
}
