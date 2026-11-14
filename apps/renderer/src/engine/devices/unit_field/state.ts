import { progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

// The signed style's semantic dissolve and the card's copy cadence, independent of house entrances.
export const CHANGE_FRAMES = 10
export const COPY_STEP_FRAMES = 2
const MAX_MARKS = 1000
const linear = (t: number) => t
interface Mark {
  id: number; weight: number; source: number; bornAt?: number; dropAt?: number; greyAt?: number | undefined
}

export function unitFieldState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const dataset = object.dataset
  if (!dataset || !dataset.unit.trim()) throw new Error('unit_field requires a dataset, unit and producerLabel')
  const row = (label: string) => {
    const matches = dataset.rows.filter(r => r.label === label)
    if (matches.length !== 1 || !Number.isFinite(matches[0]!.value)) throw new Error(`unit_field needs one finite dataset row: ${label}`)
    return matches[0]!.value
  }
  const initial = row(params.initialRow)
  if (!Number.isInteger(initial) || initial < 1 || initial > MAX_MARKS) throw new Error('unit_field initial count must be an integer from 1 to 1000')
  const { fired } = stateAt(events, object.obj, frame)
  const entrance = fired.findLast(e => e.verb === 'enter')
  const cues = fired.filter(e => e.atFrame >= (entrance?.atFrame ?? Infinity))
  const latestVisibility = cues.findLast(e => e.verb === 'enter' || e.verb === 'exit')
  const fade = (at: number) => progress(frame - at, CHANGE_FRAMES, linear)
  const enter = entrance ? fade(entrance.atFrame) : 0
  const exit = latestVisibility?.verb === 'exit' ? fade(latestVisibility.atFrame) : 0
  const marks: Mark[] = Array.from({ length: initial }, (_, id) => ({ id, weight: 1, source: id }))
  for (const cue of cues) {
    if (!['drop', 'grey', 'multiply'].includes(cue.verb)) continue
    const value = row(cue.toState)
    const live = marks.filter(m => m.dropAt === undefined)
    const total = live.reduce((n, m) => n + m.weight, 0)
    if (cue.verb === 'multiply') {
      if (value < 1) throw new Error('unit_field multiply expects a factor >= 1')
      const extra = total * (value - 1)
      const count = Math.ceil(Number(extra.toFixed(10)))
      if (marks.length + count > MAX_MARKS) throw new Error('unit_field exceeds 1000 marks')
      for (let i = 0; i < count; i++) {
        const source = live[i % live.length]!
        marks.push({ id: marks.length, weight: Math.min(1, extra - i), source: source.id,
          bornAt: cue.atFrame + i * COPY_STEP_FRAMES,
          greyAt: source.greyAt === undefined ? undefined : cue.atFrame + i * COPY_STEP_FRAMES })
      }
    } else {
      // Whole marks only: a fractional unit cannot silently become a full unit on a later loss.
      if (!Number.isInteger(value) || value < 0) throw new Error('unit_field drop/grey expects a whole unit count')
      const candidates = live.filter(m => m.weight === 1 && (cue.verb !== 'grey' || m.greyAt === undefined)).reverse()
      if (value > candidates.length) throw new Error('unit_field action exceeds available whole units')
      for (const mark of candidates.slice(0, value)) {
        if (cue.verb === 'drop') mark.dropAt = cue.atFrame
        else mark.greyAt = cue.atFrame
      }
    }
  }
  const drawn = marks.map(m => {
    const birth = m.bornAt === undefined ? 1 : fade(m.bornAt)
    const drop = m.dropAt === undefined ? 0 : fade(m.dropAt)
    const grey = m.greyAt === undefined ? 0 : fade(m.greyAt)
    return { ...m, birth, drop, grey, amount: m.weight * birth * (1 - drop) }
  })
  return { ...params, marks: drawn, count: drawn.reduce((n, m) => n + m.amount, 0),
    producer: dataset.producerLabel, unit: dataset.unit, denominator: dataset.denominator,
    opacity: enter * (1 - exit), visible: !!entrance && frame >= object.fromFrame && frame < object.toFrame && exit < 1 }
}
