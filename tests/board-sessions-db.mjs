// The board sessions and piece materials store, run against the real migration in a real database
// (supabase/migrations/20261125093000_board_sessions_and_piece_store.sql; docs/PUBLISH_BOARDS.md, "Sessions and materials").
//
//   node tests/board-sessions-db.mjs pglite /abs/path/@electric-sql/pglite/dist/index.js
//       the rules one write at a time: append only, archive only, idempotent reports, revision conflicts, the capture
//       of content_ideas.meta.materials, versions, and the role boundary (PGlite has one connection).
//   node tests/board-sessions-db.mjs pg /abs/path/pg/lib/index.js postgres://postgres@/postgres?host=/var/run/postgresql
//       the same, then four sessions on one piece at once on four real connections: every report, every material, every
//       appended note and every working-set paste lands; no field is overwritten without the revision it read.
//
// It makes its own database (pg) or its own memory instance (PGlite) and drops it at the end.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const [mode, modulePath, url] = process.argv.slice(2)
if (!['pglite', 'pg'].includes(mode) || !modulePath) {
  console.error('usage: node tests/board-sessions-db.mjs pglite|pg <module path> [postgres url]')
  process.exit(2)
}
const MIGRATION = new URL('../supabase/migrations/20261125093000_board_sessions_and_piece_store.sql', import.meta.url)
const SETUP = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
  end $$;
  grant usage on schema public to service_role;
  create table public.content_ideas (id uuid primary key default gen_random_uuid(), idea text, scheduled_for date, meta jsonb, updated_at timestamptz default now());
  grant select, insert, update on public.content_ideas to service_role;`
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex')

// ── a database to run in ─────────────────────────────────────────────────────────────────────────────────────────────
let admin, connect, cleanup
if (mode === 'pglite') {
  const { PGlite } = await import(pathToFileURL(modulePath).href)
  const db = new PGlite()
  admin = db
  connect = async () => db
  cleanup = async () => db.close()
} else {
  const pg = (await import(pathToFileURL(modulePath).href)).default
  const name = `board_sessions_${Date.now()}`
  const root = new pg.Client({ connectionString: url })
  await root.connect()
  await root.query(`create database ${name}`)
  const target = new URL(url.replace(/^postgres(ql)?:/, 'http:')); target.pathname = `/${name}`
  const dbUrl = target.toString().replace(/^http:/, 'postgres:')
  admin = new pg.Client({ connectionString: dbUrl }); await admin.connect()
  const clients = []
  connect = async () => { const c = new pg.Client({ connectionString: dbUrl }); await c.connect(); await c.query('set role service_role'); clients.push(c); return c }
  cleanup = async () => { for (const c of clients) await c.end(); await admin.end(); await root.query(`drop database ${name}`); await root.end() }
}
await admin.exec ? await admin.exec(SETUP) : await admin.query(SETUP)
const migration = await readFile(MIGRATION, 'utf8')
await (admin.exec ? admin.exec(migration) : admin.query(migration))
await (admin.exec ? admin.exec(migration) : admin.query(migration)) // re-runnable
const one = async (c, sql, params = []) => (await c.query(sql, params)).rows[0]
const rpc = async (c, fn, p) => (await one(c, `select public.${fn}($1::jsonb) as r`, [JSON.stringify(p)])).r
const count = async (c, sql, params = []) => Number((await one(c, sql, params)).n)
const asService = async (c) => { if (mode === 'pglite') await c.query('set role service_role') }

// ── the rules, one write at a time ───────────────────────────────────────────────────────────────────────────────────
const db = await connect(); await asService(db)
const piece = (await one(db, `insert into content_ideas (idea, scheduled_for, meta) values ('Oracle', '2026-11-16', $1) returning id`,
  [JSON.stringify({ materials: [{ id: 'm1', kind: 'paste', title: 'Research one', content: 'The first corpus.', by: 'claude_code', at: '2026-11-10T09:00:00Z' },
    { id: 'm2', kind: 'link', title: 'A page', url: 'https://example.org/a', by: 'Krish' }] })])).id
assert.equal(await count(db, 'select count(*) n from piece_materials where piece_id = $1', [piece]), 2, 'an insert with materials is captured')
const m1 = await one(db, `select * from piece_materials where piece_id = $1 and material_key = 'meta:m1'`, [piece])
assert.equal(m1.week.toISOString?.().slice(0, 10) ?? String(m1.week).slice(0, 10), '2026-11-16')
assert.equal(m1.day, 'mon'); assert.equal(m1.storage, 'text'); assert.equal(m1.sha256, sha('The first corpus.')); assert.equal(m1.added_by, 'claude_code')

// The working set loses m1 (trimmed, deleted on the old route, or a lost race): the store keeps it.
await db.query(`update content_ideas set meta = jsonb_set(meta, '{materials}', $2) where id = $1`, [piece, JSON.stringify([{ id: 'm2', kind: 'link', title: 'A page', url: 'https://example.org/a' }])])
assert.equal(await count(db, 'select count(*) n from piece_materials where piece_id = $1', [piece]), 2, 'a material gone from the working set stays in the store')
// A changed text under the same material id is a second version; the first stays.
await db.query(`update content_ideas set meta = jsonb_set(meta, '{materials}', $2) where id = $1`, [piece, JSON.stringify([{ id: 'm1', kind: 'paste', title: 'Research one', content: 'The first corpus, revised.' }])])
assert.deepEqual((await db.query(`select version from piece_materials where piece_id = $1 and material_key = 'meta:m1' order by version`, [piece])).rows.map(r => r.version), [1, 2])
// An update that leaves meta.materials as it was captures nothing.
await db.query(`update content_ideas set meta = meta || '{"making":{"x":1}}' where id = $1`, [piece])
assert.equal(await count(db, 'select count(*) n from piece_materials where piece_id = $1', [piece]), 3)

// Nothing is changed or removed.
for (const sql of [
  `delete from piece_materials where piece_id = '${piece}'`, `update piece_materials set title = 'x' where piece_id = '${piece}'`,
  `delete from material_texts`, `update material_texts set content = 'x'`, `truncate piece_materials`, `truncate material_texts`]) {
  await assert.rejects(db.query(sql), /append only|keeps every version|permission denied/, sql)
}
const shot = 'a'.repeat(64)
const put = await rpc(db, 'board_material_put', { piece_id: piece, storage: 'bucket', sha256: shot, bytes: 12345, object_key: `files/${shot}.png`, content_type: 'image/png',
  kind: 'screenshot', role: 'inspiration', title: 'Two screen grabs: the first', source: 'board', added_by: 'Krish' })
assert.equal(put.ok, true); assert.equal(put.duplicate, false)
assert.equal((await rpc(db, 'board_material_put', { piece_id: piece, storage: 'bucket', sha256: shot, bytes: 12345, object_key: `files/${shot}.png`, kind: 'screenshot', title: 'again', added_by: 'Krish' })).duplicate, true, 'the same bytes again are one material')
assert.equal((await rpc(db, 'board_material_put', { piece_id: piece, storage: 'bucket', sha256: shot, bytes: 1, object_key: `files/${'b'.repeat(64)}.png`, kind: 'screenshot', title: 'x', added_by: 'x' })).error, 'invalid_file')
const arch = (await one(db, `select public.board_material_archive($1, 'Krish', 'not this one') as r`, [put.material.id])).r
assert.equal(arch.ok, true); assert.ok(arch.material.archived_at)
assert.equal(await count(db, 'select count(*) n from piece_materials where id = $1', [put.material.id]), 1, 'archived, never deleted')
// Versions of a named material: a write that names the version it read is refused when another landed first.
const c1 = await rpc(db, 'board_material_put', { piece_id: piece, material_key: 'corpus', storage: 'text', content: 'v1', kind: 'corpus', title: 'Corpus', added_by: 's1', base_version: 0 })
assert.equal(c1.material.version, 1)
assert.equal((await rpc(db, 'board_material_put', { piece_id: piece, material_key: 'corpus', storage: 'text', content: 'v2 from s2', kind: 'corpus', title: 'Corpus', added_by: 's2', base_version: 1 })).material.version, 2)
const stale = await rpc(db, 'board_material_put', { piece_id: piece, material_key: 'corpus', storage: 'text', content: 'v2 from s1', kind: 'corpus', title: 'Corpus', added_by: 's1', base_version: 1 })
assert.equal(stale.error, 'version_conflict'); assert.equal(stale.current.version, 2)
// A day with no piece yet takes materials too.
const dayShot = await rpc(db, 'board_material_put', { week: '2026-11-16', day: 'tue', storage: 'link', url: 'https://example.org/inspo', kind: 'link', title: 'Tuesday inspiration', added_by: 'Krish' })
assert.equal(dayShot.material.scope, 'day:2026-11-16/tue')
assert.equal((await rpc(db, 'board_material_put', { week: '2026-11-17', storage: 'link', url: 'https://example.org/x', title: 'x', added_by: 'x' })).error, 'invalid_week')
assert.equal((await rpc(db, 'board_material_put', { piece_id: randomUUID(), storage: 'link', url: 'https://example.org/x', title: 'x', added_by: 'x' })).error, 'piece_not_found')

// Reports: idempotent on the session's own key; fields at a revision.
const report = (p) => rpc(db, 'board_session_report', { piece_id: piece, session_id: 'sess-alpha', surface: 'claude-code', by: 'Claude Code', ...p })
const r1 = await report({ client_key: 'start', kind: 'start', step: 'storyboard', summary: 'Reading the lock', fields: [{ name: 'step', value: 'storyboard', base_revision: 0 }] })
assert.equal(r1.ok, true); assert.equal(r1.fields[0].revision, 1)
const again = await report({ client_key: 'start', kind: 'start', step: 'storyboard', summary: 'Reading the lock', fields: [{ name: 'step', value: 'storyboard', base_revision: 0 }] })
assert.equal(again.duplicate, true); assert.equal(again.event_id, r1.event_id); assert.equal(again.fields[0].revision, 1, 'a retry writes nothing again')
const conflict = await rpc(db, 'board_session_report', { piece_id: piece, session_id: 'sess-beta', client_key: 'b1', kind: 'progress', by: 'claude.ai', fields: [{ name: 'step', value: 'record', base_revision: 0 }] })
assert.equal(conflict.fields[0].error, 'revision_conflict'); assert.equal(conflict.fields[0].value, 'storyboard'); assert.equal(conflict.fields[0].revision, 1)
assert.equal((await count(db, `select count(*) n from board_piece_fields where name = 'step'`)), 1, 'the refused write left the value as it was')
assert.equal((await report({ client_key: 'p1', kind: 'progress', fields: [{ name: 'notes', value: 'one', mode: 'append' }] })).fields[0].value.length, 1)
assert.deepEqual((await rpc(db, 'board_session_report', { piece_id: piece, session_id: 'sess-beta', client_key: 'b2', kind: 'progress', by: 'claude.ai', fields: [{ name: 'notes', value: 'two', mode: 'append' }] })).fields[0].value, ['one', 'two'])
assert.equal((await report({ client_key: 'bad', kind: 'nope' })).error, 'invalid_kind')
assert.equal((await rpc(db, 'board_session_report', { piece_id: piece, session_id: 'x', client_key: 'k', kind: 'start', by: 'x' })).error, 'invalid_session')
await assert.rejects(db.query('delete from board_session_events'), /append only|permission denied/)
await assert.rejects(db.query(`update board_piece_fields set value = '"x"'`), /append only|permission denied/)
// The guards hold for the database's owner too, not only for the server's role.
if (mode === 'pglite') await db.query('reset role')
for (const sql of ['delete from piece_materials', `update piece_materials set title = 'x'`, 'delete from material_texts', 'delete from board_session_events',
  `update board_piece_fields set value = '"x"'`, 'truncate board_session_events']) {
  await assert.rejects(admin.query(sql), /append only|keeps every version/, `owner: ${sql}`)
}
await asService(db)
await report({ client_key: 'done', kind: 'done', summary: 'Storyboard filed' })
const ov = (await one(db, `select public.board_overlay($1::uuid[], '2026-11-16'::date) as r`, [[piece]])).r
const alpha = ov.sessions.find(s => s.session_id === 'sess-alpha'), beta = ov.sessions.find(s => s.session_id === 'sess-beta')
assert.equal(alpha.state, 'done'); assert.equal(alpha.doing, 'Storyboard filed'); assert.equal(alpha.events, 3, 'start, one note and done: the retried start is not a second event')
assert.equal(beta.state, 'working')
assert.ok(ov.materials.some(m => m.scope === 'day:2026-11-16/tue'), 'the day with no piece is in the week overlay')
assert.ok(!ov.materials.some(m => m.archived_at), 'archived materials are left out unless asked')
assert.equal(ov.materials.filter(m => m.key === 'corpus').length, 1, 'only the latest version unless asked')
assert.equal(ov.fields.find(f => f.name === 'step').value, 'storyboard')
const allv = (await one(db, `select public.board_overlay($1::uuid[], null, true, true) as r`, [[piece]])).r
assert.equal(allv.materials.filter(m => m.key === 'corpus').length, 2)

// The role boundary: only the server's role reads or writes any of it.
if (mode === 'pglite') await db.query('reset role')
const outsider = mode === 'pglite' ? db : admin
for (const role of ['anon', 'authenticated']) {
  await outsider.query(`set role ${role}`)
  await assert.rejects(outsider.query('select * from piece_materials'), /permission denied/)
  await assert.rejects(outsider.query('select * from board_session_events'), /permission denied/)
  await assert.rejects(outsider.query(`select public.board_session_report('{}'::jsonb)`), /permission denied/)
  await outsider.query('reset role')
}
console.log('PASS (one at a time): capture of meta.materials, append only, archive only, versions with conflicts, day scope, idempotent reports, revision conflicts, appends, presence, roles')

// ── four sessions on one piece at once (real connections only) ───────────────────────────────────────────────────────
if (mode === 'pg') {
  const target = (await one(db, `insert into content_ideas (idea, scheduled_for, meta) values ('Four at once', '2026-11-18', '{"materials":[]}') returning id`)).id
  const sessions = await Promise.all([1, 2, 3, 4].map(() => connect()))
  const jitter = () => new Promise(r => setTimeout(r, Math.random() * 15))
  const STEPS = 6
  const conflicts = []
  const work = sessions.map(async (c, n) => {
    const id = `four-session-${n + 1}`
    const say = async (key, p) => {
      await jitter()
      const r = await rpc(c, 'board_session_report', { piece_id: target, session_id: id, client_key: key, by: `session ${n + 1}`, surface: 'claude-code', ...p })
      assert.equal(r.ok, true, JSON.stringify(r))
      return r
    }
    await say('start', { kind: 'start', step: 'research', summary: `Session ${n + 1} starting` })
    for (let k = 0; k < STEPS; k++) {
      // A note every session appends: all of them must land.
      await say(`note-${k}`, { kind: 'progress', summary: `note ${k}`, fields: [{ name: 'notes', value: `s${n + 1}-${k}`, mode: 'append' }] })
      // The same report sent twice (a retry after a timeout): it lands once.
      await say(`note-${k}`, { kind: 'progress', summary: `note ${k}`, fields: [{ name: 'notes', value: `s${n + 1}-${k}`, mode: 'append' }] })
      // A shared value set at the revision it read: refused when another landed first, then set again on the fresh read.
      let base = Number((await one(c, `select coalesce(max(revision), 0) n from board_piece_fields where scope = $1 and name = 'status'`, [target])).n)
      for (let tries = 0; ; tries++) {
        await jitter()
        const r = await rpc(c, 'board_session_report', { piece_id: target, session_id: id, client_key: `status-${k}-${tries}`, kind: 'progress', by: `session ${n + 1}`,
          fields: [{ name: 'status', value: { by: n + 1, k, base }, base_revision: base }] })
        const f = r.fields[0]
        if (f.ok) break
        assert.equal(f.error, 'revision_conflict'); conflicts.push(f)
        base = f.revision
        assert.ok(tries < 200, 'a writer never gets through')
      }
      // Materials: its own screen grab, the shared corpus (same bytes from every session), and its own corpus version.
      const grab = sha(`grab ${n} ${k}`)
      await rpc(c, 'board_material_put', { piece_id: target, storage: 'bucket', sha256: grab, bytes: 1000 + k, object_key: `files/${grab}.png`, kind: 'screenshot', title: `Grab ${n}-${k}`, added_by: `session ${n + 1}`, session_id: id })
      const shared = await rpc(c, 'board_material_put', { piece_id: target, storage: 'text', content: 'The one shared research corpus.', kind: 'corpus', title: 'Shared corpus', added_by: `session ${n + 1}` })
      assert.equal(shared.ok, true)
      await rpc(c, 'board_material_put', { piece_id: target, material_key: 'running-notes', storage: 'text', content: `notes from ${n} at ${k}`, kind: 'note', title: 'Running notes', added_by: `session ${n + 1}` })
      // The old working-set write, read-modify-write with no guard, as the materials route did: some of these lose each
      // other in content_ideas.meta.materials, and the store must still hold every one.
      await c.query('begin')
      const meta = (await one(c, 'select meta from content_ideas where id = $1', [target])).meta
      await jitter()
      const mat = { id: `ws-${n}-${k}`, kind: 'paste', title: `Paste ${n}-${k}`, content: `Pasted by session ${n + 1}, step ${k}.`, by: `session ${n + 1}` }
      await c.query('update content_ideas set meta = $2 where id = $1', [target, JSON.stringify({ ...meta, materials: [mat, ...(meta.materials || [])] })])
      await c.query('commit')
    }
    await say('done', { kind: 'done', summary: `Session ${n + 1} done` })
  })
  await Promise.all(work)
  const n = (sql, p = [target]) => count(db, sql, p)
  assert.equal(await n(`select count(*) n from board_session_events where piece_id = $1`), 4 * (2 + STEPS + STEPS) + conflicts.length, 'every report landed once, retries not doubled')
  const notes = (await one(db, `select value from board_piece_fields where scope = $1 and name = 'notes' order by revision desc limit 1`, [target])).value
  assert.equal(notes.length, 4 * STEPS, 'every appended note landed'); assert.equal(new Set(notes).size, 4 * STEPS)
  const status = (await db.query(`select revision, value from board_piece_fields where scope = $1 and name = 'status' order by revision`, [target])).rows
  assert.equal(status.length, 4 * STEPS, 'every status write landed, each on the one it read')
  status.forEach((r, i) => { assert.equal(r.revision, i + 1); assert.equal(r.value.base, i, `revision ${i + 1} was written by a session that had read revision ${i}`) })
  assert.equal(await n(`select count(*) n from piece_materials where piece_id = $1 and kind = 'screenshot'`), 4 * STEPS, 'every screen grab is there')
  assert.equal(await n(`select count(*) n from piece_materials where piece_id = $1 and kind = 'corpus'`), 1, 'the same corpus from four sessions is one material')
  assert.equal(await n(`select count(*) n from piece_materials where piece_id = $1 and material_key = 'running-notes'`), 4 * STEPS, 'every version of a named material is kept')
  assert.deepEqual((await db.query(`select version from piece_materials where piece_id = $1 and material_key = 'running-notes' order by version`, [target])).rows.map(r => r.version), Array.from({ length: 4 * STEPS }, (_, i) => i + 1))
  const inSet = (await one(db, `select jsonb_array_length(meta->'materials') n from content_ideas where id = $1`, [target])).n
  assert.equal(await n(`select count(*) n from piece_materials where piece_id = $1 and material_key like 'meta:ws-%'`), 4 * STEPS, 'every working-set paste is in the store, whatever the races did to the working set')
  const presence = (await one(db, `select public.board_overlay($1::uuid[], null) as r`, [[target]])).r.sessions
  assert.equal(presence.length, 4); assert.ok(presence.every(s => s.state === 'done'))
  console.log(`PASS (four at once): ${4 * (2 + 2 * STEPS)} reports with retries, ${conflicts.length} revision conflicts refused and retried on a fresh read, `
    + `${4 * STEPS} appended notes, ${4 * STEPS} screen grabs, one shared corpus, ${4 * STEPS} versions of one material, and all ${4 * STEPS} racing pastes kept `
    + `(the working set itself holds ${inSet} of them)`)
}
await cleanup()
