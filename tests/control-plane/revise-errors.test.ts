import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A failed rewrite can never read as a successful one (walk log F31).
//
// On 2026-09-28 piece 1's revise call came back HTTP 200 carrying one untyped
// SSE event, `revise_failed: anthropic_400 ... usage limits`, because the
// stream opened before the model call. A session that read the status saw
// success. Now a failure known before the stream opens is a JSON body with a
// failure status; after it opens, it is a typed `error` event, the stream's
// last, with no `done`. Neither writes meta.revisions or a ledger row.

const db = vi.hoisted(() => ({
  updates: [] as Array<{ table: string; values: unknown }>,
  inserts: [] as Array<{ table: string; values: unknown }>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    rpc: async () => ({ error: null }),
    from(table: string) {
      const chain: Record<string, any> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) chain[m] = () => chain
      const row = table === 'content_ideas' ? { idea: 'An idea', thesis: 'A thesis', meta: {}, lane: null, lane_slot: null } : null
      chain.single = async () => ({ data: row, error: null })
      chain.maybeSingle = chain.single
      chain.update = (values: unknown) => { db.updates.push({ table, values }); return chain }
      chain.insert = async (values: unknown) => { db.inserts.push({ table, values }); return { error: null } }
      chain.upsert = async () => ({ error: null })
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
      return chain
    },
  },
}))

const TOKEN = 'eot_' + 'r'.repeat(40)
const LIMIT = 'You have reached your specified API usage limits. You will regain access on 2099-10-01 at 00:00 UTC.'
const ID = '00000000-0000-4000-8000-000000000001'

const { modelFailure, emptyOutput } = await import('../../apps/control-plane/api/_stream.js')

function sse(frames: string[]): string {
  return frames.join('\n\n') + '\n\n'
}
const START = 'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":1}}}'
const delta = (text: string) => `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}`

async function revise(upstream: () => Response) {
  vi.stubGlobal('fetch', vi.fn(async () => upstream()))
  const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/revise.js')
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
  await handler({
    method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: { id: ID },
    body: { mode: 'feedback', instruction: 'Tighten it.', source_text: 'The draft as it stands.' },
  } as never, res as never)
  const events = out.chunks.join('').split('\n\n').filter(f => f.startsWith('event:')).map(f => {
    const [head, data] = f.split('\n')
    return { event: head!.slice(6).trim(), data: JSON.parse(data!.slice(5).trim()) }
  })
  return { ...out, events }
}

beforeEach(() => {
  db.updates.length = 0
  db.inserts.length = 0
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  process.env.ANTHROPIC_API_KEY = 'sk-test-not-a-key'
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})
afterEach(() => { vi.unstubAllGlobals() })

describe('the error shape', () => {
  it('a usage limit is a 503 with its class, the provider\'s words and the reset, and says try later', () => {
    const f = modelFailure('revise_failed', 'The rewrite', Object.assign(new Error(`anthropic_400:${LIMIT}`), { status: 400 }))
    expect(f.status).toBe(503)
    expect(f.body).toMatchObject({ ok: false, error: 'revise_failed', code: 'provider_usage_limit', provider_class: 'usage_limit', message: LIMIT, reset_at: '2099-10-01T00:00:00.000Z', retryable: false })
    expect(f.body.detail).toMatch(/^The rewrite did not run\. Anthropic is over its usage limit/)
    expect(f.retryAfterSeconds).toBeGreaterThan(0)
  })
  it('an overload is retryable, a rate limit is a 429, a malformed request is a 502', () => {
    expect(modelFailure('x', 'It', new Error('anthropic_529:Overloaded'))).toMatchObject({ status: 503, body: { code: 'provider_overload', retryable: true } })
    expect(modelFailure('x', 'It', new Error('anthropic_429:rate limit'))).toMatchObject({ status: 429, body: { code: 'provider_rate_limit' } })
    expect(modelFailure('x', 'It', new Error('anthropic_400:prompt is too long'))).toMatchObject({ status: 502, body: { code: 'provider_request', retryable: false } })
  })
  it('an empty answer is its own failure', () => {
    expect(emptyOutput('revise_failed', 'The rewrite')).toMatchObject({ ok: false, code: 'empty_output', provider_class: null })
  })
})

describe('POST /api/content-ideas/:id/revise', () => {
  it('a refusal known before the stream opens is a failure status with a JSON body, and nothing is recorded', async () => {
    const r = await revise(() => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: LIMIT } }), { status: 400 }))
    expect(r.streamed).toBe(false)
    expect(r.status).toBe(503)
    expect(r.body).toMatchObject({ ok: false, error: 'revise_failed', code: 'provider_usage_limit', reset_at: '2099-10-01T00:00:00.000Z' })
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0)
    expect(db.updates.filter(u => u.table === 'content_ideas')).toHaveLength(0)
    expect(db.inserts.filter(i => i.table === 'content_edit_events')).toHaveLength(0)
  })

  it('a failure after the stream opened is a typed error event, the last one, with no done', async () => {
    const r = await revise(() => new Response(sse([START, delta('Half a'), 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}']), { status: 200 }))
    expect(r.streamed).toBe(true)
    const last = r.events[r.events.length - 1]!
    expect(last.event).toBe('error')
    expect(last.data).toMatchObject({ ok: false, error: 'revise_failed', code: 'provider_overload', provider_class: 'overload', retryable: true })
    expect(r.events.some(e => e.event === 'done')).toBe(false)
    expect(db.updates.filter(u => u.table === 'content_ideas')).toHaveLength(0)
    expect(db.inserts.filter(i => i.table === 'content_edit_events')).toHaveLength(0)
  })

  it('an answer with no text is a typed error, never a done carrying nothing', async () => {
    const r = await revise(() => new Response(sse([START]), { status: 200 }))
    const last = r.events[r.events.length - 1]!
    expect(last.event).toBe('error')
    expect(last.data.code).toBe('empty_output')
    expect(r.events.some(e => e.event === 'done')).toBe(false)
  })

  it('a success still ends with done, ok true, and records its history', async () => {
    const r = await revise(() => new Response(sse([START, delta('The tighter draft.')]), { status: 200 }))
    const last = r.events[r.events.length - 1]!
    expect(last.event).toBe('done')
    expect(last.data).toMatchObject({ ok: true, revised: 'The tighter draft.' })
    expect(db.updates.filter(u => u.table === 'content_ideas')).toHaveLength(1)
  })
})
