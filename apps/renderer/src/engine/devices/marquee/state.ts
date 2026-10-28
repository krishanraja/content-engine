import { overlayState } from '../../kit/overlay'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema } from './schema'
export function marqueeState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  return { ...overlayState(object, events, frame), ...ParamsSchema.parse(object.params), offset: Math.max(0, frame - object.fromFrame) * 2 }
}
