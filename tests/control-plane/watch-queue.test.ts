import { describe, expect, it, vi } from 'vitest'
import {
  claim, compareRev, parseClaim, parseReadOnly, parseReport, report, writeReads,
  type ReadRow, type WatchRequestRow, type WatchStore,
} from '../../apps/control-plane/api/watch/_watch.js'

// The content-watcher queue with an in-memory store: two machines never take one link, a dead machine's claim comes
// back, three tries end in failed, and an older reading never replaces a newer one. Synthetic rows only.

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))

const NOW = new Date('2026-10-24T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()
const sha = (c: string) => c.repeat(64)
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function request(n: number, over: Partial<WatchRequestRow> = {}): WatchRequestRow {
  return {
    id: uuid(n), url: `https://www.instagram.com/reel/R${n}/`, url_key: `https://www.instagram.com/reel/R${n}/`,
    platform: 'instagram', lane: null, note: null, status: 'queued', attempts: 0, claimed_by: null, claimed_at: null,
    requested_at: minutesAgo(100 - n), ...over,
  }
}

class MemoryStore implements WatchStore {
  rows = new Map<string, WatchRequestRow & Record<string, unknown>>()
  reads = new Map<string, ReadRow & { id: string }>()
  constructor(rows: WatchRequestRow[]) { for (const r of rows) this.rows.set(r.id, { ...r }) }
  async claimable(staleBefore: string, limit: number) {
    return [...this.rows.values()]
      .filter(r => r.status === 'queued' || ((r.status === 'claimed' || r.status === 'filed') && r.claimed_at !== null && r.claimed_at < staleBefore))
      .sort((a, b) => a.requested_at.localeCompare(b.requested_at))
      .slice(0, limit)
      .map(r => ({ ...r }))
  }
  async updateIf(id: string, was: { status: string; claimed_at: string | null }, patch: Record<string, unknown>) {
    const row = this.rows.get(id)
    if (!row || row.status !== was.status || row.claimed_at !== was.claimed_at) return null
    Object.assign(row, patch)
    return { ...row }
  }
  async get(id: string) { const r = this.rows.get(id); return r ? { ...r } : null }
  async readRevs(shas: string[]) {
    const out = new Map<string, { id: string; engine_rev: string; linked: boolean }>()
    for (const s of shas) { const r = this.reads.get(s); if (r) out.set(s, { id: r.id, engine_rev: r.engine_rev, linked: r.source_url !== null }) }
    return out
  }
  async upsertReads(rows: ReadRow[]) {
    const out = new Map<string, string>()
    for (const r of rows) {
      const id = this.reads.get(r.sha256)?.id ?? `read-${this.reads.size + 1}`
      this.reads.set(r.sha256, { ...r, id })
      out.set(r.sha256, id)
    }
    return out
  }
}

const readRow = (c: string, rev = 'cw-2026.10.24'): ReadRow => ({
  sha256: sha(c), source_url: 'https://www.instagram.com/reel/R1/', platform: 'instagram', shape: 'video',
  engine_rev: rev, read: { heard: 'words', words_text: 'hi', post: null }, read_md: `# Reading ${c}`,
})
const media = [{ name: 'instagram_R1.mp4', sha256: sha('a'), mime: 'video/mp4', bytes: 10, folder: 'video_inspiration' }]

describe('claim', () => {
  it('takes the oldest queued links, raises attempts and names the machine', async () => {
    const store = new MemoryStore([request(1), request(2), request(3)])
    const out = await claim(store, 'HOME-1', 2, NOW)
    expect(out.requests.map(r => r.id)).toEqual([uuid(1), uuid(2)])
    expect(out.requests[0]).toEqual({ id: uuid(1), url: 'https://www.instagram.com/reel/R1/', url_key: 'https://www.instagram.com/reel/R1/', platform: 'instagram', lane: null, note: null, attempts: 1, media: null })
    expect(store.rows.get(uuid(1))).toMatchObject({ status: 'claimed', claimed_by: 'HOME-1', claimed_at: NOW.toISOString(), attempts: 1 })
    expect(store.rows.get(uuid(3))!.status).toBe('queued')
  })

  it('never gives one link to two machines', async () => {
    const store = new MemoryStore([request(1)])
    const [a, b] = await Promise.all([claim(store, 'HOME-1', 3, NOW), claim(store, 'HOME-2', 3, NOW)])
    expect(a.requests.length + b.requests.length).toBe(1)
  })

  it('takes back a claim a quiet machine held for over 30 minutes, and leaves a fresh one alone', async () => {
    const store = new MemoryStore([
      request(1, { status: 'claimed', claimed_by: 'HOME-1', claimed_at: minutesAgo(31), attempts: 1 }),
      request(2, { status: 'filed', claimed_by: 'HOME-1', claimed_at: minutesAgo(45), attempts: 1 }),
      request(3, { status: 'claimed', claimed_by: 'HOME-1', claimed_at: minutesAgo(5), attempts: 1 }),
    ])
    const out = await claim(store, 'HOME-2', 5, NOW)
    expect(out.requests.map(r => r.id)).toEqual([uuid(1), uuid(2)])
    expect(out.requests.every(r => r.attempts === 2)).toBe(true)
    expect(store.rows.get(uuid(3))!.claimed_by).toBe('HOME-1')
  })

  it('fails a stale claim on its third attempt as a timeout instead of trying a fourth time', async () => {
    const store = new MemoryStore([request(1, { status: 'claimed', claimed_by: 'HOME-1', claimed_at: minutesAgo(60), attempts: 3 })])
    const out = await claim(store, 'HOME-2', 3, NOW)
    expect(out.requests).toEqual([])
    expect(out.expired).toBe(1)
    expect(store.rows.get(uuid(1))).toMatchObject({ status: 'failed', status_class: 'timeout', claimed_by: null, claimed_at: null })
  })

  // Krish, 2026-10-27: "Why can't I add links into my inspiration board pre-tagged for production or content?" Control
  // Center writes his tag as lane; content-watcher files by it (production: Production Inspo, strategy: Content Inspo).
  it('leaves a link to the home computers for 15 minutes before the cloud backup may take it', async () => {
    const store = new MemoryStore([request(1, { requested_at: minutesAgo(16) }), request(2, { requested_at: minutesAgo(5) })])
    const cloud = await claim(store, 'cloud-github', 5, NOW)
    expect(cloud.requests.map(r => r.id)).toEqual([uuid(1)])
    const home = await claim(store, 'LORIMER', 5, NOW)
    expect(home.requests.map(r => r.id)).toEqual([uuid(2)])
  })

  it('hands a machine what an earlier try already filed, so a second fetch reuses it', async () => {
    const filed = [{ name: 'instagram_P1_01.jpg', sha256: sha('f'), mime: 'image/jpeg', bytes: 5, folder: 'cold_ideas' }]
    const store = new MemoryStore([request(1, { media: filed } as Partial<WatchRequestRow>), request(2)])
    const { requests } = await claim(store, 'HOME-1', 3, NOW)
    expect(requests.map(r => r.media)).toEqual([filed, null])
  })

  it('hands the home computer the tag he picked when he pasted the link, unchanged', async () => {
    const store = new MemoryStore([request(1, { lane: 'production' }), request(2, { lane: 'strategy' })])
    const out = await claim(store, 'HOME-1', 2, NOW)
    expect(out.requests.map(r => [r.id, r.lane])).toEqual([[uuid(1), 'production'], [uuid(2), 'strategy']])
  })
})

describe('report', () => {
  const claimed = (over: Partial<WatchRequestRow> = {}) => request(1, { status: 'claimed', claimed_by: 'HOME-1', claimed_at: minutesAgo(1), attempts: 1, ...over })
  const body = (over: Record<string, unknown>) => {
    const parsed = parseReport({ id: uuid(1), machine: 'HOME-1', ...over })
    if (!parsed.ok) throw new Error(parsed.error)
    return parsed.value
  }

  it('moves a claim through filed to read, linking the first file\'s reading', async () => {
    const store = new MemoryStore([claimed()])
    expect(await report(store, body({ status: 'filed', shape: 'video', media }), NOW)).toMatchObject({ ok: true, status: 'filed' })
    expect(store.rows.get(uuid(1))).toMatchObject({ status: 'filed', shape: 'video', media })
    const done = await report(store, body({ status: 'read', shape: 'video', media, reads: [readRow('a'), readRow('b')] }), NOW)
    expect(done).toMatchObject({ ok: true, status: 'read', written: 2, kept_newer: 0 })
    expect(store.rows.get(uuid(1))!.read_id).toBe(store.reads.get(sha('a'))!.id)
  })

  it('queues a failure again below three attempts, and keeps it failed at three', async () => {
    const store = new MemoryStore([claimed({ attempts: 1 })])
    expect(await report(store, body({ status: 'failed', status_class: 'login_wall' }), NOW)).toMatchObject({ ok: true, status: 'queued' })
    expect(store.rows.get(uuid(1))).toMatchObject({ status: 'queued', status_class: 'login_wall', claimed_by: null, claimed_at: null })

    const last = new MemoryStore([claimed({ attempts: 3 })])
    expect(await report(last, body({ status: 'failed', status_class: 'not_found' }), NOW)).toMatchObject({ ok: true, status: 'failed' })
    expect(last.rows.get(uuid(1))).toMatchObject({ status: 'failed', status_class: 'not_found' })
  })

  it('spaces the tries: a failed try waits 20 minutes per try before anyone takes it again', async () => {
    // 28 October: an Instagram post spent all three tries in five minutes across both home computers.
    const store = new MemoryStore([claimed({ attempts: 1 })])
    await report(store, body({ status: 'failed', status_class: 'blocked' }), NOW)
    const later = (m: number) => new Date(NOW.getTime() + m * 60_000)
    expect((await claim(store, 'HOME-2', 3, later(1))).requests).toHaveLength(0)
    expect((await claim(store, 'HOME-2', 3, later(19))).requests).toHaveLength(0)
    expect((await claim(store, 'HOME-2', 3, later(21))).requests.map(r => r.attempts)).toEqual([2])
    await report(store, { ...body({ status: 'failed', status_class: 'blocked' }), machine: 'HOME-2' } as any, later(22))
    expect((await claim(store, 'HOME-1', 3, later(50))).requests).toHaveLength(0)
    expect((await claim(store, 'HOME-1', 3, later(63))).requests.map(r => r.attempts)).toEqual([3])
  })

  it('refuses a machine that does not hold the claim, and an unknown request', async () => {
    const store = new MemoryStore([claimed()])
    const other = parseReport({ id: uuid(1), machine: 'HOME-2', status: 'failed', status_class: 'other' })
    expect(other.ok && await report(store, other.value, NOW)).toEqual({ ok: false, code: 409, error: 'not_your_claim' })
    const missing = parseReport({ id: uuid(9), machine: 'HOME-1', status: 'failed', status_class: 'other' })
    expect(missing.ok && await report(store, missing.value, NOW)).toEqual({ ok: false, code: 404, error: 'not_found' })
    const done = new MemoryStore([claimed({ status: 'read' })])
    expect(await report(done, body({ status: 'failed', status_class: 'other' }), NOW)).toEqual({ ok: false, code: 409, error: 'not_your_claim' })
  })
})

describe('readings', () => {
  it('compares engine revisions by number', () => {
    expect(compareRev('cw-2026.10.24', 'cw-2026.11.2')).toBeLessThan(0)
    expect(compareRev('cw-2026.10.24', 'cw-2026.10.24')).toBe(0)
  })

  it('never lets an older revision replace a newer reading, and rewrites the same revision', async () => {
    const store = new MemoryStore([])
    await writeReads(store, [readRow('a', 'cw-2026.11.2')])
    const older = await writeReads(store, [readRow('a', 'cw-2026.10.24'), readRow('b')])
    expect(older).toMatchObject({ written: 1, kept_newer: 1 })
    expect(store.reads.get(sha('a'))!.engine_rev).toBe('cw-2026.11.2')
    expect(older.ids.get(sha('a'))).toBe(store.reads.get(sha('a'))!.id)
    const same = await writeReads(store, [{ ...readRow('b'), read_md: 'again' }])
    expect(same.written).toBe(1)
    expect(store.reads.get(sha('b'))!.read_md).toBe('again')
  })

  it('never lets a reading of a hand-dropped file replace one made from his link, at any revision', async () => {
    // 28 October: the other home computer read his filed carousel slides as new drops and overwrote all 16.
    const store = new MemoryStore([])
    await writeReads(store, [readRow('a')])
    const drop = { ...readRow('a', 'cw-2026.11.2'), source_url: null, platform: 'own', read_md: '# Reading: own file' }
    const out = await writeReads(store, [drop])
    expect(out).toMatchObject({ written: 0, kept_newer: 1 })
    expect(store.reads.get(sha('a'))!.platform).toBe('instagram')
    expect(out.ids.get(sha('a'))).toBe(store.reads.get(sha('a'))!.id)
    // A link reading still replaces a drop reading of the same file.
    await writeReads(store, [{ ...readRow('c'), source_url: null, platform: 'own' }])
    expect((await writeReads(store, [readRow('c')])).written).toBe(1)
    expect(store.reads.get(sha('c'))!.platform).toBe('instagram')
  })
})

describe('what the routes accept', () => {
  it('checks the claim body', () => {
    expect(parseClaim({ machine: 'HOME-1' })).toEqual({ ok: true, value: { machine: 'HOME-1', limit: 3 } })
    expect(parseClaim({ machine: 'HOME 1' })).toEqual({ ok: false, error: 'invalid_machine' })
    expect(parseClaim({ machine: 'HOME-1', limit: 11 })).toEqual({ ok: false, error: 'invalid_limit' })
    expect(parseClaim('{"machine":"HOME-1","limit":2}')).toEqual({ ok: true, value: { machine: 'HOME-1', limit: 2 } })
  })

  it('checks a report: a class for a failure, media for filed, readings for read, never a message', () => {
    const base = { id: uuid(1), machine: 'HOME-1' }
    expect(parseReport({ ...base, status: 'failed' })).toEqual({ ok: false, error: 'status_class_required' })
    expect(parseReport({ ...base, status: 'failed', status_class: 'Instagram said no' })).toEqual({ ok: false, error: 'invalid_status_class' })
    expect(parseReport({ ...base, status: 'filed', shape: 'video' })).toEqual({ ok: false, error: 'filed_needs_shape_and_media' })
    expect(parseReport({ ...base, status: 'filed', shape: 'video', media: [{ ...media[0], folder: 'desktop' }] })).toEqual({ ok: false, error: 'invalid_media' })
    expect(parseReport({ ...base, status: 'filed', shape: 'video', media: [{ ...media[0], name: '../x.mp4' }] })).toEqual({ ok: false, error: 'invalid_media' })
    expect(parseReport({ ...base, status: 'read' })).toEqual({ ok: false, error: 'read_needs_reads' })
    expect(parseReport({ ...base, status: 'read', reads: [{ ...readRow('a'), read_md: 'x'.repeat(40_001) }] })).toEqual({ ok: false, error: 'invalid_reads' })
    expect(parseReport({ ...base, status: 'read', reads: [readRow('a'), readRow('a')] })).toEqual({ ok: false, error: 'invalid_reads' })
    expect(parseReport({ ...base, id: 'nope', status: 'read', reads: [readRow('a')] })).toEqual({ ok: false, error: 'invalid_id' })
  })

  it('checks a drop reading', () => {
    expect(parseReadOnly({ machine: 'HOME-1', reads: [{ ...readRow('a'), platform: 'own', source_url: null }] }).ok).toBe(true)
    expect(parseReadOnly({ machine: 'HOME-1', reads: [] })).toEqual({ ok: false, error: 'invalid_reads' })
    expect(parseReadOnly({ machine: 'HOME-1', reads: [{ ...readRow('a'), shape: 'audio' }] })).toEqual({ ok: false, error: 'invalid_reads' })
  })
})

describe('the routes sit behind guardEngine', () => {
  function call() {
    const res: { statusCode?: number; body?: unknown; headers: Record<string, string>; status: (c: number) => typeof res; json: (b: unknown) => typeof res; setHeader: (k: string, v: string) => void; end: () => typeof res } = {
      headers: {},
      status(c) { this.statusCode = c; return this },
      json(b) { this.body = b; return this },
      setHeader(k, v) { this.headers[k] = v },
      end() { return this },
    }
    return res
  }

  it('refuses a caller without the engine key, on all three', async () => {
    vi.stubEnv('ENGINE_OPERATOR_TOKEN', 'engine-key')
    const routes = {
      claim: (await import('../../apps/control-plane/api/watch/claim.js')).default,
      report: (await import('../../apps/control-plane/api/watch/report.js')).default,
      read: (await import('../../apps/control-plane/api/watch/read.js')).default,
    }
    for (const [route, handler] of Object.entries(routes)) {
      const res = call()
      await handler({ method: 'POST', headers: { authorization: 'Bearer wrong' }, body: { machine: 'HOME-1' } } as never, res as never)
      expect(res.statusCode, route).toBe(401)
    }
    vi.unstubAllEnvs()
  })

  it('answers a bad body from the key holder with a class', async () => {
    vi.stubEnv('ENGINE_OPERATOR_TOKEN', 'engine-key')
    const { default: handler } = await import('../../apps/control-plane/api/watch/claim.js')
    const res = call()
    await handler({ method: 'POST', headers: { authorization: 'Bearer engine-key' }, body: { machine: 'no spaces' } } as never, res as never)
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: 'invalid_machine' })
    vi.unstubAllEnvs()
  })
})
