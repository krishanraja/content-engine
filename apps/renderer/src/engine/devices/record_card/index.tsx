import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { recordState } from './state'

/** The ledger keeps every field until an explicit stamp replaces that key. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = recordState(object, events, frame)
  if (!state.visible) return null
  const portrait = aspect === '9:16'
  return <div style={{ position: 'absolute', ...box, boxSizing: 'border-box', background: tokens.cream, color: tokens.ink, border: `2px solid ${tokens.ink}`, boxShadow: `8px 8px 0 ${tokens.inkDeep}`, padding: portrait ? 28 : 24, opacity: state.drop, transform: `translateY(${-64 * (1 - state.drop)}px)`, display: 'grid', alignContent: 'center', gap: portrait ? 22 : 16 }}>
    {state.fields.map((field) => <div key={field.key} style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr' : 'minmax(0, 1fr) minmax(0, 2fr)', gap: portrait ? 8 : 20, alignItems: 'baseline', borderBottom: `1px solid ${tokens.inkSoft}`, paddingBottom: portrait ? 16 : 12 }}>
      <div style={{ fontFamily: HOUSE_FONTS.data, fontSize: portrait ? 24 : 22, overflowWrap: 'anywhere' }}>{field.label}</div>
      <div style={{ fontFamily: HOUSE_FONTS.structure, fontWeight: 800, fontSize: portrait ? 44 : 40, lineHeight: 1.1, overflowWrap: 'anywhere', transformOrigin: 'left center', transform: `scale(${field.scale})` }}>{field.value}</div>
    </div>)}
  </div>
}
