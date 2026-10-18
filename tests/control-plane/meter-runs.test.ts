import { beforeEach, describe, expect, it, vi } from 'vitest'

// Cost guard G12 (docs/COST_GUARDS.md): Perplexity and OpenAI calls are metered,
// and a call made for a piece's run also lands as one row with the piece and the
// run, so a rerun's estimate is the last run's own cost, not a day's average.
// The per-run table may not exist yet (its migration waits on Krish): the daily
// cells must be written exactly as before, and the estimate must fall back.

const db = vi.hoisted(() => ({
  rpc: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
  eventsTable: true,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    rpc: async (_fn: string, args: Record<string, unknown>) => { db.rpc.push(args); return { error: null } },
    from(table: string) {
      const chain: Record<string, unknown> = {}
      for (const k of ['select', 'like', 'not', 'order', 'limit', 'in', 'eq']) chain[k] = () => chain
      chain.insert = async (row: Record<string, unknown>) => {
        if (table === 'meter_events' && !db.eventsTable) return { error: { code: 'PGRST205', message: "Could not find the table 'public.meter_events'" } }
        db.events.push(row)
        return { error: null }
      }
      chain.then = (resolve: (v: unknown) => unknown) => {
        if (table === 'meter_events' && !db.eventsTable) return Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'missing' } }).then(resolve)
        const data = table === 'meter_events' ? db.events : [{ day: '2026-10-18', unit_key: 'fact-gate-extract', usd: 2, runs: 2 }, { day: '2026-10-18', unit_key: 'fact-gate-web', usd: 1, runs: 20 }]
        return Promise.resolve({ data, error: null }).then(resolve)
      }
      return chain
    },
  },
}))

const meter = await import('../../apps/control-plane/api/_meter.js')
const prices = await import('../../apps/control-plane/api/_prices.js')

beforeEach(() => { db.rpc.length = 0; db.events.length = 0 })

describe('Perplexity and OpenAI on the meter', () => {
  it('prices a Perplexity call by its own reported cost first', () => {
    expect(prices.perplexityUsd('sonar-pro', { prompt_tokens: 1000, completion_tokens: 500, cost: { total_cost: 0.0187 } })).toBe(0.0187)
    // 1000 in at $3/M + 500 out at $15/M + the $0.006 request fee
    expect(prices.perplexityUsd('sonar-pro', { prompt_tokens: 1000, completion_tokens: 500 })).toBeCloseTo(0.0165, 6)
    expect(prices.perplexityUsd('unknown-model', { prompt_tokens: 1000 })).toBe(0)
  })

  it('records Perplexity and OpenAI calls as their own providers', async () => {
    await meter.perplexityCall({ agent: 'fact-gate-web', model: 'sonar-pro', usage: { prompt_tokens: 100, completion_tokens: 50, cost: { total_cost: 0.01 } } })
    await meter.openaiEmbeddingCall({ agent: 'embeddings', model: 'text-embedding-3-small', usage: { total_tokens: 1_000_000 } })
    expect(db.rpc.map(r => [r.p_provider, r.p_unit_key, r.p_usd])).toEqual([['perplexity', 'fact-gate-web', 0.01], ['openai', 'embeddings', 0.02]])
    expect(db.events).toEqual([])
  })

  it('a failed call is a run and a failure at no cost', async () => {
    await meter.perplexityCall({ agent: 'challenge', model: 'sonar-pro', failed: true })
    expect(db.rpc[0]).toMatchObject({ p_provider: 'perplexity', p_failed: 1, p_usd: 0 })
  })
})

describe('piece and run ids', () => {
  it('every call inside a scope lands with the piece and the run', async () => {
    await meter.meterScope({ pieceId: 'piece-1', runId: 'run-1' }, async () => {
      await meter.anthropicCall({ agent: 'fact-gate-extract', model: 'claude-haiku-4-5', inputTokens: 1_000_000, outputTokens: 0 })
      await Promise.all([meter.perplexityCall({ agent: 'fact-gate-web', model: 'sonar-pro', usage: { prompt_tokens: 10, completion_tokens: 10, cost: { total_cost: 0.5 } } })])
    })
    expect(db.events.map(e => [e.provider, e.unit_key, e.piece_id, e.run_id, e.usd])).toEqual([
      ['anthropic', 'fact-gate-extract', 'piece-1', 'run-1', 1],
      ['perplexity', 'fact-gate-web', 'piece-1', 'run-1', 0.5],
    ])
    expect(meter.currentMeterScope()).toBeNull()
  })

  it('the estimate is the newest run\'s own total', async () => {
    const run = meter.newestRunCost([
      { at: '2026-10-18T10:00:00Z', run_id: 'old', piece_id: 'p', usd: 4 },
      { at: '2026-10-18T12:00:00Z', run_id: 'new', piece_id: 'p', usd: 0.6 },
      { at: '2026-10-18T12:01:00Z', run_id: 'new', piece_id: 'p', usd: '0.25' },
      { at: '2026-10-18T13:00:00Z', run_id: null, piece_id: null, usd: 9 },
    ])
    expect(run).toEqual({ day: '2026-10-18', runs: 1, usd_per_run: 0.85, basis: 'run', run_id: 'new', piece_id: 'p' })
  })

  it('without the table the day cells are written as before and the estimate is the day average', async () => {
    db.eventsTable = false
    await meter.meterScope({ pieceId: 'p', runId: 'r' }, () => meter.perplexityCall({ agent: 'fact-gate-web', model: 'sonar-pro', usage: { prompt_tokens: 1, completion_tokens: 1, cost: { total_cost: 0.1 } } }))
    expect(db.rpc).toHaveLength(1)
    expect(db.events).toEqual([])
    // $2 of extract plus $1 of web checks over the day's 2 runs
    expect(await meter.lastFactRunCost()).toEqual({ day: '2026-10-18', runs: 2, usd_per_run: 1.5, basis: 'day_average' })
    db.eventsTable = true
  })
})
