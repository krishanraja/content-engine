import React from 'react'
import { Swipe } from '../../../house/components'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth, wrapWords } from '../../../house/metrics'
import { ENTER, MOTION, progress } from '../../clock'
import { fitScale } from '../../fit'
import { ZONES } from '../../kit/lock'
import { canvasRect, halftone, houseTokens } from '../../kit/overlay'
import type { DeviceProps } from '../types'
import { headlineState } from './state'

export function headlineLayout(lines: string[], width: number, swipedLine = -1) {
  const naturalWidth = Math.max(...lines.map((l, i) => textWidth('anton', l.toUpperCase(), 240) + (i === swipedLine ? 0.24 * 240 : 0)))
  const size = Math.floor(240 * fitScale({ width: naturalWidth, height: lines.length * 240 * 0.88 },
    { left: 0, top: 0, width, height: ZONES.headline.h }))
  if (size < 150) throw new Error('Headline cannot fit at 150px; shorten the supplied lines')
  return { size, height: lines.length * size * 0.88 }
}

export function Device({ object, events, tokens, frame }: DeviceProps) {
  const s = headlineState(object, events, frame)
  if (!s.visible) return null
  const at = s.at ?? ZONES.headline
  const l = headlineLayout(s.lines, at.w, s.swipe?.line)
  const singleWord = s.lines.length === 1 && s.lines[0]!.split(/\s+/).length === 1
  const wordWidth = textWidth('anton', s.lines[0]!.toUpperCase(), l.size) + (s.swipe ? l.size * 0.24 : 0)
  const beside = singleWord && at.w - wordWidth - 32 >= 260
  const dekWidth = beside ? at.w - wordWidth - 32 : at.w
  if (s.dek && (wrapWords('fraunces', s.dek, 44, dekWidth).length * 44 * 1.16 > 110 ||
    s.dek.split(/\s+/).some(word => textWidth('fraunces', word, 44) > dekWidth)))
    throw new Error('Dek copy does not fit at 44px')
  return <>
    <div data-overlay="headline" style={{ ...canvasRect(at.x, at.y, at.w, l.height), color: tokens.cream,
      fontFamily: HOUSE_FONTS.display, fontSize: l.size, lineHeight: 0.88, opacity: 1 - s.exit }}>
      {s.lines.map((line, i) => {
        const p = progress(s.age - i * MOTION.staggerFrames, MOTION.enterFrames, ENTER)
        return <div key={i} style={{ opacity: p, transform: `translateY(${24 * (1 - p)}px)`, whiteSpace: 'nowrap' }}>
          {line.toUpperCase().split(/\s+/).map((word, j) => {
            if (s.swipe?.line !== i || s.swipe.word !== j) return <React.Fragment key={j}>{j > 0 ? ' ' : ''}{word}</React.Fragment>
            const swipe = Swipe({ children: word, tokens: { ...houseTokens(tokens), mint: tokens.channel }, display: true })
            const children = React.Children.toArray(swipe.props.children)
            const block = children[0] as React.ReactElement<{ style: React.CSSProperties }>
            return <React.Fragment key={j}>{j > 0 ? ' ' : ''}{React.cloneElement(swipe, {},
              React.cloneElement(block, { style: { ...block.props.style, ...halftone(tokens) } }), word)}</React.Fragment>
          })}
        </div>
      })}
    </div>
    {s.dek && <div style={{ ...canvasRect(beside ? at.x + wordWidth + 32 : at.x,
      beside ? at.y : at.y + l.height + 24, dekWidth, 110),
      color: tokens.cream, fontFamily: HOUSE_FONTS.dek, fontSize: 44, fontStyle: 'italic', lineHeight: 1.16,
      opacity: s.opacity }}>{s.dek}</div>}
  </>
}
