import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { kineticState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = kineticState(object, events, frame)
  if (!state.visible) return null
  const portrait = aspect === '9:16'
  // The number scales to its slot so the stat never spills over a neighbouring device.
  const numberPx = Math.round(Math.min(portrait ? 120 : 144, box.height * 0.42))
  return <div style={{ position: 'absolute', ...box, boxSizing: 'border-box', overflow: 'hidden', color: tokens.cream, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: portrait ? 'center' : 'flex-start', gap: portrait ? 24 : 18, textAlign: portrait ? 'center' : 'left' }}>
    <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', flexWrap: 'wrap', alignItems: portrait ? 'center' : 'baseline', gap: portrait ? 12 : 24, maxWidth: '100%', minWidth: 0 }}>
      <div style={{ fontFamily: HOUSE_FONTS.display, fontSize: numberPx, lineHeight: 1, overflowWrap: 'anywhere', maxWidth: '100%', fontVariantNumeric: 'tabular-nums' }}>{state.text}</div>
      <div style={{ fontFamily: HOUSE_FONTS.data, fontSize: portrait ? 30 : 28, overflowWrap: 'anywhere' }}>{state.unit}</div>
    </div>
    <div style={{ fontFamily: HOUSE_FONTS.data, fontSize: portrait ? 24 : 22, lineHeight: 1.3, overflowWrap: 'anywhere', maxWidth: '100%' }}>{state.producerLabel}</div>
  </div>
}
