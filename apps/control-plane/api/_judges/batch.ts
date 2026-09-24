import { createHash } from 'node:crypto'
import { claudeRequestBody, getAnthropicKey, type ClaudeCall, type ClaudeOpts } from '../_content.js'
import { supabase } from '../_supabase.js'
import * as meter from '../_meter.js'
import { DeferredCall } from './deferred.js'

// The batch transport: the same ladder, at half price, paid for in latency.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────
//
// Measured 2026-09-24, the ladder's own meter rows for the day:
//
//   nine judges   1,287 calls   $8.08   67%
//   expand          116 calls   $2.21   18%
//   repair           81 calls   $1.29   11%
//   router          113 calls   $0.49    4%
//
// The Batches API bills every token type at half. Nothing about the sweep is
// latency-sensitive: it is a cron, and Krish reads the result in the morning.
//
// ── WHY IT IS A TRANSPORT AND NOT A SECOND LADDER ─────────────────────────
//
// The obvious build is a staged pipeline — expand everything, judge everything,
// repair what needs it — and it is the wrong one, because the staging would be
// a second copy of the ladder's decision logic: the banding, the keep-the-
// better rule, the two-attempt cap, the confirmation. Every one of those was
// fixed in place this week after a live run proved it wrong, and a second copy
// is a second place for the next fix to be forgotten.
//
// So the ladder is untouched and the CALL is what changes. `bus.call` has the
// same signature as `callClaude`. It answers from a reply already paid for, and
// when it has not got one it records the request and throws DeferredCall. The
// walk unwinds, the idea is left exactly where it was, and every request the
// tick collected goes out as one batch. The next tick re-walks the same ideas:
// now the first stage answers from cache, the walk gets one stage further, and
// defers again. An idea advances one stage per tick and the ladder never knew.
//
// It costs a full re-walk per tick — database reads and hashes, no model calls.
// That is the price of not forking the decisions, and it is worth paying.
//
// ── THE TWO THINGS THAT WOULD MAKE THIS SILENTLY WRONG ────────────────────
//
// 1. A content-keyed cache answers the bury confirmation with the answer it is
//    trying to test. The confirmation re-expands ON PURPOSE, because only 2 of
//    10 seeds expanded to the same angle twice and all the score variance lived
//    in the other eight. A cache hit there would return the first expansion,
//    the second panel would agree with itself, and the row would claim a
//    confirmation that never happened. `sample` is how a call says it must be
//    an independent draw; it is not sent to the model.
// 2. Research that varies between ticks changes the repair REQUEST, so the
//    repair misses its own cache and the sweep never converges. Web lookups are
//    cached in the same table for the same reason, and that is correctness
//    rather than thrift.

const API = 'https://api.anthropic.com/v1/messages/batches'
const VERSION = '2023-06-01'
/** The Batches API bills every token type at half list price. */
export const BATCH_DISCOUNT = 0.5
/** Anthropic's cap is 100,000 requests / 256MB. This one is ours: a tick that
 *  wants more than this has almost certainly looped, and a runaway batch is the
 *  one mistake here that cannot be taken back once submitted. */
export const MAX_BATCH_REQUESTS = 4000

// DeferredCall lives in deferred.ts, which imports nothing: expand.ts and
// panel.ts both have to recognise it, and both run in the test suite with no
// database, while this file loads the Supabase client at module scope.
export { DeferredCall, isDeferred } from './deferred.js'

/**
 * The cache key for a request: what is actually sent, plus the sample number.
 *
 * The body rather than the opts, so two call sites that build the same request
 * differently still share a reply, and so a change to how a prompt is assembled
 * correctly invalidates it. `agent` and `timeoutMs` are deliberately NOT in the
 * key: they change nothing the model sees.
 */
export function requestKey(opts: ClaudeOpts): string {
  const body = JSON.stringify(claudeRequestBody(opts))
  const sample = Number.isFinite(Number(opts.sample)) ? Number(opts.sample) : 0
  return createHash('sha256').update(`${sample}\u0000${body}`).digest('hex')
}

export function researchKey(query: string): string {
  return createHash('sha256').update(`research\u0000${query}`).digest('hex')
}

export interface BatchRef {
  id: string
  requests: number
  submitted_at: string
  /** True once the results are in judge_sweep_cache and it need never be
   *  fetched again. */
  read: boolean
}

interface CachedCall {
  text: string | null
  error: string | null
}

interface Wanted {
  key: string
  opts: ClaudeOpts
}

async function anthropic(path: string, init: RequestInit): Promise<Response> {
  const key = await getAnthropicKey()
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  return fetch(path, {
    ...init,
    headers: {
      'x-api-key': key,
      'anthropic-version': VERSION,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

/** Submit one batch. Returns its id. */
export async function submitBatch(requests: { custom_id: string; params: unknown }[]): Promise<string> {
  if (!requests.length) throw new Error('refusing to submit an empty batch')
  if (requests.length > MAX_BATCH_REQUESTS) {
    throw new Error(`refusing to submit ${requests.length} requests: the cap is ${MAX_BATCH_REQUESTS}`)
  }
  const r = await anthropic(API, { method: 'POST', body: JSON.stringify({ requests }) })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`batch_submit_${r.status}:${String(j?.error?.message || '').slice(0, 160)}`)
  const id = String(j?.id || '')
  if (!id) throw new Error('the batch was accepted with no id')
  return id
}

export interface BatchStatus {
  ended: boolean
  processing: number
  succeeded: number
  errored: number
  canceled: number
  expired: number
}

export async function retrieveBatch(id: string): Promise<BatchStatus> {
  const r = await anthropic(`${API}/${encodeURIComponent(id)}`, { method: 'GET' })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`batch_retrieve_${r.status}:${String(j?.error?.message || '').slice(0, 160)}`)
  const c = j?.request_counts || {}
  return {
    ended: j?.processing_status === 'ended',
    processing: Number(c.processing) || 0,
    succeeded: Number(c.succeeded) || 0,
    errored: Number(c.errored) || 0,
    canceled: Number(c.canceled) || 0,
    expired: Number(c.expired) || 0,
  }
}

/** The first text block of a batch result message, for the same reason
 *  _content.firstText exists: a thinking block can come first, and indexing by
 *  position returns undefined from a perfectly good reply. */
function firstText(message: any): string {
  const blocks = Array.isArray(message?.content) ? message.content : []
  for (const b of blocks) if (b?.type === 'text' && typeof b.text === 'string') return b.text
  return ''
}

export interface BatchResult {
  key: string
  value: CachedCall
  usage: unknown
  model: string | null
}

/**
 * Read a finished batch, as JSONL.
 *
 * An errored, cancelled or expired request becomes a cached ERROR rather than a
 * gap. A gap would be re-requested on the next tick, forever, and a sweep that
 * cannot finish is worse than one that reports a failed judge: the panel
 * already abstains gracefully on a judge it could not reach, and the ladder
 * already records a repair whose call fell over. Letting the failure through is
 * what makes those paths mean something.
 */
export async function readBatchResults(id: string): Promise<BatchResult[]> {
  const r = await anthropic(`${API}/${encodeURIComponent(id)}/results`, { method: 'GET' })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`batch_results_${r.status}:${body.slice(0, 160)}`)
  }
  const text = await r.text()
  const out: BatchResult[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let row: any
    try { row = JSON.parse(trimmed) } catch { continue }
    const key = String(row?.custom_id || '')
    if (!key) continue
    const result = row?.result || {}
    if (result.type === 'succeeded') {
      out.push({
        key,
        value: { text: firstText(result.message), error: null },
        usage: result.message?.usage,
        model: typeof result.message?.model === 'string' ? result.message.model : null,
      })
    } else {
      const why = result?.error?.type
        ? `${result.error.type}: ${String(result.error?.message || '').slice(0, 160)}`
        : String(result?.type || 'unknown')
      out.push({ key, value: { text: null, error: `batch_${why}` }, usage: null, model: null })
    }
  }
  return out
}

/**
 * The bus: what has been answered, what is wanted, and how to ask for it.
 *
 * Built fresh each tick. `open` loads every reply this sweep has already paid
 * for; `call` serves from that or defers; `flush` submits everything deferred
 * as one batch.
 */
export class BatchBus {
  private ready = new Map<string, CachedCall>()
  private wanted = new Map<string, Wanted>()
  private researchReady = new Map<string, unknown>()
  /** Buffered panel rows for the idea currently being walked. Written only if
   *  it finishes; a deferred idea re-walks next tick and would otherwise write
   *  the same panel_runs row again on every tick until it settled. */
  private buffer: { table: string; rows: Record<string, unknown>[] }[] = []

  private constructor(readonly sweepId: string, readonly dryRun: boolean) {}

  static async open(sweepId: string, dryRun: boolean): Promise<BatchBus> {
    const bus = new BatchBus(sweepId, dryRun)
    // Paged, because a sweep of 64 ideas reaches a few thousand rows and
    // supabase-js caps a select at 1000 by default. A silently truncated cache
    // would re-request everything past the first page and pay for it twice.
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('judge_sweep_cache')
        .select('key,kind,value')
        .eq('sweep_id', sweepId)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`sweep cache unreadable: ${error.message}`)
      for (const row of data || []) {
        const key = String((row as Record<string, unknown>).key)
        const value = (row as Record<string, unknown>).value
        if ((row as Record<string, unknown>).kind === 'research') bus.researchReady.set(key, value)
        else bus.ready.set(key, value as CachedCall)
      }
      if (!data || data.length < PAGE) break
    }
    return bus
  }

  /** How many replies this sweep already holds. Reported so a tick that
   *  advanced nothing is visibly a tick that advanced nothing. */
  get cached(): number { return this.ready.size + this.researchReady.size }
  get pending(): number { return this.wanted.size }

  /** Drop-in for callClaude. Answers, or defers. */
  call: ClaudeCall = async (opts: ClaudeOpts): Promise<string> => {
    const key = requestKey(opts)
    const hit = this.ready.get(key)
    if (hit) {
      // A cached failure is re-thrown exactly as a live one would be, so the
      // panel abstains and the repair records a failed call, rather than the
      // ladder seeing an empty string and treating it as an answer.
      if (hit.error) throw new Error(hit.error)
      return hit.text || ''
    }
    this.wanted.set(key, { key, opts })
    throw new DeferredCall(key, opts.agent || 'unattributed')
  }

  /**
   * A web lookup, cached for the life of the sweep.
   *
   * Unlike `call` this does NOT defer: the research providers are synchronous
   * HTTP and cheap beside a model call, so the first tick that needs one simply
   * makes it. What matters is that the second tick gets the same text back, or
   * the repair prompt it feeds changes and the repair never matches its own
   * cache entry.
   */
  async research<T>(query: string, lookup: () => Promise<T | null>): Promise<T | null> {
    const key = researchKey(query)
    if (this.researchReady.has(key)) {
      const v = this.researchReady.get(key)
      return (v && typeof v === 'object' && 'found' in (v as Record<string, unknown>)
        ? (v as Record<string, unknown>).found
        : null) as T | null
    }
    const found = await lookup()
    this.researchReady.set(key, { found })
    // NOT gated on dryRun. A dry run still makes the call and still spends the
    // money, and the cache is this sweep's own scratch space rather than any
    // part of the content. Skipping the write would make the next tick look up
    // again, change the repair prompt, miss the repair's own cached reply, and
    // stall a dry run on an idea that looks fine in every other respect.
    const { error } = await supabase.from('judge_sweep_cache').upsert({
      key, kind: 'research', sweep_id: this.sweepId, value: { found },
    }, { onConflict: 'key' })
    if (error) console.warn(`[sweep] research cache write failed: ${error.message}`)
    return found
  }

  /** Buffer a row instead of writing it. See `buffer` above for why. */
  hold(table: string, rows: Record<string, unknown>[]): void {
    if (rows.length) this.buffer.push({ table, rows })
  }

  /** The idea finished its walk: write everything held for it, in order. */
  async commit(): Promise<void> {
    const held = this.buffer
    this.buffer = []
    if (this.dryRun) return
    for (const { table, rows } of held) {
      const { error } = await supabase.from(table).insert(rows)
      if (error) console.warn(`[sweep] ${table} insert failed: ${error.message}`)
    }
  }

  /** The idea deferred: nothing it produced this tick is written. */
  abandon(): void { this.buffer = [] }

  /**
   * Submit everything deferred as one batch.
   *
   * Returns null when nothing was wanted, which is how the sweep knows it is
   * done. Results are NOT waited for: the next tick reads them.
   */
  async flush(): Promise<BatchRef | null> {
    if (!this.wanted.size) return null
    const requests = [...this.wanted.values()].map(w => ({
      custom_id: w.key,
      params: claudeRequestBody(w.opts),
    }))
    const id = await submitBatch(requests)
    return { id, requests: requests.length, submitted_at: new Date().toISOString(), read: false }
  }

  /** What each deferred request was for, so a tick can say what it is waiting
   *  on rather than only how many. */
  wantedByAgent(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const w of this.wanted.values()) {
      const agent = w.opts.agent || 'unattributed'
      out[agent] = (out[agent] || 0) + 1
    }
    return out
  }
}

/**
 * Pull a finished batch into the cache, metering what it cost.
 *
 * Metered HERE and once, at half price, because a batched reply is read by
 * every later tick and metering on read would count one call as five. The
 * discount is applied to the price and never to the token counts, so a batched
 * judge and a live judge still show the same `units` in meter_daily and the
 * difference between them is legible as dollars per token.
 */
export async function drainBatch(sweepId: string, ref: BatchRef): Promise<{ cached: number; errored: number }> {
  const results = await readBatchResults(ref.id)
  let errored = 0
  // One meter row per (model, agent) rather than one per reply: 576 individual
  // writes would be slower than the batch itself.
  const totals = new Map<string, { model: string; agent: string; input: number; output: number; cacheRead: number; cacheWrite: number; calls: number; failed: number }>()
  const rows: Record<string, unknown>[] = []

  for (const r of results) {
    if (r.value.error) errored++
    rows.push({ key: r.key, kind: 'call', sweep_id: sweepId, value: r.value })
    const u = (r.usage || {}) as Record<string, unknown>
    const model = r.model || 'unknown'
    const agent = 'judge-batch'
    const bucket = `${model}\u0000${agent}`
    const t = totals.get(bucket) || { model, agent, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, failed: 0 }
    t.input += Number(u.input_tokens) || 0
    t.output += Number(u.output_tokens) || 0
    t.cacheRead += Number(u.cache_read_input_tokens) || 0
    t.cacheWrite += Number(u.cache_creation_input_tokens) || 0
    t.calls += 1
    if (r.value.error) t.failed += 1
    totals.set(bucket, t)
  }

  {
    // Neither the cache nor the meter is gated on dryRun, and both would be
    // wrong to gate. The batch has already been submitted and already billed,
    // so a dry run that did not meter would under-report real spend — the one
    // failure a spend surface may never have. And a dry run that did not cache
    // would resubmit the whole ladder on its next tick and pay for it again,
    // which is the opposite of what a dry run is for.
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('judge_sweep_cache').upsert(rows.slice(i, i + 500), { onConflict: 'key' })
      if (error) throw new Error(`sweep cache write failed: ${error.message}`)
    }
    for (const t of totals.values()) {
      await meter.anthropicCall({
        agent: t.agent,
        model: t.model,
        usage: {
          input_tokens: t.input,
          output_tokens: t.output,
          cache_read_input_tokens: t.cacheRead,
          cache_creation_input_tokens: t.cacheWrite,
        },
        calls: t.calls,
        failedCalls: t.failed,
        discount: BATCH_DISCOUNT,
      })
    }
  }
  return { cached: rows.length, errored }
}
