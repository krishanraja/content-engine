import { AsyncLocalStorage } from 'node:async_hooks'
import { priceUsd, priceUsdDetailed, priceUsdUncached, readUsage, isPriced, perplexityUsd, PERPLEXITY_PRICES, OPENAI_EMBEDDING_PRICES, type TokenUsage } from './_prices.js'
import { classifyAnthropicFailure, noteAnthropicSuccess, recordAnthropicFailure, type ProviderFailure } from './_modelProvider.js'

/**
 * Supabase, lazily.
 *
 * `_supabase.ts` THROWS at module scope when the service credentials are
 * missing, which is why api/_content.ts imports it inside loadConfig rather
 * than at the top — a comment there calls that placement load-bearing. This
 * module is imported statically by _content, _harness, _relevance and _stream,
 * every one of which is also run by the eval scripts outside Vercel with no
 * Supabase env at all. A static import here would crash all of them at load.
 * So the client is resolved per call, cached after the first, and a missing
 * environment makes metering a no-op instead of an outage.
 */
type Db = Awaited<typeof import('./_supabase.js')>['supabase']
let dbPromise: Promise<Db | null> | null = null
function db(): Promise<Db | null> {
  if (!dbPromise) {
    dbPromise = import('./_supabase.js').then(m => m.supabase).catch(() => null)
  }
  return dbPromise
}

// Read and write the usage meter (public.meter_daily).
//
// One shape for every provider, so the UI can rank an Apify actor, an n8n
// workflow and an Anthropic agent against each other without three code paths:
//
//   provider   who bills for it
//   unit_kind  what a row is one of — 'actor' | 'workflow' | 'agent'
//   unit_key   the provider's stable id for that unit
//   bucket     the one sub-dimension worth splitting by (run origin, execution
//              mode, model) — '' when there is none
//
// The two write paths are NOT interchangeable, and picking the wrong one is the
// bug that would make every number here worthless:
//
//   replaceDays()  Provider-derived truth. The collector recomputes a whole day
//                  from the provider's own records and overwrites. Safe to
//                  re-run, safe with overlapping windows, cannot double-count.
//   add()          Self-metered events, one call at a time, as they happen.
//                  Accumulates. Never use it for a value the provider can
//                  restate, or a re-sync will stack on top of what is there.

export type MeterProvider = 'apify' | 'n8n' | 'anthropic' | 'perplexity' | 'openai'
export type MeterUnitKind = 'actor' | 'workflow' | 'agent'

// ── Which piece and which run a call was for (cost guard G12) ───────────────
//
// meter_daily is one cell per agent per day, so it can say what the fact gate
// cost on a day but never what one run cost: G2 had to divide a day by its runs.
// A route that runs paid work for a piece wraps it in `meterScope`, and every
// self-metered call inside it, however deep, also lands as one row in
// public.meter_events stamped with the piece and the run. No call site threads
// ids. Until the migration (20261024090000_meter_events.sql) is applied the
// insert fails, is said once, and is not tried again by this process: the daily
// cells are written exactly as before.
export interface MeterScope { pieceId: string | null; runId: string | null }
const scopeStore = new AsyncLocalStorage<MeterScope>()

/** Run `fn` with every metered call inside it stamped with this piece and run. */
export function meterScope<T>(s: MeterScope, fn: () => Promise<T>): Promise<T> {
  return scopeStore.run(s, fn)
}

/** The scope a call is in, if any. */
export function currentMeterScope(): MeterScope | null {
  return scopeStore.getStore() ?? null
}

let eventsTableMissing = false

async function addEvent(e: { provider: MeterProvider; unitKey: string; bucket: string; usd: number; units: number; failed: boolean }, s: MeterScope): Promise<void> {
  if (eventsTableMissing) return
  const supabase = await db()
  if (!supabase) return
  const { error } = await supabase.from('meter_events').insert({
    provider: e.provider, unit_key: e.unitKey, bucket: e.bucket,
    piece_id: s.pieceId, run_id: s.runId, usd: e.usd, units: e.units, failed: e.failed,
  })
  if (!error) return
  // 42P01 from Postgres, PGRST205 from PostgREST: the table is not there yet.
  if (error.code === '42P01' || error.code === 'PGRST205' || /meter_events/.test(error.message || '')) {
    eventsTableMissing = true
    console.warn('[meter] meter_events is not in the database yet; per-run rows are off until its migration is applied')
    return
  }
  console.warn(`[meter] event write failed for ${e.provider}/${e.unitKey}: ${error.message || error}`)
}

export interface MeterRow {
  provider: MeterProvider
  unit_kind: MeterUnitKind
  unit_key: string
  /** UTC calendar day, YYYY-MM-DD. */
  day: string
  bucket: string
  unit_label: string | null
  category: string | null
  usd: number
  runs: number
  failed: number
  units: number
  /** What `units` counts: 'compute-units' | 'executions' | 'tokens'. */
  unit_name: string | null
  /**
   * Cached tokens, kept apart from `units` and from each other.
   *
   * Netting reads against writes would hide the one failure worth catching: a
   * site that writes cache entries nobody reads pays MORE than one with no
   * caching at all, because a write is priced above an ordinary input token
   * and a read is priced at a tenth of one. Two columns, so the ratio between
   * them is visible and a write-only site shows up as exactly what it is.
   */
  cache_read_tokens?: number
  cache_write_tokens?: number
  /** What the same work would have cost with no caching. usd minus this is the saving. */
  usd_uncached?: number
}

/** UTC calendar day of an instant, as the meter stores it. */
export function dayKey(d: Date | string | number): string {
  const t = d instanceof Date ? d : new Date(d)
  return Number.isNaN(t.getTime()) ? '' : t.toISOString().slice(0, 10)
}

/** N days back from now, as a UTC day key. */
export function daysAgoKey(n: number): string {
  return dayKey(Date.now() - n * 86_400_000)
}

/**
 * Overwrite whole meter cells with provider-derived truth.
 *
 * Chunked because a wide window over a busy account is thousands of rows and
 * PostgREST has a payload ceiling. Returns how many rows landed; a failure is
 * reported, not thrown — a collector that half-succeeded should say so and
 * leave the rest of its work intact.
 */
export async function replaceDays(rows: MeterRow[]): Promise<{ written: number; error: string | null }> {
  if (!rows.length) return { written: 0, error: null }
  const supabase = await db()
  if (!supabase) return { written: 0, error: 'supabase not configured' }
  const CHUNK = 500
  let written = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map(r => ({ ...r, updated_at: new Date().toISOString() }))
    const { error } = await supabase
      .from('meter_daily')
      .upsert(slice, { onConflict: 'provider,unit_kind,unit_key,day,bucket' })
    if (error) return { written, error: error.message }
    written += slice.length
  }
  return { written, error: null }
}

/**
 * Add one self-metered event to its cell.
 *
 * Fire-and-forget by contract: metering must never break the work it measures,
 * so every failure is swallowed. The cost is one round trip on a path that
 * already spent seconds waiting on a model.
 */
export async function add(e: {
  provider: MeterProvider
  unitKind: MeterUnitKind
  unitKey: string
  bucket?: string
  label?: string | null
  category?: string | null
  usd?: number
  runs?: number
  failed?: number
  units?: number
  unitName?: string | null
  cacheReadTokens?: number
  cacheWriteTokens?: number
  /** What this call would have cost uncached, so the saving is a stored number. */
  usdUncached?: number
  /** Defaults to today. */
  day?: string
}): Promise<void> {
  try {
    const supabase = await db()
    if (!supabase) return
    const { error } = await supabase.rpc('meter_add', {
      p_provider: e.provider,
      p_unit_kind: e.unitKind,
      p_unit_key: e.unitKey,
      p_day: e.day || dayKey(Date.now()),
      p_bucket: e.bucket || '',
      p_unit_label: e.label ?? null,
      p_category: e.category ?? null,
      p_usd: e.usd ?? 0,
      p_runs: e.runs ?? 1,
      p_failed: e.failed ?? 0,
      p_units: e.units ?? 0,
      p_unit_name: e.unitName ?? null,
      p_cache_read_tokens: e.cacheReadTokens ?? 0,
      p_cache_write_tokens: e.cacheWriteTokens ?? 0,
      p_usd_uncached: e.usdUncached ?? e.usd ?? 0,
    })
    // METERING IS NEVER LOAD-BEARING, BUT IT MUST BE ABLE TO SAY IT FAILED.
    //
    // supabase-js RETURNS errors here, it does not throw them, so the catch
    // below never saw a rejected write: the result was discarded and every
    // failure looked exactly like a successful one. Combined with the catch,
    // this function could not report anything at all.
    //
    // What that hides is the whole instrument going dark. Every Anthropic agent
    // in meter_daily stops on 2026-09-15 on the same day, control-center's own
    // and content-engine's alike, while the apify and n8n rows written by the
    // sync crons continue. Read off the dashboard that is "we spent nothing",
    // which is the most expensive sentence this codebase can say silently.
    //
    // Still swallowed, still never thrown: a failed meter write must not fail
    // the work it was measuring. But it is now SAID, once per failure, so the
    // difference between "no spend" and "no measurement" reaches a log.
    if (error) console.warn(`[meter] write failed for ${e.provider}/${e.unitKey}: ${error.message || error}`)
    const s = currentMeterScope()
    if (s && (s.pieceId || s.runId)) {
      await addEvent({ provider: e.provider, unitKey: e.unitKey, bucket: e.bucket || '', usd: e.usd ?? 0, units: e.units ?? 0, failed: (e.failed ?? 0) > 0 }, s)
    }
  } catch (e2) {
    console.warn(`[meter] write threw for ${e.provider}/${e.unitKey}: ${(e2 as Error)?.message || e2}`)
  }
}

export interface MeterUnit {
  provider: MeterProvider
  unit_kind: MeterUnitKind
  unit_key: string
  label: string
  category: string | null
  usd: number
  runs: number
  failed: number
  units: number
  unit_name: string | null
  /** Spend inside the shorter recent window, for "is this one accelerating". */
  usd_recent: number
  /** Sub-dimension totals, biggest first: origins, modes, models. */
  buckets: Array<{ bucket: string; usd: number; runs: number }>
  last_day: string
}

/**
 * Roll the meter up per unit over a window.
 *
 * `recentDays` is a second, shorter window scored in the same pass so the
 * caller can say "and half of that was this week" without a second query.
 */
export async function readUnits(opts: {
  sinceDay: string
  recentSinceDay?: string
  providers?: MeterProvider[]
  limit?: number
}): Promise<{ units: MeterUnit[]; total_usd: number; error: string | null }> {
  const supabase = await db()
  if (!supabase) return { units: [], total_usd: 0, error: 'supabase not configured' }
  let q = supabase
    .from('meter_daily')
    .select('provider, unit_kind, unit_key, day, bucket, unit_label, category, usd, runs, failed, units, unit_name')
    .gte('day', opts.sinceDay)
    .order('day', { ascending: false })
    .limit(opts.limit ?? 5000)
  if (opts.providers?.length) q = q.in('provider', opts.providers)

  const { data, error } = await q
  if (error) return { units: [], total_usd: 0, error: error.message }

  const agg = new Map<string, MeterUnit & { _buckets: Map<string, { usd: number; runs: number }> }>()
  let total = 0
  for (const r of (data || []) as Array<Record<string, unknown>>) {
    const provider = String(r.provider) as MeterProvider
    const unit_kind = String(r.unit_kind) as MeterUnitKind
    const unit_key = String(r.unit_key)
    const id = `${provider}|${unit_kind}|${unit_key}`
    const usd = Number(r.usd) || 0
    const runs = Number(r.runs) || 0
    const day = String(r.day)
    total += usd

    let u = agg.get(id)
    if (!u) {
      u = {
        provider, unit_kind, unit_key,
        label: (r.unit_label as string) || unit_key,
        category: (r.category as string) ?? null,
        usd: 0, runs: 0, failed: 0, units: 0,
        unit_name: (r.unit_name as string) ?? null,
        usd_recent: 0, buckets: [], last_day: day,
        _buckets: new Map(),
      }
      agg.set(id, u)
    }
    u.usd += usd
    u.runs += runs
    u.failed += Number(r.failed) || 0
    u.units += Number(r.units) || 0
    if (r.unit_label) u.label = String(r.unit_label)
    if (r.category) u.category = String(r.category)
    if (r.unit_name) u.unit_name = String(r.unit_name)
    if (day > u.last_day) u.last_day = day
    if (opts.recentSinceDay && day >= opts.recentSinceDay) u.usd_recent += usd

    const b = String(r.bucket || '')
    if (b) {
      const cur = u._buckets.get(b) || { usd: 0, runs: 0 }
      cur.usd += usd
      cur.runs += runs
      u._buckets.set(b, cur)
    }
  }

  const units = [...agg.values()]
    .map(({ _buckets, ...u }) => ({
      ...u,
      usd: round6(u.usd),
      usd_recent: round6(u.usd_recent),
      units: Math.round(u.units * 100) / 100,
      buckets: [..._buckets.entries()]
        .map(([bucket, v]) => ({ bucket, usd: round6(v.usd), runs: v.runs }))
        .sort((a, b) => b.usd - a.usd || b.runs - a.runs),
    }))
    // Dollars first, then volume — an unpriced provider (n8n) still ranks.
    .sort((a, b) => b.usd - a.usd || b.runs - a.runs)

  return { units, total_usd: round6(total), error: null }
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6

// ── Anthropic self-metering ─────────────────────────────────────────────────
//
// The API key cannot read Anthropic's billing: the usage and cost reports are
// Admin-key endpoints, and an Admin key does not exist for an individual
// account. So the OS meters itself — every call records the token counts
// Anthropic returned on the response, priced from _prices.ts, stamped with the
// agent that made it.
//
// What this therefore CANNOT see, stated here so it is never quietly forgotten:
// any Anthropic call made outside these helpers. An n8n node holding its own
// Anthropic credential bills Krish's account and never touches this code. The
// one such path the OS owns — n8n workflows that POST to
// /api/internal/sonnet-proxy — IS metered, stamped with their X-Internal-Caller.
// Everything else shows up only on the invoice, which is why the invoice
// remains the source of truth for total Anthropic spend and this meter answers
// the different question: which agent, of the ones we run, is spending.

export const UNATTRIBUTED = 'unattributed'

/** Agent stamps become unit keys, so they are normalised once, here. */
export function normalizeAgent(raw: string | null | undefined): string {
  const s = (raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s ? s.slice(0, 48) : UNATTRIBUTED
}

/**
 * Record one Anthropic call against the agent that made it.
 *
 * `units` is total tokens; `usd` is the priced split, which is the number that
 * matters (output costs five times input). A model with no known rate records
 * its tokens with usd 0 — deliberately a visible gap rather than a guess.
 */
export async function anthropicCall(e: {
  agent?: string | null
  model: string
  inputTokens?: number
  outputTokens?: number
  /**
   * The raw `usage` object from the response, preferred over the two counts.
   *
   * Every call site used to pluck input_tokens and output_tokens by hand and
   * drop everything else, which is why cache savings were invisible across the
   * whole OS: five sites, five places to forget. Passing the object through
   * means the cache fields are read in exactly one place, and a site that
   * starts caching tomorrow is measured without touching it.
   */
  usage?: unknown
  /** A call that errored after tokens were produced still cost money. */
  failed?: boolean
  /**
   * What the provider said when the call failed. With `failed`, the failure is
   * classified (usage limit, overload...) and kept where the health endpoint
   * and the judge sweep read it (api/_modelProvider.ts). Only for a single
   * in-process call: a reporter posting another process's totals has no error
   * of ours to record.
   */
  error?: unknown
  /**
   * How many calls this usage total covers. Defaults to 1, which is every
   * in-process site: one call, one usage object, one run.
   *
   * It exists for the reporters that measure a batch and post it afterwards.
   * The AEO engine runs in GitHub Actions and sends one row per model per run,
   * and a run is around fifty probes. Without this, `runs` would read 1 for all
   * of them: the dollars would be right and cost-per-run fifty times the truth,
   * which is the kind of half-wrong number that survives a long time because
   * the total it sits beside is correct.
   */
  calls?: number
  /** How many of `calls` failed. Defaults to `failed` on a single call. */
  failedCalls?: number
  /** The day this usage belongs to. Defaults to today, which is right for an
   *  in-process call and wrong for a run posting its total after midnight. */
  day?: string
  /**
   * A multiplier on the PRICE, for tokens that did not cost list rate.
   *
   * The only caller today is the Batches API, which bills every token type at
   * half. Applied to `usd` and `usd_uncached` alike, because the discount is a
   * property of how the request was sent rather than of whether its prefix was
   * cached: folding it into only one of the two would make the cache saving
   * read larger than it is, and the batch saving smaller.
   *
   * Token counts are untouched, so a batched call and a live call of the same
   * size still record the same `units` and the dollars-per-token between them
   * stays comparable. Ignored unless it is a finite number in (0, 1].
   */
  discount?: number
}): Promise<void> {
  const u: TokenUsage = e.usage
    ? readUsage(e.usage)
    : { input: e.inputTokens || 0, output: e.outputTokens || 0 }
  const cached = (u.cacheRead || 0) + (u.cacheWrite5m || 0) + (u.cacheWrite1h || 0)
  const tokens = u.input + u.output + cached
  // Bounded rather than trusted. A discount above 1 would be a surcharge and a
  // discount of 0 would make a real spend disappear from the meter, which is
  // the one failure a spend surface may never have.
  const discount = Number.isFinite(Number(e.discount)) && Number(e.discount) > 0 && Number(e.discount) <= 1
    ? Number(e.discount)
    : 1
  const runs = Math.max(1, Math.trunc(Number(e.calls) || 1))
  // An explicit failedCalls always wins, including an explicit zero. Only when
  // it is absent does the single-call `failed` boolean decide, which is every
  // in-process site.
  const failedRuns = e.failedCalls === undefined
    ? (e.failed ? 1 : 0)
    : Math.max(0, Math.trunc(Number(e.failedCalls) || 0))
  // A FAILED CALL IS COUNTED EVEN WHEN IT PRODUCED NOTHING.
  //
  // This returned early on zero tokens, and a refused call has zero tokens:
  // from 2026-09-27 10:00 UTC every Anthropic call the engine made was refused
  // for the account's usage limit, and meter_daily recorded none of them, so
  // `failed` read 0 for a key that had not answered for 33 hours. A failure
  // now adds a run and a failure to its key and day, and no cost unless the
  // provider reported usage. Only a call with neither tokens nor a failure is
  // still skipped: there is nothing to say about it.
  if (!tokens && !failedRuns) return
  await add({
    provider: 'anthropic',
    unitKind: 'agent',
    unitKey: normalizeAgent(e.agent),
    bucket: e.model,
    label: normalizeAgent(e.agent),
    category: isPriced(e.model) ? 'priced' : 'unpriced-model',
    usd: priceUsdDetailed(e.model, u) * discount,
    usdUncached: priceUsdUncached(e.model, u) * discount,
    runs,
    failed: Math.min(runs, failedRuns),
    units: tokens,
    unitName: 'tokens',
    cacheReadTokens: u.cacheRead || 0,
    cacheWriteTokens: (u.cacheWrite5m || 0) + (u.cacheWrite1h || 0),
    day: e.day,
  })
  // What the provider is doing, kept for health and the judge sweep. Single
  // in-process calls only: `calls` is how a reporter (the AEO engine, a batch
  // drain) posts totals for calls this process did not see fail or succeed.
  if (e.calls !== undefined) return
  if (failedRuns && e.error !== undefined) {
    await recordAnthropicFailure({ ...classifyAnthropicFailure(e.error), agent: normalizeAgent(e.agent), model: e.model })
  } else if (!failedRuns && tokens) {
    await noteAnthropicSuccess()
  }
}

/**
 * Record one failed Anthropic call: a run and a failure on its key and day,
 * no cost unless the provider reported usage, and the failure itself where
 * health reads it. Returns the classified failure, so a route can say what
 * happened in its own response. Never throws.
 */
export async function anthropicFailure(e: {
  agent?: string | null
  model: string
  error: unknown
  /** The usage the provider reported before it failed, if any. */
  usage?: unknown
}): Promise<ProviderFailure> {
  const failure = classifyAnthropicFailure(e.error)
  try {
    await anthropicCall({ agent: e.agent, model: e.model, usage: e.usage ?? null, failed: true, error: e.error })
  } catch { /* metering is never load-bearing */ }
  return failure
}

/**
 * Record one Perplexity call (cost guard G12). `usage` is the response's own
 * usage object; its reported cost wins over the price table. A failed call is
 * a run and a failure with no cost unless the provider reported usage. Never
 * throws: metering is never load-bearing.
 */
export async function perplexityCall(e: { agent: string; model: string; usage?: unknown; failed?: boolean }): Promise<void> {
  try {
    const u = (e.usage || {}) as Record<string, unknown>
    const tokens = (Number(u.prompt_tokens) || 0) + (Number(u.completion_tokens) || 0)
    if (!tokens && !e.failed) return
    const usd = tokens ? perplexityUsd(e.model, e.usage) : 0
    await add({
      provider: 'perplexity', unitKind: 'agent', unitKey: normalizeAgent(e.agent), bucket: e.model,
      label: normalizeAgent(e.agent), category: PERPLEXITY_PRICES[e.model] ? 'priced' : 'unpriced-model',
      usd, runs: 1, failed: e.failed ? 1 : 0, units: tokens, unitName: 'tokens',
    })
  } catch { /* metering is never load-bearing */ }
}

/** Record one OpenAI embeddings call (cost guard G12). Never throws. */
export async function openaiEmbeddingCall(e: { agent: string; model: string; usage?: unknown; failed?: boolean }): Promise<void> {
  try {
    const tokens = Number(((e.usage || {}) as Record<string, unknown>).total_tokens) || 0
    if (!tokens && !e.failed) return
    const rate = OPENAI_EMBEDDING_PRICES[e.model]
    await add({
      provider: 'openai', unitKind: 'agent', unitKey: normalizeAgent(e.agent), bucket: e.model,
      label: normalizeAgent(e.agent), category: rate !== undefined ? 'priced' : 'unpriced-model',
      usd: rate !== undefined ? tokens / 1e6 * rate : 0, runs: 1, failed: e.failed ? 1 : 0, units: tokens, unitName: 'tokens',
    })
  } catch { /* metering is never load-bearing */ }
}

export interface FactRunCost {
  day: string
  runs: number
  usd_per_run: number
  /** 'run': the newest run's own rows in meter_events. 'day_average': that day's fact-gate spend over its runs. */
  basis: 'run' | 'day_average'
  run_id?: string
  piece_id?: string | null
}

/** The newest fact-check run's measured cost, from its own rows, or null when there are none to read. */
export function newestRunCost(rows: Array<{ at: string; run_id: string | null; piece_id: string | null; usd: number | string }>): FactRunCost | null {
  const runs = new Map<string, { at: string; usd: number; piece_id: string | null }>()
  for (const r of rows) {
    if (!r.run_id) continue
    const cur = runs.get(r.run_id) || { at: r.at, usd: 0, piece_id: r.piece_id }
    cur.usd += Number(r.usd) || 0
    if (r.at > cur.at) cur.at = r.at
    runs.set(r.run_id, cur)
  }
  const newest = [...runs.entries()].sort((a, b) => (a[1].at < b[1].at ? 1 : -1))[0]
  if (!newest) return null
  return { day: newest[1].at.slice(0, 10), runs: 1, usd_per_run: Math.round(newest[1].usd * 100) / 100, basis: 'run', run_id: newest[0], piece_id: newest[1].piece_id }
}

/**
 * What one paid fact check cost, measured. Cost guard G2 (docs/COST_GUARDS.md): a rerun is estimated from this,
 * never from a count of sentences (18 October: estimated at 20 cents, cost about $1).
 *
 * The newest run's own rows in meter_events when that table exists (G12): every Anthropic and Perplexity call
 * of the run, stamped with its run id. Without it, the older estimate: the fact gate's spend on the last day it
 * ran, divided by that day's runs (one claim list per run), now with the metered web checks included.
 */
export async function lastFactRunCost(): Promise<FactRunCost | null> {
  const supabase = await db()
  if (!supabase) return null
  if (!eventsTableMissing) {
    const { data, error } = await supabase.from('meter_events').select('at,run_id,piece_id,usd')
      .like('unit_key', 'fact-gate-%').not('run_id', 'is', null).order('at', { ascending: false }).limit(2000)
    if (!error && data) {
      const run = newestRunCost(data as Array<{ at: string; run_id: string | null; piece_id: string | null; usd: number | string }>)
      if (run) return run
    }
  }
  const { data, error } = await supabase.from('meter_daily').select('day,unit_key,usd,runs')
    .in('provider', ['anthropic', 'perplexity']).like('unit_key', 'fact-gate-%').order('day', { ascending: false }).limit(120)
  if (error || !data) return null
  const days = new Map<string, { usd: number; runs: number }>()
  for (const r of data as Array<{ day: string; unit_key: string; usd: number | string; runs: number | string }>) {
    const d = days.get(r.day) || { usd: 0, runs: 0 }
    d.usd += Number(r.usd) || 0
    if (r.unit_key === 'fact-gate-extract') d.runs += Number(r.runs) || 0
    days.set(r.day, d)
  }
  for (const [day, d] of [...days.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
    if (d.runs > 0) return { day, runs: d.runs, usd_per_run: Math.round((d.usd / d.runs) * 100) / 100, basis: 'day_average' }
  }
  return null
}
