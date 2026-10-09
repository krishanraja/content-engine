import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import { guardEngine } from '../../_auth.js'
import { marketOdds, nextCallMarket, type CallMarketRecord, type MarketSource } from '../../_signals.js'

// GET  /api/content-ideas/:id/call-market                 the market pinned to this piece's Call, if any
// POST /api/content-ideas/:id/call-market  body: { source: 'polymarket' | 'kalshi', key }   pin one
// POST /api/content-ideas/:id/call-market  body: { clear: true }                            unpin
//
// Pins a prediction market to a piece's dated Call so the scoreboard can show
// our confidence beside what traders pay for the same outcome, and the daily
// cron (api/signals/odds.ts) can track both to the due date. The market is
// read once here, so a wrong slug or ticker is refused before it is stored.
// The key is the Polymarket slug (the last part of the market's address) or
// the Kalshi ticker. Operator or dashboard only: this changes what the
// scoreboard says about a piece.

const SOURCES: MarketSource[] = ['polymarket', 'kalshi']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return

  const raw = req.query?.id
  const ideaId = Array.isArray(raw) ? raw[0] : raw
  if (!ideaId) return res.status(400).json({ ok: false, error: 'id required' })

  const { data: row, error } = await supabase.from('content_ideas').select('id, idea, state, meta').eq('id', ideaId).maybeSingle()
  if (error) return res.status(500).json({ ok: false, error: error.message })
  if (!row) return res.status(404).json({ ok: false, error: 'idea not found' })
  const meta = ((row as any).meta && typeof (row as any).meta === 'object' ? (row as any).meta : {}) as Record<string, unknown>

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, idea_id: ideaId, call_market: (meta.call_market as CallMarketRecord | undefined) || null })
  }

  const body = (req.body || {}) as { source?: unknown; key?: unknown; clear?: unknown }
  const stamp = new Date().toISOString()

  if (body.clear === true) {
    const { call_market: _dropped, ...rest } = meta
    const { error: upErr } = await supabase.from('content_ideas').update({ meta: rest, updated_at: stamp }).eq('id', ideaId)
    if (upErr) return res.status(500).json({ ok: false, error: upErr.message })
    return res.status(200).json({ ok: true, idea_id: ideaId, call_market: null })
  }

  const source = String(body.source || '') as MarketSource
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!SOURCES.includes(source)) return res.status(400).json({ ok: false, error: `source must be one of ${SOURCES.join(', ')}` })
  if (!key || key.length > 200) return res.status(400).json({ ok: false, error: 'key is the Polymarket slug or the Kalshi ticker' })

  let odds
  try {
    odds = await marketOdds(source, key)
  } catch (e: any) {
    return res.status(502).json({ ok: false, error: `could not read the market: ${String(e?.message || e)}` })
  }
  if (!odds) return res.status(404).json({ ok: false, error: `no ${source} market found for "${key}"` })

  const prev = (meta.call_market || null) as Partial<CallMarketRecord> | null
  const samePin = prev?.source === source && prev?.key === key
  const next = nextCallMarket(samePin ? prev : { set_at: stamp, history: [] }, odds)
  const { error: upErr } = await supabase
    .from('content_ideas')
    .update({ meta: { ...meta, call_market: next }, updated_at: stamp })
    .eq('id', ideaId)
  if (upErr) return res.status(500).json({ ok: false, error: upErr.message })
  return res.status(200).json({ ok: true, idea_id: ideaId, call_market: next })
}
