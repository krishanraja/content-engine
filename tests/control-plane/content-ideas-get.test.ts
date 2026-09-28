import { beforeEach, describe, expect, it, vi } from 'vitest'

// An operator session can read a piece (walk log F32).
//
// On 2026-09-28 piece 1's walk could not read the body it was about to
// rewrite: content-ideas allowed only POST and PATCH on the operator bearer,
// and GET /fact-check returns the checklist without the text, so the session
// confirmed v10 with read-only SQL. GET /api/content-ideas?id= returns the
// row's id, state, lane_slot, idea, thesis, body and updated_at, and nothing
// else, behind the gate the route already has.

const db = vi.hoisted(() => ({ selected: [] as string[], filters: [] as Array<[string, unknown]>, row: null as Record<string, unknown> | null }))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    from() {
      const chain: Record<string, any> = {}
      chain.select = (cols: string) => { db.selected.push(cols); return chain }
      chain.eq = (col: string, val: unknown) => { db.filters.push([col, val]); return chain }
      chain.maybeSingle = async () => ({ data: db.row, error: null })
      return chain
    },
  },
}))

const TOKEN = 'eot_' + 'g'.repeat(40)
const ID = '6cb0d213-1aa6-44d3-8dc2-0b91d8dde4df'

async function get(query: Record<string, string>, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) {
  const { default: handler } = await import('../../apps/control-plane/api/content-ideas.js')
  const out = { status: 0, body: undefined as any }
  const res: Record<string, any> = {
    setHeader() { return res },
    status(code: number) { out.status = code; return res },
    json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  await handler({ method: 'GET', headers, query, body: {} } as never, res as never)
  return out
}

beforeEach(() => {
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
  db.selected.length = 0
  db.filters.length = 0
  db.row = null
})

describe('GET /api/content-ideas?id=', () => {
  it('returns the piece as it stands, exactly the named fields', async () => {
    db.row = { id: ID, state: 'review', lane_slot: 'follow_the_money', idea: 'Same agent, opposite answers', thesis: 'The contract is the tool.', body: 'The body, v10.', updated_at: '2026-09-28T19:24:25.645Z' }
    const r = await get({ id: ID })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, piece: db.row })
    expect(db.selected).toEqual(['id,state,lane_slot,idea,thesis,body,updated_at'])
    expect(db.filters).toEqual([['id', ID]])
  })

  it('a piece that is not there is a 404; an id that is not a uuid is a 400 before any read', async () => {
    expect((await get({ id: ID })).status).toBe(404)
    expect((await get({ id: "x' or 1=1" })).status).toBe(400)
    expect(db.selected).toHaveLength(1)
  })

  it('no credentials, no piece', async () => {
    db.row = { id: ID, body: 'secret draft' }
    const r = await get({ id: ID }, {})
    expect(r.status).toBe(401)
    expect(JSON.stringify(r.body)).not.toMatch(/secret draft/)
  })
})
