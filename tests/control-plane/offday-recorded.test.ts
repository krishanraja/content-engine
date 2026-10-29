import { describe, expect, it } from 'vitest'
import { validBody } from '../../apps/control-plane/api/board/_contracts.js'
import { afterPress, offdayDate, preparePress } from '../../apps/control-plane/api/board/_presses.js'
import { makingCuts, makingSteps, parseMakingPatch } from '../../apps/control-plane/api/_making.js'
import { scriptHash, type SendApprovedInput } from '../../apps/control-plane/api/_teleprompter.js'

// An off-day piece he records (Ruling, Krish, 2026-10-29): an idea he drops in can be a Tuesday, Thursday, Saturday
// or Sunday piece, one short cut, "a short with motion designed subtitles and branding, or voiceover with motion
// designed infographics". His Approve on its option is his approval of the exact words shown: the server puts the
// piece on its day and sends those words to Teleprompter. Nothing here reaches Teleprompter or the database.

const WEEK = '2026-11-02'
const PIECE = '0d0d0d0d-1111-4222-8333-444455556666'
const ID = 'off-thu-mine'
const SCRIPT = 'Why does your team still copy the same numbers every Monday?\n\nPick one boring job and hand it to an agent.'
const SHA = scriptHash(SCRIPT)
const press = (over: Record<string, unknown> = {}) => ({
  pick: ID, use: 'offday', day: 'thu', approved: true, copy_sha256: 'c'.repeat(64), format: 'Said to camera', source: 'Your idea',
  option_id: 'mine', week: WEEK, at: '2026-11-01T09:00:00Z', kind: 'recorded', piece_id: PIECE, series: 'under_the_hood',
  style: 'to_camera', script: SCRIPT, script_sha256: SHA, folder_title: 'Thu 5 Nov under.the.hood - One boring job',
  title: 'Thu 5 Nov - 90-second - One boring job', readers: ['Reader A', 'Reader B'], ...over,
})

/** The two calls the press makes: one content_ideas row (read, then a guarded update) and board_save. */
function fakeDb(row: Record<string, any>) {
  const saves: any[] = []
  const db = {
    row,
    saves,
    from() {
      let patch: Record<string, any> | null = null
      const guards: Record<string, unknown> = {}
      const q: any = {
        select() { return q },
        update(p: Record<string, any>) { patch = p; return q },
        eq(col: string, v: unknown) { guards[col] = v; return q },
        async maybeSingle() { return { data: guards.id === db.row.id ? structuredClone(db.row) : null, error: null } },
        then(resolve: (v: unknown) => void) {
          if (patch && guards.id === db.row.id && guards.updated_at === db.row.updated_at) {
            db.row = { ...db.row, ...patch }
            return resolve({ data: [{ id: db.row.id }], error: null })
          }
          return resolve({ data: [], error: null })
        },
      }
      return q
    },
    async rpc(_name: string, args: Record<string, any>) { saves.push(args); return { data: { ok: true, revision: 2, body: args.p_body }, error: null } },
  }
  return db
}

describe('the board takes a press on an off-day piece he records', () => {
  it('a recorded Approve with the piece, its words and its names is a valid write', () => {
    expect(validBody('queue', ID, press())).toBe(true)
  })
  it('a plain off-day press still writes as it did', () => {
    const { kind, piece_id, series, style, script, script_sha256, folder_title, title, readers, ...plain } = press()
    expect(validBody('queue', ID, plain)).toBe(true)
  })
  it('refuses a send of its own, a style or series it does not know, and a piece that is not a uuid', () => {
    expect(validBody('queue', ID, press({ send: { status: 'sent' } }))).toBe(false)
    expect(validBody('queue', ID, press({ style: 'dance' }))).toBe(false)
    expect(validBody('queue', ID, press({ series: 'other' }))).toBe(false)
    expect(validBody('queue', ID, press({ piece_id: 'x' }))).toBe(false)
    expect(validBody('queue', ID, press({ script: '' }))).toBe(false)
  })
})

describe('his Approve binds the exact words he saw', () => {
  it('the server works out their hash, and his approval holds it for the short cut', async () => {
    const out = await preparePress('queue', ID, press({ script_sha256: undefined }))
    expect(out.script_sha256).toBe(SHA)
    expect(out.scripts).toEqual({ short: SHA })
  })
  it('a hash that is not the hash of the words is refused', async () => {
    await expect(preparePress('queue', ID, press({ script_sha256: 'f'.repeat(64) }))).rejects.toThrow('approval_hash_mismatch')
  })
})

describe('after his Approve the piece is on its day and the words go to Teleprompter', () => {
  it('Thursday of the week, in its series, in flight, one short cut, sent with his press as the approval', async () => {
    const db = fakeDb({ id: PIECE, state: 'seeded', scheduled_for: null, lane_slot: null, meta: {}, buried_at: null, updated_at: 't0' })
    const sent: SendApprovedInput[] = []
    const send = async (i: SendApprovedInput) => {
      sent.push(i)
      return { status: 'sent' as const, folder_id: '86B6F74B-2F8A-4477-AE44-8DA1119D1CD9', scripts: [{ cut: 'short', script_id: 'ED3DE98A-7158-4448-A622-A2A5115FFA83', readback_ok: true }] }
    }
    const body = await preparePress('queue', ID, press())
    const out = await afterPress(db as any, { week: WEEK, collection: 'queue', id: ID, body, who: 'Krish', saved: { ok: true, revision: 1 } }, { send, now: () => '2026-11-01T09:00:05Z' })
    expect(offdayDate(WEEK, 'thu')).toBe('2026-11-05')
    expect(db.row.scheduled_for).toBe('2026-11-05')
    expect(db.row.lane_slot).toBe('under_the_hood')
    expect(db.row.state).toBe('drafting')
    expect(db.row.meta.offday).toMatchObject({ day: 'thu', date: '2026-11-05', doc: `queue/${ID}`, style: 'to_camera', script_sha256: SHA, approved_by: 'Krish', prior_state: 'seeded' })
    expect(db.row.meta.making.script_check).toMatchObject({ passed: true, one_cut: true, cuts: ['short'], hashes: { short: SHA } })
    expect(db.row.meta.making.script_check.read_back.short).toMatchObject({ script_sha256: SHA, found: 'nothing lost', readers: ['Reader A', 'Reader B'] })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ piece_id: PIECE, day: 'thu', folder_title: body.folder_title, approval: { id: ID, updated_by: 'Krish' } })
    expect(sent[0].scripts).toEqual([expect.objectContaining({ cut: 'short', title: body.title, sha256: SHA })])
    expect(db.row.meta.making.teleprompter.cuts.short).toMatchObject({ script_id: 'ED3DE98A-7158-4448-A622-A2A5115FFA83', script_sha256: SHA })
    expect(out?.send).toMatchObject({ status: 'sent', date: '2026-11-05', recorded: true })
    expect(db.saves[0].p_body.send.status).toBe('sent')
    expect(makingSteps({ id: PIECE, state: db.row.state, meta: db.row.meta }).find(s => s.key === 'scripts')).toMatchObject({ state: 'done', note: 'short; in Teleprompter' })
  })

  it('an idea already on another day stays there, and nothing is sent', async () => {
    const db = fakeDb({ id: PIECE, state: 'drafting', scheduled_for: '2026-11-04', lane_slot: 'under_the_hood', meta: {}, buried_at: null, updated_at: 't0' })
    let calls = 0
    const out = await afterPress(db as any, { week: WEEK, collection: 'queue', id: ID, body: await preparePress('queue', ID, press()), who: 'Krish', saved: { ok: true, revision: 1 } },
      { send: async () => { calls++; return { status: 'sent' as const } } })
    expect(calls).toBe(0)
    expect(db.row.scheduled_for).toBe('2026-11-04')
    expect(out?.send).toMatchObject({ status: 'refused', error: 'the idea is already on 2026-11-04' })
  })

  it('a Skip after his Approve takes it off the day and back to the state it was in, unless he has recorded it', async () => {
    const db = fakeDb({ id: PIECE, state: 'seeded', scheduled_for: null, lane_slot: null, meta: {}, buried_at: null, updated_at: 't0' })
    const send = async () => ({ status: 'no_key' as const })
    await afterPress(db as any, { week: WEEK, collection: 'queue', id: ID, body: await preparePress('queue', ID, press()), who: 'Krish', saved: { ok: true, revision: 1 } }, { send, now: () => 't1' })
    expect(db.row.scheduled_for).toBe('2026-11-05')
    const out = await afterPress(db as any, { week: WEEK, collection: 'queue', id: ID, body: press({ approved: false }), who: 'Krish', saved: { ok: true, revision: 3 } }, { send, now: () => 't2' })
    expect(out).toMatchObject({ placed: 'withdrawn' })
    expect(db.row.scheduled_for).toBe(null)
    expect(db.row.state).toBe('seeded')
    expect(db.row.meta.offday.withdrawn_by).toBe('Krish')
  })
})

describe('the making record knows an off-day piece is one short cut', () => {
  it('one_cut with the short\'s hash alone asks for the short; anything else asks for both', () => {
    const one = parseMakingPatch({ script_check: { passed: true, problems: [], one_cut: true, hashes: { short: SHA } } }, 'now').patch
    expect(one.script_check?.one_cut).toBe(true)
    expect(makingCuts(one)).toEqual(['short'])
    expect(makingCuts({ script_check: { passed: true, problems: [], checked_at: 'now', one_cut: true, hashes: { short: SHA, long: SHA } } })).toEqual(['long', 'short'])
    expect(makingCuts({ script_check: { passed: true, problems: [], checked_at: 'now', hashes: { short: SHA } } })).toEqual(['long', 'short'])
  })
})
