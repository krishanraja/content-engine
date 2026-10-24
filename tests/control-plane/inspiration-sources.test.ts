import { describe, expect, it } from 'vitest'
import { buildInspiration, card } from '../../apps/control-plane/api/_inspirationSources'

// Krish, 2026-10-24: "Double check my inspirationhouse gets read properly when ideas are being built, alongside all
// the other sources of content suggestions." Three cards he routed to Make a piece that day had no idea row.

const WEEK = '2026-10-26'
const item = (id: string, extra: Record<string, any> = {}) => ({
  id, name: `${id}.jpg`, folder: 'cold_ideas', lane: 'strategy', kind: null, facets: { platform: 'instagram' }, route: null, routes: [],
  why_like: null, why_like_source: null, would_do: null, note_for_claude: null, answered_at: null, answered_by: null,
  dismissed_at: null, created_at: '2026-10-22T09:00:00Z', piece_id: null, auto_tags: [], confirmed_tags: [], transcript: null, ...extra,
})

describe('the Inspiration House block', () => {
  it('a card routed to Make a piece is owed a place on the board, with his typed words', () => {
    const out = buildInspiration({ weekStart: WEEK, items: [
      item('routed', { route: 'make_piece', routes: ['make_piece'], why_like: 'the three-question test is simple', why_like_source: 'typed', answered_by: 'Krish', answered_at: '2026-10-24T08:00:00Z' }),
      item('made', { route: 'make_piece', routes: ['make_piece'], piece_id: '11111111-2222-4333-8444-555555555555' }),
    ] })
    expect(out.routed.map(c => c.id)).toEqual(['routed'])
    expect(out.must_cover).toEqual([{ id: 'routed', what: 'Inspiration card "routed.jpg" you routed to Make a piece', his_words: 'the three-question test is simple', endorsed: null }])
  })

  it('a tapped suggestion is his endorsement, never his words', () => {
    const c = card(item('t', { why_like: 'It makes a debate relatable', why_like_source: 'picked', answered_by: 'Krish' }))
    expect(c.why_like).toBeNull()
    expect(c.endorsed).toBe('It makes a debate relatable')
  })

  it('study_style cards are production references, liked cards are taste, fresh cards are seeds, dismissed ones never show', () => {
    const out = buildInspiration({ weekStart: WEEK, items: [
      item('style', { routes: ['study_style'], route: 'study_style', why_like: 'watch it frame by frame', why_like_source: 'typed' }),
      item('liked', { why_like: 'the chart makes a boring report instantly understandable', why_like_source: 'typed', answered_at: '2026-10-24T08:00:00Z' }),
      item('fresh'), item('old', { created_at: '2026-09-01T09:00:00Z' }), item('gone', { dismissed_at: '2026-10-23T09:00:00Z' }),
      item('slide', { facets: { part_of: { item_id: 'fresh', n: 2 } } }),
    ] })
    expect(out.study_style.map(c => c.id)).toEqual(['style'])
    expect(out.liked.map(c => c.id)).toEqual(['liked'])
    expect(out.fresh.map(c => c.id)).toEqual(['fresh'])
    expect(out.must_cover).toEqual([])
  })

  it('a reading with no card is research he dropped in; one that became a card is not repeated', () => {
    const out = buildInspiration({ weekStart: WEEK, items: [item('carded', { name: 'clip.mp4' }), item('duet', { name: 'https://claude..txt' })], reads: [
      { id: 'r1', sha256: 'a', shape: 'text', platform: 'own', source_url: null, created_at: '2026-10-24T08:00:00Z',
        read_md: '# Reading: own file text\n\nFile: two-species-one-company.md (sha256 0336…)\n\nCaption: The philosophy of the autonomous business' },
      { id: 'r3', sha256: 'c', shape: 'text', platform: 'own', source_url: null, created_at: '2026-10-24T08:00:00Z',
        read_md: '# Reading: own file text\n\nFile: https   claude..txt (sha256 0336…)\n\nFirst line: x' },
      { id: 'r2', sha256: 'b', shape: 'video', platform: 'own', source_url: null, created_at: '2026-10-24T08:00:00Z',
        read_md: '# Reading: own file video\n\nFile: clip.mp4 (sha256 6bc6…)\n\nHeard: words' },
    ] })
    expect(out.corpora.map(c => [c.id, c.title])).toEqual([['r1', 'two-species-one-company.md']])
    expect(out.corpora[0].excerpt).toContain('autonomous business')
  })

  it('taste claims are form only, proposed first, and a retired claim never reaches the drafter', () => {
    const out = buildInspiration({ weekStart: WEEK, items: [], claims: [
      { id: 'c1', kind: 'form', layer: 'opening', status: 'candidate', statement: 'Open on the hook', krish: 'launch straight in', support_n: 3 },
      { id: 'c2', kind: 'form', layer: 'close', status: 'proposed', statement: 'Close on what to do', krish: null, support_n: 4 },
      { id: 'c3', kind: 'subject', layer: null, status: 'proposed', statement: 'Likes cost stories', krish: null, support_n: 5 },
      { id: 'c4', kind: 'form', layer: 'tone', status: 'retired', statement: 'x', krish: null, support_n: 1 },
    ] })
    expect(out.claims.map(c => [c.id, c.status])).toEqual([['c2', 'proposed'], ['c1', 'candidate']])
  })
})
