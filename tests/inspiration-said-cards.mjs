// "Say it" ideas become Inspiration cards (supabase/migrations/20261118093200_inspiration_said_cards.sql, W3.2),
// executed in disposable PostgreSQL (PGlite). The card table comes from its own migration (the taste ledger's
// section 9); the said door's table and the card columns later migrations added are stubbed as they are live.
// node tests/inspiration-said-cards.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const db = new PGlite()
await db.exec('create role anon; create role authenticated;')
await db.exec(`create table public.content_ideas (id uuid primary key);
  create table public.said_parts (id uuid primary key default gen_random_uuid(), kind text not null, excerpt text not null,
    title text not null, about text, landed_table text, landed_id text, created_at timestamptz not null default now());`)
const ledger = await migration('20261104090000_taste_ledger.sql')
await db.exec(ledger.slice(ledger.indexOf('create table public.inspiration_items ('), ledger.indexOf('-- 10. Access')))
await db.exec(`alter table public.inspiration_items
  add column facets jsonb not null default '{}'::jsonb check (jsonb_typeof(facets) = 'object'),
  add column kind text check (kind is null or kind in ('video', 'image', 'feed', 'corpus', 'idea', 'document')),
  add column kind_source text check (kind_source is null or kind_source in ('rule', 'model', 'krish')),
  add constraint inspiration_items_kind_has_source check ((kind is null) = (kind_source is null));`)
const A1 = '00000000-0000-0000-0000-0000000000a1', A2 = '00000000-0000-0000-0000-0000000000a2', B1 = '00000000-0000-0000-0000-0000000000b1'
// Said before the migration: one idea (the backfill makes its card) and one task (no card); and one Drive drop.
await db.exec(`insert into public.said_parts (id, kind, excerpt, title, created_at) values
    ('${A1}', 'idea', 'what if the bots ran the shop', 'Bots run the shop', '2026-10-20T09:00:00Z'),
    ('${A2}', 'task', 'call the bank', 'Call the bank', '2026-10-20T09:00:00Z');
  insert into public.inspiration_items (drive_file_id, folder, lane, name, mime, drive_created_at)
    values ('drivefile0001', 'cold_ideas', 'strategy', 'a drop', 'image/png', now());`)
await db.exec(await migration('20261118093200_inspiration_said_cards.sql'))
const said = async () => (await db.query(`select said_part_id, name, kind, kind_source, facets, answered_at, drive_created_at, folder, drive_file_id
  from public.inspiration_items where said_part_id is not null order by name`)).rows

// 1. The backfill: one card per idea already said, his words exactly, unanswered, in the order he said them.
let cards = await said()
assert.equal(cards.length, 1)
assert.deepEqual({ ...cards[0], drive_created_at: cards[0].drive_created_at.toISOString() }, {
  said_part_id: A1, name: 'Bots run the shop', kind: 'idea', kind_source: 'rule', answered_at: null, folder: null, drive_file_id: null,
  drive_created_at: '2026-10-20T09:00:00.000Z',
  facets: { said: { title: 'Bots run the shop', excerpt: 'what if the bots ran the shop' } } })

// 2. A card the moment an idea is said, with where it landed; none for a note; an unrelated edit adds nothing.
await db.exec(`insert into public.said_parts (id, kind, excerpt, title, landed_table, landed_id) values
    ('${B1}', 'idea', 'a piece on agent wallets', 'Agent wallets', 'content_ideas', 'x1'),
    (gen_random_uuid(), 'note', 'remember the mic', 'Mic', null, null);
  update public.said_parts set excerpt = excerpt where id = '${B1}';`)
cards = await said()
assert.deepEqual(cards.map(c => c.name), ['Agent wallets', 'Bots run the shop'])
assert.deepEqual(cards[0].facets.said, { title: 'Agent wallets', excerpt: 'a piece on agent wallets', landed_table: 'content_ideas', landed_id: 'x1' })

// 3. A part re-read into an idea gets its card, and only one however often it is re-read.
await db.exec(`update public.said_parts set kind = 'idea' where id = '${A2}'; update public.said_parts set kind = 'idea' where id = '${A2}';`)
assert.equal((await said()).filter(c => c.said_part_id === A2).length, 1)

// 4. One source per card; a said card is an idea by rule; a said part with a card is never deleted.
const refused = async (sql, pattern) => { await assert.rejects(db.exec(sql), pattern) }
await refused(`insert into public.inspiration_items (lane, name, mime, drive_created_at) values ('strategy', 'nothing', 'text/plain', now())`,
  /inspiration_items_one_source/)
await refused(`insert into public.inspiration_items (drive_file_id, folder, said_part_id, lane, name, mime, drive_created_at, kind, kind_source)
  values ('drivefile0002', 'cold_ideas', '${B1}', 'strategy', 'both', 'text/plain', now(), 'idea', 'rule')`, /inspiration_items_one_source/)
await refused(`insert into public.inspiration_items (said_part_id, lane, name, mime, drive_created_at)
  values ('${B1}', 'strategy', 'unkinded', 'text/plain', now())`, /inspiration_items_said_is_idea|duplicate key/)
await refused(`delete from public.said_parts where id = '${A1}'`, /foreign key/)
assert.equal((await db.query('select count(*)::int as n from public.inspiration_items where drive_file_id is not null')).rows[0].n, 1)

console.log('PASS: said ideas become cards: backfill, trigger on file and re-read, once each, one source, his words kept, nothing deleted')
