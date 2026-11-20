import { formatAmount } from './money'
import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { fitBox, fitScale } from '../../fit'
import { fillsWidth } from '../../kit/layout'
import type { Box, DeviceProps } from '../types'
import { kineticState } from './state'

export function kineticLayout(box: Box, text: string, unit: string, producerLabel: string, aspect: DeviceProps['aspect'], ghostTexts: readonly string[] = []) {
  const sizes = aspect === '9:16' ? [120, 30, 24] : [144, 28, 22]
  const [numberSize, unitSize, producerSize] = sizes as [number, number, number]
  // In a region that fills its width (stage) the figure fills the width (shot grammar step 5: the source line, set in small mono, held a $195,000
  // to half the panel); the unit and the source line then shrink to the figure's width rather than setting it.
  const region = fillsWidth(box)
  const lines = region ? [] : [textWidth('mono', unit, unitSize), textWidth('mono', producerLabel, producerSize)]
  const width = Math.max(1, textWidth('anton', text, numberSize), textWidth('anton', text.replace(/\d/g, '0'), numberSize), ...lines,
    ...ghostTexts.map(value => Math.max(textWidth('mono', value, numberSize), textWidth('anton', value, numberSize))))
  const ghostInset = ghostTexts.length ? 8 : 0
  const natural = { width, height: numberSize * 1.2 + unitSize * 1.3 + producerSize * 1.3 + 24 + ghostInset }
  const scale = fitScale(natural, box)
  const fitted = fitBox(natural, box)
  const rect = (top: number, height: number): Box => ({ left: fitted.left, top: fitted.top + (top + ghostInset) * scale, width: fitted.width, height: height * scale })
  // Each row's own font size: the unit and the source line never wider than the figure (outside a region, exactly scale).
  const fits = (w: number, size: number) => Math.min(size * scale, w > 0 ? size * fitted.width / w : size * scale)
  const rowSizes = [numberSize * scale, fits(textWidth('mono', unit, unitSize), unitSize), fits(textWidth('mono', producerLabel, producerSize), producerSize)]
  return { scale, sizes, rowSizes, number: rect(0, numberSize * 1.2), unit: rect(numberSize * 1.2 + 12, unitSize * 1.3),
    producer: rect(numberSize * 1.2 + 24 + unitSize * 1.3, producerSize * 1.3) }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = kineticState(object, events, frame)
  if (!state.visible) return null
  // Size against the final value, so counting never changes the geometry.
  const target = state.targetText
  const ghostTexts = object.params.ghost === true ? object.dataset!.rows.map(row =>
    state.denominator === null ? formatAmount(row.value, object.dataset!.unit).text : `${row.value}/${state.denominator}`) : []
  const l = kineticLayout(box, target, state.unit, state.producerLabel, aspect, ghostTexts)
  return <div style={{ color: tokens.cream, textAlign: 'center' }}>
    {state.ghostText !== null && <div data-kinetic-ghost="" style={{ position: 'absolute', ...l.number,
      top: l.number.top - 8 * l.scale, opacity: 0.25, textDecoration: 'line-through',
      fontFamily: HOUSE_FONTS.data, fontSize: l.sizes[0]! * l.scale,
      lineHeight: 1.2, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{state.ghostText}</div>}
    {[{ rect: l.number, text: state.text, font: HOUSE_FONTS.display },
      { rect: l.unit, text: state.unit, font: HOUSE_FONTS.data },
      { rect: l.producer, text: state.producerLabel, font: HOUSE_FONTS.data }].map((row, i) =>
      <div key={i} style={{ position: 'absolute', ...row.rect, fontFamily: row.font, fontSize: l.rowSizes[i]!,
        lineHeight: i === 0 ? 1.2 : 1.3, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{row.text}</div>)}
  </div>
}
