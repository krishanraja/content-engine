import { ENTER, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { pointAlong, type Point } from '../../kit/focus'
import { SCRIBBLE } from '../../kit/lock'
import { scribblePath, type ScribbleSpec } from '../../kit/scribblePath'
import { ParamsSchema } from './schema'

export function scribbleState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const state = stateAt(events, object.obj, frame)
  const draw = state.fired.findLast(e => e.verb === 'draw')
  const current = state.fired.findLast(e => e.verb === 'draw' || e.verb === 'exit')
  const exiting = current?.verb === 'exit'
  let spec: ScribbleSpec
  if (params.shape === 'loop') {
    const t = params.target
    spec = { shape: 'loop', cx: params.cx ?? t!.x + t!.w / 2, cy: params.cy ?? t!.y + t!.h / 2,
      u: params.perspective?.u ?? params.u ?? [t!.w * 0.55, 0],
      v: params.perspective?.v ?? params.v ?? [0, t!.h * 0.55], turns: params.turns, sq: params.sq }
  } else if (params.shape === 'underline') {
    spec = params.target ? { ...params, target: params.target } : { ...params, from: params.from!, to: params.to! }
  } else spec = params
  return { visible: !!draw && frame >= object.fromFrame && frame < object.toFrame,
    d: scribblePath(spec, params.seed), colour: params.colour, exiting,
    sinceFrames: current ? stateAt([current], object.obj, frame).sinceFrames : 0 }
}

/** single-line-drawing's camera target (kit/focus.ts): the pen tip, frame by frame, in frame pixels. It runs along the
 *  very path Scribble draws, at the share its dash has drawn (the same ENTER curve over SCRIBBLE.draw_on_frames), so
 *  the camera and the line never part. Undefined before the first stroke and once the scribble is gone; after the
 *  stroke it rests on the line's end. */
export function scribblePen(object: EngineObject, events: readonly EngineEvent[]): (frame: number) => Point | undefined {
  const d = scribbleState(object, events, object.fromFrame).d
  return (frame: number) => {
    const state = stateAt(events, object.obj, frame)
    const current = state.fired.findLast(e => e.verb === 'draw' || e.verb === 'exit')
    if (!current || current.verb !== 'draw' || frame < object.fromFrame || frame >= object.toFrame) return undefined
    const drawn = progress(frame - current.atFrame, SCRIBBLE.draw_on_frames, ENTER)
    return drawn > 0 ? pointAlong(d, drawn) : undefined
  }
}
