import { describe, expect, it, vi } from 'vitest'
import { WATCH_ACTORS, checkPaidRun, parsePaidRun, postToken } from '../../apps/control-plane/api/watch/_paid.js'
import type { WatchRequestRow, WatchStore } from '../../apps/control-plane/api/watch/_watch.js'

// The cloud backup's paid step, made by the engine with its own Apify key: only a cloud machine holding the claim,
// only content-watcher's actors, only an input that names that post. Krish, 2026-10-28: "Do not stop until this is
// functional." Synthetic rows only.

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))

const ID = '00000000-0000-4000-8000-000000000001'
const row = (over: Partial<WatchRequestRow> = {}): WatchRequestRow => ({
  id: ID, url: 'https://www.instagram.com/p/DfAY9PWFuEX/?igsh=abc', url_key: 'https://www.instagram.com/p/DfAY9PWFuEX/',
  platform: 'instagram', lane: 'strategy', note: null, status: 'claimed', attempts: 1, claimed_by: 'cloud-gh',
  claimed_at: '2026-10-28T06:00:00Z', requested_at: '2026-10-27T19:50:33Z', ...over,
})
const store = (r: WatchRequestRow | null): WatchStore => ({
  async claimable() { return [] },
  async updateIf() { throw new Error('a paid run never changes a request') },
  async get() { return r },
  async readRevs() { return new Map() },
  async upsertReads() { throw new Error('a paid run never writes a reading') },
})
const body = (over: Record<string, unknown> = {}) => {
  const p = parsePaidRun({ id: ID, machine: 'cloud-gh', actor: 'snapinsta~instagram-downloader-api',
    input: { url: 'https://www.instagram.com/p/DfAY9PWFuEX/' }, ...over })
  if ('error' in p) throw new Error(p.error)
  return p.value
}

describe('the engine runs Apify for the cloud backup', () => {
  it('runs an allowed actor for the cloud machine holding the claim, on an input naming that post', async () => {
    expect(await checkPaidRun(store(row()), body())).toEqual({ ok: true })
    // content-watcher's own normalised address still names the post.
    expect(await checkPaidRun(store(row()), body({ actor: 'apify~instagram-scraper',
      input: { directUrls: ['https://instagram.com/p/DfAY9PWFuEX'], resultsType: 'posts' } }))).toEqual({ ok: true })
  })

  it('refuses a home computer, a machine without the claim, a finished request and another post', async () => {
    expect(await checkPaidRun(store(row({ claimed_by: 'SURFACE' })), body({ machine: 'SURFACE' })))
      .toMatchObject({ ok: false, error: 'cloud_machines_only' })
    expect(await checkPaidRun(store(row({ claimed_by: 'cloud-other' })), body())).toMatchObject({ ok: false, error: 'not_claimed_by_machine' })
    expect(await checkPaidRun(store(row({ status: 'read' })), body())).toMatchObject({ ok: false, error: 'not_claimed_by_machine' })
    expect(await checkPaidRun(store(null), body())).toMatchObject({ ok: false, status: 404 })
    expect(await checkPaidRun(store(row()), body({ input: { url: 'https://www.instagram.com/p/SomethingElse/' } })))
      .toMatchObject({ ok: false, error: 'input_not_this_post' })
  })

  it('takes only content-watcher\'s actors, each with a hard charge cap, and a small input', () => {
    expect(parsePaidRun({ id: ID, machine: 'cloud-gh', actor: 'someone~expensive-crawler', input: { url: 'x' } }))
      .toEqual({ ok: false, error: 'actor_not_allowed' })
    expect(parsePaidRun({ id: ID, machine: 'cloud-gh', actor: 'apify~instagram-scraper', input: { big: 'x'.repeat(3000) } }))
      .toEqual({ ok: false, error: 'invalid_input' })
    expect(parsePaidRun({ id: ID, machine: 'cloud-gh', actor: 'toString', input: {} })).toEqual({ ok: false, error: 'actor_not_allowed' })
    for (const limits of Object.values(WATCH_ACTORS)) expect(limits.maxUsd).toBeLessThanOrEqual(0.15)
  })

  it('reads the post id from a link', () => {
    expect(postToken('https://youtube.com/shorts/7olCmqWw9Wk')).toBe('7olCmqWw9Wk')
    expect(postToken('https://www.instagram.com/p/DfAY9PWFuEX/')).toBe('DfAY9PWFuEX')
    expect(postToken('not a link')).toBeNull()
  })

  it('sits behind the engine key', async () => {
    const { default: route } = await import('../../apps/control-plane/api/watch/apify.js')
    let status = 0
    const res: any = { setHeader() { return res }, status(c: number) { status = c; return res }, json() { return res }, end() { return res } }
    await route({ method: 'POST', headers: {}, body: {} } as any, res)
    expect(status).toBe(401)
  })
})
