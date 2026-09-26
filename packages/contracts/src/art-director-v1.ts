import { z } from 'zod'
import { StudioSeriesSchema } from './series.js'

const Identifier = z.string().regex(/^[a-z0-9][a-z0-9_-]{1,95}$/i)
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/)

export const VisualNarrativeJobV1Schema = z.enum(['prove', 'explain', 'orient', 'compare', 'evoke', 'delight'])
export type VisualNarrativeJobV1 = z.infer<typeof VisualNarrativeJobV1Schema>
export const DeviceImplementationStateV1Schema = z.enum(['specified', 'implemented', 'verified', 'proven'])
export const DeviceCostClassV1Schema = z.enum(['local', 'hybrid', 'cloud_optional'])

export const DeviceEligibilityV1Schema = z.object({
  // The default stays the two retired ids so a pinned registry parses exactly
  // as it did; seriesEligible reads a list naming both as every subchannel.
  series: z.array(StudioSeriesSchema).default(['money_of_ai', 'built_with_ai']),
  source_modes: z.array(z.enum(['extract', 'solo', 'short_native'])).default(['extract', 'solo', 'short_native']),
  editorial_formats: z.array(Identifier).default([]),
  narrative_functions: z.array(Identifier).default([]),
  viewer_tasks: z.array(Identifier).default([]),
  requires: z.array(Identifier).default([]),
  contraindications: z.array(z.string().trim().min(4).max(240)).default([]),
}).strict()

export const VisualDeviceDefinitionV1Schema = z.object({
  technique_id: Identifier,
  version: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(12).max(600),
  narrative_jobs: z.array(VisualNarrativeJobV1Schema).min(1).default(['explain']),
  required_inputs: z.array(Identifier),
  parameters: z.array(Identifier),
  accessibility: z.array(Identifier),
  cost_class: DeviceCostClassV1Schema,
  fallback: z.string().trim().min(8).max(400),
  experimental: z.boolean(),
  signature: z.boolean(),
  eligibility: DeviceEligibilityV1Schema.default({
    series: ['money_of_ai', 'built_with_ai'],
    source_modes: ['extract', 'solo', 'short_native'],
    editorial_formats: [],
    narrative_functions: [],
    viewer_tasks: [],
    requires: [],
    contraindications: [],
  }),
  implementation_state: DeviceImplementationStateV1Schema.default('specified'),
  render_adapter: Identifier.optional(),
  qa_checks: z.array(Identifier).default([]),
}).strict()
export type VisualDeviceDefinitionV1 = z.infer<typeof VisualDeviceDefinitionV1Schema>

export const VisualRecipeV1Schema = z.object({
  recipe_id: Identifier,
  version: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(12).max(600),
  device_sequence: z.array(Identifier).min(2).max(12),
  eligible_series: z.array(StudioSeriesSchema).min(1),
  eligible_formats: z.array(Identifier).default([]),
  recurrence_cap_jobs: z.number().int().min(1).max(20).default(4),
  required_inputs: z.array(Identifier).default([]),
  fallback: z.string().trim().min(8).max(400),
  experimental: z.boolean().default(false),
}).strict()
export type VisualRecipeV1 = z.infer<typeof VisualRecipeV1Schema>

export const ReferenceObservationV1Schema = z.object({
  reference_id: Identifier,
  title: z.string().trim().min(2).max(160),
  source_ref: z.string().trim().min(1).max(500),
  source_hash: Sha256,
  rights_role: z.literal('analysis_only'),
  observed_devices: z.array(Identifier).min(1),
  observations: z.array(z.string().trim().min(8).max(400)).min(1).max(20),
  prohibited_uses: z.array(z.string().trim().min(8).max(240)).min(1),
  recorded_at: z.string().datetime(),
}).strict()
export type ReferenceObservationV1 = z.infer<typeof ReferenceObservationV1Schema>

export const DeviceScoreV1Schema = z.object({
  narrative_fit: z.number().int().min(0).max(30),
  proof_value: z.number().int().min(0).max(25),
  available_coverage: z.number().int().min(0).max(20),
  series_format_fit: z.number().int().min(0).max(10),
  novelty: z.number().int().min(0).max(10),
  cost_risk: z.number().int().min(0).max(5),
  total: z.number().int().min(0).max(100),
}).strict().superRefine((value, context) => {
  const calculated = value.narrative_fit + value.proof_value + value.available_coverage + value.series_format_fit + value.novelty + value.cost_risk
  if (value.total !== calculated) context.addIssue({ code: 'custom', path: ['total'], message: 'device score total must equal its dimensions' })
})

export const DeviceSelectionCandidateV1Schema = z.object({
  technique_id: Identifier,
  eligible: z.boolean(),
  hard_rejections: z.array(z.string().trim().min(4).max(240)),
  score: DeviceScoreV1Schema.nullable(),
  rationale: z.string().trim().min(8).max(500),
}).strict()
export type DeviceSelectionCandidateV1 = z.infer<typeof DeviceSelectionCandidateV1Schema>

export const DeviceInventionProposalV1Schema = z.object({
  proposal_id: Identifier,
  beat_id: Identifier,
  name: z.string().trim().min(2).max(120),
  narrative_job: VisualNarrativeJobV1Schema,
  gap: z.string().trim().min(12).max(500),
  mechanism: z.string().trim().min(12).max(600),
  fallback_technique_id: Identifier,
  treatment_lane: z.literal('experimental'),
  requires_styleframes: z.literal(true),
  requires_animatic: z.literal(true),
  approval_state: z.enum(['proposed', 'approved', 'rejected']).default('proposed'),
  approved_by: z.literal('Krish').optional(),
  approval_ref: z.string().trim().min(12).optional(),
}).strict().superRefine((value, context) => {
  if (value.approval_state === 'approved' && (!value.approved_by || !value.approval_ref)) {
    context.addIssue({ code: 'custom', path: ['approval_ref'], message: 'invented devices require exact Krish approval' })
  }
})
export type DeviceInventionProposalV1 = z.infer<typeof DeviceInventionProposalV1Schema>

export const DeviceSelectionTraceV1Schema = z.object({
  schema_version: z.literal(1),
  trace_id: Identifier,
  beat_id: Identifier,
  registry_id: Identifier,
  registry_version: z.number().int().positive(),
  registry_hash: Sha256.optional(),
  policy_version: z.literal('art-director-v1'),
  threshold: z.number().int().min(0).max(100),
  candidates: z.array(DeviceSelectionCandidateV1Schema).min(1),
  selected_primary: Identifier.nullable(),
  selected_support: z.array(Identifier).max(2),
  fallback_technique_id: Identifier.nullable(),
  invention: DeviceInventionProposalV1Schema.nullable(),
  rationale: z.string().trim().min(12).max(600),
}).strict().superRefine((value, context) => {
  if (!value.selected_primary && !value.invention) context.addIssue({ code: 'custom', path: ['selected_primary'], message: 'selection requires a primary device or governed invention proposal' })
  if (value.selected_primary && value.invention) context.addIssue({ code: 'custom', path: ['invention'], message: 'invention is only available when no existing device is selected' })
  if (new Set(value.candidates.map((candidate) => candidate.technique_id)).size !== value.candidates.length) context.addIssue({ code: 'custom', path: ['candidates'], message: 'selection candidates must be unique' })
  if (new Set(value.selected_support).size !== value.selected_support.length) context.addIssue({ code: 'custom', path: ['selected_support'], message: 'support devices must be unique' })
  if (value.selected_primary && value.selected_support.includes(value.selected_primary)) context.addIssue({ code: 'custom', path: ['selected_support'], message: 'primary device cannot also be a support device' })
  const candidates = new Map(value.candidates.map((candidate) => [candidate.technique_id, candidate]))
  for (const [path, techniqueId] of [['selected_primary', value.selected_primary], ...value.selected_support.map((id) => ['selected_support', id])] as Array<[string, string | null]>) {
    if (!techniqueId) continue
    const candidate = candidates.get(techniqueId)
    if (!candidate || !candidate.eligible || !candidate.score || candidate.score.total < value.threshold) context.addIssue({ code: 'custom', path: [path], message: 'selected devices must be eligible candidates that clear the recorded threshold' })
  }
  if (value.fallback_technique_id && !candidates.has(value.fallback_technique_id)) context.addIssue({ code: 'custom', path: ['fallback_technique_id'], message: 'fallback device must appear in the candidate set' })
  if (value.invention && value.candidates.some((candidate) => candidate.eligible && candidate.score && candidate.score.total >= value.threshold)) context.addIssue({ code: 'custom', path: ['invention'], message: 'invention is prohibited when an existing eligible device clears the threshold' })
})
export type DeviceSelectionTraceV1 = z.infer<typeof DeviceSelectionTraceV1Schema>

export const DeviceUsageEventV1Schema = z.object({
  schema_version: z.literal(1),
  event_id: z.string().uuid(),
  session_id: Identifier,
  job_id: Identifier,
  beat_id: Identifier,
  technique_id: Identifier,
  technique_version: z.number().int().positive(),
  action: z.enum(['proposed', 'approved', 'replaced', 'removed', 'shortened', 'repositioned', 'praised', 'rejected']),
  replacement_technique_id: Identifier.optional(),
  reason: z.string().trim().min(4).max(600).optional(),
  scope: z.object({ level: z.enum(['global', 'series', 'mode', 'treatment', 'platform', 'job']), key: z.string().trim().min(1) }).strict(),
  evidence_strength: z.enum(['weak', 'strong']),
  confirmation: z.enum(['observed', 'confirmed', 'corrected']).default('observed'),
  occurred_at: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (value.action === 'replaced' && !value.replacement_technique_id) context.addIssue({ code: 'custom', path: ['replacement_technique_id'], message: 'replacement action requires its replacement device' })
  if (['replaced', 'removed', 'rejected'].includes(value.action) && !value.reason) context.addIssue({ code: 'custom', path: ['reason'], message: 'negative device feedback requires a reason' })
})
export type DeviceUsageEventV1 = z.infer<typeof DeviceUsageEventV1Schema>

export const DeviceLearningProposalV1Schema = z.object({
  schema_version: z.literal(1),
  proposal_id: Identifier,
  technique_id: Identifier,
  action: z.enum(['approved', 'replaced', 'removed', 'shortened', 'repositioned', 'praised', 'rejected']),
  replacement_technique_id: Identifier.optional(),
  scope: z.object({ level: z.enum(['global', 'series', 'mode', 'treatment', 'platform', 'job']), key: z.string().trim().min(1) }).strict(),
  assertion: z.string().trim().min(12).max(800),
  supporting_event_ids: z.array(z.string().uuid()).min(1),
  counterexample_event_ids: z.array(z.string().uuid()),
  independent_job_count: z.number().int().nonnegative(),
  independent_session_count: z.number().int().nonnegative(),
  lifecycle_state: z.enum(['observed', 'eligible']),
  eligibility_reason: z.string().trim().min(12).max(600),
  requires_krish_approval: z.literal(true),
  activation_allowed: z.literal(false),
}).strict()
export type DeviceLearningProposalV1 = z.infer<typeof DeviceLearningProposalV1Schema>

export const ArtDirectorRepertoireV1Schema = z.object({
  schema_version: z.literal(1),
  registry_id: Identifier,
  version: z.number().int().positive(),
  principle: z.string().trim().min(12).max(600),
  selection_policy: z.object({
    version: z.literal('art-director-v1'),
    minimum_score: z.number().int().min(1).max(100),
    maximum_support_devices: z.literal(2),
    maximum_signature_devices_per_short: z.literal(1),
    maximum_experimental_devices_per_short: z.literal(1),
    invention_requires_no_credible_fit: z.literal(true),
    invention_requires_krish_approval: z.literal(true),
  }).strict().default({
    version: 'art-director-v1',
    minimum_score: 68,
    maximum_support_devices: 2,
    maximum_signature_devices_per_short: 1,
    maximum_experimental_devices_per_short: 1,
    invention_requires_no_credible_fit: true,
    invention_requires_krish_approval: true,
  }),
  techniques: z.array(VisualDeviceDefinitionV1Schema).min(1),
  recipes: z.array(VisualRecipeV1Schema).default([]),
  reference_observations: z.array(ReferenceObservationV1Schema).default([]),
}).strict().superRefine((value, context) => {
  const techniqueIds = value.techniques.map((item) => item.technique_id)
  if (new Set(techniqueIds).size !== techniqueIds.length) context.addIssue({ code: 'custom', path: ['techniques'], message: 'device IDs must be unique' })
  const known = new Set(techniqueIds)
  value.recipes.forEach((recipe, index) => recipe.device_sequence.forEach((id) => {
    if (!known.has(id)) context.addIssue({ code: 'custom', path: ['recipes', index, 'device_sequence'], message: `recipe references unknown device ${id}` })
  }))
})
export type ArtDirectorRepertoireV1 = z.infer<typeof ArtDirectorRepertoireV1Schema>
