// A card can teach a thumbnail (supabase/migrations/20261205090000_inspiration_teaches_thumbnail.sql), executed in
// disposable PostgreSQL (PGlite). The card table comes from its own migration (the taste ledger's section 9), then the
// teaches migration, then this one: before it a thumbnail is refused, after it a card may teach one and a use may serve
// one, every other check still holds, and running it twice changes nothing.
// node tests/inspiration-teaches-thumbnail-db.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role;')
await db.exec('create table public.content_ideas (id uuid primary key);')
const ledger = await migration('20261104090000_taste_ledger.sql')
await db.exec(ledger.slice(ledger.indexOf('create table public.inspiration_items ('), ledger.indexOf('-- 10. Access')))
await db.exec(`alter table public.inspiration_items add column facets jsonb not null default '{}'::jsonb,
  add column kind text;`)
await db.exec(await migration('20261122090000_inspiration_teaches_and_card_uses.sql'))

const card = async (name, teaches, source) => (await db.query(`insert into public.inspiration_items
    (drive_file_id, folder, lane, name, mime, drive_created_at, teaches, teaches_source)
  values ($1, 'video_inspiration', 'production', $2, 'image/png', now(), $3::text[], $4) returning id`,
  [`drive_${name}_0000000000`, name, teaches, source])).rows[0].id
const use = (id, role) => db.query(`insert into public.card_uses (card_id, spec_path, cut, role) values ($1, 'docs/plans/x/ve/spec.json', 'short', $2)`, [id, role])

// 1. Before: a thumbnail is refused on a card and on a use.
await assert.rejects(card('before', ['thumbnail'], 'engine_guess'), /inspiration_items_teaches_check/)
const look = await card('look', ['look', 'motion'], 'krish')
await assert.rejects(use(look, 'thumbnail'), /card_uses_role_check/)

// 2. After, run twice: a card may teach a thumbnail beside the six, and a use may serve one.
const sql = await migration('20261205090000_inspiration_teaches_thumbnail.sql')
await db.exec(sql)
await db.exec(sql)
const study = await card('veed_thumb_1', ['thumbnail', 'look'], 'engine_guess')
await use(study, 'thumbnail')
await card('all', ['look', 'motion', 'captions', 'hook', 'pacing', 'layout', 'thumbnail'], 'krish')

// 3. Every other check still holds: an unknown role, a teaches with no source, a use of an unknown role.
await assert.rejects(card('cover', ['cover'], 'engine_guess'), /inspiration_items_teaches_check/)
await assert.rejects(card('nosource', ['thumbnail'], null), /inspiration_items_teaches_has_source/)
await assert.rejects(use(study, 'cover'), /card_uses_role_check/)

// 4. Nothing was lost: the cards and the use written before and after are all there.
const n = (await db.query(`select (select count(*) from public.inspiration_items)::int as cards, (select count(*) from public.card_uses)::int as uses`)).rows[0]
assert.deepEqual(n, { cards: 3, uses: 1 })
console.log('inspiration teaches thumbnail: ok')
