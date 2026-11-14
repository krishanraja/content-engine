import { BACK, EXIT, MOTION, drift, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

// Card ve-gap-takeover-1: exactly three split frames, once per entrance, never a loop.
export const FLICKER_OFFSETS = [12, -8, 4] as const
const linear = (t: number) => t

export function takeoverState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  const entrance = fired.findLast(e => e.verb === 'enter')
  const visibility = fired.findLast(e => e.verb === 'enter' || e.verb === 'exit')
  const age = entrance ? stateAt([entrance], object.obj, frame).sinceFrames : -1
  const exit = visibility?.verb === 'exit'
    ? progress(stateAt([visibility], object.obj, frame).sinceFrames, MOTION.exitFrames, EXIT) : 0
  const visible = !!entrance && frame >= object.fromFrame && frame < object.toFrame && exit < 1
  const split = visible && exit === 0 && age >= 0 && age < FLICKER_OFFSETS.length
    ? FLICKER_OFFSETS[age as 0 | 1 | 2] : 0
  // The streak follows the flicker. Its single linear pass uses the active profile's entrance duration.
  const streak = progress(age - FLICKER_OFFSETS.length, MOTION.enterFrames, linear)
  return { ...params, visible, age, exit, split,
    enter: progress(age, MOTION.enterFrames, BACK),
    streak, streakVisible: visible && exit === 0 && age >= FLICKER_OFFSETS.length && streak < 1,
    push: 1 + drift(frame, object.fromFrame, object.toFrame, Math.min(MOTION.driftPct, 1.5)),
  }
}
