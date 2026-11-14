import React from 'react'
import { MonoLabel } from '../../../house/components'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { isRegion } from '../../kit/layout'
import { ZONES } from '../../kit/lock'
import { canvasRect } from '../../kit/overlay'
import { RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { statStripState } from './state'
export function Device({ object, events, box, tokens, frame }: DeviceProps) {
  const s = statStripState(object, events, frame)
  if (!s.visible) return null
  const at = s.at ?? ZONES.lower_line
  const number = `${s.numeral}${s.unit ? ` ${s.unit}` : ''}`.toUpperCase()
  const numberWidth = textWidth('anton', number, 94)
  const labelWidth = Math.max(...s.label.toUpperCase().split('\n').map(line => textWidth('mono', line, 30, 0.14)),
    textWidth('mono', (object.dataset?.producerLabel ?? '').toUpperCase(), 30, 0.14))
  if (numberWidth * s.scale + labelWidth + 72 > at.w) throw new Error('Stat strip copy does not fit at minimum type sizes')
  // In a layout region the strip is as wide as its copy needs, then fills and centres in the region.
  if (isRegion(box)) {
    const natural = { width: Math.min(at.w, Math.ceil(numberWidth * s.scale + labelWidth) + 120), height: ZONES.lower_line.h }
    return <RegionFit natural={natural} box={box}>{strip({ x: 0, y: 0, w: natural.width })}</RegionFit>
  }
  return strip(at)
  function strip(at: { x: number; y: number; w: number }) {
    return <div style={{ ...canvasRect(at.x, at.y, at.w, ZONES.lower_line.h), background: tokens.mint,
      color: tokens.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px 0 24px',
      opacity: s.opacity, transform: `translateY(${56 * (1 - s.enter)}px)` }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <MonoLabel sizePx={30} style={{ letterSpacing: '0.14em', whiteSpace: 'pre-line' }}>{s.label.toUpperCase()}</MonoLabel>
        {object.dataset && <MonoLabel sizePx={30} style={{ letterSpacing: '0.14em', whiteSpace: 'pre-line' }}>{object.dataset.producerLabel.toUpperCase()}</MonoLabel>}
      </div>
      <span style={{ fontFamily: HOUSE_FONTS.display, fontSize: 94, lineHeight: 1,
        transform: `scale(${s.scale})`, transformOrigin: 'right center' }}>{number}</span>
    </div>
  }
}
