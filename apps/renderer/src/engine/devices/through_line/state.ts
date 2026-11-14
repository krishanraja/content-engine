import { MOTION, progress, stateAt } from '../../clock'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema, type NumberSchema } from './schema'
import type { z } from 'zod'

type SourcedNumber = z.infer<typeof NumberSchema>
const easeOut = (t: number) => 1 - (1 - t) ** 3
export const entranceFrames = () => Math.max(4, Math.min(7, MOTION.enterFrames))

/** Replay the entire object history, including earlier, interrupted transitions.
 * toState names a typed command in params.states; beat boundaries never reset it. */
export function throughLineState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const parts = params.parts.map(p => ({ ...p, opacity: 1, lit: 0 }))
  const connections: { from: string; to: string; amount: number }[] = []
  let focus: string | null = parts.find(p => p.number)?.id ?? null
  let camera = parts.map(() => 0)
  let annotation: string | undefined
  let annotationPart: string | null = null
  let visible = false, opacity = 0
  const checkNumber = (n: SourcedNumber) => {
    if (!object.dataset || !object.dataset.rows.some(row => row.value === n.value) || !object.dataset.producerLabel.includes(n.producer))
      throw new Error('through_line numbers require a matching dataset value and producer')
  }
  for (const p of parts) if (p.number) checkNumber(p.number)
  // Each transition starts from the state actually reached at its cue, not its old target.
  const transitions: { at: number; duration: number; apply: (t: number) => void }[] = []
  const sample = (at: number) => { for (const t of transitions) t.apply(progress(at - t.at, t.duration, easeOut)) }
  for (const e of fired) {
    sample(e.atFrame)
    if (e.verb === 'enter' || e.verb === 'exit') {
      visible = true
      const start = opacity, end = e.verb === 'enter' ? 1 : 0
      transitions.push({ at: e.atFrame, duration: entranceFrames(), apply: t => { opacity = start + (end - start) * t } })
      continue
    }
    if (e.verb === 'carry') continue
    const c = params.states[e.toState]
    if (!c || c.verb !== e.verb) throw new Error(`through_line invalid ${e.verb} command: ${e.toState}`)
    const i = parts.findIndex(p => p.id === c.part), part = parts[i]!
    if (c.annotation !== undefined) { annotation = c.annotation; annotationPart = c.part }
    if ('number' in c && c.number) {
      const number = c.number
      checkNumber(number)
      if (part.number && part.number.unit !== number.unit) throw new Error('through_line cannot change a part unit')
      const start = part.number?.value ?? 0
      part.number = { ...number, value: start }
      focus = part.id
      transitions.push({ at: e.atFrame, duration: 30, apply: t => { part.number = { ...number, value: start + (number.value - start) * t } } })
    }
    const animate = (duration: number, apply: (t: number) => void) => transitions.push({ at: e.atFrame, duration, apply })
    if (c.verb === 'thin') { const start = part.thickness; animate(30, t => { part.thickness = start + (c.thickness - start) * t }) }
    if (c.verb === 'grow') { const start = part.size; animate(30, t => { part.size = start + (c.size - start) * t }) }
    if (c.verb === 'multiply') {
      const start = part.count, end = start * c.factor
      if (end > 1000) throw new Error('through_line supports at most 1000 unit marks')
      animate(30, t => { part.count = start + (end - start) * t })
    }
    if (c.verb === 'drop') {
      if (c.count !== undefined) {
        const start = part.count, end = start - c.count
        if (end < 0) throw new Error('through_line cannot drop more marks than remain')
        animate(30, t => { part.count = start + (end - start) * t })
      } else { focus = part.id; const start = part.opacity; animate(entranceFrames(), t => { part.opacity = start * (1 - t) }) }
    }
    if (c.verb === 'light') { const start = part.lit; animate(entranceFrames(), t => { part.lit = start + (1 - start) * t }) }
    if (c.verb === 'connect') {
      const connection = { from: c.part, to: c.to, amount: 0 }; connections.push(connection)
      animate(30, t => { connection.amount = t })
    }
    if (c.verb === 'rest_on') {
      const start = [...camera]
      animate(entranceFrames(), t => { camera = start.map((v, j) => v + ((j === i ? 1 : 0) - v) * t) })
    }
  }
  sample(frame)
  return { obj: object.obj, parts, connections, focus, camera, annotation, annotationPart, opacity,
    visible: visible && opacity > 0 && frame >= object.fromFrame && frame < object.toFrame }
}
