import { z } from 'zod'

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
  verb: z.enum(['enter', 'move', 'mark', 'fill', 'stamp', 'count_to', 'highlight', 'carry', 'exit', 'draw']),
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
  layout: z.enum(['P1', 'P3', 'P6', 'F1', 'F3', 'STAGE']),
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
  /** The premixed dialogue + bed stem from ve's audio step (make.py loudness), placed at frame 0. */
  stem: z.object({ src: z.string().min(1), trimBeforeFrames: Frame }).strict(),
  sfx: z.array(z.object({ src: z.string().min(1), atFrame: Frame, gainDb: z.number().max(0) }).strict()).default([]),
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
  beats: z.array(EngineBeatSchema).min(1),
  objects: z.array(EngineObjectSchema),
  events: z.array(EngineEventSchema),
  call: z.object({ statement: z.string(), due: z.string(), confidencePercent: z.number().int() }).strict().optional(),
  ending: z.object({ fromFrame: Frame, url: z.string().min(1) }).strict().optional(),
}).strict()

export type EngineRenderProps = z.infer<typeof EngineRenderPropsSchema>
export type EngineObject = z.infer<typeof EngineObjectSchema>
export type EngineEvent = z.infer<typeof EngineEventSchema>
export type EngineBeat = z.infer<typeof EngineBeatSchema>
export type EngineTokens = z.infer<typeof EngineTokensSchema>
