import { createServer } from 'node:http'
import { afterEach, expect, it, vi } from 'vitest'
import { MediaFixture } from '../helpers/media-quality.js'
import { createMediaQualityHandler } from '../../apps/control-plane/api/media-quality/index.js'
vi.hoisted(() => { process.env.SUPABASE_URL = 'https://storage-fixture.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test' })
const originalFetch = globalThis.fetch
const previous = { token: process.env.ENGINE_OPERATOR_TOKEN, keys: process.env.MEDIA_REVIEW_PUBLIC_KEYS }
afterEach(() => {
  vi.unstubAllGlobals()
  for (const [name, value] of [['ENGINE_OPERATOR_TOKEN', previous.token], ['MEDIA_REVIEW_PUBLIC_KEYS', previous.keys]]) {
    if (value === undefined) delete process.env[name!]; else process.env[name!] = value
  }
})
it('exercises authenticated qualification over real local HTTP and rejects corrupt/revoked media', async () => {
  const f = new MediaFixture(), v = f.video()
  process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-runtime-token'
  process.env.MEDIA_REVIEW_PUBLIC_KEYS = JSON.stringify(f.keys)
  vi.stubGlobal('fetch', (url: string | URL | Request, init?: RequestInit) => String(url).startsWith('https://media-fixture.invalid/') ? f.fetch(url) : originalFetch(url, init))
  const handler = createMediaQualityHandler(async () => f.db as never)
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const parsed = { method: req.method, headers: req.headers, query: {}, body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {} }
    const adapted = Object.assign(res, { status(code: number) { res.statusCode = code; return this }, json(data: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return this } })
    await handler(parsed as never, adapted as never)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }, url = `http://127.0.0.1:${address.port}/api/media-quality`
  const post = (auth = true) => originalFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${process.env.ENGINE_OPERATOR_TOKEN}` } : {}) }, body: JSON.stringify(v.request) })
  try {
    expect((await post(false)).status).toBe(401)
    const good = await post(); expect(good.status).toBe(200)
    expect(await good.json()).toMatchObject({ ok: true, qualification: { qualified: true, artifact: v.request.artifact, production_id: 'job-fixture-piece' } })
    process.env.MEDIA_REVIEW_PUBLIC_KEYS = JSON.stringify({ final: f.keys.final })
    const revoked = await post(); expect(revoked.status).toBe(409)
    expect((await revoked.json()).problems[0]).toContain('representative proof')
    process.env.MEDIA_REVIEW_PUBLIC_KEYS = JSON.stringify(f.keys)
    f.objects.set(f.rows.find(r => r.sha256 === v.request.artifact.sha256)!.object_key, Buffer.from('changed'))
    expect((await post()).status).toBe(409)
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())) }
})
