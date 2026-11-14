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
//   { rows: [{ agent: 'aeo-<stage>', model, usage: {...}, calls?, failed?, day? }], run? }
//
// Since the AEO brief, section F (2026-11-14), a row may also say who billed it
// and how, and the context lists `meter_billing` once this route reads them:
//
//   provider      anthropic (the default), openai, perplexity, google or xai
//   billing       api (the default) or subscription. Subscription rows carry
//                 tokens and no dollar amount (Ruling, Krish, 2026-11-13: Claude
//                 probes run on the Claude Code subscription token, with the
//                 paid API as a fallback)
//   input_tokens, output_tokens
//                 for a provider whose usage object is not Anthropic's; an
//                 Anthropic row may still send `usage`, cache fields and all
//   search_calls  hosted web searches, billed per request on the API
//
// Every row is priced in _meter.ts against the one price table (reportedUsage).
//
// add() and not replaceDays(): these are self-metered events, and a second run
// on the same day really did spend the money a second time. A replayed POST
// therefore accumulates, which is the same contract every other self-metered
// call site in the fleet has — the engine posts once, at the end of a run.

/** A model's worth of usage from one run, as the engine measured it. */
interface UsageRow {
  provider?: unknown
  billing?: unknown
  agent?: unknown
  model?: unknown
  usage?: unknown
  input_tokens?: unknown
  output_tokens?: unknown
  search_calls?: unknown
  calls?: unknown
  failed?: unknown
  day?: unknown
}

const MAX_ROWS = 200
const DAY = /^\d{4}-\d{2}-\d{2}$/
export const METER_PROVIDERS = ['anthropic', 'openai', 'perplexity', 'google', 'xai'] as const
type Provider = typeof METER_PROVIDERS[number]
const count = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isInteger(v) && v >= 0)

/** Every reason a row cannot be metered, by its index. A row is never written as a zero it does not mean. */
export function rowErrors(rows: readonly UsageRow[]): string[] {
  const bad: string[] = []
  for (const [i, r] of rows.entries()) {
    if (typeof r.model !== 'string' || !r.model) bad.push(`rows[${i}]: model required`)
    if (r.provider !== undefined && !(METER_PROVIDERS as readonly unknown[]).includes(r.provider)) bad.push(`rows[${i}]: provider must be one of ${METER_PROVIDERS.join(', ')}`)
    if (r.billing !== undefined && r.billing !== 'api' && r.billing !== 'subscription') bad.push(`rows[${i}]: billing must be api or subscription`)
    const hasUsage = !!r.usage && typeof r.usage === 'object'
    const hasTokens = r.input_tokens !== undefined || r.output_tokens !== undefined
    if (!hasUsage && !hasTokens) bad.push(`rows[${i}]: usage object or input_tokens and output_tokens required`)
    if (!count(r.input_tokens) || !count(r.output_tokens)) bad.push(`rows[${i}]: input_tokens and output_tokens must be whole numbers`)
    if (!count(r.search_calls)) bad.push(`rows[${i}]: search_calls must be a whole number`)
    if (r.day !== undefined && (typeof r.day !== 'string' || !DAY.test(r.day))) bad.push(`rows[${i}]: day must be YYYY-MM-DD`)
  }
  return bad
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardBearerExport(req, res, 'AEO_ENGINE_SECRET', ['POST'])) return

  const body = (req.body || {}) as { rows?: unknown; run?: unknown }
  const rows = Array.isArray(body.rows) ? (body.rows as UsageRow[]) : null
  if (!rows) return res.status(400).json({ ok: false, error: 'rows[] required' })
  if (rows.length > MAX_ROWS) return res.status(400).json({ ok: false, error: `rows[] over ${MAX_ROWS}` })

  // A row naming no model cannot be priced and a row with no usage cannot be
  // measured. Both are rejected by name rather than written as a zero, because
  // a zero row is indistinguishable from a cheap one on the dashboard.
  const bad = rowErrors(rows)
  if (bad.length) return res.status(400).json({ ok: false, error: 'invalid rows', errors: bad.slice(0, 20) })

  // reportedUsage sends an Anthropic API row through anthropicCall, the one
  // place cache fields are read and the one place the price table is applied,
  // so the engine is metered by exactly the same code as an in-process call.
  let written = 0
  for (const r of rows) {
    await meter.reportedUsage({
      provider: (r.provider as Provider | undefined) ?? 'anthropic',
      billing: r.billing === 'subscription' ? 'subscription' : 'api',
      agent: typeof r.agent === 'string' && r.agent ? r.agent : 'aeo-engine',
      model: String(r.model),
      usage: r.usage && typeof r.usage === 'object' ? r.usage : undefined,
      inputTokens: Number(r.input_tokens) || 0,
      outputTokens: Number(r.output_tokens) || 0,
      calls: Number(r.calls) || 1,
      failedCalls: Number(r.failed) || 0,
      searchCalls: Number(r.search_calls) || 0,
      day: typeof r.day === 'string' ? r.day : undefined,
    })
    written++
  }

  return res.status(200).json({ ok: true, rows: written, run: typeof body.run === 'string' ? body.run : null })
}
