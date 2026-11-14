import { isRegion } from '../../kit/layout'
import React from 'react'
import { Swipe } from '../../../house/components'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth, wrapWords } from '../../../house/metrics'
import { fitScale } from '../../fit'
import { ZONES } from '../../kit/lock'
import { canvasRect, halftone, houseTokens } from '../../kit/overlay'
import { entranceStyle, revealLines } from '../../kit/reveal'
import type { DeviceProps } from '../types'
import { headlineState } from './state'

export function headlineLayout(lines: string[], width: number, swipedLine = -1, room: number = ZONES.headline.h) {
  const naturalWidth = Math.max(...lines.map((l, i) => textWidth('anton', l.toUpperCase(), 240) + (i === swipedLine ? 0.24 * 240 : 0)))
  const size = Math.floor(240 * fitScale({ width: naturalWidth, height: lines.length * 240 * 0.88 },
    { left: 0, top: 0, width, height: room }))
  if (size < 150) throw new Error('Headline cannot fit at 150px; shorten the supplied lines')
  return { size, height: lines.length * size * 0.88 }
}

export function Device({ object, events, box, aspect, tokens, frame }: DeviceProps) {
  const s = headlineState(object, events, frame)
  if (!s.visible) return null
  // In a layout region (kit/layout.ts) the headline fills the region it is given and centres in it, like a stage; a
  // headline too long for the region's rail-safe width at the 150 px minimum keeps the stage placement it had before.
  const stageAt = { x: 60, y: aspect === '9:16' ? 220 : 180, w: (aspect === '9:16' ? 1080 : 1920) - 120, h: aspect === '9:16' ? 987 : 720 }
  let region = !s.at && isRegion(box)
  if (region) { try { headlineLayout(s.lines, box.width, s.swipe?.line, box.height) } catch { region = false } }
  const stage = (!s.at && isRegion(box)) || (!s.at && box.top === 0 && box.height === (aspect === '9:16' ? 1920 : 1080))
  const at = { ...(s.at ?? (region ? { x: box.left, y: box.top, w: box.width, h: box.height }
    : stage ? (isRegion(box) ? stageAt : { ...stageAt, w: box.width - 120 }) : ZONES.headline)) }
  const l = headlineLayout(s.lines, at.w, s.swipe?.line, 'h' in at ? at.h : undefined)
  if (stage) at.y += (at.h! - l.height - (s.dek ? 134 : 0)) / 2
  const singleWord = s.lines.length === 1 && s.lines[0]!.split(/\s+/).length === 1
  const wordWidth = textWidth('anton', s.lines[0]!.toUpperCase(), l.size) + (s.swipe ? l.size * 0.24 : 0)
  const beside = singleWord && at.w - wordWidth - 32 >= 260
  const dekWidth = s.dekAt?.w ?? (beside ? at.w - wordWidth - 32 : at.w)
  if (s.dek && (wrapWords('fraunces', s.dek, 44, dekWidth).length * 44 * 1.16 > 110 ||
    s.dek.split(/\s+/).some(word => textWidth('fraunces', word, 44) > dekWidth)))
    throw new Error('Dek copy does not fit at 44px')
  const reveal = revealLines(s.lines.map(line => line.toUpperCase()), s.age)
  return <>
    <div data-overlay="headline" style={{ ...canvasRect(at.x, at.y, at.w, l.height), color: s.ground === 'light' ? tokens.ink : tokens.cream,
      fontFamily: HOUSE_FONTS.display, fontSize: l.size, lineHeight: 0.88, opacity: 1 - s.exit }}>
      {s.lines.map((line, i) => {
        // The shared reveal (kit/reveal.ts): by line with no style, as before; by word, typed or rolled in a style.
        const r = reveal[i]!
        const words = line.toUpperCase().split(/\s+/).map((word, j) => {
          const w = r.words[j]!
          const shown = w.chars >= word.length ? word : <>{word.slice(0, w.chars)}<span style={{ opacity: 0 }}>{word.slice(w.chars)}</span></>
          const swiped = s.swipe?.line === i && s.swipe.word === j
          let body: React.ReactNode = shown
          if (swiped) {
            const swipe = Swipe({ children: word, tokens: { ...houseTokens(tokens), mint: tokens.channel }, display: true })
            const children = React.Children.toArray(swipe.props.children)
            const block = children[0] as React.ReactElement<{ style: React.CSSProperties }>
            body = React.cloneElement(swipe, {}, React.cloneElement(block, { style: { ...block.props.style, ...halftone(tokens) } }), word)
          }
          // A word typing in shows its typed part; the swiped word waits until it is whole.
          const unit = w.chars < word.length ? (swiped ? <span style={{ opacity: 0 }}>{body}</span> : shown)
            : w.p === 1 ? body : <span style={{ display: 'inline-block', ...entranceStyle(w.p) }}>{body}</span>
          return <React.Fragment key={j}>{j > 0 ? ' ' : ''}{unit}</React.Fragment>
        })
        if (r.roll) return <div key={i} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ transform: `translateY(${(100 * (1 - r.p)).toFixed(3)}%)`, opacity: Math.min(1, r.p * 2) }}>{words}</div></div>
        return <div key={i} style={{ ...entranceStyle(r.p), whiteSpace: 'nowrap' }}>{words}</div>
      })}
    </div>
    {s.dek && <div style={{ ...canvasRect(s.dekAt?.x ?? (beside ? at.x + wordWidth + 32 : at.x),
      s.dekAt?.y ?? (beside ? at.y : at.y + l.height + 24), dekWidth, 110),
      color: tokens.cream, fontFamily: HOUSE_FONTS.dek, fontSize: 44, fontStyle: 'italic', lineHeight: 1.16,
      opacity: s.opacity, ...(s.dekBack ? { background: tokens.ink, boxShadow: `0 0 0 14px ${tokens.ink}`, width: 'fit-content', maxWidth: dekWidth, height: 'auto', minHeight: 0 } : {}) }}
      data-dek-back={s.dekBack ? '' : undefined}>{s.dek}</div>}
  </>
}
