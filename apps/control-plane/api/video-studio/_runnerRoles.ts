// Which Windows runner may take work, and how each one looks from the cloud.
//
// Ruling (Krish, 2026-09-28): a second Windows machine is a cold standby with
// its task disabled. The roles live in video_studio_runner_roles
// (supabase/migrations/20260928120000_video_studio_runner_roles.sql), where the
// claim functions enforce them. This module mirrors that rule for the routes
// that read it (the brief claim's early answer, the health route, the watch
// and the operator's roster) so they cannot drift from each other.

export const RUNNER_ROLES = ['active', 'standby', 'retired'] as const
export type RunnerRole = typeof RUNNER_ROLES[number]
/** 'unfenced' until the roles are seeded; 'unassigned' for a hash with no row. */
export type RunnerStanding = RunnerRole | 'unassigned' | 'unfenced'

/** The heartbeat lease (runner/heartbeat.ts): a runner heard within it is up. */
export const RUNNER_FRESH_SECONDS = 120
/** Documents and screens name a runner by this many characters of its hash. */
export const RUNNER_PREFIX_LENGTH = 8

export interface RunnerRoleRow {
  runner_id_hash: string
  role: RunnerRole
  set_by?: string | null
  set_at?: string | null
  reason?: string | null
}

export interface RunnerHeartbeatRow {
  runner_id_hash: string
  runner_status: string
  drive_state: string
  software_commit: string
  active_command_id: string | null
  pending_receipts: number
  occurred_at: string
  received_at: string
}

export const RUNNER_HEARTBEAT_COLUMNS = 'runner_id_hash,runner_status,drive_state,software_commit,active_command_id,pending_receipts,occurred_at,received_at'
export const RUNNER_ROLE_COLUMNS = 'runner_id_hash,role,set_by,set_at,reason'

/** Mirrors public.video_studio_runner_lease_standing. */
export function runnerStanding(roles: ReadonlyArray<Pick<RunnerRoleRow, 'runner_id_hash' | 'role'>>, runnerIdHash: string): RunnerStanding {
  if (roles.length === 0) return 'unfenced'
  return roles.find((row) => row.runner_id_hash === runnerIdHash)?.role ?? 'unassigned'
}

/** New commands and briefs go only to the active runner, or to anyone before the seed. */
export function mayStartNewWork(standing: RunnerStanding): boolean {
  return standing === 'active' || standing === 'unfenced'
}

export interface RunnerRosterEntry {
  runner_id_hash: string
  runner_id_prefix: string
  role: RunnerRole | 'unassigned'
  last_heartbeat_at: string | null
  heartbeat_age_seconds: number | null
  fresh: boolean
  runner_status: string | null
  drive_state: string | null
  software_commit: string | null
  pending_receipts: number | null
  working: boolean
  role_set_at: string | null
  role_set_by: string | null
  role_reason: string | null
}

export interface RunnerRoster {
  /** True once the roles are seeded: only the active runner is leased new work. */
  fenced: boolean
  /** The active runner; before the seed, the runner heard most recently. */
  active: RunnerRosterEntry | null
  /** How `active` was chosen. */
  active_basis: 'role' | 'latest_heartbeat_unfenced' | 'none'
  standby: RunnerRosterEntry[]
  /** Heartbeating runners with no role row, newest first. Before the seed, every other runner. */
  unassigned: RunnerRosterEntry[]
  retired_count: number
}

function ageSeconds(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return null
  return Math.max(0, Math.round((now.getTime() - at) / 1000))
}

function entry(
  hash: string,
  role: RunnerRole | 'unassigned',
  heartbeat: RunnerHeartbeatRow | undefined,
  roleRow: RunnerRoleRow | undefined,
  now: Date,
): RunnerRosterEntry {
  const age = ageSeconds(heartbeat?.received_at, now)
  return {
    runner_id_hash: hash,
    runner_id_prefix: hash.slice(0, RUNNER_PREFIX_LENGTH),
    role,
    last_heartbeat_at: heartbeat?.received_at ?? null,
    heartbeat_age_seconds: age,
    fresh: age !== null && age <= RUNNER_FRESH_SECONDS,
    runner_status: heartbeat?.runner_status ?? null,
    drive_state: heartbeat?.drive_state ?? null,
    software_commit: heartbeat?.software_commit ?? null,
    pending_receipts: heartbeat?.pending_receipts ?? null,
    working: Boolean(heartbeat?.active_command_id),
    role_set_at: roleRow?.set_at ?? null,
    role_set_by: roleRow?.set_by ?? null,
    role_reason: roleRow?.reason ?? null,
  }
}

const newestFirst = (a: RunnerRosterEntry, b: RunnerRosterEntry) =>
  (a.heartbeat_age_seconds ?? Number.MAX_SAFE_INTEGER) - (b.heartbeat_age_seconds ?? Number.MAX_SAFE_INTEGER)

/**
 * The runners as the cloud sees them. Retired runners are counted and never
 * listed, so the stale rows of old bearers stop reading as machines.
 */
export function runnerRoster(
  roles: ReadonlyArray<RunnerRoleRow>,
  heartbeats: ReadonlyArray<RunnerHeartbeatRow>,
  now: Date,
): RunnerRoster {
  const beats = new Map(heartbeats.map((row) => [row.runner_id_hash, row]))
  const roleByHash = new Map(roles.map((row) => [row.runner_id_hash, row]))
  const fenced = roles.length > 0
  const activeRow = roles.find((row) => row.role === 'active')
  const standby = roles
    .filter((row) => row.role === 'standby')
    .map((row) => entry(row.runner_id_hash, 'standby', beats.get(row.runner_id_hash), row, now))
    .sort(newestFirst)
  const unassigned = heartbeats
    .filter((row) => !roleByHash.has(row.runner_id_hash))
    .map((row) => entry(row.runner_id_hash, 'unassigned', row, undefined, now))
    .sort(newestFirst)
  const retiredCount = roles.filter((row) => row.role === 'retired').length

  if (activeRow) {
    return {
      fenced,
      active: entry(activeRow.runner_id_hash, 'active', beats.get(activeRow.runner_id_hash), activeRow, now),
      active_basis: 'role',
      standby,
      unassigned,
      retired_count: retiredCount,
    }
  }
  // Unseeded: every runner can claim, so the one to watch is the one heard last.
  const [latest, ...rest] = unassigned
  return {
    fenced,
    active: latest ?? null,
    active_basis: latest ? 'latest_heartbeat_unfenced' : 'none',
    standby,
    unassigned: rest,
    retired_count: retiredCount,
  }
}

export interface RunnerAttention {
  code:
    | 'active_runner_silent_with_work_waiting'
    | 'no_runner_with_work_waiting'
    | 'standby_heartbeating_while_active_down'
    | 'unassigned_runner_heartbeating'
    | 'several_runners_unfenced'
  line: string
}

/**
 * The rule that has always held (runner_watch): silence with nothing waiting
 * is fine, silence with work waiting is an alert. What changed is whose
 * silence counts: the active runner's, never a standby's or a retired row's.
 * The other three are what a failover, a drill or a bearer rotation leaves
 * behind when the roles were not switched with it, and the one hazard of the
 * time before the seed: two runners up, both able to take work.
 */
export function runnerAttention(roster: RunnerRoster, waiting: number, silentAfterSeconds: number): RunnerAttention[] {
  const out: RunnerAttention[] = []
  const active = roster.active
  const activeAge = active?.heartbeat_age_seconds ?? null
  const activeDown = activeAge === null || activeAge > RUNNER_FRESH_SECONDS
  const activeSilent = activeAge === null || activeAge > silentAfterSeconds
  if (waiting > 0 && !active) {
    out.push({
      code: 'no_runner_with_work_waiting',
      line: `No Studio runner has ever reported, and ${waiting} item${waiting === 1 ? ' is' : 's are'} waiting for one.`,
    })
  } else if (waiting > 0 && active && activeSilent) {
    const hours = activeAge === null ? null : Math.round(activeAge / 360) / 10
    out.push({
      code: 'active_runner_silent_with_work_waiting',
      line: `The ${roster.fenced ? 'active ' : ''}Studio runner ${active.runner_id_prefix} has been silent${hours === null ? '' : ` for ${hours} hours`} with ${waiting} item${waiting === 1 ? '' : 's'} waiting.`,
    })
  }
  if (roster.fenced && activeDown) {
    const up = roster.standby.find((row) => row.fresh)
    if (up) {
      out.push({
        code: 'standby_heartbeating_while_active_down',
        line: `Standby runner ${up.runner_id_prefix} is heartbeating while the active runner is not. It takes no work until the active role is switched to it.`,
      })
    }
  }
  if (roster.fenced) {
    const stray = roster.unassigned.find((row) => row.fresh)
    if (stray) {
      out.push({
        code: 'unassigned_runner_heartbeating',
        line: `Runner ${stray.runner_id_prefix} is heartbeating with no role, so it takes no work. After a bearer rotation every runner reports under a new hash; switch the active role to it if it is the primary.`,
      })
    }
  } else if (active?.fresh && roster.unassigned.some((row) => row.fresh)) {
    out.push({
      code: 'several_runners_unfenced',
      line: 'More than one Studio runner is heartbeating and the runner roles are not seeded, so either could be leased work. Stop and disable the one that should not be running.',
    })
  }
  return out
}

/** The exact empty answers a runner at 6bf7862 parses as "nothing to claim". */
export const NOTHING_TO_CLAIM_BRIEF = Object.freeze({ ok: true, schema_version: 1, item: null })
export const NOTHING_TO_CLAIM_COMMAND = Object.freeze({ ok: true, schema_version: 1, command: null })

export interface SwitchActiveRunnerRequest {
  schema_version: 1
  action: 'switch_active'
  to_runner_id_hash: string
  expected_active_runner_id_hash: string
  reason: string
}

export interface SetRunnerRoleRequest {
  schema_version: 1
  action: 'set_role'
  runner_id_hash: string
  role: 'standby' | 'retired'
  reason: string
}

export type RunnerRoleRequest = SwitchActiveRunnerRequest | SetRunnerRoleRequest

const HASH = /^[a-f0-9]{64}$/

function reasonText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length < 8 || trimmed.length > 500) return null
  // One line of plain words: no control characters in an audit record.
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null
  return trimmed
}

export function parseRunnerRoleRequest(value: unknown): RunnerRoleRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (body.schema_version !== 1) return null
  const reason = reasonText(body.reason)
  if (!reason) return null
  if (body.action === 'switch_active') {
    const keys = Object.keys(body).sort().join(',')
    if (keys !== 'action,expected_active_runner_id_hash,reason,schema_version,to_runner_id_hash') return null
    if (typeof body.to_runner_id_hash !== 'string' || !HASH.test(body.to_runner_id_hash)) return null
    if (typeof body.expected_active_runner_id_hash !== 'string' || !HASH.test(body.expected_active_runner_id_hash)) return null
    if (body.to_runner_id_hash === body.expected_active_runner_id_hash) return null
    return {
      schema_version: 1,
      action: 'switch_active',
      to_runner_id_hash: body.to_runner_id_hash,
      expected_active_runner_id_hash: body.expected_active_runner_id_hash,
      reason,
    }
  }
  if (body.action === 'set_role') {
    const keys = Object.keys(body).sort().join(',')
    if (keys !== 'action,reason,role,runner_id_hash,schema_version') return null
    if (typeof body.runner_id_hash !== 'string' || !HASH.test(body.runner_id_hash)) return null
    if (body.role !== 'standby' && body.role !== 'retired') return null
    return { schema_version: 1, action: 'set_role', runner_id_hash: body.runner_id_hash, role: body.role, reason }
  }
  return null
}

/** The database's refusals, passed to the operator by name. */
export const RUNNER_ROLE_REFUSALS = [
  'runner_roles_not_seeded',
  'active_runner_changed',
  'runner_already_active',
  'runner_retired',
  'active_runner_still_running',
  'active_runner_has_pending_receipts',
  'active_runner_holds_work',
  'target_runner_not_ready',
  'runner_is_active',
  'runner_role_unchanged',
  'runner_still_running',
  'runner_holds_work',
  'invalid_runner_role_request',
] as const
export type RunnerRoleRefusal = typeof RUNNER_ROLE_REFUSALS[number]

/** Matched on the exact message, as safeErrorCode in _contracts.ts does. */
export function runnerRoleRefusal(error: { code?: string; message?: string } | null | undefined): RunnerRoleRefusal | null {
  if (!error) return null
  const message = String(error.message || '').trim()
  return (RUNNER_ROLE_REFUSALS as readonly string[]).includes(message) ? message as RunnerRoleRefusal : null
}
