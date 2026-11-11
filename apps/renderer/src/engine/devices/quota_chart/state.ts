import { MOTION, progress, stateAt } from '../../clock'
import { overlayState } from '../../kit/overlay'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema } from './schema'

export function quotaState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const p = ParamsSchema.parse(object.params)
  const visibility = overlayState(object, events, frame)
  const cues = visibility.fired.filter(e => e.atFrame >= (visibility.entrance?.atFrame ?? Infinity))
  const last = (verb: string) => cues.findLast(e => e.verb === verb)
  const amount = (verb: string, duration: number, delay = 0) => {
    const e = last(verb)
    return e ? progress(stateAt([e], object.obj, frame).sinceFrames - delay, duration) : 0
  }
  if (last('move') && last('move')!.toState !== 'half') throw new Error('quota_chart move expects half')
  // The card specifies an 18-frame semantic transition, independent of entrance style.
  const move = amount('move', 18), fill = amount('fill', MOTION.countFrames)
  const mark = amount('mark', MOTION.slideFrames)
  const target = p.target + (p.halfTarget - p.target) * move
  const oldBin = Math.min(p.bins.length - 1, Math.floor(p.target * p.bins.length))
  const newBin = Math.min(p.bins.length - 1, Math.floor(p.halfTarget * p.bins.length))
  const sales = amount('count_to', MOTION.countFrames)
  const lift = amount('count_to', MOTION.countFrames, MOTION.countFrames)
  return { ...visibility, ...p, target, move, mark, fill, draw: amount('draw', MOTION.slideFrames),
    bars: p.bins.map((value, i) => ({ x: (i + 0.5 + (i === oldBin ? newBin - oldBin : i >= newBin && i < oldBin ? 1 : 0) * move) / p.bins.length,
      solid: value * fill * (1 - p.junkShare * mark), junk: value * fill * p.junkShare * mark * (1 - amount('move', 18, Math.min(i * 3, 22))) })),
    sales: [sales, sales * (1 + p.salesLift * lift)], lift,
  }
}
