import { Easing } from 'remotion'
import { FPS, progress } from '../clock'

// Explicit house curve keeps these pure even when FormatMaster changes the active profile.
const ease = Easing.bezier(0.05, 0.7, 0.1, 1)
function share(frame: number, at: number, frames: number): number {
  if (frame < at) return 0
  if (frames <= 0 || frame >= at + frames) return 1
  return progress(frame - at, frames, ease)
}

function hash(at: number): number {
  let h = 2166136261
  for (const c of String(at)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0) / 4294967295 * 2 - 1
}

/** Count with a cue-seeded, decaying perturbation; endpoints retain their exact values. */
export function countTo(frame: number, at: number, from: number, to: number,
  { frames = 18, jitter = 0.02, decimals = 0 }: { frames?: number; jitter?: number; decimals?: number } = {}): number {
  if (frame <= at) return from
  const p = share(frame, at, frames)
  if (p === 1) return to
  const value = from + (to - from) * p + Math.abs(to - from) * jitter * hash(at) * p * (1 - p)
  const scale = 10 ** Math.min(15, Math.max(0, Math.floor(decimals)))
  return Math.round(value * scale) / scale
}

/** Reveal Unicode code points at the readable 25..40 characters/second floor. */
export function typeOn(frame: number, at: number, text: string, { cps = 30 }: { cps?: number } = {}): string {
  const rate = Math.min(40, Math.max(25, cps))
  return Array.from(text).slice(0, Math.max(0, Math.floor((frame - at) * rate / FPS))).join('')
}

export function drawPath(frame: number, at: number, lengthPx: number, { frames = 12 }: { frames?: number } = {}): number {
  return lengthPx * (1 - share(frame, at, frames))
}

/** Token values remain intact, including named colours and CSS variables. */
export function mix(frame: number, at: number, fromColour: string, toColour: string,
  { frames = 6 }: { frames?: number } = {}): string {
  const p = share(frame, at, frames)
  if (p === 0) return fromColour
  if (p === 1) return toColour
  return `color-mix(in srgb, ${fromColour} ${(1 - p) * 100}%, ${toColour} ${p * 100}%)`
}

export interface CursorPoint { readonly x: number; readonly y: number }
export interface CursorState { x: number; y: number; pressed: boolean }

/** Each destination gets a rest, with a press on its final frame, then release.
 * Total duration is (points.length - 1) * (framesPerLeg + restFrames).
 * Empty paths are rejected; a single point stays still without pressing.
 */
export function cursorPath(frame: number, at: number, points: readonly CursorPoint[],
  { framesPerLeg = 10, restFrames = 4 }: { framesPerLeg?: number; restFrames?: number } = {}): CursorState {
  if (!points.length) throw new RangeError('cursorPath requires at least one point')
  const first = points[0]!
  if (frame < at || points.length === 1) return { ...first, pressed: false }
  const travel = Math.max(1, framesPerLeg)
  const rest = Math.max(0, restFrames)
  const duration = travel + rest
  const age = frame - at
  if (age >= (points.length - 1) * duration) return { ...points[points.length - 1]!, pressed: false }
  const leg = Math.floor(age / duration)
  const local = age - leg * duration
  const a = points[leg]!, b = points[leg + 1]!
  if (local >= travel) return { ...b, pressed: local >= duration - Math.min(1, rest) }
  const p = share(local, 0, travel)
  // A quadratic arc with its control point displaced perpendicular to the leg.
  const bend = 0.3 * p * (1 - p)
  return { x: a.x + (b.x - a.x) * p - (b.y - a.y) * bend,
    y: a.y + (b.y - a.y) * p + (b.x - a.x) * bend, pressed: false }
}
