import { F, band, clamp, hero, livePage, outBack, outCubic, scale, textWidth } from '../kit'
import { type Draw, exitStart, marked, root, upper } from '../draw'

/** slot-roll: each Anton letter rolls up into its own little window one after another, like a slot reel. A digit is a
 *  real reel: it clicks through four lead digits, one whole digit a frame (never its own true digit, so it never seems
 *  to land early), then the true digit drops into the window and sits whole. The lead digits follow from the true
 *  digit, so a still and a render agree. The page's real hero (none on a setup line) rolls slower in the series colour.
 *  Once the last letter has landed, every letter rolls on out of the top of its window, and the windows are empty on
 *  the page's last frame. Left-aligned in the lower and upper bands, centred in the centre band; at most two rows. A
 *  house build for the number-heavy follow.the.money pieces. */
const SHADOW = 'drop-shadow(0 2px 3px rgba(0,0,0,.30)) drop-shadow(0 8px 26px rgba(0,0,0,.36))'
const LEADS = [9, 7, 5, 3] // offsets from the true digit, never 0 mod 10

export const slotRoll: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), place = props.captionPlacement ?? 'lower', fps = props.fps
  const kw = marked(hero(page))
  const words = page.words.map((w) => upper(w.text))
  const wide = (w: string, size: number) => textWidth(w, size, 'anton', true) * 1.1
  const ROW = 1.04 // a row's height in em: the window is 1 em with a hair of air
  const layout = (S: number) => {
    const gap = S * 0.24, rows: number[][] = []
    let row: number[] = [], used = 0
    words.forEach((w, i) => {
      const wd = wide(w, S)
      if (row.length && used + gap + wd > box.width) { rows.push(row); row = []; used = 0 }
      used += (row.length ? gap : 0) + wd; row.push(i)
    })
    if (row.length) rows.push(row)
    return rows
  }
  let S = Math.round(112 * k), rows = layout(S)
  while (S > 40 && (rows.length > 2 || rows.length * S * ROW > box.height || rows.some((r) => r.length === 1 && wide(words[r[0]!]!, S) > box.width))) {
    S -= 2; rows = layout(S)
  }
  const gap = S * 0.24, centred = place === 'centre'

  // timing per word: letter stagger in frames, a letter's landing in seconds, frames per lead digit
  const timing = (i: number) => {
    const n = [...words[i]!].length, isKey = i === kw
    const step = n > 1 ? Math.min(isKey ? 1.5 : 1, ((isKey ? 0.3 : 0.2) * fps) / (n - 1)) : 0
    return { n, isKey, step, land: isKey ? 0.22 : 0.16, perLead: isKey ? 1.5 : 1 }
  }
  // the last word's whole roll in seconds: its last letter's start, then its reel or landing
  const lt = timing(page.words.length - 1)
  const lastHasDigit = /\d/.test(words[words.length - 1]!)
  const lastRoll = ((lt.n - 1) * lt.step + (lastHasDigit ? 4 * lt.perLead + 3 : lt.land * fps)) / fps
  const es = exitStart(page, 4, fps, lastRoll + 0.05)
  const exitEnd = page.toFrame - 1 // the last live frame: the windows are empty by then
  const exitLen = es === undefined ? 0 : exitEnd - es

  const word = (i: number) => {
    const w = page.words[i]!, text = words[i]!, letters = [...text]
    const { n, isKey, step, land, perLead } = timing(i)
    const color = isKey ? props.tokens.channel : props.tokens.cream
    const exitStep = n > 1 && exitLen > 1 ? Math.min(0.5, (exitLen * 0.4) / (n - 1)) : 0
    const exitDur = Math.max(1, exitLen - exitStep * (n - 1))
    // each letter's window, from the kit's widths: the window shows the whole word set in place, cut to that letter's
    // column, so the windows at rest add up to the word exactly as set (and a reader of the page reads the word whole)
    const em = (x: number) => x / S
    const px = letters.map((_, j) => em(textWidth(letters.slice(0, j).join(''), S, 'anton', true)))
    px.push(em(textWidth(text, S, 'anton', true)))
    const SLACK = 0.25 // the last window runs on past the estimate, so an estimate a little short never clips the word
    const cell = (ch: string, j: number) => {
      const start = w.atFrame + j * step
      const f = frame - start // frames since this letter's start
      const out = es === undefined || exitLen < 1 ? 0 : clamp((frame - es - j * exitStep) / exitDur)
      const exitY = -1.05 * outCubic(out)
      const width = px[j + 1]! - px[j]! + (j === n - 1 ? SLACK : 0)
      const base = { display: 'inline-block', width: `${width.toFixed(4)}em`, height: '1em', lineHeight: '1em', overflow: 'hidden',
        verticalAlign: 'top' } as const
      const inWord = (y: number) => <span key={j} style={base}>
        <span style={{ display: 'block', marginLeft: `${(-px[j]!).toFixed(4)}em`, whiteSpace: 'nowrap', transform: `translateY(${y.toFixed(3)}em)` }}>{text}</span>
      </span>
      // a lone glyph centred in the letter's own column (the last window's slack left out)
      const glyph = (g: number, y: number, op: number) => <span key={j} style={base}>
        <span style={{ display: 'block', width: `${(px[j + 1]! - px[j]!).toFixed(4)}em`, textAlign: 'center', opacity: op,
          transform: `translateY(${y.toFixed(3)}em)` }}>{g}</span>
      </span>
      if (f < 0) return <span key={j} style={{ ...base, visibility: 'hidden' }}>{ch}</span>
      if (/\d/.test(ch)) {
        const d = Number(ch)
        const leadFrames = 4 * perLead
        if (f < leadFrames) {
          // one whole lead digit at a time, never the true digit: a reel clicking past
          const g = (d + LEADS[3 - Math.floor(f / perLead)]!) % 10
          return glyph(g, exitY, 0.8)
        }
        // the true digit drops in from just below, on its own (so no sliver of a neighbour rides with it), and sits whole
        // by its third frame; from then on it is part of the word as set
        if (f < leadFrames + 3) return glyph(d, 0.35 * (1 - outCubic((f - leadFrames) / 3)) + exitY, 1)
        return inWord(exitY)
      }
      const p = outBack((f + 1) / fps / land, 1.3) // the landing frame already shows the first step
      return inWord((1 - p) + exitY)
    }
    return <span key={i} style={{ display: 'inline-flex', fontFamily: F.display, fontSize: S, letterSpacing: 0, color,
      whiteSpace: 'nowrap', marginRight: `${(-SLACK).toFixed(2)}em` }}>{letters.map(cell)}</span>
  }

  const anchor = place === 'upper' ? { top: 0 } : centred ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: 0 }
  return root('slot-roll', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, ...anchor, display: 'flex', flexDirection: 'column',
      alignItems: centred ? 'center' : 'flex-start', rowGap: S * (ROW - 1), filter: SHADOW }}>
      {rows.map((r, ri) => <div key={ri} style={{ display: 'flex', columnGap: gap }}>{r.map(word)}</div>)}
    </div>))
}
