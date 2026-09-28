import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The brief's rewrite can never read as a success when it failed (walk log
// F40).
//
// POST /api/briefs/:week/revise opened its stream before the model call, the
// fault 1d6a1b0 fixed on the piece's revise (F31): a usage limit came back as
// HTTP 200 carrying one untyped event. Now it answers as the piece's revise
// does. A failure known before the stream opens is a JSON body with a failure
// status; after it opens, it is a typed `error` event, the stream's last, with
// no `done`.

// A dead local address before anything loads, the database client mocked,
// and the two config readers stubbed, so nothing here reaches a database.
vi.hoisted(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})
vi.mock('../../apps/control-plane/api/_content.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../apps/control-plane/api/_content.js')>()),
  loadVoiceBlock: async () => '',
}))
vi.mock('../../apps/control-plane/api/_briefNotes.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../apps/control-plane/api/_briefNotes.js')>()),
  loadStandingNotes: async () => [],
}))
vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    rpc: async () => ({ error: null }),
    from(table: string) {
      const chain: Record<string, any> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) chain[m] = () => chain
      const row = table === 'weekly_briefs' ? { week: WEEK, body_md: BRIEF } : null
      chain.single = async () => ({ data: row, error: null })
      chain.maybeSingle = chain.single
      chain.update = () => chain
      chain.insert = async () => ({ error: null })
      chain.upsert = async () => ({ error: null })
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
      return chain
    },
  },
}))

const WEEK = '2026-W40'
const BRIEF = '# The week the price list became the product\n\nEvery lab now sells a menu. The clues below prosecute one belief: that buyers still pick a model.'
const LIMIT = 'You have reached your specified API usage limits. You will regain access on 2099-10-01 at 00:00 UTC.'
const REWRITE = 'The week the price list became the product. Every lab now sells a menu, and the menu decides who pays for what. '.repeat(2)

function sse(frames: string[]): string {
  return frames.join('\n\n') + '\n\n'
}
const START = 'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":1}}}'
const delta = (text: string) => `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}`

const { default: handler } = await import('../../apps/control-plane/api/briefs/[week]/revise.js')

async function revise(upstream: () => Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    // A write that misses the database mock meets the dead address here,
    // never a network.
    if (String(url).startsWith('http://127.0.0.1:9/')) return new Response('[]', { status: 200 })
    return upstream()
  }))
  const out = { status: 0, headers: {} as Record<string, string>, streamed: false, chunks: [] as string[], body: undefined as any }
  const res: Record<string, any> = {
    statusCode: 200,
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v; return res },
    status(code: number) { out.status = code; res.statusCode = code; return res },
    json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
    writeHead(code: number) { out.status = code; out.streamed = true; return res },
    write(chunk: string) { out.chunks.push(chunk); return true },
    end() { return res },
  }
  await handler({ method: 'POST', headers: {}, query: { week: WEEK }, body: { mode: 'tighten' } } as never, res as never)
  const events = out.chunks.join('').split('\n\n').filter(f => f.startsWith('event:')).map(f => {
    const [head, data] = f.split('\n')
    return { event: head!.slice(6).trim(), data: JSON.parse(data!.slice(5).trim()) }
  })
  return { ...out, events }
}

beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'sk-test-not-a-key' })
afterEach(() => { vi.unstubAllGlobals() })

describe('POST /api/briefs/:week/revise', () => {
  it('a refusal known before the stream opens is a failure status with a typed JSON body', async () => {
    const r = await revise(() => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: LIMIT } }), { status: 400 }))
    expect(r.streamed).toBe(false)
    expect(r.status).toBe(503)
    expect(r.body).toMatchObject({
      ok: false, error: 'revise_failed', code: 'provider_usage_limit', provider_class: 'usage_limit',
      message: LIMIT, reset_at: '2099-10-01T00:00:00.000Z', retryable: false,
    })
    expect(r.body.detail).toMatch(/^The rewrite of the brief did not run\. Anthropic is over its usage limit/)
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('a rate limit is a 429 and a malformed request a 502', async () => {
    const limited = await revise(() => new Response(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'Number of request tokens has exceeded your per-minute rate limit' } }), { status: 429 }))
    expect(limited).toMatchObject({ status: 429, streamed: false, body: { code: 'provider_rate_limit', retryable: true } })
    expect(limited.headers['retry-after']).toBe('30')
    const bad = await revise(() => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'prompt is too long' } }), { status: 400 }))
    expect(bad).toMatchObject({ status: 502, streamed: false, body: { code: 'provider_request', retryable: false } })
  })

  it('a failure after the stream opened is a typed error event, the last one, with no done', async () => {
    const r = await revise(() => new Response(sse([START, delta('Half a'), 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}']), { status: 200 }))
    expect(r.streamed).toBe(true)
    const last = r.events[r.events.length - 1]!
    expect(last.event).toBe('error')
    expect(last.data).toMatchObject({ ok: false, error: 'revise_failed', code: 'provider_overload', provider_class: 'overload', retryable: true })
    expect(r.events.some(e => e.event === 'done')).toBe(false)
  })

  it('an answer too short to be a brief ends with a typed error and no done', async () => {
    const r = await revise(() => new Response(sse([START, delta('Too short.')]), { status: 200 }))
    const last = r.events[r.events.length - 1]!
    expect(last.event).toBe('error')
    expect(last.data).toMatchObject({ ok: false, error: 'revise_failed', code: 'empty_output', provider_class: null })
    expect(r.events.some(e => e.event === 'done')).toBe(false)
  })

  it('a success still streams its deltas and ends with done, ok true, and the preview', async () => {
    const r = await revise(() => new Response(sse([START, delta(REWRITE)]), { status: 200 }))
    expect(r.streamed).toBe(true)
    expect(r.events[0]).toMatchObject({ event: 'delta', data: { text: REWRITE } })
    const last = r.events[r.events.length - 1]!
    expect(last.event).toBe('done')
    expect(last.data).toMatchObject({ ok: true, preview: REWRITE.trim() })
  })
})
