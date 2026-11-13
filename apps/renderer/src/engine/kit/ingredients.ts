import type { CSSProperties } from 'react'
import { z } from 'zod'

/** The cut's ingredients that are not the motion style: how beats hand over (transitions), what the camera does over
 *  the whole picture (camera) and how hard both hit (energy). Each is chosen per piece in the spec (style.transitions,
 *  style.camera, style.energy; docs/ve/INGREDIENTS.md) and works over any motion style, any device and any caption
 *  style. Captions are their own ingredient (style.captions -> props.captionTheme and props.captionPlacement).
 *
 *  Why (Krish, 2026-11-13, of the two 3D style test cuts): "the captions should be decoupled from the animation styles
 *  ... The motion design is terrible, the use of the screen space is terrible, the motion is 10X too slow, not
 *  immersive and engaging at all." The 3D cuts had one device event about every 5 s under a still camera; the
 *  references he keeps show about 3 to 4.5 visual events a second (`ve pace`, config/ve/pace-references.json).
 *
 *  Numbers rewritten from OpenMontage's HyperFrames rules and CollageBurst (docs/ve/sources/openmontage.md;
 *  source: "openmontage@fecb9a1", AGPL, behaviour only, no code copied): energy-tiered transitions (calm 0.5 to 0.8 s,
 *  medium 0.3 to 0.5 s, high 0.15 to 0.3 s), a landing flash, a decaying seeded shake, a phased camera with sine
 *  micro-drift and no spring on the camera. With no ingredients the composition draws exactly what it drew before
 *  (houseGolden.test.ts). Pure functions of (props, frame): a still and a render agree frame for frame. */

export const ENERGIES = ['calm', 'medium', 'high'] as const
export const TRANSITIONS = ['cut', 'whip', 'push', 'zoom-through', 'flash', 'punch', 'crossfade'] as const
export const CAMERAS = ['none', 'drift', 'phased', 'punch'] as const

export const EngineIngredientsSchema = z.object({
  energy: z.enum(ENERGIES),
  transition: z.enum(TRANSITIONS),
  camera: z.enum(CAMERAS),
  /** Device events kick the camera (a punch-in and, at high energy, a short shake) and may flash. */
  hits: z.boolean(),
}).strict()
export type EngineIngredients = z.infer<typeof EngineIngredientsSchema>

type Energy = typeof ENERGIES[number]
export const TRANSITION_FRAMES: Record<Energy, number> = { calm: 16, medium: 10, high: 6 }   // 0.53 / 0.33 / 0.2 s at 30 fps
const BLUR_PX: Record<Energy, number> = { calm: 18, medium: 12, high: 6 }
const PUNCH: Record<Energy, number> = { calm: 0.02, medium: 0.04, high: 0.07 }        // scale bump on a hit
const PUNCH_FRAMES: Record<Energy, number> = { calm: 14, medium: 10, high: 7 }
const SHAKE_PX: Record<Energy, number> = { calm: 0, medium: 4, high: 10 }               // CollageBurst 5 / 12 px
const SHAKE_FRAMES = 6
// Kept low and short: a cream flash over the dark ground reads as a flat grey frame when it is strong or long
// (seen at speed on the 13 Nov test cut, frame 1 of a zoom-through at 0.5 for 5 frames).
const FLASH: Record<Energy, number> = { calm: 0.1, medium: 0.16, high: 0.24 }
const FLASH_FRAMES = 3
const DRIFT_PX = { x: 4, y: 2 }
const HEADROOM = 1.015                                                                   // so a drift never shows an edge

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const outExpo = (x: number) => (clamp(x) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)))
const outQuart = (x: number) => 1 - Math.pow(1 - clamp(x), 4)
const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
/** A seeded value in -1..1 for a frame and a salt, the same on every render. */
const noise = (n: number, salt: number) => { const s = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1 }

export interface Span { fromFrame: number; toFrame: number }
export interface CameraState { scale: number; tx: number; ty: number; blurPx: number }

/** The most recent handover at or before the frame (a beat start other than the first). */
function lastHandover(beats: readonly Span[], frame: number): number | undefined {
  let at: number | undefined
  for (let i = 1; i < beats.length; i++) if (beats[i]!.fromFrame <= frame) at = beats[i]!.fromFrame
  return at
}

/** Hit frames: device events, de-duplicated so two events in the same 3 frames hit once. */
export function hitFrames(events: readonly { atFrame: number }[]): number[] {
  const frames = [...new Set(events.map((e) => e.atFrame))].sort((a, b) => a - b)
  const out: number[] = []
  for (const f of frames) if (!out.length || f - out[out.length - 1]! >= 3) out.push(f)
  return out
}

/** The picture's camera at a frame: scale, offset and motion blur, from the base move, the handover and the hits. */
export function cameraAt(ing: EngineIngredients, beats: readonly Span[], hits: readonly number[], frame: number,
  width: number): CameraState {
  const e = ing.energy
  let scale = 1, tx = 0, ty = 0, blurPx = 0
  const beat = beats.find((b) => frame >= b.fromFrame && frame < b.toFrame)
  if (ing.camera !== 'none') {
    scale = HEADROOM
    tx = DRIFT_PX.x * Math.sin(frame / 30 * 0.9)
    ty = DRIFT_PX.y * Math.sin(frame / 30 * 0.6 + 1.3)
  }
  if (ing.camera === 'phased' && beat) {
    // Three steps a beat (at 0, 35% and 70% of it), each landing on an out-quart over 12 frames: 1.0, 1.015, 1.035.
    // Kept small on purpose: graphics run to the safe edges, so a steady zoom past about 1.05 crops their words
    // (seen on the 13 Nov test stills); the hits carry the energy, briefly.
    const len = beat.toFrame - beat.fromFrame, t = frame - beat.fromFrame
    const steps = [[0, 0], [0.35, 0.015], [0.7, 0.02]] as const
    let add = 0
    for (const [at, amount] of steps) add += amount * outQuart((t - at * len) / 12)
    scale *= 1 + add
  }
  if (ing.hits && (ing.camera === 'punch' || ing.camera === 'phased')) {
    for (const h of hits) {
      const since = frame - h
      if (since < 0 || since >= PUNCH_FRAMES[e]) continue
      scale *= 1 + PUNCH[e] * (1 - outCubic(since / PUNCH_FRAMES[e]))
      if (since < SHAKE_FRAMES && SHAKE_PX[e]) {
        const decay = 1 - since / SHAKE_FRAMES
        tx += SHAKE_PX[e] * decay * noise(frame, h)
        ty += SHAKE_PX[e] * decay * noise(frame, h + 17)
      }
    }
  }
  // The handover: the incoming beat arrives on the style's transition.
  const at = lastHandover(beats, frame)
  if (at !== undefined && ing.transition !== 'cut' && ing.transition !== 'flash') {
    const n = TRANSITION_FRAMES[e], since = frame - at
    if (since >= 0 && since < n) {
      const q = outExpo(since / n), left = 1 - q
      if (ing.transition === 'whip') { tx += left * width * 0.55; blurPx = Math.max(blurPx, left * BLUR_PX[e] * 2) }
      else if (ing.transition === 'push') { ty += left * width * 0.5 }
      else if (ing.transition === 'zoom-through') { scale *= 1 + left * 0.9; blurPx = Math.max(blurPx, left * BLUR_PX[e]) }
      else if (ing.transition === 'punch') { scale *= 1 + left * 0.14 }
    }
  }
  return { scale, tx, ty, blurPx }
}

/** The camera as a style on the picture layer (his take and the beat graphics; never the captions or the frame). */
export function cameraStyle(state: CameraState, width: number, height: number): CSSProperties {
  if (state.scale === 1 && !state.tx && !state.ty && !state.blurPx) return {}
  return {
    transform: `translate(${state.tx.toFixed(2)}px, ${state.ty.toFixed(2)}px) scale(${state.scale.toFixed(4)})`,
    transformOrigin: `${width / 2}px ${height / 2}px`,
    ...(state.blurPx > 0.3 ? { filter: `blur(${state.blurPx.toFixed(1)}px)` } : {}),
  }
}

/** A flash of the house cream over the picture: on a `flash` handover, and on hits at high energy. 0 when none. */
export function flashAt(ing: EngineIngredients, beats: readonly Span[], hits: readonly number[], frame: number): number {
  let a = 0
  const at = lastHandover(beats, frame)
  if (at !== undefined && (ing.transition === 'flash' || ing.transition === 'zoom-through')) {
    const since = frame - at
    if (since >= 0 && since < FLASH_FRAMES) a = Math.max(a, FLASH[ing.energy] * (1 - since / FLASH_FRAMES))
  }
  if (ing.hits && ing.energy === 'high') {
    for (const h of hits) {
      const since = frame - h
      if (since >= 0 && since < 3) a = Math.max(a, FLASH.calm * (1 - since / 3))
    }
  }
  return a
}
