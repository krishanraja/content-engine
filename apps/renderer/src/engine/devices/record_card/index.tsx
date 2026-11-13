import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { wrapWords } from '../../../house/metrics'
import { isRegion } from '../../kit/layout'
import { RegionFit, bestNatural } from '../../kit/regionFit'
import { font } from '../../kit/typeRole'
import type { Box, DeviceProps } from '../types'
import { recordState } from './state'

/** The ledger keeps every field until an explicit stamp replaces that key. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = recordState(object, events, frame)
  if (!state.visible) return null
  const portrait = aspect === '9:16'
  // In a layout region the ledger lays out at the natural width that grows most, then fills and centres in the region.
  if (isRegion(box)) {
    const face = font('structure') === HOUSE_FONTS.data ? 'mono' : 'archivo600'
    const pad = portrait ? 28 : 24, gap = portrait ? 22 : 16, valueSize = portrait ? 44 : 40
    const natural = bestNatural(box, [480, 560, 640, 720], width => {
      const inner = width - 2 * pad - 4
      const rows = state.fields.map(field => {
        const value = wrapWords(face, field.value, valueSize, portrait ? inner : (inner - 20) * 2 / 3).length * valueSize * 1.1
        return (portrait ? 24 * 1.2 + 8 + value + 16 : Math.max(22 * 1.2, value) + 12) + 1
      })
      return 2 * pad + 4 + rows.reduce((a, b) => a + b, 0) + gap * Math.max(0, rows.length - 1)
    })
    return <RegionFit natural={natural} box={box}>{ledger({ left: 0, top: 0, width: natural.width, height: natural.height })}</RegionFit>
  }
  return ledger(box)
  function ledger(box: Box) {
    return <div style={{ position: 'absolute', ...box, boxSizing: 'border-box', background: tokens.cream, color: tokens.ink, border: `2px solid ${tokens.ink}`, boxShadow: `8px 8px 0 ${tokens.inkDeep}`, padding: portrait ? 28 : 24, opacity: state.drop, transform: `translateY(${-64 * (1 - state.drop)}px)`, display: 'grid', alignContent: 'center', gap: portrait ? 22 : 16 }}>
      {state.fields.map((field) => <div key={field.key} style={{ display: 'grid', gridTemplateColumns: portrait ? '1fr' : 'minmax(0, 1fr) minmax(0, 2fr)', gap: portrait ? 8 : 20, alignItems: 'baseline', borderBottom: `1px solid ${tokens.inkSoft}`, paddingBottom: portrait ? 16 : 12 }}>
        <div style={{ fontFamily: font('data'), fontSize: portrait ? 24 : 22, overflowWrap: 'anywhere' }}>{field.label}</div>
        <div style={{ fontFamily: font('structure'), fontWeight: 800, fontSize: portrait ? 44 : 40, lineHeight: 1.1, overflowWrap: 'anywhere', transformOrigin: 'left center', transform: `scale(${field.scale})` }}>{field.value}</div>
      </div>)}
    </div>
  }
}
