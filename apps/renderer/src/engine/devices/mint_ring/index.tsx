import React from 'react'
import { isRegion } from '../../kit/layout'
import { SCRIBBLE } from '../../kit/lock'
import { RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { mintRingState } from './state'

export function Device({ object, events, box, tokens, frame }: DeviceProps) {
  const state = mintRingState(object, events, frame)
  if (!state.visible || state.drawn <= 0) return null
  const g = state.geometry
  const region = isRegion(box)
  const width = region ? g.width : box.width, height = region ? g.height : box.height
  const svg = <svg width={width} height={height} viewBox={region ? `${g.left} ${g.top} ${width} ${height}` : `0 0 ${width} ${height}`}
    aria-label={object.meaning} style={{ position: 'absolute', left: region ? 0 : box.left,
      top: region ? 0 : box.top, overflow: 'visible', pointerEvents: 'none', opacity: state.opacity }}>
    {(['ink', 'mint'] as const).map(role => <path key={role} d={g.d} fill="none" stroke={tokens[role]}
      strokeWidth={role === 'ink' ? SCRIBBLE.keyline_px : SCRIBBLE.stroke_px}
      strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - state.drawn} />)}
  </svg>
  return region ? <RegionFit natural={{ width, height }} box={box}>{svg}</RegionFit> : svg
}
