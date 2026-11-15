import { EXIT, MOTION, progress, stateAt } from '../../clock'
import { cursorPath, typeOn } from '../../kit/verbs'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'

/** Replay only this object's cues, so seeks and interrupted glides remain deterministic.
 * A press cue before arrival + four frames is invalid, rather than silently moved off its word. */
export function cursorState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter || frame < object.fromFrame || frame >= object.toFrame) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const exit = active.filter(e => e.verb === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out >= 1) return null
  let origin = params.start, destination = params.start, moveAt = enter.atFrame
  let settledAt = enter.atFrame
  let press: { atFrame: number; target: string; point: typeof origin; send: boolean } | undefined
  const texts: Record<string, string> = {}
  for (const e of active) {
    if (!['move', 'pick', 'send', 'type'].includes(e.verb)) continue
    const target = params.targets.find(t => t.id === e.toState)
    if (!target) throw new Error(`cursor_path unknown target: ${e.toState}`)
    const point = { x: target.x + target.w / 2, y: target.y + target.h / 2 }
    if (e.verb === 'move') {
      origin = cursorPath(e.atFrame, moveAt, [origin, destination])
      destination = point; moveAt = e.atFrame; settledAt = e.atFrame + 10
    } else if (e.verb === 'type') {
      texts[target.id] = typeOn(frame, e.atFrame, target.text ?? '')
    } else {
      if (e.atFrame < settledAt + 4 || destination.x !== point.x || destination.y !== point.y)
        throw new Error('cursor_path press needs a move to its target and four settled frames')
      press = { atFrame: e.atFrame, target: target.id, point, send: e.verb === 'send' }
    }
  }
  const cursor = cursorPath(frame, moveAt, [origin, destination])
  const age = press ? frame - press.atFrame : Infinity
  const next = press ? Math.min(object.toFrame, ...events.filter(e => e.obj === object.obj && e.atFrame > press.atFrame).map(e => e.atFrame)) : 0
  const focus = active.filter(e => e.verb === 'move').at(-1)?.toState
  return { params, cursor, texts, press, focus, out, enter: progress(frame - enter.atFrame, MOTION.enterFrames),
    scale: age < 2 ? 0.9 : 1,
    ripple: press && age < 10 ? { point: press.point, p: progress(age, 10) } : null,
    busy: press?.send ? progress(age, Math.max(1, Math.min(45, next - press.atFrame))) : 0 }
}
