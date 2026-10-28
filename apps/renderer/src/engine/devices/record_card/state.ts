import { MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

export function recordState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  const entrance = fired.findLast((event) => event.verb === 'enter')
  const visibility = fired.findLast((event) => event.verb === 'enter' || event.verb === 'exit')
  const fields = params.fields.map((field) => {
    const stamp = fired.findLast((event) => event.verb === 'stamp' && event.toState.startsWith(`${field.key}=`))
    const slap = stamp ? progress(stateAt([stamp], object.obj, frame).sinceFrames, MOTION.slapFrames) : 1
    return { ...field, value: stamp ? stamp.toState.slice(field.key.length + 1) : field.value, scale: 1 + 0.12 * (1 - slap), stamped: !!stamp }
  })
  return {
    visible: frame >= object.fromFrame && frame < object.toFrame && visibility?.verb === 'enter',
    drop: entrance ? progress(stateAt([entrance], object.obj, frame).sinceFrames, MOTION.dropFrames) : 0,
    fields,
  }
}
