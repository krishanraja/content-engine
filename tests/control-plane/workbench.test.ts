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
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') {
        hit.forEach(r => Object.assign(r, payload))
        db.writes.push([table, 'update'])
        return { data: hit, error: null }
      }
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
    await call('POST', { action: 'upsert_items', items: [{ id: 'p3', lane: 'on_you', title: 'Read article 3', detail: 'Facts checked.', ...READY }] })
    const move = await call('POST', { action: 'upsert_items', items: [{ id: 'p3', lane: 'done' }] })
    expect(move.status).toBe(200)
    const row = db.tables.work_board_items.find(r => r.id === 'p3')!
    expect(row.lane).toBe('done')
    expect(row.title).toBe('Read article 3')
    expect(row.detail).toBe('Facts checked.')
  })

  it('lane_if_new is the lane only for a new item: an item already closed is never reopened by a tool asking again', async () => {
    await call('POST', { action: 'upsert_items', items: [{ id: 'take-aaaaaaaaaaaa', lane: 'on_you', title: 'Which piece is this take?', ...READY }] })
    await call('POST', { action: 'upsert_items', items: [{ id: 'take-aaaaaaaaaaaa', lane: 'done' }] })
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
    const relayed = await call('POST', { action: 'upsert_items', client: 'claude_code', decided_by: 'Krish', items: [{ id: 'you-welcome-days', lane: 'done' }] })
    expect(relayed.status).toBe(200)
    expect(item('you-welcome-days')).toMatchObject({ lane: 'done', updated_by: 'claude_code', closed_by: 'Krish' })
    await reopenRefused('you-welcome-days')
    const back = await call('POST', { action: 'upsert_items', decided_by: 'Krish', items: [{ id: 'you-welcome-days', lane: 'on_you' }] })
    expect(back.status).toBe(409)
    expect(back.body.error).toBe('krish_closed_it')
  })

  it('an agent cannot forge who closed it', async () => {
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-build', lane: 'in_progress', title: 'Build' }] })
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
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-build', lane: 'in_progress', title: 'Build' }] })
    await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'doing-build', lane: 'done' }] })
    expect(item('doing-build').closed_by).toBe('claude_code')
    const back = await call('POST', { action: 'upsert_items', client: 'codex', items: [{ id: 'doing-build', lane: 'in_progress' }] })
    expect(back.status).toBe(200)
    expect(item('doing-build').closed_by).toBe(null)
    // The engine's own close (_boardClose.ts) records itself.
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
      [without('closes_on'), 'on_you_needs_closes_on', /workroom, draft, visual_gate, scripts, pack, record, video, publish\), published, or week_planned for the week's planning item alone/],
      [without('idea_id'), 'on_you_needs_idea_id', /the piece's uuid. Only closes_on week_planned needs none/],
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
    db.tables.work_board_items.push({ id: 'you-welcome-days', lane: 'in_progress', title: 'Swap two days in the welcome email', only_you: 'login', link: null, closes_on: null, idea_id: null, closed_by: null })
    const bare = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-welcome-days', lane: 'on_you' }] })
    expect(bare.status).toBe(400)
    expect(bare.body.error).toBe('on_you_needs_link')
    // The week's close is the week item's alone: on anything else it would never fire.
    const faked = await call('POST', { action: 'upsert_items', client: 'claude_code', items: [{ id: 'you-welcome-days', lane: 'on_you', link: 'https://substack.com/publish/settings', closes_on: 'week_planned' }] })
    expect(faked.status).toBe(400)
    expect(faked.body.error).toBe('on_you_needs_closes_on')
    expect(faked.body.detail).toContain('id week-<its Monday>')
    expect(item('you-welcome-days')).toMatchObject({ lane: 'in_progress', link: null, closes_on: null })
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
    // Control Center's slate writes the week the same way, and archives an old one with a lane alone.
    const slate = await call('POST', { action: 'upsert_items', client: 'control_center_slate', items: [
      { id: 'week-2026-10-19', lane: 'on_you', title: 'What are we writing about this week? Pick Wednesday', ...WEEK, prompt: null },
      { id: 'friday-record', lane: 'archived' },
    ] }, 'krish')
    expect(slate.status).toBe(200)
    expect(item('friday-record')!.lane).toBe('archived')
  })

  it('an item that is not on him needs none of it', async () => {
    const out = await call('POST', { action: 'upsert_items', client: 'codex', items: [
      { id: 'doing-build', lane: 'in_progress', title: 'Build the Descript return' },
      { id: 'old-note', lane: 'done', title: 'Sent' },
      { id: 'gone', lane: 'archived', title: 'Dropped' },
    ] })
    expect(out.status).toBe(200)
  })
})
