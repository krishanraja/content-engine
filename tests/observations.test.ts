import { describe, expect, it } from 'vitest'
import {
  contentHash,
  hostOf,
  normalizeUrl,
  sha256,
  toObservationRow,
  type ObservationInput,
} from '../apps/control-plane/api/_observation-shape.js'

// The identity rules for the permanent trend record.
//
// The values pinned here are pinned IDENTICALLY in mm-ctrl's
// supabase/functions/_shared/trend-memory.test.ts, against a different
// Supabase project and a different runtime (Deno Web Crypto there, Node crypto
// here). The two records are meant to be joinable on these hashes, and drift
// between them would not throw: it would quietly split one story into two and
// understate every corroboration count until somebody happened to notice. So
// both suites assert the same literals, and either one drifting goes red.

describe('normalizeUrl', () => {
  it('strips tracking parameters, www, fragment and trailing slash', () => {
    expect(normalizeUrl('https://www.Example.com/a/?utm_source=x&utm_medium=y#frag'))
      .toBe('https://example.com/a')
  })

  it('keeps a query string that is part of the article', () => {
    expect(normalizeUrl('https://example.com/view?id=99')).toBe('https://example.com/view?id=99')
  })

  it('sorts parameters so ordering is not an identity', () => {
    expect(normalizeUrl('https://example.com/a?b=2&a=1'))
      .toBe(normalizeUrl('https://example.com/a?a=1&b=2'))
  })

  it('upgrades http to https so a scheme change is not a new story', () => {
    expect(normalizeUrl('http://example.com/a')).toBe('https://example.com/a')
  })

  it('returns null for anything that is not an http(s) URL', () => {
    expect(normalizeUrl('mailto:someone@example.com')).toBeNull()
    expect(normalizeUrl('not a url')).toBeNull()
    expect(normalizeUrl(null)).toBeNull()
    expect(normalizeUrl(undefined)).toBeNull()
    expect(normalizeUrl('')).toBeNull()
  })
})

describe('hostOf', () => {
  it('returns the bare lowercased host', () => {
    expect(hostOf('https://WWW.Example.com/a')).toBe('example.com')
  })
  it('is null when the URL is unusable', () => {
    expect(hostOf('nonsense')).toBeNull()
  })
})

describe('sha256', () => {
  it('matches the known digest of the empty string', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('contentHash', () => {
  it('ignores case and whitespace reflow', () => {
    expect(contentHash('A  Title', 'Some   text')).toBe(contentHash('a title', 'some text'))
  })

  it('separates title from snippet so the boundary cannot be forged', () => {
    expect(contentHash('ab', 'c')).not.toBe(contentHash('a', 'bc'))
  })

  it('treats a missing snippet as empty', () => {
    expect(contentHash('t', null)).toBe(contentHash('t', ''))
    expect(contentHash('t', undefined)).toBe(contentHash('t', ''))
  })

  it('agrees with mm-ctrl on a fixed input', () => {
    // The cross-repo anchor. mm-ctrl computes this same digest through
    // contentHashInput + sha256Hex in trend-memory.ts. If either side changes
    // its separator, its casing or its whitespace rule, this literal moves and
    // one of the two suites fails.
    expect(contentHash('OpenAI ships a thing', 'A description'))
      .toBe('bc1e47d2d24a96d77213dc469431783ddd3b2f0ca263d7699064cb0c2a65bcc1')
  })
})

describe('toObservationRow', () => {
  const base: ObservationInput = {
    origin: 'pool_headline',
    collector: 'feed/ingest',
    title: 'OpenAI ships a thing',
    snippet: 'A description',
    url: 'https://www.example.com/a?utm_source=x&b=2&a=1',
    surfaced: true,
  }

  it('normalises the URL and derives the host', () => {
    const row = toObservationRow(base)
    expect(row.url).toBe('https://example.com/a?a=1&b=2')
    expect(row.source_host).toBe('example.com')
    expect((row.url_hash as string).length).toBe(64)
  })

  it('clears the drop reason on a surfaced row', () => {
    const row = toObservationRow({ ...base, surfaced: true, dropReason: 'off_beat' })
    expect(row.drop_reason).toBeNull()
  })

  it('always gives an unsurfaced row a reason, since the table demands one', () => {
    // trend_observations has a check constraint requiring it, so a caller that
    // forgets would fail the insert for the whole batch rather than just its
    // own row. Defaulting here keeps one careless caller from costing a day's
    // archive.
    const row = toObservationRow({ ...base, surfaced: false })
    expect(row.drop_reason).toBe('gathered_not_selected')
  })

  it('leaves published_at null rather than substituting the observation time', () => {
    const row = toObservationRow(base)
    expect(row.published_at).toBeNull()
  })

  it('leaves url_hash null when there is no usable URL, so it dedupes on text', () => {
    const row = toObservationRow({ ...base, url: null })
    expect(row.url_hash).toBeNull()
    expect(row.content_hash).toBeTruthy()
  })

  it('defaults the observation day to today in UTC', () => {
    const row = toObservationRow(base)
    expect(row.observed_on).toBe(new Date().toISOString().slice(0, 10))
  })

  it('honours an explicit observation day, so a backdated row lands on its own day', () => {
    // The purge maps a row purged in September but captured in July onto July,
    // or every volume series it feeds would be wrong.
    const row = toObservationRow({ ...base, observedOn: '2026-07-04' })
    expect(row.observed_on).toBe('2026-07-04')
  })
})
