import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { drift, EXIT, MOTION, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema, resolveLogo } from './schema'

export function orbitState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>, count: number, chips: number) {
  const fired = stateAt(events, object.obj, frame).fired
  // An add can start an orbit without revealing the other marks.
  const start = fired.filter(e => e.verb === 'enter').at(-1) ?? fired.find(e => e.verb === 'add')
  if (!start) return null
  const active = fired.filter(e => e.atFrame >= start.atFrame)
  for (const e of active) {
    if (['add', 'highlight', 'chip'].includes(e.verb) &&
      (!/^\d+$/.test(e.toState) || Number(e.toState) >= (e.verb === 'chip' ? chips : count))) {
      throw new Error(`logo_orbit ${e.verb} needs a zero-based index`)
    }
  }
  const exit = active.filter(e => e.verb === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out >= 1) return null
  const highlight = active.filter(e => e.verb === 'highlight').at(-1)
  const lift = highlight ? progress(frame - highlight.atFrame, MOTION.slapFrames) : 0
  return { out, ring: progress(frame - start.atFrame, MOTION.enterFrames),
    angle: drift(frame, start.atFrame, object.toFrame, 12) * Math.PI * 2 + out * Math.PI,
    logos: Array.from({ length: count }, (_, i) => {
      const add = active.find(e => e.verb === 'add' && Number(e.toState) === i)
      const cue = Math.min(start.verb === 'enter' ? start.atFrame + i * MOTION.staggerFrames : Infinity, add?.atFrame ?? Infinity)
      const p = progress(frame - cue, MOTION.enterFrames)
      return { visible: frame >= cue, p, opacity: p * (highlight && Number(highlight.toState) !== i ? 1 - 0.6 * lift : 1),
        scale: 1 + (highlight && Number(highlight.toState) === i ? 0.1 * lift : 0) }
    }),
    chips: Array.from({ length: chips }, (_, i) => {
      const cue = active.find(e => e.verb === 'chip' && Number(e.toState) === i)
      return cue ? progress(frame - cue.atFrame, MOTION.enterFrames) : 0
    }),
  }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const params = ParamsSchema.parse(object.params)
  const s = orbitState({ object, events, frame }, params.logos.length, params.chips.length)
  if (!s) return null
  // Independent tall and wide staging; circles stay circular in either slot.
  const layout = aspect === '9:16' ? { radius: 0.36, cy: 0.48, mark: 0.105, font: 32 }
    : { radius: 0.35, cy: 0.5, mark: 0.11, font: 34 }
  const unit = Math.min(box.width, box.height)
  const radius = unit * layout.radius
  const size = unit * layout.mark
  const ringRadius = (i: number) => radius * (0.58 + 0.42 * (i + 1) / params.rings)
  return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
    <rect width={box.width} height={box.height} fill={tokens.cream} />
    <g data-centre-slot={params.centre} transform={`translate(${box.width / 2} ${box.height * layout.cy})`} opacity={1 - s.out}>
      {Array.from({ length: params.rings }, (_, i) => <circle key={i} r={ringRadius(i)} fill="none"
        stroke={tokens.inkSoft} strokeWidth={2} opacity={0.3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - s.ring} />)}
      {params.logos.map((logo, i) => {
        const l = s.logos[i]!
        if (!l.visible) return null
        const angle = i * Math.PI * 2 / params.logos.length - Math.PI / 2 + s.angle
        const r = ringRadius(i % params.rings)
        const distance = r + (1 - l.p) * unit * 0.45 + s.out * unit
        const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance
        return <g key={i} data-logo={i} opacity={l.opacity}>
          {l.p < 1 && <path d={`M ${Math.cos(angle) * (distance + size)} ${Math.sin(angle) * (distance + size)} L ${x} ${y}`}
            fill="none" stroke={tokens.inkSoft} strokeWidth={3} strokeLinecap="round" opacity={1 - l.p} />}
          <g transform={`translate(${x} ${y}) scale(${l.scale})`}>
            <ellipse cy={size * 0.53} rx={size * 0.4} ry={size * 0.06} fill={tokens.ink} opacity={0.08} />
            <image href={resolveLogo(logo.id)} x={-size / 2} y={-size / 2} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
          </g>
        </g>
      })}
      {params.chips.map((label, i) => {
        const p = s.chips[i]!
        if (!p) return null
        const angle = (i + 0.5) * Math.PI * 2 / params.chips.length + s.angle
        const r = radius + (1 - p) * unit * 0.5 + s.out * unit
        const width = label.length * layout.font * 0.62 + 32
        return <g key={i} opacity={p} transform={`translate(${Math.cos(angle) * r} ${Math.sin(angle) * r})`}>
          <rect x={-width / 2} y={-26} width={width} height={52} rx={26} fill={tokens.cream} stroke={tokens.inkSoft} />
          <text textAnchor="middle" dominantBaseline="central" fontFamily={HOUSE_FONTS.structure} fontSize={layout.font} fill={tokens.ink}>{label}</text>
        </g>
      })}
    </g>
  </svg>
}
