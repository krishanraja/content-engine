import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Provider failures are counted (walk log F29).
//
// From 2026-09-27 10:00 UTC every Anthropic call the engine made was refused
// for the account's usage limit, and meter_daily recorded none of them:
// anthropicCall returned early on zero tokens, and a refused call has none. So
// `failed` read 0 for a key that had not answered for 33 hours. These are the
// properties that make a refusal visible: counted on its key and day, at no
// cost, classified, and kept where the health endpoint reads it.

const db = vi.hoisted(() => ({
  rpc: [] as Array<Record<string, unknown>>,
  upserts: [] as Array<Record<string, unknown>>,
  config: [] as Array<{ key: string; value: string }>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    rpc: async (_fn: string, args: Record<string, unknown>) => { db.rpc.push(args); return { error: null } },
    from(table: string) {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.in = () => chain
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: table === 'system_config' ? db.config : [], error: null }).then(resolve)
      chain.upsert = async (row: Record<string, unknown>) => {
        db.upserts.push(row)
        const i = db.config.findIndex(r => r.key === row.key)
        if (i >= 0) db.config[i] = { key: String(row.key), value: String(row.value) }
        else db.config.push({ key: String(row.key), value: String(row.value) })
        return { error: null }
      }
      return chain
    },
  },
}))

const LIMIT = 'You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC.'

const provider = await import('../../apps/control-plane/api/_modelProvider.js')
const { JUDGE_MODEL, UTILITY_MODEL } = await import('../../apps/control-plane/api/_models.js')
const meter = await import('../../apps/control-plane/api/_meter.js')

beforeEach(() => {
  db.rpc.length = 0
  db.upserts.length = 0
  db.config.length = 0
  provider.resetProviderMemory()
})

afterEach(() => { vi.unstubAllGlobals() })

describe('what a failure is called', () => {
  it('the usage limit of 2026-09-27, with the reset time the provider gave', () => {
    const f = provider.classifyAnthropicFailure(Object.assign(new Error(`anthropic_400:${LIMIT}`), { status: 400 }))
    expect(f.class).toBe('usage_limit')
    expect(f.status).toBe(400)
    expect(f.message).toBe(LIMIT)
    expect(f.reset_at).toBe('2026-10-01T00:00:00.000Z')
    expect(provider.refusesEveryCall(f.class)).toBe(true)
  })

  it('the same status means different things: a 400 can be a spent balance or a bad request', () => {
    expect(provider.classifyAnthropicFailure(new Error('anthropic_400:Your credit balance is too low to access the Anthropic API.')).class).toBe('credit')
    expect(provider.classifyAnthropicFailure(new Error('anthropic_400:prompt is too long: 250000 tokens > 200000 maximum')).class).toBe('request')
  })

  it('names an overload, a rate limit, a server error, a bad key and a deadline', () => {
    const cls = (m: string) => provider.classifyAnthropicFailure(new Error(m)).class
    expect(cls('anthropic_529:Overloaded')).toBe('overload')
    expect(cls('anthropic_stream_error:overloaded_error: Overloaded')).toBe('overload')
    expect(cls('anthropic_429:Number of request tokens has exceeded your per-minute rate limit')).toBe('rate_limit')
    expect(cls('anthropic_500:Internal server error')).toBe('server')
    expect(cls('anthropic_401:invalid x-api-key')).toBe('auth')
    expect(cls('ANTHROPIC_API_KEY not configured')).toBe('auth')
    expect(cls('anthropic_timeout_45000ms')).toBe('timeout')
    // Transient classes back off; they do not stop every run.
    for (const c of ['overload', 'rate_limit', 'server', 'timeout', 'request'] as const) expect(provider.refusesEveryCall(c)).toBe(false)
  })
})

describe('a failed call is counted on its key and day, at no cost', () => {
  it('a refusal with no tokens adds one run and one failure, and no dollars', async () => {
    await meter.anthropicFailure({ agent: 'cleo-revise', model: UTILITY_MODEL, error: new Error(`anthropic_400:${LIMIT}`) })
    expect(db.rpc).toHaveLength(1)
    const row = db.rpc[0]!
    expect(row.p_unit_key).toBe('cleo-revise')
    expect(row.p_runs).toBe(1)
    expect(row.p_failed).toBe(1)
    expect(row.p_usd).toBe(0)
    expect(row.p_units).toBe(0)
  })

  it('a call that failed after producing tokens is still priced, because it was billed', async () => {
    await meter.anthropicFailure({ agent: 'cleo-revise', model: UTILITY_MODEL, usage: { input_tokens: 1000, output_tokens: 10 }, error: new Error('anthropic_stream_error:overloaded_error: Overloaded') })
    expect(db.rpc[0]!.p_failed).toBe(1)
    expect(Number(db.rpc[0]!.p_usd)).toBeGreaterThan(0)
  })

  it('a batch of refused calls posted as a total is counted too', async () => {
    await meter.anthropicCall({ agent: 'judge-batch', model: JUDGE_MODEL, usage: null, calls: 9, failedCalls: 9 })
    expect(db.rpc).toHaveLength(1)
    expect(db.rpc[0]!.p_runs).toBe(9)
    expect(db.rpc[0]!.p_failed).toBe(9)
  })

  it('a call with neither tokens nor a failure still writes nothing', async () => {
    await meter.anthropicCall({ agent: 'x', model: UTILITY_MODEL, usage: {} })
    expect(db.rpc).toHaveLength(0)
  })
})

describe('the failure is kept where health and the judge sweep read it', () => {
  it('a success in the same millisecond as the failure is still noted once', async () => {
    // CI on 2026-10-03: a fast runner put the failure and the first success
    // in one millisecond, and the recovery was written twice.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-03T18:20:00.000Z') })
    try {
      await meter.anthropicFailure({ agent: 'judge-0', model: JUDGE_MODEL, error: new Error(`anthropic_400:${LIMIT}`) })
      await meter.anthropicCall({ agent: 'cleo-draft', model: UTILITY_MODEL, usage: { input_tokens: 10, output_tokens: 10 } })
      await meter.anthropicCall({ agent: 'cleo-draft', model: UTILITY_MODEL, usage: { input_tokens: 10, output_tokens: 10 } })
      expect(db.upserts.filter(u => u.key === provider.OK_KEY)).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('recorded once for a burst of nine judges, then a success after it is noted once', async () => {
    for (let i = 0; i < 9; i++) {
      await meter.anthropicFailure({ agent: `judge-${i}`, model: JUDGE_MODEL, error: new Error(`anthropic_400:${LIMIT}`) })
    }
    const failures = db.upserts.filter(u => u.key === provider.FAILURE_KEY)
    expect(failures).toHaveLength(1)
    const stored = provider.parseFailure(failures[0]!.value)
    expect(stored?.class).toBe('usage_limit')
    expect(stored?.reset_at).toBe('2026-10-01T00:00:00.000Z')
    expect(stored?.agent).toBe('judge-0')

    await meter.anthropicCall({ agent: 'cleo-draft', model: UTILITY_MODEL, usage: { input_tokens: 10, output_tokens: 10 } })
    await meter.anthropicCall({ agent: 'cleo-draft', model: UTILITY_MODEL, usage: { input_tokens: 10, output_tokens: 10 } })
    expect(db.upserts.filter(u => u.key === provider.OK_KEY)).toHaveLength(1)
  })

  it('a reporter posting another process\'s totals records no provider state', async () => {
    await meter.anthropicCall({ agent: 'aeo-probe', model: UTILITY_MODEL, usage: null, calls: 5, failedCalls: 5, error: new Error(LIMIT) })
    expect(db.upserts).toHaveLength(0)
  })
})

describe('the call helpers meter their own failures', () => {
  it('callClaude meters a refusal once and throws it with its status', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-not-a-key'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: LIMIT } }), { status: 400 })))
    const { callClaude } = await import('../../apps/control-plane/api/_content.js')
    await expect(callClaude({ system: 's', user: 'u', agent: 'cleo-draft' })).rejects.toThrow(/anthropic_400:You have reached/)
    expect(db.rpc).toHaveLength(1)
    expect(db.rpc[0]!.p_failed).toBe(1)
    expect(db.upserts.some(u => u.key === provider.FAILURE_KEY)).toBe(true)
  })

  it('streamClaude refuses before it opens, so the caller can still answer with a status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: LIMIT } }), { status: 400 })))
    const { streamClaude } = await import('../../apps/control-plane/api/_stream.js')
    const onOpen = vi.fn()
    await expect(streamClaude({ apiKey: 'k', model: UTILITY_MODEL, maxTokens: 10, system: 's', messages: [{ role: 'user', content: 'u' }], onText: () => {}, onOpen, agent: 'cleo-revise' }))
      .rejects.toMatchObject({ status: 400 })
    expect(onOpen).not.toHaveBeenCalled()
    expect(db.rpc[0]!.p_failed).toBe(1)
  })

  it('streamClaude never returns half an answer as a whole one when the stream reports an error', async () => {
    const sse = [
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":1200,"output_tokens":1}}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Half a"}}',
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
    ].join('\n\n') + '\n\n'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })))
    const { streamClaude } = await import('../../apps/control-plane/api/_stream.js')
    const onOpen = vi.fn()
    const err = await streamClaude({ apiKey: 'k', model: UTILITY_MODEL, maxTokens: 10, system: 's', messages: [{ role: 'user', content: 'u' }], onText: () => {}, onOpen, agent: 'cleo-revise' })
      .then(() => null, (e: unknown) => e)
    expect(err).not.toBeNull()
    expect(provider.classifyAnthropicFailure(err).class).toBe('overload')
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(db.rpc[0]!.p_failed).toBe(1)
  })
})
