import { describe, expect, it } from 'vitest'
import { buildCues, cuesFrom, tableMissing } from '../../apps/control-plane/api/_feedbackCues'

// Krish, 2026-10-26: "all the feedback I've given you goes into a really clear set of cues that you can draw from in
// the future". Synthetic words only; nothing here is anything he said.

const cue = (id: string, use: string, extra: Record<string, any> = {}) => ({
  id, source: 'idea_queue', source_ref: `idea-${id}:${use}`, subject_ref: `idea-${id}`, subject: `Idea ${id}`,
  said: `words ${id}`, said_at: '2026-10-20T10:00:00Z', use, theme: null, use_origin: 'krish', status: 'open', ...extra,
})

describe('the feedback cues block', () => {
  it('groups open cues the way Sunday uses them, oldest first', () => {
    const out = buildCues([
      cue('b', 'future_piece', { said_at: '2026-10-22T10:00:00Z' }),
      cue('a', 'future_piece', { said_at: '2026-10-19T10:00:00Z' }),
      cue('t', 'track_over_time'),
      cue('r', 'brief', { use_origin: 'rule' }),
      cue('n', 'not_for_us'),
      cue('u', 'future_piece', { status: 'used' }),
      cue('x', 'future_piece', { status: 'retired' }),
    ])
    expect(out.future_pieces.map(c => c.id)).toEqual(['a', 'b'])
    expect(out.tracked.map(c => c.id)).toEqual(['t'])
    expect(out.briefs[0]).toMatchObject({ id: 'r', said: 'words r', subject_ref: 'idea-r', use_origin: 'rule' })
    expect(out.not_for_us.map(c => c.id)).toEqual(['n'])
    expect(out.counts).toEqual({ future_pieces: 2, wider_pieces: 0, wider_themes: 0, tracked: 1, briefs: 1, not_for_us: 1 })
  })

  it('gathers the context for each bigger piece by its theme, named themes first, whatever the case he wrote it in', () => {
    const out = buildCues([
      cue('1', 'wider_piece_context', { theme: 'Chip supply' }),
      cue('2', 'wider_piece_context', { theme: null }),
      cue('3', 'wider_piece_context', { theme: 'chip supply' }),
      cue('4', 'wider_piece_context', { theme: 'robot pricing' }),
    ])
    expect(out.wider_pieces.map(w => [w.theme, w.context.map(c => c.id)])).toEqual([
      ['Chip supply', ['1', '3']], ['robot pricing', ['4']], [null, ['2']],
    ])
    expect(out.counts).toMatchObject({ wider_pieces: 4, wider_themes: 2 })
  })

  it('keeps his words whole and never shows a cue with no words', () => {
    const long = 'a '.repeat(600).trim()
    const out = buildCues([cue('l', 'brief', { said: long }), cue('e', 'brief', { said: '   ' })])
    expect(out.briefs.map(c => c.said)).toEqual([long])
  })
})

describe('reading the table', () => {
  it('says the table is not there yet and carries on, never failing the Sunday run', () => {
    const missing = cuesFrom({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.feedback_cues' in the schema cache" } })
    expect(missing.empty).toMatchObject({ source: 'cues' })
    expect(missing.empty!.why).toMatch(/20261111090000_feedback_cues/)
    expect(missing.cues.counts.future_pieces).toBe(0)
    expect(tableMissing({ message: 'relation "public.feedback_cues" does not exist' })).toBe(true)
  })

  it('says a failed read in empty too, with the error, and still carries on', () => {
    const failed = cuesFrom({ data: null, error: { message: 'timeout' } })
    expect(failed.empty!.why).toMatch(/could not be read \(timeout\)/)
  })

  it('says so when there is nothing open, and says nothing when there is', () => {
    expect(cuesFrom({ data: [], error: null }).empty!.why).toMatch(/no open feedback cues/)
    expect(cuesFrom({ data: [cue('a', 'future_piece')], error: null }).empty).toBeNull()
  })
})
