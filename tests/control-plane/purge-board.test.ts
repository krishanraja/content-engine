import { beforeEach, describe, expect, it, vi } from 'vitest'

// The Monday purge deletes rows that expired unused. A board item about such
// a row would have its idea_id emptied by the delete (on delete set null),
// and an open item that closes on a piece's step must name its piece
// (work_board_items_open_says_how_it_ends), so the purge keeps any row an
// open item names (kept_for_board) and closes no board item: Control
// Center's done-check sweep ends each by its kind (step 4).

type Row = Record<string, any>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as Array<[string, string, Row]> }))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  function query(table: string) {
    const rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'update' | 'insert' | 'delete' = 'select'
    let payload: Row = {}
    let limit = Infinity
    const run = () => {
      if (op === 'insert') { rows().push({ ...payload }); db.writes.push([table, 'insert', payload]); return { data: [payload], error: null, count: 1 } }
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') { hit.forEach(r => Object.assign(r, payload)); db.writes.push([table, 'update', { ...payload, ids: hit.map(h => h.id) }]); return { data: hit, error: null, count: hit.length } }
      if (op === 'delete') { db.tables[table] = rows().filter(r => !hit.includes(r)); db.writes.push([table, 'delete', { ids: hit.map(h => h.id) }]); return { data: null, error: null, count: hit.length } }
      return { data: hit.slice(0, limit), error: null, count: hit.length }
    }
    // The purge's own filters on content_ideas (expiry, state, day) are not
    // under test here: every row in the stand-in table has expired unused.
    const chain: Record<string, any> = {
      select() { return chain },
      insert(row: Row) { op = 'insert'; payload = row; return chain },
      update(patch: Row) { op = 'update'; payload = patch; return chain },
      delete() { op = 'delete'; return chain },
      eq(k: string, v: unknown) { if (table !== 'content_ideas') filters.push(r => r[k] === v); return chain },
      in(k: string, vs: unknown[]) { filters.push(r => vs.includes(r[k])); return chain },
      is() { return chain },
      not(k: string, how: string, v: unknown) {
        if (how === 'is' && v === null && table === 'work_board_items') filters.push(r => r[k] != null)
        if (how === 'in' && k === 'id') { const out = String(v).replace(/[()]/g, '').split(','); filters.push(r => !out.includes(r[k])) }
        return chain
      },
      lte() { return chain },
      lt() { return chain },
      neq() { return chain },
      or() { return chain },
      order() { return chain },
      limit(n: number) { limit = n; return chain },
      async maybeSingle() { const r = run(); return { data: (r.data as Row[] | null)?.[0] ?? null, error: null } },
      async single() { const r = run(); return { data: (r.data as Row[] | null)?.[0] ?? null, error: null } },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) { try { return Promise.resolve(run()).then(resolve, reject) } catch (e) { return reject(e) } },
    }
    return chain
  }
  return { supabase: { from: (t: string) => query(t) } }
})

vi.mock('../../apps/control-plane/api/purge/_archive.js', () => ({
  exportBeforeDelete: async (_week: string, rows: unknown[]) => ({ ok: true, key: 'purge/test.json', rows: rows.length }),
}))
vi.mock('../../apps/control-plane/api/_observations.js', () => ({
  recordObservations: async (rows: unknown[]) => ({ ok: true, written: rows.length }),
}))

const CRON = 'cron-secret-for-tests'
const GONE = '11111111-1111-4111-8111-111111111111'
const KEPT = '22222222-2222-4222-8222-222222222222'
const NAMED = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  process.env.CRON_SECRET = CRON
  db.tables = {
    content_ideas: [
      { id: GONE, idea: 'An option nobody picked', state: 'seed', expires_at: '2026-10-01T00:00:00Z' },
      { id: NAMED, idea: 'An option an open item still names', state: 'seed', expires_at: '2026-10-01T00:00:00Z' },
    ],
    work_board_items: [
      { id: 'about-named', lane: 'on_you', idea_id: NAMED, only_you: 'judgment', link: 'https://controlcenter.krishraja.com/#/week', closes_on: 'workroom' },
      { id: 'agent-named', lane: 'in_progress', idea_id: NAMED, closes_on: 'draft' },
      { id: 'closed-gone', lane: 'done', idea_id: GONE, updated_by: 'Krish', closed_by: 'Krish' },
      { id: 'about-kept', lane: 'on_you', idea_id: KEPT, only_you: 'face', link: 'https://web.descript.com/x', closes_on: 'record' },
      { id: 'no-piece', lane: 'in_progress', idea_id: null, closes_on: 'session' },
    ],
    weekly_briefs: [],
    content_decisions: [],
    audit_log: [],
    content_engine_runs: [],
  }
  db.writes = []
})

describe('the purge and the board', () => {
  it('keeps every row an open board item names, deletes the rest, and closes no board item', async () => {
    const { default: handler } = await import('../../apps/control-plane/api/purge/run.js')
    const out = { status: 0, body: undefined as any }
    const res: Record<string, any> = {
      setHeader() { return res },
      status(code: number) { out.status = code; return res },
      json(b: unknown) { out.body = b; if (!out.status) out.status = 200; return res },
      end() { return res },
    }
    await handler({ method: 'GET', headers: { authorization: `Bearer ${CRON}` }, query: {}, body: {} } as never, res as never)
    // Counted like everything else the purge touches, in its response and its audit row.
    expect(out.body).toMatchObject({ ok: true, expired: 1, kept_for_board: [NAMED] })
    expect(out.body.board_items_archived).toBeUndefined()
    expect(db.tables.audit_log[0].details).toMatchObject({ kept_for_board: [NAMED] })
    expect(db.tables.content_ideas.map(r => r.id)).toEqual([NAMED])
    // A done item about a deleted row keeps its close; nothing on the board was written.
    expect(db.writes.filter(([table]) => table === 'work_board_items')).toEqual([])
    expect(db.tables.work_board_items.map(r => [r.id, r.lane])).toEqual([
      ['about-named', 'on_you'], ['agent-named', 'in_progress'], ['closed-gone', 'done'], ['about-kept', 'on_you'], ['no-piece', 'in_progress'],
    ])
  })
})
