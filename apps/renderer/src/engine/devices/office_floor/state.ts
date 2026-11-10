import { MOTION, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { FillSchema, MoveSchema, ParamsSchema, StampSchema, TargetSchema } from './schema'

export function officeState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const exit = active.findLast(e => e.verb === 'exit')
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames) : 0
  if (out === 1) return null
  const figures = params.figures.map(f => ({ ...f, added: undefined as number | undefined, rank: params.figures.length,
    marker: params.figures.length, sent: undefined as number | undefined, carried: undefined as number | undefined }))
  let meter = 0, target = params.target, highlight: string | undefined
  let fill: { id: string; at: number; p: number } | undefined
  let badge: { id: string; text: string; at: number } | undefined
  let topple = 0
  // Resolve interrupted transitions at the next cue before applying the next target.
  let meterFrom = 0, meterTo = 0, meterAt = enter.atFrame
  let targetFrom = target, targetTo = target, targetAt = enter.atFrame
  const moves = new Map<string, { from: number; to: number; at: number }>()
  for (const e of active) {
    const data = ['fill', 'move', 'stamp'].includes(e.verb) ? JSON.parse(e.toState) : null
    const id = data?.id ?? e.toState
    const figure = figures.find(f => f.id === id)
    if (e.verb === 'add' && figure && figure.added === undefined) figure.added = e.atFrame
    if (e.verb === 'fill') {
      const d = FillSchema.parse(data)
      if (!figure || figure.added === undefined) continue
      meterFrom += (meterTo - meterFrom) * progress(e.atFrame - meterAt, MOTION.countFrames)
      meterTo = d.to; meterAt = e.atFrame
      fill = { id: d.id, at: e.atFrame, p: progress(frame - e.atFrame, MOTION.countFrames) }
    }
    if (e.verb === 'move' && figure && figure.added !== undefined) {
      const d = MoveSchema.parse(data), old = moves.get(id)
      const from = old ? old.from + (old.to - old.from) * progress(e.atFrame - old.at, MOTION.slideFrames) : figure.marker
      moves.set(id, { from, to: d.rank, at: e.atFrame }); figure.rank = d.rank
    }
    if (e.verb === 'send' && figure && figure.added !== undefined) figure.sent = e.atFrame
    if (e.verb === 'carry' && figure && figure.added !== undefined) figure.carried = e.atFrame
    if (e.verb === 'highlight' && figure) highlight = id
    if (e.verb === 'stamp' && figure && figure.added !== undefined) badge = { ...StampSchema.parse(data), at: e.atFrame }
    if (e.verb === 'draw') {
      targetFrom += (targetTo - targetFrom) * progress(e.atFrame - targetAt, MOTION.slideFrames)
      targetTo = TargetSchema.parse(JSON.parse(e.toState)); targetAt = e.atFrame
    }
    if (e.verb === 'mark') topple = progress(frame - e.atFrame, MOTION.dropFrames)
  }
  meter = meterFrom + (meterTo - meterFrom) * progress(frame - meterAt, MOTION.countFrames)
  target = targetFrom + (targetTo - targetFrom) * progress(frame - targetAt, MOTION.slideFrames)
  for (const f of figures) {
    const m = moves.get(f.id)
    if (m) f.marker = m.from + (m.to - m.from) * progress(frame - m.at, MOTION.slideFrames)
  }
  return { params, enter: enter.atFrame, figures, meter, target, highlight, badge, fill, topple, out }
}
