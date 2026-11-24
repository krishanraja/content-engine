import { describe, expect, it } from 'vitest'
import { recentOutOf, repeatOf } from '../../apps/control-plane/api/board/_weekModel'
import type { OffdayItem } from '../../apps/control-plane/api/board/_offdayItems'
import { isGoodNews, saturdayHold } from '../../apps/control-plane/api/board/_goodNews'
import { carryTemplates } from '../../apps/control-plane/api/board/_carryTemplates'

type Body = Record<string, unknown>

// Saturday is good-news carousels only (Krish, 2026-11-19, of Sat 28: "Some of them are memes that are sneaking through").
describe('the ideas board holds a Saturday option that is not a good-news carousel', () => {
  const sat28 = [
    { id: 'goodnews', weekly: 'good_news', format: 'Uplifting AI news carousel, 7 cards, 4:5' },
    { id: 'builditself', format: 'Carousel, 6 cards, 4:5' },
    { id: 'salesagent', format: 'Explainer carousel, 5 cards, 4:5' },
    { id: 'presszero', format: 'Meme, 2 panels, 4:5' },
  ]
  it('holds the meme, the explainer and the plain carousel with the reason, never the good news', () => {
    const held = sat28.map(o => saturdayHold('2026-11-23', 'sat', o, false))
    expect(held[0]).toBeNull()
    for (const h of held.slice(1)) expect(h).toMatch(/^Saturday offers only good-news carousels/)
  })
  it('never holds what he approved, another day, or an earlier board', () => {
    expect(saturdayHold('2026-11-23', 'sat', sat28[3], true)).toBeNull()
    expect(saturdayHold('2026-11-23', 'tue', sat28[3], false)).toBeNull()
    expect(saturdayHold('2026-11-16', 'sat', sat28[3], false)).toBeNull()
  })
  it('reads good news from its kind, the weekly series or its format, never a meme', () => {
    expect(isGoodNews({ kind: 'good_news' })).toBe(true)
    expect(isGoodNews({ format: 'Good news meme, 2 panels' })).toBe(false)
  })
})

// Nothing already approved or in work is offered again (Ruling, Krish, 2026-11-19: "no suggestions approved duplicated.
// right now I seem to get pieces I am already working on show up as suggestions for following weeks").
describe('an idea that is something already approved or in work leaves every later board', () => {
  const opt = { id: 'aiauditor', hook: 'Will your AI auditor find your missing money?', source: { url: 'https://example.org/audit' } }
  const postInWork: OffdayItem = { item: 'engine:2026-11-23:schoolday', source: 'engine', origin_week: '2026-11-23', option_id: 'schoolday',
    option: { id: 'schoolday', hook: '$75,000 for an AI school day. Here is the receipt.', source: { url: 'https://example.org/school' } },
    state: 'approved', week: '2026-11-23', day: 'thu', date: '2026-11-26', doc: 'off-thu-schoolday', piece_id: null, drive_folder: null,
    posts: [{ state: 'made', channel: null, due_at: null, url: null, at: '2026-11-19T10:00:00Z', buffer_post_id: null }], followed: {}, version: 1,
    placed_by: 'Krish', placed_at: '2026-11-19T05:03:00Z' }
  const lastWeeksPiece = { id: 'c00cd4e0-e1bb-4c60-b36f-cea92897e38c', idea: 'Will your AI auditor find your missing money?', scheduled_for: '2026-11-20',
    state: 'review', buried_at: null, source_url: 'https://example.org/audit', canonical_url: null }
  const laterPiece = { ...lastWeeksPiece, id: 'd00cd4e0-e1bb-4c60-b36f-cea92897e38c', scheduled_for: '2026-12-09', idea: 'A piece he is making for December', source_url: 'https://example.org/december' }
  const recent = recentOutOf({ week: '2026-11-30', ideas: null, plans: {}, pieces: [] }, [], [postInWork], [lastWeeksPiece, laterPiece])

  it('last week\'s approved piece in production', () => {
    const rep = repeatOf({ keys: ['2026-11-30:fri-1', 'piece:c00cd4e0-e1bb-4c60-b36f-cea92897e38c'], week: '2026-11-30', date: '2026-12-04', url: 'https://example.org/audit',
      hook: null, idea: true }, recent)
    expect(rep?.line).toMatch(/^Already in work: "Will your AI auditor/)
  })
  it('an off-day post in production, offered again by its item, its source or its hook', () => {
    expect(repeatOf({ keys: ['2026-11-30:off-tue-schoolday', 'engine:2026-11-23:schoolday'], week: '2026-11-30', date: '2026-12-01', url: null, hook: null, idea: true }, recent)?.line)
      .toMatch(/^Already in work/)
    expect(repeatOf({ keys: ['2026-11-30:off-tue-other'], week: '2026-11-30', date: '2026-12-01', url: 'https://example.org/school', hook: null, idea: true }, recent)?.line)
      .toMatch(/^Same source as/)
  })
  it('a piece in work for a later week is never offered either', () => {
    expect(repeatOf({ keys: ['2026-11-30:wed-2'], week: '2026-11-30', date: '2026-12-02', url: 'https://example.org/december', hook: null, idea: true }, recent)?.line)
      .toMatch(/^Same source as "A piece he is making for December"/)
  })
  it('a distinct idea stays', () => {
    expect(repeatOf({ keys: ['2026-11-30:sat-1'], week: '2026-11-30', date: '2026-12-05', url: 'https://example.org/new', hook: 'a new thing', idea: true }, recent)).toBeNull()
  })
})

// Every week's ideas board carries the meme templates (Ruling, Krish, 2026-11-19: "every week's ideas board should include
// the meme templates feature as well").
describe('last week\'s unanswered meme templates stay on offer', () => {
  const tpl = (id: string, page: string) => ({ id, kind: 'meme', template: { title: id, clip: { url: `https://x.test/${id}.mp4`, page }, found: { place: 'reddit' } } })
  const w16 = { offdays: { tue: [tpl('dog', 'https://r.test/dog'), tpl('cat', 'https://r.test/cat')], thu: [tpl('owl', 'https://r.test/owl'), { id: 'carousel', kind: 'explainer' }] } }
  it('the week of 23 Nov, which the run left with none, carries 16 Nov\'s open ones onto the same days', () => {
    const got = carryTemplates({ offdays: { tue: [], thu: [] } }, '2026-11-16', w16, [{ doc_id: 'off-tue-cat', body: { idea: { verdict: 'reject' } } }], new Set(['owl']))!
    const ids = (d: string) => ((got.offdays as Body)[d] as Body[]).map(o => o.id)
    expect(ids('tue')).toEqual(['dog'])
    expect(ids('thu')).toEqual([])
    expect(((got.offdays as Body).tue as Body[])[0].carried_from).toBe('2026-11-16')
  })
  it('a week with its own templates keeps them, and one on the same clip is never carried twice', () => {
    const own = { offdays: { tue: [tpl('newdog', 'https://r.test/dog')], thu: [] } }
    const got = carryTemplates(own, '2026-11-16', w16, [], new Set())!
    expect(((got.offdays as Body).tue as Body[]).map(o => o.id)).toEqual(['newdog', 'cat'])
    expect(((got.offdays as Body).thu as Body[]).map(o => o.id)).toEqual(['owl'])
  })
  it('no plan last week, nothing carried', () => {
    const own = { offdays: { tue: [] } }
    expect(carryTemplates(own, '2026-11-16', null, [], new Set())).toBe(own)
  })
})
