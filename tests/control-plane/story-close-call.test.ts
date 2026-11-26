// The story score's close call on the board (the story engine v5 plan: "close call, your pick", never a silent pass).
// story_score.py order writes story_score.close_call beside the top two of a slot that scored within the margin with
// no council read to decide them; the option card says it first. Every option here is invented.
import { describe, expect, it } from 'vitest'
import { closeCall, offdayOptions, seriesOptions, thinWeek, type ExtrasInputs } from '../../apps/control-plane/api/board/_viewExtras'

const WEEK = '2026-11-23'
const inputs = (ideas: Record<string, unknown>): ExtrasInputs => ({ week: WEEK, pieces: [], picks: [], queue: [], ideas, approvals: [] })
const score = (close_call?: string) => ({ total: 80, rubric_version: 'story-score/1', ...(close_call ? { close_call } : {}) })

describe('a close call shows on the card', () => {
  it('says the close call first, capitalised, on a series option and an off-day option', () => {
    expect(closeCall({ story_score: score('close call, your pick') })).toBe('Close call, your pick. ')
    expect(closeCall({ story_score: score() })).toBe('')
    expect(closeCall({})).toBe('')
    const o = { id: '22222222-3333-4444-8555-666666666666', so_what: 'Who keeps the AI saving.', story: 'Headline: who keeps it.',
      story_score: score('close call, your pick') }
    const [option] = seriesOptions(inputs({ days: { mon: [o] } }), 'mon', false)
    expect(option.text.startsWith('Close call, your pick. Who keeps')).toBe(true)
    const off = { id: 'cats', kind: 'recorded', hook: 'The cat filed the expenses', copy: 'A meme about a cat.', story_score: score('close call, your pick') }
    const [shown] = offdayOptions(inputs({ offdays: { tue: [off] } }), 'tue')
    expect(shown.text.startsWith('Close call, your pick. A meme about a cat.')).toBe(true)
  })
})

describe('a thin week shows on the card', () => {
  it('says it plainly on a series option, and nothing when the day is not thin', () => {
    const s = { total: 80, rubric_version: 'story-score/1', thin_week: 'a thin week: only two options passed every floor after a second gather' }
    expect(thinWeek({ story_score: s })).toBe('A thin week: only two options passed every floor after a second gather. ')
    expect(thinWeek({ story_score: score() })).toBe('')
    const o = { id: '22222222-3333-4444-8555-666666666666', so_what: 'Who keeps the AI saving.', story: 'Headline: who keeps it.', story_score: s }
    const [option] = seriesOptions(inputs({ days: { mon: [o] } }), 'mon', false)
    expect(option.text.startsWith('A thin week: only two options passed every floor after a second gather. Who keeps')).toBe(true)
  })
})
