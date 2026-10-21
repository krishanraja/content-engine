import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { actor, canonical, combineWriterRefused, digest, monday, validBody, validManifest } from '../../apps/control-plane/api/board/_contracts.js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'

const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE','ENGINE_OPERATOR_TOKEN','APP_ORIGIN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })
const req = (method: string, headers: Record<string,string> = {}) => ({ method, headers, query: {} }) as VercelRequest
describe('board access and contracts', () => {
  it('fails closed without configured secrets, including reads', () => {
    delete process.env.ACCESS_CODE; delete process.env.ENGINE_OPERATOR_TOKEN
    expect(actor(req('GET'))).toBeNull()
    expect(actor(req('PUT', { authorization: 'Bearer undefined' }))).toBeNull()
  })
  it('allows cookie reads, checks write origin, and restricts publication to operator', () => {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    expect(actor(req('GET', { cookie }))).toBe('Krish')
    expect(actor(req('PUT', { cookie }))).toBeNull()
    expect(actor(req('PUT', { cookie, origin: 'https://attacker.example' }))).toBeNull()
    expect(actor(req('PUT', { cookie, origin: 'https://content.krishraja.com' }))).toBe('Krish')
    expect(actor(req('PUT', { cookie, origin: 'https://content.krishraja.com' }), true)).toBeNull()
    expect(actor(req('PUT', { authorization: 'Bearer synthetic-operator' }), true)).toBe('engine_operator')
  })
  it('rejects invalid dates, ids, bodies and active link schemes', () => {
    expect(monday('2026-10-19')).toBe(true)
    for (const date of ['2026-10-20', '2026-02-30', '../2026-10-19']) expect(monday(date)).toBe(false)
    expect(validBody('links', 'mon', { article: 'javascript:alert(1)', youtube: '' })).toBe(false)
    expect(validBody('ticks', '../mon', { done: true })).toBe(false)
    expect(validBody('queue', 'mon-1', { pick: 'mon-1', queued: false })).toBe(true)
    // A Combine tap: his choice of two to five queued ideas, saved as queue/combine-<n>.
    const m = ['11111111-2222-4333-8444-555555555555', '22222222-3333-4444-8555-666666666666']
    expect(validBody('queue', 'combine-1', { combine: true, members: m, pick: 'combine-1', at: '2026-10-25T10:00:00Z' })).toBe(true)
    expect(validBody('queue', 'combine-1', { combine: true, members: [m[0]], pick: 'combine-1' })).toBe(false)
    expect(validBody('queue', 'combine-1', { combine: true, members: [m[0], m[0]], pick: 'combine-1' })).toBe(false)
    expect(validBody('queue', 'combine-1', { combine: true, members: [m[0], 'not-a-uuid'], pick: 'combine-1' })).toBe(false)
    expect(validBody('queue', 'combine-1', { combine: true, members: m, pick: 'combine-2' })).toBe(false)
    expect(validBody('queue', 'mon-1', { combine: true, members: m, pick: 'mon-1' })).toBe(false)
    expect(validBody('edits', 'mon-article', { text: 'new', day: 'mon', item: 'article' })).toBe(true)
  })
  it('makes canonical hashes order-independent and bounds immutable paths', () => {
    expect(digest(canonical({ b: 2, a: 1 }))).toBe(digest(canonical({ a: 1, b: 2 })))
    const hash = 'a'.repeat(64)
    const manifest = { version: 1, week: '2026-10-19', html: { name: 'board.html', sha256: hash, bytes: 6000000, type: 'text/html', key: `boards/2026-10-19/${hash}` }, assets: {} }
    expect(validManifest('2026-10-19', manifest)).toBe(true)
    expect(validManifest('2026-10-12', manifest)).toBe(false)
    expect(validManifest('2026-10-19', { ...manifest, html: { ...manifest.html, key: 'private/other' } })).toBe(false)
  })
  it('takes a Combine tap only from Krish: a session holding the operator key is refused before the store', async () => {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    const members = ['11111111-2222-4333-8444-555555555555', '22222222-3333-4444-8555-666666666666']
    const body = { combine: true, members, pick: 'combine-1', at: '2026-10-25T10:00:00Z' }
    const saves: unknown[] = []
    const db = { rpc: async (_: string, args: unknown) => { saves.push(args); return { data: { ok: true, revision: 1, body }, error: null } } }
    const handler = createBoardHandler(async () => db as never)
    const put = async (headers: Record<string, string>) => {
      let status = 0; let out: any
      const res = { setHeader() {}, status(code: number) { status = code; return this }, json(value: unknown) { out = value } } as unknown as VercelResponse
      await handler({ method: 'PUT', headers, query: { week: '2026-10-26', collection: 'queue', id: 'combine-1' }, body: { body, revision: 0 } } as unknown as VercelRequest, res)
      return { status, out }
    }
    const session = await put({ authorization: 'Bearer synthetic-operator' })
    expect(session.status).toBe(403); expect(session.out.error).toBe('combine_is_his_tap'); expect(saves).toHaveLength(0)
    const his = await put({ cookie, origin: 'https://content.krishraja.com' })
    expect(his.status).not.toBe(403); expect(saves).toHaveLength(1)
    expect(combineWriterRefused('queue', { pick: 'mon-1', queued: true }, 'engine_operator')).toBe(false)
  })
  it('checks authentication before constructing any database client', async () => {
    delete process.env.ACCESS_CODE; delete process.env.ENGINE_OPERATOR_TOKEN
    const handler = createBoardHandler(async () => { throw new Error('database must not be reached') })
    let status = 0; let body: unknown
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(value: unknown) { body = value } } as unknown as VercelResponse
    await handler(req('GET'), res)
    expect(status).toBe(401); expect(body).toEqual({ ok: false, error: 'unauthorized' })
  })
})
