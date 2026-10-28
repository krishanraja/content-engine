import { stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
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
