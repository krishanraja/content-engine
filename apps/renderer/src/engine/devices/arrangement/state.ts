import { z } from 'zod'
import { stateAt, progress, MOTION } from '../../clock'
import type { DeviceProps } from '../types'
import { Kind, ParamsSchema } from './schema'
const Payload = z.object({ lane: z.string(), text: z.string().optional(), tag: z.string().optional(), who: z.string().optional(), pin: z.boolean().optional(), layers: z.array(z.object({ kind: Kind, weight: z.number().positive() })).optional() })
export function arrangementState({ object, events, frame }: Pick<DeviceProps, 'object'|'events'|'frame'>) {
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const params = ParamsSchema.parse(object.params)
  const lanes = params.lanes.map(l => ({ ...l, visible: !l.hidden, pin: false, tag: '', credit: l.who ?? '', at: enter.atFrame,
    removed: false, layers: l.kind === 'both' ? [{kind: 'human', weight: 0.85}, {kind: 'ai', weight: 0.15}] : [{kind: l.kind, weight: 1}] }))
  let solo = '', zoom = 1, x = 0.5, moveAt = enter.atFrame, oldZoom = 1, oldX = 0.5, out = 0, prompt: {text: string; lane: string; p: number} | null = null
  let countAt = enter.atFrame
  for (const e of fired.filter(e => e.atFrame >= enter.atFrame)) {
    if (e.verb === 'exit') out = progress(frame - e.atFrame, MOTION.exitFrames)
    if (e.verb === 'highlight') solo = e.toState === 'all' ? '' : e.toState
    if (e.verb === 'move') {
      if (e.toState === 'count') { countAt = e.atFrame; continue }
      const m = z.object({zoom: z.number().min(1).max(3), x: z.number().min(0).max(1).optional()}).parse(JSON.parse(e.toState))
      oldZoom = zoom; oldX = x; zoom = m.zoom; x = m.x ?? 0.5; moveAt = e.atFrame; continue
    }
    if (!['add','type','stamp','mark','fill','chip'].includes(e.verb)) continue
    const p = e.toState.startsWith('{') ? Payload.parse(JSON.parse(e.toState)) : {lane: e.toState}
    const l = lanes.find(l => l.id === p.lane)
    if (!l) throw new Error(`Unknown arrangement lane: ${p.lane}`)
    if (e.verb === 'add') { l.visible = true; l.removed = false; l.at = e.atFrame }
    if (e.verb === 'type') {
      const text = p.text ?? ''; const elapsed = frame - e.atFrame
      const typed = Array.from(text).slice(0, Math.floor(elapsed * 2)).join('')
      const fly = progress(elapsed - Math.ceil(Array.from(text).length / 2), MOTION.slideFrames)
      prompt = fly < 1 ? {text: typed, lane: l.id, p: fly} : null
      if (fly === 1) { l.visible = true; l.removed = false; l.at = e.atFrame + Math.ceil(Array.from(text).length / 2) + MOTION.slideFrames }
    }
    if (e.verb === 'mark') { if (p.pin) l.pin = true; else { l.removed = true; l.at = e.atFrame } }
    if (e.verb === 'stamp') { l.tag = p.tag ?? ''; l.at = e.atFrame }
    if (e.verb === 'chip') l.credit = p.who ?? ''
    if (e.verb === 'fill' && p.layers) l.layers = p.layers
  }
  return { params, lanes, solo, prompt, out, enter: progress(frame - enter.atFrame, MOTION.enterFrames), enterAt: enter.atFrame,
    zoom: oldZoom + (zoom - oldZoom) * progress(frame - moveAt, MOTION.slideFrames, t => t*t*(3-2*t)),
    x: oldX + (x-oldX)*progress(frame-moveAt, MOTION.slideFrames), countAt }
}
