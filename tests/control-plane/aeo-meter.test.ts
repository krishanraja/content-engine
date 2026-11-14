import { beforeEach, describe, expect, it, vi } from 'vitest'

// AEO brief, section F: the engine's meter rows say who billed them and how.
// Subscription rows carry tokens and no dollar amount (Ruling, Krish,
// 2026-11-13), in a bucket of their own; Anthropic API rows are priced by
// anthropicCall with their searches beside them; Perplexity is priced from the
// table; OpenAI, Google and xAI from each provider's published price
// (PROVIDER_PRICES), searches beside; a model with no rate lands as tokens with
// no dollars, `unpriced-model`, a visible gap rather than a cheap-looking zero.

const db = vi.hoisted(() => ({ rpc: [] as Array<Record<string, unknown>> }))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    rpc: async (_fn: string, args: Record<string, unknown>) => { db.rpc.push(args); return { error: null } },
    from() {
      const chain: Record<string, unknown> = {}
      for (const k of ['select', 'like', 'not', 'order', 'limit', 'in', 'eq']) chain[k] = () => chain
      chain.insert = async () => ({ error: null })
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
      return chain
    },
  },
}))

const meter = await import('../../apps/control-plane/api/_meter.js')
const { rowErrors } = await import('../../apps/control-plane/api/aeo/meter.js')

beforeEach(() => { db.rpc.length = 0 })

const cell = (r: Record<string, unknown>) => [r.p_provider, r.p_unit_key, r.p_bucket, r.p_category, r.p_usd, r.p_runs, r.p_failed, r.p_units]

describe('the AEO meter rows', () => {
  it('a subscription row is tokens with no dollar amount, in its own bucket', async () => {
    await meter.reportedUsage({ provider: 'anthropic', billing: 'subscription', agent: 'aeo-probe', model: 'claude-sonnet-5', inputTokens: 1000, outputTokens: 500, calls: 40, failedCalls: 2, searchCalls: 90 })
    expect(db.rpc.map(cell)).toEqual([['anthropic', 'aeo-probe', 'claude-sonnet-5 (subscription)', 'subscription', 0, 40, 2, 1500]])
  })

  it('an Anthropic API row is priced by anthropicCall, its searches at $10 a thousand beside it', async () => {
    await meter.reportedUsage({ provider: 'anthropic', billing: 'api', agent: 'aeo-probe', model: 'claude-sonnet-5', usage: { input_tokens: 1_000_000, output_tokens: 100_000 }, calls: 10, searchCalls: 25 })
    expect(db.rpc.map(cell)).toEqual([
      ['anthropic', 'aeo-probe', 'claude-sonnet-5', 'priced', 3, 10, 0, 1_100_000],
      ['anthropic', 'aeo-probe', 'claude-sonnet-5 web search', 'priced', 0.25, 0, 0, 25],
    ])
  })

  it('Perplexity is priced from the table with one request fee a call that answered', async () => {
    await meter.reportedUsage({ provider: 'perplexity', billing: 'api', agent: 'aeo-probe', model: 'sonar', inputTokens: 1_000_000, outputTokens: 1_000_000, calls: 10, failedCalls: 2 })
    const [r] = db.rpc
    expect(cell(r).slice(0, 4)).toEqual(['perplexity', 'aeo-probe', 'sonar', 'priced'])
    // $1 in + $1 out + 8 answered requests at $0.005
    expect(r.p_usd).toBeCloseTo(2.04, 6)
  })

  it('OpenAI, Google and xAI are priced from each provider\'s published page, searches in a bucket of their own', async () => {
    const day = '2026-11-22'
    for (const [provider, model] of [['openai', 'gpt-5'], ['google', 'gemini-3.6-flash'], ['xai', 'grok-4']] as const) {
      await meter.reportedUsage({ provider, billing: 'api', agent: 'aeo-probe', model, inputTokens: 1_000_000, outputTokens: 1_000_000, calls: 3, searchCalls: 1000, day })
    }
    const rows = db.rpc.map(cell)
    expect(rows.map(r => r.slice(0, 4))).toEqual([
      ['openai', 'aeo-probe', 'gpt-5 web search', 'priced'], ['openai', 'aeo-probe', 'gpt-5', 'priced'],
      ['google', 'aeo-probe', 'gemini-3.6-flash web search', 'priced'], ['google', 'aeo-probe', 'gemini-3.6-flash', 'priced'],
      ['xai', 'aeo-probe', 'grok-4 web search', 'priced'], ['xai', 'aeo-probe', 'grok-4', 'priced'],
    ])
    expect(rows.map(r => Number(r[4]))).toEqual([10, 11.25, 14, 4.5, 5, 3.75].map(x => expect.closeTo(x, 6)) as unknown as number[])
    // Gemini 3.6 Flash doubles from 1 Jan 2027, its published date.
    db.rpc.length = 0
    await meter.reportedUsage({ provider: 'google', billing: 'api', agent: 'aeo-probe', model: 'gemini-3.6-flash', inputTokens: 1_000_000, outputTokens: 1_000_000, day: '2027-01-01' })
    expect(Number(db.rpc[0].p_usd)).toBeCloseTo(9, 6)
  })

  it('an exact id only: a newer model with no published rate here stays unpriced, never a cheap-looking zero', async () => {
    await meter.reportedUsage({ provider: 'xai', billing: 'api', agent: 'aeo-probe', model: 'grok-4.7', inputTokens: 100, outputTokens: 50, calls: 3, searchCalls: 4 })
    expect(db.rpc.map(cell)).toEqual([['xai', 'aeo-probe', 'grok-4.7', 'unpriced-model', 0, 3, 0, 150]])
  })

  it('a row with nothing measured writes nothing; a failure with no tokens is still a failure', async () => {
    await meter.reportedUsage({ provider: 'openai', billing: 'api', agent: 'aeo-probe', model: 'gpt-5', inputTokens: 0, outputTokens: 0, calls: 1 })
    expect(db.rpc).toEqual([])
    await meter.reportedUsage({ provider: 'openai', billing: 'api', agent: 'aeo-probe', model: 'gpt-5', calls: 2, failedCalls: 2 })
    expect(db.rpc.map(cell)).toEqual([['openai', 'aeo-probe', 'gpt-5', 'priced', 0, 2, 2, 0]])
  })

  it('the route names every bad row and takes the old Anthropic shape unchanged', () => {
    expect(rowErrors([{ agent: 'aeo-probe', model: 'claude-sonnet-5', usage: { input_tokens: 1, output_tokens: 1 }, calls: 1 }])).toEqual([])
    expect(rowErrors([{ provider: 'openai', billing: 'api', model: 'gpt-5', input_tokens: 10, output_tokens: 5, search_calls: 2 }])).toEqual([])
    expect(rowErrors([
      { provider: 'mistral', model: 'm', input_tokens: 1, output_tokens: 1 },
      { billing: 'free', model: 'm', input_tokens: 1, output_tokens: 1 },
      { model: 'm' },
      { model: 'm', input_tokens: -1, output_tokens: 1.5 },
      { model: 'm', input_tokens: 1, output_tokens: 1, search_calls: 'many' },
      { input_tokens: 1, output_tokens: 1 },
    ])).toEqual([
      'rows[0]: provider must be one of anthropic, openai, perplexity, google, xai',
      'rows[1]: billing must be api or subscription',
      'rows[2]: usage object or input_tokens and output_tokens required',
      'rows[3]: input_tokens and output_tokens must be whole numbers',
      'rows[4]: search_calls must be a whole number',
      'rows[5]: model required',
    ])
  })
})
