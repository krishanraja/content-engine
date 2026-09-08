import { z } from 'zod'
import { FeedbackScopeV2Schema, IdentifierV1Schema, Sha256V1Schema } from './v2.js'

export const STUDIO_SESSION_SCHEMA_VERSION_V1 = 1 as const

export const StudioClientV1Schema = z.enum([
  'control_center',
  'codex_desktop',
  'codex_cli',
  'codex_cloud',
  'claude_desktop',
  'claude_code',
  'claude_ai',
  'chatgpt',
  'other_mcp',
])
export type StudioClientV1 = z.infer<typeof StudioClientV1Schema>

export const StudioCapabilityV1Schema = z.enum([
  'session_read',
  'job_read',
  'job_create_from_drive',
  'review_read',
  'direction_write',
  'review_decide',
  'feedback_write',
  'feedback_confirm',
  'learning_read',
  'learning_decide',
  'repository_write',
  'local_media_read',
  'local_render',
])
export type StudioCapabilityV1 = z.infer<typeof StudioCapabilityV1Schema>

const IsoDateV1Schema = z.string().datetime()

export const StudioSessionV1Schema = z.object({
  schema_version: z.literal(STUDIO_SESSION_SCHEMA_VERSION_V1),
  session_id: z.string().uuid(),
  client: StudioClientV1Schema,
  actor: z.object({
    actor_id: IdentifierV1Schema,
    display_name: z.literal('Krish'),
  }).strict(),
  capabilities: z.array(StudioCapabilityV1Schema).min(1).refine((items) => new Set(items).size === items.length, { message: 'session capabilities must be unique' }),
  repository: z.object({
    // Both names, on purpose, and not forever.
    //
    // The repository is `krishanraja/content-engine` now. This was a z.literal
    // of the old name, and a literal is a flag day: the moment the control
    // plane required the new one, the Windows runner, which is pinned to an
    // older checkout and is reinstalled by hand, would have had every session
    // it opened refused. Nothing would have said why except a schema error on
    // a machine nobody is watching.
    //
    // So the schema accepts either and the engine emits the new one. Narrow
    // this back to a single literal once the runner has been reinstalled from a
    // commit that emits it, which is a deliberate step, not a cleanup.
    name: z.enum(['krishanraja/content-engine', 'krishanraja/mindmake-video-studio']),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
  }).strict(),
  linked_job_ids: z.array(IdentifierV1Schema).max(100).refine((items) => new Set(items).size === items.length, { message: 'linked job IDs must be unique' }),
  privacy_mode: z.literal('structured_events_only'),
  tracking_state: z.enum(['tracked', 'read_only_untracked']),
  opened_at: IsoDateV1Schema,
  last_seen_at: IsoDateV1Schema,
  closed_at: IsoDateV1Schema.nullable(),
}).strict().superRefine((value, context) => {
  if (Date.parse(value.last_seen_at) < Date.parse(value.opened_at)) context.addIssue({ code: 'custom', path: ['last_seen_at'], message: 'session last-seen time cannot precede opening' })
  if (value.closed_at && Date.parse(value.closed_at) < Date.parse(value.last_seen_at)) context.addIssue({ code: 'custom', path: ['closed_at'], message: 'session closure cannot precede its last event' })
  if (value.tracking_state === 'read_only_untracked' && value.capabilities.some((capability) => capability.endsWith('_write') || capability === 'review_decide' || capability === 'feedback_confirm' || capability === 'learning_decide')) {
    context.addIssue({ code: 'custom', path: ['capabilities'], message: 'untracked sessions cannot advertise mutation capabilities' })
  }
})
export type StudioSessionV1 = z.infer<typeof StudioSessionV1Schema>

export const StudioInteractionActionV1Schema = z.enum([
  'session_opened',
  'session_closed',
  'job_linked',
  'job_created_from_drive',
  'artifact_viewed',
  'direction_submitted',
  'review_approved',
  'review_rejected',
  'revision_requested',
  'feedback_praised',
  'feedback_recorded',
  'feedback_confirmed',
  'feedback_corrected',
  'learning_approved',
  'learning_rejected',
])
export type StudioInteractionActionV1 = z.infer<typeof StudioInteractionActionV1Schema>

export const StudioInteractionEventV1Schema = z.object({
  schema_version: z.literal(STUDIO_SESSION_SCHEMA_VERSION_V1),
  event_id: z.string().uuid(),
  idempotency_key: z.string().uuid(),
  session_id: z.string().uuid(),
  client: StudioClientV1Schema,
  action: StudioInteractionActionV1Schema,
  job_id: IdentifierV1Schema.optional(),
  artifact: z.object({
    artifact_id: z.string().trim().min(1).max(160),
    before_hash: Sha256V1Schema.optional(),
    after_hash: Sha256V1Schema.optional(),
  }).strict().optional(),
  explicit_feedback_excerpt: z.string().trim().min(1).max(1_600).optional(),
  detected_differences: z.array(z.object({
    feature: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(600),
  }).strict()).max(32).default([]),
  inference: z.object({
    rationale: z.string().trim().min(1).max(1_600),
    confidence: z.number().min(0).max(1),
    scope: FeedbackScopeV2Schema,
  }).strict().optional(),
  confirmation_state: z.enum(['not_applicable', 'pending', 'confirmed', 'corrected', 'observation_only']),
  provenance: z.object({
    tool_name: z.string().regex(/^studio\.[a-z][a-z0-9_.]{1,79}$/),
    request_hash: Sha256V1Schema,
  }).strict(),
  occurred_at: IsoDateV1Schema,
}).strict().superRefine((value, context) => {
  if (value.artifact?.after_hash && !value.artifact.before_hash) context.addIssue({ code: 'custom', path: ['artifact', 'before_hash'], message: 'an after hash requires a before hash' })
  if (value.confirmation_state === 'pending' && !value.inference) context.addIssue({ code: 'custom', path: ['inference'], message: 'pending confirmation requires an inference' })
  if (value.confirmation_state === 'confirmed' || value.confirmation_state === 'corrected') {
    if (!value.inference || !value.explicit_feedback_excerpt) context.addIssue({ code: 'custom', path: ['explicit_feedback_excerpt'], message: 'confirmed learning requires an inference and exact feedback excerpt' })
  }
})
export type StudioInteractionEventV1 = z.infer<typeof StudioInteractionEventV1Schema>

export const LearningProposalV1Schema = z.object({
  schema_version: z.literal(STUDIO_SESSION_SCHEMA_VERSION_V1),
  proposal_id: z.string().uuid(),
  weekly_batch_id: IdentifierV1Schema,
  proposal_class: z.enum(['taste', 'performance', 'engine_quality']),
  assertion: z.string().trim().min(1).max(1_600),
  scope: FeedbackScopeV2Schema,
  evidence_event_ids: z.array(z.string().uuid()).min(1).max(100).refine((items) => new Set(items).size === items.length, { message: 'proposal evidence IDs must be unique' }),
  independent_session_count: z.number().int().positive(),
  independent_job_count: z.number().int().nonnegative(),
  counterexamples: z.array(z.string().trim().min(1).max(600)).max(20),
  regression_cases: z.array(z.string().trim().min(1).max(600)).min(1).max(40),
  proposed_change: z.object({
    kind: z.enum(['preference_rule', 'configuration', 'code_change']),
    summary: z.string().trim().min(1).max(1_600),
    draft_pull_request_url: z.string().url().optional(),
  }).strict(),
  status: z.enum(['proposed', 'approved', 'corrected', 'rejected', 'superseded']),
  created_at: IsoDateV1Schema,
  decided_at: IsoDateV1Schema.optional(),
  decided_by: z.literal('Krish').optional(),
}).strict().superRefine((value, context) => {
  if (value.proposal_class === 'performance' && (value.independent_job_count < 3 || value.independent_session_count < 3)) {
    context.addIssue({ code: 'custom', path: ['evidence_event_ids'], message: 'performance proposals require three comparable tests' })
  }
  if (value.status !== 'proposed' && (!value.decided_at || value.decided_by !== 'Krish')) {
    context.addIssue({ code: 'custom', path: ['decided_by'], message: 'a terminal proposal decision requires Krish' })
  }
})
export type LearningProposalV1 = z.infer<typeof LearningProposalV1Schema>

export const StudioSessionReceiptV1Schema = z.object({
  schema_version: z.literal(STUDIO_SESSION_SCHEMA_VERSION_V1),
  session_id: z.string().uuid(),
  event_count: z.number().int().nonnegative(),
  learning_observation_count: z.number().int().nonnegative(),
  pending_confirmation_count: z.number().int().nonnegative(),
  event_chain_hash: Sha256V1Schema,
  closed_at: IsoDateV1Schema,
}).strict()
export type StudioSessionReceiptV1 = z.infer<typeof StudioSessionReceiptV1Schema>
