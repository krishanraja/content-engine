import { BACK, MOTION, drift, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'
const linear = (t: number) => t

export function videoWallState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const entered = fired.findLast(e => e.verb === 'enter')
  // Recover the actual cue: opening walls still populate tile by tile, never all at frame zero.
  const enter = entered && events.find(e => e.id === entered.id && e.obj === object.obj)
  const starts = params.clips.map(() => Infinity)
  const add = (target: string, at: number) => {
    if (target === 'wall') {
      let order = 0
      starts.forEach((start, i) => { if (start > at) starts[i] = Math.min(start, at + order++ * params.intervalFrames) })
      return
    }
    const index = target === 'next' || target === 'visible' ? starts.findIndex(s => s > at) : params.clips.findIndex(c => c.id === target)
    if (index < 0) {
      if (target === 'next' || target === 'visible') return
      throw new Error(`video_wall: unknown clip ${target}`)
    }
    starts[index] = Math.min(starts[index]!, at)
  }
  if (enter) add(enter.toState === 'visible' ? (params.mode === 'wall' ? 'wall' : 'next') : enter.toState, enter.atFrame)
  let dimAt: number | undefined
  for (const cue of fired) {
    if (!enter || cue.atFrame < enter.atFrame || cue.verb === 'enter') continue
    if (cue.verb === 'add') add(cue.toState, cue.atFrame)
    if (cue.verb === 'dim' && dimAt === undefined) dimAt = cue.atFrame
  }
  return {
    params,
    visible: !!enter && frame >= object.fromFrame && frame < object.toFrame,
    // The brief's one-third wall, reached over the active style's exit time.
    opacity: dimAt === undefined ? 1 : 1 - (2 / 3) * progress(frame - dimAt, MOTION.exitFrames, linear),
    push: 1 + drift(frame, object.fromFrame, object.toFrame),
    tiles: starts.map(start => ({ start, visible: frame >= start,
      slam: progress(frame - start, MOTION.enterFrames, BACK) })),
  }
}
