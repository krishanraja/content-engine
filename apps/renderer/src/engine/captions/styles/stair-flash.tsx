import React from 'react'
import type { Draw } from '../draw'
import { exitStart, marked, root, upper } from '../draw'
import { F, LIFT, band, clamp, clean, hero, livePage, mix, outCubic, outExpo, scale, since, textWidth } from '../kit'

/** stair-flash, the staircase flash: Anton capitals build a stepped lockup, word by word on hard cuts, with the small
 *  connector words set at about half size on the same baseline. Each row steps in from the anchor side, and the anchor
 *  swaps left, right, left by page. The key word lands with a short series-colour streak and then cools to cream under
 *  a left-to-right wipe. Only a real hero is keyed; a setup line has no key. The page leaves on a blur over its last
 *  three frames, but never before its last word has shown sharp (else it cuts). */

const STOPW = new Set(('a an the to of in on at for and but or so it is was be are that this with as if by from i we you ' +
  'they he she my your our its not no do').split(' '))

const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`
}

export const stairFlash: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page, index } = live, k = scale(props.aspect), box = band(props), hw = hero(page), kw = marked(hw)
  const words = page.words.map((w) => upper(w.text))
  // The hero is never set small, even when it is a stop word ('not', 'no').
  const small = page.words.map((w, i) => { const c = clean(w.text).toLowerCase(); return STOPW.has(c) && c.length <= 4 && i !== hw })
  const width = Math.min((props.aspect === '16:9' ? 1100 : 760) * k, box.width)
  const rel = (i: number) => (small[i] ? 0.58 : i === hw ? 1.34 : 1)

  // Lay the words into at most three rows, each row stepping in by 0.9C; shrink C until they fit the band.
  const layout = (C: number) => {
    const rows: number[][] = []
    let row: number[] = [], used = 0
    words.forEach((w, i) => {
      const wd = textWidth(w, C * rel(i), 'anton', true), avail = width - rows.length * 0.9 * C
      if (row.length && used + 0.18 * C + wd > avail) { rows.push(row); row = []; used = 0 }
      used += (row.length ? 0.18 * C : 0) + wd; row.push(i)
    })
    if (row.length) rows.push(row)
    const tallest = rows.map((r) => Math.max(...r.map((i) => rel(i))) * C * 0.92)
    const widest = Math.max(...rows.map((r, ri) => r.reduce((s, i, j) => s + textWidth(words[i]!, C * rel(i), 'anton', true) + (j ? 0.18 * C : 0), 0) + ri * 0.9 * C))
    return { rows, ok: rows.length <= 3 && widest <= width && tallest.reduce((a, b) => a + b, 0) <= box.height }
  }
  let C = 112 * k, L = layout(C)
  while (!L.ok && C > 40 * k) { C -= 4 * k; L = layout(C) }

  const right = index % 3 === 1
  const placement = props.captionPlacement ?? 'lower'
  const vpos: React.CSSProperties = placement === 'upper' ? { top: 0 } : placement === 'centre' ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: 0 }
  const xs = exitStart(page, 3, props.fps)
  const exit = xs === undefined ? 0 : clamp((frame - xs) / Math.max(1, page.toFrame - xs))
  return root('stair-flash', box, (
    <div style={{ position: 'absolute', left: 0, width, ...(right ? { left: box.width - width } : {}), ...vpos,
      display: 'flex', flexDirection: 'column', alignItems: right ? 'flex-end' : 'flex-start',
      opacity: 1 - exit, filter: exit > 0 ? `blur(${(exit * 12).toFixed(1)}px)` : undefined }}>
      {L.rows.map((r, ri) => <div key={ri} style={{ display: 'flex', alignItems: 'baseline', columnGap: 0.18 * C, lineHeight: 0.92,
        [right ? 'marginRight' : 'marginLeft']: ri * 0.9 * C }}>
        {r.map((i) => {
          const w = page.words[i]!, size = C * rel(i), shown = frame >= w.atFrame - 1
          const t = since(frame, w.atFrame - 1, props.fps)
          const base: React.CSSProperties = { fontFamily: F.display, fontSize: size, lineHeight: 0.92, letterSpacing: '0.005em',
            display: 'inline-block', position: 'relative', whiteSpace: 'nowrap', visibility: shown ? 'visible' : 'hidden',
            transformOrigin: right ? '100% 100%' : '0% 100%' }
          // Every word lands: down from 1.12 to 1 over about five frames, growing toward the inside of the band.
          const sc = mix(1.12, 1, outCubic(t / 0.16))
          if (i !== kw) {
            return <span key={i} style={{ ...base, color: props.tokens.cream, textShadow: LIFT, transform: `scale(${sc.toFixed(4)})` }}>{words[i]}</span>
          }
          // The key word: slides in 40 px from the inside of the band (never past its anchored edge) with a
          // channel-colour streak trailing behind it, then a cream copy wipes over it.
          const dir = right ? -1 : 1
          const dx = dir * (1 - outExpo(t / 0.1)) * 40
          const s = clamp(1 - t / 0.1)
          const streak = s > 0 ? [[-18, 0.5], [-36, 0.3], [-54, 0.15]].map(([x, a]) => `${(-dir * x! * s).toFixed(1)}px 0 0 ${rgba(props.tokens.channel, a! * s)}`).join(', ') : ''
          const wipe = outCubic((t - 0.12) / 0.18)
          return <span key={i} style={{ ...base, color: props.tokens.channel, textShadow: streak ? `${streak}, ${LIFT}` : LIFT,
            transform: `translateX(${dx.toFixed(1)}px) scale(${sc.toFixed(4)})` }}>
            {words[i]}
            {wipe > 0 && <span style={{ position: 'absolute', left: 0, top: 0, color: props.tokens.cream,
              clipPath: `inset(-20% ${((1 - wipe) * 100).toFixed(1)}% -20% 0)` }}>{words[i]}</span>}
          </span>
        })}
      </div>)}
    </div>))
}
