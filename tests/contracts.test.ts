import { describe, expect, it } from 'vitest'
import { ApprovalGateSchema, BrandHouseStyleV1Schema, ClaimSchema, EvidenceOverlayV1Schema, OrchestratedEvidenceOverlayV1Schema, PUBLIC_SERIES_NAMES, RadarFeedV1Schema, normalizeSeries } from '@mindmake/contracts'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import studioConfig from '../config/studio.json'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('canonical series contracts', () => {
  it('accepts legacy aliases only at import time', () => {
    expect(normalizeSeries('paid')).toBe('money_of_ai')
    expect(normalizeSeries('built')).toBe('built_with_ai')
    expect(PUBLIC_SERIES_NAMES.money_of_ai).toBe('The Money of AI')
    expect(PUBLIC_SERIES_NAMES.built_with_ai).toBe('Built With AI')
  })

  it('rejects unsupported radar schema majors', () => {
    expect(() => RadarFeedV1Schema.parse({ schema_version: 2, provider: 'offline', provider_version: 'x', generated_at: new Date().toISOString(), source_age: 0, candidates: [] })).toThrow()
  })

  it('accepts both upstream offline contract fixtures', async () => {
    for (const name of ['mm-ctrl-radar-v1.json', 'control-center-radar-v1.json']) {
      const feed = RadarFeedV1Schema.parse(JSON.parse(await readFile(join(fixtures, name), 'utf8')))
      expect(feed.schema_version).toBe(1)
    }
  })

  it('requires evidence overlays to carry timing, attribution, and rights provenance', () => {
    const overlay = {
      overlay_id: 'source-card', start_ms: 1000, end_ms: 4000, kind: 'screenshot', asset_path: 'source.png', title: 'Publishers take control', source_label: 'Industry source', source_url: 'https://example.com/evidence', attribution: 'Example evidence report', rights_rationale: 'Transformative excerpt used briefly to support the spoken editorial claim.', approved: true,
    }
    expect(EvidenceOverlayV1Schema.parse(overlay).placement).toBe('upper')
    expect(() => EvidenceOverlayV1Schema.parse({ ...overlay, end_ms: 500 })).toThrow('evidence overlay must end after it starts')
    expect(() => EvidenceOverlayV1Schema.parse({ ...overlay, attribution: '' })).toThrow()
    expect(() => OrchestratedEvidenceOverlayV1Schema.parse(overlay)).toThrow('approved evidence requires viewer_intent')
    expect(OrchestratedEvidenceOverlayV1Schema.parse({ ...overlay, viewer_intent: 'verify_claim', presentation: 'evidence_cutaway', anchor: 'center', face_policy: 'intentional_substitution' }).presentation).toBe('evidence_cutaway')
    expect(OrchestratedEvidenceOverlayV1Schema.parse({ ...overlay, viewer_intent: 'maintain_connection', presentation: 'evidence_ribbon', anchor: 'center', face_policy: 'avoid' }).presentation).toBe('evidence_ribbon')
    expect(() => OrchestratedEvidenceOverlayV1Schema.parse({ ...overlay, viewer_intent: 'verify_claim', presentation: 'evidence_cutaway', anchor: 'center', face_policy: 'avoid' })).toThrow('intentional presenter substitution')
  })

  it('has a separate evidence approval gate', () => {
    expect(ApprovalGateSchema.parse('evidence')).toBe('evidence')
  })

  it('does not accept an evidence-free factual claim as verified', () => {
    expect(() => ClaimSchema.parse({ text: 'Revenue increased by 30%.', kind: 'fact', evidence_urls: [], verification: 'verified' })).toThrow('evidence URL')
    expect(ClaimSchema.parse({ text: 'Revenue increased by 30%.', kind: 'fact', evidence_urls: ['https://example.com/report'], verification: 'verified' }).verification).toBe('verified')
  })
})

describe('house style copy across the why-ladder change', () => {
  const live = (studioConfig.brand_themes as Array<{ publication?: { house_style?: Record<string, unknown> } }>)
    .map((theme) => theme.publication?.house_style).find(Boolean) as { copy: Record<string, string> } & Record<string, unknown>

  it('still parses a house style a job pinned before 24 Nov 2026, with its call copy', () => {
    // The copy of config/studio.json at 96c840a4 (origin/main before the ruling), as an existing v2 job pinned it.
    const pinnedCopy = {
      site: 'makeyourmindup.ai', call_kicker: 'The call', call_headline: 'Our call.',
      call_footnote: 'One view, made only when it is worth making. You make your mind up.',
      question_kicker: 'The question', cover_call_sticker: 'Swipe for the call',
    }
    const parsed = BrandHouseStyleV1Schema.parse({ ...live, copy: pinnedCopy })
    expect(parsed.copy).toEqual(pinnedCopy)
  })

  it('reads the live copy, which carries the ladder kickers and no call (Ruling, Krish, 2026-11-24)', () => {
    const parsed = BrandHouseStyleV1Schema.parse(live)
    expect(parsed.copy.landing_kicker).toBe('What this shows')
    expect(Object.keys(live.copy).filter((key) => key.includes('call'))).toEqual([])
  })
})
