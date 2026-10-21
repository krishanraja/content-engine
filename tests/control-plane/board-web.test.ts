import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { actor, canonical, digest, monday, validBody, validManifest } from '../../apps/control-plane/api/board/_contracts.js'
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
    // The Drafts editor's save keeps the store's fields and adds the hash of the words it was made on.
    expect(validBody('edits', 'mon-article', { text: 'new', day: 'mon', item: 'article', base_sha256: 'a'.repeat(64), at: '2026-10-26T07:00:00Z' })).toBe(true)
  })
  it('takes a comment pinned to a passage, and his taps on Also changed and What I learned, and nothing looser', () => {
    const c = { thread_id: 't1', anchor: 'rvp-mon-article-3', text: 'Too strong', at: '2026-10-26T07:00:00Z' }
    expect(validBody('comments', 't1', c)).toBe(true)
    expect(validBody('comments', 't1', { ...c, box: 'mon-article', paragraph: 3, quote: 'about 40% of firms' })).toBe(true)
    expect(validBody('comments', 't1', { ...c, paragraph: -1 })).toBe(false)
    expect(validBody('comments', 't1', { ...c, paragraph: 1.5 })).toBe(false)
    expect(validBody('comments', 't1', { ...c, box: '../mon' })).toBe(false)
    expect(validBody('comments', 't1', { ...c, quote: '' })).toBe(false)
    expect(validBody('comments', 't1', { ...c, quote: 'x'.repeat(2001) })).toBe(false)
    expect(validBody('comments', 't1', { ...c, anchor: 'mon-also-1', act: 'undo', ref: 's1' })).toBe(true)
    expect(validBody('comments', 't1', { ...c, anchor: 'mon-lesson-1', act: 'lesson_yes', ref: '11111111-2222-4333-8444-555555555555' })).toBe(true)
    expect(validBody('comments', 't1', { ...c, act: 'delete', ref: 's1' })).toBe(false)
    expect(validBody('comments', 't1', { ...c, act: 'undo' })).toBe(false)
    expect(validBody('comments', 't1', { ...c, ref: 's1' })).toBe(false)
  })
  it('makes canonical hashes order-independent and bounds immutable paths', () => {
    expect(digest(canonical({ b: 2, a: 1 }))).toBe(digest(canonical({ a: 1, b: 2 })))
    const hash = 'a'.repeat(64)
    const manifest = { version: 1, week: '2026-10-19', html: { name: 'board.html', sha256: hash, bytes: 6000000, type: 'text/html', key: `boards/2026-10-19/${hash}` }, assets: {} }
    expect(validManifest('2026-10-19', manifest)).toBe(true)
    expect(validManifest('2026-10-12', manifest)).toBe(false)
    expect(validManifest('2026-10-19', { ...manifest, html: { ...manifest.html, key: 'private/other' } })).toBe(false)
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
