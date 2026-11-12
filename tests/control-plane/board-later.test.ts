import { describe, expect, it } from 'vitest'
import { approval, withApprovals } from './_approvals'
import { buildLater, type LaterInputs } from '../../apps/control-plane/api/board/_later'
import { validBody } from '../../apps/control-plane/api/board/_contracts'
import { offdaySides } from '../../apps/control-plane/api/board/_offdaySides'
import { fillPress, offdayList } from '../../apps/control-plane/api/board/_viewExtras'
import { buildView } from '../../apps/control-plane/api/board/_view'

// Ideas for later (Krish, 2026-11-12: "Does my 'Ideas for Later' tab contain everything I've not approved but not
// rejected in all the previous ideas boards?"): every option on every ideas board he neither approved nor rejected,
// grouped, from the records, never an outcome made up for him. Synthetic fixtures only.

type Body = Record<string, unknown>
const NOW = new Date('2026-11-12T15:00:00Z')
const A = '11111111-2222-4333-8444-555555555551', B = '11111111-2222-4333-8444-555555555552', C = '11111111-2222-4333-8444-555555555553'
const D = '11111111-2222-4333-8444-555555555554', E = '11111111-2222-4333-8444-555555555555', F = '11111111-2222-4333-8444-555555555556'
const series = (id: string | null, so: string) => ({ ...(id ? { id } : {}), so_what: so, story: `Headline: ${so} Hook: "x"` })
const off = (id: string, extra: Body = {}) => ({ id, format: 'Meme carousel, 4:5', copy: `Copy ${id}`, hook: `Hook ${id}.`, ...extra })
const doc = (week: string, collection: string, doc_id: string, body: Body, updated_by = 'Krish') => ({ week, collection, doc_id, body, updated_by, updated_at: String(body.at || '2026-11-01T00:00:00Z'), revision: 2 })

function inputs(over: Partial<LaterInputs> = {}): LaterInputs {
  return {
    now: NOW,
    boards: [
      // The first board: options with no record id, verdicts imported from it, a pick.
      { week: '2026-10-19', ideas: { days: { mon: [series(null, 'Old pick.'), series(null, 'Old queued.'), series(null, 'Old curious.'), series(null, 'Old drop.')] } }, growth: null },
      { week: '2026-11-02', ideas: null, growth: { days: { '2026-11-07': [{ concept_id: 'passports', lane: 'Carousel', draft: 'A shopping guide.' }], '2026-11-08': [{ concept_id: 'weekin3', draft: 'Sunday cards.' }] } } },
      { week: '2026-11-09', ideas: { days: { wed: [series(A, 'Filed one.'), series(B, 'Picked one.'), series(C, 'Rejected one.'), series(D, 'Untouched one.')] },
        offdays: { tue: [off('shell'), off('trendy')], sat: [off('goodnews', { weekly: 'good_news' })] } }, growth: null },
      // Next week's board is still the Sunday slate.
      { week: '2026-11-16', ideas: { days: { fri: [series(E, 'Slate, unanswered.'), series(F, 'Slate, improved.')] } }, growth: null },
    ],
    docs: [
      doc('2026-10-19', 'picks', 'mon', { day: 'mon', pick: 'mon-1', story: 's', at: '2026-10-19T07:20:00Z' }, 'engine_operator'),
      doc('2026-10-19', 'queue', 'mon-2', { pick: 'mon-2', queued: true, verdict: 'story', reason: null, at: '2026-10-19T07:21:00Z' }, 'engine_operator'),
      doc('2026-10-19', 'queue', 'mon-3', { pick: 'mon-3', queued: false, verdict: 'curious', reason: 'Not sure who it helps.', at: '2026-10-19T07:22:00Z' }, 'engine_operator'),
      doc('2026-10-19', 'queue', 'mon-4', { pick: 'mon-4', queued: false, verdict: 'drop', at: '2026-10-19T07:23:00Z' }, 'engine_operator'),
      doc('2026-11-02', 'queue', 'off-sat-passports', { use: 'offday', pick: 'off-sat-passports', day: 'sat', idea: { verdict: 'improve', words: 'Make it a parody.', sha256: 'a'.repeat(64), at: '2026-11-01T10:00:00Z' } }),
      doc('2026-11-09', 'picks', 'wed', { day: 'wed', pick: 'wed-2', idea_id: B, story: 's', at: '2026-11-03T06:49:00Z' }),
      doc('2026-11-09', 'queue', 'wed-1', { pick: 'wed-1', queued: true, use: 'next_week', note: 'Later, with more.', target_week: '2026-11-16', at: '2026-11-03T06:50:00Z' }),
      doc('2026-11-09', 'queue', 'off-tue-shell', { use: 'offday', pick: 'off-tue-shell', day: 'tue', idea: { verdict: 'approve', words: null, sha256: offdaySides(off('shell')).idea_sha256, at: '2026-11-03T06:55:00Z' } }),
      // A session's press is never his.
      doc('2026-11-09', 'queue', 'wed-4', { pick: 'wed-4', queued: true, use: 'next_week', target_week: '2026-11-16', at: '2026-11-03T07:00:00Z' }, 'engine_operator'),
    ],
    outcomes: [
      { week: '2026-11-09', day: 'wed', idea_id: C, option_ref: 'wed-3', doc: 'queue/wed-3', outcome: 'rejected', words: 'Boring.', decided_by: 'Krish', decided_at: '2026-11-03T06:51:00Z', via: 'press' },
      { week: '2026-11-09', day: 'tue', idea_id: 'off-tue-trendy', option_ref: 'off-tue-trendy', doc: 'queue/off-tue-trendy', outcome: 'trend', words: 'The token squeeze.', decided_by: 'Krish', decided_at: '2026-11-03T06:56:00Z', via: 'offday' },
      { week: '2026-11-16', day: 'fri', idea_id: F, option_ref: 'fri-2', doc: 'queue/fri-2', outcome: 'improved', words: 'Simpler.', decided_by: 'Krish', decided_at: '2026-11-09T13:10:00Z', via: 'press' },
    ],
    cues: [],
    pieces: [{ id: B, state: 'published', scheduled_for: '2026-11-11', published_at: '2026-11-11T21:00:00Z' }, { id: A, state: 'seeded' }, { id: D, state: 'seeded' }],
    approvals: {
      '2026-11-09': [approval('2026-11-09', 'wed', B), approval('2026-11-09', 'tue', 'shell'), approval('2026-11-09', 'sat', 'oldproof')],
      '2026-11-16': [approval('2026-11-16', 'wed', '99999999-2222-4333-8444-555555555555')],
      '2026-11-23': [], '2026-11-30': [],
    },
    ...over,
  }
}
const items = (v: ReturnType<typeof buildLater>) => Object.fromEntries(v.groups.flatMap(g => g.items.map(x => [x.title, { group: g.id, x }])))

describe('ideas for later: what is in it', () => {
  it('keeps every option he neither approved nor rejected, in the group his last answer puts it, and nothing else', () => {
    const v = buildLater(inputs())
    const got = Object.fromEntries(Object.entries(items(v)).map(([t, { group }]) => [t, group]))
    expect(got).toEqual({
      'Filed one.': 'filed',
      'Old queued.': 'filed',
      'Hook trendy.': 'trend',
      'A shopping guide.': 'improved',
      'Slate, improved.': 'improved',
      'Old curious.': 'older',
      'Untouched one.': 'never',
      'Hook goodnews.': 'never',
      'Sunday cards.': 'never',
    })
    // Approved (a standing pick, an off-day Approve, a piece published) and rejected (his Reject, an old Drop) are out.
    expect(v.counts).toMatchObject({ approved: 3, rejected: 2, on_slate: 1, total: 9, filed: 2, trend: 1, improved: 2, older: 1, never: 3 })
  })

  it('never reads a session\'s press as his, never makes an outcome up, and keeps his words beside each answer', () => {
    const v = items(buildLater(inputs()))
    expect(v['Untouched one.'].x.answer).toBeNull()
    expect(v['Filed one.'].x.answer).toMatchObject({ said: 'filed', words: 'Later, with more.', label: 'Filed for later' })
    expect(v['Old curious.'].x.answer).toMatchObject({ said: 'older', label: 'Curious, not convinced', words: 'Not sure who it helps.' })
    expect(v['Old queued.'].x.answer).toMatchObject({ said: 'filed', via: 'legacy_story' })
  })

  it('lists the newest board first in each group, each with the board it was on', () => {
    const v = buildLater(inputs())
    const filed = v.groups.find(g => g.id === 'filed')!.items
    expect(filed.map(x => x.week)).toEqual(['2026-11-09', '2026-10-19'])
    expect(filed[0]).toMatchObject({ week: '2026-11-09', day: 'wed', date: '2026-11-11', doc: 'queue/wed-1', kind: 'series' })
  })

  it('takes the latest answer across every board an idea was on', () => {
    const later = inputs()
    later.boards[3].ideas = { days: { fri: [series(A, 'Filed one, offered again.'), series(E, 'Slate, unanswered.')] } }
    later.outcomes.push({ week: '2026-11-16', day: 'fri', idea_id: A, option_ref: 'fri-1', doc: 'queue/fri-1', outcome: 'rejected', words: 'No.', decided_by: 'Krish', decided_at: '2026-11-09T13:00:00Z', via: 'press' })
    expect(items(buildLater(later))['Filed one, offered again.']).toBeUndefined()
  })
})

describe('ideas for later: the five presses', () => {
  it('gives each the five presses of the ideas gate, each a document the board accepts', () => {
    const v = buildLater(inputs())
    for (const g of v.groups) for (const x of g.items) {
      for (const a of x.actions) {
        expect(a.kind).toBe('press')
        const { id, body } = fillPress(a, a.words ? 'His words.' : '', '2026-11-12T15:00:00Z')
        expect(validBody(a.collection!, id, body), `${x.title}: ${a.label}`).toBe(true)
        expect(a.week, a.label).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
      expect(x.actions.filter(a => a.outcome !== 'approved').map(a => a.label)).toEqual(['File for later', 'Reject', 'Save as a trend', 'Improve for a future piece'])
    }
  })

  it('approves onto the next free date of its own day, and the four others answer the board it was on', () => {
    const v = items(buildLater(inputs()))
    const filed = v['Filed one.'].x
    // Wed 11 has gone, Wed 18 has its piece: Wed 25.
    expect(filed.actions[0]).toMatchObject({ label: 'Approve for Wednesday 25 Nov', week: '2026-11-23', collection: 'picks', id: 'wed', outcome: 'approved' })
    expect(filed.actions[0].body).toMatchObject({ day: 'wed', idea_id: A, pick: `later-${A.slice(0, 8)}` })
    expect(filed.actions.slice(1).every(a => a.week === '2026-11-09' && a.id === 'wed-1')).toBe(true)
    // An off-day option goes to the next free day of its own weekday, bound to the words it showed.
    const trend = v['Hook trendy.'].x
    expect(trend.actions[0]).toMatchObject({ label: 'Approve for Tuesday 17 Nov', week: '2026-11-16', collection: 'queue', id: 'off-tue-trendy' })
    expect((trend.actions[0].body.idea as Body).sha256).toBe(offdaySides(off('trendy')).idea_sha256)
  })

  it('says why an idea has no Approve: no record, a Sunday, or a week\'s good news', () => {
    const v = items(buildLater(inputs()))
    expect(v['Old queued.'].x.held).toMatch(/no record in the engine/)
    expect(v['Sunday cards.'].x.held).toMatch(/Sunday is a rest day/)
    expect(v['Hook goodnews.'].x.held).toMatch(/good news is made of that week's stories/)
    for (const t of ['Old queued.', 'Sunday cards.', 'Hook goodnews.']) expect(v[t].x.actions.some(a => a.outcome === 'approved')).toBe(false)
  })
})

describe('an off-day option approved onto another board', () => {
  it('is drawn on its new day from the words his Approve bound, so the approval covers it', () => {
    const o = off('trendy')
    const s = offdaySides(o)
    const queue = [{ doc_id: 'off-tue-trendy', updated_by: 'Krish', revision: 1, body: { use: 'offday', pick: 'off-tue-trendy', day: 'tue', week: '2026-11-16', option_id: 'trendy',
      format: o.format, copy_sha256: s.copy_sha256, idea: { verdict: 'approve', words: null, sha256: s.idea_sha256, shown: s.shown_idea, at: '2026-11-12T15:00:00Z' } } }]
    const list = offdayList({ offdays: { tue: [off('other')] } }, queue, 'tue')
    expect(list.map(x => x.id)).toEqual(['other', 'trendy'])
    expect(offdaySides(list[1]).idea_sha256).toBe(s.idea_sha256)
    // On the week's view, it is approved and Growth makes it.
    const v = buildView(withApprovals({ week: '2026-11-16', now: NOW, pieces: [], picks: [], history: [], runs: {}, north_star: null, locks: {}, queue,
      ideas: { offdays: { tue: [off('other')] } }, approvals: [{ ...approval('2026-11-16', 'tue', 'trendy'), option_sha256: s.idea_sha256 }] }))
    const tue = v.days.find(d => d.day === 'tue')!
    expect(tue.options.find(x => x.id === 'trendy')?.status).toBe('approved')
    expect(tue.who).toBe('growth')
  })
})

describe('every off-day idea for later moves to any day (Ruling, Krish, 2026-11-12)', () => {
  const row = (item: string, state: string, extra: Body = {}) => ({ item, source: 'engine', origin_week: '2026-11-09', option_id: item.split(':')[2], option: off(item.split(':')[2]),
    state, week: null, day: null, date: null, doc: null, piece_id: null, drive_folder: null, posts: [], followed: {}, version: 4, placed_by: 'Krish', placed_at: 'x', ...extra })
  it('an idea from the plan carries Move to…, onto any day from today through four weeks, its Approve for that day', () => {
    const trendy = items(buildLater(inputs()))['Hook trendy.'].x
    expect(trendy.move).toMatchObject({ op: 'move', item: 'engine:2026-11-09:trendy', version: 0, state: 'slate', from: { week: '2026-11-09', day: 'tue' }, later: true })
    expect(trendy.move!.days[0].date).toBe('2026-11-12')
    expect(trendy.move!.days.some(d => d.day === 'sun')).toBe(false)
    // Growth's older file is not the plan a move reads back, so it is not offered there; a series idea keeps its own Approve.
    expect(items(buildLater(inputs()))['A shopping guide.'].x.move).toBeUndefined()
  })
  it('one he sent back to later moves by its row; one his move put on a day is not an idea for later', () => {
    const later = items(buildLater(inputs({ items: [row('engine:2026-11-09:trendy', 'later')] as never })))['Hook trendy.'].x
    expect(later.move).toMatchObject({ item: 'engine:2026-11-09:trendy', version: 4, state: 'later', from: null })
    const placed = buildLater(inputs({ items: [row('engine:2026-11-09:trendy', 'approved', { week: '2026-11-23', day: 'thu', date: '2026-11-26', doc: 'queue/off-thu-trendy' })] as never }))
    expect(items(placed)['Hook trendy.']).toBeUndefined()
  })
})
