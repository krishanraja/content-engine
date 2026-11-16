import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { citesOf, hookNorm, primaryUrl, repeatOf, type RecentOut } from '../../apps/control-plane/api/board/_weekModel'
import { notesReport } from '../../apps/control-plane/api/board/_presses'
import { stillFiles, stillUrl } from '../../apps/control-plane/api/board/_style'

// The repeat check (contract 1.17.0; Ruling, Krish, 2026-11-16: "this week's Ideas Board needs to not contain mostly
// things we published last week"), on the real plans of the weeks of 9 and 16 Nov, where it went wrong: the Fri 20
// flagship retold Sat 14's live carousel, and Tue 17's "frenemies" retold Fri 13's "beststicker" from three of the same
// sources.

type Body = Record<string, unknown>
const plan = (week: string) => JSON.parse(readFileSync(`docs/plans/${week}-week/ideas.json`, 'utf8')) as { days: Record<string, Body[]>; offdays: Record<string, Body[]> }
const w9 = plan('2026-11-09'), w16 = plan('2026-11-16')
const option = (p: ReturnType<typeof plan>, group: 'days' | 'offdays', day: string, id: string) => p[group][day].find(o => String(o.id).startsWith(id))!

const out = (o: Body, extra: Partial<RecentOut>): RecentOut => ({ keys: [String(o.id)], kind: 'post', title: String(o.hook ?? o.id), url: primaryUrl(o),
  hook: hookNorm(o.hook), date: '2026-11-14', day: 'sat', stage: 'live', cites: citesOf(o), ...extra })

const recent: RecentOut[] = [
  out(option(w9, 'offdays', 'sat', 'oldproof'), { date: '2026-11-14', day: 'sat', stage: 'live' }),
  out(option(w9, 'offdays', 'thu', 'beststicker'), { date: '2026-11-17', day: 'tue', stage: 'scheduled' }),
  out(option(w9, 'days', 'fri', 'f3fcd5e1'), { kind: 'piece', keys: ['piece:f3fcd5e1-573e-4692-a413-db7c5823a10e'], date: '2026-11-13', day: 'fri', stage: 'live' }),
]
const own = (o: Body, date: string, supports: string | null = null) => ({ keys: [String(o.id)], date, url: primaryUrl(o), hook: hookNorm(o.hook), supports, cites: citesOf(o) })
const WEEK_END = '2026-11-22'

describe('an idea or item that retells what already went out', () => {
  it('Fri 20\'s flagship is the story Sat 14\'s carousel told: the same Axiom page', () => {
    const rep = repeatOf(own(option(w16, 'days', 'fri', 'c00cd4e0'), '2026-11-20'), recent, null)
    expect(rep).toMatchObject({ stage: 'live', date: '2026-11-14', kind: 'post' })
    expect(rep!.line).toBe('The same story went out on Sat 14 Nov: "AI found a mistake in a maths proof from 1986, its makers say".')
  })

  it('Tue 17\'s "frenemies" cites three of the sources of the post scheduled for that day', () => {
    const rep = repeatOf(own(option(w16, 'offdays', 'tue', 'frenemies'), '2026-11-17'), recent, WEEK_END)
    expect(rep).toMatchObject({ stage: 'scheduled', date: '2026-11-17' })
  })

  it('Tue 17\'s "burntokens" is Fri 13\'s piece again: the same Amazon page', () => {
    expect(repeatOf(own(option(w16, 'offdays', 'tue', 'burntokens'), '2026-11-17'), recent, WEEK_END)).toMatchObject({ kind: 'piece', date: '2026-11-13' })
  })

  it('a fresh story passes, a supporting carousel may share its own piece\'s page, and nothing matches itself', () => {
    const fresh = { keys: ['x'], date: '2026-11-19', url: 'example.com/new', hook: hookNorm('A brand new thing happened today'), supports: null, cites: { urls: ['example.com/new'], parts: [] } }
    expect(repeatOf(fresh, recent, WEEK_END)).toBeNull()
    const piece = recent[2]
    const support = { keys: ['carousel'], date: '2026-11-14', url: piece.url, hook: null, supports: 'fri', cites: { urls: [], parts: [] } }
    expect(repeatOf(support, [{ ...piece, date: '2026-11-13' }], null)).toBeNull()
    expect(repeatOf({ ...own(option(w9, 'offdays', 'sat', 'oldproof'), '2026-11-14'), keys: ['oldproof'] }, recent, null)).toBeNull()
  })

  it('looks back 14 days, and an item only matches what came before it', () => {
    const fri = own(option(w16, 'days', 'fri', 'c00cd4e0'), '2026-12-05')
    expect(repeatOf(fri, recent, null)).toBeNull()
    expect(repeatOf(own(option(w16, 'days', 'fri', 'c00cd4e0'), '2026-11-13'), recent, null)).toBeNull()
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
  const samples = { stills: { motion: { 'swiss-kinetic-type': '/api/board/sign-offs?file=abcdefghijklmnopqrstuvwx' }, captions: { pop: '' }, treatment: { 'face-with-proof': 'https://evil.example/x.jpg' } },
    stills_drive: { motion: { 'swiss-kinetic-type': 'abcdefghijklmnopqrstuvwx' }, captions: { pop: 'zzzzzzzzzzzzzzzzzzzzzzzz' }, treatment: { 'face-with-proof': 'yyyyyyyyyyyyyyyyyyyyyyyy' } } }
  it('is a path on this site or nothing, and only a shown still\'s Drive file is served', () => {
    expect(stillUrl('motion', 'swiss-kinetic-type', samples)).toBe('/api/board/sign-offs?file=abcdefghijklmnopqrstuvwx')
    expect(stillUrl('captions', 'pop', samples)).toBeNull()
    expect(stillUrl('treatment', 'face-with-proof', samples)).toBeNull()
    expect([...stillFiles(samples)]).toEqual(['abcdefghijklmnopqrstuvwx'])
  })
})
