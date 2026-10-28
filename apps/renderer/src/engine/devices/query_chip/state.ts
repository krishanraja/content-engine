import { EXIT, MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

export function queryState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const { text } = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  const entrance = fired.findLast((event) => event.verb === 'enter')
  const visibility = fired.findLast((event) => event.verb === 'enter' || event.verb === 'exit')
  const highlight = fired.findLast((event) => event.verb === 'highlight' && event.atFrame >= (entrance?.atFrame ?? Infinity))
  const enter = entrance ? progress(stateAt([entrance], object.obj, frame).sinceFrames, MOTION.slideFrames) : 0
  const exit = visibility?.verb === 'exit' ? progress(stateAt([visibility], object.obj, frame).sinceFrames, MOTION.exitFrames, EXIT) : 0
  const age = highlight ? stateAt([highlight], object.obj, frame).sinceFrames : -1
  // Two clamped legs give exactly one pulse, with its peak at frame four.
  const pulse = age < 0 ? 0 : age <= 4 ? progress(age, 4) : 1 - progress(age - 4, 4)
  return { text, visible: !!entrance && frame >= object.fromFrame && frame < object.toFrame && exit < 1, enter, exit, scale: 1 + 0.05 * pulse }
}
