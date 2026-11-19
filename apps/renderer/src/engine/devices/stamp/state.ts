import { FPS, MOTION, overshootEase, progress } from '../../clock'
import { overlayState } from '../../kit/overlay'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema } from './schema'

const heroSlapFrames = 0.12 * FPS
const heroSlapEase = overshootEase(6)

export function stampState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const s = overlayState(object, events, frame, 'stamp', MOTION.slapFrames)
  if (params.size === 'label') return { ...s, ...params, scale: 1.25 - 0.25 * s.enter }

  const enter = progress(s.age, heroSlapFrames, t => t)
  return { ...s, ...params, enter, opacity: enter * (1 - s.exit), scale: 1.35 - 0.35 * heroSlapEase(enter) }
}
