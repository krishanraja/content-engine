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

// Krish, 2026-10-11: one list of what waits on him, with Clear, Bump and Purge
// on every item. An item says why only he can do it (only_you), his Bump hides
// it until his next day (bumped_until), and the week's planning item closes
// when every day has a piece (closes_on 'week_planned').
describe('the fields for his one list', () => {
  it('cleanItem takes only_you, bumped_until and week_planned, and refuses bad ones', async () => {
    const { cleanItem, ONLY_YOU } = await import('../../apps/control-plane/api/workbench.js')
    expect([...ONLY_YOU]).toEqual(['send', 'post', 'spend', 'delete', 'permission', 'credential', 'face', 'login', 'judgment'])
    for (const only of ONLY_YOU) expect(cleanItem({ id: 'a1', only_you: only }, false)).toEqual({ id: 'a1', only_you: only })
    expect(cleanItem({ id: 'a1', only_you: null }, false)).toEqual({ id: 'a1', only_you: null })
    expect(() => cleanItem({ id: 'a1', only_you: 'whenever' }, false)).toThrow('only_you_invalid')
    expect(() => cleanItem({ id: 'a1', only_you: 'Face' }, false)).toThrow('only_you_invalid')

    expect(cleanItem({ id: 'a1', bumped_until: '2026-10-13T04:00:00Z' }, false)).toEqual({ id: 'a1', bumped_until: '2026-10-13T04:00:00.000Z' })
    expect(cleanItem({ id: 'a1', bumped_until: '2026-11-02T00:00:00-05:00' }, false)).toEqual({ id: 'a1', bumped_until: '2026-11-02T05:00:00.000Z' })
    expect(cleanItem({ id: 'a1', bumped_until: null }, false)).toEqual({ id: 'a1', bumped_until: null })
    for (const bad of ['tomorrow', '2026-10-13', '2026-10-13T04:00:00', '2026-13-40T99:00:00Z', 42, '']) {
      expect(() => cleanItem({ id: 'a1', bumped_until: bad }, false)).toThrow('bumped_until_invalid')
    }

    expect(cleanItem({ id: 'week-2026-10-12', closes_on: 'week_planned' }, false)).toEqual({ id: 'week-2026-10-12', closes_on: 'week_planned' })
    expect(() => cleanItem({ id: 'a1', closes_on: 'week_done' }, false)).toThrow('closes_on_invalid')
    // Fields not sent are left alone.
    expect(cleanItem({ id: 'a1', lane: 'done' }, false)).toEqual({ id: 'a1', lane: 'done' })
  })

  it('the route writes them and the board returns them', async () => {
    const add = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [
      { id: 'monday-record', lane: 'on_you', title: 'Record both cuts', only_you: 'face', closes_on: 'record' },
      { id: 'week-2026-10-12', lane: 'on_you', title: 'Pick this week', only_you: 'judgment', closes_on: 'week_planned' },
    ] })
    expect(add.status).toBe(200)
    const bump = await call('POST', { action: 'upsert_items', items: [{ id: 'monday-record', bumped_until: '2026-10-13T04:00:00Z' }] }, 'krish')
    expect(bump.status).toBe(200)
    const board = await call('GET', {}, 'krish')
    expect(board.body.items.find((i: Row) => i.id === 'monday-record')).toMatchObject({ only_you: 'face', bumped_until: '2026-10-13T04:00:00.000Z', updated_by: 'Krish' })
    expect(board.body.items.find((i: Row) => i.id === 'week-2026-10-12')).toMatchObject({ only_you: 'judgment', closes_on: 'week_planned' })
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'monday-record', only_you: 'nobody' }] })).body.error).toBe('only_you_invalid')
  })
})

describe('an item Krish closed stays closed to agents', () => {
  async function closedByKrish(lane: 'done' | 'archived') {
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-launch', lane: 'on_you', title: 'Swap the cover' }] })
    const close = await call('POST', { action: 'upsert_items', items: [{ id: 'you-launch', lane }] }, 'krish')
    expect(close.status).toBe(200)
    expect(db.tables.work_board_items[0]).toMatchObject({ lane, updated_by: 'Krish' })
  }

  it('an agent that moves it back out of done or archived is refused with 409, and nothing is written', async () => {
    for (const lane of ['done', 'archived'] as const) {
      db.tables.work_board_items = []
      await closedByKrish(lane)
      for (const back of ['on_you', 'in_progress']) {
        const writes = db.writes.length
        const out = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'fresh-one', lane: 'on_you', title: 'New' }, { id: 'you-launch', lane: back }] })
        expect(out.status).toBe(409)
        expect(out.body).toMatchObject({ ok: false, error: 'krish_closed_it', item: 'you-launch' })
        expect(db.writes.length).toBe(writes)
        expect(db.tables.work_board_items.map(r => r.id)).toEqual(['you-launch'])
        expect(db.tables.work_board_items[0]).toMatchObject({ lane, updated_by: 'Krish' })
      }
    }
  })

  it('a relayed decision is still an agent write', async () => {
    await closedByKrish('done')
    const out = await call('POST', { action: 'upsert_items', decided_by: 'Krish', items: [{ id: 'you-launch', lane: 'on_you' }] })
    expect(out.status).toBe(409)
    expect(out.body.error).toBe('krish_closed_it')
  })

  it('his own Undo, from his cookie, reopens it', async () => {
    await closedByKrish('done')
    const undo = await call('POST', { action: 'upsert_items', items: [{ id: 'you-launch', lane: 'on_you' }] }, 'krish')
    expect(undo.status).toBe(200)
    expect(db.tables.work_board_items[0]).toMatchObject({ lane: 'on_you', updated_by: 'Krish' })
  })

  it('an agent may still edit it in place, or move it from done to archived', async () => {
    await closedByKrish('done')
    const edit = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-launch', detail: 'Swapped on Monday.' }] })
    expect(edit.status).toBe(200)
    expect(db.tables.work_board_items[0]).toMatchObject({ lane: 'done', detail: 'Swapped on Monday.' })
    // The edit made codex the last writer; put Krish back to test the move.
    db.tables.work_board_items[0].updated_by = 'Krish'
    const archive = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-launch', lane: 'archived' }] })
    expect(archive.status).toBe(200)
    expect(db.tables.work_board_items[0].lane).toBe('archived')
  })

  it('an item an agent or the engine closed can be reopened by an agent', async () => {
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-build', lane: 'in_progress', title: 'Build' }] })
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-build', lane: 'done' }] })
    const back = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'doing-build', lane: 'in_progress' }] })
    expect(back.status).toBe(200)
    db.tables.work_board_items[0].lane = 'done'
    db.tables.work_board_items[0].updated_by = 'engine: record done'
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'doing-build', lane: 'on_you' }] })).status).toBe(200)
  })
})
