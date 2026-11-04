import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { afterPress, pressIncidents } from '../../apps/control-plane/api/board/_presses.js'
import { parseIncident, recordIncident, stageOfAsset } from '../../apps/control-plane/api/_incidents.js'
import { mergeMaking, parseMakingPatch } from '../../apps/control-plane/api/_making.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => true, mediaQualityRollout: () => ({ status: 'active' }) }))

// The failure loop (Krish, 2026-11-04: "how can your system autonomously understand the difference between a repeated
// failure, why it happened, what was being done when the failure occurred and how it was being done ... all of this
// stuff should feed an intelligent system that automatically gets more intelligent every week, not just pile up loads
// of individual feedback for me to sift through"). Part 1 captures: every incident with the preflight receipt then
// held. Part 2 learns weekly (scripts/learning/, its Python tests run here).

type Row = Record<string, any>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as Array<[string, string, unknown]>, fail: new Set<string>() }))

function fakeDb() {
  function query(table: string) {
    const rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'update' = 'select'
    let payload: Row = {}
    const run = () => {
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') { hit.forEach(r => Object.assign(r, payload)); db.writes.push([table, 'update', payload]); return { data: hit, error: null } }
      return { data: hit, error: null }
    }
    const write = (kind: string, value: unknown) => {
      db.writes.push([table, kind, value])
      if (db.fail.has(table)) return { data: null, error: { code: 'XX000', message: 'down' } }
      for (const r of Array.isArray(value) ? value : [value]) rows().push({ id: `id-${rows().length}`, ...(r as Row) })
      return { data: Array.isArray(value) ? value : [value], error: null }
    }
    const chain: Record<string, any> = {
      select() { return chain },
      update(p: Row) { op = 'update'; payload = p; return chain },
      eq(k: string, v: unknown) { filters.push(r => r[k] === v); return chain },
      gte() { return chain }, order() { return chain }, limit() { return chain }, like() { return chain }, not() { return chain },
      upsert(value: unknown) { const out = write('upsert', value); return { ...out, select: () => out, then: (f: any) => Promise.resolve(out).then(f) } },
      insert(value: unknown) { const out = write('insert', value); return { ...out, select: () => out, then: (f: any) => Promise.resolve(out).then(f) } },
      async maybeSingle() { const r = run(); return { data: (r.data as Row[])[0] ?? null, error: null } },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) { try { return Promise.resolve(run()).then(resolve, reject) } catch (e) { return reject(e) } },
    }
    return chain
  }
  return { from: (t: string) => query(t), rpc: async () => ({ data: { ok: true }, error: null }) }
}
vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: fakeDb() }))

const PIECE = '11111111-2222-4333-8444-555555555555'
const A = 'a'.repeat(64), B = 'b'.repeat(64)
const RECEIPT = [{ check: 'floor', format: 'short_video', version_or_hash: 'abc123', at: '2026-11-08T09:00:00Z', by: 'Claude Code' }]
const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'

beforeEach(() => {
  db.tables = { content_ideas: [{ id: PIECE, meta: { making: { preflight: RECEIPT, gates: {} } }, updated_at: '2026-11-08T00:00:00Z' }] }
  db.writes = []
  db.fail = new Set()
})

const incidents = () => db.writes.filter(([t]) => t === 'engine_incidents').flatMap(([, , v]) => (Array.isArray(v) ? v : [v]) as Row[])

describe('what an incident may carry', () => {
  it('takes a well-formed incident and only the fields the table holds', () => {
    const { row, problems } = parseIncident({ stage: 'cut', kind: 'critic_block', maker: 've', artifact_sha256: A, extra: 'x' }, '2026-11-08T10:00:00Z')
    expect(problems).toEqual([])
    expect(row).toMatchObject({ stage: 'cut', kind: 'critic_block', maker: 've', at: '2026-11-08T10:00:00Z', floor_groups: [], failure_ids: [] })
    expect(row).not.toHaveProperty('extra')
  })
  it('refuses a wrong stage, kind or hash, and his words on anything but his reject', () => {
    expect(parseIncident({ stage: 'nowhere', kind: 'critic_block' }, 'now').problems.length).toBeGreaterThan(0)
    expect(parseIncident({ stage: 'cut', kind: 'mood' }, 'now').problems.length).toBeGreaterThan(0)
    expect(parseIncident({ stage: 'cut', kind: 'critic_block', artifact_sha256: 'x' }, 'now').problems).toContain('artifact_sha256 is 64 lowercase hex characters')
    expect(parseIncident({ stage: 'cut', kind: 'critic_block', his_words: 'looks bad' }, 'now').problems).toContain('his_words is only on a krish_reject: his typed words')
    expect(parseIncident({ stage: 'cut', kind: 'krish_reject', his_words: 'Looks like Excel.' }, 'now').problems).toEqual([])
  })
  it('names the stage of a rejected asset from what the board calls it', () => {
    expect(stageOfAsset('video-short', '90-second video')).toBe('cut')
    expect(stageOfAsset('thumb-long', 'Long thumbnail')).toBe('package')
    expect(stageOfAsset('article', null)).toBe('post')
  })
  it('carries the piece\'s preflight receipt as it stood, and never throws when the table is down', async () => {
    const supa = fakeDb() as any
    expect(await recordIncident(supa, { stage: 'cut', kind: 'second_round', piece_id: PIECE }, '2026-11-08T10:00:00Z')).toBe('filed')
    expect(incidents()[0].preflight).toEqual(RECEIPT)
    db.fail.add('engine_incidents')
    expect(await recordIncident(supa, { stage: 'cut', kind: 'second_round', piece_id: PIECE }, '2026-11-08T10:00:00Z')).toBe('failed')
  })
})

describe('the press writer', () => {
  const reject = { kind: 'reject_asset', day: 'mon', piece_id: PIECE, asset: 'video-short', label: '90-second video', reason: 'The captions sit on my face.', drive_id: 'd'.repeat(33), formats: ['short_video'] }
  const proof = (extra: Row = {}) => ({ kind: 'approve_proof', day: 'wed', piece_id: PIECE, sha256: B, verdict: 'reject', words: 'It still looks like Excel.', ...extra })

  it('turns his Reject asset, Reject proof and None of these styles into his-words incidents, keyed once each', () => {
    const [asset] = pressIncidents('2026-11-09', 'mon-reject-video-short', reject, null)
    expect(asset).toMatchObject({ kind: 'krish_reject', stage: 'cut', his_words: 'The captions sit on my face.', artifact_ref: `drive:${'d'.repeat(33)}`, piece_id: PIECE })
    const [p] = pressIncidents('2026-11-09', 'wed-proof', proof(), null)
    expect(p).toMatchObject({ kind: 'krish_reject', stage: 'proof', maker: 've', artifact_sha256: B })
    const [s] = pressIncidents('2026-11-09', 'wed-style', { kind: 'pick_style', day: 'wed', piece_id: PIECE, sha256: A, module: null, reason: 'All three look like templates.' }, null)
    expect(s).toMatchObject({ kind: 'krish_reject', stage: 'style', his_words: 'All three look like templates.' })
    expect(pressIncidents('2026-11-09', 'wed-proof', proof({ verdict: 'approve', words: undefined }), null)).toEqual([])
    expect(pressIncidents('2026-11-09', 'mon-reject-video-short', reject, null)[0].client_ref).toBe(asset.client_ref)
  })

  it('records a second round when he presses a new proof after rejecting one', () => {
    const prior = { proof: { by: 'Krish' as const, at: 'x', sha256: A, verdict: 'reject' as const } }
    const out = pressIncidents('2026-11-09', 'wed-proof', proof({ verdict: 'approve', words: undefined }), prior)
    expect(out).toEqual([expect.objectContaining({ kind: 'second_round', stage: 'proof', artifact_sha256: B })])
    expect(pressIncidents('2026-11-09', 'wed-proof', proof({ verdict: 'approve', words: undefined, sha256: A }), prior)).toEqual([])
  })

  it('files the incident beside the inbox row, and the press still answers when the incident write fails', async () => {
    const saved = { ok: true, revision: 3 }
    const ctx = { week: '2026-11-09', collection: 'picks', id: 'mon-reject-video-short', body: reject, who: 'Krish', saved }
    const out = await afterPress(fakeDb() as any, ctx, { now: () => '2026-11-09T08:00:00Z' })
    expect(out).toMatchObject({ inbox: 'filed', incident: 'filed' })
    expect(incidents()).toEqual([expect.objectContaining({ kind: 'krish_reject', preflight: RECEIPT, his_words: 'The captions sit on my face.' })])
    db.fail.add('engine_incidents')
    const again = await afterPress(fakeDb() as any, ctx, { now: () => '2026-11-09T08:00:00Z' })
    expect(again).toMatchObject({ inbox: 'filed', incident: 'failed' })
  })
})

describe('the incidents route', () => {
  async function call(method: 'GET' | 'POST', body: Row = {}, query: Row = {}) {
    process.env.ENGINE_OPERATOR_TOKEN = 'eot_' + 'k'.repeat(40)
    const { default: handler } = await import('../../apps/control-plane/api/learning/incidents.js')
    const out = { status: 0, body: undefined as any }
    const res: Record<string, any> = { setHeader() { return res }, status(c: number) { out.status = c; return res }, json(b: unknown) { out.body = b; return res }, end() { return res } }
    await handler({ method, headers: { authorization: `Bearer ${process.env.ENGINE_OPERATOR_TOKEN}` }, query, body } as never, res as never)
    return out
  }
  const proposal = (n: number) => ({
    proposal_class: 'engine_quality', assertion: `Mode ${n} came back.`, scope: { key: `loop:cut/g${n}/x` },
    evidence_ids: ['00000000-0000-4000-8000-000000000001'], evidence_count: 1, counterexamples: [], regression_cases: ['no repeat next week'], proposed_change: {},
  })

  it('files a batch from the Python writers once each, and refuses a malformed one whole', async () => {
    const ok = await call('POST', { incidents: [{ stage: 'cut', kind: 'critic_block', maker: 've', client_ref: 'py-1' }, { stage: 'session', kind: 'guard_fired', failure_ids: ['F30-designed-blind-to-the-channel'] }] })
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ ok: true, filed: 'filed', count: 2 })
    const bad = await call('POST', { incidents: [{ stage: 'cut', kind: 'critic_block' }, { stage: 'x', kind: 'critic_block' }] })
    expect(bad.status).toBe(400)
    expect(bad.body.problems[0]).toMatch(/^incidents\.1: stage/)
    expect((await call('POST', {})).status).toBe(400)
  })

  it('takes at most three proposals a week, of the loop\'s own classes, citing their incidents', async () => {
    expect((await call('POST', { proposals: [1, 2, 3, 4].map(proposal), batch: 'learning-2026-11-08' })).status).toBe(400)
    expect((await call('POST', { proposals: [{ ...proposal(1), proposal_class: 'performance' }], batch: 'learning-2026-11-08' })).status).toBe(400)
    expect((await call('POST', { proposals: [{ ...proposal(1), scope: { key: 'spoken:x' } }], batch: 'learning-2026-11-08' })).status).toBe(400)
    const ok = await call('POST', { proposals: [1, 2].map(proposal), batch: 'learning-2026-11-08' })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body.proposals).toBe(2)
    const rows = db.writes.filter(([t]) => t === 'mindmake_studio_learning_proposals').flatMap(([, , v]) => v as Row[])
    expect(rows[0]).toMatchObject({ proposal_class: 'engine_quality', status: 'proposed', evidence_event_ids: ['00000000-0000-4000-8000-000000000001'] })
  })

  it('reads the week\'s incidents back', async () => {
    db.tables.engine_incidents = [{ id: 'i1', stage: 'cut', kind: 'critic_block' }]
    const out = await call('GET', {}, { since: '2026-11-01T00:00:00Z' })
    expect(out.status).toBe(200)
    expect(out.body.incidents).toHaveLength(1)
  })
})

describe('the preflight receipt on the making record', () => {
  it('takes receipts, merges by check, format and skill, and refuses a malformed one', () => {
    const now = '2026-11-08T10:00:00Z'
    const first = parseMakingPatch({ preflight: [{ check: 'floor', format: 'short_video', version_or_hash: 'v1' }, { check: 'failures', version_or_hash: 'f1' }], by: 'Codex' }, now)
    expect(first.problems).toEqual([])
    const second = parseMakingPatch({ preflight: { check: 'floor', format: 'short_video', version_or_hash: 'v2' } }, now)
    const merged = mergeMaking(mergeMaking(null, first.patch, 'Codex', now), second.patch, 'Claude Code', now)
    expect(merged.preflight).toHaveLength(2)
    expect(merged.preflight!.find(p => p.check === 'floor')).toMatchObject({ version_or_hash: 'v2', by: 'Claude Code' })
    expect(parseMakingPatch({ preflight: [{ check: 'vibes', version_or_hash: 'x' }] }, now).problems.length).toBe(1)
    expect(parseMakingPatch({ preflight: [{ check: 'skill', version_or_hash: 'x' }] }, now).problems[0]).toMatch(/names the skill/)
  })
})

describe('the weekly loop and the capture writers in Python', () => {
  for (const [name, args] of [
    ['clusters, traces, climbs one rung, caps proposals at three, and gates ve brief on the preflight from 9 Nov', ['tests/learning_loop_test.py']],
    ['the preflight receipt writer', ['scripts/preflight.py', '--self-test']],
    ['the incident writer and its offline queue', ['scripts/incidents.py', '--self-test']],
  ] as const) {
    it(name, () => {
      const r = spawnSync(PY, [...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8', INCIDENTS_OFFLINE: '1', VE_GATES_OFFLINE: '1' } })
      expect(r.status, r.stdout + r.stderr).toBe(0)
    }, 120_000)
  }
})
