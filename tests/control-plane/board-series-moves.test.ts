import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  moveSeriesPiece, pieceVersion, replaceInput, replacePick, replacePress, seriesMoveSpec, SERIES_MOVE_NOTE,
} from '../../apps/control-plane/api/board/_seriesMoves'
import { moveInput } from '../../apps/control-plane/api/board/_offdayItems'
import { optionSha } from '../../apps/control-plane/api/board/_gate'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler'
import { buildLater, replaceTargets, type LaterInputs } from '../../apps/control-plane/api/board/_later'

// Replacing a day's piece, and Move to… on a series piece (docs/PUBLISH_BOARDS.md). Krish, 13 Nov 2026, on the live
// board: "There is no approve button. I have to click through five different fucking pages for one idea." The
// database's half (nothing reaches a day without his press, a placement supersedes the pick it moved from, one
// transaction) is tests/series-moves-db.mjs on the real migration; this file holds the presses, the routes and the view.

type Body = Record<string, any>
const W = '2026-11-16'
const NOW = new Date('2026-11-13T18:00:00Z') // Friday 13 November, New York
const OLD = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118' // Fri 20's data-centre piece
const NEW = 'c00cd4e0-e1bb-4c60-b36f-cea92897e38c' // The Great Recount
const T1 = '2026-11-13T17:30:20.035Z', T2 = '2026-11-07T17:00:17.358Z'
const piece = (id: string, over: Body = {}) => ({ id, idea: `Piece ${id.slice(0, 4)}`, thesis: null, state: 'drafting', scheduled_for: null, lane_slot: 'mind_the_gap',
  buried_at: null, published_at: null, protected_at: null, meta: {}, updated_at: T1, ...over })
const card = { pick: 'later-c00cd4e0', idea_id: NEW, series: 'mind_the_gap', story: 'The Great Recount. AI finds what we got wrong.', so_what: 'AI checks old work.' }
const sha = optionSha({ so_what: card.so_what, story: card.story })

/** The tables a series move touches, and series_piece_place done the way the migration does it. */
function fakeDb(pieces: Body[], docs: Body[] = []) {
  const t = { content_ideas: structuredClone(pieces), board_documents: structuredClone(docs), series_moves: [] as Body[] }
  const calls: Body[] = []
  function query(table: keyof typeof t) {
    const where: Array<(r: Body) => boolean> = []
    let single = false
    const q: any = {
      select: () => q,
      eq: (k: string, v: unknown) => { where.push(r => String(r[k] ?? '') === String(v)); return q },
      order: () => q, limit: () => q,
      maybeSingle: () => { single = true; return q },
      then: (ok: (v: unknown) => unknown) => Promise.resolve().then(() => {
        const rows = t[table].filter(r => where.every(w => w(r)))
        return { data: single ? structuredClone(rows[0] ?? null) : structuredClone(rows), error: null }
      }).then(ok),
    }
    return q
  }
  const rpc = async (fn: string, args: Body) => {
    if (fn !== 'series_piece_place') return { data: null, error: { message: 'unknown' } }
    const p = args.p
    calls.push(p)
    const snap = structuredClone(t)
    try {
      if (p.actor !== 'Krish') throw new Error('his_press')
      for (const w of p.writes) {
        if (!/^((mon|tue|wed|thu|fri|sat)|place-(mon|tue|wed|thu|fri|sat|sun)-[0-9a-f-]{36})$/.test(w.id)) throw new Error('invalid_move')
        const cur = t.board_documents.find(d => d.week === w.week && d.collection === 'picks' && d.doc_id === w.id)
        if ((cur?.revision ?? 0) !== w.revision) throw new Error(`revision_conflict: ${w.id}`)
        if (cur) Object.assign(cur, { body: w.body, revision: cur.revision + 1, updated_by: 'Krish' })
        else t.board_documents.push({ week: w.week, collection: 'picks', doc_id: w.id, body: w.body, revision: 1, updated_by: 'Krish' })
      }
      // The gate: a new day stands only on his approval for that piece and that date (a pick or a placement).
      const holds = (id: string, date: string) => t.board_documents.some(d => d.updated_by === 'Krish' && (
        (d.doc_id === `place-${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${date}T00:00:00Z`).getUTCDay()]}-${id}` && d.body.placed === true && d.body.date === date)
        || (/^(mon|wed|fri)$/.test(d.doc_id) && d.body.idea_id === id && dateOf(d.week, d.doc_id) === date)))
      for (const x of p.pieces) {
        if (x.to_place === 'alongside') continue
        const r = t.content_ideas.find(c => c.id === x.id)
        if (!r || r.updated_at !== x.updated_at) throw new Error(`stale_piece: ${x.id}`)
        if (x.scheduled_for && !holds(x.id, x.scheduled_for)) throw new Error(`not_approved_by_krish: ${x.id}`)
        Object.assign(r, { scheduled_for: x.scheduled_for, ...(x.state ? { state: x.state } : {}), ...(x.lane_slot ? { lane_slot: x.lane_slot } : {}), updated_at: '2026-11-13T18:00:00.000Z' })
      }
      for (const x of p.pieces) t.series_moves.push({ id: t.series_moves.length + 1, piece_id: x.id, kind: x.kind, from_date: x.from_date, to_date: x.scheduled_for, to_place: x.to_place })
      return { data: { ok: true }, error: null }
    } catch (e) {
      Object.assign(t, snap)
      return { data: null, error: { message: String((e as Error).message) } }
    }
  }
  return { db: { from: (table: keyof typeof t) => query(table), rpc } as never, t, calls }
}
const dateOf = (week: string, day: string) => { const d = new Date(`${week}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(day)); return d.toISOString().slice(0, 10) }
const followed: string[] = []
const deps = { now: NOW, library: { follow: async (id: string) => { followed.push(id); return 'moved' } } }
const fri20Pick = { week: W, collection: 'picks', doc_id: 'fri', revision: 3, updated_by: 'Krish', body: { day: 'fri', pick: 'fri-2', idea_id: OLD, series: 'mind_the_gap' } }
const replaceBody = (to: unknown, over: Body = {}) => ({ day: 'fri', revision: 3, pick: { day: 'fri', ...card, option_sha256: sha }, replaces: { item: `piece:${OLD}`, version: Date.parse(T1) }, current_to: to, ...over })

describe('Move to… on a series piece', () => {
  it('has the same shape as an off-day item\'s move, any day from today through four weeks but Sunday, and says why', () => {
    const spec = seriesMoveSpec(piece(OLD, { scheduled_for: '2026-11-20' }), NOW)!
    expect(spec).toMatchObject({ op: 'move', label: 'Move to…', item: `piece:${OLD}`, version: Date.parse(T1), state: 'approved', from: { week: W, day: 'fri', date: '2026-11-20' },
      later: true, note: SERIES_MOVE_NOTE, body: { item: `piece:${OLD}`, version: Date.parse(T1), from: { week: W, day: 'fri' } } })
    expect(spec.days[0].date).toBe('2026-11-13')
    expect(spec.days.some(d => d.day === 'sun')).toBe(false)
    expect(spec.days.some(d => d.day === 'mon')).toBe(true) // the Tue/Thu/Sat limit does not apply to a series piece
    expect(spec.days.find(d => d.date === '2026-11-20')?.current).toBe(true)
    expect(SERIES_MOVE_NOTE).toMatch(/Tuesday, Thursday and Saturday limit is for a piece recorded on an off day/)
    // A piece that is out, buried or an off-day post does not move here.
    expect(seriesMoveSpec(piece(OLD, { state: 'published' }), NOW)).toBeNull()
    expect(seriesMoveSpec(piece(OLD, { meta: { offday: { doc: 'queue/off-thu-x' } } }), NOW)).toBeNull()
    expect(moveInput(spec.body ? { ...spec.body, to: { date: '2026-11-17' } } : null).input?.item).toBe(`piece:${OLD}`)
  })

  it('moves the piece forward in one write: leaves its day, is approved for the new one, and the library follows', async () => {
    followed.length = 0
    const { db, t, calls } = fakeDb([piece(OLD, { scheduled_for: '2026-11-20' })], [fri20Pick])
    const out = await moveSeriesPiece(db, { item: `piece:${OLD}`, version: Date.parse(T1), from: { week: W, day: 'fri' }, to: { date: '2026-11-17' } }, deps)
    expect(out.status).toBe(200)
    expect(out.body).toMatchObject({ ok: true, state: 'approved', date: '2026-11-17', line: 'Moved to Tue 17 Nov. Approved for that day.', undo: { to: { date: '2026-11-20' }, undo: true } })
    expect(t.content_ideas[0].scheduled_for).toBe('2026-11-17')
    expect(calls[0].writes.map((w: Body) => [w.id, w.body.placed])).toEqual([[`place-fri-${OLD}`, false], [`place-tue-${OLD}`, true]])
    expect(t.series_moves).toMatchObject([{ piece_id: OLD, kind: 'move', from_date: '2026-11-20', to_date: '2026-11-17', to_place: 'day' }])
    expect(followed).toEqual([OLD])
  })

  it('refuses a past day, a Sunday, past four weeks, a stale version and the day it is on; back to later is his File for later', async () => {
    const { db, t } = fakeDb([piece(OLD, { scheduled_for: '2026-11-20' })])
    const go = (to: Body | 'later', version = Date.parse(T1)) => moveSeriesPiece(db, { item: `piece:${OLD}`, version, from: null, to: to as never }, deps)
    expect((await go({ date: '2026-11-12' })).body.error).toBe('out_of_window')
    expect((await go({ date: '2026-11-15' })).body.error).toBe('rest_day')
    expect((await go({ date: '2026-12-14' })).body.error).toBe('out_of_window')
    expect((await go({ date: '2026-11-20' })).body.error).toBe('already_there')
    expect((await go({ date: '2026-11-17' }, 1)).body.error).toBe('stale')
    expect(t.content_ideas[0].scheduled_for).toBe('2026-11-20')
    const later = await go('later')
    expect(later.body).toMatchObject({ ok: true, state: 'later', line: 'Back in your Ideas for Later.' })
    expect(t.content_ideas[0].scheduled_for).toBeNull()
    expect(t.board_documents.find(d => d.doc_id === `place-fri-${OLD}`)!.body).toMatchObject({ placed: false, later: true })
  })
})

describe('Approve on a day that already holds a piece', () => {
  it('says what it replaces and asks where the current piece goes: another day, Ideas for Later, or alongside', () => {
    const press = replacePress({ week: W, day: 'fri', revision: 3, card: { ...card, option_sha256: sha }, current: piece(OLD, { idea: 'OpenAI pledges to pay for data center power', scheduled_for: '2026-11-20' }), now: NOW })
    expect(press.label).toBe('Approve for Fri 20 Nov, replacing OpenAI pledges to pay for data center power')
    expect(press.op).toBe('replace')
    expect(press.choose).toMatchObject({ path: 'current_to', multi: false, required: true })
    const values = press.choose!.options.map(o => o.value)
    expect(values).toContain('2026-11-17')
    expect(values).not.toContain('2026-11-20')
    expect(values.slice(-2)).toEqual(['later', 'alongside'])
    expect(press.choose!.options.at(-1)!.label).toBe('Alongside it on Fri 20 Nov')
    expect(replaceInput({ ...press.body, current_to: ['2026-11-17'] }).input?.current_to).toEqual({ date: '2026-11-17' })
    expect(replaceInput({ ...press.body, current_to: 'later' }).input?.current_to).toBe('later')
    expect(replaceInput({ ...press.body }).problem).toBe('invalid_current_to')
  })

  it('places his new pick and brings the old piece forward in one transaction (the swap on Fri 20 Nov)', async () => {
    followed.length = 0
    const { db, t, calls } = fakeDb([piece(OLD, { scheduled_for: '2026-11-20' }), piece(NEW, { state: 'seeded', updated_at: T2 })], [fri20Pick])
    const out = await replacePick(db, W, replaceInput(replaceBody('2026-11-17')).input!, deps)
    expect(out.status).toBe(200)
    expect(out.body).toMatchObject({ ok: true, date: '2026-11-20', piece: NEW, replaced: { piece: OLD, to: '2026-11-17', place: 'day' } })
    expect(out.body.line).toBe('Approved for Fri 20 Nov. "Piece b019" moved to Tue 17 Nov, approved for that day.')
    expect(t.content_ideas.find(c => c.id === NEW)).toMatchObject({ scheduled_for: '2026-11-20', state: 'drafting', lane_slot: 'mind_the_gap' })
    expect(t.content_ideas.find(c => c.id === OLD)!.scheduled_for).toBe('2026-11-17')
    expect(calls[0]).toMatchObject({ actor: 'Krish', kind: 'replace' })
    expect(calls[0].writes.map((w: Body) => w.id)).toEqual(['fri', `place-fri-${OLD}`, `place-tue-${OLD}`])
    expect(t.board_documents.find(d => d.doc_id === 'fri')!.body).toMatchObject({ idea_id: NEW, option_sha256: sha, replaced: { piece_id: OLD, to: '2026-11-17' } })
    expect(t.series_moves.map(m => [m.piece_id, m.kind, m.to_place])).toEqual([[OLD, 'replaced', 'day'], [NEW, 'replace', 'day']])
    expect(followed.sort()).toEqual([NEW, OLD].sort())
  })

  it('keeps the old piece alongside, or files it for later, and refuses stale or changed words whole', async () => {
    const start = () => fakeDb([piece(OLD, { scheduled_for: '2026-11-20' }), piece(NEW, { state: 'seeded', updated_at: T2 })], [fri20Pick])
    const a = start()
    const along = await replacePick(a.db, W, replaceInput(replaceBody('alongside')).input!, deps)
    expect(along.body).toMatchObject({ ok: true, replaced: { to: '2026-11-20', place: 'alongside' } })
    expect(a.t.content_ideas.map(c => c.scheduled_for)).toEqual(['2026-11-20', '2026-11-20'])
    expect(a.t.board_documents.find(d => d.doc_id === `place-fri-${OLD}`)!.body).toMatchObject({ placed: true, alongside: NEW })
    const l = start()
    expect((await replacePick(l.db, W, replaceInput(replaceBody('later')).input!, deps)).body).toMatchObject({ ok: true, replaced: { to: null, place: 'later' } })
    expect(l.t.content_ideas.find(c => c.id === OLD)!.scheduled_for).toBeNull()
    const s = start()
    const stale = await replacePick(s.db, W, replaceInput(replaceBody('2026-11-17', { replaces: { item: `piece:${OLD}`, version: 1 } })).input!, deps)
    expect(stale.body.error).toBe('stale')
    const words = await replacePick(s.db, W, replaceInput(replaceBody('2026-11-17', { pick: { day: 'fri', ...card, story: 'Other words.', option_sha256: sha } })).input!, deps)
    expect(words.body.error).toBe('changed_words')
    const rev = await replacePick(s.db, W, replaceInput(replaceBody('2026-11-17', { revision: 2 })).input!, deps)
    expect(rev.body.error).toBe('stale')
    expect(s.t.content_ideas.map(c => c.scheduled_for)).toEqual(['2026-11-20', null])
    expect(s.t.series_moves).toEqual([])
  })
})

describe('his presses only', () => {
  const call = async (who: 'krish' | 'operator', op: 'replace' | 'move', body: Body, db: never) => {
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    process.env.ACCESS_CODE = 'synthetic-board-test'
    const handler = createBoardHandler(async () => db, { library: () => null, now: () => NOW.toISOString() } as never)
    let status = 0; let out: Body = {}
    const res = { setHeader() {}, status(c: number) { status = c; return this }, json(v: Body) { out = v; return this }, end() { return this } } as unknown as VercelResponse
    await handler({ method: 'POST', headers: who === 'operator' ? { authorization: 'Bearer synthetic-operator' } : {}, query: { week: W, op }, body } as unknown as VercelRequest, res)
    return { status, out }
  }
  it('refuses a replace, a series move and a placement written by hand for anyone but Krish, and nothing moves', async () => {
    const { db, t, calls } = fakeDb([piece(OLD, { scheduled_for: '2026-11-20' }), piece(NEW, { state: 'seeded', updated_at: T2 })], [fri20Pick])
    expect(await call('operator', 'replace', replaceBody('2026-11-17'), db)).toMatchObject({ status: 403, out: { error: 'his_press' } })
    expect(await call('operator', 'move', { item: `piece:${OLD}`, version: Date.parse(T1), from: null, to: { date: '2026-11-17' } }, db)).toMatchObject({ status: 403, out: { error: 'his_press' } })
    expect(calls).toEqual([])
    expect(t.content_ideas.map(c => c.scheduled_for)).toEqual(['2026-11-20', null])
    // The database refuses any other actor too.
    const refused = await (db as { rpc: (f: string, a: Body) => Promise<{ error: { message: string } | null }> }).rpc('series_piece_place', { p: { actor: 'engine_operator', kind: 'move', writes: [], pieces: [] } })
    expect(refused.error?.message).toMatch(/his_press/)
    const src = readFileSync(new URL('../../apps/control-plane/api/board/_handler.ts', import.meta.url), 'utf8')
    expect(src).toContain("'place_is_its_own_press'")
    const routed = JSON.parse(readFileSync(new URL('../../apps/control-plane/vercel.json', import.meta.url), 'utf8'))
    expect(JSON.stringify(routed)).toContain('"source":"/api/board/:week/replace","destination":"/api/board?week=:week&op=replace"')
  })
})

describe('Ideas for Later', () => {
  it('offers an Approve onto every held date of its weekday, saying what it replaces (Fri 20 Nov, The Great Recount)', () => {
    const i = { now: NOW, boards: [], docs: [fri20Pick], outcomes: [], cues: [], pieces: [],
      approvals: { [W]: [{ idea_id: OLD, day: 'fri', date: '2026-11-20', via: 'pick', doc: 'picks/fri', option_ref: null, revision: 3, decided_at: 'x', option_sha256: null, words: null, source: 'publish_board' }],
        '2026-11-23': [], '2026-11-30': [], '2026-12-07': [] },
      on_days: [piece(OLD, { scheduled_for: '2026-11-20', idea: 'OpenAI pledges to pay for data center power' })] } as unknown as LaterInputs
    const targets = replaceTargets(i, 'fri', NEW, '2026-11-13')
    expect(targets.map(x => [x.date, String(x.piece.id)])).toEqual([['2026-11-20', OLD]])
    expect(replaceTargets(i, 'fri', OLD, '2026-11-13')).toEqual([])
    expect(pieceVersion(targets[0].piece)).toBe(Date.parse(T1))
    expect(typeof buildLater).toBe('function')
  })
})
