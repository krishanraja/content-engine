import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { citesOf, hookNorm, primaryUrl, recentOutOf, repeatOf, type RecentOut } from '../../apps/control-plane/api/board/_weekModel'
import type { OffdayItem } from '../../apps/control-plane/api/board/_offdayItems'
import { notesReport } from '../../apps/control-plane/api/board/_presses'
import { stillFiles, stillUrl } from '../../apps/control-plane/api/board/_style'

// The repeat check (contract 1.17.0; Ruling, Krish, 2026-11-16: "this week's Ideas Board needs to not contain mostly
// things we published last week"), on the real plans of the weeks of 9 and 16 Nov, where it went wrong: the Fri 20
// flagship retold Sat 14's live carousel, and Tue 17's "frenemies" retold Fri 13's "beststicker" from three of the same
// sources.

type Body = Record<string, unknown>
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as { days: Record<string, Body[]>; offdays: Record<string, Body[]> }
const plan = (week: string) => read(`docs/plans/${week}-week/ideas.json`)
// The week of 16 Nov as it stood when this went wrong (frozen 16 Nov): the live plan moves on as its ideas are made
// again, and a later run took frenemies and fuelgauge off it, so the test reads the plan it was written against.
const w9 = plan('2026-11-09'), w16 = read('tests/fixtures/plans/2026-11-16-ideas.json')
const option = (p: ReturnType<typeof plan>, group: 'days' | 'offdays', day: string, id: string) => p[group][day].find(o => String(o.id).startsWith(id))!

// What earlier boards put out, through the real shapes: off-day item rows (offday_items) and piece rows (content_ideas).
const item = (o: Body, extra: Partial<OffdayItem>): OffdayItem => ({ item: `item-${o.id}`, source: 'engine', origin_week: '2026-11-09', option_id: String(o.id), option: o,
  state: 'approved', week: '2026-11-09', day: 'sat', date: '2026-11-14', doc: `off-sat-${o.id}`, piece_id: null, drive_folder: null, posts: [], followed: {}, version: 1,
  placed_by: 'krish', placed_at: '2026-11-08T00:00:00Z', ...extra })
const live = [{ state: 'live', channel: 'instagram', at: '2026-11-14T09:00:00Z' }] as unknown as OffdayItem['posts']
const items: OffdayItem[] = [
  item(option(w9, 'offdays', 'sat', 'oldproof'), { posts: live }),
  item(option(w9, 'offdays', 'thu', 'beststicker'), { week: '2026-11-16', day: 'tue', date: '2026-11-17', doc: 'off-thu-beststicker', posts: [{ state: 'scheduled', channel: 'x', at: '2026-11-17T08:30:00Z' }] as unknown as OffdayItem['posts'] }),
  item(option(w9, 'offdays', 'sat', 'goodnews'), { doc: 'off-sat-goodnews', posts: live }),
  // This week's own board is never its own repeat.
  item(option(w16, 'offdays', 'tue', 'fuelgauge'), { origin_week: '2026-11-16', week: '2026-11-16', day: 'tue', date: '2026-11-17', doc: 'off-tue-fuelgauge' }),
]
const fri13 = option(w9, 'days', 'fri', 'f3fcd5e1')
const pieces = [{ id: 'f3fcd5e1-573e-4692-a413-db7c5823a10e', idea: 'Meta staff were ranked by AI use. They gamed it.', scheduled_for: '2026-11-13', state: 'published', buried_at: null,
  source_url: (fri13.source as Body).url, canonical_url: null }]
const m = { week: '2026-11-16', ideas: w16 as unknown as Body, plans: { '2026-11-09': w9 as unknown as Body }, pieces: [] }
const recent: RecentOut[] = recentOutOf(m, [], items, pieces)
const own = (o: Body, date: string, extra: Body = {}) => ({ keys: [`2026-11-16:off-x-${o.id}`], week: '2026-11-16', date, url: primaryUrl(o), hook: hookNorm(o.hook), cites: citesOf(o), ...extra })

describe('an idea or item that retells what an earlier board put out', () => {
  it('reads only earlier boards: this week\'s own items are left out', () => {
    expect(recent.map(r => r.week)).toEqual(['2026-11-09', '2026-11-09', '2026-11-09', '2026-11-09'])
    expect(recent.find(r => r.kind === 'piece')).toMatchObject({ stage: 'live', week: '2026-11-09', day: 'fri' })
  })

  it('Fri 20\'s flagship is the story Sat 14\'s carousel told: the same Axiom page, and the line says what matched', () => {
    const rep = repeatOf(own(option(w16, 'days', 'fri', 'c00cd4e0'), '2026-11-20'), recent)
    expect(rep).toMatchObject({ stage: 'live', date: '2026-11-14', kind: 'post' })
    expect(rep!.line).toBe('Same source as "AI found a mistake in a maths proof from 1986, its makers say", which went out on Sat 14 Nov.')
  })

  it('Tue 17\'s "frenemies" shares three sources with the post an earlier board scheduled for that day', () => {
    expect(repeatOf(own(option(w16, 'offdays', 'tue', 'frenemies'), '2026-11-17'), recent)).toMatchObject({ stage: 'scheduled', date: '2026-11-17', line: expect.stringMatching(/^Shares 3 sources with /) })
  })

  it('Tue 17\'s "burntokens" is Fri 13\'s piece again: the same Amazon page', () => {
    expect(repeatOf(own(option(w16, 'offdays', 'tue', 'burntokens'), '2026-11-17'), recent)).toMatchObject({ kind: 'piece', date: '2026-11-13' })
  })

  it('an off-day option tied to this week\'s own piece is never a repeat of it (Thu 19\'s "fortytoone" and Tue 17\'s election piece)', () => {
    expect(repeatOf(own(option(w16, 'offdays', 'thu', 'fortytoone'), '2026-11-19'), recent)).toBeNull()
  })

  it('the weekly good news has the same hook every week by design, and is never a repeat by its hook alone', () => {
    expect(repeatOf(own(option(w16, 'offdays', 'sat', 'goodnews'), '2026-11-21', { recurring: true }), recent)).toBeNull()
    expect(recent.find(r => r.keys.includes('item-goodnews'))?.recurring).toBe(true)
    // The same hook on anything else is a repeat.
    const hooked = recent.map(r => (r.keys.includes('item-goodnews') ? { ...r, recurring: false } : r))
    expect(repeatOf(own(option(w16, 'offdays', 'sat', 'goodnews'), '2026-11-21'), hooked)).toMatchObject({ line: expect.stringMatching(/^Same hook as /) })
  })

  it('an item carried into this week is never its own repeat, and a fresh story passes', () => {
    const best = option(w9, 'offdays', 'thu', 'beststicker')
    expect(repeatOf({ ...own(best, '2026-11-17'), keys: ['2026-11-16:off-tue-beststicker', 'item-beststicker'] }, recent)).toBeNull()
    expect(repeatOf({ keys: ['x'], week: '2026-11-16', date: '2026-11-19', url: 'example.com/new', hook: hookNorm('A brand new thing happened today'), cites: { urls: ['example.com/new'], parts: [] } }, recent)).toBeNull()
  })

  it('looks back 14 days only', () => {
    expect(repeatOf({ ...own(option(w16, 'days', 'fri', 'c00cd4e0'), '2026-12-05'), week: '2026-11-30' }, recent)).toBeNull()
  })

  it('reads every cited source: links anywhere in the source, and named sources one per part', () => {
    const c = citesOf({ source: { label: 'GeekWire, 30 Mar 2026 (Microsoft Critique); NeurIPS 2024 study on AI judges; x', url: 'https://www.geekwire.com/a/?utm_source=t' } })
    expect(c.urls).toEqual(['https://geekwire.com/a'])
    expect(c.parts).toEqual(['geekwire 30 mar 2026 microsoft critique', 'neurips 2024 study on ai judges'])
    expect(hookNorm('Too short')).toBeNull()
  })
})

describe('his notes for Claude', () => {
  it('are filed to his taste ledger as his words, where and when he typed them, and nothing else is', () => {
    const body = { text: 'I want a different angle for the story.', use: 'claude_notes', piece_id: 'c00cd4e0-e1bb-4c60-b36f-cea92897e38c', title: 'The Great Recount', at: '2026-11-16T09:00:00.000Z', anchor: 'desk:fri:story', thread_id: 'x' }
    const r = notesReport('2026-11-16', 'desk-fri-story-1', body, '2026-11-16T09:00:01.000Z')!
    expect(r).toMatchObject({ kind: 'krish_words', body: 'I want a different angle for the story.', said_at: '2026-11-16T09:00:00.000Z', subject_ref: 'piece:c00cd4e0-e1bb-4c60-b36f-cea92897e38c' })
    expect(r.said_where).toContain('his notes for Claude')
    expect(notesReport('2026-11-16', 'a', { ...body, use: undefined }, 'now')).toBeNull()
    expect(notesReport('2026-11-16', 'a', { ...body, text: '  ' }, 'now')).toBeNull()
  })
})

describe('a style\'s still (1.17.0)', () => {
  const samples = { stills: { motion: { 'swiss-kinetic-type': '/api/board/sign-offs?file=abcdefghijklmnopqrstuvwx' }, captions: { pop: '/\\evil.example/x.jpg' }, treatment: { 'face-with-proof': 'https://evil.example/x.jpg' } },
    stills_drive: { motion: { 'swiss-kinetic-type': 'abcdefghijklmnopqrstuvwx' }, captions: { pop: 'zzzzzzzzzzzzzzzzzzzzzzzz' }, treatment: { 'face-with-proof': 'yyyyyyyyyyyyyyyyyyyyyyyy' } } }
  it('is a path on this site or nothing, and only a shown still\'s Drive file is served', () => {
    expect(stillUrl('motion', 'swiss-kinetic-type', samples)).toBe('/api/board/sign-offs?file=abcdefghijklmnopqrstuvwx')
    expect(stillUrl('captions', 'pop', samples)).toBeNull()
    expect(stillUrl('treatment', 'face-with-proof', samples)).toBeNull()
    expect([...stillFiles(samples)]).toEqual(['abcdefghijklmnopqrstuvwx'])
  })
})
