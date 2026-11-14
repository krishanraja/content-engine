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
//
// Filters (OPEN-ITEMS D3; Ruling, Krish, 2026-11-14), each optional: since=<YYYY-MM-DD> (added on or after),
// kinds=research,corpus,note,paste (any of), fresh=1 (added in the last 90 days) or fresh=0 (older), venture=<slug>
// (another venture's own shelf, I-30; absent or publication is Make Your Mind Up's). The answer says what it searched
// and shelf_size, how many research items that shelf holds, so an empty shelf reads differently from no match.

export const FIND_KINDS = ['research', 'corpus', 'note', 'paste'] as const
export const FRESH_DAYS = 90
const VENTURE = /^[a-z][a-z0-9_]{1,40}$/

const freshOf = (at: unknown) => typeof at === 'string' && Date.now() - Date.parse(at) <= FRESH_DAYS * 86_400_000

export interface FindQuery { q: string; limit: number; since: string | null; kinds: string[] | null; fresh: boolean | null; venture: string | null }

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
  venture: string | null
  fresh: boolean
}

type Db = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }> }

/** The query, limit and filters, or null when any is unusable. */
export function parseFindQuery(query: unknown): FindQuery | null {
  const raw = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)
  const q = first(raw.q)
  if (typeof q !== 'string') return null
  const text = q.replace(/[\u0000-\u001f]+/g, ' ').trim()
  if (text.length < 2 || text.length > QUERY_MAX) return null
  let limit = FIND_LIMIT_DEFAULT
  const rawLimit = first(raw.limit)
  if (rawLimit !== undefined) {
    if (typeof rawLimit !== 'string' || !/^[0-9]{1,2}$/.test(rawLimit)) return null
    limit = Number(rawLimit)
    if (limit < 1 || limit > FIND_LIMIT_MAX) return null
  }
  let since: string | null = null
  const rawSince = first(raw.since)
  if (rawSince !== undefined && rawSince !== '') {
    if (typeof rawSince !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rawSince)) return null
    const d = new Date(`${rawSince}T00:00:00Z`)
    if (isNaN(+d) || d.toISOString().slice(0, 10) !== rawSince) return null
    since = rawSince
  }
  let kinds: string[] | null = null
  const rawKinds = first(raw.kinds)
  if (rawKinds !== undefined && rawKinds !== '') {
    if (typeof rawKinds !== 'string') return null
    const list = [...new Set(rawKinds.split(',').map(k => k.trim().toLowerCase()).filter(Boolean))]
    if (!list.length || list.some(k => !(FIND_KINDS as readonly string[]).includes(k))) return null
    kinds = list
  }
  let fresh: boolean | null = null
  const rawFresh = first(raw.fresh)
  if (rawFresh !== undefined && rawFresh !== '') {
    if (rawFresh === '1' || rawFresh === 'true') fresh = true
    else if (rawFresh === '0' || rawFresh === 'false') fresh = false
    else return null
  }
  let venture: string | null = null
  const rawVenture = first(raw.venture)
  if (rawVenture !== undefined && rawVenture !== '') {
    if (typeof rawVenture !== 'string' || !VENTURE.test(rawVenture.trim().toLowerCase())) return null
    venture = rawVenture.trim().toLowerCase()
    if (venture === 'publication') venture = null
  }
  return { q: text, limit, since, kinds, fresh, venture }
}

export function createFindHandler(getDb: () => Promise<Db>) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (guardEngine(req, res, ['GET'])) return
    res.setHeader('Cache-Control', 'no-store')
    const parsed = parseFindQuery(req.query)
    if (!parsed) return res.status(400).json({ ok: false, error: 'invalid_query' })
    const db = await getDb()
    const { q, limit, since, kinds, fresh, venture } = parsed
    const [found, size] = await Promise.all([
      db.rpc('research_find', { p_query: q, p_limit: limit, p_since: since, p_kinds: kinds, p_fresh: fresh, p_venture: venture }),
      db.rpc('research_shelf_size', { p_venture: venture }),
    ])
    const unfiltered = !since && !kinds && fresh === null && !venture
    const rows = found.data
    // Before migration 20261203100000 is applied the six-argument search does not exist: an unfiltered search falls
    // back to the first one (Make Your Mind Up, no filters), with the shelf size unknown, never guessed.
    if ((found.error || !Array.isArray(rows)) && unfiltered) {
      const old = await db.rpc('research_find', { p_query: q, p_limit: limit })
      if (!old.error && Array.isArray(old.data)) {
        const hits = (old.data as FindHit[]).map((h) => ({ ...h, rank: Number(h.rank), bytes: Number(h.bytes), venture: null, fresh: freshOf(h.added_at) }))
        return res.status(200).json({ ok: true, q, venture: 'publication', searched: { since, kinds, fresh, fresh_days: FRESH_DAYS }, shelf_size: null, count: hits.length, hits })
      }
    }
    // An unreadable library is never an empty one: either read failing fails the answer.
    if (found.error || !Array.isArray(rows) || size.error || size.data === null || size.data === undefined) {
      return res.status(503).json({ ok: false, error: 'research_index_unavailable' })
    }
    const hits = (rows as FindHit[]).map((h) => ({ ...h, rank: Number(h.rank), bytes: Number(h.bytes), venture: h.venture ?? null, fresh: Boolean(h.fresh) }))
    return res.status(200).json({
      ok: true, q, venture: venture ?? 'publication', searched: { since, kinds, fresh, fresh_days: FRESH_DAYS },
      shelf_size: Number(size.data), count: hits.length, hits,
    })
  }
}

export default createFindHandler(async () => (await import('../_supabase.js')).supabase as unknown as Db)
