import { describe, expect, it } from 'vitest'
import { EvidenceOverlayV1Schema, PUBLIC_SERIES_NAMES, RadarFeedV1Schema, normalizeSeries } from '@mindmake/contracts'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  })
})
