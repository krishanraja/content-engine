import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { withApprovals } from './_approvals'
import { buildView, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { WRITE_BACK_HEAD, attachOverlay, stepKey, withWriteBack, writeBack } from '../../apps/control-plane/api/board/_writeBack'
import { StoreError, addText, confirmFile, listing, parseReport, parseScope, writerOf, type StoreDb } from '../../apps/control-plane/api/_pieceStore'
import { createSessionsHandler } from '../../apps/control-plane/api/content-ideas/sessions'

// Board sessions and the piece materials store (docs/PUBLISH_BOARDS.md, "Sessions and materials"). The database rules
// themselves (append only, idempotent reports, revision conflicts, four sessions at once) are run against the real
// migration in tests/board-sessions-db.mjs; a copied prompt followed end to end is tests/integration/board-sessions-e2e.ts.

type Body = Record<string, any>
const WEEK = '2026-11-16'
const MON = '8287846b-6618-4a19-9fb8-23ad4eca2718', WED = 'db9f9f6a-1092-49be-8024-f335e060305a'
const piece = (id: string, date: string, slot: string, meta: Body = {}) =>
  ({ id, idea: `Piece ${id.slice(0, 4)}. It says one thing.`, scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, body: '', updated_at: '2026-11-09T12:00:00Z', meta })
const inputs = (over: Partial<ViewInputs> = {}): ViewInputs => withApprovals({
  week: WEEK, now: new Date('2026-11-16T09:00:00Z'), pieces: [piece(MON, '2026-11-16', 'follow_the_money'), piece(WED, '2026-11-18', 'under_the_hood')],
  picks: [], queue: [], history: [], ideas: { offdays: { tue: [{ id: 'povteach', format: 'Meme' }], thu: [], sat: [] } }, locks: {}, runs: {}, north_star: null, ...over,
})

describe('every copied prompt carries how to report back, with no key in it', () => {
  it('each Claude and Growth prompt says it once, names the piece or the day, and the step', () => {
    const v = buildView(inputs())
    let n = 0
    for (const d of v.days) {
      for (const a of d.actions) {
        if (a.kind !== 'prompt') continue
        if (/Perplexity/i.test(a.label)) { expect(a.prompt).not.toContain(WRITE_BACK_HEAD); continue }
        n++
        expect(a.prompt.split(WRITE_BACK_HEAD).length - 1).toBe(1)
        expect(a.prompt).toContain(d.piece_id ? `piece_id ${d.piece_id}` : `week ${WEEK} and day ${d.day}`)
        expect(a.prompt).toMatch(/report_board_session/)
        expect(a.prompt).toMatch(/scripts\/post-pack\/board_session\.py/)
        expect(a.prompt).not.toMatch(/Bearer|ENGINE_OPERATOR_TOKEN|hmcp1_|eyJ[A-Za-z0-9]/)
      }
      if (d.path) {
        expect(d.path.prompts.research).not.toContain(WRITE_BACK_HEAD)
        for (const k of ['story', 'storyboard', 'mock'] as const) expect(d.path.prompts[k]).toContain(WRITE_BACK_HEAD)
      }
    }
    expect(n).toBeGreaterThanOrEqual(6)
    // yours shares the day's actions: the same words there.
    for (const y of v.yours) for (const a of y.actions) if (a.kind === 'prompt' && !/Perplexity/i.test(a.label)) expect(a.prompt).toContain(WRITE_BACK_HEAD)
  })

  it('is added once however often it is applied, and says the day for a day with no piece', () => {
    const days = [{ day: 'tue', date: '2026-11-17', piece_id: null, who: 'growth', actions: [{ kind: 'prompt', label: 'Copy prompt for Growth', prompt: 'Post it.' }] }]
    withWriteBack(WEEK, days); withWriteBack(WEEK, days)
    const p = String(days[0].actions[0].prompt)
    expect(p.split(WRITE_BACK_HEAD).length - 1).toBe(1)
    expect(p).toContain('day:2026-11-16/tue')
    expect(p).toContain('step post')
    expect(stepKey('Storyboard and script')).toBe('storyboard-and-script')
    expect(stepKey('')).toBe('next')
    expect(writeBack({ pieceId: MON, week: WEEK, day: 'mon', step: 'board' })).toContain(`board_session.py ${MON} show`)
  })
})

describe('what the board carries for each day', () => {
  it('sessions working first, the piece and the day materials, thumbnails only for pictures', () => {
    const overlay = {
      sessions: [
        { session_id: 'old-done', scope: MON, state: 'done', by: 'claude.ai', last_at: '2026-11-16T08:00:00Z', started_at: '2026-11-16T07:00:00Z' },
        { session_id: 'live-one', scope: MON, state: 'working', by: 'Claude Code', step: 'board', doing: 'Script', last_at: '2026-11-16T07:30:00Z', started_at: '2026-11-16T07:00:00Z' },
        { session_id: 'tue-one', scope: `day:${WEEK}/tue`, state: 'working', by: 'claude.ai', last_at: '2026-11-16T07:30:00Z', started_at: '2026-11-16T07:00:00Z' },
      ],
      materials: [
        { id: 'a', scope: MON, piece_id: MON, kind: 'screenshot', title: 'Grab', bytes: 10, content_type: 'image/png', added_by: 'Krish', at: '2026-11-16T07:00:00Z', version: 1 },
        { id: 'b', scope: MON, piece_id: MON, kind: 'corpus', title: 'Corpus', bytes: 99, content_type: null, added_by: 'Claude Code', at: '2026-11-16T06:00:00Z', version: 3 },
        { id: 'c', scope: `day:${WEEK}/tue`, piece_id: null, kind: 'image', title: 'Tuesday', bytes: 5, content_type: 'image/jpeg', added_by: 'Krish', at: null, version: 1 },
      ],
    }
    const v = buildView(inputs({ overlay }))
    const mon = v.days.find(d => d.day === 'mon')!, tue = v.days.find(d => d.day === 'tue')!, wed = v.days.find(d => d.day === 'wed')!
    expect(mon.sessions.map(s => s.session_id)).toEqual(['live-one', 'old-done'])
    expect(mon.materials.map(m => [m.title, m.thumbnail, m.version, m.where])).toEqual([['Grab', 'a', 1, 'piece'], ['Corpus', null, 3, 'piece']])
    expect(tue.sessions.map(s => s.session_id)).toEqual(['tue-one'])
    expect(tue.materials.map(m => m.where)).toEqual(['day'])
    expect(wed.sessions).toEqual([]); expect(wed.materials).toEqual([])
    expect(v.sources.store).toBe(true)
    expect(attachOverlay(WEEK, [{ day: 'mon', piece_id: MON }], null)[0]).toMatchObject({ sessions: [], materials: [] })
  })
})

describe('what a session may send', () => {
  it('reads a report, and refuses one that is not', () => {
    const r = parseReport({ piece_id: MON.toUpperCase(), session_id: 'board-kxqp', kind: 'progress', summary: ' Drafting ', step: 'board' })
    expect(r.scope).toEqual({ piece_id: MON })
    expect(r.summary).toBe('Drafting')
    expect(r.client_key).toMatch(/^progress-[a-f0-9]{32}$/)
    expect(parseReport({ piece_id: MON, session_id: 'board-kxqp', kind: 'progress', summary: 'Drafting', step: 'board' }).client_key).toBe(r.client_key)
    const bad = (b: Body) => { try { parseReport(b); return null } catch (e) { return (e as StoreError).message } }
    expect(bad({ piece_id: MON, session_id: 'x', kind: 'start' })).toBe('invalid_session')
    expect(bad({ piece_id: MON, session_id: 'board-kxqp', kind: 'finish' })).toBe('invalid_kind')
    expect(bad({ piece_id: 'nope', session_id: 'board-kxqp', kind: 'start' })).toBe('invalid_piece')
    expect(bad({ week: '2026-11-17', session_id: 'board-kxqp', kind: 'start' })).toBe('invalid_scope')
    expect(bad({ piece_id: MON, session_id: 'board-kxqp', kind: 'progress', fields: [{ name: 'status', value: 1 }] })).toBe('base_revision_required')
    expect(bad({ piece_id: MON, session_id: 'board-kxqp', kind: 'progress', fields: [{ name: 'notes', value: 1, mode: 'append' }] })).toBe(null)
    expect(bad({ piece_id: MON, session_id: 'board-kxqp', kind: 'start', lease_seconds: 5 })).toBe('invalid_lease')
    expect(parseScope({ week: WEEK, day: 'Tuesday' })).toEqual({ week: WEEK, day: 'tue' })
    expect(writerOf(true, {})).toBe('Claude Code')
    expect(writerOf(true, { by: 'Codex' })).toBe('Codex')
    expect(writerOf(false, { by: 'claude.ai', via: 'control_center' })).toBe('claude.ai')
    expect(writerOf(false, { by: 'someone' })).toBe('Krish')
  })
})

// A fake of the narrow store client: content_ideas rows, the RPCs and the bucket, with the race the working set guards.
function fakeDb(opts: { races?: number } = {}) {
  const rows = new Map<string, Body>([[MON, { id: MON, idea: 'Oracle', scheduled_for: '2026-11-16', lane_slot: 'follow_the_money', meta: { making: { draft: 'done' } }, updated_at: 't0' }]])
  const calls: Array<[string, Body]> = []
  let races = opts.races ?? 0
  const stored: Body[] = []
  const objects = new Map<string, Buffer>()
  const db: StoreDb & { rows: typeof rows; calls: typeof calls; stored: Body[]; objects: typeof objects } = {
    rows, calls, stored, objects,
    rpc: async (fn, args) => {
      calls.push([fn, args])
      if (fn === 'board_material_put') { const p = args.p as Body; const m = { id: `m${stored.length}`, version: 1, scope: p.piece_id, ...p }; stored.push(m); return { data: { ok: true, duplicate: false, material: m }, error: null } }
      if (fn === 'board_overlay') return { data: { as_of: 'now', materials: stored.map(m => ({ ...m, key: m.material_key })), sessions: [{ session_id: 's-1', scope: MON, state: 'working' }], fields: [], events: [] }, error: null }
      if (fn === 'board_session_report') return { data: { ok: true, duplicate: false, event_id: 1, fields: [] }, error: null }
      if (fn === 'board_capture_materials') return { data: 0, error: null }
      return { data: null, error: { message: 'unknown' } }
    },
    from: (table: string) => {
      const filters: Body = {}
      let patch: Body | null = null
      const q: any = {
        select: () => q, eq: (c: string, v: unknown) => { filters[c] = v; return q }, update: (p: Body) => { patch = p; return q },
        maybeSingle: async () => ({ data: rows.get(String(filters.id)) ?? null, error: null }),
        then: (ok: (r: unknown) => unknown) => {
          const row = rows.get(String(filters.id))
          if (!patch || !row) return Promise.resolve({ data: [], error: null }).then(ok)
          // Another writer (a making record) lands between this read and this write, once per race.
          if (races > 0) { races--; row.meta = { ...row.meta, making: { ...row.meta.making, scripts: 'done' } }; row.updated_at = `t${Math.random()}` }
          if (filters.updated_at !== row.updated_at) return Promise.resolve({ data: [], error: null }).then(ok)
          rows.set(row.id, { ...row, ...patch, updated_at: `t${Math.random()}` })
          // The capture trigger: a working-set material is filed in the store in the same write.
          for (const m of (patch.meta as Body).materials || []) if (!stored.some(s => s.material_key === `meta:${m.id}`)) stored.push({ id: `cap-${m.id}`, material_key: `meta:${m.id}`, scope: MON, kind: m.store_kind, title: m.title })
          return Promise.resolve({ data: [{ id: row.id }], error: null }).then(ok)
        },
      }
      return table ? q : q
    },
    storage: { from: () => ({
      createSignedUrl: async (key: string) => (objects.has(key) ? { data: { signedUrl: `mem://${key}` }, error: null } : { data: null, error: {} }),
    }) },
  }
  return db
}

describe('the store, through its own code', () => {
  it('a piece text joins the working set without losing a write that lands in between, and is in the store', async () => {
    const db = fakeDb({ races: 2 })
    const r = await addText(db, { piece_id: MON, content: '# Corpus\n\nThe sources.', kind: 'corpus', role: 'research', session_id: 'board-kxqp' }, true, 'Claude Code')
    expect(r.working_set).toBe('added')
    const row = db.rows.get(MON)!
    expect(row.meta.making).toEqual({ draft: 'done', scripts: 'done' }) // the write that landed in between is kept
    expect(row.meta.materials).toHaveLength(1)
    expect(row.meta.materials[0]).toMatchObject({ title: 'Corpus', store_kind: 'corpus', role: 'research', session_id: 'board-kxqp', by: 'Claude Code' })
    expect((r.material as Body).material_key).toBe(`meta:${row.meta.materials[0].id}`)
  })

  it('a working set that never lets the write through still leaves the material in the store', async () => {
    const db = fakeDb({ races: 99 })
    const r = await addText(db, { piece_id: MON, content: 'One line of research.' }, true, 'Claude Code')
    expect(r.working_set).toBe('busy')
    expect(db.calls.some(([fn, a]) => fn === 'board_material_put' && String((a.p as Body).material_key).startsWith('meta:'))).toBe(true)
  })

  it('a long corpus, a named version and a day with no piece go to the store alone', async () => {
    const db = fakeDb()
    await addText(db, { piece_id: MON, content: 'x'.repeat(400_001) }, true, 'Claude Code')
    await addText(db, { piece_id: MON, content: 'v2', material_key: 'corpus', base_version: 1 }, true, 'Claude Code')
    await addText(db, { week: WEEK, day: 'tue', url: 'https://example.org/inspo' }, false, 'Krish')
    const puts = db.calls.filter(([fn]) => fn === 'board_material_put').map(([, a]) => a.p as Body)
    expect(puts.map(p => [p.storage, p.material_key ?? null, p.base_version ?? null, p.source])).toEqual([['text', null, null, 'session'], ['text', 'corpus', 1, 'session'], ['link', null, null, 'board']])
    expect(db.rows.get(MON)!.meta.materials).toBeUndefined()
  })

  it('a file counts only when every byte read back matches its sha256', async () => {
    const db = fakeDb()
    const bytes = Buffer.from('png bytes here')
    const sha = createHash('sha256').update(bytes).digest('hex')
    db.objects.set(`files/${sha}.png`, bytes)
    const fetcher = async (url: string) => {
      const b = db.objects.get(url.replace('mem://', ''))!
      return { ok: true, body: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(b)); c.close() } }) }
    }
    process.env.SUPABASE_URL ||= 'https://placeholder.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder'
    const ok = await confirmFile(db, { piece_id: MON, name: 'Screen grab 1.png', sha256: sha, bytes: bytes.length }, false, 'Krish', fetcher as never)
    expect((ok.material as Body)).toMatchObject({ kind: 'screenshot', storage: 'bucket', object_key: `files/${sha}.png`, source: 'board', added_by: 'Krish' })
    await expect(confirmFile(db, { piece_id: MON, name: 'x.png', sha256: sha, bytes: bytes.length + 1 }, false, 'Krish', fetcher as never)).rejects.toThrow('file_size_mismatch')
    db.objects.set(`files/${'f'.repeat(64)}.png`, bytes)
    await expect(confirmFile(db, { piece_id: MON, name: 'x.png', sha256: 'f'.repeat(64), bytes: bytes.length }, false, 'Krish', fetcher as never)).rejects.toThrow('file_hash_mismatch')
    await expect(confirmFile(db, { piece_id: MON, name: 'x.exe', sha256: sha, bytes: 3 }, false, 'Krish', fetcher as never)).rejects.toThrow('file_type_not_allowed')
  })

  it('a listing first files whatever the working set holds, then reads everything on record', async () => {
    const db = fakeDb()
    db.rows.get(MON)!.meta.materials = [{ id: 'old', kind: 'paste', title: 'Old', content: 'x' }]
    const l = await listing(db, { piece_id: MON })
    expect(db.calls[0][0]).toBe('board_capture_materials')
    expect(l.piece).toMatchObject({ id: MON, week: '2026-11-16', day: 'mon' })
    expect(l.working).toBe(1)
  })

  it('the sessions route answers a report with who else is on the piece', async () => {
    const db = fakeDb()
    process.env.ENGINE_OPERATOR_TOKEN = 'test-operator-key'
    let status = 0, json: Body = {}
    const res: any = { setHeader: () => res, status: (s: number) => { status = s; return res }, json: (b: Body) => { json = b; return res }, end: () => res }
    const handler = createSessionsHandler(async () => db)
    await handler({ method: 'POST', headers: { authorization: 'Bearer test-operator-key' }, query: {}, body: { piece_id: MON, session_id: 'board-kxqp', kind: 'start', summary: 'Starting' } } as never, res)
    expect(status).toBe(201)
    expect(json.others).toEqual([{ session_id: 's-1', scope: MON, state: 'working' }])
    expect((db.calls.find(([fn]) => fn === 'board_session_report')![1].p as Body)).toMatchObject({ piece_id: MON, session_id: 'board-kxqp', by: 'Claude Code', kind: 'start' })
    await handler({ method: 'POST', headers: {}, query: {}, body: {} } as never, res)
    expect(status).toBe(401)
  })
})
