import { describe, expect, it } from 'vitest'
import { approval, withApprovals } from './_approvals'
import { buildView, viewProblems, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { channelOfUrl, liveByDay, liveInput, livePress, publishedNow, recordLive, todayNY } from '../../apps/control-plane/api/board/_itsLive'
import { hisOnlyRefusal, validBody } from '../../apps/control-plane/api/board/_contracts'
import { offdaySides } from '../../apps/control-plane/api/board/_offdaySides'
import { fillPress, type PressAction } from '../../apps/control-plane/api/board/_viewExtras'

// "It's live" (Krish, 2026-11-12: "How do I indicate that Tuesday the 10th was posted correctly?"): one press on any
// piece on the publish board, series days and off days alike, recorded as his, append only, so the day moves to Live and
// Done and the week's published count rises; Growth reads every one for its learning. Synthetic fixtures only.

type Body = Record<string, unknown>
const WEEK = '2026-11-09'
const MON = 'b358e788-209f-427b-a84d-1f79a8ebb430', FRI = 'f3fcd5e1-573e-4692-a413-db7c5823a10e'
const piece = (id: string, date: string, slot: string, extra: Body = {}) =>
  ({ id, idea: `Piece ${id.slice(0, 4)}.`, scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, updated_at: '2026-11-09T12:00:00Z', meta: {}, ...extra })
const opt = (id: string, extra: Body = {}) => ({ id, format: 'Meme carousel, 4:5', copy: `Option ${id}`, hook: `Hook ${id}.`, ...extra })
const shell = opt('shell'), homework = opt('homework')
const approved = (o: Body) => ({ doc_id: `off-tue-${o.id}`, updated_by: 'Krish', revision: 1, body: { use: 'offday', pick: `off-tue-${o.id}`, day: 'tue',
  idea: { verdict: 'approve', words: null, sha256: offdaySides(o).idea_sha256, at: '2026-11-03T06:55:38Z' } } })
const liveDoc = (day: string, posts: Body[], by = 'Krish') => ({ doc_id: `live-${day}`, updated_by: by, revision: posts.length, body: { kind: 'live', day, at: String(posts[posts.length - 1].at), posts } })

function week(over: Partial<ViewInputs> = {}): ViewInputs {
  const pieces = [piece(MON, '2026-11-09', 'follow_the_money', { state: 'published' }), piece(FRI, '2026-11-13', 'mind_the_gap')]
  return withApprovals({
    week: WEEK, now: new Date('2026-11-12T15:00:00Z'), pieces, picks: [], history: [], runs: {}, north_star: { current: 3, target: 8 }, locks: {},
    queue: [approved(shell), approved(homework)],
    ideas: { offdays: { tue: [shell, homework, opt('quoteline')] } },
    approvals: [approval(WEEK, 'mon', MON), approval(WEEK, 'fri', FRI), approval(WEEK, 'tue', 'shell'), approval(WEEK, 'tue', 'homework')],
    ...over,
  })
}
const day = (v: ReturnType<typeof buildView>, d: string) => v.days.find(x => x.day === d)!
const isLive = (a: { kind: string; label: string }): a is PressAction => a.kind === 'press' && /^It's live/.test(a.label)

describe("It's live: the press", () => {
  it('knows a post\'s channel from its own address, and never guesses from anything else', () => {
    expect(channelOfUrl('https://www.instagram.com/p/abc/')).toBe('instagram')
    expect(channelOfUrl('https://www.instagram.com/reel/abc/')).toBe('reels')
    expect(channelOfUrl('https://www.youtube.com/shorts/x')).toBe('shorts')
    expect(channelOfUrl('https://youtu.be/x')).toBe('youtube')
    expect(channelOfUrl('https://www.linkedin.com/posts/x')).toBe('linkedin')
    expect(channelOfUrl('https://x.com/a/status/1')).toBe('x')
    expect(channelOfUrl('https://www.threads.net/@a/post/1')).toBe('threads')
    expect(channelOfUrl('https://home.makeyourmindup.ai/p/a-piece')).toBe('substack')
    expect(channelOfUrl('https://substack.com/@krish/note/c-1')).toBe('substack-notes')
    expect(channelOfUrl('https://example.org/post')).toBeNull()
    expect(channelOfUrl('not a link')).toBeNull()
  })

  it('takes his link and the channels a day posts to, for exactly one subject, and refuses anything else', () => {
    const ok = { day: 'tue', option: 'off-tue-shell', channels: ['instagram', 'linkedin'], url: 'https://www.instagram.com/p/abc/' }
    expect(liveInput(ok).input).toEqual(ok)
    expect(liveInput({ ...ok, piece_id: MON }).problem).toMatch(/one of the two/)
    expect(liveInput({ ...ok, option: undefined }).problem).toMatch(/one of the two/)
    expect(liveInput({ ...ok, option: 'off-thu-shell' }).problem).toMatch(/one of the two/)
    expect(liveInput({ ...ok, channels: ['substack'] }).problem).toMatch(/not a channel an off-day post goes out on/)
    expect(liveInput({ ...ok, channels: [] }).problem).toMatch(/channels/)
    expect(liveInput({ ...ok, url: 'http://insecure.example/x' }).problem).toMatch(/https/)
    expect(liveInput({ ...ok, send: true }).problem).toMatch(/unknown fields/)
    expect(liveInput({ ...ok, day: 'sun' }).problem).toMatch(/day/)
    expect(liveInput({ day: 'mon', piece_id: MON, channels: ['substack', 'shorts'], url: 'https://home.makeyourmindup.ai/p/x' }).input?.channels).toEqual(['substack', 'shorts'])
  })

  it('is built as a press the board fills with his link and his channels, ticking the link\'s own channel first', () => {
    const p = livePress('tue', { option: 'off-tue-shell', title: 'Hook shell.' })
    expect(p).toMatchObject({ kind: 'press', label: "It's live", op: 'live', body: { day: 'tue', option: 'off-tue-shell' }, words: { path: 'url', required: true }, stamp: ['at'] })
    expect(p.choose).toMatchObject({ path: 'channels', multi: true, required: true, from_link: true })
    expect(p.choose!.options.map(o => o.value)).toEqual(['shorts', 'tiktok', 'reels', 'instagram', 'linkedin', 'x', 'threads', 'facebook', 'substack-notes'])
    expect(p.choose!.options.find(o => o.value === 'instagram')?.hosts).toContain('instagram.com/p')
    const { body } = fillPress(p, 'https://www.instagram.com/p/abc/', '2026-11-12T15:00:00Z')
    expect(liveInput({ ...body, channels: ['instagram'] }).input).toBeTruthy()
  })

  it('keeps every post in one append-only record of his, which only he writes and a plain write cannot change', () => {
    const post = { channels: ['instagram'], url: 'https://www.instagram.com/p/abc/', at: '2026-11-10T17:30:00Z', by: 'Krish', option: 'off-tue-shell' }
    expect(validBody('picks', 'live-tue', { kind: 'live', day: 'tue', at: post.at, posts: [post] })).toBe(true)
    expect(validBody('picks', 'live-tue', { kind: 'live', day: 'wed', at: post.at, posts: [post] })).toBe(false)
    expect(validBody('picks', 'live-tue', { kind: 'live', day: 'tue', at: post.at, posts: [{ ...post, by: 'growth' }] })).toBe(false)
    expect(validBody('picks', 'live-tue', { kind: 'live', day: 'tue', at: post.at, posts: [{ ...post, piece_id: MON }] })).toBe(false)
    expect(validBody('picks', 'live-tue', { kind: 'live', day: 'tue', at: post.at, posts: [] })).toBe(false)
    expect(hisOnlyRefusal('picks', { kind: 'live', day: 'tue', posts: [post] }, 'engine_operator')).toBe('decision_is_his')
    // A session's document is never read as his.
    expect(liveByDay([liveDoc('tue', [post], 'engine_operator')])).toEqual({})
    expect(liveByDay([liveDoc('tue', [post])]).tue).toHaveLength(1)
  })
})

/** A store with one piece, his approvals, and board_documents, enough for recordLive. */
function store(opts: { approvals?: Body[] | null; piece?: Body | null; held?: Body | null } = {}) {
  const docs = new Map<string, { body: Body; revision: number; updated_by: string }>()
  if (opts.held) docs.set('live-mon', { body: opts.held, revision: 1, updated_by: 'Krish' })
  let piece: Body | null = opts.piece === undefined ? { ...piece0 } : opts.piece
  const saves: Body[] = []
  const db: any = {
    rpc: async (name: string, a: Body) => {
      if (name === 'board_approvals_now') return opts.approvals === null ? { data: null, error: { message: 'down' } } : { data: opts.approvals ?? [], error: null }
      if (name !== 'board_save') throw new Error(name)
      const held = docs.get(String(a.p_id))
      if ((held?.revision || 0) !== a.p_revision) return { data: { ok: false, error: 'revision_conflict' }, error: null }
      docs.set(String(a.p_id), { body: a.p_body as Body, revision: Number(a.p_revision) + 1, updated_by: String(a.p_actor) })
      saves.push(a)
      return { data: { ok: true, revision: Number(a.p_revision) + 1 }, error: null }
    },
    from: (table: string) => {
      const f: Body = {}
      const q: any = {
        select: () => q, eq: (k: string, v: unknown) => { f[k] = v; return q },
        update: (patch: Body) => { f.patch = patch; return q },
        maybeSingle: async () => {
          if (table === 'content_ideas') return { data: piece && piece.id === f.id ? piece : null, error: null }
          const d = docs.get(String(f.doc_id))
          return { data: d ? { body: d.body, revision: d.revision, updated_by: d.updated_by } : null, error: null }
        },
        select2: null,
      }
      // content_ideas update(...).eq(id).eq(updated_at).select('id')
      q.select = (cols?: string) => {
        if (f.patch && cols === 'id') {
          if (piece && f.updated_at === piece.updated_at) { piece = { ...piece, ...(f.patch as Body), updated_at: String((f.patch as Body).updated_at) }; return Promise.resolve({ data: [{ id: piece.id }], error: null }) }
          return Promise.resolve({ data: [], error: null })
        }
        return q
      }
      return q
    },
  }
  return { db, docs, saves, piece: () => piece }
}
const piece0: Body = { id: MON, idea: 'Who walks away with the money.', scheduled_for: '2026-11-09', state: 'drafting', buried_at: null, updated_at: '2026-11-09T12:00:00Z',
  meta: { making: { updated_at: '2026-11-09T12:00:00Z', by: 'growth', channels: { shorts: { posted_at: '2026-11-09T17:30:00Z', url: 'https://www.youtube.com/shorts/x', buffer_post_id: 'b1' } } } } }
const MON_OK = [{ idea_id: MON, day: 'mon', date: '2026-11-09', via: 'pick', doc: 'picks/mon', option_ref: null, revision: 1, decided_at: '2026-11-08T10:00:00Z', option_sha256: null, words: null, source: 'publish_board' }]
const NOW = '2026-11-12T15:00:00.000Z'

describe("It's live: the record", () => {
  it('is his alone: a session or Growth is refused, and nothing is written', async () => {
    const s = store({ approvals: MON_OK })
    const r = await recordLive(s.db, WEEK, { day: 'mon', piece_id: MON, channels: ['substack'], url: 'https://home.makeyourmindup.ai/p/x' }, 'engine_operator', NOW)
    expect(r).toEqual({ status: 403, body: { ok: false, error: 'live_is_his' } })
    expect(s.saves).toEqual([])
  })

  it('marks only what his approval holds on the day, and says so when his approvals cannot be read', async () => {
    expect((await recordLive(store({ approvals: [] }).db, WEEK, { day: 'mon', piece_id: MON, channels: ['substack'], url: 'https://home.makeyourmindup.ai/p/x' }, 'Krish', NOW)).body.error).toBe('not_approved_by_krish')
    expect((await recordLive(store({ approvals: null }).db, WEEK, { day: 'mon', piece_id: MON, channels: ['substack'], url: 'https://home.makeyourmindup.ai/p/x' }, 'Krish', NOW)).status).toBe(503)
    expect((await recordLive(store({ approvals: MON_OK }).db, WEEK, { day: 'tue', option: 'off-tue-shell', channels: ['instagram'], url: 'https://www.instagram.com/p/a/' }, 'Krish', NOW)).body.error).toBe('not_approved_by_krish')
    expect((await recordLive(store({ approvals: MON_OK }).db, WEEK, { day: 'wed', piece_id: MON, channels: ['substack'], url: 'https://home.makeyourmindup.ai/p/x' }, 'Krish', NOW)).body.error).toBe('not_this_day')
  })

  it('appends each post, never changes one, and writes a repeat once', async () => {
    const s = store({ approvals: MON_OK })
    const first = await recordLive(s.db, WEEK, { day: 'mon', piece_id: MON, channels: ['substack'], url: 'https://home.makeyourmindup.ai/p/x', at: '2026-11-09T17:31:00Z' }, 'Krish', NOW)
    expect(first.status).toBe(200)
    const second = await recordLive(s.db, WEEK, { day: 'mon', piece_id: MON, channels: ['linkedin', 'x'], url: 'https://www.linkedin.com/posts/y' }, 'Krish', NOW)
    expect(second.status).toBe(200)
    const again = await recordLive(s.db, WEEK, { day: 'mon', piece_id: MON, channels: ['linkedin'], url: 'https://www.linkedin.com/posts/y' }, 'Krish', NOW)
    expect(again.body.duplicate).toBe(true)
    const posts = (s.docs.get('live-mon')!.body.posts as Body[])
    expect(posts.map(p => p.url)).toEqual(['https://home.makeyourmindup.ai/p/x', 'https://www.linkedin.com/posts/y'])
    expect(posts[0]).toMatchObject({ by: 'Krish', piece_id: MON, at: '2026-11-09T17:31:00.000Z', title: 'Who walks away with the money.' })
    expect(s.saves.map(x => x.p_actor)).toEqual(['Krish', 'Krish'])
  })

  it('copies each new channel onto the piece\'s making record, the link on its own channel, Growth\'s entry kept', async () => {
    const s = store({ approvals: MON_OK })
    const r = await recordLive(s.db, WEEK, { day: 'mon', piece_id: MON, channels: ['substack', 'shorts', 'linkedin'], url: 'https://home.makeyourmindup.ai/p/x' }, 'Krish', NOW)
    expect(r.body.making_channels).toEqual(['substack', 'linkedin'])
    const ch = (s.piece()!.meta as Body & { making: { channels: Record<string, Body> } }).making.channels
    expect(ch.substack).toEqual({ posted_at: NOW, url: 'https://home.makeyourmindup.ai/p/x' })
    expect(ch.linkedin).toEqual({ posted_at: NOW })
    expect(ch.shorts).toMatchObject({ buffer_post_id: 'b1' })
  })

  it('records an off-day post on the day with no piece at all', async () => {
    const tue = [{ ...MON_OK[0], idea_id: 'off-tue-shell', day: 'tue', date: '2026-11-10', via: 'offday', doc: 'queue/off-tue-shell' }]
    const s = store({ approvals: tue, piece: null })
    const r = await recordLive(s.db, WEEK, { day: 'tue', option: 'off-tue-shell', channels: ['instagram', 'facebook'], url: 'https://www.instagram.com/p/a/' }, 'Krish', NOW)
    expect(r.status).toBe(200)
    expect(s.docs.get('live-tue')!.body.posts).toEqual([{ channels: ['instagram', 'facebook'], url: 'https://www.instagram.com/p/a/', at: NOW, by: 'Krish', option: 'off-tue-shell' }])
  })
})

describe("It's live on the board", () => {
  it('leads a due day Growth has with It\'s live, one per approved option, and keeps every rule of the view', () => {
    const v = buildView(week())
    const tue = day(v, 'tue')
    // Tue 10 has passed with nothing marked live: the board says it was missed, never "with Growth" (Ruling, Krish,
    // 2026-11-12: the board shows exactly where everything is), and It's live still leads.
    expect(tue.who).toBe('missed')
    expect(tue.actions.filter(isLive).map(a => a.label)).toEqual(["It's live: Hook shell.", "It's live: Hook homework."])
    expect(isLive(tue.actions[0])).toBe(true)
    expect(tue.next).toBe("Missed: Tue 10 has passed and nothing on it is marked live. If it went out, press It's live with its link")
    expect(tue.detail.at(-1)).toEqual({ h: 'Before its day passed', p: expect.stringMatching(/Once it is out, press It's live with the post's link$/) })
    expect(viewProblems(v)).toEqual([])
    // A piece still being made, on a day still to come, takes no It's live.
    expect(day(v, 'fri').actions.some(isLive)).toBe(false)
    // Monday is out already (Substack): no press.
    expect(day(v, 'mon').who).toBe('done')
    expect(day(v, 'mon').actions.some(isLive)).toBe(false)
  })

  it('moves an off day to Live and Done once he marks a post live, with its link on what went out', () => {
    const post = { channels: ['instagram', 'linkedin'], url: 'https://www.instagram.com/p/abc/', at: '2026-11-10T17:30:00Z', by: 'Krish', option: 'off-tue-shell' }
    const v = buildView(week({ picks: [liveDoc('tue', [post])] }))
    const tue = day(v, 'tue')
    expect(tue).toMatchObject({ who: 'done', stop: 4, title: 'Hook shell.' })
    expect(tue.next).toBe('Live on Instagram, LinkedIn. You marked it live, Tue 10 Nov, 12:30')
    expect(tue.posted).toEqual([
      { step: 'instagram', label: 'Instagram', at: post.at, href: post.url, by: 'you' },
      { step: 'linkedin', label: 'LinkedIn', at: post.at, by: 'you' },
    ])
    // The other approved option keeps its own press, never leading a day that is done.
    expect(tue.actions.map(a => a.label)).toEqual(["It's live: Hook homework."])
  })

  it('moves a series day to Done once he marks its essay live on Substack, before the watcher matches it', () => {
    const fri = { ...week().pieces[1], meta: { making: { video_assets: [] } } }
    const post = { channels: ['substack', 'shorts'], url: 'https://home.makeyourmindup.ai/p/meta', at: '2026-11-13T17:30:00Z', by: 'Krish', piece_id: FRI }
    const v = buildView(week({ now: new Date('2026-11-13T20:00:00Z'), pieces: [week().pieces[0], fri], picks: [liveDoc('fri', [post])] }))
    expect(day(v, 'fri')).toMatchObject({ who: 'done', stop: 4, next: 'Live on Substack, YouTube Shorts. You marked it live, Fri 13 Nov, 12:30' })
    expect(day(v, 'fri').path?.stages.every(s => s.state === 'done')).toBe(true)
  })

  it('gives an off-day option approved for a series day its own It\'s live, with the off-day channels', () => {
    const meme = opt('meme')
    const v = buildView(week({ queue: [approved(shell), approved(homework), { ...approved(meme), doc_id: 'off-mon-meme', body: { ...approved(meme).body, pick: 'off-mon-meme', day: 'mon' } }],
      ideas: { offdays: { tue: [shell, homework], mon: [meme] } },
      approvals: [approval(WEEK, 'mon', MON), approval(WEEK, 'fri', FRI), approval(WEEK, 'tue', 'shell'), approval(WEEK, 'tue', 'homework'),
        { ...approval(WEEK, 'mon', 'meme'), via: 'offday', doc: 'queue/off-mon-meme', option_ref: 'off-mon-meme' }] }))
    const mon = day(v, 'mon')
    expect(mon.who).toBe('done')
    const live = mon.actions.filter(isLive)
    expect(live.map(a => a.label)).toEqual(["It's live: Hook meme."])
    expect(live[0].body).toMatchObject({ day: 'mon', option: 'off-mon-meme' })
    expect(live[0].choose!.options.map(o => o.value)).toContain('instagram')
    expect(liveInput({ day: 'mon', option: 'off-mon-meme', channels: ['instagram'], url: 'https://www.instagram.com/p/a/' }).input).toBeTruthy()
    expect(liveInput({ day: 'mon', piece_id: MON, channels: ['instagram'], url: 'https://www.instagram.com/p/a/' }).problem).toMatch(/series piece/)
  })

  it('says what is out today by the day in New York', () => {
    expect(todayNY(new Date('2026-11-12T03:00:00Z'))).toBe('2026-11-11')
    expect(todayNY(new Date('2026-11-12T15:00:00Z'))).toBe('2026-11-12')
  })
})

describe('the published count, live', () => {
  const db = (pieces: Body[] | null, docs: Body[]) => ({
    from: (table: string) => {
      const q: any = { select: () => q, gte: () => q, eq: () => q, like: () => q, in: () => q,
        limit: async () => (table === 'content_ideas' ? (pieces ? { data: pieces, error: null } : { data: null, error: { message: 'down' } }) : { data: docs, error: null }) }
      return q
    },
  })
  const now = new Date('2026-11-12T15:00:00Z')
  it('counts the pieces out this week by the North Star\'s own rule, and each post he marked live that it cannot see yet, once', async () => {
    const live = (week: string, day: string, posts: Body[], by = 'Krish') => ({ week, doc_id: `live-${day}`, updated_by: by, body: { kind: 'live', day, posts } })
    const docs = [
      live('2026-11-09', 'tue', [{ option: 'off-tue-shell', at: '2026-11-10T17:30:00Z' }, { option: 'off-tue-shell', at: '2026-11-10T18:00:00Z' }]),
      live('2026-11-09', 'mon', [{ piece_id: MON, at: '2026-11-09T17:31:00Z' }]),
      live('2026-11-09', 'fri', [{ piece_id: FRI, at: '2026-11-12T14:00:00Z' }]),
      live('2026-11-02', 'thu', [{ option: 'off-thu-old', at: '2026-11-01T17:30:00Z' }]),
      live('2026-11-09', 'sat', [{ option: 'off-sat-x', at: '2026-11-11T10:00:00Z' }], 'engine_operator'),
    ]
    // Mon is published (counted once, not again for his press), Fri is marked live before the watcher, Tue is an off day.
    expect(await publishedNow(db([{ id: MON }, { id: '36886e0b-4b32-473b-be72-b0aef31fccef' }], docs) as never, now)).toBe(4)
    expect(await publishedNow(db(null, docs) as never, now)).toBeNull()
  })
})
