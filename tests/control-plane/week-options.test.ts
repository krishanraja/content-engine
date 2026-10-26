import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isMonday, keepThroughWeek, mergeCovers, parseOptions } from '../../apps/control-plane/api/_weekOptions.js'

// The week's options (Krish, 2026-10-11): the Sunday session writes the
// researched options for each publishing day onto the pieces; Control
// Center's week page reads them live until he picks.

type Row = Record<string, any>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as Array<[string, Row]> }))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  // A column, or a JSON path the way PostgREST reads one ("meta->week_option->>series").
  const read = (r: Row, k: string) => k.split(/->>?/).reduce<any>((v, part) => (v == null ? undefined : v[part]), r)
  function query(table: string) {
    const rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'update' = 'select'
    let payload: Row = {}
    const run = () => {
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') { hit.forEach(r => Object.assign(r, payload)); db.writes.push([table, { ...payload, ids: hit.map(h => h.id) }]); return { data: hit, error: null } }
      return { data: hit, error: null }
    }
    const chain: Record<string, any> = {
      select() { return chain },
      update(p: Row) { op = 'update'; payload = p; return chain },
      eq(k: string, v: unknown) { filters.push(r => read(r, k) === v); return chain },
      in(k: string, vs: unknown[]) { filters.push(r => vs.includes(read(r, k))); return chain },
      is(k: string, v: unknown) { filters.push(r => (read(r, k) ?? null) === v); return chain },
      gte(k: string, v: string) { filters.push(r => String(read(r, k) ?? '') >= v); return chain },
      lte(k: string, v: string) { filters.push(r => read(r, k) != null && String(read(r, k)) <= v); return chain },
      limit() { return chain },
      async maybeSingle() { const r = run(); return { data: (r.data as Row[])[0] ?? null, error: null } },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) { try { return Promise.resolve(run()).then(resolve, reject) } catch (e) { return reject(e) } },
    }
    return chain
  }
  return { supabase: { from: (t: string) => query(t) } }
})

const TOKEN = 'eot_' + 'k'.repeat(40)
const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const C = '00000000-0000-4000-8000-00000000000c'
const OLD = '00000000-0000-4000-8000-0000000000dd'
const PUB = '00000000-0000-4000-8000-0000000000ee'
const NEXT = '00000000-0000-4000-8000-0000000000ff'

async function call(method: 'GET' | 'POST', body: Row = {}, query: Row = {}) {
  const { default: handler } = await import('../../apps/control-plane/api/week/options.js')
  const out = { status: 0, body: undefined as any }
  const res: Record<string, any> = { setHeader() { return res }, status(c: number) { out.status = c; return res }, json(b: unknown) { out.body = b; if (!out.status) out.status = 200; return res }, end() { return res } }
  await handler({ method, headers: { authorization: `Bearer ${TOKEN}` }, query, body } as never, res as never)
  return out
}

beforeEach(() => {
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  db.tables = {
    venture_formats: [
      { slug: 'follow_the_money', label: 'follow.the.money', cadence_label: 'Mondays', mandate: 'Where the money goes.', venture_slug: 'publication', kind: 'subchannel', active: true },
      { slug: 'general', label: 'general', cadence_label: 'No cadence', mandate: '', venture_slug: 'publication', kind: 'any', active: true },
    ],
    content_ideas: [
      { id: A, idea: 'AI music: who gets paid', state: 'seeded', lane_slot: 'follow_the_money', meta: { ladder: { final: { score: 7, band: 'ready' } } }, expires_at: '2026-10-12T14:00:00+00:00', updated_at: '2026-10-10T00:00:00Z', buried_at: null, library_at: null },
      { id: B, idea: 'Lease bill', state: 'drafting', lane_slot: 'follow_the_money', meta: {}, updated_at: '2026-10-10T00:00:00Z', buried_at: null, library_at: null },
      { id: C, idea: 'No series yet', state: 'seeded', lane_slot: null, meta: {}, expires_at: null, updated_at: '2026-10-10T00:00:00Z', buried_at: null, library_at: null },
      { id: OLD, idea: 'Offered before', state: 'seeded', lane_slot: 'follow_the_money', meta: { week_option: { week_start: '2026-10-12', series: 'follow_the_money', rank: 1 } }, updated_at: '2026-10-10T00:00:00Z', buried_at: null, library_at: null },
      { id: PUB, idea: 'Monday, posted on Substack', state: 'published', lane_slot: 'follow_the_money', scheduled_for: '2026-10-12', meta: {}, updated_at: '2026-10-12T15:00:00Z', buried_at: null, library_at: null },
      { id: NEXT, idea: 'Next week', state: 'drafting', lane_slot: 'follow_the_money', scheduled_for: '2026-10-19', meta: {}, updated_at: '2026-10-12T15:00:00Z', buried_at: null, library_at: null },
    ],
  }
  db.writes = []
})

describe("the Sunday session's own finds", () => {
  it('are stored under a source type the capture route accepts, never as one of Krish\'s drop-ins', async () => {
    const { readFileSync } = await import('node:fs')
    const { ALLOWED_SOURCE } = await import('../../apps/control-plane/api/content-ideas.js')
    const skill = readFileSync('.agents/skills/plan-week/SKILL.md', 'utf8')
    const types = [...skill.matchAll(/"source_type": "([a-z_]+)"/g)].map(m => m[1])
    expect(types.length).toBeGreaterThan(0)
    for (const t of types) {
      expect(ALLOWED_SOURCE.has(t), t).toBe(true)
      expect(t).not.toBe('manual')
    }
  })
})

describe('the week options', () => {
  it('reads a Monday only, and refuses a bad option with its reason', () => {
    expect(isMonday('2026-10-12')).toBe(true)
    expect(isMonday('2026-10-11')).toBe(false)
    const { problems } = parseOptions({ week_start: '2026-10-11', series: 'x', options: [{ id: 'nope', rank: 1, pitch: 'p', why_now: 'w' }, { id: A, rank: 1, pitch: '', why_now: 'w' }] })
    expect(problems).toEqual(['week_start must be the Monday the week starts on, YYYY-MM-DD', 'option id "nope" is not a piece id', `option ${A} needs a pitch of up to 700 characters`])
    expect(parseOptions({ week_start: '2026-10-12', series: 's', options: [{ id: A, rank: 1, pitch: 'p', why_now: 'w', recommended: true }, { id: B, rank: 2, pitch: 'p', why_now: 'w', recommended: true }] }).problems).toEqual(['recommend one option at most'])
  })

  it("writes each day's options onto the rows, gives a seriesless row the day's series, and clears what the day no longer offers", async () => {
    const out = await call('POST', { week_start: '2026-10-12', series: 'follow_the_money', options: [
      { id: A, rank: 1, pitch: 'The labels sued; now they take a cut.', why_now: 'Second suit filed 18 Sep 2026.', recommended: true },
      { id: C, rank: 2, pitch: 'Another angle.', why_now: 'News on 8 Oct 2026.' },
    ] })
    expect(out.status).toBe(200)
    expect(out.body).toMatchObject({ written: [A, C], cleared: [OLD] })
    const rows = Object.fromEntries(db.tables.content_ideas.map(r => [r.id, r]))
    expect(rows[A].meta.week_option).toMatchObject({ week_start: '2026-10-12', series: 'follow_the_money', rank: 1, recommended: true, by: 'Claude Code' })
    expect(rows[A].meta.ladder).toBeTruthy()
    expect(rows[C].lane_slot).toBe('follow_the_money')
    expect(rows[A].lane_slot).toBe('follow_the_money')
    expect(rows[OLD].meta.week_option).toBeUndefined()
    // The Monday purge would have deleted A at 14:00 on the day it was offered for.
    expect(rows[A].expires_at).toBe('2026-10-19T14:00:00.000Z')
    expect(rows[C].expires_at).toBeNull()
  })

  it('keeps on the piece the cards and words its option answers, for good, and refuses a bad covers list', async () => {
    const CARD = '00000000-0000-4000-8000-0000000000c1'
    expect(parseOptions({ week_start: '2026-10-12', series: 's', options: [{ id: A, rank: 1, pitch: 'p', why_now: 'w', covers: ['bad id!'] }] }).problems)
      .toEqual([`option ${A} covers must be a list of up to 20 must_cover ids`])
    const out = await call('POST', { week_start: '2026-10-12', series: 'follow_the_money', options: [
      { id: A, rank: 1, pitch: 'p', why_now: 'w', covers: [CARD, 'said-1', CARD] },
    ] })
    expect(out.status).toBe(200)
    const rowA = () => db.tables.content_ideas.find(r => r.id === A)!
    expect(rowA().meta.covers).toEqual({ '2026-10-12': [CARD, 'said-1'] })
    // Offered again without covers, or cleared from a later day, the piece still says which card it answers.
    await call('POST', { week_start: '2026-10-12', series: 'follow_the_money', options: [{ id: A, rank: 1, pitch: 'p', why_now: 'w' }] })
    expect(rowA().meta.covers).toEqual({ '2026-10-12': [CARD, 'said-1'] })
    await call('POST', { week_start: '2026-10-12', series: 'follow_the_money', options: [{ id: C, rank: 1, pitch: 'p', why_now: 'w' }] })
    expect(rowA().meta.week_option).toBeUndefined()
    expect(rowA().meta.covers).toEqual({ '2026-10-12': [CARD, 'said-1'] })
    expect(mergeCovers(undefined, '2026-10-12', undefined)).toBeNull()
    // Another week's covers sit beside, never mixed in; a malformed key is dropped.
    expect(mergeCovers({ '2026-10-12': [CARD], 'nope': ['x'] }, '2026-10-19', ['said-2'])).toEqual({ '2026-10-12': [CARD], '2026-10-19': ['said-2'] })
  })

  it('keeps an option alive through its week, and never shortens a later expiry', () => {
    expect(keepThroughWeek('2026-10-12T14:00:00Z', '2026-10-12')).toBe('2026-10-19T14:00:00.000Z')
    expect(keepThroughWeek('2026-10-25T10:00:00Z', '2026-10-12')).toBeNull()
    expect(keepThroughWeek(null, '2026-10-12')).toBeNull()
    expect(keepThroughWeek('2026-10-12T14:00:00Z', '2026-10-13')).toBeNull()
  })

  it('refuses a series that does not publish and a piece that is not live', async () => {
    expect((await call('POST', { week_start: '2026-10-12', series: 'general', options: [] })).body.error).toBe('series_not_live')
    db.tables.content_ideas[0]!.state = 'published'
    const out = await call('POST', { week_start: '2026-10-12', series: 'follow_the_money', options: [{ id: A, rank: 1, pitch: 'p', why_now: 'w' }] })
    expect(out.status).toBe(409)
    expect(out.body.problems).toEqual([`${A} is published`])
  })

  it('GET hands the session the mandate, the options, what is in flight and the judges best', async () => {
    const out = await call('GET', {}, { week_start: '2026-10-12' })
    expect(out.status).toBe(200)
    const ftm = out.body.series.find((s: Row) => s.slug === 'follow_the_money')
    expect(ftm.mandate).toBe('Where the money goes.')
    expect(ftm.options.map((o: Row) => o.id)).toEqual([OLD])
    expect(ftm.in_flight.map((o: Row) => o.id)).toEqual([B, NEXT])
    expect(ftm.judged_best.map((o: Row) => o.id)).toEqual([A])
    expect(out.body.series.find((s: Row) => s.slug === 'general')).toBeUndefined()
    expect((await call('GET', {}, { week_start: '2026-10-13' })).status).toBe(400)
  })

  it('GET names the piece each day of the week holds, published included, so a day posted on Substack still holds its piece', async () => {
    // The publish watcher marks a piece published once its Substack post is
    // live; Krish still posts YouTube, Shorts, TikTok and Instagram from the
    // week's board, whose ticks are copied onto that piece.
    const out = await call('GET', {}, { week_start: '2026-10-12' })
    const ftm = out.body.series.find((s: Row) => s.slug === 'follow_the_money')
    expect(ftm.in_flight.map((o: Row) => o.id)).not.toContain(PUB)
    expect(ftm.scheduled).toEqual([{ id: PUB, idea: 'Monday, posted on Substack', state: 'published', scheduled_for: '2026-10-12' }])
    const next = (await call('GET', {}, { week_start: '2026-10-19' })).body.series.find((s: Row) => s.slug === 'follow_the_money')
    expect(next.scheduled.map((o: Row) => o.id)).toEqual([NEXT])
  })
})
