// What a failed run is allowed to leave behind.
//
// Two inspiration_scan runs failed on 2026-09-08 and recorded `counts: {}` and
// a reason string. That is enough to know something broke and not enough to fix
// it, so the failure had to be reproduced by hand against live data. An engine
// that loses the evidence of its own failures relearns them.
//
// The constraint that makes this safe to keep is that an artifact is a bounded,
// redacted snapshot, never a payload. Prompts and model responses pass through
// here on their way to storage, and those carry whatever the row they were
// built from carried.
//
// Pure by construction: imports nothing outside node:, so the guard and the
// tests run with no database, no network and no key.

/** The kinds of failure worth keeping. Pinned against the table's CHECK
 *  constraint; check-run-recovery.ts holds them together. */
export const ARTIFACT_KINDS = ['handler_error', 'llm_parse_failure', 'schema_rejection', 'http_failure'] as const
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number]

/** A single artifact is capped well under the row limits. A failure needs the
 *  shape of what came back, not all of it: the first 4kB of a bad model
 *  response says which field was missing, and the next 200kB says it again. */
export const MAX_ARTIFACT_CHARS = 4_000
export const MAX_ARTIFACT_KEYS = 24

/** Key names whose values never survive, matched case-insensitively anywhere in
 *  the key. These routes handle Anthropic, OpenAI, Perplexity, Exa, Apify and
 *  Supabase credentials, and a prompt assembled from config can carry one. */
const SECRET_KEY = /(secret|token|key|password|passwd|credential|authorization|auth|cookie|bearer|signature|session)/i

/** Values that look like a credential regardless of what the key is called.
 *  Redaction by key alone fails the moment something is logged as `detail`. */
const SECRET_VALUE = [
  /\b(sk|rt|ex|pk|sbp|vcp|ghp|gho|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
]

export const REDACTED = '[redacted]'

/** Strip credentials out of one string. Exported for the guard, which asserts
 *  the known token shapes are all covered. */
export function redactText(input: string): string {
  let out = input
  for (const pattern of SECRET_VALUE) out = out.replace(pattern, REDACTED)
  return out
}

function truncate(input: string): string {
  return input.length <= MAX_ARTIFACT_CHARS ? input : `${input.slice(0, MAX_ARTIFACT_CHARS)}…[${input.length} chars total]`
}

/** Reduce anything a handler wants to keep to a bounded, redacted object.
 *
 *  Depth is capped at two because an artifact is evidence, not a dump, and an
 *  unbounded walk over a Supabase error object reaches the request that caused
 *  it, headers included. */
export function redactArtifact(payload: unknown, depth = 0): unknown {
  if (payload === null || payload === undefined) return null
  if (typeof payload === 'number' || typeof payload === 'boolean') return payload
  if (typeof payload === 'string') return truncate(redactText(payload))
  if (payload instanceof Error) {
    return { name: payload.name, message: truncate(redactText(payload.message)) }
  }
  if (Array.isArray(payload)) {
    if (depth >= 2) return `[${payload.length} items]`
    return payload.slice(0, MAX_ARTIFACT_KEYS).map(item => redactArtifact(item, depth + 1))
  }
  if (typeof payload === 'object') {
    if (depth >= 2) return '[object]'
    const out: Record<string, unknown> = {}
    let kept = 0
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (kept >= MAX_ARTIFACT_KEYS) { out['…'] = 'truncated'; break }
      out[key] = SECRET_KEY.test(key) ? REDACTED : redactArtifact(value, depth + 1)
      kept += 1
    }
    return out
  }
  // Functions and symbols are not evidence and have no business being stored.
  return null
}

export interface RunArtifact {
  job: string
  kind: ArtifactKind
  reason: string | null
  payload: unknown
}

/** Build the artifact a failed run leaves, or null when there is nothing worth
 *  keeping. Returning null rather than an empty row matters: a table of empty
 *  artifacts is indistinguishable from one nobody writes to. */
export function artifactForFailure(
  job: string,
  status: string,
  reason: string | null,
  body: unknown,
): RunArtifact | null {
  if (status !== 'failed') return null
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  const kind: ArtifactKind = typeof record.parse_failure === 'string' || typeof record.raw_response === 'string'
    ? 'llm_parse_failure'
    : typeof record.schema_error === 'string'
      ? 'schema_rejection'
      : reason && /^http_\d{3}$/.test(reason)
        ? 'http_failure'
        : 'handler_error'
  return {
    job,
    kind,
    reason: reason ? truncate(redactText(reason)) : null,
    payload: redactArtifact(body),
  }
}
