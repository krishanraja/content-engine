import { Easing, interpolate } from 'remotion'
import type { EngineEvent } from './props'

/** The only time source for engine devices (ESLint no-useCurrentFrame-outside-clock). A device asks
 *  "what state am I in, and how far into it?" and never does arithmetic on the raw frame, so no device
 *  can loop on f % N (the Friday S12 failure) or drift from its cue. */

export const FPS = 30
export const ENTER = Easing.bezier(0.05, 0.7, 0.1, 1.0)   // 400 ms decelerate (brand-tokens.json motion.enter)
export const EXIT = Easing.bezier(0.3, 0.0, 0.8, 0.15)     // 200 ms accelerate
export const HERO = Easing.bezier(0.16, 1, 0.3, 1)
export const MOTION = { enterFrames: 12, exitFrames: 6, staggerFrames: 3, slapFrames: 5, dropFrames: 8, slideFrames: 12, driftPct: 1.5 } as const

export interface DeviceState {
  /** The latest event at or before this frame for this object, or null before its first event. */
  current: EngineEvent | null
  /** Events already fired, oldest first. */
  fired: EngineEvent[]
  /** Frames since `current` fired (0 on its frame); Infinity before the first event. */
  sinceFrames: number
}

export function stateAt(events: readonly EngineEvent[], obj: string, frame: number): DeviceState {
  const fired = events.filter((e) => e.obj === obj && e.atFrame <= frame).sort((a, b) => a.atFrame - b.atFrame)
  const current = fired.at(-1) ?? null
  return { current, fired, sinceFrames: current ? frame - current.atFrame : Number.POSITIVE_INFINITY }
}

/** 0 to 1 progress through an animation that starts at an event, eased; clamped, so it never repeats. */
export function progress(sinceFrames: number, durationFrames: number, easing: (t: number) => number = ENTER): number {
  if (!Number.isFinite(sinceFrames) || sinceFrames < 0) return 0
  return interpolate(sinceFrames, [0, durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing })
}

/** Ambient drift so nothing fully stops: a slow, non-repeating push (percent of size) across an object's life. */
export function drift(frame: number, fromFrame: number, toFrame: number, pct: number = MOTION.driftPct): number {
  if (toFrame <= fromFrame) return 0
  return interpolate(frame, [fromFrame, toFrame], [0, pct / 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}
