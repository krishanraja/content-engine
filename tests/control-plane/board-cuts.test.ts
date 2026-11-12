import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CutError, answerOn, cutIncident, cutInboxRow, cutPick, cutPresses, cutReport, cutVerdicts, fileCutLearning, mediaWithAnswers, nextVerdicts, saveCut } from '../../apps/control-plane/api/board/_cuts.js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// His answer on each rendered cut (view contract 1.6.0; docs/PUBLISH_BOARDS.md, "His answer on each cut"): Yes, this
// cut is right, or Not this with his words, kept append only on the piece (meta.cut_verdicts). It never changes the cut.

type Body = Record<string, any>
const PIECE = '8287846b-6618-4a19-9fb8-23ad4eca2718'
const LONG = 'a'.repeat(64), SHORT = 'b'.repeat(64)
const making = { video_assets: [
  { cut: 'long', path: '3 Posts/mon/long.mp4', sha256: LONG, at: '2026-11-16T08:00:00Z', seconds: 412, thumbnail: { path: '3 Posts/mon/long.jpg' } },
  { cut: 'short', path: '3 Posts/mon/short.mp4', sha256: SHORT, at: '2026-11-16T08:05:00Z', seconds: 58 },
] }
const THUMB = createHash('sha256').update('path:3 Posts/mon/long.jpg').digest('hex')
const ROW = { id: PIECE, idea: 'A piece', scheduled_for: '2026-11-16', lane_slot: 'follow_the_money', updated_at: '2026-11-16T08:00:00Z',
  meta: { making, look: { production: 'face-with-proof' } } }
const refused = (f: () => unknown) => { try { f(); return null } catch (e) { return e instanceof CutError ? [e.status, e.message] : e } }

describe('the presses on each cut', () => {
  it('gives every cut its Yes and its Not this, which needs his words; a thumbnail carries neither', () => {
    const media = mediaWithAnswers(ROW)
    expect(media.map(m => [m.kind, m.cut])).toEqual([['cut', 'short'], ['cut', 'long'], ['thumbnail', 'long']])
    const long = media.find(m => m.id === LONG)!
    expect(long.presses).toEqual(cutPresses(PIECE, long))
    expect(long.presses!.yes).toMatchObject({ kind: 'press', label: 'Yes', op: 'cut-verdict', body: { piece_id: PIECE, media_id: LONG, verdict: 'yes' }, stamp: [] })
    expect(long.presses!.yes.words).toBeUndefined()
    expect(long.presses!.not_this).toMatchObject({ label: 'Not this', op: 'cut-verdict', body: { piece_id: PIECE, media_id: LONG, verdict: 'not_this' },
      words: { path: 'words', ask: 'What is not right about the long cut?', required: true } })
    expect(long.verdict).toBeNull()
    const thumb = media.find(m => m.kind === 'thumbnail')!
    expect(thumb.id).toBe(THUMB)
    expect('presses' in thumb || 'verdict' in thumb).toBe(false)
  })

  it('says his latest answer on each file, and only on that file', () => {
    const meta = { ...ROW.meta, cut_verdicts: [
      { media_id: LONG, cut: 'long', verdict: 'yes', words: null, by: 'Krish', at: '2026-11-16T08:10:00Z' },
      { media_id: LONG, cut: 'long', verdict: 'not_this', words: 'Start on the number.', by: 'Krish', at: '2026-11-16T08:20:00Z' },
      { media_id: 'not-a-media-id', verdict: 'yes', at: '2026-11-16T08:30:00Z' },
    ] }
    const media = mediaWithAnswers({ ...ROW, meta })
    expect(media.find(m => m.id === LONG)!.verdict).toEqual({ said: 'not_this', words: 'Start on the number.', at: '2026-11-16T08:20:00Z' })
    expect(media.find(m => m.id === SHORT)!.verdict).toBeNull()
    expect(answerOn(meta, SHORT)).toBeNull()
    // A piece with no making record, or no piece, has no media and no presses.
    expect(mediaWithAnswers(undefined)).toEqual([])
    expect(mediaWithAnswers({ id: PIECE, meta: {} })).toEqual([])
  })
})

describe('his press on a cut', () => {
  it('takes a media id and Yes, or Not this with his words', () => {
    expect(cutPick({ piece_id: PIECE, media_id: LONG, verdict: 'yes', words: 'ignored' })).toEqual({ media_id: LONG, verdict: 'yes', words: null })
    expect(cutPick({ media_id: LONG.toUpperCase(), verdict: 'not_this', words: '  The open drags.  ' })).toEqual({ media_id: LONG, verdict: 'not_this', words: 'The open drags.' })
    expect(refused(() => cutPick({ media_id: 'x', verdict: 'yes' }))).toEqual([400, 'invalid_media'])
    expect(refused(() => cutPick({ media_id: LONG, verdict: 'maybe' }))).toEqual([400, 'invalid_verdict'])
    expect(refused(() => cutPick({ media_id: LONG, verdict: 'not_this' }))).toEqual([400, 'words_required'])
    expect(refused(() => cutPick({ media_id: LONG, verdict: 'not_this', words: '   ' }))).toEqual([400, 'words_required'])
    expect(cutPick({ media_id: LONG, verdict: 'not_this', words: 'x'.repeat(5000) }).words!.length).toBe(4000)
  })

  it('is appended, never rewritten: the file, its hash and its place in the library are kept with his words', () => {
    const before = { ...ROW.meta, cut_verdicts: [{ media_id: SHORT, cut: 'short', verdict: 'yes', words: null, by: 'Krish', at: 'T0', extra: 'kept as it was' }] }
    const next = nextVerdicts(before, { media_id: LONG, verdict: 'not_this', words: 'Start on the number.' }, '2026-11-16T09:00:00.000Z')
    expect(next.already).toBe(false)
    expect(next.list[0]).toEqual(before.cut_verdicts[0])
    expect(next.list[1]).toEqual({ media_id: LONG, cut: 'long', verdict: 'not_this', words: 'Start on the number.', sha256: LONG, path: '3 Posts/mon/long.mp4', by: 'Krish', at: '2026-11-16T09:00:00.000Z' })
    // Then a Yes on the same file: both stay, and the Yes is his answer now.
    const meta2 = { ...before, cut_verdicts: next.list }
    const yes = nextVerdicts(meta2, { media_id: LONG, verdict: 'yes', words: null }, '2026-11-16T09:05:00.000Z')
    expect(yes.list).toHaveLength(3)
    expect(answerOn({ cut_verdicts: yes.list }, LONG)).toEqual({ said: 'yes', words: null, at: '2026-11-16T09:05:00.000Z' })
    expect(cutVerdicts({ cut_verdicts: yes.list }).map(v => v.verdict)).toEqual(['not_this', 'yes'])
  })

  it('keeps the same answer pressed twice in a row once', () => {
    const meta = { ...ROW.meta, cut_verdicts: [{ media_id: LONG, cut: 'long', verdict: 'yes', words: null, by: 'Krish', at: '2026-11-16T08:10:00Z' }] }
    const again = nextVerdicts(meta, { media_id: LONG, verdict: 'yes', words: null }, '2026-11-16T09:00:00.000Z')
    expect(again.already).toBe(true)
    expect(again.list).toEqual(meta.cut_verdicts)
    expect(again.entry.at).toBe('2026-11-16T08:10:00Z')
  })

  it('is refused on anything but a cut on this piece: a thumbnail, another piece\'s file, an id it never gave', () => {
    expect(refused(() => nextVerdicts(ROW.meta, { media_id: THUMB, verdict: 'yes', words: null }, 'T'))).toEqual([404, 'media_not_found'])
    expect(refused(() => nextVerdicts(ROW.meta, { media_id: 'c'.repeat(64), verdict: 'yes', words: null }, 'T'))).toEqual([404, 'media_not_found'])
    expect(refused(() => nextVerdicts({}, { media_id: LONG, verdict: 'yes', words: null }, 'T'))).toEqual([404, 'media_not_found'])
  })
})

/** content_ideas with one row: reads and guarded writes, and another writer that can land between a read and a write. */
function fakeDb(row: Body, landBetween = 0, refuse: string[] = []) {
  const state = { row: JSON.parse(JSON.stringify(row)) as Body, writes: 0, conflicts: 0, tables: [] as string[], upserts: [] as Array<[string, Body]> }
  const db = {
    from: (table: string) => {
      state.tables.push(table)
      const filters: Array<[string, unknown]> = []
      let update: Body | null = null
      const match = () => filters.every(([k, v]) => state.row[k] === v)
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q },
        order: () => q,
        range: async () => ({ data: [], error: null }),
        update: (u: Body) => { update = u; return q },
        // What a Not this teaches lands in the learning tables, once each by its key (ignoreDuplicates).
        upsert: (v: Body) => {
          if (refuse.includes(table)) return Promise.resolve({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
          const key = table === 'engine_incidents' ? v.client_ref : `${v.emitter_id}|${v.client_report_id}`
          if (!state.upserts.some(([t, x]) => t === table && (table === 'engine_incidents' ? x.client_ref : `${x.emitter_id}|${x.client_report_id}`) === key)) state.upserts.push([table, v])
          return Promise.resolve({ data: null, error: null })
        },
        single: async () => (match() ? { data: JSON.parse(JSON.stringify(state.row)), error: null } : { data: null, error: { message: 'none' } }),
        maybeSingle: async () => ({ data: match() ? JSON.parse(JSON.stringify(state.row)) : null, error: null }),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          if (update && landBetween > 0) {
            landBetween--
            state.conflicts++
            state.row = { ...state.row, updated_at: `2026-11-16T09:00:0${state.conflicts}Z`, meta: { ...state.row.meta, style: { motion: 'ladder' } } }
          }
          const ok = Boolean(update) && match()
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
  it('appends to meta.cut_verdicts and keeps a write that lands in between', async () => {
    const { db, state } = fakeDb(ROW, 1)
    const saved = await saveCut(db as never, PIECE, { media_id: SHORT, verdict: 'yes', words: null }, new Date('2026-11-16T09:30:00Z'))
    expect(saved).toEqual({ already: false, verdict: { media_id: SHORT, cut: 'short', verdict: 'yes', words: null, sha256: SHORT, path: '3 Posts/mon/short.mp4', by: 'Krish', at: '2026-11-16T09:30:00.000Z' } })
    expect(state.conflicts).toBe(1)
    expect(state.row.meta.cut_verdicts).toEqual([saved.verdict])
    expect(state.row.meta.style).toEqual({ motion: 'ladder' })
    // The cut itself is untouched.
    expect(state.row.meta.making).toEqual(making)
  })

  it('says the piece is busy when the writes in between never stop, and refuses a file not on the piece', async () => {
    await expect(saveCut(fakeDb(ROW, 99).db as never, PIECE, { media_id: SHORT, verdict: 'yes', words: null })).rejects.toMatchObject({ status: 409, message: 'piece_busy' })
    const { db, state } = fakeDb(ROW)
    await expect(saveCut(db as never, PIECE, { media_id: 'c'.repeat(64), verdict: 'yes', words: null })).rejects.toMatchObject({ status: 404, message: 'media_not_found' })
    expect(state.writes).toBe(0)
  })
})

describe('what a Not this teaches', () => {
  const PLACE = { week: '2026-11-16', date: '2026-11-16', pieceId: PIECE }
  const NO = { media_id: LONG, cut: 'long', verdict: 'not_this' as const, words: 'The open drags. Start on the number.', sha256: LONG, path: '3 Posts/mon/long.mp4', by: 'Krish' as const, at: '2026-11-16T09:30:00.000Z' }
  const YES = { ...NO, verdict: 'yes' as const, words: null }

  it('goes to his taste ledger as his own words, with where and when', () => {
    expect(cutReport(PLACE, NO)).toMatchObject({ kind: 'krish_words', body: NO.words, said_where: 'publish board, 2026-11-16 mon, Cuts: Not this on the long cut',
      said_at: NO.at, lane: 'production', polarity: 'dislikes', subject_ref: `piece:${PIECE}`, subject: 'the long cut for the mon piece of the week of 2026-11-16',
      repository: 'krishanraja/content-engine', surface: 'publish_board', emitter_id: 'content-engine-board', meta: { press: 'cut_not_this', cut: 'long', media_id: LONG, path: NO.path } })
    expect(cutReport(PLACE, NO)!.client_report_id).toMatch(/^cut-[a-f0-9]{64}$/)
    expect(cutReport(PLACE, YES)).toBeNull()
  })

  it('goes to the rejection inbox as words alone, with the cut\'s format, never a Drive id it does not have', () => {
    const row = cutInboxRow(PLACE, NO)!
    expect(row).toMatchObject({ kind: 'rejected', said: NO.words, said_where: 'publish board, 2026-11-16 mon, Cuts', piece: PIECE, formats: ['long_video'],
      master_drive_id: null, at_ms: null, whole_cut: false, emitter_id: 'content-engine/publish-board', meta: { cut: 'long', sha256: LONG, path: NO.path } })
    expect(row.client_report_id).toMatch(/^cut-[a-f0-9]{40}$/)
    expect(cutInboxRow(PLACE, { ...NO, cut: 'short' })!.formats).toEqual(['short_video'])
    expect(cutInboxRow(PLACE, YES)).toBeNull()
  })

  it('goes to the failure loop as a rejection at the cut stage, and the same words on the same file file once', () => {
    expect(cutIncident(PLACE, NO)).toMatchObject({ piece_id: PIECE, stage: 'cut', kind: 'krish_reject', his_words: NO.words, artifact_sha256: LONG, artifact_ref: `library:${NO.path}` })
    expect(cutIncident(PLACE, YES)).toBeNull()
    // Pressed again later in the same words: the same keys. New words: new keys.
    expect(cutReport(PLACE, { ...NO, at: '2026-11-17T10:00:00.000Z' })!.client_report_id).toBe(cutReport(PLACE, NO)!.client_report_id)
    expect(cutReport(PLACE, { ...NO, words: 'Too slow.' })!.client_report_id).not.toBe(cutReport(PLACE, NO)!.client_report_id)
  })

  it('never blocks: a table not made yet is said, and the others still file', async () => {
    const { db, state } = fakeDb(ROW, 0, ['taste_rejection_inbox'])
    expect(await fileCutLearning(db as never, PLACE, NO)).toEqual({ taste: 'filed', inbox: 'waits_on_migration', incident: 'filed' })
    expect(state.upserts.map(([t]) => t)).toEqual(['taste_reports', 'engine_incidents'])
    expect(await fileCutLearning(db as never, PLACE, YES)).toBeNull()
  })
})

describe('POST /api/board/<Monday>/cut-verdict', () => {
  const previous = { ...process.env }
  afterEach(() => {
    for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] }
    vi.unstubAllGlobals()
  })
  /** The request as production sends it: vercel.json rewrites /api/board/:week/:collection, so the press arrives as a
   *  collection named for its op. */
  async function press(body: Body, opts: { row?: Body; operator?: boolean; method?: string; route?: Body } = {}) {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => null })))
    const { db, state } = fakeDb(opts.row || ROW)
    const handler = createBoardHandler(async () => db as never)
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    const headers = opts.operator ? { authorization: 'Bearer synthetic-operator' } : { cookie, origin: 'https://controlcenter.krishraja.com' }
    let status = 0; let out: Body = {}
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: Body) { out = v } } as unknown as VercelResponse
    await handler({ method: opts.method || 'POST', headers, query: opts.route || { week: '2026-11-16', collection: 'cut-verdict' }, body: { piece_id: PIECE, ...body } } as unknown as VercelRequest, res)
    return { status, out, state }
  }

  it('records his Yes on the piece and answers with it', async () => {
    const { status, out, state } = await press({ media_id: LONG, verdict: 'yes' })
    expect(status).toBe(200)
    expect(out).toMatchObject({ ok: true, already: false, cut_verdict: { media_id: LONG, cut: 'long', verdict: 'yes', words: null, by: 'Krish' } })
    expect(state.row.meta.cut_verdicts).toHaveLength(1)
    expect(state.row.meta.making).toEqual(making)
  })

  it('records his Not this with his words exactly as he typed them', async () => {
    const { status, out, state } = await press({ media_id: SHORT, verdict: 'not_this', words: 'The captions cover his face.' })
    expect(status).toBe(200)
    expect(state.row.meta.cut_verdicts[0]).toMatchObject({ media_id: SHORT, verdict: 'not_this', words: 'The captions cover his face.' })
    // And teaches what his other rejections teach: his taste ledger, the rejection inbox, the failure loop.
    expect(out.learned).toEqual({ taste: 'filed', inbox: 'filed', incident: 'filed' })
    expect(state.upserts.map(([t]) => t)).toEqual(['taste_reports', 'taste_rejection_inbox', 'engine_incidents'])
  })

  it('files nothing to learn from on a Yes, and nothing again when the same answer is pressed twice', async () => {
    const yes = await press({ media_id: LONG, verdict: 'yes' })
    expect(yes.out.learned).toBeUndefined()
    expect(yes.state.upserts).toEqual([])
    const meta = { ...ROW.meta, cut_verdicts: [{ media_id: SHORT, cut: 'short', verdict: 'not_this', words: 'The captions cover his face.', sha256: SHORT, path: '3 Posts/mon/short.mp4', by: 'Krish', at: '2026-11-16T08:10:00Z' }] }
    const again = await press({ media_id: SHORT, verdict: 'not_this', words: 'The captions cover his face.' }, { row: { ...ROW, meta } })
    expect(again.out).toMatchObject({ ok: true, already: true })
    expect(again.out.learned).toBeUndefined()
    expect(again.state.upserts).toEqual([])
  })

  it('is his press only, on a cut of a piece of this week, with his words on a Not this', async () => {
    expect((await press({ media_id: LONG, verdict: 'yes' }, { operator: true })).out).toMatchObject({ error: 'his_press' })
    expect(await press({ media_id: LONG, verdict: 'yes' }, { row: { ...ROW, scheduled_for: '2026-11-25' } })).toMatchObject({ status: 404, out: { error: 'piece_not_in_week' } })
    expect(await press({ media_id: THUMB, verdict: 'yes' })).toMatchObject({ status: 404, out: { error: 'media_not_found' } })
    expect(await press({ media_id: LONG, verdict: 'nope' })).toMatchObject({ status: 400, out: { error: 'invalid_verdict' } })
    const silent = await press({ media_id: LONG, verdict: 'not_this' })
    expect(silent).toMatchObject({ status: 400, out: { error: 'words_required' } })
    expect(silent.state.writes).toBe(0)
  })
})

describe('a press posted to its op arrives as a collection, as production rewrites it', () => {
  const previous = { ...process.env }
  afterEach(() => {
    for (const key of ['ACCESS_CODE']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] }
    vi.unstubAllGlobals()
  })
  async function call(method: string, query: Body, body: Body = {}) {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => null })))
    const { db, state } = fakeDb(ROW)
    const handler = createBoardHandler(async () => db as never)
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    let status = 0; let out: Body = {}
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: Body) { out = v } } as unknown as VercelResponse
    await handler({ method, headers: { cookie, origin: 'https://controlcenter.krishraja.com' }, query, body } as unknown as VercelRequest, res)
    return { status, out, state }
  }

  it('POST /api/board/<Monday>/style is the style press, which the read-only view refused before (400 read_only_view)', async () => {
    const { status, out, state } = await call('POST', { week: '2026-11-16', collection: 'style' }, { piece_id: PIECE, captions: 'art-directed' })
    expect(status).toBe(200)
    expect(out).toMatchObject({ ok: true, style: { captions: 'art-directed', by: 'Krish' } })
    expect(state.row.meta.style.captions).toBe('art-directed')
  })

  it('GET /api/board/<Monday>/style and /cut stay the read-only views of his gate documents', async () => {
    const style = await call('GET', { week: '2026-11-16', collection: 'style' })
    expect(style).toMatchObject({ status: 200, out: { ok: true, collection: 'style', documents: [] } })
    expect((await call('GET', { week: '2026-11-16', collection: 'cut' })).out).toMatchObject({ ok: true, collection: 'cut', documents: [] })
    // A POST to the Approve cut view is still refused: his answer on a cut is cut-verdict, never cut.
    expect(await call('POST', { week: '2026-11-16', collection: 'cut' }, { piece_id: PIECE })).toMatchObject({ status: 400, out: { error: 'read_only_view' } })
  })
})
