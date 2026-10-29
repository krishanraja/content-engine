import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { hisOnlyRefusal, validBody } from '../../apps/control-plane/api/board/_contracts.js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { scriptHash, spokenText, type SendApprovedInput, type SendResult } from '../../apps/control-plane/api/_teleprompter.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => true, mediaQualityRollout: () => ({ status: 'active' }) }))

// Krish's presses on the publish board (Krish, 2026-10-28: "pick an idea for a specific day AND add any optional
// comments easily, which can be saved, or I can: mark an idea as being useful in a future wider piece OR mark it as
// being an idea that should be stored for a future trend OR queue it for next week OR reject it"), the off days, and
// his decisions on a day's tab: what each document may carry, that only he writes them, and what the server does next.

const PIECE = '11111111-2222-4333-8444-555555555555'
const IDEA = '22222222-3333-4444-8555-666666666666'
const LONG = '# The hook\n\nForty percent of firms pay for **AI pictures**.\n\nHere is what I would do.'
const SHORT = 'Forty percent of firms pay.\n\nWatch this.'
const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })

const approval = (extra: Record<string, unknown> = {}) => ({
  kind: 'approve_scripts', day: 'mon', piece_id: PIECE, approved: true, at: '2026-11-01T12:30:00Z',
  texts: { long: LONG, short: SHORT },
  titles: { long: 'Mon 9 Nov - 5-minute - Who pays for AI pictures', short: 'Mon 9 Nov - 90-second - Who pays for AI pictures' },
  folder_title: 'Mon 9 Nov follow.the.money - Who pays for AI pictures', ...extra,
})
const press = (use: string | null, extra: Record<string, unknown> = {}) => ({
  pick: 'mon-2', use, queued: use === 'next_week', idea_id: IDEA, so_what: 'Firms now pay for AI pictures.', story: 'The story.',
  series: 'follow_the_money', week: '2026-11-09', day: 'mon', at: '2026-11-08T09:00:00Z', ...extra,
})
const offday = (extra: Record<string, unknown> = {}) => ({
  pick: 'off-tue-meme-1', use: 'offday', day: 'tue', approved: true, copy_sha256: 'c'.repeat(64), format: 'meme', source: 'A cue', option_id: 'meme-1', ...extra,
})
const reject = (extra: Record<string, unknown> = {}) => ({
  kind: 'reject_asset', day: 'mon', piece_id: PIECE, asset: 'video-short', label: '90-second video', reason: 'The captions drift off his words at the start.',
  drive_id: 'a'.repeat(33), formats: ['short_video'], at: '2026-11-09T07:40:00Z', ...extra,
})

describe('what each press may carry', () => {
  it('takes a pick with his optional saved note, and nothing that pretends to be a decision', () => {
    const pick = { pick: 'mon-2', idea_id: IDEA, series: 'follow_the_money', story: 'The story.', day: 'mon', at: '2026-11-08T09:00:00Z' }
    expect(validBody('picks', 'mon', pick)).toBe(true)
    expect(validBody('picks', 'mon', { ...pick, note: 'Lead with the Getty deal.' })).toBe(true)
    expect(validBody('picks', 'mon', { ...pick, note: 'x'.repeat(2001) })).toBe(false)
    expect(validBody('picks', 'mon', { ...pick, kind: 'titles' })).toBe(false)
  })
  it('takes the four presses on an idea, each with its own optional words, and Next week only for a Monday', () => {
    for (const use of ['wider_piece_context', 'track_over_time', 'not_for_us', null]) expect(validBody('queue', 'mon-2', press(use))).toBe(true)
    expect(validBody('queue', 'mon-2', press('wider_piece_context', { note: 'Part of the pricing series', theme: 'AI pricing' }))).toBe(true)
    expect(validBody('queue', 'mon-2', press('not_for_us', { reason: 'Done to death this month.' }))).toBe(true)
    expect(validBody('queue', 'mon-2', press('next_week', { target_week: '2026-11-16' }))).toBe(true)
    expect(validBody('queue', 'mon-2', press('next_week'))).toBe(false)
    expect(validBody('queue', 'mon-2', press('next_week', { target_week: '2026-11-17' }))).toBe(false)
    expect(validBody('queue', 'mon-2', press('track_over_time', { target_week: '2026-11-16' }))).toBe(false)
    expect(validBody('queue', 'mon-2', press('maybe'))).toBe(false)
    expect(validBody('queue', 'mon-3', press('not_for_us'))).toBe(false)
    expect(validBody('queue', 'mon-2', press('not_for_us', { reason: 'x'.repeat(2001) }))).toBe(false)
  })
  it('takes an off-day approval or skip bound to the copy he saw', () => {
    expect(validBody('queue', 'off-tue-meme-1', offday())).toBe(true)
    expect(validBody('queue', 'off-tue-meme-1', offday({ approved: false }))).toBe(true)
    expect(validBody('queue', 'off-tue-meme-1', offday({ day: 'thu' }))).toBe(false)
    expect(validBody('queue', 'off-mon-meme-1', offday({ pick: 'off-mon-meme-1', day: 'mon' }))).toBe(false)
    expect(validBody('queue', 'off-tue-meme-1', offday({ copy_sha256: 'short' }))).toBe(false)
    expect(validBody('queue', 'off-tue-meme-1', offday({ approved: 'yes' }))).toBe(false)
    expect(validBody('queue', 'off-tue-meme-1', { pick: 'off-tue-meme-1', queued: true })).toBe(false)
  })
  it('takes Approve scripts with the exact words, the Teleprompter names, and never a send it brings itself', () => {
    expect(validBody('picks', 'mon-scripts', approval())).toBe(true)
    expect(validBody('picks', 'mon-scripts', approval({ scripts: { long: scriptHash(LONG), short: scriptHash(SHORT) } }))).toBe(true)
    expect(validBody('picks', 'mon-scripts', { kind: 'approve_scripts', day: 'mon', piece_id: PIECE, approved: false })).toBe(true)
    expect(validBody('picks', 'mon-scripts', approval({ send: { status: 'sent' } }))).toBe(false)
    expect(validBody('picks', 'mon-scripts', approval({ day: 'wed' }))).toBe(false)
    expect(validBody('picks', 'mon-scripts', approval({ titles: { long: 'Only one title' } }))).toBe(false)
    expect(validBody('picks', 'mon-scripts', approval({ texts: { long: LONG, short: SHORT, deep: 'x' } }))).toBe(false)
    expect(validBody('picks', 'mon-scripts', approval({ folder_title: 'Two\nlines' }))).toBe(false)
    expect(validBody('picks', 'mon-scripts', approval({ piece_id: 'not-a-piece' }))).toBe(false)
    expect(validBody('picks', 'mon-scripts', approval({ folder_id: 'lowercase-not-an-id' }))).toBe(false)
    expect(validBody('picks', 'mon-scripts', approval({ kind: 'titles' }))).toBe(false)
  })
  it('takes his title picks, his publish approval and an asset reject only with its reason', () => {
    expect(validBody('picks', 'mon-titles', { kind: 'titles', day: 'mon', piece_id: PIECE, picks: { long_title: 'Who pays for AI pictures', short_thumbnail: 'WHO PAYS?' } })).toBe(true)
    expect(validBody('picks', 'mon-titles', { kind: 'titles', day: 'mon', picks: {} })).toBe(false)
    expect(validBody('picks', 'mon-titles', { kind: 'titles', day: 'mon', picks: { headline: 'x' } })).toBe(false)
    expect(validBody('picks', 'mon-publish', { kind: 'approve_publish', day: 'mon', piece_id: PIECE, approved: true, manifest_sha256: 'b'.repeat(64) })).toBe(true)
    expect(validBody('picks', 'mon-publish', { kind: 'approve_publish', day: 'mon', piece_id: PIECE, approved: true, manifest_sha256: 'nope' })).toBe(false)
    expect(validBody('picks', 'mon-reject-video-short', reject())).toBe(true)
    expect(validBody('picks', 'mon-reject-video-short', reject({ at_ms: 4200 }))).toBe(true)
    expect(validBody('picks', 'mon-reject-video-short', reject({ reason: '   ' }))).toBe(false)
    expect(validBody('picks', 'mon-reject-video-short', reject({ asset: 'video-long' }))).toBe(false)
    expect(validBody('picks', 'mon-reject-video-short', reject({ drive_id: 'short' }))).toBe(false)
    expect(validBody('picks', 'mon-reject-video-short', reject({ formats: ['Short Video'] }))).toBe(false)
  })
})

describe('only Krish presses', () => {
  it('refuses every new press from a session holding the operator key, and leaves a plain pick and triage open', () => {
    const op = 'engine_operator'
    expect(hisOnlyRefusal('picks', { pick: 'mon-2', day: 'mon', story: 's', note: 'mine' }, op)).toBe('pick_note_is_his')
    expect(hisOnlyRefusal('queue', press('not_for_us'), op)).toBe('press_is_his')
    expect(hisOnlyRefusal('queue', press(null), op)).toBe('press_is_his')
    expect(hisOnlyRefusal('queue', offday(), op)).toBe('press_is_his')
    expect(hisOnlyRefusal('picks', approval(), op)).toBe('decision_is_his')
    expect(hisOnlyRefusal('picks', { kind: 'titles', day: 'mon', picks: { long_title: 'x' } }, op)).toBe('decision_is_his')
    expect(hisOnlyRefusal('picks', { kind: 'approve_publish', day: 'mon', piece_id: PIECE, approved: true }, op)).toBe('decision_is_his')
    expect(hisOnlyRefusal('picks', reject(), null)).toBe('decision_is_his')
    expect(hisOnlyRefusal('picks', { pick: 'mon-2', day: 'mon', story: 's' }, op)).toBeNull()
    expect(hisOnlyRefusal('queue', { pick: 'mon-1', queued: true }, op)).toBeNull()
    for (const body of [approval(), press('next_week', { target_week: '2026-11-16' }), offday(), reject()]) expect(hisOnlyRefusal('picks', body, 'Krish')).toBeNull()
  })
})

type Call = { name: string; args: Record<string, any> }
function fakeDb(opts: { inboxError?: boolean } = {}) {
  const calls: Call[] = [], inbox: Array<{ row: Record<string, any>; options: unknown }> = [], reads: Array<[string, unknown][]> = []
  const store = new Map<string, number>()
  const db = {
    rpc: async (name: string, args: Record<string, any>) => {
      calls.push({ name, args })
      const key = `${args.p_collection}/${args.p_id}`
      const current = store.get(key) || 0
      if (current !== args.p_revision) return { data: { ok: false, error: 'revision_conflict', revision: current }, error: null }
      store.set(key, current + 1)
      return { data: { ok: true, revision: current + 1, body: args.p_body }, error: null }
    },
    from: (table: string) => {
      const filters: [string, unknown][] = []
      const q: any = {
        upsert: async (row: Record<string, any>, options: unknown) => { expect(table).toBe('taste_rejection_inbox'); inbox.push({ row, options }); return { error: opts.inboxError ? { message: 'down' } : null } },
        select: () => q, eq: (k: string, v: unknown) => { filters.push([k, v]); return q }, order: () => q,
        range: async () => { reads.push(filters); return { data: [{ doc_id: 'mon-scripts', body: approval(), revision: 2, updated_at: '2026-11-01T12:30:01Z', updated_by: 'Krish' }], error: null } },
      }
      return q
    },
  }
  return { db, calls, inbox, reads }
}
function setup(send?: (input: SendApprovedInput) => Promise<SendResult>, opts: { inboxError?: boolean } = {}) {
  process.env.ACCESS_CODE = 'synthetic-board-test'
  process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
  const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
  const fake = fakeDb(opts)
  const sent: SendApprovedInput[] = []
  const handler = createBoardHandler(async () => fake.db as never, {
    now: () => '2026-11-01T12:30:05.000Z',
    send: async input => { sent.push(input); return send ? send(input) : { status: 'no_key', error: 'TELEPROMPTER_API_KEY is not set' } },
  })
  const call = async (method: string, query: Record<string, string>, body?: unknown, who: 'krish' | 'operator' = 'krish') => {
    let status = 0; let out: any
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(value: unknown) { out = value } } as unknown as VercelResponse
    const headers = who === 'krish' ? { cookie, origin: 'https://content.krishraja.com' } : { authorization: 'Bearer synthetic-operator' }
    await handler({ method, headers, query: { week: '2026-11-09', ...query }, body } as unknown as VercelRequest, res)
    return { status, out }
  }
  const put = (collection: string, id: string, body: unknown, who: 'krish' | 'operator' = 'krish', revision = 0) => call('PUT', { collection, id }, { body, revision }, who)
  return { ...fake, sent, put, call }
}

describe('Approve scripts sends his exact words to Teleprompter from the server', () => {
  it('binds the hash of the words he saw, sends them with his document as the approval, and records the answer', async () => {
    const t = setup(async input => ({ status: 'sent', folder_id: 'F'.repeat(8) + '-AAAA-4AAA-8AAA-' + 'A'.repeat(12),
      scripts: input.scripts.map(s => ({ cut: s.cut, script_id: 'B'.repeat(8) + '-BBBB-4BBB-8BBB-' + 'B'.repeat(12), readback_ok: true })) }))
    const { status, out } = await t.put('picks', 'mon-scripts', approval())
    expect(status).toBe(200)
    expect(t.calls).toHaveLength(2)
    const first = t.calls[0].args, second = t.calls[1].args
    expect(first.p_body.scripts).toEqual({ long: scriptHash(LONG), short: scriptHash(SHORT) })
    expect(first.p_actor).toBe('Krish')
    expect(t.sent).toHaveLength(1)
    const input = t.sent[0]
    expect(input.approval).toMatchObject({ id: 'mon-scripts', updated_by: 'Krish', body: { piece_id: PIECE, scripts: { long: scriptHash(LONG) } } })
    expect(input.folder_title).toBe('Mon 9 Nov follow.the.money - Who pays for AI pictures')
    const long = input.scripts.find(s => s.cut === 'long')!
    expect(long.text).toBe(spokenText(LONG)); expect(long.sha256).toBe(scriptHash(spokenText(LONG))); expect(long.source).toBe(LONG)
    expect(long.text).not.toContain('**')
    expect(second.p_revision).toBe(1)
    expect(second.p_body.send).toMatchObject({ status: 'sent', at: '2026-11-01T12:30:05.000Z', by: 'content-engine server' })
    expect(second.p_body.scripts).toEqual(first.p_body.scripts)
    expect(out).toMatchObject({ ok: true, revision: 2, send: { status: 'sent' } })
    expect(out.body.send.scripts).toHaveLength(2)
  })
  it('records no_key so a session can finish the send, and an error without losing his approval', async () => {
    const t = setup()
    const { out } = await t.put('picks', 'mon-scripts', approval())
    expect(out).toMatchObject({ ok: true, send: { status: 'no_key' } })
    expect(t.calls[1].args.p_body.send.status).toBe('no_key')
    const broken = setup(async () => { throw new Error('socket hang up') })
    const answer = await broken.put('picks', 'mon-scripts', approval())
    expect(answer.out).toMatchObject({ ok: true, send: { status: 'error', error: 'socket hang up' } })
    expect(broken.calls[0].args.p_body.approved).toBe(true)
  })
  it('refuses hashes that are not of the words, a session pressing for him, and sends nothing on a withdrawal', async () => {
    const t = setup()
    const wrong = await t.put('picks', 'mon-scripts', approval({ scripts: { long: 'a'.repeat(64), short: scriptHash(SHORT) } }))
    expect(wrong).toMatchObject({ status: 400, out: { error: 'approval_hash_mismatch' } })
    const session = await t.put('picks', 'mon-scripts', approval(), 'operator')
    expect(session).toMatchObject({ status: 403, out: { error: 'decision_is_his' } })
    expect(t.calls).toHaveLength(0); expect(t.sent).toHaveLength(0)
    const withdrawn = await t.put('picks', 'mon-scripts', { kind: 'approve_scripts', day: 'mon', piece_id: PIECE, approved: false })
    expect(withdrawn.status).toBe(200); expect(t.sent).toHaveLength(0); expect(t.calls).toHaveLength(1)
  })
  it('lists his approvals and titles as read-only views of picks', async () => {
    const t = setup()
    const listed = await t.call('GET', { collection: 'approvals' })
    expect(listed.status).toBe(200)
    expect(listed.out.documents[0]).toMatchObject({ id: 'mon-scripts', updated_by: 'Krish' })
    expect(t.reads[0]).toEqual([['week', '2026-11-09'], ['collection', 'picks'], ['body->>kind', 'approve_scripts']])
    await t.call('GET', { collection: 'titles' })
    expect(t.reads[1]).toContainEqual(['body->>kind', 'titles'])
    expect(await t.put('approvals', 'mon-scripts', approval())).toMatchObject({ status: 400, out: { error: 'read_only_view' } })
  })
})

describe('a rejection files his reason in the rejection inbox', () => {
  it('files a rejected asset with where and when he said it, its piece, formats and Drive id, never a master', async () => {
    const t = setup()
    const { status, out } = await t.put('picks', 'mon-reject-video-short', reject())
    expect(status).toBe(200); expect(out).toMatchObject({ ok: true, inbox: 'filed' })
    expect(t.inbox).toHaveLength(1)
    const { row, options } = t.inbox[0]
    expect(options).toEqual({ onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true })
    expect(row).toMatchObject({
      kind: 'rejected', said: 'The captions drift off his words at the start.', said_where: 'publish board, 2026-11-09 mon',
      said_at: '2026-11-01T12:30:05.000Z', piece: PIECE, formats: ['short_video'], master_drive_id: 'a'.repeat(33), at_ms: null, whole_cut: true,
      repository: 'krishanraja/content-engine', surface: 'publish_board', emitter_id: 'content-engine/publish-board',
    })
    expect(row.client_report_id).toMatch(/^board-[a-f0-9]{40}$/)
    expect(row.note).toBe('Asset rejected on the Publish step: 90-second video')
    expect(Object.keys(row)).not.toContain('screenshot')
    const moment = setup()
    await moment.put('picks', 'mon-reject-video-short', reject({ at_ms: 4200 }))
    expect(moment.inbox[0].row).toMatchObject({ at_ms: 4200, whole_cut: false })
    const words = setup()
    const { drive_id: _drive, ...cover } = reject({ asset: 'img-cover', label: 'Substack cover', formats: ['cover'] })
    await words.put('picks', 'mon-reject-img-cover', cover)
    expect(words.inbox[0].row).toMatchObject({ master_drive_id: null, at_ms: null, whole_cut: false, formats: ['cover'] })
  })
  it('files a rejected idea with a reason as a subject, files nothing without one, and the same words only once', async () => {
    const t = setup()
    await t.put('queue', 'mon-2', press('not_for_us'))
    expect(t.inbox).toHaveLength(0)
    await t.put('queue', 'mon-2', press('not_for_us', { reason: 'Done to death this month.' }), 'krish', 1)
    expect(t.inbox).toHaveLength(1)
    expect(t.inbox[0].row).toMatchObject({ said: 'Done to death this month.', said_where: 'publish board, 2026-11-09 mon', piece: IDEA, formats: [],
      master_drive_id: null, whole_cut: false, note: 'Idea rejected on the Ideas tab: Firms now pay for AI pictures.',
      meta: { rule_kind: 'subject', subject_ref: `idea:${IDEA}` } })
    await t.put('queue', 'mon-2', press('not_for_us', { reason: 'Done to death this month.', at: '2026-11-08T09:05:00Z' }), 'krish', 2)
    expect(t.inbox[1].row.client_report_id).toBe(t.inbox[0].row.client_report_id)
    await t.put('queue', 'mon-2', press('wider_piece_context', { note: 'pricing' }), 'krish', 3)
    expect(t.inbox).toHaveLength(2)
  })
  it('keeps his press when the inbox cannot take it, and says so', async () => {
    const t = setup(undefined, { inboxError: true })
    const { status, out } = await t.put('picks', 'mon-reject-video-short', reject())
    expect(status).toBe(200); expect(out).toMatchObject({ ok: true, revision: 1, inbox: 'failed' })
  })
})
