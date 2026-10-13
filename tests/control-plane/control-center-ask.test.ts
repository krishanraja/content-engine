import { describe, expect, it, vi } from 'vitest'

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: { from: () => { throw new Error('not read here') } } }))

import { accessCookie, askChecksToLook, controlCenterUrl } from '../../apps/control-plane/api/_controlCenter.js'

// After a step lands, the engine asks Control Center's done-check sweep to
// look at the piece's items (step 4). The ask is short and never fails the
// write that made it.

describe('asking the sweep to look', () => {
  const env = { ACCESS_CODE: 'a-test-code', CONTROL_CENTER_URL: 'https://cc.example.com/' }
  it('posts the item keys with the access cookie to Control Center, or its override', async () => {
    const sent: Array<[string, Record<string, unknown>]> = []
    const look = await askChecksToLook(['monday-record', 'monday-record', 'week-publish-board-2026-10-12'], {
      env, fetchImpl: async (url, init) => { sent.push([url, { cookie: init.headers.cookie, body: JSON.parse(init.body) }]); return { status: 200 } },
    })
    expect(look).toEqual({ keys: ['board-monday-record', 'board-week-publish-board-2026-10-12'], status: 200 })
    expect(sent).toEqual([['https://cc.example.com/api/done-checks', { cookie: accessCookie(env), body: { keys: ['board-monday-record', 'board-week-publish-board-2026-10-12'] } }]])
    expect(controlCenterUrl({})).toBe('https://controlcenter.krishraja.com')
  })
  it('never throws: no code, a refusal or a timeout leaves the cron to look', async () => {
    const never = vi.fn()
    expect(await askChecksToLook(['x-item'], { env: {}, fetchImpl: never })).toMatchObject({ keys: [], status: null })
    expect(never).not.toHaveBeenCalled()
    expect(await askChecksToLook(['x-item'], { env, fetchImpl: async () => ({ status: 429 }) })).toEqual({ keys: ['board-x-item'], status: 429 })
    const late = await askChecksToLook(['x-item'], { env, timeoutMs: 5, fetchImpl: (_u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) })
    expect(late).toMatchObject({ keys: ['board-x-item'], status: null })
    expect(late.note).toContain('the cron looks within 15 minutes')
    expect(await askChecksToLook([], { env, fetchImpl: never })).toEqual({ keys: [], status: null })
  })
  it('sends at most ten keys, as Control Center takes', async () => {
    let keys: string[] = []
    await askChecksToLook(Array.from({ length: 12 }, (_, i) => `item-${i}`), { env, fetchImpl: async (_u, init) => { keys = JSON.parse(init.body).keys; return { status: 200 } } })
    expect(keys).toHaveLength(10)
  })
})
