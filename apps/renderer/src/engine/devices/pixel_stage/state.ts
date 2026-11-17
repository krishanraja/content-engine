import { drift, MOTION, onTwos, progress, stateAt } from '../../clock'
// @ts-ignore shared move library
import { lerp } from '@mymu/moves/_kit.mjs'
import type { DeviceProps } from '../types'
import { MoveSchema, ParamsSchema } from './schema'

/** Coordinates are logical pixels, always enlarged sixfold. Cells are sized to each sprite. */
export function stageLayout(p: DeviceProps) {
  const params = ParamsSchema.parse(p.object.params)
  const width = p.aspect === '9:16' ? 180 : 320, height = p.aspect === '9:16' ? 320 : 180
  const x = Math.round((p.box.width - width * 6) / 2), y = p.aspect === '9:16' ? Math.max(0, 270 - p.box.top) : Math.round((p.box.height - height * 6) / 2)
  const sprites = params.sprites.map(s => {
    const image = params.images[s.image]!
    // Stop at whichever threshold the picture's own shape reaches first, never at a 24px thumbnail.
    const k = Math.min(width * .6 / image.pixelWidth, height * .7 / image.pixelHeight) / Math.sqrt(params.sprites.length)
    const w = Math.max(1, Math.ceil(image.pixelWidth * k)), h = Math.max(1, Math.ceil(image.pixelHeight * k))
    return { ...s, image, w, h, columns: Math.max(1, Math.floor(width / w)), rows: Math.max(1, Math.floor(height / h)) }
  })
  return { params, width, height, x, y, sprites }
}
export function stageState(p: DeviceProps) {
  const layout = stageLayout(p), frame = onTwos(p.frame, p.object.fromFrame)
  const { fired } = stateAt(p.events, p.object.obj, frame)
  const last = (verb: string) => fired.findLast(e => e.verb === verb)
  const amount = (e: typeof fired[number] | undefined, duration: number) => e ? progress(frame - e.atFrame, Math.min(18, duration), t => t) : 0
  const enter = last('enter'), exit = last('exit')
  const boot = enter?.atFrame === -Number.MAX_SAFE_INTEGER ? 1 : amount(enter, MOTION.enterFrames)
  const power = boot * (1 - amount(exit, MOTION.exitFrames))
  // A two-pose idle, driven by the shared non-repeating drift clock, rather than a raw frame loop.
  const push = drift(frame, p.object.fromFrame, p.object.toFrame, Math.max(.2, MOTION.driftPct))
  const pose = Math.floor(push * 2400) % 2
  const sprites = layout.sprites.map(s => {
    let at = s.at, x = at[0], y = at[1]
    for (const e of fired.filter(e => e.verb === 'move')) {
      let raw: unknown; try { raw = JSON.parse(e.toState) } catch { continue }
      const move = MoveSchema.safeParse(raw)
      if (!move.success || move.data.id !== s.id) continue
      const next = move.data.at, t = amount(e, MOTION.slideFrames)
      x = Math.round(lerp(at[0], next[0], t)); y = Math.round(lerp(at[1], next[1], t)); at = next
    }
    const add = fired.findLast(e => e.verb === 'add' && e.toState === s.id)
    const added = p.events.some(e => e.obj === p.object.obj && e.verb === 'add' && e.toState === s.id)
    const highlight = fired.findLast(e => e.verb === 'highlight' && (e.toState === s.id || e.toState === 'all'))
    return { ...s, x: Math.min(s.columns - 1, x) * s.w, y: Math.min(s.rows - 1, y) * s.h,
      pop: added ? amount(add, MOTION.slapFrames) : 1,
      mint: !!highlight && amount(highlight, MOTION.slapFrames) < 1, pose }
  })
  const count = last('count_to'), dataset = p.object.dataset
  const row = dataset?.rows.find(r => r.label === count?.toState) ?? dataset?.rows[0]
  return { ...layout, sprites, power, visible: !!enter && p.frame >= p.object.fromFrame && p.frame < p.object.toFrame && power > 0,
    score: Math.round((row?.value ?? 0) * amount(count, MOTION.countFrames)), dataset }
}
