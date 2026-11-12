import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  dayOptions, elsewhereLines, followDrive, growthItems, libraryFixes, moveDays, moveInput, moveItem, postFolderName, todayIn, type DriveRenamer, type OffdayItem,
} from '../../apps/control-plane/api/board/_offdayItems'
import { offdaySides } from '../../apps/control-plane/api/board/_offdaySides'
import { buildView, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { readPieces } from '../../apps/control-plane/api/board/_posted'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler'
import { validBody } from '../../apps/control-plane/api/board/_contracts'
import { approvedAll } from './_approvals'

// Moving an off-day item to any day (docs/PUBLISH_BOARDS.md, "Moving an off-day item to any day"). Ruling (Krish,
// 2026-11-12): any off-day post or idea moves to any day at his press, and the move updates every place that names its
// day. The database's half (no day without his press, a move whole or not at all, Growth never over his row) is
// tests/offday-items-db.mjs on the real migration; this file holds the one write, the view, Growth's read, the post's
// folder in Drive, the research library and what Growth still has scheduled.

type Body = Record<string, any>
const W1 = '2026-11-16', W2 = '2026-11-23'
const NOW = new Date('2026-11-12T15:00:00Z') // Thursday 12 November, New York
const POSTS = '17KdbFrZXKmGXkCaMpmntRD9rrAhnWkcT'
const FOLDER = 'F'.repeat(33)
const option = (id: string, extra: Body = {}) => ({ id, format: 'Meme, 2 panels, 4:5', copy: `Option ${id}`, source: 'Content Inspo', ...extra })
const PLAN: Record<string, Body> = {
  [W1]: { offdays: { tue: [option('burntokens', { drive: `https://drive.google.com/drive/folders/${FOLDER}` }), option('fuelgauge')], thu: [option('swarmdeal')], sat: [option('goodnews', { weekly: 'good_news' })] } },
  [W2]: { offdays: { thu: [option('ownref')] } },
}
const row = (over: Partial<OffdayItem>): OffdayItem => ({ item: `engine:${W1}:burntokens`, source: 'engine', origin_week: W1, option_id: 'burntokens', option: option('burntokens'),
  state: 'approved', week: W1, day: 'tue', date: '2026-11-17', doc: 'queue/off-tue-burntokens', piece_id: null, drive_folder: null, scheduled: [], followed: {}, version: 1,
  placed_by: 'Krish', placed_at: '2026-11-10T10:00:00Z', ...over })

// ── An in-memory engine database: the tables a move and its readers touch, and the two functions they call ──────────
interface Tables { offday_items: Body[]; offday_moves: Body[]; board_documents: Body[]; content_ideas: Body[] }
function fakeDb(start: Partial<Tables> = {}) {
  const t: Tables = { offday_items: [], offday_moves: [], board_documents: [], content_ideas: [], ...structuredClone(start) }
  const calls: Array<{ fn: string; p: Body }> = []
  const like = (v: unknown, pat: string) => new RegExp(`^${pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`).test(String(v ?? ''))
  function query(table: keyof Tables) {
    const where: Array<(r: Body) => boolean> = []
    let patch: Body | null = null, limit = Infinity, desc: string | null = null, single = false
    const q: any = {
      select: () => q, update: (v: Body) => { patch = v; return q },
      eq: (k: string, v: unknown) => { where.push(r => String(r[k] ?? '') === String(v)); return q },
      neq: (k: string, v: unknown) => { where.push(r => String(r[k] ?? '') !== String(v)); return q },
      in: (k: string, vs: unknown[]) => { where.push(r => vs.map(String).includes(String(r[k]))); return q },
      gte: (k: string, v: string) => { where.push(r => String(r[k] ?? '') >= v); return q },
      lte: (k: string, v: string) => { where.push(r => String(r[k] ?? '') <= v); return q },
      like: (k: string, v: string) => { where.push(r => like(r[k], v)); return q },
      or: (f: string) => { const parts = f.split(',').map(x => x.split('.')); where.push(r => parts.some(([k, op, ...v]) => op === 'eq' ? String(r[k] ?? '') === v.join('.') : like(r[k], v.join('.')))); return q },
      order: (k: string, o: { ascending: boolean }) => { if (!o.ascending) desc = k; return q },
      limit: (n: number) => { limit = n; return q },
      maybeSingle: () => { single = true; return q },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve().then(() => {
        let rows = t[table].filter(r => where.every(w => w(r)))
        if (patch) { for (const r of rows) Object.assign(r, structuredClone(patch)); return { data: null, error: null } }
        if (desc) rows = [...rows].sort((a, b) => Number(b[desc!]) - Number(a[desc!]))
        rows = rows.slice(0, limit)
        return { data: single ? structuredClone(rows[0] ?? null) : structuredClone(rows), error: null }
      }).then(ok, bad),
    }
    return q
  }
  const approvalsNow = (week: string) => t.board_documents.filter(d => d.week === week && d.collection === 'queue' && /^off-/.test(d.doc_id) && d.updated_by === 'Krish'
    && (d.body.idea?.verdict === 'approve' || d.body.approved === true))
    .map(d => ({ idea_id: d.doc_id, day: d.doc_id.slice(4, 7), date: dateOf(week, d.doc_id.slice(4, 7)), via: 'offday', doc: `queue/${d.doc_id}`, option_ref: d.doc_id, revision: d.revision,
      decided_at: '2026-11-12T15:00:00Z', option_sha256: null, words: null, source: 'publish_board' }))
  const save = (w: Body) => {
    const cur = t.board_documents.find(d => d.week === w.week && d.collection === 'queue' && d.doc_id === w.id)
    if ((cur?.revision ?? 0) !== w.revision) throw new Error(`revision_conflict: ${w.id}`)
    if (cur) Object.assign(cur, { body: w.body, revision: cur.revision + 1, updated_by: 'Krish' })
    else t.board_documents.push({ week: w.week, collection: 'queue', doc_id: w.id, body: w.body, revision: 1, updated_by: 'Krish' })
  }
  const rpc = async (fn: string, args: Body) => {
    calls.push({ fn, p: args.p ?? args })
    if (fn === 'board_approvals_now') return { data: approvalsNow(args.p_week), error: null }
    if (fn !== 'offday_item_move') return { data: null, error: { message: 'unknown function' } }
    const p = args.p
    const snapshot = structuredClone(t)
    try {
      if (p.actor !== 'Krish') throw new Error('his_press')
      const r = t.offday_items.find(x => x.item === p.item)
      if ((r?.version ?? 0) !== p.version) return { data: { ok: false, error: 'stale', version: r?.version ?? 0 }, error: null }
      for (const w of p.writes) save(w)
      const place = p.place ? { week: p.place.week, day: p.place.day, date: dateOf(p.place.week, p.place.day), doc: p.state === 'later' ? null : `queue/off-${p.place.day}-${p.option_id}` }
        : { week: null, day: null, date: null, doc: null }
      if (p.state === 'approved' && !approvalsNow(place.week!).some(a => a.doc === place.doc)) throw new Error(`not_approved_by_krish: ${p.item}`)
      const version = (r?.version ?? 0) + 1
      if (r) Object.assign(r, { state: p.state, ...place, option: p.option ?? r.option, version, drive_folder: p.drive_folder ?? r.drive_folder, placed_by: 'Krish' })
      else t.offday_items.push({ item: p.item, source: p.source, origin_week: p.origin_week, option_id: p.option_id, option: p.option, state: p.state, ...place, piece_id: p.piece_id ?? null,
        drive_folder: p.drive_folder ?? null, scheduled: [], followed: {}, version, placed_by: 'Krish', placed_at: 'x' })
      t.offday_moves.push({ id: t.offday_moves.length + 1, item: p.item, version, from_state: r?.state ?? null, from_week: r?.week ?? null, from_day: r?.day ?? null, from_date: r?.date ?? null, to_state: p.state })
      return { data: { ok: true, version, ...place, state: p.state }, error: null }
    } catch (e) {
      Object.assign(t, snapshot)
      return { data: null, error: { message: String((e as Error).message) } }
    }
  }
  return { db: { from: (table: keyof Tables) => query(table), rpc } as never, t, calls }
}
const dateOf = (week: string, day: string) => { const d = new Date(`${week}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(day)); return d.toISOString().slice(0, 10) }
const approveDoc = (week: string, day: string, id: string, extra: Body = {}) => {
  const s = offdaySides(PLAN[week].offdays[day].find((o: Body) => o.id === id))
  return { week, collection: 'queue', doc_id: `off-${day}-${id}`, revision: 1, updated_by: 'Krish',
    body: { pick: `off-${day}-${id}`, use: 'offday', day, week, option_id: id, format: s.format, source: s.source, copy_sha256: s.copy_sha256,
      idea: { verdict: 'approve', words: null, sha256: s.idea_sha256, at: 'x', shown: s.shown_idea }, ...extra } }
}
function fakeDrive(name: string, parents = [POSTS]) {
  const f = { id: FOLDER, name, parents, trashed: false }
  const renamed: string[] = []
  const drive: DriveRenamer = { folder: async id => (id === FOLDER ? { ...f } : null), rename: async (_id, n) => { renamed.push(n); f.name = n } }
  return { drive, f, renamed }
}
const deps = (over: Body = {}) => ({ now: NOW, ideas: async (w: string) => PLAN[w] ?? null, drive: null, library: null, ...over })

describe('the one place an off-day item\'s day lives', () => {
  it('draws the plan\'s options minus what moved away, plus what moved here and Growth\'s own', () => {
    const items = [row({ state: 'approved', week: W1, day: 'thu', date: '2026-11-19', doc: 'queue/off-thu-burntokens' }),
      row({ item: `growth:${W1}:aiintern`, source: 'growth', option_id: 'aiintern', option: option('aiintern', { by: 'growth' }), state: 'offered', week: W1, day: 'tue', date: '2026-11-17', doc: 'queue/off-tue-aiintern' })]
    const tue = dayOptions(PLAN[W1], items, W1, 'tue'), thu = dayOptions(PLAN[W1], items, W1, 'thu')
    expect(tue.map(x => [x.o.id, x.placed.state, x.placed.source])).toEqual([['fuelgauge', 'slate', 'engine'], ['aiintern', 'offered', 'growth']])
    expect(thu.map(x => [x.o.id, x.placed.state, x.placed.version])).toEqual([['swarmdeal', 'slate', 0], ['burntokens', 'approved', 1]])
    // Moved within its own week, it keeps the plan's words, and its Drive folder rides with it.
    expect(thu[1].o.drive).toBe(`https://drive.google.com/drive/folders/${FOLDER}`)
    // The one place cannot be read: the plan's options as they are, and nothing offers a move.
    expect(dayOptions(PLAN[W1], null, W1, 'tue').map(x => [x.o.id, x.placed.state])).toEqual([['burntokens', 'unknown'], ['fuelgauge', 'unknown']])
  })

  it('offers every day from today through the next four weeks: never a past day, never a Sunday', () => {
    const days = moveDays(NOW, { current: '2026-11-17' })
    expect(todayIn(NOW)).toBe('2026-11-12')
    expect(days[0]).toEqual({ date: '2026-11-12', week: '2026-11-09', day: 'thu', label: 'Thu 12 Nov' })
    expect(days[days.length - 1].date).toBe('2026-12-10')
    expect(days.some(d => d.day === 'sun')).toBe(false)
    expect(days.filter(d => d.current)).toEqual([{ date: '2026-11-17', week: W1, day: 'tue', label: 'Tue 17 Nov', current: true }])
    // A series day is any day too (Krish, 2026-11-12: a publishing day can carry off-day posts).
    expect(days.some(d => d.day === 'mon') && days.some(d => d.day === 'wed') && days.some(d => d.day === 'fri')).toBe(true)
    expect(moveDays(NOW, { onlyWeek: W1 }).map(d => d.day)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
    expect(new Set(moveDays(NOW, { recorded: true }).map(d => d.day))).toEqual(new Set(['tue', 'thu', 'sat']))
  })

  it('reads the press as the board sends it, and nothing else', () => {
    expect(moveInput({ item: `engine:${W1}:burntokens`, version: 0, from: { week: W1, day: 'tue' }, to: { date: '2026-11-26' } }).input?.to).toEqual({ date: '2026-11-26' })
    expect(moveInput({ item: `engine:${W1}:burntokens`, version: 2, from: null, to: 'later' }).input?.to).toBe('later')
    for (const bad of [null, { item: 'burntokens', version: 0, to: 'later' }, { item: `engine:${W1}:x`, version: -1, to: 'later' }, { item: `engine:${W1}:x`, version: 0, to: { date: 'soon' } },
      { item: `engine:${W1}:x`, version: 0, from: { week: '2026-11-17', day: 'tue' }, to: 'later' }]) expect(moveInput(bad).input).toBeUndefined()
  })
})

describe('a move, the one write', () => {
  it('moves an idea he never pressed onto any day: that move is his Approve for that day, and Undo puts it back', async () => {
    const { db, t, calls } = fakeDb()
    const out = await moveItem(db, { item: `engine:${W1}:fuelgauge`, version: 0, from: { week: W1, day: 'tue' }, to: { date: '2026-11-25' } }, deps())
    expect(out.status).toBe(200)
    expect(out.body).toMatchObject({ ok: true, state: 'approved', week: W2, day: 'wed', date: '2026-11-25', line: 'Moved to Wed 25 Nov. Approved for that day.' })
    const move = calls.find(c => c.fn === 'offday_item_move')!.p
    // Nothing to take off Tuesday (he never approved it there); his Approve for Wednesday, bound to the words shown.
    expect(move.writes.map((w: Body) => [w.week, w.id])).toEqual([[W2, 'off-wed-fuelgauge']])
    const arrive = move.writes[0].body
    expect(arrive.idea).toMatchObject({ verdict: 'approve', sha256: offdaySides(option('fuelgauge')).idea_sha256 })
    expect(arrive.moved).toEqual({ from_week: W1, from_day: 'tue', at: NOW.toISOString() })
    // The press it saves is a body the board itself would accept.
    expect(validBody('queue', 'off-wed-fuelgauge', arrive)).toBe(true)
    expect(t.offday_items[0]).toMatchObject({ state: 'approved', week: W2, day: 'wed', version: 1 })
    // Undo: back to an idea offered on Tuesday, his approval for Wednesday taken back.
    const undo = await moveItem(db, moveInput(out.body.undo).input!, deps())
    expect(undo.body).toMatchObject({ ok: true, state: 'offered', week: W1, day: 'tue' })
    const back = t.board_documents.find(d => d.doc_id === 'off-wed-fuelgauge')!
    expect(back.body.idea.verdict).toBeNull()
    expect(back.body.moved).toEqual({ to_week: W1, to_day: 'tue', at: NOW.toISOString() })
  })

  it('moves an approved post to another week: his approval leaves the old day and lands on the new one, his direction, mock and note with it', async () => {
    const doc = approveDoc(W1, 'tue', 'burntokens', { direction: { verdict: 'approve', words: null, sha256: 'd'.repeat(64), at: 'x', shown: { look: 'Black ground' } },
      note: { words: 'WHEN YOUR AI BURNS TOKENS', at: 'x' } })
    const { db, t } = fakeDb({ offday_items: [row({})], board_documents: [doc] })
    const out = await moveItem(db, { item: `engine:${W1}:burntokens`, version: 1, from: { week: W1, day: 'tue' }, to: { date: '2026-11-26' } }, deps())
    expect(out.body).toMatchObject({ ok: true, version: 2, week: W2, day: 'thu', weeks: [W1, W2] })
    const left = t.board_documents.find(d => d.week === W1 && d.doc_id === 'off-tue-burntokens')!
    expect([left.body.idea.verdict, left.body.moved.to_day, left.revision]).toEqual([null, 'thu', 2])
    const arrived = t.board_documents.find(d => d.week === W2 && d.doc_id === 'off-thu-burntokens')!
    expect(arrived.body.direction.shown).toEqual({ look: 'Black ground' })
    expect(arrived.body.note.words).toBe('WHEN YOUR AI BURNS TOKENS')
    expect(validBody('queue', 'off-thu-burntokens', arrived.body)).toBe(true)
  })

  it('refuses a move on an old version, a Sunday, a past day, a day past four weeks, and a day whose plan already has the idea', async () => {
    const { db, calls } = fakeDb({ offday_items: [row({ version: 3 })], board_documents: [approveDoc(W1, 'tue', 'burntokens')] })
    const go = (to: Body, version = 3) => moveItem(db, { item: `engine:${W1}:burntokens`, version, from: { week: W1, day: 'tue' }, to: to as never }, deps())
    expect((await go({ date: '2026-11-19' }, 2)).body).toMatchObject({ ok: false, error: 'stale', version: 3 })
    expect((await go({ date: '2026-11-22' })).body).toMatchObject({ error: 'rest_day', line: 'Sunday is a rest day.' })
    expect((await go({ date: '2026-11-11' })).body.error).toBe('out_of_window')
    expect((await go({ date: '2026-12-11' })).body.error).toBe('out_of_window')
    expect((await go({ date: '2026-11-17' })).body.error).toBe('already_there')
    const plan = { ...PLAN, [W2]: { offdays: { thu: [option('burntokens')] } } }
    expect((await moveItem(db, { item: `engine:${W1}:burntokens`, version: 3, from: { week: W1, day: 'tue' }, to: { date: '2026-11-26' } }, deps({ ideas: async (w: string) => plan[w] }))).body.error).toBe('day_has_it')
    expect(calls.filter(c => c.fn === 'offday_item_move')).toEqual([])
    // A week's good news stays in its week.
    const gn = fakeDb()
    expect((await moveItem(gn.db, { item: `engine:${W1}:goodnews`, version: 0, from: { week: W1, day: 'sat' }, to: { date: '2026-11-26' } }, deps())).body.error).toBe('weekly_stays')
    expect((await moveItem(gn.db, { item: `engine:${W1}:goodnews`, version: 0, from: { week: W1, day: 'sat' }, to: { date: '2026-11-20' } }, deps())).status).toBe(200)
  })

  it('goes back to his Ideas for Later as his File for later, and from there onto any day', async () => {
    const { db, t } = fakeDb({ offday_items: [row({})], board_documents: [approveDoc(W1, 'tue', 'burntokens')] })
    const later = await moveItem(db, { item: `engine:${W1}:burntokens`, version: 1, from: { week: W1, day: 'tue' }, to: 'later' }, deps())
    expect(later.body).toMatchObject({ ok: true, state: 'later', week: null, line: 'Back in your Ideas for Later.' })
    expect(t.board_documents[0].body.idea.verdict).toBe('next_week')
    const back = await moveItem(db, { item: `engine:${W1}:burntokens`, version: 2, from: null, to: { date: '2026-11-28' } }, deps())
    expect(back.body).toMatchObject({ ok: true, state: 'approved', date: '2026-11-28' })
    expect(t.board_documents.find(d => d.doc_id === 'off-sat-burntokens')!.body.moved).toEqual({ from: 'later', at: NOW.toISOString() })
  })

  it('is his press only: the route refuses anyone else, and a move with no Approve for the new day changes nothing', async () => {
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    process.env.ACCESS_CODE = 'synthetic-board-test'
    const { db, t, calls } = fakeDb({ offday_items: [row({})], board_documents: [approveDoc(W1, 'tue', 'burntokens')] })
    const handler = createBoardHandler(async () => db, { ideas: async (w: string) => PLAN[w] ?? null, renamer: () => null, library: () => null })
    let status = 0; let out: Body = {}
    const res = { setHeader() {}, status(c: number) { status = c; return this }, json(v: Body) { out = v; return this }, end() { return this } } as unknown as VercelResponse
    await handler({ method: 'POST', headers: { authorization: 'Bearer synthetic-operator' }, query: { week: W1, op: 'move' },
      body: { item: `engine:${W1}:burntokens`, version: 1, from: { week: W1, day: 'tue' }, to: { date: '2026-11-26' } } } as unknown as VercelRequest, res)
    expect([status, out.error]).toEqual([403, 'his_press'])
    expect(calls).toEqual([])
    // The database refuses a move that would leave a day without his approval for it (no Approve written for Thursday).
    const refused = await (db as { rpc: (f: string, a: Body) => Promise<{ error: { message: string } | null }> }).rpc('offday_item_move', { p: { item: `engine:${W1}:burntokens`, version: 1, actor: 'Krish',
      state: 'approved', option_id: 'burntokens', place: { week: W2, day: 'thu' }, writes: [] } })
    expect(refused.error?.message).toMatch(/not_approved_by_krish/)
    expect(t.offday_items[0]).toMatchObject({ day: 'tue', version: 1 })
    const routed = JSON.parse(readFileSync(new URL('../../apps/control-plane/vercel.json', import.meta.url), 'utf8'))
    for (const op of ['move', 'offdays', 'scheduled']) expect(JSON.stringify(routed)).toContain(`"source":"/api/board/:week/${op}","destination":"/api/board?week=:week&op=${op}"`)
  })
})

describe('every place that names the day follows the one place', () => {
  it('moves a post and reads its day back from the view, Growth\'s read, its Drive folder, the library and what is still scheduled', async () => {
    const doc = approveDoc(W1, 'tue', 'burntokens')
    const { db, t } = fakeDb({ offday_items: [row({ drive_folder: FOLDER, scheduled: [{ channel: 'instagram', due_at: '2026-11-17T17:30:00Z', buffer_post_id: 'b1', state: 'scheduled' }] })], board_documents: [doc] })
    const { drive, renamed } = fakeDrive('2026-11-17 Tue off.day - Burn tokens')
    const followed: string[] = []
    const out = await moveItem(db, { item: `engine:${W1}:burntokens`, version: 1, from: { week: W1, day: 'tue' }, to: { date: '2026-11-26' } },
      deps({ drive, library: { follow: async (p: string) => { followed.push(p); return 'updated:1' } } }))
    expect(out.status).toBe(200)
    // 1. The one place.
    expect(t.offday_items[0]).toMatchObject({ week: W2, day: 'thu', date: '2026-11-26', doc: 'queue/off-thu-burntokens', version: 2 })
    // 2. The live board: gone from Tuesday of its week, on Thursday of the next, with its press to move it again.
    const view = (week: string) => buildView({ week, now: NOW, pieces: [], picks: [], history: [], runs: {}, north_star: null, locks: {}, ideas: PLAN[week] ?? null,
      queue: t.board_documents.filter(d => d.week === week).map(d => ({ doc_id: d.doc_id, body: d.body, updated_by: d.updated_by, revision: d.revision })),
      approvals: [], items: t.offday_items.map(r => ({ ...r })) as OffdayItem[] } as ViewInputs)
    const optionsOn = (week: string, day: string) => view(week).days.find(d => d.day === day)!.options.map(o => o.id)
    expect(optionsOn(W1, 'tue')).toEqual(['fuelgauge'])
    expect(optionsOn(W2, 'thu')).toEqual(['ownref', 'burntokens'])
    const moved = view(W2).days.find(d => d.day === 'thu')!.options.find(o => o.id === 'burntokens')!
    expect(moved.move).toMatchObject({ op: 'move', item: `engine:${W1}:burntokens`, version: 2, from: { week: W2, day: 'thu', date: '2026-11-26' } })
    expect(moved.move!.days.find(d => d.current)?.date).toBe('2026-11-26')
    // 3. Growth's read of what to make on which day: on Thursday of the next week, never on Tuesday.
    const pieces = async (week: string) => (await readPieces(db, week)).body.offdays as Body[]
    expect(await pieces(W1)).toEqual([])
    expect((await pieces(W2)).map(o => [o.id, o.day, o.date, o.item, o.version, o.moved_from])).toEqual([['off-thu-burntokens', 'thu', '2026-11-26', `engine:${W1}:burntokens`, 2, { week: W1, day: 'tue' }]])
    // 4. Its post's folder in Drive: renamed to its new date by its ID, so it files under its new week.
    expect(renamed).toEqual(['2026-11-26 Thu off.day - Burn tokens'])
    expect(out.body.followed).toMatchObject({ drive: 'renamed' })
    // 5. The research library follows a piece he records; this post has none.
    expect(followed).toEqual([])
    // 6. What Growth already scheduled for Tuesday is said plainly until Growth moves it.
    expect(out.body.elsewhere).toEqual(['Still scheduled for Tue 17 on Instagram: move it there too'])
    expect(moved.elsewhere).toEqual(['Still scheduled for Tue 17 on Instagram: move it there too'])
  })

  it('a piece he records moves its research rows in the library index too', async () => {
    const P = '9b6e5a10-3c55-4f1e-8a1d-2f0c6a7b8c9d'
    const s = offdaySides(option('rec', { kind: 'recorded' }))
    const rec = { week: W1, collection: 'queue', doc_id: 'off-tue-rec', revision: 1, updated_by: 'Krish',
      body: { pick: 'off-tue-rec', use: 'offday', day: 'tue', week: W1, option_id: 'rec', kind: 'recorded', piece_id: P, approved: true, copy_sha256: s.copy_sha256,
        series: 'mind_the_gap', style: 'to_camera', script: 'Words.', script_sha256: 'e'.repeat(64), folder_title: 'Rec', title: 'Rec' } }
    const { db } = fakeDb({ offday_items: [row({ item: `engine:${W1}:rec`, option_id: 'rec', option: option('rec', { kind: 'recorded' }), doc: 'queue/off-tue-rec', piece_id: P })], board_documents: [rec] })
    const followed: string[] = []
    const plan = { ...PLAN, [W1]: { offdays: { tue: [option('rec', { kind: 'recorded' })] } } }
    const go = (date: string) => moveItem(db, { item: `engine:${W1}:rec`, version: 1, from: { week: W1, day: 'tue' }, to: { date } },
      deps({ ideas: async (w: string) => plan[w] ?? null, library: { follow: async (p: string) => { followed.push(p); return 'updated:2' } } }))
    expect((await go('2026-11-18')).body.error).toBe('recorded_days')
    const out = await go('2026-11-19')
    expect(out.body.followed).toMatchObject({ library: 'updated:2' })
    expect(followed).toEqual([P])
    // The rows the library's index names it by take the new week, day and date.
    const values = [['Week', 'Day', 'Piece', 'Series', 'Kind', 'Title', 'Date added', 'Drive link', 'sha256', 'Version', 'Added by', 'Piece id', 'Material id'],
      [W1, 'Tue', 'Tue 17 Nov mind.the.gap - Rec (9b6e5a10)', '', 'research', 'Notes', '', '', '', '1', '', P, 'm1'],
      [W1, 'Mon', 'Other', '', 'research', 'Other', '', '', '', '1', '', 'another', 'm2']]
    expect(libraryFixes(values, 1, P, [W1, 'Thu', 'Thu 19 Nov mind.the.gap - Rec (9b6e5a10)'])).toEqual([{ row: 2, cells: [W1, 'Thu', 'Thu 19 Nov mind.the.gap - Rec (9b6e5a10)'] }])
  })

  it('renames a post\'s folder by its date only, never one outside 3 Posts, and keeps it when the post goes back to later', async () => {
    expect(postFolderName('2026-11-12 Thu off.day - AI agent not set up', '2026-11-19')).toBe('2026-11-19 Thu off.day - AI agent not set up')
    expect(postFolderName('2026-11-12 off.day - Meme', '2026-11-17')).toBe('2026-11-17 Tue off.day - Meme')
    expect(postFolderName('Meme ideas', '2026-11-17')).toBeNull()
    expect(await followDrive(fakeDrive('2026-11-17 Tue off.day - X').drive, FOLDER, '2026-11-17')).toBe('already')
    expect(await followDrive(fakeDrive('2026-11-17 Tue off.day - X', ['elsewhere']).drive, FOLDER, '2026-11-19')).toBe('outside_posts')
    expect(await followDrive(fakeDrive('2026-11-17 Tue off.day - X').drive, FOLDER, null)).toBe('kept')
    expect(await followDrive(null, FOLDER, '2026-11-19')).toBe('not_configured')
  })

  it('says a post Growth scheduled for a day it left, and nothing once Growth moved it', () => {
    const r = row({ week: W2, day: 'thu', date: '2026-11-26', scheduled: [{ channel: 'tiktok', due_at: '2026-11-17T22:30:00Z', state: 'scheduled' }, { channel: 'instagram', due_at: '2026-11-26T17:30:00Z', state: 'scheduled' }] })
    expect(elsewhereLines(r, NOW)).toEqual(['Still scheduled for Tue 17 on TikTok: move it there too'])
    expect(elsewhereLines({ ...r, scheduled: [{ channel: 'tiktok', due_at: '2026-11-17T22:30:00Z', state: 'moved' }] }, NOW)).toEqual([])
    expect(elsewhereLines({ ...r, state: 'later', week: null, day: null, date: null }, NOW)).toEqual(['Still scheduled for Tue 17 on TikTok: take it off there too', 'Still scheduled for Thu 26 on Instagram: take it off there too'])
  })
})

describe('Growth hands its options over through the one place', () => {
  it('reads Growth\'s growth-offdays file into offered items: never a Sunday, never the plan\'s own option, its kind and source kept', () => {
    const file = { schema: 'growth-offdays/1', week_of: W1, days: {
      '2026-11-17': [{ concept_id: 'meme-ai-intern', lane: 'memes', formats: ['instagram:image', 'x:image'], source_url: 'https://example.org/a', draft: 'The AI intern asks for a raise.', share_line: 'Send it to your boss', needs: [], ready: true },
        { concept_id: 'burntokens', lane: 'memes', formats: [], draft: 'Clash' }],
      '2026-11-22': [{ concept_id: 'sunday-one', lane: 'memes', formats: [], draft: 'Rest' }] } }
    const { items, left } = growthItems(W1, file, PLAN[W1])
    expect(items).toEqual([{ item: `growth:${W1}:meme-ai-intern`, option_id: 'meme-ai-intern', day: 'tue', drive_folder: null, option: expect.objectContaining({
      id: 'meme-ai-intern', format: 'instagram:image, x:image', source: { label: 'Source', url: 'https://example.org/a' }, copy: 'The AI intern asks for a raise.', lane: 'memes', by: 'growth' }) }])
    expect(left).toEqual([{ id: 'burntokens', why: 'the_plans_own' }, { id: 'sunday-one', why: 'rest_day' }])
    expect(growthItems(W2, file, null).problem).toBe('wrong_week')
  })

  it('takes Growth\'s options on Growth\'s key only, and gives Growth back where every item is', async () => {
    process.env.GROWTH_WRITEBACK_TOKEN = 'synthetic-growth'
    const offered: Body[] = []
    const { db, t } = fakeDb({ offday_items: [row({})] })
    const withOffer = { ...db as object, rpc: async (fn: string, a: Body) => { if (fn === 'offday_items_offer') { offered.push(a); return { data: { ok: true, offered: a.p_items.length }, error: null } } return (db as any).rpc(fn, a) } }
    const handler = createBoardHandler(async () => withOffer as never, { ideas: async (w: string) => PLAN[w] ?? null })
    const call = async (auth: string, method: string, op: string, body?: Body) => {
      let status = 0; let out: Body = {}
      const res = { setHeader() {}, status(c: number) { status = c; return this }, json(v: Body) { out = v; return this } } as unknown as VercelResponse
      await handler({ method, headers: auth ? { authorization: auth } : {}, query: { week: W1, op }, body } as unknown as VercelRequest, res)
      return { status, out }
    }
    expect((await call('', 'POST', 'offdays', {})).status).toBe(401)
    const posted = await call('Bearer synthetic-growth', 'POST', 'offdays', { schema: 'growth-offdays/2', week: W1, options: [{ id: 'meme-ai-intern', day: 'thu', copy: 'The AI intern.', format: 'Meme' }] })
    expect(posted).toMatchObject({ status: 200, out: { ok: true, offered: 1 } })
    expect(offered[0]).toMatchObject({ p_week: W1, p_source: 'growth', p_items: [{ item: `growth:${W1}:meme-ai-intern`, day: 'thu' }] })
    const read = await call('Bearer synthetic-growth', 'GET', 'offdays')
    expect(read.out.items).toEqual([{ item: `engine:${W1}:burntokens`, source: 'engine', option_id: 'burntokens', state: 'approved', week: W1, day: 'tue', date: '2026-11-17',
      doc: 'queue/off-tue-burntokens', version: 1, scheduled: [], moved: false }])
    // What Growth has scheduled for an item, as Growth reports it.
    const sched = await call('Bearer synthetic-growth', 'POST', 'scheduled', { posts: [{ option: 'off-tue-burntokens', channel: 'instagram', due_at: '2026-11-17T17:30:00Z', buffer_post_id: 'b1' }] })
    expect(sched.out).toEqual({ ok: true, items: 1, unknown: 0 })
    expect(t.offday_items[0].scheduled).toEqual([{ channel: 'instagram', due_at: '2026-11-17T17:30:00.000Z', buffer_post_id: 'b1', state: 'scheduled' }])
  })
})

describe('the frozen week still draws', () => {
  it('a view with no items read offers no move, and the plan\'s options as they are', () => {
    const v = buildView({ week: W1, now: NOW, pieces: [], picks: [], queue: [], history: [], runs: {}, north_star: null, locks: {}, ideas: PLAN[W1], approvals: approvedAll(W1, []) } as ViewInputs)
    const tue = v.days.find(d => d.day === 'tue')!.options
    expect(tue.map(o => o.id)).toEqual(['burntokens', 'fuelgauge'])
    expect(tue.every(o => o.move === undefined && o.item === undefined)).toBe(true)
    expect(v.sources.items).toBe(false)
  })
})
