import React from 'react'
import { type Draw, isStop, marked, root } from '../draw'
import { F, band, clamp, clean, fit, hero, livePage, mix, outBack, outCubic, scale, spoken, textWidth } from '../kit'

/** mint-word, from Krish's AI music cut (11 Nov 2026), whose proof slams onto the stage with a back-eased overshoot:
 *  one word at a time, Archivo 900 up to 132 px (shrinking to fit), lower case as said, cream on a tight deep-ink box
 *  with an inkSoft edge; the page's real hero turns the box mint with ink type and sits higher, as in the cut. Active:
 *  every content word is a landing of 7 frames. The box wipes open left to right over 4 frames, starting a frame
 *  before the type, and box and word slam in together from 1.25x and a little low with a back-eased overshoot, so each word is an
 *  event, not a cut. Stop words ("a", "the", "of") are set at 0.6x with a short, small landing, so filler never
 *  shouts. Left-aligned in the band, as the cut sits left of the speaker; centred when the placement is `centre`. */

export const mintWord: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), now = spoken(page, frame)
  if (now < 0) return null
  const t = props.tokens, kw = marked(hero(page))
  const w = page.words[now]!
  const word = clean(w.text).toLowerCase()
  const isKey = now === kw, stop = !isKey && isStop(w.text)
  const padX = 0.16
  // Fit to the band less the box's padding and the landing's overshoot; the key word's lift stays inside the band.
  const avail = (box.width - 24) / (1 + padX * 2 * 0.62)
  const full = fit(word, avail / 1.08, 'archivo900', false, 132 * k, 44)
  const size = Math.min(full, Math.round((box.height - 20) / 1.4), stop ? Math.round(132 * k * 0.6) : 999)
  const f = frame - (w.atFrame - 1) // frames since the landing began (the box leads by a frame)
  const len = stop ? 4 : 7
  const wipe = outCubic(f / (stop ? 2 : 4)) // the box opens left to right
  const land = outBack(clamp((f - 1) / (len - 1)), stop ? 1.2 : 2.6) // the type slams in a frame behind the box
  // the slam starts at 1.25x, less when a long word would leave the band at that scale
  const from = stop ? 1.08 : clamp(avail / textWidth(word, size, 'archivo900', false), 1.08, 1.25)
  const lift = isKey ? size * 0.14 : 0
  const centre = props.captionPlacement === 'centre'
  return root('mint-word', box, (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: centre ? 'center' : 'flex-start',
      paddingLeft: centre ? 0 : 6 }}>
      <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap', transformOrigin: centre ? '50% 60%' : '0% 60%',
        transform: `translateY(${(mix(size * 0.22, 0, land) - lift).toFixed(1)}px) scale(${mix(from, 1, land).toFixed(3)})`,
        padding: `${size * 0.02}px ${size * padX}px ${size * 0.06}px` }}>
        <span style={{ position: 'absolute', inset: 0, background: isKey ? t.mint : t.inkDeep,
          border: isKey ? undefined : `3px solid ${t.inkSoft}`, clipPath: `inset(0 ${((1 - wipe) * 100).toFixed(1)}% 0 0)` }} />
        <span style={{ position: 'relative', display: 'inline-block', fontFamily: F.structure, fontWeight: 900, fontSize: size, lineHeight: 1.12,
          letterSpacing: '-0.005em', color: isKey ? t.ink : t.cream, opacity: f < 1 ? 0.5 : 1 }}>{word}</span>
      </span>
    </div>))
}
