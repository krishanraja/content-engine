import React from 'react'
import type { EngineRenderProps } from '../props'
import type { CaptionThemeName } from './names'
import {
  F, LIFT, REGIONS, band, type Box, clamp, clean, fit, hero, key, livePage, mix, outBack, outCubic, outExpo, previousPage,
  scale, settle, since, spoken, spring, textWidth,
} from './kit'
import { type Draw, root, upper, wrap } from './draw'
import { STYLES } from './styles'

/** Every caption style but `art-directed` (chrome/ArtDirectedCaption.tsx), each the house's own build of an idea
 *  (Krish, 2026-11-11: "None of other styles are amazing you need to improve them all 10X"). The house rules they all
 *  keep: only the house faces (Anton, Archivo, Fraunces, Plex Mono) in weights the files really carry; only the brand
 *  tokens (cream type, the series colour or mint for one marked word, ink for a card); words appear at the frame they
 *  are spoken, never a finished line early; one marked word per page at most; type inside the safe area, never under
 *  the platform UI; no rainbow, no permanent glow, no pill per word. */


/** pop: Archivo Black capitals that land word by word with a firm settle; the word being said wears the series colour
 *  and hands it on as the next lands. Centred in the caption band, at most two lines, sized to fill the width. */
const pop: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), now = spoken(page, frame)
  const words = page.words.map((w) => upper(w.text))
  const size = Math.min(132 * k, fit(words.join(' '), box.width * 2.3, 'archivo900', true, 132 * k))
  const rows = wrap(words, size, box.width, 'archivo900', true, size * 0.28)
  return root('pop', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {rows.map((r, ri) => <div key={ri} style={{ display: 'flex', gap: size * 0.28, lineHeight: 0.98 }}>
        {r.map((i) => {
          const w = page.words[i]!; if (frame < w.atFrame - 1) return <span key={i} style={{ visibility: 'hidden', fontSize: size }}>{words[i]}</span>
          const t = since(frame, w.atFrame, props.fps) / 0.22
          return <span key={i} style={{ fontFamily: F.structure, fontWeight: 900, fontSize: size, letterSpacing: '-0.01em',
            color: i === now ? props.tokens.channel : props.tokens.cream, textShadow: LIFT, display: 'inline-block',
            transform: `translateY(${(1 - outCubic(t)) * 18}px) scale(${settle(t)})`, opacity: clamp(t * 3) }}>{words[i]}</span>
        })}
      </div>)}
    </div>))
}

/** karaoke: the whole line is set at once in quiet cream; each word fills to full cream left to right across the time
 *  it is spoken, and a short series-colour rule draws under the word being said. Archivo ExtraBold, mixed case. */
const karaoke: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), now = spoken(page, frame)
  const words = page.words.map((w) => clean(w.text))
  const size = Math.min(100 * k, fit(words.join(' '), box.width * 2.1, 'archivo700', false, 100 * k))
  const enter = outCubic(since(frame, page.fromFrame, props.fps) / 0.2)
  return root('karaoke', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexWrap: 'wrap', columnGap: size * 0.3,
      rowGap: size * 0.08, opacity: enter, transform: `translateY(${(1 - enter) * 14}px)` }}>
      {page.words.map((w, i) => {
        const end = page.words[i + 1]?.atFrame ?? page.toFrame
        const p = clamp((frame - w.atFrame) / Math.max(1, Math.min(end - w.atFrame, props.fps * 0.5)))
        const fill = `${p * 100}%`
        return <span key={i} style={{ position: 'relative', display: 'inline-block', fontFamily: F.structure, fontWeight: 800,
          fontSize: size, lineHeight: 1.04, letterSpacing: '-0.015em' }}>
          <span style={{ color: props.tokens.cream, opacity: 0.34 }}>{words[i]}</span>
          <span style={{ position: 'absolute', inset: 0, color: props.tokens.cream, textShadow: LIFT, clipPath: `inset(-20% calc(100% - ${fill}) -20% 0)` }}>{words[i]}</span>
          {i === now && <span style={{ position: 'absolute', left: 0, bottom: -size * 0.06, height: Math.max(5, size * 0.07), width: '100%',
            background: props.tokens.channel, transformOrigin: 'left', transform: `scaleX(${outExpo(since(frame, w.atFrame, props.fps) / 0.25)})` }} />}
        </span>
      })}
    </div>))
}

/** kinetic-01, the justified stack: one word per row in Anton capitals, every row sized to the same width so the
 *  phrase becomes a block of type; each new row wipes up from its baseline and the block grows upward from the band's
 *  floor. The key word is set in the series colour. */
const kinetic01: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), kw = key(page)
  const width = 560 * k, words = page.words.map((w) => upper(w.text))
  let sizes = words.map((w) => fit(w, width, 'anton', true, 230 * k, 60))
  const total = sizes.reduce((a, b) => a + b * 0.92, 0), room = box.height + 140 * k
  if (total > room) sizes = sizes.map((s) => s * (room / total))
  return root('kinetic-01', { ...box, top: box.top - 140 * k, height: box.height + 140 * k }, (
    <div style={{ position: 'absolute', left: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {page.words.map((w, i) => {
        if (frame < w.atFrame - 1) return null
        const t = outExpo(since(frame, w.atFrame, props.fps) / 0.24)
        return <div key={i} style={{ overflow: 'hidden', height: sizes[i]! * 0.92, lineHeight: 0.92 }}>
          <div style={{ fontFamily: F.display, fontSize: sizes[i], lineHeight: 0.92, width, whiteSpace: 'nowrap',
            color: i === kw ? props.tokens.channel : props.tokens.cream, textShadow: LIFT, transform: `translateY(${(1 - t) * 100}%)` }}>{words[i]}</div>
        </div>
      })}
    </div>))
}

/** kinetic-02, the edge snap: condensed Archivo capitals that snap in from alternating sides of the frame into one
 *  left-aligned lockup; the page's hero lands last and largest, a full step up, in the series colour. */
const kinetic02: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), kw = key(page)
  const words = page.words.map((w) => upper(w.text))
  const base = Math.min(104 * k, fit(words.filter((_, i) => i !== kw).join(' '), box.width * 1.6, 'archivoCondensed', true, 104 * k))
  const big = fit(words[kw]!, box.width, 'archivoCondensed', true, 200 * k)
  const before = page.words.map((_, i) => i).filter((i) => i !== kw)
  const rows = wrap(before.map((i) => words[i]!), base, box.width, 'archivoCondensed', true, base * 0.24).map((r) => r.map((j) => before[j]!))
  const word = (i: number, size: number) => {
    const w = page.words[i]!; if (frame < w.atFrame - 1) return <span key={i} style={{ visibility: 'hidden', fontSize: size }}>{words[i]}</span>
    const t = since(frame, w.atFrame, props.fps) / 0.2, dir = i % 2 === 0 ? -1 : 1
    return <span key={i} style={{ display: 'inline-block', fontFamily: F.structure, fontWeight: 900, fontStretch: '72%', fontSize: size,
      lineHeight: 0.9, color: i === kw ? props.tokens.channel : props.tokens.cream, textShadow: LIFT,
      transform: `translateX(${dir * (1 - outExpo(t)) * 140}px)`, opacity: clamp(t * 4) }}>{words[i]}</span>
  }
  return root('kinetic-02', box, (
    <div style={{ position: 'absolute', left: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: base * 0.06 }}>
      {rows.map((r, ri) => <div key={ri} style={{ display: 'flex', gap: base * 0.24 }}>{r.map((i) => word(i, base))}</div>)}
      <div>{word(kw, big)}</div>
    </div>))
}

/** hustle, the marker: Anton capitals, two lines at most; under the key word a series-colour bar draws left to right
 *  just after it is said and the word turns ink on it, like a pen through the line. */
const hustle: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), kw = key(page)
  const words = page.words.map((w) => upper(w.text))
  const size = Math.min(128 * k, fit(words.join(' '), box.width * 2.1, 'anton', true, 128 * k))
  const rows = wrap(words, size, box.width - 40, 'anton', true, size * 0.22)
  return root('hustle', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.04 }}>
      {rows.map((r, ri) => <div key={ri} style={{ display: 'flex', gap: size * 0.22 }}>
        {r.map((i) => {
          const w = page.words[i]!; if (frame < w.atFrame - 1) return <span key={i} style={{ visibility: 'hidden', fontFamily: F.display, fontSize: size }}>{words[i]}</span>
          const t = since(frame, w.atFrame, props.fps), bar = i === kw ? outExpo((t - 0.08) / 0.22) : 0
          return <span key={i} style={{ position: 'relative', display: 'inline-block', padding: `0 ${size * 0.08}px`,
            transform: `translateY(${(1 - outCubic(t / 0.16)) * 22}px)`, opacity: clamp(t / 0.06) }}>
            {i === kw && <span style={{ position: 'absolute', left: 0, right: 0, top: '8%', bottom: '2%', background: props.tokens.channel,
              transformOrigin: 'left', transform: `scaleX(${bar}) skewX(-6deg)` }} />}
            <span style={{ position: 'relative', fontFamily: F.display, fontSize: size, lineHeight: 1.02,
              color: bar > 0.55 ? props.tokens.ink : props.tokens.cream, textShadow: bar > 0.55 ? 'none' : LIFT }}>{words[i]}</span>
          </span>
        })}
      </div>)}
    </div>))
}

/** grape, the ink card: the line sits on a deep-ink card that opens left to right as the phrase starts; words arrive in
 *  cream as they are said and the word being said is mint. Archivo Bold, mixed case: the most legible style over busy
 *  footage, for pieces shot against a window or a screen. */
const grape: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), now = spoken(page, frame)
  const words = page.words.map((w) => clean(w.text))
  const size = Math.min(84 * k, fit(words.join(' '), (box.width - 80) * 2.2, 'archivo700', false, 84 * k))
  const open = outExpo(since(frame, page.fromFrame, props.fps) / 0.26)
  return root('grape', box, (
    <div style={{ position: 'absolute', left: 0, bottom: 0, maxWidth: box.width, padding: `${size * 0.36}px ${size * 0.5}px`,
      background: props.tokens.inkDeep, borderRadius: 18, opacity: 0.94, boxShadow: '0 18px 50px rgba(0,0,0,.35)',
      clipPath: `inset(0 ${100 - open * 100}% 0 0 round 18px)`, display: 'flex', flexWrap: 'wrap', columnGap: size * 0.28, rowGap: size * 0.1 }}>
      <span style={{ position: 'absolute', left: 0, top: 18, bottom: 18, width: 6, background: props.tokens.mint, borderRadius: 3 }} />
      {page.words.map((w, i) => {
        const t = since(frame, w.atFrame, props.fps) / 0.16
        return <span key={i} style={{ fontFamily: F.structure, fontWeight: 700, fontSize: size, lineHeight: 1.1, letterSpacing: '-0.01em',
          color: i === now ? props.tokens.mint : props.tokens.cream, opacity: frame < w.atFrame - 1 ? 0 : clamp(t * 2),
          transform: `translateY(${(1 - outCubic(t)) * 10}px)`, display: 'inline-block' }}>{words[i]}</span>
      })}
    </div>))
}

/** beast, the punch: huge Anton capitals in cream with a thick ink outline and a hard ink drop, two words at most on
 *  screen (the one said and the one before it, smaller); each word punches in from 1.3x with a small turn that rights
 *  itself. The key word fills with the series colour. Loud on purpose, for the fast cuts. */
const beast: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), now = spoken(page, frame), kw = key(page)
  if (now < 0) return null
  const show = [now - 1, now].filter((i) => i >= 0)
  return root('beast', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {show.map((i) => {
        const w = page.words[i]!, cur = i === now, t = since(frame, w.atFrame, props.fps)
        const size = fit(upper(w.text), box.width, 'anton', true, (cur ? 190 : 104) * k, 60)
        const p = cur ? outBack(t / 0.2, 2.2) : 1
        return <span key={i} style={{ fontFamily: F.display, fontSize: size, lineHeight: 0.98, display: 'inline-block',
          color: i === kw ? props.tokens.channel : props.tokens.cream, opacity: cur ? clamp(t / 0.05) : 0.9,
          WebkitTextStroke: `${Math.round(size * 0.075)}px ${props.tokens.ink}`, paintOrder: 'stroke fill',
          textShadow: `0 ${Math.round(size * 0.06)}px 0 ${props.tokens.ink}`,
          transform: cur ? `scale(${mix(1.3, 1, p)}) rotate(${mix(-4, 0, p)}deg)` : 'none' }}>{upper(w.text)}</span>
      })}
    </div>))
}

/** poppin: mixed-case Archivo ExtraBold where every word springs up from its baseline with one overshoot; the key word
 *  springs a size bigger, in mint. Friendly and quick, for the lighter pieces. */
const poppin: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), kw = key(page)
  const words = page.words.map((w) => clean(w.text))
  const size = Math.min(104 * k, fit(words.join(' '), box.width * 2.1, 'archivo900', false, 104 * k))
  return root('poppin', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
      alignItems: 'baseline', columnGap: size * 0.26, rowGap: size * 0.06 }}>
      {page.words.map((w, i) => {
        const s = i === kw ? size * 1.28 : size
        if (frame < w.atFrame - 1) return <span key={i} style={{ visibility: 'hidden', fontSize: s, fontWeight: 800 }}>{words[i]}</span>
        const t = since(frame, w.atFrame, props.fps), y = spring(t * 1.6)
        return <span key={i} style={{ fontFamily: F.structure, fontWeight: 800, fontSize: s, lineHeight: 1.04, letterSpacing: '-0.02em',
          color: i === kw ? props.tokens.mint : props.tokens.cream, textShadow: LIFT, display: 'inline-block',
          transform: `translateY(${(1 - y) * 46}px)`, opacity: clamp(t / 0.06) }}>{words[i]}</span>
      })}
    </div>))
}

/** aarit, the editorial: the setup in Fraunces italic, quiet and conversational, under a short cream rule that draws
 *  first; then the hero alone on its own line in Anton capitals, three times the size. A page without a hero stays a
 *  single italic line. Left-aligned, for the reflective pieces. */
const aarit: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), h = hero(page)
  const rest = page.words.map((w, i) => ({ w, i })).filter(({ i }) => i !== h)
  const small = Math.min(78 * k, fit(rest.map(({ w }) => clean(w.text)).join(' '), box.width * 1.6, 'frauncesItalic', false, 78 * k))
  const rule = outExpo(since(frame, page.fromFrame, props.fps) / 0.3)
  const it = (i: number) => { const t = since(frame, page.words[i]!.atFrame, props.fps) / 0.22; return frame < page.words[i]!.atFrame - 1 ? 0 : t }
  return root('aarit', box, (
    <div style={{ position: 'absolute', left: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ width: 120 * k, height: 3, background: props.tokens.cream, opacity: 0.7, marginBottom: small * 0.32, transformOrigin: 'left', transform: `scaleX(${rule})` }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: small * 0.24, maxWidth: box.width }}>
        {rest.map(({ w, i }) => <span key={i} style={{ fontFamily: F.dek, fontStyle: 'italic', fontWeight: 380, fontSize: small, lineHeight: 1.08,
          color: props.tokens.cream, textShadow: LIFT, opacity: clamp(it(i) * 2), transform: `translateY(${(1 - outCubic(it(i))) * 12}px)`, display: 'inline-block' }}>{clean(w.text)}</span>)}
      </div>
      {h >= 0 && frame >= page.words[h]!.atFrame - 1 && (() => {
        const t = it(h), size = fit(upper(page.words[h]!.text), box.width, 'anton', true, 220 * k)
        return <div style={{ fontFamily: F.display, fontSize: size, lineHeight: 0.92, marginTop: small * 0.12, color: props.tokens.cream,
          textShadow: LIFT, transformOrigin: 'left bottom', transform: `scale(${settle(t)})`, opacity: clamp(t * 3) }}>{upper(page.words[h]!.text)}</div>
      })()}
    </div>))
}

/** soft-ai, the bloom: Archivo Medium, mixed case; each word comes into focus from a soft blur with its letters easing
 *  together, and the key word blooms with a brief mint glow that settles to a clean edge within a third of a second.
 *  Sharp and readable at rest; for the technology pieces. */
const softAi: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), kw = key(page)
  const words = page.words.map((w) => clean(w.text))
  const size = Math.min(100 * k, fit(words.join(' '), box.width * 2.1, 'archivo500', false, 100 * k))
  return root('soft-ai', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
      columnGap: size * 0.26, rowGap: size * 0.06 }}>
      {page.words.map((w, i) => {
        if (frame < w.atFrame - 1) return <span key={i} style={{ visibility: 'hidden', fontSize: size }}>{words[i]}</span>
        const t = outCubic(since(frame, w.atFrame, props.fps) / 0.35), glow = i === kw ? Math.max(0, 1 - since(frame, w.atFrame, props.fps) / 0.4) : 0
        return <span key={i} style={{ fontFamily: F.structure, fontWeight: i === kw ? 700 : 500, fontSize: size, lineHeight: 1.08,
          letterSpacing: `${mix(0.08, -0.01, t)}em`, color: props.tokens.cream, opacity: t, filter: `blur(${(1 - t) * 14}px)`, display: 'inline-block',
          textShadow: glow > 0 ? `0 0 ${12 + 30 * glow}px ${props.tokens.mint}, ${LIFT}` : LIFT }}>{words[i]}</span>
      })}
    </div>))
}

/** gaming-stream, the terminal: Plex Mono on a deep-ink tag with a mint prompt; each word types itself out at about
 *  thirty characters a second from the frame it is said, and a mint block cursor blinks at the end of the line. */
const gaming: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props)
  const size = Math.round(62 * k), per = props.fps / 30
  let text = ''
  page.words.forEach((w, i) => {
    if (frame < w.atFrame - 1) return
    const end = page.words[i + 1]?.atFrame ?? page.toFrame, word = clean(w.text)
    const n = Math.min(word.length, Math.floor((Math.min(frame, end) - w.atFrame) / per) + 1)
    text += (text ? ' ' : '') + word.slice(0, Math.max(1, n))
  })
  const blink = Math.floor(frame / (props.fps * 0.5)) % 2 === 0
  return root('gaming-stream', box, (
    <div style={{ position: 'absolute', left: 0, bottom: 0, maxWidth: box.width, background: props.tokens.inkDeep, opacity: 0.94,
      borderRadius: 10, padding: `${size * 0.3}px ${size * 0.42}px`, fontFamily: F.data, fontWeight: 500, fontSize: size, lineHeight: 1.2,
      color: props.tokens.cream, boxShadow: `0 0 0 2px ${props.tokens.inkSoft}, 0 18px 50px rgba(0,0,0,.35)` }}>
      <span style={{ color: props.tokens.mint }}>{'> '}</span>{text}
      <span style={{ display: 'inline-block', width: size * 0.55, height: size * 0.95, marginLeft: size * 0.1, verticalAlign: '-0.12em',
        background: props.tokens.mint, opacity: blink ? 1 : 0 }} />
    </div>))
}

/** simple-one-word: the word being said, alone, in Archivo Black capitals fitted to the band's width (never larger
 *  than 240 px), with a firm settle; the word before it lingers above at a tenth of its weight and leaves as the next
 *  lands. The key word is in the series colour. */
const oneWord: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), now = spoken(page, frame), kw = key(page)
  if (now < 0) return null
  const w = page.words[now]!, text = upper(w.text), t = since(frame, w.atFrame, props.fps) / 0.2
  const size = fit(text, box.width, 'archivo900', true, 240 * k, 70)
  const prev = page.words[now - 1]
  return root('simple-one-word', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {prev && <span style={{ fontFamily: F.structure, fontWeight: 900, fontSize: size * 0.42, lineHeight: 1, color: props.tokens.cream,
        opacity: 0.22 * (1 - clamp(t)), marginBottom: size * 0.04 }}>{upper(prev.text)}</span>}
      <span style={{ fontFamily: F.structure, fontWeight: 900, fontSize: size, lineHeight: 0.96, letterSpacing: '-0.02em', display: 'inline-block',
        color: now === kw ? props.tokens.channel : props.tokens.cream, textShadow: LIFT, transform: `scale(${settle(t)})`, opacity: clamp(t * 3) }}>{text}</span>
    </div>))
}

/** podcast, the two-line scroll: the line being said in Archivo Bold, mixed case, its words brightening from quiet
 *  cream as they are spoken; the line before sits above it, smaller and dimmed, and slides up and away as a new line
 *  begins. Left-aligned, calm, for long conversational takes. */
const podcast: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page, index } = live, k = scale(props.aspect), box = band(props), prev = previousPage(props, index, frame, 90)
  const size = Math.min(88 * k, fit(page.words.map((w) => clean(w.text)).join(' '), box.width * 2.1, 'archivo700', false, 88 * k))
  const enter = outCubic(since(frame, page.fromFrame, props.fps) / 0.28)
  return root('podcast', box, (
    <div style={{ position: 'absolute', left: 0, bottom: 0, width: box.width, transform: `translateY(${(1 - enter) * size * 0.9}px)` }}>
      {prev && <div style={{ fontFamily: F.structure, fontWeight: 600, fontSize: size * 0.6, lineHeight: 1.12, color: props.tokens.cream,
        opacity: 0.5 - 0.15 * clamp(since(frame, page.fromFrame, props.fps) / 1.2), marginBottom: size * 0.2 }}>{prev.words.map((w) => clean(w.text)).join(' ')}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.26, opacity: enter }}>
        {page.words.map((w, i) => {
          const lit = clamp(since(frame, w.atFrame, props.fps) / 0.15)
          return <span key={i} style={{ fontFamily: F.structure, fontWeight: 700, fontSize: size, lineHeight: 1.1, letterSpacing: '-0.012em',
            color: props.tokens.cream, opacity: mix(0.3, 1, lit), textShadow: lit > 0.5 ? LIFT : 'none' }}>{clean(w.text)}</span>
        })}
      </div>
    </div>))
}

/** cinematic, Audrey's cinematic caption system (github.com/audrey-560/hyperframes-cinematic-caption, MIT; Krish,
 *  2026-11-11: "install these too"), rebuilt for ve: captions as designed editorial moments, not a subtitle strip.
 *  - Each page is a semantic group. Support words in Archivo Medium, mixed case, rise in a 16 px cascade at the frame
 *    each is said; the page's hero (heroScore 4 or more: a reversal, a number, the spoken stress) lands at the same
 *    moment on its own line in Anton at hero scale (fitted, up to 230 px) with a firm settle.
 *  - The hero is neutral silver-white tinted glass: a 56% fill so the footage shows through, a fine cream rim, a soft
 *    bloom at entry that settles within 0.3 s, and one light sweep across the glyphs while their geometry stays still.
 *  - A page with no hero sets its emphasis word a step up in weight and size (the anchor), never a hero by default.
 *  - Layout states rotate between groups and hold within one (lower-left, upper band, lower-right), each reading top to
 *    bottom; with no subject matte in ve the hero sits in the safe negative space, never faked behind him. */
const cinematic: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page, index } = live, k = scale(props.aspect), regions = REGIONS[props.aspect], h = hero(page)
  const state = (['lower-left', 'upper', 'lower-right'] as const)[index % 3]!
  const box = state === 'upper' ? regions.upper : regions.lower
  const align = state === 'lower-right' ? 'flex-end' : 'flex-start'
  const anchor = h < 0 ? (page.swipeIndex ?? -1) : -1
  const support = page.words.map((w, i) => ({ w, i })).filter(({ i }) => i !== h)
  const sSize = Math.min(68 * k, fit(support.map(({ w }) => clean(w.text)).join(' '), box.width * 1.6, 'archivo500', false, 68 * k))
  const cascade = (i: number) => { const w = page.words[i]!; if (frame < w.atFrame - 1) return null; return outCubic(since(frame, w.atFrame, props.fps) / 0.26) }
  const before = support.filter(({ i }) => h < 0 || i < h), after = support.filter(({ i }) => h >= 0 && i > h)
  const line = (items: typeof support) => items.length > 0 && (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: sSize * 0.26, justifyContent: align, maxWidth: box.width }}>
      {items.map(({ w, i }) => {
        const t = cascade(i), a = i === anchor
        return <span key={i} style={{ fontFamily: F.structure, fontWeight: a ? 800 : 500, fontSize: a ? sSize * 1.32 : sSize, lineHeight: 1.06,
          letterSpacing: '-0.01em', color: props.tokens.cream, textShadow: LIFT, display: 'inline-block', visibility: t === null ? 'hidden' : 'visible',
          opacity: t ?? 0, transform: `translateY(${(1 - (t ?? 0)) * 16}px)` }}>{clean(w.text)}</span>
      })}
    </div>)
  let heroEl: React.ReactNode = null
  if (h >= 0 && frame >= page.words[h]!.atFrame - 1) {
    const text = clean(page.words[h]!.text), t = since(frame, page.words[h]!.atFrame, props.fps)
    // in the upper band the whole group (support line and hero) must fit above the head, inside the band
    const room = state === 'upper' ? (box.height - (before.length ? sSize * 1.1 : 0) - (after.length ? sSize * 1.1 : 0)) / 0.98 : 230 * k
    const size = fit(text, box.width, 'anton', false, Math.min(230 * k, room), 90)
    const sweep = mix(-60, 160, clamp((t - 0.18) / 0.7)), bloom = Math.max(0, 1 - t / 0.3)
    heroEl = <div style={{ fontFamily: F.display, fontSize: size, lineHeight: 0.94, margin: `${sSize * 0.12}px 0`,
      color: 'transparent', WebkitTextStroke: `1.25px rgba(244,239,228,.9)`,
      backgroundImage: `linear-gradient(105deg, rgba(244,239,228,.56) 0%, rgba(244,239,228,.56) ${sweep - 18}%, rgba(255,255,255,.96) ${sweep}%, rgba(244,239,228,.56) ${sweep + 18}%, rgba(214,222,226,.5) 100%)`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text', display: 'inline-block', transformOrigin: align === 'flex-end' ? 'right bottom' : 'left bottom',
      filter: `drop-shadow(0 2px 2px rgba(0,0,0,.28)) drop-shadow(0 10px 30px rgba(0,0,0,.35))${bloom > 0 ? ` drop-shadow(0 0 ${8 + 26 * bloom}px rgba(244,239,228,${0.55 * bloom}))` : ''}`,
      transform: `scale(${settle(t / 0.32)})`, opacity: clamp(t / 0.08) }}>{text}</div>
  }
  return root('cinematic', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, [state === 'upper' ? 'top' : 'bottom']: 0, display: 'flex', flexDirection: 'column', alignItems: align }}>
      {line(before)}{heroEl}{line(after)}
    </div>))
}

/** slam, the beat-slam stack: every word slams in at the frame it is said, from 2.2x with a motion blur and a small
 *  alternating turn, landing in 0.16 s on a quart-out (the kinetic beat-slam timings, held 0.35 s and more; source:
 *  "openmontage@fecb9a1", behaviour only). The words already said on the page stack above it, each step smaller and
 *  dimmer, the stack sliding up as the next lands, so the band fills from the bottom. Anton capitals; the key word in
 *  the series colour with an ink outline. Every word is an event on screen: this is the fast caption. */
const slam: Draw = (props, frame) => {
  const live = livePage(props, frame); if (!live) return null
  const { page } = live, k = scale(props.aspect), box = band(props), now = spoken(page, frame), kw = key(page)
  if (now < 0) return null
  const w = page.words[now]!, t = since(frame, w.atFrame, props.fps)
  const land = 1 - Math.pow(1 - clamp(t / 0.16), 4)
  const show = [now - 2, now - 1, now].filter((i) => i >= 0)
  const sizes = show.map((i, j) => fit(upper(page.words[i]!.text), box.width, 'anton', true, (j === show.length - 1 ? 210 : 210 * Math.pow(0.58, show.length - 1 - j)) * k, 44))
  return root('slam', box, (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      transform: `translateY(${((1 - outExpo(t / 0.12)) * sizes[sizes.length - 1]! * 0.5).toFixed(1)}px)` }}>
      {show.map((i, j) => {
        const cur = i === now, size = sizes[j]!, word = upper(page.words[i]!.text), turn = (now % 2 ? 1 : -1) * 5
        return <span key={i} style={{ fontFamily: F.display, fontSize: size, lineHeight: 0.96, display: 'inline-block', letterSpacing: '0.005em',
          color: i === kw ? props.tokens.channel : props.tokens.cream, opacity: cur ? clamp(t / 0.03) : 0.55 + 0.2 * j,
          WebkitTextStroke: i === kw ? `${Math.round(size * 0.06)}px ${props.tokens.ink}` : undefined, paintOrder: 'stroke fill',
          textShadow: LIFT, filter: cur && land < 0.98 ? `blur(${((1 - land) * 16).toFixed(1)}px)` : undefined,
          transform: cur ? `scale(${mix(2.2, 1, land).toFixed(3)}) rotate(${mix(turn, 0, land).toFixed(2)}deg)` : 'none' }}>{word}</span>
      })}
    </div>))
}

export const THEMES: Record<Exclude<CaptionThemeName, 'art-directed'>, Draw> = {
  pop, karaoke, 'kinetic-01': kinetic01, 'kinetic-02': kinetic02, hustle, grape, beast, poppin, aarit, 'soft-ai': softAi,
  'gaming-stream': gaming, 'simple-one-word': oneWord, podcast, cinematic, slam, ...STYLES,
}
