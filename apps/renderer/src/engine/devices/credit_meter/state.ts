import { HERO, MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

export function creditState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params), dataset = object.dataset
  if (!dataset) throw new Error('credit_meter requires a dataset')
  const row = (name: string) => {
    const r = dataset.rows.find(r => r.label === name)
    if (!r || !Number.isSafeInteger(r.value) || r.value < 0) throw new Error('credit_meter requires nonnegative whole credits in named rows')
    return r.value
  }
  const plan = row(params.plan.row), bonus = row(params.bonus.row)
  if (!Number.isSafeInteger(plan + bonus) || plan + bonus === 0) throw new Error('credit_meter requires positive capacity')
  const { fired } = stateAt(events, object.obj, frame)
  const duration = Math.min(18, MOTION.countFrames)
  let base = 0, extra = 0, day = 1
  let cue: EngineEvent | undefined, from = [0, 0, 1], target = [0, 0, 1]
  const sample = (at: number) => {
    const p = cue ? progress(stateAt([cue], object.obj, at).sinceFrames, duration, HERO) : 1
    return target.map((v, i) => from[i]! + (v - from[i]!) * p)
  }
  for (const e of fired) {
    if (!['fill', 'add', 'drop', 'count_to'].includes(e.verb)) continue
    ;[base, extra, day] = sample(e.atFrame) as [number, number, number]
    from = [base, extra, day]; target = [...from]
    if (e.verb === 'fill' || e.verb === 'drop') {
      if (e.toState !== params.plan.row) throw new Error('fill/drop must select the plan row')
      target = [plan, 0, day]
    }
    if (e.verb === 'add') {
      if (e.toState !== params.bonus.row) throw new Error('add must select the bonus row')
      target = [base, bonus, day]
    }
    if (e.verb === 'count_to') {
      const d = Number(e.toState)
      if (!Number.isInteger(d) || d < 1 || d > params.days) throw new Error('day outside bonus life')
      target[2] = d
    }
    cue = e
  }
  ;[base, extra, day] = sample(frame) as [number, number, number]
  const visibility = fired.findLast(e => e.verb === 'enter' || e.verb === 'exit')
  const vp = visibility ? progress(stateAt([visibility], object.obj, frame).sinceFrames,
    Math.min(18, visibility.verb === 'exit' ? MOTION.exitFrames : MOTION.enterFrames)) : 0
  const opacity = visibility?.verb === 'exit' ? 1 - vp : vp
  const mark = fired.findLast(e => e.verb === 'mark')
  return { params, base, extra, day: Math.round(day), capacity: plan + bonus,
    value: Math.round(base + extra), unit: dataset.unit, producer: dataset.producerLabel,
    opacity, visible: frame >= object.fromFrame && frame < object.toFrame && opacity > 0,
    mark: mark ? progress(stateAt([mark], object.obj, frame).sinceFrames, Math.min(18, MOTION.slideFrames)) : 0 }
}
