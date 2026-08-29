import { z } from 'zod'

export const SCHEMA_VERSION = 1 as const

export const SeriesSchema = z.enum(['money_of_ai', 'built_with_ai'])
export type Series = z.infer<typeof SeriesSchema>

export const SourceModeSchema = z.enum(['extract', 'solo', 'short_native'])
export type SourceMode = z.infer<typeof SourceModeSchema>

export const JobPurposeSchema = z.enum(['production', 'calibration'])
export type JobPurpose = z.infer<typeof JobPurposeSchema>

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

export const ApprovalGateSchema = z.enum(['angle', 'evidence', 'treatment', 'final'])
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
  actor: z.enum(['krish', 'codex', 'system']).default('krish'),
  occurred_at: z.string(),
})

export const JobManifestV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  job_id: z.string().min(1),
  created_at: z.string(),
  updated_at: z.string(),
  series: SeriesSchema,
  mode: SourceModeSchema,
  purpose: JobPurposeSchema.default('production'),
  presenter_name: z.string().min(1).optional(),
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

export const EditSegmentV1Schema = z.object({
  segment_id: z.string().min(1),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().positive(),
  role: z.enum(['hook', 'body', 'ending']),
  transcript: z.string().min(1),
  selection_reason: z.string().min(12),
})
export type EditSegmentV1 = z.infer<typeof EditSegmentV1Schema>

export const EditPlanV1Schema = z.object({
  structure: z.enum(['continuous', 'stitched']),
  segments: z.array(EditSegmentV1Schema).min(1).max(8),
  caption_script: z.string().min(1),
  semantic_throughline: z.string().min(20),
  continuity_rationale: z.string().min(20),
  continuous_baseline: z.object({
    start_ms: z.number().int().nonnegative(),
    end_ms: z.number().int().positive(),
    verdict: z.enum(['selected', 'rejected']),
    rationale: z.string().min(20),
  }),
  cold_open: z.object({
    decision: z.enum(['used', 'not_used']),
    rationale: z.string().min(16),
  }),
  source_order: z.object({
    decision: z.enum(['preserved', 'reordered']),
    rationale: z.string().min(16),
  }),
  meaning_preservation: z.array(z.object({
    removed_token: z.string().min(1),
    category: z.enum(['negation', 'uncertainty', 'condition', 'contrast', 'quantity']),
    rationale: z.string().min(20),
  })).default([]),
  retained_disfluencies: z.array(z.object({ phrase: z.string().min(1), rationale: z.string().min(12) })).default([]),
  total_duration_ms: z.number().int().positive(),
})

const EditorialScoresV1Schema = z.object({
  semantic_coherence: z.number().min(0).max(1),
  impact: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  insight: z.number().min(0).max(1),
  specificity: z.number().min(0).max(1),
  audience_value: z.number().min(0).max(1),
  hook_strength: z.number().min(0).max(1),
  ending_strength: z.number().min(0).max(1),
})

export const RerecordGuidanceV1Schema = z.object({
  reason: z.string().min(20),
  hook: z.string().min(12),
  missing_proof: z.string().min(12),
  structure: z.string().min(12),
  delivery: z.string().min(12),
  ending: z.string().min(12),
  target_duration_seconds: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
}).refine((value) => value.target_duration_seconds.max >= value.target_duration_seconds.min, { message: 'rerecord maximum duration must be at least the minimum' })

export const EditorialAssessmentV1Schema = z.object({
  disposition: z.enum(['publishable', 'revise', 'rerecord', 'reject', 'discovery_only']),
  scores: EditorialScoresV1Schema,
  semantic_checks: z.object({
    standalone_without_source: z.boolean(),
    referents_resolved: z.boolean(),
    claim_boundaries_preserved: z.boolean(),
    causal_chain_preserved: z.boolean(),
    visual_dependencies_available: z.boolean(),
    audience_payoff_specific: z.boolean(),
    ending_complete: z.boolean(),
  }),
  semantic_failure_notes: z.array(z.string().min(12)).default([]),
  strongest_reason_to_reject: z.string().min(12),
  selection_rationale: z.string().min(20),
  audience_payoff: z.string().min(16),
  rerecord_guidance: RerecordGuidanceV1Schema.optional(),
}).superRefine((value, context) => {
  if (value.disposition === 'rerecord' && !value.rerecord_guidance) context.addIssue({ code: 'custom', path: ['rerecord_guidance'], message: 'rerecord disposition requires specific guidance' })
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
  edit_plan: EditPlanV1Schema.optional(),
  editorial: EditorialAssessmentV1Schema.optional(),
  identity_mentions: z.array(z.object({
    name: z.string().min(1),
    role: z.enum(['presenter', 'guest', 'subject']),
    evidence: z.string().min(8),
  })).default([]),
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

export const EvidenceOverlayV1Schema = z.object({
  overlay_id: z.string().min(1),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().positive(),
  kind: z.enum(['screenshot', 'document', 'diagram']),
  asset_path: z.string().min(1),
  title: z.string().min(1).max(90),
  excerpt: z.string().max(180).optional(),
  source_label: z.string().min(1).max(80),
  source_url: z.string().url().optional(),
  viewer_intent: z.enum(['maintain_connection', 'verify_claim', 'inspect_artifact', 'understand_mechanism']).optional(),
  presentation: z.enum(['presenter_primary', 'sidecar', 'evidence_cutaway']).optional(),
  anchor: z.enum(['top_left', 'top_right', 'left', 'right', 'center']).optional(),
  face_policy: z.enum(['avoid', 'intentional_substitution']).optional(),
  placement: z.enum(['upper', 'center']).default('upper'),
  fit: z.enum(['contain', 'cover']).default('contain'),
  attribution: z.string().min(1),
  rights_rationale: z.string().min(20),
  approved: z.boolean().default(false),
}).refine((value) => value.end_ms > value.start_ms, { message: 'evidence overlay must end after it starts' })
export type EvidenceOverlayV1 = z.infer<typeof EvidenceOverlayV1Schema>

export const OrchestratedEvidenceOverlayV1Schema = EvidenceOverlayV1Schema.superRefine((value, context) => {
  for (const field of ['viewer_intent', 'presentation', 'anchor', 'face_policy'] as const) {
    if (!value[field]) context.addIssue({ code: 'custom', path: [field], message: `approved evidence requires ${field}` })
  }
  if (value.presentation === 'evidence_cutaway' && value.face_policy !== 'intentional_substitution') {
    context.addIssue({ code: 'custom', path: ['face_policy'], message: 'an evidence cutaway must explicitly declare intentional presenter substitution' })
  }
  if (value.presentation && value.presentation !== 'evidence_cutaway' && value.face_policy !== 'avoid') {
    context.addIssue({ code: 'custom', path: ['face_policy'], message: 'presenter-visible evidence must explicitly avoid the presenter' })
  }
})
export type OrchestratedEvidenceOverlayV1 = z.infer<typeof OrchestratedEvidenceOverlayV1Schema>

export const EvidenceApprovalPacketV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  packet_id: z.string().min(1),
  job_id: z.string().min(1),
  candidate_hash: z.string().regex(/^[a-f0-9]{64}$/),
  duration_ms: z.number().int().positive(),
  created_at: z.string(),
  strategy_summary: z.string().min(20),
  ending_return_to_presenter: z.boolean().default(true),
  contact_sheet_path: z.string().min(1),
  contact_sheet_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  items: z.array(z.object({
    overlay: OrchestratedEvidenceOverlayV1Schema,
    asset_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    pixel_width: z.number().int().positive(),
    pixel_height: z.number().int().positive(),
  })).min(1).max(8),
})
export type EvidenceApprovalPacketV1 = z.infer<typeof EvidenceApprovalPacketV1Schema>

export const RenderManifestV1Schema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  job_id: z.string(),
  candidate_id: z.string(),
  hook: z.string(),
  series: SeriesSchema,
  branding: z.enum(['series', 'none']).default('series'),
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
    caption_personality: z.enum(['clean', 'kinetic']).default('clean'),
  }),
  captions: z.array(CaptionCueSchema),
  evidence_overlays: z.array(EvidenceOverlayV1Schema).default([]),
  edit_segments: z.array(EditSegmentV1Schema).default([]),
  caption_provenance: z.object({
    source: z.enum(['captions', 'faster_whisper', 'manual']),
    transcript_hash: z.string(),
    verified: z.boolean(),
    alignment_similarity: z.number().min(0).max(1),
    exact_word_fidelity: z.boolean().default(false),
    source_token_count: z.number().int().nonnegative().default(0),
    caption_token_count: z.number().int().nonnegative().default(0),
  }).optional(),
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
  origin: z.enum(['user', 'codex', 'system']).default('user'),
  before_hash: z.string(),
  after_hash: z.string().optional(),
  delta_features: z.array(z.object({ feature: z.string(), before: z.unknown().optional(), after: z.unknown().optional() })),
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
