import { describe, expect, it } from 'vitest'
import { buildView, lockOf, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { dayLine } from '../../apps/control-plane/api/board/_weekModel'
import { reportPosts, type OffdayItem } from '../../apps/control-plane/api/board/_offdayItems'
import { writeBack } from '../../apps/control-plane/api/board/_writeBack'
import { approval } from './_approvals'

// The board says the current state of affairs (Krish, 2026-11-13: the Publish Board "fully up to date with no glitches,
// errors, duplicates, or fragmentation in the data pipeline", showing "the current state of affairs on what needs to be
// done"). Each case here is a glitch the live board of 13 Nov showed:
//   - Fri 13 said "Done: everything on it is live" while two approved posts on it were not;
//   - Sat 14's good news was scheduled in Buffer and still offered "Find the other 4 stories";
//   - Thu 12 still asked for his Approve on "POV: your AI agent..." after the one post went out on Fri 13;
//   - Fri 20's new piece read as Branded from the lock he signed for the piece that moved to Tue 17;
//   - Tue 17's moved piece lost its signed lock, and a moved piece never said it was missed;
//   - Buffer sent four of the week's posts and no record reached the board (the done-check's report, client done_check).

type Body = Record<string, any>
const W09 = '2026-11-09', W16 = '2026-11-16'
const HOOK = 'POV: your AI agent using your computer without being set up properly by you'
const SHORT = { label: 'Geek Creative Agency short Krish saved on 3 Nov', url: 'https://youtube.com/shorts/tJwqPQvgQkk' }
const povteach = { id: 'povteach', format: 'Meme video, 9:16', hook: HOOK, copy: 'The short you saved, with your caption.', source: SHORT }
const agentnotsetup = { id: 'agentnotsetup', format: 'Meme video, 19 s, 9:16', hook: HOOK, copy: 'Gave my AI agent the keys to my laptop.', source: SHORT,
  decided: 'Posts Thu 12 Nov (Krish, 11 Nov: "is for tomorrow"). Codex schedules it.' }
const beststicker = { id: 'beststicker', format: 'Explainer carousel, 6 cards, 4:5', hook: "Your AI thinks it's the best. Guess who told it.", copy: 'Six cards.' }
const oldproof = { id: 'oldproof', format: 'Uplifting explainer carousel, 4 cards, 4:5', hook: 'AI found a mistake in a maths proof from 1986, its makers say.',
  copy: 'Axiom says its AI agents checked a 15,000-page piece of maths.', source: { label: 'Axiom', url: 'https://axiommath.ai/research/the-enormous-theorem-formalized/' } }

const row = (o: Body, week: string, day: string, date: string, over: Partial<OffdayItem> = {}): OffdayItem => ({ item: `engine:${week}:${o.id}`, source: 'engine',
  origin_week: week, option_id: o.id, option: o, state: 'approved', week: W09, day, date, doc: `queue/off-${day}-${o.id}`, piece_id: null, drive_folder: null,
  posts: [], followed: {}, version: 1, placed_by: 'Krish', placed_at: '2026-11-10T18:17:48Z', ...over })

function weekOf(now: string, items: OffdayItem[], plan: Body, extra: Partial<ViewInputs> = {}): ViewInputs {
  const approvals = items.filter(r => r.state === 'approved' && r.week === W09 && r.day)
    .map(r => approval(W09, r.day as never, String(r.doc).slice('queue/off-'.length + 4), { doc: r.doc!, decided_at: r.placed_at }))
  return { week: W09, now: new Date(now), pieces: [], picks: [], queue: [], history: [], runs: {}, north_star: null, ideas: plan, locks: {}, approvals,
    items, all_items: items, plans: {}, ...extra } as ViewInputs
}
const model = (v: ReturnType<typeof buildView>, d: string) => v.model!.days.find(x => x.day === d)!
const live = (channel: string, at: string, buffer: string, url: string | null = null) => ({ state: 'live' as const, channel, url, at, due_at: null, buffer_post_id: buffer, check: 'buffer_sent' })

describe('a day says Done only when everything on it is live', () => {
  const item = (key: string, stage: string) => ({ key, missed: false, stage: { key: stage, label: stage }, decision: false }) as never
  it('says how many are live and how many are still in progress (Fri 13 Nov: the piece out, two posts not)', () => {
    expect(dayLine({ label: 'Fri 13', items: [item('piece:x', 'live'), item('off-fri-a', 'approved'), item('off-fri-b', 'approved')], decisions: 0, ideas: 0 }))
      .toBe('1 of 3 live. 2 items in progress.')
    expect(dayLine({ label: 'Fri 13', items: [item('piece:x', 'live'), item('off-fri-a', 'live')], decisions: 0, ideas: 0 })).toBe('Done: everything on it is live.')
    expect(dayLine({ label: 'Fri 13', items: [item('off-fri-a', 'scheduled')], decisions: 0, ideas: 0 })).toBe('One item in progress.')
  })
  it('on the board itself: a post out beside one not out is never Done', () => {
    const items = [row(povteach, W16, 'fri', '2026-11-13', { posts: [live('instagram', '2026-11-13T20:31:00Z', 'b1', 'https://www.instagram.com/p/abc/')] }),
      row(beststicker, W09, 'fri', '2026-11-13')]
    const v = buildView(weekOf('2026-11-13T21:00:00Z', items, { offdays: { fri: [beststicker] } }, { plans: { [W16]: { offdays: { tue: [povteach] } } } }))
    const fri = model(v, 'fri')
    expect(fri.items.map(i => i.stage.key).sort()).toEqual(['approved', 'live'])
    expect(fri.line).not.toMatch(/^Done/)
    expect(fri.line).toBe('1 of 2 live. One item in progress.')
  })
})

describe('the Buffer send the done-check saw is the post going out, said as Buffer\'s', () => {
  it('draws the item live with "Buffer shows it sent", and its day done', () => {
    // Thu 12's Git carousel: Buffer sent it on Fri 13.
    const git = { id: 'gitbroke', format: 'Explainer carousel, 5 cards, 4:5', hook: "Anthropic's AI wrote so much code Git could not keep up.", copy: 'Git broke.' }
    const items = [row(git, W09, 'thu', '2026-11-12', { posts: [live('instagram', '2026-11-13T18:46:00Z', 'b1', 'https://www.instagram.com/p/abc/'), live('substack-notes', '2026-11-13T18:45:00Z', 'b2')] })]
    const v = buildView(weekOf('2026-11-13T21:00:00Z', items, { offdays: { thu: [git] } }))
    const thu = model(v, 'thu')
    expect(thu.items[0]).toMatchObject({ stage: { key: 'live' }, next: null, missed: false })
    expect(thu.items[0].links).toEqual([{ label: 'Instagram', href: 'https://www.instagram.com/p/abc/' }])
    const day = v.days.find(d => d.day === 'thu')!
    expect(day.next).toMatch(/^Live on Substack Notes, Instagram\. Buffer shows it sent, Fri 13 Nov/)
    expect(thu.line).toBe('Done: everything on it is live.')
  })
})

describe('good news that is scheduled is made: no run to find more stories', () => {
  it('Sat 14: scheduled in Buffer, so its next step is Growth\'s, never "Find the other 4 stories"', () => {
    const sched = { state: 'scheduled' as const, channel: 'instagram', url: null, at: '2026-11-13T22:44:00Z', due_at: '2026-11-14T10:00:00Z', buffer_post_id: 'b9', check: 'buffer_sent' }
    const items = [row(oldproof, W09, 'sat', '2026-11-14', { posts: [sched] })]
    const v = buildView(weekOf('2026-11-13T21:00:00Z', items, { offdays: { sat: [oldproof] } }))
    const gn = model(v, 'sat').items[0]
    expect(gn).toMatchObject({ stage: { key: 'scheduled' }, line: 'Scheduled on Instagram for Sat 14 Nov, 05:00.', next: { kind: 'press', op: 'live' } })
    // Not scheduled and with one story, the run is still offered.
    const bare = buildView(weekOf('2026-11-13T21:00:00Z', [row(oldproof, W09, 'sat', '2026-11-14')], { offdays: { sat: [oldproof] } }))
    expect(model(bare, 'sat').items[0].next).toMatchObject({ kind: 'run', label: 'Find the other 4 stories' })
  })
})

describe('the ideas board asks only about what still waits on him', () => {
  const plan = { offdays: { thu: [agentnotsetup] } }
  const out = row(povteach, W16, 'fri', '2026-11-13', { posts: [live('x', '2026-11-13T20:30:00Z', 'b3', 'https://x.com/TheRealKrisho/status/1')] })
  it('an idea that is the same post as one already out leaves the ideas board', () => {
    // Wed 11: Thu 12 has not passed, so only the post being out takes it off.
    const v = buildView(weekOf('2026-11-11T15:00:00Z', [out], plan, { plans: { [W16]: { offdays: { tue: [povteach] } } } }))
    expect(v.model!.ideas.find(i => i.doc_id === 'off-thu-agentnotsetup')).toBeUndefined()
    expect(model(v, 'thu').ideas).toBe(0)
    // Not out yet, the one-post Approve that moves it is still his to press.
    const waiting = buildView(weekOf('2026-11-11T15:00:00Z', [{ ...out, posts: [] }], plan, { plans: { [W16]: { offdays: { tue: [povteach] } } } }))
    expect(waiting.model!.ideas.find(i => i.doc_id === 'off-thu-agentnotsetup')).toBeTruthy()
  })
  it('an idea for a day that has passed leaves the ideas board', () => {
    const v = buildView(weekOf('2026-11-13T15:00:00Z', [], plan))
    expect(v.model!.ideas.filter(i => i.date < '2026-11-13')).toEqual([])
    const before = buildView(weekOf('2026-11-11T15:00:00Z', [], plan))
    expect(before.model!.ideas.map(i => i.doc_id)).toEqual(['off-thu-agentnotsetup'])
  })
})

describe('a narrative lock follows its piece, never its day', () => {
  const FRI_OLD = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118', FRI_NEW = 'c00cd4e0-e1bb-4c60-b36f-cea92897e38c'
  const lockFor = (id: string) => `# Narrative lock\n\npiece_id: ${id}\nPublishes: 2026-11-20\n\nThe arc.\n\nSigned by Krish: "Signed.", 2026-11-09`
  const piece = (id: string, date: string, slot: string) => ({ id, idea: `Piece ${id.slice(0, 4)}`, thesis: 'x', scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, body: '', updated_at: '2026-11-13T18:21:08Z', meta: {} })
  it('reads the week\'s lock that names the piece, wherever it is filed, and a day\'s lock that names another piece is not this one\'s', () => {
    const locks = { fri: lockFor(FRI_OLD), mon: '# Narrative lock\n\nNo piece line.\n\nSigned by Krish: "Yes", 2026-11-10' }
    expect(lockOf(locks, 'fri', FRI_NEW)).toBeNull()
    expect(lockOf(locks, 'tue', FRI_OLD)).toEqual({ text: locks.fri, day: 'fri' })
    expect(lockOf(locks, 'mon', '8287846b-6618-4a19-9fb8-23ad4eca2718')).toEqual({ text: locks.mon, day: 'mon' })
  })
  it('on the board: Fri 20\'s new piece is not Branded by the moved piece\'s lock; the moved piece on Tue 17 keeps it, and says when it is missed', () => {
    const i: ViewInputs = {
      week: W16, now: new Date('2026-11-13T22:00:00Z'), pieces: [piece(FRI_NEW, '2026-11-20', 'mind_the_gap'), piece(FRI_OLD, '2026-11-17', 'mind_the_gap')],
      picks: [], queue: [], history: [], runs: {}, north_star: null, ideas: { days: { fri: [{ id: FRI_NEW }] } }, locks: { fri: lockFor(FRI_OLD) },
      approvals: [approval(W16, 'fri', FRI_NEW), approval(W16, 'tue', FRI_OLD)], items: [], all_items: [], plans: {},
    } as unknown as ViewInputs
    const v = buildView(i)
    const fri = model(v, 'fri').items.find(x => x.piece_id === FRI_NEW)!
    expect(fri.path[0].state).not.toBe('done')
    expect(fri.stage.key).toBe('approved')
    expect(v.days.find(d => d.day === 'fri')!.detail.find(x => x.h === 'Narrative lock')!.p).toBe('Not written yet')
    const tue = model(v, 'tue').items.find(x => x.piece_id === FRI_OLD)!
    expect(tue).toMatchObject({ stage: { key: 'branded' }, missed: false })
    expect(tue.line).toMatch(/^Branded: its narrative lock is signed for Tue 17/)
    const later = buildView({ ...i, now: new Date('2026-11-18T15:00:00Z') })
    expect(model(later, 'tue').items.find(x => x.piece_id === FRI_OLD)).toMatchObject({ missed: true, line: expect.stringMatching(/^Missed: Tue 17 passed/) })
  })
})

describe('every copied prompt for a piece says where his typed approval goes', () => {
  it('names board_session.py approve lock|scripts, so his approval in a session reaches the record', () => {
    const p = writeBack({ pieceId: '8287846b-6618-4a19-9fb8-23ad4eca2718', week: W16, day: 'mon', step: 'board' })
    expect(p).toMatch(/When Krish approves the narrative lock or the scripts in this session, file his exact typed words at once/)
    expect(p).toMatch(/board_session\.py 8287846b-6618-4a19-9fb8-23ad4eca2718 approve lock\|scripts/)
    expect(writeBack({ pieceId: null, week: W16, day: 'tue', step: 'post' })).not.toMatch(/approve lock/)
  })
})

describe('the done-check\'s report of a Buffer send (POST offday-posts, client done_check)', () => {
  function db(rows: OffdayItem[]) {
    const writes: Array<{ item: string; posts: unknown[] }> = []
    const q = (filter: (r: OffdayItem) => boolean) => {
      const chain: any = {
        eq: (k: string, val: unknown) => q(r => filter(r) && (r as any)[k] === val),
        in: (k: string, vals: unknown[]) => q(r => filter(r) && vals.includes((r as any)[k])),
        or: () => chain, order: () => chain, limit: () => chain,
        then: (res: any) => res({ data: rows.filter(filter), error: null }),
      }
      return chain
    }
    return {
      writes,
      from: () => ({
        select: () => q(() => true),
        update: (v: { posts: unknown[] }) => ({ eq: (_k: string, item: string) => { writes.push({ item, posts: v.posts }); return Promise.resolve({ error: null }) } }),
      }),
    } as any
  }
  const shell = row({ id: 'shell', hook: 'Character.AI went bust. Here is who got what.' }, W09, 'tue', '2026-11-10')
  it('records each send as the check\'s, with its Buffer id as the proof when Buffer gives no public link', async () => {
    const d = db([shell])
    const r = await reportPosts(d, W09, { client: 'done_check', check: 'buffer_sent', posts: [
      { item: shell.item, state: 'live', channel: 'instagram', url: 'https://www.instagram.com/p/Dfkc9h-CdqP/', at: '2026-11-10T17:34:14Z', buffer_post_id: '6af1fbe1a606e4de469dd4a5' },
      { item: shell.item, state: 'live', channel: 'substack-notes', at: '2026-11-10T18:25:00Z', buffer_post_id: '6af1fe6208578dcbeb68972e' },
    ] })
    expect(r.body).toMatchObject({ ok: true, items: 1, unknown: 0, check: 'buffer_sent' })
    expect(d.writes[0].posts).toEqual([
      expect.objectContaining({ state: 'live', channel: 'instagram', buffer_post_id: '6af1fbe1a606e4de469dd4a5', check: 'buffer_sent' }),
      expect.objectContaining({ state: 'live', channel: 'substack-notes', url: null, buffer_post_id: '6af1fe6208578dcbeb68972e', check: 'buffer_sent' }),
    ])
  })
  it('never takes Growth\'s own record of a channel, writes nothing for a replay, and refuses a check it does not know', async () => {
    const growth = { state: 'live' as const, channel: 'instagram', url: 'https://www.instagram.com/p/own/', at: '2026-11-10T17:30:00Z', due_at: null, buffer_post_id: 'g1' }
    const d = db([{ ...shell, posts: [growth, live('facebook', '2026-11-10T17:40:00Z', 'b2', 'https://www.facebook.com/x')] }])
    const r = await reportPosts(d, W09, { client: 'done_check', check: 'buffer_sent', posts: [
      { item: shell.item, state: 'live', channel: 'instagram', url: 'https://www.instagram.com/p/other/', at: '2026-11-10T17:34:00Z', buffer_post_id: 'b1' },
      { item: shell.item, state: 'live', channel: 'facebook', url: 'https://www.facebook.com/x', at: '2026-11-10T17:40:00Z', buffer_post_id: 'b2' },
    ] })
    expect(r.body).toMatchObject({ ok: true, already: 2 })
    expect(d.writes[0].posts).toEqual([expect.objectContaining({ channel: 'instagram', buffer_post_id: 'g1', url: 'https://www.instagram.com/p/own/' }),
      expect.objectContaining({ channel: 'facebook', buffer_post_id: 'b2' })])
    expect((d.writes[0].posts[0] as Body).check).toBeUndefined()
    expect((await reportPosts(db([shell]), W09, { client: 'done_check', check: 'guess', posts: [] })).status).toBe(400)
  })
  it('a live post with no link and no Buffer id, or a check\'s report of anything but a send or a schedule, is left out', async () => {
    const d = db([shell])
    const r = await reportPosts(d, W09, { client: 'done_check', check: 'buffer_sent', posts: [
      { item: shell.item, state: 'live', channel: 'x', at: '2026-11-10T18:06:00Z' },
      { item: shell.item, state: 'made', buffer_post_id: 'b5' },
    ] })
    expect(r.body).toMatchObject({ ok: true, items: 0, unknown: 2 })
    // Growth's own report still needs the link, as before.
    const g = await reportPosts(db([shell]), W09, { posts: [{ item: shell.item, state: 'live', channel: 'x', at: '2026-11-10T18:06:00Z', buffer_post_id: 'b6' }] })
    expect(g.body).toMatchObject({ unknown: 1 })
  })
})

describe('scripts agreed before the production pick: the look is his next press, then recording', () => {
  const MON = '8287846b-6618-4a19-9fb8-23ad4eca2718'
  const LOCK = `# Narrative lock\n\npiece_id: ${MON}\nPublishes: 2026-11-16\n\nThe arc.\n\nSigned by Krish: "signed, add in the impacts too", 2026-11-10`
  const looks = [{ id: 'face-with-proof', name: 'Face with proof', pitch: 'You to camera, the evidence beside you.', status: 'live' },
    { id: 'explainer-board', name: 'Explainer board', pitch: 'A board you draw on.', status: 'live' }]
  const inputs = (meta: Body = {}, making: Body = {}): ViewInputs => ({
    week: W16, now: new Date('2026-11-14T08:00:00Z'),
    pieces: [{ id: MON, idea: 'Where the money for AI comes from', thesis: 'x', scheduled_for: '2026-11-16', lane_slot: 'follow_the_money', state: 'drafting', buried_at: null, body: '',
      updated_at: '2026-11-13T22:00:00Z', meta: { ...meta, making } }],
    picks: [{ doc_id: 'mon-scripts', updated_by: 'Krish', body: { approved: true, piece_id: MON } }], queue: [], history: [], runs: {}, north_star: null,
    ideas: { days: { mon: [{ id: MON, so_what: 'Where the money comes from.', style: { production: 'face-with-proof' } }] } }, locks: { mon: LOCK },
    formats: { production: looks, script: [] }, approvals: [approval(W16, 'mon', MON)], items: [], all_items: [], plans: {},
  } as unknown as ViewInputs)
  it('Mon 16 with his scripts on file and no look: Branded, "Scripts approved. Pick the look", one press with the looks, the recommended first', () => {
    const v = buildView(inputs())
    const mon = model(v, 'mon')
    const it = mon.items[0]
    expect(it.stage.key).toBe('branded')
    expect(it.path.map(s => s.state)).toEqual(['done', 'current', 'todo', 'todo', 'todo'])
    expect(it.line).toMatch(/^Branded\. Scripts approved\. Pick the look/)
    expect(it.decision).toBe(true)
    expect(it.next).toMatchObject({ kind: 'press', op: 'look', label: 'Pick the look', body: { piece_id: MON },
      choose: { path: 'production', required: true, options: [{ value: 'face-with-proof', label: 'Face with proof (recommended)' }, { value: 'explainer-board', label: 'Explainer board' }] } })
    expect(mon.line).toBe('One decision for you.')
    expect(v.days.find(d => d.day === 'mon')!.detail.find(x => x.h === 'Scripts')!.p).toBe('Approved by you on the board')
  })
  it('once the look is picked, the next step is recording, never the look again', () => {
    const v = buildView(inputs({ look: { production: 'face-with-proof', experiment: null, inspiration: [], at: '2026-11-14T09:00:00Z' } }))
    const it = model(v, 'mon').items[0]
    expect(it.next).toMatchObject({ kind: 'open', label: 'Open Teleprompter' })
    expect(it.path.slice(0, 3).map(s => s.state)).toEqual(['done', 'done', 'done'])
    expect(it.decision).toBe(false)
  })
  it('a take already recorded is never sent back to the look', () => {
    const v = buildView(inputs({}, { recordings: [{ cut: 'long', at: '2026-11-14T10:00:00Z' }, { cut: 'short', at: '2026-11-14T10:10:00Z' }] }))
    const day = v.days.find(d => d.day === 'mon')!
    expect(day.path!.steps.find(s => s.key === 'record')!.state).toBe('done')
    expect(day.path!.current).not.toBe('look')
    expect(model(v, 'mon').items[0].next).not.toMatchObject({ op: 'look' })
  })
})

describe('a post scheduled after its day says when it goes, never Missed', () => {
  const sched = (channel: string, due: string, id: string) => ({ state: 'scheduled' as const, channel, url: null, at: '2026-11-13T22:50:00Z', due_at: due, buffer_post_id: id, check: 'buffer_sent' })
  const best = row(beststicker, W09, 'fri', '2026-11-13', { posts: [sched('instagram', '2026-11-17T13:30:00Z', 'b1'), sched('x', '2026-11-17T13:30:00Z', 'b2')] })
  it('Fri 13\'s "Your AI thinks it\'s the best", scheduled in Buffer for Tue 17, on Sat 14', () => {
    const v = buildView(weekOf('2026-11-14T12:00:00Z', [best], { offdays: { fri: [beststicker] } }))
    const it = model(v, 'fri').items.find(i => i.key === 'off-fri-beststicker')!
    expect(it).toMatchObject({ missed: false, stage: { key: 'scheduled' } })
    expect(it.line).toBe('Scheduled on Instagram, X for Tue 17 Nov, 08:30, after its day (Fri 13 Nov).')
    expect(model(v, 'fri').line).not.toMatch(/^Missed/)
  })
  it('a schedule whose time has passed with no send is missed, as before', () => {
    const v = buildView(weekOf('2026-11-18T12:00:00Z', [best], { offdays: { fri: [beststicker] } }))
    expect(model(v, 'fri').items.find(i => i.key === 'off-fri-beststicker')).toMatchObject({ missed: true })
  })
})

describe('his production pick on every piece before recording: the look, the motion style and the captions, each one press', () => {
  const MON = '8287846b-6618-4a19-9fb8-23ad4eca2718', WED = 'db9f9f6a-1092-49be-8024-f335e060305a', TUE = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
  const mod = (id: string, name: string, extra: Body = {}) => ({ id, name, how: `${name}.`, rules: [], point_types: ['claim'], formats: ['long_video', 'short_video'], fits: 'often', krish_verdict: '', ve_route: ['ve'], ...extra })
  const motion = [mod('swiss-kinetic-type', 'Swiss grid'), mod('ladder', 'The Ladder', { ve_route: ['needs_device'], krish_verdict: 'liked' }), mod('character-ai-receipts', 'Receipts on the ink desk', { fits: 'sometimes' })]
  const looks = [{ id: 'face-with-proof', name: 'Face with proof', pitch: 'x', status: 'live' }, { id: 'fry-talking-head', name: 'The lit talking head', pitch: 'x', status: 'live' }]
  const LOCK = `# Narrative lock\n\npiece_id: ${MON}\n\nThe arc.\n\nSigned by Krish: "signed", 2026-11-10`
  const piece = (id: string, date: string, slot: string, meta: Body = {}) => ({ id, idea: `Piece ${id.slice(0, 4)}`, thesis: 'x', scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, body: '', updated_at: '2026-11-13T22:00:00Z', meta })
  const inputs = (monMeta: Body = {}): ViewInputs => ({
    week: W16, now: new Date('2026-11-14T08:00:00Z'),
    pieces: [piece(MON, '2026-11-16', 'follow_the_money', monMeta), piece(WED, '2026-11-18', 'under_the_hood'), piece(TUE, '2026-11-17', 'mind_the_gap')],
    picks: [], queue: [], history: [], runs: {}, north_star: null,
    ideas: { days: {
      mon: [{ id: MON, so_what: 'x', style: { production: 'face-with-proof', motion: 'character-ai-receipts', captions: 'receipt-chip' } }],
      wed: [{ id: WED, so_what: 'x', style: { production: 'fry-talking-head' } }],
      fri: [{ id: TUE, so_what: 'x', style: { production: 'face-with-proof', motion: 'ladder', captions: 'art-directed' } }],
    } },
    locks: { mon: LOCK }, motion, formats: { production: looks, script: [] },
    approvals: [approval(W16, 'mon', MON), approval(W16, 'wed', WED), approval(W16, 'tue', TUE)], items: [], all_items: [], plans: {},
  } as unknown as ViewInputs)
  const labels = (a: any) => a.choose.options.map((o: Body) => o.label)
  it('Mon 16 at its look: Pick the look leads, the motion style and the captions wait beside it, the plan\'s picks first and marked', () => {
    const it = model(buildView(inputs()), 'mon').items[0]
    expect(it.next).toMatchObject({ kind: 'press', op: 'look', label: 'Pick the look', body: { piece_id: MON, experiment: null, inspiration: [] }, choose: { path: 'production' } })
    expect(labels(it.next)[0]).toBe('Face with proof (recommended)')
    expect(it.others.map(a => [a.label, (a as any).op, (a as any).choose.path])).toEqual([['Pick the motion style', 'style', 'motion'], ['Pick the captions', 'style', 'captions']])
    expect(labels(it.others[0])).toEqual(['Receipts on the ink desk (recommended)', 'Swiss grid', 'The Ladder (not ready yet)'])
    expect((it.others[0] as any).body).toEqual({ piece_id: MON })
    expect(labels(it.others[1])[0]).toMatch(/\(recommended\)$/)
    expect((it.others[1] as any).choose.options[0].value).toBe('receipt-chip')
  })
  it('Wed 18 before its lock is signed: the step stays the lock, and the three picks wait in the read sheet', () => {
    const it = model(buildView(inputs()), 'wed').items[0]
    expect(it.next).not.toMatchObject({ op: 'look' })
    expect(it.decision).toBe(false)
    expect(it.others.map(a => a.label)).toEqual(['Pick the look', 'Pick the motion style', 'Pick the captions'])
    expect(labels(it.others[0])[0]).toBe('The lit talking head (recommended)')
  })
  it('Tue 17\'s moved piece has the same three picks, from its own row in the plan', () => {
    const it = model(buildView(inputs()), 'tue').items.find(x => x.piece_id === TUE)!
    expect(it.others.map(a => a.label)).toEqual(['Pick the look', 'Pick the motion style', 'Pick the captions'])
    expect((it.others[1] as any).body).toEqual({ piece_id: TUE })
    expect(labels(it.others[1])[0]).toBe('The Ladder (recommended)')
  })
  it('once picked it says so and offers a change; once a take is recorded, no pick is offered', () => {
    const picked = model(buildView(inputs({ look: { production: 'face-with-proof', experiment: 'data-story', inspiration: ['a'], at: '2026-11-14T09:00:00Z' }, style: { motion: 'ladder', at: '2026-11-14T09:00:00Z' } })), 'mon').items[0]
    const look = picked.others.find(a => /the look/.test(a.label)) as any
    expect(look.label).toBe('Change the look')
    expect(look.body).toEqual({ piece_id: MON, experiment: 'data-story', inspiration: ['a'] })
    expect(labels(look)[0]).toBe('Face with proof (picked)')
    const rec = model(buildView(inputs({ making: { recordings: [{ cut: 'long', at: '2026-11-14T10:00:00Z' }, { cut: 'short', at: '2026-11-14T10:10:00Z' }] } })), 'mon').items[0]
    expect(rec.others).toEqual([])
  })
})
