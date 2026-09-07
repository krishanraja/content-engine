import { z } from 'zod'

export const CAROUSEL_SCHEMA_VERSION = 1 as const
const CarouselSeriesSchema = z.enum(['money_of_ai', 'built_with_ai'])

const CarouselVisualStageSchema = z.enum([
  'meaning_map',
  'visual_casting',
  'territory_audition',
  'storyboard_asset_gate',
  'final',
])

const CarouselDecisionPointSchema = z.enum([
  'combined_visual_route',
  'meaning',
  'casting',
  'territory',
  'storyboard_and_assets',
  'final',
])

const CarouselCollaborationModeSchema = z.object({
  stages: z.array(CarouselVisualStageSchema).min(2),
  decision_points: z.array(CarouselDecisionPointSchema).min(2),
}).strict()

export const CarouselVisualDirectionMethodV1Schema = z.object({
  schema_version: z.literal(CAROUSEL_SCHEMA_VERSION),
  method_id: z.literal('mindmake-carousel-visual-direction-v1'),
  default_mode: z.literal('standard'),
  boundary: z.object({
    input: z.literal('completed_content_idea'),
    topic_ideation_allowed: z.literal(false),
    recording_ideation_allowed: z.literal(false),
    incomplete_action: z.literal('return_to_content_owner'),
    engine_may: z.tuple([
      z.literal('challenge_visualizability'),
      z.literal('request_evidence'),
      z.literal('flag_ambiguity'),
    ]),
  }).strict(),
  modes: z.object({
    fast: CarouselCollaborationModeSchema,
    standard: CarouselCollaborationModeSchema,
    exploratory: CarouselCollaborationModeSchema,
  }).strict(),
  casting_lanes: z.tuple([
    z.literal('real_world_evidence'),
    z.literal('infographic'),
    z.literal('physical_analogy'),
    z.literal('cultural_restage'),
    z.literal('handmade'),
    z.literal('surreal_wildcard'),
  ]),
  territory_audition: z.object({
    candidate_count: z.literal(3),
    styleframes_per_candidate: z.literal(2),
    required_territories: z.tuple([
      z.literal('evidence_led'),
      z.literal('explanatory'),
      z.literal('unexpected'),
    ]),
  }).strict(),
  choice_rules: z.object({
    analogy_must_clarify: z.literal(true),
    shock_must_carry_meaning: z.literal(true),
    proof_separate_from_illustration: z.literal(true),
    meme_requires_rights_path: z.literal(true),
    genericness_penalty: z.literal(true),
  }).strict(),
  learning: z.object({
    store_contextual_reason: z.literal(true),
    infer_object_preference: z.literal(false),
    record_rejections: z.literal(true),
    novelty_against_own_corpus: z.literal(true),
    durable_rule_requires_approval: z.literal(true),
  }).strict(),
  branding: z.object({
    series_wordmark: z.literal('top_left_channel_signpost'),
    mindmake_wordmark: z.literal('bottom_left_publisher_signature'),
    official_assets_only: z.literal(true),
    one_of_each_per_card: z.literal(true),
  }).strict(),
}).strict().superRefine((method, context) => {
  const expectedStages = ['meaning_map', 'visual_casting', 'territory_audition', 'storyboard_asset_gate', 'final']
  const expected = {
    fast: ['combined_visual_route', 'final'],
    standard: ['meaning', 'territory', 'storyboard_and_assets', 'final'],
    exploratory: ['meaning', 'casting', 'territory', 'storyboard_and_assets', 'final'],
  } as const
  if (method.modes.fast.stages.join(':') !== ['visual_casting', 'territory_audition', 'storyboard_asset_gate', 'final'].join(':')) context.addIssue({ code: 'custom', path: ['modes', 'fast', 'stages'], message: 'fast mode must preserve casting, audition, asset and final stages' })
  for (const mode of ['standard', 'exploratory'] as const) {
    if (method.modes[mode].stages.join(':') !== expectedStages.join(':')) context.addIssue({ code: 'custom', path: ['modes', mode, 'stages'], message: `${mode} mode must preserve the full visual direction sequence` })
  }
  for (const mode of ['fast', 'standard', 'exploratory'] as const) {
    if (method.modes[mode].decision_points.join(':') !== expected[mode].join(':')) context.addIssue({ code: 'custom', path: ['modes', mode, 'decision_points'], message: `${mode} mode has the wrong human decision sequence` })
  }
})

export type CarouselVisualDirectionMethodV1 = z.infer<typeof CarouselVisualDirectionMethodV1Schema>
const CarouselClaimSchema = z.object({
  claim_id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(['fact', 'inference', 'judgment']),
  evidence_urls: z.array(z.string().url()),
  verification: z.enum(['verified', 'needs_review', 'unsupported']),
}).strict().superRefine((claim, context) => {
  if (claim.kind === 'fact' && claim.verification === 'verified' && claim.evidence_urls.length === 0) context.addIssue({ code: 'custom', path: ['evidence_urls'], message: 'verified facts require evidence URLs' })
})
export const CarouselPlatformSchema = z.enum(['linkedin_document', 'instagram'])
export const CarouselSourceFormatSchema = z.enum([
  'money_trace', 'artifact', 'verdict', 'cold_open_cutdown',
  'builder_conversation', 'build_itself', 'third_why', 'first_version',
])
export const CarouselSlideRoleSchema = z.enum(['cover', 'scene', 'mechanism', 'proof', 'counterpoint', 'resolution'])
export const CarouselLayoutSchema = z.enum(['cover', 'statement', 'split_gate', 'flow', 'evidence', 'verdict'])
export const CarouselSceneSchema = z.enum([
  'signal_room',
  'inspection_table',
  'engraving_bench',
  'lever_cutaway',
  'xray_mismatch',
  'shutter_cabinet',
  'output_tray',
])

export const CarouselAssetV1Schema = z.object({
  asset_id: z.string().min(1),
  source_path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  media_kind: z.enum(['image', 'screenshot', 'diagram']),
  truth_role: z.enum(['evidence', 'owned_artifact', 'illustration', 'decoration']),
  generated: z.boolean(),
  rights: z.enum(['owned', 'permissioned', 'quotation_exception', 'generated']),
  approval: z.object({ decision: z.literal('approved'), approved_by: z.literal('Krish'), approved_at: z.string().datetime(), artifact_hash: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
  attribution: z.string().min(1).optional(),
  source_url: z.string().url().optional(),
  illustration_label: z.string().min(1).optional(),
}).strict().superRefine((asset, context) => {
  if ((asset.truth_role === 'evidence' || asset.media_kind === 'screenshot') && !asset.approval) context.addIssue({ code: 'custom', path: ['approval'], message: 'evidence and screenshot assets require exact approval' })
  if (asset.approval && asset.approval.artifact_hash !== asset.sha256) context.addIssue({ code: 'custom', path: ['approval', 'artifact_hash'], message: 'asset approval must bind the exact asset hash' })
  if (asset.generated && asset.truth_role === 'evidence') context.addIssue({ code: 'custom', path: ['truth_role'], message: 'generated media cannot be evidence' })
  if (asset.generated && !asset.illustration_label) context.addIssue({ code: 'custom', path: ['illustration_label'], message: 'generated media requires an illustration label' })
  if (asset.generated !== (asset.rights === 'generated')) context.addIssue({ code: 'custom', path: ['rights'], message: 'generated rights classification must match generated media' })
  if (asset.truth_role === 'evidence' && (!asset.source_url || !asset.attribution)) context.addIssue({ code: 'custom', path: ['source_url'], message: 'evidence assets require a source URL and attribution' })
})

export const CarouselSlideV1Schema = z.object({
  slide_id: z.string().min(1),
  position: z.number().int().min(1).max(10),
  role: CarouselSlideRoleSchema,
  layout: CarouselLayoutSchema,
  scene: CarouselSceneSchema,
  question_answered: z.string().min(8).max(160),
  headline: z.string().min(3).max(120),
  body: z.string().min(3).max(300).optional(),
  data_label: z.string().min(1).max(80).optional(),
  visual_items: z.array(z.string().min(1).max(80)).max(5).default([]),
  claim_ids: z.array(z.string().min(1)).default([]),
  asset_ids: z.array(z.string().min(1)).default([]),
  accent: z.enum(['none', 'mint_answer', 'amber_changed']).default('none'),
}).strict()

export const CarouselEditorialAssessmentV1Schema = z.object({
  disposition: z.enum(['publishable', 'revise', 'reject']),
  unique: z.boolean(),
  researched: z.boolean(),
  thoughtful: z.boolean(),
  kind: z.boolean(),
  helpful: z.boolean(),
  strongest_reason_to_reject: z.string().min(12),
  audience_payoff: z.string().min(12),
  countercase: z.string().min(12),
}).strict()

export const CarouselApprovalV1Schema = z.object({
  gate: z.enum(['story', 'visual_direction', 'final']),
  decision: z.literal('approved'),
  approved_by: z.literal('Krish'),
  approved_at: z.string().datetime(),
  artifact_hash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

export const CarouselStoryV1Schema = z.object({
  schema_version: z.literal(CAROUSEL_SCHEMA_VERSION),
  story_id: z.string().min(1),
  title: z.string().min(3),
  series: CarouselSeriesSchema,
  source_format: CarouselSourceFormatSchema,
  target_audience: z.string().min(8),
  source_artifact: z.object({ kind: z.enum(['owned', 'public', 'internal_sanitized']), ref: z.string().min(1), source_hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  platforms: z.array(CarouselPlatformSchema).min(1),
  fixed_seed: z.string().min(8),
  brand_theme: z.object({
    theme_id: z.string().min(1),
    theme_hash: z.string().regex(/^[a-f0-9]{64}$/),
    design_repository: z.literal('krishanraja/mindmake'),
    design_commit: z.string().regex(/^[a-f0-9]{40}$/),
    design_contract_path: z.literal('project-documentation/03_DESIGN_CONTRACT.md'),
  }).strict(),
  claims: z.array(CarouselClaimSchema).default([]),
  assets: z.array(CarouselAssetV1Schema).default([]),
  slides: z.array(CarouselSlideV1Schema).min(5).max(10),
  editorial: CarouselEditorialAssessmentV1Schema,
  approvals: z.array(CarouselApprovalV1Schema).default([]),
}).strict().superRefine((story, context) => {
  const allowedFormats = story.series === 'money_of_ai'
    ? new Set(['money_trace', 'artifact', 'verdict', 'cold_open_cutdown'])
    : new Set(['builder_conversation', 'build_itself', 'third_why', 'first_version'])
  if (!allowedFormats.has(story.source_format)) context.addIssue({ code: 'custom', path: ['source_format'], message: 'source format does not belong to this series' })
  const positions = story.slides.map((slide) => slide.position)
  if (new Set(positions).size !== positions.length || positions.some((position, index) => position !== index + 1)) context.addIssue({ code: 'custom', path: ['slides'], message: 'slide positions must be unique and contiguous from 1' })
  if (story.slides[0]?.role !== 'cover' || story.slides.at(-1)?.role !== 'resolution') context.addIssue({ code: 'custom', path: ['slides'], message: 'story must open with a cover and end with a resolution' })
  const scenes = story.slides.map((slide) => slide.scene)
  if (new Set(scenes).size !== scenes.length) context.addIssue({ code: 'custom', path: ['slides'], message: 'each carousel slide requires a unique narrative scene' })
  const claimIds = new Set(story.claims.map((claim) => claim.claim_id))
  const assetIds = new Set(story.assets.map((asset) => asset.asset_id))
  for (const [index, slide] of story.slides.entries()) {
    for (const claimId of slide.claim_ids) if (!claimIds.has(claimId)) context.addIssue({ code: 'custom', path: ['slides', index, 'claim_ids'], message: `unknown claim ${claimId}` })
    for (const assetId of slide.asset_ids) if (!assetIds.has(assetId)) context.addIssue({ code: 'custom', path: ['slides', index, 'asset_ids'], message: `unknown asset ${assetId}` })
  }
  if (story.editorial.disposition === 'publishable' && ![story.editorial.unique, story.editorial.researched, story.editorial.thoughtful, story.editorial.kind, story.editorial.helpful].every(Boolean)) {
    context.addIssue({ code: 'custom', path: ['editorial'], message: 'publishable stories must pass all five editorial principles' })
  }
  if (story.editorial.disposition === 'publishable' && story.claims.some((claim) => claim.verification !== 'verified')) context.addIssue({ code: 'custom', path: ['claims'], message: 'publishable stories cannot contain unverified or unsupported claims' })
}).transform((story) => ({ ...story, slides: [...story.slides].sort((left, right) => left.position - right.position) }))

export type CarouselStoryV1 = z.infer<typeof CarouselStoryV1Schema>
export type CarouselSlideV1 = z.infer<typeof CarouselSlideV1Schema>

export const CarouselDraftPackageV1Schema = z.object({
  schema_version: z.literal(CAROUSEL_SCHEMA_VERSION),
  package_id: z.string().min(1),
  story_id: z.string().min(1),
  story_hash: z.string().regex(/^[a-f0-9]{64}$/),
  created_at: z.string().datetime(),
  slide_pngs: z.array(z.object({ position: z.number().int().positive(), path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(5),
  linkedin_pdf: z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
  platforms: z.array(CarouselPlatformSchema).min(1),
  public_posting_authorised: z.literal(false),
}).strict()

export type CarouselDraftPackageV1 = z.infer<typeof CarouselDraftPackageV1Schema>
