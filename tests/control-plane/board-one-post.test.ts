import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { duplicatePosts, postKeys, samePost } from '../../apps/control-plane/api/board/_onePost'
import { carriedItems, carry, dayOptions, syncApprove, type OffdayItem } from '../../apps/control-plane/api/board/_offdayItems'
import { buildView, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { truthProblems } from '../../apps/control-plane/api/board/_stage'
import { approval } from './_approvals'

// One post is one off-day item (docs/PUBLISH_BOARDS.md, "One post, one item"). Ruling (Krish, 2026-11-12): the board
// shows exactly where everything is, and one post is one item that can never sprawl across days or go stale.
//
// The case that made this: on 11 Nov a session moved Tue 17's POV meme (povteach) to Thu 12 by deleting it from the
// plan and writing it again as agentnotsetup. His Approve (10 Nov) still stood on Tue 17, so the one post sat on two
// days. The database's half (a second item of one post refused, the carry whole or not at all, his presses kept) is
// tests/offday-one-post-db.mjs on the real migration; this file holds the keys, the view, the carry and the guard.

type Body = Record<string, any>
const W09 = '2026-11-09', W16 = '2026-11-16'
const NOW = new Date('2026-11-12T15:00:00Z') // Thursday 12 November, New York
const HOOK = 'POV: your AI agent using your computer without being set up properly by you'
const SHORT = { label: 'Geek Creative Agency short Krish saved on 3 Nov', url: 'https://youtube.com/shorts/tJwqPQvgQkk' }
const povteach = { id: 'povteach', format: 'Meme video, made fresh in the brand kit, 9:16', hook: HOOK, copy: 'The short you saved, with your caption.', source: SHORT }
const agentnotsetup = { id: 'agentnotsetup', format: 'Meme video, 19 s, 9:16', hook: HOOK, copy: 'Gave my AI agent the keys to my laptop.', source: SHORT,
  decided: 'Posts Thu 12 Nov (Krish, 11 Nov: "is for tomorrow"). Codex schedules it.' }
const gitbroke = { id: 'gitbroke', format: 'Explainer carousel, 5 cards, 4:5', hook: "Anthropic's AI wrote so much code Git could not keep up.", copy: 'Git broke.' }
const PLANS: Record<string, Body> = {
  [W09]: { offdays: { thu: [gitbroke, agentnotsetup] } },
  [W16]: { offdays: { tue: [{ id: 'fuelgauge', format: 'Explainer carousel', hook: 'From December, your ChatGPT plan gets a fuel gauge.', copy: 'Fuel gauge.' }] } },
}
const row = (over: Partial<OffdayItem> = {}): OffdayItem => ({ item: `engine:${W16}:povteach`, source: 'engine', origin_week: W16, option_id: 'povteach', option: povteach,
  state: 'approved', week: W16, day: 'tue', date: '2026-11-17', doc: 'queue/off-tue-povteach', piece_id: null, drive_folder: null, posts: [], followed: {}, version: 1,
  placed_by: 'Krish', placed_at: '2026-11-10T18:17:48Z', ...over })
const gitRow: OffdayItem = { ...row(), item: `engine:${W09}:gitbroke`, origin_week: W09, option_id: 'gitbroke', option: gitbroke, week: W09, day: 'thu', date: '2026-11-12', doc: 'queue/off-thu-gitbroke' }

function weekInputs(week: string, items: OffdayItem[], extra: Partial<ViewInputs> = {}): ViewInputs {
  const mine = items.filter(r => r.week === week || r.origin_week === week)
  const approvals = items.filter(r => r.state === 'approved' && r.week === week && r.day)
    .map(r => approval(week, r.day as never, String(r.doc).slice('queue/off-'.length + 4), { doc: r.doc!, decided_at: r.placed_at }))
  return { week, now: NOW, pieces: [], picks: [], queue: [], history: [], runs: {}, north_star: null, ideas: PLANS[week] ?? null, locks: {}, approvals,
    items: mine, all_items: items, plans: Object.fromEntries(Object.entries(PLANS).filter(([w]) => w !== week)), ...extra } as ViewInputs
}
const day = (v: ReturnType<typeof buildView>, d: string) => v.days.find(x => x.day === d)!

describe('the keys a post is known by', () => {
  const F = JSON.parse(readFileSync(new URL('../fixtures/one-post-keys.json', import.meta.url), 'utf8')) as { cases: Array<{ name: string; item: string | null; week: string; drive: string | null; option: Body; keys: string[] }> }
  it.each(F.cases.map(c => [c.name, c] as const))('%s (the database computes the same: tests/offday-one-post-db.mjs)', (_n, c) => {
    expect(postKeys(c.option, { item: c.item, week: c.week, drive: c.drive })).toEqual(c.keys)
  })
  it('knows povteach and agentnotsetup as one post, and two weeks of good news or an article two posts cite as different ones', () => {
    const k = (o: Body, item: string, week: string) => postKeys(o, { item, week })
    expect(samePost(k(povteach, `engine:${W16}:povteach`, W16), k(agentnotsetup, `engine:${W09}:agentnotsetup`, W09))).toBe(true)
    const gn = { id: 'goodnews', hook: 'Good things AI did this week.', weekly: 'good_news' }
    expect(samePost(k(gn, `engine:${W09}:goodnews`, W09), k(gn, `engine:${W16}:goodnews`, W16))).toBe(false)
    const art = { url: 'https://venturebeat.com/video/grade-google-with-openai-a-fortune-50-ai-stack-at-home-depot' }
    expect(samePost(k({ hook: "Home Depot makes its AIs mark each other's homework.", source: art }, `engine:${W09}:homework`, W09),
      k({ hook: "Your AI thinks it's the best. Guess who told it.", source: art }, `engine:${W16}:auditrule`, W16))).toBe(false)
  })
})

describe('one post on one day, on the board', () => {
  it('shows Thu 12\'s agentnotsetup as the one post approved for Tue 17, whose Approve moves it, never a second item', () => {
    const v = buildView(weekInputs(W09, [row(), gitRow]))
    const thu = day(v, 'thu')
    const o = thu.options.find(x => x.id === 'agentnotsetup')!
    expect(o.item).toMatchObject({ key: `engine:${W16}:povteach`, state: 'approved' })
    expect(o.same_post).toMatchObject({ item: `engine:${W16}:povteach`, week: W16, day: 'tue', date: '2026-11-17', state: 'approved' })
    expect(o.elsewhere?.[0]).toBe('This is one post with the one approved for Tue 17 Nov (povteach). Your Approve here moves it here, so it is only ever on one day.')
    const approve = o.actions.find(a => a.kind === 'press' && /^Approve for/.test(a.label)) as Body
    expect(approve.goes).toBe('Moves the one post here from Tue 17 Nov, onto the publish board for Thursday 12 November. It is never on two days.')
    expect(approve.id).toBe('off-thu-agentnotsetup') // his press is on the option he sees; syncApprove carries the item
    expect(o.move).toMatchObject({ item: `engine:${W16}:povteach`, from: { week: W16, day: 'tue', date: '2026-11-17' } })
    expect(o.stage).toEqual({ state: 'idea', label: "Idea: one post with Tue 17 Nov's, approved there", at: null, links: [] })
    expect(o.posts).toBeUndefined() // Growth's record is the item's, on the day it is on
    expect(thu.options.find(x => x.id === 'gitbroke')!.stage).toMatchObject({ state: 'approved' })
  })

  it('says on Tue 17 where else the same post is up as an idea', () => {
    const v = buildView(weekInputs(W16, [row(), gitRow]))
    const tue = day(v, 'tue')
    const o = tue.options.find(x => x.id === 'povteach')!
    expect(o.stage?.state).toBe('approved')
    expect(o.elsewhere).toContain('Thu 12 Nov also has this post up as an idea (agentnotsetup). Your Approve there moves it there, so it is only ever on one day. A session wrote that it is for that day; only your press moves it.')
    expect(tue.next).toMatch(/Thu 12 Nov also has this post up as an idea \(agentnotsetup\)/)
  })

  it('draws the post once, on Thu 12, after his Approve carried it, and nothing on Tue 17', () => {
    const carried = row({ option_id: 'agentnotsetup', option: agentnotsetup, week: W09, day: 'thu', date: '2026-11-12', doc: 'queue/off-thu-agentnotsetup', version: 2, placed_at: '2026-11-12T14:00:00Z' })
    const thu = day(buildView(weekInputs(W09, [carried, gitRow])), 'thu')
    expect(thu.options.filter(o => o.id === 'agentnotsetup')).toHaveLength(1)
    expect(thu.options.find(o => o.id === 'agentnotsetup')).toMatchObject({ status: 'approved', item: { key: `engine:${W16}:povteach` } })
    expect(thu.options.find(o => o.id === 'agentnotsetup')!.same_post).toBeUndefined()
    const tue = day(buildView(weekInputs(W16, [carried, gitRow])), 'tue')
    expect(tue.options.map(o => o.id)).toEqual(['fuelgauge'])
  })

  it('never draws a plan option beside the item of the same post on its own day', () => {
    // The one item moved onto Thu 12 under its own id (a Move, not an Approve): the plan's agentnotsetup is not drawn too.
    const moved = row({ week: W09, day: 'thu', date: '2026-11-12', doc: 'queue/off-thu-povteach', version: 2 })
    const options = dayOptions(PLANS[W09], [gitRow, moved], W09, 'thu', undefined, [gitRow, moved])
    expect(options.map(x => x.o.id)).toEqual(['gitbroke', 'povteach'])
  })

  it('keeps every rule of where everything is across both weeks: one day per post, one stage per item, no past day with Growth', () => {
    const items = [row(), gitRow]
    const days = [...buildView(weekInputs(W09, items)).days, ...buildView(weekInputs(W16, items)).days]
    expect(truthProblems(days, '2026-11-12')).toEqual([])
    // The guard sees a post placed on two days.
    const twice = [...days, { ...day(buildView(weekInputs(W16, items)), 'tue'), date: '2026-11-19', day: 'thu' }]
    expect(truthProblems(twice, '2026-11-12')).toContain(`engine:${W16}:povteach: on 2026-11-17 and 2026-11-19`)
  })
})

describe('his Approve carries the one item', () => {
  function fake(rows: OffdayItem[], docs: Body[] = []) {
    const calls: Body[] = []
    const q = (table: string) => {
      const where: Array<(r: Body) => boolean> = []
      let single = false
      const src = () => (table === 'offday_items' ? rows : table === 'board_documents' ? docs : []) as Body[]
      const self: any = {
        select: () => self, eq: (k: string, v: unknown) => { where.push(r => String(r[k] ?? '') === String(v)); return self },
        in: (k: string, vs: unknown[]) => { where.push(r => vs.map(String).includes(String(r[k]))); return self },
        limit: () => self, maybeSingle: () => { single = true; return self },
        then: (ok: (v: unknown) => unknown) => Promise.resolve().then(() => { const r = src().filter(x => where.every(w => w(x))); return { data: single ? r[0] ?? null : r, error: null } }).then(ok),
      }
      return self
    }
    return { calls, db: { from: q, rpc: async (fn: string, args: Body) => { calls.push({ fn, p: args.p }); return { data: { ok: true, version: 2 }, error: null } } } }
  }
  const press = { pick: 'off-thu-agentnotsetup', use: 'offday', day: 'thu', week: W09, option_id: 'agentnotsetup', idea: { verdict: 'approve', words: null, sha256: 'd'.repeat(64), shown: { copy: agentnotsetup.copy, hook: HOOK } } }

  it('moves povteach to Thu 12 under agentnotsetup and takes his approval off Tue 17 in the same move', async () => {
    const f = fake([row(), gitRow], [{ week: W16, collection: 'queue', doc_id: 'off-tue-povteach', body: { pick: 'off-tue-povteach', use: 'offday', idea: { verdict: 'approve', sha256: 'e'.repeat(64) } }, revision: 3 }])
    const out = await syncApprove(f.db as never, W09, 'off-thu-agentnotsetup', press, async w => PLANS[w] ?? null, NOW)
    expect(out).toBe('carried')
    expect(f.calls).toHaveLength(1)
    const p = f.calls[0].p
    expect(p).toMatchObject({ item: `engine:${W16}:povteach`, version: 1, actor: 'Krish', option_id: 'agentnotsetup', state: 'approved', place: { week: W09, day: 'thu' }, carry: true })
    expect(p.writes).toHaveLength(1)
    expect(p.writes[0]).toMatchObject({ week: W16, id: 'off-tue-povteach', revision: 3, body: { idea: { verdict: null }, moved: { to_week: W09, to_day: 'thu', as: 'agentnotsetup', one_post: true } } })
  })

  it('gives an option its own row when no item is the same post', async () => {
    const f = fake([gitRow])
    expect(await syncApprove(f.db as never, W09, 'off-thu-agentnotsetup', press, async w => PLANS[w] ?? null, NOW)).toBe('placed')
    expect(f.calls[0].p).toMatchObject({ item: `engine:${W09}:agentnotsetup`, version: 0, writes: [] })
  })

  it('carries an item from his Ideas for Later without writing to a day it was never on', async () => {
    const later = row({ state: 'later', week: null, day: null, date: null, doc: null })
    const f = fake([later])
    expect(await carry(f.db as never, later, { week: W09, day: 'thu', optionId: 'agentnotsetup', option: agentnotsetup, body: press }, NOW)).toBe('carried')
    expect(f.calls[0].p.writes).toEqual([])
  })
})

describe('the guard over the week plans', () => {
  it('finds a post copied to another day under a new id, and lets a re-plan that names the item it carries through', () => {
    const copied = { [W16]: { offdays: { tue: [povteach] } }, [W09]: { offdays: { thu: [agentnotsetup] } } }
    expect(duplicatePosts(copied)).toEqual([{ post: 'asset:youtube:tJwqPQvgQkk', a: `${W09} thu agentnotsetup`, b: `${W16} tue povteach` }])
    const carried = { [W16]: { offdays: { tue: [povteach] } }, [W09]: { offdays: { thu: [{ ...agentnotsetup, item: `engine:${W16}:povteach` }] } } }
    expect(duplicatePosts(carried)).toEqual([])
    // A filed idea offered again in a later week under its own id is that idea, not a copy.
    expect(duplicatePosts({ [W09]: { offdays: { thu: [gitbroke] } }, [W16]: { offdays: { tue: [gitbroke] } } })).toEqual([])
  })
})

describe('an option a re-plan carries leaves its day', () => {
  it('draws Tue 17\'s auditrule nowhere once Thu 12\'s beststicker names it as the item it carries, unless a press of his stands on it', () => {
    const auditrule = { id: 'auditrule', hook: "Your AI thinks it's the best. Guess who told it.", copy: 'Six cards.', closed: 'Moved to Thu 12 Nov and filed there.' }
    const plan16 = { offdays: { tue: [auditrule] } }
    const carriedBy = { [W09]: { offdays: { thu: [{ id: 'beststicker', item: `engine:${W16}:auditrule`, hook: auditrule.hook }] } }, [W16]: plan16 }
    expect(dayOptions(plan16, [], W16, 'tue', undefined, [], carriedItems(carriedBy)).map(x => x.o.id)).toEqual([])
    // A session's `closed` alone never takes an idea off his board: only a re-plan that names what it carries does.
    expect(dayOptions(plan16, [], W16, 'tue', undefined, [], carriedItems({ [W16]: plan16 })).map(x => x.o.id)).toEqual(['auditrule'])
    const his = row({ item: `engine:${W16}:auditrule`, option_id: 'auditrule', option: auditrule, doc: 'queue/off-tue-auditrule' })
    expect(dayOptions(plan16, [his], W16, 'tue', undefined, [his], carriedItems(carriedBy)).map(x => x.o.id)).toEqual(['auditrule'])
  })
})
