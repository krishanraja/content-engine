// The one home of an off-day item's day, run against the real migrations in a real database
// (supabase/migrations/20261129090000_offday_items.sql; docs/PUBLISH_BOARDS.md, "Moving an off-day item to any day").
// Ruling (Krish, 2026-11-12): any off-day post or idea moves to any day at his press, and the move updates every place
// that names its day.
//
//   node tests/offday-items-db.mjs /abs/path/@electric-sql/pglite/dist/index.js
//
// Every way an item could reach a day without his press is tried and refused: a row put on a day, a row moved to
// another day, a move by anyone but Krish, a move that carries no approval for the new day, a stale move, Growth
// writing over a row he placed. Then his move lands whole: his approval for the new day stands, his approval for the
// old day no longer does, the row says the new day, a piece he records moves with it, and the move is kept append
// only. Growth's options come in offered, never approved, and go away only as withdrawn.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const [modulePath] = process.argv.slice(2)
if (!modulePath) {
  console.error('usage: node tests/offday-items-db.mjs <path to @electric-sql/pglite/dist/index.js>')
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

const W1 = '2026-11-16', W2 = '2026-11-23'
const rows = async (sql, p = []) => (await db.query(sql, p)).rows
const one = async (sql, p = []) => (await rows(sql, p))[0]
const revOf = async (week, id) => Number((await one(`select revision from board_documents where week = $1 and collection = 'queue' and doc_id = $2`, [week, id]))?.revision || 0)
const save = async (week, id, body, actor = 'Krish') => {
  const r = (await db.query(`select public.board_save($1, 'queue', $2, $3::jsonb, $4, $5) as r`, [week, id, JSON.stringify(body), await revOf(week, id), actor])).rows[0].r
  assert.equal(r.ok, true, `board_save ${id}: ${JSON.stringify(r)}`)
  return r
}
const refused = async (sql, p, code, why) => {
  await assert.rejects(db.query(sql, p), e => { assert.match(String(e.message), code, why); return true }, why)
}
const SHA = c => c.repeat(64)
const offBody = (week, day, id, idea, extra = {}) => ({ use: 'offday', pick: `off-${day}-${id}`, day, week, option_id: id, format: 'Meme, 2 panels, 4:5',
  copy_sha256: SHA('c'), idea, ...extra })
const approve = { verdict: 'approve', words: null, sha256: SHA('d'), at: '2026-11-12T09:00:00Z', shown: { copy: 'Burning tokens', hook: null, pitch: null, cards: null } }

// His Approve on Tuesday's meme, saved before the migration: the backfill gives it its row.
await save(W1, 'off-tue-burntokens', offBody(W1, 'tue', 'burntokens', approve))
await db.exec(await migration('20261129090000_offday_items.sql'))
await db.exec(await migration('20261129090000_offday_items.sql')) // re-runnable: the backfill adds nothing twice
await db.exec(await migration('20261129100000_offday_items_posts.sql'))
await db.exec(await migration('20261129100000_offday_items_posts.sql')) // re-runnable
await db.exec('set role service_role')

const ITEM = `engine:${W1}:burntokens`
const row = await one(`select item, source, state, week::text, day, date::text, doc, version, placed_by, option from offday_items where item = $1`, [ITEM])
assert.deepEqual([row.source, row.state, row.week, row.day, row.date, row.doc, Number(row.version), row.placed_by],
  ['engine', 'approved', W1, 'tue', '2026-11-17', 'queue/off-tue-burntokens', 1, 'Krish'], 'every approval that stands gets its row, once')
assert.equal(row.option.copy, 'Burning tokens', 'the row keeps the words his approval was bound to')
assert.equal((await rows(`select 1 from offday_items`)).length, 1)

const holds = async (doc, date) => (await one(`select public.board_approval_holds($1, $2::date, $3) as h`, [doc.split('/')[1], date, doc])).h
const move = p => db.query(`select public.offday_item_move($1::jsonb) as r`, [JSON.stringify(p)]).then(r => r.rows[0].r)
const NOT_APPROVED = /not_approved_by_krish/

// ── nothing reaches a day without his press ─────────────────────────────────────────────────────────────────────────────
await refused(`update offday_items set week = $1, day = 'thu', date = '2026-11-26', doc = 'queue/off-thu-burntokens' where item = $2`, [W2, ITEM], NOT_APPROVED,
  'a session cannot re-date an approved post')
await refused(`insert into offday_items (item, source, origin_week, option_id, option, state, week, day, date, doc, placed_by)
  values ('engine:${W1}:fresh', 'engine', $1, 'fresh', '{}', 'approved', $1, 'thu', '2026-11-19', 'queue/off-thu-fresh', 'Krish')`, [W1], NOT_APPROVED,
  'a row cannot be put on a day as approved without his approval for that day')
await refused(`update offday_items set state = 'later', week = null, day = null, date = null, doc = null, placed_by = 'growth' where item = $1`, [ITEM], /his_placement|check constraint/,
  'nobody but Krish takes a post he placed off its day')
await assert.rejects(move({ item: ITEM, version: 1, actor: 'engine_operator', state: 'approved', option_id: 'burntokens', place: { week: W2, day: 'thu' }, writes: [] }),
  /his_press/, 'a move by anyone but Krish is refused')
// A move that carries no approval for the new day is refused whole: the old day keeps its approval.
const leave = { week: W1, id: 'off-tue-burntokens', body: offBody(W1, 'tue', 'burntokens', { verdict: null, words: null, sha256: SHA('d') }, { moved: { to_week: W2, to_day: 'thu', at: '2026-11-12T09:01:00Z' } }), revision: await revOf(W1, 'off-tue-burntokens') }
await assert.rejects(move({ item: ITEM, version: 1, actor: 'Krish', state: 'approved', source: 'engine', origin_week: W1, option_id: 'burntokens', place: { week: W2, day: 'thu' }, writes: [leave] }),
  NOT_APPROVED, 'a move with no Approve for the new day is refused')
assert.equal(await holds('queue/off-tue-burntokens', '2026-11-17'), true, 'and nothing of it landed: Tuesday still holds')
assert.equal(Number((await one(`select version from offday_items where item = $1`, [ITEM])).version), 1)

// ── his move lands whole ────────────────────────────────────────────────────────────────────────────────────────────────
const arrive = { week: W2, id: 'off-thu-burntokens', body: offBody(W2, 'thu', 'burntokens', approve, { moved: { from_week: W1, from_day: 'tue', at: '2026-11-12T09:01:00Z' } }), revision: 0 }
const moved = await move({ item: ITEM, version: 1, actor: 'Krish', state: 'approved', source: 'engine', origin_week: W1, option_id: 'burntokens',
  option: row.option, place: { week: W2, day: 'thu' }, writes: [leave, arrive], words: null })
assert.deepEqual([moved.ok, Number(moved.version), moved.state, moved.week, moved.day, moved.date, moved.doc], [true, 2, 'approved', W2, 'thu', '2026-11-26', 'queue/off-thu-burntokens'])
assert.equal(await holds('queue/off-thu-burntokens', '2026-11-26'), true, 'his approval stands for the new day')
assert.equal(await holds('queue/off-tue-burntokens', '2026-11-17'), false, 'and no longer for the day it left')
assert.deepEqual((await rows(`select doc from board_approvals_now($1)`, [W1])).map(r => r.doc), [], 'the old week stands nothing for it')
assert.deepEqual((await rows(`select doc, day from board_approvals_now($1)`, [W2])).map(r => [r.doc, r.day]), [['queue/off-thu-burntokens', 'thu']])
const left = await one(`select outcome, via from idea_outcomes where doc = 'queue/off-tue-burntokens' order by id desc limit 1`)
assert.deepEqual([left.outcome, left.via], ['withdrawn', 'offday'], 'the day it left records his approval taken back')
// Two writers at once: the second names the version it saw, and is told the item moved.
const stale = await move({ item: ITEM, version: 1, actor: 'Krish', state: 'approved', source: 'engine', origin_week: W1, option_id: 'burntokens', place: { week: W2, day: 'sat' }, writes: [] })
assert.deepEqual([stale.ok, stale.error, Number(stale.version)], [false, 'stale', 2], 'a move on an old version is refused, and says the version now')
// A revision that changed under the move refuses all of it.
await assert.rejects(move({ item: ITEM, version: 2, actor: 'Krish', state: 'approved', source: 'engine', origin_week: W1, option_id: 'burntokens', place: { week: W2, day: 'sat' },
  writes: [{ ...arrive, body: { ...arrive.body, idea: { verdict: null, words: null, sha256: SHA('d') }, moved: { to_week: W2, to_day: 'sat' } }, revision: 0 }] }), /revision_conflict/)
assert.equal((await one(`select day from offday_items where item = $1`, [ITEM])).day, 'thu')

// ── back to his Ideas for Later, and from there onto a day ────────────────────────────────────────────────────────────
const toLater = await move({ item: ITEM, version: 2, actor: 'Krish', state: 'later', source: 'engine', origin_week: W1, option_id: 'burntokens', place: null,
  writes: [{ week: W2, id: 'off-thu-burntokens', body: offBody(W2, 'thu', 'burntokens', { verdict: 'next_week', words: null, sha256: SHA('d'), at: '2026-11-12T09:02:00Z' }, { moved: { to: 'later' } }), revision: await revOf(W2, 'off-thu-burntokens') }] })
assert.deepEqual([toLater.ok, toLater.state, toLater.week, toLater.date], [true, 'later', null, null])
assert.equal((await one(`select outcome from idea_outcomes where doc = 'queue/off-thu-burntokens' and week = $1 order by id desc limit 1`, [W2])).outcome, 'filed',
  'Back to Ideas for Later is his File for later')
assert.deepEqual((await rows(`select doc from board_approvals_now($1)`, [W2])).map(r => r.doc), [])
const fromLater = await move({ item: ITEM, version: 3, actor: 'Krish', state: 'approved', source: 'engine', origin_week: W1, option_id: 'burntokens', place: { week: W2, day: 'sat' },
  writes: [{ week: W2, id: 'off-sat-burntokens', body: offBody(W2, 'sat', 'burntokens', approve), revision: 0 }] })
assert.deepEqual([fromLater.ok, Number(fromLater.version), fromLater.date], [true, 4, '2026-11-28'])

// ── Growth's options come in offered, and never over his ──────────────────────────────────────────────────────────────
const offer = items => db.query(`select public.offday_items_offer($1, 'growth', $2::jsonb) as r`, [W2, JSON.stringify(items)]).then(r => r.rows[0].r)
const GROWTH = `growth:${W2}:ai-intern`
const first = await offer([{ item: GROWTH, option_id: 'ai-intern', day: 'tue', option: { id: 'ai-intern', format: 'Meme, 1 image, 4:5', copy: 'The AI intern', source: 'Growth: memes' } },
  { item: `growth:${W2}:burntokens`, option_id: 'burntokens', day: 'sat', option: { id: 'burntokens', copy: 'Clash' } }])
assert.deepEqual([first.offered, first.taken], [1, 1], 'an option on a document he already holds is refused, never written over his')
const g = await one(`select state, day, placed_by from offday_items where item = $1`, [GROWTH])
assert.deepEqual([g.state, g.day, g.placed_by], ['offered', 'tue', 'growth'], 'Growth offers; only his press approves')
assert.equal(await holds(`queue/off-tue-ai-intern`, '2026-11-24'), false)
// His move on a Growth option is his Approve for the day he chose.
const pickG = await move({ item: GROWTH, version: 1, actor: 'Krish', state: 'approved', source: 'growth', origin_week: W2, option_id: 'ai-intern', place: { week: W2, day: 'wed' },
  writes: [{ week: W2, id: 'off-wed-ai-intern', body: offBody(W2, 'wed', 'ai-intern', approve), revision: 0 }] })
assert.deepEqual([pickG.ok, pickG.date], [true, '2026-11-25'], 'a publishing day can carry an off-day post')
// Growth writing its options again never moves what he placed; one it drops that he never pressed is withdrawn.
const again = await offer([])
assert.deepEqual([again.withdrawn], [0], 'his approved Growth option is his now')
const other = `growth:${W2}:spare`
await offer([{ item: other, option_id: 'spare', day: 'thu', option: { id: 'spare', copy: 'Spare' } }])
const dropped = await offer([])
assert.equal(dropped.withdrawn, 1)
assert.equal((await one(`select state from offday_items where item = $1`, [other])).state, 'withdrawn', 'withdrawn, never deleted')
assert.equal((await one(`select state, day from offday_items where item = $1`, [GROWTH])).day, 'wed')

// ── a piece he records moves with it, through the content_ideas gate ─────────────────────────────────────────────────
const P = (await one(`insert into content_ideas (idea, state, meta) values ('Recorded', 'drafting', $1::jsonb) returning id`,
  [JSON.stringify({ offday: { doc: 'queue/off-tue-rec', date: '2026-11-24' } })])).id
const rec = (day, approved) => ({ use: 'offday', pick: `off-${day}-rec`, day, week: W2, option_id: 'rec', kind: 'recorded', piece_id: P, approved, copy_sha256: SHA('c'),
  series: 'mind_the_gap', style: 'to_camera', script: 'Words.', script_sha256: SHA('e'), folder_title: 'Rec', title: 'Rec' })
await save(W2, 'off-tue-rec', rec('tue', true))
await db.query(`update content_ideas set scheduled_for = '2026-11-24' where id = $1`, [P])
await refused(`update content_ideas set scheduled_for = '2026-11-26' where id = $1`, [P], NOT_APPROVED, 'a recorded piece is never re-dated without his press')
const REC = `engine:${W2}:rec`
const recMove = await move({ item: REC, version: 0, actor: 'Krish', state: 'approved', source: 'engine', origin_week: W2, option_id: 'rec', piece_id: P, place: { week: W2, day: 'thu' },
  writes: [{ week: W2, id: 'off-tue-rec', body: { ...rec('tue', false), moved: { to_week: W2, to_day: 'thu' } }, revision: await revOf(W2, 'off-tue-rec') },
    { week: W2, id: 'off-thu-rec', body: rec('thu', true), revision: 0 }] })
assert.equal(recMove.ok, true)
const recRow = await one(`select scheduled_for::text d, meta from content_ideas where id = $1`, [P])
assert.deepEqual([recRow.d, recRow.meta.offday.doc, recRow.meta.offday.date], ['2026-11-26', 'queue/off-thu-rec', '2026-11-26'], 'its piece moved with it')
assert.equal(await holds('queue/off-tue-rec', '2026-11-24'), false)

// ── Growth's posting record lives on the item ─────────────────────────────────────────────────────────────────────
await db.query(`update offday_items set posts = $1::jsonb where item = $2`, [JSON.stringify([{ state: 'live', channel: 'instagram', url: 'https://www.instagram.com/p/x', at: '2026-11-28T17:34:00Z' }]), ITEM])
assert.equal((await one(`select posts->0->>'state' s from offday_items where item = $1`, [ITEM])).s, 'live', 'the posts column holds Growth\'s record')
await refused(`update offday_items set posts = '{}'::jsonb where item = $1`, [ITEM], /check constraint/, 'its record is a list')

// ── every move is kept, append only ──────────────────────────────────────────────────────────────────────────────────
const log = await rows(`select item, version, from_day, to_state, to_day, moved_by from offday_moves order by id`)
assert.deepEqual(log.map(m => [m.item, Number(m.version), m.from_day, m.to_state, m.to_day, m.moved_by]), [
  [ITEM, 2, 'tue', 'approved', 'thu', 'Krish'],
  [ITEM, 3, 'thu', 'later', null, 'Krish'],
  [ITEM, 4, null, 'approved', 'sat', 'Krish'],
  [GROWTH, 2, 'tue', 'approved', 'wed', 'Krish'],
  [REC, 1, null, 'approved', 'thu', 'Krish'],
])
await refused(`update offday_moves set to_day = 'mon'`, [], /append only|permission denied/, 'his moves are never changed')
await refused(`delete from offday_moves`, [], /append only|permission denied/, 'his moves are never removed')
// The board hears both weeks.
await db.exec('reset role')
const signal = await rows(`select week::text, source from board_signal order by week`)
assert.ok(signal.some(s => s.week === W1) && signal.some(s => s.week === W2), 'both weeks are told')

await db.close()
console.log('offday items: no day without his press; his move lands whole on both weeks; Growth offers, never places; moves append only')
