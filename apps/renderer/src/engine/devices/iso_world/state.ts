import { BACK, MOTION, drift, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { FillSchema, ParamsSchema } from './schema'
// Reuse the shared move's interpolation, with engine-owned event progress.
// @ts-ignore shared JavaScript primitive
import { lerp } from '@mymu/moves/_kit.mjs'
export const project = ([a, b]: readonly number[]) => ({ x: (a! - b!) * 100, y: (a! + b!) * 50 })
export function routePoint(cells: number[][], p: number) {
  const points = cells.map(project)
  const lengths = points.slice(1).map((b, i) => Math.hypot(b.x - points[i]!.x, b.y - points[i]!.y))
  let distance = lengths.reduce((a, b) => a + b, 0) * p
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!
    if (distance <= length || i === lengths.length - 1) {
      const t = length ? Math.min(1, distance / length) : 1
      return { x: lerp(points[i]!.x, points[i + 1]!.x, t), y: lerp(points[i]!.y, points[i + 1]!.y, t) }
    }
    distance -= length
  }
  return points[0]!
}
export function worldState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  let enter: number | undefined, exit: number | undefined
  const blocks = params.blocks.map(b => ({ ...b, added: undefined as number | undefined, heightNow: b.height, highlighted: false, pulse: 0 }))
  let focus = { x: 0, y: 0 }
  let token: { x: number; y: number; route: string } | undefined
  for (const e of fired) {
    if (e.verb === 'enter') { enter = e.atFrame; exit = undefined; blocks.forEach(b => { b.added = undefined; b.heightNow = b.height; b.highlighted = false }); focus = { x: 0, y: 0 }; token = undefined }
    const b = blocks.find(b => b.id === e.toState)
    if (e.verb === 'add' && b && b.added === undefined) b.added = e.atFrame
    if (e.verb === 'fill') {
      const target = FillSchema.parse(JSON.parse(e.toState)), block = blocks.find(b => b.id === target.id)
      if (block) block.heightNow = lerp(block.heightNow, target.height, progress(frame - e.atFrame, MOTION.slideFrames))
    }
    if (e.verb === 'highlight' && b) { blocks.forEach(block => { block.highlighted = block === b }); b.pulse = progress(frame - e.atFrame, MOTION.slapFrames) }
    if (e.verb === 'move' && b) { const pos = project(b.cell), p = progress(frame - e.atFrame, MOTION.slideFrames); focus = { x: lerp(focus.x, pos.x, p), y: lerp(focus.y, pos.y, p) } }
    if (e.verb === 'carry') { const r = params.routes.find(r => r.id === e.toState); if (r) token = { ...routePoint(r.cells, progress(frame - e.atFrame, MOTION.slideFrames, t => t)), route: r.id } }
    if (e.verb === 'exit') exit = e.atFrame
  }
  const added = blocks.filter(b => b.added !== undefined).sort((a, b) => a.added! - b.added!)
  const out = exit === undefined ? 0 : progress(frame - exit, MOTION.exitFrames, t => t)
  return { params, visible: enter !== undefined && out < 1, ground: enter === undefined ? 0 : progress(frame - enter, MOTION.dropFrames, BACK), focus, token, out,
    drift: drift(frame, object.fromFrame, object.toFrame, Math.max(0.5, MOTION.driftPct)),
    blocks: added.map((b, i) => ({ ...b, ...project(b.cell), drop: progress(frame - b.added!, MOTION.dropFrames, BACK), sink: exit === undefined ? 0 : progress(frame - exit, MOTION.exitFrames, t => Math.max(0, Math.min(1, t * added.length - (added.length - 1 - i)))) })).sort((a, b) => a.cell[0] + a.cell[1] - b.cell[0] - b.cell[1] || a.cell[0] - b.cell[0]),
  }
}
