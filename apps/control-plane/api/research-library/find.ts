import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'

// GET /api/research-library/find?q=<words>[&limit=1..50], on the engine key (or Krish's cookie).
//
// Research found before it is paid for (I-16, 14 Nov 2026). Every piece's research is already in the piece materials
// store and mirrored to makeyourmindup > 6 Research library (docs/DRIVE.md, "The research library"); Krish,
// 2026-11-11: "one of the most important prospects that we have over time is connecting the dots on historical data".
// Before a session pays for a web search, an Apify run or a research call, it asks here what an earlier piece already
// found. The database function research_find (migration 20261202090000_research_find.sql) does the search: the newest
// version of each research, corpus, note or paste text, never an archived one, ranked by English full text, with a short
// snippet. Read only: it writes nothing, spends nothing and moves no bytes. The full text is read from the store by its
// material id (GET /api/content-ideas/[id]/materials).
//
// q takes the web-search forms: plain words, "a phrase", or, -not.

export const FIND_LIMIT_DEFAULT = 10
export const FIND_LIMIT_MAX = 50
const QUERY_MAX = 300

export interface FindHit {
  material_id: string
  scope: string
  piece_id: string | null
  piece_title: string | null
  week: string | null
  day: string | null
  kind: string
  role: string | null
  title: string
  version: number
  sha256: string
  bytes: number
  added_at: string
  rank: number
  snippet: string
}

type Db = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }> }

/** The query and limit, or null when either is unusable. */
export function parseFindQuery(query: unknown): { q: string; limit: number } | null {
  const raw = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)
  const q = first(raw.q)
  if (typeof q !== 'string') return null
  const text = q.replace(/[\u0000-\u001f]+/g, ' ').trim()
  if (text.length < 2 || text.length > QUERY_MAX) return null
  const rawLimit = first(raw.limit)
  if (rawLimit === undefined) return { q: text, limit: FIND_LIMIT_DEFAULT }
  if (typeof rawLimit !== 'string' || !/^[0-9]{1,2}$/.test(rawLimit)) return null
  const limit = Number(rawLimit)
  if (limit < 1 || limit > FIND_LIMIT_MAX) return null
  return { q: text, limit }
}

export function createFindHandler(getDb: () => Promise<Db>) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (guardEngine(req, res, ['GET'])) return
    res.setHeader('Cache-Control', 'no-store')
    const parsed = parseFindQuery(req.query)
    if (!parsed) return res.status(400).json({ ok: false, error: 'invalid_query' })
    const db = await getDb()
    const { data, error } = await db.rpc('research_find', { p_query: parsed.q, p_limit: parsed.limit })
    if (error || !Array.isArray(data)) return res.status(503).json({ ok: false, error: 'research_index_unavailable' })
    const hits = (data as FindHit[]).map((h) => ({ ...h, rank: Number(h.rank), bytes: Number(h.bytes) }))
    return res.status(200).json({ ok: true, q: parsed.q, count: hits.length, hits })
  }
}

export default createFindHandler(async () => (await import('../_supabase.js')).supabase as unknown as Db)
