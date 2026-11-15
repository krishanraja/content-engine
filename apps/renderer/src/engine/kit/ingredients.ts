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
 *  (houseGolden.test.ts). Pure functions of (props, frame): a still and a render agree frame for frame.
 *
 *  15 Nov 2026: a handover may lead with its exit (`lead`), `drift` is a living drift (across, down, a small roll and a
 *  slow push), `focus` pushes the graphics layer onto the line that proves the words, and every move blurs by how fast
 *  it travels (`speedBlur`), never more than 18 px. A cut that chooses none of them draws as before. */

export const ENERGIES = ['calm', 'medium', 'high'] as const
export const TRANSITIONS = ['cut', 'whip', 'push', 'zoom-through', 'flash', 'punch', 'crossfade'] as const
export const CAMERAS = ['none', 'drift', 'phased', 'punch'] as const
/** The handovers whose exit can lead their entrance: the ones that travel. */
export const LEAD_TRANSITIONS = ['whip', 'push', 'zoom-through', 'punch'] as const

export const EngineIngredientsSchema = z.object({
  energy: z.enum(ENERGIES),
  transition: z.enum(TRANSITIONS),
  camera: z.enum(CAMERAS),
  /** Device events kick the camera (a punch-in and, at high energy, a short shake) and may flash. */
  hits: z.boolean(),
  /** The exit leads the entrance: on a whip, push, zoom-through or punch the outgoing beat starts leaving 6 frames
   *  before the handover and stays mounted 2 frames after it, dimming to dark, while the incoming beat arrives over it.
   *  Both moves are on the beats' own layers, so the camera makes no handover move of its own. */
  lead: z.boolean().optional(),
  /** Focus on the event: the graphics layer pushes onto the line a device reports (the typed line, the chip), for a
   *  motion style that does not already zoom to it. Never the camera: his take is never cropped by it. */
  focus: z.boolean().optional(),
}).strict()
export type EngineIngredients = z.infer<typeof EngineIngredientsSchema>

type Energy = typeof ENERGIES[number]
export const TRANSITION_FRAMES: Record<Energy, number> = { calm: 16, medium: 10, high: 6 }   // 0.53 / 0.33 / 0.2 s at 30 fps
const PUNCH: Record<Energy, number> = { calm: 0.02, medium: 0.04, high: 0.07 }        // scale bump on a hit
const PUNCH_FRAMES: Record<Energy, number> = { calm: 14, medium: 10, high: 7 }
const SHAKE_PX: Record<Energy, number> = { calm: 0, medium: 4, high: 10 }               // CollageBurst 5 / 12 px
const SHAKE_FRAMES = 6
// Kept low and short: a cream flash over the dark ground reads as a flat grey frame when it is strong or long
// (seen at speed on the 13 Nov test cut, frame 1 of a zoom-through at 0.5 for 5 frames).
const FLASH: Record<Energy, number> = { calm: 0.1, medium: 0.16, high: 0.24 }
const FLASH_FRAMES = 3
/** The gentle sine under the phased and punch cameras, as it always was. */
const DRIFT_PX = { x: 4, y: 2 }
const HEADROOM = 1.015                                                                   // so a drift never shows an edge
/** The living drift (camera `drift`): about 8 px across, 4 px down, a 0.1 degree roll and a slow push to 1.02. Its
 *  headroom covers the drift and the roll at either aspect (9:16 needs 1.018), and headroom times push stays at or
 *  under 1.05, where graphics that run to the safe edges start losing their words (ingredients.test.ts). */
export const LIVING_DRIFT = { xPx: 8, yPx: 4, rollDeg: 0.1, push: 1.02, headroom: 1.02 } as const
/** A lead handover: the exit starts this many frames before the handover and ends this many after it. */
export const LEAD_BEFORE = 6
export const LEAD_AFTER = 2
/** How dark the outgoing beat gets by the end of its exit (its brightness falls from 1 to 1 - LEAD_DIM). Dark, never a
 *  fade: a busy frame blurred and faded over another reads as one flat mid-grey frame. */
const LEAD_DIM = 0.85
/** Focus on the event: how far the graphics layer pushes onto the line (living-ui's own zoom is 1.5). */
export const FOCUS_SCALE = 1.3
/** Blur from speed: a 180 degree shutter smears a frame over half of its travel, and a box of length L blurs like a
 *  Gaussian of sigma L / sqrt(12). Never above 18 px, and none under 1.5 px, so a slow drift never softens his face. */
export const MAX_BLUR_PX = 18
const MIN_BLUR_PX = 1.5
const SHUTTER = 0.5

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const outExpo = (x: number) => (clamp(x) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)))
const outQuart = (x: number) => 1 - Math.pow(1 - clamp(x), 4)
const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
const inCubic = (x: number) => Math.pow(clamp(x), 3)
/** A seeded value in -1..1 for a frame and a salt, the same on every render. */
const noise = (n: number, salt: number) => { const s = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1 }

export interface Span { fromFrame: number; toFrame: number }
export interface CameraState { scale: number; tx: number; ty: number; blurPx: number; rollDeg?: number }
/** Where the picture (or one beat's layer) is: about its centre, before any blur. */
export interface Pose { scale: number; tx: number; ty: number; rollDeg: number }

/** The canvas height for a width, when a caller gives only the width (1080 is the tall cut, 1920 the wide one). */
const heightFor = (width: number) => (width === 1080 ? 1920 : 1080)

/** Whether the handovers lead with their exit (`lead`, on a transition that travels). */
export function leads(ing: EngineIngredients | undefined): boolean {
  return !!ing?.lead && (LEAD_TRANSITIONS as readonly string[]).includes(ing.transition)
}

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

/** Blur from speed: the picture's travel over one frame, centred on it (the poses half a frame either side), as px of
 *  Gaussian blur. Scale and roll count by how far they move the average point of the frame. Capped at MAX_BLUR_PX. */
export function speedBlur(before: Pose, after: Pose, width: number, height: number): number {
  const r = Math.sqrt((width * width + height * height) / 12)   // the root mean square distance of a frame point from its centre
  const travel = Math.hypot(after.tx - before.tx, after.ty - before.ty)
    + (Math.abs(after.scale - before.scale) + Math.abs(after.rollDeg - before.rollDeg) * Math.PI / 180) * r
  const px = Math.min(MAX_BLUR_PX, travel * SHUTTER / Math.sqrt(12))
  return px < MIN_BLUR_PX ? 0 : px
}

/** Moves a pose `amount` (0 at rest, 1 the whole way) along a travelling handover: with sign 1 towards where the
 *  incoming beat arrives from (the right on a whip, below on a push, close up on a zoom-through or punch), with sign -1
 *  the way a leading exit leaves (the left, above; a zoom or punch still pushes in, flying through the beat). */
function travel(kind: EngineIngredients['transition'], amount: number, width: number, pose: Pose, sign: 1 | -1): void {
  if (kind === 'whip') pose.tx += sign * amount * width * 0.55
  else if (kind === 'push') pose.ty += sign * amount * width * 0.5
  else if (kind === 'zoom-through') pose.scale *= 1 + amount * 0.9
  else if (kind === 'punch') pose.scale *= 1 + amount * 0.14
}

/** The camera's pose at a frame (which may be half a frame either side of the drawn one), with `beat` and `handover`
 *  read at the drawn frame, so a pose sampled across a beat start keeps the beat it belongs to. */
function cameraPose(ing: EngineIngredients, beat: Span | undefined, handover: number | undefined, hits: readonly number[],
  f: number, width: number): Pose {
  const e = ing.energy
  const pose: Pose = { scale: 1, tx: 0, ty: 0, rollDeg: 0 }
  if (ing.camera === 'drift') {
    // The living drift: three slow sines that never line up, and a breath that pushes in to 1.02 and back.
    const s = f / 30
    pose.scale = LIVING_DRIFT.headroom * (1 + (LIVING_DRIFT.push - 1) * 0.5 * (1 - Math.cos(s * 0.5)))
    pose.tx = LIVING_DRIFT.xPx * Math.sin(s * 0.9)
    pose.ty = LIVING_DRIFT.yPx * Math.sin(s * 0.6 + 1.3)
    pose.rollDeg = LIVING_DRIFT.rollDeg * Math.sin(s * 0.37 + 0.7)
  } else if (ing.camera !== 'none') {
    pose.scale = HEADROOM
    pose.tx = DRIFT_PX.x * Math.sin(f / 30 * 0.9)
    pose.ty = DRIFT_PX.y * Math.sin(f / 30 * 0.6 + 1.3)
  }
  if (ing.camera === 'phased' && beat) {
    // Three steps a beat (at 0, 35% and 70% of it), each landing on an out-quart over 12 frames: 1.0, 1.015, 1.035.
    // Kept small on purpose: graphics run to the safe edges, so a steady zoom past about 1.05 crops their words
    // (seen on the 13 Nov test stills); the hits carry the energy, briefly.
    const len = beat.toFrame - beat.fromFrame, t = f - beat.fromFrame
    const steps = [[0, 0], [0.35, 0.015], [0.7, 0.02]] as const
    let add = 0
    for (const [at, amount] of steps) add += amount * outQuart((t - at * len) / 12)
    pose.scale *= 1 + add
  }
  if (ing.hits && (ing.camera === 'punch' || ing.camera === 'phased')) {
    for (const h of hits) {
      const since = f - h
      if (since < 0 || since >= PUNCH_FRAMES[e]) continue
      pose.scale *= 1 + PUNCH[e] * (1 - outCubic(since / PUNCH_FRAMES[e]))
      if (since < SHAKE_FRAMES && SHAKE_PX[e]) {
        const decay = 1 - since / SHAKE_FRAMES
        pose.tx += SHAKE_PX[e] * decay * noise(f, h)
        pose.ty += SHAKE_PX[e] * decay * noise(f, h + 17)
      }
    }
  }
  // The handover: the incoming beat arrives on the style's transition (unless it leads, when the beats move instead).
  if (handover !== undefined && ing.transition !== 'cut' && ing.transition !== 'flash') {
    const n = TRANSITION_FRAMES[e], since = f - handover
    if (since >= 0 && since < n) travel(ing.transition, 1 - outExpo(since / n), width, pose, 1)
  }
  return pose
}

/** The picture's camera at a frame: scale, offset, roll and the blur its speed gives it, from the base move, the
 *  handover and the hits. A leading handover moves the beats, not the camera (leadMoveAt). */
export function cameraAt(ing: EngineIngredients, beats: readonly Span[], hits: readonly number[], frame: number,
  width: number, height: number = heightFor(width)): CameraState {
  const beat = beats.find((b) => frame >= b.fromFrame && frame < b.toFrame)
  const handover = leads(ing) ? undefined : lastHandover(beats, frame)
  const pose = (f: number) => cameraPose(ing, beat, handover, hits, f, width)
  const now = pose(frame)
  const blurPx = speedBlur(pose(frame - 0.5), pose(frame + 0.5), width, height)
  return { scale: now.scale, tx: now.tx, ty: now.ty, blurPx, ...(now.rollDeg ? { rollDeg: now.rollDeg } : {}) }
}

/** The camera as a style on the picture layer (his take and the beat graphics; never the captions or the frame). */
export function cameraStyle(state: CameraState, width: number, height: number): CSSProperties {
  const roll = state.rollDeg ?? 0
  if (state.scale === 1 && !state.tx && !state.ty && !state.blurPx && !roll) return {}
  return {
    transform: `translate(${state.tx.toFixed(2)}px, ${state.ty.toFixed(2)}px)${roll ? ` rotate(${roll.toFixed(4)}deg)` : ''} scale(${state.scale.toFixed(4)})`,
    transformOrigin: `${width / 2}px ${height / 2}px`,
    ...(state.blurPx > 0.3 ? { filter: `blur(${state.blurPx.toFixed(1)}px)` } : {}),
  }
}

/** One beat's own move in a leading handover: where its layer is, how fast it travels and how dark it is. */
export interface LeadMove { scale: number; tx: number; ty: number; blurPx: number; brightness: number }

/** A beat's layer in a leading handover (`lead`): it arrives on the transition from its start when the beat before
 *  hands over to it (`enters`), and, when it hands over to the next (`exits`), it starts leaving LEAD_BEFORE frames
 *  before its end, accelerating out and dimming to dark until LEAD_AFTER frames after it, while the incoming beat is
 *  already arriving over it. Undefined when the beat is at rest. */
export function leadMoveAt(ing: EngineIngredients, beat: Span, enters: boolean, exits: boolean, frame: number,
  width: number, height: number = heightFor(width)): LeadMove | undefined {
  if (!leads(ing)) return undefined
  const n = TRANSITION_FRAMES[ing.energy]
  const out = (f: number) => clamp((f - (beat.toFrame - LEAD_BEFORE)) / (LEAD_BEFORE + LEAD_AFTER))
  const pose = (f: number): Pose => {
    const p: Pose = { scale: 1, tx: 0, ty: 0, rollDeg: 0 }
    const since = f - beat.fromFrame
    if (enters && since >= 0 && since < n) travel(ing.transition, 1 - outExpo(since / n), width, p, 1)
    if (exits) travel(ing.transition, inCubic(out(f)), width, p, -1)
    return p
  }
  const now = pose(frame)
  const blurPx = speedBlur(pose(frame - 0.5), pose(frame + 0.5), width, height)
  const brightness = exits ? 1 - LEAD_DIM * out(frame) : 1
  if (now.scale === 1 && !now.tx && !now.ty && !blurPx && brightness === 1) return undefined
  return { scale: now.scale, tx: now.tx, ty: now.ty, blurPx, brightness }
}

/** A leading move as a style on the beat's outer layer, about the layer's own centre. */
export function leadStyle(move: LeadMove | undefined): CSSProperties {
  if (!move) return {}
  const filters = [move.brightness < 1 ? `brightness(${move.brightness.toFixed(3)})` : '', move.blurPx > 0.3 ? `blur(${move.blurPx.toFixed(1)}px)` : '']
    .filter(Boolean).join(' ')
  return {
    ...(move.scale !== 1 || move.tx || move.ty ? { transform: `translate(${move.tx.toFixed(2)}px, ${move.ty.toFixed(2)}px) scale(${move.scale.toFixed(4)})` } : {}),
    ...(filters ? { filter: filters } : {}),
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
