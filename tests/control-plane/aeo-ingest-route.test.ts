import { beforeEach, describe, expect, it, vi } from 'vitest'

// AEO lane (14 Nov 2026): where a research week's recommendations go. One kit routes to kits and seeds no idea; an
// empty kits list is not kits; a held venture seeds nothing (Ruling, Krish, 2026-10-29); a verify packet writes no
// digest. The database is a fake that records every write; packet validation is stood in for.
type Row = Record<string, any>
const writes: Array<{ table: string; op: string; body: unknown }> = []
let engines: { data: Row[] | null; error: { message: string } | null } = { data: [], error: null }

function builder(table: string) {
  let op = 'select'
  let body: unknown = null
  const answer = () => {
    if (op !== 'select') writes.push({ table, op, body })
    if (table === 'growth_engines') return engines
    if (table === 'growth_aeo_subjects') return { data: { id: 'S', kind: 'venture', slug: 'ctrl', name: 'CTRL', product_slug: 'ctrl', active: true }, error: null }
    if (table === 'growth_aeo_digests' && op !== 'select') return { data: { id: 'D' }, error: null }
    if (table === 'content_ideas' && op === 'insert') return { data: { id: 'I' }, error: null }
    if (table === 'growth_geo_probes' && op === 'select') return { data: null, count: 0, error: null }
    return { data: op === 'select' ? null : [], error: null }
  }
  const b: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(answer()).then(ok, bad)
      if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve(answer())
      if (['insert', 'upsert', 'update', 'delete'].includes(prop)) return (v: unknown) => { op = prop; body = v; return b }
      return () => b
    },
  })
  return b
}

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) } }))
vi.mock('../../apps/control-plane/api/_auth.js', async (orig) => ({ ...(await orig<object>()), guardBearerExport: () => false }))
vi.mock('../../apps/control-plane/api/_runs.js', () => ({ withContentRun: (_job: string, h: unknown) => h }))
vi.mock('../../apps/control-plane/api/_dedup.js', () => ({ checkDuplicate: async () => ({ is_duplicate: false, match_id: null, keys: { canonical_url: null, title_norm: 't', content_hash: 'h' } }) }))
vi.mock('../../apps/control-plane/api/_aeo.js', async (orig) => {
  const real = await orig<typeof import('../../apps/control-plane/api/_aeo.js')>()
  return { ...real, validatePacket: (body: unknown) => ({ ok: true, packet: body }) }
})

const { recommendationRoute } = await import('../../apps/control-plane/api/_aeo.js')
const handler = (await import('../../apps/control-plane/api/aeo/ingest.js')).default as (req: unknown, res: unknown) => Promise<unknown>

function packet(over: Row = {}): Row {
  return {
    schema_version: 1, run_id: 'R', command_id: null, subject: { id: 'S', kind: 'venture', slug: 'ctrl', product_slug: 'ctrl' },
    week_start: '2026-11-09', generated_at: '2026-11-14T00:00:00.000Z', engines: ['perplexity'], themes_status: 'ok', themes: [],
    calls: { considered: 0, attributed: 0 }, queries: [], strongest_signal: 's', watch_list: [], competitor_gap: null,
    playbook: null, approach_hook: null, stats: { cost_usd: 0 },
    recommendations: [{ n: 1, title: 'T', target_query: 'q', query_id: 'Q', angle: 'a', evidence: [], engines: [], demand: 1 }],
    ...over,
  }
}

async function ingest(body: Row) {
  let out: { status: number; body: Row } = { status: 0, body: {} }
  const res: any = { status: (n: number) => ({ json: (b: Row) => { out = { status: n, body: b }; return res } }), setHeader: () => res }
  await handler({ method: 'POST', body, headers: {}, query: {} }, res)
  return out
}
const ideaInserts = () => writes.filter(w => w.table === 'content_ideas' && w.op === 'insert')
const digestWrites = () => writes.filter(w => w.table === 'growth_aeo_digests')

beforeEach(() => { writes.length = 0; engines = { data: [{ product_slug: 'ctrl', role: 'venture', activation_state: 'active' }], error: null } })

describe('AEO recommendations route', () => {
  it('the route: kits only when there is one, held and unknown seed nothing', () => {
    expect(recommendationRoute([{ id: 'k' }], 'held')).toBe('kits')
    expect(recommendationRoute([], 'active')).toBe('ideas')
    expect(recommendationRoute(undefined, 'active')).toBe('ideas')
    expect(recommendationRoute([], 'held')).toBe('held')
    expect(recommendationRoute(undefined, 'unknown')).toBe('unknown')
  })

  it('one kit routes to kits and inserts no idea', async () => {
    const r = await ingest(packet({ kits: [{ query_id: 'Q', product_slug: 'ctrl' }] }))
    expect(r.status).toBe(200)
    expect(r.body.ideas_kits).toBe(1)
    expect(ideaInserts()).toHaveLength(0)
  })

  it('an empty kits list for an active venture follows the ideas path', async () => {
    const r = await ingest(packet({ kits: [] }))
    expect(r.body.ideas_inserted).toBe(1)
    expect(ideaInserts()).toHaveLength(1)
  })

  it('a held venture seeds nothing, and its digest keeps the recommendation', async () => {
    engines = { data: [{ product_slug: 'ctrl', role: 'venture', activation_state: 'held' }], error: null }
    const r = await ingest(packet({ kits: [] }))
    expect(r.body.ideas_held).toBe(1)
    expect(ideaInserts()).toHaveLength(0)
    const digest = digestWrites().find(w => w.op === 'upsert')!.body as Row
    expect(digest.recommendations).toHaveLength(1)
  })

  it('a hold that cannot be read seeds nothing', async () => {
    engines = { data: null, error: { message: 'down' } }
    const r = await ingest(packet())
    expect(r.body.ideas_held).toBe(1)
    expect(ideaInserts()).toHaveLength(0)
  })

  it('a verify packet still writes no digest and no idea', async () => {
    const r = await ingest(packet({ run_kind: 'verify', kits: [] }))
    expect(r.body.run_kind).toBe('verify')
    expect(digestWrites()).toHaveLength(0)
    expect(ideaInserts()).toHaveLength(0)
  })
})
