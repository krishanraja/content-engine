// A series piece's move and a replacing Approve, run against the real migrations in a real database
// (supabase/migrations/20261201100000_series_piece_moves.sql; docs/PUBLISH_BOARDS.md, "Replacing a day's piece, and
// Move to… on a series piece"). Krish, 13 Nov 2026: "There is no approve button."
//
//   node tests/series-moves-db.mjs /abs/path/@electric-sql/pglite/dist/index.js
//
// Every way a series piece could reach a day without his press is tried and refused: a session re-dating it, a move by
// anyone but Krish, a placement saved by another writer, a move that carries no approval for the new day, a stale
// piece. Then his presses land whole: the replacing Approve puts the new idea on the day and the old piece where he
// chose, a moved piece's old pick no longer holds it anywhere, back to later is his File for later, alongside keeps
// both, and every move is kept append only.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const [modulePath] = process.argv.slice(2)
if (!modulePath) {
  console.error('usage: node tests/series-moves-db.mjs <path to @electric-sql/pglite/dist/index.js>')
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
    lane_slot text, scheduled_for date, buried_at timestamptz, protected_at timestamptz, meta jsonb default '{}'::jsonb, updated_at timestamptz default now());
  grant select, insert, update on public.content_ideas to service_role;`)
const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
for (const m of ['20261019120743_publish_board_web.sql', '20261126090000_ideas_gate.sql', '20261125090000_board_signal.sql', '20261129090000_offday_items.sql',
  '20261129100000_offday_items_posts.sql', '20261130090000_offday_one_post.sql']) await db.exec(await migration(m))

const W = '2026-11-16', W2 = '2026-11-23'
const OLD = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118', NEW = 'c00cd4e0-e1bb-4c60-b36f-cea92897e38c', WED = 'db9f9f6a-1092-49be-8024-f335e060305a'
const rows = async (sql, p = []) => (await db.query(sql, p)).rows
const one = async (sql, p = []) => (await rows(sql, p))[0]
const revOf = async (week, id) => Number((await one(`select revision from board_documents where week = $1 and collection = 'picks' and doc_id = $2`, [week, id]))?.revision || 0)
const save = async (week, id, body, actor = 'Krish') => {
  const r = (await db.query(`select public.board_save($1, 'picks', $2, $3::jsonb, $4, $5) as r`, [week, id, JSON.stringify(body), await revOf(week, id), actor])).rows[0].r
  assert.equal(r.ok, true, `board_save ${id}: ${JSON.stringify(r)}`)
}
const pick = (day, id) => ({ day, pick: `${day}-1`, idea_id: id, series: 'mind_the_gap', story: 'Story.', so_what: 'So what.', option_sha256: 'a'.repeat(64) })
const stood = async week => (await rows(`select idea_id, day, via from board_approvals_now($1) order by day, via`, [week])).map(r => `${r.day}:${r.idea_id.slice(0, 4)}:${r.via}`)
const place = p => db.query(`select public.series_piece_place($1::jsonb) as r`, [JSON.stringify(p)]).then(r => r.rows[0].r)
const at = async id => (await one(`select scheduled_for::text d, updated_at::text u, state from content_ideas where id = $1`, [id]))
const NOT_APPROVED = /not_approved_by_krish/

// Before: his picks of 9 Nov hold Fri 20 (the data-centre piece) and Wed 18; The Great Recount is an idea for later.
await db.exec(`insert into content_ideas (id, idea, state, lane_slot) values ('${OLD}', 'Data centres', 'drafting', 'mind_the_gap'),
  ('${NEW}', 'The Great Recount', 'seeded', 'mind_the_gap'), ('${WED}', 'Wednesday', 'drafting', 'under_the_hood')`)
await save(W, 'fri', pick('fri', OLD))
await save(W, 'wed', pick('wed', WED))
await db.exec(await migration('20261201100000_series_piece_moves.sql'))
await db.exec(await migration('20261201100000_series_piece_moves.sql')) // re-runnable
await db.exec(`set role service_role`)
await db.exec(`update content_ideas set scheduled_for = '2026-11-20' where id = '${OLD}'; update content_ideas set scheduled_for = '2026-11-18' where id = '${WED}'`)
assert.deepEqual(await stood(W), [`fri:${OLD.slice(0, 4)}:pick`, `wed:${WED.slice(0, 4)}:pick`])

// ── nothing reaches a day without his press ─────────────────────────────────────────────────────────────────────────
await assert.rejects(db.query(`update content_ideas set scheduled_for = '2026-11-17' where id = $1`, [OLD]), NOT_APPROVED, 'a session cannot re-date a series piece')
await assert.rejects(place({ actor: 'engine_operator', kind: 'move', writes: [], pieces: [] }), /his_press/, 'a move by anyone but Krish is refused')
// A placement another writer saves is no approval: the move it would carry is refused.
const u = (await at(OLD)).u
await save(W, `place-tue-${OLD}`, { kind: 'place_piece', piece_id: OLD, placed: true }, 'engine_operator')
await assert.rejects(place({ actor: 'Krish', kind: 'move', writes: [], pieces: [{ id: OLD, updated_at: u, scheduled_for: '2026-11-17', to_place: 'day' }] }), NOT_APPROVED,
  'a placement saved by another writer is not his approval')
// A day's pick changes only with a replacing Approve.
await assert.rejects(place({ actor: 'Krish', kind: 'move', writes: [{ week: W, id: 'fri', body: pick('fri', NEW), revision: await revOf(W, 'fri') }], pieces: [] }), /invalid_move/)
assert.equal((await at(OLD)).d, '2026-11-20', 'and nothing of it landed')

// ── his replacing Approve on Fri 20: The Great Recount on Friday, the data-centre piece brought forward to Tue 17 ──
const before = { old: await at(OLD), fresh: await at(NEW) }
const swap = {
  actor: 'Krish', kind: 'replace', words: null,
  writes: [
    { week: W, id: 'fri', body: { ...pick('fri', NEW), replaced: { piece_id: OLD, to: '2026-11-17' } }, revision: await revOf(W, 'fri') },
    { week: W, id: `place-fri-${OLD}`, body: { kind: 'place_piece', piece_id: OLD, placed: false, moved: { to_date: '2026-11-17' } }, revision: 0 },
    { week: W, id: `place-tue-${OLD}`, body: { kind: 'place_piece', piece_id: OLD, placed: true, moved: { from_date: '2026-11-20' } }, revision: await revOf(W, `place-tue-${OLD}`) },
  ],
  pieces: [
    { id: OLD, updated_at: before.old.u, scheduled_for: '2026-11-17', kind: 'replaced', from_date: '2026-11-20', to_place: 'day' },
    { id: NEW, updated_at: before.fresh.u, scheduled_for: '2026-11-20', state: 'drafting', lane_slot: 'mind_the_gap', protect: true, kind: 'replace', to_place: 'day' },
  ],
}
// A stale piece refuses all of it.
await assert.rejects(place({ ...swap, pieces: [{ ...swap.pieces[0], updated_at: '2020-01-01T00:00:00Z' }, swap.pieces[1]] }), /stale_piece/)
assert.deepEqual(await stood(W), [`fri:${OLD.slice(0, 4)}:pick`, `wed:${WED.slice(0, 4)}:pick`], 'a refused swap changes no approval')
const done = await place(swap)
assert.equal(done.ok, true)
assert.equal((await at(OLD)).d, '2026-11-17')
assert.deepEqual([(await at(NEW)).d, (await at(NEW)).state], ['2026-11-20', 'drafting'])
assert.ok((await one(`select protected_at from content_ideas where id = $1`, [NEW])).protected_at, 'his pick protects the new piece, as a pick does')
assert.deepEqual(await stood(W), [`fri:${NEW.slice(0, 4)}:pick`, `tue:${OLD.slice(0, 4)}:placed`, `wed:${WED.slice(0, 4)}:pick`])
const outs = await rows(`select doc, outcome, via from idea_outcomes where idea_id = $1 and week = $2 order by id`, [OLD, W])
assert.deepEqual(outs.slice(-2).map(o => [o.doc, o.outcome, o.via]), [[`picks/place-fri-${OLD}`, 'withdrawn', 'placed'], [`picks/place-tue-${OLD}`, 'approved', 'placed']])
assert.deepEqual((await rows(`select piece_id::text p, kind, to_place from series_moves order by id`)).map(r => [r.p.slice(0, 4), r.kind, r.to_place]),
  [[OLD.slice(0, 4), 'replaced', 'day'], [NEW.slice(0, 4), 'replace', 'day']])

// ── a moved piece's old pick no longer holds it: Wednesday's piece to Thu 19, and a session cannot put it back ────────
const wedU = (await at(WED)).u
await place({ actor: 'Krish', kind: 'move', writes: [
  { week: W, id: `place-wed-${WED}`, body: { kind: 'place_piece', piece_id: WED, placed: false, moved: { to_date: '2026-11-19' } }, revision: 0 },
  { week: W, id: `place-thu-${WED}`, body: { kind: 'place_piece', piece_id: WED, placed: true }, revision: 0 },
], pieces: [{ id: WED, updated_at: wedU, scheduled_for: '2026-11-19', kind: 'move', from_date: '2026-11-18', to_place: 'day' }] })
assert.deepEqual(await stood(W), [`fri:${NEW.slice(0, 4)}:pick`, `thu:${WED.slice(0, 4)}:placed`, `tue:${OLD.slice(0, 4)}:placed`], 'his Wednesday pick is superseded by the move')
await assert.rejects(db.query(`update content_ideas set scheduled_for = '2026-11-18' where id = $1`, [WED]), NOT_APPROVED, 'so nothing but his press puts it back on Wednesday')

// ── across weeks, back to later, and alongside ─────────────────────────────────────────────────────────────────────
const oldU = (await at(OLD)).u
await place({ actor: 'Krish', kind: 'move', writes: [
  { week: W, id: `place-tue-${OLD}`, body: { kind: 'place_piece', piece_id: OLD, placed: false, moved: { to_date: '2026-11-24' } }, revision: await revOf(W, `place-tue-${OLD}`) },
  { week: W2, id: `place-tue-${OLD}`, body: { kind: 'place_piece', piece_id: OLD, placed: true }, revision: 0 },
], pieces: [{ id: OLD, updated_at: oldU, scheduled_for: '2026-11-24', kind: 'move', from_date: '2026-11-17', to_place: 'day' }] })
assert.equal((await at(OLD)).d, '2026-11-24')
assert.ok(!(await stood(W)).some(s => s.startsWith('tue:')), 'the week it left stands nothing for it')
assert.deepEqual(await stood(W2), [`tue:${OLD.slice(0, 4)}:placed`])
await place({ actor: 'Krish', kind: 'move', writes: [
  { week: W2, id: `place-tue-${OLD}`, body: { kind: 'place_piece', piece_id: OLD, placed: false, later: true, moved: { to: 'later' } }, revision: await revOf(W2, `place-tue-${OLD}`) },
], pieces: [{ id: OLD, updated_at: (await at(OLD)).u, scheduled_for: null, kind: 'move', from_date: '2026-11-24', to_place: 'later' }] })
assert.equal((await at(OLD)).d, null)
assert.equal((await one(`select outcome from idea_outcomes where doc = $1 and week = $2 order by id desc limit 1`, [`picks/place-tue-${OLD}`, W2])).outcome, 'filed',
  'back to his Ideas for Later is his File for later')
assert.deepEqual(await stood(W2), [])
// Alongside: his Approve of another idea on Fri 20 keeps The Great Recount there beside it, both approved.
const third = '11111111-2222-4333-8444-555555555555'
await db.exec(`reset role; insert into content_ideas (id, idea, state, lane_slot) values ('${third}', 'Third', 'seeded', 'mind_the_gap'); set role service_role`)
await place({ actor: 'Krish', kind: 'replace', writes: [
  { week: W, id: 'fri', body: pick('fri', third), revision: await revOf(W, 'fri') },
  { week: W, id: `place-fri-${NEW}`, body: { kind: 'place_piece', piece_id: NEW, placed: true, alongside: third }, revision: 0 },
], pieces: [
  { id: NEW, updated_at: (await at(NEW)).u, scheduled_for: '2026-11-20', kind: 'replaced', from_date: '2026-11-20', to_place: 'alongside' },
  { id: third, updated_at: (await at(third)).u, scheduled_for: '2026-11-20', state: 'drafting', kind: 'replace', to_place: 'day' },
] })
assert.deepEqual((await stood(W)).filter(s => s.startsWith('fri:')).sort(), [`fri:${NEW.slice(0, 4)}:placed`, `fri:${third.slice(0, 4)}:pick`].sort())
assert.deepEqual([(await at(NEW)).d, (await at(third)).d], ['2026-11-20', '2026-11-20'])

// Alongside keeps his Approve for publish on that day (the reviewer's case): The Great Recount's publish approval, saved
// before a fourth idea replaces Friday's pick, still stands after it is kept alongside.
await save(W, 'fri-publish', { kind: 'approve_publish', piece_id: NEW, approved: true })
const fourth = '22222222-3333-4444-8555-666666666666'
await db.exec(`reset role; insert into content_ideas (id, idea, state, lane_slot) values ('${fourth}', 'Fourth', 'seeded', 'mind_the_gap'); set role service_role`)
await place({ actor: 'Krish', kind: 'replace', writes: [
  { week: W, id: 'fri', body: pick('fri', fourth), revision: await revOf(W, 'fri') },
  { week: W, id: `place-fri-${NEW}`, body: { kind: 'place_piece', piece_id: NEW, placed: true, alongside: fourth, again: true }, revision: await revOf(W, `place-fri-${NEW}`) },
], pieces: [
  { id: NEW, updated_at: (await at(NEW)).u, scheduled_for: '2026-11-20', kind: 'replaced', to_place: 'alongside' },
  { id: fourth, updated_at: (await at(fourth)).u, scheduled_for: '2026-11-20', state: 'drafting', kind: 'replace', to_place: 'day' },
] })
assert.ok((await stood(W)).includes(`fri:${NEW.slice(0, 4)}:approve_publish`), 'kept alongside, its Approve for publish on that day stands')

// His Approve again on the day a piece was moved from, with the same words, is a new approval (the reviewer's case):
// Wednesday's piece went to Thu 19 by his move; his same pick for Wednesday saved again puts it back.
await save(W, 'wed', { ...pick('wed', WED), again: true })
await save(W, 'wed', pick('wed', WED))
assert.ok((await stood(W)).includes(`wed:${WED.slice(0, 4)}:pick`), 'the same pick pressed again after a move stands again')

// ── his moves are kept append only ─────────────────────────────────────────────────────────────────────────────────
await db.exec('reset role')
await assert.rejects(db.query(`delete from series_moves`), /append only/)
await assert.rejects(db.query(`update series_moves set to_place = 'day'`), /append only/)
await assert.rejects(db.query(`insert into series_moves (piece_id, kind, to_place, moved_by) values ($1, 'move', 'day', 'engine_operator')`, [OLD]), /check/)
console.log('series moves: every refusal holds and his presses land whole on the real migration')
