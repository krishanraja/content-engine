import { drift, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

// eating-jobs-ladder.card.json: changes crossfade over 10 frames, highlights sweep in 3 per word.
const CROSSFADE_FRAMES = 10
const SWEEP_FRAMES = 3
const linear = (t: number) => t

export function pullQuoteState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  const show = fired.find(e => e.verb === 'enter' && e.toState === 'visible')
  const cueProgress = (cue: EngineEvent | undefined, duration: number) => cue
    ? progress(stateAt([cue], object.obj, frame).sinceFrames, duration, linear) : 0
  const attribution = fired.find(e => e.verb === 'enter' && e.toState === 'attribution')
  if (/\d/.test(params.quote) && !object.dataset) throw new Error('pull_quote numeric evidence requires a dataset and producerLabel')
  return {
    ...params,
    visible: !!show && frame >= object.fromFrame && frame < object.toFrame,
    opacity: cueProgress(show, CROSSFADE_FRAMES),
    push: drift(frame, object.fromFrame, object.toFrame),
    attributionProgress: cueProgress(attribution, CROSSFADE_FRAMES),
    producerLabel: object.dataset?.producerLabel,
    words: params.quote.split(/\s+/).map((text, index) => {
      const spoken = fired.find(e => e.verb === 'enter' && e.toState === `word:${index}`)
      const highlight = fired.find(e => e.verb === 'highlight' && e.toState === `word:${index}`)
      return { text, reveal: cueProgress(spoken, CROSSFADE_FRAMES),
        highlight: cueProgress(highlight, SWEEP_FRAMES) }
    }),
  }
}
