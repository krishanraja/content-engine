import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { quoteCardState } from './state'

/** A verbatim pull quote beside real footage: evidence text too small to read in frame is carried here, attributed,
 *  never retyped into the footage itself. Brutal card: square, 2 px border, hard offset shadow, no blur. */
export function Device({ object, events, tokens, frame }: DeviceProps) {
  const s = quoteCardState(object, events, frame)
  if (!s.visible) return null
  return <div style={{ position: 'absolute', left: s.at.x, top: s.at.y, width: s.at.w, boxSizing: 'border-box',
    background: tokens.ink, border: `2px solid ${tokens.cream}`, boxShadow: `6px 6px 0 ${tokens.channel}`,
    padding: '10px 28px 10px', transform: `translateY(${s.rise}px)`, opacity: s.opacity }}>
    <div style={{ fontFamily: HOUSE_FONTS.structure, fontWeight: 600, fontSize: 44, lineHeight: 1.2, color: tokens.cream }}>{s.quote}</div>
    <div style={{ position: 'absolute', right: 28, bottom: 10, fontFamily: HOUSE_FONTS.data, fontWeight: 500, fontSize: 30, lineHeight: 1,
      letterSpacing: '0.14em', textTransform: 'uppercase', color: tokens.mint }}>{s.label}</div>
  </div>
}
