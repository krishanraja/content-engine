import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pieceVerdict } from '../../apps/control-plane/api/_making.js'
import { matchPost, normTitle, readPosts, unmatchedItem, type Candidate } from '../../apps/control-plane/api/_publishWatch.js'

// Krish, 2026-10-11: board items "should really be chalked off automatically
// when we are done with a publish flow". The engine learns a piece went out
// from the publication's own archive and records each step on the piece;
// Control Center's done-check sweep closes the items (step 4). The engine
// closes nothing itself: a making write and a publish ask the sweep to look.

type Row = Record<string, any>
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  writes: [] as Array<[string, string, Row]>,
  /** An insert of this id is refused, as the database refuses a row its checks do not admit. */
  refuseInsert: null as null | string,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  function query(table: string) {
    const rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'update' | 'insert' = 'select'
    let payload: Row = {}
    let limit = Infinity
    // A read returns only the columns it names, as PostgREST does.
    let columns: string[] | null = null
    const pick = (r: Row) => columns ? Object.fromEntries(columns.filter(c => c in r).map(c => [c, r[c]])) : r
    const run = () => {
      if (op === 'insert' && db.refuseInsert && payload.id === db.refuseInsert) return { data: null, error: { code: '23514', message: 'new row violates check constraint "work_board_items_closes_on_check"' } }
      if (op === 'insert') { rows().push({ ...payload }); db.writes.push([table, 'insert', payload]); return { data: [payload], error: null } }
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') { hit.forEach(r => Object.assign(r, payload)); db.writes.push([table, 'update', { ...payload, ids: hit.map(h => h.id) }]); return { data: hit, error: null } }
      return { data: hit.slice(0, limit).map(pick), error: null }
    }
    const chain: Record<string, any> = {
      select(cols?: string) { if (op === 'select' && cols && cols.trim() !== '*') columns = cols.split(',').map(c => c.trim()); return chain },
      insert(row: Row) { op = 'insert'; payload = row; return chain },
      update(patch: Row) { op = 'update'; payload = patch; return chain },
      eq(k: string, v: unknown) { filters.push(r => r[k] === v); return chain },
      in(k: string, vs: unknown[]) { filters.push(r => vs.includes(r[k])); return chain },
      is(k: string, v: unknown) { filters.push(r => (r[k] ?? null) === v); return chain },
      ilike(k: string, pattern: string) { const needle = pattern.replace(/%/g, '').toLowerCase(); filters.push(r => String(r[k] ?? '').toLowerCase().includes(needle)); return chain },
      order() { return chain },
      limit(n: number) { limit = n; return chain },
      async maybeSingle() { const r = run(); return { data: (r.data as Row[])[0] ?? null, error: null } },
      async single() { const r = run(); return { data: (r.data as Row[])[0], error: null } },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) { try { return Promise.resolve(run()).then(resolve, reject) } catch (e) { return reject(e) } },
    }
    return chain
  }
  return { supabase: { from: (t: string) => query(t) } }
})

const TOKEN = 'eot_' + 'b'.repeat(40)
const CODE = 'board-close-access-code'
const COOKIE = `cc_access=${createHash('sha256').update(CODE).digest('hex')}`
const HIGGS = '9ae1a768-f32a-4533-b253-67a506bf5600'
const FRIDAY = '904658db-4df2-4537-a0ed-ebe93e081db7'

function fakeRes() {
  const out = { status: 0, body: undefined as any }
  const res: Record<string, any> = {
    setHeader() { return res },
    status(code: number) { out.status = code; return res },
    json(b: unknown) { out.body = b; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  return { out, res }
}

beforeEach(() => {
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  process.env.ACCESS_CODE = CODE
  process.env.CRON_SECRET = 'cron-secret-for-tests'
  db.tables = {
    content_ideas: [
      { id: HIGGS, idea: 'Higgsfield, taken apart: the $1bn AI video machine', state: 'drafting', published_url: null, published_at: null, buried_at: null, meta: {}, transformed_outputs: { youtube_package: { substack_title: 'Higgsfield, taken apart: the $1bn AI video machine' } }, updated_at: '2026-10-09T00:00:00Z' },
      { id: FRIDAY, idea: 'Every AI lab now sells a menu instead of a model', state: 'review', published_url: null, published_at: null, buried_at: null, meta: { fact_check: { passed: true }, making: { pack: { folder: 'f', packed_at: 'x', files: 3, headline: 'Why are there suddenly so many AIs?' }, updated_at: 'x', by: 'Claude Code' } }, transformed_outputs: {}, updated_at: '2026-10-10T00:00:00Z' },
    ],
    // Every item on Krish is ready for his list, as the database holds
    // (work_board_items_on_you_is_ready): why only he can do it, the link he
    // presses, and the piece and step that close it. The rest are in progress.
    work_board_items: [
      { id: 'you-wed-pick', lane: 'on_you', idea_id: HIGGS, closes_on: 'publish', only_you: 'post', link: 'https://claude.ai/artifact/wednesday-publish-board', title: 'Approve, record, publish' },
      { id: 'friday-record', lane: 'on_you', idea_id: FRIDAY, closes_on: 'record', only_you: 'face', link: 'https://web.descript.com/friday-record-here', title: 'Record both cuts' },
      { id: 'unrelated', lane: 'in_progress', idea_id: null, closes_on: 'session', link: null, title: 'Send the Maven email' },
    ],
  }
  db.writes = []
  db.refuseInsert = null
  asks.length = 0
  globalThis.fetch = (async (url: string, init: { headers: Record<string, string>; body?: string }) => {
    if (String(url).endsWith('/api/done-checks')) { asks.push({ url: String(url), cookie: init.headers.cookie, body: JSON.parse(init.body || '{}') }); return { ok: true, status: 200, json: async () => ({ ok: true }) } }
    return { ok: true, status: 200, json: async () => archive.posts }
  }) as never
})

/** The asks the engine sent Control Center's done-check sweep. */
const asks: Array<{ url: string; cookie: string; body: { keys: string[] } }> = []
/** What the publication's archive answers. */
const archive = { posts: [] as unknown[] }
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch; archive.posts = [] })

// The fixtures hold only shapes the database admits: an item on Krish
// carries why only he can do it, an https link, and a close with its piece
// (supabase/migrations/20261013093000_board_on_you_is_ready.sql).
const readyForHisList = (r: Row) => r.lane !== 'on_you' || Boolean(r.only_you && /^https:\/\//.test(r.link || '') && r.closes_on && (r.closes_on === 'week_planned' ? /^week-\d{4}-\d{2}-\d{2}$/.test(r.id) : r.idea_id))

describe('the fixtures', () => {
  it('seed only items the database would admit', () => {
    expect(db.tables.work_board_items.filter(r => !readyForHisList(r)).map(r => r.id)).toEqual([])
    expect(db.tables.work_board_items.filter(r => ['on_you', 'in_progress'].includes(r.lane) && !r.closes_on).map(r => r.id)).toEqual([])
  })
})

describe("whether a piece's state ends an item on one of its steps (pieceVerdict)", () => {
  const making = (channels: Record<string, unknown>) => ({ making: { workroom: { url: 'https://claude.ai/artifact/w', at: 'x' }, channels, updated_at: 'x', by: 'Krish' } })
  const substack = { substack: { url: 'https://home.makeyourmindup.ai/p/x', posted_at: 'x' } }
  it('a published piece with no making record (made before it existed) is done for every step', () => {
    expect(['record', 'publish', 'published'].map(k => pieceVerdict({ id: HIGGS, state: 'published', meta: {} }, k))).toEqual(['done', 'done', 'done'])
  })
  it('with a making record, the Substack post alone ends only "published"; the standing five end every step (Krish, 2026-10-11)', () => {
    expect(pieceVerdict({ id: FRIDAY, state: 'published', meta: making(substack) }, 'record')).toBeNull()
    expect(pieceVerdict({ id: FRIDAY, state: 'published', meta: making(substack) }, 'published')).toBe('done')
    const four = { ...substack, youtube: { posted_at: 'x' }, shorts: { posted_at: 'x' }, reels: { posted_at: 'x' }, linkedin: { posted_at: 'x' } }
    expect(pieceVerdict({ id: FRIDAY, state: 'published', meta: making(four) }, 'record')).toBeNull()
    expect(pieceVerdict({ id: FRIDAY, state: 'published', meta: making({ ...four, tiktok: { posted_at: 'x' } }) }, 'record')).toBe('done')
  })
  it("the watcher's Substack-only stamp on an old piece is not a making record, so its items still end on publish", () => {
    const stub = { making: { channels: { substack: { url: 'https://home.makeyourmindup.ai/p/higgsfield', posted_at: 'x' } }, updated_at: 'x', by: 'publish watcher' } }
    expect(pieceVerdict({ id: HIGGS, state: 'published', meta: stub }, 'record')).toBe('done')
  })
  it('"published" waits for the Substack post', () => {
    const meta = { making: { session: { url: 'https://claude.ai/code/s', started_at: 'x', by: 'Claude Code' }, channels: { substack: { posted_at: 'x' } }, updated_at: 'x', by: 'publish watcher' } }
    expect(pieceVerdict({ id: FRIDAY, state: 'review', meta }, 'published')).toBeNull()
    expect(pieceVerdict({ id: FRIDAY, state: 'published', meta }, 'published')).toBe('done')
  })
  it('a dropped, absorbed or buried piece makes its items moot; absorbed now ends one too', () => {
    expect(pieceVerdict({ id: HIGGS, state: 'dropped', meta: {} }, 'record')).toBe('moot')
    expect(pieceVerdict({ id: HIGGS, state: 'absorbed', meta: {} }, 'record')).toBe('moot')
    expect(pieceVerdict({ id: HIGGS, state: 'review', buried_at: '2026-10-12T00:00:00Z', meta: {} }, 'record')).toBe('moot')
  })
  it('an item ends on its step: record is done once both cuts are in', () => {
    const one = { id: FRIDAY, state: 'review', meta: { making: { recordings: [{ cut: 'long', path: 'a', at: 'x' }], updated_at: 'x', by: 'x' } } }
    expect(pieceVerdict(one, 'record')).toBeNull()
    const both = { ...one, meta: { making: { recordings: [{ cut: 'long', path: 'a', at: 'x' }, { cut: 'short', path: 'b', at: 'x' }], updated_at: 'x', by: 'x' } } }
    expect(pieceVerdict(both, 'record')).toBe('done')
  })
  it('a take question is not a step: the sweep ends it from where the take is, never from Record', () => {
    const both = { id: FRIDAY, state: 'review', meta: { making: { recordings: [{ cut: 'long', path: 'a', at: 'x' }, { cut: 'short', path: 'b', at: 'x' }], updated_at: 'x', by: 'x' } } }
    expect(pieceVerdict(both, 'take_placed')).toBeNull()
  })
})

describe('which piece a post is', () => {
  const pieces = () => db.tables.content_ideas as unknown as Candidate[]
  const post = (over: Record<string, unknown>) => ({ id: 1, title: '', url: 'https://home.makeyourmindup.ai/p/x', posted_at: '2026-10-07T16:06:00Z', type: 'newsletter', ...over })
  it('matches by the packaged Substack title, by the pack headline and by address', () => {
    expect(matchPost(post({ title: 'Higgsfield, taken apart: the $1bn AI video machine' }), pieces())).toMatchObject({ kind: 'one', by: 'title', piece: { id: HIGGS } })
    expect(matchPost(post({ title: 'Why are there suddenly so many AIs?' }), pieces())).toMatchObject({ kind: 'one', piece: { id: FRIDAY } })
    const withUrl = pieces().map(p => p.id === FRIDAY ? { ...p, meta: { making: { channels: { substack: { url: 'https://home.makeyourmindup.ai/p/renamed' } } } } } : p)
    expect(matchPost(post({ title: 'A title changed at the last minute', url: 'https://home.makeyourmindup.ai/p/renamed' }), withUrl)).toMatchObject({ kind: 'one', by: 'address', piece: { id: FRIDAY } })
  })
  it('a video post matches only by address, and an unknown title matches nothing', () => {
    expect(matchPost(post({ title: 'Higgsfield, taken apart: the $1bn AI video machine', type: 'podcast' }), pieces())).toEqual({ kind: 'none' })
    expect(matchPost(post({ title: 'Something else entirely' }), pieces())).toEqual({ kind: 'none' })
  })
  it('two pieces with the same title is ambiguous, never a guess', () => {
    const twins = [...pieces(), { ...pieces()[0], id: '00000000-0000-4000-8000-000000000001' }]
    expect(matchPost(post({ title: 'Higgsfield, taken apart: the $1bn AI video machine' }), twins).kind).toBe('ambiguous')
  })
  it('reads the archive and asks about an unmatched post once', () => {
    expect(readPosts([{ id: 9, title: 'T', canonical_url: 'https://a/p/t', post_date: '2026-10-07T00:00:00Z', type: 'newsletter' }, { title: 'no url' }])).toHaveLength(1)
    expect(normTitle('Why are there  suddenly so many AIs?')).toBe('why are there suddenly so many ais')
    const item = unmatchedItem({ id: 77, title: 'T', url: 'https://a/p/t', posted_at: 'x', type: 'newsletter' })
    expect(item).toMatchObject({ id: 'post-77', closes_on: 'post_matched', close_ref: { url: 'https://a/p/t' } })
    expect(item.detail).not.toMatch(/archives this item/)
  })
})

describe('the board route', () => {
  it('takes idea_id and closes_on, and refuses a bad one', async () => {
    const { default: handler } = await import('../../apps/control-plane/api/workbench.js')
    const { out, res } = fakeRes()
    await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: { action: 'upsert_items', items: [{ id: 'new-one', lane: 'on_you', title: 'Record', only_you: 'face', link: 'https://claude.ai/artifact/script', idea_id: FRIDAY, closes_on: 'record' }] } } as never, res as never)
    expect(out.status).toBe(200)
    expect(db.tables.work_board_items.find(r => r.id === 'new-one')).toMatchObject({ idea_id: FRIDAY, closes_on: 'record', updated_by: 'claude_code' })
    const bad = fakeRes()
    await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: { action: 'upsert_items', items: [{ id: 'bad-one', lane: 'on_you', title: 'x', closes_on: 'whenever' }] } } as never, bad.res as never)
    expect(bad.out.body.error).toBe('closes_on_invalid')
  })
  it("Control Center's own job is recorded as itself, not as Krish, and no one can reply", async () => {
    const { default: handler } = await import('../../apps/control-plane/api/workbench.js')
    const a = fakeRes()
    await handler({ method: 'POST', headers: { cookie: COOKIE }, query: {}, body: { action: 'upsert_items', client: 'control_center_slate', items: [{ id: 'week-2026-10-12', lane: 'on_you', title: 'Pick', only_you: 'judgment', link: 'https://controlcenter.krishraja.com/#/week', closes_on: 'week_planned' }] } } as never, a.res as never)
    expect(a.out.status).toBe(200)
    expect(db.tables.work_board_items.find(r => r.id === 'week-2026-10-12')?.updated_by).toBe('control_center_slate')
    const krish = fakeRes()
    await handler({ method: 'POST', headers: { cookie: COOKIE }, query: {}, body: { action: 'upsert_items', items: [{ id: 'unrelated', lane: 'done' }] } } as never, krish.res as never)
    expect(db.tables.work_board_items.find(r => r.id === 'unrelated')?.updated_by).toBe('Krish')
    const reply = fakeRes()
    await handler({ method: 'POST', headers: { cookie: COOKIE }, query: {}, body: { action: 'reply', client: 'control_center', item_id: 'unrelated', text: 'yes' } } as never, reply.res as never)
    expect(reply.out.status).toBe(410)
  })
})

describe('the making route asks the sweep to look, and closes nothing', () => {
  it("recording both cuts writes the step, asks Control Center to look at the piece's open items with the access cookie, and leaves the board alone", async () => {
    const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/making.js')
    const { out, res } = fakeRes()
    await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: { id: FRIDAY }, body: { recordings: [{ cut: 'long', path: 'r/long.mp4' }, { cut: 'short', path: 'r/short.mp4' }] } } as never, res as never)
    expect(out.status).toBe(200)
    expect(out.body).toMatchObject({ closed: [], looked: ['board-friday-record'] })
    expect(out.body.steps.find((s: Row) => s.key === 'record').state).toBe('done')
    expect(asks).toEqual([{ url: 'https://controlcenter.krishraja.com/api/done-checks', cookie: COOKIE, body: { keys: ['board-friday-record'] } }])
    expect(db.tables.work_board_items.find(r => r.id === 'friday-record')?.lane).toBe('on_you')
    expect(db.writes.filter(([t]) => t === 'work_board_items')).toEqual([])
  })
  it('a Control Center that cannot be reached changes nothing: the write lands and the cron looks later', async () => {
    globalThis.fetch = (async () => { throw new Error('connect ECONNREFUSED') }) as never
    const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/making.js')
    const { out, res } = fakeRes()
    await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: { id: FRIDAY }, body: { recordings: [{ cut: 'long', path: 'r/long.mp4' }] } } as never, res as never)
    expect(out.status).toBe(200)
    expect(out.body.closed).toEqual([])
  })
  it('a piece with no open item asks nothing', async () => {
    const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/making.js')
    const { out, res } = fakeRes()
    await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: { id: HIGGS }, body: { workroom: { url: 'https://claude.ai/artifact/w' } } } as never, res as never)
    expect(out.status).toBe(200)
    expect(out.body.looked).toEqual(['board-you-wed-pick'])
    db.tables.work_board_items.find(r => r.id === 'you-wed-pick')!.lane = 'done'
    const again = fakeRes()
    await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: { id: HIGGS }, body: { workroom: { url: 'https://claude.ai/artifact/w2' } } } as never, again.res as never)
    expect(again.out.body.looked).toEqual([])
    expect(asks).toHaveLength(1)
  })
})

describe('the publish watcher', () => {
  const run = async () => {
    const { default: handler } = await import('../../apps/control-plane/api/publish/watch.js')
    const { out, res } = fakeRes()
    await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: {} } as never, res as never)
    return out
  }
  it('marks the matched piece published, asks the sweep to look at its items, closes none, and holds a fresh unmatched post for a session once', async () => {
    archive.posts = [
      { id: 101, title: 'Higgsfield, taken apart: the $1bn AI video machine', canonical_url: 'https://home.makeyourmindup.ai/p/higgsfield-taken-apart-the-1bn-ai', post_date: '2026-10-07T16:06:00Z', type: 'newsletter' },
      { id: 102, title: 'VIDEO: Higgsfield deconstructed.', canonical_url: 'https://home.makeyourmindup.ai/p/higgs-video', post_date: '2026-10-07T16:09:00Z', type: 'podcast' },
      { id: 103, title: 'A fresh post nobody packed', canonical_url: 'https://home.makeyourmindup.ai/p/fresh', post_date: new Date(Date.now() - 3600_000).toISOString(), type: 'newsletter' },
    ]
    const out = await run()
    expect(out.status).toBe(200)
    expect(out.body).toMatchObject({ published: 1, held: 1 })
    expect(out.body.closed).toBeUndefined()
    expect(out.body.let_go).toBeUndefined()
    const higgs = db.tables.content_ideas.find(r => r.id === HIGGS)!
    expect(higgs).toMatchObject({ state: 'published', published_url: 'https://home.makeyourmindup.ai/p/higgsfield-taken-apart-the-1bn-ai', published_at: '2026-10-07T16:06:00Z' })
    // Higgsfield was made before the making record existed: the watcher gives it none.
    expect(higgs.meta.making).toBeUndefined()
    expect(db.tables.work_board_items.find(r => r.id === 'you-wed-pick')?.lane).toBe('on_you')
    expect(asks.map(a => a.body.keys)).toEqual([['board-you-wed-pick']])
    // Nothing Krish can press answers it, so it is a session's to work out, and it says how it ends.
    const question = db.tables.work_board_items.find(r => r.id === 'post-103')!
    expect(question).toMatchObject({ lane: 'in_progress', link: 'https://home.makeyourmindup.ai/p/fresh', updated_by: 'engine: publish watcher', closes_on: 'post_matched' })
    expect(question.only_you).toBeUndefined()
    // A second pass changes nothing it already changed, and asks nothing twice.
    question.lane = 'archived'
    const again = await run()
    expect(again.body).toMatchObject({ published: 0, held: 0 })
    expect(db.tables.work_board_items.find(r => r.id === 'post-103')?.lane).toBe('archived')
    expect(db.writes.filter(([t, op]) => t === 'work_board_items' && op === 'update')).toEqual([])
  })

  it('a question the database refuses is said once in the report, never dropped', async () => {
    archive.posts = [{ id: 104, title: 'Another post nobody packed', canonical_url: 'https://home.makeyourmindup.ai/p/another', post_date: new Date(Date.now() - 3600_000).toISOString(), type: 'newsletter' }]
    db.refuseInsert = 'post-104'
    const out = await run()
    expect(out.status).toBe(200)
    expect(out.body.held).toBe(0)
    const said = (out.body.report as Row[]).filter(r => r.post === 'https://home.makeyourmindup.ai/p/another')
    expect(said).toHaveLength(1)
    expect(said[0]).toMatchObject({ matched: null, question: 'post-104', held: false })
    expect(said[0]!.note).toMatch(/^board_write_failed: 23514 .*work_board_items_closes_on_check/)
    expect(db.tables.work_board_items.find(r => r.id === 'post-104')).toBeUndefined()
  })

  it('a piece with a making record gets the Substack tick, and its items wait for the sweep', async () => {
    db.tables.work_board_items.push({ id: 'friday-substack', lane: 'on_you', idea_id: FRIDAY, closes_on: 'published', only_you: 'post', link: 'https://substack.com/publish/post/1', title: 'Post the Substack video' })
    archive.posts = [{ id: 201, title: 'Why are there suddenly so many AIs?', canonical_url: 'https://home.makeyourmindup.ai/p/why-so-many-ais', post_date: '2026-10-16T13:00:00Z', type: 'newsletter' }]
    const out = await run()
    expect(out.body).toMatchObject({ published: 1 })
    const friday = db.tables.content_ideas.find(r => r.id === FRIDAY)!
    expect(friday.state).toBe('published')
    expect(friday.meta.making.channels.substack.url).toBe('https://home.makeyourmindup.ai/p/why-so-many-ais')
    expect(friday.meta.making.pack.folder).toBe('f')
    expect(db.tables.work_board_items.find(r => r.id === 'friday-substack')?.lane).toBe('on_you')
    expect(asks.map(a => a.body.keys.sort())).toEqual([['board-friday-record', 'board-friday-substack']])
  })

  it("a post a session recorded on a piece already published fills the piece's empty published_url, so the sweep's post_matched check sees it", async () => {
    const url = 'https://home.makeyourmindup.ai/p/a-changed-title'
    const friday = db.tables.content_ideas.find(r => r.id === FRIDAY)!
    // Published through the content-ideas PATCH with no address; a session then ran making.py <piece> posted substack <url>.
    friday.state = 'published'
    friday.meta = { ...friday.meta, making: { ...friday.meta.making, channels: { substack: { url, posted_at: '2026-10-16T13:00:00Z' } } } }
    db.tables.work_board_items.push({ id: 'post-401', lane: 'in_progress', idea_id: null, closes_on: 'post_matched', close_ref: { url }, link: url, title: 'Which piece is this post?' })
    archive.posts = [{ id: 401, title: 'A title Krish changed at the last minute', canonical_url: url, post_date: '2026-10-16T13:00:00Z', type: 'newsletter' }]
    const out = await run()
    expect(out.status).toBe(200)
    expect(friday).toMatchObject({ state: 'published', published_url: url })
    expect(friday.published_at).toBe('2026-10-16T13:00:00Z')
    // It records the address and closes nothing: the sweep ends post-401 once published_url is the post.
    expect(db.tables.work_board_items.find(r => r.id === 'post-401')!.lane).toBe('in_progress')
    expect(db.writes.filter(([t]) => t === 'work_board_items')).toEqual([])
    expect((out.body.report as Row[]).find(r => r.post === url)).toMatchObject({ piece: FRIDAY, by: 'address', written: true })
    // A second pass writes nothing more.
    const pieceWrites = () => db.writes.filter(([t]) => t === 'content_ideas').length
    const writes = pieceWrites()
    await run()
    expect(pieceWrites()).toBe(writes)
  })

  it('a piece already published under another address keeps it, and the report says so', async () => {
    const url = 'https://home.makeyourmindup.ai/p/the-post'
    const friday = db.tables.content_ideas.find(r => r.id === FRIDAY)!
    friday.state = 'published'
    friday.published_url = 'https://www.linkedin.com/posts/elsewhere'
    friday.published_at = '2026-10-15T09:00:00Z'
    friday.meta = { ...friday.meta, making: { ...friday.meta.making, channels: { substack: { url, posted_at: '2026-10-16T13:00:00Z' } } } }
    archive.posts = [{ id: 402, title: 'Another changed title', canonical_url: url, post_date: '2026-10-16T13:00:00Z', type: 'newsletter' }]
    const out = await run()
    expect(friday.published_url).toBe('https://www.linkedin.com/posts/elsewhere')
    expect(db.writes.filter(([t]) => t === 'content_ideas')).toEqual([])
    expect((out.body.report as Row[]).find(r => r.post === url)).toMatchObject({ piece: FRIDAY, by: 'address', written: false })
    expect((out.body.report as Row[]).find(r => r.post === url)!.note).toMatch(/published under another address/)
  })

  it('never lets go of a question: an old one stays for the sweep, which ends it by its kind', async () => {
    const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
    db.tables.work_board_items.push(
      { id: 'post-301', lane: 'in_progress', idea_id: null, closes_on: 'post_matched', close_ref: { url: 'https://home.makeyourmindup.ai/p/an-announcement' }, link: 'https://home.makeyourmindup.ai/p/an-announcement', title: 'Which piece is this post?', updated_at: days(8) },
      { id: 'take-aaaaaaaaaaaa', lane: 'in_progress', idea_id: null, closes_on: 'take_placed', link: null, title: 'Which piece and cut is the take "broll.mov"?', updated_at: days(8) },
    )
    const out = await run()
    expect(out.status).toBe(200)
    expect(['post-301', 'take-aaaaaaaaaaaa'].map(id => db.tables.work_board_items.find(r => r.id === id)!.lane)).toEqual(['in_progress', 'in_progress'])
    expect(db.writes.filter(([t]) => t === 'work_board_items')).toEqual([])
  })
})
