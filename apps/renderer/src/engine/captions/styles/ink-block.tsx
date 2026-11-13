import React from 'react'
import { type Draw, exitProgress, exitStart, marked, root } from '../draw'
import { F, band, clamp, clean, hero, livePage, mix, outBack, outCubic, scale, spoken, textWidth } from '../kit'

/** ink-block, from Krish's "Anthropic is eating its own jobs" cut (2 Nov 2026), whose motion is The Ladder: the phrase
 *  builds as stepped slabs, one full-width deep-ink slab per line, flush left, each line stepped in from the one above
 *  like a rung, with a thick series-colour bar under each slab. Cream Archivo Black, mixed case as said. Active: a
 *  line's slab wipes in from the left across the band when its first word is said; each word rises into its slab from
 *  below the baseline over 6 frames; and on every landing the bar under that line draws on, left to right, out to the
 *  end of the new word, thickening as it goes and settling, while the hot slab gives a 4% pulse. The page's real hero
 *  wears the series colour from the moment it is said. At most two lines; the slabs wipe back out to the left once the
 *  last word has shown sharp. Sits at the foot of the band (the middle in `centre`). */

const BAR = 14 // px, the underline bar at rest
const RIM = 3 // px, a hard cream rim outside the edge so the slab reads on near-black footage
const EDGE = 2 // px, the inkSoft edge that keeps the slab off dark footage

export const inkBlock: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), now = spoken(page, frame)
  if (now < 0) return null
  const t = props.tokens, fps = props.fps, kw = marked(hero(page))
  const words = page.words.map((w) => clean(w.text))

  // Size: the largest at which the page takes two stepped lines at most and both slabs, with their bars, fit the band.
  const layout = (S: number) => {
    const gap = S * 0.26, padX = S * 0.3, step = S * 0.9, rows: number[][] = []
    let row: number[] = [], used = 0
    words.forEach((w, i) => {
      const wd = textWidth(w, S, 'archivo900', false)
      const width = box.width * 0.955 - rows.length * step - padX * 2
      if (row.length && used + gap + wd > width) { rows.push(row); row = []; used = 0 }
      used += (row.length ? gap : 0) + wd; row.push(i)
    })
    if (row.length) rows.push(row)
    return rows
  }
  const slabH = (S: number) => S * 1.18 + EDGE * 2
  let S = Math.round(96 * k), rows = layout(S)
  while (S > 36 && (rows.length > 2 || rows.length * (slabH(S) + BAR + 10) > box.height
    || rows.some((r, ri) => r.length === 1 && textWidth(words[r[0]!]!, S, 'archivo900', false) > box.width * 0.955 - ri * S * 0.9 - S * 0.6))) {
    S -= 2; rows = layout(S)
  }
  const gap = S * 0.26, padX = S * 0.3, step = S * 0.9
  const es = exitStart(page, 6, fps)
  const out = exitProgress(page, es, frame)
  const centre = props.captionPlacement === 'centre'

  // The right edge of each word inside its slab, for the bar's reach.
  const ends = (r: number[]) => {
    let x = padX; return r.map((i, j) => { x += (j ? gap : 0) + textWidth(words[i]!, S, 'archivo900', false); return x })
  }

  return root('ink-block', box, (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      justifyContent: centre ? 'center' : 'flex-end', gap: 10 }}>
      {rows.map((r, ri) => {
        const first = page.words[r[0]!]!
        const f0 = frame - (first.atFrame - 1)
        if (f0 < 0) return null
        const wipe = outCubic(f0 / 5) * (1 - outCubic(out * 1.2 - ri * 0.2))
        const hotJ = r.indexOf(now)
        // the bar's reach: from the end of the word before to the end of the newest word on this line
        const e = ends(r)
        const said = r.filter((i) => i <= now).length
        const lastI = r[said - 1]!
        const lf = frame - (page.words[lastI]!.atFrame - 1)
        const draw = outCubic(lf / 6)
        const from = said > 1 ? e[said - 2]! : 0
        const reach = mix(from, e[said - 1]!, draw)
        const thick = BAR * mix(1.6, 1, outCubic(lf / 6))
        const pulse = hotJ >= 0 ? mix(1.04, 1, outCubic((frame - (page.words[now]!.atFrame - 1)) / 4)) : 1
        const indent = ri * step
        return <div key={ri} style={{ position: 'relative', marginLeft: indent, marginRight: box.width * 0.045, height: slabH(S) + BAR,
          transformOrigin: '0% 50%', transform: `scale(${pulse.toFixed(3)})` }}>
          <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: slabH(S), background: t.inkDeep,
            border: `${EDGE}px solid ${t.inkSoft}`,
            // a hard cream edge so the slab reads on near-black footage; the clip leaves room for it
            boxShadow: `0 0 0 ${RIM}px ${t.cream}`,
            clipPath: `inset(${-RIM}px ${wipe >= 1 ? -RIM : ((1 - wipe) * 100).toFixed(1) + '%'} ${-RIM}px ${-RIM}px)` }}>
            <div style={{ position: 'absolute', left: padX, top: 0, height: '100%', display: 'flex', alignItems: 'center',
              whiteSpace: 'nowrap', gap }}>
              {r.map((i) => {
                const w = page.words[i]!; const wf = frame - (w.atFrame - 1)
                if (wf < 0) return null
                const rise = outBack(wf / 6, 1.4)
                return <span key={i} style={{ display: 'inline-block', fontFamily: F.structure, fontWeight: 900, fontSize: S,
                  lineHeight: 1.1, letterSpacing: '-0.01em', color: i === kw ? t.channel : t.cream,
                  transform: `translateY(${((1 - rise) * S * 0.9).toFixed(1)}px)` }}>{words[i]}</span>
              })}
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, top: slabH(S) - 1, height: thick, width: reach * wipe, background: t.channel }} />
        </div>
      })}
    </div>))
}
