import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { readFileSync } from 'node:fs'
import { POSTED_CHANNELS, dayDate, postedInput } from '../../apps/control-plane/api/board/_posted.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// Growth's write-back (Krish, 2026-10-29: "we need the growth repo to keep the publish board check boxes update with
// what it has done and when"): one post ticks the day's box and lands on the piece's making record, once per post.

const PIECE = '11111111-2222-4333-8444-555555555555'
const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN', 'GROWTH_WRITEBACK_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })

const post = (extra: Record<string, unknown> = {}) => ({
  day: 'mon', piece_id: PIECE, channel: 'linkedin', post_url: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
  posted_at: '2026-11-09T14:00:00Z', buffer_post_id: 'buf_1', ...extra,
})

function fakeDb(opts: { scheduled?: string | null; staleMaking?: number; conflicts?: number; tickPiece?: string } = {}) {
  const ticks = new Map<string, { body: any; revision: number; by: string }>()
  if (opts.tickPiece) ticks.set('mon-linkedin', { body: { done: false, piece_id: opts.tickPiece }, revision: 1, by: 'Krish' })
  let piece: any = { id: PIECE, scheduled_for: opts.scheduled === undefined ? '2026-11-09' : opts.scheduled, meta: { making: { updated_at: '2026-11-01T00:00:00Z', by: 'Claude Code', channels: { substack: { posted_at: '2026-11-09T12:00:00Z' } } } }, updated_at: '2026-11-01T00:00:00Z' }
  let stale = opts.staleMaking || 0, conflicts = opts.conflicts || 0
  const writes = { ticks: 0, making: 0 }
  const db = {
    rpc: async (name: string, a: Record<string, any>) => {
      expect(name).toBe('board_save'); expect(a.p_actor).toBe('growth'); expect(a.p_collection).toBe('ticks')
      const held = ticks.get(a.p_id)
      if (conflicts > 0) { conflicts--; ticks.set(a.p_id, { body: held?.body || { done: false }, revision: (held?.revision || 0) + 1, by: 'Krish' }); return { data: { ok: false, error: 'revision_conflict' }, error: null } }
      if ((held?.revision || 0) !== a.p_revision) return { data: { ok: false, error: 'revision_conflict' }, error: null }
      ticks.set(a.p_id, { body: a.p_body, revision: a.p_revision + 1, by: a.p_actor }); writes.ticks++
      return { data: { ok: true, revision: a.p_revision + 1 }, error: null }
    },
    from: (table: string) => {
      const f: Record<string, unknown> = {}
      let update: any = null
      const q: any = {
        select: () => {
          if (!update) return q
          if (stale > 0) { stale--; piece = { ...piece, updated_at: `2026-11-02T00:00:0${stale}Z` }; return Promise.resolve({ data: [], error: null }) }
          if (f.updated_at !== piece.updated_at) return Promise.resolve({ data: [], error: null })
          piece = { ...piece, meta: update.meta, updated_at: update.updated_at }; writes.making++
          return Promise.resolve({ data: [{ id: PIECE }], error: null })
        },
        update: (v: any) => { expect(table).toBe('content_ideas'); update = v; return q },
        eq: (k: string, v: unknown) => { f[k] = v; return q },
        maybeSingle: async () => {
          if (table === 'content_ideas') return { data: f.id === PIECE ? piece : null, error: null }
          expect(table).toBe('board_ticks'); expect(f.week).toBe('2026-11-09')
          const t = ticks.get(String(f.tick_id))
          return { data: t ? { body: t.body, revision: t.revision } : null, error: null }
        },
      }
      return q
    },
  }
  return { db, ticks, writes, piece: () => piece }
}

function setup(opts: Parameters<typeof fakeDb>[0] = {}) {
  process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
  process.env.GROWTH_WRITEBACK_TOKEN = 'synthetic-growth'
  process.env.ACCESS_CODE = 'synthetic-board-test'
  const fake = fakeDb(opts)
  const handler = createBoardHandler(async () => fake.db as never, { now: () => '2026-11-09T14:05:00.000Z' })
  const call = async (body: unknown, auth = 'Bearer synthetic-growth', method = 'POST', week = '2026-11-09') => {
    let status = 0; let out: any
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: unknown) { out = v } } as unknown as VercelResponse
    await handler({ method, headers: auth ? { authorization: auth } : {}, query: { week, op: 'posted' }, body } as unknown as VercelRequest, res)
    return { status, out }
  }
  return { ...fake, call }
}

describe('what a post must carry', () => {
  it('takes the six fields and nothing else', () => {
    expect(postedInput(post()).input?.channel).toBe('linkedin')
    expect(postedInput(post({ day: 'tue' })).problem).toMatch(/mon, wed or fri/)
    expect(postedInput(post({ channel: 'whatsapp' })).problem).toMatch(/channel/)
    expect(postedInput(post({ post_url: 'http://x' })).problem).toMatch(/https/)
    expect(postedInput(post({ posted_at: 'soon' })).problem).toMatch(/ISO/)
    expect(postedInput(post({ buffer_post_id: '' })).problem).toMatch(/Buffer/)
    expect(postedInput(post({ done: true })).problem).toMatch(/unknown fields: done/)
    expect(dayDate('2026-11-02', 'fri')).toBe('2026-11-06')
  })
})

describe('the boxes it ticks', () => {
  it('are week_board.py\'s posting steps, with the same labels', () => {
    const py = readFileSync(new URL('../../scripts/post-pack/week_board.py', import.meta.url), 'utf8')
    const steps = [...py.matchAll(/^    \('([a-z-]+)', '([^']+)', '([a-z]+)', (?:True|False)\),$/gm)].map(m => [m[1], m[2]])
    expect(steps.length).toBeGreaterThan(0)
    expect(Object.fromEntries(steps)).toEqual(POSTED_CHANNELS)
  })
})

describe('POST /api/board/<Monday>/posted', () => {
  it('opens only to Growth\'s key or the operator\'s, never a browser or no key', async () => {
    const s = setup()
    expect((await s.call(post(), '')).status).toBe(401)
    expect((await s.call(post(), 'Bearer wrong')).status).toBe(401)
    expect((await s.call(post(), 'Bearer synthetic-operator')).status).toBe(200)
    expect((await s.call(post(), 'Bearer synthetic-growth', 'PUT')).status).toBe(405)
    delete process.env.GROWTH_WRITEBACK_TOKEN
    expect((await s.call(post({ buffer_post_id: 'buf_2' }), 'Bearer ')).status).toBe(401)
  })
  it('ticks the box with what was posted and when, and records the channel on the piece', async () => {
    const s = setup()
    const r = await s.call(post())
    expect(r.status).toBe(200)
    expect(r.out).toMatchObject({ ok: true, duplicate: false, tick_id: 'mon-linkedin' })
    const tick = s.ticks.get('mon-linkedin')!
    expect(tick.by).toBe('growth')
    expect(tick.body).toMatchObject({ done: true, day: 'mon', piece_id: PIECE, step: 'linkedin', channel: 'linkedin', label: 'LinkedIn', at: '2026-11-09T14:00:00Z' })
    expect(tick.body.posts).toEqual([{ buffer_post_id: 'buf_1', url: post().post_url, posted_at: '2026-11-09T14:00:00Z', recorded_at: '2026-11-09T14:05:00.000Z' }])
    const making = s.piece().meta.making
    expect(making.channels.linkedin).toEqual({ posted_at: '2026-11-09T14:00:00Z', url: post().post_url, buffer_post_id: 'buf_1' })
    expect(making.channels.substack).toBeTruthy()
  })
  it('writes a post once: a replay answers duplicate and writes nothing', async () => {
    const s = setup()
    await s.call(post())
    const again = await s.call(post())
    expect(again.out).toMatchObject({ ok: true, duplicate: true })
    expect(s.writes).toEqual({ ticks: 1, making: 1 })
    const second = await s.call(post({ buffer_post_id: 'buf_2', posted_at: '2026-11-09T18:00:00Z' }))
    expect(second.out.duplicate).toBe(false)
    expect(s.ticks.get('mon-linkedin')!.body.posts.map((p: any) => p.buffer_post_id)).toEqual(['buf_1', 'buf_2'])
  })
  it('finishes the making record on a replay when the first write could not land it', async () => {
    const s = setup({ staleMaking: 2 })
    const first = await s.call(post())
    expect(first.out).toMatchObject({ ok: true, making_channel: null })
    expect(s.ticks.get('mon-linkedin')!.body.done).toBe(true)
    const replay = await s.call(post())
    expect(replay.out).toMatchObject({ ok: true, duplicate: true, making_channel: { buffer_post_id: 'buf_1' } })
    expect(s.writes).toEqual({ ticks: 1, making: 1 })
  })
  it('refuses a piece that is not on that day of that week, and writes nothing', async () => {
    const s = setup({ scheduled: '2026-11-02' })
    const r = await s.call(post())
    expect(r.status).toBe(409); expect(r.out.error).toBe('not_this_day')
    expect(s.writes).toEqual({ ticks: 0, making: 0 })
    expect((await setup({ scheduled: null }).call(post())).out.error).toBe('not_this_day')
    expect((await s.call(post({ piece_id: '99999999-2222-4333-8444-555555555555' }))).status).toBe(404)
    expect((await s.call(post(), 'Bearer synthetic-growth', 'POST', '2026-11-10')).out.error).toBe('invalid_week')
  })
  it('never takes over a box that holds another piece', async () => {
    const s = setup({ tickPiece: '33333333-2222-4333-8444-555555555555' })
    expect((await s.call(post())).out.error).toBe('box_holds_another_piece')
  })
  it('reads the box again once when it changed under the write', async () => {
    expect((await setup({ conflicts: 1 }).call(post())).out.ok).toBe(true)
    expect((await setup({ conflicts: 2 }).call(post())).out.error).toBe('revision_conflict')
  })
})
