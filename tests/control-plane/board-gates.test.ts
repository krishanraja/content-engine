import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { canonical, digest, hisOnlyRefusal, validBody, views } from '../../apps/control-plane/api/board/_contracts.js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { gatePatch, gateReport } from '../../apps/control-plane/api/board/_presses.js'
import { liveDay, liveGate } from '../../apps/control-plane/api/board/_live.js'
import { mergeMaking, parseMakingPatch } from '../../apps/control-plane/api/_making.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => true, mediaQualityRollout: () => ({ status: 'active' }) }))

// The production gates on a day's tab (Krish, 2026-11-04: "Can I select a visual style now that we have different
// style skills? Do I get shown mocks at the right moment?"): Sign storyboard, Pick a style, Approve or Reject the
// moving proof, and Approve cut. Each is his press alone, bound to the sha256 of what the tab showed him, written onto
// the piece's making record as meta.making.gates, and shown again by the live overlay.

const PIECE = '11111111-2222-4333-8444-555555555555'
const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64)
const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })

const storyboard = (extra: Record<string, unknown> = {}) => ({ kind: 'sign_storyboard', day: 'wed', piece_id: PIECE, approved: true, sha256: A, at: '2026-11-08T10:00:00Z', ...extra })
const verdicts = [{ module: 'orbit-on-split', verdict: 'picked', sha256: B }, { module: 'paper-cut', verdict: 'seen' }, { module: 'neon-grid', verdict: 'not_for_us' }]
const style = (extra: Record<string, unknown> = {}) => ({ kind: 'pick_style', day: 'wed', piece_id: PIECE, sha256: A, module: 'orbit-on-split', verdicts, ...extra })
const proof = (extra: Record<string, unknown> = {}) => ({ kind: 'approve_proof', day: 'wed', piece_id: PIECE, sha256: C, verdict: 'approve', ...extra })
const cut = (extra: Record<string, unknown> = {}) => ({ kind: 'approve_cut', day: 'wed', piece_id: PIECE, approved: true, sha256: B, cuts: { long: B }, ...extra })

describe('what each gate press may carry', () => {
  it('takes Sign storyboard bound to the hash of what he read, and nothing else', () => {
    expect(validBody('picks', 'wed-storyboard', storyboard())).toBe(true)
    expect(validBody('picks', 'wed-storyboard', storyboard({ sha256: 'A'.repeat(64) }))).toBe(false)
    expect(validBody('picks', 'wed-storyboard', storyboard({ sha256: undefined }))).toBe(false)
    expect(validBody('picks', 'wed-storyboard', storyboard({ approved: false }))).toBe(false)
    expect(validBody('picks', 'mon-storyboard', storyboard())).toBe(false)
    expect(validBody('picks', 'wed-storyboard', storyboard({ kind: 'approve_proof' }))).toBe(false)
    expect(validBody('picks', 'wed-storyboard', storyboard({ piece_id: 'not-a-piece' }))).toBe(false)
    expect(validBody('picks', 'wed-storyboard', storyboard({ send: {} }))).toBe(false)
    expect(validBody('picks', 'tue-storyboard', { ...storyboard(), day: 'tue' })).toBe(false)
  })
  it('takes a style pick with his verdict on every style shown, and "None of these" only with his words', () => {
    expect(validBody('picks', 'wed-style', style())).toBe(true)
    expect(validBody('picks', 'wed-style', style({ reason: 'It moves like the Verge piece I liked.' }))).toBe(true)
    // None of these: no style picked, and his words are required.
    const none = style({ module: null, verdicts: verdicts.map(v => ({ ...v, verdict: 'not_for_us' })) })
    expect(validBody('picks', 'wed-style', none)).toBe(false)
    expect(validBody('picks', 'wed-style', { ...none, reason: '   ' })).toBe(false)
    expect(validBody('picks', 'wed-style', { ...none, reason: 'All three feel like a template.' })).toBe(true)
    // The pick must be the one style marked picked, once.
    expect(validBody('picks', 'wed-style', style({ module: 'paper-cut' }))).toBe(false)
    expect(validBody('picks', 'wed-style', style({ verdicts: verdicts.map(v => ({ ...v, verdict: 'picked' })) }))).toBe(false)
    expect(validBody('picks', 'wed-style', style({ verdicts: [...verdicts, verdicts[1]] }))).toBe(false)
    expect(validBody('picks', 'wed-style', style({ verdicts: [] }))).toBe(false)
    expect(validBody('picks', 'wed-style', style({ verdicts: verdicts.map(v => ({ ...v, verdict: 'loved' })) }))).toBe(false)
    expect(validBody('picks', 'wed-style', style({ module: undefined }))).toBe(false)
    // Bound to the styles shown: a wrong hash, on the set or on a clip, is refused.
    expect(validBody('picks', 'wed-style', style({ sha256: 'not-a-hash' }))).toBe(false)
    expect(validBody('picks', 'wed-style', style({ verdicts: [{ ...verdicts[0], sha256: 'x' }, ...verdicts.slice(1)] }))).toBe(false)
  })
  it('takes the proof approved, or rejected only with his words, bound to the clip he watched', () => {
    expect(validBody('picks', 'wed-proof', proof())).toBe(true)
    expect(validBody('picks', 'wed-proof', proof({ cut: 'short' }))).toBe(true)
    expect(validBody('picks', 'wed-proof', proof({ verdict: 'reject' }))).toBe(false)
    expect(validBody('picks', 'wed-proof', proof({ verdict: 'reject', words: '' }))).toBe(false)
    expect(validBody('picks', 'wed-proof', proof({ verdict: 'reject', words: 'The captions sit on my face.' }))).toBe(true)
    expect(validBody('picks', 'wed-proof', proof({ verdict: 'maybe' }))).toBe(false)
    expect(validBody('picks', 'wed-proof', proof({ cut: 'wide' }))).toBe(false)
    expect(validBody('picks', 'wed-proof', proof({ sha256: C.slice(1) }))).toBe(false)
  })
  it('takes Approve cut bound to the cut file shown, or to both cuts together', () => {
    expect(validBody('picks', 'wed-cut', cut())).toBe(true)
    const { cuts: _, ...bare } = cut()
    expect(validBody('picks', 'wed-cut', bare)).toBe(true)
    // One cut shown: the press hash is that file's hash, nothing else.
    expect(validBody('picks', 'wed-cut', cut({ sha256: C }))).toBe(false)
    const both = { long: B, short: C }
    expect(validBody('picks', 'wed-cut', cut({ cuts: both, sha256: digest(canonical(both)) }))).toBe(true)
    expect(validBody('picks', 'wed-cut', cut({ cuts: both, sha256: B }))).toBe(false)
    expect(validBody('picks', 'wed-cut', cut({ cuts: { long: 'x' } }))).toBe(false)
    expect(validBody('picks', 'wed-cut', cut({ approved: false }))).toBe(false)
  })
  it('is his press alone, and each gate reads back as a view of picks', () => {
    for (const body of [storyboard(), style(), proof(), cut()]) {
      expect(hisOnlyRefusal('picks', body, 'engine_operator')).toBe('decision_is_his')
      expect(hisOnlyRefusal('picks', body, null)).toBe('decision_is_his')
      expect(hisOnlyRefusal('picks', body, 'Krish')).toBeNull()
    }
    expect(views).toMatchObject({ storyboard: 'sign_storyboard', style: 'pick_style', proof: 'approve_proof', cut: 'approve_cut' })
  })
})

describe('the gate written on the making record', () => {
  it('holds who, when, the hash shown and the gate\'s own answer, and nothing a session could forge', () => {
    const now = '2026-11-08T10:00:05.000Z'
    expect(gatePatch('sign_storyboard', storyboard(), now)).toEqual({ storyboard: { by: 'Krish', at: now, sha256: A } })
    expect(gatePatch('pick_style', style({ reason: ' It moves. ' }), now)).toEqual({ style: { by: 'Krish', at: now, sha256: A, module: 'orbit-on-split', reason: 'It moves.',
      verdicts: [{ module: 'orbit-on-split', verdict: 'picked', sha256: B }, { module: 'paper-cut', verdict: 'seen' }, { module: 'neon-grid', verdict: 'not_for_us' }] } })
    expect(gatePatch('approve_proof', proof({ verdict: 'reject', words: 'Too busy.', cut: 'short' }), now)).toEqual({ proof: { by: 'Krish', at: now, sha256: C, verdict: 'reject', words: 'Too busy.', cut: 'short' } })
    expect(gatePatch('approve_cut', cut(), now)).toEqual({ final: { by: 'Krish', at: now, sha256: B, cuts: { long: B } } })
    // The making route never takes a gate from a session; rounds it does take.
    expect(parseMakingPatch({ gates: { storyboard: { by: 'Krish', at: now, sha256: A } } }, now).problems).toEqual(['gates are written only by Krish\'s presses on the publish board'])
    expect(parseMakingPatch({ rounds: 1 }, now)).toEqual({ patch: { rounds: 1 }, problems: [] })
    expect(parseMakingPatch({ rounds: -1 }, now).problems).toHaveLength(1)
    // Gate by gate: a later press keeps the earlier ones, and a session's later write keeps them all.
    const one = mergeMaking(null, { gates: gatePatch('sign_storyboard', storyboard(), now) }, 'content-engine server', now)
    const two = mergeMaking(one, { gates: gatePatch('approve_proof', proof(), now) }, 'content-engine server', '2026-11-08T11:00:00.000Z')
    const three = mergeMaking(two, { rounds: 1 }, 'Claude Code', '2026-11-08T12:00:00.000Z')
    expect(Object.keys(three.gates!)).toEqual(['storyboard', 'proof'])
    expect(three.rounds).toBe(1)
  })
  it('files his words on a rejected proof or "None of these" to his taste ledger, verbatim, and nothing on an approval', () => {
    const now = '2026-11-08T10:00:05.000Z'
    const row = gateReport('2026-11-02', 'wed-proof', proof({ verdict: 'reject', words: 'The captions sit on my face.' }), now)!
    expect(row).toMatchObject({ kind: 'krish_words', body: 'The captions sit on my face.', said_where: 'publish board, 2026-11-02 picks/wed-proof', said_at: now,
      polarity: 'dislikes', subject_ref: `piece:${PIECE}`, surface: 'publish_board', meta: { press: 'reject_proof', gate: 'proof' } })
    const none = gateReport('2026-11-02', 'wed-style', style({ module: null, reason: 'All three feel like a template.' }), now)!
    expect(none).toMatchObject({ kind: 'krish_words', body: 'All three feel like a template.', meta: { press: 'none_of_these', gate: 'style' } })
    expect(gateReport('2026-11-02', 'wed-proof', proof(), now)).toBeNull()
    expect(gateReport('2026-11-02', 'wed-style', style({ reason: 'It moves.' }), now)).toBeNull()
    expect(gateReport('2026-11-02', 'wed-storyboard', storyboard(), now)).toBeNull()
  })
})

// The handler end to end, against a small stand-in for the store: his press saved, then the gate on the piece's row.
function fakeDb(opts: { stale?: number; making?: unknown } = {}) {
  const calls: Array<Record<string, any>> = [], pieces: Array<Record<string, any>> = [], taste: Array<Record<string, any>> = [], reads: Array<[string, unknown][]> = []
  const store = new Map<string, number>()
  let piece = { id: PIECE, meta: { other: 'kept', making: opts.making === undefined ? { started_at: '2026-11-01T09:00:00.000Z', updated_at: '2026-11-01T10:00:00.000Z', by: 'Claude Code' } : opts.making }, updated_at: '2026-11-01T10:00:00.000Z' }
  let stale = opts.stale || 0
  const db = {
    rpc: async (_: string, args: Record<string, any>) => {
      calls.push(args)
      const key = `${args.p_collection}/${args.p_id}`, current = store.get(key) || 0
      if (current !== args.p_revision) return { data: { ok: false, error: 'revision_conflict', revision: current }, error: null }
      store.set(key, current + 1)
      return { data: { ok: true, revision: current + 1, body: args.p_body }, error: null }
    },
    from: (table: string) => {
      const filters: [string, unknown][] = []
      const has = (k: string) => filters.find(f => f[0] === k)?.[1]
      let update: Record<string, any> | null = null
      const q: any = {
        upsert: async (row: Record<string, any>) => { expect(table).toBe('taste_reports'); taste.push(row); return { error: null } },
        update: (values: Record<string, any>) => { expect(table).toBe('content_ideas'); update = values; return q },
        select: () => {
          if (!update) return q
          if (stale > 0) { stale--; piece = { ...piece, updated_at: `2026-11-01T11:0${stale}:00.000Z` }; return Promise.resolve({ data: [], error: null }) }
          if (has('updated_at') !== piece.updated_at) return Promise.resolve({ data: [], error: null })
          piece = { ...piece, meta: update.meta, updated_at: update.updated_at }; pieces.push(update)
          return Promise.resolve({ data: [{ id: PIECE }], error: null })
        },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q }, order: () => q,
        maybeSingle: async () => (table === 'content_ideas' ? { data: has('id') === PIECE ? piece : null, error: null } : { data: null, error: null }),
        range: async () => { reads.push(filters); return { data: [], error: null } },
      }
      return q
    },
  }
  return { db, calls, pieces, taste, reads, piece: () => piece }
}
function setup(opts: { stale?: number; making?: unknown } = {}) {
  process.env.ACCESS_CODE = 'synthetic-board-test'
  process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
  const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
  const fake = fakeDb(opts)
  const handler = createBoardHandler(async () => fake.db as never, { now: () => '2026-11-08T10:00:05.000Z' })
  const call = async (method: string, query: Record<string, string>, body?: unknown, who: 'krish' | 'operator' = 'krish') => {
    let status = 0; let out: any
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(value: unknown) { out = value } } as unknown as VercelResponse
    const headers = who === 'krish' ? { cookie, origin: 'https://content.krishraja.com' } : { authorization: 'Bearer synthetic-operator' }
    await handler({ method, headers, query: { week: '2026-11-02', ...query }, body } as unknown as VercelRequest, res)
    return { status, out }
  }
  const put = (id: string, body: unknown, who: 'krish' | 'operator' = 'krish', revision = 0) => call('PUT', { collection: 'picks', id }, { body, revision }, who)
  return { ...fake, put, call }
}

describe('his gate press on the server', () => {
  it('writes each gate onto the piece\'s making record, gate by gate, keeping the rest of the row', async () => {
    const t = setup()
    expect((await t.put('wed-storyboard', storyboard())).out).toMatchObject({ ok: true, revision: 1, gate: 'recorded' })
    expect((await t.put('wed-style', style())).out).toMatchObject({ ok: true, gate: 'recorded' })
    expect((await t.put('wed-proof', proof())).out).toMatchObject({ ok: true, gate: 'recorded' })
    expect((await t.put('wed-cut', cut())).out).toMatchObject({ ok: true, gate: 'recorded' })
    const meta = t.piece().meta as Record<string, any>
    expect(meta.other).toBe('kept')
    expect(meta.making.started_at).toBe('2026-11-01T09:00:00.000Z')
    expect(meta.making.gates).toEqual({
      storyboard: { by: 'Krish', at: '2026-11-08T10:00:05.000Z', sha256: A },
      style: { by: 'Krish', at: '2026-11-08T10:00:05.000Z', sha256: A, module: 'orbit-on-split', verdicts },
      proof: { by: 'Krish', at: '2026-11-08T10:00:05.000Z', sha256: C, verdict: 'approve' },
      final: { by: 'Krish', at: '2026-11-08T10:00:05.000Z', sha256: B, cuts: { long: B } },
    })
    expect(t.taste).toHaveLength(0)
    // His press is saved once, as his: no second revision.
    expect(t.calls.every(c => c.p_actor === 'Krish')).toBe(true)
    expect(t.calls).toHaveLength(4)
  })
  it('reads again once on a stale row, and says so when the piece changed twice', async () => {
    const once = setup({ stale: 1 })
    expect((await once.put('wed-storyboard', storyboard())).out).toMatchObject({ gate: 'recorded' })
    expect(once.pieces).toHaveLength(1)
    const twice = setup({ stale: 2 })
    expect((await twice.put('wed-storyboard', storyboard())).out).toMatchObject({ ok: true, gate: 'failed', gate_error: 'the piece changed twice while his press was being recorded' })
    const gone = setup({ making: null })
    expect((await gone.put('wed-storyboard', storyboard())).out).toMatchObject({ ok: true, gate: 'recorded' })
  })
  it('files his words on a rejected proof to the taste ledger', async () => {
    const t = setup()
    const { out } = await t.put('wed-proof', proof({ verdict: 'reject', words: 'The captions sit on my face.' }))
    expect(out).toMatchObject({ gate: 'recorded', taste: 'filed' })
    expect(t.taste[0]).toMatchObject({ kind: 'krish_words', body: 'The captions sit on my face.' })
    expect((t.piece().meta as any).making.gates.proof).toMatchObject({ verdict: 'reject', words: 'The captions sit on my face.' })
  })
  it('refuses a session pressing for him, a body that does not hold, and lists each gate as a view', async () => {
    const t = setup()
    expect(await t.put('wed-storyboard', storyboard(), 'operator')).toMatchObject({ status: 403 })
    expect(await t.put('wed-proof', proof({ verdict: 'reject' }))).toMatchObject({ status: 400, out: { error: 'invalid_document_write' } })
    expect(t.pieces).toHaveLength(0)
    const listed = await t.call('GET', { collection: 'style' })
    expect(listed.status).toBe(200)
    expect(t.reads[0]).toContainEqual(['body->>kind', 'pick_style'])
    expect(await t.put('storyboard', 'wed-storyboard', storyboard())).toMatchObject({ status: 400 })
  })
})

describe('the live block\'s gates', () => {
  const row = (gates: unknown, extra: Record<string, unknown> = {}) => ({ id: PIECE, state: 'drafting', body: '', updated_at: '2026-11-08T10:00:00.000Z',
    meta: { making: { started_at: '2026-11-01T09:00:00.000Z', updated_at: '2026-11-08T10:00:00.000Z', by: 'content-engine server', gates, ...extra } } })
  it('says each gate waits on him until he pressed it, then his answer, when, and the hash it is bound to', () => {
    const empty = liveDay(row(undefined), '2026-11-04')
    expect(empty.gates).toEqual({ storyboard: { state: 'waiting', at: null }, style: { state: 'waiting', at: null }, proof: { state: 'waiting', at: null }, final: { state: 'waiting', at: null } })
    expect(empty.rounds).toBeUndefined()
    const at = '2026-11-08T10:00:05.000Z'
    const day = liveDay(row({ storyboard: { by: 'Krish', at, sha256: A }, style: { by: 'Krish', at, sha256: A, module: 'orbit-on-split', reason: 'mine', verdicts },
      proof: { by: 'Krish', at, sha256: C, verdict: 'reject', words: 'Too busy.' }, final: { by: 'Krish', at, sha256: B, cuts: { long: B } } }, { rounds: 2 }), '2026-11-04')
    expect(day.gates).toEqual({ storyboard: { state: 'signed', at, sha256: A }, style: { state: 'picked', at, sha256: A, module: 'orbit-on-split' },
      proof: { state: 'rejected', at, sha256: C }, final: { state: 'approved', at, sha256: B } })
    expect(day.rounds).toBe(2)
    // His words and the clips' paths stay on the record.
    expect(JSON.stringify(day.gates)).not.toContain('Too busy')
    expect(liveGate('style', { by: 'Krish', at, sha256: A, module: null, reason: 'None', verdicts: [] })).toEqual({ state: 'none_of_these', at, sha256: A })
    // A gate a session wrote, or one with no hash, is not his press.
    expect(liveGate('storyboard', { by: 'Claude Code', at, sha256: A })).toEqual({ state: 'waiting', at: null })
    expect(liveGate('proof', { by: 'Krish', at })).toEqual({ state: 'waiting', at: null })
  })
})
