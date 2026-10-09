import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_supabase.js'
import { readPieceCall } from '../../../packages/contracts/src/call.js'
import type { CallMarketRecord } from './_signals.js'

// GET /api/calls   the scoreboard feed: every published piece's dated Call,
//                  our confidence, and the market's odds where one is pinned.
//
// Public and read-only, by design: a Call is public the moment its piece is
// published, and the point of the scoreboard (makeyourmindup.ai) is that
// anyone can check us. Only published pieces appear here; an approved piece
// that is not yet out stays private, because nothing publishes itself
// (docs/NORTH_STAR.md). Nothing here spends, and nothing here is a secret.
//
// Each call carries a status the cover site can print without interpreting:
//   not_due_yet   the date to check it by has not come
//   due           the date has come; Krish rules it right, wrong or too close
//                 to call in words, and that ruling (meta.call_verdict) is
//                 passed through when he has made it.
//
// Origins allowed to read this from a browser: the publication's own sites.

const ORIGINS = new Set([
  'https://makeyourmindup.ai',
  'https://www.makeyourmindup.ai',
  'https://home.makeyourmindup.ai',
  'https://controlcenter.krishraja.com',
])

export interface ScoreboardCall {
  idea_id: string
  title: string
  subchannel: string | null
  published_at: string | null
  statement: string
  due: string
  confidence_percent: number
  status: 'not_due_yet' | 'due'
  verdict: string | null
  market: { source: string; key: string; question: string | null; url: string | null; probability: number | null; read_at: string } | null
}

export function toScoreboardCall(row: { id: string; idea: string | null; lane_slot: string | null; body: string | null; published_at: string | null; meta: unknown }, today = new Date().toISOString().slice(0, 10)): ScoreboardCall | null {
  const read = readPieceCall(String(row.body || ''))
  if (!read.ok) return null
  const meta = (row.meta && typeof row.meta === 'object' ? row.meta : {}) as { call_market?: Partial<CallMarketRecord>; call_verdict?: unknown }
  const m = meta.call_market
  return {
    idea_id: row.id,
    title: String(row.idea || ''),
    subchannel: row.lane_slot || null,
    published_at: row.published_at || null,
    statement: read.call.statement,
    due: read.call.due,
    confidence_percent: read.call.confidence_percent,
    status: read.call.due > today ? 'not_due_yet' : 'due',
    verdict: typeof meta.call_verdict === 'string' ? meta.call_verdict : null,
    market: m?.source && m?.key
      ? { source: String(m.source), key: String(m.key), question: m.question ?? null, url: m.url ?? null, probability: typeof m.probability === 'number' ? m.probability : null, read_at: String(m.read_at || '') }
      : null,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const origin = String(req.headers.origin || '')
  if (ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' })

  const { data, error } = await supabase
    .from('content_ideas')
    .select('id, idea, lane_slot, body, published_at, meta')
    .eq('state', 'published')
    .order('published_at', { ascending: false })
    .limit(100)
  if (error) return res.status(500).json({ ok: false, error: error.message })
  const calls = ((data || []) as any[]).map(r => toScoreboardCall(r)).filter((c): c is ScoreboardCall => Boolean(c))
  return res.status(200).json({ ok: true, read_at: new Date().toISOString(), calls })
}
