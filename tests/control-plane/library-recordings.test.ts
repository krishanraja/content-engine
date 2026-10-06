import { readFileSync } from 'node:fs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The recordings lane (api/library/recordings/), with Storage stubbed: no test
// reaches a real bucket.
//
// Krish, 2026-10-06, after a session told him it could not reach his file:
// "figure out how to never make that error again". His always-on machine sends
// every finished recording in the Video Engine Inbox (upload-url, confirm, on
// the runner bearer); a cloud session lists and downloads them (GET
// recordings, on the engine key). No table: the bytes and a small manifest
// beside them, in the library's private bucket under recordings/.

vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://store.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})

const db = vi.hoisted(() => ({
  bucket: null as null | { public: boolean; file_size_limit: number; allowed_mime_types: string[] },
  objects: new Map<string, { size: number; contentType: string; etag?: string; body?: string; created: number }>(),
  signedOrigin: 'https://store.example',
  rpc: [] as Array<{ name: string; args: any }>,
  uploads: [] as string[],
  written: [] as Array<{ key: string; options: any }>,
  storeDown: false,
  clock: 0,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    from: (name: string) => { throw new Error(`the recordings lane reads no table, but asked for ${name}`) },
    rpc: async (name: string, args: unknown) => {
      db.rpc.push({ name, args })
      if (name === 'video_studio_take_rate_limit') return { data: [{ allowed: true }], error: null }
      return { data: null, error: { message: `unexpected rpc ${name}` } }
    },
    storage: {
      getBucket: async (id: string) => (db.bucket
        ? { data: { id, name: id, ...db.bucket }, error: null }
        : { data: null, error: { message: 'Bucket not found', status: 404 } }),
      from: (bucket: string) => ({
        info: async (key: string) => {
          if (db.storeDown) return { data: null, error: { message: 'down', status: 500 } }
          const object = db.objects.get(key)
          return object
            ? { data: { name: key, size: object.size, contentType: object.contentType, etag: object.etag }, error: null }
            : { data: null, error: { message: 'Object not found', status: 404 } }
        },
        download: async (key: string) => {
          if (db.storeDown) return { data: null, error: { message: 'down', status: 500 } }
          const object = db.objects.get(key)
          return object?.body !== undefined
            ? { data: new Blob([object.body]), error: null }
            : { data: null, error: { message: 'Object not found', status: 400 } }
        },
        upload: async (key: string, body: Buffer, options: any) => {
          db.written.push({ key, options })
          db.objects.set(key, { size: body.length, contentType: options.contentType, body: body.toString('utf8'), created: ++db.clock })
          return { data: { path: key }, error: null }
        },
        list: async (prefix: string, options: any) => {
          expect(prefix).toBe('recordings')
          expect(options).toEqual({ limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
          const items = [...db.objects.entries()]
            .filter(([key]) => key.startsWith('recordings/'))
            .sort((a, b) => b[1].created - a[1].created)
            .map(([key]) => ({ name: key.slice('recordings/'.length) }))
          return { data: items, error: null }
        },
        createSignedUploadUrl: async (key: string, options: { upsert: boolean }) => {
          expect(options).toEqual({ upsert: false })
          db.uploads.push(key)
          return { data: { signedUrl: `${db.signedOrigin}/storage/v1/object/upload/sign/${bucket}/${key}?token=up`, token: 'up', path: key }, error: null }
        },
        createSignedUrls: async (keys: string[], ttl: number) => {
          expect(ttl).toBe(60 * 60)
          return { data: keys.map((key) => ({ path: key, signedUrl: `${db.signedOrigin}/storage/v1/object/sign/${bucket}/${key}?token=down`, error: null })), error: null }
        },
      }),
    },
  },
}))

import uploadUrl from '../../apps/control-plane/api/library/recordings/upload-url.js'
import confirm from '../../apps/control-plane/api/library/recordings/confirm.js'
import list from '../../apps/control-plane/api/library/recordings/index.js'
import { LIBRARY_MAX_BYTES, LIBRARY_OPTIONAL_MIME_TYPES, libraryMimeTypes } from '../../apps/control-plane/api/library/_library.js'
import { RECORDING_CONTENT_TYPES, checkRecordingName } from '../../apps/control-plane/api/library/_recordings.js'

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

const asRunner = (body: unknown) => ({ headers: { authorization: `Bearer ${RUNNER}`, 'content-type': 'application/json' }, body })
const asEngine = (query: Record<string, unknown> = {}) => ({ method: 'GET', headers: { authorization: `Bearer ${ENGINE}` }, query })

const SHA = 'b'.repeat(64)
const MD5 = '0123456789abcdef0123456789abcdef'
const KEY = `recordings/${SHA}.mp4`
const NAME = '2026-10-06 take 1.mp4'
const BYTES = 300 * 1024 * 1024
const recording = (over: Record<string, unknown> = {}) => ({ name: NAME, sha256: SHA, md5: MD5, bytes: BYTES, ...over })
const stored = (key = KEY, size = BYTES, contentType = 'video/mp4') => db.objects.set(key, { size, contentType, etag: `"${MD5}"`, created: ++db.clock })

beforeEach(() => {
  db.bucket = { public: false, file_size_limit: LIBRARY_MAX_BYTES, allowed_mime_types: libraryMimeTypes() }
  db.objects = new Map()
  db.signedOrigin = 'https://store.example'
  db.rpc = []
  db.uploads = []
  db.written = []
  db.storeDown = false
  db.clock = 0
})

describe('POST /api/library/recordings/upload-url', () => {
  it('takes only the runner bearer, before anything is read', async () => {
    for (const headers of [{}, { authorization: `Bearer ${ENGINE}` }, { authorization: 'Bearer nope' }]) {
      const res = await call(uploadUrl, { headers, body: recording() })
      expect(res.statusCode).toBe(401)
    }
    expect(db.rpc).toEqual([])
    expect(db.uploads).toEqual([])
  })

  it('refuses a name with a folder, an unsafe character or a type that is no recording, with the reason', async () => {
    for (const [name, reason] of [
      ['../Archive/take.mp4', 'name_has_folder'],
      ['Inbox\\take.mp4', 'name_has_folder'],
      ['take?.mp4', 'name_unsafe_character'],
      ['.hidden.mp4', 'name_hidden'],
      ['notes.txt', 'name_type_not_recording'],
      ['take.mp4 ', 'name_edge'],
    ] as const) {
      const res = await call(uploadUrl, asRunner(recording({ name })))
      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ ok: false, error: { code: 'invalid_recording_name', reason } })
    }
    expect(db.uploads).toEqual([])
  })

  it('refuses a recording over 500 MiB, and a bad sha256 or md5', async () => {
    const big = await call(uploadUrl, asRunner(recording({ bytes: LIBRARY_MAX_BYTES + 1 })))
    expect(big.statusCode).toBe(413)
    expect(big.body).toEqual({ ok: false, error: { code: 'recording_too_large' } })
    for (const over of [{ sha256: 'x' }, { md5: 'x' }, { bytes: 0 }]) {
      const res = await call(uploadUrl, asRunner(recording(over)))
      expect(res.body).toEqual({ ok: false, error: { code: 'invalid_recording_request' } })
    }
  })

  it('hands back a signed PUT keyed by sha256 under recordings/', async () => {
    const res = await call(uploadUrl, asRunner(recording()))
    expect(res.statusCode).toBe(200)
    expect(res.body.already_there).toBe(false)
    expect(res.body.upload).toMatchObject({
      method: 'PUT',
      url: `https://store.example/storage/v1/object/upload/sign/content-library/${KEY}?token=up`,
      headers: { 'Content-Type': 'video/mp4' },
    })
    expect(db.uploads).toEqual([KEY])
    expect(db.rpc[0]).toMatchObject({ name: 'video_studio_take_rate_limit', args: { p_scope: 'library:recordings' } })
  })

  it('works without an md5', async () => {
    const res = await call(uploadUrl, asRunner(recording({ md5: undefined })))
    expect(res.statusCode).toBe(200)
    expect(res.body.upload.method).toBe('PUT')
  })

  it('says already_there when the bytes are stored under this name', async () => {
    stored()
    await call(confirm, asRunner(recording()))
    const res = await call(uploadUrl, asRunner(recording()))
    expect(res.body).toMatchObject({ ok: true, already_there: true, upload: null, recording: { name: NAME, sha256: SHA, bytes: BYTES } })
    expect(db.uploads).toEqual([])
  })

  it('asks only for a confirm when the bytes are stored under another name', async () => {
    stored()
    await call(confirm, asRunner(recording({ name: 'first name.mp4' })))
    const res = await call(uploadUrl, asRunner(recording()))
    expect(res.body).toMatchObject({ ok: true, already_there: false, upload: null })
    expect(db.uploads).toEqual([])
  })

  it('refuses stored bytes of another size', async () => {
    stored(KEY, 5)
    const res = await call(uploadUrl, asRunner(recording()))
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ ok: false, error: { code: 'recording_object_conflict' } })
  })

  it('refuses an mkv until the bucket allows Matroska, then takes it', async () => {
    const before = await call(uploadUrl, asRunner(recording({ name: 'take.mkv' })))
    expect(before.statusCode).toBe(415)
    expect(before.body).toEqual({ ok: false, error: { code: 'recording_type_not_enabled', content_type: 'video/x-matroska' } })
    db.bucket!.allowed_mime_types = [...libraryMimeTypes(), 'video/x-matroska']
    const after = await call(uploadUrl, asRunner(recording({ name: 'take.mkv' })))
    expect(after.statusCode).toBe(200)
    expect(db.uploads).toEqual([`recordings/${SHA}.mkv`])
  })

  it('refuses a signed URL that points anywhere but the database\'s own Storage', async () => {
    db.signedOrigin = 'https://elsewhere.example'
    const res = await call(uploadUrl, asRunner(recording()))
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ ok: false, error: { code: 'library_store_unavailable' } })
  })
})

describe('POST /api/library/recordings/confirm', () => {
  it('refuses when the upload did not arrive', async () => {
    const res = await call(confirm, asRunner(recording()))
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ ok: false, error: { code: 'recording_object_missing' } })
    expect(db.written).toEqual([])
  })

  it('refuses stored bytes whose MD5 differs from the one declared', async () => {
    db.objects.set(KEY, { size: BYTES, contentType: 'video/mp4', etag: `"${'f'.repeat(32)}"`, created: 1 })
    const res = await call(confirm, asRunner(recording()))
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ ok: false, error: { code: 'recording_object_conflict' } })
  })

  it('writes the manifest beside the bytes, and confirming again changes nothing', async () => {
    stored()
    const first = await call(confirm, asRunner(recording()))
    expect(first.statusCode).toBe(200)
    expect(first.body).toMatchObject({ already_listed: false, recording: { name: NAME, names: [NAME], bytes: BYTES, sha256: SHA, content_type: 'video/mp4' } })
    expect(first.body.recording).not.toHaveProperty('object_key')
    expect(db.written).toHaveLength(1)
    expect(db.written[0]).toEqual({ key: `recordings/${SHA}.json`, options: { contentType: 'application/json', upsert: true } })
    const manifest = JSON.parse(db.objects.get(`recordings/${SHA}.json`)!.body!)
    expect(manifest).toMatchObject({ schema_version: 1, sha256: SHA, md5: MD5, bytes: BYTES, object_key: KEY, names: [NAME] })
    const again = await call(confirm, asRunner(recording()))
    expect(again.body.already_listed).toBe(true)
    expect(db.written).toHaveLength(1)
  })

  it('two runner machines sending the same recording at once end with one object and one listing, and no error', async () => {
    // Krish: "just use whichever machine is online at the time? the runner exists on both".
    const primary = await call(uploadUrl, asRunner(recording()))
    const standby = await call(uploadUrl, asRunner(recording()))
    expect(primary.body.upload.url).toBe(standby.body.upload.url)
    stored() // the primary's PUT lands; the standby's is refused by storage (upsert false) and it confirms anyway
    const first = await call(confirm, asRunner(recording()))
    const second = await call(confirm, asRunner(recording()))
    expect([first.statusCode, second.statusCode]).toEqual([200, 200])
    expect(second.body.already_listed).toBe(true)
    expect([...db.objects.keys()].sort()).toEqual([`recordings/${SHA}.json`, KEY])
    const later = await call(uploadUrl, asRunner(recording()))
    expect(later.body).toMatchObject({ already_there: true, upload: null })
    const listed = await call(list, asEngine())
    expect(listed.body.recordings).toHaveLength(1)
  })

  it('keeps every name the same bytes came in under, the newest first, and the first arrival time', async () => {
    stored()
    await call(confirm, asRunner(recording({ name: 'first.mp4' })))
    const uploadedAt = JSON.parse(db.objects.get(`recordings/${SHA}.json`)!.body!).uploaded_at
    const res = await call(confirm, asRunner(recording({ name: 'renamed.mp4' })))
    expect(res.body.recording.names).toEqual(['renamed.mp4', 'first.mp4'])
    expect(res.body.recording.uploaded_at).toBe(uploadedAt)
  })
})

describe('GET /api/library/recordings', () => {
  it('takes only the engine key', async () => {
    for (const headers of [{}, { authorization: `Bearer ${RUNNER}` }]) {
      const res = await call(list, { method: 'GET', headers })
      expect(res.statusCode).toBe(401)
    }
    const post = await call(list, { method: 'POST', headers: { authorization: `Bearer ${ENGINE}` } })
    expect(post.statusCode).toBe(405)
  })

  it('lists the recordings, the newest first, each with a signed download that lasts an hour', async () => {
    const older = 'c'.repeat(64)
    stored(`recordings/${older}.mov`, 10, 'video/quicktime')
    await call(confirm, asRunner({ name: 'older.mov', sha256: older, bytes: 10 }))
    const olderManifest = JSON.parse(db.objects.get(`recordings/${older}.json`)!.body!)
    olderManifest.uploaded_at = '2026-10-05T09:00:00.000Z'
    db.objects.get(`recordings/${older}.json`)!.body = JSON.stringify(olderManifest)
    stored()
    await call(confirm, asRunner(recording()))

    const res = await call(list, asEngine())
    expect(res.statusCode).toBe(200)
    expect(res.body.recordings.map((r: any) => r.name)).toEqual([NAME, 'older.mov'])
    expect(res.body.recordings[0]).toMatchObject({ bytes: BYTES, sha256: SHA, content_type: 'video/mp4' })
    expect(res.body.recordings[0].download).toMatchObject({
      method: 'GET',
      url: `https://store.example/storage/v1/object/sign/content-library/${KEY}?token=down`,
    })
    expect(res.body.recordings[1].uploaded_at).toBe('2026-10-05T09:00:00.000Z')
    expect(res.body.skipped).toBe(0)
    expect(res.body.more).toBe(false)

    const one = await call(list, asEngine({ limit: '1' }))
    expect(one.body.recordings).toHaveLength(1)
    expect(one.body.more).toBe(true)
    const bad = await call(list, asEngine({ limit: '0' }))
    expect(bad.statusCode).toBe(400)
  })

  it('counts a manifest it cannot read, and never guesses at it', async () => {
    stored()
    db.objects.set(`recordings/${'d'.repeat(64)}.json`, { size: 3, contentType: 'application/json', body: '{"nope":1}', created: ++db.clock })
    await call(confirm, asRunner(recording()))
    const res = await call(list, asEngine())
    expect(res.body.recordings.map((r: any) => r.name)).toEqual([NAME])
    expect(res.body.skipped).toBe(1)
  })
})

describe('the bucket, shared with the asset library', () => {
  it('accepts the bucket with Matroska added by the recordings migration, and refuses any other extra type', async () => {
    db.bucket!.allowed_mime_types = [...libraryMimeTypes(), ...LIBRARY_OPTIONAL_MIME_TYPES]
    const withMkv = await call(uploadUrl, asRunner(recording()))
    expect(withMkv.statusCode).toBe(200)
    db.bucket!.allowed_mime_types = [...libraryMimeTypes(), 'application/x-msdownload']
    const odd = await call(uploadUrl, asRunner(recording()))
    expect(odd.body).toEqual({ ok: false, error: { code: 'library_store_misconfigured' } })
  })

  it('every recording type but Matroska is in the bucket from the library migration', () => {
    const library = new Set(libraryMimeTypes())
    for (const [extension, type] of Object.entries(RECORDING_CONTENT_TYPES)) {
      if (extension === 'mkv') expect(LIBRARY_OPTIONAL_MIME_TYPES).toContain(type)
      else expect(library.has(type), extension).toBe(true)
    }
  })

  it('the recordings migration adds Matroska and nothing else, and makes no table', () => {
    const sql = readFileSync('supabase/migrations/20261006180000_content_library_recordings.sql', 'utf8')
    const code = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n')
    expect(code).toContain("array['video/x-matroska']")
    expect(code).toContain("where id = 'content-library'")
    expect(code).not.toMatch(/create table|alter table|drop /i)
    expect([...code.matchAll(/'([a-z]+\/[a-z0-9.+-]+)'/g)].map((m) => m[1])).toEqual(['video/x-matroska', 'video/x-matroska'])
  })

  it('names are checked the same way the cloud tool checks them', () => {
    expect(checkRecordingName('2026-10-06 take 1.MP4')).toMatchObject({ ok: true, extension: 'mp4', contentType: 'video/mp4' })
    expect(checkRecordingName('con.mp4')).toEqual({ ok: false, refusal: 'name_reserved' })
    expect(checkRecordingName('x'.repeat(197) + '.mp4')).toEqual({ ok: false, refusal: 'name_too_long' })
  })
})
