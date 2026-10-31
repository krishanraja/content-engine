import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validBody } from '../../apps/control-plane/api/board/_contracts.js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { afterPress, recordTitle } from '../../apps/control-plane/api/board/_presses.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// Krish, 2026-10-31: the board's titles did not match the article's, and he could not comment on some off-day options.
// His long_title pick on the Titles press becomes content_ideas.title (the title of record), and every off-day option
// takes his comment as the note on its record. Nothing here reaches the database.

const PIECE = '11111111-2222-4333-8444-555555555555'
const WEEK = '2026-11-02'
const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })

/** content_ideas.update(...).eq(...).select(...) answering `answer`; records each update. */
function titleDb(answer: { data?: unknown; error?: unknown }) {
  const updates: Array<{ table: string; patch: Record<string, unknown>; id?: unknown }> = []
  return {
    updates,
    from(table: string) {
      const u: { table: string; patch: Record<string, unknown>; id?: unknown } = { table, patch: {} }
      const q: any = {
        update(patch: Record<string, unknown>) { u.patch = patch; updates.push(u); return q },
        eq(_: string, v: unknown) { u.id = v; return q },
        select: async () => answer,
      }
      return q
    },
  }
}
const titles = (picks: Record<string, string>, extra: Record<string, unknown> = {}) => ({ kind: 'titles', day: 'mon', piece_id: PIECE, picks, ...extra })

describe('one title of record', () => {
  it('writes his long_title pick to content_ideas.title', async () => {
    const db = titleDb({ data: [{ id: PIECE }], error: null })
    expect(await recordTitle(db as never, titles({ long_title: '  The title he picked ', short_title: 'Short' }))).toBe('recorded')
    expect(db.updates).toEqual([{ table: 'content_ideas', patch: { title: 'The title he picked' }, id: PIECE }])
  })
  it('does nothing without a long_title pick or a piece', async () => {
    const db = titleDb({ data: [], error: null })
    expect(await recordTitle(db as never, titles({ short_title: 'Short' }))).toBeNull()
    expect(await recordTitle(db as never, { kind: 'titles', day: 'mon', picks: { long_title: 'x' } })).toBeNull()
    expect(db.updates).toHaveLength(0)
  })
  it('waits on the migration while the column is not there, and never throws', async () => {
    expect(await recordTitle(titleDb({ error: { code: '42703' } }) as never, titles({ long_title: 'T' }))).toBe('waits_on_migration')
    expect(await recordTitle(titleDb({ error: { code: 'PGRST204' } }) as never, titles({ long_title: 'T' }))).toBe('waits_on_migration')
    expect(await recordTitle(titleDb({ error: { code: '500' } }) as never, titles({ long_title: 'T' }))).toBe('failed')
    expect(await recordTitle(titleDb({ data: [], error: null }) as never, titles({ long_title: 'T' }))).toBe('failed')
  })
  it('answers the Titles press with what happened to the title', async () => {
    const out = await afterPress(titleDb({ data: [{ id: PIECE }], error: null }) as never,
      { week: WEEK, collection: 'picks', id: 'mon-titles', body: titles({ long_title: 'T' }), who: 'Krish', saved: { ok: true, revision: 2 } })
    expect(out).toMatchObject({ ok: true, revision: 2, title: 'recorded' })
  })
})

const off = (extra: Record<string, unknown> = {}) => ({ pick: 'off-tue-o1', use: 'offday', day: 'tue', approved: true, copy_sha256: 'a'.repeat(64),
  format: 'carousel', source: 'Growth', option_id: 'o1', at: '2026-11-01T09:00:00Z', ...extra })

describe('his comment on an off-day option', () => {
  it('rides with his Approve or Skip as an optional note', () => {
    expect(validBody('queue', 'off-tue-o1', off({ note: 'Lead with the chart' }))).toBe(true)
    expect(validBody('queue', 'off-tue-o1', off({ approved: false, note: null }))).toBe(true)
    expect(validBody('queue', 'off-tue-o1', off({ note: 'x'.repeat(2001) }))).toBe(false)
    expect(validBody('queue', 'off-tue-o1', off({ note: 7 }))).toBe(false)
  })
  it('stands alone on an option he has not pressed, only with his words', () => {
    expect(validBody('queue', 'off-tue-o1', off({ approved: null, note: 'Too close to Thursday' }))).toBe(true)
    expect(validBody('queue', 'off-tue-o1', off({ approved: null, note: '  ' }))).toBe(false)
    expect(validBody('queue', 'off-tue-o1', off({ approved: null }))).toBe(false)
    expect(validBody('queue', 'off-tue-o1', off({ approved: undefined, note: 'x' }))).toBe(false)
  })
  it('is added to a pressed option as note_only, which carries its note', () => {
    expect(validBody('queue', 'off-tue-o1', off({ note: 'later thought', note_only: true }))).toBe(true)
    expect(validBody('queue', 'off-tue-o1', off({ note: '', note_only: true }))).toBe(true)
    expect(validBody('queue', 'off-tue-o1', off({ note_only: true }))).toBe(false)
    expect(validBody('queue', 'off-tue-o1', off({ note: 'x', note_only: false }))).toBe(false)
  })
  it('never runs a press again', async () => {
    const out = await afterPress({} as never, { week: WEEK, collection: 'queue', id: 'off-thu-mine',
      body: off({ day: 'thu', pick: 'off-thu-mine', kind: 'recorded', note: 'x', note_only: true }), who: 'Krish', saved: { ok: true, revision: 4 } })
    expect(out).toBeNull()
  })

  function boardDb(stored: Record<string, unknown> | null) {
    const saves: any[] = []
    const db = {
      saves,
      rpc: async (_: string, a: Record<string, any>) => { saves.push(a); return { data: { ok: true, revision: a.p_revision + 1, body: a.p_body }, error: null } },
      from: () => { const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: stored ? { body: stored } : null, error: null }) }; return q },
    }
    return db
  }
  async function put(db: unknown, body: Record<string, unknown>) {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    const handler = createBoardHandler(async () => db as never, { now: () => '2026-11-01T09:00:01.000Z' })
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    let status = 0; let out: any
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: unknown) { out = v } } as unknown as VercelResponse
    await handler({ method: 'PUT', headers: { cookie, origin: 'https://content.krishraja.com' }, query: { week: WEEK, collection: 'queue', id: 'off-tue-o1' },
      body: { body, revision: 3 } } as unknown as VercelRequest, res)
    return { status, out }
  }
  it('keeps the press exactly as saved, its send included, and changes only the note', async () => {
    const stored = off({ kind: undefined, send: { status: 'sent' }, at: 'earlier' })
    const db = boardDb(stored)
    const { status } = await put(db, { pick: 'off-tue-o1', use: 'offday', day: 'tue', approved: false, copy_sha256: 'b'.repeat(64), note: 'Make it a meme', note_only: true, at: '2026-11-01T10:00:00Z' })
    expect(status).toBe(200)
    expect(db.saves).toHaveLength(1)
    expect(db.saves[0].p_body).toEqual({ ...stored, note: 'Make it a meme', at: '2026-11-01T10:00:00Z', note_only: true })
  })
  it('refuses note_only on an option he never pressed', async () => {
    const { status, out } = await put(boardDb(null), { pick: 'off-tue-o1', use: 'offday', day: 'tue', approved: true, copy_sha256: 'b'.repeat(64), note: 'x', note_only: true })
    expect(status).toBe(409)
    expect(out).toMatchObject({ ok: false, error: 'offday_press_not_found' })
  })
})
