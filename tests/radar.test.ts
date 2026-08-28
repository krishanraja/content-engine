import { describe, expect, it } from 'vitest'
import { mergeRadarFeeds, rankRadarOpportunities, selectWeeklyBrief } from '@mindmake/core'
import type { RadarFeedV1 } from '@mindmake/contracts'

function feed(provider: 'mm_ctrl' | 'control_center', candidates: RadarFeedV1['candidates']): RadarFeedV1 {
  return { schema_version: 1, provider, provider_version: 'test', generated_at: '2026-08-28T10:00:00.000Z', source_age: 0, candidates }
}

describe('radar', () => {
  it('deduplicates shared stories and preserves the more corroborated record', () => {
    const base = { id: 'a', title: 'AI agents change workflow cost', summary: 'A mechanism for enterprise buyers.', source_kind: 'public_signal' as const, sensitivity: 'public' as const, occurred_at: '2026-08-28T09:00:00.000Z', source_urls: ['https://example.com/a'], evidence_status: 'public_grounded' as const, category: 'economics', source_ref_hash: 'hash' }
    const merged = mergeRadarFeeds([feed('control_center', [{ ...base, corroboration: 1 }]), feed('mm_ctrl', [{ ...base, id: 'b', corroboration: 3 }])])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.corroboration).toBe(3)
  })

  it('hard-blocks sanitized internal patterns without public evidence', () => {
    const candidates = [{ id: 'private', title: 'Customer pattern', summary: 'A de-identified issue', source_kind: 'internal_pattern' as const, sensitivity: 'internal_sanitized' as const, occurred_at: '2026-08-28T09:00:00.000Z', source_urls: [], corroboration: 0, evidence_status: 'public_evidence_required' as const, category: 'customer_voice', source_ref_hash: 'privatehash' }]
    const ranked = rankRadarOpportunities(candidates, new Date('2026-08-28T10:00:00.000Z'))
    expect(ranked[0]?.editorial_eligible).toBe(false)
    expect(ranked[0]?.hard_blocks[0]).toContain('public evidence')
    expect(selectWeeklyBrief(ranked)).toHaveLength(1)
  })

  it('routes economic workflow stories to The Money of AI', () => {
    const candidate = { id: 'economic', title: 'AI costs move into workflow design', summary: 'The operating model changes enterprise margin.', source_kind: 'public_signal' as const, sensitivity: 'public' as const, occurred_at: '2026-08-28T09:00:00.000Z', source_urls: ['https://example.com/economics'], corroboration: 2, evidence_status: 'public_grounded' as const, category: 'economics', source_ref_hash: 'economichash' }
    expect(rankRadarOpportunities([candidate], new Date('2026-08-28T10:00:00.000Z'))[0]?.series).toBe('money_of_ai')
  })
})
