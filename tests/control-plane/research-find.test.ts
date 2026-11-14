import { describe, expect, it } from 'vitest'

// GET /api/research-library/find (I-16): research the store already holds, found before a session pays for more.
// The search itself is research_find (migration 20261202090000_research_find.sql); the database is a fixture here.

const ENGINE = 'eot_' + 'f'.repeat(40)
process.env.ENGINE_OPERATOR_TOKEN = ENGINE
process.env.SUPABASE_URL = 'https://store.example'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'

const { createFindHandler, parseFindQuery } = await import('../../apps/control-plane/api/research-library/find.js')

const HIT = {
  material_id: '22222222-2222-4222-8222-222222222222', scope: '11111111-1111-4111-8111-111111111111',
  piece_id: '11111111-1111-4111-8111-111111111111', piece_title: 'Oracle files to sell $20B of bonds', week: '2026-11-16', day: 'mon',
  kind: 'research', role: null, title: 'Oracle debt research', version: 2, sha256: 'a'.repeat(64), bytes: '84',
  added_at: '2026-11-14T10:00:00Z', rank: '0.099', snippet: '«Oracle» «bond» sale', venture: null, fresh: true,
}
const NONE = { since: null, kinds: null, fresh: null, venture: null }
type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
const db = (find: () => { data: unknown; error: { message?: string } | null }, size: unknown = 412, calls: Array<{ fn: string; args: Record<string, unknown> }> = []) =>
  ({ rpc: (async (fn, args) => { calls.push({ fn, args }); return fn === 'research_shelf_size' ? { data: size, error: null } : find() }) as Rpc })

function call(handler: ReturnType<typeof createFindHandler>, query: Record<string, unknown>, auth = true, method = 'GET') {
  const res: any = { statusCode: 200, headers: {} as Record<string, string>, body: undefined as any }
  res.status = (code: number) => { res.statusCode = code; return res }
  res.json = (body: unknown) => { res.body = body; return res }
  res.setHeader = (k: string, v: string) => { res.headers[k] = v }
  res.end = () => res
  const req: any = { method, query, headers: auth ? { authorization: `Bearer ${ENGINE}` } : {} }
  return Promise.resolve(handler(req, res)).then(() => res)
}

describe('finding research the store already holds', () => {
  it('takes plain words or web-search forms, within bounds', () => {
    expect(parseFindQuery({ q: 'oracle bonds' })).toEqual({ q: 'oracle bonds', limit: 10, ...NONE })
    expect(parseFindQuery({ q: ['"data centre" -openai'], limit: '50' })).toEqual({ q: '"data centre" -openai', limit: 50, ...NONE })
    for (const bad of [{}, { q: 'a' }, { q: 'x'.repeat(301) }, { q: 'ok ok', limit: '0' }, { q: 'ok ok', limit: '51' }, { q: 'ok ok', limit: 'ten' }]) {
      expect(parseFindQuery(bad)).toBeNull()
    }
  })

  it('asks research_find and the shelf size once each, read only, and hands back each hit with its piece, version and snippet', async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
    const handler = createFindHandler(async () => db(() => ({ data: [HIT], error: null }), 412, calls))
    const res = await call(handler, { q: 'oracle bonds', limit: '5' })
    expect(res.statusCode).toBe(200)
    expect(calls).toEqual([
      { fn: 'research_find', args: { p_query: 'oracle bonds', p_limit: 5, p_since: null, p_kinds: null, p_fresh: null, p_venture: null } },
      { fn: 'research_shelf_size', args: { p_venture: null } },
    ])
    expect(res.body).toMatchObject({ ok: true, q: 'oracle bonds', venture: 'publication', shelf_size: 412, count: 1 })
    expect(res.body.searched).toEqual({ since: null, kinds: null, fresh: null, fresh_days: 90 })
    expect(res.body.hits[0]).toMatchObject({ material_id: HIT.material_id, piece_title: HIT.piece_title, version: 2, bytes: 84, rank: 0.099, fresh: true, venture: null })
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('takes since, kinds, fresh and a venture shelf (D3, I-30), and refuses a bad one', async () => {
    expect(parseFindQuery({ q: 'oracle', since: '2026-11-01', kinds: 'research, corpus,research', fresh: '1', venture: 'Mindmake' }))
      .toEqual({ q: 'oracle', limit: 10, since: '2026-11-01', kinds: ['research', 'corpus'], fresh: true, venture: 'mindmake' })
    expect(parseFindQuery({ q: 'oracle', fresh: 'false', venture: 'publication' })).toMatchObject({ fresh: false, venture: null })
    for (const bad of [{ since: '2026-02-30' }, { since: 'yesterday' }, { kinds: 'research,video' }, { kinds: ',' }, { fresh: 'maybe' }, { venture: 'Mind Make' }]) {
      expect(parseFindQuery({ q: 'oracle', ...bad })).toBeNull()
    }
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
    const handler = createFindHandler(async () => db(() => ({ data: [], error: null }), 0, calls))
    const res = await call(handler, { q: 'buyers', venture: 'mindmake', kinds: 'research', since: '2026-11-01', fresh: '1' })
    expect(calls[0].args).toEqual({ p_query: 'buyers', p_limit: 10, p_since: '2026-11-01', p_kinds: ['research'], p_fresh: true, p_venture: 'mindmake' })
    expect(calls[1].args).toEqual({ p_venture: 'mindmake' })
    // An empty shelf says so: 0 of 0, not 0 of 412.
    expect(res.body).toMatchObject({ ok: true, venture: 'mindmake', shelf_size: 0, count: 0, hits: [] })
  })

  it('refuses without the engine key, a bad query or another method, and says so when the index is down', async () => {
    const handler = createFindHandler(async () => db(() => ({ data: null, error: { message: 'down' } })))
    expect((await call(handler, { q: 'oracle' }, false)).statusCode).toBe(401)
    expect((await call(handler, { q: 'o' })).body).toEqual({ ok: false, error: 'invalid_query' })
    expect((await call(handler, { q: 'oracle' }, true, 'POST')).statusCode).toBe(405)
    expect((await call(handler, { q: 'oracle' })).body).toEqual({ ok: false, error: 'research_index_unavailable' })
    // A shelf size that cannot be read fails the answer too: an unreadable library is never an empty one.
    const noSize = createFindHandler(async () => ({ rpc: (async (fn: string) => fn === 'research_shelf_size' ? { data: null, error: { message: 'down' } } : { data: [], error: null }) as Rpc }))
    expect((await call(noSize, { q: 'oracle' })).statusCode).toBe(503)
  })

  it('still answers an unfiltered search before the filters migration is applied, with the shelf size unknown', async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
    const old = { rpc: (async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      if (fn === 'research_find' && 'p_since' in args) return { data: null, error: { message: 'function research_find(...) does not exist' } }
      if (fn === 'research_shelf_size') return { data: null, error: { message: 'does not exist' } }
      return { data: [{ ...HIT, venture: undefined, fresh: undefined, added_at: new Date().toISOString() }], error: null }
    }) as Rpc }
    const res = await call(createFindHandler(async () => old), { q: 'oracle' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, venture: 'publication', shelf_size: null, count: 1 })
    expect(res.body.hits[0]).toMatchObject({ fresh: true, venture: null })
    expect(calls.at(-1)).toEqual({ fn: 'research_find', args: { p_query: 'oracle', p_limit: 10 } })
    // A filtered search never falls back: it cannot honour the filter, so it says the index is unavailable.
    expect((await call(createFindHandler(async () => old), { q: 'oracle', kinds: 'research' })).statusCode).toBe(503)
  })
})
