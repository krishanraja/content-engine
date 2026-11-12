// End to end, on a real database: a session follows the prompt the board copies out, and the board reads what it did.
// docs/PUBLISH_BOARDS.md, "Sessions and materials".
//
//   node --import tsx tests/integration/board-sessions-e2e.ts /abs/path/pg/lib/index.js 'postgres://postgres@localhost/postgres?host=/run/postgresql'
//
// It makes a database, applies the real migration, serves the real engine routes (api/content-ideas/store.ts and
// sessions.ts) over HTTP on the engine key, with the content library's bucket standing in memory, builds the week's
// view with the real readView, copies Monday's "Copy Claude prompt" out of it, and runs exactly the script lines that
// prompt names (scripts/post-pack/board_session.py, on ENGINE_BASE_URL). Three more sessions work on the same piece
// over the same routes at the same time. Then it reads the view again and checks the board shows all four sessions
// and every material, against view.schema.json.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const [pgPath, url] = process.argv.slice(2)
const TOKEN = 'local-e2e-operator-key'
process.env.ENGINE_OPERATOR_TOKEN = TOKEN
// api/library/_library.ts opens a client when it loads; the routes here are handed the database below instead.
process.env.SUPABASE_URL ||= 'https://placeholder.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder'
const pg = (await import(pathToFileURL(pgPath).href)).default
pg.types.setTypeParser(1184, (v: string) => v) // timestamptz as the database writes it, as supabase-js returns it
pg.types.setTypeParser(1114, (v: string) => v)
pg.types.setTypeParser(1082, (v: string) => v) // date

const name = `board_e2e_${Date.now()}`
const root = new pg.Client({ connectionString: url }); await root.connect()
await root.query(`create database ${name}`)
const dbUrl = (() => { const u = new URL(url.replace(/^postgres(ql)?:/, 'http:')); u.pathname = `/${name}`; return u.toString().replace(/^http:/, 'postgres:') })()
const pool = new pg.Pool({ connectionString: dbUrl, max: 12 })
await pool.query(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
  end $$;
  create table public.content_ideas (id uuid primary key default gen_random_uuid(), idea text, thesis text, scheduled_for date, lane_slot text,
    state text, buried_at timestamptz, body text, meta jsonb, updated_at timestamptz default now());`)
// The board's own tables, then the sessions' store, then the ideas gate: a piece goes on a day only by his Approve.
for (const m of ['20261019120743_publish_board_web', '20261125093000_board_sessions_and_piece_store', '20261126090000_ideas_gate'])
  await pool.query(readFileSync(new URL(`../../supabase/migrations/${m}.sql`, import.meta.url), 'utf8'))

// ── a Supabase-shaped client over the real database (only what these routes and the view use) ───────────────────────
const qi = (c: string) => `"${c.replace(/"/g, '')}"`
function from(table: string) {
  const st: { op: string; cols: string; where: string[]; params: unknown[]; order: string[]; limit: number | null; values: Record<string, unknown> | null; single: '' | 'maybe' | 'one'; returning: string | null } =
    { op: 'select', cols: '*', where: [], params: [], order: [], limit: null, values: null, single: '', returning: null }
  const add = (sql: (n: string) => string, v: unknown) => { st.params.push(v); st.where.push(sql(`$${st.params.length}`)) }
  const b: any = {
    select(cols = '*') { if (st.op === 'select') st.cols = cols; else st.returning = cols; return b },
    update(v: Record<string, unknown>) { st.op = 'update'; st.values = v; return b },
    eq(c: string, v: unknown) { add(n => `${qi(c)} = ${n}`, v); return b },
    gte(c: string, v: unknown) { add(n => `${qi(c)} >= ${n}`, v); return b },
    lte(c: string, v: unknown) { add(n => `${qi(c)} <= ${n}`, v); return b },
    like(c: string, v: unknown) { add(n => `${qi(c)} like ${n}`, v); return b },
    is(c: string, v: null) { st.where.push(`${qi(c)} is ${v === null ? 'null' : String(v)}`); return b },
    not(c: string, op: string, v: null) { if (op === 'is') st.where.push(`${qi(c)} is not ${v === null ? 'null' : String(v)}`); return b },
    or() { return b },
    order(c: string, o: { ascending?: boolean } = {}) { st.order.push(`${qi(c)} ${o.ascending === false ? 'desc' : 'asc'}`); return b },
    limit(n: number) { st.limit = n; return b },
    maybeSingle() { st.single = 'maybe'; return b },
    single() { st.single = 'one'; return b },
    then(ok: (r: unknown) => unknown, bad: (e: unknown) => unknown) { return run().then(ok, bad) },
  }
  const cols = (c: string) => c === '*' ? '*' : c.split(',').map(x => qi(x.trim())).join(', ')
  async function run() {
    try {
      let sql: string
      if (st.op === 'update') {
        const keys = Object.keys(st.values!)
        const base = st.params.length
        sql = `update public.${qi(table)} set ${keys.map((k, i) => `${qi(k)} = $${base + i + 1}`).join(', ')}${st.where.length ? ` where ${st.where.join(' and ')}` : ''} returning ${cols(st.returning || '*')}`
        st.params.push(...keys.map(k => st.values![k]))
      } else {
        sql = `select ${cols(st.cols)} from public.${qi(table)}${st.where.length ? ` where ${st.where.join(' and ')}` : ''}${st.order.length ? ` order by ${st.order.join(', ')}` : ''}${st.limit ? ` limit ${st.limit}` : ''}`
      }
      const r = await pool.query(sql, st.params)
      if (st.single) {
        if (st.single === 'one' && r.rows.length !== 1) return { data: null, error: { message: 'not one row' } }
        return { data: r.rows[0] ?? null, error: null }
      }
      return { data: r.rows, error: null }
    } catch (e) { return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } } }
  }
  return b
}
// A function that returns a table answers its rows, as PostgREST does; any other answers its one value.
const TABLE_FUNCTIONS = new Set(['board_approvals_now'])
async function rpc(fn: string, args: Record<string, unknown>) {
  const keys = Object.keys(args)
  const call = `public.${qi(fn)}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`
  try {
    const r = await pool.query(TABLE_FUNCTIONS.has(fn) ? `select * from ${call}` : `select ${call} as r`, keys.map(k => args[k]))
    return { data: TABLE_FUNCTIONS.has(fn) ? r.rows : r.rows[0].r, error: null }
  } catch (e) { return { data: null, error: { message: (e as Error).message } } }
}
// The content library's bucket, in memory: signed links point back at this server.
const objects = new Map<string, Buffer>()
let base = ''
const storage = {
  from: () => ({
    info: async (key: string) => objects.has(key) ? { data: { size: objects.get(key)!.length }, error: null } : { data: null, error: { status: 404 } },
    createSignedUploadUrl: async (key: string) => ({ data: { signedUrl: `${base}/bucket/${encodeURIComponent(key)}` }, error: null }),
    createSignedUrl: async (key: string) => objects.has(key) ? { data: { signedUrl: `${base}/bucket/${encodeURIComponent(key)}` }, error: null } : { data: null, error: { message: 'missing' } },
  }),
}
const db = { from, rpc, storage }

// ── the engine's routes, as Vercel runs them ────────────────────────────────────────────────────────────────────────
const { createStoreHandler } = await import('../../apps/control-plane/api/content-ideas/store.ts')
const { createSessionsHandler } = await import('../../apps/control-plane/api/content-ideas/sessions.ts')
const { readView } = await import('../../apps/control-plane/api/board/_view.ts')
const { validate } = await import('../../scripts/check-view-contract.ts')
const store = createStoreHandler(async () => db as never), sessions = createSessionsHandler(async () => db as never)

async function body(req: IncomingMessage): Promise<Buffer> { const parts: Buffer[] = []; for await (const c of req) parts.push(c as Buffer); return Buffer.concat(parts) }
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const u = new URL(req.url || '/', 'http://x')
  const raw = await body(req)
  if (u.pathname.startsWith('/bucket/')) {
    const key = decodeURIComponent(u.pathname.slice(8))
    if (req.method === 'PUT') { objects.set(key, raw); res.writeHead(200).end('{}'); return }
    if (!objects.has(key)) { res.writeHead(404).end(); return }
    res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(objects.get(key)); return
  }
  const handler = u.pathname === '/api/content-ideas/store' ? store : u.pathname === '/api/content-ideas/sessions' ? sessions : null
  if (!handler) { res.writeHead(404).end('{}'); return }
  const vreq = Object.assign(req, { query: Object.fromEntries(u.searchParams), body: raw.length ? JSON.parse(raw.toString('utf8')) : undefined })
  let code = 200
  const vres = Object.assign(res, {
    status(c: number) { code = c; return vres },
    json(v: unknown) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(v)); return vres },
    send(v: unknown) { res.writeHead(code); res.end(v); return vres },
    redirect(c: number, to: string) { res.writeHead(c, { location: to }); res.end(); return vres },
  })
  await handler(vreq as never, vres as never)
})
await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()))
base = `http://127.0.0.1:${(server.address() as { port: number }).port}`

// ── the week: Monday's piece, with one paste already on its working set ─────────────────────────────────────────────
const WEEK = '2026-11-16'
const IDEA = 'Oracle files to sell $20B in new stock and bonds to fund AI'
// His Approve on the ideas board puts the piece on Monday (the ideas gate): without it the database refuses the row.
const piece = randomUUID()
const approve = await pool.query(`select public.board_save($1, 'picks', 'mon', $2::jsonb, 0, 'Krish') as r`,
  [WEEK, JSON.stringify({ day: 'mon', pick: 'mon-1', idea_id: piece, series: 'follow_the_money', story: IDEA })])
assert.equal(approve.rows[0].r.ok, true, 'his Approve is saved')
await pool.query(`insert into content_ideas (id, idea, scheduled_for, lane_slot, state, meta) values
  ($1, $2, '2026-11-16', 'follow_the_money', 'drafting', $3)`,
  [piece, IDEA, { materials: [{ id: 'm-first', kind: 'paste', title: 'Oracle 10-Q notes', content: 'Remaining performance obligations, the prepayments.', by: 'Krish', at: '2026-11-09T10:00:00Z' }] }])
const offline = async () => ({ status: 404, text: async () => '' })
const view = () => readView(db as never, WEEK, {}, offline as never, new Date(Date.now()))

const before = await view()
const mon = before.days.find(d => d.day === 'mon')!
const prompt = mon.actions.find(a => a.kind === 'prompt' && /Claude/.test(a.label)) as { prompt: string; label: string } | undefined
assert.ok(prompt, 'Monday carries a Claude prompt')
assert.match(prompt.prompt, /Keep the board current as you work/)
assert.ok(prompt.prompt.includes(`piece_id ${piece}`), 'the prompt names the piece')
assert.ok(!/Bearer|operator token|ENGINE_OPERATOR_TOKEN|hmcp1_/i.test(prompt.prompt), 'no key in the prompt')
assert.equal(mon.materials.length, 1, 'the paste already on the piece is on the board before any session')
const step = /step ([a-z0-9_-]+)\)/.exec(prompt.prompt)![1]

// ── the session the prompt starts: exactly the script lines it names ───────────────────────────────────────────────
const SCRIPT = 'scripts/post-pack/board_session.py'
const env = { ...process.env, ENGINE_BASE_URL: base, ENGINE_OPERATOR_TOKEN: TOKEN, ENGINE_CREDENTIALS_ENV_ONLY: '1', CLAUDE_CODE_REMOTE: '' }
// Async: the routes the script calls are served by this same process.
const run = promisify(execFile)
const py = async (...a: string[]) => (await run('python3', [SCRIPT, ...a], { env, encoding: 'utf8' })).stdout.trim()
const showLine = new RegExp(`python3 ${SCRIPT.replace(/\./g, '\\.')} (\\S+) show`).exec(prompt.prompt)
assert.ok(showLine && showLine[1] === piece, 'the prompt names the script line to see what is on file')
const work = mkdtempSync(join(tmpdir(), 'board-e2e-'))
const png = (n: number) => { const b = Buffer.alloc(2048 + n); b.write('\x89PNG\r\n\x1a\n', 0, 'binary'); b.writeUInt32BE(n, 16); return b }
writeFileSync(join(work, 'screen-grab-1.png'), png(1)); writeFileSync(join(work, 'screen-grab-2.png'), png(2))
writeFileSync(join(work, 'oracle-corpus.md'), '# Oracle research corpus\n\nThe bond sale, the share sale, and who prepays.\n')

const transcript: string[] = []
const log = (cmd: string, out: string) => transcript.push(`$ ${cmd}\n${out}`)
log(`board_session.py ${piece} show`, await py(piece, 'show'))
const started = await py(piece, 'start', 'Reading the lock and the research', '--step', step)
const session = /as session (\S+?)\./.exec(started)![1]
log(`board_session.py ${piece} start "Reading the lock and the research" --step ${step}`, started)

// Three more sessions on the same piece at the same time, over the same routes.
const post = (path: string, b: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json() as Promise<Record<string, any>>)
const others = [1, 2, 3].map(async n => {
  const id = `other-${n}-sess`
  await post('/api/content-ideas/sessions', { piece_id: piece, session_id: id, kind: 'start', step: 'research', summary: `Session ${n} on the numbers`, by: 'claude.ai', via: 'control_center' })
  for (let k = 0; k < 3; k++) {
    const r = await post('/api/content-ideas/store?op=text', { piece_id: piece, content: `Source ${k} found by session ${n}.`, title: `Source ${n}.${k}`, kind: 'research', session_id: id, by: 'claude.ai', via: 'control_center' })
    assert.equal(r.ok, true, JSON.stringify(r))
    await post('/api/content-ideas/sessions', { piece_id: piece, session_id: id, kind: 'progress', summary: `Filed source ${k}`, fields: [{ name: 'notes', value: `${n}.${k}`, mode: 'append' }], by: 'claude.ai' })
  }
  await post('/api/content-ideas/sessions', { piece_id: piece, session_id: id, kind: n === 3 ? 'progress' : 'done', summary: n === 3 ? 'Still checking the bond terms' : `Session ${n} done`, by: 'claude.ai' })
})
const mine = (async () => {
  for (const f of ['screen-grab-1.png', 'screen-grab-2.png', 'oracle-corpus.md']) {
    const out = await py(piece, 'add', join(work, f), '--session', session, '--role', f.endsWith('.png') ? 'inspiration' : 'research')
    log(`board_session.py ${piece} add ${f} --session ${session}`, out)
  }
  log(`board_session.py ${piece} progress "Two screen grabs and the corpus filed" --session ${session} --step ${step}`,
    await py(piece, 'progress', 'Two screen grabs and the corpus filed', '--session', session, '--step', step))
})()
await Promise.all([...others, mine])
log(`board_session.py ${piece} done "Storyboard and scripts drafted" --session ${session} --step ${step}`,
  await py(piece, 'done', 'Storyboard and scripts drafted', '--session', session, '--step', step))
// A retry of the same report (a timeout, say) lands once.
await py(piece, 'done', 'Storyboard and scripts drafted', '--session', session, '--step', step)

// ── what the board reads now ────────────────────────────────────────────────────────────────────────────────────────
const after = await view()
const day = after.days.find(d => d.day === 'mon')!
const schema = JSON.parse(readFileSync('apps/control-plane/api/board/view.schema.json', 'utf8'))
assert.deepEqual(validate(schema, JSON.parse(JSON.stringify({ ok: true, ...after }))), [], 'the view keeps its contract')
assert.equal(day.sessions.length, 4, 'four sessions on the piece')
assert.equal(day.sessions.find(s => s.session_id === session)?.state, 'done')
assert.equal(day.sessions.find(s => s.session_id === session)?.doing, 'Storyboard and scripts drafted')
assert.equal(day.sessions.filter(s => s.state === 'working').length, 1, 'one other still working')
const titles = day.materials.map(m => m.title)
for (const t of ['screen-grab-1.png', 'screen-grab-2.png', 'oracle-corpus.md', 'Oracle 10-Q notes']) assert.ok(titles.includes(t), `the board lists ${t}`)
assert.equal(day.materials.filter(m => m.kind === 'research').length, 9, 'every source the three sessions filed')
assert.equal(day.materials.filter(m => m.thumbnail).length, 2, 'the two screen grabs carry a thumbnail')
assert.equal(day.materials.filter(m => m.kind === 'screenshot').length, 2, 'named as screen grabs')
assert.equal(day.materials.find(m => m.title === 'oracle-corpus.md')?.kind, 'corpus', 'a corpus stays a corpus on the working set')
const events = (await pool.query(`select count(*)::int n from board_session_events where piece_id = $1 and session_id = $2`, [piece, session])).rows[0].n
assert.equal(events, 3, 'start, progress and done: the retried done landed once')
// Any later session sees where everything is, and opens the two screen grabs.
const listing = await fetch(`${base}/api/content-ideas/store?piece=${piece}`, { headers: { authorization: `Bearer ${TOKEN}` } }).then(r => r.json()) as { materials: Array<Record<string, any>> }
const grabs = listing.materials.filter(m => m.kind === 'screenshot')
assert.equal(grabs.length, 2)
for (const g of grabs) {
  const out = await py(piece, 'read', g.id, '--out', work)
  assert.match(out, /^Saved /)
  const saved = out.replace(/^Saved .* to /, '')
  assert.equal(createHash('sha256').update(readFileSync(saved)).digest('hex'), g.sha256, 'the bytes read back are the bytes filed')
}
log(`board_session.py ${piece} show`, await py(piece, 'show'))
console.log(transcript.join('\n\n'))
console.log('\nThe board (view) for Monday now carries:')
console.log(JSON.stringify({ sessions: day.sessions.map(s => `${s.state}: ${s.session_id} (${s.by}) ${s.step ?? ''} ${s.doing ?? ''}`), materials: day.materials.map(m => `${m.kind}: ${m.title} by ${m.added_by}${m.thumbnail ? ' [thumbnail]' : ''}`) }, null, 1))
console.log('\nPASS: a session following the copied prompt reported start, progress and done and filed two screen grabs and a corpus; three more sessions worked on the same piece at once; the board view shows all four sessions and every material, and keeps its contract.')

server.close(); await pool.end(); await root.query(`drop database ${name}`); await root.end()
