import { describe, expect, it } from 'vitest'
import { hisOnlyRefusal, validBody, views } from '../../apps/control-plane/api/board/_contracts.js'
import { creativePatch, creativeReport } from '../../apps/control-plane/api/board/_presses.js'

// Layout v4 of the publish board (Krish, 2026-11-07: "I still have to keep looking for things... It also doesn't allow
// me to give feedback for every day of publishing stuff last week, say, for example, the off days"; "I think we should
// redesign the 9th of November board as well"): his Sign creative press on the Creative step, and a Scores press for
// every post, off days included.

const PIECE = '11111111-2222-4333-8444-555555555555'
const A = 'a'.repeat(64), B = 'b'.repeat(64)
const picks = { opener: 'as_written', captions: 'cap-a', motion: 'swiss-kinetic-type', thumbnail: 'th-b' }
const sign = (extra: Record<string, unknown> = {}) => ({ kind: 'sign_creative', day: 'wed', piece_id: PIECE, sha256: A, approved: true, picks,
  storyboard_sha256: B, shown: ['swiss-kinetic-type', 'data-story'], at: '2026-11-08T10:00:00Z', ...extra })

describe('Sign creative', () => {
  it('takes one pick in each section, bound to the sheet shown and the storyboard ve binds', () => {
    expect(validBody('picks', 'wed-creative', sign())).toBe(true)
    expect(validBody('picks', 'tue-creative', sign({ day: 'tue' }))).toBe(true)
    expect(validBody('picks', 'sun-creative', sign({ day: 'sun' }))).toBe(false)
    expect(validBody('picks', 'wed-creative', sign({ day: 'fri' }))).toBe(false)
    expect(validBody('picks', 'wed-creative', sign({ picks: { ...picks, thumbnail: undefined } }))).toBe(false)
    expect(validBody('picks', 'wed-creative', sign({ picks: { ...picks, colour: 'red' } }))).toBe(false)
    expect(validBody('picks', 'wed-creative', sign({ sha256: 'x' }))).toBe(false)
    expect(validBody('picks', 'wed-creative', sign({ storyboard_sha256: undefined }))).toBe(false)
    expect(validBody('picks', 'wed-creative', sign({ piece_id: 'not-a-piece' }))).toBe(false)
    expect(validBody('picks', 'wed-creative', sign({ send: {} }))).toBe(false)
    // The motion pick must be one of the styles the sheet showed.
    expect(validBody('picks', 'wed-creative', sign({ picks: { ...picks, motion: 'paper-cutout' } }))).toBe(false)
  })
  it('takes Change it only with his words, and any picks he made so far', () => {
    expect(validBody('picks', 'wed-creative', sign({ approved: false, picks: {} }))).toBe(false)
    expect(validBody('picks', 'wed-creative', sign({ approved: false, picks: {}, words: '   ' }))).toBe(false)
    expect(validBody('picks', 'wed-creative', sign({ approved: false, picks: { captions: 'cap-a' }, words: 'The thumbnails are too dark.' }))).toBe(true)
  })
  it('is his press alone, and reads back as a view of picks', () => {
    expect(hisOnlyRefusal('picks', sign(), 'engine_operator')).toBe('decision_is_his')
    expect(hisOnlyRefusal('picks', sign(), 'Krish')).toBeNull()
    expect(views.creative).toBe('sign_creative')
  })
  it('writes the creative gate, and the storyboard and style gates ve reads when he signs', () => {
    const now = '2026-11-08T10:00:01Z'
    const g = creativePatch(sign(), now)
    expect(g.creative).toEqual({ by: 'Krish', at: now, sha256: A, approved: true, picks })
    expect(g.storyboard).toEqual({ by: 'Krish', at: now, sha256: B })
    expect(g.style?.module).toBe('swiss-kinetic-type')
    expect(g.style?.verdicts).toEqual([{ module: 'swiss-kinetic-type', verdict: 'picked' }, { module: 'data-story', verdict: 'seen' }])
    const back = creativePatch(sign({ approved: false, words: 'Too busy.' }), now)
    expect(back.creative?.approved).toBe(false)
    expect(back.creative?.words).toBe('Too busy.')
    expect(back.storyboard).toBeUndefined()
    expect(back.style).toBeUndefined()
  })
  it('files his words on a sheet he sent back to his taste ledger, verbatim, and nothing on a signature', () => {
    expect(creativeReport('2026-11-09', 'wed-creative', sign(), 'now')).toBeNull()
    const r = creativeReport('2026-11-09', 'wed-creative', sign({ approved: false, words: 'The thumbnails are too dark.' }), '2026-11-08T10:00:00Z')
    expect(r?.body).toBe('The thumbnails are too dark.')
    expect(r?.subject_ref).toBe(`piece:${PIECE}`)
  })
})

describe('Scores for every post', () => {
  const score = (extra: Record<string, unknown> = {}) => ({ kind: 'scores', narrative: 7, production: 5, basis: 'hindsight', ...extra })
  it('still takes a piece\'s scores under its piece', () => {
    expect(validBody('picks', `score-${PIECE}`, score({ piece_id: PIECE }))).toBe(true)
    expect(validBody('picks', `score-${PIECE}`, score())).toBe(false)
  })
  it('takes a post with no piece under its date, with its title', () => {
    expect(validBody('picks', 'score-2026-11-03', score({ date: '2026-11-03', title: 'What could you hand to AI this week?', day: 'tue' }))).toBe(true)
    expect(validBody('picks', 'score-2026-11-03-meme', score({ date: '2026-11-03', title: 'The translator meme' }))).toBe(true)
    expect(validBody('picks', 'score-2026-11-03', score({ date: '2026-11-04', title: 'x' }))).toBe(false)
    expect(validBody('picks', 'score-2026-11-03', score({ date: '2026-11-03' }))).toBe(false)
    expect(validBody('picks', 'score-2026-02-30', score({ date: '2026-02-30', title: 'x' }))).toBe(false)
    expect(validBody('picks', 'score-2026-11-03', score({ date: '2026-11-03', title: 'x', narrative: 11 }))).toBe(false)
    expect(validBody('picks', 'score-2026-11-03', score({ date: '2026-11-03', title: 'x', day: 'sun' }))).toBe(false)
    expect(hisOnlyRefusal('picks', score({ date: '2026-11-03', title: 'x' }), 'engine_operator')).toBe('decision_is_his')
  })
})
