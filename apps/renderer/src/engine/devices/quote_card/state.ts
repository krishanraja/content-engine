import { MOTION } from '../../clock'
import { overlayState } from '../../kit/overlay'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema } from './schema'
export function quoteCardState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const s = overlayState(object, events, frame, 'enter', MOTION.enterFrames)
  return { ...s, ...ParamsSchema.parse(object.params), rise: 24 * (1 - s.enter) }
}
