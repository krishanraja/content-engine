import { EXIT, FPS, MOTION, progress, stateAt } from '../../clock'
import { typeOn } from '../../kit/verbs'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'

export function codeState({ object, events, frame, aspect }: Pick<DeviceProps, 'object' | 'events' | 'frame' | 'aspect'>) {
  const params = ParamsSchema.parse(object.params)
  for (const line of params.lines) if (Array.from(line.text).length > (aspect === '9:16' ? 30 : 56))
    throw new Error(`code_card line ${line.id} exceeds ${aspect} character limit`)
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const exit = active.filter(e => e.verb === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out === 1) return null
  const starts = new Map<string, number>()
  let end = enter.atFrame
  for (const e of active) {
    if (e.verb !== 'type' && e.verb !== 'highlight') continue
    const line = params.lines.find(l => l.id === e.toState)
    if (!line) throw new Error(`code_card unknown line ${e.toState}`)
    if (e.verb === 'type') {
      if (!line.typed) throw new Error(`code_card line ${line.id} is not typed`)
      if (starts.has(line.id)) continue
      const start = Math.max(end, e.atFrame)
      starts.set(line.id, start)
      end = start + Math.ceil(Array.from(line.text).length * FPS / 30)
    }
  }
  const highlighted = active.filter(e => e.verb === 'highlight').at(-1)?.toState
  const rows = params.lines.map(line => {
    const start = starts.get(line.id)
    const text = !line.typed ? line.text : start === undefined ? '' : typeOn(frame, start, line.text)
    const caret = start !== undefined && frame >= start && text !== line.text
    return { ...line, text, start, caret, opacity: highlighted && highlighted !== line.id ? 0.4 : 1 }
  })
  return { params, rows, highlighted, enter: progress(frame - enter.atFrame, MOTION.enterFrames), out }
}
