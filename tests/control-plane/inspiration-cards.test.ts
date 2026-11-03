import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rankCandidates, usesByCard } from '../../apps/control-plane/api/inspiration/_cards.js'

// The inspiration board drives the cut (Wave 3, docs/handovers/2026-11-03-engine-audit.md). Krish, 2026-11-03: "I'm
// also still a bit disappointed with how poorly the inspiration board is used right now."

type Row = Record<string, any>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as Array<[string, string, any]>, missing: new Set<string>() }))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  function query(table: string) {
    const rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'update' | 'upsert' = 'select'
    let payload: any = {}
    let cols = ''
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
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') { hit.forEach(r => Object.assign(r, payload)); db.writes.push([table, 'update', { ...payload, n: hit.length }]); return { data: hit, error: null } }
      return { data: hit, error: null }
    }
    const chain: Record<string, any> = {
      select(c = '') { if (op === 'select') cols = c; return chain },
      update(p: Row) { op = 'update'; payload = p; return chain },
      upsert(p: Row[]) { op = 'upsert'; payload = p; return chain },
      eq(k: string, v: unknown) { filters.push(r => r[k] === v); return chain },
      in(k: string, vs: unknown[]) { filters.push(r => vs.includes(r[k])); return chain },
      is(k: string, v: unknown) { filters.push(r => (r[k] ?? null) === v); return chain },
      order() { return chain },
      limit() { return chain },
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
