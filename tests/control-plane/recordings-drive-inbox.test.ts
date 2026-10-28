import { readFileSync } from 'node:fs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The Inbox read from Google by its folder ID (api/library/recordings/drive-inbox.ts)
// and the home computers' pass reports (api/library/recordings/lane.ts), with
// Drive, Storage and the run ledger stubbed.
//
// Krish, 2026-10-24: "Surely, the whole point of having a Google Drive is that
// there's a specific ID for a specific folder." Then, offered A or B: "A."

vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://store.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'engine@example.iam.gserviceaccount.com'
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = 'not-a-pem'
  process.env.CRON_SECRET = 'c'.repeat(40)
})

const db = vi.hoisted(() => ({
  bucket: null as null | { public: boolean; file_size_limit: number; allowed_mime_types: string[] },
  objects: new Map<string, { size: number; contentType: string; etag?: string; body?: string }>(),
  runs: [] as any[],
  copies: [] as Array<{ fileId: string; url: string }>,
  copyResult: { status: 200, sha256: '' },
  folderStatus: 200,
  files: [] as any[],
  morePages: false,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    from: (name: string) => {
      if (name === 'content_engine_runs') return { insert: (row: any) => { db.runs.push(row); return { select: () => ({ single: async () => ({ data: { id: 'run' }, error: null }) }) } } }
      if (name === 'content_engine_run_artifacts') return { insert: async () => ({ error: null }) }
      if (name === 'system_config') return { select: () => ({ in: async () => ({ data: [], error: null }) }) }
      throw new Error(`unexpected table ${name}`)
    },
    rpc: async () => ({ data: [{ allowed: true }], error: null }),
    storage: {
      getBucket: async (id: string) => ({ data: { id, name: id, ...db.bucket }, error: null }),
      from: (bucket: string) => ({
        info: async (key: string) => {
          const object = db.objects.get(key)
          return object
            ? { data: { name: key, size: object.size, contentType: object.contentType, etag: object.etag }, error: null }
            : { data: null, error: { message: 'Object not found', status: 404 } }
        },
        download: async (key: string) => {
          const object = db.objects.get(key)
          return object?.body !== undefined ? { data: new Blob([object.body]), error: null } : { data: null, error: { message: 'not found', status: 400 } }
        },
        upload: async (key: string, body: Buffer, options: any) => {
          db.objects.set(key, { size: body.length, contentType: options.contentType, body: body.toString('utf8') })
          return { data: { path: key }, error: null }
        },
        list: async (prefix: string) => ({
          data: [...db.objects.keys()].filter((key) => key.startsWith(`${prefix}/`)).map((key) => ({ name: key.slice(prefix.length + 1) })),
          error: null,
        }),
        remove: async (keys: string[]) => { for (const key of keys) db.objects.delete(key); return { data: [], error: null } },
        createSignedUploadUrl: async (key: string) => ({ data: { signedUrl: `https://store.example/storage/v1/object/upload/sign/${bucket}/${key}?token=up` }, error: null }),
      }),
    },
  },
}))

vi.mock('../../apps/control-plane/api/_google.js', () => ({
  DRIVE_READONLY_SCOPE: 'https://www.googleapis.com/auth/drive.readonly',
  googleConfigured: () => true,
  googleAccessToken: async () => 'token',
}))

vi.mock('../../apps/control-plane/api/library/_inboxDrive.js', async (original) => {
  const actual = await original<typeof import('../../apps/control-plane/api/library/_inboxDrive.js')>()
  return {
    ...actual,
    copyDriveFile: async (fileId: string, url: string, contentType: string, bytes: number) => {
      db.copies.push({ fileId, url })
      const key = new URL(url).pathname.split('/content-library/')[1]!
      db.objects.set(key, { size: bytes, contentType, etag: `"${MD5}"` })
      return db.copyResult
    },
  }
})

import driveInbox from '../../apps/control-plane/api/library/recordings/drive-inbox.js'
import lane from '../../apps/control-plane/api/library/recordings/lane.js'
import { INBOX_FOLDER_ID, INBOX_RUN_BUDGET_MS, copyFits, planInbox } from '../../apps/control-plane/api/library/_inboxDrive.js'
import { LANE_PROBLEMS, LANE_REPORT_FRESH_HOURS, lanePlainProblems, parseLaneReport } from '../../apps/control-plane/api/library/_lanes.js'
import { LIBRARY_MAX_BYTES, libraryMimeTypes } from '../../apps/control-plane/api/library/_library.js'
import { CONTENT_ENGINE_JOBS } from '../../apps/control-plane/lib/contentEngineSchedule.js'
import { JOBS } from '../../apps/control-plane/api/content-engine/_jobs.js'

class MockResponse {
  statusCode = 200
  body: any
  headers = new Map<string, unknown>()
  status(code: number) { this.statusCode = code; return this }
  json(value: unknown) { this.body = value; return this }
  setHeader(name: string, value: unknown) { this.headers.set(name.toLowerCase(), value); return this }
  end() { return this }
}

const RUNNER = 'r'.repeat(48)
process.env.VIDEO_STUDIO_RUNNER_TOKEN = RUNNER

async function call(handler: (req: VercelRequest, res: VercelResponse) => unknown, request: Record<string, unknown>) {
  const res = new MockResponse()
  await handler({ method: 'GET', headers: {}, query: {}, ...request } as unknown as VercelRequest, res as unknown as VercelResponse)
  return res
}
const asCron = { method: 'GET', headers: { authorization: `Bearer ${'c'.repeat(40)}` } }

const SHA = 'a'.repeat(64)
const MD5 = '0123456789abcdef0123456789abcdef'
const OLD = new Date(Date.now() - 60 * 60 * 1000).toISOString()
const take = (over: Record<string, unknown> = {}) => ({
  id: 'drive-file-1', name: 'Fri take 1.mp4', mimeType: 'video/mp4', size: String(300 * 1024 * 1024),
  md5Checksum: MD5, sha256Checksum: SHA, modifiedTime: OLD, ...over,
})

beforeEach(() => {
  db.bucket = { public: false, file_size_limit: LIBRARY_MAX_BYTES, allowed_mime_types: libraryMimeTypes() }
  db.objects = new Map()
  db.runs = []
  db.copies = []
  db.copyResult = { status: 200, sha256: SHA }
  db.folderStatus = 200
  db.files = [take()]
  db.morePages = false
  vi.stubGlobal('fetch', async (input: string) => {
    const url = new URL(input)
    if (url.pathname === `/drive/v3/files/${INBOX_FOLDER_ID}`) {
      return new Response(JSON.stringify(db.folderStatus === 200 ? { id: INBOX_FOLDER_ID, name: 'Inbox', mimeType: 'application/vnd.google-apps.folder', trashed: false } : { error: {} }), { status: db.folderStatus })
    }
    if (url.pathname === '/drive/v3/files') {
      expect(url.searchParams.get('q')).toBe(`'${INBOX_FOLDER_ID}' in parents and trashed = false`)
      expect(url.searchParams.get('orderBy')).toBe('modifiedTime desc')
      return new Response(JSON.stringify({ files: db.files, ...(db.morePages ? { nextPageToken: 'more' } : {}) }), { status: 200 })
    }
    throw new Error(`unexpected fetch ${input}`)
  })
})

describe('planInbox', () => {
  it('takes finished recordings with a checksum, the newest first, and says why it skips the rest', () => {
    const now = Date.now()
    const steps = planInbox([
      take({ id: 'old', modifiedTime: new Date(now - 7_200_000).toISOString() }),
      take({ id: 'new', name: 'newer.mov', modifiedTime: new Date(now - 600_000).toISOString() }),
      take({ id: 'doc', name: 'notes', mimeType: 'application/vnd.google-apps.document' }),
      take({ id: 'big', size: String(LIBRARY_MAX_BYTES + 1) }),
      take({ id: 'nosum', sha256Checksum: undefined }),
      take({ id: 'fresh', modifiedTime: new Date(now - 10_000).toISOString() }),
    ], now)
    expect(steps.map((s) => [s.file.id, s.kind === 'skip' ? s.why : 'consider'])).toEqual([
      ['fresh', 'settling'], ['new', 'consider'], ['doc', 'not_recording'], ['big', 'too_large'], ['nosum', 'no_checksum'], ['old', 'consider'],
    ])
    const considered = steps.find((s) => s.file.id === 'new')
    expect(considered?.kind === 'consider' && considered.request).toEqual({
      recording: { name: 'newer.mov', extension: 'mov', contentType: 'video/quicktime' }, sha256: SHA, md5: MD5, bytes: 300 * 1024 * 1024,
    })
  })

  it('starts a copy only when it can finish inside the run', () => {
    expect(copyFits(1_100_000_000, 0)).toBe(true)
    expect(copyFits(1_100_000_000, INBOX_RUN_BUDGET_MS - 10_000)).toBe(false)
  })
})

describe('GET /api/library/recordings/drive-inbox', () => {
  it('copies a new take into the store keyed by its sha256, with the manifest confirm writes', async () => {
    const res = await call(driveInbox, asCron)
    expect(res.body).toMatchObject({ ok: true, copied: 1, listed: 1, failed: 0 })
    expect(db.copies).toEqual([{ fileId: 'drive-file-1', url: `https://store.example/storage/v1/object/upload/sign/content-library/recordings/${SHA}.mp4?token=up` }])
    const manifest = JSON.parse(db.objects.get(`recordings/${SHA}.json`)!.body!)
    expect(manifest).toMatchObject({ schema_version: 1, sha256: SHA, md5: MD5, names: ['Fri take 1.mp4'], object_key: `recordings/${SHA}.mp4`, content_type: 'video/mp4' })
    expect(db.runs.at(-1)).toMatchObject({ job: 'recordings_drive_inbox', status: 'ok' })

    const again = await call(driveInbox, asCron)
    expect(again.body).toMatchObject({ ok: true, copied: 0, already_there: 1 })
    expect(db.copies).toHaveLength(1)
  })

  it('only adds the name when a home computer already sent the bytes', async () => {
    db.objects.set(`recordings/${SHA}.mp4`, { size: 300 * 1024 * 1024, contentType: 'video/mp4', etag: `"${MD5}"` })
    const res = await call(driveInbox, asCron)
    expect(res.body).toMatchObject({ ok: true, copied: 0, named: 1 })
    expect(db.copies).toEqual([])
  })

  it('removes bytes that do not match the sha256 Drive reported, and fails the run', async () => {
    db.copyResult = { status: 200, sha256: 'f'.repeat(64) }
    const res = await call(driveInbox, asCron)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/did not match the sha256/)
    expect(db.objects.has(`recordings/${SHA}.mp4`)).toBe(false)
    expect(db.objects.has(`recordings/${SHA}.json`)).toBe(false)
    expect(db.runs.at(-1)).toMatchObject({ status: 'failed' })
  })

  it('fails loudly, with the fix, when the folder is not shared or is gone', async () => {
    for (const status of [404, 403]) {
      db.folderStatus = status
      const res = await call(driveInbox, asCron)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/cannot be read by its ID/)
      expect(res.body.error).toMatch(/as Viewer/)
      expect(db.runs.at(-1)).toMatchObject({ job: 'recordings_drive_inbox', status: 'failed' })
    }
  })

  it('says so, newest first, when the Inbox holds more than one run lists', async () => {
    db.morePages = true
    const res = await call(driveInbox, asCron)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/more files than one run lists/)
    expect(res.body.copied).toBe(1)
  })

  it('fails, naming the machine, while a home computer reports a problem', async () => {
    const sent = await call(lane, { method: 'POST', headers: { authorization: `Bearer ${RUNNER}`, 'content-type': 'application/json' }, body: { machine: 'KRISH-PC', problems: ['inbox_env_stale'] } })
    expect(sent.body).toMatchObject({ ok: true, problems: 1 })
    const res = await call(driveInbox, asCron)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/home computer KRISH-PC has a MINDMAKE_MEDIA_INBOX setting/)
    expect(res.body.copied).toBe(1)

    await call(lane, { method: 'POST', headers: { authorization: `Bearer ${RUNNER}`, 'content-type': 'application/json' }, body: { machine: 'KRISH-PC', problems: [] } })
    expect((await call(driveInbox, asCron)).body.ok).toBe(true)
  })
})

describe('POST /api/library/recordings/lane', () => {
  it('takes only the runner bearer and only known problems', async () => {
    expect((await call(lane, { method: 'POST', headers: {}, body: { machine: 'A', problems: [] } })).statusCode).toBe(401)
    expect((await call(lane, { method: 'POST', headers: { authorization: `Bearer ${RUNNER}`, 'content-type': 'application/json' }, body: { machine: 'A', problems: ['made_up'] } })).statusCode).toBe(400)
    expect((await call(lane, { method: 'POST', headers: { authorization: `Bearer ${RUNNER}`, 'content-type': 'application/json' }, body: { machine: '../x', problems: [] } })).statusCode).toBe(400)
  })

  it('stops counting a report once it is stale: a machine that is off is not a fault', () => {
    const report = parseLaneReport({ machine: 'B', problems: ['inbox_unreachable'] }, new Date(0).toISOString())!
    expect(lanePlainProblems([report], 1000)).toHaveLength(1)
    expect(lanePlainProblems([report], LANE_REPORT_FRESH_HOURS * 3_600_000 + 1)).toEqual([])
  })
})

describe('the content watcher in the lane report', () => {
  // Krish, 2026-10-28: "i should never really need to copy and paste log files to you like this, ever, this is
  // ridiculous". The recordings pass sends the watcher's health; the engine keeps its shape and nothing else.
  it('keeps the watch block by its shape and drops anything else', () => {
    const report = parseLaneReport({
      machine: 'SURFACE', problems: ['watch_cannot_reach_engine'],
      watch: {
        last_run_at: '2026-10-26T07:59:23Z', stage: 'claim', stage_at: '2026-10-26T07:59:23Z', task_state: 'Running',
        task_result: 267009, head: '827475f', repaired: ['stopped_stuck_run', 'started_run', 'Bad Word'],
        counts: { claimed: 0, 'engine.engine_tls_untrusted': 1, 'https://x.example/reel': 1, seconds: -1, note: 'a caption' },
        message: 'a whole log line',
      },
    }, new Date(0).toISOString())!
    expect(report.problems).toEqual(['watch_cannot_reach_engine'])
    expect(report.watch).toEqual({
      last_run_at: '2026-10-26T07:59:23Z', stage: 'claim', stage_at: '2026-10-26T07:59:23Z', task_state: 'Running',
      task_result: 267009, head: '827475f', repaired: ['stopped_stuck_run', 'started_run'],
      counts: { claimed: 0, 'engine.engine_tls_untrusted': 1 },
    })
    expect(lanePlainProblems([report], 1000)).toEqual([`home computer SURFACE ${LANE_PROBLEMS.watch_cannot_reach_engine}`])
  })

  it('keeps the last six hours of runs, summed, by the same rules as the last line', () => {
    // 28 October: an Instagram post spent its three tries in five minutes; the last line said only claimed: 0.
    const report = parseLaneReport({
      machine: 'LORIMER', problems: [],
      watch: { counts: { claimed: 0 }, recent: { claimed: 2, read: 1, 'failed.other': 1, 'method.apify.blocked': 1, 'https://x.example/p': 1, 'request.error': -2 } },
    }, new Date(0).toISOString())!
    expect(report.watch?.recent).toEqual({ claimed: 2, read: 1, 'failed.other': 1, 'method.apify.blocked': 1 })
    const none = parseLaneReport({ machine: 'LORIMER', problems: [], watch: { counts: {}, recent: {} } }, new Date(0).toISOString())!
    expect(none.watch).not.toHaveProperty('recent')
  })

  it('accepts a report with no watch block, as every pass before this one sent', () => {
    expect(parseLaneReport({ machine: 'A', problems: [] }, new Date(0).toISOString())).toEqual(
      { schema_version: 1, machine: 'A', at: new Date(0).toISOString(), problems: [] })
  })

  it('gives every machine\'s last report back to the engine key, and to nothing else', async () => {
    process.env.ENGINE_OPERATOR_TOKEN = 'e'.repeat(48)
    try {
      const post = await call(lane, { method: 'POST', headers: { authorization: `Bearer ${RUNNER}`, 'content-type': 'application/json' },
        body: { machine: 'LORIMER', problems: ['watch_run_failed'], watch: { last_run_at: '2026-10-25T07:59:17Z', counts: { claimed: 0 } } } })
      expect(post.statusCode).toBe(200)
      expect((await call(lane, { method: 'GET', headers: {} })).statusCode).toBe(401)
      expect((await call(lane, { method: 'GET', headers: { authorization: `Bearer ${RUNNER}` } })).statusCode).toBe(401)
      const read = await call(lane, { method: 'GET', headers: { authorization: `Bearer ${'e'.repeat(48)}` } })
      expect(read.statusCode).toBe(200)
      expect(read.body.reports.map((r: any) => [r.machine, r.problems, r.watch?.counts])).toEqual([['LORIMER', ['watch_run_failed'], { claimed: 0 }]])
    } finally { delete process.env.ENGINE_OPERATOR_TOKEN }
  })
})

describe('one home per fact', () => {
  it('holds the Inbox ID equal to config/studio.json, and the job in every registry', () => {
    const studio = JSON.parse(readFileSync('config/studio.json', 'utf8'))
    expect(studio.drive_ids.media_inbox).toBe(INBOX_FOLDER_ID)
    expect(JOBS.recordings_drive_inbox?.path).toBe('/api/library/recordings/drive-inbox')
    expect(CONTENT_ENGINE_JOBS.some((job) => job.job === 'recordings_drive_inbox')).toBe(true)
  })
})
