import { describe, expect, it } from 'vitest'
import { ProductionBriefV1Schema } from '@mindmake/contracts'

const hash = 'a'.repeat(64)
const base = {
  schema_version: 1 as const,
  brief_id: 'brief-1',
  content_idea_id: '00000000-0000-4000-8000-000000000001',
  content_revision_hash: hash,
  series: 'money_of_ai' as const,
  production_kinds: ['video'] as const,
  source_mode: 'short_native' as const,
  content: {
    title: 'The price of implementation is changing',
    thesis: 'Lower implementation effort changes what buyers should pay for and what suppliers can keep as margin.',
    approved_text: 'Lower implementation effort changes what buyers should pay for and what suppliers can keep as margin.',
    audience: 'Enterprise leaders buying or selling AI implementation work.',
    intended_payoff: 'A practical way to decide where the saved implementation effort should land.',
  },
  claims: [{ claim_id: 'claim-1', text: 'Implementation effort fell in the cited test.', evidence_urls: ['https://example.com/evidence'], verification: 'verified' as const, approved_case_material: false }],
  visual_opportunities: [{ opportunity_id: 'visual-1', description: 'Show the cited result beside a simple cost stack.', proof_role: 'evidence' as const, source_urls: ['https://example.com/evidence'] }],
  hard_gates: { truth: 'passed' as const, rights: 'passed' as const, confidentiality: 'passed' as const, meaning: 'passed' as const, naming: 'passed' as const },
  editorial_approval: { approved_by: 'Krish' as const, approved_at: '2026-09-07T12:00:00.000Z', approval_revision_hash: hash },
}

describe('ProductionBriefV1', () => {
  it('accepts an exact editorial handoff approved by Krish', () => {
    expect(ProductionBriefV1Schema.parse(base).brief_id).toBe('brief-1')
  })

  it('blocks a verified claim with neither evidence nor approved case material', () => {
    const parsed = ProductionBriefV1Schema.safeParse({ ...base, claims: [{ ...base.claims[0], evidence_urls: [] }] })
    expect(parsed.success).toBe(false)
  })

  it('rejects approval for a different content revision', () => {
    const parsed = ProductionBriefV1Schema.safeParse({
      ...base,
      editorial_approval: { ...base.editorial_approval, approval_revision_hash: 'b'.repeat(64) },
    })
    expect(parsed.success).toBe(false)
  })

  it('does not let written-only input masquerade as a video source', () => {
    const parsed = ProductionBriefV1Schema.safeParse({ ...base, source_mode: 'written' })
    expect(parsed.success).toBe(false)
  })
})
