import { z } from 'zod'
import { IdentifierV1Schema, Sha256V1Schema } from './v2.js'

export const PRODUCTION_BRIEF_SCHEMA_VERSION_V1 = 1 as const

export const ProductionBriefV1Schema = z.object({
  schema_version: z.literal(PRODUCTION_BRIEF_SCHEMA_VERSION_V1),
  brief_id: IdentifierV1Schema,
  content_idea_id: z.string().uuid(),
  content_revision_hash: Sha256V1Schema,
  series: z.enum(['money_of_ai', 'built_with_ai']),
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
  for (const [index, claim] of value.claims.entries()) {
    if (claim.verification === 'verified' && claim.evidence_urls.length === 0 && !claim.approved_case_material) {
      context.addIssue({ code: 'custom', path: ['claims', index, 'evidence_urls'], message: 'a verified claim needs public evidence or approved case material' })
    }
  }
})

export type ProductionBriefV1 = z.infer<typeof ProductionBriefV1Schema>
