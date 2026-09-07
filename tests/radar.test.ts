import { describe, expect, it } from 'vitest'
import { mergeRadarFeeds, radarEditorialQualityBlocks, rankRadarOpportunities, selectWeeklyBrief } from '@mindmake/core'
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
    expect(selectWeeklyBrief(ranked)).toHaveLength(0)
  })

  it('keeps raw signals neutral and opens independent series lenses without a Built default', () => {
    const candidate = { id: 'economic', title: 'AI costs move into workflow design', summary: 'The operating model changes enterprise margin.', source_kind: 'public_signal' as const, sensitivity: 'public' as const, occurred_at: '2026-08-28T09:00:00.000Z', source_urls: ['https://example.com/economics'], corroboration: 2, evidence_status: 'public_grounded' as const, category: 'economics', source_ref_hash: 'economichash' }
    const ranked = rankRadarOpportunities([candidate], new Date('2026-08-28T10:00:00.000Z'))
    expect(ranked.map((item) => item.series).sort()).toEqual(['built_with_ai', 'money_of_ai'])
    expect(ranked.every((item) => !item.editorial_eligible)).toBe(true)
    expect(ranked.every((item) => item.hard_blocks.includes('raw radar signal requires an approved Control Center editorial opportunity before production'))).toBe(true)
    expect(ranked.every((item) => !item.proposed_hook.includes('inside this headline'))).toBe(true)
  })

  it('rejects generic guides, weak sources and thin summaries from the weekly brief', () => {
    const now = new Date('2026-08-29T10:00:00.000Z')
    const guide = { id: 'guide', title: 'How to Run a Chatbot on Your Own Computer', summary: 'A practical walkthrough for installing and running a private chatbot on a personal computer.', source_kind: 'public_signal' as const, sensitivity: 'public' as const, occurred_at: '2026-08-29T09:00:00.000Z', source_urls: ['https://www.wired.com/story/local-chatbot'], corroboration: 2, evidence_status: 'public_grounded' as const, category: 'governance', source_ref_hash: 'guidehash' }
    const aggregator = { ...guide, id: 'aggregator', title: 'Claude deletes a developer directory', source_urls: ['https://slashdot.org/story'], source_ref_hash: 'aggregatorhash' }
    const thin = { ...guide, id: 'thin', title: 'Gemini Transcribe', summary: 'Gemini Transcribe', source_urls: ['https://blog.google/innovation-and-ai/models/gemini'], corroboration: 1, source_ref_hash: 'thinhash' }
    const appointment = { ...guide, id: 'appointment', title: 'OpenAI appoints a Meta executive to lead a region', summary: 'The leadership change signals a general focus on regional growth and partnerships.', source_urls: ['https://www.bloomberg.com/news/appointment'], source_ref_hash: 'appointmenthash' }
    expect(radarEditorialQualityBlocks(guide, now)).toContain('generic guide, listicle or service headline is not eligible for the weekly news brief')
    expect(radarEditorialQualityBlocks(aggregator, now)).toContain('aggregator or discussion surface is not acceptable headline evidence')
    expect(radarEditorialQualityBlocks(thin, now)).toContain('summary does not state a specific, intelligible consequence')
    expect(radarEditorialQualityBlocks(appointment, now)).toContain('personnel appointment is not an opportunity without a specific operating or commercial consequence')
    expect(selectWeeklyBrief(rankRadarOpportunities([guide, aggregator, thin, appointment], now))).toEqual([])
  })

  it('retains a substantive primary signal but does not turn it into production copy', () => {
    const candidate = { id: 'primary', title: 'Google releases a new transcription model', summary: 'The release adds timestamped multilingual speech recognition and changes the available local workflow.', source_kind: 'public_signal' as const, sensitivity: 'public' as const, occurred_at: '2026-08-29T09:00:00.000Z', source_urls: ['https://blog.google/innovation-and-ai/models/transcription'], corroboration: 1, evidence_status: 'public_grounded' as const, category: 'model', source_ref_hash: 'primaryhash' }
    const ranked = rankRadarOpportunities([candidate], new Date('2026-08-29T10:00:00.000Z'))
    expect(radarEditorialQualityBlocks(candidate, new Date('2026-08-29T10:00:00.000Z'))).toEqual([])
    expect(ranked).toHaveLength(2)
    expect(ranked.every((item) => !item.editorial_eligible)).toBe(true)
    expect(selectWeeklyBrief(ranked)).toHaveLength(0)
  })
})
