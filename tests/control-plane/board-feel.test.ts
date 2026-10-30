import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { hisOnlyRefusal, validBody } from '../../apps/control-plane/api/board/_contracts.js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { feelReport } from '../../apps/control-plane/api/board/_presses.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// His Liked or Not it on a day's post, in the Today view (layout A; Krish, 2026-10-29: "yes, go with A and your
// recommendations and my feedback"): saved as picks/<day>-feel by his press alone, and filed as one taste_reports row,
// the road his feedback takes to the cues. A bare press is an observation, never words put in his mouth.

const PIECE = '11111111-2222-4333-8444-555555555555'
const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })
const feel = (extra: Record<string, unknown> = {}) => ({ kind: 'feel', day: 'tue', feel: 'not_it', piece_id: PIECE, title: 'Four jobs AI is learning first', at: '2026-11-03T18:00:00Z', ...extra })

describe('what a Liked or Not it carries', () => {
  it('any day, one of the two, an optional note, never a send', () => {
    expect(validBody('picks', 'tue-feel', feel())).toBe(true)
    expect(validBody('picks', 'sun-feel', feel({ day: 'sun', feel: 'liked' }))).toBe(true)
    expect(validBody('picks', 'tue-feel', feel({ feel: 'meh' }))).toBe(false)
    expect(validBody('picks', 'tue-feel', feel({ day: 'wed' }))).toBe(false)
    expect(validBody('picks', 'tue-feel', feel({ send: true }))).toBe(false)
    expect(validBody('picks', 'tue-feel', feel({ note: 'too busy, one idea per slide' }))).toBe(true)
  })
  it('is his alone', () => {
    expect(hisOnlyRefusal('picks', feel(), 'engine_operator')).toBe('decision_is_his')
    expect(hisOnlyRefusal('picks', feel(), 'Krish')).toBeNull()
  })
  it('files his words as his words, and a bare press as an observation of the press', () => {
    const words = feelReport('2026-11-02', 'tue-feel', feel({ note: 'too busy, one idea per slide' }), '2026-11-03T18:00:01Z')
    expect(words).toMatchObject({ kind: 'krish_words', body: 'too busy, one idea per slide', said_where: 'publish board, 2026-11-02 picks/tue-feel',
      said_at: '2026-11-03T18:00:01Z', polarity: 'dislikes', subject_ref: `piece:${PIECE}`, subject: 'Four jobs AI is learning first',
      repository: 'krishanraja/content-engine', surface: 'publish_board' })
    const bare = feelReport('2026-11-02', 'tue-feel', feel({ feel: 'liked' }), '2026-11-03T18:00:01Z')
    expect(bare).toMatchObject({ kind: 'observation', said_where: null, said_at: null, polarity: 'likes' })
    expect(bare.body).toBe('Krish pressed Liked on the publish board for tue of the week of 2026-11-02: Four jobs AI is learning first.')
    expect(bare.client_report_id).toMatch(/^feel-[a-f0-9]{16,}$/)
    expect(feelReport('2026-11-02', 'tue-feel', feel({ feel: 'liked' }), 'later').client_report_id).toBe(bare.client_report_id)
  })
})

describe('the press on the board', () => {
  it('saves his press and files it once', async () => {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    const filed: Array<{ table: string; row: Record<string, any>; options: unknown }> = []
    const db = {
      rpc: async (_: string, a: Record<string, any>) => ({ data: { ok: true, revision: a.p_revision + 1, body: a.p_body }, error: null }),
      from: (table: string) => {
        const q: any = {
          eq: () => q, select: () => q, maybeSingle: async () => ({ data: null, error: null }),
          upsert: async (row: Record<string, any>, options: unknown) => { filed.push({ table, row, options }); return { error: null } },
        }
        return q
      },
    }
    const handler = createBoardHandler(async () => db as never, { now: () => '2026-11-03T18:00:01.000Z' })
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    let status = 0; let out: any
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: unknown) { out = v } } as unknown as VercelResponse
    await handler({ method: 'PUT', headers: { cookie, origin: 'https://content.krishraja.com' }, query: { week: '2026-11-02', collection: 'picks', id: 'tue-feel' },
      body: { body: feel(), revision: 0 } } as unknown as VercelRequest, res)
    expect(status).toBe(200)
    expect(out).toMatchObject({ ok: true, taste: 'filed' })
    expect(filed).toHaveLength(1)
    expect(filed[0]).toMatchObject({ table: 'taste_reports', options: { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true } })
    expect(filed[0].row).toMatchObject({ kind: 'observation', polarity: 'dislikes', subject_ref: `piece:${PIECE}` })
  })
})
