import { drift, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

// Producer: ve-gap-slam-word-1 / Character.ai study. The slam is an explicit
// three-frame exception to normal entrances; exits use the style's 8-frame dissolve.
export const SLAM = { landingFrames: 3, fadeFrames: 8, endOpacity: 0.3, burstFrames: 24, slips: 24 } as const
const linear = (t: number) => t

/** Local seeded PRNG; only the persistent object id supplies entropy. */
export function burstFor(id: string) {
  let seed = 2166136261
  for (const char of id) seed = Math.imul(seed ^ char.codePointAt(0)!, 16777619) >>> 0
  const sample = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let n = Math.imul(seed ^ (seed >>> 15), seed | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
  return Array.from({ length: SLAM.slips }, () => ({
    angle: sample() * Math.PI * 2,
    reach: 0.55 + sample() * 0.45,
    rotation: sample() * 360,
    spin: (sample() - 0.5) * 540,
    width: 8 + sample() * 8,
    height: 16 + sample() * 12,
    tone: (['mint', 'cream', 'channel'] as const)[Math.floor(sample() * 3)]!,
  }))
}

export function slamWordState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const state = stateAt(events, object.obj, frame)
  const enter = state.fired.filter(e => e.verb === 'enter').at(-1)
  const exit = state.current?.verb === 'exit' && enter && state.current.atFrame >= enter.atFrame ? state.current : undefined
  const age = enter ? frame - enter.atFrame : -1
  const land = progress(age, SLAM.landingFrames, linear)
  const burst = progress(age - SLAM.landingFrames, SLAM.burstFrames, linear)
  const fade = exit ? progress(frame - exit.atFrame, SLAM.fadeFrames, linear) : 0
  return {
    ...params,
    visible: Boolean(enter) && frame >= object.fromFrame && frame < object.toFrame,
    scale: 2.5 - 1.5 * land,
    opacity: fade === 1 ? SLAM.endOpacity : 1 - (1 - SLAM.endOpacity) * fade,
    // A single bounded travel, not a looping ticker. Duplicate tape copy covers its travel.
    tapeDrift: enter ? drift(frame, Math.max(object.fromFrame, enter.atFrame), object.toFrame, 100) * 120 : 0,
    burst,
    burstVisible: Boolean(enter) && age >= SLAM.landingFrames && burst < 1,
    slips: burstFor(object.obj),
  }
}
