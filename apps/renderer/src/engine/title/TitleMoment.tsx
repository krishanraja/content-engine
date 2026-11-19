import React, { type JSX } from 'react'
import { Img, interpolate, spring } from 'remotion'
import { HOUSE_FONTS } from '../../house/geometry'
import { textWidth } from '../../house/metrics'

export type TitleWord = { text: string; atFrame: number }
export type Box = { left: number; top: number; width: number; height: number }
export type TitleMomentProps = {
  card?: boolean
  /** On a card, the wordmark rides in the card's last row, under the title and aligned to its words, and slams in with it
   *  (Krish, 19 Nov 2026: "It should animate in and all be one feature, aligned properly. not a wordmark temporarily in
   *  the bottom right, disconnected from the title."). */
  logo?: { src: string; pixelWidth: number; pixelHeight: number }
  words: TitleWord[]; fromFrame: number; toFrame: number; frame: number
  aspect: '9:16' | '16:9'; width: number; height: number
  stage: Box; captionBox: Box; tokens: Record<string, string>
  /** 'captions' (default): the title flows back into the caption line. 'fade': the captions already took his next
   *  words while the title held, so it fades where it stands instead of flying into them. */
  release?: 'captions' | 'fade'
}
const unit = (v: number) => Math.max(0, Math.min(1, v))
const mix = (a: number, b: number, t: number) => interpolate(t, [0, 1], [a, b])
const emphasis = (s: string) => /^(ai|built|say|no)$/i.test(s.replace(/[^a-z]/gi, '')) ? 1.24 : 1

/** Partition by measured advances, keeping the final geometry stable before any words arrive.
 * No hidden text nodes: unspoken words reserve geometry only, never markup. */
export function titleLayout(words: TitleWord[], stage: Box, aspect: TitleMomentProps['aspect']) {
  const widths = words.map(w => textWidth('anton', w.text.toUpperCase(), 100 * emphasis(w.text)))
  const gap = 22
  let best: { rows: number[][]; size: number; score: number } | undefined
  for (let count = Math.min(2, words.length); count <= Math.min(4, words.length); count++) {
    const sum = (a: number, b: number) => widths.slice(a, b).reduce((x, y) => x + y, 0) + gap * Math.max(0, b - a - 1)
    const target = (sum(0, words.length) - gap * (count - 1)) / count
    const dp = Array.from({ length: count + 1 }, () => Array(words.length + 1).fill(Infinity) as number[])
    const prev = dp.map(row => row.map(() => 0))
    dp[0]![0] = 0
    for (let r = 1; r <= count; r++) for (let end = r; end <= words.length; end++) {
      for (let start = r - 1; start < end; start++) {
        // Keep SAY NO together when possible.
        const split = start > 0 && /^say$/i.test(words[start - 1]!.text) && /^no\W*$/i.test(words[start]!.text)
        const cost = dp[r - 1]![start]! + (sum(start, end) - target) ** 2 + (split ? target ** 2 : 0)
        if (cost < dp[r]![end]!) { dp[r]![end] = cost; prev[r]![end] = start }
      }
    }
    const rows: number[][] = []
    let end = words.length
    for (let r = count; r > 0; r--) { const start = prev[r]![end]!; rows.unshift(Array.from({ length: end - start }, (_, i) => start + i)); end = start }
    const natural = { width: Math.max(...rows.map(row => sum(row[0]!, row.at(-1)! + 1))), height: count * 112 }
    // A title grows to fill its stage (fitScale never grows type past its natural size outside a layout region).
    const size = 100 * Math.min(stage.width * 0.88 / natural.width, stage.height * 0.84 / natural.height)
    // The biggest type that still spans 80% of the stage: a tall stack of small rows is not a hero title.
    const spans = natural.width * size / 100 >= stage.width * 0.8
    const score = size * (aspect === '9:16' && count === 3 ? 1.04 : 1) * (spans ? 1 : 0.5)
    if (!best || score > best.score) best = { rows, size, score }
  }
  const size = best?.size ?? 0, rows = best?.rows ?? []
  const lineHeight = size * 1.12, height = rows.length * lineHeight
  return rows.flatMap((row, ri) => {
    const rowWidth = row.reduce((s, i) => s + widths[i]! * size / 100, 0) + Math.max(0, row.length - 1) * gap * size / 100
    let x = stage.left + (stage.width - rowWidth) / 2
    return row.map(i => {
      const width = widths[i]! * size / 100
      // Bigger key words share the row's baseline: the extra size rises above the line, never hangs below it.
      const result = { index: i, x, y: stage.top + (stage.height - height) / 2 + ri * lineHeight - size * (emphasis(words[i]!.text) - 1) * 0.9, width, size: size * emphasis(words[i]!.text), row: ri }
      x += width + gap * size / 100
      return result
    })
  })
}

/** Cut-clock only; deliberately no Remotion context, clocks, random values or persistent state. */
export function TitleMoment(props: TitleMomentProps): JSX.Element | null {
  const { words, frame, fromFrame, toFrame, stage, captionBox, tokens } = props
  if (frame < fromFrame || frame >= toFrame || !words.length || stage.width <= 0 || stage.height <= 0) return null
  const layout = titleLayout(words, stage, props.aspect)
  const last = Math.max(...words.map(w => w.atFrame))
  const landing = frame - last
  const exit = unit((frame - Math.max(fromFrame, toFrame - 10)) / Math.min(10, toFrame - fromFrame))
  const returnEase = exit * exit * (3 - 2 * exit)
  const settle = landing < 0 ? 1 : mix(0.975, 1, spring({ frame: landing, fps: 30, config: { damping: 18, stiffness: 260, mass: 0.5 } }))
  const push = 1 + 0.012 * unit((frame - last) / Math.max(1, toFrame - last))
  const bloom = landing >= 0 ? 1 - unit(landing / 9) : 0
  const sweep = mix(-40, 140, unit(landing / 9))
  const cream = tokens.cream ?? tokens.text
  const ink = tokens.ink ?? tokens.background
  const brand = tokens.brand ?? tokens.mint ?? cream
  // Podcast's two-line, left-aligned caption band supplies each word's origin and destination.
  const captionSize = Math.min(88 * props.width / 1080, captionBox.height / 2.2)
  let cx = 0, cy = 0
  const origins = words.map(w => {
    const width = textWidth('archivo700', w.text, captionSize)
    if (cx && cx + width > captionBox.width) { cx = 0; cy += captionSize * 1.1 }
    const result = { x: captionBox.left + cx, y: captionBox.top + cy }
    cx += width + captionSize * 0.26
    return result
  })
  const maxY = Math.max(...origins.map(o => o.y))
  const offsetY = captionBox.top + captionBox.height - captionSize * 1.1 - maxY
  // The title lands on a card that slams in, never bare over his face (Krish, 18 Nov 2026: "you will need to make the
  // title captions a card that slams or slides in I think. having naked captions over my face looks stupid").
  const pad = Math.max(...layout.map(p => p.size)) * 0.32
  const left = Math.min(...layout.map(p => p.x)) - pad, top = Math.min(...layout.map(p => p.y)) - pad * 0.6
  const right = Math.max(...layout.map(p => p.x + p.width)) + pad
  const logoH = props.card && props.logo ? Math.max(...layout.map(p => p.size)) * 0.62 : 0
  const textBottom = Math.max(...layout.map(p => p.y + p.size * 1.15))
  const bottom = textBottom + pad * 0.6 + (logoH ? logoH + pad * 0.5 : 0)
  const slam = spring({ frame: Math.max(0, frame - fromFrame), fps: 30, config: { damping: 13, stiffness: 320, mass: 0.6 } })
  const cardIn = unit((frame - fromFrame) / 3)
  return <div data-title-moment="" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {props.card ? [<div key="card" data-title-card="" style={{ position: 'absolute', left, top, width: right - left, height: bottom - top,
      background: ink, borderRadius: pad * 0.6, borderLeft: `${Math.max(8, pad * 0.22)}px solid ${brand}`,
      boxShadow: `0 ${pad * 0.4}px ${pad * 1.4}px rgba(0,0,0,0.45)`, opacity: cardIn * (1 - returnEase),
      transformOrigin: '50% 60%', transform: `scale(${mix(1.28, 1, slam).toFixed(4)}) rotate(${mix(-3, 0, slam).toFixed(3)}deg)` }} />,
      ...(logoH && props.logo ? [<Img key="card-logo" data-title-wordmark="" src={props.logo.src} style={{ position: 'absolute',
        left: left + pad, top: textBottom + pad * 0.35, height: logoH, width: logoH * props.logo.pixelWidth / props.logo.pixelHeight,
        opacity: cardIn * (1 - returnEase), transformOrigin: `${50}% ${-120}%`,
        transform: `scale(${mix(1.28, 1, slam).toFixed(4)}) rotate(${mix(-3, 0, slam).toFixed(3)}deg)` }} />] : []), ...(layout.map(p => {
      const w = words[p.index]!
      if (frame < w.atFrame) return null
      const progress = unit((frame - w.atFrame) / 8)
      const lift = 1 - (1 - progress) ** 3
      // On a card each word lands in place on the card, never flying up across his face from the caption band.
      const origin = props.card ? { x: p.x, y: p.y - offsetY + p.size * 0.35 } : origins[p.index]!
      const targetX = stage.left + stage.width / 2 + (p.x - stage.left - stage.width / 2) * settle * push
      const targetY = stage.top + stage.height / 2 + (p.y - stage.top - stage.height / 2) * settle * push
      const home = props.release === 'fade' ? 0 : returnEase
      const x = mix(mix(origin.x, targetX, lift), origin.x, home)
      const y = mix(mix(origin.y + offsetY, targetY, lift), origin.y + offsetY, home)
      const size = mix(mix(captionSize, p.size * settle * push, lift), captionSize, home)
      return <span key={p.index} data-title-word={p.index} data-title-row={p.row} style={{
        position: 'absolute', left: x, top: y, fontFamily: HOUSE_FONTS.display, fontWeight: 400,
        fontSize: size, lineHeight: 1.15, whiteSpace: 'pre', opacity: 1 - returnEase,
        color: cream, textTransform: 'uppercase',
        textShadow: `0 2px 3px ${ink}, 0 6px 18px ${ink}, 0 0 36px ${ink}`,
        filter: bloom > 0 ? `drop-shadow(0 0 ${bloom * 10}px ${brand})` : undefined,
        ...(landing >= 0 && landing < 9 ? {
          // Transparent glyphs would show the ink text-shadow through them: the sweep keeps its separation as a filter.
          textShadow: 'none', filter: `drop-shadow(0 4px 10px ${ink})${bloom > 0 ? ` drop-shadow(0 0 ${bloom * 10}px ${brand})` : ''}`,
          color: 'transparent', backgroundImage: `linear-gradient(110deg, ${cream} ${sweep - 16}%, ${brand} ${sweep}%, ${cream} ${sweep + 16}%)`, backgroundClip: 'text', WebkitBackgroundClip: 'text' } : {}),
      }}>{w.text}</span>
    }))] : layout.map(p => {
      const w = words[p.index]!
      if (frame < w.atFrame) return null
      const progress = unit((frame - w.atFrame) / 8)
      const lift = 1 - (1 - progress) ** 3
      // On a card each word lands in place on the card, never flying up across his face from the caption band.
      const origin = props.card ? { x: p.x, y: p.y - offsetY + p.size * 0.35 } : origins[p.index]!
      const targetX = stage.left + stage.width / 2 + (p.x - stage.left - stage.width / 2) * settle * push
      const targetY = stage.top + stage.height / 2 + (p.y - stage.top - stage.height / 2) * settle * push
      const home = props.release === 'fade' ? 0 : returnEase
      const x = mix(mix(origin.x, targetX, lift), origin.x, home)
      const y = mix(mix(origin.y + offsetY, targetY, lift), origin.y + offsetY, home)
      const size = mix(mix(captionSize, p.size * settle * push, lift), captionSize, home)
      return <span key={p.index} data-title-word={p.index} data-title-row={p.row} style={{
        position: 'absolute', left: x, top: y, fontFamily: HOUSE_FONTS.display, fontWeight: 400,
        fontSize: size, lineHeight: 1.15, whiteSpace: 'pre', opacity: 1 - returnEase,
        color: cream, textTransform: 'uppercase',
        textShadow: `0 2px 3px ${ink}, 0 6px 18px ${ink}, 0 0 36px ${ink}`,
        filter: bloom > 0 ? `drop-shadow(0 0 ${bloom * 10}px ${brand})` : undefined,
        ...(landing >= 0 && landing < 9 ? {
          // Transparent glyphs would show the ink text-shadow through them: the sweep keeps its separation as a filter.
          textShadow: 'none', filter: `drop-shadow(0 4px 10px ${ink})${bloom > 0 ? ` drop-shadow(0 0 ${bloom * 10}px ${brand})` : ''}`,
          color: 'transparent', backgroundImage: `linear-gradient(110deg, ${cream} ${sweep - 16}%, ${brand} ${sweep}%, ${cream} ${sweep + 16}%)`, backgroundClip: 'text', WebkitBackgroundClip: 'text' } : {}),
      }}>{w.text}</span>
    })}
  </div>
}
