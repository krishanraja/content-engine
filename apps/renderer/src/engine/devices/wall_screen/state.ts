import { EXIT, MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

// Card-specific semantic timings: light 8f, camera 18f, highlighter 12f.
// The symmetric camera curve deliberately avoids the house ease-out hero push.
const easeInOut = (t: number) => t * t * (3 - 2 * t)
export function wallState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.findLast(e => e.verb === 'enter')
  const cues = fired.filter(e => e.atFrame >= (enter?.atFrame ?? Infinity))
  let from = 0, target = 0, moveAt = -Infinity
  const cameraAt = (at: number): number => Number.isFinite(moveAt)
    ? from + (target - from) * progress(at - moveAt, 18, easeInOut) : target
  for (const cue of cues) {
    if (cue.verb !== 'move') continue
    if (cue.toState !== 'full' && cue.toState !== 'wall') throw new Error(`wall_screen: unknown move ${cue.toState}`)
    from = cameraAt(cue.atFrame)
    target = cue.toState === 'full' ? 1 : 0
    moveAt = cue.atFrame
  }
  const mark = cues.find(e => e.verb === 'mark')
  const exit = cues.findLast(e => e.verb === 'exit')
  const fade = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  return { params, full: cameraAt(frame),
    visible: !!enter && frame >= object.fromFrame && frame < object.toFrame && fade < 1,
    light: (enter ? progress(frame - enter.atFrame, 8, t => t) : 0) * (1 - fade),
    highlight: mark ? progress(frame - mark.atFrame, 12, t => t) : 0,
    underline: mark ? progress(frame - mark.atFrame - 12, 10, t => t) : 0,
  }
}
export function pageRect(wall: {x: number; y: number; w: number; h: number; skew?: number}, full: number) {
  return { x: wall.x * (1 - full), y: wall.y * (1 - full),
    w: wall.w + (1 - wall.w) * full, h: wall.h + (1 - wall.h) * full,
    skew: (wall.skew ?? 0) * (1 - full) + 0 }
}
