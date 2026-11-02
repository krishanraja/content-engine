import React from 'react'
import { EXIT, MOTION, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { MoodSchema, ParamsSchema, PositionSchema } from './schema'

const linear = (t: number) => t
const pulse = (p: number) => Math.sin(Math.PI * p)

export function buddyState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const exit = active.filter(e => e.verb === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out === 1) return null
  // Resolve each interrupted move at the next cue, rather than snapping to its target.
  let origin = { x: 0.5, y: 0.5 }
  let target = origin
  let started = enter.atFrame
  for (const e of active.filter(e => e.verb === 'move')) {
    const p = progress(e.atFrame - started, MOTION.slideFrames)
    origin = { x: origin.x + (target.x - origin.x) * p, y: origin.y + (target.y - origin.y) * p }
    target = PositionSchema.parse(JSON.parse(e.toState))
    started = e.atFrame
  }
  const glide = progress(frame - started, MOTION.slideFrames)
  const action = active.filter(e => ['bounce', 'sulk', 'wave'].includes(e.verb)).at(-1)
  const moodEvent = active.filter(e => e.verb === 'sulk').at(-1)
  const mood = moodEvent ? MoodSchema.parse(moodEvent.toState) : params.mood
  const p = action ? progress(frame - action.atFrame, MOTION.enterFrames, linear) : 1
  const hop = action?.verb === 'bounce' ? (p < 0.5 ? pulse(p * 2) : 0.7 * pulse((p - 0.5) * 2)) : 0
  const recoil = action?.verb === 'sulk' ? pulse(p) : 0
  const wave = action?.verb === 'wave' ? pulse(p) : 0
  const arrival = progress(frame - enter.atFrame, MOTION.enterFrames, linear)
  return { mood, prop: params.prop, out, arrival, hop, recoil, wave,
    x: origin.x + (target.x - origin.x) * glide,
    y: origin.y + (target.y - origin.y) * glide,
    slump: mood === 'sulk' ? 1 : 0,
    stretch: Math.sin(arrival * Math.PI * 2) * (1 - arrival) * 0.22,
  }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = buddyState({ object, events, frame })
  if (!s) return null
  // Separate slot compositions: the wide buddy is broader and sits higher on its stage.
  const layout = aspect === '9:16' ? { size: Math.min(box.width * 0.34, box.height * 0.25), lift: 0 }
    : { size: Math.min(box.width * 0.22, box.height * 0.42), lift: -0.04 }
  const size = layout.size
  const x = box.width * s.x - (box.width + size) * (1 - s.arrival) ** 2 + (box.width + size) * s.out
  const y = box.height * (s.y + layout.lift) - box.height * 0.2 * pulse(s.arrival)
    + size * (0.12 * s.slump - 0.3 * s.hop)
  return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
    <ellipse cx={x} cy={box.height * (s.y + layout.lift) + size * 0.6} rx={size * 0.35} ry={size * 0.055}
      fill={tokens.inkSoft} opacity={0.12 * s.arrival * (1 - s.out)} />
    <g transform={`translate(${x - size * 0.2 * s.recoil} ${y}) scale(${size / 100}) rotate(${s.wave * -18 + s.slump * 10})`}>
      {s.arrival < 1 && [0, 1, 2].map(i => <path key={i} d={`M ${-65 - i * 18} ${-10 + i * 18} l -22 4`}
        stroke={tokens.mint} strokeWidth={7 - i} strokeLinecap="round" opacity={(1 - s.arrival) * (0.6 - i * 0.15)} />)}
      <g transform={`scale(${1 + s.stretch} ${1 - s.stretch - s.slump * 0.12})`}>
        <path d="M -34 -47 Q -39 -55 -40 -43 L -35 39 Q -34 48 -27 42 L -7 24 L 8 50 Q 11 55 17 51 L 29 44 Q 34 41 30 35 L 15 12 L 42 8 Q 51 7 43 0 Z"
          fill={tokens.inkSoft} opacity={0.15} transform="translate(3 5)" />
        <path d="M -34 -47 Q -39 -55 -40 -43 L -35 39 Q -34 48 -27 42 L -7 24 L 8 50 Q 11 55 17 51 L 29 44 Q 34 41 30 35 L 15 12 L 42 8 Q 51 7 43 0 Z"
          fill={tokens.mint} stroke={tokens.ink} strokeWidth={2.5} strokeLinejoin="round" />
        {s.mood === 'cool' ? <g data-sunglasses="true" fill={tokens.ink} stroke={tokens.ink} strokeWidth={3}>
          <path d="M -29 -12 H -13 V -5 Q -21 4 -29 -5 Z M -7 -12 H 9 V -5 Q 1 4 -7 -5 Z" />
          <path d="M -13 -9 H -7 M -34 -12 H -29 M 9 -12 H 14" />
        </g> : <g data-eyes={s.mood === 'sulk' ? 'half-closed' : 'open'} fill={tokens.ink}>
          {s.slump ? <path d="M -28 -8 Q -23 -3 -18 -8 M -7 -8 Q -2 -3 3 -8" fill="none" stroke={tokens.ink} strokeWidth={3} strokeLinecap="round" />
            : <><circle cx={-23} cy={-9} r={3.5} />{s.wave > 0.35
              ? <path d="M -7 -9 Q -2 -14 3 -9" fill="none" stroke={tokens.ink} strokeWidth={3} />
              : <circle cx={-2} cy={-9} r={3.5} />}</>}
        </g>}
        <path d={s.slump ? 'M -17 10 Q -11 4 -5 10' : s.mood === 'proud' ? 'M -20 4 Q -11 20 -2 4 Z' : 'M -17 5 Q -11 13 -5 5'}
          fill={s.mood === 'proud' ? tokens.ink : 'none'} stroke={tokens.ink} strokeWidth={2.5} strokeLinecap="round" />
        {s.prop === 'card' && <rect data-prop="card" x={16} y={16} width={43} height={28} rx={5} fill={tokens.cream} stroke={tokens.ink} strokeWidth={2.5} transform="rotate(-8 16 16)" />}
      </g>
    </g>
  </svg>
}
