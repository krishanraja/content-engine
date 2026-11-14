import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { patchMeta, type StoreDb } from '../../apps/control-plane/api/_pieceStore'

// deepen, dive-deeper and the investigation spend seconds on a model between reading a piece and writing it. They now
// write onto the piece as it is at the write (patchMeta), guarded on its updated_at like the materials route
// (krishanraja/content-engine#542), so a making record or a board press that landed meanwhile is kept.

type Row = { id: string; meta: Record<string, unknown>; updated_at: string }
function fakeDb(row: Row, onRead?: (n: number) => void) {
  let reads = 0, stamp = 0
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => { const data = JSON.parse(JSON.stringify(row)); onRead?.(++reads); return { data, error: null } } }) }),
      update: (patch: { meta: Record<string, unknown> }) => ({
        eq: () => ({ eq: (_k: string, at: string) => ({ select: async () => {
          if (at !== row.updated_at) return { data: [], error: null }
          row.meta = patch.meta; row.updated_at = `t${++stamp}`
          return { data: [{ id: row.id }], error: null }
        } }) }),
      }),
    }),
  }
  return db as unknown as StoreDb
}

describe('a long-running route writes onto the piece as it is now', () => {
  it('keeps a write that landed between its read and its write, and adds its own', async () => {
    const row: Row = { id: 'p', meta: { deep_dives: [] }, updated_at: 't0' }
    // A making record lands right after the route's first read.
    const db = fakeDb(row, n => { if (n === 1) { row.meta = { ...row.meta, making: { scripts: 'done' } }; row.updated_at = 't-other' } })
    const r = await patchMeta(db, 'p', m => ({ ...m, deep_dives: [...(m.deep_dives as unknown[]), { query: 'q' }] }))
    expect(r.ok).toBe(true)
    expect(row.meta).toEqual({ deep_dives: [{ query: 'q' }], making: { scripts: 'done' } })
  })

  it('says busy rather than overwrite when the piece never holds still', async () => {
    const row: Row = { id: 'p', meta: {}, updated_at: 't0' }
    const db = fakeDb(row, n => { row.updated_at = `moving-${n}` })
    expect(await patchMeta(db, 'p', m => ({ ...m, x: 1 }), 3)).toEqual({ ok: false, reason: 'busy' })
    expect(row.meta).toEqual({})
  })

  it('is what deepen, dive-deeper and the investigation write with', () => {
    for (const f of ['apps/control-plane/api/content-ideas/[id]/deepen.ts', 'apps/control-plane/api/content-ideas/[id]/dive-deeper.ts', 'apps/control-plane/api/_investigation.ts']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toMatch(/patchMeta\(/)
      expect(src, f).not.toMatch(/\.update\(\{\s*meta: \{ \.\.\.meta/)
    }
  })
})
