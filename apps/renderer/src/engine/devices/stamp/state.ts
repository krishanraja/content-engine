import { MOTION } from '../../clock'
import { overlayState } from '../../kit/overlay'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema } from './schema'
export function stampState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const s = overlayState(object, events, frame, 'stamp', MOTION.slapFrames)
  return { ...s, ...ParamsSchema.parse(object.params), scale: 1.25 - 0.25 * s.enter }
}
