// What counts as an admissible row in the edit ledger.
//
// This lives apart from the route on purpose. The rules below decide what
// evidence the weekly compiler is allowed to reason from, and evidence rules
// have to be checkable without a database, a network or a key. When they were
// exported from the route, the guard that checks them could only run on a
// machine that happened to have Supabase credentials in its shell.
//
// Two rules the ledger exists to hold:
//
//   Bounded. Hashes, a structured diff, a preset key, and an excerpt only when
//   he typed one. Never two full bodies, never a conversation. The privacy line
//   is ADR-017's and it does not move because the subject changed from video to
//   text.
//
//   Anti-echo. This data may inform form and craft. It must never rank a
//   candidate higher because he showed interest in its subject. Nothing here
//   stores a topic, and check-judges.ts fails the build if a scorer starts
//   reading this table.

import { createHash } from 'node:crypto'

const ACTIONS = new Set([
  'manual_edit',
  'magic_invoked', 'magic_accepted', 'magic_rejected',
  'section_kept', 'section_dropped',
  'final_pass_accepted', 'final_pass_dismissed',
  'approved', 'binned', 'published', 'external_final_captured',
])
const ARTIFACT_KINDS = new Set(['draft', 'brief_section', 'headline', 'thesis', 'caption', 'script', 'external_final'])
const SUBJECT_TABLES = new Set(['content_ideas', 'weekly_briefs', 'video_studio_jobs'])
const SURFACES = new Set(['composer', 'brief_editor', 'mobile_deck', 'video_review', 'carousel_review', 'triage', 'api'])
const CLIENTS = new Set(['desktop', 'mobile', 'codex', 'claude_code', 'claude_ai', 'chatgpt', 'runner', 'cron'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA256 = /^[a-f0-9]{64}$/

export function sha256(text: string): string {
  return createHash('sha256').update(text ?? '').digest('hex')
}

// ── Whose event is it ───────────────────────────────────────────────────────
//
// The weekly compiler learns Krish's taste from this table, and `actor`
// defaults to 'Krish'. Until 2026-09-24 every row an agent session wrote took
// that default, so a draft the agent asked for, or a rewrite the agent kept,
// would have been learned as his. Found on the three-piece walk, whose own
// drafting would have been the first such rows.
//
// The rule is the Studio's (packages/core/src/feedback.ts): an event whose
// origin is not Krish is an observation, never a preference. An operator
// session (the bearer token) acts as itself unless it says it is relaying a
// decision Krish made in words, with `decided_by: 'Krish'`. Saying so is
// deliberate and auditable; the default can never pass for him.

/** Clients that are an agent acting, not Krish's hand on a device. */
export const AGENT_CLIENTS = new Set(['codex', 'claude_code', 'claude_ai', 'chatgpt', 'runner', 'cron'])

/** The actions that settle a judge's prediction in judge_calibration. Only
 *  Krish makes these; an agent may relay one, never take one. */
export const DECISION_ACTIONS = new Set(['approved', 'binned', 'published'])

export interface OperatorAttribution {
  surface: 'api'
  client: string
  actor: string
  /** True unless the session is relaying Krish's own decision. */
  observation: boolean
}

/**
 * Attribution for a request that came in on the operator bearer. Null for a
 * browser (the cookie), whose events are Krish's on the surface it names.
 */
export function operatorAttribution(authorization: unknown, body: unknown): OperatorAttribution | null {
  if (!/^Bearer\s/i.test(String(authorization || ''))) return null
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const client = typeof b.client === 'string' && AGENT_CLIENTS.has(b.client) ? b.client : 'claude_code'
  const relayed = b.decided_by === 'Krish'
  return { surface: 'api', client, actor: relayed ? 'Krish' : client, observation: !relayed }
}

export interface EditEventInput {
  idempotency_key: string
  subject_table: string
  subject_id: string
  artifact_kind: string
  action: string
  surface: string
  client: string
  session_id?: string | null
  panel_run_id?: string | null
  mode?: string | null
  value?: string | null
  instruction?: string | null
  selection_hash?: string | null
  before_hash?: string | null
  after_hash?: string | null
  delta_features?: unknown
  chars_before?: number | null
  chars_after?: number | null
  dwell_ms?: number | null
  reason_code?: string | null
  confirmation_state?: string | null
  actor?: string
}

/** Fail closed and say which field. A ledger that silently accepts a malformed
 *  row is worse than one that refuses: the row looks like evidence forever. */
export function validateEditEvent(input: unknown): { ok: true; value: EditEventInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'body_must_be_an_object' }
  const b = input as Record<string, unknown>
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : null)

  const idempotency_key = str('idempotency_key')
  if (!idempotency_key || !UUID.test(idempotency_key)) return { ok: false, error: 'idempotency_key_must_be_a_uuid' }

  const subject_table = str('subject_table')
  if (!subject_table || !SUBJECT_TABLES.has(subject_table)) return { ok: false, error: 'unknown_subject_table' }

  const subject_id = str('subject_id')
  if (!subject_id || subject_id.length > 200) return { ok: false, error: 'subject_id_required' }

  const artifact_kind = str('artifact_kind')
  if (!artifact_kind || !ARTIFACT_KINDS.has(artifact_kind)) return { ok: false, error: 'unknown_artifact_kind' }

  const action = str('action')
  if (!action || !ACTIONS.has(action)) return { ok: false, error: 'unknown_action' }

  const surface = str('surface')
  if (!surface || !SURFACES.has(surface)) return { ok: false, error: 'unknown_surface' }

  const client = str('client')
  if (!client || !CLIENTS.has(client)) return { ok: false, error: 'unknown_client' }

  for (const key of ['before_hash', 'after_hash', 'selection_hash']) {
    const v = str(key)
    if (v && !SHA256.test(v)) return { ok: false, error: `${key}_must_be_sha256` }
  }
  for (const key of ['session_id', 'panel_run_id']) {
    const v = str(key)
    if (v && !UUID.test(v)) return { ok: false, error: `${key}_must_be_a_uuid` }
  }

  // The two invariants the table also enforces, checked here so the caller gets
  // a reason rather than a constraint violation.
  const before_hash = str('before_hash')
  const after_hash = str('after_hash')
  if ((action === 'magic_accepted' || action === 'magic_rejected') && !before_hash) {
    return { ok: false, error: 'a_resolution_must_name_what_it_resolved' }
  }
  if ((action === 'manual_edit' || action === 'magic_accepted' || action === 'external_final_captured') && !after_hash) {
    return { ok: false, error: 'a_change_must_name_its_result' }
  }

  const instruction = str('instruction')
  if (instruction && instruction.length > 1600) return { ok: false, error: 'instruction_too_long' }

  const delta = b.delta_features
  if (delta !== undefined && !Array.isArray(delta)) return { ok: false, error: 'delta_features_must_be_an_array' }

  return {
    ok: true,
    value: {
      idempotency_key,
      subject_table,
      subject_id,
      artifact_kind,
      action,
      surface,
      client,
      session_id: str('session_id'),
      panel_run_id: str('panel_run_id'),
      mode: str('mode'),
      value: str('value'),
      instruction,
      selection_hash: str('selection_hash'),
      before_hash,
      after_hash,
      delta_features: Array.isArray(delta) ? delta.slice(0, 200) : [],
      chars_before: typeof b.chars_before === 'number' ? b.chars_before : null,
      chars_after: typeof b.chars_after === 'number' ? b.chars_after : null,
      dwell_ms: typeof b.dwell_ms === 'number' ? b.dwell_ms : null,
      reason_code: str('reason_code'),
      confirmation_state: str('confirmation_state') || 'not_applicable',
    },
  }
}
