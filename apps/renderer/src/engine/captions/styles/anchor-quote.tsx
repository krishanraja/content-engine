import React from 'react'
import type { EngineRenderProps } from '../../props'
import { F, LIFT, band, clamp, clean, fit, hero, mix, outBack, outCubic, outExpo, scale, spoken, textWidth, type Page } from '../kit'
import { type Draw, marked, root } from '../draw'

/** anchor-quote: a running caption (Archivo Bold, as said, three words at most) changes every few words, while the
 *  page's hero holds under it in big Fraunces capitals inside mint curly quotes. Every running word lands as an event:
 *  it rises a third of its size from below and settles from 1.2x with an overshoot over 0.2 s, and a mint bar wipes in
 *  under it and fades. The anchor lands at its word with a firm settle, the quotes close in on it two frames later, and
 *  it then stays still across the next pages until a new anchor lands or 3 s pass; it leaves with the quotes sliding
 *  back out and the word fading. The anchor is the page's real hero only (marked(hero)); in the running tier its place
 *  is held by a mint ellipsis so the small line still parses. Source: instagram_DeZuQ7-lATg (a running caption over a
 *  held "SPEAK"). */

/** The anchor word of a page: its real hero, else none (never the longest-word fallback). */
function anchorOf(page: Page): number { return marked(hero(page)) }

type Anchor = { text: string; at: number; enter: number; exitStart: number; exitEnd: number }

/** Every anchor's timeline in frames, in page order: it always enters at its word (one frame early), holds until the
 *  next anchor is due or 3 s pass, and leaves over 0.15 s, finishing before the next anchor enters. When the next
 *  anchor is close the hold, then the exit, shortens; a new anchor is never delayed, so its word is never shown nowhere.
 *  Pure: derived from props only. */
function anchors(props: EngineRenderProps): Anchor[] {
  const fps = props.fps, hold = Math.round(3 * fps), out = Math.max(3, Math.round(0.15 * fps))
  const raw = props.captions.map((p) => { const a = anchorOf(p); return a < 0 ? null : { text: clean(p.words[a]!.text).toUpperCase(), at: p.words[a]!.atFrame } })
    .filter((x): x is { text: string; at: number } => x !== null)
  return raw.map((r, i) => {
    const enter = r.at - 1
    const nextEnter = raw[i + 1] !== undefined ? raw[i + 1]!.at - 1 : Infinity
    const exitEnd = Math.min(enter + hold + out, nextEnter)
    const exitStart = Math.max(enter + 1, exitEnd - out)
    return { text: r.text, at: r.at, enter, exitStart: Math.min(exitStart, exitEnd), exitEnd }
  })
}

export const anchorQuote: Draw = (props, frame) => {
  const k = scale(props.aspect), box = band(props), place = props.captionPlacement ?? 'lower', fps = props.fps
  // the reference page: the live one, else the last that has begun (an anchor may hold through a pause)
  let index = -1
  props.captions.forEach((p, i) => { if (frame >= p.fromFrame - 1) index = i })
  if (index < 0) return null
  const page = props.captions[index]!, livePg = frame < page.toFrame
  const own = anchorOf(page)

  const all = anchors(props)
  const a = all.find((x) => frame >= x.enter && frame < x.exitEnd) ?? null

  // anchor geometry and motion
  let aSize = 0, presence = 0, anchorEl: React.ReactNode = null
  if (a) {
    aSize = Math.min(132 * k, Math.floor(fit(a.text, 700 * k, 'archivo900', true, 132 * k, 44) * 0.92))
    const quote = textWidth('“', aSize, 'frauncesItalic', false)
    // keep word plus quotes inside the band and within 800 px
    const room = Math.min(800 * k, box.width)
    while (aSize > 44 && textWidth(a.text, aSize, 'archivo900', true) * 0.95 + quote * 2 + aSize * 0.1 > room) aSize -= 2
    const tIn = (frame - a.enter) / fps, tOut = clamp((frame - a.exitStart) / Math.max(1, a.exitEnd - a.exitStart))
    const s = mix(1.18, 1, outBack(tIn / 0.2, 1.6)), wordOp = clamp((frame - a.enter) / 2) * (1 - tOut)
    const qIn = outExpo(((frame - a.enter - 2) / fps) / 0.16), qOut = outCubic(tOut)
    const slide = 48 * k * (1 - qIn) + 48 * k * qOut, qOp = clamp((frame - a.enter - 2) / 2) * (1 - qOut)
    presence = clamp((frame - a.enter) / 3) * (1 - outCubic(tOut))
    const q = (ch: string, dir: -1 | 1) => <span style={{ fontFamily: F.dek, fontWeight: 400, fontSize: aSize, lineHeight: 1, color: props.tokens.mint,
      textShadow: LIFT, display: 'inline-block', opacity: qOp, transform: `translateX(${(dir * slide).toFixed(1)}px)`,
      margin: dir < 0 ? `0 ${aSize * 0.04}px 0 0` : `0 0 0 ${aSize * 0.04}px` }}>{ch}</span>
    anchorEl = <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', height: aSize, overflow: 'visible' }}>
      {q('“', -1)}
      <span style={{ fontFamily: F.dek, fontWeight: 700, fontSize: aSize, lineHeight: 1, letterSpacing: '0.005em', color: props.tokens.cream,
        textShadow: LIFT, display: 'inline-block', opacity: wordOp, transform: `scale(${s.toFixed(4)})`,
        // grow from the slot edge that meets the band edge, so the 1.18x entry never overshoots the band
        transformOrigin: place === 'upper' ? '50% 0%' : place === 'centre' ? '50% 60%' : '50% 100%' }}>{a.text}</span>
      {q('”', 1)}
    </div>
  }

  // the running tier: the page's words in chunks of three at most, the anchor's place held by a mint ellipsis; the live
  // chunk is the one holding the word being said, and it is replaced by a hard cut when the next chunk's first word
  // lands. Every word lands as an event: a rise of a third of its size and a 1.2x to 1 settle with overshoot over
  // 0.2 s, and a mint bar that wipes in under it over 4 frames and fades by 0.5 s.
  let runEl: React.ReactNode = null
  // as large as the band allows above the anchor's slot (92 px in the lower band, 76 in the 230 px upper one)
  const runMax = Math.min(92 * k, (box.height - 10 * k - 132 * k) / 1.15)
  const rs = mix(runMax, runMax * 0.84, presence)
  if (livePg) {
    const now = spoken(page, frame)
    const items = page.words.map((_, i) => i)
    const nChunks = Math.ceil(items.length / 3), per = nChunks ? Math.ceil(items.length / nChunks) : 0
    const chunks: number[][] = []
    for (let c = 0; c < nChunks; c++) chunks.push(items.slice(c * per, (c + 1) * per))
    let cur = -1
    chunks.forEach((ch, c) => { if (ch[0] !== undefined && ch[0] <= now) cur = c })
    const chunk = cur >= 0 ? chunks[cur]! : []
    const text = chunk.map((i) => (i === own ? '\u2026' : clean(page.words[i]!.text)))
    const size = Math.min(rs, fit(text.join(' '), Math.min(800 * k, box.width) / 1.2, 'archivo700', false, rs, 30))
    if (chunk.length && !(chunk.length === 1 && chunk[0] === own)) runEl = <div style={{ display: 'flex', justifyContent: 'center', columnGap: size * 0.26, height: size * 1.15, alignItems: 'flex-end' }}>
      {chunk.map((i, j) => {
        const w = page.words[i]!, isOwn = i === own
        const shown = frame >= w.atFrame - 1, f = frame - w.atFrame + 1
        const t = outBack(f / (0.2 * fps), 1.8), op = clamp(f / 2)
        const bar = isOwn ? 0 : outCubic(f / 4) * (1 - clamp((f - 0.25 * fps) / (0.25 * fps)))
        return <span key={i} style={{ position: 'relative', fontFamily: F.structure, fontWeight: 700, fontSize: size, lineHeight: 1.1, letterSpacing: '-0.005em',
          color: isOwn ? props.tokens.mint : props.tokens.cream, textShadow: `${LIFT}, 0 0 2px ${props.tokens.inkDeep}`, display: 'inline-block',
          visibility: shown ? 'visible' : 'hidden', opacity: op, transformOrigin: '50% 100%',
          transform: `translateY(${((1 - t) * 0.34 * size).toFixed(1)}px) scale(${mix(1.2, 1, t).toFixed(4)})` }}>{text[j]}
          {bar > 0.01 && <span style={{ position: 'absolute', left: 0, right: 0, bottom: size * 0.02, height: Math.max(3, size * 0.07),
            background: props.tokens.mint, opacity: bar, transformOrigin: '0% 50%', transform: `scaleX(${outCubic(f / 4).toFixed(4)})` }} />}
        </span>
      })}
    </div>
  }
  if (!runEl && !anchorEl) return null

  // placement: the anchor's slot (its largest size) is always kept, so the running tier never moves under an anchor
  // that is arriving or leaving. lower sits the slot on the band's bottom with the running tier 10 px above it; upper
  // hangs the running tier from the band's top with the slot under it; centre centres the pair.
  const runH = runMax * 1.15, gap = 10 * k, slot = 132 * k
  let runTop: number, slotTop: number
  if (place === 'upper') { runTop = 0; slotTop = runH + gap }
  else if (place === 'centre') { runTop = (box.height - (runH + gap + slot)) / 2; slotTop = runTop + runH + gap }
  else { slotTop = box.height - slot; runTop = slotTop - gap - runH }
  // the anchor sits on the slot's baseline (bottom), so a smaller anchor never floats away from the running tier
  const aTop = place === 'upper' ? slotTop : slotTop + slot - aSize
  return root('anchor-quote', box, (<>
    {runEl && <div style={{ position: 'absolute', left: 0, right: 0, top: runTop, height: runH, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>{runEl}</div>}
    {anchorEl && <div style={{ position: 'absolute', left: 0, right: 0, top: aTop }}>{anchorEl}</div>}
  </>))
}
