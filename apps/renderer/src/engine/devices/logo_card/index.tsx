import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { EXIT, MOTION, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { Mark } from '../logo_orbit/mark'
import { ParamsSchema, resolveLogo } from './schema'

// Monday's E.back, with its 1.9 overshoot. The card pins the house duration.
const back = (t: number) => 1 + 2.9 * Math.pow(t - 1, 3) + 1.9 * Math.pow(t - 1, 2)
const linear = (t: number) => t
export function logoCardState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>, count: number) {
  const s = stateAt(events, object.obj, frame)
  const enter = s.fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const active = s.fired.filter(e => e.atFrame >= enter.atFrame)
  const exit = active.filter(e => e.verb === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out >= 1) return null
  const highlight = active.filter(e => e.verb === 'highlight').at(-1)
  const chosen = highlight ? Number(highlight.toState) : null
  if (highlight && (!/^\d+$/.test(highlight.toState) || !Number.isInteger(chosen) || chosen! >= count)) {
    throw new Error('logo_card highlight needs a zero-based logo index')
  }
  const lift = highlight ? progress(frame - highlight.atFrame, MOTION.slapFrames) : 0
  return {
    out,
    logos: Array.from({ length: count }, (_, i) => {
      const age = frame - enter.atFrame - i * MOTION.staggerFrames
      const p = progress(age, MOTION.enterFrames, back)
      const fade = progress(age, MOTION.enterFrames, linear)
      return { visible: age >= 0, scale: (0.35 + 0.65 * p) * (1 + (chosen === i ? 0.08 * lift : 0)),
        rotation: age >= MOTION.enterFrames ? 0 : -6 * (1 - p),
        opacity: fade * (chosen !== null && chosen !== i ? 1 - 0.6 * lift : 1) }
    }),
    labelProgress: progress(frame - enter.atFrame - (count - 1) * MOTION.staggerFrames - MOTION.enterFrames, MOTION.enterFrames, linear),
  }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const params = ParamsSchema.parse(object.params)
  const s = logoCardState({ object, events, frame }, params.logos.length)
  if (!s) return null
  if (params.tiles) {
    const rows = Math.ceil(params.logos.length / 3)
    // Preserve the proof's 1080-wide stage proportions; constrain short slots too.
    const unit = Math.min(box.width / 1080, box.height / (rows * 240 + (rows - 1) * 60))
    const side = 240 * unit
    const gap = 60 * unit
    const height = rows * side + (rows - 1) * gap
    return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
      style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
      <g transform={`translate(${-box.width * s.out} 0)`}>
        {params.logos.map((logo, i) => {
          const l = s.logos[i]!
          if (!l.visible) return null
          const row = Math.floor(i / 3)
          const columns = Math.min(3, params.logos.length - row * 3)
          const x = (box.width - (columns * side + (columns - 1) * gap)) / 2 + (i - row * 3) * (side + gap) + side / 2
          const y = (box.height - height) / 2 + row * (side + gap) + side / 2
          return <g key={i} data-tile-side={side} data-row={row} opacity={l.opacity}
            transform={`translate(${x} ${y}) scale(${l.scale})`}>
            <rect x={-side / 2} y={-side / 2} width={side} height={side} rx={24 * unit} fill="white" />
            <Mark id={logo.id} size={140 * unit} />
          </g>
        })}
        {params.label && <text x={box.width / 2} y={(box.height + height) / 2 + 48 * unit}
          textAnchor="middle" fill={tokens.cream} fontFamily={HOUSE_FONTS.data} fontSize={32 * unit} letterSpacing="0.14em">
          {params.label.slice(0, Math.floor(params.label.length * s.labelProgress))}
        </text>}
      </g>
    </svg>
  }
  // Independently authored slot proportions, with identical equal-width cells.
  const layout = aspect === '9:16'
    ? { inset: 0.05, rowY: 0.23, rowH: 0.42, labelY: 0.77, font: 32 }
    : { inset: 0.08, rowY: 0.18, rowH: 0.48, labelY: 0.79, font: 36 }
  const rowW = box.width * (1 - 2 * layout.inset)
  const cell = rowW / params.logos.length
  const label = params.label?.slice(0, Math.floor((params.label?.length ?? 0) * s.labelProgress))
  return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
    <g transform={`translate(${-box.width * s.out} 0)`}>
      {params.logos.map((logo, i) => {
        const l = s.logos[i]!
        if (!l.visible) return null
        const x = box.width * layout.inset + cell * (i + 0.5)
        const y = box.height * (layout.rowY + layout.rowH / 2)
        return <g key={i} data-cell-width={cell} opacity={l.opacity}
          transform={`translate(${x} ${y}) rotate(${l.rotation}) scale(${l.scale})`}>
          <image href={resolveLogo(logo.id)} x={-cell * 0.4} y={-box.height * layout.rowH / 2}
            width={cell * 0.8} height={box.height * layout.rowH} preserveAspectRatio="xMidYMid meet" />
        </g>
      })}
      {label && <text x={box.width / 2} y={box.height * layout.labelY} textAnchor="middle"
        fill={tokens.cream} fontFamily={HOUSE_FONTS.data} fontSize={layout.font} letterSpacing="0.14em">{label}</text>}
    </g>
  </svg>
}
