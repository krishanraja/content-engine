import { describe, expect, it } from 'vitest'
import { hisOnlyRefusal, validBody } from '../../apps/control-plane/api/board/_contracts.js'
import { afterPress, offdayReports } from '../../apps/control-plane/api/board/_presses.js'
import { dispatchOffdayRevise } from '../../apps/control-plane/api/board/_offdayRevise.js'

// Off days judged like Mon/Wed/Fri (Ruling, Krish, 2026-11-01: "Mock looks right, lock it and build it"; he asked
// for "Ideas and a suggested creative direction to approve or improve or flat out reject for a reason, and the
// machine can learn over time"). Each option is queue/off-<day>-<option> with a side for the idea, the direction and
// the returned mock; Improve and Reject carry his words, which go to his taste ledger, and Improve asks for a revision.

const WEEK = '2026-11-09'
const SHA = 'c'.repeat(64)
const side = (verdict: string | null, words: string | null = null, extra: Record<string, unknown> = {}) =>
  ({ verdict, words, sha256: SHA, at: '2026-11-08T10:00:00Z', ...extra })
const record = (sides: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  pick: 'off-tue-prices', use: 'offday', day: 'tue', week: WEEK, option_id: 'prices', format: 'Carousel', source: 'Content Inspo',
  copy_sha256: SHA, at: '2026-11-08T10:00:00Z', ...sides, ...extra,
})

describe('the off-day verdict contract', () => {
  it('takes Approve, Improve, Reject and Next week on the idea, each side bound to what it showed', () => {
    for (const v of ['approve', 'next_week', null]) expect(validBody('queue', 'off-tue-prices', record({ idea: side(v) }))).toBe(true)
    expect(validBody('queue', 'off-tue-prices', record({ idea: side('approve', null, { shown: { hook: 'Three prices' } }), direction: side('improve', 'warmer') }))).toBe(true)
    expect(validBody('queue', 'off-tue-prices', record({ mock: side('reject', 'too busy') }))).toBe(true)
  })
  it('refuses Improve or Reject without his words, Next week off the idea, and a side not bound to a hash', () => {
    expect(validBody('queue', 'off-tue-prices', record({ idea: side('reject') }))).toBe(false)
    expect(validBody('queue', 'off-tue-prices', record({ idea: side('improve', '   ') }))).toBe(false)
    expect(validBody('queue', 'off-tue-prices', record({ direction: side('next_week') }))).toBe(false)
    expect(validBody('queue', 'off-tue-prices', record({ idea: { ...side('approve'), sha256: 'nope' } }))).toBe(false)
    expect(validBody('queue', 'off-tue-prices', record({ idea: { ...side('approve'), extra: 1 } }))).toBe(false)
    expect(validBody('queue', 'off-tue-prices', record({ idea: side('approve') }, { send: {} }))).toBe(false)
    expect(validBody('queue', 'off-tue-prices', record({ idea: side('approve') }, { day: 'thu' }))).toBe(false)
    expect(validBody('queue', 'off-tue-prices', record({ idea: side('maybe') }))).toBe(false)
  })
  it('is his press only', () => {
    expect(hisOnlyRefusal('queue', record({ idea: side('approve') }), 'Growth')).toBe('press_is_his')
    expect(hisOnlyRefusal('queue', record({ idea: side('approve') }), 'Krish')).toBeNull()
  })
})

describe('what the server does with his words', () => {
  it('files one taste report per side he improved or rejected, in his words, once', () => {
    const rows = offdayReports(WEEK, 'off-tue-prices', record({ idea: side('approve'), direction: side('improve', 'a real puppy'), mock: side('reject', 'too busy') }), 'now')
    expect(rows.map(r => [r.meta.side, r.meta.verdict, r.body, r.polarity, r.lane])).toEqual([
      ['direction', 'improve', 'a real puppy', 'neutral', 'production'],
      ['mock', 'reject', 'too busy', 'dislikes', 'production'],
    ])
    expect(rows[0]).toMatchObject({ kind: 'krish_words', surface: 'publish_board', subject_ref: `offday:${WEEK}:off-tue-prices` })
    const again = offdayReports(WEEK, 'off-tue-prices', record({ direction: side('improve', 'a real puppy') }), 'later')
    expect(again[0].client_report_id).toBe(rows[0].client_report_id)
  })

  const fakeDb = (fresh: boolean) => {
    const filed: unknown[] = []
    return {
      filed,
      db: { from: (t: string) => ({ upsert: (row: unknown) => { expect(t).toBe('taste_reports'); filed.push(row)
        return { select: async () => ({ data: fresh ? [{ client_report_id: 'x' }] : [], error: null }) } } }) },
    }
  }
  it('asks for a revised card on a new Improve, and not again for the same words', async () => {
    const asked: unknown[] = []
    const revise = async (p: { week: string; option: string; side: string; words: string }) => { asked.push(p); return { sent: true as const } }
    const body = record({ idea: side('approve'), direction: side('improve', 'warmer, a real puppy') })
    const ctx = { week: WEEK, collection: 'queue', id: 'off-tue-prices', body, who: 'Krish', saved: { ok: true, revision: 2 } }
    const first = fakeDb(true)
    const out = await afterPress(first.db as never, ctx, { now: () => 'now', revise })
    expect(out).toMatchObject({ taste: { direction: 'filed' }, revise: { direction: { sent: true } } })
    expect(asked).toEqual([{ week: WEEK, option: 'off-tue-prices', side: 'direction', words: 'warmer, a real puppy' }])
    const second = fakeDb(false)
    const repeat = await afterPress(second.db as never, ctx, { now: () => 'now', revise })
    expect(repeat).toMatchObject({ revise: { direction: { sent: false, reason: 'already_asked' } } })
    expect(asked).toHaveLength(1)
  })
  it('files a Reject without asking for a revision, and does nothing for a plain Approve', async () => {
    const asked: unknown[] = []
    const revise = async () => { asked.push(1); return { sent: true as const } }
    const rejected = fakeDb(true)
    const out = await afterPress(rejected.db as never, { week: WEEK, collection: 'queue', id: 'off-tue-prices', body: record({ idea: side('reject', 'every account does this joke') }), who: 'Krish', saved: { ok: true } }, { revise })
    expect(out).toMatchObject({ taste: { idea: 'filed' } })
    expect(asked).toHaveLength(0)
    expect(await afterPress({} as never, { week: WEEK, collection: 'queue', id: 'off-tue-prices', body: record({ idea: side('approve') }), who: 'Krish', saved: { ok: true } }, { revise })).toBeNull()
  })
})

describe('the revise dispatch', () => {
  it('sends nothing without a token, and one repository_dispatch with one', async () => {
    const payload = { week: WEEK, option: 'off-tue-prices', side: 'direction', words: 'warmer' }
    expect(await dispatchOffdayRevise(payload, {})).toEqual({ sent: false, reason: 'not_configured' })
    const calls: Array<{ url: string; body: string }> = []
    const fetcher = async (url: string, init: { body: string }) => { calls.push({ url, body: init.body }); return { status: 204, text: async () => '' } }
    expect(await dispatchOffdayRevise(payload, { PLACE_TAKES_DISPATCH_TOKEN: 'synthetic' }, fetcher as never)).toEqual({ sent: true })
    expect(calls[0].url).toBe('https://api.github.com/repos/krishanraja/content-engine/dispatches')
    expect(JSON.parse(calls[0].body)).toEqual({ event_type: 'offday-revise', client_payload: payload })
  })
})

describe('Sunday reads his off-day verdicts back', async () => {
  const { buildOffdayVerdicts, offdayWeeksBefore } = await import('../../apps/control-plane/api/week/_offdayVerdicts.js')
  it('lists every side he judged, his words verbatim, newest first, with the hook he saw', () => {
    const at = (h: number) => `2026-11-0${h}T10:00:00Z`
    const out = buildOffdayVerdicts([
      { week: '2026-11-02', doc_id: 'off-tue-a', body: { day: 'tue', format: 'Meme', idea: { verdict: 'approve', words: null, sha256: SHA, at: at(1), shown: { hook: 'The AI that agrees' } },
        direction: { verdict: 'improve', words: ' a real puppy ', sha256: SHA, at: at(2) } } },
      { week: '2026-11-02', doc_id: 'off-sat-b', body: { day: 'sat', idea: { verdict: 'reject', words: 'every account does this joke', sha256: SHA, at: at(3) } } },
      { week: '2026-11-02', doc_id: 'off-sun-c', body: { day: 'sun', approved: true } },
      { week: '2026-11-02', doc_id: 'mon-1', body: { idea: { verdict: 'approve' } } },
    ])
    expect(out.verdicts.map(v => [v.option, v.side, v.verdict, v.words, v.hook])).toEqual([
      ['off-sat-b', 'idea', 'reject', 'every account does this joke', null],
      ['off-tue-a', 'direction', 'improve', 'a real puppy', 'The AI that agrees'],
      ['off-tue-a', 'idea', 'approve', null, 'The AI that agrees'],
    ])
    expect(out.counts).toEqual({ approve: 1, improve: 1, reject: 1, next_week: 0 })
  })
  it('reads the eight weeks before the one being planned', () => {
    expect(offdayWeeksBefore('2026-11-09')).toEqual(['2026-11-02', '2026-10-26', '2026-10-19', '2026-10-12', '2026-10-05', '2026-09-28', '2026-09-21', '2026-09-14'])
  })
})
