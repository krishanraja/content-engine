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

  // Krish, 2026-10-29, of a YouTube link he saved with "We should reskin this as a hilarious video meme for when your AI
  // talks to your customer's AI.": "check this meme idea ... makes it through correctly to the ideas board".
  it('a link he saved with his own words is owed a place on the board, with those words', () => {
    const note = "We should reskin this as a hilarious video meme for when your AI talks to your customer's AI."
    const link = (extra: Record<string, any>) => ({ platform: 'youtube', link: { url: 'https://youtube.com/shorts/x', note }, ...extra })
    const out = buildInspiration({ weekStart: WEEK, items: [
      item('meme', { facets: link({}), why_here: note }),
      item('undone', { facets: link({}), why_here: null }),
      item('style', { facets: link({}), why_here: note, route: 'study_style', routes: ['study_style'] }),
      item('made', { facets: link({}), why_here: note, piece_id: '11111111-2222-4333-8444-555555555555' }),
    ] })
    expect(out.fresh.find(c => c.id === 'meme')?.saved_why).toBe(note)
    expect(out.must_cover[0]).toEqual({ id: 'meme', what: 'Inspiration card "meme.jpg" you saved with your words', his_words: note, endorsed: null })
    // The style card and the one made into a piece are asks too (Krish, 2026-10-31), marked so each can be accounted.
    expect(out.must_cover.slice(1).map(m => [m.id, m.state])).toEqual([['style', 'style_only'], ['made', 'piece']])
  })

  // Migration 20261118093200 makes every said idea an inspiration card too; Sunday counts the content idea it landed in.
  it('a said idea counts once: its card gives way to the content idea already listed, unless he answered the card', () => {
    const IDEA = '22222222-2222-4333-8444-555555555555'
    const said = (id: string, extra: Record<string, any> = {}) => item(id, { folder: null, kind: 'idea',
      facets: { said: { excerpt: 'what agents cost a shop', landed_table: 'content_ideas', landed_id: IDEA } }, ...extra })
    const out = buildInspiration({ weekStart: WEEK, listedIdeas: [IDEA], items: [
      said('dup'),
      said('routed', { route: 'make_piece', routes: ['make_piece'], answered_at: '2026-10-24T08:00:00Z', answered_by: 'Krish' }),
      said('elsewhere', { facets: { said: { excerpt: 'x', landed_table: 'content_ideas', landed_id: '33333333-2222-4333-8444-555555555555' } } }),
    ] })
    const ids = [...out.fresh, ...out.routed].map(c => c.id)
    expect(ids).not.toContain('dup')
    expect(ids).toContain('routed')
    expect(ids).toContain('elsewhere')
    expect(buildInspiration({ weekStart: WEEK, items: [said('dup')] }).fresh.map(c => c.id)).toEqual(['dup'])
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
    // Both carry his typed words, so both are asks (Krish, 2026-10-31); the style card may be answered as style.
    expect(out.must_cover.map(m => [m.id, m.state, m.style_only])).toEqual([['liked', 'open', false], ['style', 'style_only', true]])
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

  it('a claim\'s quote is his words only while the answer it quotes stands', () => {
    const claim = (id: string, source: string) =>
      ({ id, kind: 'form', layer: 'opening', status: 'candidate', statement: 'Open on the hook', krish: 'an invented line', krish_source_id: source, support_n: 3 })
    const out = buildInspiration({ weekStart: WEEK, items: [], claims: [claim('kept', 'e-standing'), claim('taken-back', 'e-withdrawn')],
      quotesStanding: ['e-standing'] })
    expect(out.claims.map(c => [c.id, c.his_words])).toEqual([['kept', 'an invented line'], ['taken-back', null]])
    // With no list of standing rows, no quote is handed on.
    expect(buildInspiration({ weekStart: WEEK, items: [], claims: [claim('kept', 'e-standing')] }).claims[0]!.his_words).toBeNull()
  })

  // Krish, 2026-10-31: the Sunday run ignored his asks. Card a397253e carried his typed why and was dismissed on 26 Oct,
  // so it never reached the run; card 45e0ead0 was routed to study_style though his words named the topic.
  describe('asks: every card he typed words on', () => {
    const granny = item('a397253e', { name: 'granny benchmark', dismissed_at: '2026-10-26T09:00:00Z', answered_at: '2026-10-25T20:00:00Z',
      why_like: 'random headlines make boring ethics topics entertaining', why_like_source: 'typed', transcript: 'the granny benchmark asks',
      facets: { platform: 'x', link: { url: 'https://x.com/a/status/1' } } })
    const replaced = item('45e0ead0', { name: 'Anthropic just replaced Git', route: 'study_style', routes: ['study_style'],
      would_do: 'do this topic: what replacing Git means for a team', answered_at: '2026-10-28T08:00:00Z' })

    it('a dismissed ask is in asks and in must_cover, with his words verbatim', () => {
      const out = buildInspiration({ weekStart: '2026-11-02', items: [granny] })
      expect(out.fresh.map(c => c.id)).toEqual([])
      expect(out.asks).toEqual([expect.objectContaining({ id: 'a397253e', state: 'dismissed', dismissed: true, url: 'https://x.com/a/status/1',
        heard: 'the granny benchmark asks', his_words: { why_here: null, why_like: 'random headlines make boring ethics topics entertaining', would_do: null } })])
      expect(out.must_cover).toEqual([expect.objectContaining({ id: 'a397253e', ask: true, state: 'dismissed', style_only: false,
        his_words: 'random headlines make boring ethics topics entertaining' })])
    })

    it('a style-only ask is in must_cover flagged style_only, so it can be accounted as style used', () => {
      const out = buildInspiration({ weekStart: '2026-11-02', items: [replaced] })
      expect(out.study_style.map(c => c.id)).toEqual(['45e0ead0'])
      expect(out.asks.map(a => [a.id, a.state, a.style_only])).toEqual([['45e0ead0', 'style_only', true]])
      expect(out.must_cover).toEqual([expect.objectContaining({ id: '45e0ead0', ask: true, style_only: true, his_words: 'do this topic: what replacing Git means for a team' })])
    })

    it('asks rank newest words first, mark a card made into a piece, skip guesses and words older than 45 days', () => {
      const out = buildInspiration({ weekStart: '2026-11-02', items: [
        granny, replaced,
        item('made', { why_here: 'make this', piece_id: '11111111-2222-4333-8444-555555555555', created_at: '2026-10-20T09:00:00Z' }),
        item('guess', { why_like: 'a suggested why', why_like_source: 'picked', answered_at: '2026-10-29T09:00:00Z' }),
        item('old', { would_do: 'too old', answered_at: '2026-09-01T09:00:00Z', created_at: '2026-09-01T09:00:00Z' }),
      ] })
      expect(out.asks.map(a => [a.id, a.state])).toEqual([['45e0ead0', 'style_only'], ['a397253e', 'dismissed'], ['made', 'piece']])
      expect(out.must_cover.find(m => m.id === 'made')).toEqual(expect.objectContaining({ piece_id: '11111111-2222-4333-8444-555555555555' }))
      expect(out.counts.asks).toBe(3)
    })

    it('a routed card already owed keeps its one entry', () => {
      const out = buildInspiration({ weekStart: '2026-11-02', items: [item('r', { route: 'make_piece', routes: ['make_piece'], would_do: 'go', answered_at: '2026-10-28T08:00:00Z' })] })
      expect(out.must_cover.map(m => m.id)).toEqual(['r'])
      expect(out.asks.map(a => a.state)).toEqual(['routed'])
    })
  })

  it('recent pieces are the ones scheduled in the 21 days before the week, with the ids they covered', () => {
    const out = buildInspiration({ weekStart: '2026-11-02', items: [], recentPieces: [
      { id: 'p1', idea: 'Who pays', state: 'published', lane_slot: 'follow_the_money', scheduled_for: '2026-10-26', meta: { covers: { '2026-10-26': ['card-9'] } } },
      { id: 'p2', idea: 'Too old', state: 'published', scheduled_for: '2026-10-05', meta: {} },
      { id: 'p3', idea: 'This week', state: 'drafting', scheduled_for: '2026-11-02', meta: {} },
    ] })
    expect(out.recent).toEqual([{ id: 'p1', idea: 'Who pays', state: 'published', scheduled_for: '2026-10-26', series: 'follow_the_money', covers: ['card-9'] }])
  })
})
