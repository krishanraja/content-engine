import { MOTION, drift, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

const linear = (t: number) => t
const scales = [1.55, 1.30, 1, 0.965, 1.012, 1] as const
const opacity = [0, 0.7, 1, 1, 1, 1] as const
function slapValue(p: number, values: readonly number[]) {
  const segment = p * (values.length - 1)
  const index = Math.min(values.length - 2, Math.floor(segment))
  return values[index]! + (values[index + 1]! - values[index]!) * (segment - index)
}

export function passportState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  const entrance = fired.findLast((event) => event.verb === 'enter')
  const visibility = fired.findLast((event) => event.verb === 'enter' || event.verb === 'exit')
  const since = (event: EngineEvent) => stateAt([event], object.obj, frame).sinceFrames
  const exit = visibility?.verb === 'exit' ? progress(since(visibility), MOTION.exitFrames) : 0
  const cycle = fired.filter((event) => entrance && event.atFrame >= entrance.atFrame)
  return {
    params,
    visible: !!entrance && frame >= object.fromFrame && frame < object.toFrame && exit < 1,
    enter: entrance ? progress(since(entrance), MOTION.enterFrames) : 0, exit,
    drift: entrance ? drift(frame, entrance.atFrame, object.toFrame) : 0,
    fields: params.fields.map((field) => {
      const stamp = cycle.findLast((event) => event.verb === 'stamp' && event.toState === field.id)
      const mark = cycle.findLast((event) => event.verb === 'mark' && event.toState === field.id)
      const p = stamp ? progress(since(stamp), MOTION.slapFrames, linear) : 1
      return { ...field, visible: field.state !== 'stamped' || !!stamp,
        scale: slapValue(p, scales), opacity: slapValue(p, opacity), tilt: field.tiltDeg + 10 * (1 - p),
        marked: !!mark, markProgress: mark ? progress(since(mark), MOTION.enterFrames) : 0 }
    }),
  }
}

/** Fixed-width machine-readable text, never an assertion about physical residence. */
export function mrzLine(text: string) {
  return text.toUpperCase().replace(/[^A-Z0-9<]/g, '<').slice(0, 42).padEnd(42, '<')
}
