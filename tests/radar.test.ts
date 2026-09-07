import { describe, expect, it } from 'vitest'
import * as core from '@mindmake/core'
import { mergeRadarFeeds, radarEditorialQualityBlocks } from '@mindmake/core'
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

  it('validates every feed against the radar schema before merging', () => {
    const invalid = { ...feed('mm_ctrl', []), schema_version: 2 } as unknown as RadarFeedV1
    expect(() => mergeRadarFeeds([invalid])).toThrow()
  })

  it('flags generic guides, weak sources, thin summaries and appointments as evidence-quality blocks', () => {
    const now = new Date('2026-08-29T10:00:00.000Z')
    const guide = { id: 'guide', title: 'How to Run a Chatbot on Your Own Computer', summary: 'A practical walkthrough for installing and running a private chatbot on a personal computer.', source_kind: 'public_signal' as const, sensitivity: 'public' as const, occurred_at: '2026-08-29T09:00:00.000Z', source_urls: ['https://www.wired.com/story/local-chatbot'], corroboration: 2, evidence_status: 'public_grounded' as const, category: 'governance', source_ref_hash: 'guidehash' }
    const aggregator = { ...guide, id: 'aggregator', title: 'Claude deletes a developer directory', source_urls: ['https://slashdot.org/story'], source_ref_hash: 'aggregatorhash' }
    const thin = { ...guide, id: 'thin', title: 'Gemini Transcribe', summary: 'Gemini Transcribe', source_urls: ['https://blog.google/innovation-and-ai/models/gemini'], corroboration: 1, source_ref_hash: 'thinhash' }
    const appointment = { ...guide, id: 'appointment', title: 'OpenAI appoints a Meta executive to lead a region', summary: 'The leadership change signals a general focus on regional growth and partnerships.', source_urls: ['https://www.bloomberg.com/news/appointment'], source_ref_hash: 'appointmenthash' }
    expect(radarEditorialQualityBlocks(guide, now)).toContain('generic guide, listicle or service headline is not eligible for the weekly news brief')
    expect(radarEditorialQualityBlocks(aggregator, now)).toContain('aggregator or discussion surface is not acceptable headline evidence')
    expect(radarEditorialQualityBlocks(thin, now)).toContain('summary does not state a specific, intelligible consequence')
    expect(radarEditorialQualityBlocks(appointment, now)).toContain('personnel appointment is not an opportunity without a specific operating or commercial consequence')
  })

  it('passes a substantive primary-authority signal through the evidence-quality checks', () => {
    const candidate = { id: 'primary', title: 'Google releases a new transcription model', summary: 'The release adds timestamped multilingual speech recognition and changes the available local workflow.', source_kind: 'public_signal' as const, sensitivity: 'public' as const, occurred_at: '2026-08-29T09:00:00.000Z', source_urls: ['https://blog.google/innovation-and-ai/models/transcription'], corroboration: 1, evidence_status: 'public_grounded' as const, category: 'model', source_ref_hash: 'primaryhash' }
    expect(radarEditorialQualityBlocks(candidate, new Date('2026-08-29T10:00:00.000Z'))).toEqual([])
  })

  it('exposes no ranking or weekly-brief selection: radar is a feed importer only', () => {
    expect('rankRadarOpportunities' in core).toBe(false)
    expect('selectWeeklyBrief' in core).toBe(false)
    expect('applyCorpusNovelty' in core).toBe(false)
  })
})
