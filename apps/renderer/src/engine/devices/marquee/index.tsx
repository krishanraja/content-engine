import React from 'react'
import { TickerStar } from '../../../house/components'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { ZONES } from '../../kit/lock'
import { canvasRect, halftone } from '../../kit/overlay'
import type { DeviceProps } from '../types'
import { marqueeState } from './state'
export function Device({ object, events, tokens, frame }: DeviceProps) {
  const s = marqueeState(object, events, frame)
  if (!s.visible) return null
  const at = s.at ?? ZONES.marquee
  const cycleWidth = s.items.reduce((sum, item) => sum + textWidth('mono', item, 30, 0.02) + 46 * 0.84 + 48, 0)
  const repeats = Math.ceil((1080 + (object.toFrame - object.fromFrame) * 2) / cycleWidth) + 1
  return <div aria-hidden style={{ ...canvasRect(0, at.y, 1080, at.h), ...halftone(tokens), overflow: 'hidden', opacity: s.opacity }}>
    <div style={{ display: 'flex', alignItems: 'center', height: at.h, width: cycleWidth * repeats,
      transform: `translateX(${-s.offset}px)`, color: tokens.ink, fontFamily: HOUSE_FONTS.data,
      fontSize: 30, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
      {Array.from({ length: repeats }, (_, n) => s.items.map((item, i) => <React.Fragment key={`${n}-${i}`}>
        <span style={{ flex: 'none', marginRight: 24 }}>{item}</span><span style={{ flex: 'none', marginRight: 24 }}><TickerStar color={tokens.ink} /></span>
      </React.Fragment>))}
    </div>
  </div>
}
