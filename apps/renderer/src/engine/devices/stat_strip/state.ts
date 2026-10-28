import { MOTION, progress, stateAt } from '../../clock'
import { overlayState } from '../../kit/overlay'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema } from './schema'
export function statStripState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const s = overlayState(object, events, frame)
  const params = ParamsSchema.parse(object.params)
  const count = s.fired.findLast(e => e.verb === 'count_to' && e.atFrame >= (s.entrance?.atFrame ?? Infinity))
  const row = count && object.dataset?.rows.find(r => r.label === count.toState)
  if (count && object.dataset && !row) throw new Error('count_to must name a dataset row')
  const numeral = count ? (row ? String(row.value) : count.toState) : params.numeral
  const slap = count ? progress(stateAt([count], object.obj, frame).sinceFrames, MOTION.slapFrames) : 1
  return { ...s, ...params, numeral, unit: object.dataset?.unit ?? params.unit, scale: 1.25 - 0.25 * slap }
}
