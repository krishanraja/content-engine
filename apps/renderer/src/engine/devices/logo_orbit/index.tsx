import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { drift, EXIT, MOTION, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema, resolveLogo } from './schema'

export function orbitState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>, count: number, chips: number) {
  const { fired } = stateAt(events, object.obj, frame)
  for (const e of fired) {
    const limit = e.verb === 'chip' ? chips : count
    if (['add', 'chip', 'highlight'].includes(e.verb) &&
      (!/^\d+$/.test(e.toState) || Number(e.toState) >= limit))
      throw new Error(`logo_orbit ${e.verb} needs a zero-based index`)
  }
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  const active = fired.filter(e => !enter || e.atFrame >= enter.atFrame)
  const start = enter ?? active.find(e => e.verb === 'add')
  if (!start) return null
  const exit = active.filter(e => e.verb === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out >= 1) return null
  const highlight = active.filter(e => e.verb === 'highlight').at(-1)
  const lift = highlight ? progress(frame - highlight.atFrame, MOTION.slapFrames) : 0
  return {
    out, rings: progress(frame - start.atFrame, MOTION.enterFrames),
    logos: Array.from({ length: count }, (_, i) => {
      const add = active.find(e => e.verb === 'add' && Number(e.toState) === i)
      const cues = [enter ? enter.atFrame + i * MOTION.staggerFrames : Infinity, add?.atFrame ?? Infinity]
      const cue = Math.min(...cues)
      return { visible: frame >= cue, arrival: progress(frame - cue, MOTION.enterFrames),
        scale: 1 + (Number(highlight?.toState) === i ? 0.1 * lift : 0),
        opacity: highlight && Number(highlight.toState) !== i ? 1 - 0.6 * lift : 1 }
    }),
    chips: Array.from({ length: chips }, (_, i) => {
      const cue = active.find(e => e.verb === 'chip' && Number(e.toState) === i)
      return { visible: !!cue, arrival: cue ? progress(frame - cue.atFrame, MOTION.enterFrames) : 0 }
    }),
  }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const p = ParamsSchema.parse(object.params)
  const s = orbitState({ object, events, frame }, p.logos.length, p.chips?.length ?? 0)
  if (!s) return null
  // Tall slots keep the hero above the caption band; wide slots use the central field.
  const layout = aspect === '9:16'
    ? { x: box.width * 0.5, y: box.height * 0.34, radius: Math.min(box.width * 0.34, box.height * 0.2), mark: 94, font: 30 }
    : { x: box.width * 0.5, y: box.height * 0.5, radius: Math.min(box.width * 0.32, box.height * 0.34), mark: 104, font: 32 }
  const turn = drift(frame, object.fromFrame, object.toFrame) * Math.PI * 2
  const radius = (i: number) => layout.radius * (0.6 + 0.4 * (i + 1) / p.rings)
  const point = (angle: number, r: number) => ({ x: layout.x + Math.cos(angle) * r, y: layout.y + Math.sin(angle) * r })
  return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    data-centre-slot={p.centre} style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
    <rect width={box.width} height={box.height} fill={tokens.cream} opacity={1 - s.out} />
    <g opacity={1 - s.out}>
      {Array.from({ length: p.rings }, (_, i) => <circle key={i} cx={layout.x} cy={layout.y}
        r={radius(i) * (1 + s.out)} fill="none" stroke={tokens.inkSoft} strokeWidth={2} opacity={0.35}
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - s.rings} />)}
      {p.logos.map((logo, i) => {
        const l = s.logos[i]!
        if (!l.visible) return null
        const angle = -Math.PI / 2 + i * Math.PI * 2 / p.logos.length + turn + s.out * Math.PI
        const r = radius(i % p.rings) * (1 + 0.75 * (1 - l.arrival) + 2 * s.out)
        const pos = point(angle, r)
        const trail = point(angle - 0.3 * (1 - l.arrival), r + layout.mark * (1 - l.arrival))
        return <g key={i} data-logo-index={i} opacity={l.opacity}
          transform={`translate(${pos.x} ${pos.y}) scale(${l.scale})`}>
          <path d={`M ${trail.x - pos.x} ${trail.y - pos.y} Q ${-layout.mark * (1 - l.arrival)} 0 0 0`}
            fill="none" stroke={tokens.inkSoft} strokeWidth={3} strokeLinecap="round" opacity={1 - l.arrival} />
          <image href={resolveLogo(logo.id)} x={-layout.mark / 2} y={-layout.mark / 2}
            width={layout.mark} height={layout.mark} preserveAspectRatio="xMidYMid meet" />
        </g>
      })}
      {p.chips?.map((label, i) => {
        const c = s.chips[i]!
        if (!c.visible) return null
        const angle = Math.PI / 6 + i * Math.PI * 2 / 6 + turn + s.out * Math.PI
        const pos = point(angle, layout.radius * (1 + 0.7 * (1 - c.arrival) + 2 * s.out))
        const w = label.length * layout.font * 0.62 + 36
        return <g key={i} data-chip-index={i} opacity={c.arrival} transform={`translate(${pos.x} ${pos.y})`}>
          <rect x={-w / 2 + 3} y={-19} width={w} height={48} rx={24} fill={tokens.ink} opacity={0.12} />
          <rect x={-w / 2} y={-24} width={w} height={48} rx={24} fill={tokens.cream} stroke={tokens.inkSoft} strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fontFamily={HOUSE_FONTS.structure}
            fontSize={layout.font} fill={tokens.ink}>{label}</text>
        </g>
      })}
    </g>
  </svg>
}
