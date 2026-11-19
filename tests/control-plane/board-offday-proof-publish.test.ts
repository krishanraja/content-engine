import { describe, expect, it } from 'vitest'
import { gatePatch } from '../../apps/control-plane/api/board/_presses.js'
import { OFFDAY_PUBLISH_ID, PROOF_ID, validBody } from '../../apps/control-plane/api/board/_contracts.js'

// Tue 17 Nov's habits voiceover (Krish, 2026-11-18): its produce session filed the proof and the board had no press for
// it, because <day>-proof was a Monday, Wednesday and Friday name; and an off-day piece he records had no Approve for
// publish once its final files were filed. Both presses are his, on any day he publishes, through the same gates.
const PIECE = '701a2c55-7400-4dc8-99cb-d6001147ae16'
const SHA = 'cf0c06a280637499fd904cf739d9433e4b9d870a688cf440a5f61cab4ff09d9d'
const proof = (o: Record<string, unknown> = {}) => ({ day: 'tue', kind: 'approve_proof', piece_id: PIECE, sha256: SHA, verdict: 'approve', at: '2026-11-18T18:00:00Z', ...o })

describe('the proof press on any piece, any day', () => {
  it('takes his Approve proof or Reject on the piece own document', () => {
    expect(PROOF_ID.test('tue-proof-701a2c55')).toBe(true)
    expect(validBody('picks', 'tue-proof-701a2c55', proof())).toBe(true)
    expect(validBody('picks', 'mon-proof-701a2c55', proof({ day: 'mon' }))).toBe(true)
    expect(validBody('picks', 'tue-proof-701a2c55', proof({ verdict: 'reject', words: 'The VOID stamp lands late' }))).toBe(true)
  })
  it('refuses a reject with no words, another piece, another day, a bad hash or a send', () => {
    expect(validBody('picks', 'tue-proof-701a2c55', proof({ verdict: 'reject' }))).toBe(false)
    expect(validBody('picks', 'tue-proof-b019dbf8', proof())).toBe(false)
    expect(validBody('picks', 'tue-proof-701a2c55', proof({ day: 'thu' }))).toBe(false)
    expect(validBody('picks', 'tue-proof-701a2c55', proof({ sha256: 'abc' }))).toBe(false)
    expect(validBody('picks', 'tue-proof-701a2c55', proof({ send: {} }))).toBe(false)
    expect(validBody('picks', 'sun-proof-701a2c55', proof({ day: 'sun' }))).toBe(false)
  })
  it('writes gates.proof bound to the file, as the series press does', () => {
    expect(gatePatch('approve_proof', proof({ verdict: 'reject', words: ' too fast ' }), '2026-11-18T18:00:00Z'))
      .toEqual({ proof: { by: 'Krish', at: '2026-11-18T18:00:00Z', sha256: SHA, verdict: 'reject', words: 'too fast' } })
  })
})

describe('Approve for publish on an off-day piece he records', () => {
  const pub = (o: Record<string, unknown> = {}) => ({ kind: 'approve_publish', day: 'tue', piece_id: PIECE, approved: true, manifest_sha256: SHA, at: '2026-11-18T18:00:00Z', ...o })
  it('takes picks/<tue|thu|sat>-publish with the series body', () => {
    expect(OFFDAY_PUBLISH_ID.test('tue-publish')).toBe(true)
    expect(validBody('picks', 'tue-publish', pub())).toBe(true)
    expect(validBody('picks', 'sat-publish', pub({ day: 'sat' }))).toBe(true)
  })
  it('refuses another day, another kind, or a press with no piece', () => {
    expect(validBody('picks', 'tue-publish', pub({ day: 'wed' }))).toBe(false)
    expect(validBody('picks', 'tue-publish', pub({ kind: 'approve_scripts' }))).toBe(false)
    expect(validBody('picks', 'tue-publish', pub({ piece_id: 'x' }))).toBe(false)
    expect(validBody('picks', 'sun-publish', pub({ day: 'sun' }))).toBe(false)
    // Only publish opens on an off day: its other decisions stay where they were.
    expect(validBody('picks', 'tue-storyboard', { day: 'tue', kind: 'sign_storyboard', piece_id: PIECE, sha256: SHA, approved: true })).toBe(false)
  })
})

describe('a piece still being made is never Missed (contract 1.32.0)', () => {
  const work = (materials: unknown[], sessions: unknown[] = []) => ({ work: { [PIECE]: { sessions, materials } } as never, pieces: [{ id: PIECE, meta: {} }] as never })
  const file = { title: 'Proof v9: the caption line at 61.8 s fits the frame', role: 'proof', kind: 'video', version: 9, at: '2026-11-19T10:00:00Z', sha256: SHA }
  it('holds while the newest proof has no answer from him, and lets go once he answers that exact file', async () => {
    const { stillBeingMade } = await import('../../apps/control-plane/api/board/_weekModel.js')
    expect(stillBeingMade(work([file]), [PIECE], [PIECE])?.why).toBe('proof')
    const answered = { ...work([file]), pieces: [{ id: PIECE, meta: { making: { gates: { proof: { by: 'Krish', at: 'x', sha256: SHA, verdict: 'approve' } } } } }] as never }
    expect(stillBeingMade(answered, [PIECE], [PIECE])).toBeNull()
  })
  it('holds for a session working on it and for final files waiting on Approve for publish, never for nothing', async () => {
    const { stillBeingMade } = await import('../../apps/control-plane/api/board/_weekModel.js')
    expect(stillBeingMade(work([], [{ by: 'claude', state: 'working', step: 'produce', doing: 'cutting', last_at: 'x' }]), [PIECE], [PIECE])?.why).toBe('session')
    expect(stillBeingMade(work([]), [PIECE], [PIECE], true)?.why).toBe('final')
    expect(stillBeingMade(work([]), [PIECE], [PIECE])).toBeNull()
  })
})
