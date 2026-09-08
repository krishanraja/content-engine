import { z } from 'zod'
import { IdentifierV1Schema, Sha256V1Schema } from './v2.js'

export const PRODUCTION_BRIEF_SCHEMA_VERSION_V1 = 1 as const

export const MONEY_OF_AI_FORMATS_V1 = ['money_trace', 'artifact', 'verdict', 'cold_open_cutdown'] as const
export const BUILT_WITH_AI_FORMATS_V1 = ['builder_conversation', 'build_itself', 'third_why', 'first_version'] as const
export const EditorialFormatV1Schema = z.enum([...MONEY_OF_AI_FORMATS_V1, ...BUILT_WITH_AI_FORMATS_V1])
export type EditorialFormatV1 = z.infer<typeof EditorialFormatV1Schema>

const EDITORIAL_FORMAT_IMPORT_ALIASES = new Map<string, EditorialFormatV1>([
  ['money trace', 'money_trace'],
  ['the money trace', 'money_trace'],
  ['artifact', 'artifact'],
  ['the artifact', 'artifact'],
  ['teardown', 'artifact'],
  ['the teardown', 'artifact'],
  ['verdict', 'verdict'],
  ['the verdict', 'verdict'],
  ['cold open cutdown', 'cold_open_cutdown'],
  ['builder conversation', 'builder_conversation'],
  ['the builder conversation', 'builder_conversation'],
  ['build itself', 'build_itself'],
  ['the build itself', 'build_itself'],
  ['third why', 'third_why'],
  ['the third why', 'third_why'],
  ['first version', 'first_version'],
])

export function normalizeEditorialFormatV1(input: string): EditorialFormatV1 {
  const normalized = input.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  const alias = EDITORIAL_FORMAT_IMPORT_ALIASES.get(normalized)
  if (!alias) throw new Error(`unsupported editorial format: ${input}`)
  return alias
}

export function editorialFormatBelongsToSeriesV1(series: 'money_of_ai' | 'built_with_ai', format: EditorialFormatV1): boolean {
  return (series === 'money_of_ai' ? MONEY_OF_AI_FORMATS_V1 : BUILT_WITH_AI_FORMATS_V1).includes(format as never)
}

export const ProductionBriefV1Schema = z.object({
  schema_version: z.literal(PRODUCTION_BRIEF_SCHEMA_VERSION_V1),
  brief_id: IdentifierV1Schema,
  content_idea_id: z.string().uuid(),
  content_revision_hash: Sha256V1Schema,
  series: z.enum(['money_of_ai', 'built_with_ai']),
  editorial_format: EditorialFormatV1Schema.optional(),
  production_kinds: z.array(z.enum(['video', 'carousel'])).min(1).max(2).refine((value) => new Set(value).size === value.length, { message: 'production kinds must be unique' }),
  source_mode: z.enum(['extract', 'solo', 'short_native', 'written']),
  content: z.object({
    title: z.string().min(1).max(220),
    thesis: z.string().min(12).max(1600),
    approved_text: z.string().min(12).max(30_000),
    audience: z.string().min(3).max(600),
    intended_payoff: z.string().min(12).max(1200),
  }).strict(),
  claims: z.array(z.object({
    claim_id: IdentifierV1Schema,
    text: z.string().min(1).max(1200),
    evidence_urls: z.array(z.string().url()).max(16),
    verification: z.enum(['verified', 'human_required']),
    approved_case_material: z.boolean().default(false),
  }).strict()).max(64),
  visual_opportunities: z.array(z.object({
    opportunity_id: IdentifierV1Schema,
    description: z.string().min(3).max(1200),
    proof_role: z.enum(['evidence', 'owned_artifact', 'illustration', 'texture']),
    source_urls: z.array(z.string().url()).max(16),
  }).strict()).max(64),
  hard_gates: z.object({
    truth: z.literal('passed'),
    rights: z.literal('passed'),
    confidentiality: z.literal('passed'),
    meaning: z.literal('passed'),
    naming: z.literal('passed'),
  }).strict(),
  editorial_approval: z.object({
    approved_by: z.literal('Krish'),
    approved_at: z.string().datetime(),
    approval_revision_hash: Sha256V1Schema,
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.editorial_approval.approval_revision_hash !== value.content_revision_hash) {
    context.addIssue({ code: 'custom', path: ['editorial_approval', 'approval_revision_hash'], message: 'editorial approval must bind the exact content revision' })
  }
  if (value.production_kinds.includes('video') && value.source_mode === 'written') {
    context.addIssue({ code: 'custom', path: ['source_mode'], message: 'video production needs extract, solo or short_native source mode' })
  }
  if (value.editorial_format && !editorialFormatBelongsToSeriesV1(value.series, value.editorial_format)) {
    context.addIssue({ code: 'custom', path: ['editorial_format'], message: 'editorial format does not belong to this series' })
  }
  for (const [index, claim] of value.claims.entries()) {
    if (claim.verification === 'verified' && claim.evidence_urls.length === 0 && !claim.approved_case_material) {
      context.addIssue({ code: 'custom', path: ['claims', index, 'evidence_urls'], message: 'a verified claim needs public evidence or approved case material' })
    }
  }
})

export type ProductionBriefV1 = z.infer<typeof ProductionBriefV1Schema>

const RunnerIdentityV1Schema = z.string().regex(/^[a-z0-9][a-z0-9_-]{1,95}$/i)
const RunnerCommitV1Schema = z.string().regex(/^(?:[a-f0-9]{40}|unknown)$/)
const LeaseTokenV1Schema = z.string().min(24).max(256)

export const ProductionBriefClaimRequestV1Schema = z.object({
  schema_version: z.literal(1),
  runner_id: RunnerIdentityV1Schema,
  software_commit: RunnerCommitV1Schema,
  command_schema_versions: z.tuple([z.literal(1)]),
  lease_seconds: z.number().int().min(30).max(300).optional(),
}).strict()
export type ProductionBriefClaimRequestV1 = z.infer<typeof ProductionBriefClaimRequestV1Schema>

export const ClaimedProductionBriefV1Schema = z.object({
  content_idea_id: z.string().uuid(),
  brief: ProductionBriefV1Schema,
  brief_hash: Sha256V1Schema,
  lease: z.object({
    token: LeaseTokenV1Schema,
    expires_at: z.string().datetime(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.content_idea_id !== value.brief.content_idea_id) {
    context.addIssue({ code: 'custom', path: ['content_idea_id'], message: 'claimed content idea must match its brief' })
  }
})
export type ClaimedProductionBriefV1 = z.infer<typeof ClaimedProductionBriefV1Schema>

export const ProductionBriefClaimResponseV1Schema = z.object({
  ok: z.literal(true),
  schema_version: z.literal(1),
  item: ClaimedProductionBriefV1Schema.nullable(),
}).strict()

export const ProductionBriefCompleteRequestV1Schema = z.object({
  schema_version: z.literal(1),
  runner_id: RunnerIdentityV1Schema,
  content_idea_id: z.string().uuid(),
  brief_id: IdentifierV1Schema,
  brief_hash: Sha256V1Schema,
  lease_token: LeaseTokenV1Schema,
  status: z.enum(['imported', 'awaiting_source_bundle', 'failed']),
  job_id: IdentifierV1Schema.nullable(),
  safe_code: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/).nullable(),
}).strict().superRefine((value, context) => {
  if (value.status === 'failed' && value.safe_code === null) {
    context.addIssue({ code: 'custom', path: ['safe_code'], message: 'failed production brief completion requires a safe code' })
  }
  if (value.status !== 'failed' && value.safe_code !== null) {
    context.addIssue({ code: 'custom', path: ['safe_code'], message: 'successful production brief completion cannot carry a failure code' })
  }
})
export type ProductionBriefCompleteRequestV1 = z.infer<typeof ProductionBriefCompleteRequestV1Schema>

export const ProductionBriefCompleteResponseV1Schema = z.object({
  ok: z.literal(true),
  schema_version: z.literal(1),
  duplicate: z.boolean(),
  brief_id: IdentifierV1Schema,
  status: z.enum(['imported', 'awaiting_source_bundle', 'failed']),
  job_id: IdentifierV1Schema.nullable(),
}).strict()
