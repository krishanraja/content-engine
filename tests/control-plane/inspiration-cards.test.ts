import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rankCandidates, usesByCard } from '../../apps/control-plane/api/inspiration/_cards.js'

// The inspiration board drives the cut (Wave 3, docs/handovers/2026-11-03-engine-audit.md). Krish, 2026-11-03: "I'm
// also still a bit disappointed with how poorly the inspiration board is used right now."

type Row = Record<string, any>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as Array<[string, string, any]>, missing: new Set<string>() }))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  // A column, or a JSON path the way PostgREST reads one ("facets->style").
  const read = (r: Row, k: string) => k.split(/->>?/).reduce<any>((v, part) => (v == null ? undefined : v[part]), r)
  // PostgREST's or(): "a.not.is.null,b.eq.x".
  const orOf = (expr: string) => (r: Row) => expr.split(',').some(term => {
    const m = /^(.+?)\.(not\.is\.null|eq\.(.*))$/.exec(term)
    if (!m) throw new Error(`mock or(): ${term}`)
    return m[2] === 'not.is.null' ? read(r, m[1]) != null : String(read(r, m[1])) === m[3]
  })
  function query(table: string) {
    const rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'update' | 'upsert' = 'select'
    let payload: any = {}
    let cols = ''
    let order: [string, boolean] | null = null
    let cap = Infinity
    const run = () => {
      if (db.missing.has(table)) return { data: null, error: { message: `relation "public.${table}" does not exist` } }
      if (table === 'inspiration_items' && db.missing.has('teaches') && /teaches/.test(cols)) return { data: null, error: { message: 'column inspiration_items.teaches does not exist' } }
      if (op === 'upsert') {
        const list = payload as Row[]
        for (const p of list) {
          const held = rows().find(r => r.card_id === p.card_id && r.spec_path === p.spec_path && r.cut === p.cut && r.role === p.role)
          if (held) Object.assign(held, p)
          else rows().push({ id: `use-${rows().length + 1}`, published: false, krish_verdict: null, ...p })
        }
        db.writes.push([table, 'upsert', list])
        return { data: list, error: null }
      }
      let hit = rows().filter(r => filters.every(f => f(r)))
      if (order) { const [k, asc] = order; hit = [...hit].sort((a, b) => String(read(a, k) ?? '').localeCompare(String(read(b, k) ?? '')) * (asc ? 1 : -1)) }
      if (op === 'select') hit = hit.slice(0, cap)
      if (op === 'update') { hit.forEach(r => Object.assign(r, payload)); db.writes.push([table, 'update', { ...payload, n: hit.length }]); return { data: hit, error: null } }
      return { data: hit, error: null }
    }
    const chain: Record<string, any> = {
      select(c = '') { if (op === 'select') cols = c; return chain },
      update(p: Row) { op = 'update'; payload = p; return chain },
      upsert(p: Row[]) { op = 'upsert'; payload = p; return chain },
      eq(k: string, v: unknown) { filters.push(r => read(r, k) === v); return chain },
      in(k: string, vs: unknown[]) { filters.push(r => vs.includes(read(r, k))); return chain },
      is(k: string, v: unknown) { filters.push(r => (read(r, k) ?? null) === v); return chain },
      not(k: string, o: string, v: unknown) { if (o !== 'is' || v !== null) throw new Error('mock not()'); filters.push(r => read(r, k) != null); return chain },
      or(expr: string) { filters.push(orOf(expr)); return chain },
      order(k: string, o: { ascending?: boolean } = {}) { order = [k, o.ascending !== false]; return chain },
      limit(n: number) { cap = n; return chain },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) { try { return Promise.resolve(run()).then(resolve, reject) } catch (e) { return reject(e) } },
    }
    return chain
  }
  return { supabase: { from: (t: string) => query(t) } }
})

const TOKEN = 'eot_' + 'i'.repeat(40)
const JACK = '0b9e7d24-5a61-4f3c-8e2d-1c4a6b8d0e21'
const GEORGIA = '6f1c0a52-3b7e-4c1d-9a8e-0d2f4b6a8c10'
const GONE = '11111111-2222-4333-8444-555555555555'
const IDEAS = '22222222-3333-4444-8555-666666666666'
const NEW = '33333333-4444-4555-8666-777777777777'
const PIECE = '7083d6ad-419e-4fdc-9aba-f3be7f3f3a23'

function card(id: string, over: Row = {}): Row {
  return { id, name: `instagram_${id.slice(0, 8)}.mp4`, drive_file_id: `drive_${id.slice(0, 8)}_aaaaaaaaaaaa`, lane: 'production', kind: 'video', dismissed_at: null,
    why_here: null, why_like: null, why_like_source: null, would_do: null, route: null, routes: [], picked_likes: [], answered_at: null,
    facets: {}, drive_created_at: '2026-10-01T00:00:00Z', teaches: [], teaches_source: null, ...over }
}

async function call(route: 'cards' | 'candidates' | 'uses', method: 'GET' | 'POST', query: Row = {}, body: Row = {}, auth = true) {
  const routes = {
    cards: () => import('../../apps/control-plane/api/inspiration/cards.js'),
    candidates: () => import('../../apps/control-plane/api/inspiration/candidates.js'),
    uses: () => import('../../apps/control-plane/api/inspiration/uses.js'),
  }
  const { default: handler } = await routes[route]()
  const out = { status: 0, body: undefined as any }
  const res: Record<string, any> = { setHeader() { return res }, status(c: number) { out.status = c; return res }, json(b: unknown) { out.body = b; if (!out.status) out.status = 200; return res }, end() { return res } }
  await handler({ method, headers: auth ? { authorization: `Bearer ${TOKEN}` } : {}, query, body } as never, res as never)
  return out
}

beforeEach(() => {
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  db.missing = new Set()
  db.writes = []
  db.tables = {
    inspiration_items: [
      card(JACK, { name: 'instagram_DeZuQ7-lATg.mp4', teaches: ['look', 'motion'], teaches_source: 'krish', answered_at: '2026-10-20T00:00:00Z', routes: ['study_style'], why_like: 'the product cards', why_like_source: 'typed' }),
      card(GEORGIA, { name: 'instagram_DePHDr_jRed.mp4', teaches: ['captions'], teaches_source: 'engine_guess', drive_created_at: '2026-10-05T00:00:00Z' }),
      card(GONE, { dismissed_at: '2026-10-21T00:00:00Z', teaches: ['look'], teaches_source: 'krish' }),
      card(IDEAS, { lane: 'strategy', teaches: ['look'], teaches_source: 'krish' }),
      card(NEW, { drive_created_at: '2026-10-30T00:00:00Z' }),
    ],
    card_uses: [{ id: 'u1', card_id: JACK, piece_id: PIECE, spec_path: 'docs/plans/x/ve/spec.json', cut: 'short', role: 'look', critic_score: 9, published: false, krish_verdict: null }],
    content_ideas: [],
  }
})

describe('GET /api/inspiration/cards', () => {
  it('answers each card by id with its label, Drive id, answers, teaches and uses, and names the unknown', async () => {
    const out = await call('cards', 'GET', { ids: `${JACK},${GONE},${IDEAS},99999999-9999-4999-8999-999999999999` })
    expect(out.status).toBe(200)
    const [jack, gone, ideas] = out.body.cards
    expect(jack).toMatchObject({ id: JACK, label: 'instagram_DeZuQ7-lATg', drive_id: 'drive_0b9e7d24_aaaaaaaaaaaa', lane: 'production', kind: 'video', problem: null,
      kept: 2, teaches: ['look', 'motion'], teaches_source: 'krish', answers: { why_like: 'the product cards', routes: ['study_style'] } })
    expect(jack.uses).toEqual([expect.objectContaining({ cut: 'short', role: 'look', critic_score: 9, published: false })])
    expect(gone.problem).toBe('dismissed')
    expect(ideas.problem).toBe('not_production_lane')
    expect(out.body.unknown).toEqual(['99999999-9999-4999-8999-999999999999'])
  })

  it('refuses an id that is no uuid, no ids, and a caller without the engine key', async () => {
    expect((await call('cards', 'GET', { ids: 'instagram_DePHDr_jRed' })).body.error).toBe('bad_ids')
    expect((await call('cards', 'GET', {})).body.error).toBe('ids_required')
    expect((await call('cards', 'GET', { ids: JACK }, {}, false)).status).toBe(401)
    expect((await call('cards', 'POST', { ids: JACK })).status).toBe(405)
  })

  it('still answers before the teaches migration runs, and says so', async () => {
    db.missing = new Set(['teaches', 'card_uses'])
    const out = await call('cards', 'GET', { ids: JACK })
    expect(out.status).toBe(200)
    expect(out.body.migration_pending).toBe(true)
    expect(out.body.cards[0]).toMatchObject({ id: JACK, uses: [] })
  })
})

describe('GET /api/inspiration/candidates', () => {
  it('offers production cards that teach the role first, his word before the guess, never a dismissed or strategy card', async () => {
    const look = await call('candidates', 'GET', { role: 'look', limit: '3' })
    expect(look.status).toBe(200)
    expect(look.body.candidates.map((c: Row) => c.id)).toEqual([JACK, NEW, GEORGIA])
    const captions = await call('candidates', 'GET', { role: 'captions', limit: '1' })
    expect(captions.body.candidates.map((c: Row) => c.id)).toEqual([GEORGIA])
    expect(captions.body.candidates[0].why[0]).toBe('the engine guesses it teaches captions')
  })

  it('refuses an unknown role and a limit out of range', async () => {
    expect((await call('candidates', 'GET', { role: 'vibe' })).body.error).toBe('bad_role')
    expect((await call('candidates', 'GET', { role: 'look', limit: '50' })).body.error).toBe('bad_limit')
  })

  it('ranks kept, then the asked format, then never used, then newest', () => {
    const rows = [
      card('a0000000-0000-4000-8000-000000000001', { drive_created_at: '2026-10-03T00:00:00Z' }),
      card('a0000000-0000-4000-8000-000000000002', { drive_created_at: '2026-10-02T00:00:00Z', facets: { format: 'reel' } }),
      card('a0000000-0000-4000-8000-000000000003', { drive_created_at: '2026-10-04T00:00:00Z' }),
      card('a0000000-0000-4000-8000-000000000004', { drive_created_at: '2026-09-01T00:00:00Z', answered_at: '2026-10-01T00:00:00Z', picked_likes: ['pace'] }),
    ]
    const uses = usesByCard([{ card_id: 'a0000000-0000-4000-8000-000000000003', piece_id: null, spec_path: 's', cut: '', role: 'motion', critic_score: null, published: false, krish_verdict: null }])
    const order = rankCandidates(rows, uses, { role: 'motion', format: 'reel', limit: 4 }).map(c => c.id.slice(-1))
    expect(order).toEqual(['4', '2', '1', '3'])
  })
})

// Krish, 2026-11-17: "If I put actual feedback in the inspiration board as to why I like something, that is not really a
// guess is it?" The engine's read of a card (inspirationhouse tag-v4) grounded in his own words is his steer.
describe('the engine read of a card steers the candidates', () => {
  const read = (over: Row = {}) => ({ origin: 'engine_read', grounded_in: [], captions: [], motion: [], transitions: [], camera: [],
    energy: null, script_formats: [], production_formats: [], series: null, teaches: [], ...over })
  const id = (n: number) => `c0000000-0000-4000-8000-00000000000${n}`

  it('ranks his word, then a read grounded in his words, then a bare guess, and shows the read', () => {
    const rows = [
      card(id(1), { teaches: ['captions'], teaches_source: 'engine_guess', drive_created_at: '2026-11-10T00:00:00Z', facets: { style: read({ teaches: ['captions'], captions: ['kinetic_pop'] }) } }),
      card(id(2), { teaches: ['captions'], teaches_source: 'engine_guess', drive_created_at: '2026-10-01T00:00:00Z', why_like: 'the captions bounce on the beat', why_like_source: 'typed',
        facets: { grounded_in: ['why_like'], style: read({ grounded_in: ['why_like', 'not_a_field'], teaches: ['captions'], captions: ['beat_bounce', 'bad id!'], motion: ['kinetic_type'], energy: 'high' }) } }),
      card(id(3), { teaches: ['captions'], teaches_source: 'krish', drive_created_at: '2026-09-01T00:00:00Z' }),
    ]
    const out = rankCandidates(rows, new Map(), { role: 'captions', limit: 3 })
    expect(out.map(c => c.id)).toEqual([id(3), id(2), id(1)])
    expect(out[1].why[0]).toBe('the engine read it from his own words (why_like): it teaches captions')
    expect(out[2].why[0]).toBe('the engine guesses it teaches captions')
    expect(out[1].grounded_in).toEqual(['why_like'])
    expect(out[1].style).toMatchObject({ origin: 'engine_read', grounded: true, captions: ['beat_bounce'], motion: ['kinetic_type'], energy: 'high' })
    expect(out[2].style).toMatchObject({ grounded: false, grounded_in: [] })
    expect(out[0].style).toBeNull()
  })

  it('offers his thumbnail study first for a thumbnail, and a loose card before a reference set for anything else', () => {
    const set = { collection: { name: 'VEED Studio - Instagram Thumbnail Study', path: 'Production Inspo/VEED Studio - Instagram Thumbnail Study' } }
    const rows = [
      card(id(1), { kind: 'image', drive_created_at: '2026-11-12T00:00:00Z', facets: { ...set, style: read({ teaches: ['thumbnail', 'look'] }) } }),
      card(id(2), { kind: 'image', drive_created_at: '2026-11-01T00:00:00Z', facets: { style: read({ teaches: ['look'] }) } }),
      card(id(3), { kind: 'image', drive_created_at: '2026-11-11T00:00:00Z', facets: { ...set } }),
    ]
    const thumb = rankCandidates(rows, new Map(), { role: 'thumbnail', limit: 3 })
    expect(thumb.map(c => c.id)).toEqual([id(1), id(3), id(2)])
    expect(thumb[0].why).toContain('from his reference set "VEED Studio - Instagram Thumbnail Study"')
    expect(thumb[0].collection).toEqual(set.collection)
    expect(rankCandidates(rows, new Map(), { role: 'look', limit: 3 }).map(c => c.id)).toEqual([id(2), id(1), id(3)])
  })

  it('reads the window by value: a bulk drop never pushes out a card with his words or a read on it', async () => {
    const bulk = Array.from({ length: 520 }, (_, n) => card(`d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      { kind: 'image', drive_created_at: '2026-11-15T00:00:00Z', facets: { collection: { name: 'A bulk drop', path: null } } }))
    const worded = card(id(7), { drive_created_at: '2026-08-01T00:00:00Z', why_like: 'the hand-drawn arrows', why_like_source: 'typed', answered_at: '2026-08-02T00:00:00Z' })
    const readOnly = card(id(8), { drive_created_at: '2026-08-01T00:00:00Z', facets: { style: read({ grounded_in: ['why_here'], teaches: ['motion'], motion: ['kinetic_type'] }) }, why_here: 'this pace' })
    db.tables.inspiration_items = [...bulk, worded, readOnly]
    const motion = await call('candidates', 'GET', { role: 'motion', limit: '2' })
    expect(motion.status).toBe(200)
    expect(motion.body.candidates.map((c: Row) => c.id)).toEqual([id(8), id(7)])
    expect(motion.body.candidates[0].style.motion).toEqual(['kinetic_type'])
  })

  it('takes a thumbnail role and records a thumbnail use', async () => {
    expect((await call('candidates', 'GET', { role: 'thumbnail' })).status).toBe(200)
    const out = await call('uses', 'POST', {}, { uses: [{ card_id: JACK, piece_id: PIECE, spec_path: 'docs/plans/x/ve/spec.json', cut: 'wide', role: 'thumbnail', critic_score: 8 }] })
    expect(out.status).toBe(200)
  })
})

describe('POST /api/inspiration/uses', () => {
  const use = (over: Row = {}) => ({ card_id: GEORGIA, piece_id: PIECE, spec_path: 'docs/plans/x/ve/spec.json', cut: 'short', role: 'captions', critic_score: 8.5, ...over })

  it('records one use per card, spec, cut and role, and a second verdict replaces the score', async () => {
    const first = await call('uses', 'POST', {}, { uses: [use(), use({ card_id: JACK, role: 'look', critic_score: 9.5 })] })
    expect(first.status).toBe(200)
    expect(first.body.written).toBe(2)
    expect(db.tables.card_uses).toHaveLength(2)
    expect(db.tables.card_uses.find(u => u.card_id === JACK)).toMatchObject({ critic_score: 9.5, published: false })
    await call('uses', 'POST', {}, { uses: [use({ critic_score: 6 })] })
    expect(db.tables.card_uses.filter(u => u.card_id === GEORGIA)).toEqual([expect.objectContaining({ critic_score: 6 })])
  })

  it('refuses a dismissed, strategy or unknown card and writes nothing', async () => {
    const out = await call('uses', 'POST', {}, { uses: [use({ card_id: GONE }), use({ card_id: IDEAS }), use({ card_id: '99999999-9999-4999-8999-999999999999' })] })
    expect(out.status).toBe(409)
    expect(out.body.problems).toHaveLength(3)
    expect(db.writes).toEqual([])
  })

  it('refuses a malformed use', async () => {
    const out = await call('uses', 'POST', {}, { uses: [use({ role: 'vibe', critic_score: 12, card_id: 'instagram_x' })] })
    expect(out.status).toBe(400)
    expect(out.body.problems).toHaveLength(3)
  })
})

describe('a posted channel publishes the cards the piece used', () => {
  it('markPublished sets published on every unpublished use of the piece', async () => {
    const { markPublished } = await import('../../apps/control-plane/api/inspiration/_cards.js')
    const { supabase } = await import('../../apps/control-plane/api/_supabase.js')
    db.tables.card_uses.push({ id: 'u2', card_id: GEORGIA, piece_id: 'other', published: false })
    expect(await markPublished(supabase, PIECE, '2026-11-09T12:00:00Z')).toBeNull()
    expect(db.tables.card_uses.map(u => [u.id, u.published])).toEqual([['u1', true], ['u2', false]])
  })
})
