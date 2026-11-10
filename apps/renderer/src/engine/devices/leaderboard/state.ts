import { MOTION, progress, stateAt } from '../../clock'
import { overlayState } from '../../kit/overlay'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema, RowTarget, StampTarget } from './schema'

export function leaderboardState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const visibility = overlayState(object, events, frame)
  const cues = visibility.fired.filter(e => e.atFrame >= (visibility.entrance?.atFrame ?? Infinity))
  const last = (verb: string) => cues.findLast(e => e.verb === verb)
  const age = (e: EngineEvent) => stateAt([e], object.obj, frame).sinceFrames
  const add = last('add'), fill = last('fill'), move = last('move'), mark = last('mark'), highlight = last('highlight')
  if (move && move.toState !== 'alt') throw new Error('leaderboard move expects alt')
  if (move && (!params.altHeader || params.rows.some(r => r.alt === undefined))) throw new Error('Alt ranking requires altHeader and every alt value')
  const target = (e: EngineEvent) => {
    const value = e.verb === 'stamp' ? StampTarget.parse(JSON.parse(e.toState)) : RowTarget.parse(JSON.parse(e.toState))
    if (!params.rows.some(r => r.label === value.row)) throw new Error('Unknown leaderboard row')
    return value
  }
  const selected = highlight ? target(highlight).row : undefined
  const initial = [...params.rows].sort((a, b) => b.value - a.value)
  const alternate = [...params.rows].sort((a, b) => (b.alt ?? b.value) - (a.alt ?? a.value))
  const travel = move ? progress(age(move), MOTION.slideFrames) : 0
  const rows = initial.map((row, i) => {
    const stamp = cues.findLast(e => e.verb === 'stamp' && target(e).row === row.label)
    const badge = stamp ? StampTarget.parse(JSON.parse(stamp.toState)).text : undefined
    const altIndex = alternate.findIndex(r => r.label === row.label)
    return { ...row, position: i + (altIndex - i) * travel,
      rank: (travel === 1 ? altIndex : i) + 1,
      reveal: add ? progress(age(add) - i * MOTION.staggerFrames, MOTION.enterFrames) : 0,
      bar: move ? (row.alt ?? row.value) * progress(age(move) - altIndex * MOTION.staggerFrames, MOTION.countFrames)
        : fill ? row.value * progress(age(fill) - i * MOTION.staggerFrames, MOTION.countFrames) : 0,
      badge, stamp: stamp ? progress(age(stamp), MOTION.slapFrames) : 0,
      lift: selected === row.label && highlight ? progress(age(highlight), MOTION.slapFrames) : 0,
    }
  })
  return { ...visibility, ...params, rows, alternate: !!move, travel,
    header: move ? params.altHeader! : params.header,
    strike: mark ? progress(age(mark), MOTION.slideFrames) : 0,
    grey: mark ? progress(age(mark) - MOTION.slideFrames, MOTION.slapFrames) : 0 }
}
