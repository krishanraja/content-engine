import React from 'react'
import { MonoLabel } from '../../../house/components'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { canvasRect, halftone, rotatedBounds } from '../../kit/overlay'
import type { DeviceProps } from '../types'
import { stampState } from './state'
export function Device({ object, events, tokens, frame }: DeviceProps) {
  const s = stampState(object, events, frame)
  if (!s.visible) return null
  const { x, y, w, h } = s.at
  rotatedBounds(x, y, w, h, s.tiltDeg)
  if (s.leader && (s.leader.to.x < 8 || s.leader.to.x > 1072 || s.leader.to.y < 8 || s.leader.to.y > 1912))
    throw new Error('Leader dot outside canvas')
  const leaderWidth = Math.max(w, textWidth('mono', (s.leader?.label ?? '').toUpperCase(), 30, 0.16))
  if (Math.max(textWidth('mono', s.main.toUpperCase(), 30, 0.18), textWidth('mono', (s.top ?? '').toUpperCase(), 30, 0.18)) > w - 42 || h < (s.top ? 90 : 60))
    throw new Error('Stamp copy does not fit at 30px')
  return <>
    {s.leader && <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: s.opacity }}>
      <line x1={x + w / 2} y1={y + h / 2} x2={s.leader.to.x} y2={s.leader.to.y} stroke={tokens.cream} strokeWidth={2} />
      <circle cx={s.leader.to.x} cy={s.leader.to.y} r={7} fill={tokens.ink} stroke={tokens.cream} strokeWidth={2} />
    </svg>}
    {s.leader?.label && <MonoLabel sizePx={30} style={{ ...canvasRect(x, y - 42, leaderWidth, 36), color: tokens.cream, opacity: s.opacity }}>{s.leader.label}</MonoLabel>}
    <div style={{ ...canvasRect(x, y, w, h), display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', fontFamily: HOUSE_FONTS.data, fontSize: 30, fontWeight: 700, lineHeight: 1,
      letterSpacing: '0.18em', color: s.kind === 'block' ? tokens.ink : tokens.cream,
      background: s.kind === 'block' ? tokens.channel : tokens.ink, ...(s.kind === 'block' ? halftone(tokens) : {}),
      border: `3px ${s.kind === 'dashed' ? 'dashed' : 'solid'} ${s.kind === 'block' ? tokens.ink : tokens.cream}`,
      transform: `rotate(${s.tiltDeg}deg) scale(${s.scale})`, opacity: s.visible ? 1 - s.exit : 0,
      gap: 8, whiteSpace: 'nowrap' }}>
      {s.top && <span>{s.top.toUpperCase()}</span>}<span>{s.main.toUpperCase()}</span>
    </div>
  </>
}
