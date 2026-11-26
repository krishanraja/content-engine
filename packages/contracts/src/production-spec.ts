import {isV5Id,v5Params} from './why-ladder-v5.js'
import { z } from 'zod'
import { IdentifierV1Schema, NarrativeBeatV1Schema, Sha256V1Schema } from './v2.js'

/** The ve ProductionSpec: creative-direction.json at schema_version 2. One signed
 *  spec per piece is the only creative artefact; the engine compiles it into the
 *  EDL, cue sheet and render props. Positions are word indexes into the signed
 *  script (w), never seconds, so a treatment can be written before recording.
 *  docs/ve/ENGINE.md explains the fields; config/ve holds formats, crew and tokens. */

export const VE_FORMATS = ['face-with-proof', 'scoreboard-test', 'voice-led-pictures', 'hand-held-screen', 'two-passports', 'why-ladder-v5'] as const
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
/** Shot types of the shot grammar (Ruling, Krish, 2026-11-20: "The shot grammar is approved"). */
export const VE_SHOTS = ['band', 'stage', 'anchor', 'plate', 'number', 'chapter', 'title', 'end'] as const
/** The stagings a cut's body may use under the shot grammar; pillar is band's 16:9 form for a vertical take. */
export const VE_STAGING_MODES = ['house', 'fill', 'stack', 'band', 'stage', 'tray', 'pillar', 'anchor'] as const
/** The signature format is the why-ladder (Ruling, Krish, 2026-11-24: "the signature format is the 5 Whys; get rid of
 *  everything that suggests predictions, calls, dated, odds or scores"): a `why` beat is one rung of it and a `landing`
 *  beat is where it lands, what this shows plus an open question handed to the viewer, never a verdict or a forecast. */
export const VeRoleSchema = z.enum(['hook', 'anchor', 'bridge', 'pivot', 'payoff', 'why', 'landing'])
/** The rung a `why` beat climbs, in the why-ladder's own names (packages/contracts/src/whys.ts WhyRung, WhyStrength). */
export const VeWhyStepSchema = z.object({
  n: z.number().int().min(1).max(7),
  question: z.string().min(8).max(160),
  strength: z.enum(['documented', 'inferred', 'open']),
}).strict()
/** Where the ladder lands (packages/contracts/src/whys.ts WhyLanding): what this shows, and the open question. */
export const VeLandingSchema = z.object({
  shows: z.string().min(12).max(300),
  open_question: z.string().min(8).max(200),
}).strict()
// The same verbs as the renderer's EngineEventSchema (apps/renderer/src/engine/props.ts), so a spec can name every
// verb a library device accepts (config/ve/devices.json); compile still refuses a verb its device does not list.
export const VeVerbSchema = z.enum(['enter', 'move', 'mark', 'fill', 'stamp', 'count_to', 'highlight', 'carry', 'exit', 'draw', 'bounce', 'sulk', 'wave', 'add', 'chip', 'type', 'send', 'pick', 'drop', 'grey', 'multiply', 'dim', 'thin', 'grow', 'light', 'connect', 'rest_on', 'stripe'])
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
  // The beat's shot type under the shot grammar (docs/ve/INGREDIENTS.md, "Shot grammar"; Ruling, Krish, 2026-11-20: one
  // staging per cut). The body takes the cut's one staging (band, stage or anchor); only the title, a chapter mark, the end
  // card and, on an anchor cut, a full graphic plate break from it. The planner writes it; ve lint (grammar.*) reads it.
  shot: z.enum(VE_SHOTS).optional(),
  // Depth (shot grammar step 5; docs/ve/INGREDIENTS.md "Shot grammar"): a `number` beat's in-world word or number, set
  // behind him through the subject matte at head height, its glyphs 0.4 to 0.6 of the frame's height, slamming in on
  // at_w (anchor cuts; `ve matte` makes the matte); a `chapter` beat's numeral beside or behind him, a different
  // arrangement each time in a cut.
  world: z.object({ text: z.string().min(1).max(12), at_w: WordSchema.optional(), accent: z.enum(['mint', 'channel']).optional() }).strict().optional(),
  chapter: z.object({ mark: z.string().min(1).max(3), label: z.string().min(1).max(16).optional(),
    arrangement: z.enum(['beside_left', 'beside_right', 'rotated', 'behind']), accent: z.enum(['mint', 'channel']).optional() }).strict().optional(),
  plate: z.object({ source: z.string().regex(/^(take|none|asset:[a-z0-9][a-z0-9_-]*)$/), crop: z.string().min(1).optional() }).strict(),
  // One real picture under the beat's graphics, fitted by cover: the panel above his face on a staged beat, the whole
  // frame on a graphics-only beat (Krish, 2026-11-18: "making actual use of the full screen when it isn't my face").
  backdrop: z.string().regex(/^asset:[a-z0-9][a-z0-9_-]*$/).optional(),
  // A `why` beat names its rung and a `landing` beat its landing; no other beat carries either (ve lint story.why).
  why: VeWhyStepSchema.optional(),
  landing: VeLandingSchema.optional(),
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
  /** A proof excerpt (Gate 2) skips the whole-cut story rules: one payoff, the face runs. */
  excerpt: z.boolean().default(false),
  edit: z.object({
    remove: z.array(z.object({ from_w: WordSchema, to_w: WordSchema, why: z.string().min(3) }).strict()).default([]),
    speed: z.number().min(1).max(1.35).default(1),
    speed_said: z.string().min(2).optional(),
    // A pause longer than longer_than_s, between two words he said straight through, is cut down to a breath where
    // both aligners agree on a gap (velib/conform.py tighten; Krish, 2026-11-17: "clip out empty awkward silences").
    pauses: z.object({ longer_than_s: z.number().min(0.4).max(3), said: z.string().min(12) }).strict().optional(),
  }).strict().refine((v) => v.speed === 1 || !!v.speed_said, { message: "a speed change needs Krish's words in speed_said", path: ['speed_said'] }),
  captions: z.object({ region: z.string().min(1).default('default'), emphasis: z.array(WordSchema).default([]) }).strict(),
  /** Impact zoom (Krish, 2026-11-26: "Zoom for impact ... classy and subtle rather than too aggressive";
   *  config/ve/impact-zoom.json): the words a human or the narrative lock pins a push on, in place of the automatic
   *  choice. compile refuses a pin that breaks a hard rule (a banned beat, a cut, the spacing). */
  impact: z.array(z.object({ at_w: WordSchema, strength: z.enum(['normal', 'strong']).default('normal') }).strict()).max(12).optional(),
  /** No impact zoom on this cut at all. */
  impact_off: z.literal(true).optional(),
  beats: z.array(VeBeatSchema).min(1),
  music: VeCutMusicSchema.optional(),
  /** A cut's own music bed when the piece's bed cannot hold this cut's length to the one bed shape (Wed 18, 18 Nov 2026:
   *  Mind Bender, 3:20, looped under a 4:55 long cut and lost its loud open). Same ledger rules as audio.bed. */
  bed: z.object({ ledger_id: z.string().min(1), reason: z.string().min(12) }).strict().optional(),
}).strict()
  .refine((v) => !(v.impact_off && v.impact?.length), { message: 'a cut pins impact pushes or turns them off, not both', path: ['impact_off'] })
  .refine((v) => (v.impact ?? []).filter((pin) => pin.strength === 'strong').length <= 1, { message: 'one strong impact push a cut, on its single biggest word', path: ['impact'] })

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

/** Off-day voiceover shorts may be voiced with his approved ElevenLabs clone; hero cuts stay on his real takes (Ruling,
 *  Krish, 2026-11-15). An asset of kind `voice` is that clone's reading of the signed script: generated, its tool
 *  `<tool>.voice_clone:<registry name>` (`ve voice clone` writes it). The schema holds its shape here; ve lint holds
 *  the rest (scripts/velib/lint.py: voice.clone_route for the off day and the tool, voice.synthetic for his approval
 *  in krish-clone's registry). */
export const VE_CLONE_VOICE_RULING = 'Ruling, Krish, 2026-11-15: off-day voiceover shorts may be voiced with his approved ElevenLabs clone; hero cuts stay on his real takes'

export const VeAssetSchema = z.object({
  id: SlugSchema,
  kind: z.enum(['logo', 'screenshot', 'document', 'photo', 'illustration', 'broll', 'recording', 'sfx', 'music', 'voice']),
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
  // What a generated picture stands for (Ruling, Krish, 2026-11-20: generated imagery, photoreal included, is allowed when
  // art-directed and clearly a metaphor; generated stand-ins for real documents, signs, places or people are refused):
  // `metaphor` (an art-directed image that reads as a figure of speech) or `real` (it stands in for a real document,
  // sign, place or person, which ve lint refuses). Required on every generated picture (grammar.generated).
  depicts: z.enum(['real', 'metaphor']).optional(),
  // A note for the record only: ve never draws it and no check requires it (no ILLUSTRATION tag, Krish, 28 Oct 2026).
  label: z.string().min(2).optional(),
  // A recording's frame in pixels, so a 16:9 cut knows a vertical take before any layout is chosen (config/ve/piece-guards.json
  // take_orientation reads it; Build or buy, 18 Nov: a vertical take on 16:9 layouts cut the top of his head). Never typed
  // on a new piece: ve ingest measures the take's size and rotation with ffprobe and writes it on the take record
  // (media.frame), which lint and compile read (scripts/velib/takes.py cut_frame). A typed frame here is kept only so an
  // older spec still compiles; with no layout named, compile stages a vertical take on 16:9 as pillar.
  frame: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict().optional(),
}).strict().superRefine((v, c) => {
  if (v.origin === 'generated') {
    if (!['illustration', 'broll', 'sfx', 'music', 'voice'].includes(v.kind)) c.addIssue({ code: 'custom', path: ['kind'], message: 'generated media is illustration, broll, sfx, music or his approved clone voice, never evidence' })
    if (!v.tool) c.addIssue({ code: 'custom', path: ['tool'], message: 'generated media names the tool that made it' })
  }
  if (v.kind === 'voice' && v.origin !== 'generated') c.addIssue({ code: 'custom', path: ['origin'], message: `a voice asset is his clone's reading, so it is generated; his own voice is a recording or a take (${VE_CLONE_VOICE_RULING})` })
  if (/\bCC[ -]BY/i.test(v.licence) && !v.credit) c.addIssue({ code: 'custom', path: ['credit'], message: 'a CC BY licence needs its credit line' })
})

export const VeAudioSchema = z.object({
  master: z.enum(['take', 'vo']),
  bed: z.object({
    ledger_id: z.string().min(1),
    epidemic_edit_id: z.string().min(1).optional(),
    mode: z.enum(['continuous', 'episode', 'ducked', 'episode_bed']),
    under_vo_lu: z.number().max(-12).min(-30).default(-20),
    // Krish's ear on this piece's music, in dB under the house levels (an episode_bed's intro, bed, chapter and outro
    // all move by it). Krish, 2026-11-18: "Aspire, but turn the volume down 15%." (-1.41 dB).
    trim_db: z.number().min(-6).max(0).optional(),
  }).strict(),
  sfx_kit: z.string().min(1).default('house-v1'),
  targets: z.object({ lufs: z.number().default(-14), tp: z.number().max(-1).default(-1) }).strict().default({ lufs: -14, tp: -1 }),
}).strict()

export const VeApprovalSchema = z.object({
  gate: z.enum(['treatment', 'proof', 'final', 'spend', 'synthetic', 'exception']),
  by: z.literal('Krish'),
  said: z.string().min(2),
  on: DateSchema,
  // The moment he pressed, as a full timestamp: a date alone is read as midnight, so a press later that day would not
  // count against renders made earlier the same day (scripts/velib/guards.py last_press). Older records keep `on` only.
  at: z.string().datetime({ offset: true }).optional(),
  // `engine-follows-main`: his standing yes for this piece to take the engine on main as it moves (guards.follows_main).
  scope: z.enum(['engine', 'engine-follows-main']).optional(),
  artifact_hash: Sha256V1Schema,
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

// The day each series publishes on (Monday follow.the.money, Wednesday under.the.hood, Friday mind.the.gap; the
// house channels in config/studio.json). A piece published on any other day is an off-day piece: it wears no series
// promise (velib/guards.off_day).
const VE_SERIES_WEEKDAY: Record<string, number> = { 'follow.the.money': 1, 'under.the.hood': 3, 'mind.the.gap': 5 }

export function veOffDay(spec: { publish_day?: string | undefined, brand: { series: string } }): boolean {
  if (!spec.publish_day) return false
  const weekday = new Date(`${spec.publish_day}T12:00:00Z`).getUTCDay()
  return weekday !== VE_SERIES_WEEKDAY[spec.brand.series]
}

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
      'soft-ai', 'gaming-stream', 'simple-one-word', 'podcast', 'art-directed', 'cinematic', 'slam', 'georgia-build', 'stair-flash', 'tuck-stack', 'anchor-quote', 'rack-focus', 'flip-hinge', 'slice', 'slot-roll', 'receipt-chip', 'ink-block', 'mint-word', 'house-v5']).optional(),
    title: z.string().min(3).max(48).optional(),
    // The logo rule (config/brand-palette.json logo_rule: no logo in a cut's body, only on the title frame and the close)
    // applied to a piece ahead of the rule's date, on Krish's word for that piece (Tue 17, 18 Nov 2026: "we have a strict
    // NO ICONS, ONLY THE WORDMARK DURING THE TITLE FRAME AND THE CLOSING FRAME").
    body_logo: z.literal(false).optional(),
    reference: z.string().min(1).optional(),
    // Required by ve lint for every piece publishing after 5 Nov 2026: at least one card for look, one for motion
    // and one for the caption build (scripts/velib/lint.py, reference_lints).
    references: z.array(VeReferenceSchema).optional(),
    intro_sting: z.string().optional(),
    // Retired (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever."): from 9 Nov it put a piece's own episode
    // card where the sting was. Kept in the shape only so the refusal below can name it; any value is refused.
    opening_exception: z.unknown().optional(),
  }).strict(),
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
      'soft-ai', 'gaming-stream', 'simple-one-word', 'podcast', 'art-directed', 'cinematic', 'slam', 'georgia-build', 'stair-flash', 'tuck-stack', 'anchor-quote', 'rack-focus', 'flip-hinge', 'slice', 'slot-roll', 'receipt-chip', 'ink-block', 'mint-word', 'house-v5']),
      placement: z.enum(['lower', 'centre', 'upper', 'seam', 'chin']).optional(), reason: z.string().min(1) }).strict().optional(),
    // lead: the exit leads the entrance, on a handover that travels (docs/ve/INGREDIENTS.md, 15 Nov 2026).
    transitions: z.object({ kind: z.enum(['cut', 'whip', 'push', 'zoom-through', 'flash', 'punch', 'crossfade']), lead: z.boolean().optional(), reason: z.string().min(1) }).strict()
      .refine((t) => !t.lead || (['whip', 'push', 'zoom-through', 'punch'] as string[]).includes(t.kind), { message: 'style.transitions.lead leads a handover that travels: whip, push, zoom-through or punch', path: ['lead'] }).optional(),
    // focus: the graphics layer pushes onto the line a device reports, for a motion style that does not already.
    camera: z.object({ move: z.enum(['none', 'drift', 'phased', 'punch']), hits: z.boolean().optional(), focus: z.boolean().optional(), reason: z.string().min(1) }).strict().optional(),
    energy: z.enum(['calm', 'medium', 'high']).optional(),
    // IDs are checked against Krish's approved sounds by ve lint and compile.
    sound: z.object({ handover: z.string().min(1).optional(), hit: z.string().min(1).optional(),
      gainDb: z.number().finite().max(0).optional(), reason: z.string().min(1) }).strict().optional(),
    // How a graphics-only beat uses the frame (docs/ve/INGREDIENTS.md; Krish, 2026-11-13: "the use of the screen space is terrible").
    // `cuts` names a cut's own staging where it differs from `mode` (one staging per cut, picked at the lock with the
    // recipe; Ruling, Krish, 2026-11-20): anchor is refused on 16:9, so an anchor short beside a wide long names it here.
    layout: z.object({ mode: z.enum(VE_STAGING_MODES), cuts: z.record(SlugSchema, z.enum(VE_STAGING_MODES)).optional(),
      reason: z.string().min(1) }).strict().optional(),
  }).catchall(z.unknown()).optional(),
  max_face_share: z.number().min(0).max(1).optional(),
  character: VeCharacterSchema.optional(),
  // The episode title moment (Krish, 2026-11-15: the episode title should be "integrated into a sentence seamlessly
  // near the start of the video and the production suite knows that this is the moment to make it feel like the
  // title, instead of regular captions"). `title` is the episode title, `line` the sentence he says that carries it,
  // as written in the teleprompter script; `spans` marks that sentence's words in each cut's take once it is recorded.
  // The renderer shows the title there as its own animated title and the captions step aside for those words. ve lint
  // requires it for a series piece from 16 Nov 2026 (scripts/velib/lint.py, title_moment_lints).
  // The title question his intro speaks (house rule INTRO_PATTERN; Ruling, Krish, 2026-11-17: "how can you encode this intro
  // style for the future?"): the one line the video's title animation is keyed to. making.py scripts records it as
  // script_check.title_line; ve lint (title.line) refuses a spec whose script never says it.
  title_line: z.string().min(3).max(160).optional(),
  title_moment: z.object({
    title: z.string().min(3).max(80),
    line: z.string().min(8).max(240),
    spans: z.record(SlugSchema, VeSpanSchema).optional(),
    /** The title lands on a card that slams in over the caption band, never bare over his face (Krish, 18 Nov 2026). */
    card: z.boolean().optional(),
  }).strict().optional(),
}).strict().superRefine((spec, c) => {
  if (spec.brand.intro_sting !== undefined && spec.brand.intro_sting !== VE_NO_STING && spec.brand.intro_sting !== VE_NO_STING_BEFORE) {
    c.addIssue({ code: 'custom', path: ['brand', 'intro_sting'], message: `nothing goes before the hook (Ruling, Krish, 2026-11-12: "${VE_NOTHING_BEFORE_HOOK}"): brand.intro_sting is "${VE_NO_STING}", or unset` })
  }
  if (spec.brand.opening_exception !== undefined) {
    c.addIssue({ code: 'custom', path: ['brand', 'opening_exception'], message: `nothing goes before the hook (Ruling, Krish, 2026-11-12: "${VE_NOTHING_BEFORE_HOOK}"): remove brand.opening_exception` })
  }
  // His clone voices only an off-day voiceover short (VE_CLONE_VOICE_RULING): a spec that carries it is a voiceover
  // with one voice, every cut a 9:16 short read from it, so no hero cut and no take of his can sit beside it. Whether the
  // day is an off day is ve lint's (voice.clone_route, from config/studio.json's series days).
  const voices = spec.assets.filter((a) => a.kind === 'voice')
  if (voices.length > 0) {
    const route = `his clone voices an off-day voiceover short only (${VE_CLONE_VOICE_RULING})`
    if (voices.length > 1) c.addIssue({ code: 'custom', path: ['assets'], message: `one clone voice per spec, the one every cut takes: ${route}` })
    if (spec.audio.master !== 'vo') c.addIssue({ code: 'custom', path: ['audio', 'master'], message: `a spec with a clone voice has the voiceover master (vo): ${route}` })
    if (!spec.publish_day) c.addIssue({ code: 'custom', path: ['publish_day'], message: `a spec with a clone voice names its publish_day, so its off day can be checked: ${route}` })
    const voiceIds = new Set(voices.map((a) => a.id))
    for (const [cutId, cut] of Object.entries(spec.cuts)) {
      if (cut.aspect !== '9:16') c.addIssue({ code: 'custom', path: ['cuts', cutId, 'aspect'], message: `every cut of a clone-voiced spec is a 9:16 short: ${route}` })
      if (!voiceIds.has(cut.take)) c.addIssue({ code: 'custom', path: ['cuts', cutId, 'take'], message: `every cut of a clone-voiced spec takes the clone voice asset, never a take of his: ${route}` })
    }
  }
  const datasets = new Set(spec.datasets.map((d) => d.id))
  const objects = new Set(spec.objects.map((o) => o.obj))
  const assets = new Set(spec.assets.map((a) => a.id))
  spec.objects.forEach((o, i) => {
    if (isV5Id(o.device)) {
      const result = v5Params[o.device].safeParse(o.params)
      if (!result.success) for (const issue of result.error.issues) c.addIssue({code:'custom', path:['objects',i,'params',...issue.path], message:issue.message})
    }
    if (o.dataset && !datasets.has(o.dataset)) c.addIssue({ code: 'custom', path: ['objects', i, 'dataset'], message: `unknown dataset ${o.dataset}` })
  })
  for (const [cutId, cut] of Object.entries(spec.cuts)) {
    const seen = new Set<string>()
    let lastEnd = -1
    cut.beats.forEach((b, i) => {
      const at = ['cuts', cutId, 'beats', i]
      if (b.uses.filter(id => spec.objects.find(o => o.obj === id)?.device === 'v5_callout').length > 1) c.addIssue({code:'custom',path:[...at,'uses'],message:'Only one callout can appear at once'})
      if (seen.has(b.id)) c.addIssue({ code: 'custom', path: [...at, 'id'], message: `duplicate beat id ${b.id}` })
      seen.add(b.id)
      if (b.span.from_w <= lastEnd) c.addIssue({ code: 'custom', path: [...at, 'span'], message: 'beats run in script order and never overlap' })
      lastEnd = b.span.to_w
      if (b.plate.source.startsWith('asset:') && !assets.has(b.plate.source.slice(6))) c.addIssue({ code: 'custom', path: [...at, 'plate', 'source'], message: `unknown asset ${b.plate.source.slice(6)}` })
      if (b.backdrop && !assets.has(b.backdrop.slice(6))) c.addIssue({ code: 'custom', path: [...at, 'backdrop'], message: `unknown asset ${b.backdrop.slice(6)}` })
      if (b.role === 'why' && !b.why) c.addIssue({ code: 'custom', path: [...at, 'why'], message: 'a why beat names its rung: why { n, question, strength }' })
      if (b.role !== 'why' && b.why) c.addIssue({ code: 'custom', path: [...at, 'why'], message: 'only a why beat names a rung' })
      if (b.role === 'landing' && !b.landing) c.addIssue({ code: 'custom', path: [...at, 'landing'], message: 'a landing beat carries its landing: landing { shows, open_question }' })
      if (b.role !== 'landing' && b.landing) c.addIssue({ code: 'custom', path: [...at, 'landing'], message: 'only a landing beat carries the landing' })
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
export type VeWhyStep = z.infer<typeof VeWhyStepSchema>
export type VeLanding = z.infer<typeof VeLandingSchema>
