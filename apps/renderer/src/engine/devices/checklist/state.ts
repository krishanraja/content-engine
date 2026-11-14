import { MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

// Card-specific reference timings: blank slots two frames apart, state dissolve eight frames.
export const SLOT_STAGGER = 2
export const FILL_FRAMES = 8
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
      return { id: slot.id, number: dataset.rows.find(row => row.label === slot.id)!.value,
        line: fill ? slot.line : '', filled: !!fill, dissolve,
        arrival: progress(sinceEnter - index * SLOT_STAGGER, Math.min(7, MOTION.enterFrames), linear) }
    }),
  }
}
