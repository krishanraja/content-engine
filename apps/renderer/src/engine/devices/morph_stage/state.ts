import { drift, HERO, MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
// Shared move arithmetic, rather than a second interpolation implementation.
// @ts-ignore The moves bank is shared JavaScript.
import { lerp } from '@mymu/moves/_kit.mjs'
import { ParamsSchema, type MorphState } from './schema'
export type Point = [number, number]
export function resample(vertices: Point[], count = 96): Point[] {
  const lengths = vertices.map((a, i) => { const b = vertices[(i + 1) % vertices.length]!; return Math.hypot(b[0] - a[0], b[1] - a[1]) })
  const total = lengths.reduce((a, b) => a + b, 0)
  if (!total) throw new Error('Morph outline must have area')
  return Array.from({ length: count }, (_, i) => {
    let distance = i * total / count, edge = 0
    while (edge < lengths.length - 1 && distance > lengths[edge]!) distance -= lengths[edge++]!
    const a = vertices[edge]!, b = vertices[(edge + 1) % vertices.length]!, t = lengths[edge] ? distance / lengths[edge]! : 0
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
  })
}
export function outline(s: MorphState): Point[] {
  if (s.kind === 'shape' && s.points) return resample(s.points)
  if (s.shape === 'circle') return resample(Array.from({ length: 96 }, (_, i): Point => { const a = -Math.PI / 2 + i * Math.PI * 2 / 96; return [.5 + .5 * Math.cos(a), .5 + .5 * Math.sin(a)] }))
  return resample(s.shape === 'triangle' ? [[.5, 0], [1, 1], [0, 1]] : s.shape === 'diamond' ? [[.5, 0], [1, .5], [.5, 1], [0, .5]] : [[0, 0], [1, 0], [1, 1], [0, 1]])
}
/** Part way between two outlines; a finished morph is the target outline itself, never a rounding error short of it. */
export const blend = (a: Point[], b: Point[], t: number): Point[] => t >= 1 ? b : a.map((p, i) => [lerp(p[0], b[i]![0], t), lerp(p[1], b[i]![1], t)])
export function morphState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params), state = stateAt(events, object.obj, frame)
  for (const s of params.states) if (s.kind === 'number' && !object.dataset?.rows[s.row]) throw new Error('Number states require a dataset row and producerLabel')
  const duration = Math.min(18, Math.max(1, MOTION.countFrames))
  let points = outline(params.states[0]!), source = points, target = points, index = 0, previous = 0, start = 0, amount = 1
  let entered = false, scale = 1, highlighted = false
  for (const e of state.fired) {
    if (e.verb === 'enter') { entered = true; scale = progress(frame - e.atFrame, Math.min(18, MOTION.enterFrames)); continue }
    if (e.verb === 'highlight') { highlighted = true; continue }
    if (e.verb === 'exit') { scale *= 1 - progress(frame - e.atFrame, Math.min(18, MOTION.exitFrames)); continue }
    if (e.verb !== 'move') continue
    const n = Number(e.toState)
    if (!Number.isInteger(n) || !params.states[n]) throw new Error('move toState must be a state index')
    // Replay interrupted morphs at their cue, so a fast next beat starts from the actual outline.
    points = blend(source, target, progress(e.atFrame - start, duration, HERO))
    source = points; target = outline(params.states[n]!); previous = index; index = n; start = e.atFrame
    amount = progress(frame - start, duration, HERO)
    points = blend(source, target, amount)
  }
  return { params, points, source, target, index, previous, amount, scale, highlighted, visible: entered && frame >= object.fromFrame && frame <= object.toFrame && scale > 0,
    drift: drift(frame, object.fromFrame, object.toFrame, Math.max(.1, MOTION.driftPct)) }
}
