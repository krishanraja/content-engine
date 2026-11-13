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
/** brand.intro_sting: nothing goes before the hook, ever (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever.
 *  Remove the sting exception for good."), so the one value a piece may name is VE_NO_STING, or leave it unset. The
 *  series stings (config/intro-sting.json, retired) are listed only so the refusal can name what it refuses; ve lint
 *  refuses the same (scripts/velib/guards.py, opening_problems). */
export const VeStingSchema = z.enum(['follow_the_money', 'mind_the_gap', 'under_the_hood'])
/** The sentence scripts/post-pack/creative_direction.py writes as NO_STING (tests/ve_thursday_guards_test.py pins them equal). */
export const VE_NO_STING = 'none: this piece opens on its hook, and nothing goes before it'
/** The same answer as written before 2026-11-12, still read as no sting so a spec from before the ruling parses. */
export const VE_NO_STING_BEFORE = 'none: this piece opens on its hook (an off day, or no wide long cut)'
export const VE_NOTHING_BEFORE_HOOK = 'Nothing before the hook, ever. Remove the sting exception for good.'
export const VeAspectSchema = z.enum(['9:16', '16:9'])
export const VeLayoutSchema = z.enum(['P1', 'P3', 'P6', 'F1', 'F3', 'STAGE', 'SPLIT', 'WINDOW'])
export const VeRoleSchema = z.enum(['hook', 'anchor', 'bridge', 'pivot', 'payoff', 'call'])
// The same verbs as the renderer's EngineEventSchema (apps/renderer/src/engine/props.ts), so a spec can name every
// verb a library device accepts (config/ve/devices.json); compile still refuses a verb its device does not list.
export const VeVerbSchema = z.enum(['enter', 'move', 'mark', 'fill', 'stamp', 'count_to', 'highlight', 'carry', 'exit', 'draw',
  'bounce', 'sulk', 'wave', 'add', 'chip', 'type', 'send', 'pick'])
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
  face: z.enum(['full', 'window', 'off']).optional(),
  plate: z.object({ source: z.string().regex(/^(take|none|asset:[a-z0-9][a-z0-9_-]*)$/), crop: z.string().min(1).optional() }).strict(),
  uses: z.array(z.string().min(1)).default([]),
  events: z.array(VeEventSchema).default([]),
  transition_out: VeTransitionSchema.default('cut'),
  override_reason: z.string().min(12).optional(),
}).strict()

// The cut's own music plan, when it departs from the one bed shape (config/music-bed.json): outside clips heard with
// their own sound, and a bed that enters late. Krish, 2026-11-09, of Wednesday 11 Nov's opening: "I want the audio and the
// video to play at the start of this track of this video to draw people in" and "we go straight from the first video
// track to the second video track and then move into Seize It". Every time is on the cut's own clock, in seconds (a
// sting in front is added by ve premix). A clip's level points name the ledger's approved levels: `open` is intro_lufs,
// `under` is bed_lufs, `off` is silence, linear in dB between points. `end_s` ends the clip's sound on a beat of its own
// song, after a low-pass sweep of `sweep_s`. Two clips sound together only inside a declared handover; the bed is silent
// before `bed_enter_s` and rises over `bed_fade_in_s`. Handovers (and the bed's rise) are left out of the steadiness and
// drop-out checks, the way chapter lifts are. `said` is Krish's words asking for it: the plan is never invented.
export const VeCutMusicSchema = z.object({
  said: z.string().min(12),
  clips: z.array(z.object({
    asset: SlugSchema,
    src_from_s: z.number().min(0).default(0),
    at_s: z.number().min(0),
    end_s: z.number().positive(),
    points: z.array(z.object({ t: z.number().min(0), level: z.enum(['open', 'under', 'off']) }).strict()).min(1),
    sweep_s: z.number().min(0).max(2).default(0),
  }).strict().refine((v) => v.end_s > v.at_s, { message: 'a clip ends after it starts', path: ['end_s'] })).default([]),
  bed_enter_s: z.number().min(0).default(0),
  bed_fade_in_s: z.number().min(0).max(12).default(0),
  handovers: z.array(z.tuple([z.number().min(0), z.number().positive()])).default([]),
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
  music: VeCutMusicSchema.optional(),
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
  // A note for the record only: ve never draws it and no check requires it (no ILLUSTRATION tag, Krish, 28 Oct 2026).
  label: z.string().min(2).optional(),
}).strict().superRefine((v, c) => {
  if (v.origin === 'generated') {
    if (!['illustration', 'broll', 'sfx', 'music'].includes(v.kind)) c.addIssue({ code: 'custom', path: ['kind'], message: 'generated media is illustration, broll, sfx or music, never evidence' })
    if (!v.tool) c.addIssue({ code: 'custom', path: ['tool'], message: 'generated media names the tool that made it' })
  }
  if (/\bCC[ -]BY/i.test(v.licence) && !v.credit) c.addIssue({ code: 'custom', path: ['credit'], message: 'a CC BY licence needs its credit line' })
})

export const VeAudioSchema = z.object({
  master: z.enum(['take', 'vo']),
  bed: z.object({
    ledger_id: z.string().min(1),
    epidemic_edit_id: z.string().min(1).optional(),
    mode: z.enum(['continuous', 'episode', 'ducked', 'episode_bed']),
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

// A card on Krish's inspiration board that this piece is held to (Krish, 2026-11-03: "I even gave literal inspiration in
// the inspiration board on the quality I expect, and also the subtitle builds we could have"). `card` is the board's
// own name for the clip (its file stem, instagram_DePHDr_jRed); `drive_id` is where its video lives, read at packet
// time and never copied into the repository; `takeaway` says in words what the cut must match. `id` is the card's
// inspiration_items.id, what the board, the making record's clip_uses and card_uses all key on; ve lint requires it
// from 6 Nov 2026 and `ve refs` checks it against GET /api/inspiration/cards. `offered: true` marks a card `ve init`
// pre-filled from GET /api/inspiration/candidates: the session confirms it by deleting the flag, or replaces the card.
export const VeReferenceSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'the Inspiration card id (inspiration_items.id, a uuid)').optional(),
  card: z.string().regex(/^[a-z]+_[A-Za-z0-9_-]{4,}$/, 'the board card name, the clip file stem (instagram_DePHDr_jRed)'),
  for: z.array(z.enum(['look', 'motion', 'captions'])).min(1),
  drive_id: z.string().regex(/^[A-Za-z0-9_-]{20,}$/, 'the Drive file id of the reference video'),
  takeaway: z.string().min(12),
  offered: z.boolean().optional(),
}).strict()

// Krish's cartoon character, placed at the bottom of a cut from his drawn pose library (config/ve/character.json,
// _corpus/keyframes-character.md). Optional and off unless named: ve lint (scripts/velib/character.py) refuses it until
// he has approved the base, the library is built and the character_layer device is registered. Each cue is the pose
// for the word that carries an idea; never inside a cut's hook beat.
export const VeCharacterCueSchema = z.object({
  at_w: WordSchema,
  pose: SlugSchema,
  spot: z.enum(['centre', 'left', 'right']).optional(),
  sink_px: z.number().int().min(0).max(190).optional(),
}).strict()

export const VeCharacterSchema = z.object({
  id: SlugSchema,
  cuts: z.array(SlugSchema).min(1),
  cues: z.array(VeCharacterCueSchema).min(1),
}).strict()

export const ProductionSpecV2Schema = z.object({
  schema_version: z.literal(2),
  piece_id: IdentifierV1Schema,
  publish_day: DateSchema.optional(),
  format: VeFormatSchema,
  theme: SlugSchema,
  brand: z.object({
    series: VeSeriesSchema,
    // 'word': one word at a time, off the face, under a held title (Krish, 2026-11-03: "its the georgia subtitles
    // build, and the motion and graphics of the other one"; inspiration card instagram_DePHDr_jRed).
    captions: z.enum(['house', 'word']),
    // A caption theme instead of the house caption (Krish, 2026-11-11: "install all of these different caption styles
    // in to the engine, so future productions can select from them"). Names as apps/renderer/src/engine/captions/names.ts.
    caption_theme: z.enum(['pop', 'karaoke', 'kinetic-01', 'kinetic-02', 'hustle', 'grape', 'beast', 'poppin', 'aarit',
      'soft-ai', 'gaming-stream', 'simple-one-word', 'podcast', 'art-directed', 'cinematic', 'slam', 'georgia-build', 'stair-flash', 'tuck-stack', 'anchor-quote', 'rack-focus', 'flip-hinge', 'slice', 'slot-roll', 'receipt-chip', 'ink-block', 'mint-word']).optional(),
    title: z.string().min(3).max(48).optional(),
    reference: z.string().min(1).optional(),
    // Required by ve lint for every piece publishing after 5 Nov 2026: at least one card for look, one for motion
    // and one for the caption build (scripts/velib/lint.py, reference_lints).
    references: z.array(VeReferenceSchema).optional(),
    intro_sting: z.string().optional(),
    // Retired (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever."): from 9 Nov it put a piece's own episode
    // card where the sting was. Kept in the shape only so the refusal below can name it; any value is refused.
    opening_exception: z.unknown().optional(),
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
  // style.motion is one module from the motion layer of config/style-references.json and the point it lands; ve lint
  // (motion.required) checks the module against the bank and requires it from creative_direction.MOTION_FROM.
  style: z.object({
    motion: z.object({ module: z.string().min(1), reason: z.string().min(1) }).strict().optional(),
    // The ingredients chosen apart from the motion style (docs/ve/INGREDIENTS.md; Krish, 2026-11-13: "the captions
    // should be decoupled from the animation styles"). captions wins over brand.caption_theme.
    captions: z.object({ theme: z.enum(['pop', 'karaoke', 'kinetic-01', 'kinetic-02', 'hustle', 'grape', 'beast', 'poppin', 'aarit',
      'soft-ai', 'gaming-stream', 'simple-one-word', 'podcast', 'art-directed', 'cinematic', 'slam', 'georgia-build', 'stair-flash', 'tuck-stack', 'anchor-quote', 'rack-focus', 'flip-hinge', 'slice', 'slot-roll', 'receipt-chip', 'ink-block', 'mint-word']),
      placement: z.enum(['lower', 'centre', 'upper']).optional(), reason: z.string().min(1) }).strict().optional(),
    transitions: z.object({ kind: z.enum(['cut', 'whip', 'push', 'zoom-through', 'flash', 'punch']), reason: z.string().min(1) }).strict().optional(),
    camera: z.object({ move: z.enum(['none', 'drift', 'phased', 'punch']), hits: z.boolean().optional(), reason: z.string().min(1) }).strict().optional(),
    energy: z.enum(['calm', 'medium', 'high']).optional(),
    // How a graphics-only beat uses the frame (docs/ve/INGREDIENTS.md; Krish, 2026-11-13: "the use of the screen space is terrible").
    layout: z.object({ mode: z.enum(['house', 'fill', 'stack', 'band', 'stage', 'tray']), reason: z.string().min(1) }).strict().optional(),
  }).catchall(z.unknown()).optional(),
  max_face_share: z.number().min(0).max(1).optional(),
  character: VeCharacterSchema.optional(),
}).strict().superRefine((spec, c) => {
  if (spec.brand.series === 'mind.the.gap' && !spec.call) c.addIssue({ code: 'custom', path: ['call'], message: 'mind.the.gap ends in a dated call: add call.statement, call.due and call.confidence_percent' })
  if (spec.brand.intro_sting !== undefined && spec.brand.intro_sting !== VE_NO_STING && spec.brand.intro_sting !== VE_NO_STING_BEFORE) {
    c.addIssue({ code: 'custom', path: ['brand', 'intro_sting'], message: `nothing goes before the hook (Ruling, Krish, 2026-11-12: "${VE_NOTHING_BEFORE_HOOK}"): brand.intro_sting is "${VE_NO_STING}", or unset` })
  }
  if (spec.brand.opening_exception !== undefined) {
    c.addIssue({ code: 'custom', path: ['brand', 'opening_exception'], message: `nothing goes before the hook (Ruling, Krish, 2026-11-12: "${VE_NOTHING_BEFORE_HOOK}"): remove brand.opening_exception` })
  }
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
