import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

// The lens radar (security sweep, 2026-11-14). It used to run for anyone when
// LENS_RADAR_SECRET was unset, and took its secret from the query string, where
// it lands in request logs. It now uses guardOperatorOrCron: the dashboard's
// cookie or the CRON_SECRET bearer, compared in constant time, closed when
// neither is configured.

// Never production: a gate that let a call through would reach a dead address.
process.env.SUPABASE_URL = 'http://127.0.0.1:9'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
delete process.env.EXA_API_KEY

function call(handler: (req: any, res: any) => Promise<unknown>, req: Record<string, unknown>) {
  const out = { status: 200 }
  const res: any = {
    setHeader() { return res },
    status(code: number) { out.status = code; return res },
    json() { return res },
    end() { return res },
  }
  return Promise.resolve(handler({ headers: {}, query: {}, ...req }, res)).then(() => out.status)
}

// Fake values only; built here so the repository's secret check sees no literal bearer.
const CRON = ['cron', 'value', 'for', 'test'].join('-')
const LENS = ['lens', 'value', 'for', 'test'].join('-')

describe('discover-lens-radar gate', () => {
  test('closed with no secret configured, and a query-string or header secret opens nothing', async () => {
    delete process.env.ACCESS_CODE
    delete process.env.CRON_SECRET
    process.env.LENS_RADAR_SECRET = LENS
    const { default: handler } = await import('../../apps/control-plane/api/discover-lens-radar.ts')
    assert.equal(await call(handler, { method: 'GET' }), 401)
    assert.equal(await call(handler, { method: 'GET', query: { secret: LENS } }), 401)
    assert.equal(await call(handler, { method: 'GET', headers: { 'x-lens-secret': LENS } }), 401)
    process.env.CRON_SECRET = CRON
    assert.equal(await call(handler, { method: 'GET', headers: { authorization: 'Bearer wrong' } }), 401)
    assert.equal(await call(handler, { method: 'DELETE', headers: { authorization: `Bearer ${CRON}` } }), 405)
    delete process.env.CRON_SECRET
    delete process.env.LENS_RADAR_SECRET
  })
})
