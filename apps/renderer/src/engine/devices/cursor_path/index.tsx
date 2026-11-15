import React from 'react'
import { Img } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import { MOTION } from '../../clock'
import type { DeviceProps } from '../types'
import { cursorState } from './state'

export function Device(props: DeviceProps) {
  const s = cursorState(props)
  if (!s) return null
  const { box, aspect, tokens } = props
  // Independently authored slots, with contain preserving the entire capture.
  const slot = aspect === '9:16' ? { x: 0.055, y: 0.15, w: 0.74, h: 0.39 } : { x: 0.1, y: 0.16, w: 0.8, h: 0.66 }
  const k = Math.min(box.width * slot.w / s.params.screen.pixelWidth, (box.height * slot.h - 60) / s.params.screen.pixelHeight)
  const width = s.params.screen.pixelWidth * k, height = s.params.screen.pixelHeight * k
  const focus = s.params.targets.find(t => t.id === s.focus)
  const rect = (t: { x: number; y: number; w: number; h: number }): React.CSSProperties => ({ position: 'absolute', left: t.x * k, top: t.y * k, width: t.w * k, height: t.h * k })
  return <div data-device="cursor_path" style={{ position: 'absolute', left: box.left + box.width * slot.x,
    top: box.top + box.height * slot.y, width, opacity: s.enter * (1 - s.out),
    transform: `translateY(${(1 - s.enter + s.out) * MOTION.risePx}px)` }}>
    <div style={{ position: 'relative', width, height }}>
      <Img src={s.params.screen.src} style={{ width, height, display: 'block' }} />
      {focus && <svg data-proof-dim="" style={{ position: 'absolute', inset: 0, width, height }}>
        <path d={`M0 0H${width}V${height}H0Z M${focus.x * k} ${focus.y * k}v${focus.h * k}h${focus.w * k}v${-focus.h * k}Z`}
          fill={tokens.ink} fillRule="evenodd" opacity={0.6} />
      </svg>}
      {s.press && <div data-highlight={s.press.target} style={{ ...rect(s.params.targets.find(t => t.id === s.press!.target)!), outline: `3px solid ${tokens.mint}`, background: `color-mix(in srgb, ${tokens.mint} 15%, transparent)` }} />}
      {s.params.targets.map(t => s.texts[t.id] !== undefined && <div key={t.id} data-typed={t.id} style={{ ...rect(t), color: tokens.ink, fontFamily: HOUSE_FONTS.structure, fontSize: 32, overflow: 'hidden' }}>{s.texts[t.id]}</div>)}
      {s.ripple && <svg data-ripple="" style={{ position: 'absolute', left: s.ripple.point.x * k - 28, top: s.ripple.point.y * k - 28, width: 56, height: 56, overflow: 'visible' }}><circle cx="28" cy="28" r={28 * s.ripple.p} fill="none" stroke={tokens.mint} strokeWidth="3" opacity={1 - s.ripple.p} /></svg>}
      <svg data-cursor="" style={{ position: 'absolute', left: s.cursor.x * k, top: s.cursor.y * k, width: 44, height: 44, overflow: 'visible', transformOrigin: '0 0', transform: `scale(${s.scale})` }} viewBox="0 0 44 44">
        <path d="M2 2 L2 35 L12 27 L20 42 L27 38 L19 24 L32 23 Z" fill={tokens.cream} stroke={tokens.ink} strokeWidth="2" />
        {s.press?.send && <circle data-busy="" cx="17" cy="22" r="28" fill="none" stroke={tokens.mint} strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - s.busy} transform="rotate(-90 17 22)" />}
      </svg>
    </div>
    <div style={{ marginTop: 16, fontFamily: HOUSE_FONTS.data, fontSize: 24, color: tokens.cream }}>{s.params.label}</div>
  </div>
}
