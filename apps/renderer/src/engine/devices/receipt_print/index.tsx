import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { PRINT, receiptState } from './state'

type ReceiptState = ReturnType<typeof receiptState>

/** Authored separately: stacked label/figure on tall paper, columns on wide paper.
 *  All text is measured at its final value, so adding a line never shifts earlier lines. */
export function receiptLayout(state: ReceiptState, aspect: DeviceProps['aspect']) {
  const tall = aspect === '9:16'
  const labelSize = tall ? 32 : 30, figureSize = tall ? 40 : 38, sourceSize = 30, titleSize = tall ? 52 : 56
  const pad = 32, gap = 14
  const labelWidth = Math.max(...state.lines.map(line => textWidth('mono', line.label, labelSize)))
  const figureWidth = Math.max(...state.lines.map(line => textWidth('mono', line.figure, figureSize))) + 20
  const width = Math.max(tall ? 760 : 960, textWidth('mono', state.title, titleSize) + 2 * pad,
    textWidth('mono', state.producerLabel, sourceSize) + 2 * pad,
    (tall ? Math.max(labelWidth, figureWidth) : labelWidth + gap + figureWidth) + 2 * pad)
  const rowHeight = tall ? 106 : 68, rowsTop = 112
  const height = rowsTop + rowHeight * state.lines.length + 86
  // Conservative rotational envelope at every tilt, including the ghost and full 250 px rise.
  const angle = Math.abs(PRINT.startDeg) * Math.PI / 180
  const marginX = height * Math.sin(angle) / 2 + 8
  const marginY = width * Math.sin(angle) / 2 + 8
  return { tall, labelSize, figureSize, sourceSize, titleSize, pad, figureWidth, rowHeight, rowsTop,
    paper: { width, height }, left: marginX, top: marginY,
    width: width + marginX * 2, height: height + marginY * 2 + PRINT.risePx }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = receiptState(object, events, frame)
  if (!state.visible) return null
  const l = receiptLayout(state, aspect)
  const centreX = l.paper.width / 2, centreY = l.paper.height / 2
  // RegionFit grows only boxes marked by layout/staging; ordinary slots only shrink.
  return <RegionFit natural={l} box={box}>
    <svg width={l.width} height={l.height} viewBox={`0 0 ${l.width} ${l.height}`} role="img" aria-label={`${state.title}, ${state.producerLabel}`}>
      <title>{`${state.title} · ${state.producerLabel}`}</title>
      <g opacity={state.opacity} transform={`translate(${l.left} ${l.top + state.y + state.jolt}) rotate(${state.tilt} ${centreX} ${centreY})`}>
        {state.dissolve < 1 && <g data-previous-layout="" aria-hidden="true" opacity={1 - state.dissolve}>{paper(state.previousHighlight)}</g>}
        <g data-current-layout="" opacity={state.dissolve}>{paper(state.highlighted)}</g>
        {state.ghost && <g data-print-ghost="" aria-hidden="true" opacity={0.25} transform={`translate(${PRINT.joltPx} ${PRINT.joltPx})`}>{paper(state.highlighted, true)}</g>}
      </g>
    </svg>
  </RegionFit>

  function paper(highlighted: string | undefined, ghost = false) {
    return <g fontFamily={HOUSE_FONTS.data} fill={tokens.ink}>
      <rect width={l.paper.width} height={l.paper.height} fill={ghost ? 'none' : tokens.cream} stroke={ghost ? tokens.cream : 'none'} />
      <text x={l.pad} y={76} fontSize={l.titleSize}>{state.title}</text>
      <path d={`M ${l.pad} 94 H ${l.paper.width - l.pad}`} stroke={tokens.ink} strokeWidth={2} />
      {state.lines.map((line, i) => {
        const y = l.rowsTop + i * l.rowHeight
        const figureX = l.tall ? l.pad : l.paper.width - l.pad - l.figureWidth
        const figureY = y + (l.tall ? 46 : 6)
        return <g key={line.key} data-line={line.key} opacity={line.opacity}>
          {line.key === highlighted && <rect data-highlight="" x={l.pad - 8} y={y - 2} width={l.paper.width - 2 * l.pad + 16} height={l.rowHeight - 8} fill="none" stroke={tokens.ink} strokeWidth={2} />}
          <text x={l.pad} y={y + l.labelSize} fontSize={l.labelSize}>{line.label}</text>
          {line.printed && <rect data-figure-fill="" x={figureX} y={figureY} width={l.figureWidth} height={l.figureSize + 10} fill={tokens.mint} />}
          <text x={figureX + 10} y={figureY + l.figureSize} fontSize={l.figureSize}>{line.figure}</text>
          <path d={`M ${l.pad} ${y + l.rowHeight - 4} H ${l.paper.width - l.pad}`} stroke={tokens.inkSoft} strokeWidth={1} strokeDasharray="4 6" />
        </g>
      })}
      <text x={l.pad} y={l.paper.height - 32} fontSize={l.sourceSize}>{state.producerLabel}</text>
    </g>
  }
}
