import { describe, expect, it } from 'vitest'
import { hisOnlyRefusal, validBody } from '../../apps/control-plane/api/board/_contracts.js'
import { yesByDay } from '../../apps/control-plane/api/board/_yes.js'

// One yes anywhere (Ruling, Krish, 2026-11-02: "yes, start with one yes anywhere"): his yes to a day is one record,
// from his board press or from his exact typed words carried by a session, never a press he did not make.

const words = (extra: Record<string, unknown> = {}) => ({ kind: 'yes', day: 'wed', via: 'words', approved: true, at: '2026-11-02T21:30:00Z',
  words: 'can you just approve Weds, Fri and Sat for me here', said_at: '2026-11-02T21:25:00Z',
  said_where: 'Claude Code session in krishanraja/content-engine', session_ref: 'https://claude.ai/code/session_x', ...extra })
const board = (extra: Record<string, unknown> = {}) => ({ kind: 'yes', day: 'wed', via: 'board', approved: true, at: '2026-11-02T22:00:00Z', ...extra })

describe('what a yes carries', () => {
  it('a words yes holds his words verbatim, when and where he typed them and the session link', () => {
    expect(validBody('picks', 'yes-wed-words', words())).toBe(true)
    for (const bad of [{ words: '' }, { said_at: 'yesterday' }, { said_where: '' }, { session_ref: 'http://x' }, { approved: false }, { day: 'fri' }])
      expect(validBody('picks', 'yes-wed-words', words(bad)), JSON.stringify(bad)).toBe(false)
  })
  it('a board yes or undo needs only the day and the time; the id names its source', () => {
    expect(validBody('picks', 'yes-sat-board', board({ day: 'sat' }))).toBe(true)
    expect(validBody('picks', 'yes-sat-board', board({ day: 'sat', approved: false }))).toBe(true)
    expect(validBody('picks', 'yes-wed-board', words())).toBe(false)
    expect(validBody('picks', 'yes-wed-words', board())).toBe(false)
  })
})

describe('who may write a yes', () => {
  it('the engine may carry his typed yes, but never a board press nor an undo', () => {
    expect(hisOnlyRefusal('picks', words(), 'engine_operator')).toBe(null)
    expect(hisOnlyRefusal('picks', board(), 'engine_operator')).toBe('yes_press_is_his')
    expect(hisOnlyRefusal('picks', board({ approved: false }), 'engine_operator')).toBe('yes_press_is_his')
    expect(hisOnlyRefusal('picks', board(), 'Krish')).toBe(null)
  })
  it('his other decisions stay his alone', () => {
    expect(hisOnlyRefusal('picks', { kind: 'approve_publish', day: 'wed', approved: true }, 'engine_operator')).toBe('decision_is_his')
  })
})

describe('his answer for each day', () => {
  it('the latest of his board yes, his words and his Approve for publish wins', () => {
    const rows = [
      { doc_id: 'yes-wed-words', body: words(), updated_by: 'engine_operator' },
      { doc_id: 'yes-wed-board', body: board({ approved: false, at: '2026-11-02T23:00:00Z' }), updated_by: 'Krish' },
      { doc_id: 'yes-sat-words', body: words({ day: 'sat' }), updated_by: 'engine_operator' },
      { doc_id: 'fri-publish', body: { kind: 'approve_publish', day: 'fri', approved: true, at: '2026-10-31T18:17:06Z' }, updated_by: 'Krish' },
    ]
    const yes = yesByDay(rows)
    expect(yes.wed).toMatchObject({ approved: false, via: 'board' })
    expect(yes.sat).toMatchObject({ approved: true, via: 'words', words: 'can you just approve Weds, Fri and Sat for me here' })
    expect(yes.fri).toMatchObject({ approved: true, via: 'publish_press' })
  })
  it('a board yes or a publish press that is not his own login counts for nothing', () => {
    const yes = yesByDay([
      { doc_id: 'yes-wed-board', body: board(), updated_by: 'engine_operator' },
      { doc_id: 'fri-publish', body: { kind: 'approve_publish', day: 'fri', approved: true, at: '2026-10-31T18:17:06Z' }, updated_by: 'engine_operator' },
    ])
    expect(yes).toEqual({})
  })
})
