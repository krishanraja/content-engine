import React from 'react'
import { Img } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import { fitBox, fitScale } from '../../fit'
import type { Box, DeviceProps } from '../types'
import { testGridStateAt } from './state'

export { testGridStateAt } from './state'
export { TestGridParamsSchema } from './schema'

const LAYOUT = {
  '9:16': { width: 768, labelWidth: 200, gap: 14, headHeight: 96, rowMin: 92, labelSize: 32, footerHeight: 120, tickSize: 68, shadow: 6 },
  '16:9': { width: 1100, labelWidth: 244, gap: 24, headHeight: 76, rowMin: 96, labelSize: 36, footerHeight: 120, tickSize: 80, shadow: 8 },
} as const

/** All returned rectangles are in frame coordinates, including the reserved footer rows. */
export function gridLayout(box: Box, rowCount: number, colCount: number, aspect: DeviceProps['aspect']) {
  const l = LAYOUT[aspect]
  const natural = { width: l.width, height: l.headHeight + rowCount * (l.rowMin + l.gap) + l.footerHeight }
  const scale = fitScale(natural, box)
  const fitted = fitBox(natural, box)
  const rect = (left: number, top: number, width: number, height: number): Box => ({
    left: fitted.left + left * scale, top: fitted.top + top * scale, width: width * scale, height: height * scale,
  })
  const colWidth = (l.width - l.labelWidth - colCount * l.gap) / Math.max(1, colCount)
  const header = Array.from({ length: colCount }, (_, col) => rect(l.labelWidth + l.gap + col * (colWidth + l.gap), 0, colWidth, l.headHeight))
  const rowLabels = Array.from({ length: rowCount }, (_, row) => rect(0, l.headHeight + l.gap + row * (l.rowMin + l.gap), l.labelWidth, l.rowMin))
  const cells = rowLabels.flatMap((_, row) => header.map((_, col) => rect(
    l.labelWidth + l.gap + col * (colWidth + l.gap), l.headHeight + l.gap + row * (l.rowMin + l.gap), colWidth - l.shadow, l.rowMin - l.shadow,
  )))
  const footerY = natural.height - l.footerHeight
  return { scale, header, rowLabels, cells,
    outOf: rect(0, footerY + 12, l.width, 44), producerFooter: rect(0, footerY + 64, l.width, 44) }
}

function Tick({ color, outline, ghost, size }: { color: string; outline: string; ghost: boolean; size: number }) {
  const path = 'M 17 49 L 39 70 L 83 25'
  return <svg aria-hidden width={size} height={size} viewBox="0 0 100 100">
    {ghost ? null : <path d={path} fill="none" stroke={outline} strokeWidth={19} strokeLinejoin="miter" />}
    <path d={path} fill="none" stroke={color} strokeWidth={ghost ? 5 : 13} strokeDasharray={ghost ? '1 10' : undefined} strokeLinecap={ghost ? 'round' : 'square'} strokeLinejoin="miter" />
  </svg>
}

export function TestGrid({ object, events, box, tokens, aspect, frame }: DeviceProps): React.ReactElement {
  const state = testGridStateAt(object, events, frame)
  const l = LAYOUT[aspect]
  const layout = gridLayout(box, state.params.rows.length, state.params.cols.length, aspect)
  const textStyle = (rect: Box, text: string, size: number = l.labelSize): React.CSSProperties => ({
    position: 'absolute', ...rect, display: 'flex', alignItems: 'center', boxSizing: 'border-box',
    fontFamily: HOUSE_FONTS.data, fontSize: Math.min(size * layout.scale, rect.width / Math.max(1, [...text].length * 0.6)),
    lineHeight: 1.2, fontWeight: 500, whiteSpace: 'nowrap',
  })
  return <div data-device="test_grid" role="table" aria-label={object.meaning} style={{ color: tokens.cream, opacity: state.opacity }}>
    {state.params.cols.map((col, i) => <div role="columnheader" key={col.id} style={{ ...textStyle(layout.header[i]!, col.label), justifyContent: 'center' }}>{col.label}</div>)}
    {state.params.rows.map((row, i) => <div role="row" key={row.id}>
      <div role="rowheader" style={textStyle(layout.rowLabels[i]!, row.label, row.logoSrc ? l.labelSize - 6 : l.labelSize)}>
        {row.logoSrc ? <Img src={row.logoSrc} style={{ width: 24 * layout.scale, height: 24 * layout.scale, objectFit: 'contain', marginRight: 6 * layout.scale }} /> : null}
        <span>{row.label}</span>
      </div>
      {state.cells.filter((cell) => cell.row === row.id).map((cell) => {
        const col = state.params.cols.findIndex((item) => item.id === cell.col)
        const rect = layout.cells[i * state.params.cols.length + col]!
        const size = Math.min(l.tickSize * layout.scale, rect.height * 0.75, rect.width * 0.4)
        return <div role="cell" key={cell.id} data-cell={cell.id} aria-label={`${row.label}, ${state.params.cols[col]!.label}: ${cell.stamped ? `${cell.value} ${state.unit}` : 'pending'}`} style={{
          position: 'absolute', ...rect, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box', background: tokens.cream, color: tokens.ink, border: `${2 * layout.scale}px solid ${tokens.ink}`,
          boxShadow: `${l.shadow * layout.scale}px ${l.shadow * layout.scale}px 0 ${tokens.ink}`,
          opacity: cell.opacity, transform: `scale(${cell.scale > 1 ? 1 : 0.98})`, transformOrigin: 'center',
        }}>
          {cell.ghost ? <span style={{ opacity: cell.ghostProgress * 0.5 }}><Tick ghost color={tokens.ink} outline={tokens.ink} size={size} /></span> : null}
          {cell.stamped ? <div style={{ display: 'flex', alignItems: 'center', opacity: cell.stampProgress, transform: `scale(${0.8 + 0.2 * cell.stampProgress})` }}>
            {cell.tick ? <Tick ghost={false} color={tokens.mint} outline={tokens.ink} size={size} /> : null}
            <span style={{ fontFamily: HOUSE_FONTS.display, fontSize: Math.min(60 * layout.scale, rect.height * 0.7, rect.width / Math.max(1, String(cell.value).length)) }}>{cell.value}</span>
          </div> : null}
        </div>
      })}
    </div>)}
    <div style={textStyle(layout.outOf, `${state.unit}${state.denominator === null ? '' : ` · OUT OF ${state.denominator}`}`, 26)}>{state.unit}{state.denominator === null ? '' : ` · OUT OF ${state.denominator}`}</div>
    <div style={textStyle(layout.producerFooter, state.producerLabel, 26)}>{state.producerLabel}</div>
  </div>
}
