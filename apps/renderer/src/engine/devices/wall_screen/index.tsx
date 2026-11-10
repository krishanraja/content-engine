import React from 'react'
import { Img } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { pageRect, wallState } from './state'

/** One continuous image plane. Its annotations share the exact same normalised coordinates. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = wallState(object, events, frame)
  if (!s.visible) return null
  const { params: p } = s
  const r = pageRect(p.wall, s.full)
  const footerSize = aspect === '9:16' ? 30 : 32
  return <div data-device="wall_screen" style={{ position: 'absolute', left: box.left, top: box.top,
    width: box.width, height: box.height, overflow: 'hidden', isolation: 'isolate' }}>
    <div data-footage-scrim="" style={{ position: 'absolute', inset: 0,
      backdropFilter: `blur(${6 * s.full}px)`, background: tokens.ink, opacity: 0.7 * s.full * s.light }} />
    <div data-page="" style={{ position: 'absolute', left: `${r.x * 100}%`, top: `${r.y * 100}%`,
      width: `${r.w * 100}%`, height: `${r.h * 100}%`, overflow: 'hidden',
      transform: `skewX(${r.skew}deg)`, transformOrigin: 'center', opacity: s.light,
      boxShadow: `0 0 ${24 * (1 - s.full)}px ${tokens.cream}` }}>
      <Img src={p.image} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {s.highlight > 0 && <div data-line="" style={{ position: 'absolute', left: `${p.line.x * 100}%`, top: `${p.line.y * 100}%`,
        width: `${p.line.w * 100}%`, height: `${p.line.h * 100}%`, overflow: 'hidden' }}>
        <div data-highlighter="" style={{ position: 'absolute', inset: 0, width: `${s.highlight * 100}%`, background: tokens.channel, opacity: 0.22 }} />
        {s.underline > 0 && <svg data-underline="" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d="M 2 87 Q 23 82 47 87 T 98 85" fill="none" stroke={tokens.mint} strokeWidth="5" pathLength="1"
            strokeDasharray="1" strokeDashoffset={1 - s.underline} />
        </svg>}
      </div>}
      {p.logo && <Img data-logo="" src={p.logo} style={{ position: 'absolute', right: '3%', top: '3%', width: '8%', height: '8%', objectFit: 'contain' }} />}
    </div>
    {s.full > 0 && <div data-source="" style={{ position: 'absolute', left: 0, right: 0, bottom: 0,
      padding: aspect === '9:16' ? '16px 24px' : '12px 32px', boxSizing: 'border-box',
      fontFamily: HOUSE_FONTS.data, fontSize: footerSize, lineHeight: 1.3, overflowWrap: 'anywhere',
      color: tokens.cream, background: tokens.ink, opacity: s.light }}>{p.source}</div>}
  </div>
}
