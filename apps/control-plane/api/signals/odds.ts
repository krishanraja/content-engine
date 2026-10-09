import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { withContentRun } from '../_runs.js'
import { marketOdds, nextCallMarket, type CallMarketRecord } from '../_signals.js'

// Daily reading of the market's odds on every Call that has a market pinned.
//
// A piece's Call is pinned to a prediction market with
// POST /api/content-ideas/:id/call-market, which stores
// content_ideas.meta.call_market. This cron reads each pinned market once a
// day and appends the reading to its history, so the scoreboard (GET
// /api/calls) can show our dated call beside the market's and both can be
// tracked to the due date (docs/ENGINE_100X.md, "The scoreboard that keeps
// score"). Keyless: Polymarket's and Kalshi's market data are public.
//
//   GET (CRON_SECRET)  — daily 06:45 UTC   ·   POST — on demand

const MAX_PIECES = 50

interface Row { id: string; idea: string | null; state: string; meta: Record<string, unknown> | null }

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return
  try {
    const { data, error } = await supabase
      .from('content_ideas')
      .select('id, idea, state, meta')
      .in('state', ['approved', 'published'])
      .not('meta->call_market', 'is', null)
      .limit(MAX_PIECES)
    if (error) return res.status(500).json({ ok: false, error: error.message })
    const rows = (data || []) as Row[]
    if (!rows.length) return res.status(200).json({ ok: true, skipped: 'no Call has a market pinned yet', pieces: 0 })

    let read = 0, failed = 0, unchanged = 0
    const report: Array<{ idea_id: string; source: string; key: string; probability: number | null; note?: string }> = []
    for (const row of rows) {
      const prev = (row.meta?.call_market || null) as Partial<CallMarketRecord> | null
      if (!prev?.source || !prev?.key) { unchanged++; continue }
      try {
        const odds = await marketOdds(prev.source, prev.key)
        if (!odds) { failed++; report.push({ idea_id: row.id, source: prev.source, key: prev.key, probability: null, note: 'market not found' }); continue }
        const next = nextCallMarket(prev, odds)
        const { error: upErr } = await supabase
          .from('content_ideas')
          .update({ meta: { ...(row.meta || {}), call_market: next }, updated_at: new Date().toISOString() })
          .eq('id', row.id)
        if (upErr) { failed++; report.push({ idea_id: row.id, source: prev.source, key: prev.key, probability: odds.probability, note: upErr.message }); continue }
        read++
        report.push({ idea_id: row.id, source: prev.source, key: prev.key, probability: odds.probability })
      } catch (e: any) {
        failed++
        report.push({ idea_id: row.id, source: prev.source, key: prev.key, probability: null, note: String(e?.message || e) })
      }
    }
    return res.status(200).json({ ok: failed === 0 || read > 0, pieces: rows.length, read, failed, unchanged, report })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

export default withContentRun('signals_odds', handler)
