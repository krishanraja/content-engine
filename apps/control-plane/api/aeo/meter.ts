import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardBearerExport } from '../_auth.js'
import * as meter from '../_meter.js'

// What an AEO run actually spent, measured rather than estimated.
//
// The engine runs in GitHub Actions and calls Anthropic directly, so nothing
// it spends has ever passed through _meter.ts. One research run on 2026-09-20
// made roughly 54 probes per subject across five subjects; the meter recorded
// none of it, the same blind spot as the n8n LLM nodes and for the same reason:
// the meter only sees what goes through this codebase's own model helpers.
//
// The engine's own Ledger is not the fix. It charges PRICE_USD_PER_CALL before
// each call — a flat per-call ESTIMATE whose own comment says to tune it from
// real ledgers — so posting that number would put a guess in meter_daily
// wearing the clothes of a measurement. It posts token counts read off the
// responses instead, and the pricing happens here, against the one price table
// that prices everything else. An engine that priced its own calls would be a
// second table to keep in step with this one, which is the failure _prices.ts
// exists to have ended.
//
//   POST, Bearer AEO_ENGINE_SECRET
//   { agent: 'aeo-<stage>', model, usage: {...}, calls?, failed? }[]
//
// add() and not replaceDays(): these are self-metered events, and a second run
// on the same day really did spend the money a second time. A replayed POST
// therefore accumulates, which is the same contract every other self-metered
// call site in the fleet has — the engine posts once, at the end of a run.

/** A model's worth of usage from one run, as the engine measured it. */
interface UsageRow {
  agent?: unknown
  model?: unknown
  usage?: unknown
  calls?: unknown
  failed?: unknown
  day?: unknown
}

const MAX_ROWS = 200
const DAY = /^\d{4}-\d{2}-\d{2}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardBearerExport(req, res, 'AEO_ENGINE_SECRET', ['POST'])) return

  const body = (req.body || {}) as { rows?: unknown; run?: unknown }
  const rows = Array.isArray(body.rows) ? (body.rows as UsageRow[]) : null
  if (!rows) return res.status(400).json({ ok: false, error: 'rows[] required' })
  if (rows.length > MAX_ROWS) return res.status(400).json({ ok: false, error: `rows[] over ${MAX_ROWS}` })

  // A row naming no model cannot be priced and a row with no usage cannot be
  // measured. Both are rejected by name rather than written as a zero, because
  // a zero row is indistinguishable from a cheap one on the dashboard.
  const bad: string[] = []
  for (const [i, r] of rows.entries()) {
    if (typeof r.model !== 'string' || !r.model) bad.push(`rows[${i}]: model required`)
    if (!r.usage || typeof r.usage !== 'object') bad.push(`rows[${i}]: usage object required`)
    if (r.day !== undefined && (typeof r.day !== 'string' || !DAY.test(r.day))) bad.push(`rows[${i}]: day must be YYYY-MM-DD`)
  }
  if (bad.length) return res.status(400).json({ ok: false, error: 'invalid rows', errors: bad.slice(0, 20) })

  // anthropicCall is the one place cache fields are read and the one place the
  // price table is applied, so the engine is metered by exactly the same code
  // as an in-process call — and gets cache accounting for free the day a probe
  // prompt starts being cached, without this route learning anything about it.
  let written = 0
  for (const r of rows) {
    await meter.anthropicCall({
      agent: typeof r.agent === 'string' && r.agent ? r.agent : 'aeo-engine',
      model: String(r.model),
      usage: r.usage,
      calls: Number(r.calls) || 1,
      failedCalls: Number(r.failed) || 0,
      day: typeof r.day === 'string' ? r.day : undefined,
    })
    written++
  }

  return res.status(200).json({ ok: true, rows: written, run: typeof body.run === 'string' ? body.run : null })
}
