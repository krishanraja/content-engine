import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync } from 'node:fs'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { carryInput, dayDocuments, moveRef } from '../../apps/control-plane/api/board/_carry.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// The cross-week carry: a piece that moved weeks keeps its ticks, links, his edits, his decisions and the comment
// threads inside its day, under the new day, written as the writer each already had.

const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN', 'GROWTH_WRITEBACK_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })

const TICKS = [
  { week: '2026-10-26', tick_id: 'fri-substack', body: { done: true, day: 'fri', piece_id: 'p', step: 'substack', label: 'Substack' }, revision: 1, updated_by: 'Krish' },
  { week: '2026-10-26', tick_id: 'wed-substack', body: { done: true, day: 'wed', piece_id: 'q', step: 'substack', label: 'Substack' }, revision: 1, updated_by: 'Krish' },
]
const DOCS = [
  { week: '2026-10-26', collection: 'edits', doc_id: 'fri-article', body: { day: 'fri', item: 'article', text: 'his words' }, revision: 2, updated_by: 'Krish' },
  { week: '2026-10-26', collection: 'links', doc_id: 'fri', body: { article: 'https://x.substack.com/p/a', youtube: '' }, revision: 1, updated_by: 'Krish' },
  { week: '2026-10-26', collection: 'picks', doc_id: 'fri', body: { day: 'fri', pick: 'fri-2', story: 's' }, revision: 1, updated_by: 'Krish' },
  { week: '2026-10-26', collection: 'picks', doc_id: 'fri-scripts', body: { kind: 'scripts', approved: true }, revision: 1, updated_by: 'Krish' },
  { week: '2026-10-26', collection: 'comments', doc_id: 't1', body: { thread_id: 't1', anchor: 'rvs-fri-article', text: 'tighten this' }, revision: 1, updated_by: 'Krish' },
  { week: '2026-10-26', collection: 'comments', doc_id: 't1-r', body: { thread_id: 't1', anchor: 'board-root', text: 'done' }, revision: 1, updated_by: 'engine_operator' },
  { week: '2026-10-26', collection: 'comments', doc_id: 't2', body: { thread_id: 't2', anchor: 'idea-3', text: 'not this one' }, revision: 1, updated_by: 'Krish' },
]

describe('what a day carries', () => {
  it('moves ids and anchors from one day to another, and nothing else', () => {
    expect(moveRef('fri-article', 'fri', 'mon')).toBe('mon-article')
    expect(moveRef('rvs-fri-article', 'fri', 'mon')).toBe('rvs-mon-article')
    expect(moveRef('wed-article', 'fri', 'mon')).toBeNull()
    expect(moveRef('idea-3', 'fri', 'mon')).toBeNull()
  })
  it('takes the day\'s ticks, link, edits, his decisions and its threads with their replies; never the day pick', () => {
    const out = dayDocuments(TICKS, DOCS, 'fri', 'mon', '2026-10-26')
    expect(out.map(d => `${d.collection}/${d.id}/${d.by}`).sort()).toEqual([
      'comments/t1-r/engine_operator', 'comments/t1/Krish', 'edits/mon-article/Krish', 'links/mon/Krish', 'picks/mon-scripts/Krish', 'ticks/mon-substack/Krish'])
    const edit = out.find(d => d.collection === 'edits')!
    expect(edit.body).toMatchObject({ day: 'mon', item: 'article', text: 'his words', carried_from: { week: '2026-10-26', collection: 'edits', id: 'fri-article' } })
    expect(out.find(d => d.id === 't1')!.body.anchor).toBe('rvs-mon-article')
  })
  it('takes a well-formed body only', () => {
    expect(carryInput({ from_week: '2026-10-26', from_day: 'fri', to_day: 'mon' }).input).toBeTruthy()
    expect(carryInput({ from_week: '2026-10-27', from_day: 'fri', to_day: 'mon' }).problem).toMatch(/Monday/)
    expect(carryInput({ from_week: '2026-10-26', from_day: 'tue', to_day: 'mon' }).problem).toMatch(/from_day/)
    expect(carryInput({ from_week: '2026-10-26', from_day: 'fri', to_day: 'mon', x: 1 }).problem).toMatch(/unknown/)
  })
})

function fakeDb(held: Record<string, unknown> = {}) {
  const saved: Array<Record<string, unknown>> = []
  const db = {
    rpc: async (name: string, a: Record<string, any>) => {
      expect(name).toBe('board_save'); expect(a.p_week).toBe('2026-11-02'); expect(a.p_revision).toBe(0)
      saved.push(a); return { data: { ok: true, revision: 1 }, error: null }
    },
    from: (table: string) => {
      const f: Record<string, unknown> = {}
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { f[k] = v; return q },
        range: async () => ({ data: f.week === '2026-10-26' ? (table === 'board_ticks' ? TICKS : DOCS) : [], error: null }),
        maybeSingle: async () => {
          const key = table === 'board_ticks' ? `ticks/${f.tick_id}` : `${f.collection}/${f.doc_id}`
          return { data: key in held ? { body: held[key], revision: 1 } : null, error: null }
        },
      }
      return q
    },
  }
  return { db, saved }
}

describe('POST /api/board/<Monday>/carry', () => {
  const call = async (fake: ReturnType<typeof fakeDb>, body: unknown, auth = 'Bearer synthetic-operator', method = 'POST') => {
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    process.env.GROWTH_WRITEBACK_TOKEN = 'synthetic-growth'
    process.env.ACCESS_CODE = 'synthetic-board-test'
    const handler = createBoardHandler(async () => fake.db as never)
    let status = 0; let out: any
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: unknown) { out = v } } as unknown as VercelResponse
    await handler({ method, headers: auth ? { authorization: auth } : {}, query: { week: '2026-11-02', op: 'carry' }, body } as unknown as VercelRequest, res)
    return { status, out }
  }
  const body = { from_week: '2026-10-26', from_day: 'fri', to_day: 'mon' }
  it('opens to the operator key only', async () => {
    expect((await call(fakeDb(), body, '')).status).toBe(401)
    expect((await call(fakeDb(), body, 'Bearer synthetic-growth')).status).toBe(401)
    expect((await call(fakeDb(), body, 'Bearer synthetic-operator', 'GET')).status).toBe(405)
  })
  it('writes each document as its own writer, and leaves a different one already there alone', async () => {
    const fake = fakeDb({ 'edits/mon-article': { day: 'mon', item: 'article', text: 'newer words' } })
    const r = await call(fake, body)
    expect(r.status).toBe(200)
    expect(r.out).toMatchObject({ ok: true, carried: { ticks: 1, links: 1, edits: 0, picks: 1, comments: 2 }, conflicts: ['edits/mon-article'] })
    expect(fake.saved.find(s => s.p_id === 't1')!.p_actor).toBe('Krish')
    expect(fake.saved.find(s => s.p_id === 't1-r')!.p_actor).toBe('engine_operator')
  })
  it('is routed at /api/board/<Monday>/carry', () => {
    const v = readFileSync(new URL('../../apps/control-plane/vercel.json', import.meta.url), 'utf8')
    expect(JSON.stringify(JSON.parse(v))).toContain('"source":"/api/board/:week/carry","destination":"/api/board?week=:week&op=carry"')
  })
})
