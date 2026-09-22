import { describe, expect, it } from 'vitest'
import { aliasMatcher, matchEntities } from '../apps/control-plane/api/trends/_entities.js'
import { weekLabelBack } from '../apps/control-plane/api/_weeks.js'

// The alias matcher is the whole quality of the entity series. A false
// positive here does not throw, it inflates a competitor's share of voice for
// months and nobody can tell from the chart. These are the cases that matter.

const entities = [
  { slug: 'openai', aliases: ['openai', 'open ai'] },
  { slug: 'anthropic', aliases: ['anthropic'] },
  { slug: 'rag', aliases: ['rag', 'retrieval augmented'] },
  { slug: 'mcp', aliases: ['mcp', 'model context protocol'] },
  { slug: 'xai', aliases: ['xai', 'x.ai'] },
  { slug: 'gpt', aliases: ['gpt', 'gpt-4'] },
]

describe('aliasMatcher', () => {
  it('matches a whole word regardless of case', () => {
    expect(aliasMatcher('openai').test('OpenAI ships a thing')).toBe(true)
  })

  it('does not match inside a longer word', () => {
    // 'rag' inside 'fragment' and 'storage' is the classic way a technique
    // series ends up looking busy and meaning nothing.
    expect(aliasMatcher('rag').test('a fragment of text')).toBe(false)
    expect(aliasMatcher('rag').test('storage costs')).toBe(false)
    expect(aliasMatcher('rag').test('we shipped RAG last week')).toBe(true)
  })

  it('treats a dot in an alias as a literal', () => {
    // Unescaped, 'x.ai' would match 'xyai' and worse, 'xbai', 'x-ai'.
    expect(aliasMatcher('x.ai').test('xyai is not it')).toBe(false)
    expect(aliasMatcher('x.ai').test('posted on x.ai today')).toBe(true)
  })

  it('matches a hyphenated alias without the hyphen acting as a boundary trick', () => {
    expect(aliasMatcher('gpt-4').test('GPT-4 arrives')).toBe(true)
  })

  it('matches a multi-word alias', () => {
    expect(aliasMatcher('model context protocol').test('the Model Context Protocol spec')).toBe(true)
  })

  it('handles punctuation adjacency, which is most real headlines', () => {
    expect(aliasMatcher('anthropic').test('Anthropic, again')).toBe(true)
    expect(aliasMatcher('anthropic').test('(Anthropic)')).toBe(true)
    expect(aliasMatcher('openai').test('"OpenAI" said')).toBe(true)
  })

  it('does not let a digit adjacency create a false word boundary', () => {
    // 'gpt' must not match inside 'gpt5' when 'gpt5' is someone else's token,
    // because the boundary is letters AND digits, not just letters.
    expect(aliasMatcher('gpt').test('gpt5 rumours')).toBe(false)
    expect(aliasMatcher('gpt').test('GPT is here')).toBe(true)
  })
})

describe('matchEntities', () => {
  it('returns the alias that matched, so a bad alias can be found', () => {
    expect(matchEntities('Open AI ships', entities))
      .toEqual([{ slug: 'openai', matchedOn: 'open ai' }])
  })

  it('counts an entity once however many of its aliases hit', () => {
    // Otherwise an entity with more aliases outranks one with fewer purely
    // because somebody wrote more synonyms into the registry.
    const hits = matchEntities('OpenAI and Open AI', entities)
    expect(hits.filter(h => h.slug === 'openai')).toHaveLength(1)
  })

  it('finds several distinct entities in one headline', () => {
    const slugs = matchEntities('Anthropic and OpenAI both ship MCP support', entities)
      .map(h => h.slug).sort()
    expect(slugs).toEqual(['anthropic', 'mcp', 'openai'])
  })

  it('returns nothing for text that mentions nobody', () => {
    expect(matchEntities('a quiet week for everyone', entities)).toEqual([])
  })

  it('ignores an empty alias rather than matching everything', () => {
    // An empty string in the registry would otherwise tag every observation
    // with that entity and silently ruin the series.
    expect(matchEntities('anything at all', [{ slug: 'broken', aliases: [''] }])).toEqual([])
  })
})

describe('weekLabelBack', () => {
  it('gives the current ISO week at zero', () => {
    expect(weekLabelBack(0, new Date('2026-09-22T12:00:00Z'))).toBe('2026-W39')
  })

  it('steps back a week', () => {
    expect(weekLabelBack(1, new Date('2026-09-22T12:00:00Z'))).toBe('2026-W38')
  })

  it('crosses a year boundary without inventing week 00', () => {
    // 2027-01-04 is the Monday of 2027-W01, so one week back is the last week
    // of 2026 under ISO week-numbering rather than '2027-W00'.
    expect(weekLabelBack(1, new Date('2027-01-07T12:00:00Z'))).toBe('2026-W53')
  })
})
