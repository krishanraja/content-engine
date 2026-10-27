import React from 'react'
import { Img } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { testGridStateAt } from './state'

export { testGridStateAt } from './state'
export { TestGridParamsSchema } from './schema'

// The visual answers: which model flagged the same issue in each country?
// Every cell keeps its position, so the remaining ghost is directly comparable.
const LAYOUT = {
  '9:16': { width: 768, labelWidth: 200, gap: 14, headHeight: 96, rowMin: 92, labelSize: 32, footerHeight: 120, tickSize: 68, shadow: 6 },
  '16:9': { width: 1100, labelWidth: 244, gap: 24, headHeight: 76, rowMin: 96, labelSize: 36, footerHeight: 120, tickSize: 80, shadow: 8 },
} as const

function Tick({ color, outline, ghost, size }: { color: string; outline: string; ghost: boolean; size: number }) {
  const path = 'M 17 49 L 39 70 L 83 25'
  return <svg aria-hidden width={size} height={size} viewBox="0 0 100 100">
    {ghost ? null : <path d={path} fill="none" stroke={outline} strokeWidth={19} strokeLinejoin="miter" />}
    <path d={path} fill="none" stroke={color} strokeWidth={ghost ? 5 : 13} strokeDasharray={ghost ? '1 10' : undefined} strokeLinecap={ghost ? 'round' : 'square'} strokeLinejoin="miter" />
  </svg>
}

export function TestGrid({ object, events, box, tokens, aspect, frame }: DeviceProps): React.ReactElement {
  const state = testGridStateAt(object, events, frame)
  const layout = LAYOUT[aspect]
  const width = Math.min(box.width, layout.width) - layout.shadow * 2
  const mono: React.CSSProperties = { fontFamily: HOUSE_FONTS.data, fontSize: layout.labelSize, lineHeight: 1.2, fontWeight: 500 }
  const columns = `${layout.labelWidth}px repeat(${state.params.cols.length}, minmax(0, 1fr))`
  return <div data-device="test_grid" style={{
    position: 'absolute', left: box.left + (box.width - width) / 2, top: box.top,
    width, height: box.height, color: tokens.cream, opacity: state.opacity,
    transform: `translateY(${state.dropY - state.ambient * box.height}px)`,
  }}>
    <div role="table" aria-label={object.meaning} style={{
      display: 'grid', gridTemplateColumns: columns,
      gridTemplateRows: `${layout.headHeight}px repeat(${state.params.rows.length}, minmax(${layout.rowMin}px, 1fr))`,
      gap: layout.gap, height: Math.max(box.height - layout.footerHeight, layout.headHeight + state.params.rows.length * (layout.rowMin + layout.gap)),
    }}>
      <div role="row" style={{ display: 'contents' }}>
        <div role="columnheader" />
        {state.params.cols.map((col) => <div role="columnheader" key={col.id} style={{ ...mono, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflowWrap: 'anywhere' }}>{col.label}</div>)}
      </div>
      {state.params.rows.map((row) => <div role="row" key={row.id} style={{ display: 'contents' }}>
        <div role="rowheader" style={{ ...mono, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, overflowWrap: 'anywhere' }}>
          {row.logoSrc ? <Img src={row.logoSrc} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} /> : null}
          <span style={{ minWidth: 0 }}>{row.label}</span>
        </div>
        {state.cells.filter((cell) => cell.row === row.id).map((cell) => <div role="cell" key={cell.id} data-cell={cell.id} aria-label={`${row.label}, ${state.params.cols.find((col) => col.id === cell.col)!.label}: ${cell.stamped ? `${cell.value} ${state.unit}` : 'pending'}`} style={{
          minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
          background: tokens.cream, color: tokens.ink, border: `2px solid ${tokens.ink}`, borderRadius: 0,
          boxShadow: `${layout.shadow}px ${layout.shadow}px 0 ${tokens.ink}`,
          opacity: cell.opacity, transform: `scale(${cell.scale})`,
        }}>
          {cell.ghost ? <span style={{ opacity: cell.ghostProgress * 0.5 }}><Tick ghost color={tokens.ink} outline={tokens.ink} size={layout.tickSize} /></span> : null}
          {cell.stamped ? <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: cell.stampProgress, transform: `translateY(${-16 * (1 - cell.stampProgress)}px) scale(${1.2 - 0.2 * cell.stampProgress})` }}>
            {cell.tick ? <Tick ghost={false} color={tokens.mint} outline={tokens.ink} size={layout.tickSize} /> : null}
            <span style={{ fontFamily: HOUSE_FONTS.display, fontSize: aspect === '9:16' ? 52 : 60 }}>{cell.value}</span>
          </div> : null}
        </div>)}
      </div>)}
    </div>
    <div style={{ ...mono, fontSize: 26, lineHeight: 1.35, paddingTop: 22, overflowWrap: 'anywhere' }}>
      <div>{state.unit}{state.denominator === null ? '' : ` · OUT OF ${state.denominator}`}</div>
      <div style={{ paddingTop: 8 }}>{state.producerLabel}</div>
    </div>
  </div>
}
