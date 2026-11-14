import { EXIT, MOTION, overshootEase, progress, stateAt } from '../../clock'
import { SCRIBBLE } from '../../kit/lock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

// Card ve-gap-mint-ring-1: eight-frame pen move with a small endpoint overshoot.
export const DRAW_FRAMES = 8
const PEN = overshootEase(4)
const SAMPLES = 256 // polygon resolution, per complete turn
const TURNS = 2 // hidden second lap gives the endpoint room to overshoot in arc length
const REST_TURNS = 1.03 // a hand-drawn loop closes with a short overlap

export function ringGeometry(object: EngineObject) {
  const { at } = ParamsSchema.parse(object.params)
  // Stable object-id hash: each annotation has its own hand, including on backward seeks.
  let seed = 2166136261
  for (const char of object.obj) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0
  const phase = seed / 4294967296 * Math.PI * 2
  const margin = SCRIBBLE.keyline_px
  const cx = at.x + at.w / 2, cy = at.y + at.h / 2
  // A fourth-power superellipse encloses the rectangle's corners. Padding also clears the keyline.
  const rx = (at.w / 2 + margin) * Math.pow(2, 0.25)
  const ry = (at.h / 2 + margin) * Math.pow(2, 0.25)
  const point = (turn: number) => {
    const angle = turn * Math.PI * 2 - Math.PI / 2
    // Outward-only wobble preserves enclosure, even on narrow targets.
    const wobble = 1 + 0.012 * (1 + Math.sin(3 * angle + phase))
    const c = Math.cos(angle), s = Math.sin(angle)
    return { x: cx + rx * Math.sign(c) * Math.sqrt(Math.abs(c)) * wobble,
      y: cy + ry * Math.sign(s) * Math.sqrt(Math.abs(s)) * wobble }
  }
  const points = Array.from({ length: Math.ceil(SAMPLES * TURNS) + 1 }, (_, i) => point(Math.min(i / SAMPLES, TURNS)))
  const loopLength = points.slice(1, SAMPLES + 1).reduce((length, p, i) =>
    length + Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y), 0)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  const left = Math.min(...points.map(p => p.x)) - margin / 2
  const top = Math.min(...points.map(p => p.y)) - margin / 2
  const width = Math.max(...points.map(p => p.x)) + margin / 2 - left
  const height = Math.max(...points.map(p => p.y)) + margin / 2 - top
  return { d, points, loopLength, left, top, width, height }
}

export function mintRingState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const state = stateAt(events, object.obj, frame)
  const draw = state.fired.findLast(e => e.verb === 'draw')
  const cue = state.fired.findLast(e => e.verb === 'draw' || e.verb === 'exit')
  const exiting = cue?.verb === 'exit'
  // Exit holds the exact pen position reached when it interrupted a draw.
  const elapsed = draw ? (exiting ? cue.atFrame : frame) - draw.atFrame : 0
  const drawn = draw ? progress(elapsed, DRAW_FRAMES, PEN) * REST_TURNS / TURNS : 0
  const opacity = exiting ? 1 - progress(stateAt([cue], object.obj, frame).sinceFrames, MOTION.exitFrames, EXIT) : 1
  return { visible: !!draw && frame >= object.fromFrame && frame < object.toFrame && opacity > 0,
    drawn, opacity, geometry: ringGeometry(object) }
}
