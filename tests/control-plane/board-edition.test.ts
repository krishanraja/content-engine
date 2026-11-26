import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withApprovals } from './_approvals'
import { buildView, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { modelProblems } from '../../apps/control-plane/api/board/_weekModel'
import { checkEditionBind, editionDate, editionPaths, editionView, parseEdition, readEdition, sha256, type EditionRead } from '../../apps/control-plane/api/board/_edition'
import { EDITION_DOC, hisOnlyRefusal, validBody } from '../../apps/control-plane/api/board/_contracts'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { SCHEMA_PATH, validate } from '../../scripts/check-view-contract'

// The weekly edition on the Saturday card, and his one press, Approve for send (contract 1.35.0; Krish, 2026-11-25: one
// email a week, "makeyourmindup weekly", every Saturday at 08:00 New York, sent only on his press). The package the Friday
// run files (scripts/edition/edition.py package, content-engine-edition/1) is read here as the board reads it, his press
// binds its sha256, and a press bound to another sha256 is refused, 409, as the piece manifest's is.

type Body = Record<string, any>
const WEEK = '2026-11-09'
const SATURDAY = '2026-11-14'
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Body

/** The fixture week's draft, packaged by scripts/edition/edition.py itself: the exact bytes the Friday run files. */
function packaged(change = ''): Buffer {
  const code = [
    'import json, sys, tempfile, pathlib',
    'sys.path.insert(0, "scripts/edition")',
    'import edition as ed',
    // The hub's subsectors, as the fixture copies config/hub-sources.json (which the hub pipeline brings).
    'ed.HUB_SOURCES_PATH = pathlib.Path("tests/fixtures/edition/week-2026-11-09/hub-sources.json")',
    'd = json.loads(pathlib.Path("tests/fixtures/edition/week-2026-11-09/edition.json").read_text(encoding="utf-8")); d.pop("_about")',
    'change = sys.argv[1]',
    'if change: d["sections"][-1]["text"] = change',
    'out = pathlib.Path(tempfile.mkdtemp())',
    'ed.package(d, out, kill=lambda t: [])',
    'sys.stdout.buffer.write((out / "0 Publish" / "edition.draft.json").read_bytes())',
  ].join('\n')
  return execFileSync('python3', ['-c', code, change])
}
const read = (bytes: Buffer, preview = true): EditionRead => ({ draft: parseEdition(bytes, SATURDAY)!, bytes,
  preview: preview ? { object_key: 'files/preview.html', sha256: sha256('<!doctype html>') } : null })
const hisPress = (sha: string, revision = 2, by = 'Krish') => ({ doc_id: EDITION_DOC, updated_by: by, revision,
  body: { kind: 'approve_send', day: 'sat', edition_date: SATURDAY, approved: true, edition_sha256: sha, at: '2026-11-14T12:05:00Z' } })

describe('the edition the Friday run packages is the edition the board reads', () => {
  const bytes = packaged()

  it('reads the package as edition.py writes it: its sha256 is the bytes\', its sections in brief', () => {
    const e = parseEdition(bytes, SATURDAY)!
    expect(e.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect([e.subject, e.pieces.map(p => p.day), e.news.items, e.news.topics.length, e.checks]).toEqual([
      'Who got paid when an AI app went bust, and a UK number two', ['mon', 'wed', 'fri'], 8, 6,
      { voice: 'pass', kill_list: 'pass', sources: 'pass', words: 704 }])
    expect(e.sources[0]).toEqual({ label: 'Example Records', href: 'https://example.org/records/news/ai-licence' })
    expect(e.contents).toHaveLength(4)
    expect(editionDate(WEEK)).toBe(SATURDAY)
    expect(editionPaths(SATURDAY).draft).toBe('3 Posts/2026-11-14 Sat edition - makeyourmindup weekly/0 Publish/edition.draft.json')
  })

  it('refuses a draft for another Saturday, of another shape, or with a check that failed', () => {
    expect(parseEdition(bytes, '2026-11-21')).toBeNull()
    const pkg = JSON.parse(bytes.toString('utf8'))
    expect(parseEdition(Buffer.from(JSON.stringify({ ...pkg, schema: 'content-engine-piece-manifest/1' })), SATURDAY)).toBeNull()
    expect(parseEdition(Buffer.from(JSON.stringify({ ...pkg, checks: { ...pkg.checks, sources: 'fail' } })), SATURDAY)).toBeNull()
    expect(parseEdition(Buffer.from('not json'), SATURDAY)).toBeNull()
  })
})

describe('the Saturday carries the edition and his Approve for send, bound to its sha256', () => {
  const bytes = packaged()
  const e = read(bytes)
  const inputs = (picks: ViewInputs['picks'], edition: EditionRead | null = e): ViewInputs =>
    withApprovals({ week: WEEK, now: new Date('2026-11-13T22:00:00Z'), pieces: [], picks, queue: [], history: [], runs: {}, north_star: null, ideas: null, locks: {}, edition })

  it('waits on his press: the press leads Saturday, and the model draws one edition item with it as its decision', () => {
    const v = buildView(inputs([]))
    const sat = v.days.find(d => d.day === 'sat')!
    expect(sat.edition).toMatchObject({ kind: 'edition', edition_date: SATURDAY, sha256: e.draft.sha256, state: 'waiting', approved_at: null, approved_sha256: null,
      files: { draft: `/api/board/${WEEK}/edition/draft`, preview: `/api/board/${WEEK}/edition/preview` } })
    expect(sat.edition!.press).toMatchObject({ kind: 'press', label: 'Approve for send', collection: 'picks', id: 'sat-edition', stamp: ['at'],
      body: { kind: 'approve_send', day: 'sat', edition_date: SATURDAY, approved: true, edition_sha256: e.draft.sha256 } })
    expect(sat.actions[0]).toEqual(sat.edition!.press)
    expect(v.days.filter(d => d.day !== 'sat').every(d => d.edition === null)).toBe(true)
    const items = v.model!.days.find(d => d.day === 'sat')!.items
    const it = items.find(i => i.kind === 'edition')!
    expect([it.key, it.type, it.kind_label, it.title, it.stage.key, it.decision, it.next]).toEqual([
      `edition:${SATURDAY}`, 'post', 'Weekly edition', e.draft.subject, 'drafted', true, sat.edition!.press])
    expect(it.path.map(s => `${s.key}:${s.state}`)).toEqual(['drafted:done', 'approved:current', 'scheduled:todo', 'sent:todo'])
    expect(it.links.map(l => l.href)).toEqual([`https://controlcenter.krishraja.com/api/board/${WEEK}/edition/preview`, `https://controlcenter.krishraja.com/api/board/${WEEK}/edition/draft`])
    expect(it.line).toBe('Drafted: 3 pieces and 8 news items, each checked against its primary source. Read the preview, then Approve for send; nothing is sent until you do.')
    expect(it.read.sources).toHaveLength(8)
    expect(modelProblems(v.model!, v.days)).toEqual([])
    expect(validate(SCHEMA, JSON.parse(JSON.stringify({ ok: true, ...v })))).toEqual([])
  })

  it('stands approved when his press binds exactly this draft, and needs a fresh press when the draft changed', () => {
    const approved = editionView(e, [hisPress(e.draft.sha256)], WEEK)!
    expect([approved.state, approved.press, approved.approved_at, approved.approved_sha256]).toEqual(['approved', null, '2026-11-14T12:05:00Z', e.draft.sha256])
    const v = buildView(inputs([hisPress(e.draft.sha256)]))
    const it = v.model!.days.find(d => d.day === 'sat')!.items.find(i => i.kind === 'edition')!
    expect([it.stage.key, it.next, it.decision, it.approved]).toEqual(['approved', null, false, 'Approved for send by you, Sat 14 Nov, 07:05'])
    expect(it.path.map(s => s.state)).toEqual(['done', 'done', 'current', 'todo'])
    expect(modelProblems(v.model!, v.days)).toEqual([])
    const changed = editionView(read(packaged('That is the week, and the next edition lands on Saturday 21 November, as ever.')), [hisPress(e.draft.sha256)], WEEK)!
    expect([changed.state, changed.press!.label, changed.press!.revision, changed.approved_sha256]).toEqual(['changed', 'Approve the new edition for send', 2, e.draft.sha256])
    expect(changed.why).toMatch(/changed after you approved it/)
    // A press that is not his never counts, and a week with no edition filed carries none.
    expect(editionView(e, [hisPress(e.draft.sha256, 2, 'engine_operator')], WEEK)!.state).toBe('waiting')
    expect(buildView(inputs([], null)).days.find(d => d.day === 'sat')!.edition).toBeNull()
  })

  it('takes only his press, for a Saturday, bound to a sha256', () => {
    const body = { kind: 'approve_send', day: 'sat', edition_date: SATURDAY, approved: true, edition_sha256: e.draft.sha256, at: '2026-11-14T12:05:00Z' }
    expect(validBody('picks', 'sat-edition', body)).toBe(true)
    expect(validBody('picks', 'sat-edition', { ...body, approved: false, edition_sha256: undefined })).toBe(false)
    const { edition_sha256: _sha, ...takeBack } = { ...body, approved: false }
    expect(validBody('picks', 'sat-edition', takeBack)).toBe(true)
    expect(validBody('picks', 'sat-edition', { ...body, edition_sha256: 'x' })).toBe(false)
    expect(validBody('picks', 'sat-edition', { ...body, edition_date: '2026-11-13' })).toBe(false)
    expect(validBody('picks', 'sat-edition', { ...body, send: true })).toBe(false)
    expect(validBody('picks', 'sat-edition', { ...body, note: 'x' })).toBe(false)
    expect(validBody('picks', 'fri-edition', body)).toBe(false)
    expect(validBody('picks', 'sat-publish', body)).toBe(false)
    expect(hisOnlyRefusal('picks', body, 'engine_operator')).toBe('decision_is_his')
    expect(hisOnlyRefusal('picks', body, 'Krish')).toBeNull()
  })
})

/** A store holding the week's edition, its preview and his press, read through the same calls the board makes. */
function store(bytes: Buffer, opts: { libSha?: string; none?: boolean; press?: Body; hub?: Body[]; hubError?: boolean; asked?: Body } = {}) {
  const page = Buffer.from('<!doctype html><title>Preview</title>')
  const paths = editionPaths(SATURDAY)
  const rows: Record<string, Body> = {
    [paths.draft]: { path: paths.draft, object_key: 'files/draft.json', sha256: opts.libSha ?? sha256(bytes), ready_at: '2026-11-13T18:00:00Z' },
    [paths.preview]: { path: paths.preview, object_key: 'files/preview.html', sha256: sha256(page), ready_at: '2026-11-13T18:00:00Z' },
  }
  const query = (table: string) => {
    const filters: Record<string, unknown> = {}
    const q: Body = {}
    for (const k of ['select', 'in', 'order', 'gte', 'lte', 'limit', 'not', 'is', 'like']) q[k] = () => q
    q.eq = (k: string, v: unknown) => { filters[k] = v; return q }
    q.gte = (k: string, v: unknown) => { if (opts.asked) opts.asked[`${table} ${k} >=`] = v; return q }
    q.lte = (k: string, v: unknown) => { if (opts.asked) opts.asked[`${table} ${k} <=`] = v; return q }
    q.maybeSingle = async () => ({ error: null, data: null })
    q.then = (resolve: (v: unknown) => void) => resolve(table === 'content_library_files'
      ? { error: null, data: opts.none ? [] : [rows[String(filters.path)]].filter(Boolean) }
      : table === 'board_documents' ? { error: null, data: opts.press ? [opts.press] : [] }
      : table === 'hub_snapshots' ? (opts.hubError ? { error: { message: 'relation "public.hub_snapshots" does not exist' }, data: null } : { error: null, data: opts.hub ?? [] })
      : { error: null, data: [] })
    return q
  }
  const files: Record<string, Buffer> = { 'files/draft.json': bytes, 'files/preview.html': page }
  return { from: query, storage: { from: () => ({ download: async (key: string) => ({ error: null, data: new Blob([files[key]!]) }) }) },
    rpc: async () => ({ error: null, data: { ok: true, revision: 3 } }) }
}

describe('the board refuses a press bound to anything but the edition as it stands', () => {
  const bytes = packaged()
  const sha = sha256(bytes)
  const body = { kind: 'approve_send', day: 'sat', edition_date: SATURDAY, approved: true, edition_sha256: sha }

  it('reads the newest library copy whose bytes match the hash the library recorded', async () => {
    expect((await readEdition(store(bytes) as never, WEEK))?.draft.sha256).toBe(sha)
    expect(await readEdition(store(bytes, { libSha: 'f'.repeat(64) }) as never, WEEK)).toBeNull()
    expect(await readEdition(store(bytes, { none: true }) as never, WEEK)).toBeNull()
  })

  it('binds: the draft\'s hash passes, another is edition_changed, no edition or another Saturday is edition_not_found', async () => {
    await expect(checkEditionBind(store(bytes) as never, WEEK, body)).resolves.toBeUndefined()
    await expect(checkEditionBind(store(bytes) as never, WEEK, { ...body, edition_sha256: 'e'.repeat(64) })).rejects.toMatchObject({ status: 409, message: 'edition_changed' })
    await expect(checkEditionBind(store(bytes, { none: true }) as never, WEEK, body)).rejects.toMatchObject({ status: 409, message: 'edition_not_found' })
    await expect(checkEditionBind(store(bytes) as never, WEEK, { ...body, edition_date: '2026-11-21' })).rejects.toMatchObject({ status: 409, message: 'edition_not_found' })
    // Taking it back is not this check's.
    await expect(checkEditionBind(store(bytes) as never, WEEK, { ...body, approved: false, edition_sha256: 'e'.repeat(64) })).resolves.toBeUndefined()
  })

  const previous = { ...process.env }
  afterEach(() => {
    for (const k of ['ACCESS_CODE', 'GROWTH_WRITEBACK_TOKEN']) { if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k] }
  })
  const call = async (db: unknown, req: Body) => {
    const handler = createBoardHandler(async () => db as never)
    let status = 0; let out: unknown = null; const headers: Record<string, string> = {}
    const res = { setHeader(k: string, v: string) { headers[k.toLowerCase()] = v }, status(code: number) { status = code; return this },
      json(v: unknown) { out = v }, send(v: unknown) { out = v }, end() {}, redirect() {} } as unknown as VercelResponse
    await handler(req as unknown as VercelRequest, res)
    return { status, out, headers }
  }
  const cookie = () => `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE!).digest('hex')}`

  it('PUT /api/board/<Monday>/picks/sat-edition answers 409 edition_changed for a stale page, and saves his press on the draft as it stands', async () => {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    const put = (b: Body) => call(store(bytes), { method: 'PUT', headers: { cookie: cookie(), origin: 'https://controlcenter.krishraja.com' },
      query: { week: WEEK, collection: 'picks', id: 'sat-edition' }, body: { body: { ...b, at: '2026-11-14T12:05:00Z' }, revision: 0 } })
    expect(await put({ ...body, edition_sha256: 'e'.repeat(64) })).toMatchObject({ status: 409, out: { ok: false, error: 'edition_changed' } })
    expect((await put(body)).status).toBe(200)
  })

  it('GET /api/board/<Monday>/edition serves the item, the draft\'s exact bytes and the preview, to him or to Growth\'s key only', async () => {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.GROWTH_WRITEBACK_TOKEN = 'growth-key-x'
    const get = (id: string, headers: Body, db = store(bytes, { press: hisPress(sha) })) => call(db, { method: 'GET', headers, query: { week: WEEK, op: 'edition', ...(id ? { id } : {}) } })
    const growth = { authorization: 'Bearer growth-key-x' }
    const item = await get('', growth)
    expect(item.status).toBe(200)
    expect((item.out as Body).edition).toMatchObject({ state: 'approved', sha256: sha, approved_sha256: sha, press: null })
    const draft = await get('draft', { cookie: cookie() })
    expect([draft.status, sha256(draft.out as Buffer), draft.headers['x-content-sha256']]).toEqual([200, sha, sha])
    const preview = await get('preview', growth)
    expect([preview.status, String(preview.out)]).toEqual([200, '<!doctype html><title>Preview</title>'])
    expect(preview.headers['content-security-policy']).toMatch(/default-src 'none'/)
    expect((await get('draft', {})).status).toBe(401)
    expect((await get('cover', growth)).status).toBe(404)
    expect((await get('draft', growth, store(bytes, { none: true }))).out).toEqual({ ok: false, error: 'edition_not_found' })
  })

  it('GET /api/board/<Monday>/edition/news serves the week\'s daily hub items the Friday run chooses from, read only', async () => {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    const item = (id: string, extra: Body = {}) => ({ id, subsector: 'music', date: '2026-11-10T09:00:00Z', source: 'Example Trade',
      url: `https://example.org/trade/${id}`, headline: 'A label licenses its catalogue', dek: 'It is paid on every track.', why: 'It pays.',
      coverage: 3, companies: ['Example Records'], tickers: [], image: { kind: null, url: null }, ...extra })
    const snapshot = (date: string, items: Body[], extra: Body = {}) => ({ edition_date: date, payload: { ok: true, version: 1, edition_date: date, items, ...extra } })
    const asked: Body = {}
    const hub = [
      snapshot('2026-11-09', [item('a'), item('b', { url: 'http://example.org/insecure' }), item('c', { headline: ' ' })]),
      snapshot('2026-11-10', [item('d', { why: '', coverage: 0 })]),
      snapshot('2026-11-11', [item('e')], { ok: false }),
      snapshot('2026-11-12', [item('f')], { edition_date: '2026-11-01' }),
    ]
    const get = (db: unknown, headers: Body = { cookie: cookie() }) => call(db, { method: 'GET', headers, query: { week: WEEK, op: 'edition', id: 'news' } })
    const news = await get(store(bytes, { hub, asked }))
    expect(news.status).toBe(200)
    // The eight daily editions the window can draw on: the Friday before the week to its Friday.
    expect(asked).toEqual({ 'hub_snapshots edition_date >=': '2026-11-06', 'hub_snapshots edition_date <=': '2026-11-13' })
    expect(news.out).toEqual({ ok: true, week: WEEK, from: '2026-11-06', to: '2026-11-13',
      days: [
        { edition_date: '2026-11-09', skipped: 2, items: [{ id: 'a', subsector: 'music', date: '2026-11-10T09:00:00Z', source: 'Example Trade',
          url: 'https://example.org/trade/a', headline: 'A label licenses its catalogue', dek: 'It is paid on every track.', why: 'It pays.', coverage: 3 }] },
        { edition_date: '2026-11-10', skipped: 0, items: [{ id: 'd', subsector: 'music', date: '2026-11-10T09:00:00Z', source: 'Example Trade',
          url: 'https://example.org/trade/d', headline: 'A label licenses its catalogue', dek: 'It is paid on every track.', why: null, coverage: 1 }] },
      ],
      // A row that is not a good snapshot is said as missing, never read.
      missing: ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-11', '2026-11-12', '2026-11-13'] })
    expect(await get(store(bytes, { hubError: true }))).toMatchObject({ status: 503, out: { ok: false, error: 'hub_unavailable' } })
    expect((await get(store(bytes, { hub }), {})).status).toBe(401)
    expect((await call(store(bytes, { hub }), { method: 'POST', headers: { cookie: cookie(), origin: 'https://controlcenter.krishraja.com' }, query: { week: WEEK, op: 'edition', id: 'news' }, body: {} })).status).toBe(405)
  })

  it('routes /api/board/<Monday>/edition[/<file>] to the edition before the board\'s collections', () => {
    const routes = (JSON.parse(readFileSync('apps/control-plane/vercel.json', 'utf8')).rewrites as Array<{ source: string; destination: string }>)
    const at = (source: string) => routes.findIndex(r => r.source === source)
    expect(routes[at('/api/board/:week/edition')]?.destination).toBe('/api/board?week=:week&op=edition')
    expect(routes[at('/api/board/:week/edition/:id')]?.destination).toBe('/api/board?week=:week&op=edition&id=:id')
    expect(at('/api/board/:week/edition/:id')).toBeLessThan(at('/api/board/:week/:collection/:id'))
    expect(at('/api/board/:week/edition')).toBeLessThan(at('/api/board/:week/:collection'))
  })
})

describe('the package bytes are the same on both sides', () => {
  it('scripts/edition/edition.py and the board agree on the sha256 of the bytes filed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'edition-'))
    const draft = join(dir, 'draft.json')
    execFileSync('python3', ['-c', 'import json,sys,pathlib; d=json.loads(pathlib.Path("tests/fixtures/edition/week-2026-11-09/edition.json").read_text(encoding="utf-8")); d.pop("_about"); pathlib.Path(sys.argv[1]).write_text(json.dumps(d), encoding="utf-8")', draft])
    const out = join(dir, 'pack')
    // edition.py's command line, reading the fixture's copy of the hub's subsectors (config/hub-sources.json).
    const cli = 'import pathlib, sys; sys.path.insert(0, "scripts/edition"); import edition as ed; ed.HUB_SOURCES_PATH = pathlib.Path("tests/fixtures/edition/week-2026-11-09/hub-sources.json"); sys.exit(ed.main(sys.argv[1:]))'
    const printed = JSON.parse(execFileSync('python3', ['-c', cli, 'package', draft, '--out', out], { encoding: 'utf8' }))
    const bytes = readFileSync(join(out, '0 Publish', 'edition.draft.json'))
    expect(parseEdition(bytes, SATURDAY)!.sha256).toBe(printed.sha256)
    expect(printed.draft_path).toBe(editionPaths(SATURDAY).draft)
  })
})
