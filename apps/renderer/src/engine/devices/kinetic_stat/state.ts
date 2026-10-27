import { HERO, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

export function kineticState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  ParamsSchema.parse(object.params)
  const dataset = object.dataset
  if (!dataset || dataset.rows.length === 0) throw new Error('kinetic_stat requires a nonempty dataset')
  const { fired } = stateAt(events, object.obj, frame)
  const visibility = fired.findLast((event) => event.verb === 'enter' || event.verb === 'exit')
  const count = fired.findLast((event) => event.verb === 'count_to')
  // A row label selects another authored value; otherwise the first row is the hero.
  const row = dataset.rows.find((item) => item.label === count?.toState) ?? dataset.rows[0]!
  if (!Number.isFinite(row.value) || (dataset.denominator !== null && !Number.isFinite(dataset.denominator))) throw new Error('kinetic_stat requires finite values')
  const amount = count ? progress(stateAt([count], object.obj, frame).sinceFrames, 18, HERO) : 0
  // Whole-number targets count in whole numbers (3/3, never 2.57/3); decimals keep the target's precision.
  const places = Number.isInteger(row.value) ? 0 : Math.min(2, (String(row.value).split('.')[1] ?? '').length)
  const value = amount === 1 ? row.value : Math.round(row.value * amount * 10 ** places) / 10 ** places
  return {
    visible: frame >= object.fromFrame && frame < object.toFrame && visibility?.verb === 'enter',
    value, target: row.value, unit: dataset.unit, denominator: dataset.denominator, producerLabel: dataset.producerLabel,
    text: dataset.denominator === null ? String(value) : `${value}/${dataset.denominator}`,
  }
}
