import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The live judge sweep ends, and the next one takes the ideas that exist now
// (docs/plans/2026-11-11-ideas-wave1-diagnosis.md).
//
// Measured 11 November: sweep 8903e989, created 30 October, was still
// `running` on its thirteenth daily tick. A live sweep finished only when one
// tick reached the end of its list inside its four-minute clock, the 20-tick
// ceiling counted only when a batch was out, and a live sweep never has one.
// So every morning `loadRunning` handed back the same 30 October list, no new
// sweep was created, and none of the 95 ideas made after 2 November was ever
// chosen. These tests hold the repair: an expired live sweep is closed through
// the route's own conditional write (never deleted), the same tick starts a
// sweep over the current ideas, a young sweep is still carried on, and the
// tick ceiling counts in live mode too.

vi.hoisted(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})

type Row = Record<string, any>

// A small in-memory PostgREST: enough of the query shapes the sweep, its
// candidate query and the run ledger use, with filters that really filter, so
// a test that passes is a test the route's own queries passed.
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  updates: [] as Array<{ table: string; patch: Row; matched: number }>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  let seq = 0
  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = []
    let order: { col: string; asc: boolean } | null = null
    let limit = Infinity
    let op: { kind: 'select' } | { kind: 'update'; patch: Row } | { kind: 'insert'; rows: Row[] } = { kind: 'select' }
    const rows = () => (db.tables[table] ||= [])
    const matching = () => {
      let out = rows().filter(r => filters.every(f => f(r)))
      if (order) {
        const { col, asc } = order
        out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1))
      }
      return out.slice(0, limit)
    }
    const run = (): { data: any; error: null } => {
      if (op.kind === 'insert') {
        const made = op.rows.map(r => ({ id: `row-${++seq}`, created_at: new Date().toISOString(), status: table === 'judge_sweeps' ? 'running' : undefined, ticks: 0, batches: [], counts: {}, note: null, ...r }))
        rows().push(...made)
        return { data: made, error: null }
      }
      if (op.kind === 'update') {
        const hit = matching()
        for (const r of hit) Object.assign(r, op.patch)
        db.updates.push({ table, patch: op.patch, matched: hit.length })
        return { data: hit, error: null }
      }
      return { data: matching(), error: null }
    }
    const chain: Record<string, any> = {
      select: () => chain,
      eq: (c: string, v: unknown) => { filters.push(r => r[c] === v); return chain },
      in: (c: string, vs: unknown[]) => { filters.push(r => vs.includes(r[c])); return chain },
      is: (c: string, v: unknown) => { filters.push(r => (r[c] ?? null) === v); return chain },
      not: () => chain,
      neq: (c: string, v: unknown) => { filters.push(r => r[c] !== v); return chain },
      order: (col: string, o?: { ascending?: boolean }) => { order = { col, asc: o?.ascending !== false }; return chain },
      limit: (n: number) => { limit = n; return chain },
      range: (a: number, b: number) => { limit = b - a + 1; return chain },
      insert: (r: Row | Row[]) => { op = { kind: 'insert', rows: Array.isArray(r) ? r : [r] }; return chain },
      upsert: (r: Row | Row[]) => { op = { kind: 'insert', rows: Array.isArray(r) ? r : [r] }; return chain },
      update: (patch: Row) => { op = { kind: 'update', patch }; return chain },
      maybeSingle: async () => { const { data } = run(); return { data: data[0] ?? null, error: null } },
      single: async () => { const { data } = run(); return { data: data[0] ?? null, error: null } },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    }
    return chain
  }
  return { supabase: { from } }
})

// The walk itself is the ladder's, tested in its own files. Here it is replaced
// by a stand-in that records which ideas it was asked to judge and reports a
// walk that finished, or one that ran out of its clock.
const walk = vi.hoisted(() => ({ calls: [] as string[][], ranOutOfTime: false }))
vi.mock('../../apps/control-plane/api/judge/ladder.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../apps/control-plane/api/judge/ladder.js')>()
  return {
    ...real,
    runLadder: async ({ ids }: { ids: string[] }) => {
      walk.calls.push([...ids])
      return {
        ok: true, dry_run: false, judged: walk.ranOutOfTime ? 1 : ids.length, ready: walk.ranOutOfTime ? 1 : ids.length,
        escalated: 0, weak: 0, unjudged: 0, skipped: 0, repairs: 0, deferred: 0,
        ran_out_of_time: walk.ranOutOfTime, failed: 0, backed_off: 0, stopped: null, results: [],
      }
    },
  }
})
vi.mock('../../apps/control-plane/api/_judges/batch.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../apps/control-plane/api/_judges/batch.js')>()
  const bus = {
    cached: 0, liveCall: async () => '', call: async () => '', research: async () => null,
    hold: () => {}, commit: async () => {}, abandon: () => {}, flush: async () => null, wantedByAgent: () => ({}),
  }
  return { ...real, BatchBus: { open: async () => bus } }
})

const NOW = new Date('2026-11-12T05:00:20Z')
const secret = ['synthetic', 'cron', 'secret', 'for', 'the', 'sweep'].join('-')

async function tick() {
  process.env.CRON_SECRET = secret
  const { default: handler } = await import('../../apps/control-plane/api/judge/sweep.js')
  const out = { status: 0, body: undefined as any }
  const res: Record<string, any> = {
    statusCode: 200,
    setHeader() { return res },
    status(code: number) { out.status = code; res.statusCode = code; return res },
    json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  await handler({ method: 'GET', headers: { authorization: `Bearer ${secret}` }, query: {}, body: {} } as never, res as never)
  return out
}

const { artifactHash } = await import('../../apps/control-plane/api/_judges/panel.js')
const { liveSweepExpired } = await import('../../apps/control-plane/api/judge/sweep.js')

const idea = (id: string, created_at: string, judged = false): Row => {
  const row: Row = { id, idea: `Idea ${id}`, thesis: `Thesis ${id}`, body: null, lane_slot: null, state: 'seeded', buried_at: null, created_at, updated_at: created_at, meta: {} }
  if (judged) row.meta = { ladder: { final: { band: 'ready' }, artifact_hash: artifactHash(`${row.idea}\n\n${row.thesis}`) } }
  return row
}

const sweep = (over: Row): Row => ({
  id: 'sweep-8903', created_at: '2026-10-30T05:00:37Z', updated_at: '2026-11-11T05:05:49Z', status: 'running',
  idea_ids: ['old-judged', 'old-unjudged'], batches: [], ticks: 13, counts: {}, dry_run: false, note: null, live_fallback: true,
  ...over,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  walk.calls.length = 0
  walk.ranOutOfTime = false
  db.updates.length = 0
  db.tables = {
    system_config: [],
    judge_sweeps: [],
    content_ideas: [
      idea('old-judged', '2026-10-24T11:30:00Z', true),
      idea('old-unjudged', '2026-10-24T06:39:00Z'),
      idea('new-a', '2026-11-03T09:00:00Z'),
      idea('new-b', '2026-11-10T09:00:00Z'),
    ],
  }
})
afterEach(() => { vi.useRealTimers() })

describe('a live sweep that has held its ideas too long', () => {
  it('is closed through the route, never deleted, and the same tick sweeps the ideas made since', async () => {
    db.tables.judge_sweeps = [sweep({})]
    const out = await tick()

    // The stuck sweep is still there, closed with the reason in words.
    const old = db.tables.judge_sweeps.find(r => r.id === 'sweep-8903')!
    expect(old).toBeDefined()
    expect(old.status).toBe('failed')
    expect(old.note).toMatch(/^closed after 312 hours: a live sweep keeps the ideas it chose for at most 6 hours/)
    expect(old.note).toMatch(/still unjudged and eligible/)
    expect(old.note).not.toMatch(/[—–]/)

    // A new sweep chose from the ideas that exist now: the two made after the
    // old sweep's list, newest first, and the one it never reached. The idea
    // with a current score is not chosen again.
    const fresh = db.tables.judge_sweeps.find(r => r.id !== 'sweep-8903')!
    expect(fresh.idea_ids).toEqual(['new-b', 'new-a', 'old-unjudged'])
    expect(walk.calls).toEqual([['new-b', 'new-a', 'old-unjudged']])
    expect(fresh.status).toBe('finished')

    expect(out.status).toBe(200)
    expect(out.body.closed.sweep_id).toBe('sweep-8903')
    expect(out.body.sweep_id).toBe(fresh.id)
  })

  it('a live sweep inside its six hours is carried on with its own list, and no new sweep starts', async () => {
    db.tables.judge_sweeps = [sweep({ created_at: '2026-11-12T01:00:00Z', ticks: 1 })]
    walk.ranOutOfTime = true
    await tick()
    expect(walk.calls).toEqual([['old-judged', 'old-unjudged']])
    expect(db.tables.judge_sweeps).toHaveLength(1)
    expect(db.tables.judge_sweeps[0].status).toBe('running')
    expect(db.tables.judge_sweeps[0].ticks).toBe(2)
  })

  it('a cancel that landed first wins: the close matches nothing and changes nothing', async () => {
    db.tables.judge_sweeps = [sweep({ status: 'cancelled', note: 'cancelled by hand' })]
    await tick()
    const old = db.tables.judge_sweeps.find(r => r.id === 'sweep-8903')!
    expect(old.status).toBe('cancelled')
    expect(old.note).toBe('cancelled by hand')
  })
})

describe('when a live sweep has expired', () => {
  const base = { created_at: '2026-11-12T00:00:00Z', live_fallback: true, batches: [] as never[] }
  it('at six hours, by the clock and not by ticks', () => {
    expect(liveSweepExpired(base, new Date('2026-11-12T05:59:00Z'))).toBeNull()
    expect(liveSweepExpired(base, new Date('2026-11-12T06:00:00Z'))).toBe(360)
  })
  it('never for a batch sweep, live fallback or not: its paid replies are kept under its own id', () => {
    const batch = [{ id: 'msgbatch_1', requests: 64, submitted_at: '2026-11-12T00:00:00Z', read: true }] as never[]
    expect(liveSweepExpired({ ...base, live_fallback: false }, new Date('2026-11-20T00:00:00Z'))).toBeNull()
    expect(liveSweepExpired({ ...base, batches: batch }, new Date('2026-11-20T00:00:00Z'))).toBeNull()
  })
})

describe('the tick ceiling', () => {
  it('counts in live mode: a live sweep that runs out of time on its twentieth tick stops and says why', async () => {
    db.tables.judge_sweeps = [sweep({ created_at: '2026-11-12T04:00:00Z', ticks: 19 })]
    walk.ranOutOfTime = true
    await tick()
    const s = db.tables.judge_sweeps[0]
    expect(s.status).toBe('failed')
    expect(s.ticks).toBe(20)
    expect(s.note).toMatch(/20-tick ceiling without reaching the end of its 2 ideas/)
  })

  it('a live tick that reaches the end of its list still finishes, at any count', async () => {
    db.tables.judge_sweeps = [sweep({ created_at: '2026-11-12T04:00:00Z', ticks: 19 })]
    await tick()
    expect(db.tables.judge_sweeps[0].status).toBe('finished')
  })
})
