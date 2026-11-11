import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildView, viewProblems, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { fillPress, type PressAction } from '../../apps/control-plane/api/board/_viewExtras'
import { validBody, hisOnlyRefusal } from '../../apps/control-plane/api/board/_contracts'
import { HELD_CHANGED, HELD_TITLE, OUTCOMES, approvedWhen, asSentence, optionSha } from '../../apps/control-plane/api/board/_gate'
import { afterPress, ideaReport, placePick, preparePress, PressError } from '../../apps/control-plane/api/board/_presses'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler'
import { approval } from './_approvals'

// The ideas gate (docs/PUBLISH_BOARDS.md, "The ideas gate"). Krish, 2026-11-11: "Once I've completed it, ideas should
// either be: filed away for later, rejected and learnt from, saved as a trend for a wider piece, improved for a future
// piece cue. If they're approved, they should move into the publish board. ... I shouldn't end up seeing random ideas in
// the publish board that I never wanted there and that I didn't approve to move to the publish board."
//
// The database's half (every writer refused without his approval, an approval never reused for another idea or day, the
// ledger append only) is tests/ideas-gate-db.mjs, on the real migration. This file holds the view, the presses, the
// routes and the run that fills the board.

type Body = Record<string, any>
const WEEK = '2026-11-16'
const MON = '8287846b-6618-4a19-9fb8-23ad4eca2718', WED = 'db9f9f6a-1092-49be-8024-f335e060305a', OTHER = '941c3147-a010-4ac5-a7bf-0bdd67c2a323'
const piece = (id: string, date: string, slot: string, extra: Body = {}) =>
  ({ id, idea: `Piece ${id.slice(0, 4)}. It says one thing.`, scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, body: '', updated_at: '2026-11-09T12:00:00Z', meta: {}, ...extra })
const MON_OPTION = { id: MON, so_what: 'Oracle is raising $20 billion more to build for AI.', story: 'Headline: Oracle borrows to build. Hook: "$20 billion."' }
const inputs = (over: Partial<ViewInputs> = {}): ViewInputs => ({
  week: WEEK, now: new Date('2026-11-12T09:00:00Z'),
  pieces: [piece(MON, '2026-11-16', 'follow_the_money'), piece(WED, '2026-11-18', 'under_the_hood')],
  picks: [], queue: [], history: [], runs: {}, north_star: null, locks: {},
  ideas: { days: { mon: [MON_OPTION, { id: OTHER, so_what: 'IT buyers ask for lower prices.', story: 'Headline: You use AI now.' }] }, offdays: { tue: [], thu: [], sat: [] } },
  approvals: [approval(WEEK, 'mon', MON, { option_sha256: optionSha({ so_what: MON_OPTION.so_what, story: MON_OPTION.story }), decided_at: '2026-11-09T13:07:48Z' })],
  ...over,
})
const day = (v: ReturnType<typeof buildView>, d: string) => v.days.find(x => x.day === d)!

describe('the view draws only what his approval holds, and names every other piece as held', () => {
  it('draws an approved piece with "Approved by you" and when, and holds one with no approval, never hiding it', () => {
    const v = buildView(inputs())
    const mon = day(v, 'mon'), wed = day(v, 'wed')
    expect(mon.piece_id).toBe(MON)
    expect(mon.pieces).toEqual([expect.objectContaining({ id: MON, approval: { at: '2026-11-09T13:07:48Z', label: 'Approved by you, Mon 9 Nov, 08:07', via: 'pick' } })])
    expect(mon.detail[0]).toEqual({ h: 'Approved by you', p: 'Mon 9 Nov, 08:07' })
    expect(mon.held).toEqual([])
    // Wednesday's piece is on its day in the database, but nothing he pressed put it there.
    expect(wed.piece_id).toBeNull()
    expect(wed.pieces).toEqual([])
    expect(wed.held).toEqual([{ piece_id: WED, option: null, title: HELD_TITLE, text: 'Piece db9f. It says one thing. Nothing you pressed on the ideas board put it on this day.' }])
    expect(wed.who).toBe('you')
    expect(wed.next).toMatch(/^One idea is held: not approved by you/)
    // One press approves exactly that piece for exactly that day, as an Approve on the ideas board does.
    const press = wed.actions[0] as PressAction
    expect(press).toMatchObject({ kind: 'press', collection: 'picks', id: 'wed', outcome: 'approved', label: 'Approve "Piece db9f. It says one thing." for Wednesday 18 Nov' })
    expect(press.body).toMatchObject({ day: 'wed', idea_id: WED, series: 'under_the_hood' })
    const { id, body } = fillPress(press, '', '2026-11-12T10:00:00Z')
    expect(validBody('picks', id, body)).toBe(true)
    expect(viewProblems(v)).toEqual([])
  })

  it('holds every piece when his approvals cannot be read: nothing is shown as approved on a guess', () => {
    const v = buildView(inputs({ approvals: null }))
    expect(v.days.flatMap(d => d.pieces)).toEqual([])
    expect(day(v, 'mon').held[0].text).toMatch(/could not be read/)
    expect(v.sources.approvals).toBe(false)
  })

  it('never reuses an approval for another idea, another day, or words changed since he approved them', () => {
    // An approval for Monday's idea does not hold another idea placed on Monday, or Monday's idea on Wednesday.
    const swapped = buildView(inputs({ pieces: [piece(OTHER, '2026-11-16', 'follow_the_money'), piece(MON, '2026-11-18', 'under_the_hood')] }))
    expect(swapped.days.flatMap(d => d.pieces)).toEqual([])
    expect(day(swapped, 'mon').held.map(h => h.piece_id)).toEqual([OTHER])
    expect(day(swapped, 'wed').held.map(h => h.piece_id)).toEqual([MON])
    // The option's words on the ideas board changed after his Approve: the approval binds the words he saw.
    const changed = buildView(inputs({ ideas: { days: { mon: [{ ...MON_OPTION, so_what: 'Oracle is raising money. A session rewrote this.' }] } } }))
    expect(day(changed, 'mon').pieces).toEqual([])
    expect(day(changed, 'mon').held).toEqual([expect.objectContaining({ piece_id: MON, title: HELD_CHANGED })])
    // An approval saved before 11 November bound no words: it holds, and nothing pretends it was checked.
    const older = buildView(inputs({ approvals: [approval(WEEK, 'mon', MON)], ideas: { days: { mon: [{ ...MON_OPTION, so_what: 'Rewritten.' }] } } }))
    expect(day(older, 'mon').pieces.map(p => p.id)).toEqual([MON])
  })

  it('gives every idea five outcomes, each a press saying where it goes, and an approved idea none other', () => {
    const v = buildView(inputs({ pieces: [], approvals: [] }))
    const opt = day(v, 'mon').options[0]
    expect(opt.status).toBe('open')
    expect(opt.outcome).toBeNull()
    expect(opt.actions.map(a => [a.outcome, a.label])).toEqual([
      ['approved', 'Approve for Monday 16 Nov'], ['filed', 'File for later'], ['rejected', 'Reject'], ['trend', 'Save as a trend'], ['improved', 'Improve for a future piece']])
    expect(opt.actions.map(a => a.goes)).toEqual([
      "Goes onto the publish board for Monday 16 November as the day's piece.",
      "Filed with today's date. It comes back on a later ideas board, or when you ask for it.",
      'Rejected. Your reason is kept as a cue the next ideas run reads, and goes to your taste ledger in your words.',
      'Kept with the trend you name, for a wider piece.',
      'Kept with your note as a cue for a future piece.'])
    // A reason is required to reject, a trend's name to save it as one, a note to improve it.
    expect(opt.actions.map(a => a.words?.required ?? null)).toEqual([false, false, true, true, true])
    for (const a of opt.actions) {
      const { id, body } = fillPress(a, a.words?.required ? 'His words.' : '', '2026-11-12T10:00:00Z')
      expect(validBody(a.collection!, id, body), a.label).toBe(true)
    }
    // Every press binds the words he saw.
    expect(opt.actions.every(a => a.body.option_sha256 === optionSha({ so_what: MON_OPTION.so_what, story: MON_OPTION.story }))).toBe(true)
    // Approved: the day's piece, the idea says so with when, and it carries no other press.
    const approved = day(buildView(inputs()), 'mon').options[0]
    expect(approved.status).toBe('approved')
    expect(approved.outcome).toEqual({ id: 'approved', label: 'Approved by you, Mon 9 Nov, 08:07', at: '2026-11-09T13:07:48Z', words: null })
    expect(approved.actions).toEqual([])
    // His earlier answers read as the outcome they became: Track it over time is a trend.
    const queued = day(buildView(inputs({ queue: [{ doc_id: 'mon-2', updated_by: 'Krish', body: { pick: 'mon-2', use: 'track_over_time', queued: true, at: '2026-11-09T13:06:22Z' } }] })), 'mon').options[1]
    expect(queued.outcome).toMatchObject({ id: 'trend', label: OUTCOMES.trend })
    expect(Object.values(OUTCOMES)).toEqual(['Approved', 'Filed for later', 'Rejected and learnt from', 'Saved as a trend for a wider piece', 'Improved for a future piece'])
  })

  it('ends a held line\'s title with one full stop, never two', () => {
    expect(asSentence('Good things AI did this week.')).toBe('Good things AI did this week.')
    expect(asSentence('Which one started as an AI demo?')).toBe('Which one started as an AI demo?')
    expect(asSentence(' Oracle borrows to build ')).toBe('Oracle borrows to build.')
  })

  it('says his time of approval in his own time zone', () => {
    expect(approvedWhen('2026-11-09T13:07:48Z')).toBe('Mon 9 Nov, 08:07')
    expect(approvedWhen('2026-11-03T06:52:52Z')).toBe('Tue 3 Nov, 01:52')
  })
})

describe('only his press approves, and his Approve puts exactly that idea on its day', () => {
  it('refuses a pick or a press from anyone but Krish', () => {
    for (const who of ['engine_operator', null]) {
      expect(hisOnlyRefusal('picks', { day: 'mon', pick: 'mon-1', idea_id: MON, story: 's' }, who)).toBe('pick_is_his')
      expect(hisOnlyRefusal('queue', { pick: 'mon-1', use: 'improve', queued: true, note: 'x' }, who)).toBe('press_is_his')
      expect(hisOnlyRefusal('queue', { pick: 'off-tue-x', use: 'offday', day: 'tue', idea: { verdict: 'approve', sha256: 'a'.repeat(64) } }, who)).toBe('press_is_his')
    }
    expect(hisOnlyRefusal('picks', { day: 'mon', pick: 'mon-1', idea_id: MON, story: 's' }, 'Krish')).toBeNull()
  })

  it('binds the hash of the words he saw, and refuses a press that brings another hash', async () => {
    const body = { day: 'mon', pick: 'mon-1', idea_id: MON, series: 'follow_the_money', story: MON_OPTION.story, so_what: MON_OPTION.so_what }
    const sha = optionSha({ so_what: MON_OPTION.so_what, story: MON_OPTION.story })
    expect((await preparePress('picks', 'mon', body)).option_sha256).toBe(sha)
    expect((await preparePress('picks', 'mon', { ...body, option_sha256: sha })).option_sha256).toBe(sha)
    await expect(preparePress('picks', 'mon', { ...body, option_sha256: 'f'.repeat(64) })).rejects.toBeInstanceOf(PressError)
    await expect(preparePress('queue', 'mon-1', { pick: 'mon-1', use: 'not_for_us', queued: true, reason: 'x', ...body, option_sha256: 'f'.repeat(64) })).rejects.toBeInstanceOf(PressError)
  })

  it('places the idea it names on its day, and says so when the database finds no approval', async () => {
    const row = { id: MON, state: 'seeded', scheduled_for: null, lane_slot: null, buried_at: null, protected_at: null, updated_at: 'u1' }
    const db = (refuse = false, current: Body = row) => {
      const writes: Body[] = []
      const q: any = {
        select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: current, error: null }),
        update: (u: Body) => { writes.push(u); const w: any = { eq: () => w, select: async () => (refuse ? { data: null, error: { message: 'not_approved_by_krish: x goes on the publish board ...' } } : { data: [{ id: MON }], error: null }) }; return w },
      }
      return { db: { from: () => q } as never, writes }
    }
    const ok = db()
    expect(await placePick(ok.db, { week: WEEK, day: 'mon', body: { idea_id: MON, series: 'follow_the_money' }, now: '2026-11-12T10:00:00Z' })).toEqual({ status: 'placed', date: '2026-11-16' })
    expect(ok.writes[0]).toMatchObject({ scheduled_for: '2026-11-16', state: 'drafting', lane_slot: 'follow_the_money', protected_at: '2026-11-12T10:00:00Z' })
    const refused = await placePick(db(true).db, { week: WEEK, day: 'mon', body: { idea_id: MON, series: 'follow_the_money' }, now: 'n' })
    expect(refused).toEqual({ status: 'refused', date: '2026-11-16', error: 'the database found no approval of yours for it on this day' })
    // A piece already on another day stays there: he decides, nothing moves it.
    const elsewhere = await placePick(db(false, { ...row, state: 'drafting', scheduled_for: '2026-11-11' }).db, { week: WEEK, day: 'mon', body: { idea_id: MON }, now: 'n' })
    expect(elsewhere.status).toBe('refused')
    expect(elsewhere.error).toMatch(/already on 2026-11-11/)
    expect(await placePick(db().db, { week: WEEK, day: 'mon', body: { idea_id: null }, now: 'n' })).toMatchObject({ status: 'refused' })
  })

  it('places only on his own press, through the board route', async () => {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    const placed: Body[] = []
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: MON, state: 'seeded', scheduled_for: null, updated_at: 'u' }, error: null }),
      update: (u: Body) => { placed.push(u); const w: any = { eq: () => w, select: async () => ({ data: [{ id: MON }], error: null }) }; return w } }
    const fake = { from: () => q, rpc: async (_n: string, a: Body) => ({ data: { ok: true, revision: 1, body: a.p_body }, error: null }) }
    const handler = createBoardHandler(async () => fake as never, { now: () => '2026-11-12T10:00:00Z' })
    const put = async (who: 'krish' | 'operator') => {
      let status = 0; let out: any
      const res = { setHeader() {}, status(c: number) { status = c; return this }, json(v: unknown) { out = v } } as unknown as VercelResponse
      const headers = who === 'krish' ? { cookie, origin: 'https://controlcenter.krishraja.com' } : { authorization: 'Bearer synthetic-operator' }
      await handler({ method: 'PUT', headers, query: { week: WEEK, collection: 'picks', id: 'mon' }, body: { body: { day: 'mon', pick: 'mon-1', idea_id: MON, series: 'follow_the_money', story: 's', so_what: 'w' }, revision: 0 } } as unknown as VercelRequest, res)
      return { status, out }
    }
    expect(await put('operator')).toMatchObject({ status: 403, out: { error: 'pick_is_his' } })
    expect(placed).toEqual([])
    const his = await put('krish')
    expect(his.status).toBe(200)
    expect(his.out.placed).toEqual({ status: 'placed', date: '2026-11-16' })
    expect(placed).toHaveLength(1)
  })

  it('sends his reason on a Reject, and his note on an Improve, to his taste ledger in his own words', async () => {
    const body = { pick: 'mon-2', use: 'not_for_us', queued: true, reason: 'We did this last month.', idea_id: OTHER, so_what: 'IT buyers ask for lower prices.' }
    const r = ideaReport(WEEK, 'mon-2', body, '2026-11-12T10:00:00Z')!
    expect(r).toMatchObject({ kind: 'krish_words', body: 'We did this last month.', lane: 'strategy', polarity: 'dislikes', subject_ref: `idea:${OTHER}`,
      said_where: `publish board, ${WEEK} queue/mon-2 (an idea on the ideas board)`, meta: { outcome: 'rejected' } })
    expect(r.client_report_id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,95}$/)
    expect(ideaReport(WEEK, 'mon-2', { ...body, use: 'improve', note: 'Find the person it happened to.' }, 'n')!.meta.outcome).toBe('improved')
    expect(ideaReport(WEEK, 'mon-2', { ...body, use: 'next_week' }, 'n')).toBeNull()
    const filed: Body[] = []
    const db = { from: () => ({ upsert: async (row: Body) => { filed.push(row); return { error: null } } }) }
    const out = await afterPress(db as never, { week: WEEK, collection: 'queue', id: 'mon-2', body, who: 'Krish', saved: { ok: true, revision: 1 } })
    expect(out).toMatchObject({ taste: 'filed' })
    expect(filed[0].body).toBe('We did this last month.')
    expect(await afterPress(db as never, { week: WEEK, collection: 'queue', id: 'mon-2', body, who: 'engine_operator', saved: { ok: true } })).toBeNull()
  })
})

describe('the next ideas run reads his answers as cues', () => {
  it('gives it the latest answer on each idea of the weeks before, grouped by outcome, his words as said', async () => {
    const { vi } = await import('vitest')
    vi.resetModules()
    vi.doMock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
    const { readOutcomes } = await import('../../apps/control-plane/api/week/options')
    const rows = [
      { id: 9, week: '2026-11-09', day: 'fri', date: '2026-11-13', idea_id: 'a', option_ref: 'fri-4', doc: 'queue/fri-4', outcome: 'withdrawn', words: null, decided_at: '2026-11-03T07:00:00Z' },
      { id: 8, week: '2026-11-09', day: 'fri', date: '2026-11-13', idea_id: 'a', option_ref: 'fri-4', doc: 'queue/fri-4', outcome: 'improved', words: 'Find the person.', decided_at: '2026-11-03T06:59:00Z' },
      { id: 7, week: '2026-11-09', day: 'wed', date: '2026-11-11', idea_id: 'b', option_ref: 'wed-4', doc: 'queue/wed-4', outcome: 'rejected', words: 'We did this.', decided_at: '2026-11-03T06:50:23Z' },
      { id: 6, week: '2026-11-09', day: 'wed', date: '2026-11-11', idea_id: 'c', option_ref: 'wed-1', doc: 'queue/wed-1', outcome: 'trend', words: null, decided_at: '2026-11-03T06:49:40Z' },
      { id: 5, week: '2026-11-09', day: 'thu', date: '2026-11-12', idea_id: 'off-thu-x', option_ref: 'off-thu-x', doc: 'queue/off-thu-x', outcome: 'filed', words: null, decided_at: '2026-11-03T06:56:52Z' },
      { id: 4, week: '2026-11-09', day: 'wed', date: '2026-11-11', idea_id: 'd', option_ref: 'wed-2', doc: 'picks/wed', outcome: 'approved', words: null, decided_at: '2026-11-03T06:49:11Z' },
    ]
    const asked: unknown[] = []
    const q: any = { select: () => q, gte: (...a: unknown[]) => { asked.push(['gte', ...a]); return q }, lt: (...a: unknown[]) => { asked.push(['lt', ...a]); return q },
      order: () => q, limit: async () => ({ data: rows, error: null }) }
    const out = await readOutcomes('2026-11-16', { from: () => q } as never)
    expect(asked).toEqual([['gte', 'week', '2026-09-21'], ['lt', 'week', '2026-11-16']])
    expect(out.empty).toBeNull()
    // The improve was taken back, so it is not a cue; the approval is the publish board's, not a cue.
    expect(out.block.improved).toEqual([])
    expect(out.block.rejected).toEqual([{ week: '2026-11-09', day: 'wed', idea_id: 'b', option: 'wed-4', said: 'We did this.', at: '2026-11-03T06:50:23Z' }])
    expect(out.block.trend.map(r => r.idea_id)).toEqual(['c'])
    expect(out.block.filed.map(r => r.idea_id)).toEqual(['off-thu-x'])
    const down: any = { select: () => down, gte: () => down, lt: () => down, order: () => down, limit: async () => ({ data: null, error: { message: 'relation does not exist' } }) }
    expect((await readOutcomes('2026-11-16', { from: () => down } as never)).empty).toMatch(/could not be read/)
    vi.doUnmock('../../apps/control-plane/api/_supabase.js')
  })
})

describe('every route that sets a date meets the gate', () => {
  it('the engine\'s schedule route refuses a date without his approval, and the database\'s refusal too', async () => {
    const holds: Body[] = []
    let approved = false, dbRefuses = false
    const updated: Body[] = []
    const fake = {
      rpc: async (name: string, args: Body) => { holds.push({ name, args }); return { data: approved, error: null } },
      from: () => ({ update: (u: Body) => { updated.push(u); const w: any = { eq: () => w, select: () => w, single: async () => (dbRefuses ? { data: null, error: { message: 'not_approved_by_krish: ...' } } : { data: { id: MON, scheduled_for: u.scheduled_for }, error: null }) }; return w } }),
    }
    const { vi } = await import('vitest')
    vi.resetModules()
    vi.doMock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: fake }))
    vi.doMock('../../apps/control-plane/api/_auth.js', () => ({ guardEngine: () => false }))
    const handler = (await import('../../apps/control-plane/api/content-ideas/[id]/schedule')).default
    const call = async (date: string | null) => {
      let status = 0; let out: any
      const res = { status(c: number) { status = c; return this }, json(v: unknown) { out = v; return this } } as unknown as VercelResponse
      await handler({ method: 'POST', query: { id: MON }, body: { date } } as unknown as VercelRequest, res)
      return { status, out }
    }
    expect(await call('2026-11-16')).toMatchObject({ status: 409, out: { error: 'not_approved_by_krish' } })
    expect(updated).toEqual([])
    expect(holds[0]).toEqual({ name: 'board_approval_holds', args: { p_idea: MON, p_date: '2026-11-16', p_offday_doc: null } })
    approved = true
    expect((await call('2026-11-16')).status).toBe(200)
    // The database refuses a write the route let through (an approval taken back in between): said, never a 500.
    dbRefuses = true
    expect(await call('2026-11-16')).toMatchObject({ status: 409, out: { error: 'not_approved_by_krish' } })
    // Taking a piece off its day is never refused.
    approved = false; dbRefuses = false
    expect((await call(null)).status).toBe(200)
    vi.doUnmock('../../apps/control-plane/api/_supabase.js')
    vi.doUnmock('../../apps/control-plane/api/_auth.js')
  })

  it('the migration gates every writer in the database, and records answers only from his saved presses', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/20261126090000_ideas_gate.sql', import.meta.url), 'utf8')
    expect(sql).toMatch(/create trigger content_ideas_board_gate before insert or update on public\.content_ideas/)
    expect(sql).toMatch(/create trigger idea_outcomes_from_history after insert on public\.board_history/)
    expect(sql).toMatch(/h\.updated_by = 'Krish'/)
    expect(sql).toMatch(/create trigger idea_outcomes_no_change before update or delete on public\.idea_outcomes/)
  })

  it('the run that fills the ideas board can propose but has no route that places: the board\'s link is the live board\'s', () => {
    const wf = readFileSync(new URL('../../.github/workflows/sunday-ideas.yml', import.meta.url), 'utf8')
    expect(wf).toMatch(/Saturday good news/)
    expect(wf).toMatch(/never put one on the publish board/)
    // Its tools: the engine scripts and the plan folder; any date it sets meets the route above and the database.
    expect(wf).not.toMatch(/Bash\(curl/)
  })
})
