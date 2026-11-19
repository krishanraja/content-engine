import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { RECEIPT_ROLE, ShowGateError, checkProofShown, gateApplies, receiptCovers } from '../../apps/control-plane/api/board/_showGate'

// The board's Approve proof refuses a proof with no show receipt for its exact clip (Krish, 2026-11-19: "Krish was the
// quality check. Cuts reached him before anyone had watched them."). The receipt is ve's (scripts/velib/showgate.py).
const SHA = 'a'.repeat(64)
const PIECE = '701a2c55-7400-4dc8-99cb-d6001147ae16'
const receipt = (over: Record<string, unknown> = {}) => JSON.stringify({ schema: 've-show-receipt/1', cut_sha256: SHA, ok: true, missing: [], ...over })
const press = (over: Record<string, unknown> = {}) => ({ kind: 'approve_proof', verdict: 'approve', piece_id: PIECE, sha256: SHA, ...over })
const WEEK = '2026-11-23'

/** A db whose piece_materials holds the given receipt texts, as the supabase client's chain answers. */
function db(texts: string[], fail = false): SupabaseClient {
  const answer = (data: unknown) => ({ data, error: fail ? { message: 'down' } : null })
  const chain = (data: unknown) => { const c: any = { select: () => c, eq: () => c, is: () => c, in: () => c, then: (r: any) => r(answer(data)) }; return c }
  return { from: (t: string) => chain(t === 'piece_materials' ? texts.map((_, i) => ({ text_sha256: String(i).repeat(64).slice(0, 64).replace(/[^a-f0-9]/g, 'b'), role: RECEIPT_ROLE })) : texts.map(content => ({ content }))) } as unknown as SupabaseClient
}

describe('the show gate on the board', () => {
  it('a receipt covers only its own clip, ok, with nothing missing', () => {
    expect(receiptCovers(receipt(), SHA)).toBe(true)
    expect(receiptCovers(receipt(), 'b'.repeat(64))).toBe(false)
    expect(receiptCovers(receipt({ ok: false }), SHA)).toBe(false)
    expect(receiptCovers(receipt({ missing: ['no recorded watch'] }), SHA)).toBe(false)
    expect(receiptCovers(receipt({ schema: 'other' }), SHA)).toBe(false)
    expect(receiptCovers('not json', SHA)).toBe(false)
  })

  it('applies to an approve of a proof in an enforced week; never to a reject, another kind or an earlier week', () => {
    expect(gateApplies(press(), WEEK)).toBe(true)
    expect(gateApplies(press({ verdict: 'reject' }), WEEK)).toBe(false)
    expect(gateApplies(press({ kind: 'approve_cut' }), WEEK)).toBe(false)
    expect(gateApplies(press(), '2026-11-09')).toBe(false)
    expect(gateApplies(press(), WEEK, { mode: 'off', enforce_from_week: '2026-11-16' })).toBe(false)
  })

  it('refuses an approve with no receipt for that clip (409 proof_not_shown)', async () => {
    await expect(checkProofShown(db([]), press(), WEEK)).rejects.toMatchObject({ status: 409, message: 'proof_not_shown' })
    await expect(checkProofShown(db([receipt({ cut_sha256: 'c'.repeat(64) })]), press(), WEEK)).rejects.toBeInstanceOf(ShowGateError)
    await expect(checkProofShown(db([receipt({ ok: false, missing: ['x'] })]), press(), WEEK)).rejects.toMatchObject({ status: 409 })
  })

  it('lets an approve through when a receipt for that exact clip is on the piece', async () => {
    await expect(checkProofShown(db([receipt({ cut_sha256: 'c'.repeat(64) }), receipt()]), press(), WEEK)).resolves.toBeUndefined()
  })

  it('never refuses his Reject, and does nothing for an earlier week', async () => {
    await expect(checkProofShown(db([]), press({ verdict: 'reject' }), WEEK)).resolves.toBeUndefined()
    await expect(checkProofShown(db([]), press(), '2026-11-09')).resolves.toBeUndefined()
  })

  it('an unreadable store is a 503, never a pass', async () => {
    await expect(checkProofShown(db([], true), press(), WEEK)).rejects.toMatchObject({ status: 503 })
  })
})
