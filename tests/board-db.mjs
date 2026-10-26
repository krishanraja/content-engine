// Execute the actual migration and RPCs in disposable PostgreSQL (PGlite).
// node tests/board-db.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;')
await db.exec(await readFile(new URL('../supabase/migrations/20261019120743_publish_board_web.sql', import.meta.url), 'utf8'))
await db.exec('set role service_role')
const save = async (body, rev, week = '2026-10-19', collection = 'ticks', id = 'mon-substack') =>
  (await db.query('select board_save($1,$2,$3,$4,$5,$6) as result', [week,collection,id,body,rev,'fixture'])).rows[0].result
const activate = async (id, manifest, rev) =>
  (await db.query('select board_activate($1,$2,$3,$4,$5) as result', ['2026-10-19',id,manifest,rev,'fixture'])).rows[0].result
const yes = { done: true }, no = { done: false }
assert.equal((await save(yes,0)).revision,1)
assert.equal((await save(yes,0)).revision,1, 'identical replay is idempotent')
assert.equal((await save(no,0)).error,'revision_conflict')
assert.equal((await save(no,1)).revision,2)
assert.equal((await save(yes,0,'2026-10-12')).revision,1, 'weeks are independent')
assert.equal((await db.query('select count(*)::int as n from board_ticks')).rows[0].n,2, 'untick retains the row')
assert.equal((await db.query('select count(*)::int as n from board_history')).rows[0].n,3)
const combine = { combine:true, pick:'combine-1', members:['11111111-2222-4333-8444-555555555555','22222222-3333-4444-8555-666666666666'], at:'2026-10-25T10:00:00Z' }
assert.equal((await save(combine,0,'2026-10-26','queue','combine-1')).revision,1, 'a Combine tap saves as queue/combine-1')
assert.deepEqual((await db.query("select body from board_documents where week='2026-10-26' and collection='queue' and doc_id='combine-1'")).rows[0].body.members, combine.members)
assert.equal((await save({ text:'first' },0,'2026-10-19','comments','root')).ok,true)
assert.equal((await save({ text:'overwrite' },1,'2026-10-19','comments','root')).error,'revision_conflict')
const a='a'.repeat(64), b='b'.repeat(64)
assert.equal((await activate(a,{test:'first'},0)).revision,1)
assert.equal((await activate(a,{test:'first'},0)).revision,1)
assert.equal((await activate(a,{test:'tamper'},1)).error,'immutable_build_conflict')
assert.equal((await activate(b,{test:'second'},0)).error,'revision_conflict')
assert.equal((await activate(b,{test:'second'},1)).revision,2)
assert.equal((await activate(a,{test:'first'},2)).revision,3,'rollback points to a retained build')
assert.equal((await db.query('select count(*)::int as n from board_builds')).rows[0].n,2)
assert.equal((await db.query("select body from board_ticks where week='2026-10-19'")).rows[0].body.done,false,'rollback keeps current interaction state')
await db.exec('reset role')
for (const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`)
  await assert.rejects(db.query('select * from board_ticks'), /permission denied/)
  await assert.rejects(db.query("select board_save('2026-10-19','ticks','x','{}',0,'forged')"), /permission denied/)
  await db.exec('reset role')
}
const flags=await db.query("select count(*)::int as n from pg_class where relname like 'board_%' and relkind='r' and relrowsecurity")
assert.equal(flags.rows[0].n,7)
console.log('PASS: actual SQL migration, CAS, replay, week isolation, untick/history, append-only comments, immutable builds, rollback and role/RLS boundaries')
await db.close()
