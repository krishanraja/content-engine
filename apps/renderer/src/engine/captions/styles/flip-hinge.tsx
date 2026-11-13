import { F, LIFT, band, clamp, hero, livePage, outBack, outCubic, scale, since, textWidth } from '../kit'
import { type Draw, exitStart, marked, root, upper } from '../draw'

/** flip-hinge: each word swings up into place on a hinge at its baseline, like a card flipped upright (rotateX from
 *  -95 deg, overshooting about 8 deg and settling), lighting up as it comes to face the camera. Archivo Black capitals,
 *  centred, at most two rows; the page's real hero (marked(hero)) in the series colour a step larger, on a slightly slower swing. At the
 *  page's end the words fall away backward about their top edge, one after another from the first (a frame apart, at
 *  least 0.04 s), and the fall never starts before the last word has stood upright for 0.27 s; a page with no room
 *  for that cuts instead.
 *  A house build (the one 3D move); the hard-landing timing comes from instagram_DfkCOCLt7KZ. */
/** Clearance under the top of the band in the upper placement, at 9:16 (scaled by k). */
const TOP = 10

export const flipHinge: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), place = props.captionPlacement ?? 'lower', fps = props.fps
  const kw = marked(hero(page)) // the real hero only; a page without one has no coloured word
  const words = page.words.map((w) => upper(w.text))
  const mult = (i: number) => (i === kw ? 1.1 : 1)
  // rows: greedy wrap with the key word's own width, shrinking until the page fits two rows. Archivo Black capitals
  // set about 15% wider than the kit's estimate (measured on the stills), so the estimate is scaled up here.
  const wide = (w: string, size: number) => textWidth(w, size, 'archivo900', true) * 1.15
  const layout = (S: number) => {
    const gap = S * 0.26, rows: number[][] = []
    let row: number[] = [], used = 0
    words.forEach((w, i) => {
      const wd = wide(w, S * mult(i))
      if (row.length && used + gap + wd > box.width) { rows.push(row); row = []; used = 0 }
      used += (row.length ? gap : 0) + wd; row.push(i)
    })
    if (row.length) rows.push(row)
    return rows
  }
  let S = Math.round(120 * k), rows = layout(S)
  const top = place === 'upper' ? TOP * k : 0
  while (S > 36 && (rows.length > 2 || rows.length * S * 1.1 * 1.08 + top > box.height || rows.some((r) => r.length === 1 && wide(words[r[0]!]!, S * mult(r[0]!)) > box.width))) {
    S -= 3; rows = layout(S)
  }

  // the exit: each word falls back over D frames, the next one a stagger later, word after word from the first;
  // it starts only once the last word (and the key word's slower swing) has fully stood upright
  const n = words.length, D = 3, stagger = Math.max(1, Math.round(0.04 * fps))
  const fall = exitStart(page, D + (n - 1) * stagger, fps, 0.27)

  const span = (i: number) => {
    const w = page.words[i]!, size = S * mult(i)
    const base = { fontFamily: F.structure, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: '-0.01em' } as const
    if (frame < w.atFrame - 1) return <span key={i} style={{ ...base, display: 'inline-block', visibility: 'hidden' }}>{words[i]}</span>
    const dur = i === kw ? 0.26 : 0.2
    const raw = since(frame, w.atFrame, fps)
    const p = outBack(raw / dur, 1.5) // 0 to about 1.08 and back to 1
    const e = fall === undefined || raw < dur ? 0 : outCubic((frame - fall - i * stagger) / D)
    const leaving = e > 0
    const rot = leaving ? 90 * e : -95 * (1 - p)
    const bright = 0.55 + 0.45 * clamp(p)
    return <span key={i} style={{ ...base, display: 'inline-block', color: i === kw ? props.tokens.channel : props.tokens.cream,
      textShadow: LIFT, transformOrigin: leaving ? '50% 0%' : '50% 100%', backfaceVisibility: 'hidden',
      transform: `rotateX(${rot.toFixed(2)}deg)`, opacity: clamp(raw / 0.05 + 0.2) * (1 - e),
      filter: bright < 0.995 ? `brightness(${bright.toFixed(3)})` : undefined }}>{words[i]}</span>
  }

  const anchor = place === 'upper' ? { top: TOP * k } : place === 'centre' ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: 0 }
  return root('flip-hinge', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, ...anchor, display: 'flex', flexDirection: 'column', alignItems: 'center',
      perspective: 700, rowGap: S * 0.08 }}>
      {rows.map((r, ri) => <div key={ri} style={{ display: 'flex', columnGap: S * 0.26, alignItems: 'baseline', perspective: 700,
        transformStyle: 'preserve-3d' }}>{r.map(span)}</div>)}
    </div>))
}
