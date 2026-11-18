import { MOTION, progress, stateAt } from '../../clock'
import type { EngineObject, EngineEvent } from '../../props'
import { ParamsSchema } from './schema'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export function coverRect(shot: { width: number; height: number; focus?: { x: number; y: number } }, boxW: number, boxH: number) {
  const scale = Math.max(boxW / shot.width, boxH / shot.height)
  const width = shot.width * scale, height = shot.height * scale, focus = shot.focus ?? { x: .5, y: .5 }
  return { x: clamp(boxW / 2 - focus.x * width, boxW - width, 0), y: clamp(boxH / 2 - focus.y * height, boxH - height, 0), width, height }
}
// Integer avalanche: a seek-safe sample, bounded to [-1, 1].
function sample(frame: number, seed: number) {
  let h = (Math.floor(frame) ^ seed) | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1
}
export function sceneState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  let visible = false, index = 0, start = object.fromFrame, wipe = false
  for (const event of fired) {
    const cue = events.find(e => e.id === event.id && e.obj === object.obj) ?? event
    if (cue.verb === 'exit') visible = false
    if (cue.verb === 'enter' || cue.verb === 'move') {
      const target = cue.toState === 'cut' && cue.verb === 'enter' ? 0 : Number(cue.toState)
      if (!/^\d+$/.test(cue.toState) && !(cue.toState === 'cut' && cue.verb === 'enter') || !Number.isInteger(target) || target < 0 || target >= params.shots.length) throw new Error(`scene_plate: bad shot index ${cue.toState}`)
      index = target; start = cue.atFrame; wipe = cue.toState !== 'cut'; visible = true
    }
  }
  const end = Math.min(object.toFrame, ...events.filter(e => e.obj === object.obj && e.atFrame > start && ['enter', 'move', 'exit'].includes(e.verb)).map(e => e.atFrame))
  return { params, index, start, visible: visible && frame >= object.fromFrame && frame < object.toFrame,
    cameraProgress: progress(frame - start, Math.max(1, end - start - 1)),
    // Four-frame wipe is a device requirement, capped by the selected motion entrance.
    wipe: wipe && frame >= start && frame - start < Math.min(4, MOTION.enterFrames),
    wipeProgress: progress(frame - start, Math.max(1, Math.min(4, MOTION.enterFrames) - 1), t => t),
  }
}
export function cameraPose(camera: string, p: number, frame: number, w: number, h: number, focus: { x: number; y: number }) {
  if (camera === 'push') return { scale: 1 + .08 * p, x: 0, y: 0, rotation: 0 }
  if (camera === 'drift') return { scale: 1.04, x: (focus.x < .5 ? -1 : 1) * .03 * w * (p - .5), y: 0, rotation: 0 }
  if (camera === 'handheld') return { scale: Math.max(1.04, 1 + (12 + .007 * Math.max(w, h)) / Math.min(w, h)), x: 6 * sample(frame, 31), y: 6 * sample(frame, 71), rotation: .4 * sample(frame, 107) }
  return { scale: 1, x: 0, y: 0, rotation: 0 }
}
