import { describe, expect, it, vi } from 'vitest'

// Security lane APP-8 (14 Nov 2026): GET /api/investigations/:run_id/trace returned a run's claims, evidence and gate
// log to anyone, with CORS *. It is behind the engine's sensitive-read gate now. No database is reached here.
vi.hoisted(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
  process.env.ACCESS_CODE = 'test-access-code'
})
const reads: string[] = []
vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: { from: (t: string) => { reads.push(t); throw new Error('no database in this test') } },
}))
const handler = (await import('../../apps/control-plane/api/investigations/[run_id]/trace.js')).default

function call(headers: Record<string, string> = {}) {
  const out: { status: number; headers: Record<string, string> } = { status: 0, headers: {} }
  const res: any = {
    setHeader: (k: string, v: string) => { out.headers[k.toLowerCase()] = v; return res },
    status: (n: number) => { out.status = n; return { json: () => res, end: () => res } },
  }
  return handler({ method: 'GET', headers, query: { run_id: 'run-1' } } as never, res).then(() => out)
}

describe('investigation trace', () => {
  it('a request with no credential gets 401 and reads nothing', async () => {
    const r = await call()
    expect(r.status).toBe(401)
    expect(reads).toEqual([])
    expect(r.headers['access-control-allow-origin']).not.toBe('*')
  })
  it('a wrong cookie gets 401', async () => {
    expect((await call({ cookie: 'cc_access=nope' })).status).toBe(401)
  })
})
