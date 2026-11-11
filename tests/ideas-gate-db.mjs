// The ideas gate, run against the real migrations in a real database (supabase/migrations/20261126090000_ideas_gate.sql;
// docs/PUBLISH_BOARDS.md, "The ideas gate"). Krish, 2026-11-11: "The ideas board-to-publish board process should be
// bulletproof. I shouldn't end up seeing random ideas in the publish board that I never wanted there and that I didn't
// approve to move to the publish board."
//
//   node tests/ideas-gate-db.mjs /abs/path/@electric-sql/pglite/dist/index.js
//
// Every way a piece can reach a day is tried without his approval and refused: a new row on a day, a row moved onto a
// day, a row moved to another day, a buried or dropped row brought back, an off-day piece by its option, a press saved by
// anyone but Krish, a forged ledger row. Then his Approve lets exactly that piece onto exactly that day, and nothing
// else: not another piece, not another day, not a second row by the same off-day approval. The ledger keeps every
// answer, append only, with who, when and his words.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const [modulePath] = process.argv.slice(2)
if (!modulePath) {
  console.error('usage: node tests/ideas-gate-db.mjs <path to @electric-sql/pglite/dist/index.js>')
  process.exit(2)
}
const { PGlite } = await import(pathToFileURL(modulePath).href)
const db = new PGlite()
const SETUP = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
  end $$;
  grant usage on schema public to service_role;
  create table public.content_ideas (id uuid primary key default gen_random_uuid(), idea text, state text default 'seeded',
    lane_slot text, scheduled_for date, buried_at timestamptz, meta jsonb default '{}'::jsonb, updated_at timestamptz default now());
  grant select, insert, update on public.content_ideas to service_role;`
await db.exec(SETUP)
await db.exec(await readFile(new URL('../supabase/migrations/20261019120743_publish_board_web.sql', import.meta.url), 'utf8'))

// One press he saved before the gate existed: it is recorded once, from board_history, when the migration runs.
const WEEK = '2026-11-16'
const OLD = '8287846b-6618-4a19-9fb8-23ad4eca2718'
const save = async (doc, body, actor = 'Krish', week = WEEK) => {
  const [collection, id] = doc.split('/')
  const cur = (await db.query(`select revision from board_documents where week = $1 and collection = $2 and doc_id = $3`, [week, collection, id])).rows[0]
  const r = (await db.query(`select public.board_save($1, $2, $3, $4::jsonb, $5, $6) as r`, [week, collection, id, JSON.stringify(body), cur ? Number(cur.revision) : 0, actor])).rows[0].r
  assert.equal(r.ok, true, `board_save ${doc}: ${JSON.stringify(r)}`)
  return r
}
await save('picks/mon', { day: 'mon', pick: 'mon-2', idea_id: OLD, series: 'follow_the_money', story: 'Headline: Oracle raises $20bn.' })

const migration = await readFile(new URL('../supabase/migrations/20261126090000_ideas_gate.sql', import.meta.url), 'utf8')
await db.exec(migration)
await db.exec(migration) // re-runnable: the backfill records nothing twice
await db.exec('set role service_role')

const rows = async (sql, p = []) => (await db.query(sql, p)).rows
const one = async (sql, p = []) => (await rows(sql, p))[0]
const refused = async (sql, p, code, why) => {
  await assert.rejects(db.query(sql, p), (e) => { assert.match(String(e.message), code, why); return true }, why)
}
const NOT_APPROVED = /not_approved_by_krish/
const newIdea = async (idea, extra = {}) => (await one(`insert into content_ideas (idea, state, meta) values ($1, 'seeded', $2) returning id`,
  [idea, JSON.stringify(extra.meta || {})])).id

// ── what he said before the gate is kept ──────────────────────────────────────────────────────────────────────────────
const backfilled = await rows(`select * from idea_outcomes where source = 'board_history_backfill'`)
assert.equal(backfilled.length, 1, 'his earlier pick is recorded once, even when the migration runs twice')
assert.deepEqual([backfilled[0].outcome, backfilled[0].idea_id, backfilled[0].via, backfilled[0].doc, backfilled[0].decided_by],
  ['approved', OLD, 'pick', 'picks/mon', 'Krish'])
assert.equal(backfilled[0].option_sha256, null, 'a pick saved before the gate carries no option hash: its text was not bound')
await db.query(`insert into content_ideas (id, idea, state) values ($1, 'Oracle', 'seeded')`, [OLD])
await db.query(`update content_ideas set scheduled_for = '2026-11-16', state = 'drafting' where id = $1`, [OLD])
assert.equal((await one(`select scheduled_for::text d from content_ideas where id = $1`, [OLD])).d, '2026-11-16', 'his earlier pick still places its piece')

// ── every route without his approval is refused ───────────────────────────────────────────────────────────────────────
const A = await newIdea('Idea A'), B = await newIdea('Idea B')
await refused(`update content_ideas set scheduled_for = '2026-11-18' where id = $1`, [A], NOT_APPROVED, 'a session cannot move an idea onto a day')
await refused(`insert into content_ideas (idea, scheduled_for) values ('Straight onto Friday', '2026-11-20')`, [], NOT_APPROVED,
  'a new row cannot be created on a day')
await refused(`update content_ideas set scheduled_for = '2026-11-18' where id = $1`, [OLD], NOT_APPROVED,
  'an approved piece cannot be moved to another day without an approval for that day')
// A piece on a day that is buried or dropped cannot be brought back without an approval.
const C = await newIdea('Idea C')
// (Set up as the owner with the gate off: how a piece buried on a day before the gate would look.)
await db.exec('reset role')
await db.query(`alter table content_ideas disable trigger content_ideas_board_gate`)
await db.query(`update content_ideas set scheduled_for = '2026-11-20', buried_at = now() where id = $1`, [C])
await db.query(`alter table content_ideas enable trigger content_ideas_board_gate`)
await db.exec('set role service_role')
await refused(`update content_ideas set buried_at = null where id = $1`, [C], NOT_APPROVED, 'a buried piece on a day cannot come back unapproved')
// A press by anyone but Krish approves nothing (the routes refuse it too: hisOnlyRefusal).
await save('picks/wed', { day: 'wed', pick: 'wed-1', idea_id: A, series: 'under_the_hood', story: 'Headline: A.' }, 'engine_operator')
assert.equal((await rows(`select * from idea_outcomes where doc = 'picks/wed'`)).length, 0, 'a session\'s pick is not an approval')
await refused(`update content_ideas set scheduled_for = '2026-11-18' where id = $1`, [A], NOT_APPROVED, 'a session\'s pick places nothing')
// The ledger cannot be written by hand, changed or emptied.
await refused(`insert into idea_outcomes (week, day, date, idea_id, doc, revision, outcome, via, decided_by, decided_at, source)
  values ('2026-11-16', 'wed', '2026-11-18', $1, 'picks/wed', 99, 'approved', 'pick', 'Krish', now(), 'publish_board')`, [A], /not_his_press|permission denied/,
  'a forged approval naming no press of his is refused')
await db.exec('reset role')
await refused(`insert into idea_outcomes (week, day, date, idea_id, doc, revision, outcome, via, decided_by, decided_at, source)
  values ('2026-11-16', 'wed', '2026-11-18', $1, 'picks/wed', 1, 'approved', 'pick', 'Krish', now(), 'publish_board')`, [A], /not_his_press/,
  'even the owner cannot record an approval for a revision Krish did not save')
await refused(`update idea_outcomes set outcome = 'rejected'`, [], /append only/, 'his answers are never changed')
await refused(`delete from idea_outcomes`, [], /append only/, 'his answers are never removed')
await refused(`truncate idea_outcomes`, [], /append only/, 'his answers are never emptied')
await db.exec('set role service_role')

// ── his Approve lets exactly that piece onto exactly that day ─────────────────────────────────────────────────────────
const SHA = 'a'.repeat(64)
await save('picks/wed', { day: 'wed', pick: 'wed-1', idea_id: A, series: 'under_the_hood', story: 'Headline: A.', so_what: 'A matters.', option_sha256: SHA, note: 'Lead with the money.' })
const approval = await one(`select * from idea_outcomes where doc = 'picks/wed' order by id desc limit 1`)
assert.deepEqual([approval.outcome, approval.idea_id, approval.date.toISOString().slice(0, 10), approval.option_sha256, approval.words, approval.decided_by, approval.source],
  ['approved', A, '2026-11-18', SHA, 'Lead with the money.', 'Krish', 'publish_board'], 'his Approve is recorded with the idea, the day, the text hash, his words and who')
await db.query(`update content_ideas set scheduled_for = '2026-11-18', state = 'drafting' where id = $1`, [A])
await refused(`update content_ideas set scheduled_for = '2026-11-18' where id = $1`, [B], NOT_APPROVED, 'an approval for one idea is never reused for another')
await refused(`update content_ideas set scheduled_for = '2026-11-20' where id = $1`, [A], NOT_APPROVED, 'an approval for one day is never reused for another day')
// A new pick for the day replaces the old one: the old idea's approval no longer stands for a new placement.
await save('picks/wed', { day: 'wed', pick: 'wed-2', idea_id: B, series: 'under_the_hood', story: 'Headline: B.', so_what: 'B matters.', option_sha256: 'b'.repeat(64) })
assert.deepEqual((await rows(`select idea_id from board_approvals_now('2026-11-16') where day = 'wed'`)).map(r => r.idea_id), [B])
await db.query(`update content_ideas set scheduled_for = null where id = $1`, [A])
await refused(`update content_ideas set scheduled_for = '2026-11-18' where id = $1`, [A], NOT_APPROVED, 'a replaced pick places nothing again')
await db.query(`update content_ideas set scheduled_for = '2026-11-18', state = 'drafting' where id = $1`, [B])
// Taking a piece off a day is never refused.
await db.query(`update content_ideas set scheduled_for = null where id = $1`, [B])
// A press with a story longer than the ledger keeps whole still saves: its approval keeps the hash, never fails his press.
await save('picks/fri', { day: 'fri', pick: 'fri-1', idea_id: B, series: 'mind_the_gap', story: 'x'.repeat(30000), so_what: 'Long.', option_sha256: 'e'.repeat(64) })
const long = await one(`select shown, option_sha256 from idea_outcomes where doc = 'picks/fri' order by id desc limit 1`)
assert.deepEqual([long.shown, long.option_sha256], [null, 'e'.repeat(64)])

// ── off days: by the piece, or by the option's own approval, once ─────────────────────────────────────────────────────
const off = (verdict, words = null) => ({ use: 'offday', pick: 'off-sat-goodnews', day: 'sat', week: WEEK, option_id: 'goodnews',
  copy_sha256: 'c'.repeat(64), idea: { verdict, words, sha256: 'd'.repeat(64) } })
const G1 = await newIdea('Good news', { meta: { offday: { doc: 'queue/off-sat-goodnews', date: '2026-11-21' } } })
const G2 = await newIdea('Good news again', { meta: { offday: { doc: 'queue/off-sat-goodnews', date: '2026-11-21' } } })
await refused(`update content_ideas set scheduled_for = '2026-11-21' where id = $1`, [G1], NOT_APPROVED, 'an off-day option he has not approved places nothing')
await save('queue/off-sat-goodnews', off('improve', 'Use real photos.'))
assert.equal((await one(`select outcome, words from idea_outcomes where doc = 'queue/off-sat-goodnews' order by id desc limit 1`)).outcome, 'improved')
await refused(`update content_ideas set scheduled_for = '2026-11-21' where id = $1`, [G1], NOT_APPROVED, 'an Improve is not an approval')
await save('queue/off-sat-goodnews', off('approve'))
await db.query(`update content_ideas set scheduled_for = '2026-11-21' where id = $1`, [G1])
await refused(`update content_ideas set scheduled_for = '2026-11-21' where id = $1`, [G2], NOT_APPROVED, 'one off-day approval places one piece, never a second')
await save('queue/off-sat-goodnews', off('reject', 'Not uplifting.'))
await db.query(`update content_ideas set scheduled_for = null where id = $1`, [G1])
await refused(`update content_ideas set scheduled_for = '2026-11-21' where id = $1`, [G1], NOT_APPROVED, 'a Reject after an Approve takes the approval away')

// ── the five outcomes, append only, with his words ────────────────────────────────────────────────────────────────────
const press = (pick, use, extra = {}) => ({ pick, use, queued: true, idea_id: B, so_what: 'B matters.', story: 'Headline: B.', ...extra })
await save('queue/fri-1', press('fri-1', 'next_week', { target_week: '2026-11-23' }))
await save('queue/fri-2', press('fri-2', 'not_for_us', { reason: 'We did this last month.' }))
await save('queue/fri-3', press('fri-3', 'wider_piece_context', { note: 'AI money pressure' }))
await save('queue/fri-4', press('fri-4', 'improve', { note: 'Find the person it happened to.' }))
await save('queue/fri-4', press('fri-4', null))
const fri = await rows(`select doc, outcome, words from idea_outcomes where doc like 'queue/fri-%' order by id`)
assert.deepEqual(fri.map(r => [r.doc, r.outcome, r.words]), [
  ['queue/fri-1', 'filed', null],
  ['queue/fri-2', 'rejected', 'We did this last month.'],
  ['queue/fri-3', 'trend', 'AI money pressure'],
  ['queue/fri-4', 'improved', 'Find the person it happened to.'],
  ['queue/fri-4', 'withdrawn', null],
], 'every answer is kept in order: filed, rejected with his reason, a trend with its name, improved with his note, a press taken back')
// The same answer saved again (a note added) records nothing twice.
await save('queue/fri-2', press('fri-2', 'not_for_us', { reason: 'We did this last month.', at: '2026-11-11T10:00:00Z' }))
assert.equal((await rows(`select 1 from idea_outcomes where doc = 'queue/fri-2'`)).length, 1)

await db.close()
console.log('ideas gate: every unapproved route refused; his Approve places exactly its piece on exactly its day; answers append only')
