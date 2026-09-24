import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, test } from 'vitest'

// The gate on /api/content-ideas.
//
// Until 2026-09-24 thirteen of these routes checked nothing but the HTTP
// method, so anyone with the engine's URL could spend on the Anthropic key or
// overwrite a draft. The cases below are the properties that closed it, and the
// last block reads every handler so a route added later cannot ship open.

const ENV_KEYS = ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN', 'CRON_SECRET'] as const

// Never production. The handler block below calls every route for real, and a
// route whose gate is missing (which is exactly what a mutation run produces)
// would otherwise reach the live database with whatever service key the shell
// holds. A dead local address makes that a connection error instead of a write.
process.env.SUPABASE_URL = 'http://127.0.0.1:9'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
delete process.env.ANTHROPIC_API_KEY

async function withEnv<T>(env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, fn: () => Promise<T>): Promise<T> {
  const previous = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]))
  for (const k of ENV_KEYS) {
    const v = env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    return await fn()
  } finally {
    for (const k of ENV_KEYS) {
      const v = previous[k]
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

function fakeRes() {
  const out = { status: 0, headers: {} as Record<string, string> }
  const res = {
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v },
    status(code: number) { out.status = code; return res },
    json() { return res },
    end() { return res },
    write() { return true },
    flushHeaders() {},
  }
  return { res, out }
}

async function gate(env: Parameters<typeof withEnv>[0], req: Record<string, unknown>, methods?: string[]) {
  return withEnv(env, async () => {
    const { guardEngine } = await import('../../apps/control-plane/api/_auth.js')
    const { res, out } = fakeRes()
    const stopped = guardEngine({ method: 'POST', headers: {}, ...req } as never, res as never, methods)
    return { stopped, ...out }
  })
}

const CODE = 'dashboard-code-for-tests'
const COOKIE = `cc_access=${createHash('sha256').update(CODE).digest('hex')}`
const TOKEN = 'eot_' + 'b'.repeat(40)

describe('guardEngine', () => {
  test('with nothing configured it refuses, never opens', async () => {
    const r = await gate({}, { headers: {} })
    assert.equal(r.stopped, true, 'a route that spends must not fail open when env vars are missing')
    assert.equal(r.status, 401)
  })

  test('the dashboard cookie is accepted, a wrong one is not', async () => {
    const good = await gate({ ACCESS_CODE: CODE }, { headers: { cookie: COOKIE } })
    assert.equal(good.stopped, false)
    const bad = await gate({ ACCESS_CODE: CODE }, { headers: { cookie: 'cc_access=' + 'f'.repeat(64) } })
    assert.equal(bad.stopped, true)
    assert.equal(bad.status, 401)
  })

  test('the operator token is accepted, a wrong one is not, an empty one never matches', async () => {
    const good = await gate({ ENGINE_OPERATOR_TOKEN: TOKEN }, { headers: { authorization: `Bearer ${TOKEN}` } })
    assert.equal(good.stopped, false, 'the bearer arm is how a session without a browser drives the engine')
    const bad = await gate({ ENGINE_OPERATOR_TOKEN: TOKEN }, { headers: { authorization: 'Bearer eot_wrong' } })
    assert.equal(bad.stopped, true)
    const empty = await gate({ ENGINE_OPERATOR_TOKEN: '' }, { headers: { authorization: 'Bearer ' } })
    assert.equal(empty.stopped, true)
  })

  test('the cron secret does not open an idea route', async () => {
    // Separate secrets on purpose: an operator can be given the engine without
    // being handed every scheduled job, and the reverse.
    const secret = 'cs_' + 'c'.repeat(32)
    const r = await gate({ CRON_SECRET: secret }, { headers: { authorization: `Bearer ${secret}` } })
    assert.equal(r.stopped, true)
    assert.equal(r.status, 401)
  })

  test('methods are the route\'s own, and a wrong one is refused first', async () => {
    const del = await gate({ ENGINE_OPERATOR_TOKEN: TOKEN }, { method: 'DELETE', headers: { authorization: `Bearer ${TOKEN}` } })
    assert.equal(del.status, 405)
    const allowed = await gate({ ENGINE_OPERATOR_TOKEN: TOKEN }, { method: 'DELETE', headers: { authorization: `Bearer ${TOKEN}` } }, ['GET', 'POST', 'DELETE'])
    assert.equal(allowed.stopped, false)
  })

  test('the origin is pinned, never a wildcard', async () => {
    const r = await gate({}, { headers: {} })
    assert.notEqual(r.headers['access-control-allow-origin'], '*')
  })
})

// ── every handler, called for real ────────────────────────────────────────

const API = join(__dirname, '../../apps/control-plane/api')

function handlers(): string[] {
  // content-edits.ts is the ledger the walk's decisions are recorded through,
  // so it carries the same gate as the routes it records.
  const out: string[] = [join(API, 'content-ideas.ts'), join(API, 'content-edits.ts')]
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.ts') && !name.startsWith('_')) out.push(p)
    }
  }
  walk(join(API, 'content-ideas'))
  return out
}

describe('every idea route', () => {
  const files = handlers()

  test('the scan found the routes it is meant to guard', () => {
    // A probe that finds nothing has to be proved able to find something.
    assert.ok(files.length >= 21, `expected at least 21 handlers, found ${files.length}`)
    assert.ok(files.some(f => f.endsWith('content-edits.ts')))
    assert.ok(files.some(f => f.endsWith(join('[id]', 'revise.ts'))))
  })

  test('no handler uses the unauthenticated preamble or a wildcard origin', () => {
    const open = files.filter(f => {
      const src = readFileSync(f, 'utf8')
      return /\bpreamble\(req/.test(src) || /Access-Control-Allow-Origin', '\*'/.test(src)
    })
    assert.deepEqual(open.map(f => relative(API, f)), [])
  })

  test('each one refuses a request that carries no credentials', async () => {
    // Called, not read: a gate that is imported and never reached is the same
    // as no gate. Every handler must stop before touching the database.
    const unguarded: string[] = []
    await withEnv({ ACCESS_CODE: CODE, ENGINE_OPERATOR_TOKEN: TOKEN, CRON_SECRET: 'cs_' + 'd'.repeat(32) }, async () => {
      for (const file of files) {
        const mod = await import(file)
        const handler = mod.default as (req: unknown, res: unknown) => unknown
        const { res, out } = fakeRes()
        await handler({ method: 'POST', headers: {}, query: { id: '00000000-0000-4000-8000-000000000000' }, body: {} }, res)
        if (out.status !== 401) unguarded.push(`${relative(API, file)} -> ${out.status || 'no status'}`)
      }
    })
    assert.deepEqual(unguarded, [])
  })
})
