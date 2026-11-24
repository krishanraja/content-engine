import React, { useMemo } from 'react'
import '@fontsource/ibm-plex-mono/700.css'
import { MonoLabel } from '../../../house/components'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { ACTIVE_CANVAS } from '../../kit/lock'
import { canvasRect, halftone, rotatedBounds } from '../../kit/overlay'
import { jitter, seedOf } from '../../kit/overlays'
import type { DeviceProps } from '../types'
import { stampState } from './state'

function pressedInkMask(w: number, h: number, seed: number) {
  let step = 0
  const sample = () => jitter(seed, step++)
  const point = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`
  const radius = 1.6
  const opacity = 0.85
  // A speck is a round-ended stroke, 1–4 px long before the end caps.
  // Budget for overlapping specks so the mean alpha loss is about 12%.
  const averageArea = Math.PI * radius ** 2 + 2 * radius * 2.5
  const count = Math.ceil(-Math.log(0.88) * w * h / (averageArea * opacity))
  const specks = Array.from({ length: count }, () => {
    const x = sample() * w, y = sample() * h
    const angle = sample() * 2 * Math.PI
    const length = 1 + 3 * sample()
    return `M${point(x, y)}l${point(Math.cos(angle) * length, Math.sin(angle) * length)}`
  }).join('')

  // Two faint scuffs per side, between the rounded corners of the outer rim.
  const edge = [0, w].map(x => [0, 1].map(() => {
    const y = h * (0.16 + 0.68 * sample())
    return `M${point(x, y)}h${x === 0 ? 8 : -8}`
  }).join('')).join('') + [0, h].map(y => [0, 1].map(() => {
    const x = w * (0.16 + 0.68 * sample())
    return `M${point(x, y)}v${y === 0 ? 8 : -8}`
  }).join('')).join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">
        <feGaussianBlur stdDeviation="1.4"/>
      </filter>
      <mask id="ink" mask-type="luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="white"/>
        <path d="${specks}" fill="none" stroke="black" stroke-width="${2 * radius}" stroke-linecap="round" stroke-opacity="${opacity}"/>
        <path d="${edge}" fill="none" stroke="black" stroke-width="9" stroke-linecap="round" stroke-opacity=".65" filter="url(#soft)"/>
      </mask>
    </defs>
    <rect width="${w}" height="${h}" fill="white" mask="url(#ink)"/>
  </svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function HeroStamp({ stamp, tokens, id }: { stamp: ReturnType<typeof stampState>; tokens: DeviceProps['tokens']; id: string }) {
  const { x, y, w, h } = stamp.at
  const maskImage = useMemo(() => pressedInkMask(w, h, seedOf(id)), [w, h, id])
  const paint = tokens[stamp.paint]
  const main = stamp.main.trim().replace(/\s+/g, ' ').toUpperCase()
  const top = stamp.top?.trim().toUpperCase()
  const tracking = 0.06
  const topTracking = 0.12
  const topSize = 44
  const gap = 20
  const copyWidth = Math.min(w * 0.8, w - 52)
  const mainSize = Math.min(copyWidth / textWidth('archivoHeavy', main, 1, tracking), h - 52 - (top ? topSize + gap : 0))
  if (mainSize < 30 || (top && textWidth('mono', top, topSize, topTracking) > copyWidth))
    throw new Error('Hero stamp copy does not fit')

  return <div style={{ ...canvasRect(x, y, w, h), color: paint,
    transform: `rotate(${stamp.tiltDeg}deg) scale(${stamp.scale})`, opacity: stamp.opacity,
    filter: `drop-shadow(0 3px 4px color-mix(in srgb, ${tokens.ink} 30%, transparent))` }}>
    <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box',
      border: `12px solid ${paint}`, borderRadius: 32,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap,
      lineHeight: 1, whiteSpace: 'nowrap',
      maskImage, maskSize: '100% 100%', maskRepeat: 'no-repeat' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 6, border: `2px solid ${paint}`, borderRadius: 14 }} />
      {top && <span style={{ fontFamily: `"IBM Plex Mono", ${HOUSE_FONTS.data}`, fontSize: topSize, fontWeight: 700, letterSpacing: `${topTracking}em` }}>{top}</span>}
      <span style={{ fontFamily: HOUSE_FONTS.structure, fontSize: mainSize, fontWeight: 900,
        fontStretch: '112%', letterSpacing: `${tracking}em`, fontKerning: 'none' }}>{main}</span>
    </div>
  </div>
}

export function Device({ object, events, tokens, frame }: DeviceProps) {
  const s = stampState(object, events, frame)
  if (!s.visible) return null
  const { x, y, w, h } = s.at
  rotatedBounds(x, y, w, h, s.tiltDeg)
  if (s.leader && (s.leader.to.x < 8 || s.leader.to.x > ACTIVE_CANVAS.w - 8 || s.leader.to.y < 8 || s.leader.to.y > ACTIVE_CANVAS.h - 8))
    throw new Error('Leader dot outside canvas')
  const leaderWidth = Math.max(w, textWidth('mono', (s.leader?.label ?? '').toUpperCase(), 30, 0.16))
  const hero = s.size === 'hero'
  const leaderPaint = hero ? tokens[s.paint] : tokens.cream
  if (!hero && (Math.max(textWidth('mono', s.main.toUpperCase(), 30, 0.18), textWidth('mono', (s.top ?? '').toUpperCase(), 30, 0.18)) > w - 42 || h < (s.top ? 90 : 60)))
    throw new Error('Stamp copy does not fit at 30px')
  return <>
    {s.leader && <svg width={ACTIVE_CANVAS.w} height={ACTIVE_CANVAS.h} style={{ position: 'absolute', left: 0, top: 0, opacity: s.opacity }}>
      <line x1={x + w / 2} y1={y + h / 2} x2={s.leader.to.x} y2={s.leader.to.y} stroke={leaderPaint} strokeWidth={2} />
      <circle cx={s.leader.to.x} cy={s.leader.to.y} r={7} fill={tokens.ink} stroke={leaderPaint} strokeWidth={2} />
    </svg>}
    {s.leader?.label && <MonoLabel sizePx={30} style={{ ...canvasRect(x, y - 42, leaderWidth, 36), color: leaderPaint, opacity: s.opacity }}>{s.leader.label}</MonoLabel>}
    {hero ? <HeroStamp stamp={s} tokens={tokens} id={object.obj} /> : <div style={{ ...canvasRect(x, y, w, h), display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', fontFamily: HOUSE_FONTS.data, fontSize: 30, fontWeight: 700, lineHeight: 1,
      letterSpacing: '0.18em', color: s.kind === 'block' ? tokens.ink : tokens.cream,
      background: s.kind === 'block' ? tokens[s.paint] : tokens.ink, ...(s.kind === 'block' ? halftone(tokens, tokens[s.paint]) : {}),
      border: `3px ${s.kind === 'dashed' ? 'dashed' : 'solid'} ${s.kind === 'block' ? tokens.ink : tokens.cream}`,
      transform: `rotate(${s.tiltDeg}deg) scale(${s.scale})`, opacity: s.visible ? 1 - s.exit : 0,
      gap: 8, whiteSpace: 'nowrap' }}>
      {s.top && <span>{s.top.toUpperCase()}</span>}<span>{s.main.toUpperCase()}</span>
    </div>}
  </>
}
