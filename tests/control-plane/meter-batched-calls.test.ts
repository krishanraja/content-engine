import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// anthropicCall metered exactly one call, because until now every caller WAS
// exactly one call: one request, one usage object, one run.
//
// The AEO engine is not. It runs in GitHub Actions, calls Anthropic directly,
// and posts its totals afterwards — one row per model per run, where a run is
// around fifty probes. Metered as a single call, the dollars would have been
// right and `runs` would have read 1, so cost-per-run would have been fifty
// times the truth sitting next to a correct total. That is the kind of
// half-wrong number that survives for years, because the figure beside it
// checks out.

const added: Array<Record<string, unknown>> = []

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      added.push(args)
      return { error: null }
    },
  },
}))

const usage = { input_tokens: 50_000, output_tokens: 5_000 }

describe('anthropicCall over a batch of calls', () => {
  beforeEach(() => { added.length = 0 })
  afterEach(() => { vi.resetModules() })

  it('records one run per call, not one run per report', async () => {
    const meter = await import('../../apps/control-plane/api/_meter.js')
    await meter.anthropicCall({ agent: 'aeo-probe', model: 'claude-sonnet-5', usage, calls: 54 })
    expect(added).toHaveLength(1)
    expect(added[0].p_runs).toBe(54)
    // The tokens are the batch's total and are NOT multiplied by the run count.
    expect(added[0].p_units).toBe(55_000)
  })

  it('still reads as one run when nothing says otherwise', async () => {
    const meter = await import('../../apps/control-plane/api/_meter.js')
    await meter.anthropicCall({ agent: 'cleo-revise', model: 'claude-sonnet-5', usage })
    expect(added[0].p_runs).toBe(1)
    expect(added[0].p_failed).toBe(0)
  })

  it('carries a failure count, and never more failures than calls', async () => {
    const meter = await import('../../apps/control-plane/api/_meter.js')
    await meter.anthropicCall({ agent: 'aeo-probe', model: 'claude-sonnet-5', usage, calls: 10, failedCalls: 3 })
    expect(added[0].p_runs).toBe(10)
    expect(added[0].p_failed).toBe(3)
    added.length = 0
    await meter.anthropicCall({ agent: 'aeo-probe', model: 'claude-sonnet-5', usage, calls: 2, failedCalls: 99 })
    expect(added[0].p_failed).toBe(2)
  })

  // An explicit zero is a statement — "none of these failed" — and must not be
  // overridden by the single-call boolean that exists for everyone else.
  it('an explicit zero failure count wins over the boolean', async () => {
    const meter = await import('../../apps/control-plane/api/_meter.js')
    await meter.anthropicCall({ agent: 'aeo-probe', model: 'claude-sonnet-5', usage, failed: true, failedCalls: 0 })
    expect(added[0].p_failed).toBe(0)
  })

  it('a batch can name the day it belongs to, for a run that reports after midnight', async () => {
    const meter = await import('../../apps/control-plane/api/_meter.js')
    await meter.anthropicCall({ agent: 'aeo-digest', model: 'claude-sonnet-5', usage, calls: 5, day: '2026-09-20' })
    expect(added[0].p_day).toBe('2026-09-20')
  })

  // The existing contract, unchanged by any of the above: no tokens, no row.
  it('a call with no tokens is still not written at all', async () => {
    const meter = await import('../../apps/control-plane/api/_meter.js')
    await meter.anthropicCall({ agent: 'aeo-probe', model: 'claude-sonnet-5', usage: {}, calls: 40 })
    expect(added).toHaveLength(0)
  })
})
