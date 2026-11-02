import React from 'react'
import { EXIT, MOTION, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { MoodSchema, ParamsSchema, PositionSchema } from './schema'

const linear = (t: number) => t
const pulse = (t: number) => t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t)

/** All poses are evaluated from the event history, including interrupted moves. */
export function buddyState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const params = ParamsSchema.parse(object.params)
  if (frame < object.fromFrame || frame >= object.toFrame) return null
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const exit = active.filter(e => e.verb === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out >= 1) return null
  let origin = { x: 0.5, y: 0.5 }
  let target = origin
  let moveAt = enter.atFrame
  const positionAt = (at: number) => {
    const p = progress(at - moveAt, MOTION.slideFrames)
    return { x: origin.x + (target.x - origin.x) * p, y: origin.y + (target.y - origin.y) * p }
  }
  for (const event of active) {
    if (event.verb !== 'move') continue
    const next = PositionSchema.parse(JSON.parse(event.toState))
    origin = positionAt(event.atFrame)
    target = next
    moveAt = event.atFrame
  }
  // String comparison allows the new device verbs while the shared schema awaits extension.
  const moodEvent = active.filter(e => ['sulk', 'bounce'].includes(String(e.verb))).at(-1)
  const mood = String(moodEvent?.verb) === 'bounce' ? 'proud' : moodEvent ? MoodSchema.parse(moodEvent.toState) : params.mood
  const gesture = active.filter(e => ['bounce', 'sulk', 'wave'].includes(String(e.verb))).at(-1)
  const verb = String(gesture?.verb ?? '')
  const age = gesture ? frame - gesture.atFrame : Infinity
  const hopP = progress(age, MOTION.dropFrames * 2, linear)
  const hop = verb === 'bounce' ? Math.abs(Math.sin(hopP * Math.PI * 2)) * (1 - 0.25 * hopP) : 0
  const slump = mood === 'sulk' ? (moodEvent ? progress(frame - moodEvent.atFrame, MOTION.dropFrames) : 1) : 0
  const recoil = verb === 'sulk' ? pulse(progress(age, MOTION.slapFrames, linear)) : 0
  const wave = verb === 'wave' ? pulse(progress(age, MOTION.dropFrames * 2, linear)) : 0
  const entry = progress(frame - enter.atFrame, MOTION.enterFrames, linear)
  const zip = progress(frame - enter.atFrame, MOTION.dropFrames)
  const settle = pulse(progress(frame - enter.atFrame - MOTION.dropFrames, MOTION.enterFrames - MOTION.dropFrames, linear))
  return { ...positionAt(frame), mood, prop: params.prop, entry, zip, out, hop: hopP === 1 ? 0 : hop,
    slump, recoil, wave, scaleX: 1 + 0.16 * settle, scaleY: 1 - 0.16 * settle }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = buddyState({ object, events, frame })
  if (!s) return null
  const tall = aspect === '9:16'
  const size = Math.min(box.width * (tall ? 0.28 : 0.18), box.height * (tall ? 0.24 : 0.38))
  const scale = size / 160
  const x = box.width * s.x - (box.width * s.x + size) * (1 - s.zip) + (box.width + size) * s.out - s.recoil * size * 0.12
  const groundY = box.height * s.y
  const y = groundY - size * 0.7 * 4 * s.zip * (1 - s.zip) - size * 0.3 * s.hop + size * 0.13 * s.slump
  const tilt = -8 * (1 - s.zip) - 14 * s.slump + 15 * s.wave
  return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
    <ellipse cx={x + 3 * scale} cy={groundY + 88 * scale}
      rx={(58 - s.hop * 14) * scale} ry={9 * scale} fill={tokens.ink}
      opacity={(0.06 + 0.06 * (1 - s.hop)) * s.zip * (1 - s.out)} />
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {s.entry < 1 && [0, 1, 2].map(i => <path key={i} d={`M ${-115 - i * 25} ${10 + i * 18} q -28 -10 -46 2`}
        fill="none" stroke={tokens.mint} strokeWidth={9 - i * 2} strokeLinecap="round" opacity={(1 - s.entry) * (0.5 - i * 0.12)} />)}
      <g transform={`rotate(${tilt}) scale(${s.scaleX} ${s.scaleY})`}>
        <path d="M -57 -70 Q -60 -83 -48 -75 L 64 16 Q 76 27 60 30 L 20 34 L 3 73 Q -2 85 -12 76 L -37 40 L -67 57 Q -80 64 -77 47 Z"
          transform="translate(2 5)" fill={tokens.ink} opacity="0.12" />
        <path data-body="cursor" d="M -57 -70 Q -60 -83 -48 -75 L 64 16 Q 76 27 60 30 L 20 34 L 3 73 Q -2 85 -12 76 L -37 40 L -67 57 Q -80 64 -77 47 Z"
          fill={tokens.mint} stroke={tokens.ink} strokeWidth="3" strokeLinejoin="round" />
        {s.mood === 'cool' ? <g data-eyes="sunglasses" fill={tokens.ink} stroke={tokens.ink} strokeWidth="4">
          <path d="M -48 -17 L -25 -17 L -28 -4 Q -38 4 -46 -5 Z M -15 -17 L 8 -17 L 5 -4 Q -5 4 -13 -5 Z" />
          <path d="M -25 -13 L -15 -13 M -55 -19 L 13 -19" fill="none" />
        </g> : <g data-eyes={s.mood === 'sulk' ? 'half-closed' : 'open'} fill={tokens.ink}>
          {s.mood === 'sulk' ? <path d={s.wave > 0.3 ? 'M -45 -8 q 7 7 14 0 M -13 -12 q 6 6 12 0' : 'M -45 -8 q 7 7 14 0 M -17 -8 q 7 7 14 0'} fill="none" stroke={tokens.ink} strokeWidth="4" strokeLinecap="round" /> : <>
            <ellipse cx="-37" cy="-13" rx="5" ry="6" />
            {s.wave > 0.3 ? <path d="M -13 -12 q 6 6 12 0" fill="none" stroke={tokens.ink} strokeWidth="4" strokeLinecap="round" /> : <ellipse cx="-9" cy="-13" rx="5" ry="6" />}
          </>}
        </g>}
        <path d={s.mood === 'sulk' ? 'M -30 16 q 9 -8 18 0' : s.mood === 'proud' ? 'M -33 7 q 12 20 25 0 Z' : 'M -30 10 q 9 10 18 0'}
          fill={s.mood === 'proud' ? tokens.ink : 'none'} stroke={tokens.ink} strokeWidth="3" strokeLinecap="round" />
        {s.prop === 'card' && <g data-prop="card" transform="translate(26 48) rotate(-8)">
          <rect x="-22" y="-15" width="57" height="36" rx="6" fill={tokens.ink} opacity="0.1" />
          <rect x="-24" y="-18" width="57" height="36" rx="6" fill={tokens.cream} stroke={tokens.ink} strokeWidth="3" />
        </g>}
      </g>
    </g>
  </svg>
}
