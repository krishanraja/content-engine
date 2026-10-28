import React from 'react'
import type { EngineTokens } from '../props'
import { HOUSE_FONTS, HOUSE_HALFTONE } from '../../house/geometry'
import plates from './passport-plates.json'

/** Simplified reference illustrations. Production must use a licensed open flag set.
 * National colours are embedded in the source SVG plates and are never recoloured. */
export function PrintedFlag({ kind, tokens, width = 214, height = 113 }: {
  kind: 'usa' | 'china' | 'unknown'; tokens: EngineTokens; width?: number; height?: number
}) {
  return <div data-flag={kind} style={{ position: 'relative', width, height, mixBlendMode: 'multiply',
    filter: 'saturate(.88) contrast(.96)', color: tokens.ink }}>
    {kind === 'unknown'
      ? <svg width={width} height={height} viewBox="0 0 214 113" aria-label="Unknown country">
        <rect x="2" y="2" width="210" height="109" fill="none" stroke={tokens.ink} strokeWidth="3" strokeDasharray="10 8" />
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 20} 4 l-40 105`} stroke={tokens.ink} opacity=".15" />)}
        <text x="107" y="80" textAnchor="middle" style={{ fontFamily: HOUSE_FONTS.data, fontSize: 64, fontWeight: 700 }} fill={tokens.ink}>?</text>
      </svg>
      : <img src={plates[kind]} alt={`${kind.toUpperCase()} simplified illustration`} style={{ display: 'block', width: '100%', height: '100%' }} />}
    <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: HOUSE_HALFTONE.image, backgroundSize: '7px 7px', pointerEvents: 'none' }} />
  </div>
}
