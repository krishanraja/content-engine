import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { THUMB_CHECKS, setDigest } from '../../apps/control-plane/api/_thumbOptions.js'
import { ThumbError, criticLine, dayThumbs, fileThumbLearning, nextThumbs, saveThumbs, thumbDriveIds, thumbInboxRow, thumbPick, thumbReport, thumbsPress } from '../../apps/control-plane/api/board/_thumbs.js'
import { sampleDrive, sampleFiles, sampleUrl } from '../../apps/control-plane/api/board/_style.js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// A piece's thumbnail options on the Content board with his pick (view contract 1.16.0; Ruling, Krish, 2026-11-15,
// approved with the specialists plan: thumbnail options carry a pick press on the Content board). The view carries the
// options and the grid mock as same-site Drive file paths; Pick and Not this land on the making record bound to the
// set's hash; a set no longer on the record is refused with the making route's own 409.

type Body = Record<string, any>
const PIECE = '8287846b-6618-4a19-9fb8-23ad4eca2718'
const WEEK = '2026-11-16'
const NOW = '2026-11-16T09:00:00.000Z'
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const did = (s: string) => `1Drive${s}${'x'.repeat(26 - s.length)}`
const OPTIONS = (['a', 'b', 'c'] as const).map(id => ({ id, note: `Option ${id}`,
  files: (['wide', 'tall'] as const).map(shape => ({ shape, file: `options/${id}/thumb-${shape}-${shape === 'wide' ? '1280x720' : '1080x1920'}.jpg`, sha256: sha(`${id}${shape}`), drive_id: did(`${id}${shape}`) })) }))
const checks = (fail?: string) => Object.fromEntries(THUMB_CHECKS.map(k => [k, k === fail ? 'fail' : 'pass']))
const SET = {
  set_sha256: setDigest(OPTIONS), drawn_at: NOW, skin: 'receipt', headline: 'Voters said no', options: OPTIONS,
  grid_mock: { sha256: sha('mock'), past_read: 5, note: 'Beside the last five covers.', drive_id: did('mock') },
  verdict: { reviewer: 'thumbnail-critic', reviewed_at: NOW, best: 'b', blocking: false, options: OPTIONS.map(o => ({ id: o.id, files: o.files.map(f => ({ file: f.file, sha256: f.sha256 })),
    checks: checks(o.id === 'c' ? 'logos_named' : undefined), blocking: o.id === 'c', findings: o.id === 'c' ? ['block: logos_named: a logo the headline does not name'] : [] })) },
  at: NOW, by: 'Claude Code',
}
const ROW = { id: PIECE, idea: 'A piece', scheduled_for: WEEK, lane_slot: 'follow_the_money', updated_at: NOW, meta: { making: { thumbnail_options: SET } } }
const withSet = (set: Body) => ({ ...ROW, meta: { making: { thumbnail_options: set } } })
const refused = (f: () => unknown) => { try { f(); return null } catch (e) { return e instanceof ThumbError ? [e.status, e.message] : e } }

describe('the view: thumbs on a day', () => {
  it('carries a judged set: each file a same-site Drive path with its sha256, the critic\'s line, Pick on what it does not hold, Not this on the set', () => {
    const t = dayThumbs(WEEK, ROW)!
    expect(t.state).toBe('awaits_pick')
    expect(t.options.map(o => [o.id, o.files.map(f => f.shape), o.critic.best, o.critic.blocking, Boolean(o.press)])).toEqual([
      ['a', ['tall', 'wide'], false, false, true], ['b', ['tall', 'wide'], true, false, true], ['c', ['tall', 'wide'], false, true, false]])
    expect(t.options[0].files[0]).toEqual({ shape: 'tall', src: `/api/board/${WEEK}/drive/${did('atall')}`, drive: { file_id: did('atall'), url: `https://drive.google.com/file/d/${did('atall')}/view` }, sha256: sha('atall') })
    expect(t.options[2].critic.line).toBe('Held by the critic. A logo the headline does not name.')
    expect(t.options[1].press).toEqual({ kind: 'press', label: 'Pick', op: 'thumb-pick', body: { piece_id: PIECE, set_sha256: SET.set_sha256, verdict: 'pick', option: 'b' }, stamp: [],
      done: 'Picked. Option B is the thumbnail; a session files it with the cuts.' })
    expect(t.not_this).toMatchObject({ label: 'Not this', op: 'thumb-pick', body: { piece_id: PIECE, set_sha256: SET.set_sha256, verdict: 'not_this' }, words: { path: 'words', required: false } })
    expect(t.grid_mock).toMatchObject({ src: `/api/board/${WEEK}/drive/${did('mock')}`, past_read: 5 })
    expect(t.answer).toBeNull()
  })

  it('leads the piece with Pick the thumbnail: the options the critic did not hold, its pick first', () => {
    const p = thumbsPress(dayThumbs(WEEK, ROW))!
    expect(p).toMatchObject({ label: 'Pick the thumbnail', op: 'thumb-pick', body: { piece_id: PIECE, set_sha256: SET.set_sha256, verdict: 'pick' } })
    expect(p.body.option).toBeUndefined()
    expect(p.choose).toEqual({ path: 'option', ask: 'Which thumbnail?', multi: false, required: true, options: [{ value: 'b', label: "Option B (the critic's pick)" }, { value: 'a', label: 'Option A' }] })
  })

  it('carries no press until every file is in Drive, and none of a set the critic has not judged or holds back whole', () => {
    const noCopy = { ...SET, options: SET.options.map((o, k) => (k ? o : { ...o, files: o.files.map(f => ({ ...f, drive_id: undefined })) })) }
    const t = dayThumbs(WEEK, withSet(noCopy))!
    expect([t.state, t.not_this, t.options.every(o => !o.press), t.options[0].files[0].src]).toEqual(['not_in_drive', null, true, null])
    expect(thumbsPress(t)).toBeNull()
    expect(dayThumbs(WEEK, withSet({ ...SET, verdict: undefined }))).toBeNull()
    expect(dayThumbs(WEEK, withSet({ ...SET, verdict: { ...SET.verdict, blocking: true } }))).toBeNull()
    expect(dayThumbs(WEEK, { ...ROW, meta: {} })).toBeNull()
  })

  it('says his answer once it is there, with no press', () => {
    const picked = dayThumbs(WEEK, withSet({ ...SET, pick: { option: 'b', files: OPTIONS[1].files, decision: 'picked on the board', at: NOW, by: 'Krish' } }))!
    expect([picked.state, picked.line, picked.answer, picked.not_this, picked.options.some(o => o.press)]).toEqual(['picked', 'You picked option B on the board. A session files it with the cuts.',
      { said: 'picked', option: 'b', how: 'picked on the board', words: null, at: NOW }, null, false])
    const redraw = dayThumbs(WEEK, withSet({ ...SET, redraw: { decision: 'not this: draw them again', words: 'Too busy.', at: NOW, by: 'Krish' } }))!
    expect([redraw.state, redraw.answer?.words]).toEqual(['redraw', 'Too busy.'])
  })

  it('says each option in one line: held, all seven, or how many pass with its first note', () => {
    const v = (findings: string[], blocking = false, fail?: string) => ({ id: 'a', files: [], checks: checks(fail) as any, blocking, findings })
    expect(criticLine(v([]))).toBe('Passes all 7 checks.')
    expect(criticLine(v(['fix: readable_at_grid: the second line is small'], false, 'readable_at_grid'))).toBe('Passes 6 of 7 checks. The second line is small.')
    expect(criticLine(v(['note: other: nice crop']))).toBe('Passes 7 of 7 checks. Nice crop.')
    expect(criticLine(undefined)).toBe('Not judged.')
  })

  it('serves only the Drive ids its days show: each option\'s files and the mock', () => {
    const ids = thumbDriveIds([ROW, { id: 'x', meta: {} }])
    expect(ids.size).toBe(7)
    expect(ids.has(did('mock'))).toBe(true)
    expect(thumbDriveIds([withSet({ ...SET, verdict: undefined })]).size).toBe(0)
  })
})

describe('his press', () => {
  it('takes the set he saw, and Pick with an option or Not this with his words if he gave any', () => {
    expect(thumbPick({ set_sha256: SET.set_sha256.toUpperCase(), verdict: 'pick', option: 'B' })).toEqual({ set_sha256: SET.set_sha256, verdict: 'pick', option: 'b', words: null })
    expect(thumbPick({ set_sha256: SET.set_sha256, verdict: 'not_this', words: '  Too busy.  ' })).toEqual({ set_sha256: SET.set_sha256, verdict: 'not_this', option: null, words: 'Too busy.' })
    expect(thumbPick({ set_sha256: SET.set_sha256, verdict: 'not_this' }).words).toBeNull()
    expect(refused(() => thumbPick({ set_sha256: 'x', verdict: 'pick', option: 'a' }))).toEqual([400, 'invalid_set'])
    expect(refused(() => thumbPick({ set_sha256: SET.set_sha256, verdict: 'maybe' }))).toEqual([400, 'invalid_verdict'])
    expect(refused(() => thumbPick({ set_sha256: SET.set_sha256, verdict: 'pick', option: 'd' }))).toEqual([400, 'invalid_option'])
  })

  it('records his pick on the making record, bound to the set and that option\'s files, as his own decision at his press time', () => {
    const next = nextThumbs(ROW.meta.making, { set_sha256: SET.set_sha256, verdict: 'pick', option: 'b', words: null }, NOW)
    expect(next.already).toBe(false)
    expect(next.making.thumbnail_options.pick).toEqual({ option: 'b', files: OPTIONS[1].files, decision: 'picked on the board', at: NOW, by: 'Krish' })
    expect(next.making.thumbnail_options.pick.krish_words).toBeUndefined()
    expect(next.making.thumbnail_options.verdict).toEqual(SET.verdict)
    expect([next.making.updated_at, next.making.by]).toEqual([NOW, 'Krish'])
  })

  it('records Not this as a redraw, with his words', () => {
    const next = nextThumbs(ROW.meta.making, { set_sha256: SET.set_sha256, verdict: 'not_this', option: null, words: 'Too busy.' }, NOW)
    expect(next.making.thumbnail_options.redraw).toEqual({ decision: 'not this: draw them again', words: 'Too busy.', at: NOW, by: 'Krish' })
    expect(next.making.thumbnail_options.pick).toBeUndefined()
  })

  it('refuses a stale set with the making route\'s own 409, an option the critic held, and a second, different answer', () => {
    const stale = { set_sha256: sha('another set'), verdict: 'pick' as const, option: 'a', words: null }
    expect(refused(() => nextThumbs(ROW.meta.making, stale, NOW))).toEqual([409, 'thumbnail_options_unbound'])
    expect(refused(() => nextThumbs(ROW.meta.making, { ...stale, verdict: 'not_this', option: null }, NOW))).toEqual([409, 'thumbnail_options_unbound'])
    expect(refused(() => nextThumbs({ thumbnail_options: { ...SET, verdict: undefined } }, { ...stale, set_sha256: SET.set_sha256 }, NOW))).toEqual([409, 'thumbnail_options_unbound'])
    expect(refused(() => nextThumbs(ROW.meta.making, { set_sha256: SET.set_sha256, verdict: 'pick', option: 'c', words: null }, NOW))).toEqual([409, 'option_held_by_critic'])
    const picked = nextThumbs(ROW.meta.making, { set_sha256: SET.set_sha256, verdict: 'pick', option: 'b', words: null }, NOW).making
    expect(nextThumbs(picked, { set_sha256: SET.set_sha256, verdict: 'pick', option: 'b', words: null }, '2026-11-16T10:00:00Z')).toMatchObject({ already: true, answer: { option: 'b', at: NOW } })
    expect(refused(() => nextThumbs(picked, { set_sha256: SET.set_sha256, verdict: 'pick', option: 'a', words: null }, NOW))).toEqual([409, 'thumbnails_answered'])
    expect(refused(() => nextThumbs(picked, { set_sha256: SET.set_sha256, verdict: 'not_this', option: null, words: null }, NOW))).toEqual([409, 'thumbnails_answered'])
  })
})

/** content_ideas with one row, and the learning tables. */
function fakeDb(row: Body, landBetween = 0) {
  const state = { row: JSON.parse(JSON.stringify(row)) as Body, writes: 0, upserts: [] as Array<[string, Body]> }
  const db = {
    from: (table: string) => {
      const filters: Array<[string, unknown]> = []
      let update: Body | null = null
      const match = () => filters.every(([k, v]) => state.row[k] === v)
      const q: any = {
        select: () => q, eq: (k: string, v: unknown) => { filters.push([k, v]); return q }, gte: () => q, lte: () => q, in: () => q, limit: () => q,
        update: (u: Body) => { update = u; return q },
        upsert: (v: Body) => { state.upserts.push([table, v]); return Promise.resolve({ data: null, error: null }) },
        single: async () => (match() ? { data: JSON.parse(JSON.stringify(state.row)), error: null } : { data: null, error: { message: 'none' } }),
        maybeSingle: async () => ({ data: match() ? JSON.parse(JSON.stringify(state.row)) : null, error: null }),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          if (!update) return Promise.resolve({ data: [JSON.parse(JSON.stringify(state.row))], error: null }).then(resolve, reject)
          if (landBetween > 0) { landBetween--; state.row = { ...state.row, updated_at: `2026-11-16T09:00:0${landBetween}Z` } }
          const ok = match()
          if (ok) { state.row = { ...state.row, ...update }; state.writes++ }
          return Promise.resolve({ data: ok ? [{ id: state.row.id }] : [], error: null }).then(resolve, reject)
        },
      }
      return q
    },
  }
  return { db, state }
}

describe('the write', () => {
  it('lands on the making record, keeping a write that lands in between', async () => {
    const { db, state } = fakeDb(ROW, 1)
    const saved = await saveThumbs(db as never, PIECE, { set_sha256: SET.set_sha256, verdict: 'pick', option: 'a', words: null }, new Date(NOW))
    expect(saved).toMatchObject({ already: false, headline: 'Voters said no', answer: { said: 'picked', option: 'a' } })
    expect(state.row.meta.making.thumbnail_options.pick.option).toBe('a')
    expect(state.writes).toBe(1)
  })
})

describe('what a Not this teaches', () => {
  const PLACE = { week: WEEK, date: WEEK, pieceId: PIECE, set: SET.set_sha256, headline: 'Voters said no' }
  it('goes to his taste ledger and the rejection inbox as his own words, once, and nothing without words', async () => {
    expect(thumbReport(PLACE, 'Too busy.', NOW)).toMatchObject({ kind: 'krish_words', body: 'Too busy.', said_where: `publish board, ${WEEK} mon, thumbnail options: Not this on the set`,
      polarity: 'dislikes', subject_ref: `piece:${PIECE}`, emitter_id: 'content-engine-board', meta: { press: 'thumbs_not_this', set_sha256: SET.set_sha256 } })
    expect(thumbInboxRow(PLACE, 'Too busy.', NOW)).toMatchObject({ kind: 'rejected', said: 'Too busy.', formats: ['thumbnail'], master_drive_id: null, whole_cut: false })
    expect(thumbReport(PLACE, 'Too busy.', NOW)!.client_report_id).toBe(thumbReport(PLACE, 'Too busy.', '2026-11-17T00:00:00Z')!.client_report_id)
    expect(thumbReport(PLACE, null, NOW)).toBeNull()
    const { db, state } = fakeDb(ROW)
    expect(await fileThumbLearning(db as never, PLACE, 'Too busy.', NOW)).toEqual({ taste: 'filed', inbox: 'filed' })
    expect(state.upserts.map(([t]) => t)).toEqual(['taste_reports', 'taste_rejection_inbox'])
    expect(await fileThumbLearning(db as never, PLACE, null, NOW)).toBeNull()
  })
})

describe('POST /api/board/<Monday>/thumb-pick', () => {
  const previous = { ...process.env }
  afterEach(() => {
    for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] }
    vi.unstubAllGlobals()
  })
  /** As production sends it: vercel.json rewrites /api/board/:week/:collection, so the press arrives as a collection. */
  async function press(body: Body, opts: { row?: Body; operator?: boolean } = {}) {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    const { db, state } = fakeDb(opts.row || ROW)
    const looked: string[] = []
    const handler = createBoardHandler(async () => db as never, { look: async (piece: string) => { looked.push(piece); return { keys: ['board-thumbs-abc'] } } })
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    const headers = opts.operator ? { authorization: 'Bearer synthetic-operator' } : { cookie, origin: 'https://controlcenter.krishraja.com' }
    let status = 0; let out: Body = {}
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: Body) { out = v } } as unknown as VercelResponse
    await handler({ method: 'POST', headers, query: { week: WEEK, collection: 'thumb-pick' }, body: { piece_id: PIECE, ...body } } as unknown as VercelRequest, res)
    return { status, out, state, looked }
  }

  it('records his pick and asks the done check to look, so the session\'s ask closes', async () => {
    const r = await press({ set_sha256: SET.set_sha256, verdict: 'pick', option: 'b' })
    expect(r.status).toBe(200)
    expect(r.out).toMatchObject({ ok: true, already: false, thumbs: { said: 'picked', option: 'b', how: 'picked on the board' }, looked: ['board-thumbs-abc'] })
    expect(r.state.row.meta.making.thumbnail_options.pick).toMatchObject({ option: 'b', decision: 'picked on the board', by: 'Krish' })
    expect(r.looked).toEqual([PIECE])
    expect(r.state.upserts).toEqual([])
  })

  it('records Not this, and files his words where his other rejections go', async () => {
    const r = await press({ set_sha256: SET.set_sha256, verdict: 'not_this', words: 'Too busy.' })
    expect(r.out).toMatchObject({ ok: true, thumbs: { said: 'not_this', words: 'Too busy.' }, learned: { taste: 'filed', inbox: 'filed' } })
    expect(r.state.row.meta.making.thumbnail_options.redraw.words).toBe('Too busy.')
  })

  it('refuses a stale set with 409 and its problems, writes nothing, and is his press only on a piece of this week', async () => {
    const stale = await press({ set_sha256: sha('old set'), verdict: 'pick', option: 'a' })
    expect(stale.status).toBe(409)
    expect(stale.out.error).toBe('thumbnail_options_unbound')
    expect(stale.out.problems.join()).toMatch(/record holds no set/)
    expect([stale.state.writes, stale.looked]).toEqual([0, []])
    expect((await press({ set_sha256: SET.set_sha256, verdict: 'pick', option: 'a' }, { operator: true })).out).toMatchObject({ error: 'his_press' })
    expect(await press({ set_sha256: SET.set_sha256, verdict: 'pick', option: 'a' }, { row: { ...ROW, scheduled_for: '2026-11-25' } })).toMatchObject({ status: 404, out: { error: 'piece_not_in_week' } })
    expect(await press({ set_sha256: SET.set_sha256, verdict: 'pick' })).toMatchObject({ status: 400, out: { error: 'invalid_option' } })
  })

  it('the same answer again changes nothing and asks nothing', async () => {
    const row = withSet({ ...SET, pick: { option: 'b', files: OPTIONS[1].files, decision: 'picked on the board', at: NOW, by: 'Krish' } })
    const r = await press({ set_sha256: SET.set_sha256, verdict: 'pick', option: 'b' }, { row })
    expect(r.out).toMatchObject({ ok: true, already: true })
    expect([r.state.row.meta, r.looked]).toEqual([row.meta, []])
  })
})

describe('GET /api/board/<Monday>/drive/<id> serves a thumbnail option\'s review copy of a piece of this week', () => {
  const previous = { ...process.env }
  afterEach(() => { if (previous.ACCESS_CODE === undefined) delete process.env.ACCESS_CODE; else process.env.ACCESS_CODE = previous.ACCESS_CODE })
  async function get(fileId: string) {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    const { db } = fakeDb(ROW)
    const served: string[] = []
    const handler = createBoardHandler(async () => db as never, { drive: () => ({ posts: async () => [], serve: async (x: string) => { served.push(x); return `https://store.example/${x}` } }) as never })
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    let status = 0; let out: Body = {}; let location = ''
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: Body) { out = v }, redirect(code: number, url: string) { status = code; location = url } } as unknown as VercelResponse
    await handler({ method: 'GET', headers: { cookie }, query: { week: WEEK, op: 'drive', id: fileId } } as unknown as VercelRequest, res)
    return { status, out, location, served }
  }
  it('serves an option\'s file and the grid mock, and refuses any other id', async () => {
    expect(await get(did('btall'))).toMatchObject({ status: 302, location: `https://store.example/${did('btall')}` })
    expect((await get(did('mock'))).status).toBe(302)
    expect(await get(did('nothing'))).toMatchObject({ status: 404, out: { error: 'drive_file_not_found' }, served: [] })
  })
})

describe('style samples (1.16.0): a same-site Drive path, its Drive link, and the ids the sign-offs route serves', () => {
  const ID = '1Sample' + 'x'.repeat(24)
  const samples = { motion: { 'paper-cutout': `/api/board/sign-offs?file=${ID}`, 'data-story': '' }, captions: {}, drive: { motion: { 'paper-cutout': ID, 'data-story': 'not-an-id' }, captions: {} } }
  it('reads a recorded sample, and an empty value as no sample at all', () => {
    expect(sampleUrl('motion', 'paper-cutout', samples)).toBe(`/api/board/sign-offs?file=${ID}`)
    expect(sampleDrive('motion', 'paper-cutout', samples)).toEqual({ file_id: ID, url: `https://drive.google.com/file/d/${ID}/view` })
    expect([sampleUrl('motion', 'data-story', samples), sampleDrive('motion', 'data-story', samples)]).toEqual([null, null])
    expect([...sampleFiles(samples)]).toEqual([ID])
  })
  it('the committed list has no sample yet: every render waits, so the board draws none', () => {
    expect(sampleFiles().size).toBe(0)
    expect(sampleUrl('motion', 'paper-cutout')).toBeNull()
  })
})
