import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  INDEX_COLUMNS, LIBRARY_LEASE, LIBRARY_LEASE_MS, PROP, RESEARCH_LIBRARY_FOLDER_ID, RESEARCH_LIBRARY_INDEX_ID, SETTLE_MS, fileNameOf, inLibrary, mirror, placeOf,
  type LeaseTake, type LibraryDrive, type LibraryFile, type LibraryFolder, type LibraryIndex, type LibraryLock, type LibrarySource, type PieceInfo, type StoredMaterial,
} from '../../apps/control-plane/api/_researchLibrary'
import { copyNow, googleLibraryDrive, googleLibraryIndex, storeLease } from '../../apps/control-plane/api/_researchLibraryGoogle'
import { classifyRun } from '../../apps/control-plane/api/_runs'
import { RESEARCH_RULE, WRITE_BACK_HEAD, writeBack } from '../../apps/control-plane/api/board/_writeBack'
import { JOBS } from '../../apps/control-plane/api/content-engine/_jobs'
import { CONTENT_ENGINE_JOBS } from '../../apps/control-plane/lib/contentEngineSchedule'
import { createStoreHandler } from '../../apps/control-plane/api/content-ideas/store'

// The research library (docs/DRIVE.md, "The research library"; Ruling, Krish, 2026-11-11): every piece's research is
// copied from the piece store into his Drive, one folder per week and per piece, with a row in the index, and only ever
// added to. Run against a fake Drive that refuses anything but adding.

const ROOT = RESEARCH_LIBRARY_FOLDER_ID
const PIECE = '8287846b-6618-4a19-9fb8-23ad4eca2718'
const NOW = Date.parse('2026-11-11T17:00:00Z')
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex')
let n = 0
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

function text(content: string, over: Partial<StoredMaterial> = {}): StoredMaterial & { content: string } {
  return {
    id: uuid(), scope: PIECE, piece_id: PIECE, week: '2026-11-16', day: 'mon', material_key: `k${n}`, version: 1, kind: 'research', role: null,
    title: 'Who Pays for the AI Build-Out', note: null, sha256: sha(content), bytes: Buffer.byteLength(content), content_type: null, storage: 'text',
    text_sha256: sha(content), object_key: null, added_by: 'Krish', added_at: '2026-11-09T10:00:00Z', archived_at: null, content, ...over,
  }
}

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

class FakeDrive implements LibraryDrive {
  folderList: Array<LibraryFolder & { parent: string; trashed?: boolean }> = []
  fileList: Array<LibraryFile & { parent: string; bytes: Uint8Array; description: string; props: Record<string, string>; mime: string }> = []
  rootState: { ok: true } | { ok: false; why: string } = { ok: true }
  failCreate = 0
  readFails = false
  calls: string[] = []
  /** Each call takes this long, as Google's do, so runs started together really interleave. */
  latency = 0
  /** Called after a listing is read, with what it asked for: another writer may add a copy here. */
  onList?: (ids?: string[]) => void
  private async wait() { if (this.latency) await pause(this.latency) }
  async root() { await this.wait(); return this.rootState }
  async folders(rootId: string) {
    await this.wait()
    if (this.readFails) throw new Error('drive_list_500')
    return this.folderList.filter(f => f.props[PROP.root] === rootId && !f.trashed)
  }
  async files(rootId: string, ids?: string[]) {
    await this.wait()
    if (this.readFails) throw new Error('drive_list_500')
    const found = this.fileList.filter(f => f.props[PROP.root] === rootId && (!ids || ids.includes(f.material)))
    this.onList?.(ids)
    return found
  }
  async createFolder(parent: string, name: string, props: Record<string, string>) {
    await this.wait()
    this.calls.push(`folder ${name}`)
    const id = `folder-${this.folderList.length + 1}`
    this.folderList.push({ id, name, props, parent })
    return id
  }
  async createFile(input: { parentId: string; name: string; mime: string; bytes: Uint8Array; description: string; props: Record<string, string> }) {
    await this.wait()
    this.calls.push(`file ${input.name}`)
    if (this.failCreate > 0) { this.failCreate--; throw new Error('drive_upload_503') }
    const id = `file-${this.fileList.length + 1}`
    const f = { id, name: input.name, link: `https://drive.google.com/file/d/${id}/view`, sha256: sha(input.bytes), material: input.props[PROP.material],
      parent: input.parentId, bytes: input.bytes, description: input.description, props: input.props, mime: input.mime }
    this.fileList.push(f)
    return f
  }
}

class FakeIndex implements LibraryIndex {
  rows: string[][] = [[...INDEX_COLUMNS]]
  failAppend = false
  latency = 0
  reads = 0
  /** Called after the Material id column is read: another writer may add a row here. */
  onRead?: (read: number) => void
  async materialIds() {
    if (this.latency) await pause(this.latency)
    const ids = new Set(this.rows.slice(1).map(r => r[12]))
    this.onRead?.(++this.reads)
    return ids
  }
  async append(rows: string[][]) {
    if (this.latency) await pause(this.latency)
    if (this.failAppend) throw new Error('sheets_append_403'); this.rows.push(...rows)
  }
}

/** The lease as engine_lease_take keeps it: one holder at a time, taken when free or run out, released by its holder. */
class Lease {
  holder: string | null = null
  until = 0
  taken = 0
  refused = 0
  private n = 0
  constructor(private ms = LIBRARY_LEASE_MS) {}
  lock(who = 'writer'): LibraryLock {
    const me = `${who}:${++this.n}`
    return {
      take: async (): Promise<LeaseTake> => {
        await pause(1)
        if (this.holder && this.holder !== me && this.until > Date.now()) {
          this.refused++
          return { ok: false, held: true, holder: this.holder, until: new Date(this.until).toISOString() }
        }
        this.holder = me; this.until = Date.now() + this.ms; this.taken++
        return { ok: true, release: async () => { if (this.holder === me) { this.holder = null; this.until = 0 } } }
      },
    }
  }
  get free() { return !this.holder || this.until <= Date.now() }
}
/** A lease nobody else holds. */
const free = () => new Lease().lock('test')
/** No lease at all: every writer gets it, which is what every sweep had before 11 Nov. */
const noLease = (): LibraryLock => ({ take: async () => ({ ok: true, release: async () => undefined }) })
/** How many copies and how many index rows each material has. */
const tally = (drive: FakeDrive, index: FakeIndex) => {
  const out = new Map<string, { copies: number; rows: number }>()
  const at = (id: string) => { if (!out.has(id)) out.set(id, { copies: 0, rows: 0 }); return out.get(id)! }
  for (const f of drive.fileList) at(f.material).copies++
  for (const r of index.rows.slice(1)) at(r[12]).rows++
  return out
}

function source(materials: Array<StoredMaterial & { content?: string }>, pieces: PieceInfo[] = [{ id: PIECE, idea: 'Oracle files to sell $20B in new stock, bonds to finance AI buildout', scheduled_for: '2026-11-16', series: 'follow_the_money' }]): LibrarySource {
  return {
    async materials(only) { return materials.filter(m => !only || only.includes(m.id)) },
    async pieces(ids) { return new Map(pieces.filter(p => ids.includes(p.id)).map(p => [p.id, p])) },
    async bytes(m) { const c = (materials.find(x => x.id === m.id) as { content?: string } | undefined)?.content; return c === undefined ? null : new Uint8Array(Buffer.from(c, 'utf8')) },
  }
}

describe('what the library keeps', () => {
  it('copies research, corpus, notes and source excerpts, never links, pictures or archived material', () => {
    const base = { storage: 'text', archived_at: null, bytes: 10, role: null } as const
    for (const kind of ['research', 'corpus', 'note', 'paste']) expect(inLibrary({ ...base, kind })).toBe(true)
    for (const kind of ['image', 'screenshot', 'storyboard', 'output', 'video']) expect(inLibrary({ ...base, kind })).toBe(false)
    expect(inLibrary({ ...base, kind: 'pdf', storage: 'bucket', role: 'research' })).toBe(true)
    expect(inLibrary({ ...base, kind: 'link', storage: 'link', role: 'sources' })).toBe(false)
    expect(inLibrary({ ...base, kind: 'research', archived_at: '2026-11-10T00:00:00Z' })).toBe(false)
  })

  it('files a piece under its own week and a plain name, a day with no piece under that day, and a week under Whole week', () => {
    const m = text('x')
    const place = placeOf(m, { id: PIECE, idea: 'Oracle files to sell $20B in new stock, bonds to finance AI buildout', scheduled_for: '2026-11-16', series: 'follow_the_money' })
    expect(place.week).toBe('2026-11-16')
    expect(place.slotName).toBe('Mon 16 Nov follow.the.money - Oracle files to sell $20B in new stock, bonds to finance AI buildout (8287846b)')
    expect(placeOf(text('y', { piece_id: null, scope: 'day:2026-11-16/tue', day: 'tue' }), null).slotName).toBe('Tue 17 Nov (no piece yet)')
    expect(placeOf(text('y', { piece_id: null, scope: 'day:2026-11-16/week', day: null }), null).slotName).toBe('Whole week')
    // A piece with no date sits in the week its research was filed.
    expect(placeOf(text('z', { week: null, added_at: '2026-10-01T09:00:00Z' }), { id: PIECE, idea: 'Koa', scheduled_for: null, series: null }).week).toBe('2026-09-28')
    expect(fileNameOf(text('a', { title: 'sources.json', version: 3 }))).toBe('2026-11-09 sources (v3).json')
    expect(fileNameOf(text('a', { title: 'Notes / from the room' }))).toBe('2026-11-09 Notes - from the room.md')
  })
})

describe('the mirror, against a fake Drive', () => {
  it('copies each research document once with the store\'s exact bytes, a link back to the piece, and one index row', async () => {
    const research = text('# Who pays\nThe hyperscalers borrow.')
    const excerpt = text('"Oracle plans to raise $20B."', { kind: 'paste', title: 'reuters.com' })
    const picture = { ...text('png'), kind: 'image', storage: 'bucket', object_key: `files/${'a'.repeat(64)}.png` }
    const day = text('Tuesday notes', { piece_id: null, scope: 'day:2026-11-16/tue', day: 'tue', kind: 'note', title: 'Tuesday notes' })
    const drive = new FakeDrive(); const index = new FakeIndex()
    const r = await mirror(source([research, excerpt, picture, day]), drive, index, free(), { now: NOW })
    expect(r).toMatchObject({ ok: true, eligible: 3, mirrored: 3, already: 0, indexed: 3 })
    // One week folder, the piece and the day inside it, and Sources inside the piece.
    const folder = (name: string) => drive.folderList.find(f => f.name === name)!
    const pieceName = 'Mon 16 Nov follow.the.money - Oracle files to sell $20B in new stock, bonds to finance AI buildout (8287846b)'
    expect(drive.folderList.map(f => `${f.name} <${f.props[PROP.kind]}>`).sort()).toEqual(
      ['2026-11-16 <week>', `${pieceName} <slot>`, 'Tue 17 Nov (no piece yet) <slot>', 'Sources <sources>'].sort())
    expect(folder('2026-11-16').parent).toBe(ROOT)
    expect(folder(pieceName).parent).toBe(folder('2026-11-16').id)
    expect(folder('Tue 17 Nov (no piece yet)').parent).toBe(folder('2026-11-16').id)
    expect(folder('Sources').parent).toBe(folder(pieceName).id)
    expect(drive.folderList.every(f => f.props[PROP.root] === ROOT)).toBe(true)
    const copy = drive.fileList.find(f => f.material === research.id)!
    expect(Buffer.from(copy.bytes).toString('utf8')).toBe(research.content)
    expect(copy.sha256).toBe(research.sha256)
    expect(copy.name).toBe('2026-11-09 Who Pays for the AI Build-Out.md')
    expect(copy.mime).toBe('text/markdown')
    expect(copy.description).toContain(`material ${research.id}`)
    expect(copy.description).toContain('https://controlcenter.krishraja.com/?ui=next#/content?week=2026-11-16&day=mon')
    const sources = drive.folderList.find(f => f.name === 'Sources')!
    expect(drive.fileList.find(f => f.material === excerpt.id)!.parent).toBe(sources.id)
    expect(index.rows).toHaveLength(4)
    const row = index.rows.find(x => x[12] === research.id)!
    expect(Object.fromEntries(INDEX_COLUMNS.map((c, i) => [c, row[i]]))).toMatchObject({
      Week: '2026-11-16', Day: 'Mon', Series: 'follow.the.money', Kind: 'research', Title: 'Who Pays for the AI Build-Out', 'Date added': '2026-11-09',
      'Drive link': copy.link, sha256: research.sha256, Version: '1', 'Added by': 'Krish', 'Piece id': PIECE,
    })

    // Again: nothing is made twice, and no row is added twice.
    const again = await mirror(source([research, excerpt, picture, day]), drive, index, free(), { now: NOW })
    expect(again).toMatchObject({ ok: true, mirrored: 0, already: 3, indexed: 0 })
    expect(drive.fileList).toHaveLength(3)
    expect(index.rows).toHaveLength(4)
  })

  it('finds its folders by their properties, so Krish may rename them', async () => {
    const drive = new FakeDrive(); const index = new FakeIndex()
    await mirror(source([text('one')]), drive, index, free(), { now: NOW })
    for (const f of drive.folderList) f.name = `renamed ${f.name}`
    await mirror(source([text('two')]), drive, index, free(), { now: NOW })
    expect(drive.folderList).toHaveLength(2)
    expect(drive.fileList).toHaveLength(2)
  })

  it('a new version is a new file beside the old one, never a replacement', async () => {
    const drive = new FakeDrive(); const index = new FakeIndex()
    const v1 = text('lock v1', { material_key: 'lock', title: 'narrative-lock-mon.md', kind: 'corpus' })
    const v2 = text('lock v2', { material_key: 'lock', title: 'narrative-lock-mon.md', kind: 'corpus', version: 2, added_at: '2026-11-10T10:00:00Z' })
    await mirror(source([v1, v2]), drive, index, free(), { now: NOW })
    expect(drive.fileList.map(f => f.name)).toEqual(['2026-11-09 narrative-lock-mon.md', '2026-11-10 narrative-lock-mon (v2).md'])
  })

  it('a failed copy loses nothing: it is reported, and the next run copies it', async () => {
    const m = text('the corpus')
    const drive = new FakeDrive(); const index = new FakeIndex()
    drive.failCreate = 1
    const first = await mirror(source([m]), drive, index, free(), { now: NOW })
    expect(first.ok).toBe(false)
    expect(first.failed).toEqual([{ id: m.id, why: 'drive_upload_503' }])
    expect(index.rows).toHaveLength(1)
    const second = await mirror(source([m]), drive, index, free(), { now: NOW })
    expect(second).toMatchObject({ ok: true, mirrored: 1, indexed: 1 })
  })

  it('a copy whose row could not be written gets its row on the next run, and no second copy', async () => {
    const m = text('the corpus')
    const drive = new FakeDrive(); const index = new FakeIndex()
    index.failAppend = true
    const first = await mirror(source([m]), drive, index, free(), { now: NOW })
    expect(first).toMatchObject({ ok: false, mirrored: 1, indexed: 0 })
    expect(first.error).toMatch(/index_append_failed/)
    index.failAppend = false
    const second = await mirror(source([m]), drive, index, free(), { now: NOW })
    expect(second).toMatchObject({ ok: true, mirrored: 0, already: 1, indexed: 1 })
    expect(drive.fileList).toHaveLength(1)
  })

  it('makes nothing when the library is gone or Drive cannot be read', async () => {
    const drive = new FakeDrive(); const index = new FakeIndex()
    drive.rootState = { ok: false, why: 'the library folder is in the bin' }
    const gone = await mirror(source([text('x')]), drive, index, free(), { now: NOW })
    expect(gone).toMatchObject({ ok: false, mirrored: 0 })
    expect(gone.error).toMatch(/in the bin/)
    drive.rootState = { ok: true }; drive.readFails = true
    const unread = await mirror(source([text('y')]), drive, index, free(), { now: NOW })
    expect(unread.ok).toBe(false)
    expect(drive.calls).toEqual([])
  })

  it('refuses bytes that are not the store\'s, and leaves a young material to the write that filed it', async () => {
    const bad = { ...text('real'), content: 'tampered' }
    const young = text('just filed', { added_at: new Date(NOW - 60_000).toISOString() })
    const drive = new FakeDrive(); const index = new FakeIndex()
    const r = await mirror(source([bad, young]), drive, index, free(), { now: NOW })
    expect(r.failed).toEqual([{ id: bad.id, why: 'store_bytes_differ' }])
    expect(r.settling).toBe(1)
    expect(drive.fileList).toHaveLength(0)
    expect(SETTLE_MS).toBe(600_000)
    // The write that filed it copies it at once.
    const now = await mirror(source([bad, young]), drive, index, free(), { now: NOW, only: [young.id] })
    expect(now).toMatchObject({ ok: true, mirrored: 1, indexed: 1 })
  })

  it('a binned copy counts as copied: what Krish binned is not made again', async () => {
    const m = text('binned')
    const drive = new FakeDrive(); const index = new FakeIndex()
    await mirror(source([m]), drive, index, free(), { now: NOW })
    drive.fileList[0].trashed = true
    const r = await mirror(source([m]), drive, index, free(), { now: NOW })
    expect(r).toMatchObject({ mirrored: 0, already: 1 })
  })
})

describe('one writer at a time (11 Nov: five hand-run sweeps overlapped and copied the same research again)', () => {
  // Three materials on one piece, old enough for the sweep, and a Drive and an index that answer as slowly as Google's,
  // so runs started together really do interleave.
  const setup = () => {
    const materials = [text('one'), text('two', { kind: 'paste', title: 'reuters.com' }), text('three', { kind: 'note', title: 'Notes' })]
    const drive = new FakeDrive(); drive.latency = 2
    const index = new FakeIndex(); index.latency = 2
    return { materials, drive, index, src: source(materials) }
  }
  const once = (drive: FakeDrive, index: FakeIndex, ids: string[]) => {
    const t = tally(drive, index)
    expect([...t.keys()].sort()).toEqual([...ids].sort())
    for (const id of ids) expect(t.get(id), id).toEqual({ copies: 1, rows: 1 })
  }

  it('the race is real: two sweeps at once with no lease copy the same material twice (the test can see the fault)', async () => {
    const { materials, drive, index, src } = setup()
    await Promise.all([mirror(src, drive, index, noLease(), { now: NOW }), mirror(src, drive, index, noLease(), { now: NOW })])
    expect(drive.fileList.length).toBeGreaterThan(materials.length)
    expect([...tally(drive, index).values()].some(t => t.copies > 1)).toBe(true)
  })

  it('two sweeps at once: one copies, the other answers already_running and writes nothing; one copy and one row each', async () => {
    const { materials, drive, index, src } = setup()
    const lease = new Lease()
    const [a, b] = await Promise.all([mirror(src, drive, index, lease.lock('sweep'), { now: NOW }), mirror(src, drive, index, lease.lock('sweep'), { now: NOW })])
    const [ran, skipped] = a.skipped ? [b, a] : [a, b]
    expect(ran).toMatchObject({ ok: true, mirrored: 3, indexed: 3 })
    expect(ran.skipped).toBeUndefined()
    expect(skipped).toMatchObject({ ok: true, skipped: 'already_running', mirrored: 0, indexed: 0, already: 0, copies: [] })
    expect(skipped.lease_until).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    once(drive, index, materials.map(m => m.id))
    expect(drive.folderList.map(f => f.props[PROP.kind]).sort()).toEqual(['slot', 'sources', 'week'])
    // The run ledger records the second one as skipped, with its reason, never as a failure.
    expect(classifyRun(200, skipped, null)).toEqual({ status: 'skipped', reason: 'already_running' })
    // And the lease is free again: the next sweep runs, and finds everything copied.
    expect(lease.free).toBe(true)
    const next = await mirror(src, drive, index, lease.lock('sweep'), { now: NOW })
    expect(next).toMatchObject({ ok: true, mirrored: 0, already: 3, indexed: 0 })
    expect(next.skipped).toBeUndefined()
    once(drive, index, materials.map(m => m.id))
  })

  it('five sweeps at once, as on 11 Nov between 18:16 and 18:20 UTC: exactly one runs, and nothing is copied or listed twice', async () => {
    const { materials, drive, index, src } = setup()
    const lease = new Lease()
    const runs = await Promise.all(Array.from({ length: 5 }, () => mirror(src, drive, index, lease.lock('sweep'), { now: NOW })))
    expect(runs.filter(r => r.skipped === 'already_running')).toHaveLength(4)
    expect(runs.filter(r => !r.skipped).map(r => r.mirrored)).toEqual([3])
    expect(lease.taken).toBe(1)
    once(drive, index, materials.map(m => m.id))
    expect(drive.folderList).toHaveLength(3)
  })

  it('the write that filed a material and a sweep at once copy it once, whichever takes the lease first', async () => {
    for (const first of ['sweep', 'write'] as const) {
      const { materials, drive, index, src } = setup()
      const lease = new Lease()
      const target = materials[0]
      const sweep = () => mirror(src, drive, index, lease.lock('sweep'), { now: NOW })
      const write = () => mirror(src, drive, index, lease.lock('write'), { now: NOW, only: [target.id], lockWaitMs: 2_000, lockRetryMs: 5 })
      const [s, w] = first === 'sweep'
        ? await (async () => { const sp = sweep(); await pause(0); const wp = write(); return Promise.all([sp, wp]) })()
        : await (async () => { const wp = write(); await pause(0); const sp = sweep(); return [await sp, await wp] as const })()
      once(drive, index, first === 'sweep' ? materials.map(m => m.id) : [target.id])
      const link = drive.fileList.find(f => f.material === target.id)!.link
      if (first === 'sweep') {
        // The write waited for the sweep, then found its copy by ce_material and its row by Material id.
        expect(s).toMatchObject({ ok: true, mirrored: 3, indexed: 3 })
        expect(w).toMatchObject({ ok: true, mirrored: 0, already: 1, indexed: 0, copies: [{ material: target.id, link, created: false }] })
        expect(w.skipped).toBeUndefined()
      } else {
        // The sweep does not wait: it answers already_running, and the write copies its material.
        expect(w).toMatchObject({ ok: true, mirrored: 1, indexed: 1, copies: [{ material: target.id, link, created: true }] })
        expect(s).toMatchObject({ skipped: 'already_running', mirrored: 0 })
      }
    }
  })

  it('a write that cannot have the lease in time writes nothing and leaves the material to the next sweep', async () => {
    const { materials, drive, index, src } = setup()
    const lease = new Lease()
    const held = await lease.lock('sweep').take()
    expect(held.ok).toBe(true)
    const w = await mirror(src, drive, index, lease.lock('write'), { now: NOW, only: [materials[0].id], lockWaitMs: 30, lockRetryMs: 5 })
    expect(w).toMatchObject({ ok: true, skipped: 'already_running', mirrored: 0, copies: [] })
    expect(lease.refused).toBeGreaterThan(1)
    expect(drive.calls).toEqual([])
  })

  it('inside the lease, a copy another writer made since this run read Drive is found by ce_material and not made again', async () => {
    const { materials, drive, index, src } = setup()
    const [m] = materials
    // A writer that held no lease (an older deployment) copies m between this run's listing and its copy.
    drive.onList = ids => {
      if (ids) return
      drive.onList = undefined
      drive.fileList.push({ id: 'rogue', name: 'rogue copy', link: 'https://drive.google.com/file/d/rogue/view', sha256: m.sha256, material: m.id, parent: ROOT,
        bytes: new Uint8Array(), description: '', props: { [PROP.root]: ROOT, [PROP.material]: m.id }, mime: 'text/markdown' })
    }
    const r = await mirror(src, drive, index, free(), { now: NOW })
    expect(r).toMatchObject({ ok: true, mirrored: 2, already: 1, indexed: 3 })
    expect(r.copies.find(c => c.material === m.id)).toEqual({ material: m.id, link: 'https://drive.google.com/file/d/rogue/view', created: false })
    once(drive, index, materials.map(x => x.id))
  })

  it('inside the lease, a row another writer added since this run read the index is not added twice', async () => {
    const { materials, drive, index, src } = setup()
    const [m] = materials
    index.onRead = read => { if (read === 1) index.rows.push([...Array(12).fill(''), m.id]) }
    const r = await mirror(src, drive, index, free(), { now: NOW })
    expect(r).toMatchObject({ ok: true, mirrored: 3, indexed: 2 })
    expect(index.reads).toBe(2)
    once(drive, index, materials.map(x => x.id))
  })

  it('makes nothing when the lease cannot be had at all (its migration not applied, the database down)', async () => {
    const { drive, index, src } = setup()
    const missing: LibraryLock = { take: async () => ({ ok: false, held: false, why: 'Could not find the function public.engine_lease_take' }) }
    const r = await mirror(src, drive, index, missing, { now: NOW })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/^research_library_lock_unavailable: Could not find the function/)
    expect(drive.calls).toEqual([])
    expect(index.rows).toHaveLength(1)
    expect(classifyRun(200, r, null).status).toBe('failed')
  })

  it('a run that throws still releases the lease, and a material that is not research never asks for it', async () => {
    const { materials, drive, index } = setup()
    const lease = new Lease()
    const broken: LibrarySource = { ...source(materials), async pieces() { throw new Error('pieces_unreadable') } }
    await expect(mirror(broken, drive, index, lease.lock('sweep'), { now: NOW })).rejects.toThrow('pieces_unreadable')
    expect(lease.free).toBe(true)
    const picture = { ...text('png'), kind: 'image' }
    expect(await mirror(source([picture]), drive, index, lease.lock('write'), { now: NOW, only: [picture.id] })).toMatchObject({ ok: true, eligible: 0 })
    expect(lease.taken).toBe(1)
  })

  it('the database lease: one holder per run, the length of the lease, held and missing told apart, released by its holder', async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
    const answers: Array<{ data: unknown; error: { message: string } | null }> = [
      { data: { ok: true, lease_until: '2026-11-11T18:20:00Z' }, error: null },
      { data: null, error: null },
      { data: { ok: false, error: 'held', holder: 'sweep:x', lease_until: '2026-11-11T18:23:00Z' }, error: null },
      { data: null, error: { message: 'Could not find the function public.engine_lease_take(p_holder, p_name, p_seconds)' } },
    ]
    const db = { rpc: async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return answers.shift()! } }
    const lock = storeLease(db, 'sweep')
    const got = await lock.take()
    expect(got.ok).toBe(true)
    if (got.ok) await got.release()
    expect(calls[0]).toMatchObject({ fn: 'engine_lease_take', args: { p_name: LIBRARY_LEASE, p_seconds: LIBRARY_LEASE_MS / 1000 } })
    expect(String(calls[0].args.p_holder)).toMatch(/^sweep:[0-9a-f-]{36}$/)
    expect(calls[1]).toEqual({ fn: 'engine_lease_release', args: { p_name: LIBRARY_LEASE, p_holder: calls[0].args.p_holder } })
    expect(await lock.take()).toEqual({ ok: false, held: true, holder: 'sweep:x', until: '2026-11-11T18:23:00Z' })
    expect(await lock.take()).toMatchObject({ ok: false, held: false, why: expect.stringMatching(/Could not find the function/) })
    expect(storeLease(db, 'write')).not.toBe(lock)
  })
})

describe('the Google side only adds', () => {
  it('lists by properties, creates folders and files, appends rows, and calls nothing that renames, moves or deletes', async () => {
    const seen: Array<{ method: string; url: string; body?: string }> = []
    const f = (async (url: string, init?: { method?: string; body?: unknown }) => {
      const method = init?.method || 'GET'
      seen.push({ method, url: String(url), body: typeof init?.body === 'string' ? init.body : undefined })
      const ok = (j: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(j), { status: 200, headers })
      if (String(url).includes('/upload/drive/v3/files?uploadType=resumable')) return ok({}, { location: 'https://upload.example/session-1' })
      if (String(url) === 'https://upload.example/session-1') return ok({ id: 'f1', name: 'n', webViewLink: 'https://drive.google.com/file/d/f1/view', sha256Checksum: 'AB' })
      if (String(url).includes('/values/M%3AM')) return ok({ values: [['Material id', '00000000-0000-4000-8000-000000000001']] })
      if (String(url).includes('/files/') && method === 'GET') return ok({ id: ROOT, mimeType: 'application/vnd.google-apps.folder', trashed: false, capabilities: { canAddChildren: true } })
      if (String(url).includes('/files?') && method === 'GET') return ok({ files: [] })
      return ok({ id: 'new-folder' })
    }) as unknown as typeof fetch
    const drive = googleLibraryDrive('t', f); const index = googleLibraryIndex('t', RESEARCH_LIBRARY_INDEX_ID, f)
    expect(await drive.root(ROOT)).toEqual({ ok: true })
    await drive.folders(ROOT); await drive.files(ROOT); await drive.files(ROOT, ['m1'])
    expect(await drive.createFolder(ROOT, '2026-11-16', { [PROP.root]: ROOT })).toBe('new-folder')
    const file = await drive.createFile({ parentId: 'p', name: 'n.md', mime: 'text/markdown', bytes: new Uint8Array([1]), description: 'd', props: { [PROP.material]: 'm1' } })
    expect(file).toMatchObject({ id: 'f1', sha256: 'ab', material: 'm1' })
    expect([...await index.materialIds()]).toEqual(['00000000-0000-4000-8000-000000000001'])
    await index.append([['a']])
    expect(seen.map(s => s.method).every(m => m === 'GET' || m === 'POST' || m === 'PUT')).toBe(true)
    expect(seen.filter(s => s.method === 'PUT').map(s => s.url)).toEqual(['https://upload.example/session-1'])
    expect(seen.some(s => /addParents|removeParents|\/trash|:clear|batchUpdate/.test(s.url))).toBe(false)
    expect(seen.find(s => s.url.includes(':append'))!.url).toContain('valueInputOption=RAW&insertDataOption=INSERT_ROWS')
    expect(new URL(seen.find(s => s.url.includes('/files?') && s.url.includes('q='))!.url).searchParams.get('q')).toContain(`properties has { key='${PROP.root}' and value='${ROOT}' }`)
  })
})

describe('the write that files research copies it, and a failed copy never fails the write', () => {
  const db = (material: Record<string, unknown>) => ({
    rpc: async () => ({ data: { ok: true, duplicate: false, material }, error: null }),
    from: () => ({}),
  })
  const call = async (copy: (id: string | null) => Promise<Record<string, unknown>>) => {
    const handler = createStoreHandler(async () => db({ id: '00000000-0000-4000-8000-0000000000aa' }) as never, copy)
    let status = 0; let out: Record<string, unknown> = {}
    const res = { setHeader() {}, status(s: number) { status = s; return res }, json(b: Record<string, unknown>) { out = b; return res }, redirect() { return res }, end() { return res } }
    process.env.ENGINE_OPERATOR_TOKEN = 'k'
    await handler({ method: 'POST', query: { op: 'text' }, headers: { authorization: 'Bearer k' }, body: { week: '2026-10-12', day: 'sun', content: '# corpus', kind: 'corpus' } } as never, res as never)
    return { status, out }
  }
  it('says where the copy is', async () => {
    const seen: Array<string | null> = []
    const r = await call(async id => { seen.push(id); return { state: 'copied', link: 'https://drive.google.com/file/d/x/view' } })
    expect(r.status).toBe(201)
    expect(seen).toEqual(['00000000-0000-4000-8000-0000000000aa'])
    expect(r.out.library).toEqual({ state: 'copied', link: 'https://drive.google.com/file/d/x/view' })
  })
  it('says later, never not_research, when the engine cannot reach Drive at all', async () => {
    const saved = { e: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, k: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY }
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL; delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    try {
      expect(await copyNow('00000000-0000-4000-8000-0000000000aa')).toMatchObject({ state: 'later' })
      expect(await copyNow(null)).toEqual({ state: 'later', why: 'no_material' })
    } finally {
      if (saved.e !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = saved.e
      if (saved.k !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = saved.k
    }
  })
  it('still files it when the copy throws', async () => {
    const r = await call(async () => { throw new Error('drive down') })
    expect(r.status).toBe(201)
    expect(r.out.ok).toBe(true)
    expect(r.out.library).toEqual({ state: 'later', why: 'copy_failed' })
  })
})

describe('the rule every session follows, and where the library is', () => {
  it('the write-back block and the plan-week, make-piece and produce-video skills (both copies) say research goes on the piece', () => {
    const flat = (s: string) => s.replace(/\s+/g, ' ')
    expect(RESEARCH_RULE).toMatch(/never left in scratch or a chat/)
    expect(RESEARCH_RULE).toMatch(/when Krish sends a Markdown file, file it on the piece first/)
    const block = writeBack({ pieceId: PIECE, week: '2026-11-16', day: 'mon', step: 'board' })
    expect(block.startsWith(WRITE_BACK_HEAD)).toBe(true)
    expect(block).toContain(RESEARCH_RULE)
    for (const skill of ['plan-week', 'make-piece', 'produce-video']) {
      for (const root of ['.agents', '.claude']) {
        const text = flat(readFileSync(`${root}/skills/${skill}/SKILL.md`, 'utf8'))
        expect(text, `${root}/skills/${skill}`).toContain(RESEARCH_RULE)
      }
    }
  })

  it('the library and its index are named once, in code, config and the map alike, and the sweep is scheduled', () => {
    const config = JSON.parse(readFileSync('config/research-library.json', 'utf8'))
    expect(config.folder_id).toBe(RESEARCH_LIBRARY_FOLDER_ID)
    expect(config.index_id).toBe(RESEARCH_LIBRARY_INDEX_ID)
    const map = readFileSync('docs/DRIVE.md', 'utf8')
    expect(map).toContain(RESEARCH_LIBRARY_FOLDER_ID)
    expect(map).toContain(RESEARCH_LIBRARY_INDEX_ID)
    expect(map).toContain('## The research library')
    const vercel = JSON.parse(readFileSync('apps/control-plane/vercel.json', 'utf8'))
    expect(vercel.crons.some((c: { path: string }) => c.path === '/api/research-library/sweep')).toBe(true)
    expect(JOBS.research_library_mirror.path).toBe('/api/research-library/sweep')
    // The lease the code asks for is the one the migration makes, and its name passes the table's own check.
    const sql = readFileSync('supabase/migrations/20261127100000_engine_leases.sql', 'utf8')
    expect(sql).toMatch(/create or replace function public\.engine_lease_take\(p_name text, p_holder text, p_seconds integer\)/)
    expect(sql).toMatch(/create or replace function public\.engine_lease_release\(p_name text, p_holder text\)/)
    expect(sql).toMatch(/grant execute on function public\.engine_lease_take\(text, text, integer\) to service_role;/)
    expect(LIBRARY_LEASE).toMatch(/^[a-z][a-z0-9_.:/-]{1,119}$/)
    expect(LIBRARY_LEASE_MS / 1000).toBeGreaterThan(120)
    expect(CONTENT_ENGINE_JOBS.find(j => j.job === 'research_library_mirror')?.path).toBe('/api/research-library/sweep')
  })
})
