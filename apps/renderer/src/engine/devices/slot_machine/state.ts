import { Easing } from 'remotion'
import { EXIT, MOTION, overshootEase, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'

const linear = (t: number) => t
const utility = Easing.bezier(0.2, 0, 0, 1)
export function slotState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const cues = fired.filter(e => e.atFrame >= enter.atFrame)
  const last = (verb: string) => cues.filter(e => e.verb === verb).at(-1)
  const exit = last('exit')
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out === 1) return null
  const params = ParamsSchema.parse(object.params)
  const type = last('type')
  for (const e of cues) {
    if (e.verb === 'type' && !['lyrics', 'style'].includes(e.toState)) throw new Error('type targets lyrics or style')
    if (e.verb === 'highlight' && !['1', '2'].includes(e.toState)) throw new Error('highlight targets 1 or 2')
  }
  const texts = (['lyrics', 'style'] as const).map(key => {
    const cue = cues.filter(e => e.verb === 'type' && e.toState === key).at(-1)
    return cue ? params[key].slice(0, Math.max(0, 2 * Math.floor(frame - cue.atFrame))) : ''
  })
  const pick = last('pick')
  const morph = pick ? progress(frame - pick.atFrame, 12, utility) : 0
  const spin = cues.filter(e => e.verb === 'send' || e.verb === 'bounce').at(-1)
  const age = spin ? frame - spin.atFrame : -1
  const fill = last('fill')
  const bounce = last('bounce')
  const flipping = !!(bounce && fill && bounce.atFrame > fill.atFrame)
  const flip = flipping ? progress(frame - bounce!.atFrame, MOTION.exitFrames) : 0
  const focusAge = type ? frame - type.atFrame : 0
  const length = type && (type.toState === 'lyrics' || type.toState === 'style') ? params[type.toState].length : 0
  const focus = type && !pick ? progress(focusAge, 6, utility) * (1 - progress(focusAge - Math.ceil(length / 2) - 8, 6, utility)) : 0
  return { params, texts, out, entrance: progress(frame - enter.atFrame, MOTION.enterFrames), morph,
    pressed: pick ? 8 * progress(frame - pick.atFrame, 2) * (1 - progress(frame - pick.atFrame - 3, 4)) : 0,
    focus: type?.toState, zoom: 1 + 0.6 * focus, focusAmount: focus,
    caret: Math.floor(progress(frame - object.fromFrame, Math.max(1, object.toFrame - object.fromFrame), linear) * (object.toFrame - object.fromFrame) / 15) % 2 === 0,
    lever: age < 0 ? 0 : 65 * progress(age, 6, utility) * (1 - progress(age - 6, 10, overshootEase(6))),
    reels: [18, 26].map(stop => ({ spinning: age >= 0 && age < stop,
      offset: age < 0 ? 0 : age < stop ? -1200 * progress(age, stop, linear) : 12 * (1 - progress(age - stop, 6, overshootEase(6))) })),
    cards: params.songs.map((song, i) => ({ ...song, visible: !!fill && frame >= fill.atFrame + i * MOTION.staggerFrames && flip < 1,
      payout: fill ? progress(frame - fill.atFrame - i * MOTION.staggerFrames, MOTION.dropFrames, overshootEase(6)) : 0,
      flip, dim: last('highlight') && Number(last('highlight')!.toState) !== i + 1 ? 0.4 : 1,
      lift: last('highlight') && Number(last('highlight')!.toState) === i + 1 ? progress(frame - last('highlight')!.atFrame, MOTION.slapFrames) : 0,
      wave: fill ? progress(frame - fill.atFrame, Math.max(1, object.toFrame - fill.atFrame), linear) : 0 })),
  }
}
