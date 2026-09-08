import { describe, it, expect } from 'vitest'
import {
  toCandidates, selectWithinBudget, storyUrl, parseSeedArray, filterSeeds,
  normaliseHandle, handleKey, creatorMatches, fileHash, artifactKey,
  DEFAULT_MAX_IMAGE_BYTES, DEFAULT_MAX_IMAGES,
} from '../../apps/control-plane/api/inspiration/_scan.js'

// The Drive scan spends on vision calls unattended, so what it decides to read
// and what it counts as the same thing are the two places a quiet bug is
// expensive. These run with no Drive, no model and no database.

const png = (id: string, bytes: number, modified = '2026-09-01T00:00:00Z') => ({
  id, name: `${id}.png`, mimeType: 'image/png', modifiedTime: modified, size: String(bytes),
})

describe('what the scan will read', () => {
  it('lists everything and reads only what the vision call can take', () => {
    const { candidates, listed, unreadable } = toCandidates([
      png('a', 1000),
      { id: 'b', name: 'notes.txt', mimeType: 'text/plain', modifiedTime: '2026-09-01T00:00:00Z' },
      { id: 'c', name: 'clip.mov', mimeType: 'video/quicktime', modifiedTime: '2026-09-01T00:00:00Z', size: '90000000' },
    ])
    expect(listed).toBe(3)
    expect(unreadable).toBe(1)
    expect(candidates.map(c => c.id)).toEqual(['a', 'b'])
    // A native Google doc reports no size and must not read as NaN bytes.
    expect(candidates[1].size_bytes).toBe(0)
  })

  it('keys the ledger by file and modification, so an edited file returns and an untouched one does not', () => {
    const { candidates } = toCandidates([png('a', 10, '2026-09-01T00:00:00Z')])
    expect(candidates[0].file_key).toBe('a:2026-09-01T00:00:00Z')

    const unchanged = selectWithinBudget({ candidates, settled: new Set(['a:2026-09-01T00:00:00Z']) })
    expect(unchanged.selected).toHaveLength(0)
    expect(unchanged.seen_before).toBe(1)

    const edited = toCandidates([png('a', 10, '2026-09-02T00:00:00Z')])
    const after = selectWithinBudget({ candidates: edited.candidates, settled: new Set(['a:2026-09-01T00:00:00Z']) })
    expect(after.selected).toHaveLength(1)
  })
})

describe('the request budget', () => {
  it('defers by name rather than dropping silently', () => {
    const { candidates } = toCandidates([png('a', 2_000_000), png('b', 2_000_000), png('c', 2_000_000)])
    const sel = selectWithinBudget({ candidates, settled: new Set(), maxImageBytes: 4_500_000, maxImages: 6 })
    expect(sel.selected.map(c => c.id)).toEqual(['a', 'b'])
    expect(sel.deferred.map(c => c.name)).toEqual(['c.png'])
    expect(sel.selected_bytes).toBe(4_000_000)
  })

  it('caps the count as well as the bytes', () => {
    const { candidates } = toCandidates(Array.from({ length: 10 }, (_, i) => png(`f${i}`, 1000)))
    const sel = selectWithinBudget({ candidates, settled: new Set() })
    expect(sel.selected).toHaveLength(DEFAULT_MAX_IMAGES)
    expect(sel.deferred).toHaveLength(10 - DEFAULT_MAX_IMAGES)
    expect(sel.selected_bytes).toBeLessThan(DEFAULT_MAX_IMAGE_BYTES)
  })

  it('never charges a text document against the image budget', () => {
    const files = [
      { id: 'd', name: 'doc.txt', mimeType: 'text/plain', modifiedTime: 'm' },
      ...Array.from({ length: DEFAULT_MAX_IMAGES }, (_, i) => png(`f${i}`, 1000)),
    ]
    const { candidates } = toCandidates(files)
    const sel = selectWithinBudget({ candidates, settled: new Set() })
    expect(sel.selected).toHaveLength(DEFAULT_MAX_IMAGES + 1)
    expect(sel.deferred).toHaveLength(0)
  })
})

describe('what counts as the same thing', () => {
  const hash = 'f'.repeat(64)

  it('takes the post url over the Drive link', () => {
    expect(storyUrl('https://www.linkedin.com/posts/abc_def-123', hash))
      .toBe('https://www.linkedin.com/posts/abc_def-123')
  })

  it('refuses the Drive link, which identifies the copy and not the story', () => {
    expect(storyUrl('https://drive.google.com/file/d/xyz/view', hash)).toBe(`screenshot:${hash}`)
    expect(storyUrl('https://docs.google.com/document/d/xyz/edit', hash)).toBe(`screenshot:${hash}`)
  })

  it('falls back to the content hash, so the same screenshot twice is one idea', () => {
    const bytes = new TextEncoder().encode('the same screenshot')
    const a = storyUrl(null, fileHash(bytes))
    const b = storyUrl(undefined, fileHash(new TextEncoder().encode('the same screenshot')))
    expect(a).toBe(b)
    expect(a.startsWith('screenshot:')).toBe(true)
  })

  it('has no identity at all when there is neither a url nor bytes', () => {
    expect(storyUrl(null, null)).toBe('')
  })

  it('addresses the stored bytes by content', () => {
    expect(artifactKey(hash, 'image/png')).toBe(`inspiration/ff/${hash}.png`)
    expect(artifactKey(hash, 'application/pdf')).toBe(`inspiration/ff/${hash}.pdf`)
  })
})

describe('the floors', () => {
  const seed = {
    is_idea: true,
    idea: 'Solo builders now ship what a team of twenty used to',
    pillar_id: 'pillar:agentic_ops',
    brand_fit_score: 8,
    evidence_present: ['named entity: Anthropic'],
  }

  it('keeps a seed that clears every floor', () => {
    expect(filterSeeds([seed], 6).survivors).toHaveLength(1)
  })

  it('counts each rejection by reason, so a strict run does not read as a broken one', () => {
    const out = filterSeeds([
      { ...seed, evidence_present: [] },
      { ...seed, brand_fit_score: 3 },
      { ...seed, idea: '5 ways to use AI' },
      { is_idea: false, rejection_reason: 'paraphrase' },
      { is_idea: false, rejection_reason: 'duplicate_angle' },
    ], 6)
    expect(out.survivors).toHaveLength(0)
    expect(out.rejected).toBe(5)
    expect(out.reasons).toMatchObject({
      no_evidence_listed: 1,
      below_min_fit: 1,
      blacklisted_framing: 1,
      not_idea: 1,
      duplicate_angle: 1,
    })
  })

  it('applies the configured floor rather than a hardcoded one', () => {
    expect(filterSeeds([seed], 9).survivors).toHaveLength(0)
    expect(filterSeeds([seed], 8).survivors).toHaveLength(1)
  })
})

describe('reading the model back', () => {
  it('recovers whole objects from a response truncated mid-array', () => {
    const truncated = '[{"idea":"first","is_idea":true},{"idea":"second","is_idea":true}'
    expect(parseSeedArray(truncated).map(s => s.idea)).toEqual(['first', 'second'])
  })

  it('finds the array inside a preamble the model was told not to write', () => {
    expect(parseSeedArray('Here you go:\n[{"idea":"x"}]\nHope that helps')).toHaveLength(1)
  })

  it('returns nothing rather than guessing when there is no array', () => {
    expect(parseSeedArray('I could not read these images.')).toEqual([])
    expect(parseSeedArray('')).toEqual([])
  })
})

describe('joining a screenshot to a creator', () => {
  it('treats every written form of a handle as one person', () => {
    for (const form of ['@KrishRaja', 'krishraja', 'in/krishraja', 'https://www.linkedin.com/in/krishraja/', ' KRISHRAJA ']) {
      expect(normaliseHandle(form)).toBe('krishraja')
    }
  })

  it('is empty for anything that is not a handle', () => {
    expect(normaliseHandle(null)).toBe('')
    expect(normaliseHandle(undefined)).toBe('')
    expect(normaliseHandle(42)).toBe('')
  })

  // The live registry holds a creator with no linkedin_slug. The Tuesday scout
  // needs a slug to scrape, so it can never reach him, and a screenshot is the
  // only way he is ever seen. He had been screenshotted and his posts_seen was
  // still zero.
  const unscrapeable = { slug: 'aaron-levie', linkedin_slug: null, name: 'Aaron Levie' }

  it('matches on the name when there is no handle to match on', () => {
    expect(creatorMatches(unscrapeable, { poster_name: 'Aaron Levie' })).toBe(true)
    expect(creatorMatches(unscrapeable, { poster_name: 'aaron levie' })).toBe(true)
  })

  it('matches a handle against the slug it is spelled from', () => {
    expect(creatorMatches(unscrapeable, { poster_handle: 'aaronlevie' })).toBe(true)
    expect(creatorMatches(unscrapeable, { poster_handle: '@AaronLevie' })).toBe(true)
    expect(creatorMatches(unscrapeable, { poster_handle: 'https://www.linkedin.com/in/aaron-levie/' })).toBe(true)
  })

  it('does not match someone else', () => {
    expect(creatorMatches(unscrapeable, { poster_name: 'Someone Else' })).toBe(false)
    expect(creatorMatches(unscrapeable, {})).toBe(false)
  })

  it('refuses a key too short to be evidence', () => {
    expect(creatorMatches({ slug: 'al', linkedin_slug: null, name: 'AL' }, { poster_handle: 'al' })).toBe(false)
  })

  it('strips every separator so three spellings agree', () => {
    expect(handleKey('Aaron Levie')).toBe('aaronlevie')
    expect(handleKey('aaron-levie')).toBe('aaronlevie')
    expect(handleKey('@aaronlevie')).toBe('aaronlevie')
  })
})
