import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The work board in the database (Krish, 2026-10-03: "I need the boards to not
// be Claude pages, but accessible by Codex too and workable using Codex too").
// One route serves Control Center (Krish's cookie) and every agent session
// (the engine key). Only Krish's cookie may write a reply.

type Row = Record<string, any>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as Array<[string, string]> }))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  function query(table: string) {
    let rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let order: [string, boolean] | null = null
    let limit = Infinity
    let op: 'select' | 'insert' | 'update' = 'select'
    let payload: Row = {}
    let inserted: Row | null = null
    const run = () => {
      if (op === 'insert') {
        inserted = { id: payload.id ?? `00000000-0000-4000-8000-${String(rows().length + 1).padStart(12, '0')}`, seen_at: null, ...payload }
        rows().push(inserted)
        db.writes.push([table, 'insert'])
        return { data: [inserted], error: null }
      }
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') {
        hit.forEach(r => Object.assign(r, payload))
        db.writes.push([table, 'update'])
        return { data: hit, error: null }
      }
      let out = [...hit]
      if (order) { const [k, asc] = order; out.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1)) }
      return { data: out.slice(0, limit), error: null }
    }
    const chain: Record<string, any> = {
      select() { return chain },
      insert(row: Row) { op = 'insert'; payload = row; return chain },
      update(patch: Row) { op = 'update'; payload = patch; return chain },
      eq(k: string, v: unknown) { filters.push(r => r[k] === v); return chain },
      in(k: string, vs: unknown[]) { filters.push(r => vs.includes(r[k])); return chain },
      is(k: string, v: unknown) { filters.push(r => (r[k] ?? null) === v); return chain },
      order(k: string, o?: { ascending?: boolean }) { order = [k, o?.ascending !== false]; return chain },
      limit(n: number) { limit = n; return chain },
      async maybeSingle() { const r = run(); return { data: r.data[0] ?? null, error: null } },
      async single() { const r = run(); return { data: (r.data as Row[])[0], error: null } },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) { try { return Promise.resolve(run()).then(resolve, reject) } catch (e) { return reject(e) } },
    }
    return chain
  }
  return { supabase: { from: (t: string) => query(t) } }
})

const TOKEN = 'eot_' + 'w'.repeat(40)
const CODE = 'board-test-access-code'
const COOKIE = `cc_access=${createHash('sha256').update(CODE).digest('hex')}`

async function call(method: 'GET' | 'POST', body: Row = {}, who: 'agent' | 'krish' = 'agent') {
  const { default: handler } = await import('../../apps/control-plane/api/workbench.js')
  const headers: Record<string, string> = who === 'agent' ? { authorization: `Bearer ${TOKEN}` } : { cookie: COOKIE }
  const out = { status: 0, body: undefined as any }
  const res: Record<string, any> = {
    setHeader() { return res },
    status(code: number) { out.status = code; return res },
    json(b: unknown) { out.body = b; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  await handler({ method, headers, query: {}, body } as never, res as never)
  return out
}

beforeEach(() => {
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  process.env.ACCESS_CODE = CODE
  db.tables = { work_board_state: [{ id: 'board', headline: '', signals: [], updated_by: 'agent', updated_at: '2026-10-03T00:00:00Z' }], work_board_items: [], work_board_replies: [] }
  db.writes = []
})

describe('the work board route', () => {
  it('refuses anyone without the cookie or the engine key', async () => {
    const { default: handler } = await import('../../apps/control-plane/api/workbench.js')
    const out = { status: 0 }
    const res: Record<string, any> = { setHeader() { return res }, status(c: number) { out.status = c; return res }, json() { return res }, end() { return res } }
    await handler({ method: 'GET', headers: {}, query: {}, body: {} } as never, res as never)
    expect(out.status).toBe(401)
  })

  it('an agent adds items and sets the headline; Control Center reads the same board', async () => {
    const add = await call('POST', { action: 'upsert_items', client: 'codex', items: [
      { id: 'p1-video', lane: 'on_you', rank: 1, area: 'Article 1', title: 'Say yes to the video', detail: 'Five things to confirm.', prompt: 'yes, make the video' },
      { id: 'next-picks', lane: 'in_progress', rank: 2, title: 'Your next two articles' },
    ] })
    expect(add.status).toBe(200)
    expect(add.body.written).toEqual(['p1-video', 'next-picks'])
    expect(db.tables.work_board_items[0].updated_by).toBe('codex')
    const head = await call('POST', { action: 'set_state', headline: 'Two things need you.', signals: [{ label: 'Home computer', state: 'ok', text: 'On' }] })
    expect(head.status).toBe(200)
    const board = await call('GET', {}, 'krish')
    expect(board.status).toBe(200)
    expect(board.body.state.headline).toBe('Two things need you.')
    expect(board.body.items.map((i: Row) => i.id)).toEqual(['p1-video', 'next-picks'])
  })

  it('an existing item is changed in place, only the fields sent', async () => {
    await call('POST', { action: 'upsert_items', items: [{ id: 'p3', lane: 'on_you', title: 'Read article 3', detail: 'Facts checked.' }] })
    const move = await call('POST', { action: 'upsert_items', items: [{ id: 'p3', lane: 'done' }] })
    expect(move.status).toBe(200)
    const row = db.tables.work_board_items.find(r => r.id === 'p3')!
    expect(row.lane).toBe('done')
    expect(row.title).toBe('Read article 3')
    expect(row.detail).toBe('Facts checked.')
  })

  it('a new item needs a lane and a title, and one bad item writes nothing', async () => {
    const bad = await call('POST', { action: 'upsert_items', items: [{ id: 'ok-one', lane: 'on_you', title: 'Fine' }, { id: 'no-title', lane: 'on_you' }] })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('title_required')
    expect(db.tables.work_board_items).toHaveLength(0)
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'Bad Id', lane: 'on_you', title: 'x' }] })).body.error).toBe('item_id_invalid')
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'x1', lane: 'someday', title: 'x' }] })).body.error).toBe('lane_invalid')
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'x2', lane: 'on_you', title: 'x', link: 'http://plain' }] })).body.error).toBe('link_must_be_https')
  })

  it('only Krish, from his cookie, can write a reply; an agent cannot speak for him', async () => {
    await call('POST', { action: 'upsert_items', items: [{ id: 'p1-video', lane: 'on_you', title: 'Say yes to the video' }] })
    const agent = await call('POST', { action: 'reply', item_id: 'p1-video', text: 'yes, make the video', decided_by: 'Krish' })
    expect(agent.status).toBe(403)
    expect(agent.body.error).toBe('a_reply_is_krish_words')
    expect(db.tables.work_board_replies).toHaveLength(0)
    const krish = await call('POST', { action: 'reply', item_id: 'p1-video', text: 'yes, make the video' }, 'krish')
    expect(krish.status).toBe(200)
    expect(db.tables.work_board_replies[0]).toMatchObject({ item_id: 'p1-video', text: 'yes, make the video', by: 'Krish' })
    expect((await call('POST', { action: 'reply', item_id: 'nope', text: 'x' }, 'krish')).status).toBe(404)
  })

  it('an agent marks replies seen, and the board counts what is still unseen', async () => {
    await call('POST', { action: 'upsert_items', items: [{ id: 'p3', lane: 'on_you', title: 'Read article 3' }] })
    await call('POST', { action: 'reply', item_id: 'p3', text: 'Approved' }, 'krish')
    let board = await call('GET')
    expect(board.body.unseen_replies).toBe(1)
    const id = board.body.replies[0].id
    const seen = await call('POST', { action: 'mark_seen', ids: [id], client: 'codex' })
    expect(seen.status).toBe(200)
    board = await call('GET')
    expect(board.body.unseen_replies).toBe(0)
    expect(db.tables.work_board_replies[0].seen_by).toBe('codex')
  })

  it('archived items leave the board; done shows the most recent', async () => {
    await call('POST', { action: 'upsert_items', items: [
      { id: 'old', lane: 'archived', title: 'Old' },
      { id: 'fin', lane: 'done', title: 'Finished' },
    ] })
    const board = await call('GET')
    expect(board.body.items.map((i: Row) => i.id)).toEqual(['fin'])
  })

  it('signals are checked', async () => {
    expect((await call('POST', { action: 'set_state', signals: [{ label: 'x', state: 'purple' }] })).body.error).toBe('signal_state_invalid')
    expect((await call('POST', { action: 'set_state', signals: 'nope' })).body.error).toBe('signals_must_be_a_list')
  })
})
