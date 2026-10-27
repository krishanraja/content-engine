import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { queryState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = queryState(object, events, frame)
  if (!state.visible) return null
  const portrait = aspect === '9:16'
  return <div style={{ position: 'absolute', ...box, display: 'flex', alignItems: 'center', justifyContent: portrait ? 'center' : 'flex-start', opacity: state.enter * (1 - state.exit), transform: `translateX(${-(portrait ? 80 : 120) * (1 - state.enter + state.exit)}px)` }}>
    <div style={{ boxSizing: 'border-box', maxWidth: '100%', borderRadius: 999, border: `2px solid ${tokens.ink}`, background: tokens.cream, color: tokens.ink, padding: portrait ? '18px 28px' : '14px 32px', fontFamily: HOUSE_FONTS.data, fontSize: portrait ? 28 : 26, lineHeight: 1.25, overflowWrap: 'anywhere', transform: `scale(${state.scale})` }}>{state.text}</div>
  </div>
}
