import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// The live state the Today view polls (Krish, 2026-11-02: "the whole Today board seems totally outdated, and I can barely
// ever see what the current state of things are there"): his yes for each day, what Growth posted, the live build.

const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })

const picks = [
  { doc_id: 'yes-wed-words', updated_by: 'engine_operator', body: { kind: 'yes', day: 'wed', via: 'words', approved: true, at: '2026-11-02T21:30:00Z',
    words: 'can you just approve Weds, Fri and Sat for me here', said_at: '2026-11-02T21:25:00Z', said_where: 'Claude Code session', session_ref: 'https://claude.ai/code/s' } },
  { doc_id: 'yes-sat-board', updated_by: 'engine_operator', body: { kind: 'yes', day: 'sat', via: 'board', approved: true, at: '2026-11-02T22:00:00Z' } },
]
const ticks = [
  { tick_id: 'mon-instagram', updated_by: 'growth', body: { done: true, day: 'mon', step: 'instagram' } },
  { tick_id: 'mon-youtube', updated_by: 'growth', body: { done: true, day: 'mon', step: 'youtube' } },
  { tick_id: 'mon-linkedin', updated_by: 'Krish', body: { done: true, day: 'mon', step: 'linkedin' } },
  { tick_id: 'tue-tiktok', updated_by: 'growth', body: { done: false, day: 'tue', step: 'tiktok' } },
]

function fakeDb() {
  const asked: string[] = []
  return {
    asked,
    db: {
      from: (table: string) => {
        asked.push(table)
        const rows = table === 'board_documents' ? picks : table === 'board_ticks' ? ticks : []
        const q: any = {
          select: () => q, eq: () => q, or: () => q,
          maybeSingle: async () => ({ data: null, error: null }),
          then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok, bad),
        }
        return q
      },
    },
  }
}

async function call(auth: string | null, method = 'GET') {
  process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
  process.env.ACCESS_CODE = 'synthetic-board-test'
  const fake = fakeDb()
  const handler = createBoardHandler(async () => fake.db as never, { now: () => '2026-11-02T22:05:00.000Z' })
  let status = 0; let out: any
  const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: unknown) { out = v } } as unknown as VercelResponse
  await handler({ method, headers: auth ? { authorization: auth } : {}, query: { week: '2026-11-02', op: 'state' } } as unknown as VercelRequest, res)
  return { status, out, asked: fake.asked }
}

describe('the live state route', () => {
  it('returns his yes for each day, what Growth posted and the live build', async () => {
    const { status, out } = await call('Bearer synthetic-operator')
    expect(status).toBe(200)
    expect(out.yes.wed).toMatchObject({ approved: true, via: 'words' })
    expect(out.yes.sat).toBeUndefined() // a board press not from his own login counts for nothing
    expect(out.posted).toEqual({ mon: ['instagram', 'youtube'] }) // only Growth's done ticks
    expect(out.build_id).toBe(null)
  })
  it('is read only and needs a login', async () => {
    expect((await call(null)).status).toBe(401)
    expect((await call('Bearer synthetic-operator', 'PUT')).status).toBe(405)
  })
})
