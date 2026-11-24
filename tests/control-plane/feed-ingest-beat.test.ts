import { beforeEach, describe, expect, it, vi } from 'vitest'

// feed/ingest and the beat (Ruling, Krish, 2026-11-24: the engine brings stories
// in his focus sectors and not governance, regulation, security or data
// breaches). The CTRL pool files every story in one of nine lanes, two of them
// governance and security; a story in either lane with no focus-sector angle in
// its headline is dropped as off_beat, and lands in trend_observations with that
// reason like every other drop. A copyright or licensing story in a creative
// sector, which the pool files under governance, stays on the beat. The database, the pool and the archive are fakes that
// record what they are handed. Every headline is invented.

type Row = Record<string, any>
const inserted: Row[] = []
const observed: Row[] = []
let pool: Row[] = []

function builder(table: string) {
  let op = 'select'
  let body: unknown = null
  const answer = () => {
    if (table === 'content_ideas' && op === 'insert') {
      inserted.push(...(body as Row[]))
      return { data: null, count: (body as Row[]).length, error: null }
    }
    return { data: [], error: null }
  }
  const b: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(answer()).then(ok, bad)
      if (prop === 'insert') return (v: unknown) => { op = 'insert'; body = v; return b }
      return () => b
    },
  })
  return b
}

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: { from: (t: string) => builder(t) } }))
vi.mock('../../apps/control-plane/api/_auth.js', () => ({ guardCronRoute: () => false }))
vi.mock('../../apps/control-plane/api/_runs.js', () => ({ withContentRun: (_job: string, h: unknown) => h }))
vi.mock('../../apps/control-plane/api/_pool.js', () => ({
  poolConfigured: () => true,
  fetchPoolDays: async () => ({ days: 1, stories: pool }),
}))
vi.mock('../../apps/control-plane/api/_observations.js', () => ({
  recordObservations: async (rows: Row[]) => { observed.push(...rows); return { ok: true, attempted: rows.length, written: rows.length } },
}))

const handler = (await import('../../apps/control-plane/api/feed/ingest.js')).default as (req: unknown, res: unknown) => Promise<unknown>

function story(headline: string, category: string | null, n: number): Row {
  return {
    day: '2026-11-24', headline, say: null, truncated: false, source: 'example.com',
    url: `https://example.com/${n}`, sourceUrls: [], category, sourceCount: 2,
  }
}

async function run() {
  let out: { status: number; body: Row } = { status: 200, body: {} }
  const res: any = {
    setHeader: () => res,
    status: (n: number) => ({ json: (b: Row) => { out = { status: n, body: b }; return res } }),
    json: (b: Row) => { out = { status: 200, body: b }; return res },
  }
  await handler({ method: 'POST', headers: {}, query: {} }, res)
  return out
}

beforeEach(() => {
  inserted.length = 0
  observed.length = 0
  delete process.env.ANTHROPIC_API_KEY
})

describe('feed/ingest drops the pool lanes that are off the beat', () => {
  it('drops a governance or security story with no focus-sector angle as off_beat', async () => {
    pool = [
      // Headlines with no avoid word and no event word: the headline gate would
      // keep them, so the lane alone drops them.
      story('New AI oversight board formed', 'governance', 1),
      story('Banks weigh AI fraud costs per customer', 'security', 2),
      story('Artist releases AI album', 'product', 3),
      story('Label partners with Suno', 'economics', 4),
    ]
    const r = await run()
    expect(r.status).toBe(200)
    expect(r.body.off_beat).toBe(2)
    expect(inserted.map(x => x.idea)).toEqual(['Artist releases AI album', 'Label partners with Suno'])
    const dropped = observed.filter(o => !o.surfaced)
    expect(dropped.map(o => [o.category, o.dropReason])).toEqual([['governance', 'off_beat'], ['security', 'off_beat']])
  })

  it('keeps a focus-sector story the pool filed under governance or security', async () => {
    pool = [
      // Licensing is the money of creative work: the pool files it under
      // governance, and the beat keeps it.
      story('Record labels price AI licences per song', 'governance', 1),
      story('Studio royalties rise as AI dubbing spreads', 'security', 2),
      // A focus word does not rescue an avoid-list headline: the gate still reads it.
      story('Music streaming data breach exposes 2m users', 'security', 3),
    ]
    const r = await run()
    expect(r.body.off_beat).toBe(1)
    expect(inserted.map(x => x.idea)).toEqual(['Record labels price AI licences per song', 'Studio royalties rise as AI dubbing spreads'])
  })

  it('still reads the headline in every other lane', async () => {
    pool = [
      story('EU AI Act vote', 'model', 5),
      story('Data breach at AI firm', null, 6),
      story('Enterprise rolls out Copilot to staff', 'org', 7),
    ]
    const r = await run()
    expect(r.body.off_beat).toBe(3)
    expect(inserted).toHaveLength(0)
    expect(observed.every(o => o.dropReason === 'off_beat')).toBe(true)
  })
})
