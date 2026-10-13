import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The work board in the database (Krish, 2026-10-03: "I need the boards to not
// be Claude pages, but accessible by Codex too and workable using Codex too").
// One route serves Control Center (Krish's cookie) and every agent session
// (the engine key). Only Krish's cookie may write a reply.

type Row = Record<string, any>
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  writes: [] as Array<[string, string]>,
  /** Runs once, just before the next update: another writer landing between the route's read and its write. */
  between: null as null | (() => void),
  /** A table whose reads fail: 'error' returns { error }, 'throw' rejects. */
  failRead: {} as Record<string, 'error' | 'throw'>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  function query(table: string) {
    let rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let order: [string, boolean] | null = null
    let limit = Infinity
    let op: 'select' | 'insert' | 'update' = 'select'
    let payload: Row = {}
    let inserted: Row | null = null
    // A read returns only the columns it names, as PostgREST does, so a route
    // that reads too little before it merges a write is caught.
    let columns: string[] | null = null
    const pick = (r: Row) => columns ? Object.fromEntries(columns.filter(c => c in r).map(c => [c, r[c]])) : r
    const run = () => {
      if (op === 'insert') {
        inserted = { id: payload.id ?? `00000000-0000-4000-8000-${String(rows().length + 1).padStart(12, '0')}`, seen_at: null, ...payload }
        rows().push(inserted)
        db.writes.push([table, 'insert'])
        return { data: [inserted], error: null }
      }
      if (op === 'update' && db.between) { const go = db.between; db.between = null; go() }
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') {
        hit.forEach(r => Object.assign(r, payload))
        db.writes.push([table, 'update'])
        return { data: hit, error: null }
      }
      if (db.failRead[table] === 'error') return { data: null, error: { message: `synthetic ${table} read failure` } }
      if (db.failRead[table] === 'throw') throw new Error(`synthetic ${table} network failure`)
      let out = [...hit]
      if (order) { const [k, asc] = order; out.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1)) }
      return { data: out.slice(0, limit).map(pick), error: null }
    }
    const chain: Record<string, any> = {
      select(cols?: string) { if (op === 'select' && cols && cols.trim() !== '*') columns = cols.split(',').map(c => c.trim()); return chain },
      insert(row: Row) { op = 'insert'; payload = row; return chain },
      update(patch: Row) { op = 'update'; payload = patch; return chain },
      eq(k: string, v: unknown) { filters.push(r => r[k] === v); return chain },
      in(k: string, vs: unknown[]) { filters.push(r => vs.includes(r[k])); return chain },
      is(k: string, v: unknown) { filters.push(r => (r[k] ?? null) === v); return chain },
      like(k: string, p: string) { const re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); filters.push(r => typeof r[k] === 'string' && re.test(r[k])); return chain },
      gte(k: string, v: string) { filters.push(r => String(r[k] ?? '') >= v); return chain },
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
const PIECE = 'f328382d-71b3-41a7-a221-d8615826f12e'
// What an item waiting on Krish carries to be written at all: why only he can
// do it, the link he presses, and how it closes itself (the piece and its step).
const READY = { only_you: 'face', link: 'https://claude.ai/artifact/script', link_label: 'Open the script', idea_id: PIECE, closes_on: 'record' }
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
  db.between = null
  db.failRead = {}
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
      { id: 'p1-video', lane: 'on_you', rank: 1, area: 'Article 1', title: 'Say yes to the video', detail: 'Five things to confirm.', ...READY },
      { id: 'next-picks', lane: 'in_progress', rank: 2, title: 'Your next two articles', closes_on: 'session' },
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
    await call('POST', { action: 'upsert_items', items: [{ id: 'p3', lane: 'on_you', title: 'Read article 3', detail: 'Facts checked.', ...READY }] })
    const move = await call('POST', { action: 'upsert_items', items: [{ id: 'p3', lane: 'done' }] }, 'krish')
    expect(move.status).toBe(200)
    const row = db.tables.work_board_items.find(r => r.id === 'p3')!
    expect(row.lane).toBe('done')
    expect(row.title).toBe('Read article 3')
    expect(row.detail).toBe('Facts checked.')
  })

  it('lane_if_new is the lane only for a new item: an item already closed is never reopened by a tool asking again', async () => {
    await call('POST', { action: 'upsert_items', items: [{ id: 'take-aaaaaaaaaaaa', lane: 'on_you', title: 'Which piece is this take?', ...READY }] })
    await call('POST', { action: 'upsert_items', items: [{ id: 'take-aaaaaaaaaaaa', lane: 'done' }] }, 'krish')
    const again = await call('POST', { action: 'upsert_items', client: 'runner', items: [
      { id: 'take-aaaaaaaaaaaa', lane_if_new: 'on_you', title: 'Which piece is this take?', detail: 'asked again from the other machine' },
      { id: 'take-bbbbbbbbbbbb', lane_if_new: 'on_you', title: 'A new take', ...READY },
    ] })
    expect(again.status).toBe(200)
    expect(db.tables.work_board_items.find(r => r.id === 'take-aaaaaaaaaaaa')!.lane).toBe('done')
    expect(db.tables.work_board_items.find(r => r.id === 'take-bbbbbbbbbbbb')!.lane).toBe('on_you')
    const bad = await call('POST', { action: 'upsert_items', items: [{ id: 'take-cccccccccccc', lane_if_new: 'sideways', title: 'x' }] })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('lane_invalid')
  })

  it('a new item needs a lane and a title, and one bad item writes nothing', async () => {
    const bad = await call('POST', { action: 'upsert_items', items: [{ id: 'ok-one', lane: 'on_you', title: 'Fine', ...READY }, { id: 'no-title', lane: 'on_you' }] })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('title_required')
    expect(db.tables.work_board_items).toHaveLength(0)
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'Bad Id', lane: 'on_you', title: 'x' }] })).body.error).toBe('item_id_invalid')
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'x1', lane: 'someday', title: 'x' }] })).body.error).toBe('lane_invalid')
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'x2', lane: 'on_you', title: 'x', link: 'http://plain' }] })).body.error).toBe('link_must_be_https')
  })

  it('replies are retired: no one writes one, and no item asks him for one; a null prompt clears an old one', async () => {
    await call('POST', { action: 'upsert_items', items: [{ id: 'p1-video', lane: 'on_you', title: 'Say yes to the video', ...READY }] })
    for (const [who, extra] of [['agent', { decided_by: 'Krish' }], ['krish', {}]] as const) {
      const out = await call('POST', { action: 'reply', item_id: 'p1-video', text: 'yes, make the video', ...extra }, who)
      expect(out.status).toBe(410)
      expect(out.body).toMatchObject({ ok: false, error: 'replies_retired' })
      expect(out.body.detail).toContain('in your reply to him')
    }
    expect(db.tables.work_board_replies).toHaveLength(0)
    const writes = db.writes.length
    for (const who of ['agent', 'krish'] as const) {
      const asks = await call('POST', { action: 'upsert_items', items: [{ id: 'p2-video', lane: 'in_progress', title: 'Which cut?', prompt: 'the long or the short' }] }, who)
      expect(asks.status).toBe(400)
      expect(asks.body).toMatchObject({ error: 'prompt_retired', item: 'p2-video' })
    }
    expect(db.writes.length).toBe(writes)
    db.tables.work_board_items.find(r => r.id === 'p1-video')!.prompt = 'Reply with the cut'
    const cleared = await call('POST', { action: 'upsert_items', items: [{ id: 'p1-video', prompt: null }] })
    expect(cleared.status).toBe(200)
    expect(db.tables.work_board_items.find(r => r.id === 'p1-video')!.prompt).toBe(null)
    expect((await call('POST', { action: 'nonsense' })).body.actions).toEqual(['upsert_items', 'set_state', 'mark_seen'])
  })

  it('an agent marks the replies he wrote before seen, and the board counts what is still unseen', async () => {
    await call('POST', { action: 'upsert_items', items: [{ id: 'p3', lane: 'on_you', title: 'Read article 3', ...READY }] })
    db.tables.work_board_replies.push({ id: '00000000-0000-4000-8000-000000000001', item_id: 'p3', text: 'Approved', by: 'Krish', at: '2026-10-10T12:00:00Z', seen_at: null })
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
      { id: 'monday-record', lane: 'on_you', title: 'Record both cuts', only_you: 'face', link: 'https://web.descript.com/record-here', idea_id: PIECE, closes_on: 'record' },
      { id: 'week-2026-10-12', lane: 'on_you', title: 'Pick this week', only_you: 'judgment', link: 'https://controlcenter.krishraja.com/#/week', closes_on: 'week_planned' },
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

// Who closed an item is kept in closed_by, never read from the last writer:
// every write restamps updated_by, including the edits an agent may still make
// to a closed item, so a rule on updated_by lasted only until the first one.
describe('an item Krish closed stays closed to agents', () => {
  const item = (id: string) => db.tables.work_board_items.find(r => r.id === id)!

  async function closedByKrish(lane: 'done' | 'archived', id = 'you-launch') {
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id, lane: 'on_you', title: 'Swap the cover', ...READY }] })
    expect(item(id).closed_by ?? null).toBe(null)
    const close = await call('POST', { action: 'upsert_items', items: [{ id, lane }] }, 'krish')
    expect(close.status).toBe(200)
    expect(item(id)).toMatchObject({ lane, updated_by: 'Krish', closed_by: 'Krish' })
  }

  async function reopenRefused(id = 'you-launch') {
    for (const back of ['on_you', 'in_progress']) {
      const out = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id, lane: back }] })
      expect(out.status).toBe(409)
      expect(out.body).toMatchObject({ ok: false, error: 'krish_closed_it', item: id })
    }
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
        expect(db.tables.work_board_items[0]).toMatchObject({ lane, updated_by: 'Krish', closed_by: 'Krish' })
      }
    }
  })

  it('an agent edit in place leaves it his: the next agent still cannot reopen it', async () => {
    // The review's case: he Clears you-launch-today, an agent closing out its
    // session writes a line on it, and the next agent tries to put it back.
    await closedByKrish('done', 'you-launch-today')
    const edit = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-launch-today', lane: 'done', detail: 'Swapped on Monday.' }] })
    expect(edit.status).toBe(200)
    expect(item('you-launch-today')).toMatchObject({ lane: 'done', detail: 'Swapped on Monday.', updated_by: 'claude_code', closed_by: 'Krish' })
    const noLane = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-launch-today', detail: 'Checked again.' }] })
    expect(noLane.status).toBe(200)
    expect(item('you-launch-today')).toMatchObject({ updated_by: 'codex', closed_by: 'Krish' })
    await reopenRefused('you-launch-today')
    expect(item('you-launch-today').lane).toBe('done')
  })

  it('an agent may move it from done to archived, and it stays his', async () => {
    await closedByKrish('done')
    const archive = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-launch', lane: 'archived' }] })
    expect(archive.status).toBe(200)
    expect(item('you-launch')).toMatchObject({ lane: 'archived', updated_by: 'codex', closed_by: 'Krish' })
    await reopenRefused()
  })

  it("Control Center's slate rewriting a closed week item leaves it his", async () => {
    await closedByKrish('done', 'week-2026-10-12')
    for (const lane of ['done', 'archived']) {
      const slate = await call('POST', { action: 'upsert_items', client: 'control_center_slate', items: [{ id: 'week-2026-10-12', lane, detail: 'Every day has a piece.' }] }, 'krish')
      expect(slate.status).toBe(200)
      expect(item('week-2026-10-12')).toMatchObject({ lane, updated_by: 'control_center_slate', closed_by: 'Krish' })
    }
    await reopenRefused('week-2026-10-12')
  })

  it('a close an agent relays from his words is his too, and a relayed reopen is still an agent write', async () => {
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-welcome-days', lane: 'on_you', title: 'Swap two days', ...READY }] })
    const relayed = await call('POST', { action: 'upsert_items', client: 'claude_code', decided_by: 'Krish', said: 'I swapped the two days this morning', items: [{ id: 'you-welcome-days', lane: 'done' }] })
    expect(relayed.status).toBe(200)
    expect(item('you-welcome-days')).toMatchObject({ lane: 'done', updated_by: 'claude_code', closed_by: 'Krish', closed_proof: 'His words: "I swapped the two days this morning"' })
    await reopenRefused('you-welcome-days')
    const back = await call('POST', { action: 'upsert_items', decided_by: 'Krish', items: [{ id: 'you-welcome-days', lane: 'on_you' }] })
    expect(back.status).toBe(409)
    expect(back.body.error).toBe('krish_closed_it')
  })

  it('an agent cannot forge who closed it', async () => {
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-build', lane: 'in_progress', title: 'Build', closes_on: 'session' }] })
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-build', lane: 'done', closed_by: 'codex' }] })
    expect(item('doing-build').closed_by).toBe('claude_code')
    await closedByKrish('done')
    await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-launch', closed_by: null }] })
    expect(item('you-launch').closed_by).toBe('Krish')
  })

  it('his own Undo, from his cookie, reopens it, and an agent may then move it again', async () => {
    await closedByKrish('done')
    const undo = await call('POST', { action: 'upsert_items', items: [{ id: 'you-launch', lane: 'on_you' }] }, 'krish')
    expect(undo.status).toBe(200)
    expect(item('you-launch')).toMatchObject({ lane: 'on_you', updated_by: 'Krish', closed_by: null })
    const agent = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-launch', lane: 'in_progress' }] })
    expect(agent.status).toBe(200)
  })

  it('an item an agent or the engine closed can be reopened by an agent', async () => {
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-build', lane: 'in_progress', title: 'Build', closes_on: 'session' }] })
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-build', lane: 'done' }] })
    expect(item('doing-build').closed_by).toBe('claude_code')
    const back = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'doing-build', lane: 'in_progress' }] })
    expect(back.status).toBe(200)
    expect(item('doing-build').closed_by).toBe(null)
    // A close the old engine closers wrote before step 4, part C, recorded themselves.
    Object.assign(item('doing-build'), { lane: 'done', updated_by: 'engine: record done', closed_by: 'engine: record done' })
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'doing-build', lane: 'on_you' }] })).body.error).toBe('on_you_needs_only_you')
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'doing-build', lane: 'on_you', ...READY }] })).status).toBe(200)
  })

  it('Krish moving an agent-closed item to archived makes the close his', async () => {
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'old-ask', lane: 'done', title: 'Old ask' }] })
    expect(item('old-ask').closed_by).toBe('claude_code')
    await call('POST', { action: 'upsert_items', items: [{ id: 'old-ask', lane: 'archived' }] }, 'krish')
    expect(item('old-ask')).toMatchObject({ lane: 'archived', closed_by: 'Krish' })
    await reopenRefused('old-ask')
  })

  it('closedByAfter: set on the close, kept through edits, cleared on reopen', async () => {
    const { closedByAfter } = await import('../../apps/control-plane/api/workbench.js')
    const open = { id: 'a1', lane: 'on_you', closed_by: null }
    const his = { id: 'a1', lane: 'done', closed_by: 'Krish' }
    expect(closedByAfter(undefined, 'done', 'codex')).toBe('codex')
    expect(closedByAfter(undefined, 'on_you', 'codex')).toBe(undefined)
    expect(closedByAfter(open, 'archived', 'Krish')).toBe('Krish')
    expect(closedByAfter(open, 'in_progress', 'codex')).toBe(undefined)
    expect(closedByAfter(his, undefined, 'codex')).toBe(undefined)
    expect(closedByAfter(his, 'archived', 'codex')).toBe(undefined)
    expect(closedByAfter(his, 'done', 'control_center_slate')).toBe(undefined)
    expect(closedByAfter({ ...his, closed_by: 'codex' }, 'archived', 'Krish')).toBe('Krish')
    expect(closedByAfter(his, 'on_you', 'Krish')).toBe(null)
  })
})

// Krish, 2026-10-11: "you are just capping the garbage. Surely we need to not
// have garbage." An item waiting on him is ready for his one list when it is
// written, or it is not written: why only he can do it, an https link to what
// he acts on, and how it closes itself (with the piece, unless it is the
// week's planning item). The write is merged with the row already there
// before it is checked.
describe('an item waiting on Krish is refused unless it is ready for his list', () => {
  const item = (id: string) => db.tables.work_board_items.find(r => r.id === id)
  const WEEK = { only_you: 'judgment', link: 'https://controlcenter.krishraja.com/#/week', link_label: 'Open the week', closes_on: 'week_planned' }
  const without = (key: keyof typeof READY) => { const r: Row = { ...READY }; delete r[key]; return r }

  it('each missing field is its own refusal, naming the item, the values allowed and in_progress; nothing is written', async () => {
    const cases: Array<[Row, string, RegExp]> = [
      [without('only_you'), 'on_you_needs_only_you', /send, post, spend, delete, permission, credential, face, login, judgment/],
      [without('link'), 'on_you_needs_link', /https:\/\//],
      [{ ...READY, link: null }, 'on_you_needs_link', /https:\/\//],
      [without('closes_on'), 'on_you_needs_closes_on', /workroom, draft, visual_gate, scripts, pack, record, video, publish\) or published.*week_planned on the week's planning item alone.*week_published.*his_word.*Never session, post_matched or take_placed/],
      [without('idea_id'), 'on_you_needs_idea_id', /the piece's uuid. Only the kinds that are not a piece's step need none/],
      [{ ...READY, idea_id: null }, 'on_you_needs_idea_id', /idea_id/],
    ]
    for (const [fields, error, names] of cases) {
      for (const who of ['agent', 'krish'] as const) {
        const out = await call('POST', { action: 'upsert_items', client: 'codex', items: [
          { id: 'fine-one', lane: 'in_progress', title: 'Agent work' },
          { id: 'you-welcome-days', lane: 'on_you', title: 'Swap two days in the welcome email', ...fields },
        ] }, who)
        expect(out.status).toBe(400)
        expect(out.body).toMatchObject({ ok: false, error, item: 'you-welcome-days' })
        expect(out.body.detail).toMatch(names)
        expect(out.body.detail).toContain('keep the item in in_progress')
        expect(db.writes).toEqual([])
      }
    }
  })

  it('the fields are checked in the order a writer fixes them, and an http link is still link_must_be_https', async () => {
    const { cleanItem, onYouLacks, BoardRefusal } = await import('../../apps/control-plane/api/workbench.js')
    expect(onYouLacks({ id: 'a1', lane: 'on_you' })).toBe('only_you')
    expect(onYouLacks({ id: 'a1', lane: 'on_you', only_you: 'login' })).toBe('link')
    expect(onYouLacks({ id: 'a1', lane: 'on_you', only_you: 'login', link: 'https://x' })).toBe('closes_on')
    expect(onYouLacks({ id: 'a1', lane: 'on_you', only_you: 'login', link: 'https://x', closes_on: 'publish' })).toBe('idea_id')
    expect(onYouLacks({ id: 'a1', lane: 'on_you', only_you: 'login', link: 'https://x', closes_on: 'week_planned' })).toBe('closes_on')
    expect(onYouLacks({ id: 'week-2026-10-19', lane: 'on_you', only_you: 'judgment', link: 'https://x', closes_on: 'week_planned' })).toBe(null)
    expect(onYouLacks({ id: 'a1', lane: 'in_progress' })).toBe(null)
    expect(() => cleanItem({ id: 'a1', lane: 'on_you', title: 'x', ...READY, link: 'http://plain' }, true)).toThrow('link_must_be_https')
    try {
      cleanItem({ id: 'a1', lane: 'on_you', title: 'x' }, true)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(BoardRefusal)
      expect((e as InstanceType<typeof BoardRefusal>).message).toBe('on_you_needs_only_you')
    }
  })

  it('a partial write is merged with the item already on him: an edit that keeps it ready passes, one that strips a field is refused', async () => {
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'monday-record', lane: 'on_you', title: 'Record both cuts', ...READY }] })).status).toBe(200)
    const edit = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'monday-record', detail: 'The scripts changed at 11:00.', closes_on: 'video' }] })
    expect(edit.status).toBe(200)
    expect(item('monday-record')).toMatchObject({ lane: 'on_you', detail: 'The scripts changed at 11:00.', closes_on: 'video', only_you: 'face', idea_id: PIECE })
    const writes = db.writes.length
    for (const [strip, error] of [[{ link: null }, 'on_you_needs_link'], [{ only_you: null }, 'on_you_needs_only_you'], [{ closes_on: null }, 'on_you_needs_closes_on'], [{ idea_id: null }, 'on_you_needs_idea_id']] as const) {
      const out = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'monday-record', ...strip }] })
      expect(out.status).toBe(400)
      expect(out.body).toMatchObject({ error, item: 'monday-record' })
    }
    expect(db.writes.length).toBe(writes)
    expect(item('monday-record')).toMatchObject({ link: READY.link, only_you: 'face', closes_on: 'video', idea_id: PIECE })
    // His Bump and his Clear are partial writes too, and an item on him passes them.
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'monday-record', bumped_until: '2026-10-13T04:00:00Z' }] }, 'krish')).status).toBe(200)
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'monday-record', lane: 'done' }] }, 'krish')).status).toBe(200)
  })

  it('an item held in progress moves on to him only with what it lacks, from the row or the write', async () => {
    // Live, 12 October: you-welcome-days has his login as the reason, but no link and no close.
    // After step 4's backfill it says how it ends: session work until something can see it.
    db.tables.work_board_items.push({ id: 'you-welcome-days', lane: 'in_progress', title: 'Swap two days in the welcome email', only_you: 'login', link: null, closes_on: 'session', idea_id: null, closed_by: null })
    const bare = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-welcome-days', lane: 'on_you' }] })
    expect(bare.status).toBe(400)
    expect(bare.body.error).toBe('on_you_needs_link')
    // The week's close is the week item's alone: on anything else it would never fire.
    const faked = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-welcome-days', lane: 'on_you', link: 'https://substack.com/publish/settings', closes_on: 'week_planned' }] })
    expect(faked.status).toBe(400)
    expect(faked.body.error).toBe('on_you_needs_closes_on')
    expect(faked.body.detail).toContain('id week-<its Monday>')
    expect(item('you-welcome-days')).toMatchObject({ lane: 'in_progress', link: null, closes_on: 'session' })
    // Still in progress, it may be edited freely.
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-welcome-days', detail: 'Nothing can see the email changed yet.' }] })).status).toBe(200)
    // A take held for want of a piece moves on once a session knows the piece.
    db.tables.work_board_items.push({ id: 'take-dddddddddddd', lane: 'in_progress', title: 'Which piece and cut is this take?', only_you: null, link: null, closes_on: 'record', idea_id: null, closed_by: null })
    const ready = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'take-dddddddddddd', lane: 'on_you', only_you: 'judgment', link: `https://controlcenter.krishraja.com/#/content?idea=${PIECE}`, idea_id: PIECE }] })
    expect(ready.status).toBe(200)
    expect(item('take-dddddddddddd')).toMatchObject({ lane: 'on_you', only_you: 'judgment', closes_on: 'record', idea_id: PIECE })
  })

  it('lane_if_new on_you is held to the same rule for a new item; for one already there it is not its lane, so not its rule', async () => {
    const bare = await call('POST', { action: 'upsert_items', client: 'runner', items: [{ id: 'take-aaaaaaaaaaaa', lane_if_new: 'on_you', title: 'Which piece and cut is this take?', closes_on: 'record' }] })
    expect(bare.status).toBe(400)
    expect(bare.body).toMatchObject({ error: 'on_you_needs_only_you', item: 'take-aaaaaaaaaaaa' })
    expect(item('take-aaaaaaaaaaaa')).toBeUndefined()
    const tied = await call('POST', { action: 'upsert_items', client: 'runner', items: [{ id: 'take-aaaaaaaaaaaa', lane_if_new: 'on_you', title: 'Which piece and cut is this take?', ...READY, only_you: 'judgment' }] })
    expect(tied.status).toBe(200)
    expect(item('take-aaaaaaaaaaaa')).toMatchObject({ lane: 'on_you', only_you: 'judgment', idea_id: PIECE, closes_on: 'record' })
    // A take with no piece goes in progress, where nothing more is asked of it.
    const held = await call('POST', { action: 'upsert_items', client: 'runner', items: [{ id: 'take-bbbbbbbbbbbb', lane_if_new: 'in_progress', title: 'Which piece and cut is this take?', closes_on: 'record' }] })
    expect(held.status).toBe(200)
    expect(item('take-bbbbbbbbbbbb')!.lane).toBe('in_progress')
    // Asked again with lane_if_new on_you, the item already there keeps its lane, and the write passes.
    db.tables.work_board_items.push({ id: 'take-cccccccccccc', lane: 'done', title: 'Answered', closed_by: 'Krish' })
    const again = await call('POST', { action: 'upsert_items', client: 'runner', items: [
      { id: 'take-bbbbbbbbbbbb', lane_if_new: 'on_you', title: 'Which piece and cut is this take?', detail: 'Still no piece.' },
      { id: 'take-cccccccccccc', lane_if_new: 'on_you', title: 'Answered', detail: 'Asked again from the other machine.' },
    ] })
    expect(again.status).toBe(200)
    expect(item('take-bbbbbbbbbbbb')!.lane).toBe('in_progress')
    expect(item('take-cccccccccccc')!.lane).toBe('done')
  })

  it('a ready item passes: a recording tied to its piece, and the week that needs no piece', async () => {
    const out = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [
      { id: 'friday-record', lane: 'on_you', rank: 2, area: 'Friday 16 Oct', title: 'Record both cuts', ...READY, idea_id: '904658db-4df2-4537-a0ed-ebe93e081db7' },
      { id: 'week-2026-10-19', lane: 'on_you', rank: 1, title: 'What are we writing about this week?', ...WEEK },
    ] })
    expect(out.status).toBe(200)
    expect(out.body.written).toEqual(['friday-record', 'week-2026-10-19'])
    expect(item('friday-record')).toMatchObject({ lane: 'on_you', only_you: 'face', closes_on: 'record', idea_id: '904658db-4df2-4537-a0ed-ebe93e081db7', updated_by: 'claude_code' })
    expect(item('week-2026-10-19')).toMatchObject({ lane: 'on_you', only_you: 'judgment', closes_on: 'week_planned' })
    expect(item('week-2026-10-19')!.idea_id).toBeUndefined()
    // Control Center's slate writes the week the same way; it closes nothing (the sweep does).
    const slate = await call('POST', { action: 'upsert_items', client: 'control_center_slate', items: [
      { id: 'week-2026-10-19', lane: 'on_you', title: 'What are we writing about this week? Pick Wednesday', ...WEEK, prompt: null },
    ] }, 'krish')
    expect(slate.status).toBe(200)
    const archive = await call('POST', { action: 'upsert_items', client: 'control_center_slate', items: [{ id: 'friday-record', lane: 'archived' }] }, 'krish')
    expect([archive.status, archive.body.error]).toEqual([409, 'check_closes_it'])
    expect(item('friday-record')!.lane).toBe('on_you')
  })

  it('an item that is not on him needs none of it', async () => {
    const out = await call('POST', { action: 'upsert_items', client: 'codex', items: [
      { id: 'doing-build', lane: 'in_progress', title: 'Build the Descript return', closes_on: 'session' },
      { id: 'old-note', lane: 'done', title: 'Sent' },
      { id: 'gone', lane: 'archived', title: 'Dropped' },
    ] })
    expect(out.status).toBe(200)
  })
})

// Step 4, one done-check sweep. Krish, 2026-10-11: "I think closing what you
// can check is already done is one of the most obvious things I've ever heard
// of as a suggestion." And: "I am happy to Clear(complete)/Bump/Purge things
// off my lists as I go but the rest should be automatically done." Every item
// says how it ends; the sweep (client done_check) only closes, with proof; a
// close relayed from him carries his words; an item whose step is already
// done is never written.
describe('every item says how it ends, so a check can end it', () => {
  const item = (id: string) => db.tables.work_board_items.find(r => r.id === id)
  const SHARE = { url: 'https://example.substack.com/p/launch', was: '0a1b2c3d-1111-4222-8333-444455556666_1200x630.png' }
  const JOB = { job: 'build_signals', after: '2026-10-22T09:00:00Z', probe: 'dry' }
  const ON_HIM = { only_you: 'login', link: 'https://example.substack.com/publish/post/1', link_label: 'Open the post settings' }

  it('closeRefOk is the database rule, kind by kind', async () => {
    const { closeRefOk, CLOSE_KINDS } = await import('../../apps/control-plane/api/workbench.js')
    expect([...CLOSE_KINDS]).toEqual(['workroom', 'draft', 'visual_gate', 'scripts', 'pack', 'record', 'video', 'publish', 'published',
      'week_planned', 'week_published', 'share_image_changed', 'job_ok', 'post_matched', 'take_placed', 'target_decided', 'session', 'his_word'])
    const cases: Array<[string, unknown, string | null, string, boolean]> = [
      ['record', {}, PIECE, 'monday-record', true],
      ['published', {}, null, 'monday-post', false],
      ['week_planned', {}, null, 'week-2026-10-19', true],
      ['week_planned', {}, null, 'plan-week-oct-19', false],
      ['week_published', {}, null, 'week-publish-board-2026-10-19', true],
      ['week_published', {}, null, 'week-2026-10-19', false],
      ['share_image_changed', SHARE, null, 'you-launch', true],
      ['share_image_changed', { url: SHARE.url }, null, 'you-launch', false],
      ['share_image_changed', { url: 'http://plain/p', was: 'x' }, null, 'you-launch', false],
      ['job_ok', JOB, null, 'you-key', true],
      ['job_ok', { job: 'build_signals' }, null, 'you-key', false],
      ['post_matched', { url: 'https://example.substack.com/p/x' }, null, 'post-77', true],
      ['post_matched', {}, null, 'post-77', false],
      ['take_placed', {}, null, 'take-0123456789ab', true],
      ['take_placed', {}, null, 'take-NOTHEX', false],
      ['target_decided', { target_id: '0a1b2c3d-1111-4222-8333-444455556666' }, null, 'visibility-take-x', true],
      ['target_decided', { target_id: 'not-a-uuid' }, null, 'visibility-take-x', false],
      ['target_decided', {}, null, 'visibility-take-x', false],
      ['session', {}, null, 'doing-x', true],
      ['his_word', null, null, 'you-x', true],
      ['someday', {}, null, 'x', false],
    ]
    for (const [kind, ref, idea, id, ok] of cases) expect([kind, id, closeRefOk(kind, ref, idea, id)]).toEqual([kind, id, ok])
  })

  it('close_ref is an object of at most 1 KB, and a check kind on an open item carries what it needs', async () => {
    const { cleanItem } = await import('../../apps/control-plane/api/workbench.js')
    expect(cleanItem({ id: 'a1', close_ref: SHARE }, false)).toEqual({ id: 'a1', close_ref: SHARE })
    expect(cleanItem({ id: 'a1', close_ref: null }, false)).toEqual({ id: 'a1', close_ref: {} })
    expect(() => cleanItem({ id: 'a1', close_ref: ['x'] }, false)).toThrow('close_ref_must_be_an_object')
    expect(() => cleanItem({ id: 'a1', close_ref: { note: 'x'.repeat(1100) } }, false)).toThrow('close_ref_too_long')
    const out = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-launch', lane: 'in_progress', title: 'Set the share image', closes_on: 'share_image_changed', close_ref: { url: SHARE.url } }] })
    expect(out.status).toBe(400)
    expect(out.body).toMatchObject({ error: 'close_ref_invalid', item: 'you-launch' })
    expect(out.body.detail).toContain('"was"')
    const take = await call('POST', { action: 'upsert_items', client: 'runner', items: [{ id: 'take-bad', lane_if_new: 'in_progress', title: 'Which take?', closes_on: 'take_placed' }] })
    expect(take.body.error).toBe('close_ref_invalid')
  })

  it('on him, the kinds a session or a machine holds are refused, and each check kind needs its ref', async () => {
    for (const kind of ['session', 'post_matched', 'take_placed']) {
      const out = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'take-0123456789ab', lane: 'on_you', title: 'x', ...ON_HIM, closes_on: kind, close_ref: { url: SHARE.url } }] })
      expect([kind, out.status, out.body.error]).toEqual([kind, 400, 'on_you_needs_closes_on'])
    }
    const noWas = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-launch', lane: 'on_you', title: 'x', ...ON_HIM, closes_on: 'share_image_changed', close_ref: { url: SHARE.url } }] })
    expect(noWas.body.error).toBe('on_you_needs_close_ref')
    const wrongWeek = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'week-2026-10-19', lane: 'on_you', title: 'x', ...ON_HIM, only_you: 'post', closes_on: 'week_published' }] })
    expect(wrongWeek.body.error).toBe('on_you_needs_closes_on')
    const ready = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [
      { id: 'you-launch', lane: 'on_you', title: 'Set the share image', ...ON_HIM, closes_on: 'share_image_changed', close_ref: SHARE },
      { id: 'you-key', lane: 'on_you', title: 'Replace the key, then press Redeploy', ...ON_HIM, only_you: 'credential', closes_on: 'job_ok', close_ref: JOB },
      { id: 'week-publish-board-2026-10-19', lane: 'on_you', title: 'This week\'s publish board', ...ON_HIM, only_you: 'post', closes_on: 'week_published' },
    ] })
    expect(ready.status).toBe(200)
    expect(item('you-launch')).toMatchObject({ lane: 'on_you', closes_on: 'share_image_changed', close_ref: SHARE })
    // A later edit is merged with the ref already there.
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-launch', detail: 'Still the old card.' }] })).status).toBe(200)
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-launch', close_ref: { url: SHARE.url } }] })).body.error).toBe('on_you_needs_close_ref')
  })

  it("the visibility scorer's write puts a podcast on him as its own writer, closing when he decides it", async () => {
    const TARGET = '0a1b2c3d-1111-4222-8333-444455556666'
    const take = { id: 'visibility-take-0a1b2c3d', lane: 'on_you', rank: 2, area: 'Visibility', title: 'A podcast worth your time: Synthetic Show',
      link: 'https://controlcenter.example/#/people?lane=visibility&target=x', link_label: 'Open it in Visibility', only_you: 'judgment', closes_on: 'target_decided', close_ref: { target_id: TARGET } }
    const out = await call('POST', { action: 'upsert_items', client: 'visibility_score', items: [take] }, 'krish')
    expect(out.status).toBe(200)
    expect(item(take.id)).toMatchObject({ lane: 'on_you', closes_on: 'target_decided', close_ref: { target_id: TARGET }, updated_by: 'visibility_score' })
    const noTarget = await call('POST', { action: 'upsert_items', client: 'visibility_score', items: [{ ...take, id: 'visibility-take-none', close_ref: {} }] }, 'krish')
    expect(noTarget.body.error).toBe('on_you_needs_close_ref')
  })

  it('his_word goes on his list only from him: his cookie, his words relayed, or Control Center', async () => {
    const put = (id: string) => ({ id, lane: 'on_you', title: 'Swap two days in the welcome email', ...ON_HIM, closes_on: 'his_word' })
    const agent = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [put('you-welcome-a')] })
    expect(agent.status).toBe(409)
    expect(agent.body).toMatchObject({ error: 'his_word_is_his', item: 'you-welcome-a' })
    expect(agent.body.detail).toBe('Only Krish puts an item on his list that nothing can see. Give it a check kind, or hold it in progress.')
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', decided_by: 'Krish', items: [put('you-welcome-a')] })).body.error).toBe('his_word_is_his')
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', decided_by: 'Krish', said: 'put the welcome email on my list', items: [put('you-welcome-a')] })).status).toBe(200)
    expect((await call('POST', { action: 'upsert_items', client: 'control_center', items: [put('you-welcome-b')] }, 'krish')).status).toBe(200)
    expect((await call('POST', { action: 'upsert_items', items: [put('you-welcome-c')] }, 'krish')).status).toBe(200)
    expect(item('you-welcome-b')).toMatchObject({ lane: 'on_you', closes_on: 'his_word', updated_by: 'control_center' })
    // Held in progress, any writer may give it his_word; an edit of one already on him is not putting it there.
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-welcome-d', lane: 'in_progress', title: 'x', closes_on: 'his_word' }] })).status).toBe(200)
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-welcome-b', detail: 'Two days swapped in the draft.' }] })).status).toBe(200)
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'you-welcome-d', lane: 'on_you', ...ON_HIM }] })).body.error).toBe('his_word_is_his')
  })

  it('the sweep closes an open item with its proof, as "check: <kind>", and does nothing else', async () => {
    db.tables.work_board_items.push(
      { id: 'monday-record', lane: 'on_you', title: 'Record both cuts', ...READY, closed_by: null },
      { id: 'doing-old', lane: 'in_progress', title: 'Old session work', closes_on: 'session', closed_by: null },
      { id: 'old-note', lane: 'done', title: 'Sent', closes_on: 'session', closed_by: 'Krish' },
    )
    const sweep = (items: Row[]) => call('POST', { action: 'upsert_items', client: 'done_check', items }, 'krish')
    const close = await sweep([{ id: 'monday-record', lane: 'done', closed_proof: 'The record step landed, 14 Oct 10:14 AM.' }])
    expect(close.status).toBe(200)
    expect(item('monday-record')).toMatchObject({ lane: 'done', closed_by: 'check: record', closed_proof: 'The record step landed, 14 Oct 10:14 AM.', updated_by: 'done_check' })
    const letGo = await sweep([{ id: 'doing-old', lane: 'archived', closed_proof: 'No session touched it for 7 days.' }])
    expect(letGo.status).toBe(200)
    expect(item('doing-old')).toMatchObject({ lane: 'archived', closed_by: 'check: session' })
    const writes = db.writes.length
    const refusals: Array<[Row, number, string]> = [
      [{ id: 'monday-record', lane: 'on_you' }, 409, 'done_check_only_closes'],
      [{ id: 'old-note', lane: 'archived', closed_proof: 'x' }, 409, 'done_check_only_closes'],
      [{ id: 'never-was', lane: 'done', closed_proof: 'x' }, 409, 'done_check_only_closes'],
      [{ id: 'friday', lane: 'in_progress' }, 409, 'done_check_only_closes'],
    ]
    db.tables.work_board_items.push({ id: 'friday', lane: 'on_you', title: 'Record', ...READY, closed_by: null })
    refusals.push([{ id: 'friday', lane: 'done' }, 400, 'done_check_needs_proof'])
    refusals.push([{ id: 'friday', lane: 'done', closed_proof: 'x', title: 'renamed' }, 409, 'done_check_only_closes'])
    refusals.push([{ id: 'friday', lane: 'done', closed_proof: 'x'.repeat(301) }, 400, 'closed_proof_too_long'])
    for (const [it, status, error] of refusals) {
      const out = await sweep([it])
      expect([it.id, out.status, out.body.error]).toEqual([it.id, status, error])
    }
    expect(db.writes.length).toBe(writes)
    expect(item('friday')!.lane).toBe('on_you')
  })

  it('the sweep never closes what only his Clear ends, or an item that does not say how it ends', async () => {
    db.tables.work_board_items.push(
      { id: 'you-welcome-days', lane: 'on_you', title: 'Swap two days', only_you: 'login', link: 'https://example.com/settings', closes_on: 'his_word', closed_by: null },
      { id: 'old-silent', lane: 'in_progress', title: 'Says nothing', closes_on: null, closed_by: null },
    )
    for (const id of ['you-welcome-days', 'old-silent']) {
      const out = await call('POST', { action: 'upsert_items', client: 'done_check', items: [{ id, lane: 'done', closed_proof: 'The check saw it.' }] }, 'krish')
      expect([id, out.status, out.body.error]).toEqual([id, 409, 'done_check_only_closes'])
    }
    expect(db.writes).toEqual([])
    expect(item('you-welcome-days')).toMatchObject({ lane: 'on_you', closed_by: null })
    expect(item('old-silent')).toMatchObject({ lane: 'in_progress', closed_by: null })
  })

  it('the sweep sends one item a call, so a lost race never leaves part of a call written', async () => {
    db.tables.work_board_items.push(
      { id: 'monday-record', lane: 'on_you', title: 'Record', ...READY, closed_by: null },
      { id: 'friday-record', lane: 'on_you', title: 'Record', ...READY, closed_by: null },
    )
    const out = await call('POST', { action: 'upsert_items', client: 'done_check', items: [
      { id: 'monday-record', lane: 'done', closed_proof: 'The record step landed.' },
      { id: 'friday-record', lane: 'done', closed_proof: 'The record step landed.' },
    ] }, 'krish')
    expect(out.status).toBe(400)
    expect(out.body.error).toBe('done_check_one_item')
    expect(db.writes).toEqual([])
  })

  it('his Clear landing between the sweep\'s read and its write wins: the sweep writes nothing', async () => {
    db.tables.work_board_items.push({ id: 'monday-record', lane: 'on_you', title: 'Record', ...READY, closed_by: null })
    db.between = () => Object.assign(item('monday-record')!, { lane: 'done', closed_by: 'Krish', closed_proof: null, updated_by: 'Krish' })
    const out = await call('POST', { action: 'upsert_items', client: 'done_check', items: [{ id: 'monday-record', lane: 'done', closed_proof: 'The record step landed.' }] }, 'krish')
    expect(out.status).toBe(409)
    expect(out.body).toMatchObject({ error: 'done_check_only_closes', item: 'monday-record' })
    expect(item('monday-record')).toMatchObject({ lane: 'done', closed_by: 'Krish', closed_proof: null, updated_by: 'Krish' })
  })

  it('only the sweep writes a proof; a later close by anyone else, or a reopen, clears it', async () => {
    db.tables.work_board_items.push({ id: 'doing-x', lane: 'in_progress', title: 'x', closes_on: 'session', closed_by: null })
    for (const [who, extra] of [['agent', { client: 'codex' }], ['krish', {}], ['krish', { client: 'control_center' }]] as const) {
      const out = await call('POST', { action: 'upsert_items', ...extra, items: [{ id: 'doing-x', lane: 'done', closed_proof: 'I say so.' }] }, who)
      expect(out.status).toBe(400)
      expect(out.body.error).toBe('closed_proof_is_the_checks')
    }
    await call('POST', { action: 'upsert_items', client: 'done_check', items: [{ id: 'doing-x', lane: 'done', closed_proof: 'No session touched it for 7 days.' }] }, 'krish')
    expect(item('doing-x')!.closed_proof).toBe('No session touched it for 7 days.')
    // His Undo comes with no client: the route records him, and the proof goes with the close.
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'doing-x', lane: 'in_progress' }] }, 'krish')).status).toBe(200)
    expect(item('doing-x')).toMatchObject({ lane: 'in_progress', closed_by: null, closed_proof: null })
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-x', lane: 'done' }] })).status).toBe(200)
    expect(item('doing-x')).toMatchObject({ lane: 'done', closed_by: 'claude_code', closed_proof: null })
  })

  it('a close or reopen relayed from Krish carries his exact words, kept on the row', async () => {
    db.tables.work_board_items.push(
      { id: 'you-a', lane: 'on_you', title: 'x', ...READY, closed_by: null },
      { id: 'doing-b', lane: 'done', title: 'x', closes_on: 'session', closed_by: 'claude_code' },
    )
    const relay = (items: Row[], said?: string) => call('POST', { action: 'upsert_items', client: 'claude_code', decided_by: 'Krish', ...(said === undefined ? {} : { said }), items })
    for (const said of [undefined, 'done', 'x'.repeat(300)]) {
      const out = await relay([{ id: 'you-a', lane: 'done' }], said)
      expect(out.status).toBe(400)
      expect(out.body).toMatchObject({ error: 'relayed_close_needs_his_words', item: 'you-a' })
    }
    expect((await relay([{ id: 'doing-b', lane: 'in_progress' }])).body.error).toBe('relayed_close_needs_his_words')
    // An edit he relayed that neither closes nor reopens needs no words.
    expect((await relay([{ id: 'you-a', detail: 'He said the cut is fine.' }])).status).toBe(200)
    expect((await relay([{ id: 'you-a', lane: 'done' }], '  I recorded both cuts last night  ')).status).toBe(200)
    expect(item('you-a')).toMatchObject({ lane: 'done', closed_by: 'Krish', closed_proof: 'His words: "I recorded both cuts last night"' })
    expect((await relay([{ id: 'doing-b', lane: 'in_progress' }], 'that one is not finished yet')).status).toBe(200)
    // A relayed reopen keeps his words too, so a forged relay is never invisible.
    expect(item('doing-b')).toMatchObject({ lane: 'in_progress', closed_by: null, closed_proof: 'His words: "that one is not finished yet"' })
  })

  it('an item whose step the engine already sees done is refused: nothing waits on Krish', async () => {
    const FRIDAY = '904658db-4df2-4537-a0ed-ebe93e081db7'
    const recorded = { making: { recordings: [{ cut: 'long', path: 'a', at: '2026-10-14T10:14:00Z' }, { cut: 'short', path: 'b', at: '2026-10-14T10:20:00Z' }], updated_at: 'x', by: 'x' } }
    db.tables.content_ideas = [
      { id: PIECE, state: 'review', buried_at: null, meta: recorded },
      { id: FRIDAY, state: 'review', buried_at: null, meta: { making: { recordings: [{ cut: 'long', path: 'a', at: 'x' }], updated_at: 'x', by: 'x' } } },
    ]
    const out = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [
      { id: 'friday-record', lane: 'on_you', title: 'Record both cuts', ...READY, idea_id: FRIDAY },
      { id: 'monday-record', lane: 'on_you', title: 'Record both cuts', ...READY },
    ] })
    expect(out.status).toBe(409)
    expect(out.body).toMatchObject({ ok: false, error: 'already_done', item: 'monday-record' })
    expect(out.body.detail).toBe('That step is already done, so nothing waits on Krish. Do not write the item.')
    expect(item('friday-record')).toBeUndefined()
    // A step not yet done passes; so does one in progress closing on another step.
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'friday-record', lane: 'on_you', title: 'Record both cuts', ...READY, idea_id: FRIDAY }] })).status).toBe(200)
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'monday-video', lane: 'in_progress', title: 'Cut the video', idea_id: PIECE, closes_on: 'video' }] })).status).toBe(200)
    // An edit that does not touch the lane, the kind or the piece is not asked about.
    Object.assign(db.tables.content_ideas.find(p => p.id === FRIDAY)!, { meta: recorded })
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'friday-record', detail: 'Both takes are in.' }] })).status).toBe(200)
    // His Undo reopens a check's close on purpose, so his writes are never refused for it.
    db.tables.work_board_items.push({ id: 'monday-record', lane: 'done', title: 'Record both cuts', ...READY, closed_by: 'check: record' })
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'monday-record', lane: 'on_you' }] }, 'krish')).status).toBe(200)
    // A published piece made before the making record closes everything on it.
    db.tables.content_ideas.push({ id: '11111111-2222-4333-8444-555555555555', state: 'published', buried_at: null, meta: null })
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'old-post', lane: 'in_progress', title: 'x', idea_id: '11111111-2222-4333-8444-555555555555', closes_on: 'published' }] })).body.error).toBe('already_done')
  })

  it('every open item says how it ends, new or edited, whoever writes it', async () => {
    const out = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-new', lane: 'in_progress', title: 'New work' }] })
    expect(out.status).toBe(400)
    expect(out.body).toMatchObject({ error: 'open_needs_closes_on', item: 'doing-new', detail: 'Say how it ends: a check kind, or session if you will close it yourself.' })
    expect((await call('POST', { action: 'upsert_items', client: 'runner', items: [{ id: 'doing-new', lane_if_new: 'in_progress', title: 'New work' }] })).body.error).toBe('open_needs_closes_on')
    // An edit of an old item that says nothing is refused too, until it is given a kind.
    db.tables.work_board_items.push({ id: 'doing-remote', lane: 'in_progress', title: 'Old', closes_on: null, closed_by: null })
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-remote', detail: 'Still going.' }] })).body.error).toBe('open_needs_closes_on')
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-remote', detail: 'Still going.', closes_on: 'session' }] })).status).toBe(200)
    // An edit may not drop the kind, and Krish's own open item says how it ends too (the database holds it to it).
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-remote', closes_on: null }] })).body.error).toBe('open_needs_closes_on')
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'his-note', lane: 'in_progress', title: 'A note' }] }, 'krish')).body.error).toBe('open_needs_closes_on')
    // A closed item needs none.
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'sent-note', lane: 'done', title: 'Sent' }] })).status).toBe(200)
  })

  it('only the check, Krish, or a session on its own work closes an item (check_closes_it)', async () => {
    db.tables.work_board_items.push(
      { id: 'monday-record', lane: 'on_you', title: 'Record both cuts', ...READY, closed_by: null },
      { id: 'you-launch', lane: 'in_progress', title: 'Set the share image', closes_on: 'share_image_changed', close_ref: { url: 'https://example.com/p/a', was: 'f' }, closed_by: null },
      { id: 'you-welcome', lane: 'on_you', title: 'Swap two days', only_you: 'login', link: 'https://example.com/settings', closes_on: 'his_word', closed_by: null },
      { id: 'doing-mine', lane: 'in_progress', title: 'My own work', closes_on: 'session', closed_by: null },
    )
    const writes = db.writes.length
    for (const [id, lane, client] of [['monday-record', 'done', 'claude_code'], ['you-launch', 'archived', 'codex'], ['you-welcome', 'done', 'runner'], ['monday-record', 'done', 'cron']] as const) {
      const out = await call('POST', { action: 'upsert_items', client, items: [{ id, lane }] })
      expect([id, out.status, out.body.error]).toEqual([id, 409, 'check_closes_it'])
      expect(out.body.detail).toContain('Record the fact')
    }
    // A Control Center job other than the sweep closes nothing, session work included.
    for (const id of ['monday-record', 'doing-mine']) {
      const out = await call('POST', { action: 'upsert_items', client: 'control_center', items: [{ id, lane: 'done' }] }, 'krish')
      expect([id, out.status, out.body.error]).toEqual([id, 409, 'check_closes_it'])
    }
    expect(db.writes.length).toBe(writes)
    // A session closes its own work; a relayed close with his words and his own Clear close anything.
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'doing-mine', lane: 'done' }] })).status).toBe(200)
    expect(item('doing-mine')).toMatchObject({ lane: 'done', closed_by: 'codex' })
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', decided_by: 'Krish', said: 'I swapped the image this morning', items: [{ id: 'you-launch', lane: 'done' }] })).status).toBe(200)
    expect(item('you-launch')).toMatchObject({ lane: 'done', closed_by: 'Krish' })
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'you-welcome', lane: 'done' }] }, 'krish')).status).toBe(200)
    // Done to archived is not a close, so a session may tidy any closed item.
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-welcome', lane: 'archived' }] })).status).toBe(200)
  })

  it("a session cannot make a check's item its own work and then close it (kind_is_the_checks)", async () => {
    db.tables.work_board_items.push(
      { id: 'monday-record', lane: 'on_you', title: 'Record both cuts', ...READY, closed_by: null },
      { id: 'you-launch', lane: 'in_progress', title: 'Set the share image', closes_on: 'share_image_changed', close_ref: { url: 'https://example.com/p/a', was: 'f' }, closed_by: null },
      { id: 'you-welcome', lane: 'in_progress', title: 'Swap two days', closes_on: 'his_word', closed_by: null },
      { id: 'doing-mine', lane: 'in_progress', title: 'My own work', closes_on: 'session', closed_by: null },
    )
    const writes = db.writes.length
    // The two-step path: take the item off his list as session work, then close it.
    const first = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'monday-record', lane: 'in_progress', closes_on: 'session' }] })
    expect([first.status, first.body.error, first.body.item]).toEqual([409, 'kind_is_the_checks', 'monday-record'])
    for (const [id, client] of [['you-launch', 'codex'], ['you-welcome', 'runner'], ['you-launch', 'cron']] as const) {
      const out = await call('POST', { action: 'upsert_items', client, items: [{ id, closes_on: 'session' }] })
      expect([id, out.status, out.body.error]).toEqual([id, 409, 'kind_is_the_checks'])
    }
    // Relaying him does not change a kind either: the database cannot tell a relay from a session, so his close is relayed as a close.
    const relayed = await call('POST', { action: 'upsert_items', client: 'claude_code', decided_by: 'Krish', said: 'That one is mine to finish now', items: [{ id: 'you-launch', closes_on: 'session' }] })
    expect(relayed.body.error).toBe('kind_is_the_checks')
    expect(relayed.body.detail).toContain('relay the close')
    expect(db.writes.length).toBe(writes)
    expect(item('monday-record')).toMatchObject({ lane: 'on_you', closes_on: 'record' })
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'monday-record', lane: 'done' }] })).body.error).toBe('check_closes_it')
    // A session's own work may take a check kind, and Krish may make anything session work.
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'doing-mine', closes_on: 'his_word' }] })).status).toBe(200)
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'you-launch', closes_on: 'session' }] }, 'krish')).status).toBe(200)
    expect(item('you-launch')!.closes_on).toBe('session')
  })

  it('only Krish reopens what a check closed (check_closed_it)', async () => {
    db.tables.work_board_items.push(
      { id: 'monday-record', lane: 'done', title: 'Record both cuts', ...READY, closed_by: 'check: record', closed_proof: 'The record step landed.' },
      { id: 'doing-old', lane: 'archived', title: 'Old session work', closes_on: 'session', closed_by: 'check: session', closed_proof: 'No session touched it for 7 days.' },
    )
    for (const [id, lane] of [['monday-record', 'on_you'], ['doing-old', 'in_progress']] as const) {
      const out = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id, lane }] })
      expect([id, out.status, out.body.error]).toEqual([id, 409, 'check_closed_it'])
    }
    expect((await call('POST', { action: 'upsert_items', client: 'control_center', items: [{ id: 'doing-old', lane: 'in_progress' }] }, 'krish')).body.error).toBe('check_closed_it')
    // Relayed without his words: told to bring them.
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', decided_by: 'Krish', items: [{ id: 'doing-old', lane: 'in_progress' }] })).body.error).toBe('relayed_close_needs_his_words')
    expect(item('doing-old')!.lane).toBe('archived')
    // His words relayed, or his Undo.
    expect((await call('POST', { action: 'upsert_items', client: 'claude_code', decided_by: 'Krish', said: 'I am still working on that one', items: [{ id: 'doing-old', lane: 'in_progress' }] })).status).toBe(200)
    expect(item('doing-old')).toMatchObject({ lane: 'in_progress', closed_by: null, closed_proof: 'His words: "I am still working on that one"' })
    expect((await call('POST', { action: 'upsert_items', items: [{ id: 'monday-record', lane: 'on_you' }] }, 'krish')).status).toBe(200)
    // An edit in place of a check's close is not a reopen.
    db.tables.work_board_items.push({ id: 'friday-record', lane: 'done', title: 'Record', ...READY, closed_by: 'check: record', closed_proof: 'x' })
    expect((await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'friday-record', detail: 'Both takes are in.' }] })).status).toBe(200)
  })

  it('the board returns what a check let go for a week, so he can Undo it, and nothing else archived', async () => {
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
    db.tables.work_board_items.push(
      { id: 'let-go-new', lane: 'archived', title: 'x', closed_by: 'check: session', updated_at: day(1) },
      { id: 'let-go-old', lane: 'archived', title: 'x', closed_by: 'check: session', updated_at: day(8) },
      { id: 'purged', lane: 'archived', title: 'x', closed_by: 'Krish', updated_at: day(1) },
    )
    const board = await call('GET', {}, 'krish')
    expect(board.body.items.map((i: Row) => i.id)).toEqual(['let-go-new'])
  })

  it('a database refusal says its code and the constraint', async () => {
    const { writeFailed } = await import('../../apps/control-plane/api/workbench.js')
    expect(writeFailed('you-x', { code: '23514', message: 'new row for relation "work_board_items" violates check constraint "work_board_items_on_you_is_ready"' }))
      .toEqual({ ok: false, error: 'board_write_failed', item: 'you-x', code: '23514', constraint: 'work_board_items_on_you_is_ready' })
    expect(writeFailed('you-x', { message: 'timeout' })).toEqual({ ok: false, error: 'board_write_failed', item: 'you-x', code: null, constraint: null })
  })

  it("the watcher's question for an unmatched post passes the rule: held in progress, ended when it matches", async () => {
    const { unmatchedItem } = await import('../../apps/control-plane/api/_publishWatch.js')
    const { cleanItem, closeRefOk } = await import('../../apps/control-plane/api/workbench.js')
    const q = unmatchedItem({ id: 77, title: 'A post', url: 'https://example.substack.com/p/a-post', posted_at: '2026-10-12T10:00:00Z', type: 'newsletter' })
    expect(q).toMatchObject({ id: 'post-77', lane: 'in_progress', closes_on: 'post_matched', close_ref: { url: 'https://example.substack.com/p/a-post' } })
    expect(closeRefOk(q.closes_on, q.close_ref, null, q.id)).toBe(true)
    expect(cleanItem(q, true)).toMatchObject({ id: 'post-77', closes_on: 'post_matched' })
    expect(() => cleanItem({ ...q, lane: 'on_you', only_you: 'judgment' }, true)).toThrow('on_you_needs_closes_on')
  })
})

// His words reach the board (step 3 of the design entropy session, PR 6).
// Control Center's filer keeps a note he says about an item in said_parts with
// about 'board:<item id>'; GET returns them on each open item. Synthetic notes.
describe('his said notes on the board', () => {
  const note = (id: string, about: string, at: string, extra: Row = {}) =>
    ({ id, about, kind: 'note', status: 'filed', excerpt: `A synthetic note ${id}.`, created_at: at, ...extra })

  beforeEach(() => {
    db.tables.work_board_items = [
      { id: 'p1-video', lane: 'in_progress', rank: 1, title: 'A synthetic item', closes_on: 'video', idea_id: PIECE },
      { id: 'p2-video', lane: 'on_you', rank: 2, title: 'Another synthetic item', ...READY },
      { id: 'old-item', lane: 'done', rank: 3, title: 'A closed synthetic item', closes_on: 'session', updated_at: '2026-10-12T00:00:00Z' },
    ]
  })

  it('an open item with two notes returns both, newest first, as part_id, excerpt and at', async () => {
    db.tables.said_parts = [
      note('00000000-0000-4000-8000-000000000001', 'board:p1-video', '2026-10-12T09:00:00Z'),
      note('00000000-0000-4000-8000-000000000002', 'board:p1-video', '2026-10-13T09:00:00Z', { status: 'settled' }),
    ]
    const board = await call('GET')
    expect(board.status).toBe(200)
    const item = board.body.items.find((i: Row) => i.id === 'p1-video')
    expect(item.said).toEqual([
      { part_id: '00000000-0000-4000-8000-000000000002', excerpt: 'A synthetic note 00000000-0000-4000-8000-000000000002.', at: '2026-10-13T09:00:00Z' },
      { part_id: '00000000-0000-4000-8000-000000000001', excerpt: 'A synthetic note 00000000-0000-4000-8000-000000000001.', at: '2026-10-12T09:00:00Z' },
    ])
    expect(board.body.items.find((i: Row) => i.id === 'p2-video').said).toEqual([])
    expect(board.body.said_read).toBeUndefined()
  })

  it('a purged note, a held one, a part that is not a note, and a note about a closed item return none', async () => {
    db.tables.said_parts = [
      note('00000000-0000-4000-8000-000000000003', 'board:p1-video', '2026-10-13T09:00:00Z', { status: 'purged' }),
      note('00000000-0000-4000-8000-000000000004', 'board:p1-video', '2026-10-13T09:00:00Z', { status: 'held' }),
      note('00000000-0000-4000-8000-000000000005', 'board:p1-video', '2026-10-13T09:00:00Z', { kind: 'task' }),
      note('00000000-0000-4000-8000-000000000006', 'board:old-item', '2026-10-13T09:00:00Z'),
      note('00000000-0000-4000-8000-000000000007', 'content', '2026-10-13T09:00:00Z'),
    ]
    const board = await call('GET', {}, 'krish')
    expect(board.body.items.find((i: Row) => i.id === 'p1-video').said).toEqual([])
    expect(board.body.items.find((i: Row) => i.id === 'old-item').said).toBeUndefined()
  })

  it('shows at most ten on an item, the newest, and writes nothing', async () => {
    db.tables.said_parts = Array.from({ length: 12 }, (_, n) =>
      note(`00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`, 'board:p1-video', `2026-10-${String(n + 1).padStart(2, '0')}T09:00:00Z`))
    const board = await call('GET')
    const said = board.body.items.find((i: Row) => i.id === 'p1-video').said
    expect(said).toHaveLength(10)
    expect(said[0].at).toBe('2026-10-12T09:00:00Z')
    expect(said[9].at).toBe('2026-10-03T09:00:00Z')
    expect(db.writes).toEqual([])
  })

  for (const how of ['error', 'throw'] as const) {
    it(`a said_parts read that fails (${how}) leaves the board up: every open item said [], said_read failed`, async () => {
      db.tables.said_parts = [note('00000000-0000-4000-8000-000000000001', 'board:p1-video', '2026-10-13T09:00:00Z')]
      db.failRead.said_parts = how
      const board = await call('GET', {}, 'krish')
      expect(board.status).toBe(200)
      expect(board.body.said_read).toBe('failed')
      const open = board.body.items.filter((i: Row) => i.lane !== 'done')
      expect(open.map((i: Row) => i.id)).toEqual(['p1-video', 'p2-video'])
      for (const i of open) expect(i.said).toEqual([])
      expect(db.writes).toEqual([])
    })
  }

  it('groupSaid keeps only notes about the items asked for', async () => {
    const { groupSaid } = await import('../../apps/control-plane/api/workbench.js')
    const out = groupSaid([
      { id: 'a', about: 'board:p1-video', excerpt: 'x', created_at: '2026-10-13T00:00:00Z' },
      { id: 'b', about: 'board:other', excerpt: 'y', created_at: '2026-10-13T00:00:00Z' },
      { id: 'c', about: 'p1-video', excerpt: 'z', created_at: '2026-10-13T00:00:00Z' },
    ], ['p1-video'])
    expect([...out.keys()]).toEqual(['p1-video'])
    expect(out.get('p1-video')!.map(n => n.part_id)).toEqual(['a'])
  })
})
