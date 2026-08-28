import { describe, expect, it } from 'vitest'
import { PUBLIC_SERIES_NAMES, RadarFeedV1Schema, normalizeSeries } from '@mindmake/contracts'
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
})
