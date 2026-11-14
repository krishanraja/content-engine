import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, sign } from 'node:crypto'
import { GITHUB_OIDC_ISSUER, RESEARCH_EXPORT_AUDIENCE, VAULT_RULE, verifyGithubIdentity, type Jwks } from '../../apps/control-plane/api/_githubIdentity'
import { createExportHandler, cursorOf, parseCursor, ventureOfScope } from '../../apps/control-plane/api/research-library/export'

// The vault's research deposit (I-31; Ruling, Krish, 2026-11-14): only claude-archive's own workflow, on main, while the
// repository is private, proved by its GitHub identity token. A token from any other repository gets 401.

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const other = generateKeyPairSync('rsa', { modulusLength: 2048 })
const KID = 'test-kid'
const JWKS: Jwks = { keys: [{ ...(publicKey.export({ format: 'jwk' }) as object), kid: KID, alg: 'RS256', use: 'sig' } as Jwks['keys'][number]] }
const keys = async () => JWKS
const NOW = Date.parse('2026-11-14T18:00:00Z')
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
function token(over: Record<string, unknown> = {}, opts: { kid?: string; alg?: string; key?: typeof privateKey } = {}) {
  const claims = {
    iss: GITHUB_OIDC_ISSUER, aud: RESEARCH_EXPORT_AUDIENCE, repository: 'krishanraja/claude-archive', repository_owner: 'krishanraja',
    ref: 'refs/heads/main', repository_visibility: 'private', event_name: 'schedule',
    iat: NOW / 1000 - 10, nbf: NOW / 1000 - 10, exp: NOW / 1000 + 300, ...over,
  }
  const h = b64({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? KID, typ: 'JWT' }), p = b64(claims)
  const s = sign('RSA-SHA256', Buffer.from(`${h}.${p}`), opts.key ?? privateKey).toString('base64url')
  return `Bearer ${h}.${p}.${s}`
}

describe('the vault identity guard', () => {
  it('admits claude-archive main on a private repository', async () => {
    expect(await verifyGithubIdentity(token(), VAULT_RULE, keys, NOW)).toMatchObject({ ok: true })
  })

  it('refuses every other token with 401, and says why', async () => {
    const cases: Array<[string, string | undefined]> = [
      ['wrong_repository', token({ repository: 'krishanraja/content-engine' })],
      ['wrong_repository', token({ repository: 'someone/claude-archive' })],
      ['wrong_branch', token({ ref: 'refs/heads/feature' })],
      ['repository_not_private', token({ repository_visibility: 'public' })],
      ['wrong_audience', token({ aud: 'sts.amazonaws.com' })],
      ['wrong_issuer', token({ iss: 'https://example.org' })],
      ['expired', token({ exp: NOW / 1000 - 1 })],
      ['pull_request', token({ event_name: 'pull_request' })],
      ['bad_signature', token({}, { key: other.privateKey })],
      ['unknown_signing_key', token({}, { kid: 'nope' })],
      ['unexpected_algorithm', token({}, { alg: 'HS256' })],
      ['no_identity_token', undefined],
      ['no_identity_token', 'Bearer eot_not_a_jwt'],
    ]
    for (const [why, auth] of cases) {
      expect(await verifyGithubIdentity(auth, VAULT_RULE, keys, NOW)).toEqual({ ok: false, status: 401, why })
    }
  })

  it('fails closed with 503 when GitHub keys cannot be read', async () => {
    expect(await verifyGithubIdentity(token(), VAULT_RULE, async () => { throw new Error('down') }, NOW)).toEqual({ ok: false, status: 503, why: 'identity_keys_unreadable' })
  })
})

type Row = Record<string, any>
const row = (n: number, over: Row = {}): Row => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, scope: 'day:2026-11-16/mon', piece_id: null, week: '2026-11-16', day: 'mon',
  material_key: `k${n}`, version: 1, kind: 'research', role: null, title: `R${n}`, note: null, sha256: `${n}`.padStart(64, 'a'), bytes: 5,
  text_sha256: `${n}`.padStart(64, 'a'), source: 'session', added_by: 'Claude Code', added_at: `2026-11-1${n}T10:00:00.000Z`, ...over,
})
function fakeDb(rows: Row[], seen: string[] = []) {
  const chain = (table: string) => {
    const q: any = { filters: [] as string[] }
    for (const m of ['select', 'eq', 'is', 'order', 'in']) q[m] = (...a: unknown[]) => { q.filters.push(`${m}:${JSON.stringify(a)}`); if (m === 'in') q.ins = a[1]; return q }
    q.or = (f: string) => { seen.push(f); return q }
    q.limit = (n: number) => Promise.resolve({ data: rows.slice(0, n), error: null })
    q.then = (ok: (v: unknown) => void) => ok({ data: (q.ins as string[]).map(s => ({ sha256: s, content: `text ${s.slice(-2)}` })), error: null })
    return table === 'material_texts' ? q : q
  }
  return { from: chain }
}
function call(handler: ReturnType<typeof createExportHandler>, query: Row, auth?: string, method = 'GET') {
  const res: any = { statusCode: 200, headers: {}, body: undefined }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: unknown) => { res.body = b; return res }
  res.setHeader = (k: string, v: string) => { res.headers[k] = v }
  return Promise.resolve(handler({ method, query, headers: auth ? { authorization: auth } : {} } as any, res)).then(() => res)
}

describe('the research export', () => {
  const verify = (a: string | undefined) => verifyGithubIdentity(a, VAULT_RULE, keys, NOW)

  it('refuses without the vault identity, writing and reading nothing', async () => {
    let read = false
    const h = createExportHandler(async () => { read = true; return fakeDb([]) }, verify)
    expect((await call(h, {}, token({ repository: 'krishanraja/content-engine' }))).statusCode).toBe(401)
    expect((await call(h, {}, undefined)).statusCode).toBe(401)
    expect((await call(h, {}, token(), 'POST')).statusCode).toBe(405)
    expect(read).toBe(false)
  })

  it('pages research oldest first with each item\'s manifest, venture and text, and a cursor to carry on', async () => {
    const seen: string[] = []
    const rows = [row(1), row(2, { scope: 'venture:mindmake', week: null, day: null }), row(3)]
    const h = createExportHandler(async () => fakeDb(rows, seen), verify)
    const first = await call(h, { limit: '2' }, token())
    expect(first.statusCode).toBe(200)
    expect(first.body).toMatchObject({ ok: true, count: 2, done: false })
    expect(first.body.items.map((i: Row) => [i.title, i.venture, i.content])).toEqual([['R1', 'publication', 'text a1'], ['R2', 'mindmake', 'text a2']])
    expect(first.body.items[0]).not.toHaveProperty('text_sha256')
    expect(parseCursor(first.body.next_cursor)).toEqual({ at: rows[1].added_at, id: rows[1].id })
    await call(h, { after: first.body.next_cursor }, token())
    expect(seen.at(-1)).toContain(`added_at.gt."${rows[1].added_at}"`)
    expect(seen.at(-1)).toContain(`id.gt.${rows[1].id}`)
    const all = await call(createExportHandler(async () => fakeDb(rows), verify), {}, token())
    expect(all.body).toMatchObject({ count: 3, done: true })
  })

  it('refuses a bad cursor or limit', async () => {
    const h = createExportHandler(async () => fakeDb([]), verify)
    expect((await call(h, { after: 'not a cursor!' }, token())).body.error).toBe('invalid_cursor')
    expect((await call(h, { limit: '201' }, token())).body.error).toBe('invalid_limit')
    expect(cursorOf({ added_at: '2026-11-14T10:00:00Z', id: '00000000-0000-4000-8000-000000000001' })).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(ventureOfScope('8287846b-6618-4a19-9fb8-23ad4eca2718')).toBe('publication')
  })
})
