import { MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'

export function washState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const state = stateAt(events, object.obj, frame)
  const enter = state.fired.findLast(e => e.verb === 'enter')
  const fired = state.fired.filter(e => !enter || e.atFrame >= enter.atFrame)
  const exit = fired.findLast(e => e.verb === 'exit')
  const amount = (event: EngineEvent | undefined, duration = MOTION.enterFrames) => !event ? 0 :
    event.atFrame < 0 ? 1 : progress(frame - event.atFrame, Math.min(18, duration))
  return { visible: !!enter && frame >= object.fromFrame && frame < object.toFrame,
    bloom: amount(enter), dry: amount(exit, MOTION.exitFrames), fired, amount }
}
