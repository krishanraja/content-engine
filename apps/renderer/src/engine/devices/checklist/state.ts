import { MOTION, motionProfile, overshootEase, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

// Card-specific reference timings: blank slots two frames apart, state dissolve eight frames.
export const SLOT_STAGGER = 2
export const FILL_FRAMES = 8
const tickEase = overshootEase(20)
const linear = (t: number) => t

export function checklistState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const dataset = object.dataset
  if (!dataset || dataset.rows.length !== params.slots.length ||
    new Set(dataset.rows.map(row => row.label)).size !== params.slots.length ||
    new Set(dataset.rows.map(row => row.value)).size !== params.slots.length ||
    params.slots.some(slot => !dataset.rows.some(row => row.label === slot.id && Number.isInteger(row.value) && row.value > 0))) {
    throw new Error('checklist needs one unique positive ordinal per slot in dataset.rows and its producerLabel')
  }
  const { fired } = stateAt(events, object.obj, frame)
  const entrance = fired.findLast(event => event.verb === 'enter')
  const visibility = fired.findLast(event => event.verb === 'enter' || event.verb === 'exit')
  const exit = visibility?.verb === 'exit' ? progress(stateAt([visibility], object.obj, frame).sinceFrames, FILL_FRAMES, linear) : 0
  const sinceEnter = entrance ? stateAt([entrance], object.obj, frame).sinceFrames : -Infinity
  return {
    visible: frame >= object.fromFrame && frame < object.toFrame && !!entrance && exit < 1,
    exit, producerLabel: dataset.producerLabel, unit: dataset.unit, denominator: dataset.denominator,
    slots: params.slots.map((slot, index) => {
      // Re-entry starts a fresh blank checklist. Repeated fill cues leave a completed slot intact.
      const fill = entrance ? fired.find(event => event.verb === 'fill' && event.toState === slot.id && event.atFrame >= entrance.atFrame) : undefined
      const dissolve = fill ? progress(stateAt([fill], object.obj, frame).sinceFrames, FILL_FRAMES, linear) : 0
      const dim = entrance ? fired.find(event => event.verb === 'dim' && event.toState === slot.id &&
        event.atFrame >= entrance.atFrame && (!fill || event.atFrame < fill.atFrame)) : undefined
      const work = dim ? progress(stateAt([dim], object.obj, frame).sinceFrames, 6, linear) : 0
      // Look ahead only to size this one draw; a later entrance belongs to another checklist.
      const scheduled = stateAt(events, object.obj, Infinity).fired
      const nextEnter = scheduled.find(event => event.verb === 'enter' && event.atFrame > (entrance?.atFrame ?? Infinity))
      const nextFill = dim ? scheduled.find(event => event.verb === 'fill' && event.toState === slot.id &&
        event.atFrame >= dim.atFrame && (!nextEnter || event.atFrame < nextEnter.atFrame)) : undefined
      const hairline = dim ? progress(stateAt([dim], object.obj, frame).sinceFrames,
        Math.max(1, Math.min(30, nextFill ? nextFill.atFrame - dim.atFrame : 30)), linear) : 0
      const tickScale = fill && motionProfile()
        ? Math.min(1.2, progress(stateAt([fill], object.obj, frame).sinceFrames, 6, tickEase)) : 1
      return { id: slot.id, number: dataset.rows.find(row => row.label === slot.id)!.value,
        line: fill ? slot.line : '', filled: !!fill, dissolve,
        workOpacity: 1 - 0.58 * work, numberOpacity: 1 - 0.58 * work * (1 - dissolve), hairline, tickScale,
        arrival: progress(sinceEnter - index * SLOT_STAGGER, Math.min(7, MOTION.enterFrames), linear) }
    }),
  }
}
