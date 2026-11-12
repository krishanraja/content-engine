import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withApprovals } from './_approvals'
import { buildView, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { checkPublishBind, dayManifest, draftPath, parseDraft, readDrafts, sha256 } from '../../apps/control-plane/api/board/_manifest'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'

// Approve for publish, bound to the piece's manifest (contract 1.8.0; docs/GROWTH-HANDOFF.md, "The piece manifest"):
// he approves exactly the files he can see, his press carries the draft's sha256, piece_manifest.py seal accepts it, and
// a draft that changes after his press needs his press again.

type Body = Record<string, any>
const WEEK = '2026-11-16'
const PIECE = '8287846b-6618-4a19-9fb8-23ad4eca2718'
const FOLDER = '2026-11-16 Mon follow.the.money - The fixture'
const spec = (words = 'Synthetic caption.') => ({ piece_id: PIECE, qa: { state: 'passed', checked_at: '2026-11-15T07:00:00Z' },
  assets: [{ name: 'short_video', drive_id: 'a'.repeat(25), sha256: '1'.repeat(64) }, { name: 'vertical_cover', drive_id: 'b'.repeat(25), sha256: '2'.repeat(64) }],
  channels: { tiktok: { words, alt_text: null, assets: ['short_video'] }, linkedin: { words, alt_text: ['A synthetic cover.'], assets: ['vertical_cover'] } } })

/** A draft's exact bytes, as scripts/post-pack/piece_manifest.py draft writes them (its own draft() and encode()). */
function draftBytes(words?: string): Buffer {
  const code = 'import json,sys; sys.path.insert(0, "scripts/post-pack"); import piece_manifest as pm; sys.stdout.buffer.write(pm.encode(pm.draft(json.loads(sys.argv[1]))))'
  return execFileSync('python3', ['-c', code, JSON.stringify(spec(words))])
}
const piece = { id: PIECE, idea: 'The fixture. It says one thing.', scheduled_for: WEEK, lane_slot: 'follow_the_money', state: 'drafting', buried_at: null, body: '',
  updated_at: '2026-11-15T12:00:00Z', meta: { making: { pack: { folder: FOLDER } } } }
const inputs = (picks: ViewInputs['picks'], drafts: ViewInputs['drafts']): ViewInputs =>
  withApprovals({ week: WEEK, now: new Date('2026-11-16T09:00:00Z'), pieces: [piece], picks, queue: [], history: [], runs: {}, north_star: null, ideas: null, locks: {}, drafts })
const hisPress = (manifest: string, revision = 3) => ({ doc_id: 'mon-publish', updated_by: 'Krish', revision,
  body: { kind: 'approve_publish', day: 'mon', piece_id: PIECE, approved: true, manifest_sha256: manifest, at: '2026-11-16T08:40:00Z' } })

describe('the day carries its manifest and his Approve for publish, bound to its sha256', () => {
  const bytes = draftBytes()
  const draft = parseDraft(bytes, PIECE)!

  it('reads a draft in Growth\'s shape: its sha256 is the bytes\', its files in order with their Drive links', () => {
    expect(draft.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(draft.assets.map(a => [a.name, a.order, a.url])).toEqual([
      ['short_video', 1, `https://drive.google.com/file/d/${'a'.repeat(25)}/view`], ['vertical_cover', 2, `https://drive.google.com/file/d/${'b'.repeat(25)}/view`]])
    expect(draft.channels).toEqual(['tiktok', 'linkedin'])
    expect(parseDraft(bytes, 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118')).toBeNull()
    expect(parseDraft(Buffer.from('{"schema":"content-engine-piece-manifest/1","approval_sha256":"x"}'), PIECE)).toBeNull()
    expect(draftPath(piece)).toBe(`3 Posts/${FOLDER}/0 Publish/manifest.draft.json`)
  })

  it('waits on his press: the press leads the day, bound to the draft', () => {
    const mon = buildView(inputs([], { [PIECE]: draft })).days.find(d => d.day === 'mon')!
    expect(mon.manifest).toMatchObject({ sha256: draft.sha256, state: 'waiting', approved_at: null, qa: 'passed' })
    expect(mon.manifest!.press).toMatchObject({ kind: 'press', label: 'Approve for publish', collection: 'picks', id: 'mon-publish',
      body: { kind: 'approve_publish', day: 'mon', piece_id: PIECE, approved: true, manifest_sha256: draft.sha256 }, stamp: ['at'] })
    expect(mon.actions[0]).toEqual(mon.manifest!.press)
  })

  it('stands approved when his press binds exactly this draft, and needs a fresh press when the draft changed', () => {
    const approved = dayManifest(draft, [hisPress(draft.sha256)], 'mon')!
    expect([approved.state, approved.press, approved.approved_at]).toEqual(['approved', null, '2026-11-16T08:40:00Z'])
    const changed = dayManifest(parseDraft(draftBytes('Changed words.'), PIECE)!, [hisPress(draft.sha256)], 'mon')!
    expect(changed.state).toBe('changed')
    expect(changed.press!.label).toBe('Approve the new files for publish')
    expect(changed.press!.revision).toBe(3)
    expect(changed.why).toMatch(/changed after you approved them/)
    // A press that is not his (an operator's write) never counts as his approval.
    expect(dayManifest(draft, [{ ...hisPress(draft.sha256), updated_by: 'engine_operator' }], 'mon')!.state).toBe('waiting')
  })

  it('piece_manifest.py seal accepts his press as the live board saves it, and refuses it for a changed draft', () => {
    const press = dayManifest(draft, [], 'mon')!.press!
    // What the board saves: the engine's own body, the time at its stamp (Control Centre's pressRequest).
    const saved = { id: press.id, updated_by: 'Krish', body: { ...press.body, at: '2026-11-16T08:41:00Z' } }
    const dir = mkdtempSync(join(tmpdir(), 'manifest-'))
    writeFileSync(join(dir, 'draft.json'), bytes)
    writeFileSync(join(dir, 'approval.json'), JSON.stringify(saved))
    const seal = (d: string) => spawnSync('python3', ['scripts/post-pack/piece_manifest.py', 'seal', '--draft', d, '--approval', join(dir, 'approval.json'), '--out', join(dir, 'manifest.json')], { encoding: 'utf8' })
    const ok = seal(join(dir, 'draft.json'))
    expect(ok.status, ok.stderr).toBe(0)
    writeFileSync(join(dir, 'changed.json'), draftBytes('Changed words.'))
    const refused = seal(join(dir, 'changed.json'))
    expect(refused.status).toBe(1)
    expect(refused.stderr).toMatch(/bound to another manifest/)
  })
})

/** A store holding one piece and its draft in the library. */
function store(bytes: Buffer, opts: { libSha?: string } = {}) {
  const query = (table: string) => {
    const q: Body = {}
    for (const k of ['select', 'eq', 'in', 'order', 'gte', 'lte', 'limit', 'not', 'is', 'like']) q[k] = () => q
    q.maybeSingle = async () => ({ error: null, data: table === 'content_ideas' ? piece : null })
    q.then = (resolve: (v: unknown) => void) => resolve(table === 'content_library_files'
      ? { error: null, data: [{ path: `3 Posts/${FOLDER}/0 Publish/manifest.draft.json`, object_key: 'files/x.json', sha256: opts.libSha ?? sha256(bytes), ready_at: '2026-11-15T10:00:00Z' }] }
      : { error: null, data: [] })
    return q
  }
  return { from: query, storage: { from: () => ({ download: async () => ({ error: null, data: new Blob([bytes]) }) }) }, rpc: async () => ({ error: null, data: { ok: true, revision: 4 } }) }
}

describe('the board refuses a press bound to anything but the draft as it stands', () => {
  const bytes = draftBytes()
  const sha = sha256(bytes)

  it('reads the newest library copy whose bytes match the hash the library recorded', async () => {
    expect((await readDrafts(store(bytes) as never, [piece])).get(PIECE)?.sha256).toBe(sha)
    expect((await readDrafts(store(bytes, { libSha: 'f'.repeat(64) }) as never, [piece])).size).toBe(0)
  })

  it('binds: the draft\'s hash passes, another is manifest_changed, no draft is manifest_not_found', async () => {
    const body = { kind: 'approve_publish', day: 'mon', piece_id: PIECE, approved: true, manifest_sha256: sha }
    await expect(checkPublishBind(store(bytes) as never, body)).resolves.toBeUndefined()
    await expect(checkPublishBind(store(bytes) as never, { ...body, manifest_sha256: 'e'.repeat(64) })).rejects.toMatchObject({ status: 409, message: 'manifest_changed' })
    await expect(checkPublishBind(store(bytes, { libSha: 'f'.repeat(64) }) as never, body)).rejects.toMatchObject({ status: 409, message: 'manifest_not_found' })
    // A take-back, or an older piece's press with no manifest, is not this check's.
    await expect(checkPublishBind(store(bytes) as never, { ...body, approved: false, manifest_sha256: 'e'.repeat(64) })).resolves.toBeUndefined()
  })

  const previous = { ...process.env }
  afterEach(() => { if (previous.ACCESS_CODE === undefined) delete process.env.ACCESS_CODE; else process.env.ACCESS_CODE = previous.ACCESS_CODE })
  it('PUT /api/board/<Monday>/picks/mon-publish answers 409 manifest_changed for a stale page', async () => {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    const handler = createBoardHandler(async () => store(bytes) as never)
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    let status = 0; let out: Body = {}
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: Body) { out = v } } as unknown as VercelResponse
    const body = { kind: 'approve_publish', day: 'mon', piece_id: PIECE, approved: true, manifest_sha256: 'e'.repeat(64), at: '2026-11-16T08:41:00Z' }
    await handler({ method: 'PUT', headers: { cookie, origin: 'https://controlcenter.krishraja.com' }, query: { week: WEEK, collection: 'picks', id: 'mon-publish' }, body: { body, revision: 0 } } as unknown as VercelRequest, res)
    expect([status, out]).toEqual([409, { ok: false, error: 'manifest_changed' }])
  })
})
