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

// The week's pieces as content_ideas holds them (the live overlay, _live.ts). Monday's is mid-making; Wednesday has two
// pieces on its date and keeps the one of its own series; a buried piece on Friday is no day's piece.
const BUILT_AT = '2026-11-01T20:00:00.000Z'
const SHA_LONG = 'a'.repeat(64), SHA_SHORT = 'b'.repeat(64)
const MON = '11111111-1111-4111-8111-111111111111', WED = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333', GONE = '44444444-4444-4444-8444-444444444444'
let ideas: Record<string, unknown>[] = []
const monPiece = (updated_at: string) => ({
  id: MON, scheduled_for: '2026-11-02', lane_slot: 'follow_the_money', state: 'draft', buried_at: null, body: 'Synthetic article.', updated_at,
  meta: { making: {
    updated_at, by: 'claude-code', started_at: '2026-10-30T10:00:00Z',
    workroom: { url: 'https://claude.ai/code/secret-room', at: '2026-10-30T10:00:00Z' },
    visual_gate: { passed: true, checked_at: '2026-10-31T10:00:00Z', problems: [] },
    script_check: { passed: true, checked_at: '2026-10-31T11:00:00Z', problems: [], cuts: ['long', 'short'], hashes: { long: SHA_LONG, short: SHA_SHORT } },
    pack: { folder: 'G:/My Drive/private/folder', packed_at: '2026-10-31T12:00:00Z', files: 3 },
    teleprompter: { cuts: { long: { script_id: 'A1B2C3D4-0000-4000-8000-000000000001', script_sha256: SHA_LONG, title: 't' } } },
    recordings: [{ cut: 'long', path: 'Video Engine/Inbox/long.mov', at: '2026-11-01T09:00:00Z', script_sha256: SHA_LONG }],
    video_assets: [{ cut: 'long', name: 'long.mp4', path: '3 Posts/x/long.mp4', at: '2026-11-01T10:00:00Z', thumbnail: { path: '3 Posts/x/long.jpg' } }],
    channels: { youtube: { posted_at: '2026-11-02T17:30:00Z', url: 'https://youtu.be/x' } },
  } },
})
const weekIdeas = (monUpdated: string) => [
  monPiece(monUpdated),
  { id: OTHER, scheduled_for: '2026-11-04', lane_slot: 'mind_the_gap', state: 'idea', buried_at: null, body: null, meta: {}, updated_at: '2026-11-01T19:00:00Z' },
  { id: WED, scheduled_for: '2026-11-04', lane_slot: 'under_the_hood', state: 'idea', buried_at: null, body: null, meta: {}, updated_at: '2026-10-30T19:00:00Z' },
  { id: GONE, scheduled_for: '2026-11-06', lane_slot: 'mind_the_gap', state: 'idea', buried_at: '2026-10-31T00:00:00Z', body: null, meta: {}, updated_at: '2026-11-02T19:00:00Z' },
]
let build: { build_id: string; created_at: string } | null = null
let ideasDown = false

function fakeDb() {
  const asked: string[] = []
  return {
    asked,
    db: {
      from: (table: string) => {
        asked.push(table)
        const rows = table === 'board_documents' ? picks : table === 'board_ticks' ? ticks : table === 'content_ideas' ? ideas : []
        const single = table === 'board_weeks' ? (build ? { week: '2026-11-02', build_id: build.build_id, revision: 3 } : null)
          : table === 'board_builds' && build ? { created_at: build.created_at, manifest: { version: 1, week: '2026-11-02', assets: {},
            html: { sha256: 'd'.repeat(64), bytes: 10, type: 'text/html', name: 'board.html', key: `boards/2026-11-02/${'d'.repeat(64)}` } } } : null
        const q: any = {
          select: () => q, eq: () => q, or: () => q, gte: () => q, lte: () => q,
          maybeSingle: async () => ({ data: single, error: null }),
          then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(table === 'content_ideas' && ideasDown ? { data: null, error: { message: 'down' } } : { data: rows, error: null }).then(ok, bad),
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

afterEach(() => { ideas = []; build = null; ideasDown = false })

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
  it('carries each day\'s piece as its making record holds it now, with no address on it', async () => {
    ideas = weekIdeas('2026-11-01T19:00:00.000Z')
    const { status, out, asked } = await call('Bearer synthetic-operator')
    expect(status).toBe(200)
    expect(asked.filter(t => t === 'content_ideas')).toHaveLength(1) // one read of the week's pieces
    expect(Object.keys(out.live)).toEqual(['mon', 'wed'])
    expect(out.live.wed.piece_id).toBe(WED) // a series day keeps the piece of its own series
    const mon = out.live.mon
    expect(mon).toMatchObject({ piece_id: MON, date: '2026-11-02', verdict: null, posted: ['youtube'],
      script_hashes: { long: SHA_LONG, short: SHA_SHORT }, teleprompter: { long: 'in', short: 'missing' },
      cuts: [{ cut: 'long', thumbnail: true }] })
    const steps = Object.fromEntries(mon.steps.map((s: any) => [s.key, s]))
    expect(steps.workroom.state).toBe('done')
    expect(steps.scripts.state).toBe('done')
    expect(steps.record).toMatchObject({ state: 'now', note: 'short cut still to record' })
    expect(steps.pack.note).toBeUndefined()
    const text = JSON.stringify(out.live)
    for (const leak of ['https://', 'G:/', '3 Posts', 'Inbox', 'Synthetic article', 'secret-room']) expect(text).not.toContain(leak)
    expect(out.rebuild_needed).toBe(false) // no live build to be newer than
  })
  it('says a rebuild is needed only when a piece was written after the live build was made', async () => {
    build = { build_id: 'c'.repeat(64), created_at: BUILT_AT }
    ideas = weekIdeas('2026-11-01T19:30:00.000Z')
    let { out } = await call('Bearer synthetic-operator')
    expect(out.build_id).toBe('c'.repeat(64))
    expect(out.built_at).toBe(BUILT_AT)
    expect(out.rebuild_needed).toBe(false)
    ideas = weekIdeas('2026-11-01T20:05:00.000Z')
    ;({ out } = await call('Bearer synthetic-operator'))
    expect(out.rebuild_needed).toBe(true)
    // A buried piece written later is no day's piece, so it never asks for a rebuild.
    ideas = weekIdeas('2026-11-01T19:30:00.000Z')
    expect(ideas.find(r => r.id === GONE)?.updated_at).toBe('2026-11-02T19:00:00Z')
    ;({ out } = await call('Bearer synthetic-operator'))
    expect(out.rebuild_needed).toBe(false)
  })
  it('keeps his yes and Growth\'s ticks when the pieces cannot be read', async () => {
    ideasDown = true
    const { status, out } = await call('Bearer synthetic-operator')
    expect(status).toBe(200)
    expect(out.live).toBe(null)
    expect(out.rebuild_needed).toBe(false)
    expect(out.yes.wed).toMatchObject({ approved: true })
    expect(out.posted).toEqual({ mon: ['instagram', 'youtube'] })
  })
})
