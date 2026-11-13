import { F, band, clamp, hero, livePage, outCubic, scale, since, textWidth } from '../kit'
import { type Draw, exitStart, marked, root, upper } from '../draw'

/** slice: each Anton word arrives cut in two, its top half nudging in from the left and its bottom half sweeping in from the right,
 *  with a mint hairline along the cut while the halves are apart; the line is gone by the time they close, so a word at
 *  rest is never crossed out. The split holds for 4 to 6 frames at speed (a real landing, not a jitter). Each half
 *  travels only as far as the band allows (and the top half never over a word already landed); what one side lacks the
 *  other makes up, so the cut always shows. The page's real hero (none on a setup line) comes in wider and slower in the series colour and keeps a hair of
 *  its cut at rest. Once the last word has closed, over the page's last 3 frames the halves part again and fade.
 *  Left-aligned in the lower and upper bands, centred in the centre band; at most two rows. A house build: the sharp
 *  news cut. */
const SHADOW = 'drop-shadow(0 2px 3px rgba(0,0,0,.30)) drop-shadow(0 8px 26px rgba(0,0,0,.36))'

export const slice: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), place = props.captionPlacement ?? 'lower', fps = props.fps
  const kw = marked(hero(page))
  const words = page.words.map((w) => upper(w.text))
  // Anton capitals set a little wider than the kit's estimate; measure with a margin so a row never overruns the band
  const wide = (w: string, size: number) => textWidth(w, size, 'anton', true) * 1.08
  const layout = (S: number) => {
    const gap = S * 0.22, rows: number[][] = []
    let row: number[] = [], used = 0
    words.forEach((w, i) => {
      const wd = wide(w, S)
      if (row.length && used + gap + wd > box.width) { rows.push(row); row = []; used = 0 }
      used += (row.length ? gap : 0) + wd; row.push(i)
    })
    if (row.length) rows.push(row)
    return rows
  }
  let S = Math.round(124 * k), rows = layout(S)
  while (S > 40 && (rows.length > 2 || rows.length * S * 0.94 > box.height || rows.some((r) => r.length === 1 && wide(words[r[0]!]!, S) > box.width))) {
    S -= 2; rows = layout(S)
  }
  const gap = S * 0.22, centred = place === 'centre'

  // each word's left and right edges inside the band (by the estimate), so no half ever starts outside it
  const left = new Map<number, number>(), right = new Map<number, number>(), first = new Set<number>()
  rows.forEach((r) => {
    const rowW = r.reduce((a, i, j) => a + wide(words[i]!, S) + (j ? gap : 0), 0)
    let x = centred ? (box.width - rowW) / 2 : 0
    first.add(r[0]!)
    r.forEach((i) => { left.set(i, x); x += wide(words[i]!, S); right.set(i, x); x += gap })
  })

  const DUR = 0.26, KEY_DUR = 0.32
  const lastDur = page.words.length - 1 === kw ? KEY_DUR : DUR
  // the exit never starts before the last word has closed (its whole landing, then a beat sharp)
  const es = exitStart(page, 3, fps, lastDur + 0.06)
  const e = es === undefined ? 0 : clamp((frame - es) / Math.max(1, page.toFrame - 1 - es))

  const word = (i: number) => {
    const w = page.words[i]!, text = words[i]!
    const base = { fontFamily: F.display, fontSize: S, lineHeight: 0.94, letterSpacing: '0.005em', whiteSpace: 'nowrap' } as const
    if (frame < w.atFrame) return <span key={i} style={{ ...base, display: 'inline-block', visibility: 'hidden' }}>{text}</span>
    const isKey = i === kw
    const dur = isKey ? KEY_DUR : DUR
    const t = since(frame, w.atFrame, fps)
    const p = outCubic(t / dur)
    const roomL = Math.max(0, left.get(i) ?? 0), roomR = Math.max(0, box.width - (right.get(i) ?? box.width))
    // the split's full width is 2 * off; each side takes what the band allows and the other side makes up the rest
    const off = isKey ? 220 : 140, total = 2 * off
    // the top half comes from the left only as far as the gap before it (so it never runs over a word already landed),
    // unless the band's right edge leaves the bottom half too little room; the bottom half from the right makes up the rest
    // (only a row's first word has open band to its left; any other word has just the gap before it)
    const freeL = first.has(i) ? roomL : gap
    const fromL = Math.min(freeL, Math.max(gap * 0.6, total - roomR))
    const fromR = Math.min(roomR, total - fromL)
    const rest = isKey ? 3 : 0 // the hero keeps a hair of its cut at rest
    const xTop = -fromL * (1 - p) - Math.min(rest, roomL) - Math.min(40, roomL) * e
    const xBot = fromR * (1 - p) + Math.min(rest, roomR) + Math.min(40, roomR) * e
    const op = (frame === w.atFrame ? 0.75 : 1) * (1 - e)
    const color = isKey ? props.tokens.channel : props.tokens.cream
    const half = (clip: string, x: number) => (
      <span style={{ ...base, position: 'absolute', left: 0, top: 0, color, clipPath: clip, transform: `translateX(${x.toFixed(1)}px)`, opacity: op }}>{text}</span>
    )
    // the hairline lives only on the cut while the halves are apart: full while the split is wide, gone before they close
    const line = 1 - clamp(p / 0.85)
    const spanL = -fromL * (1 - p), spanR = fromR * (1 - p)
    return <span key={i} style={{ ...base, display: 'inline-block', position: 'relative' }}>
      <span style={{ visibility: 'hidden' }}>{text}</span>
      {/* the halves overlap by 2 px, so at rest no anti-aliased seam reads as a line through the word */}
      {half('inset(-40% -20% calc(50% - 1px) -20%)', xTop)}
      {half('inset(calc(50% - 1px) -20% -40% -20%)', xBot)}
      {line > 0.02 && e === 0 && <span style={{ position: 'absolute', left: spanL, right: -spanR, top: '50%', height: 3, marginTop: -1.5,
        background: props.tokens.mint, opacity: line }} />}
    </span>
  }

  const anchor = place === 'upper' ? { top: 0 } : centred ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: 0 }
  return root('slice', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, ...anchor, display: 'flex', flexDirection: 'column',
      alignItems: centred ? 'center' : 'flex-start', filter: SHADOW }}>
      {rows.map((r, ri) => <div key={ri} style={{ display: 'flex', columnGap: gap }}>{r.map(word)}</div>)}
    </div>))
}
