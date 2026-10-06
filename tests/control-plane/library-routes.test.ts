import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The asset library's four routes (api/library/), with Storage and the
// database stubbed: no test reaches a real bucket or a real database.
//
// Krish, 2026-10-06: "I want every single asset in there, permanent and for
// individual posts, categorized properly, clear what to use them for, and
// every new post gets its own new folder with all assets including the
// article HTML I can copy paste, video scripts, etc etc". A cloud session
// sends (upload-url, confirm, on the engine key); his always-on machine takes
// (pending, written, on the runner bearer). Same pattern as the Studio's
// preview upload: a private bucket, signed URLs, the bucket checked on every
// request, the same error shapes.

vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://store.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})

type Row = Record<string, any>

const db = vi.hoisted(() => ({
  files: [] as Row[],
  bucket: null as null | { public: boolean; file_size_limit: number; allowed_mime_types: string[] },
  objects: new Map<string, { size: number; contentType: string; etag?: string }>(),
  signedOrigin: 'https://store.example',
  rpc: [] as Array<{ name: string; args: any }>,
  pending: [] as Row[],
  written: [] as Row[],
  indexDown: false,
  uploads: [] as string[],
  nextId: 1,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  function table(name: string) {
    if (name !== 'content_library_files') throw new Error(`unexpected table ${name}`)
    const filters: Array<[string, unknown]> = []
    let update: Row | null = null
    let order: { key: string; ascending: boolean } | null = null
    let limit: number | null = null
    const matching = () => {
      let rows = db.files.filter((row) => filters.every(([key, value]) => row[key] === value))
      if (order) {
        const { key, ascending } = order
        rows = [...rows].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1))
      }
      return limit === null ? rows : rows.slice(0, limit)
    }
    const down = { data: null, error: { message: 'index down' } }
    const chain: Record<string, any> = {
      select: () => chain,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return chain },
      order: (key: string, options?: { ascending?: boolean }) => { order = { key, ascending: options?.ascending !== false }; return chain },
      limit: (n: number) => { limit = n; return chain },
      update: (values: Row) => { update = values; return chain },
      maybeSingle: async () => {
        if (db.indexDown) return down
        const rows = matching()
        return { data: rows[0] ? { ...rows[0] } : null, error: null }
      },
      upsert: async (row: Row, options: { onConflict: string; ignoreDuplicates: boolean }) => {
        if (db.indexDown) return down
        expect(options).toEqual({ onConflict: 'path,sha256', ignoreDuplicates: true })
        if (!db.files.some((f) => f.path === row.path && f.sha256 === row.sha256)) {
          db.files.push({ id: `id-${db.nextId++}`, sent_at: '2026-10-06T09:00:00.000Z', ready_at: null, written: {}, ...row })
        }
        return { data: null, error: null }
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        if (db.indexDown) return Promise.resolve(down).then(resolve, reject)
        const rows = matching()
        if (update) for (const row of rows) Object.assign(row, update)
        return Promise.resolve({ data: rows.map((row) => ({ ...row })), error: null }).then(resolve, reject)
      },
    }
    return chain
  }
  return {
    supabase: {
      from: table,
      rpc: async (name: string, args: unknown) => {
        db.rpc.push({ name, args })
        if (name === 'video_studio_take_rate_limit') return { data: [{ allowed: true }], error: null }
        if (db.indexDown) return { data: null, error: { message: 'index down' } }
        if (name === 'content_library_pending') return { data: db.pending, error: null }
        if (name === 'content_library_record_written') return { data: db.written, error: null }
        return { data: null, error: { message: `unexpected rpc ${name}` } }
      },
      storage: {
        getBucket: async (id: string) => (db.bucket
          ? { data: { id, name: id, ...db.bucket }, error: null }
          : { data: null, error: { message: 'Bucket not found', status: 404 } }),
        from: (bucket: string) => ({
          info: async (key: string) => {
            const object = db.objects.get(key)
            return object
              ? { data: { name: key, size: object.size, contentType: object.contentType, etag: object.etag }, error: null }
              : { data: null, error: { message: 'Object not found', status: 404 } }
          },
          createSignedUploadUrl: async (key: string, options: { upsert: boolean }) => {
            expect(options).toEqual({ upsert: false })
            db.uploads.push(key)
            return { data: { signedUrl: `${db.signedOrigin}/storage/v1/object/upload/sign/${bucket}/${key}?token=up`, token: 'up', path: key }, error: null }
          },
          createSignedUrls: async (keys: string[], ttl: number) => {
            expect(ttl).toBe(30 * 60)
            return { data: keys.map((key) => ({ path: key, signedUrl: `${db.signedOrigin}/storage/v1/object/sign/${bucket}/${key}?token=down`, signedURL: null, error: null })), error: null }
          },
        }),
      },
    },
  }
})

import uploadUrl from '../../apps/control-plane/api/library/upload-url.js'
import confirm from '../../apps/control-plane/api/library/confirm.js'
import pending from '../../apps/control-plane/api/library/pending.js'
import written from '../../apps/control-plane/api/library/written.js'
import { LIBRARY_MAX_BYTES, libraryMimeTypes } from '../../apps/control-plane/api/library/_library.js'
import { videoStudioRunnerIdentity } from '../../apps/control-plane/api/_videoStudioAuth.js'

class MockResponse {
  statusCode = 200
  body: any
  headers = new Map<string, unknown>()
  status(code: number) { this.statusCode = code; return this }
  json(value: unknown) { this.body = value; return this }
  setHeader(name: string, value: unknown) { this.headers.set(name.toLowerCase(), value); return this }
  end() { return this }
}

const ENGINE = 'eot_' + 'e'.repeat(40)
const RUNNER = 'r'.repeat(48)
process.env.ENGINE_OPERATOR_TOKEN = ENGINE
process.env.VIDEO_STUDIO_RUNNER_TOKEN = RUNNER
delete process.env.ACCESS_CODE

type Handler = (req: VercelRequest, res: VercelResponse) => unknown

async function call(handler: Handler, request: { method?: string; headers?: Record<string, string>; query?: Record<string, unknown>; body?: unknown }) {
  const res = new MockResponse()
  await handler({ method: 'POST', headers: {}, query: {}, ...request } as unknown as VercelRequest, res as unknown as VercelResponse)
  return res
}

const asEngine = (body: unknown) => ({ headers: { authorization: `Bearer ${ENGINE}`, 'content-type': 'application/json' }, body })
const asRunner = (method: 'GET' | 'POST', extra: { query?: Record<string, unknown>; body?: unknown }) => ({
  method,
  headers: { authorization: `Bearer ${RUNNER}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
  ...extra,
})

const POST = '3 Posts/2026-10-05 Mon follow.the.money - Who gets paid'
const PATH = `${POST}/1 Article/substack-copy.html`
const SHA = 'a'.repeat(64)
const MD5 = '0123456789abcdef0123456789abcdef'
const KEY = `files/${SHA}.html`
const send = (over: Record<string, unknown> = {}) => ({ path: PATH, sha256: SHA, md5: MD5, bytes: 1234, purpose: "Paste into Substack's editor", client: 'codex', ...over })

function readyRow(over: Row = {}): Row {
  return {
    id: `id-${db.nextId++}`, path: PATH, sha256: SHA, md5: MD5, bytes: 1234, content_type: 'text/html', object_key: KEY,
    purpose: "Paste into Substack's editor", sent_by: 'codex', sent_at: '2026-10-06T08:00:00.000Z', state: 'ready',
    ready_at: '2026-10-06T08:01:00.000Z', written: {}, ...over,
  }
}

beforeEach(() => {
  db.files = []
  db.bucket = { public: false, file_size_limit: LIBRARY_MAX_BYTES, allowed_mime_types: libraryMimeTypes() }
  db.objects = new Map()
  db.signedOrigin = 'https://store.example'
  db.rpc = []
  db.pending = []
  db.written = []
  db.indexDown = false
  db.uploads = []
})

describe('POST /api/library/upload-url', () => {
  it('refuses without the engine key, before anything is read', async () => {
    for (const headers of [{}, { authorization: 'Bearer eot_wrong' }, { authorization: `Bearer ${RUNNER}` }]) {
      const res = await call(uploadUrl, { headers, body: send() })
      expect(res.statusCode).toBe(401)
      expect(res.body).toEqual({ ok: false, error: 'unauthorized' })
    }
    expect(db.rpc).toEqual([])
    expect(db.files).toEqual([])
  })

  it('refuses a path outside the library with the reason, and writes nothing', async () => {
    for (const [path, reason] of [
      ['3 Posts/../../Video Engine/Inbox/take.mp4', 'path_escapes_library'],
      ['Video Engine/Archive/x.mp4', 'path_wrong_top_folder'],
      ['2 Channel art (permanent)/what?.png', 'path_unsafe_character'],
      [`${POST}/cover.png`, 'path_post_section_invalid'],
    ] as const) {
      const res = await call(uploadUrl, asEngine(send({ path })))
      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ ok: false, error: { code: 'invalid_library_path', reason } })
    }
    expect(db.files).toEqual([])
    expect(db.uploads).toEqual([])
  })

  it('refuses a file over the cap', async () => {
    const res = await call(uploadUrl, asEngine(send({ bytes: LIBRARY_MAX_BYTES + 1 })))
    expect(res.statusCode).toBe(413)
    expect(res.body).toEqual({ ok: false, error: { code: 'library_file_too_large' } })
  })

  it('works only while the bucket is private, with the exact cap and types', async () => {
    const good = db.bucket!
    for (const bucket of [
      { ...good, public: true },
      { ...good, file_size_limit: 50 * 1024 * 1024 },
      { ...good, allowed_mime_types: [...good.allowed_mime_types, 'application/x-msdownload'] },
      { ...good, allowed_mime_types: [] },
    ]) {
      db.bucket = bucket
      const res = await call(uploadUrl, asEngine(send()))
      expect(res.statusCode).toBe(503)
      expect(res.body).toEqual({ ok: false, error: { code: 'library_store_misconfigured' } })
    }
    db.bucket = null
    const missing = await call(uploadUrl, asEngine(send()))
    expect(missing.body).toEqual({ ok: false, error: { code: 'library_store_unavailable' } })
    expect(db.files).toEqual([])
  })

  it('reserves a new file and hands back a signed PUT for the private bucket', async () => {
    const res = await call(uploadUrl, asEngine(send()))
    expect(res.statusCode).toBe(200)
    expect(res.body.already_there).toBe(false)
    expect(res.body.upload).toMatchObject({
      method: 'PUT',
      url: `https://store.example/storage/v1/object/upload/sign/content-library/${KEY}?token=up`,
      headers: { 'Content-Type': 'text/html' },
    })
    expect(res.body.file).toMatchObject({ path: PATH, sha256: SHA, bytes: 1234, content_type: 'text/html', state: 'reserved', sent_by: 'codex' })
    expect(res.body.file).not.toHaveProperty('object_key')
    expect(db.files).toHaveLength(1)
    expect(db.files[0]).toMatchObject({ state: 'reserved', object_key: KEY, sent_by: 'codex', purpose: "Paste into Substack's editor" })
    expect(db.rpc[0]).toMatchObject({ name: 'video_studio_take_rate_limit', args: { p_scope: 'library:send' } })
  })

  it('says who sent it: the agent client, or claude_code when none is named', async () => {
    await call(uploadUrl, asEngine(send({ client: undefined })))
    expect(db.files[0]!.sent_by).toBe('claude_code')
  })

  it('refuses a signed URL that points anywhere but the database\'s own Storage', async () => {
    db.signedOrigin = 'https://elsewhere.example'
    const res = await call(uploadUrl, asEngine(send()))
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ ok: false, error: { code: 'library_store_unavailable' } })
  })

  it('says "already there" when the path already has these bytes as its newest version', async () => {
    db.files.push(readyRow())
    const res = await call(uploadUrl, asEngine(send()))
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, already_there: true, newest_again: false, upload: null })
    expect(db.uploads).toEqual([])
  })

  it('makes an older version the newest again when it is sent again', async () => {
    db.files.push(readyRow())
    db.files.push(readyRow({ sha256: 'c'.repeat(64), object_key: `files/${'c'.repeat(64)}.html`, ready_at: '2026-10-06T10:00:00.000Z' }))
    const res = await call(uploadUrl, asEngine(send()))
    expect(res.body).toMatchObject({ already_there: true, newest_again: true, upload: null })
    const older = db.files.find((row) => row.sha256 === SHA)!
    expect(Date.parse(older.ready_at)).toBeGreaterThan(Date.parse('2026-10-06T10:00:00.000Z'))
  })

  it('needs no upload when the bytes are already stored, from another path', async () => {
    db.objects.set(KEY, { size: 1234, contentType: 'text/html', etag: `"${MD5}"` })
    const res = await call(uploadUrl, asEngine(send()))
    expect(res.body).toMatchObject({ already_there: false, upload: null })
    expect(db.uploads).toEqual([])
  })

  it('refuses stored bytes that differ from the declared ones', async () => {
    db.objects.set(KEY, { size: 99, contentType: 'text/html' })
    const res = await call(uploadUrl, asEngine(send()))
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ ok: false, error: { code: 'library_object_conflict' } })
  })

  it('refuses the same sha256 sent with another size', async () => {
    db.files.push(readyRow({ state: 'reserved', ready_at: null }))
    const res = await call(uploadUrl, asEngine(send({ bytes: 999 })))
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ ok: false, error: { code: 'library_file_conflict' } })
  })

  it('says so when the index cannot be read', async () => {
    db.indexDown = true
    const res = await call(uploadUrl, asEngine(send()))
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ ok: false, error: { code: 'library_index_unavailable' } })
  })
})

describe('POST /api/library/confirm', () => {
  const body = { path: PATH, sha256: SHA }

  it('refuses without the engine key', async () => {
    const res = await call(confirm, { headers: { authorization: `Bearer ${RUNNER}` }, body })
    expect(res.statusCode).toBe(401)
  })

  it('needs a reservation, then the object itself', async () => {
    expect((await call(confirm, asEngine(body))).body).toEqual({ ok: false, error: { code: 'library_file_not_found' } })
    db.files.push(readyRow({ state: 'reserved', ready_at: null }))
    const missing = await call(confirm, asEngine(body))
    expect(missing.statusCode).toBe(409)
    expect(missing.body).toEqual({ ok: false, error: { code: 'library_object_missing' } })
    expect(db.files[0]!.state).toBe('reserved')
  })

  it('refuses an object of the wrong size, type or MD5', async () => {
    db.files.push(readyRow({ state: 'reserved', ready_at: null }))
    for (const object of [
      { size: 1233, contentType: 'text/html' },
      { size: 1234, contentType: 'text/plain' },
      { size: 1234, contentType: 'text/html', etag: `"${'f'.repeat(32)}"` },
    ]) {
      db.objects.set(KEY, object)
      const res = await call(confirm, asEngine(body))
      expect(res.statusCode).toBe(409)
      expect(res.body).toEqual({ ok: false, error: { code: 'library_object_conflict' } })
    }
    expect(db.files[0]!.state).toBe('reserved')
  })

  it('marks the file ready once the object checks out, and changes nothing the second time', async () => {
    db.files.push(readyRow({ state: 'reserved', ready_at: null }))
    // A large upload stored in parts reports a composite tag, not an MD5: size and type still bind.
    db.objects.set(KEY, { size: 1234, contentType: 'text/html; charset=utf-8', etag: '"abc-3"' })
    const res = await call(confirm, asEngine(body))
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, already_ready: false, file: { path: PATH, state: 'ready' } })
    expect(db.files[0]!.ready_at).toEqual(expect.any(String))
    const again = await call(confirm, asEngine(body))
    expect(again.body).toMatchObject({ ok: true, already_ready: true })
  })
})

describe('GET /api/library/pending', () => {
  const machine = 'library-1d7c0e4e-1b0f-4c47-9f39-6c4c3b1f0a55'
  const hash = videoStudioRunnerIdentity(machine)
  const row = (over: Row = {}) => ({
    path: PATH, sha256: SHA, bytes: 1234, content_type: 'text/html', object_key: KEY, purpose: "Paste into Substack's editor",
    sent_by: 'codex', sent_at: '2026-10-06T08:00:00.000Z', ready_at: '2026-10-06T08:01:00.000Z', previous_sha256: null, ...over,
  })

  it('takes the runner bearer only, on GET, with no content type to send', async () => {
    expect((await call(pending, { method: 'GET', headers: { authorization: `Bearer ${ENGINE}` }, query: { machine } })).statusCode).toBe(401)
    expect((await call(pending, { method: 'GET', headers: {}, query: { machine } })).statusCode).toBe(401)
    expect((await call(pending, asRunner('POST', { query: { machine } }))).statusCode).toBe(405)
    expect((await call(pending, asRunner('GET', { query: { machine } }))).statusCode).toBe(200)
  })

  it('refuses a request without a machine', async () => {
    const res = await call(pending, asRunner('GET', { query: {} }))
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: { code: 'invalid_library_pending_request' } })
  })

  it('hands this machine the newest versions it has not written, each with a short-lived download URL', async () => {
    db.pending = [row(), row({ path: `${POST}/READ ME.txt`, sha256: 'b'.repeat(64), content_type: 'text/plain', object_key: `files/${'b'.repeat(64)}.txt`, previous_sha256: 'c'.repeat(64) })]
    const res = await call(pending, asRunner('GET', { query: { machine, limit: '1' } }))
    expect(res.statusCode).toBe(200)
    expect(db.rpc.find((c) => c.name === 'content_library_pending')?.args).toEqual({ p_machine_hash: hash, p_limit: 2 })
    expect(res.body).toMatchObject({ ok: true, schema_version: 1, machine: hash.slice(0, 8), skipped: 0, more: true })
    expect(res.body.files).toEqual([{
      path: PATH, sha256: SHA, bytes: 1234, content_type: 'text/html', purpose: "Paste into Substack's editor",
      sent_by: 'codex', sent_at: '2026-10-06T08:00:00.000Z', ready_at: '2026-10-06T08:01:00.000Z', previous_sha256: null,
      download: { method: 'GET', url: `https://store.example/storage/v1/object/sign/content-library/${KEY}?token=down`, expires_at: expect.any(String) },
    }])
  })

  it('never hands over a row that breaks the path rule, and counts it', async () => {
    db.pending = [
      row({ path: '3 Posts/../../Video Engine/Inbox/take.html' }),
      row({ path: 'Video Engine/Archive/x.html' }),
      row({ content_type: 'application/x-msdownload' }),
      row(),
    ]
    const res = await call(pending, asRunner('GET', { query: { machine } }))
    expect(res.body.files.map((f: Row) => f.path)).toEqual([PATH])
    expect(res.body.skipped).toBe(3)
  })

  it('drops a download URL that points anywhere but the database\'s own Storage', async () => {
    db.pending = [row()]
    db.signedOrigin = 'https://elsewhere.example'
    const res = await call(pending, asRunner('GET', { query: { machine } }))
    expect(res.body.files).toEqual([])
    expect(res.body.skipped).toBe(1)
  })
})

describe('POST /api/library/written', () => {
  const machine = 'library-1d7c0e4e-1b0f-4c47-9f39-6c4c3b1f0a55'
  const hash = videoStudioRunnerIdentity(machine)

  it('takes the runner bearer only, with a JSON body', async () => {
    const body = { schema_version: 1, machine, items: [{ path: PATH, sha256: SHA }] }
    expect((await call(written, { headers: { authorization: `Bearer ${ENGINE}`, 'content-type': 'application/json' }, body })).statusCode).toBe(401)
    expect((await call(written, { headers: { authorization: `Bearer ${RUNNER}` }, body })).statusCode).toBe(415)
  })

  it('refuses a name kept beside a file in another folder', async () => {
    const res = await call(written, asRunner('POST', { body: { schema_version: 1, machine, items: [{ path: PATH, sha256: SHA, written_as: '2 Channel art (permanent)/x.html' }] } }))
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: { code: 'invalid_library_written_request' } })
    expect(db.rpc.some((c) => c.name === 'content_library_record_written')).toBe(false)
  })

  it('takes a READ ME kept beside a hand-written one, which the path rule alone would refuse', async () => {
    // 2026-10-06: the first real pass kept Krish's own READ ME.txt and wrote the
    // pack's beside it as "READ ME (2).txt"; the report was refused whole.
    const readme = `${POST}/READ ME.txt`
    db.written = [{ item_path: readme, item_sha256: SHA, outcome: 'recorded' }]
    const res = await call(written, asRunner('POST', { body: { schema_version: 1, machine, items: [
      { path: readme, sha256: SHA, written_as: `${POST}/READ ME (2).txt` },
    ] } }))
    expect(res.statusCode).toBe(200)
    expect(db.rpc.find((c) => c.name === 'content_library_record_written')?.args).toEqual({
      p_machine_hash: hash,
      p_items: [{ path: readme, sha256: SHA, written_as: `${POST}/READ ME (2).txt` }],
    })
  })

  it('takes only the sync\'s own beside-name, in the same folder', async () => {
    const { isBesideName } = await import('../../apps/control-plane/api/library/_library.js')
    const readme = `${POST}/READ ME.txt`
    expect(isBesideName(readme, `${POST}/READ ME (2).txt`)).toBe(true)
    expect(isBesideName(readme, `${POST}/READ ME (99).txt`)).toBe(true)
    expect(isBesideName(PATH, PATH.replace('substack-copy.html', 'substack-copy (3).html'))).toBe(true)
    for (const bad of [
      `${POST}/READ ME (1).txt`, `${POST}/READ ME (100).txt`, `${POST}/READ ME (02).txt`,
      `${POST}/READ ME (2).html`, `${POST}/READ ME(2).txt`, `${POST}/other.txt`,
      `${POST}/1 Article/READ ME (2).txt`, `2 Channel art (permanent)/READ ME (2).txt`,
      `${POST}/READ ME (2).txt/../x.txt`, 42, null,
    ]) expect(isBesideName(readme, bad)).toBe(false)
  })

  it('records what this machine wrote, and names what the library does not hold', async () => {
    const beside = PATH.replace('substack-copy.html', 'substack-copy (2).html')
    db.written = [
      { item_path: PATH, item_sha256: SHA, outcome: 'recorded' },
      { item_path: `${POST}/READ ME.txt`, item_sha256: 'b'.repeat(64), outcome: 'unknown' },
    ]
    const res = await call(written, asRunner('POST', { body: { schema_version: 1, machine, items: [
      { path: PATH, sha256: SHA, written_as: beside },
      { path: `${POST}/READ ME.txt`, sha256: 'b'.repeat(64) },
    ] } }))
    expect(res.statusCode).toBe(200)
    expect(db.rpc.find((c) => c.name === 'content_library_record_written')?.args).toEqual({
      p_machine_hash: hash,
      p_items: [{ path: PATH, sha256: SHA, written_as: beside }, { path: `${POST}/READ ME.txt`, sha256: 'b'.repeat(64), written_as: null }],
    })
    expect(res.body).toEqual({ ok: true, schema_version: 1, machine: hash.slice(0, 8), recorded: 1, unknown: [{ path: `${POST}/READ ME.txt`, sha256: 'b'.repeat(64) }] })
  })
})

describe('the runner guard', () => {
  it('still demands JSON on every runner POST, and a GET carries none', async () => {
    const { guardVideoStudioRunner } = await import('../../apps/control-plane/api/_videoStudioAuth.js')
    const run = (method: string, headers: Record<string, string>, methods: string[]) => {
      const res = new MockResponse()
      const stopped = guardVideoStudioRunner({ method, headers } as unknown as VercelRequest, res as unknown as VercelResponse, methods)
      return { stopped, status: res.statusCode }
    }
    expect(run('POST', { authorization: `Bearer ${RUNNER}` }, ['POST'])).toEqual({ stopped: true, status: 415 })
    expect(run('POST', { authorization: `Bearer ${RUNNER}`, 'content-type': 'text/plain' }, ['POST'])).toEqual({ stopped: true, status: 415 })
    expect(run('GET', { authorization: `Bearer ${RUNNER}` }, ['POST'])).toEqual({ stopped: true, status: 405 })
    expect(run('GET', { authorization: `Bearer ${RUNNER}` }, ['GET'])).toEqual({ stopped: false, status: 200 })
    expect(run('GET', {}, ['GET'])).toEqual({ stopped: true, status: 401 })
  })

  it('identifies each machine by the same hash the runner routes use', () => {
    const expected = createHash('sha256').update(['runner', RUNNER, 'library-x'].join('\u0000')).digest('hex')
    expect(videoStudioRunnerIdentity('library-x')).toBe(expected)
  })
})
