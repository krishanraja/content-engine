import { Easing, interpolate, useCurrentFrame } from 'remotion'
import type { EngineEvent } from './props'
import type { MotionProfile } from './kit/motionProfiles'

/** The only time source for engine devices (ESLint no-useCurrentFrame-outside-clock). A device asks
 *  "what state am I in, and how far into it?" and never does arithmetic on the raw frame, so no device
 *  can loop on f % N (the Friday S12 failure) or drift from its cue. */

export const FPS = 30
const HOUSE_ENTER = Easing.bezier(0.05, 0.7, 0.1, 1.0)   // 400 ms decelerate (brand-tokens.json motion.enter)
const HOUSE_HERO = Easing.bezier(0.16, 1, 0.3, 1)
const UTILITY = Easing.bezier(0.2, 0, 0, 1)               // brand-tokens.json motion.utility
const CURVES = { enter: HOUSE_ENTER, hero: HOUSE_HERO, utility: UTILITY } as const
// Monday's E.back with its 1.9 overshoot, the logo card's own pop before motion styles rendered.
const HOUSE_BACK = (t: number) => 1 + 2.9 * Math.pow(t - 1, 3) + 1.9 * Math.pow(t - 1, 2)
export const EXIT = Easing.bezier(0.3, 0.0, 0.8, 0.15)     // 200 ms accelerate

/** The house motion: what every device draws with when a cut names no motion style. Never change these numbers; a
 *  style changes motion through its profile (kit/motion-profiles.json), so frozen locks stay valid. */
export const HOUSE_MOTION = { enterFrames: 12, exitFrames: 6, staggerFrames: 3, slapFrames: 5, dropFrames: 8, slideFrames: 12,
  driftPct: 1.5, risePx: 24, countFrames: 18 } as const
type Motion = { readonly [K in keyof typeof HOUSE_MOTION]: number }

/** An ease-out that overshoots its rest by exactly `pct` percent, then settles (the back curve, solved for its peak:
 *  peak = 4s^3 / (27 (s+1)^2)). */
export function overshootEase(pct: number): (t: number) => number {
  const target = pct / 100
  let low = 0, high = 4
  for (let i = 0; i < 60; i++) {
    const s = (low + high) / 2
    if (4 * s ** 3 / (27 * (s + 1) ** 2) < target) low = s; else high = s
  }
  const s = (low + high) / 2
  return (t: number) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)
}

interface Active { motion: Motion; enter: (t: number) => number; hero: (t: number) => number; back: (t: number) => number; profile?: MotionProfile }
const HOUSE: Active = { motion: HOUSE_MOTION, enter: HOUSE_ENTER, hero: HOUSE_HERO, back: HOUSE_BACK }
let active: Active = HOUSE

/** FormatMaster calls this once a frame from props.motion, the way it calls setActiveCanvas. `undefined` restores the
 *  house motion exactly. A profile arrives already inside the signed floor (motionProfiles.clampToFloor). */
export function setMotionProfile(profile: MotionProfile | undefined): void {
  if (!profile) { active = HOUSE; return }
  const frames = profile.entrance.frames
  const base = CURVES[profile.entrance.easing]
  const enter = profile.entrance.overshootPct > 0 ? overshootEase(profile.entrance.overshootPct) : base
  active = {
    profile,
    motion: { enterFrames: frames, exitFrames: profile.exitFrames, staggerFrames: profile.stagger.frames,
      slapFrames: Math.min(HOUSE_MOTION.slapFrames, frames), dropFrames: frames, slideFrames: frames,
      driftPct: profile.driftPct, risePx: profile.entrance.distancePx, countFrames: profile.countFrames },
    enter, hero: CURVES[profile.camera.easing], back: enter,
  }
}

/** The active profile, for the composition and the shared text reveal; undefined means the house motion. */
export function motionProfile(): MotionProfile | undefined { return active.profile }

/** Read at call time, so every device follows the active profile with no rewrite. */
export const ENTER = (t: number): number => active.enter(t)
export const HERO = (t: number): number => active.hero(t)
/** The pop a logo lands with: the house back curve, or the profile's own overshoot (never past the floor's 12%). */
export const BACK = (t: number): number => active.back(t)
export const MOTION: Motion = {
  get enterFrames() { return active.motion.enterFrames },
  get exitFrames() { return active.motion.exitFrames },
  get staggerFrames() { return active.motion.staggerFrames },
  get slapFrames() { return active.motion.slapFrames },
  get dropFrames() { return active.motion.dropFrames },
  get slideFrames() { return active.motion.slideFrames },
  get driftPct() { return active.motion.driftPct },
  get risePx() { return active.motion.risePx },
  get countFrames() { return active.motion.countFrames },
}

/** The single frame read in the engine: FormatMaster calls this once and passes `frame` down. Nothing else
 *  in apps/renderer/src/engine calls useCurrentFrame. */
export function useEngineFrame(): number {
  return useCurrentFrame()
}

export interface DeviceState {
  /** The latest event at or before this frame for this object, or null before its first event. */
  current: EngineEvent | null
  /** Events already fired, oldest first. */
  fired: EngineEvent[]
  /** Frames since `current` fired; opening entrances are already landed. Infinity before the first event. */
  sinceFrames: number
}

export function stateAt(events: readonly EngineEvent[], obj: string, frame: number): DeviceState {
  // Pre-roll opening entrances internally, including staggered children. Props keep their
  // original non-negative cues; later events and exits retain their exact times.
  const fired = events.filter((e) => e.obj === obj && e.atFrame <= frame)
    .map(e => e.atFrame === 0 && e.verb === 'enter' ? { ...e, atFrame: -Number.MAX_SAFE_INTEGER } : e)
    .sort((a, b) => a.atFrame - b.atFrame)
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

/** A style that moves on twos holds every other frame of its graphics (15 fps steps inside the 30 fps cut), counted
 *  from the beat's first frame so a beat never shows a frame before it starts. The take and captions stay on ones. */
export function onTwos(frame: number, fromFrame: number): number {
  return frame - ((frame - fromFrame) % 2)
}

/** Opening text is already typed; later rows retain their lead and reveal duration. */
export function typingProgress(frame: number, cue: EngineEvent, durationFrames: number, leadFrames: number): number {
  if (cue.atFrame === 0 && frame >= 0) return 1
  return progress(frame - cue.atFrame - leadFrames, durationFrames, t => t)
}
