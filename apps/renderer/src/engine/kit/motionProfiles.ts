import { z } from 'zod'
import table from './motion-profiles.json'

/** How the renderer draws a motion style (config/style-references.json, layer motion). The numbers live once, in
 *  motion-profiles.json beside this file; compile.py copies the chosen one into props.motion and FormatMaster hands it
 *  to clock.ts (setMotionProfile). With no profile every device keeps the house motion it had before styles rendered,
 *  so frozen locks and approved key frames stay valid. */

export const MotionProfileSchema = z.object({
  entrance: z.object({
    kind: z.enum(['rise', 'slide', 'drop', 'slap', 'scale', 'draw']),
    frames: z.number().int().positive(),
    easing: z.enum(['enter', 'hero', 'utility']),
    distancePx: z.number().nonnegative(),
    overshootPct: z.number().nonnegative(),
  }).strict(),
  stagger: z.object({ frames: z.number().int().nonnegative(), unit: z.enum(['line', 'word', 'char']) }).strict(),
  exitFrames: z.number().int().positive(),
  onTwos: z.boolean(),
  camera: z.object({
    kind: z.enum(['none', 'push', 'zoomToFocus', 'followPen']),
    scaleTo: z.number().positive(),
    dimOthers: z.boolean(),
    easing: z.enum(['enter', 'hero', 'utility']).default('hero'),
  }).strict(),
  transition: z.enum(['cut', 'cut_on_curve', 'crossfade']),
  /** How long a crossfade overlaps the two beats, 6 to 10 frames (kit/beatMotion.ts transitionFrames). */
  transitionFrames: z.number().int().min(6).max(10).optional(),
  typeReveal: z.object({ kind: z.enum(['line', 'word', 'typewriter', 'roll']), cps: z.number().positive().optional() }).strict(),
  /** house: the cream stage; inkDeep: ink_deep under a graphics-only beat (dark-keynote); dark: ink_deep under every
   *  graphic ground, SPLIT included, with text cards inverted for contrast (hud-terminal, line-boil). paper: a seeded,
   *  generated grain and fibre over the ground (paper-cutout), no image asset. */
  ground: z.object({ kind: z.enum(['house', 'inkDeep', 'dark']), sweepFrames: z.number().int().nonnegative(), texture: z.enum(['none', 'halftone', 'paper']),
    /** On a dark ground, text cards invert (the default) or keep their house cream; type drawn straight on the ground
     *  always inverts so it reads. */
    cards: z.enum(['invert', 'keep']).optional() }).strict(),
  /** What a style lays over its graphics (kit/overlays.tsx). brackets: corners locking onto the focus line; scanLines:
   *  faint static lines on the ground, never over the proof; torn: a torn paper edge and a soft shadow on cards and
   *  logo tiles; sketchFrame: a hand-drawn panel line round the graphic ground. Absent means none. */
  overlays: z.array(z.enum(['brackets', 'scanLines', 'torn', 'sketchFrame'])).optional(),
  /** Type. font data: device text in the mono data face (hud-terminal). hero: the beat's key phrase set as the
   *  picture, at the largest size the channel safe area takes, words sliding in on the grid (swiss-kinetic-type). */
  type: z.object({ font: z.enum(['house', 'data']), hero: z.boolean() }).strict().optional(),
  /** lead: large centred captions of 2 to 4 words as the main graphic, the spoken word highlighted (vertical-captions);
   *  replaces the house captions for that style only. */
  captions: z.object({ mode: z.enum(['house', 'lead']), wordsPerCard: z.number().int().positive() }).strict().optional(),
  /** A seeded SVG displacement on stroked shapes only (scribbles, drawn lines), its seed changing every `everyFrames`
   *  frames; never on type or numbers (line-boil). */
  boil: z.object({ amplitudePx: z.number().nonnegative(), everyFrames: z.number().int().positive() }).strict().optional(),
  driftPct: z.number(),
  countFrames: z.number().int().positive().default(18),
  note: z.string().optional(),
}).strict()

export type MotionProfile = z.infer<typeof MotionProfileSchema>

/** props.motion: the style Krish picked and, when the renderer can draw it, its resolved profile. */
export const EngineMotionSchema = z.object({ style: z.string().min(1), profile: MotionProfileSchema.optional() }).strict()
export type EngineMotion = z.infer<typeof EngineMotionSchema>

export const MOTION_PROFILES: Readonly<Record<string, MotionProfile>> = Object.fromEntries(
  Object.entries(table.profiles).map(([id, profile]) => [id, MotionProfileSchema.parse(profile)]))
/** Styles that need their own device or drawing pipeline: they render with the house motion until it is built. */
export const NEEDS_DEVICE: readonly string[] = table.needs_device

/** The signed floor (docs/ve/MOTION_STANDARD.md, signed by Krish 3 Nov 2026), widened on 13 Nov 2026 to admit his own
 *  cuts (Ruling, Krish, 2026-11-13: "yes it should"): the AI music cut slams about 500 px with about 12% overshoot over
 *  10 frames, and the Character.ai cut's type travels 0 px (it fades or blurs in only). */
export const FLOOR = {
  entranceFrames: [4, 10], risePx: [0, 500], overshootPctMax: 12, driftPctMin: 0,
  /** No graphic held more than 3.5 s without a change: nothing a profile times may run longer. */
  maxHoldFrames: 105,
  zoom: [1, 3], cps: [25, 40],
  /** line-boil's bank rule: amplitude under 2 px, boiled on twos or slower. Lead captions carry 2 to 4 words a card. */
  boilPx: [0.5, 2], boilEvery: [2, 4], leadWords: [2, 4],
} as const

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** What a profile breaks of the signed floor; empty when it sits inside it. */
export function floorProblems(profile: MotionProfile): string[] {
  const problems: string[] = []
  const { entrance } = profile
  if (entrance.frames < FLOOR.entranceFrames[0] || entrance.frames > FLOOR.entranceFrames[1]) problems.push(`entrance settles in ${entrance.frames} frames, not 4 to 10`)
  if (entrance.distancePx < FLOOR.risePx[0] || entrance.distancePx > FLOOR.risePx[1]) problems.push(`entrance travels ${entrance.distancePx} px, not 0 to 500`)
  if (entrance.overshootPct > FLOOR.overshootPctMax) problems.push(`overshoot ${entrance.overshootPct}% is over 12%`)
  if (!(profile.driftPct > FLOOR.driftPctMin)) problems.push('drift must be above 0 so nothing fully stops')
  if (profile.ground.sweepFrames > FLOOR.maxHoldFrames || profile.countFrames > FLOOR.maxHoldFrames || profile.exitFrames > FLOOR.maxHoldFrames)
    problems.push('a timed move runs past 3.5 s')
  if (profile.camera.scaleTo < FLOOR.zoom[0] || profile.camera.scaleTo > FLOOR.zoom[1]) problems.push(`camera scale ${profile.camera.scaleTo} is outside 1 to 3`)
  if (profile.typeReveal.kind === 'typewriter' && (profile.typeReveal.cps === undefined || profile.typeReveal.cps < FLOOR.cps[0] || profile.typeReveal.cps > FLOOR.cps[1]))
    problems.push('typing must run at a readable 25 to 40 characters a second')
  if (profile.boil && (profile.boil.amplitudePx > FLOOR.boilPx[1] || profile.boil.everyFrames < FLOOR.boilEvery[0]))
    problems.push('a line boils under 2 px, on twos or slower')
  if (profile.captions?.mode === 'lead' && (profile.captions.wordsPerCard < FLOOR.leadWords[0] || profile.captions.wordsPerCard > FLOOR.leadWords[1]))
    problems.push('a lead caption card carries 2 to 4 words')
  return problems
}

/** The profile pulled inside the floor: what a hand-edited props file can never get past. */
export function clampToFloor(profile: MotionProfile): MotionProfile {
  return {
    ...profile,
    entrance: { ...profile.entrance,
      frames: clamp(Math.round(profile.entrance.frames), FLOOR.entranceFrames[0], FLOOR.entranceFrames[1]),
      distancePx: clamp(profile.entrance.distancePx, FLOOR.risePx[0], FLOOR.risePx[1]),
      overshootPct: clamp(profile.entrance.overshootPct, 0, FLOOR.overshootPctMax) },
    exitFrames: clamp(profile.exitFrames, 1, FLOOR.maxHoldFrames),
    camera: { ...profile.camera, scaleTo: clamp(profile.camera.scaleTo, FLOOR.zoom[0], FLOOR.zoom[1]) },
    typeReveal: profile.typeReveal.kind === 'typewriter'
      ? { ...profile.typeReveal, cps: clamp(profile.typeReveal.cps ?? 30, FLOOR.cps[0], FLOOR.cps[1]) } : profile.typeReveal,
    ground: { ...profile.ground, sweepFrames: clamp(profile.ground.sweepFrames, 0, FLOOR.maxHoldFrames) },
    driftPct: profile.driftPct > 0 ? profile.driftPct : 0.5,
    countFrames: clamp(profile.countFrames, 1, FLOOR.maxHoldFrames),
    ...(profile.boil ? { boil: { amplitudePx: clamp(profile.boil.amplitudePx, FLOOR.boilPx[0], FLOOR.boilPx[1]),
      everyFrames: clamp(Math.round(profile.boil.everyFrames), FLOOR.boilEvery[0], FLOOR.boilEvery[1]) } } : {}),
    ...(profile.captions ? { captions: { ...profile.captions,
      wordsPerCard: clamp(Math.round(profile.captions.wordsPerCard), FLOOR.leadWords[0], FLOOR.leadWords[1]) } } : {}),
  }
}

/** The profile a cut renders with: its own inline profile, else the table's, else none (the house motion). */
export function resolveMotion(motion: EngineMotion | undefined): MotionProfile | undefined {
  if (!motion) return undefined
  if (motion.profile) return clampToFloor(motion.profile)
  if (Object.hasOwn(MOTION_PROFILES, motion.style)) return clampToFloor(MOTION_PROFILES[motion.style]!)
  if (NEEDS_DEVICE.includes(motion.style)) return undefined
  throw new Error(`ve: unknown motion style ${motion.style}`)
}
