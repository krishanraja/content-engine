import { z } from 'zod'

export const SCHEMA_VERSION = 1 as const

export const SeriesSchema = z.enum(['money_of_ai', 'built_with_ai'])
export type Series = z.infer<typeof SeriesSchema>

export const SourceModeSchema = z.enum(['extract', 'solo', 'short_native'])
export type SourceMode = z.infer<typeof SourceModeSchema>

export const StageNameSchema = z.enum([
  'brief',
  'script',
  'recording_brief',
  'ingest',
  'normalize',
  'transcript',
  'candidates',
  'claims',
  'treatment',
  'render',
  'qa',
  'package',
])
export type StageName = z.infer<typeof StageNameSchema>

export const ApprovalGateSchema = z.enum(['angle', 'treatment', 'final'])
export type ApprovalGate = z.infer<typeof ApprovalGateSchema>

export const JobSourceSchema = z.object({
  kind: z.enum(['file', 'youtube', 'radar', 'script']),
  ref: z.string().min(1),
  rights: z.enum(['owned', 'permissioned', 'commentary_exception', 'unverified']).default('unverified'),
  consent_note: z.string().optional(),
})

export const StageStateSchema = z.object({
  status: z.enum(['pending', 'running', 'complete', 'blocked', 'invalidated', 'skipped']),
  artifact_hash: z.string().optional(),
  artifact_path: z.string().optional(),
  updated_at: z.string(),
  reason: z.string().optional(),
})

export const ApprovalSchema = z.object({
  gate: ApprovalGateSchema,
  decision: z.enum(['approved', 'rejected', 'override']),
  artifact_hash: z.string(),
  reason: z.string().optional(),
  actor: z.string().default('krish'),
  occurred_at: z.string(),
})

export const JobManifestV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  job_id: z.string().min(1),
  created_at: z.string(),
  updated_at: z.string(),
  series: SeriesSchema,
  mode: SourceModeSchema,
  source: JobSourceSchema,
  config_hash: z.string(),
  skill_hashes: z.record(z.string(), z.string()),
  pinned_inputs: z.object({
    config_path: z.string(),
    skill_paths: z.record(z.string(), z.string()),
  }),
  stages: z.record(StageNameSchema, StageStateSchema),
  approvals: z.array(ApprovalSchema),
})
export type JobManifestV1 = z.infer<typeof JobManifestV1Schema>

export const StudioEventV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  event_id: z.string(),
  job_id: z.string(),
  type: z.enum(['job_created', 'stage_started', 'stage_completed', 'stage_invalidated', 'approval_recorded', 'feedback_recorded', 'rule_promoted']),
  occurred_at: z.string(),
  payload: z.record(z.string(), z.unknown()),
})
export type StudioEventV1 = z.infer<typeof StudioEventV1Schema>

export const StageArtifactV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  job_id: z.string(),
  stage: StageNameSchema,
  created_at: z.string(),
  input_hashes: z.record(z.string(), z.string()),
  config_hash: z.string(),
  tool_versions: z.record(z.string(), z.string()),
  payload: z.unknown(),
  artifact_hash: z.string(),
})
export type StageArtifactV1 = z.infer<typeof StageArtifactV1Schema>

const ScoreSetSchema = z.object({
  truth: z.number().min(0).max(1),
  evidence: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  tension: z.number().min(0).max(1),
  payoff: z.number().min(0).max(1),
  visual_proof: z.number().min(0).max(1),
  qualified_fit: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
})

export const ClaimSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(['fact', 'inference', 'judgment']),
  evidence_urls: z.array(z.string().url()),
  verification: z.enum(['verified', 'needs_review', 'unsupported']),
})

export const ChallengePacketSchema = z.object({
  strongest_objection: z.string(),
  safer_version: z.string(),
  stretch_version: z.string(),
  recommendation: z.string(),
  hard_blocks: z.array(z.string()),
  soft_blocks: z.array(z.string()),
})

export const CandidateV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  candidate_id: z.string(),
  job_id: z.string(),
  series: SeriesSchema,
  mode: SourceModeSchema,
  start_ms: z.number().int().nonnegative().optional(),
  end_ms: z.number().int().positive().optional(),
  transcript: z.string(),
  hook: z.string().min(1),
  payoff: z.string().min(1),
  scores: ScoreSetSchema,
  claims: z.array(ClaimSchema),
  challenge: ChallengePacketSchema,
  source_refs: z.array(z.string()),
})
export type CandidateV1 = z.infer<typeof CandidateV1Schema>

export const CaptionCueSchema = z.object({
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().positive(),
  text: z.string().min(1),
  emphasis: z.array(z.string()).default([]),
})

export const AssetLedgerEntrySchema = z.object({
  path: z.string(),
  rights: z.string(),
  purpose: z.string(),
  generated: z.boolean(),
  label: z.string().optional(),
  attribution: z.string().optional(),
  rights_rationale: z.string().optional(),
  approved: z.boolean().default(false),
}).superRefine((asset, context) => {
  if (asset.generated && !asset.label?.trim()) context.addIssue({ code: 'custom', path: ['label'], message: 'generated visuals require an illustration label' })
  if (/third[_ -]?party/i.test(asset.rights) && (!asset.attribution?.trim() || !asset.rights_rationale?.trim())) context.addIssue({ code: 'custom', path: ['rights'], message: 'third-party assets require attribution and a rights rationale' })
})

export const RenderManifestV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  job_id: z.string(),
  candidate_id: z.string(),
  hook: z.string(),
  series: SeriesSchema,
  treatment_id: z.string(),
  source_path: z.string(),
  source_hash: z.string(),
  source_width: z.number().int().positive(),
  source_height: z.number().int().positive(),
  output: z.object({ width: z.literal(1080), height: z.literal(1920), fps: z.literal(30), audio_hz: z.literal(48000) }),
  duration_ms: z.number().int().positive(),
  crop: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  crop_keyframes: z.array(z.object({ at_ms: z.number().int().nonnegative(), x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive(), confidence: z.number().min(0).max(1) })).default([]),
  style: z.object({
    caption_position: z.enum(['lower', 'middle']),
    caption_scale: z.number().min(0.8).max(1.25),
    hook_card_ms: z.number().int().nonnegative().max(3000),
    proof_motif: z.enum(['mechanism', 'evidence', 'artifact']),
  }),
  captions: z.array(CaptionCueSchema),
  accent: z.string(),
  fixed_seed: z.string(),
  assets: z.array(AssetLedgerEntrySchema),
})
export type RenderManifestV1 = z.infer<typeof RenderManifestV1Schema>

export const RadarCandidateV1Schema = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string().min(1),
  source_kind: z.enum(['public_signal', 'owned_artifact', 'internal_pattern']),
  sensitivity: z.enum(['public', 'owned', 'internal_sanitized']),
  occurred_at: z.string(),
  source_urls: z.array(z.string().url()),
  corroboration: z.number().int().nonnegative(),
  evidence_status: z.enum(['public_grounded', 'owned_grounded', 'public_evidence_required']),
  category: z.string(),
  source_ref_hash: z.string(),
  provider_score: z.number().optional(),
})

export const RadarFeedV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  provider: z.enum(['mm_ctrl', 'control_center', 'offline']),
  provider_version: z.string(),
  generated_at: z.string(),
  source_age: z.number().nonnegative(),
  candidates: z.array(RadarCandidateV1Schema),
})
export type RadarFeedV1 = z.infer<typeof RadarFeedV1Schema>
export type RadarCandidateV1 = z.infer<typeof RadarCandidateV1Schema>

export const FeedbackScopeSchema = z.object({
  level: z.enum(['global', 'series', 'mode', 'treatment', 'platform', 'job']),
  key: z.string(),
})

export const FeedbackEventV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  feedback_id: z.string(),
  job_id: z.string(),
  artifact_id: z.string(),
  stage: StageNameSchema,
  action: z.enum(['accept', 'reject', 'revise', 'praise']),
  before_hash: z.string(),
  after_hash: z.string().optional(),
  delta_features: z.array(z.object({ feature: z.string(), before: z.unknown(), after: z.unknown() })),
  user_note: z.string().optional(),
  inferred_rationale: z.string(),
  confidence: z.number().min(0).max(1),
  scope: FeedbackScopeSchema,
  confirmation: z.enum(['pending', 'confirmed', 'corrected', 'observation_only']),
  occurred_at: z.string(),
})
export type FeedbackEventV1 = z.infer<typeof FeedbackEventV1Schema>

export const PreferenceRuleV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  rule_id: z.string(),
  assertion: z.string(),
  scope: FeedbackScopeSchema,
  evidence_feedback_ids: z.array(z.string()),
  counterexamples: z.array(z.string()),
  regression_cases: z.array(z.string()),
  status: z.enum(['observed', 'inferred', 'confirmed', 'trial', 'eligible', 'user_approved', 'active', 'retired']),
  approved_by: z.string().optional(),
  approved_at: z.string().optional(),
})
export type PreferenceRuleV1 = z.infer<typeof PreferenceRuleV1Schema>

export const ExperimentV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  experiment_id: z.string(),
  hypothesis: z.string(),
  primary_variable: z.string(),
  control_job_ids: z.array(z.string()),
  treatment_job_ids: z.array(z.string()),
  platform: z.enum(['youtube', 'linkedin']),
  target_metric: z.string(),
  confounds: z.array(z.string()),
  status: z.enum(['planned', 'running', 'eligible', 'approved', 'rejected']),
})
export type ExperimentV1 = z.infer<typeof ExperimentV1Schema>

export const AnalyticsObservationV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  observation_id: z.string(),
  job_id: z.string(),
  platform: z.enum(['youtube', 'linkedin']),
  published_at: z.string().optional(),
  impressions: z.number().nonnegative().nullable(),
  views: z.number().nonnegative().nullable(),
  viewed_vs_swiped: z.number().nullable(),
  early_hold_rate: z.number().nullable(),
  average_view_duration_seconds: z.number().nonnegative().nullable(),
  average_percentage_viewed: z.number().nullable(),
  completion_rate: z.number().nullable(),
  rewatch_rate: z.number().nullable(),
  shares: z.number().nonnegative().nullable(),
  saves: z.number().nonnegative().nullable(),
  comments: z.number().nonnegative().nullable(),
  substantive_comments: z.number().nonnegative().nullable(),
  comment_quality: z.number().nullable(),
  followers_gained: z.number().nonnegative().nullable(),
  qualified_actions: z.number().nonnegative().nullable(),
  utm_actions: z.number().nonnegative().nullable(),
  published_artifact_hash: z.string(),
  source_file_hash: z.string(),
})
export type AnalyticsObservationV1 = z.infer<typeof AnalyticsObservationV1Schema>

export const DraftPackageV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  job_id: z.string(),
  platform: z.enum(['youtube', 'linkedin']),
  master_path: z.string(),
  captions_path: z.string().optional(),
  cover_path: z.string().optional(),
  titles: z.array(z.string()),
  description: z.string(),
  post_copy: z.string(),
  pinned_comment: z.string().optional(),
  claim_ledger_path: z.string(),
  asset_ledger_path: z.string(),
  provenance_path: z.string(),
  created_at: z.string(),
})
export type DraftPackageV1 = z.infer<typeof DraftPackageV1Schema>

export function normalizeSeries(value: string): Series {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'paid' || normalized === 'the_money_of_ai' || normalized === 'money_of_ai') return 'money_of_ai'
  if (normalized === 'built' || normalized === 'built_with_ai') return 'built_with_ai'
  return SeriesSchema.parse(normalized)
}

export const PUBLIC_SERIES_NAMES: Record<Series, string> = {
  money_of_ai: 'The Money of AI',
  built_with_ai: 'Built With AI',
}
