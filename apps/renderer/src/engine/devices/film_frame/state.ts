import { drift, MOTION, progress, stateAt } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema } from './schema'

/** Integer hashing, not a random generator or a repeating frame loop. */
export function grainSample(frame: number, sample: number): number {
  let n = Math.imul((frame | 0) ^ 0x45d9f3b, 0x27d4eb2d) ^ Math.imul(sample + 1, 0x85ebca6b)
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
export function filmState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const { fired } = stateAt(events, object.obj, frame)
  let plateIndex = 0, mark: EngineEvent | undefined, highlight: EngineEvent | undefined
  let enter: EngineEvent | undefined, exit: EngineEvent | undefined
  for (const e of fired) {
    if (e.verb === 'enter') { enter = e; exit = undefined }
    if (e.verb === 'move') {
      const index = Number(e.toState)
      if (!/^\d+$/.test(e.toState) || !Number.isInteger(index) || !params.plates[index]) throw new Error('film_frame move needs a valid plate index')
      plateIndex = index; mark = undefined; highlight = undefined
    }
    if (e.verb === 'mark' || e.verb === 'highlight') {
      if (!params.regions[e.toState]) throw new Error('film_frame cue needs a named region')
      if (e.verb === 'mark') mark = e
      else highlight = e
    }
    if (e.verb === 'exit') exit = e
  }
  const amount = (e: EngineEvent | undefined, duration: number) => !e ? 0
    : e.atFrame < 0 ? 1 : progress(frame - e.atFrame, Math.min(18, duration))
  // What this plate's marks and lifts point at, over its whole time on screen, so its crop is chosen once.
  let showing = 0
  const named: string[] = []
  for (const e of [...events].filter(e => e.obj === object.obj).sort((a, b) => a.atFrame - b.atFrame)) {
    if (e.verb === 'move' && /^\d+$/.test(e.toState)) showing = Number(e.toState)
    if ((e.verb === 'mark' || e.verb === 'highlight') && showing === plateIndex && params.regions[e.toState]) named.push(e.toState)
  }
  const boxes = named.map(n => params.regions[n]!)
  const focus = boxes.length ? {
    x: (Math.min(...boxes.map(b => b.x)) + Math.max(...boxes.map(b => b.x + b.width))) / 2,
    y: (Math.min(...boxes.map(b => b.y)) + Math.max(...boxes.map(b => b.y + b.height))) / 2,
  } : { x: 0.5, y: 0.5 }
  const warm = amount(enter, MOTION.enterFrames), collapse = amount(exit, MOTION.exitFrames)
  return { params, plateIndex, plate: params.plates[plateIndex]!, focus,
    visible: !!enter && frame >= object.fromFrame && frame < object.toFrame && collapse < 1,
    warm, collapse, mark: mark ? params.regions[mark.toState] : undefined,
    marked: amount(mark, MOTION.slapFrames), region: highlight ? params.regions[highlight.toState] : undefined,
    lifted: amount(highlight, MOTION.slideFrames),
    push: drift(frame, object.fromFrame, object.toFrame, Math.max(0.5, MOTION.driftPct)),
    weaveX: (grainSample(frame, 0) - 0.5) * 2, weaveY: (grainSample(frame, 1) - 0.5) * 2 }
}
