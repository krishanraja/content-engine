// The engine's leases, run against the real migration in a real database (supabase/migrations/20261127100000_engine_leases.sql).
// Five research library sweeps run by hand on 11 Nov 2026 overlapped and copied the same research again; every writer of
// the library now holds the lease `research_library_mirror` while it reads and writes (apps/control-plane/api/_researchLibrary.ts).
//
//   node tests/engine-leases-db.mjs /abs/path/@electric-sql/pglite/dist/index.js
//
// One holder at a time: a second taker is told it is held, by whom and until when; the holder may renew; only the holder
// releases; a released or run-out lease is taken by the next writer; the migration runs twice; nobody but the server may
// call it or read the table.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const [modulePath] = process.argv.slice(2)
if (!modulePath) {
  console.error('usage: node tests/engine-leases-db.mjs <path to @electric-sql/pglite/dist/index.js>')
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
  grant usage on schema public to service_role, anon, authenticated;`)
const migration = await readFile(new URL('../supabase/migrations/20261127100000_engine_leases.sql', import.meta.url), 'utf8')
await db.exec(migration)
await db.exec(migration) // re-runnable

const NAME = 'research_library_mirror'
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const take = async (holder, seconds = 180, name = NAME) => (await one('select public.engine_lease_take($1, $2, $3) as r', [name, holder, seconds])).r
const release = async (holder, name = NAME) => (await one('select public.engine_lease_release($1, $2) as r', [name, holder])).r

// Nobody but the server may take a lease or read who holds one.
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`)
  await assert.rejects(db.query(`select public.engine_lease_take('${NAME}', 'x', 60)`), /permission denied/, `${role} may not take a lease`)
  await assert.rejects(db.query('select * from public.engine_leases'), /permission denied/, `${role} may not read the leases`)
  await db.exec('reset role')
}
await db.exec('set role service_role')

// The first writer takes it; a second is told it is held, by whom and until when, and gets nothing.
const a = await take('sweep:a')
assert.equal(a.ok, true, JSON.stringify(a))
assert.equal(a.holder, 'sweep:a')
const b = await take('sweep:b')
assert.deepEqual({ ok: b.ok, error: b.error, holder: b.holder }, { ok: false, error: 'held', holder: 'sweep:a' })
assert.equal(b.lease_until, a.lease_until)
assert.equal(Number((await one('select count(*) as n from public.engine_leases')).n), 1)

// Only the holder releases it; another's release changes nothing.
assert.equal(await release('sweep:b'), false)
assert.equal((await take('write:c')).error, 'held')
// The holder may renew its own lease, and keeps the time it first took it.
const renewed = await take('sweep:a', 300)
assert.equal(renewed.ok, true)
assert.equal(renewed.taken_at, a.taken_at)
assert.ok(new Date(renewed.lease_until) > new Date(a.lease_until))

// Released, the next writer takes it; a second release by the old holder does nothing.
assert.equal(await release('sweep:a'), true)
assert.equal(await release('sweep:a'), false)
const c = await take('write:c')
assert.equal(c.ok, true, JSON.stringify(c))
assert.equal(c.holder, 'write:c')
assert.equal((await take('sweep:a')).error, 'held', 'a holder that released cannot take it back from the next one')

// A holder that died frees it when its lease runs out.
await db.exec('reset role')
await db.exec(`update public.engine_leases set lease_until = now() - interval '1 second' where name = '${NAME}'`)
await db.exec('set role service_role')
const d = await take('sweep:d')
assert.equal(d.ok, true, JSON.stringify(d))
assert.equal(d.holder, 'sweep:d')
assert.equal(await release('write:c'), false, 'the dead holder cannot release the lease the next one took')
assert.equal((await take('sweep:e')).error, 'held')

// Another name is another lease.
assert.equal((await take('sweep:e', 60, 'some_other_job')).ok, true)

// Bad arguments are refused, never stored.
assert.equal((await take('x', 0)).error, 'invalid_seconds')
assert.equal((await take('x', 3601)).error, 'invalid_seconds')
assert.equal((await take('', 60)).error, 'invalid_holder')
assert.equal((await take('x', 60, 'Research Library')).error, 'invalid_name')
assert.equal(Number((await one('select count(*) as n from public.engine_leases')).n), 2)

console.log('engine leases: one holder at a time, held answered with who and until when, renewal, release by the holder only, expiry, permissions: ok')
