import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { beforeEach, describe, test, vi } from 'vitest'

// Health says whether the model provider is usable (2026-09-28). The engine's
// Anthropic key was over its usage limit for 33 hours before anyone knew, and
// an agent session could not check: health answered 401 to the operator
// bearer. The route reads the failure the call helpers record
// (api/_modelProvider.ts) and adds it beside everything it said before.

// The route reads the real clock, so the fixtures are placed relative to it.
const NOW = new Date()

const db = vi.hoisted(() => ({
  tables: {} as Record<string, { data?: unknown; count?: number; error?: { message: string } | null }>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    from(table: string) {
      const result = db.tables[table] ?? { data: [], error: null }
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      for (const method of ['eq', 'in', 'not', 'order', 'limit']) chain[method] = () => chain
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, ...result }).then(resolve)
      return chain
    },
  },
}))

const beat = (secondsAgo: number) => ({
  updated_at: new Date(NOW.getTime() - secondsAgo * 1000).toISOString(),
  status: 'idle',
})

function world(input: { heartbeats?: unknown[] }) {
  db.tables = {
    video_studio_runner_heartbeats: { data: input.heartbeats ?? [] },
    content_engine_runs: { data: [] },
  }
}

function response() {
  const out = { status: 0, body: undefined as unknown }
  const res = {
    statusCode: 200,
    setHeader() { return res },
    status(code: number) { out.status = code; res.statusCode = code; return res },
    json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  return { res, out }
}

describe('GET /api/content-engine/health: the model provider', () => {
  // From 2026-09-27 10:00 UTC the engine's Anthropic key was over its usage
  // limit and nothing said so for 33 hours (walk log F30). Health now reads
  // the failure the call helpers record (api/_modelProvider.ts).
  const accessCode = 'synthetic-access-code-for-health'
  beforeEach(() => {
    process.env.ACCESS_CODE = accessCode
    process.env.SUPABASE_URL ||= 'https://health-test.invalid'
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-service-role-key-for-health-test'
  })

  async function health() {
    const { default: handler } = await import('../../apps/control-plane/api/content-engine/health.ts')
    const { res, out } = response()
    await handler({ method: 'GET', headers: { cookie: `cc_access=${createHash('sha256').update(accessCode).digest('hex')}` }, query: {} } as never, res as never)
    return out.body as Record<string, any>
  }

  const LIMIT = (day: string) => `You have reached your specified API usage limits. You will regain access on ${day} at 00:00 UTC.`

  test('a usage limit says plainly that the engine cannot write or check anything, with the reset time', async () => {
    const { classifyAnthropicFailure, FAILURE_KEY } = await import('../../apps/control-plane/api/_modelProvider.ts')
    // The route reads the real clock, so the reset is placed two days ahead of it.
    const day = new Date(NOW.getTime() + 2 * 86_400_000).toISOString().slice(0, 10)
    const failure = { ...classifyAnthropicFailure(Object.assign(new Error(`anthropic_400:${LIMIT(day)}`), { status: 400 }), new Date(NOW.getTime() - 3_600_000)), agent: 'judge-novelty' }
    world({ heartbeats: [beat(5)] })
    db.tables.system_config = { data: [{ key: FAILURE_KEY, value: JSON.stringify(failure) }] }
    const body = await health()
    const p = body.model_provider
    assert.equal(p.usable, false)
    assert.equal(p.state, 'unavailable')
    assert.equal(p.last_failure.class, 'usage_limit')
    assert.equal(p.last_failure.class_label, 'over its usage limit')
    assert.equal(p.last_failure.status, 400)
    assert.equal(p.last_failure.agent, 'judge-novelty')
    assert.equal(p.reset_at, `${day}T00:00:00.000Z`)
    assert.match(p.says, /cannot write or check anything/)
    assert.match(p.says, new RegExp(`${day} 00:00 UTC`))
    // Additive: everything the route said before is still there.
    assert.equal(body.ok, true)
    assert.equal(body.runner.state, 'present')
    assert.deepEqual(body.read_errors, [])
  })

  test('an overload a minute ago is degraded and still usable; a success after a failure is usable', async () => {
    const { classifyAnthropicFailure, FAILURE_KEY, OK_KEY } = await import('../../apps/control-plane/api/_modelProvider.ts')
    world({ heartbeats: [beat(5)] })
    const overload = classifyAnthropicFailure(new Error('anthropic_529:Overloaded'), new Date(NOW.getTime() - 60_000))
    db.tables.system_config = { data: [{ key: FAILURE_KEY, value: JSON.stringify(overload) }] }
    let p = (await health()).model_provider
    assert.equal(p.usable, true)
    assert.equal(p.state, 'degraded')
    assert.equal(p.last_failure.class, 'overload')

    const limit = classifyAnthropicFailure(new Error(`anthropic_400:${LIMIT('2099-01-01')}`), new Date(NOW.getTime() - 7_200_000))
    db.tables.system_config = { data: [
      { key: FAILURE_KEY, value: JSON.stringify(limit) },
      { key: OK_KEY, value: new Date(NOW.getTime() - 60_000).toISOString() },
    ] }
    p = (await health()).model_provider
    assert.equal(p.usable, true)
    assert.equal(p.state, 'ok')
    assert.match(p.says, /answering again/)
  })

  test('an agent session reads it on the operator bearer', async () => {
    const token = 'eot_' + 'h'.repeat(40)
    process.env.ENGINE_OPERATOR_TOKEN = token
    try {
      world({ heartbeats: [beat(5)] })
      const { default: handler } = await import('../../apps/control-plane/api/content-engine/health.ts')
      const { res, out } = response()
      await handler({ method: 'GET', headers: { authorization: `Bearer ${token}` }, query: {} } as never, res as never)
      assert.equal(out.status, 200)
      assert.equal((out.body as Record<string, any>).model_provider.usable, true)
    } finally {
      delete process.env.ENGINE_OPERATOR_TOKEN
    }
  })

  test('with nothing recorded, the provider is usable and the route says so', async () => {
    world({ heartbeats: [beat(5)] })
    const p = (await health()).model_provider
    assert.equal(p.usable, true)
    assert.equal(p.last_failure, null)
  })
})
