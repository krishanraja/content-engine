import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { BACK, drift, EXIT, MOTION, motionProfile, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'
import { Mark } from './mark'

// Back-out peaks above 1.12 and returns exactly to 1 on the house enter duration.
// The orbit's own pop with no motion style; under a style, the style's overshoot (never past 6%).
const back = (t: number) => motionProfile() ? BACK(t) : 1 + 3 * (t - 1) ** 3 + 2 * (t - 1) ** 2

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
      return { visible: frame >= cue, p, opacity: p * (highlight && Number(highlight.toState) !== i ? 1 - 0.3 * lift : 1),
        highlight: highlight && Number(highlight.toState) === i ? lift : 0,
        scale: progress(frame - cue, MOTION.enterFrames, back) * (1 + (highlight && Number(highlight.toState) === i ? 0.15 * lift : 0)) }
    }),
    chips: Array.from({ length: chips }, (_, i) => {
      const cue = active.find(e => e.verb === 'chip' && Number(e.toState) === i)
      return cue ? progress(frame - cue.atFrame, MOTION.enterFrames) : 0
    }),
  }
}

// Wide rings use the full ellipse; tiles reserve room for the highlighted border.
export function orbitLayout(width: number, height: number, aspect: DeviceProps['aspect']) {
  const wide = width > 1.6 * height
  const unit = Math.min(width, height)
  const radius = unit * (aspect === '9:16' ? 0.36 : 0.35)
  const size = wide ? 120 : 160
  const clearance = size * 1.15 / 2 + 10
  return { wide, unit, radius, size, cx: width / 2,
    cy: wide ? height / 2 : height * (aspect === '9:16' ? 0.48 : 0.5),
    rx: wide ? width * 0.42 : radius, ry: wide ? height * 0.38 : radius,
    tileRx: Math.min(width * 0.42, width / 2 - clearance),
    tileRy: Math.min(height * 0.38, height / 2 - clearance) }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const params = ParamsSchema.parse(object.params)
  const s = orbitState({ object, events, frame }, params.logos.length, params.chips.length)
  if (!s) return null
  // Independent tall and wide staging; circles stay circular in either slot.
  const layout = aspect === '9:16' ? { radius: 0.36, cy: 0.48, font: 34 }
    : { radius: 0.35, cy: 0.5, font: 36 }
  const geometry = orbitLayout(box.width, box.height, aspect)
  const { wide, unit, radius, size } = geometry
  const mark = 96
  const filterId = `orbit-shadow-${object.obj.replace(/[^a-zA-Z0-9_-]/g, "_")}`
  const ringRadius = (i: number) => radius * (0.58 + 0.42 * (i + 1) / params.rings)
  return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
    <defs>
      <filter id={filterId} x="-60%" y="-60%" width="220%" height="240%">
        <feDropShadow dx={0} dy={10} stdDeviation={12} floodColor={tokens.ink} floodOpacity={0.16} />
      </filter>
      {s.ring < 1 && Array.from({ length: params.rings }, (_, i) => <mask key={i} id={`${filterId}-ring-${i}`}
        maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={-geometry.rx - 8} y={-geometry.ry - 8} width={geometry.rx * 2 + 16} height={geometry.ry * 2 + 16}
        style={{ maskType: 'alpha' }}>
        <ellipse rx={wide ? geometry.rx * ringRadius(i) / radius : ringRadius(i)} ry={wide ? geometry.ry * ringRadius(i) / radius : ringRadius(i)} fill="none" stroke={tokens.cream} strokeWidth={8}
          pathLength={1} strokeDasharray={1} strokeDashoffset={1 - s.ring} />
      </mask>)}
    </defs>
    <rect width={box.width} height={box.height} fill={tokens.cream} />
    <g data-centre-slot={params.centre} transform={`translate(${geometry.cx} ${geometry.cy})`} opacity={1 - s.out}>
      {Array.from({ length: params.rings }, (_, i) => <ellipse key={i} rx={wide ? geometry.rx * ringRadius(i) / radius : ringRadius(i)} ry={wide ? geometry.ry * ringRadius(i) / radius : ringRadius(i)} fill="none"
        data-ring={i} stroke={tokens.inkSoft} strokeWidth={6} opacity={0.65} pathLength={1}
        strokeDashoffset={-s.angle / (Math.PI * 2)} strokeDasharray={i === 0 ? "0.018 0.018" : "1"} mask={s.ring < 1 ? `url(#${filterId}-ring-${i})` : undefined} />)}
      {params.logos.map((logo, i) => {
        const l = s.logos[i]!
        if (!l.visible) return null
        const angle = i * Math.PI * 2 / params.logos.length - Math.PI / 2 + s.angle
        const r = ringRadius(i % params.rings)
        const distance = r + (1 - l.p) * unit * 0.45 + s.out * unit
        const x = Math.cos(angle) * (wide ? geometry.tileRx : distance)
        const y = Math.sin(angle) * (wide ? geometry.tileRy : distance)
        const scale = wide ? Math.min(l.scale, 1 + 0.15 * l.highlight) : l.scale
        return <g key={i} data-logo={i} opacity={l.opacity}>
          {[3, 2, 1].map(copy => !wide && l.p > 0 && l.p < 1 && <g key={copy} data-trail={copy}
            opacity={(1 - l.p) * (4 - copy) * 0.12}
            transform={`translate(${x + Math.cos(angle) * copy * 26} ${y + Math.sin(angle) * copy * 26}) scale(${scale})`}>
            <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={28} fill={tokens.cream} />
            <Mark id={logo.id} size={mark} />
          </g>)}
          <g transform={`translate(${x} ${y}) scale(${scale})`}>
            <rect data-tile={i} x={-size / 2} y={-size / 2} width={size} height={size} rx={28}
              fill={tokens.cream} filter={`url(#${filterId})`} />
            {l.highlight > 0 && <rect data-highlight={i} x={-size / 2 - 7} y={-size / 2 - 7}
              width={size + 14} height={size + 14} rx={35} fill="none" stroke={tokens.mint} strokeWidth={5} opacity={l.highlight} />}
            <Mark id={logo.id} size={mark} />
          </g>
        </g>
      })}
      {params.chips.map((label, i) => {
        const p = s.chips[i]!
        if (!p) return null
        const angle = (i + 0.5) * Math.PI * 2 / params.chips.length + s.angle
        const r = radius + (1 - p) * unit * 0.5 + s.out * unit
        const width = Math.min(box.width, label.length * layout.font * 0.62 + 64)
        const chipX = Math.cos(angle) * (wide ? Math.min(geometry.rx, (box.width - width) / 2) : r)
        const chipY = Math.sin(angle) * (wide ? Math.min(geometry.ry, box.height / 2 - 28) : r)
        return <g key={i} opacity={p} transform={`translate(${chipX} ${chipY})`}>
          <rect x={-width / 2} y={-26} width={width} height={52} rx={26} fill={tokens.cream} filter={`url(#${filterId})`} />
          <circle cx={-width / 2 + 22} r={5} fill={tokens.mint} />
          <text x={10} textAnchor="middle" dominantBaseline="central" fontFamily={HOUSE_FONTS.structure} fontSize={layout.font} fill={tokens.ink}>{label}</text>
        </g>
      })}
    </g>
  </svg>
}
