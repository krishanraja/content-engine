import { MOTION } from '../../clock'
import { overlayState } from '../../kit/overlay'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema } from './schema'
export function stickerState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const s = overlayState(object, events, frame, 'enter', MOTION.dropFrames)
  const params = ParamsSchema.parse(object.params)
  return { ...s, ...params, rotation: params.tiltDeg + 12 * (1 - s.enter), drop: s.enter === 1 ? 0 : -60 * (1 - s.enter) }
}
