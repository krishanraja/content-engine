import { ENTER, MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

const linear = (t: number) => t

export function evidenceState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  const entrance = fired.findLast((event) => event.verb === 'enter')
  const visibility = fired.findLast((event) => event.verb === 'enter' || event.verb === 'exit')
  const content = fired.findLast((event) => event.verb === 'fill' || event.verb === 'mark')
  const stamp = fired.findLast((event) => event.verb === 'stamp')
  // A stamp is permanent. A later mark adds replacement text to the struck card.
  const struck = !!stamp
  const collapse = stamp ? progress(stateAt([stamp], object.obj, frame).sinceFrames, MOTION.exitFrames, linear) : 0
  const text = content?.verb === 'mark' ? content.toState : content ? (params.quote ?? '') : ''
  const chars = [...text]
  const timeline = stateAt(events, object.obj, Infinity).fired
  const next = content ? timeline[timeline.indexOf(content) + 1] : undefined
  const duration = content?.verb === 'fill'
    ? Math.max(0, Math.min(Math.ceil(chars.length / 2), (next?.atFrame ?? Infinity) - content.atFrame - 6))
    : Math.max(1, chars.length)
  const typingFrame = stamp && content?.verb === 'fill' && content.atFrame <= stamp.atFrame ? Math.min(frame, stamp.atFrame) : frame
  const typed = content ? duration === 0 ? 1 : progress(stateAt([content], object.obj, typingFrame).sinceFrames, duration, linear) : 0
  const still = (params.kind === 'screenshot' || params.kind === 'document') && content?.verb !== 'mark'
  return {
    params,
    visible: frame >= object.fromFrame && frame < object.toFrame && visibility?.verb === 'enter',
    enter: entrance ? progress(stateAt([entrance], object.obj, frame).sinceFrames, MOTION.enterFrames, ENTER) : 0,
    fullText: text, replacement: content?.verb === 'mark',
    text: chars.slice(0, Math.floor(typed * chars.length)).join(''),
    struck, collapse,
    media: !!entrance && !!params.src && (still || (params.kind === 'recording' && content?.verb === 'fill')) && collapse < 1,
    playbackFrom: content?.verb === 'fill' ? content.atFrame : null,
  }
}
