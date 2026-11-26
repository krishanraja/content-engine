import { expect, it, vi } from 'vitest'

// The dated edition and archive routes of /api/hub/today, which the site's edition pages and sitemap read.
const store = vi.hoisted(() => ({ latest: vi.fn(), byDate: vi.fn(), editionDates: vi.fn() }))
vi.mock('../../apps/control-plane/lib/hub/store.js', () => store)

async function call(query: Record<string, unknown>, method = 'GET') {
  const { default: handler } = await import('../../apps/control-plane/api/hub/today.js')
  const result = { code: 0, body: null as any, headers: {} as Record<string, string> }
  const res = { setHeader: (k: string, v: string) => { result.headers[k] = v }, status: (n: number) => { result.code = n; return res },
    json: (data: unknown) => { result.body = data } }
  await handler({ method, query } as any, res as any)
  return result
}

it('serves a dated edition, the archive of dates and the latest edition, each with its own cache', async () => {
  const day = { ok: true, version: 1, edition_date: '2026-11-27', items: [] }
  store.byDate.mockImplementation(async (date: string) => date === '2026-11-27' ? day : null)
  store.editionDates.mockResolvedValue(['2026-11-28', '2026-11-27'])
  store.latest.mockResolvedValue({ snapshot: { ...day, edition_date: '2026-11-28' }, revision: 'r' })

  const dated = await call({ date: '2026-11-27' })
  expect(dated).toMatchObject({ code: 200, body: day, headers: { 'Cache-Control': expect.stringContaining('s-maxage=3600') } })
  expect(await call({ date: '2026-11-20' })).toMatchObject({ code: 404, body: { ok: false, error: 'no_edition' } })
  expect(await call({ date: '27-11-2026' })).toMatchObject({ code: 400 })
  expect(await call({ date: ['2026-11-27'] })).toMatchObject({ code: 200 })
  expect(await call({ archive: '1' })).toMatchObject({ code: 200, body: { ok: true, dates: ['2026-11-28', '2026-11-27'] },
    headers: { 'Access-Control-Allow-Origin': '*' } })
  expect((await call({})).body.edition_date).toBe('2026-11-28')
  expect((await call({}, 'POST')).code).toBe(405)

  store.byDate.mockRejectedValue(Error('snapshot_read_failed'))
  expect(await call({ date: '2026-11-27' })).toMatchObject({ code: 503, headers: { 'Cache-Control': 'no-store' } })
})
