import { describe, expect, it } from 'vitest'
import { recordNotices, type Notice, type NoticeDb } from '../../apps/control-plane/api/claims/_notice'

// The claim sweep's came_due notices (apps/control-plane/api/claims/resolve.ts): one per claim, ever. Its upsert named
// onConflict 'claim_id', which the partial unique index claim_resolutions_one_due cannot serve, so every run from at
// least 5 to 12 Nov 2026 failed and noticed nothing. This fake holds the same rule as that index.

function fakeDb(alreadyNoticed: string[] = [], failWith?: { code: string; message: string }) {
  const notices = new Set(alreadyNoticed)
  const calls: Array<{ rows: number; options: unknown }> = []
  const db: NoticeDb = {
    from: () => ({
      insert: async (rows: Notice | Notice[], options: { count: 'exact' }) => {
        const list = Array.isArray(rows) ? rows : [rows]
        calls.push({ rows: list.length, options })
        if (failWith) return { error: failWith, count: null }
        if (list.some(r => notices.has(r.claim_id))) {
          return { error: { code: '23505', message: 'duplicate key value violates unique constraint "claim_resolutions_one_due"' }, count: null }
        }
        list.forEach(r => notices.add(r.claim_id))
        return { error: null, count: list.length }
      },
    }),
  }
  return { db, notices, calls }
}

const row = (claim_id: string): Notice => ({ claim_id, event: 'came_due', due_on: '2026-11-01' })

describe('claim sweep: one came_due notice per claim', () => {
  it('writes every new notice in one insert, with no ON CONFLICT target', async () => {
    const { db, notices, calls } = fakeDb()
    expect(await recordNotices(db, [row('a'), row('b')])).toBe(2)
    expect([...notices].sort()).toEqual(['a', 'b'])
    expect(calls).toEqual([{ rows: 2, options: { count: 'exact' } }])
  })

  it('skips a claim a concurrent run noticed first and still notices the rest', async () => {
    const { db, notices } = fakeDb(['a'])
    expect(await recordNotices(db, [row('a'), row('b'), row('c')])).toBe(2)
    expect([...notices].sort()).toEqual(['a', 'b', 'c'])
  })

  it('writes nothing a second time on a re-run', async () => {
    const { db } = fakeDb(['a', 'b'])
    expect(await recordNotices(db, [row('a'), row('b')])).toBe(0)
  })

  it('does nothing with nothing due', async () => {
    const { db, calls } = fakeDb()
    expect(await recordNotices(db, [])).toBe(0)
    expect(calls).toEqual([])
  })

  it('throws any other error, so the run is recorded as failed', async () => {
    const { db } = fakeDb([], { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' })
    await expect(recordNotices(db, [row('a')])).rejects.toThrow(/ON CONFLICT/)
  })
})
