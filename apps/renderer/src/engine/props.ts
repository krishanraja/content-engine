import { CAPTION_THEMES } from './captions/names'
import { z } from 'zod'
import { EngineMotionSchema } from './kit/motionProfiles'

/** What `ve compile` hands the renderer for one cut: everything already resolved to frames on ONE clock.
 *  The spec (packages/contracts/src/production-spec.ts) speaks in word indexes; this speaks in frames.
 *  Devices never see words, seconds or hex: they get frames, events and colour tokens. */

const Frame = z.number().int().nonnegative()

export const EngineTokensSchema = z.object({
  ink: z.string(), inkDeep: z.string(), inkSoft: z.string(), cream: z.string(), mint: z.string(),
  channel: z.string(), // the series colour: identity only (pill, mark shadow, caption shadow)
}).strict()

export const EngineImageSchema = z.object({ src: z.string().min(1), pixelWidth: z.number().int().positive(), pixelHeight: z.number().int().positive() }).strict()

export const EngineEventSchema = z.object({
  id: z.string().min(1),
  obj: z.string().min(1),
  verb: z.enum(['enter', 'move', 'mark', 'fill', 'stamp', 'count_to', 'highlight', 'carry', 'exit', 'draw', 'bounce', 'sulk', 'wave', 'add', 'chip', 'type', 'send', 'pick']),
  toState: z.string().min(1),
  atFrame: Frame,
  sfx: z.string().optional(),
}).strict()

export const EngineObjectSchema = z.object({
  obj: z.string().min(1),
  device: z.string().min(1),
  meaning: z.string().min(1),
  dataset: z.object({
    unit: z.string(), denominator: z.number().nullable(), producerLabel: z.string().min(2),
    rows: z.array(z.object({ label: z.string(), value: z.number() }).strict()),
  }).strict().optional(),
  variants: z.record(z.string(), z.string()).default({}),
  /** Device-specific parameters, validated by the device's own schema (devices/<id>/schema.ts). */
  params: z.record(z.string(), z.unknown()).default({}),
  fromFrame: Frame,
  toFrame: Frame,
}).strict()

export const EngineBeatSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['hook', 'anchor', 'bridge', 'pivot', 'payoff', 'call']),
  layout: z.enum(['P1', 'P3', 'P6', 'F1', 'F3', 'STAGE', 'SPLIT', 'WINDOW']),
  face: z.enum(['full', 'window', 'off']).optional(),
  plate: z.object({ source: z.string().min(1), crop: z.string().min(1).optional() }).strict().optional(),
  fromFrame: Frame,
  toFrame: Frame,
  uses: z.array(z.string()),
  transitionOut: z.enum(['cut', 'cut_on_curve', 'carry', 'zoom_out']),
  /** Approved frame within this beat; when absent, use 80% through the beat. */
  keyFrame: Frame.optional(),
  sectionBeat: z.boolean().default(false), // the beat that carries the channel pill
}).strict()

export const EngineCaptionPageSchema = z.object({
  fromFrame: Frame,
  toFrame: Frame,
  words: z.array(z.object({ text: z.string().min(1), atFrame: Frame }).strict()).min(1),
  swipeIndex: z.number().int().nonnegative().nullable(), // the one mint-swiped word on the page
}).strict()

/** Picture from a take: each segment is one EDL entry. trimBeforeFrames is the SAME source offset the dialogue
 *  segment uses, so picture can never drift from its audio (INV-ONE-CLOCK). Empty for voiceover cuts. */
export const EngineSegmentSchema = z.object({
  src: z.string().min(1), trimBeforeFrames: Frame, fromFrame: Frame, durationFrames: z.number().int().positive(),
  crop: z.object({ x: z.number(), y: z.number(), scale: z.number().positive() }).strict().optional(),
}).strict()

export const EngineAudioSchema = z.object({
  /** The premixed dialogue + bed stem from ve's audio step (make.py loudness), placed at the render's frame 0: the
   *  sting's first frame when the cut has one (props.sting), else the cut's own frame 0. */
  stem: z.object({ src: z.string().min(1), trimBeforeFrames: Frame }).strict(),
  sfx: z.array(z.object({ src: z.string().min(1), atFrame: Frame, gainDb: z.number().max(0) }).strict()).default([]),
}).strict()

/** A sting clip, byte for byte the one Krish saw (config/intro-sting.json clips.16x9.<series>): ve-render refuses a
 *  file whose sha256 is not this one. */
export const EngineStingSchema = z.object({
  src: z.string().min(1),
  series: z.enum(['follow_the_money', 'mind_the_gap', 'under_the_hood']),
  frames: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
}).strict()

export const EngineRenderPropsSchema = z.object({
  pieceId: z.string().min(1),
  cutId: z.string().min(1),
  format: z.enum(['face-with-proof', 'scoreboard-test', 'voice-led-pictures', 'hand-held-screen', 'two-passports']),
  aspect: z.enum(['9:16', '16:9']),
  fps: z.literal(30),
  durationFrames: z.number().int().positive(),
  tokens: EngineTokensSchema,
  series: z.object({ label: z.string().min(1), day: z.string().min(1), promise: z.string().min(1), site: z.string().min(1) }).strict(),
  brand: z.object({ mark: EngineImageSchema, logo: EngineImageSchema, stacked: EngineImageSchema }).strict(),
  segments: z.array(EngineSegmentSchema).default([]),
  audio: EngineAudioSchema,
  captions: z.array(EngineCaptionPageSchema).min(1),
  /** 'house' pages in the ink box; 'word' shows one word at a time, off the face, under a held title. */
  captionStyle: z.enum(['house', 'word']).optional(),
  /** A caption theme from captions/names.ts drawn instead of the house caption (Krish, 2026-11-11). */
  captionTheme: z.enum(CAPTION_THEMES).optional(),
  title: z.string().min(1).optional(),
  beats: z.array(EngineBeatSchema).min(1),
  objects: z.array(EngineObjectSchema),
  events: z.array(EngineEventSchema),
  call: z.object({ statement: z.string(), due: z.string(), confidencePercent: z.number().int() }).strict().optional(),
  // The house close (chrome/EndingBand.tsx, docs/production/CLOSING.md). `ticker` is kept for old props and drawn by nothing.
  ending: z.object({ fromFrame: Frame, url: z.string().min(1), ticker: z.boolean().default(true),
    tagline: z.string().min(1).optional(), cta: z.string().min(1).optional(),
    days: z.array(z.object({ day: z.string().min(1), colour: z.string().min(1) }).strict()).optional() }).strict().optional(),
  /** The motion style Krish picked (spec style.motion) and its profile; absent means the house motion, unchanged. */
  motion: EngineMotionSchema.optional(),
  /** The makeyourmindup intro sting in front of the cut (Krish, 2026-11-05: "I think it should go at the start of the
   *  longer wide videos 100%,"): one of the fixed clips in config/intro-sting.json, played as it is for its `frames`,
   *  silent, with the stem under it. Every other frame in these props stays on the cut's own clock, which starts
   *  `frames` into the render, so his face lands on the very next frame after the sting's last. Absent, the cut
   *  opens on its hook exactly as before. */
  sting: EngineStingSchema.optional(),
  /** A wide cut that opens on its own episode card where the sting would be, by Krish's word for that piece (spec
   *  brand.opening_exception; Krish, 2026-11-09: "I want the episode card to come in."). Nothing is drawn from it: the
   *  card is the spec's own beat; it only records why this series wide cut has no sting. */
  opening: z.object({ kind: z.literal('episode_card'), said: z.string().min(12), on: z.string().min(10) }).strict().optional(),
}).strict().superRefine((props, context) => {
  if (props.opening && props.sting) context.addIssue({ code: 'custom', path: ['opening'], message: 'a cut opens on its episode card or on the sting, never both' })
  if (!props.sting) return
  // Only the 16:9 long cut of a weekly series piece wears it: the 9:16 short opens straight on its hook
  // (HOOK_IS_THE_INTRO), a proof excerpt (no ending band) is never a whole cut, and an off day wears no sting.
  if (props.aspect !== '16:9') context.addIssue({ code: 'custom', path: ['sting'], message: 'the sting opens only the 16:9 long cut; the 9:16 short opens on its hook' })
  if (!props.ending) context.addIssue({ code: 'custom', path: ['sting'], message: 'the sting opens only a whole cut, never an excerpt' })
  if (props.sting.series !== props.series.label.replaceAll('.', '_')) {
    context.addIssue({ code: 'custom', path: ['sting', 'series'], message: `the ${props.sting.series} sting cannot open the ${props.series.label} cut` })
  }
})

export type EngineRenderProps = z.infer<typeof EngineRenderPropsSchema>
export type EngineObject = z.infer<typeof EngineObjectSchema>
export type EngineEvent = z.infer<typeof EngineEventSchema>
export type EngineBeat = z.infer<typeof EngineBeatSchema>
export type EngineTokens = z.infer<typeof EngineTokensSchema>
export type EngineSting = z.infer<typeof EngineStingSchema>
