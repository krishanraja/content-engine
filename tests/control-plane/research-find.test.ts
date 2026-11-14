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
  added_at: '2026-11-14T10:00:00Z', rank: '0.099', snippet: '«Oracle» «bond» sale',
}

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
    expect(parseFindQuery({ q: 'oracle bonds' })).toEqual({ q: 'oracle bonds', limit: 10 })
    expect(parseFindQuery({ q: ['"data centre" -openai'], limit: '50' })).toEqual({ q: '"data centre" -openai', limit: 50 })
    for (const bad of [{}, { q: 'a' }, { q: 'x'.repeat(301) }, { q: 'ok ok', limit: '0' }, { q: 'ok ok', limit: '51' }, { q: 'ok ok', limit: 'ten' }]) {
      expect(parseFindQuery(bad)).toBeNull()
    }
  })

  it('asks research_find once, read only, and hands back each hit with its piece, version and snippet', async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
    const handler = createFindHandler(async () => ({ rpc: async (fn, args) => { calls.push({ fn, args }); return { data: [HIT], error: null } } }))
    const res = await call(handler, { q: 'oracle bonds', limit: '5' })
    expect(res.statusCode).toBe(200)
    expect(calls).toEqual([{ fn: 'research_find', args: { p_query: 'oracle bonds', p_limit: 5 } }])
    expect(res.body).toMatchObject({ ok: true, q: 'oracle bonds', count: 1 })
    expect(res.body.hits[0]).toMatchObject({ material_id: HIT.material_id, piece_title: HIT.piece_title, version: 2, bytes: 84, rank: 0.099 })
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('refuses without the engine key, a bad query or another method, and says so when the index is down', async () => {
    const handler = createFindHandler(async () => ({ rpc: async () => ({ data: null, error: { message: 'down' } }) }))
    expect((await call(handler, { q: 'oracle' }, false)).statusCode).toBe(401)
    expect((await call(handler, { q: 'o' })).body).toEqual({ ok: false, error: 'invalid_query' })
    expect((await call(handler, { q: 'oracle' }, true, 'POST')).statusCode).toBe(405)
    expect((await call(handler, { q: 'oracle' })).body).toEqual({ ok: false, error: 'research_index_unavailable' })
  })
})
