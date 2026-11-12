// One post is one off-day item, run against the real migrations in a real database
// (supabase/migrations/20261130090000_offday_one_post.sql; docs/PUBLISH_BOARDS.md, "One post, one item").
// Ruling (Krish, 2026-11-12): the board shows exactly where everything is, and one post is one item that can never
// sprawl across days or go stale.
//
//   node tests/offday-one-post-db.mjs /abs/path/@electric-sql/pglite/dist/index.js
//
// The database knows a post by the same keys as the board (tests/fixtures/one-post-keys.json, which the TypeScript is
// held to in tests/control-plane/board-one-post.test.ts). A second item of one post is refused a day by every writer;
// Growth offering a post he already has is taken, not written; his Approve on the same post under another id carries
// the one item there, taking his approval off the day it left, whole or not at all; a carry to another post is refused.
// Every press of his stays in board_history and the carry in offday_moves.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const [modulePath] = process.argv.slice(2)
if (!modulePath) {
  console.error('usage: node tests/offday-one-post-db.mjs <path to @electric-sql/pglite/dist/index.js>')
  process.exit(2)
}
const { PGlite } = await import(pathToFileURL(modulePath).href)
const db = new PGlite()
await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
  end $$;
  grant usage on schema public to service_role;
  create table public.content_ideas (id uuid primary key default gen_random_uuid(), idea text, state text default 'seeded',
    lane_slot text, scheduled_for date, buried_at timestamptz, meta jsonb default '{}'::jsonb, updated_at timestamptz default now());
  grant select, insert, update on public.content_ideas to service_role;`)
const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
await db.exec(await migration('20261019120743_publish_board_web.sql'))
await db.exec(await migration('20261126090000_ideas_gate.sql'))
await db.exec(await migration('20261125090000_board_signal.sql'))
await db.exec(await migration('20261129090000_offday_items.sql'))
await db.exec(await migration('20261129100000_offday_items_posts.sql'))

const W09 = '2026-11-09', W16 = '2026-11-16'
const rows = async (sql, p = []) => (await db.query(sql, p)).rows
const one = async (sql, p = []) => (await rows(sql, p))[0]
const revOf = async (week, id) => Number((await one(`select revision from board_documents where week = $1 and collection = 'queue' and doc_id = $2`, [week, id]))?.revision || 0)
const save = async (week, id, body, actor = 'Krish') => {
  const r = (await db.query(`select public.board_save($1, 'queue', $2, $3::jsonb, $4, $5) as r`, [week, id, JSON.stringify(body), await revOf(week, id), actor])).rows[0].r
  assert.equal(r.ok, true, `board_save ${id}: ${JSON.stringify(r)}`)
  return r
}
const SHA = c => c.repeat(64)
const HOOK = 'POV: your AI agent using your computer without being set up properly by you'
const SHORT = { label: 'Geek Creative Agency short', url: 'https://youtube.com/shorts/tJwqPQvgQkk' }
const offBody = (week, day, id, idea, extra = {}) => ({ use: 'offday', pick: `off-${day}-${id}`, day, week, option_id: id, format: 'Meme video, 9:16', copy_sha256: SHA('c'), idea, ...extra })
const approve = shown => ({ verdict: 'approve', words: null, sha256: SHA('d'), at: '2026-11-10T18:17:48Z', shown })

// His Approve on Tue 17's povteach (10 Nov), as it stood before this migration: the backfill gave it its row.
await save(W16, 'off-tue-povteach', offBody(W16, 'tue', 'povteach', approve({ copy: 'The short you saved', hook: HOOK, pitch: null, cards: null })))
await db.exec(`insert into public.offday_items (item, source, origin_week, option_id, option, state, week, day, date, doc, version, placed_by)
  values ('engine:${W16}:povteach', 'engine', '${W16}', 'povteach', '${JSON.stringify({ id: 'povteach', hook: HOOK, copy: 'The short you saved', source: SHORT }).replace(/'/g, "''")}',
  'approved', '${W16}', 'tue', '2026-11-17', 'queue/off-tue-povteach', 1, 'Krish')`)
await db.exec(await migration('20261130090000_offday_one_post.sql'))
await db.exec(await migration('20261130090000_offday_one_post.sql')) // re-runnable
await db.exec('set role service_role')

// ── the database knows a post by the board's keys ─────────────────────────────────────────────────────────────────────
const F = JSON.parse(await readFile(new URL('./fixtures/one-post-keys.json', import.meta.url), 'utf8'))
for (const c of F.cases) {
  const k = (await one(`select public.offday_post_keys($1, $2::jsonb, $3::date, $4) as k`, [c.item, JSON.stringify(c.option), c.week, c.drive])).k
  assert.deepEqual([...k].sort(), [...c.keys].sort(), `the database's keys for "${c.name}" are the board's`)
}
const POV = `engine:${W16}:povteach`
const pov = await one(`select post_keys from offday_items where item = $1`, [POV])
assert.ok(pov.post_keys.includes('asset:youtube:tJwqPQvgQkk') && pov.post_keys.some(k => k.startsWith('hook:pov your ai agent')), 'every row learns its keys')

// ── a second item of one post is refused a day ────────────────────────────────────────────────────────────────────────
// His Approve on Thu 12's agentnotsetup, the same post a session wrote again under a new id.
const AGENT = { id: 'agentnotsetup', hook: HOOK, copy: 'Gave my AI agent the keys to my laptop', source: SHORT, drive: `https://drive.google.com/drive/folders/${'1UU2FiU2HAvUuuEbJ2GM7nqzm76rZg9GJ'}` }
await save(W09, 'off-thu-agentnotsetup', offBody(W09, 'thu', 'agentnotsetup', approve({ copy: AGENT.copy, hook: HOOK, pitch: null, cards: null })))
await assert.rejects(db.query(`insert into offday_items (item, source, origin_week, option_id, option, state, week, day, date, doc, placed_by)
  values ('engine:${W09}:agentnotsetup', 'engine', '${W09}', 'agentnotsetup', $1::jsonb, 'approved', '${W09}', 'thu', '2026-11-12', 'queue/off-thu-agentnotsetup', 'Krish')`, [JSON.stringify(AGENT)]),
  e => { assert.match(String(e.message), /same_post/); return true }, 'a second item of the same post cannot go on a day, even with his approval there')
const move = p => db.query(`select public.offday_item_move($1::jsonb) as r`, [JSON.stringify(p)]).then(r => r.rows[0].r)
await assert.rejects(move({ item: `engine:${W09}:agentnotsetup`, version: 0, actor: 'Krish', state: 'approved', source: 'engine', origin_week: W09, option_id: 'agentnotsetup',
  option: AGENT, place: { week: W09, day: 'thu' }, writes: [] }), /same_post/, 'nor through a move')
// Growth offering the same post is taken, not written.
const offer = await one(`select public.offday_items_offer($1, 'growth', $2::jsonb) as r`, [W16, JSON.stringify([{ item: `growth:${W16}:pov`, option_id: 'pov', day: 'sat', option: { id: 'pov', hook: HOOK, copy: 'Ours' } }])])
assert.deepEqual([offer.r.offered, offer.r.taken], [0, 1], 'Growth offering a post he already has is taken, never a second item')
assert.equal((await rows(`select 1 from offday_items where item = $1`, [`growth:${W16}:pov`])).length, 0)

// ── a carry to another post is refused ────────────────────────────────────────────────────────────────────────────────
await save(W09, 'off-thu-other', offBody(W09, 'thu', 'other', approve({ copy: 'Another post', hook: 'Something else entirely about AI', pitch: null, cards: null })))
await assert.rejects(move({ item: POV, version: 1, actor: 'Krish', state: 'approved', source: 'engine', origin_week: W16, option_id: 'other',
  option: { id: 'other', hook: 'Something else entirely about AI', copy: 'Another post' }, place: { week: W09, day: 'thu' }, writes: [] }), /not_the_same_post/,
  'the one item never turns into another post')

// ── his Approve carries the one item ──────────────────────────────────────────────────────────────────────────────────
const leave = { week: W16, id: 'off-tue-povteach', revision: await revOf(W16, 'off-tue-povteach'),
  body: offBody(W16, 'tue', 'povteach', { verdict: null, words: null, sha256: SHA('d'), at: '2026-11-12T14:00:00Z' }, { moved: { to_week: W09, to_day: 'thu', as: 'agentnotsetup', one_post: true } }) }
const carried = await move({ item: POV, version: 1, actor: 'Krish', state: 'approved', source: 'engine', origin_week: W16, option_id: 'agentnotsetup', option: AGENT,
  place: { week: W09, day: 'thu' }, writes: [leave], carry: true })
assert.deepEqual([carried.ok, Number(carried.version), carried.week, carried.day, carried.doc], [true, 2, W09, 'thu', 'queue/off-thu-agentnotsetup'], 'the one item is on Thu 12 under the option he approved')
const r = await one(`select option_id, state, date::text, post_keys from offday_items where item = $1`, [POV])
assert.deepEqual([r.option_id, r.state, r.date], ['agentnotsetup', 'approved', '2026-11-12'])
assert.ok(r.post_keys.includes('drive:1UU2FiU2HAvUuuEbJ2GM7nqzm76rZg9GJ'), 'its keys follow its words and its folder')
assert.equal((await rows(`select 1 from offday_items`)).length, 1, 'one post, one item: nothing was copied')
assert.deepEqual((await rows(`select doc from board_approvals_now($1)`, [W16])).map(x => x.doc), [], 'Tue 17 no longer stands it')
assert.deepEqual((await rows(`select doc from board_approvals_now($1)`, [W09])).map(x => x.doc).filter(d => /agentnotsetup/.test(d)), ['queue/off-thu-agentnotsetup'])
assert.equal((await one(`select outcome from idea_outcomes where doc = 'queue/off-tue-povteach' order by id desc limit 1`)).outcome, 'withdrawn', 'his approval on Tue 17 is recorded as withdrawn')
assert.equal(Number((await one(`select count(*) as n from board_history where week = $1 and doc_id = 'off-tue-povteach'`, [W16])).n), 2, 'both presses on Tue 17 stay in his history')
const m = await one(`select from_day, to_day, to_week::text from offday_moves where item = $1 order by id desc limit 1`, [POV])
assert.deepEqual([m.from_day, m.to_day, m.to_week], ['tue', 'thu', W09], 'the carry is kept, append only')
// Now the same post is on a day once, and that day is Thu 12.
await assert.rejects(db.query(`update offday_items set version = version where item = $1`, [POV]).then(() => db.query(`insert into offday_items (item, source, origin_week, option_id, option, state, week, day, date, doc, placed_by)
  values ('engine:${W16}:again', 'engine', '${W16}', 'again', $1::jsonb, 'offered', '${W16}', 'tue', '2026-11-17', 'queue/off-tue-again', 'engine')`, [JSON.stringify({ id: 'again', hook: HOOK })])),
  /same_post/, 'and no one can put it up again on another day while it stands')

console.log('one post, one item: the board\'s keys, no second item on a day by any writer, his Approve carries the one item whole, his presses kept')
