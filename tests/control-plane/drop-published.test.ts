import { beforeEach, describe, expect, it, vi } from 'vitest'

// A Purge from Krish's list drops a piece (PATCH state 'dropped'). The
// publish watcher marks a piece published from the live post, a public fact.
// Found in step 2's review: the drop read nothing and guarded nothing, so a
// drop landing as the watcher marked the piece published undid the publish.
// Now a published piece is never dropped (409 published_cannot_be_dropped),
// and a drop that races any other write is refused, not written over it.

type Row = Record<string, any>
const db = vi.hoisted(() => ({
  rows: [] as Row[],
  updates: [] as Row[],
  /** Runs between the drop's read and its write: another writer landing first. */
  between: null as null | (() => void),
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  function query() {
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'update' = 'select'
    let patch: Row = {}
    const run = () => {
      if (op === 'select') {
        const hit = db.rows.filter(r => filters.every(f => f(r))).map(r => ({ ...r }))
        if (db.between) { const go = db.between; db.between = null; go() }
        return hit
      }
      const hit = db.rows.filter(r => filters.every(f => f(r)))
      hit.forEach(r => Object.assign(r, patch, { updated_at: `touched-${db.updates.length + 1}` }))
      if (hit.length) db.updates.push({ ...patch })
      return hit.map(r => ({ ...r }))
    }
    const chain: Record<string, any> = {
      select() { return chain },
      update(p: Row) { op = 'update'; patch = p; return chain },
      eq(k: string, v: unknown) { filters.push(r => r[k] === v); return chain },
      async maybeSingle() { return { data: run()[0] ?? null, error: null } },
      async single() {
        const out = run()
        return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } }
      },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) { try { return Promise.resolve({ data: run(), error: null }).then(resolve, reject) } catch (e) { return reject(e) } },
    }
    return chain
  }
  return { supabase: { from: () => query() } }
})

const TOKEN = 'eot_' + 'd'.repeat(40)
const PIECE = '5b1f2c4e-0d7a-4c3b-9e8f-1a2b3c4d5e6f'

async function drop(extra: Row = {}) {
  const { default: handler } = await import('../../apps/control-plane/api/content-ideas.js')
  const out = { status: 0, body: undefined as any }
  const res: Record<string, any> = {
    setHeader() { return res },
    status(code: number) { out.status = code; return res },
    json(b: unknown) { out.body = b; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  await handler({ method: 'PATCH', headers: { authorization: `Bearer ${TOKEN}` }, query: {}, body: { id: PIECE, state: 'dropped', decided_by: 'Krish', ...extra } } as never, res as never)
  return out
}

beforeEach(() => {
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  db.rows = [{ id: PIECE, state: 'drafting', updated_at: 'seen-1', published_at: null, published_url: null }]
  db.updates = []
  db.between = null
})

describe('a drop never undoes a publish', () => {
  it('a published piece is refused with a named 409, and nothing is written', async () => {
    db.rows[0].state = 'published'
    const out = await drop()
    expect(out.status).toBe(409)
    expect(out.body).toMatchObject({ ok: false, error: 'published_cannot_be_dropped' })
    expect(db.updates).toEqual([])
    expect(db.rows[0].state).toBe('published')
  })

  it('the watcher marking it published between the drop\'s read and its write wins: the drop is refused, the publish stays', async () => {
    db.between = () => Object.assign(db.rows[0], { state: 'published', published_url: 'https://example.substack.com/p/a-post', updated_at: 'watcher-wrote' })
    const out = await drop()
    expect(out.status).toBe(409)
    expect(out.body).toMatchObject({ ok: false, error: 'content_changed_retry' })
    expect(db.updates).toEqual([])
    expect(db.rows[0]).toMatchObject({ state: 'published', published_url: 'https://example.substack.com/p/a-post' })
    // Sent again, the drop now sees the publish and says why it cannot.
    const again = await drop()
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('published_cannot_be_dropped')
  })

  it('a piece that is not published is dropped, guarded on the time it was read', async () => {
    const out = await drop()
    expect(out.status).toBe(200)
    expect(db.rows[0].state).toBe('dropped')
    expect(db.updates).toEqual([{ state: 'dropped' }])
  })

  it('a piece that does not exist is 404, and the drop still needs Krish\'s word', async () => {
    db.rows = []
    expect((await drop()).status).toBe(404)
    expect((await drop({ decided_by: undefined })).status).toBe(403)
  })
})
