import { z } from 'zod'
import {
  IdentifierV1Schema,
  SeriesV2Schema,
  Sha256V1Schema,
  SourceModeV2Schema,
  StageNameV2Schema,
  TreatmentStagePayloadV2Schema,
  VideoPlatformV1Schema,
} from './v2.js'

export const CONTROL_PLANE_SCHEMA_VERSION_V1 = 1 as const

export const MagicEditCapabilityV1Schema = z.enum([
  'camera_crop_scale',
  'caption_emphasis',
  'overlay_anchor',
  'overlay_opacity',
  'overlay_timing_shift',
])
export type MagicEditCapabilityV1 = z.infer<typeof MagicEditCapabilityV1Schema>

export const MagicEditTargetV1Schema = z.object({
  target_id: IdentifierV1Schema,
  kind: z.enum(['camera', 'caption', 'overlay']),
  ordinal: z.number().int().nonnegative(),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().positive(),
  allowed_start_ms: z.number().int().nonnegative().optional(),
  allowed_end_ms: z.number().int().positive().optional(),
  caption_tokens: z.array(z.string().trim().min(1).max(80)).min(1).max(32).optional(),
  capabilities: z.array(MagicEditCapabilityV1Schema).min(1),
  allowed_anchors: z.array(z.enum(['top_left', 'top_right', 'left', 'right', 'center', 'bottom', 'gesture', 'tracked_region'])).default([]),
  current_anchor: z.enum(['full', 'top_left', 'top_right', 'left', 'right', 'center', 'bottom', 'gesture', 'tracked_region']).optional(),
  current_opacity: z.number().min(0).max(1).optional(),
}).strict().superRefine((value, context) => {
  if (value.end_ms <= value.start_ms) context.addIssue({ code: 'custom', path: ['end_ms'], message: 'magic-edit target must end after it starts' })
  if (value.kind !== 'overlay' && value.allowed_anchors.length) context.addIssue({ code: 'custom', path: ['allowed_anchors'], message: 'only overlay targets may declare allowed anchors' })
  if (value.kind === 'caption' && !value.caption_tokens?.length) context.addIssue({ code: 'custom', path: ['caption_tokens'], message: 'caption targets require their exact local tokens' })
  if (value.kind !== 'caption' && value.caption_tokens !== undefined) context.addIssue({ code: 'custom', path: ['caption_tokens'], message: 'only caption targets may declare local caption tokens' })
  if (value.kind === 'overlay' && (value.current_anchor === undefined || value.current_opacity === undefined)) context.addIssue({ code: 'custom', path: ['current_anchor'], message: 'overlay targets require current presentation values' })
  if (value.kind !== 'overlay' && (value.current_anchor !== undefined || value.current_opacity !== undefined)) context.addIssue({ code: 'custom', path: ['current_anchor'], message: 'only overlay targets may declare current presentation values' })
  const timingWindowDeclared = value.allowed_start_ms !== undefined || value.allowed_end_ms !== undefined
  if (timingWindowDeclared && value.kind !== 'overlay') context.addIssue({ code: 'custom', path: ['allowed_start_ms'], message: 'only overlay targets may declare a timing window' })
  if (timingWindowDeclared && (value.allowed_start_ms === undefined || value.allowed_end_ms === undefined)) context.addIssue({ code: 'custom', path: ['allowed_start_ms'], message: 'overlay timing windows require both bounds' })
  if (value.allowed_start_ms !== undefined && value.allowed_end_ms !== undefined) {
    if (value.allowed_end_ms <= value.allowed_start_ms) context.addIssue({ code: 'custom', path: ['allowed_end_ms'], message: 'overlay timing window must end after it starts' })
    if (value.start_ms < value.allowed_start_ms || value.end_ms > value.allowed_end_ms) context.addIssue({ code: 'custom', path: ['start_ms'], message: 'overlay target must be inside its timing window' })
  }
})
export type MagicEditTargetV1 = z.infer<typeof MagicEditTargetV1Schema>

export const MagicEditTargetMapV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  map_id: IdentifierV1Schema,
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  expected_parent_revision_hash: Sha256V1Schema,
  expected_parent_artifact_hash: Sha256V1Schema,
  render_manifest_hash: Sha256V1Schema,
  duration_ms: z.number().int().positive(),
  targets: z.array(MagicEditTargetV1Schema).min(1),
  generated_at: z.string().datetime(),
  semantic_target_map_hash: Sha256V1Schema,
}).strict().superRefine((value, context) => {
  if (new Set(value.targets.map((target) => target.target_id)).size !== value.targets.length) {
    context.addIssue({ code: 'custom', path: ['targets'], message: 'magic-edit target IDs must be unique' })
  }
  value.targets.forEach((target, index) => {
    if (target.end_ms > value.duration_ms) context.addIssue({ code: 'custom', path: ['targets', index, 'end_ms'], message: 'magic-edit target exceeds render duration' })
  })
})
export type MagicEditTargetMapV1 = z.infer<typeof MagicEditTargetMapV1Schema>

const MagicEditOperationBaseV1Schema = z.object({ target_id: IdentifierV1Schema })
export const MagicEditOperationV1Schema = z.discriminatedUnion('operation', [
  MagicEditOperationBaseV1Schema.extend({
    operation: z.literal('camera_crop_scale'),
    factor: z.number().min(0.75).max(1.25),
  }).strict(),
  MagicEditOperationBaseV1Schema.extend({
    operation: z.literal('caption_emphasis'),
    word_indexes: z.array(z.number().int().nonnegative()).min(1).max(4).refine((items) => new Set(items).size === items.length, { message: 'caption emphasis indexes must be unique' }),
  }).strict(),
  MagicEditOperationBaseV1Schema.extend({
    operation: z.literal('overlay_anchor'),
    anchor: z.enum(['top_left', 'top_right', 'left', 'right', 'center', 'bottom', 'gesture', 'tracked_region']),
  }).strict(),
  MagicEditOperationBaseV1Schema.extend({
    operation: z.literal('overlay_opacity'),
    opacity: z.number().min(0.5).max(1),
  }).strict(),
  MagicEditOperationBaseV1Schema.extend({
    operation: z.literal('overlay_timing_shift'),
    delta_ms: z.number().int().min(-5000).max(5000).refine((value) => value !== 0, { message: 'overlay timing shift cannot be zero' }),
  }).strict(),
])
export type MagicEditOperationV1 = z.infer<typeof MagicEditOperationV1Schema>

export const MagicEditSelectionV1Schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('moment'), at_ms: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal('range'), start_ms: z.number().int().nonnegative(), end_ms: z.number().int().positive() }).strict().refine((value) => value.end_ms > value.start_ms, { message: 'magic-edit range must end after it starts' }),
  z.object({ kind: z.literal('target'), target_ids: z.array(IdentifierV1Schema).min(1).max(8) }).strict(),
])
export type MagicEditSelectionV1 = z.infer<typeof MagicEditSelectionV1Schema>

export const MagicEditDirectionV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  direction_id: z.string().uuid(),
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  expected_parent_revision_hash: Sha256V1Schema,
  expected_parent_artifact_hash: Sha256V1Schema,
  semantic_target_map_hash: Sha256V1Schema,
  selection: MagicEditSelectionV1Schema,
  instruction: z.string().trim().min(3).max(600),
  protections: z.object({
    preserve_spoken_words: z.literal(true),
    preserve_spoken_order: z.literal(true),
    preserve_claims: z.literal(true),
    preserve_evidence: z.literal(true),
    preserve_rights: z.literal(true),
  }).strict(),
  requested_profile: z.literal('preview'),
  submitted_by: z.literal('Krish'),
  submitted_at: z.string().datetime(),
}).strict()
export type MagicEditDirectionV1 = z.infer<typeof MagicEditDirectionV1Schema>

export const MagicEditIntentV1Schema = MagicEditDirectionV1Schema.omit({ direction_id: true, instruction: true, submitted_at: true }).extend({
  intent_id: z.string().uuid(),
  direction_id: z.string().uuid(),
  direction_hash: Sha256V1Schema,
  instruction_hash: Sha256V1Schema,
  operations: z.array(MagicEditOperationV1Schema).min(1).max(6),
  compiler: z.object({ kind: z.literal('bounded_deterministic'), version: z.literal(1) }).strict(),
  compiled_at: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (value.selection.kind === 'target') {
    const selected = new Set(value.selection.target_ids)
    value.operations.forEach((operation, index) => {
      if (!selected.has(operation.target_id)) context.addIssue({ code: 'custom', path: ['operations', index, 'target_id'], message: 'compiled operation target must be part of the selected target set' })
    })
  }
})
export type MagicEditIntentV1 = z.infer<typeof MagicEditIntentV1Schema>

export const MagicEditCompileResultV1Schema = z.discriminatedUnion('status', [
  z.object({
    schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
    status: z.literal('compiled'),
    intent_hash: Sha256V1Schema,
    intent: MagicEditIntentV1Schema,
    protected_invariants: z.array(z.enum(['spoken_words', 'spoken_order', 'claims', 'evidence', 'rights'])).length(5),
  }).strict(),
  z.object({
    schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
    status: z.literal('requires_editorial_route'),
    intent_hash: Sha256V1Schema,
    reason_code: z.enum(['meaning_change', 'claim_change', 'evidence_change', 'story_change', 'unsupported_direction']),
  }).strict(),
])
export type MagicEditCompileResultV1 = z.infer<typeof MagicEditCompileResultV1Schema>

export const MagicEditGateResultsV1Schema = z.object({
  truth: z.object({ status: z.enum(['passed', 'blocked', 'pending']), codes: z.array(z.string().min(1)) }).strict(),
  rights: z.object({ status: z.enum(['passed', 'blocked', 'pending']), codes: z.array(z.string().min(1)) }).strict(),
  confidentiality: z.object({ status: z.enum(['passed', 'blocked', 'pending']), codes: z.array(z.string().min(1)) }).strict(),
  transcript_fidelity: z.object({ status: z.enum(['passed', 'blocked', 'pending']), codes: z.array(z.string().min(1)) }).strict(),
  naming: z.object({ status: z.enum(['passed', 'blocked', 'pending']), codes: z.array(z.string().min(1)) }).strict(),
}).strict().superRefine((value, context) => {
  for (const [gate, result] of Object.entries(value)) {
    if (result.status === 'passed' && result.codes.length) context.addIssue({ code: 'custom', path: [gate, 'codes'], message: 'passing magic-edit gates cannot contain block codes' })
    if (result.status !== 'passed' && !result.codes.length) context.addIssue({ code: 'custom', path: [gate, 'codes'], message: 'non-passing magic-edit gates require at least one safe code' })
  }
})
export type MagicEditGateResultsV1 = z.infer<typeof MagicEditGateResultsV1Schema>

export const MagicEditCandidateV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  candidate_id: IdentifierV1Schema,
  candidate_hash: Sha256V1Schema,
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  intent_hash: Sha256V1Schema,
  expected_parent_revision_hash: Sha256V1Schema,
  expected_parent_artifact_hash: Sha256V1Schema,
  semantic_target_map_hash: Sha256V1Schema,
  prepared_render_manifest_hash: Sha256V1Schema,
  prepared_treatment_artifact_hash: Sha256V1Schema,
  prepared_treatment_payload: TreatmentStagePayloadV2Schema,
  operations: z.array(MagicEditOperationV1Schema).min(1).max(6),
  change_codes: z.array(z.enum(['camera_crop_changed', 'caption_emphasis_changed', 'overlay_anchor_changed', 'overlay_opacity_changed', 'overlay_timing_changed'])).min(1),
  gates: MagicEditGateResultsV1Schema,
  invalidates: z.array(StageNameV2Schema).min(1),
  hard_blocks: z.array(z.string().min(1)),
  soft_blocks: z.array(z.string().min(1)),
  preview: z.object({ before_hash: Sha256V1Schema.optional(), after_hash: Sha256V1Schema.optional() }).strict(),
  created_at: z.string().datetime(),
}).strict()
export type MagicEditCandidateV1 = z.infer<typeof MagicEditCandidateV1Schema>

export const MagicEditActivationV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  activation_id: z.string().uuid(),
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  candidate_hash: Sha256V1Schema,
  expected_parent_revision_hash: Sha256V1Schema,
  expected_parent_artifact_hash: Sha256V1Schema,
  prepared_treatment_artifact_hash: Sha256V1Schema,
  decision: z.literal('activate'),
  approved_by: z.literal('Krish'),
  confirmation_ref: z.string().min(20).max(800),
  occurred_at: z.string().datetime(),
}).strict().superRefine((value, context) => {
  const prefix = `control-center-confirmation:treatment:${value.prepared_treatment_artifact_hash}:`
  const suffix = value.confirmation_ref.startsWith(prefix) ? value.confirmation_ref.slice(prefix.length) : ''
  const expected = new RegExp(`^review:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:decision:${value.activation_id}$`, 'i')
  if (!expected.test(suffix)) context.addIssue({ code: 'custom', path: ['confirmation_ref'], message: 'activation confirmation must bind the treatment artifact, review, and decision IDs' })
})
export type MagicEditActivationV1 = z.infer<typeof MagicEditActivationV1Schema>

export const MagicEditReturnToParentV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  return_id: z.string().uuid(),
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  expected_parent_revision_hash: Sha256V1Schema,
  expected_parent_artifact_hash: Sha256V1Schema,
  target_parent_revision_hash: Sha256V1Schema,
  target_parent_artifact_hash: Sha256V1Schema,
  returned_by: z.literal('Krish'),
  occurred_at: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (value.target_parent_artifact_hash === value.expected_parent_artifact_hash) context.addIssue({ code: 'custom', path: ['target_parent_artifact_hash'], message: 'return target must differ from the current artifact' })
})
export type MagicEditReturnToParentV1 = z.infer<typeof MagicEditReturnToParentV1Schema>

export const ReviewDecisionRecordV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  decision_id: z.string().uuid(),
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  review_id: z.string().uuid(),
  gate: z.enum(['story', 'treatment', 'final', 'learning']),
  candidate_hash: Sha256V1Schema.nullable(),
  semantic_target_map_hash: Sha256V1Schema,
  expected_parent_revision_hash: Sha256V1Schema,
  expected_parent_artifact_hash: Sha256V1Schema,
  review_revision_hash: Sha256V1Schema,
  review_artifact_hash: Sha256V1Schema,
  decision: z.enum(['use_candidate', 'keep_current']),
  feedback: z.string().trim().min(1).max(1600).nullable(),
  override_reason: z.string().trim().min(1).max(800).nullable(),
  learning_confirmation: z.discriminatedUnion('action', [
    z.object({ action: z.literal('confirm') }).strict(),
    z.object({ action: z.literal('correct'), correction: z.string().trim().min(1).max(1600) }).strict(),
    z.object({ action: z.literal('observe_only') }).strict(),
  ]).nullable(),
  decided_by: z.literal('Krish'),
  occurred_at: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (value.gate === 'learning' && value.learning_confirmation === null) context.addIssue({ code: 'custom', path: ['learning_confirmation'], message: 'learning decisions require an explicit confirmation action' })
  if (value.gate !== 'learning' && value.learning_confirmation !== null) context.addIssue({ code: 'custom', path: ['learning_confirmation'], message: 'learning confirmation is only valid at the learning gate' })
  if (value.decision === 'use_candidate' && value.candidate_hash !== null) context.addIssue({ code: 'custom', path: ['candidate_hash'], message: 'candidate activation must use the dedicated activation command' })
  if (value.override_reason !== null && value.decision !== 'use_candidate') context.addIssue({ code: 'custom', path: ['override_reason'], message: 'an override reason is only valid when accepting the reviewed item' })
})
export type ReviewDecisionRecordV1 = z.infer<typeof ReviewDecisionRecordV1Schema>

export const ReviewRecoveryRecordV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  recovery_id: z.string().uuid(),
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  source_review_id: z.string().uuid(),
  recovery_review_id: z.string().uuid(),
  source_command_id: z.string().uuid(),
  source_command_hash: Sha256V1Schema,
  source_terminal_reason: z.enum(['runner_failed_receipt', 'attempts_exhausted', 'command_expired']),
  recovery_root_command_id: z.string().uuid(),
  recovery_generation: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  gate: z.enum(['story', 'treatment', 'final', 'learning']),
  expected_parent_revision_hash: Sha256V1Schema,
  expected_parent_artifact_hash: Sha256V1Schema,
  review_revision_hash: Sha256V1Schema,
  review_artifact_hash: Sha256V1Schema,
  candidate_hash: Sha256V1Schema.nullable(),
  semantic_target_map_hash: Sha256V1Schema,
  recovered_by: z.literal('Krish'),
  occurred_at: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (value.source_review_id === value.recovery_review_id) context.addIssue({ code: 'custom', path: ['recovery_review_id'], message: 'recovery must create a distinct review identity' })
  if (value.recovery_generation === 1 && value.source_command_id !== value.recovery_root_command_id) context.addIssue({ code: 'custom', path: ['recovery_root_command_id'], message: 'first recovery generation must name its source command as the root' })
})
export type ReviewRecoveryRecordV1 = z.infer<typeof ReviewRecoveryRecordV1Schema>

const RunnerCommandEnvelopeBaseV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  command_id: z.string().uuid(),
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  candidate_hash: Sha256V1Schema.nullable(),
  expected_parent_revision_hash: Sha256V1Schema,
  expected_parent_artifact_hash: Sha256V1Schema,
  semantic_target_map_hash: Sha256V1Schema.nullable(),
  idempotency_key: z.string().uuid(),
  payload_hash: Sha256V1Schema,
  command_hash: Sha256V1Schema,
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
})

export const RunnerCommandEnvelopeV1Schema = z.discriminatedUnion('command_kind', [
  RunnerCommandEnvelopeBaseV1Schema.extend({ command_kind: z.literal('magic_edit_prepare'), payload: MagicEditDirectionV1Schema }).strict(),
  RunnerCommandEnvelopeBaseV1Schema.extend({ command_kind: z.literal('magic_edit_activate'), payload: MagicEditActivationV1Schema }).strict(),
  RunnerCommandEnvelopeBaseV1Schema.extend({ command_kind: z.literal('magic_edit_return_to_parent'), payload: MagicEditReturnToParentV1Schema }).strict(),
  RunnerCommandEnvelopeBaseV1Schema.extend({ command_kind: z.literal('review_decision_record'), payload: ReviewDecisionRecordV1Schema }).strict(),
  RunnerCommandEnvelopeBaseV1Schema.extend({ command_kind: z.literal('review_recovery_record'), payload: ReviewRecoveryRecordV1Schema }).strict(),
]).superRefine((value, context) => {
  if (Date.parse(value.expires_at) <= Date.parse(value.issued_at)) context.addIssue({ code: 'custom', path: ['expires_at'], message: 'runner command must expire after it is issued' })
  if (value.command_kind === 'magic_edit_prepare') {
    if (value.candidate_hash !== null) context.addIssue({ code: 'custom', path: ['candidate_hash'], message: 'prepare commands cannot name a candidate before compilation' })
    if (value.semantic_target_map_hash !== value.payload.semantic_target_map_hash) context.addIssue({ code: 'custom', path: ['semantic_target_map_hash'], message: 'prepare command target map does not match its payload' })
    if (value.payload.job_id !== value.job_id) context.addIssue({ code: 'custom', path: ['payload', 'job_id'], message: 'runner command payload belongs to a different job' })
    if (value.payload.platform !== value.platform) context.addIssue({ code: 'custom', path: ['payload', 'platform'], message: 'runner command platform does not match its payload' })
    if (value.payload.expected_parent_revision_hash !== value.expected_parent_revision_hash) context.addIssue({ code: 'custom', path: ['payload', 'expected_parent_revision_hash'], message: 'runner command revision binding does not match its payload' })
    if (value.payload.expected_parent_artifact_hash !== value.expected_parent_artifact_hash) context.addIssue({ code: 'custom', path: ['payload', 'expected_parent_artifact_hash'], message: 'runner command artifact binding does not match its payload' })
  }
  if (value.command_kind === 'magic_edit_activate') {
    if (value.candidate_hash !== value.payload.candidate_hash) context.addIssue({ code: 'custom', path: ['candidate_hash'], message: 'activation command candidate does not match its payload' })
    if (value.semantic_target_map_hash === null) context.addIssue({ code: 'custom', path: ['semantic_target_map_hash'], message: 'activation command requires the prepared candidate target map' })
    if (value.payload.job_id !== value.job_id) context.addIssue({ code: 'custom', path: ['payload', 'job_id'], message: 'activation payload belongs to a different job' })
    if (value.payload.platform !== value.platform) context.addIssue({ code: 'custom', path: ['payload', 'platform'], message: 'activation platform does not match its payload' })
    if (value.payload.expected_parent_revision_hash !== value.expected_parent_revision_hash) context.addIssue({ code: 'custom', path: ['payload', 'expected_parent_revision_hash'], message: 'activation revision binding does not match its payload' })
    if (value.payload.expected_parent_artifact_hash !== value.expected_parent_artifact_hash) context.addIssue({ code: 'custom', path: ['payload', 'expected_parent_artifact_hash'], message: 'activation artifact binding does not match its payload' })
  }
  if (value.command_kind === 'magic_edit_return_to_parent') {
    if (value.semantic_target_map_hash !== null) context.addIssue({ code: 'custom', path: ['semantic_target_map_hash'], message: 'return commands cannot substitute a semantic target map' })
    if (value.payload.job_id !== value.job_id) context.addIssue({ code: 'custom', path: ['payload', 'job_id'], message: 'return payload belongs to a different job' })
    if (value.payload.platform !== value.platform) context.addIssue({ code: 'custom', path: ['payload', 'platform'], message: 'return platform does not match its payload' })
    if (value.payload.expected_parent_revision_hash !== value.expected_parent_revision_hash) context.addIssue({ code: 'custom', path: ['payload', 'expected_parent_revision_hash'], message: 'return revision binding does not match its payload' })
    if (value.payload.expected_parent_artifact_hash !== value.expected_parent_artifact_hash) context.addIssue({ code: 'custom', path: ['payload', 'expected_parent_artifact_hash'], message: 'return artifact binding does not match its payload' })
  }
  if (value.command_kind === 'review_decision_record') {
    if (value.idempotency_key !== value.payload.decision_id) context.addIssue({ code: 'custom', path: ['idempotency_key'], message: 'review decision idempotency must equal its decision ID' })
    if (value.candidate_hash !== value.payload.candidate_hash) context.addIssue({ code: 'custom', path: ['candidate_hash'], message: 'review decision candidate does not match its payload' })
    if (value.semantic_target_map_hash !== value.payload.semantic_target_map_hash) context.addIssue({ code: 'custom', path: ['semantic_target_map_hash'], message: 'review decision target map does not match its payload' })
    if (value.payload.job_id !== value.job_id) context.addIssue({ code: 'custom', path: ['payload', 'job_id'], message: 'review decision payload belongs to a different job' })
    if (value.payload.platform !== value.platform) context.addIssue({ code: 'custom', path: ['payload', 'platform'], message: 'review decision platform does not match its payload' })
    if (value.payload.expected_parent_revision_hash !== value.expected_parent_revision_hash) context.addIssue({ code: 'custom', path: ['payload', 'expected_parent_revision_hash'], message: 'review decision revision binding does not match its payload' })
    if (value.payload.expected_parent_artifact_hash !== value.expected_parent_artifact_hash) context.addIssue({ code: 'custom', path: ['payload', 'expected_parent_artifact_hash'], message: 'review decision artifact binding does not match its payload' })
  }
  if (value.command_kind === 'review_recovery_record') {
    if (value.idempotency_key !== value.payload.recovery_id) context.addIssue({ code: 'custom', path: ['idempotency_key'], message: 'review recovery idempotency must equal its recovery ID' })
    if (value.candidate_hash !== value.payload.candidate_hash) context.addIssue({ code: 'custom', path: ['candidate_hash'], message: 'review recovery candidate does not match its payload' })
    if (value.semantic_target_map_hash !== value.payload.semantic_target_map_hash) context.addIssue({ code: 'custom', path: ['semantic_target_map_hash'], message: 'review recovery target map does not match its payload' })
    if (value.payload.job_id !== value.job_id || value.payload.platform !== value.platform) context.addIssue({ code: 'custom', path: ['payload', 'job_id'], message: 'review recovery payload belongs to a different job or platform' })
    if (value.payload.expected_parent_revision_hash !== value.expected_parent_revision_hash || value.payload.expected_parent_artifact_hash !== value.expected_parent_artifact_hash) context.addIssue({ code: 'custom', path: ['payload', 'expected_parent_revision_hash'], message: 'review recovery parent binding does not match its envelope' })
  }
})
export type RunnerCommandEnvelopeV1 = z.infer<typeof RunnerCommandEnvelopeV1Schema>

export function runnerCommandHashInputV1(value: RunnerCommandEnvelopeV1) {
  return {
    schema_version: value.schema_version,
    command_kind: value.command_kind,
    job_id: value.job_id,
    platform: value.platform,
    candidate_hash: value.candidate_hash,
    expected_parent_revision_hash: value.expected_parent_revision_hash,
    expected_parent_artifact_hash: value.expected_parent_artifact_hash,
    semantic_target_map_hash: value.semantic_target_map_hash,
    idempotency_key: value.idempotency_key,
    payload_hash: value.payload_hash,
  }
}

export const RunnerHardGateResultV1Schema = z.object({
  status: z.enum(['passed', 'blocked', 'pending']),
  detail: z.string().trim().min(1).max(240).optional(),
}).strict()

export const RunnerHardGatesV1Schema = z.object({
  truth: RunnerHardGateResultV1Schema,
  rights: RunnerHardGateResultV1Schema,
  confidentiality: RunnerHardGateResultV1Schema,
  transcript_fidelity: RunnerHardGateResultV1Schema,
  naming: RunnerHardGateResultV1Schema,
}).strict()
export type RunnerHardGatesV1 = z.infer<typeof RunnerHardGatesV1Schema>

const RunnerReviewRefV1Schema = z.object({ ref: IdentifierV1Schema })

export const RunnerReviewTargetV1Schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('moment'), start_ms: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal('range'), start_ms: z.number().int().nonnegative(), end_ms: z.number().int().positive() }).strict().refine((value) => value.end_ms > value.start_ms, { message: 'review range must end after it starts' }),
  RunnerReviewRefV1Schema.extend({ kind: z.literal('caption_block') }).strict(),
  RunnerReviewRefV1Schema.extend({ kind: z.literal('overlay') }).strict(),
  RunnerReviewRefV1Schema.extend({ kind: z.literal('speaker') }).strict(),
  RunnerReviewRefV1Schema.extend({ kind: z.literal('beat') }).strict(),
])
export type RunnerReviewTargetV1 = z.infer<typeof RunnerReviewTargetV1Schema>

export const RunnerReviewPayloadV1Schema = z.object({
  direction: z.string().trim().min(1).max(600),
  change_title: z.string().trim().min(1).max(200),
  change_summary: z.string().trim().min(1).max(600),
  range_label: z.string().trim().min(1).max(120),
  changes: z.array(z.string().trim().min(1).max(240)).max(4),
  blocking_gates: RunnerHardGatesV1Schema,
  target: RunnerReviewTargetV1Schema,
  semantic_target_map_hash: Sha256V1Schema,
  editorial_note: z.string().trim().min(1).max(600).optional(),
}).strict()

const RunnerResultRefsSharedShapeV1 = {
  review_id: z.string().uuid().optional(),
  candidate_hash: Sha256V1Schema.optional(),
  semantic_target_map_hash: Sha256V1Schema.optional(),
  safe_title: z.string().trim().min(1).max(200).optional(),
  safe_summary: z.string().trim().min(1).max(600).optional(),
  review_payload: RunnerReviewPayloadV1Schema.optional(),
  before_preview_object_key: z.string().regex(/^commands\/[0-9a-f-]{36}\/previews\/before\/[a-f0-9]{64}\.mp4$/).optional(),
  before_preview_hash: Sha256V1Schema.optional(),
  before_preview_md5: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  before_preview_byte_size: z.number().int().positive().max(25 * 1024 * 1024).optional(),
  after_preview_object_key: z.string().regex(/^commands\/[0-9a-f-]{36}\/previews\/after\/[a-f0-9]{64}\.mp4$/).optional(),
  after_preview_hash: Sha256V1Schema.optional(),
  after_preview_md5: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  after_preview_byte_size: z.number().int().positive().max(25 * 1024 * 1024).optional(),
  comparison_alignment: z.enum(['exact', 'unavailable']),
  comparison_start_ms: z.number().int().nonnegative().max(86_400_000).optional(),
  comparison_end_ms: z.number().int().positive().max(86_400_000).optional(),
}

const RunnerResultRefsV1ShapeSchema = z.object({
  result_source_event_count: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  result_source_event_chain_hash: Sha256V1Schema.optional(),
  result_source_revision_hash: Sha256V1Schema.optional(),
  ...RunnerResultRefsSharedShapeV1,
}).strict()

function refineRunnerResultRefsV1(value: z.infer<typeof RunnerResultRefsV1ShapeSchema>, context: z.RefinementCtx): void {
  if ((value.comparison_start_ms === undefined) !== (value.comparison_end_ms === undefined)) context.addIssue({ code: 'custom', path: ['comparison_start_ms'], message: 'comparison range requires both bounds' })
  if (value.comparison_start_ms !== undefined && value.comparison_end_ms !== undefined && value.comparison_end_ms <= value.comparison_start_ms) context.addIssue({ code: 'custom', path: ['comparison_end_ms'], message: 'comparison range must end after it starts' })
  if (value.comparison_alignment === 'exact' && (value.comparison_start_ms === undefined || value.comparison_end_ms === undefined)) context.addIssue({ code: 'custom', path: ['comparison_alignment'], message: 'exact comparison alignment requires both timing bounds' })
  if (value.comparison_alignment === 'unavailable' && (value.comparison_start_ms !== undefined || value.comparison_end_ms !== undefined)) context.addIssue({ code: 'custom', path: ['comparison_alignment'], message: 'unavailable comparison alignment cannot contain timing bounds' })
  const beforeGroup = [value.before_preview_object_key, value.before_preview_hash, value.before_preview_md5, value.before_preview_byte_size]
  const afterGroup = [value.after_preview_object_key, value.after_preview_hash, value.after_preview_md5, value.after_preview_byte_size]
  if (beforeGroup.some((item) => item !== undefined) && beforeGroup.some((item) => item === undefined)) context.addIssue({ code: 'custom', path: ['before_preview_object_key'], message: 'before preview reference requires object key, hashes, and byte size' })
  if (afterGroup.some((item) => item !== undefined) && afterGroup.some((item) => item === undefined)) context.addIssue({ code: 'custom', path: ['after_preview_object_key'], message: 'after preview reference requires object key, hashes, and byte size' })
  if (Boolean(value.review_id) !== Boolean(value.review_payload)) context.addIssue({ code: 'custom', path: ['review_id'], message: 'review ID and review payload must be supplied together' })
  if (value.candidate_hash && (!value.review_id || !value.review_payload || beforeGroup.some((item) => item === undefined) || afterGroup.some((item) => item === undefined) || value.comparison_alignment !== 'exact')) context.addIssue({ code: 'custom', path: ['candidate_hash'], message: 'candidate review references require an exact review ID, before and after previews, and review payload' })
}

export const RunnerResultRefsV1Schema = RunnerResultRefsV1ShapeSchema.superRefine(refineRunnerResultRefsV1)
export type RunnerResultRefsV1 = z.infer<typeof RunnerResultRefsV1Schema>

export const LegacyStoredRunnerResultRefsV1Schema = z.object(RunnerResultRefsSharedShapeV1).strict().superRefine(refineRunnerResultRefsV1)

export const RunnerPreviewUploadRequestV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  runner_id: IdentifierV1Schema,
  command_id: z.string().uuid(),
  command_hash: Sha256V1Schema,
  lease_token: z.string().min(24),
  side: z.enum(['before', 'after']),
  sha256: Sha256V1Schema,
  md5: z.string().regex(/^[a-f0-9]{32}$/),
  content_type: z.literal('video/mp4'),
  byte_size: z.number().int().positive().max(25 * 1024 * 1024),
}).strict()
export type RunnerPreviewUploadRequestV1 = z.infer<typeof RunnerPreviewUploadRequestV1Schema>

export const RunnerPreviewUploadResponseV1Schema = z.object({
  ok: z.literal(true),
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  duplicate: z.boolean(),
  existing_verified: z.boolean(),
  slot: z.object({
    command_id: z.string().uuid(),
    side: z.enum(['before', 'after']),
    sha256: Sha256V1Schema,
    md5: z.string().regex(/^[a-f0-9]{32}$/),
    byte_size: z.number().int().positive().max(25 * 1024 * 1024),
    content_type: z.literal('video/mp4'),
    object_key: z.string().regex(/^commands\/[0-9a-f-]{36}\/previews\/(?:before|after)\/[a-f0-9]{64}\.mp4$/),
    slot_expires_at: z.string().datetime(),
    upload: z.object({
      method: z.literal('PUT'),
      url: z.string().url().nullable(),
      headers: z.object({ 'Content-Type': z.literal('video/mp4') }).strict(),
      expires_at: z.string().datetime().nullable(),
    }).strict(),
  }).strict(),
}).strict().superRefine((value, context) => {
  const uploadExpiry = value.slot.upload.expires_at
  if (uploadExpiry && Date.parse(uploadExpiry) > Date.parse(value.slot.slot_expires_at)) context.addIssue({ code: 'custom', path: ['slot', 'upload', 'expires_at'], message: 'signed upload URL cannot outlive its command-bound slot' })
})
export type RunnerPreviewUploadResponseV1 = z.infer<typeof RunnerPreviewUploadResponseV1Schema>

export const RunnerPreviewRetentionRequestV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  runner_id: IdentifierV1Schema,
  limit: z.number().int().min(1).max(100),
}).strict()
export type RunnerPreviewRetentionRequestV1 = z.infer<typeof RunnerPreviewRetentionRequestV1Schema>

export const RunnerPreviewRetentionResponseV1Schema = z.object({
  ok: z.literal(true),
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  reviewed: z.number().int().nonnegative(),
  deleted_objects: z.number().int().nonnegative(),
  cutoff: z.string().datetime(),
}).strict()
export type RunnerPreviewRetentionResponseV1 = z.infer<typeof RunnerPreviewRetentionResponseV1Schema>

const RunnerReceiptShapeV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  command_id: z.string().uuid(),
  command_hash: Sha256V1Schema,
  job_id: IdentifierV1Schema,
  status: z.enum(['succeeded', 'requires_editorial_route', 'failed']),
  result_revision_hash: Sha256V1Schema.nullable(),
  result_artifact_hash: Sha256V1Schema.nullable(),
  result_refs: RunnerResultRefsV1Schema.optional(),
  hard_gates: RunnerHardGatesV1Schema,
  retryable: z.literal(false),
  safe_code: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/).nullable(),
  started_at: z.string().datetime(),
  finished_at: z.string().datetime(),
  receipt_hash: Sha256V1Schema,
  receipt_signature: Sha256V1Schema,
}).strict()

function refineStoredRunnerReceiptV1(
  value: z.infer<typeof RunnerReceiptShapeV1Schema>,
  context: z.RefinementCtx,
  requireSourceCursor: boolean,
): void {
  if (Date.parse(value.finished_at) < Date.parse(value.started_at)) context.addIssue({ code: 'custom', path: ['finished_at'], message: 'runner receipt cannot finish before it starts' })
  if (value.status !== 'failed' && (!value.result_revision_hash || !value.result_artifact_hash)) context.addIssue({ code: 'custom', path: ['result_revision_hash'], message: 'non-failed runner receipts require both result hashes' })
  if (requireSourceCursor && value.status !== 'failed' && (!value.result_refs?.result_source_event_count || !value.result_refs.result_source_event_chain_hash || !value.result_refs.result_source_revision_hash)) context.addIssue({ code: 'custom', path: ['result_refs', 'result_source_event_count'], message: 'non-failed runner receipts require the exact post-dispatch source event count, chain hash, and revision hash' })
  if (value.status === 'failed' && (value.result_refs?.result_source_event_count !== undefined || value.result_refs?.result_source_event_chain_hash !== undefined || value.result_refs?.result_source_revision_hash !== undefined)) context.addIssue({ code: 'custom', path: ['result_refs', 'result_source_event_count'], message: 'failed runner receipts cannot claim post-dispatch source event state' })
  if (value.status === 'failed' && (value.result_revision_hash || value.result_artifact_hash)) context.addIssue({ code: 'custom', path: ['result_revision_hash'], message: 'failed runner receipts cannot claim result hashes' })
  if (value.status === 'succeeded' && value.safe_code !== null) context.addIssue({ code: 'custom', path: ['safe_code'], message: 'successful runner receipt cannot contain an error code' })
  if (value.status === 'requires_editorial_route' && value.safe_code !== 'requires_editorial_route') context.addIssue({ code: 'custom', path: ['safe_code'], message: 'editorial routing must use its safe code' })
  if (value.result_refs?.before_preview_object_key && value.result_refs.before_preview_object_key !== `commands/${value.command_id}/previews/before/${value.result_refs.before_preview_hash}.mp4`) context.addIssue({ code: 'custom', path: ['result_refs', 'before_preview_object_key'], message: 'before preview key must bind the receipt command and content hash' })
  if (value.result_refs?.after_preview_object_key && value.result_refs.after_preview_object_key !== `commands/${value.command_id}/previews/after/${value.result_refs.after_preview_hash}.mp4`) context.addIssue({ code: 'custom', path: ['result_refs', 'after_preview_object_key'], message: 'after preview key must bind the receipt command and content hash' })
}

export const RunnerReceiptV1Schema = RunnerReceiptShapeV1Schema.superRefine((value, context) => refineStoredRunnerReceiptV1(value, context, true))
export type RunnerReceiptV1 = z.infer<typeof RunnerReceiptV1Schema>

// Storage-only compatibility for immutable receipts produced before the source
// event cursor became mandatory. Never use this schema for network input.
export const LegacyStoredRunnerReceiptV1Schema = RunnerReceiptShapeV1Schema.extend({
  result_refs: LegacyStoredRunnerResultRefsV1Schema.optional(),
}).strict().superRefine((value, context) => refineStoredRunnerReceiptV1(value, context, false))
export type LegacyStoredRunnerReceiptV1 = z.infer<typeof LegacyStoredRunnerReceiptV1Schema>

export const RunnerHeartbeatV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  runner_id: IdentifierV1Schema,
  software_commit: z.string().regex(/^(?:[a-f0-9]{40}|unknown)$/),
  command_schema_versions: z.array(z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1)).length(1),
  status: z.enum(['idle', 'working', 'degraded']),
  drive_state: z.enum(['ready', 'unavailable', 'not_configured']),
  active_command_id: z.string().uuid().optional(),
  pending_receipts: z.number().int().nonnegative().max(10_000),
  occurred_at: z.string().datetime(),
}).strict()
export type RunnerHeartbeatV1 = z.infer<typeof RunnerHeartbeatV1Schema>

export const MagicEditCandidateProjectionV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  candidate_hash: Sha256V1Schema,
  expected_parent_revision_hash: Sha256V1Schema,
  expected_parent_artifact_hash: Sha256V1Schema,
  semantic_target_map_hash: Sha256V1Schema,
  change_codes: z.array(z.enum(['camera_crop_changed', 'caption_emphasis_changed', 'overlay_anchor_changed', 'overlay_opacity_changed', 'overlay_timing_changed'])).min(1),
  gates: MagicEditGateResultsV1Schema,
  before_preview_object_ref: IdentifierV1Schema.optional(),
  before_preview_hash: Sha256V1Schema.optional(),
  after_preview_object_ref: IdentifierV1Schema.optional(),
  after_preview_hash: Sha256V1Schema.optional(),
  state: z.enum(['preparing', 'ready', 'activated', 'discarded', 'stale', 'blocked']),
  created_at: z.string().datetime(),
}).strict()
export type MagicEditCandidateProjectionV1 = z.infer<typeof MagicEditCandidateProjectionV1Schema>

export const VideoJobProjectionV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  job_id: IdentifierV1Schema,
  series: z.enum(['money_of_ai', 'built_with_ai']),
  mode: z.enum(['extract', 'solo', 'short_native']),
  revision_hash: Sha256V1Schema,
  current_stage: StageNameV2Schema.optional(),
  current_gate: z.enum(['angle', 'evidence', 'visual_plan', 'storyboard', 'animatic', 'treatment', 'final', 'package']).optional(),
  runner_state: z.enum(['online', 'offline', 'degraded']),
  updated_at: z.string().datetime(),
}).strict()
export type VideoJobProjectionV1 = z.infer<typeof VideoJobProjectionV1Schema>

export const RunnerProjectJobV1Schema = z.object({
  job_id: IdentifierV1Schema,
  source_event_count: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  source_event_chain_hash: Sha256V1Schema,
  source_revision_hash: Sha256V1Schema,
  series: SeriesV2Schema,
  mode: SourceModeV2Schema,
  target_platforms: z.array(VideoPlatformV1Schema).min(1).max(4).refine((platforms) => new Set(platforms).size === platforms.length, { message: 'project target platforms must be unique' }),
  stage: z.union([StageNameV2Schema, z.literal('complete')]),
  status: z.enum(['active', 'completed', 'blocked', 'archived']),
  safe_title: z.string().trim().min(1).max(200),
  safe_summary: z.string().trim().min(1).max(600),
}).strict()
export type RunnerProjectJobV1 = z.infer<typeof RunnerProjectJobV1Schema>

const RunnerProjectExpectedPlatformStateShapeV1 = {
  active_revision_hash: Sha256V1Schema,
  active_artifact_hash: Sha256V1Schema,
  active_candidate_hash: Sha256V1Schema.nullable(),
  parent_revision_hash: Sha256V1Schema.nullable(),
  parent_artifact_hash: Sha256V1Schema.nullable(),
  parent_candidate_hash: Sha256V1Schema.nullable(),
  semantic_target_map_hash: Sha256V1Schema,
}

function refineRunnerProjectParentPair(value: { active_candidate_hash: string | null; parent_revision_hash: string | null; parent_artifact_hash: string | null; parent_candidate_hash: string | null }, context: z.RefinementCtx): void {
  if ((value.parent_revision_hash === null) !== (value.parent_artifact_hash === null)) context.addIssue({ code: 'custom', path: ['parent_revision_hash'], message: 'project parent revision and artifact hashes must be a complete pair' })
  if (value.parent_revision_hash === null && value.parent_candidate_hash !== null) context.addIssue({ code: 'custom', path: ['parent_candidate_hash'], message: 'project parent candidate cannot exist without parent revision and artifact hashes' })
  if (value.active_candidate_hash === null && (value.parent_revision_hash !== null || value.parent_artifact_hash !== null || value.parent_candidate_hash !== null)) context.addIssue({ code: 'custom', path: ['active_candidate_hash'], message: 'a base platform state cannot retain magic-edit parent lineage' })
  if (value.active_candidate_hash !== null && (value.parent_revision_hash === null || value.parent_artifact_hash === null)) context.addIssue({ code: 'custom', path: ['active_candidate_hash'], message: 'an active magic-edit candidate requires its complete immediate parent lineage' })
}

export const RunnerProjectPlatformStateV1Schema = z.object({
  platform: VideoPlatformV1Schema,
  ...RunnerProjectExpectedPlatformStateShapeV1,
  editorial_state: z.enum(['ingesting', 'needs_story_review', 'needs_visual_review', 'needs_final_review', 'needs_learning_confirmation', 'approved', 'blocked']),
  route_state: z.enum(['standard', 'requires_editorial_route']),
}).strict().superRefine(refineRunnerProjectParentPair)
export type RunnerProjectPlatformStateV1 = z.infer<typeof RunnerProjectPlatformStateV1Schema>

export const RunnerProjectExpectedPlatformStateV1Schema = RunnerProjectPlatformStateV1Schema
export type RunnerProjectExpectedPlatformStateV1 = z.infer<typeof RunnerProjectExpectedPlatformStateV1Schema>

export const RunnerProjectReviewV1Schema = z.object({
  id: z.string().uuid(),
  gate: z.enum(['story', 'treatment', 'final', 'learning']),
  safe_title: z.string().trim().min(1).max(200),
  safe_summary: z.string().trim().min(1).max(600),
  parent_revision_hash: Sha256V1Schema,
  parent_artifact_hash: Sha256V1Schema,
  revision_hash: Sha256V1Schema,
  artifact_hash: Sha256V1Schema,
  candidate_hash: z.null(),
  route_state: z.enum(['standard', 'requires_editorial_route']),
  safe_payload: RunnerReviewPayloadV1Schema,
  hard_gates: RunnerHardGatesV1Schema,
  created_at: z.string().datetime(),
}).strict()
export type RunnerProjectReviewV1 = z.infer<typeof RunnerProjectReviewV1Schema>

const RunnerLocalReviewProvenanceV1Schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('treatment'), treatment_artifact_hash: Sha256V1Schema }).strict(),
  z.object({
    kind: z.literal('final'),
    render_stage_artifact_hash: Sha256V1Schema,
    render_manifest_hash: Sha256V1Schema,
    qa_stage_artifact_hash: Sha256V1Schema,
    qa_render_input_hash: Sha256V1Schema,
    platform_master_hash: Sha256V1Schema,
  }).strict(),
  z.object({ kind: z.literal('story'), candidates_stage_artifact_hash: Sha256V1Schema }).strict(),
  z.object({
    kind: z.literal('learning'),
    learning_artifact_hash: Sha256V1Schema,
    learning_artifact_schema: z.enum(['feedback_v1', 'feedback_v2', 'preference_rule_v1']),
  }).strict(),
  z.object({
    kind: z.literal('magic_candidate'),
    candidate_hash: Sha256V1Schema,
    prepared_treatment_artifact_hash: Sha256V1Schema,
  }).strict(),
])

export const RunnerLocalReviewBindingV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  review_id: z.string().uuid(),
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
  gate: z.enum(['story', 'treatment', 'final', 'learning']),
  parent_revision_hash: Sha256V1Schema,
  parent_artifact_hash: Sha256V1Schema,
  review_revision_hash: Sha256V1Schema,
  review_artifact_hash: Sha256V1Schema,
  candidate_hash: Sha256V1Schema.nullable(),
  semantic_target_map_hash: Sha256V1Schema,
  review_target: RunnerReviewTargetV1Schema,
  hard_gates: RunnerHardGatesV1Schema,
  provenance: RunnerLocalReviewProvenanceV1Schema,
  recovery_provenance: z.object({
    recovery_id: z.string().uuid(),
    source_review_id: z.string().uuid(),
    source_command_id: z.string().uuid(),
    source_command_hash: Sha256V1Schema,
    source_terminal_reason: z.enum(['runner_failed_receipt', 'attempts_exhausted', 'command_expired']),
    source_evidence: z.enum(['signed_failed_receipt', 'signed_claim_journal', 'cloud_terminal_without_receipt']),
    recovery_root_command_id: z.string().uuid(),
    recovery_generation: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    bridge_command_id: z.string().uuid(),
    bridge_command_hash: Sha256V1Schema,
  }).strict().optional(),
  created_at: z.string().datetime(),
  binding_hash: Sha256V1Schema,
  binding_signature: Sha256V1Schema,
}).strict().superRefine((value, context) => {
  if (value.provenance.kind === 'magic_candidate') {
    if (value.gate !== 'treatment' || value.candidate_hash !== value.provenance.candidate_hash
      || value.review_revision_hash !== value.provenance.candidate_hash
      || value.review_artifact_hash !== value.provenance.prepared_treatment_artifact_hash) {
      context.addIssue({ code: 'custom', path: ['provenance'], message: 'magic candidate review binding must identify its exact treatment candidate' })
    }
  } else if (value.candidate_hash !== null) {
    context.addIssue({ code: 'custom', path: ['candidate_hash'], message: 'only magic candidate review bindings may carry a candidate hash' })
  }
  if (value.provenance.kind !== 'magic_candidate' && value.provenance.kind !== value.gate) context.addIssue({ code: 'custom', path: ['provenance'], message: 'review provenance kind must match its gate' })
})
export type RunnerLocalReviewBindingV1 = z.infer<typeof RunnerLocalReviewBindingV1Schema>

export const RunnerProjectProjectionV1Schema = z.object({
  job: RunnerProjectJobV1Schema,
  expected_platform_state: RunnerProjectExpectedPlatformStateV1Schema.nullable().optional(),
  platform_state: RunnerProjectPlatformStateV1Schema,
  review: RunnerProjectReviewV1Schema,
}).strict().superRefine((value, context) => {
  if (!value.job.target_platforms.includes(value.platform_state.platform)) context.addIssue({ code: 'custom', path: ['platform_state', 'platform'], message: 'project platform must be one of the job target platforms' })
  if (value.job.source_revision_hash !== value.platform_state.active_revision_hash) context.addIssue({ code: 'custom', path: ['job', 'source_revision_hash'], message: 'project source revision must match the active platform revision' })
  if (value.expected_platform_state && value.expected_platform_state.platform !== value.platform_state.platform) context.addIssue({ code: 'custom', path: ['expected_platform_state', 'platform'], message: 'expected project platform must match the desired platform state' })
  if (value.review.parent_revision_hash !== value.platform_state.active_revision_hash) context.addIssue({ code: 'custom', path: ['review', 'parent_revision_hash'], message: 'project review parent revision must match the active platform revision' })
  if (value.review.parent_artifact_hash !== value.platform_state.active_artifact_hash) context.addIssue({ code: 'custom', path: ['review', 'parent_artifact_hash'], message: 'project review parent artifact must match the active platform artifact' })
  if (value.review.route_state !== value.platform_state.route_state) context.addIssue({ code: 'custom', path: ['review', 'route_state'], message: 'project review route state must match the platform state' })
  if (value.review.safe_payload.semantic_target_map_hash !== value.platform_state.semantic_target_map_hash) context.addIssue({ code: 'custom', path: ['review', 'safe_payload', 'semantic_target_map_hash'], message: 'project review target map must match the platform state' })
  if (JSON.stringify(value.review.safe_payload.blocking_gates) !== JSON.stringify(value.review.hard_gates)) context.addIssue({ code: 'custom', path: ['review', 'safe_payload', 'blocking_gates'], message: 'project review payload gates must match its hard gates' })
})
export type RunnerProjectProjectionV1 = z.infer<typeof RunnerProjectProjectionV1Schema>

export function runnerProjectProjectionHashInputV1(value: RunnerProjectProjectionV1): RunnerProjectProjectionV1 {
  return value
}

export const RunnerProjectRequestV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  runner_id: IdentifierV1Schema,
  software_commit: z.string().regex(/^(?:[a-f0-9]{40}|unknown)$/),
  idempotency_key: z.string().uuid(),
  projection_hash: Sha256V1Schema,
  projection: RunnerProjectProjectionV1Schema,
}).strict()
export type RunnerProjectRequestV1 = z.infer<typeof RunnerProjectRequestV1Schema>

export const RunnerProjectResponseV1Schema = z.object({
  ok: z.literal(true),
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  duplicate: z.boolean(),
  projection_hash: Sha256V1Schema,
  job_id: IdentifierV1Schema,
  platform: VideoPlatformV1Schema,
}).strict()
export type RunnerProjectResponseV1 = z.infer<typeof RunnerProjectResponseV1Schema>

export const RunnerClaimRequestV1Schema = z.object({
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  runner_id: IdentifierV1Schema,
  software_commit: z.string().regex(/^(?:[a-f0-9]{40}|unknown)$/),
  command_schema_versions: z.array(z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1)).length(1),
  lease_seconds: z.number().int().min(30).max(300).optional(),
}).strict()

export const RunnerClaimResponseV1Schema = z.object({
  ok: z.literal(true),
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  command: RunnerCommandEnvelopeV1Schema.nullable(),
  lease: z.object({ token: z.string().min(24), expires_at: z.string().datetime() }).strict().optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.command) !== Boolean(value.lease)) context.addIssue({ code: 'custom', path: ['lease'], message: 'claimed commands require a lease and empty claims cannot include one' })
})

export const RunnerHeartbeatResponseV1Schema = z.object({
  ok: z.literal(true),
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  accepted: z.literal(true),
  lease_expires_at: z.string().datetime().optional(),
  server_time: z.string().datetime(),
}).strict()

export const RunnerCompleteResponseV1Schema = z.object({
  ok: z.literal(true),
  schema_version: z.literal(CONTROL_PLANE_SCHEMA_VERSION_V1),
  duplicate: z.boolean(),
  command_id: z.string().uuid(),
  receipt_hash: Sha256V1Schema,
  command_status: z.enum(['succeeded', 'failed', 'attention']),
}).strict()
