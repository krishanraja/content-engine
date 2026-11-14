import { HERO, MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

export function kineticState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const dataset = object.dataset
  if (!dataset || dataset.rows.length === 0) throw new Error('kinetic_stat requires a nonempty dataset')
  const { fired } = stateAt(events, object.obj, frame)
  const visibility = fired.findLast((event) => event.verb === 'enter' || event.verb === 'exit')
  const count = fired.findLast((event) => event.verb === 'count_to')
  // A row label selects another authored value; otherwise the first row is the hero.
  const row = dataset.rows.find((item) => item.label === count?.toState) ?? dataset.rows[0]!
  if (!Number.isFinite(row.value) || (dataset.denominator !== null && !Number.isFinite(dataset.denominator))) throw new Error('kinetic_stat requires finite values')
  const amount = count ? progress(stateAt([count], object.obj, frame).sinceFrames, MOTION.countFrames, HERO) : 0
  // Whole-number targets count in whole numbers (3/3, never 2.57/3); decimals keep the target's precision.
  const places = Number.isInteger(row.value) ? 0 : Math.min(2, (String(row.value).split('.')[1] ?? '').length)
  let value = amount === 1 ? row.value : Math.round(row.value * amount * 10 ** places) / 10 ** places
  let ghostValue: number | null = null
  if (params.ghost) {
    // Replay authored counts, sampling the preceding animation at each new cue.
    // This also preserves the actual displayed value when a count is interrupted.
    let from = 0
    let target = 0
    let cue: EngineEvent | undefined
    const sample = (at: number) => {
      if (!cue) return 0
      const p = progress(stateAt([cue], object.obj, at).sinceFrames, MOTION.countFrames, HERO)
      const precision = Number.isInteger(target) ? 0 : Math.min(2, (String(target).split('.')[1] ?? '').length)
      return p === 1 ? target : Math.round((from + (target - from) * p) * 10 ** precision) / 10 ** precision
    }
    for (const event of fired) {
      if (event.verb === 'enter' || event.verb === 'exit') ghostValue = null
      if (event.verb !== 'count_to') continue
      from = sample(event.atFrame)
      target = (dataset.rows.find(item => item.label === event.toState) ?? dataset.rows[0]!).value
      if (!Number.isFinite(target)) throw new Error('kinetic_stat requires finite values')
      cue = event
      if (target < from && frame > event.atFrame) ghostValue = from
    }
    value = sample(frame)
  }
  const format = (n: number) => dataset.denominator === null ? String(n) : `${n}/${dataset.denominator}`
  return {
    visible: frame >= object.fromFrame && frame < object.toFrame && visibility?.verb === 'enter',
    value, target: row.value, unit: dataset.unit, denominator: dataset.denominator, producerLabel: dataset.producerLabel,
    text: dataset.denominator === null ? String(value) : `${value}/${dataset.denominator}`,
    ghostText: ghostValue === null ? null : format(ghostValue),
  }
}
