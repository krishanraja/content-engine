import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
const { instructionOf, readInstructions, readTasteRules } = await import('../../apps/control-plane/api/week/options')

// What the Sunday ideas run reads beside the pool (GET /api/week/options?include=sources): his ticked cards
// (`instructions`; Ruling, Krish, 2026-11-12: a ticked inspiration card is an instruction that jumps the queue) and the
// taste rules he approved (`taste_rules`, form only). Ruling (Krish, 2026-11-12): Sunday's ideas board is to be epic,
// and nothing on it stale: a tick whose own run never made its idea is owed a place, like a routed card.

const TICK = '0d7f9c1e-2b3a-4c5d-8e9f-0a1b2c3d4e5f', CARD = '11111111-2222-4333-8444-555555555555'
function db(table: string, data: unknown[] | null, error: { message: string } | null = null) {
  const self: any = { select: () => self, in: () => self, eq: () => self, order: () => self, limit: async () => ({ data, error }) }
  return { from: (t: string) => { expect(t).toBe(table); return self } }
}

describe('his ticked cards, for the Sunday run', () => {
  it('reads each with its kind, his words, when it is due, the card and what its run did', async () => {
    const r = await readInstructions(db('inspiration_actions', [{ id: TICK, item_id: CARD, kind: 'make_piece', words: '  make  this  now ', due_at: null, state: 'open', piece_id: null, job_state: 'failed', job_error: 'no research', created_at: '2026-11-12T10:00:00Z' }]) as never)
    expect(r).toEqual({ empty: null, list: [{ id: TICK, kind: 'make_piece', card: CARD, words: 'make this now', due_at: null, state: 'open', idea: null, job: 'failed', job_error: 'no research', at: '2026-11-12T10:00:00Z' }] })
  })
  it('says when they cannot be read, and never fails the gather', async () => {
    expect(await readInstructions(db('inspiration_actions', null, { message: 'relation does not exist' }) as never)).toEqual({ list: [], empty: 'instructions: his ticked cards could not be read (relation does not exist)' })
    expect(instructionOf({ id: 'not-a-uuid' })).toBeNull()
  })
  it('reads his approved taste rules, Make Your Mind Up\'s only, form only', async () => {
    const r = await readTasteRules(db('taste_profile_form', [{ statement: 'Titles say what happens.', means: 'Name the event.', layer: 'packaging', lane: 'voice' }, { statement: ' ' }]) as never)
    expect(r).toEqual({ empty: null, list: [{ statement: 'Titles say what happens.', means: 'Name the event.', layer: 'packaging', lane: 'voice' }] })
    expect(readFileSync('apps/control-plane/api/week/options.ts', 'utf8')).toMatch(/from\('taste_profile_form'\)[\s\S]{0,120}\.eq\('venture', TASTE_VENTURE\)/)
  })
  it('owes an open Content tick its own run has not drafted a place on the board, like a routed card', () => {
    const src = readFileSync('apps/control-plane/api/week/options.ts', 'utf8')
    expect(src).toMatch(/t\.kind !== 'make_piece' \|\| t\.state !== 'open'/)
    expect(src).toMatch(/inspiration\.must_cover\.push/)
  })
})
