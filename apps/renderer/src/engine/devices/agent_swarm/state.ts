import { EXIT, MOTION, drift, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'
const linear = (t: number) => t
export function swarmState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.findLast(e => e.verb === 'enter')
  if (!enter) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const cue = (verb: string) => active.findLast(e => e.verb === verb)
  const exit = cue('exit')
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out === 1) return null
  const mark = cue('mark'), add = cue('add'), fill = cue('fill')
  const move = active.findLast(e => e.verb === 'move' && e.toState === 'rank')
  const time = mark?.atFrame ?? frame
  const countProgress = fill ? progress(time - fill.atFrame, MOTION.countFrames, t => 1 - (1 - t) ** 5) : 0
  const rankProgress = move ? progress(time - move.atFrame, MOTION.countFrames, linear) : 0
  const count = (from: number, to: number, p: number) => Math.round(from + (to - from) * p)
  return { params, out, marked: !!mark, rankMode: !!move,
    enter: progress(frame - enter.atFrame, MOTION.enterFrames),
    text: params.comment.split(/\s+/).slice(0, Math.ceil(params.comment.split(/\s+/).length * progress(time - enter.atFrame, MOTION.countFrames, linear))).join(' '),
    countProgress,
    tokenPosition: params.tokens.from + (params.tokens.to - params.tokens.from) * countProgress,
    tokens: count(params.tokens.from, params.tokens.to, countProgress),
    rank: count(params.rank.from, params.rank.to, rankProgress), rankProgress,
    strike: mark ? progress(frame - mark.atFrame, 10, linear) : 0,
    work: fill ? drift(time, fill.atFrame, object.toFrame, 100) : 0,
    agents: Array.from({ length: params.agents }, (_, i) => ({
      i, arrival: add ? progress(time - add.atFrame - (params.agents <= 1 ? 0 : i * 2), MOTION.slideFrames) : 0,
      visible: !!add && time >= add.atFrame + (params.agents <= 1 ? 0 : i * 2),
    })).filter(a => a.visible),
  }
}
