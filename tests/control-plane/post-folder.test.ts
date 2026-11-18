import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  // _library.ts loads the Supabase client: a dead local address, so nothing here can reach a real database.
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { boundPostFolder, mergeMaking, parseMakingPatch, postFolderProblems, type Making } from '../../apps/control-plane/api/_making'
import {
  GOT_ROLE, PostFolderError, beatsOf, beatsOfKey, bindPostFolder, driveName, fileToPostFolder, folderForPiece, gotKey, postFolderName, safeText, shorten,
} from '../../apps/control-plane/api/_postFolder'
import { GOT_ROLE as ROUTE_GOT_ROLE, confirmGot, sentByOf } from '../../apps/control-plane/api/content-ideas/store'
import { gotBrief, planView, type ProductionPlan } from '../../apps/control-plane/api/board/_productionPlan'
import { checkLibraryPath } from '../../apps/control-plane/api/library/_library'

// One piece, one folder in his Drive, and every file he gets himself filed there (Krish, 2026-11-18: "when I drop stuff in
// there, it needs to be filed properly in my Drive in the right place, so its easily accessible later on. every resource
// along the way for a single piece needs to be bound to the piece in a bullet proof way").

type Body = Record<string, any>
const TUE = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
const CASES = JSON.parse(readFileSync(new URL('../../config/library-paths.cases.json', import.meta.url), 'utf8')) as { post_folders: Body[] }

describe('the folder is named exactly as scripts/post-pack/library.py names it', () => {
  for (const c of CASES.post_folders) {
    it(c.why, () => {
      const run = () => postFolderName({ date: c.date, subject: c.subject, subchannel: c.subchannel ?? null, launch: Boolean(c.launch), day: c.day ?? null })
      if (c.error) expect(run).toThrow(PostFolderError)
      else expect(run()).toBe(c.folder)
    })
  }
  it('safe text and the cut at a space match archive.py', () => {
    expect(safeText('  What: a "test"?.  ')).toBe('What a test')
    expect(shorten('one two three', 9)).toBe('one two')
    expect(shorten('abcdefghijk', 5)).toBe('abcde')
  })
  it('a piece on a day with no series is off.day; its working title names it, else its idea', () => {
    expect(folderForPiece({ scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap', idea: 'Where does AI get built when towns say no?', meta: {} }))
      .toBe('2026-11-17 Tue off.day - Where does AI get built when towns say no')
    expect(folderForPiece({ scheduled_for: '2026-11-18', lane_slot: 'under_the_hood', idea: 'The labs', meta: { working_title: 'Labs on Salesforce' } }))
      .toBe('2026-11-18 Wed under.the.hood - Labs on Salesforce')
    expect(() => folderForPiece({ scheduled_for: null, idea: 'x' })).toThrow('no day yet')
  })
})

describe('the binding on the making record', () => {
  const now = '2026-11-18T10:00:00Z'
  it('the first pack binds the folder; a later pack under another name is refused, the same name passes', () => {
    const first = mergeMaking(null, { pack: { folder: '2026-11-18 Wed under.the.hood - A', packed_at: now, files: 3 } }, 'Claude Code', now)
    expect(first.post_folder).toEqual({ folder: '2026-11-18 Wed under.the.hood - A', bound_at: now, by: 'Claude Code' })
    expect(postFolderProblems(first, { pack: { folder: '2026-11-18 Wed under.the.hood - B', packed_at: now, files: 1 } })[0]).toMatch(/bound to the post folder "2026-11-18 Wed under.the.hood - A"/)
    expect(postFolderProblems(first, { pack: { folder: '2026-11-18 Wed under.the.hood - A', packed_at: now, files: 4 } })).toEqual([])
  })
  it('a writer binds or reads it through the making route: a post folder name only, and the binding already there wins', () => {
    expect(parseMakingPatch({ post_folder: { folder: 'my folder' } }, now).problems[0]).toMatch(/post_folder needs/)
    expect(parseMakingPatch({ post_folder: { folder: '2026-11-17 Tue off.day - What?' } }, now).problems).toHaveLength(1)
    const p = parseMakingPatch({ post_folder: { folder: '2026-11-17 Tue off.day - Data centres' }, by: 'Claude Code' }, now).patch
    expect(p.post_folder).toEqual({ folder: '2026-11-17 Tue off.day - Data centres', bound_at: now, by: 'Claude Code' })
    const held = mergeMaking(mergeMaking(null, p, 'Claude Code', now), parseMakingPatch({ post_folder: { folder: '2026-11-17 Tue off.day - Other' } }, now).patch, 'x', now)
    expect(boundPostFolder(held)).toBe('2026-11-17 Tue off.day - Data centres')
  })

  it('a binding is never moved by a later binding or pack, and a record from before it binds its pack folder', () => {
    const bound = mergeMaking(null, { post_folder: { folder: 'X', bound_at: now, by: 'Krish' } }, 'Krish', now)
    expect(mergeMaking(bound, { post_folder: { folder: 'Y', bound_at: now, by: 'Krish' } }, 'Krish', now).post_folder?.folder).toBe('X')
    const legacy = { pack: { folder: 'OLD', packed_at: '2026-11-01T00:00:00Z', files: 2 }, updated_at: now, by: 'Claude Code' } as Making
    expect(boundPostFolder(legacy)).toBe('OLD')
    expect(mergeMaking(legacy, { session: { url: 'https://x.y', by: 'c' } as never }, 'c', now).post_folder?.folder).toBe('OLD')
  })
})

// A fake of the narrow client: content_ideas with the updated_at guard, content_library_files, the store's RPC and bucket.
function fakeDb(opts: { races?: number; making?: Body; libraryRows?: Body[] } = {}) {
  const rows = new Map<string, Body>([[TUE, { id: TUE, idea: 'Where does AI get built when towns say no?', scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap',
    meta: { making: opts.making ?? { by: 'x', updated_at: '2026-11-17T00:00:00Z' }, working_title: 'Where does AI get built when towns say no?' }, updated_at: 't0' }]])
  const library: Body[] = [...(opts.libraryRows ?? [])]
  const stored: Body[] = []
  const objects = new Map<string, Buffer>()
  let races = opts.races ?? 0
  const db: any = {
    rows, library, stored, objects,
    rpc: async (fn: string, args: Body) => {
      if (fn === 'board_material_put') { const p = args.p as Body; const dup = stored.find(m => m.material_key === p.material_key && m.sha256 === p.sha256); if (dup) return { data: { ok: true, duplicate: true, material: dup }, error: null }
        const m = { id: `m${stored.length}`, version: 1, scope: p.piece_id, ...p }; stored.push(m); return { data: { ok: true, duplicate: false, material: m }, error: null } }
      return { data: null, error: { message: 'unknown' } }
    },
    from: (table: string) => {
      const f: Body = {}; let patch: Body | null = null; let up: Body | null = null
      const q: any = {
        select: () => q, eq: (c: string, v: unknown) => { f[c] = v; return q }, in: () => q, like: () => q,
        update: (p: Body) => { patch = p; return q }, upsert: (p: Body) => { up = p; return q },
        maybeSingle: async () => ({ data: table === 'content_ideas' ? rows.get(String(f.id)) ?? null : null, error: null }),
        then: (ok: (r: unknown) => unknown) => {
          if (table === 'content_library_files') {
            if (up) { if (!library.some(r => r.path === up!.path && r.sha256 === up!.sha256)) library.push(up); return Promise.resolve({ data: null, error: null }).then(ok) }
            if (patch) { for (const r of library) if (r.path === f.path && r.sha256 === f.sha256) Object.assign(r, patch); return Promise.resolve({ data: null, error: null }).then(ok) }
            return Promise.resolve({ data: library.filter(r => (f.path === undefined || r.path === f.path)), error: null }).then(ok)
          }
          const row = rows.get(String(f.id))
          if (!patch || !row) return Promise.resolve({ data: [], error: null }).then(ok)
          if (races > 0) { races--; row.updated_at = `t${Math.random()}` }
          if (f.updated_at !== row.updated_at) return Promise.resolve({ data: [], error: null }).then(ok)
          rows.set(row.id, { ...row, ...patch, updated_at: `t${Math.random()}` })
          return Promise.resolve({ data: [{ id: row.id }], error: null }).then(ok)
        },
      }
      return q
    },
    storage: { from: () => ({ createSignedUrl: async (key: string) => (objects.has(key) ? { data: { signedUrl: `mem://${key}` }, error: null } : { data: null, error: {} }) }) },
  }
  const fetcher = async (url: string) => {
    const b = objects.get(url.replace('mem://', ''))!
    return { ok: true, body: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(b)); c.close() } }) }
  }
  return { db, fetcher }
}

describe('a file he drops is bound to the piece and filed in its Drive folder', () => {
  const bill = Buffer.from('a photo of his electricity bill')
  const sha = createHash('sha256').update(bill).digest('hex')
  const md5 = createHash('md5').update(bill).digest('hex')
  const FOLDER = '2026-11-17 Tue off.day - Where does AI get built when towns say no'

  it('binds the folder once, under the updated_at guard, even when another write lands in between', async () => {
    const { db } = fakeDb({ races: 2 })
    expect(await bindPostFolder(db, TUE, 'Krish')).toEqual({ folder: FOLDER, bound: 'now' })
    expect(db.rows.get(TUE).meta.making.post_folder).toMatchObject({ folder: FOLDER, by: 'Krish' })
    expect(db.rows.get(TUE).meta.working_title).toBeTruthy() // the rest of meta is kept
    expect(await bindPostFolder(db, TUE, 'Claude Code')).toEqual({ folder: FOLDER, bound: 'already' })
  })

  it('a piece whose pack already made a folder keeps it', async () => {
    const { db } = fakeDb({ making: { pack: { folder: '2026-11-17 Tue off.day - Data centres', packed_at: 'x', files: 2 }, by: 'x', updated_at: 'x' } })
    expect(await bindPostFolder(db, TUE, 'Krish')).toEqual({ folder: '2026-11-17 Tue off.day - Data centres', bound: 'already' })
  })

  it('drop to Drive: a material on the piece keyed by its beats, and a ready library row in 3 Video/Your materials', async () => {
    const { db, fetcher } = fakeDb()
    db.objects.set(`files/${sha}.jpg`, bill)
    const r = await confirmGot(db, { piece_id: TUE, name: 'IMG_0412.jpg', sha256: sha, bytes: bill.length, role: GOT_ROLE, beats: ['s8', 'L9'], for: 'A photo of your own electricity bill' }, false, 'Krish', new Date('2026-11-18T10:00:00Z'), fetcher as never)
    expect(r.material).toMatchObject({ role: GOT_ROLE, material_key: gotKey(['s8', 'l9'], sha), kind: 'image', added_by: 'Krish' })
    expect(String((r.material as Body).note)).toContain(`beat s8, l9: A photo of your own electricity bill. In his Drive: 3 Posts/${FOLDER}/3 Video/Your materials.`)
    expect(r.drive).toEqual({ state: 'filed', path: `3 Posts/${FOLDER}/3 Video/Your materials/S8 L9 - IMG_0412.jpg`, folder: FOLDER })
    expect(db.library[0]).toMatchObject({ library: 'makeyourmindup', sha256: sha, md5, bytes: bill.length, content_type: 'image/jpeg', object_key: `files/${sha}.jpg`, state: 'ready', sent_by: 'Krish' })
    expect(checkLibraryPath(db.library[0].path).ok).toBe(true)
    // The same drop again is the same material and the same row.
    const again = await confirmGot(db, { piece_id: TUE, name: 'IMG_0412.jpg', sha256: sha, bytes: bill.length, role: GOT_ROLE, beats: 's8 l9' }, false, 'Krish', new Date(), fetcher as never)
    expect(again.duplicate).toBe(true)
    expect(again.drive).toMatchObject({ state: 'already' })
    expect(db.library).toHaveLength(1)
  })

  it('another file already at the name gets the next name, never over his first file', async () => {
    const { db, fetcher } = fakeDb({ libraryRows: [{ path: `3 Posts/${FOLDER}/3 Video/Your materials/S8 - bill.jpg`, sha256: 'e'.repeat(64), state: 'ready' }] })
    db.objects.set(`files/${sha}.jpg`, bill)
    const r = await confirmGot(db, { piece_id: TUE, name: 'bill.jpg', sha256: sha, bytes: bill.length, role: GOT_ROLE, beats: ['s8'] }, false, 'Krish', new Date(), fetcher as never)
    expect((r.drive as Body).path).toBe(`3 Posts/${FOLDER}/3 Video/Your materials/S8 - bill (2).jpg`)
  })

  it('a video is filed beside the cuts; a file type the library refuses is refused before anything is stored', async () => {
    const { db, fetcher } = fakeDb()
    db.objects.set(`files/${sha}.mp4`, bill)
    const r = await confirmGot(db, { piece_id: TUE, name: 'offer screen.mp4', sha256: sha, bytes: bill.length, role: GOT_ROLE, beats: [] }, false, 'Krish', new Date(), fetcher as never)
    expect((r.drive as Body).path).toBe(`3 Posts/${FOLDER}/3 Video/Your materials/offer screen.mp4`)
    await expect(confirmGot(db, { piece_id: TUE, name: 'thing.exe', sha256: sha, bytes: 3, role: GOT_ROLE }, false, 'Krish', new Date(), fetcher as never)).rejects.toThrow('file_type_not_allowed')
  })

  it('a piece with no day yet keeps the file on the piece and says why it is not in Drive', async () => {
    const { db, fetcher } = fakeDb()
    db.rows.get(TUE).scheduled_for = null
    db.objects.set(`files/${sha}.jpg`, bill)
    const r = await confirmGot(db, { piece_id: TUE, name: 'bill.jpg', sha256: sha, bytes: bill.length, role: GOT_ROLE }, false, 'Krish', new Date(), fetcher as never)
    expect(r.material).toMatchObject({ role: GOT_ROLE })
    expect(r.drive).toMatchObject({ state: 'held' })
    expect(db.library).toHaveLength(0)
  })

  it('names fit the library: beats first, long names cut, the sender a name the library takes', () => {
    expect(driveName('F', 'Screenshot 2026-11-18 at 10.42.11.png', ['s17', 'l26'], 'png')).toBe('S17 L26 - Screenshot 2026-11-18 at 10.42.11.png')
    const long = driveName('2026-11-17 Tue off.day - ' + 'x'.repeat(75), 'y'.repeat(120) + '.pdf', ['s8'], 'pdf')
    expect(checkLibraryPath(`3 Posts/2026-11-17 Tue off.day - ${'x'.repeat(75)}/3 Video/Your materials/${long}`).ok).toBe(true)
    expect(beatsOf('s8, L9 + bad beat!')).toEqual(['s8', 'l9', 'bad'])
    expect(beatsOfKey(gotKey(['s8', 'l9'], sha))).toEqual(['s8', 'l9'])
    expect(beatsOfKey(gotKey([], sha))).toEqual([])
    expect(beatsOfKey('meta:abc')).toBeNull()
    expect(sentByOf('Claude Code')).toBe('Claude_Code')
    expect(sentByOf('42')).toBe('Krish')
    expect(ROUTE_GOT_ROLE).toBe(GOT_ROLE)
  })
})

describe('the plan shows his files and the prompt names them', () => {
  const plan: ProductionPlan = {
    version: 1, piece_id: TUE, made_at: '2026-11-18T12:00:00Z', takes: [], sha256: 'a'.repeat(64),
    edit: { raw_seconds: 80, restarts: [], silences_cut: 2, kept_seconds: 78, cap_seconds: 90, speed: 1, final_seconds: 78, over_cap: false }, edit_long: null,
    style: { look: null, motion: null, captions: null }, scenes: [], humour: [],
    beats: [{ id: 's8', from: 0, to: 4, words: 'your share', picture: { id: 'bill', kind: 'real_image', what: 'His bill', source: null, recipe: null }, options: [], humour: null },
      { id: 's17', from: 4, to: 8, words: 'three times', picture: { id: 'offers', kind: 'screenshot', what: 'The offers', source: null, recipe: null }, options: [], humour: null }],
    fetch: [{ beat: 's8', what: 'A photo of your bill', why: 'Real paper' }, { beat: 's17', what: 'Three offer screenshots', why: 'Proof' }],
    folder: 'F', got: [{ id: 'm1', title: 'IMG_0412.jpg', kind: 'image', content_type: 'image/jpeg', beats: ['s8'], at: null, drive: { state: 'in_drive', path: '3 Posts/F/3 Video/Your materials/S8 - IMG_0412.jpg' } }],
  }
  it('each fetch carries the files for its beat, and the view carries them all with the folder', () => {
    const v = planView(plan, { picks: [], run: null, now: new Date() }) as Body
    expect(v.fetch[0].got.map((g: Body) => g.id)).toEqual(['m1'])
    expect(v.fetch[1].got).toEqual([])
    expect(v.got).toHaveLength(1)
    expect(v.folder).toBe('F')
  })
  it('the prompt names each file by its material id, says where they are in Drive, and what is still to get', () => {
    const b = gotBrief(plan)
    expect(b).toContain('s8: "IMG_0412.jpg" (material m1, image)')
    expect(b).toContain('in 3 Posts/F/3 Video/Your materials')
    expect(b).toContain('Still to get: s17')
    expect(gotBrief({ ...plan, got: [] })).toBe('')
  })
})
