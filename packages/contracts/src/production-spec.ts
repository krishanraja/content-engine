import { z } from 'zod'
import { IdentifierV1Schema, NarrativeBeatV1Schema, Sha256V1Schema } from './v2.js'

/** The ve ProductionSpec: creative-direction.json at schema_version 2. One signed
 *  spec per piece is the only creative artefact; the engine compiles it into the
 *  EDL, cue sheet and render props. Positions are word indexes into the signed
 *  script (w), never seconds, so a treatment can be written before recording.
 *  docs/ve/ENGINE.md explains the fields; config/ve holds formats, crew and tokens. */

export const VE_FORMATS = ['face-with-proof', 'scoreboard-test', 'voice-led-pictures', 'hand-held-screen', 'two-passports'] as const
export const VeFormatSchema = z.enum(VE_FORMATS)
export const VeSeriesSchema = z.enum(['mind.the.gap', 'follow.the.money', 'under.the.hood'])
export const VeAspectSchema = z.enum(['9:16', '16:9'])
export const VeLayoutSchema = z.enum(['P1', 'P3', 'P6', 'F1', 'F3', 'STAGE'])
export const VeRoleSchema = z.enum(['hook', 'anchor', 'bridge', 'pivot', 'payoff', 'call'])
export const VeVerbSchema = z.enum(['enter', 'mark', 'fill', 'stamp', 'count_to', 'highlight', 'carry', 'exit', 'draw'])
export const VeTransitionSchema = z.enum(['cut', 'cut_on_curve', 'carry', 'zoom_out'])
export const VeFinishSchema = z.enum(['house_grain', 'halftone_news', 'analog_paper'])

const WordSchema = z.number().int().nonnegative()
const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const VeSpanSchema = z.object({ from_w: WordSchema, to_w: WordSchema }).strict()
  .refine((v) => v.to_w >= v.from_w, { message: 'span must end at or after its start' })

export const VeEventSchema = z.object({
  at_w: WordSchema,
  obj: SlugSchema,
  verb: VeVerbSchema,
  to_state: z.string().min(1),
  sfx: z.string().min(1).optional(),
  silent: z.literal(true).optional(),
}).strict().refine((v) => !(v.sfx && v.silent), { message: 'an event has an sfx or is silent, not both' })

export const VeBeatSchema = z.object({
  id: SlugSchema,
  role: VeRoleSchema,
  span: VeSpanSchema,
  viewer_task: NarrativeBeatV1Schema.shape.viewer_task,
  point: z.string().min(12),
  layout: VeLayoutSchema,
  plate: z.object({ source: z.string().regex(/^(take|asset:[a-z0-9][a-z0-9_-]*)$/), crop: z.string().min(1).optional() }).strict(),
  uses: z.array(z.string().min(1)).default([]),
  events: z.array(VeEventSchema).default([]),
  transition_out: VeTransitionSchema.default('cut'),
  override_reason: z.string().min(12).optional(),
}).strict()

export const VeCutSchema = z.object({
  aspect: VeAspectSchema,
  take: z.string().min(1),
  max_s: z.number().positive(),
  /** A proof excerpt (Gate 2) skips the whole-cut story rules: one payoff, the call beat, layout variety. */
  excerpt: z.boolean().default(false),
  edit: z.object({
    remove: z.array(z.object({ from_w: WordSchema, to_w: WordSchema, why: z.string().min(3) }).strict()).default([]),
    speed: z.number().min(1).max(1.35).default(1),
    speed_said: z.string().min(2).optional(),
  }).strict().refine((v) => v.speed === 1 || !!v.speed_said, { message: "a speed change needs Krish's words in speed_said", path: ['speed_said'] }),
  captions: z.object({ region: z.string().min(1).default('default'), emphasis: z.array(WordSchema).default([]) }).strict(),
  beats: z.array(VeBeatSchema).min(1),
}).strict()

export const VeDatasetSchema = z.object({
  id: SlugSchema,
  unit: z.string().min(1),
  denominator: z.number().positive().nullable(),
  rows: z.array(z.object({ label: z.string().min(1), value: z.number() }).strict()).min(1),
  producer_label: z.string().min(2),
  source_url: z.string().url(),
  retrieved_at: DateSchema,
}).strict()

export const VeObjectSchema = z.object({
  obj: SlugSchema,
  device: SlugSchema,
  dataset: SlugSchema.optional(),
  meaning: z.string().min(8),
  persist: z.object({ from_beat: SlugSchema, to_beat: SlugSchema }).strict(),
  /** Device parameters, validated by the device's own schema (apps/renderer/src/engine/devices/<id>/schema.ts).
   *  Media paths (src, logoSrc) are relative to the piece's assets folder. */
  params: z.record(z.string(), z.unknown()).default({}),
}).strict()

export const VeSignatureSchema = z.object({
  hero: z.object({ device: SlugSchema, status: z.enum(['proven', 'trial', 'new']), card: z.string().min(1).optional() }).strict(),
  opening_break: z.string().min(8),
  finish_pack: VeFinishSchema,
  sound_palette: z.string().min(1),
  variants: z.record(SlugSchema, z.record(z.string(), z.string())).default({}),
}).strict()

export const VeAssetSchema = z.object({
  id: SlugSchema,
  kind: z.enum(['logo', 'screenshot', 'document', 'photo', 'illustration', 'broll', 'recording', 'sfx', 'music']),
  origin: z.enum(['capture', 'source', 'licensed', 'generated']),
  path: z.string().min(1),
  sha256: Sha256V1Schema,
  source_url: z.string().url().optional(),
  licence: z.string().min(2),
  credit: z.string().min(2).optional(),
  tool: z.string().min(1).optional(),
  job_id: z.string().min(1).optional(),
  prompt_ref: z.string().min(1).optional(),
  credits: z.number().nonnegative().optional(),
  label: z.string().min(2).optional(),
}).strict().superRefine((v, c) => {
  if (v.origin === 'generated') {
    if (!['illustration', 'broll', 'sfx', 'music'].includes(v.kind)) c.addIssue({ code: 'custom', path: ['kind'], message: 'generated media is illustration, broll, sfx or music, never evidence' })
    if (['illustration', 'broll'].includes(v.kind) && !v.label) c.addIssue({ code: 'custom', path: ['label'], message: 'generated pictures carry an on-screen label' })
    if (!v.tool) c.addIssue({ code: 'custom', path: ['tool'], message: 'generated media names the tool that made it' })
  }
  if (/\bCC[ -]BY/i.test(v.licence) && !v.credit) c.addIssue({ code: 'custom', path: ['credit'], message: 'a CC BY licence needs its credit line' })
})

export const VeAudioSchema = z.object({
  master: z.enum(['take', 'vo']),
  bed: z.object({
    ledger_id: z.string().min(1),
    epidemic_edit_id: z.string().min(1).optional(),
    mode: z.enum(['continuous', 'episode']),
    under_vo_lu: z.number().max(-12).min(-30).default(-20),
  }).strict(),
  sfx_kit: z.string().min(1).default('house-v1'),
  targets: z.object({ lufs: z.number().default(-14), tp: z.number().max(-1).default(-1) }).strict().default({ lufs: -14, tp: -1 }),
}).strict()

export const VeApprovalSchema = z.object({
  gate: z.enum(['treatment', 'proof', 'final', 'spend', 'synthetic', 'exception']),
  by: z.literal('Krish'),
  said: z.string().min(2),
  on: DateSchema,
  artifact_hash: Sha256V1Schema,
}).strict()

export const VeCallSchema = z.object({
  statement: z.string().min(12),
  due: DateSchema,
  confidence_percent: z.number().int().min(1).max(99),
}).strict()

export const ProductionSpecV2Schema = z.object({
  schema_version: z.literal(2),
  piece_id: IdentifierV1Schema,
  publish_day: DateSchema.optional(),
  format: VeFormatSchema,
  theme: SlugSchema,
  brand: z.object({
    series: VeSeriesSchema,
    captions: z.literal('house'),
    reference: z.string().min(1).optional(),
    intro_sting: z.string().min(1).optional(),
  }).strict(),
  call: VeCallSchema.optional(),
  signature: VeSignatureSchema,
  datasets: z.array(VeDatasetSchema).default([]),
  objects: z.array(VeObjectSchema).default([]),
  assets: z.array(VeAssetSchema).default([]),
  audio: VeAudioSchema,
  cuts: z.record(SlugSchema, VeCutSchema).refine((v) => Object.keys(v).length > 0, { message: 'a spec has at least one cut' }),
  approvals: z.array(VeApprovalSchema).default([]),
  budget: z.object({
    tokens_cap: z.number().int().positive().default(12_600_000),
    credits: z.object({ higgsfield: z.number().nonnegative().default(0), runway: z.number().nonnegative().default(0) }).strict().default({ higgsfield: 0, runway: 0 }),
  }).strict().default({ tokens_cap: 12_600_000, credits: { higgsfield: 0, runway: 0 } }),
  signed: z.object({ by: z.literal('Krish'), said: z.string().min(2), on: DateSchema, script_sha256: Sha256V1Schema }).strict().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
  max_face_share: z.number().min(0).max(1).optional(),
}).strict().superRefine((spec, c) => {
  if (spec.brand.series === 'mind.the.gap' && !spec.call) c.addIssue({ code: 'custom', path: ['call'], message: 'mind.the.gap ends in a dated call: add call.statement, call.due and call.confidence_percent' })
  const datasets = new Set(spec.datasets.map((d) => d.id))
  const objects = new Set(spec.objects.map((o) => o.obj))
  const assets = new Set(spec.assets.map((a) => a.id))
  spec.objects.forEach((o, i) => {
    if (o.dataset && !datasets.has(o.dataset)) c.addIssue({ code: 'custom', path: ['objects', i, 'dataset'], message: `unknown dataset ${o.dataset}` })
  })
  for (const [cutId, cut] of Object.entries(spec.cuts)) {
    const seen = new Set<string>()
    let lastEnd = -1
    cut.beats.forEach((b, i) => {
      const at = ['cuts', cutId, 'beats', i]
      if (seen.has(b.id)) c.addIssue({ code: 'custom', path: [...at, 'id'], message: `duplicate beat id ${b.id}` })
      seen.add(b.id)
      if (b.span.from_w <= lastEnd) c.addIssue({ code: 'custom', path: [...at, 'span'], message: 'beats run in script order and never overlap' })
      lastEnd = b.span.to_w
      if (b.plate.source.startsWith('asset:') && !assets.has(b.plate.source.slice(6))) c.addIssue({ code: 'custom', path: [...at, 'plate', 'source'], message: `unknown asset ${b.plate.source.slice(6)}` })
      b.events.forEach((e, j) => {
        if (!objects.has(e.obj)) c.addIssue({ code: 'custom', path: [...at, 'events', j, 'obj'], message: `unknown object ${e.obj}` })
        if (e.at_w < b.span.from_w || e.at_w > b.span.to_w) c.addIssue({ code: 'custom', path: [...at, 'events', j, 'at_w'], message: 'an event fires on a word inside its beat' })
      })
    })
  }
})

export type ProductionSpecV2 = z.infer<typeof ProductionSpecV2Schema>
export type VeBeat = z.infer<typeof VeBeatSchema>
export type VeEvent = z.infer<typeof VeEventSchema>
