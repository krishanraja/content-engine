import { describe, expect, it } from 'vitest'
import { placeOffday } from '../../apps/control-plane/api/board/_presses'

// Tue 17 Nov's habits voiceover (701a2c55) was placed on 13 Nov as an off-day piece he records with an id the engine
// never held: his Approve was refused ("the idea is not in the engine"), every session on it got piece_not_found, and its
// card showed none of their work. His Approve now makes the record under the id the option names, then puts it on its
// day under the ideas gate, as for any other piece.

const ID = '701a2c55-7400-4dc8-99cb-d6001147ae16'
type Row = Record<string, any>

function fakeDb(start: Row | null) {
  let row = start
  const inserted: Row[] = []
  const updated: Row[] = []
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row ? { ...row } : null, error: null }) }) }),
      insert: (r: Row) => ({ select: async () => { inserted.push(r); row = { ...r, scheduled_for: null, lane_slot: null, meta: {}, buried_at: null, updated_at: 't0' }; return { data: [{ id: r.id }], error: null } } }),
      update: (u: Row) => ({ eq: () => ({ eq: () => ({ select: async () => { updated.push(u); row = { ...row, ...u }; return { data: [{ id: ID }], error: null } } }) }) }),
    }),
  }
  return { db: db as never, inserted, updated }
}

const body = { piece_id: ID, day: 'tue', approved: true, title: 'Which of your habits will cost you your job once AI is at work?', folder_title: 'Tue 17 Nov off-day',
  so_what: 'AI cannot be blamed or sacked.', series: 'mind_the_gap', style: 'to_camera', script: 'The words.', script_sha256: 'a'.repeat(64) }

describe('an off-day piece he records with no record yet', () => {
  it('his Approve makes the record under the id the option names, then puts it on its day', async () => {
    const f = fakeDb(null)
    const got = await placeOffday(f.db, { week: '2026-11-16', id: `off-tue-${ID}`, body, who: 'Krish', now: '2026-11-17T12:00:00Z' })
    expect(got.ok).toBe(true)
    expect(f.inserted).toHaveLength(1)
    expect(f.inserted[0]).toMatchObject({ id: ID, idea: body.title, state: 'seeded', source_type: 'week_research' })
    expect(f.updated[0]).toMatchObject({ scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap', state: 'drafting' })
    expect(f.updated[0].meta.offday).toMatchObject({ doc: `queue/off-tue-${ID}`, approved_by: 'Krish' })
  })
  it('a Skip makes nothing', async () => {
    const f = fakeDb(null)
    const got = await placeOffday(f.db, { week: '2026-11-16', id: `off-tue-${ID}`, body: { ...body, approved: false }, who: 'Krish', now: '2026-11-17T12:00:00Z' })
    expect(got).toEqual({ ok: true, making: null, changed: false })
    expect(f.inserted).toHaveLength(0)
    expect(f.updated).toHaveLength(0)
  })
})
