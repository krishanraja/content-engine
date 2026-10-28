import { describe, expect, it, vi } from 'vitest'
import {
  WATCH_FOLDER_IDS, candidateNames, driveLiteral, parseUpload, planUpload, type DriveFile, type DriveWriter,
} from '../../apps/control-plane/api/watch/_upload.js'
import { waiting, type WatchRequestRow, type WatchStore } from '../../apps/control-plane/api/watch/_watch.js'

// The cloud backup's Drive door, with a fake Drive and an in-memory queue: only a cloud machine holding the claim
// gets an upload, the same bytes are never filed twice, a different file never takes a used name, and the peek
// claims nothing. Krish, 2026-10-28: "yes build the cloud backup". Synthetic rows only.

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))

const NOW = new Date('2026-10-28T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()
const sha = (c: string) => c.repeat(64)
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function request(n: number, over: Partial<WatchRequestRow> = {}): WatchRequestRow {
  return {
    id: uuid(n), url: `https://www.instagram.com/p/P${n}/`, url_key: `https://www.instagram.com/p/P${n}/`,
    platform: 'instagram', lane: 'strategy', note: null, status: 'claimed', attempts: 1, claimed_by: 'cloud-gh',
    claimed_at: minutesAgo(1), requested_at: minutesAgo(20), ...over,
  }
}

function store(rows: WatchRequestRow[]): WatchStore {
  const map = new Map(rows.map(r => [r.id, { ...r }]))
  return {
    async claimable(staleBefore: string, limit: number) {
      return [...map.values()]
        .filter(r => r.status === 'queued' || ((r.status === 'claimed' || r.status === 'filed') && r.claimed_at !== null && r.claimed_at < staleBefore))
        .slice(0, limit)
    },
    async updateIf() { throw new Error('the upload never changes a request') },
    async get(id: string) { return map.get(id) ?? null },
    async readRevs() { return new Map() },
    async upsertReads() { throw new Error('the upload never writes a reading') },
  }
}

class FakeDrive implements DriveWriter {
  sessions: Array<{ folderId: string; name: string; mime: string; bytes: number }> = []
  constructor(public files: DriveFile[] = []) {}
  async filesNamed(_folderId: string, names: string[]) { return this.files.filter(f => names.includes(f.name)) }
  async startUpload(folderId: string, name: string, mime: string, bytes: number) {
    this.sessions.push({ folderId, name, mime, bytes })
    return `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=U${this.sessions.length}`
  }
}

const body = (over: Record<string, unknown> = {}) => ({
  id: uuid(1), machine: 'cloud-gh', folder: 'cold_ideas', name: 'instagram_P1_1.jpg', sha256: sha('a'), bytes: 1000,
  mime: 'image/jpeg', ...over,
})
const parsed = (over: Record<string, unknown> = {}) => {
  const p = parseUpload(body(over))
  if ('error' in p) throw new Error(p.error)
  return p.value
}

describe('planUpload', () => {
  it('opens an upload in the folder the lane names, for the cloud machine holding the claim', async () => {
    const drive = new FakeDrive()
    const out = await planUpload(store([request(1)]), drive, parsed())
    expect(out).toMatchObject({ ok: true, exists: false, name: 'instagram_P1_1.jpg' })
    expect(drive.sessions).toEqual([{ folderId: WATCH_FOLDER_IDS.cold_ideas, name: 'instagram_P1_1.jpg', mime: 'image/jpeg', bytes: 1000 }])
  })

  it('files the same bytes once: a second ask answers exists and opens nothing', async () => {
    const drive = new FakeDrive([{ name: 'instagram_P1_1_v2.jpg', sha256: sha('a') }])
    const out = await planUpload(store([request(1)]), drive, parsed())
    expect(out).toEqual({ ok: true, exists: true, name: 'instagram_P1_1_v2.jpg' })
    expect(drive.sessions).toHaveLength(0)
  })

  it('never takes a name a different file holds: it moves to the next _vN, as the home computers do', async () => {
    const drive = new FakeDrive([{ name: 'instagram_P1_1.jpg', sha256: sha('b') }, { name: 'instagram_P1_1_v2.jpg', sha256: null }])
    const out = await planUpload(store([request(1)]), drive, parsed())
    expect(out).toMatchObject({ ok: true, exists: false, name: 'instagram_P1_1_v3.jpg' })
  })

  it('refuses a home computer, a machine without the claim, and an unknown request', async () => {
    const drive = new FakeDrive()
    expect(await planUpload(store([request(1, { claimed_by: 'SURFACE' })]), drive, parsed({ machine: 'SURFACE' })))
      .toEqual({ ok: false, status: 403, error: 'cloud_machines_only' })
    expect(await planUpload(store([request(1, { claimed_by: 'cloud-other' })]), drive, parsed()))
      .toEqual({ ok: false, status: 409, error: 'not_claimed_by_machine' })
    expect(await planUpload(store([request(1, { status: 'read' })]), drive, parsed()))
      .toEqual({ ok: false, status: 409, error: 'not_claimed_by_machine' })
    expect(await planUpload(store([]), drive, parsed())).toEqual({ ok: false, status: 404, error: 'not_found' })
    expect(drive.sessions).toHaveLength(0)
  })
})

describe('what the upload accepts', () => {
  it('takes only the two Inspiration folders, a plain file name, a sha256, a size and a media type', () => {
    expect(parseUpload(body()).ok).toBe(true)
    expect(parseUpload(body({ folder: 'archive' }))).toEqual({ ok: false, error: 'invalid_folder' })
    expect(parseUpload(body({ folder: 'toString' }))).toEqual({ ok: false, error: 'invalid_folder' })
    expect(parseUpload(body({ name: '../x.jpg' }))).toEqual({ ok: false, error: 'invalid_name' })
    expect(parseUpload(body({ name: 'a/b.jpg' }))).toEqual({ ok: false, error: 'invalid_name' })
    expect(parseUpload(body({ sha256: 'abc' }))).toEqual({ ok: false, error: 'invalid_sha256' })
    expect(parseUpload(body({ bytes: 0 }))).toEqual({ ok: false, error: 'invalid_bytes' })
    expect(parseUpload(body({ mime: 'application/x-msdownload' }))).toEqual({ ok: false, error: 'invalid_mime' })
    expect(parseUpload(body({ id: 'x' }))).toEqual({ ok: false, error: 'invalid_id' })
  })

  it('lists the names the home computers would try, and quotes a Drive literal safely', () => {
    expect(candidateNames('a.mp4').slice(0, 3)).toEqual(['a.mp4', 'a_v2.mp4', 'a_v3.mp4'])
    expect(candidateNames('caption')).toContain('caption_v9')
    expect(driveLiteral("it's \\ x")).toBe("'it\\'s \\\\ x'")
  })
})

describe('the peek', () => {
  it('counts what a machine could claim, after the 15-minute wait for a cloud machine, and claims nothing', async () => {
    const rows = [
      request(1, { status: 'queued', claimed_by: null, claimed_at: null, requested_at: minutesAgo(20) }),
      request(2, { status: 'queued', claimed_by: null, claimed_at: null, requested_at: minutesAgo(5) }),
    ]
    const s = store(rows)
    expect(await waiting(s, 'cloud-gh', NOW)).toBe(1)
    expect(await waiting(s, 'SURFACE', NOW)).toBe(2)
  })
})

describe('the routes sit behind guardEngine', () => {
  it('refuses a caller without the engine key on the upload and the peek', async () => {
    const { default: upload } = await import('../../apps/control-plane/api/watch/upload.js')
    const { default: claimRoute } = await import('../../apps/control-plane/api/watch/claim.js')
    for (const [route, method] of [[upload, 'POST'], [upload, 'GET'], [claimRoute, 'GET']] as const) {
      let status = 0
      const res: any = {
        setHeader() { return res }, status(code: number) { status = code; return res }, json() { return res }, end() { return res },
      }
      await route({ method, headers: {}, query: { machine: 'cloud-gh' }, body: body() } as any, res)
      expect(status).toBe(401)
    }
  })
})
