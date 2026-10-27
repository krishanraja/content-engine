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
  // Event order also defines same-frame commands: a mark after a stamp replaces it.
  const struck = !!stamp && (!content || fired.indexOf(stamp) > fired.indexOf(content))
  const collapse = struck ? progress(stateAt([stamp!], object.obj, frame).sinceFrames, MOTION.exitFrames, linear) : 0
  const text = content?.verb === 'mark' ? content.toState : content ? (params.quote ?? '') : ''
  const typingFrame = struck ? stamp!.atFrame : frame
  const typed = content ? progress(stateAt([content], object.obj, typingFrame).sinceFrames, Math.max(1, [...text].length), linear) : 0
  const still = (params.kind === 'screenshot' || params.kind === 'document') && content?.verb !== 'mark'
  return {
    params,
    visible: frame >= object.fromFrame && frame < object.toFrame && visibility?.verb === 'enter',
    enter: entrance ? progress(stateAt([entrance], object.obj, frame).sinceFrames, MOTION.enterFrames, ENTER) : 0,
    text: [...text].slice(0, Math.floor(typed * [...text].length)).join(''),
    struck, collapse,
    media: !!entrance && !!params.src && (still || (params.kind === 'recording' && content?.verb === 'fill')) && collapse < 1,
    playbackFrom: content?.verb === 'fill' ? content.atFrame : null,
  }
}
