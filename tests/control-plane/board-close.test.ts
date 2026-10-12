import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { itemPiece, itemsToClose } from '../../apps/control-plane/api/_boardClose.js'
import { matchPost, normTitle, readPosts, unmatchedItem, type Candidate } from '../../apps/control-plane/api/_publishWatch.js'

// Krish, 2026-10-11: board items "should really be chalked off automatically
// when we are done with a publish flow". Items follow their piece, and the
// engine learns a piece went out from the publication's own archive.

type Row = Record<string, any>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as Array<[string, string, Row]> }))

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
      { id: 'old-link-item', lane: 'in_progress', idea_id: null, closes_on: null, link: `https://controlcenter.krishraja.com/#/content?idea=${HIGGS}`, title: 'Linked the old way' },
      { id: 'friday-record', lane: 'on_you', idea_id: FRIDAY, closes_on: 'record', only_you: 'face', link: 'https://web.descript.com/friday-record-here', title: 'Record both cuts' },
      { id: 'unrelated', lane: 'in_progress', idea_id: null, closes_on: null, link: null, title: 'Send the Maven email' },
    ],
  }
  db.writes = []
})

// The fixtures hold only shapes the database admits: an item on Krish
// carries why only he can do it, an https link, and a close with its piece
// (supabase/migrations/20261013093000_board_on_you_is_ready.sql).
const readyForHisList = (r: Row) => r.lane !== 'on_you' || Boolean(r.only_you && /^https:\/\//.test(r.link || '') && r.closes_on && (r.closes_on === 'week_planned' ? /^week-\d{4}-\d{2}-\d{2}$/.test(r.id) : r.idea_id))

describe('the fixtures', () => {
  it('seed only items the database would admit', () => {
    expect(db.tables.work_board_items.filter(r => !readyForHisList(r)).map(r => r.id)).toEqual([])
  })
})

describe('which items a piece closes', () => {
  const items = () => db.tables.work_board_items as any[]
  it('a published piece with no making record (made before it existed) closes every item tied to it, by column or by link, and nothing else', () => {
    const closes = itemsToClose(items(), { id: HIGGS, state: 'published', meta: {} })
    expect(closes.map(c => [c.id, c.lane, c.by])).toEqual([['you-wed-pick', 'done', 'engine: piece published'], ['old-link-item', 'done', 'engine: piece published']])
  })
  it('with a making record, the Substack post alone closes nothing; the standing five close every item (Krish, 2026-10-11)', () => {
    const substack = { substack: { url: 'https://home.makeyourmindup.ai/p/x', posted_at: 'x' } }
    const making = (channels: Record<string, unknown>) => ({ making: { workroom: { url: 'https://claude.ai/artifact/w', at: 'x' }, channels, updated_at: 'x', by: 'Krish' } })
    expect(itemsToClose(items(), { id: FRIDAY, state: 'published', meta: making(substack) })).toEqual([])
    const four = { ...substack, youtube: { posted_at: 'x' }, shorts: { posted_at: 'x' }, reels: { posted_at: 'x' }, linkedin: { posted_at: 'x' } }
    expect(itemsToClose(items(), { id: FRIDAY, state: 'published', meta: making(four) })).toEqual([])
    const five = { ...four, tiktok: { posted_at: 'x' } }
    expect(itemsToClose(items(), { id: FRIDAY, state: 'published', meta: making(five) })).toEqual([{ id: 'friday-record', lane: 'done', by: 'engine: piece published' }])
  })
  it("the watcher's Substack-only stamp on an old piece is not a making record, so its items still close on publish", () => {
    const stub = { making: { channels: { substack: { url: 'https://home.makeyourmindup.ai/p/higgsfield', posted_at: 'x' } }, updated_at: 'x', by: 'publish watcher' } }
    const closes = itemsToClose(items(), { id: HIGGS, state: 'published', meta: stub })
    expect(closes.map(c => c.id)).toEqual(['you-wed-pick', 'old-link-item'])
  })
  it('an item that closes_on "published" closes on the Substack post, before the reposts', () => {
    const list = [...items(), { id: 'friday-substack', lane: 'on_you', idea_id: FRIDAY, closes_on: 'published', only_you: 'post', link: 'https://substack.com/publish/post/1' }]
    const meta = { making: { session: { url: 'https://claude.ai/code/s', started_at: 'x', by: 'Claude Code' }, channels: { substack: { posted_at: 'x' } }, updated_at: 'x', by: 'publish watcher' } }
    expect(itemsToClose(list, { id: FRIDAY, state: 'review', meta })).toEqual([])
    expect(itemsToClose(list, { id: FRIDAY, state: 'published', meta })).toEqual([{ id: 'friday-substack', lane: 'done', by: 'engine: piece published' }])
  })
  it('a dropped piece archives its items', () => {
    expect(itemsToClose(items(), { id: HIGGS, state: 'dropped', meta: {} }).map(c => c.lane)).toEqual(['archived', 'archived'])
  })
  it('an item closes on its step: record done closes "record both cuts"', () => {
    const notYet = itemsToClose(items(), { id: FRIDAY, state: 'review', meta: { making: { recordings: [{ cut: 'long', path: 'a', at: 'x' }], updated_at: 'x', by: 'x' } } })
    expect(notYet).toEqual([])
    const both = itemsToClose(items(), { id: FRIDAY, state: 'review', meta: { making: { recordings: [{ cut: 'long', path: 'a', at: 'x' }, { cut: 'short', path: 'b', at: 'x' }], updated_at: 'x', by: 'x' } } })
    expect(both).toEqual([{ id: 'friday-record', lane: 'done', by: 'engine: record done' }])
  })
  it('the piece an item is about comes from its column, else its link', () => {
    expect(itemPiece({ idea_id: null, link: `https://x/#/content?idea=${HIGGS}` })).toBe(HIGGS)
    expect(itemPiece({ idea_id: null, link: 'https://claude.ai/artifact/x' })).toBeNull()
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
    expect(unmatchedItem({ id: 77, title: 'T', url: 'https://a/p/t', posted_at: 'x', type: 'newsletter' }).id).toBe('post-77')
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

describe('the making route closes what a step finishes', () => {
  it('recording both cuts closes "record both cuts" in the same write', async () => {
    const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/making.js')
    const { out, res } = fakeRes()
    await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: { id: FRIDAY }, body: { recordings: [{ cut: 'long', path: 'r/long.mp4' }, { cut: 'short', path: 'r/short.mp4' }] } } as never, res as never)
    expect(out.status).toBe(200)
    expect(out.body.closed).toEqual(['friday-record'])
    expect(db.tables.work_board_items.find(r => r.id === 'friday-record')).toMatchObject({ lane: 'done', updated_by: 'engine: record done', closed_by: 'engine: record done' })
  })
})

describe('the publish watcher', () => {
  it('marks the matched piece published, ticks Substack, closes its items, and holds a fresh unmatched post for a session once', async () => {
    const archive = [
      { id: 101, title: 'Higgsfield, taken apart: the $1bn AI video machine', canonical_url: 'https://home.makeyourmindup.ai/p/higgsfield-taken-apart-the-1bn-ai', post_date: '2026-10-07T16:06:00Z', type: 'newsletter' },
      { id: 102, title: 'VIDEO: Higgsfield deconstructed.', canonical_url: 'https://home.makeyourmindup.ai/p/higgs-video', post_date: '2026-10-07T16:09:00Z', type: 'podcast' },
      { id: 103, title: 'A fresh post nobody packed', canonical_url: 'https://home.makeyourmindup.ai/p/fresh', post_date: new Date(Date.now() - 3600_000).toISOString(), type: 'newsletter' },
    ]
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => archive })) as never
    try {
      const { default: handler } = await import('../../apps/control-plane/api/publish/watch.js')
      const { out, res } = fakeRes()
      await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: {} } as never, res as never)
      expect(out.status).toBe(200)
      expect(out.body).toMatchObject({ published: 1, held: 1, let_go: [] })
      const higgs = db.tables.content_ideas.find(r => r.id === HIGGS)!
      expect(higgs).toMatchObject({ state: 'published', published_url: 'https://home.makeyourmindup.ai/p/higgsfield-taken-apart-the-1bn-ai', published_at: '2026-10-07T16:06:00Z' })
      // Higgsfield was made before the making record existed: the watcher
      // gives it none, so its items close on the publish as they always did.
      expect(higgs.meta.making).toBeUndefined()
      expect(out.body.closed.sort()).toEqual(['old-link-item', 'you-wed-pick'])
      expect(db.tables.work_board_items.find(r => r.id === 'unrelated')?.lane).toBe('in_progress')
      // Nothing Krish can press answers it and it could not say how it
      // closes, so it is never put on him: it is a session's to work out.
      const question = db.tables.work_board_items.find(r => r.id === 'post-103')!
      expect(question).toMatchObject({ lane: 'in_progress', link: 'https://home.makeyourmindup.ai/p/fresh', updated_by: 'engine: publish watcher' })
      expect(question.only_you).toBeUndefined()
      expect(question.prompt).toBeUndefined()
      expect(question.detail).toContain('making.py <piece id> posted substack')
      // A second pass changes nothing it already changed, and asks nothing twice.
      db.tables.work_board_items.find(r => r.id === 'post-103')!.lane = 'archived'
      const again = fakeRes()
      await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: {} } as never, again.res as never)
      expect(again.out.body).toMatchObject({ published: 0, held: 0, closed: [] })
      expect(db.tables.work_board_items.find(r => r.id === 'post-103')?.lane).toBe('archived')
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('a piece with a making record gets the Substack tick, and its items wait for the standing five', async () => {
    db.tables.work_board_items.push({ id: 'friday-repost', lane: 'on_you', idea_id: FRIDAY, closes_on: 'publish', only_you: 'post', link: 'https://studio.youtube.com/channel/upload', title: 'Repost to YouTube, Shorts, TikTok and Instagram' })
    db.tables.work_board_items.push({ id: 'friday-substack', lane: 'on_you', idea_id: FRIDAY, closes_on: 'published', only_you: 'post', link: 'https://substack.com/publish/post/1', title: 'Post the Substack video' })
    const archive = [{ id: 201, title: 'Why are there suddenly so many AIs?', canonical_url: 'https://home.makeyourmindup.ai/p/why-so-many-ais', post_date: '2026-10-16T13:00:00Z', type: 'newsletter' }]
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => archive })) as never
    try {
      const { default: handler } = await import('../../apps/control-plane/api/publish/watch.js')
      const { out, res } = fakeRes()
      await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: {} } as never, res as never)
      expect(out.body).toMatchObject({ published: 1 })
      const friday = db.tables.content_ideas.find(r => r.id === FRIDAY)!
      expect(friday.state).toBe('published')
      expect(friday.meta.making.channels.substack.url).toBe('https://home.makeyourmindup.ai/p/why-so-many-ais')
      expect(friday.meta.making.pack.folder).toBe('f')
      expect(out.body.closed).toEqual(['friday-substack'])
      expect(db.tables.work_board_items.find(r => r.id === 'friday-repost')?.lane).toBe('on_you')
      expect(db.tables.work_board_items.find(r => r.id === 'friday-record')?.lane).toBe('on_you')
      // Krish ticks the last of the five; the making route closes the rest.
      const { default: making } = await import('../../apps/control-plane/api/content-ideas/[id]/making.js')
      const tick = fakeRes()
      await making({ method: 'POST', headers: { cookie: COOKIE }, query: { id: FRIDAY }, body: { channels: { youtube: {}, shorts: {}, tiktok: {}, reels: {} } } } as never, tick.res as never)
      expect(tick.out.status).toBe(200)
      expect(tick.out.body.steps.find((s: Row) => s.key === 'publish')).toMatchObject({ state: 'done', note: '5 of 5 channels' })
      expect(tick.out.body.closed.sort()).toEqual(['friday-record', 'friday-repost'])
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('a question held for a session that no one touched for a week is let go, and counted; anything else is left', async () => {
    const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
    db.tables.work_board_items.push(
      { id: 'post-301', lane: 'in_progress', idea_id: null, closes_on: null, link: 'https://home.makeyourmindup.ai/p/an-announcement', title: 'Which piece is this post?', updated_at: days(8) },
      { id: 'take-aaaaaaaaaaaa', lane: 'in_progress', idea_id: null, closes_on: 'record', link: null, title: 'Which piece and cut is the take "broll.mov"?', updated_at: days(8) },
      { id: 'take-bbbbbbbbbbbb', lane: 'in_progress', idea_id: FRIDAY, closes_on: 'record', link: null, title: 'Which cut is the take "x.mov"?', updated_at: days(8) },
      { id: 'post-302', lane: 'in_progress', idea_id: null, closes_on: null, link: 'https://home.makeyourmindup.ai/p/fresh', title: 'Which piece is this post?', updated_at: days(2) },
      { id: 'doing-build', lane: 'in_progress', idea_id: null, closes_on: null, link: null, title: 'A session\'s own work', updated_at: days(30) },
    )
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => [] })) as never
    try {
      const { default: handler } = await import('../../apps/control-plane/api/publish/watch.js')
      const { out, res } = fakeRes()
      await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: {} } as never, res as never)
      expect(out.status).toBe(200)
      expect(out.body.let_go.sort()).toEqual(['post-301', 'take-aaaaaaaaaaaa'])
      const item = (id: string) => db.tables.work_board_items.find(r => r.id === id)!
      for (const id of ['post-301', 'take-aaaaaaaaaaaa']) {
        expect(item(id)).toMatchObject({ lane: 'archived', updated_by: 'engine: no session took it', closed_by: 'engine: no session took it' })
      }
      // A take tied to a piece closes on its step; a fresh question and a session's own work are not the watcher's.
      expect(['take-bbbbbbbbbbbb', 'post-302', 'doing-build'].map(id => item(id).lane)).toEqual(['in_progress', 'in_progress', 'in_progress'])
      const again = fakeRes()
      await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: {} } as never, again.res as never)
      expect(again.out.body.let_go).toEqual([])
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('the question held for an unmatched post closes itself once a session records the post on its piece', async () => {
    const post = { id: 104, title: 'A title changed at the last minute', canonical_url: 'https://home.makeyourmindup.ai/p/renamed', post_date: new Date(Date.now() - 3600_000).toISOString(), type: 'newsletter' }
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => [post] })) as never
    try {
      const { default: handler } = await import('../../apps/control-plane/api/publish/watch.js')
      const first = fakeRes()
      await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: {} } as never, first.res as never)
      expect(first.out.body).toMatchObject({ published: 0, held: 1 })
      expect(db.tables.work_board_items.find(r => r.id === 'post-104')?.lane).toBe('in_progress')
      // A session works out it is Friday's piece: making.py <id> posted substack <link>.
      const friday = db.tables.content_ideas.find(r => r.id === FRIDAY)!
      friday.meta = { ...friday.meta, making: { ...friday.meta.making, channels: { substack: { url: post.canonical_url, posted_at: post.post_date } } } }
      const second = fakeRes()
      await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: {} } as never, second.res as never)
      expect(second.out.body).toMatchObject({ published: 1, held: 0 })
      expect(second.out.body.closed).toContain('post-104')
      expect(db.tables.work_board_items.find(r => r.id === 'post-104')).toMatchObject({ lane: 'done', updated_by: 'engine: publish watcher', closed_by: 'engine: publish watcher' })
      // The next pass has nothing left to close.
      const third = fakeRes()
      await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: {} } as never, third.res as never)
      expect(third.out.body.closed).not.toContain('post-104')
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
