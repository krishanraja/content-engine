// The model provider, as the engine last saw it.
//
// From about 10:00 UTC on 2026-09-27 the engine's Anthropic key was over the
// account's usage limit: "You have reached your specified API usage limits.
// You will regain access on 2026-10-01 at 00:00 UTC." Nothing said so for 33
// hours. judge_verdicts gained 8,046 blank abstentions that day and 11,079 the
// next, the judge sweep logged `ok` every ten minutes, meter_daily showed no
// failed call, and two drafting sessions found out only when a draft came back
// refused (walk log F28 to F31).
//
// Three things were missing, and this module holds the shared part of each:
//
//   classifyAnthropicFailure  a name for what went wrong, so a usage limit
//                             reads differently from an overload or a bad
//                             request, with the reset time when the provider
//                             gives one;
//   recordAnthropicFailure    a record of it that outlives the process that
//                             saw it, in system_config (the same table Control
//                             Center keeps its own Anthropic breaker in, under
//                             a key of its own: the two projects may run on
//                             different keys, so neither may trip the other);
//   providerHealth            whether the engine can write or check anything
//                             now, in one plain sentence.
//
// No database import at module scope, for the reason _meter.ts gives: the eval
// scripts, the guards and the tests load this with no Supabase environment.

export type ProviderFailureClass =
  | 'usage_limit' // the account's own usage limit ("specified API usage limits")
  | 'credit'      // the balance is spent
  | 'auth'        // the key is missing, wrong or revoked
  | 'overload'    // 529, or an overloaded_error in a stream
  | 'rate_limit'  // 429
  | 'server'      // 5xx, or the provider could not be reached
  | 'timeout'     // our own deadline
  | 'request'     // any other 4xx: the request itself was refused
  | 'unknown'

export interface ProviderFailure {
  provider: 'anthropic'
  class: ProviderFailureClass
  status: number | null
  /** The provider's own words, without the engine's `anthropic_NNN:` prefix. */
  message: string
  /** When the provider said access returns, when it said. ISO 8601. */
  reset_at: string | null
  at: string
  agent?: string | null
  model?: string | null
}

/** How each class reads in a sentence. */
export const CLASS_LABEL: Record<ProviderFailureClass, string> = {
  usage_limit: 'over its usage limit',
  credit: 'out of credit',
  auth: 'refusing the API key',
  overload: 'overloaded',
  rate_limit: 'rate limiting the engine',
  server: 'failing on its side or unreachable',
  timeout: 'too slow to answer inside the deadline',
  request: 'refusing a request as malformed',
  unknown: 'failing without saying why',
}

/** The classes after which no call can succeed until the account or the key
 *  changes. A run that meets one stops; a transient class only backs off. */
const EVERY_CALL_REFUSED: ReadonlySet<ProviderFailureClass> = new Set(['usage_limit', 'credit', 'auth'])

export function refusesEveryCall(cls: ProviderFailureClass): boolean {
  return EVERY_CALL_REFUSED.has(cls)
}

/** How long a refusal with no stated reset is assumed to last before the
 *  judge sweep tries the provider once more. An hour: long enough that the
 *  sweep stops hammering a dead key every ten minutes, short enough that a
 *  fixed key is noticed the same morning. */
export const BLIND_RETRY_MS = 60 * 60_000

/** A transient failure this recent makes the provider `degraded`. */
const DEGRADED_FOR_MS = 15 * 60_000

/** "You will regain access on 2026-10-01 at 00:00 UTC" as an ISO time. */
export function parseResetAt(message: string): string | null {
  const m = /regain access on (\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{2}:\d{2}))?/i.exec(String(message || ''))
  if (!m) return null
  const when = new Date(`${m[1]}T${m[2] || '00:00'}:00Z`)
  return Number.isNaN(when.getTime()) ? null : when.toISOString()
}

/** What an error thrown by a model call amounts to. Reads the status the
 *  engine's helpers attach (`anthropic_400:...`, `e.status`) and the
 *  provider's words, because Anthropic returns its usage limit and a spent
 *  balance as a 400, the same status as a malformed request. */
export function classifyAnthropicFailure(err: unknown, now: Date = new Date()): ProviderFailure {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : String((err as { message?: unknown })?.message ?? err ?? '')
  const attached = Number((err as { status?: unknown })?.status)
  const prefixed = /anthropic_(\d{3})\b/.exec(raw)
  const status = Number.isInteger(attached) && attached >= 100 ? attached : prefixed ? Number(prefixed[1]) : null
  const message = raw.replace(/^\s*anthropic_(\d{3}|timeout_\d+ms|stream_error)\s*:?\s*/i, '').trim().slice(0, 300) || raw.slice(0, 300)
  const text = raw.toLowerCase()

  let cls: ProviderFailureClass
  if (/usage limit/.test(text)) cls = 'usage_limit'
  else if (status === 402 || /credit balance|insufficient_quota|insufficient credit|billing|payment required/.test(text)) cls = 'credit'
  else if (status === 401 || status === 403 || /invalid x-api-key|authentication_error|permission_error|api key|not configured/.test(text)) cls = 'auth'
  else if (status === 529 || /overloaded/.test(text)) cls = 'overload'
  else if (status === 429 || /rate.?limit/.test(text)) cls = 'rate_limit'
  else if (/anthropic_timeout|aborterror|timed out|timeout/.test(text)) cls = 'timeout'
  else if ((status !== null && status >= 500) || /fetch failed|econn|enotfound|socket|upstream_unreachable|network/.test(text)) cls = 'server'
  else if (status !== null && status >= 400) cls = 'request'
  else cls = 'unknown'

  return { provider: 'anthropic', class: cls, status, message, reset_at: parseResetAt(raw), at: now.toISOString() }
}

/** The failure the rest should be reported by: one that refuses every call
 *  wins over a transient one, else the first. */
export function worstFailure(failures: ProviderFailure[]): ProviderFailure | null {
  return failures.find(f => refusesEveryCall(f.class)) ?? failures[0] ?? null
}

/** Thrown when a stage could not reach the model at all: every judge of a
 *  panel failed with an error, or the expansion was refused in a way that
 *  refuses every call. It is a failed run. Recording it as a row of
 *  abstentions is what wrote 19,125 blank verdicts in 33 hours. */
export class ModelUnavailableError extends Error {
  readonly modelUnavailable = true
  constructor(readonly failure: ProviderFailure, readonly stage: 'panel' | 'expand', readonly judges = 0) {
    super(`the model could not be reached (${stage}): ${failure.class}: ${failure.message}`)
    this.name = 'ModelUnavailableError'
  }
}

export function isModelUnavailable(e: unknown): e is ModelUnavailableError {
  return Boolean(e) && (e as ModelUnavailableError).modelUnavailable === true
}

/** One plain sentence about a failure, for a run ledger or an error body. */
export function describeFailure(f: ProviderFailure): string {
  const reset = f.reset_at ? ` Access returns at ${f.reset_at.slice(0, 16).replace('T', ' ')} UTC, by its own account.` : ''
  return `Anthropic is ${CLASS_LABEL[f.class]}${f.status ? ` (HTTP ${f.status})` : ''}: "${f.message}".${reset}`
}

// ── What the engine can do now ─────────────────────────────────────────────

export interface ProviderHealth {
  provider: 'anthropic'
  /** False only when the provider has said it will refuse every call. */
  usable: boolean
  state: 'ok' | 'degraded' | 'unavailable' | 'unconfirmed'
  /** The answer in one or two plain sentences. */
  says: string
  last_failure: (ProviderFailure & { class_label: string }) | null
  last_ok_at: string | null
  reset_at: string | null
  /** When the judge sweep will next try the provider, while it is refusing. */
  retry_after: string | null
}

const STAGES = 'Drafting, rewriting, the final pass, the fact gate and the judges all run on it'
const when = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`

export function providerHealth(failure: ProviderFailure | null, okAt: string | null, now: Date = new Date()): ProviderHealth {
  const base = { provider: 'anthropic' as const, last_ok_at: okAt, last_failure: failure ? { ...failure, class_label: CLASS_LABEL[failure.class] } : null }
  if (!failure) {
    return { ...base, usable: true, state: 'ok', reset_at: null, retry_after: null,
      says: okAt ? `Anthropic is answering (last success ${when(okAt)}). No failure on record.` : 'No Anthropic failure on record.' }
  }
  const failedAt = Date.parse(failure.at)
  const recovered = okAt !== null && Date.parse(okAt) > failedAt
  if (recovered) {
    return { ...base, usable: true, state: 'ok', reset_at: null, retry_after: null,
      says: `Anthropic is answering again (last success ${when(okAt as string)}). Its last failure, at ${when(failure.at)}, was: ${CLASS_LABEL[failure.class]}.` }
  }
  if (refusesEveryCall(failure.class)) {
    const reset = failure.reset_at ? Date.parse(failure.reset_at) : null
    if (reset !== null && now.getTime() >= reset) {
      return { ...base, usable: true, state: 'unconfirmed', reset_at: failure.reset_at, retry_after: null,
        says: `Anthropic said access would return at ${when(failure.reset_at as string)}, which has passed. No call has succeeded since it failed at ${when(failure.at)}, so the next one will show whether it is back.` }
    }
    const retry = reset ?? failedAt + BLIND_RETRY_MS
    return { ...base, usable: false, state: 'unavailable', reset_at: failure.reset_at, retry_after: new Date(retry).toISOString(),
      says: `The engine cannot write or check anything: Anthropic is ${CLASS_LABEL[failure.class]} since ${when(failure.at)}` +
        (failure.reset_at ? ` and says access returns at ${when(failure.reset_at)}.` : ', and it gave no time when that ends. Nothing works until the account or the key is fixed.') +
        ` ${STAGES}.` }
  }
  const recent = now.getTime() - failedAt < DEGRADED_FOR_MS
  return { ...base, usable: true, state: recent ? 'degraded' : 'ok', reset_at: failure.reset_at, retry_after: null,
    says: recent
      ? `Anthropic was ${CLASS_LABEL[failure.class]} at ${when(failure.at)}; calls may fail for a few minutes.`
      : `Anthropic is usable. Its last failure, at ${when(failure.at)}, was: ${CLASS_LABEL[failure.class]}.` }
}

/** Whether a caller that can wait (the judge sweep) should leave the provider
 *  alone for now: it has refused every call and the time to try again, its
 *  own stated reset or an hour after a refusal with none, has not come. */
export function providerRefusing(health: ProviderHealth, now: Date = new Date()): boolean {
  if (health.state !== 'unavailable' || !health.retry_after) return false
  return now.getTime() < Date.parse(health.retry_after)
}

// ── The record ─────────────────────────────────────────────────────────────
//
// Two plain rows, so a failure and a recovery never overwrite each other:
// the last failure as JSON, and the time of the first success after it.

export const FAILURE_KEY = 'content_engine_anthropic_failure'
export const OK_KEY = 'content_engine_anthropic_ok_at'

/** A burst of nine judges failing together is one fact, written once. */
const WRITE_EVERY_MS = 60_000
/** A success looks the record up at most this often per process. */
const READ_EVERY_MS = 60_000

let lastWrite: { class: ProviderFailureClass; at: number } | null = null
let cache: { failureAt: string | null; okAt: string | null; readAt: number } | null = null

type Db = { from: (table: string) => any }
async function db(): Promise<Db | null> {
  try {
    const { supabase } = await import('./_supabase.js')
    return supabase as unknown as Db
  } catch {
    return null
  }
}

export function parseFailure(value: unknown): ProviderFailure | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const f = JSON.parse(value) as ProviderFailure
    if (!f || typeof f !== 'object' || typeof f.at !== 'string' || !(f.class in CLASS_LABEL)) return null
    return { provider: 'anthropic', class: f.class, status: f.status ?? null, message: String(f.message || ''), reset_at: f.reset_at ?? null, at: f.at, agent: f.agent ?? null, model: f.model ?? null }
  } catch {
    return null
  }
}

/** The recorded state, read fresh. */
export async function readProviderState(): Promise<{ failure: ProviderFailure | null; okAt: string | null; error: string | null }> {
  const supabase = await db()
  if (!supabase) return { failure: null, okAt: null, error: 'supabase not configured' }
  try {
    const { data, error } = await supabase.from('system_config').select('key,value').in('key', [FAILURE_KEY, OK_KEY])
    if (error) return { failure: null, okAt: null, error: String(error.message || error) }
    const rows = (Array.isArray(data) ? data : []) as Array<{ key: string; value: unknown }>
    const failure = parseFailure(rows.find(r => r.key === FAILURE_KEY)?.value)
    const okRaw = rows.find(r => r.key === OK_KEY)?.value
    const okAt = typeof okRaw === 'string' && !Number.isNaN(Date.parse(okRaw)) ? new Date(okRaw).toISOString() : null
    cache = { failureAt: failure?.at ?? null, okAt, readAt: Date.now() }
    return { failure, okAt, error: null }
  } catch (e) {
    return { failure: null, okAt: null, error: (e as Error)?.message || String(e) }
  }
}

/** Keep the failure where the health endpoint and the judge sweep read it.
 *  Best effort: a record that cannot be written must never fail the call
 *  that is already failing. */
export async function recordAnthropicFailure(f: ProviderFailure): Promise<void> {
  const now = Date.now()
  if (lastWrite && lastWrite.class === f.class && now - lastWrite.at < WRITE_EVERY_MS) return
  lastWrite = { class: f.class, at: now }
  cache = { failureAt: f.at, okAt: cache?.okAt ?? null, readAt: cache?.readAt ?? 0 }
  const supabase = await db()
  if (!supabase) return
  try {
    const { error } = await supabase.from('system_config')
      .upsert({ key: FAILURE_KEY, value: JSON.stringify(f), updated_at: new Date(now).toISOString() }, { onConflict: 'key' })
    if (error) console.warn(`[model-provider] could not record the failure: ${error.message || error}`)
  } catch (e) {
    console.warn(`[model-provider] recording the failure threw: ${(e as Error)?.message || e}`)
  }
}

/** Note the first success after a recorded failure, so health can say the
 *  provider is back. Reads the record at most once a minute per process and
 *  writes only when a failure is newer than the last success. */
export async function noteAnthropicSuccess(): Promise<void> {
  try {
    const now = Date.now()
    if (!cache || now - cache.readAt > READ_EVERY_MS) {
      const state = await readProviderState()
      if (state.error) { cache = { failureAt: null, okAt: null, readAt: now }; return }
    }
    if (!cache?.failureAt) return
    if (cache.okAt && Date.parse(cache.okAt) > Date.parse(cache.failureAt)) return
    const okAt = new Date(now).toISOString()
    cache = { ...cache, okAt }
    const supabase = await db()
    if (!supabase) return
    const { error } = await supabase.from('system_config')
      .upsert({ key: OK_KEY, value: okAt, updated_at: okAt }, { onConflict: 'key' })
    if (error) console.warn(`[model-provider] could not record the recovery: ${error.message || error}`)
  } catch (e) {
    console.warn(`[model-provider] noting a success threw: ${(e as Error)?.message || e}`)
  }
}

/** Forget what this process remembers. Tests only. */
export function resetProviderMemory(): void {
  lastWrite = null
  cache = null
}
