import React from 'react'
import { HOUSE_GRAIN_IMAGE, HOUSE_GRAIN_OPACITY } from '../../house/geometry'
import type { EngineTokens } from '../props'
import plates from './passport-plates.json'

export const PASSPORT = { width: 900, height: 1700 } as const

/** A neutral physical page. Inline plate URLs survive compile staging and offline rendering. */
export function PassportPaper({ spine, tokens, children, shimmer = 0 }: {
  spine: 'left' | 'right'; tokens: EngineTokens; children: React.ReactNode; shimmer?: number
}) {
  const right = spine === 'right'
  return <>
    <div data-part="cover" style={{ position: 'absolute', left: right ? -30 : -8, right: right ? -8 : -30,
      top: -14, bottom: -60, borderRadius: right ? '64px 12px 0 0' : '12px 64px 0 0',
      background: tokens.inkSoft, boxShadow: `0 46px 80px ${tokens.inkDeep}` }} />
    {[ [22, 9], [15, 6], [8, 3] ].map(([x, y], index) => <div key={index} data-part="leaf" style={{
      position: 'absolute', inset: 0, background: tokens.cream, border: `1px solid ${tokens.inkSoft}`,
      borderRadius: right ? '52px 8px 0 0' : '8px 52px 0 0',
      transform: `translate(${right ? -x! : x}px,${y}px)`, opacity: 0.7 + index * 0.1 }} />)}
    <div data-part="sheet" style={{ position: 'absolute', inset: 0, overflow: 'hidden',
      borderRadius: right ? '48px 8px 0 0' : '8px 48px 0 0', background: tokens.cream }}>
      <img aria-hidden src={plates.paper} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.48 }} />
      <img aria-hidden src={plates.guilloche} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.26 }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.15,
        background: `linear-gradient(${right ? 270 : 90}deg,${tokens.ink} 0%,transparent 9%,transparent 91%,${tokens.cream} 100%)` }} />
      <svg data-part="stitch" width="34" height="1700" style={{ position: 'absolute', top: 0, [spine]: 12 }}>
        <path d="M17 0 V1700" stroke={tokens.ink} strokeWidth="10" strokeDasharray="18 12" strokeDashoffset={shimmer} />
        <path d="M17 0 V1700" stroke={tokens.mint} strokeWidth="4" strokeDasharray="18 12" strokeDashoffset={shimmer} />
      </svg>
      {children}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: HOUSE_GRAIN_IMAGE,
        opacity: HOUSE_GRAIN_OPACITY, pointerEvents: 'none', mixBlendMode: 'multiply' }} />
    </div>
  </>
}
