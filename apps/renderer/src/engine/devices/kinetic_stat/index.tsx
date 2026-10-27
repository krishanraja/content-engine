import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { fitBox, fitScale } from '../../fit'
import type { Box, DeviceProps } from '../types'
import { kineticState } from './state'

export function kineticLayout(box: Box, text: string, unit: string, producerLabel: string, aspect: DeviceProps['aspect']) {
  const sizes = aspect === '9:16' ? [120, 30, 24] : [144, 28, 22]
  const [numberSize, unitSize, producerSize] = sizes as [number, number, number]
  const width = Math.max(1, textWidth('anton', text, numberSize), textWidth('anton', text.replace(/\d/g, '0'), numberSize), textWidth('mono', unit, unitSize), textWidth('mono', producerLabel, producerSize))
  const natural = { width, height: numberSize * 1.2 + unitSize * 1.3 + producerSize * 1.3 + 24 }
  const scale = fitScale(natural, box)
  const fitted = fitBox(natural, box)
  const rect = (top: number, height: number): Box => ({ left: fitted.left, top: fitted.top + top * scale, width: fitted.width, height: height * scale })
  return { scale, sizes, number: rect(0, numberSize * 1.2), unit: rect(numberSize * 1.2 + 12, unitSize * 1.3),
    producer: rect(numberSize * 1.2 + 24 + unitSize * 1.3, producerSize * 1.3) }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = kineticState(object, events, frame)
  if (!state.visible) return null
  // Size against the final value, so counting never changes the geometry.
  const target = state.denominator === null ? String(state.target) : `${state.target}/${state.denominator}`
  const l = kineticLayout(box, target, state.unit, state.producerLabel, aspect)
  return <div style={{ color: tokens.cream, textAlign: 'center' }}>
    {[{ rect: l.number, text: state.text, font: HOUSE_FONTS.display },
      { rect: l.unit, text: state.unit, font: HOUSE_FONTS.data },
      { rect: l.producer, text: state.producerLabel, font: HOUSE_FONTS.data }].map((row, i) =>
      <div key={i} style={{ position: 'absolute', ...row.rect, fontFamily: row.font, fontSize: l.sizes[i]! * l.scale,
        lineHeight: i === 0 ? 1.2 : 1.3, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{row.text}</div>)}
  </div>
}
