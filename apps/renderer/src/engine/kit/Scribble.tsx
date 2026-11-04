import React from 'react'
import { ENTER, EXIT, MOTION, motionProfile, progress } from '../clock'
import type { EngineTokens } from '../props'
import { ACTIVE_CANVAS, SCRIBBLE } from './lock'
import { BoilFilter, boilSeed, seedOf } from './overlays'

export function Scribble({ d, colour, tokens, sinceFrames, exiting = false }: {
  d: string; colour: 'cream' | 'mint'; tokens: EngineTokens; sinceFrames: number; exiting?: boolean
}) {
  const dash = exiting ? 0 : 1 - progress(sinceFrames, SCRIBBLE.draw_on_frames, ENTER)
  const opacity = exiting ? 1 - progress(sinceFrames, MOTION.exitFrames, EXIT) : 1
  const path = { d, pathLength: SCRIBBLE.path_length, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
    strokeDasharray: 1, strokeDashoffset: dash } as const
  // line-boil: the stroke (never type) wobbles, its seed changing every `everyFrames` frames.
  const boil = motionProfile()?.boil
  if (boil) {
    const id = `boil-${seedOf(d)}`
    return <svg width={ACTIVE_CANVAS.w} height={ACTIVE_CANVAS.h} viewBox={`0 0 ${ACTIVE_CANVAS.w} ${ACTIVE_CANVAS.h}`} aria-hidden="true"
      style={{ position: 'absolute', left: 0, top: 0, opacity, pointerEvents: 'none' }}>
      <defs><BoilFilter id={id} seed={boilSeed(seedOf(d), sinceFrames, boil.everyFrames)} amplitudePx={boil.amplitudePx} /></defs>
      <path data-boil {...path} stroke={tokens.ink} strokeWidth={SCRIBBLE.keyline_px} filter={`url(#${id})`} />
      <path data-boil {...path} stroke={tokens[colour]} strokeWidth={SCRIBBLE.stroke_px} filter={`url(#${id})`} />
    </svg>
  }
  return <svg width={ACTIVE_CANVAS.w} height={ACTIVE_CANVAS.h} viewBox={`0 0 ${ACTIVE_CANVAS.w} ${ACTIVE_CANVAS.h}`} aria-hidden="true"
    style={{ position: 'absolute', left: 0, top: 0, opacity, pointerEvents: 'none' }}>
    <path {...path} stroke={tokens.ink} strokeWidth={SCRIBBLE.keyline_px} />
    <path {...path} stroke={tokens[colour]} strokeWidth={SCRIBBLE.stroke_px} />
  </svg>
}
