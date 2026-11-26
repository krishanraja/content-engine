import { afterEach, expect, it, vi } from 'vitest'
import { announceEdition, INDEXNOW_ENDPOINT } from '../../apps/control-plane/lib/hub/announce.js'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

it('asks the site to announce the edition with the shared secret, and reports what came back', async () => {
  vi.stubEnv('MAKEYOURMINDUP_INDEXNOW_SECRET','fixture-only')
  const call = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ accepted:true }),{ status:200 }))
  vi.stubGlobal('fetch',call)
  expect(await announceEdition()).toBe('accepted')
  expect(call).toHaveBeenCalledTimes(1)
  const [url,init] = call.mock.calls[0]
  expect(url).toBe(INDEXNOW_ENDPOINT)
  expect(init.method).toBe('POST')
  expect(init.headers).toEqual({ authorization:'Bearer fixture-only' })

  call.mockResolvedValueOnce(new Response(null,{ status:401 }))
  expect(await announceEdition()).toBe('failed')
  call.mockResolvedValueOnce(new Response(JSON.stringify({ error:'Edition unavailable' }),{ status:503 }))
  expect(await announceEdition()).toBe('failed')
  call.mockRejectedValueOnce(Error('network down'))
  expect(await announceEdition()).toBe('failed')
})

it('skips without calling anyone while the secret is unset', async () => {
  vi.stubEnv('MAKEYOURMINDUP_INDEXNOW_SECRET','')
  const call = vi.fn()
  vi.stubGlobal('fetch',call)
  expect(await announceEdition()).toBe('skipped')
  expect(call).not.toHaveBeenCalled()
})
