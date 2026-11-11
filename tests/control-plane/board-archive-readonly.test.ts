import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { fromArchivePage, readOnlyArchive } from '../../apps/control-plane/api/board/_readOnly.js'
import { DESK_PAGE } from '../../apps/control-plane/api/board/_deskPage.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// One live board (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old board is a read-only archive).
// The engine's own pages make no press: the desk's buttons are links to the live board, the baked board carries the
// banner and a guard, and the board refuses a write either page sends. The live board's writes still pass, and a
// writer outside the board's tables can bump the week's change signal.

const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })

function fakeDb() {
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = []
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => { rpcs.push({ fn, args }); return fn === 'board_signal_bump' ? { data: 7, error: null } : { data: { ok: true, revision: 1, body: args.p_body }, error: null } },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }),
  }
  return { db, rpcs }
}

async function call(fake: ReturnType<typeof fakeDb>, req: Partial<VercelRequest> & { headers: Record<string, string> }) {
  process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
  process.env.ACCESS_CODE = 'synthetic-board-test'
  const handler = createBoardHandler(async () => fake.db as never)
  let status = 0; let out: any
  const headers: Record<string, string> = {}
  const res = { setHeader(k: string, v: string) { headers[k.toLowerCase()] = v }, status(code: number) { status = code; return this }, json(v: unknown) { out = v }, send(v: unknown) { out = v }, end() {} } as unknown as VercelResponse
  await handler({ method: 'GET', query: {}, ...req } as unknown as VercelRequest, res)
  return { status, out, headers }
}
const cookie = () => `cc_access=${createHash('sha256').update('synthetic-board-test').digest('hex')}`
const comment = { body: { thread_id: 'desk-mon-day-x', anchor: 'desk:mon:day', text: 'His words', at: '2026-11-11T12:00:00Z' }, revision: 0 }

describe('the old board is a read-only archive', () => {
  it('knows a write from one of its own pages by the page its referrer names', () => {
    expect(fromArchivePage('https://content.krishraja.com/board/2026-11-09')).toBe(true)
    expect(fromArchivePage('https://content.krishraja.com/board/2026-11-09?archive=1')).toBe(true)
    expect(fromArchivePage('https://controlcenter.krishraja.com/?ui=next')).toBe(false)
    expect(fromArchivePage('https://content.krishraja.com/')).toBe(false)
    expect(fromArchivePage(undefined)).toBe(false)
    expect(fromArchivePage('not a url')).toBe(false)
  })

  it('refuses his press from the archive page, and takes the same press from the live board', async () => {
    const q = { week: '2026-11-09', collection: 'comments', id: 'desk-mon-day-x' }
    const fromArchive = await call(fakeDb(), { method: 'PUT', query: q, body: comment, headers: { cookie: cookie(), origin: 'https://content.krishraja.com', referer: 'https://content.krishraja.com/board/2026-11-09' } })
    expect(fromArchive.status).toBe(423)
    expect(fromArchive.out).toMatchObject({ ok: false, error: 'archive_read_only', live: 'https://controlcenter.krishraja.com/?ui=next#/content?week=2026-11-09' })
    const live = fakeDb()
    const fromLive = await call(live, { method: 'PUT', query: q, body: comment, headers: { cookie: cookie(), origin: 'https://controlcenter.krishraja.com', referer: 'https://controlcenter.krishraja.com/?ui=next' } })
    expect(fromLive.status).toBe(200)
    expect(live.rpcs.map(r => r.fn)).toEqual(['board_save'])
    // A session's write (the operator's key) is never the archive's.
    const op = fakeDb()
    expect((await call(op, { method: 'PUT', query: q, body: comment, headers: { authorization: 'Bearer synthetic-operator', referer: 'https://content.krishraja.com/board/2026-11-09' } })).status).toBe(200)
  })

  it('serves the desk with a same-origin referrer, so its writes name it', async () => {
    const r = await call(fakeDb(), { method: 'GET', query: { week: '2026-11-09', op: 'html' }, headers: {} })
    expect(r.status).toBe(200)
    expect(r.headers['referrer-policy']).toBe('same-origin')
    expect(r.out).toBe(DESK_PAGE)
  })

  it('makes no press on the desk: every press is a link to the live board at its day, and its client writes nothing', () => {
    const src = ['App.tsx', 'api.ts', 'components/path.tsx', 'components/review.tsx', 'components/sheets.tsx']
      .map(f => readFileSync(`apps/control-plane/board-next/src/${f}`, 'utf8')).join('\n')
    expect(src).not.toMatch(/method: 'PUT'|method: 'POST'/)
    expect(src).toMatch(/archive_read_only/)
    expect(DESK_PAGE).toContain('Do this on the live board')
    expect(DESK_PAGE).not.toContain('Research it now</')
  })

  it('puts the banner and the guard just inside the baked board\'s body, and changes nothing else', () => {
    const html = '<!doctype html><html><head><title>x</title></head><body class="b"><main>Board</main></body></html>'
    const out = readOnlyArchive(html, '2026-11-09')
    expect(out.startsWith('<!doctype html><html><head><title>x</title></head><body class="b"><div role="note" data-archive-banner')).toBe(true)
    expect(out).toContain('This is the archive. The live Publish Board is in Control Centre. This page is read-only.')
    expect(out).toContain('href="https://controlcenter.krishraja.com/?ui=next#/content?week=2026-11-09"')
    expect(out).toContain('archive_read_only')
    expect(out.endsWith('<main>Board</main></body></html>')).toBe(true)
  })

  it('puts them after a built board\'s head when its body tag is implicit, never inside its script\'s "<body>" string', () => {
    // A built board is a fragment, and week.js holds "<body>" in a string (it saves a picture's page).
    const head = '<meta name="mymu-engine" content="x">\n<title>Board</title>\n<link rel="stylesheet" href="f.css">\n<style>a{b:c}</style>\n'
    const rest = '<div class="wk-top">Board</div>\n<script>\nconst page = "<html><head></head><body>\\n" + body;\n</script>\n'
    const out = readOnlyArchive(head + rest, '2026-11-09')
    expect(out.startsWith(head + '<div role="note" data-archive-banner')).toBe(true)
    expect(out.indexOf('<script data-archive-guard>')).toBeLessThan(out.indexOf('<div class="wk-top">'))
    expect(out.endsWith(rest)).toBe(true)
  })

  it('bumps the week\'s change signal for a writer outside the board\'s tables, on the operator\'s key only', async () => {
    const fake = fakeDb()
    expect((await call(fake, { method: 'POST', query: { week: '2026-11-09', op: 'touch' }, body: { source: 'plan' }, headers: { cookie: cookie(), origin: 'https://controlcenter.krishraja.com' } })).status).toBe(401)
    const r = await call(fake, { method: 'POST', query: { week: '2026-11-09', op: 'touch' }, body: { source: 'plan' }, headers: { authorization: 'Bearer synthetic-operator' } })
    expect(r).toMatchObject({ status: 200, out: { ok: true, week: '2026-11-09', revision: 7 } })
    expect(fake.rpcs).toEqual([{ fn: 'board_signal_bump', args: { p_week: '2026-11-09', p_source: 'plan' } }])
    expect((await call(fake, { method: 'POST', query: { week: '2026-11-10', op: 'touch' }, body: {}, headers: { authorization: 'Bearer synthetic-operator' } })).status).toBe(400)
    const routes = JSON.parse(readFileSync('apps/control-plane/vercel.json', 'utf8')).rewrites as Array<{ source: string; destination: string }>
    expect(routes.find(r => r.source === '/api/board/:week/touch')?.destination).toBe('/api/board?week=:week&op=touch')
  })
})
