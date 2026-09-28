import type { SupabaseClient } from '@supabase/supabase-js'
import {
  RUNNER_HEARTBEAT_COLUMNS,
  RUNNER_ROLE_COLUMNS,
  runnerAttention,
  runnerRoster,
  type RunnerAttention,
  type RunnerHeartbeatRow,
  type RunnerRoleRow,
  type RunnerRoster,
  type RunnerRosterEntry,
} from './_runnerRoles.js'

// One read of the Studio's runners and the work waiting for them, shared by
// GET /api/content-engine/health and the runner_watch cron so the two cannot
// disagree about which runner counts or what counts as waiting.
//
// Before 2026-09-28 the health route selected heartbeat columns that do not
// exist (updated_at, status) and so always said "never", and the watch read
// whichever heartbeat row was newest and counted production briefs in
// content_ideas.meta.production_brief, where none are stored. Briefs live in
// content_ideas.transformed_outputs.production_briefs
// (api/content-ideas/[id]/production-brief.ts), and the runner that counts is
// the active one.

/** The existing watch rule: a day of silence with work waiting is an alert. */
export const RUNNER_SILENT_AFTER_HOURS = 24
/** Runners with no role are listed only while recent, so old bearers' rows fade. */
export const RUNNER_RECENT_DAYS = 7

export interface RunnerWaiting {
  queued_commands: number
  pending_reviews: number
  ready_briefs: number
  expired_brief_leases: number
  total: number
}

export interface RunnerState {
  roster: RunnerRoster
  waiting: RunnerWaiting
  attention: RunnerAttention[]
  errors: string[]
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** Briefs a runner could claim now: ready, or leased with an expired lease. */
export function countClaimableBriefs(rows: ReadonlyArray<{ transformed_outputs: unknown }>, now: Date): { ready: number; expired: number } {
  let ready = 0
  let expired = 0
  for (const row of rows) {
    const briefs = record(record(row.transformed_outputs).production_briefs)
    for (const value of Object.values(briefs)) {
      const envelope = record(value)
      if (envelope.status === 'ready_for_studio') ready += 1
      else if (envelope.status === 'leased') {
        const expiresAt = Date.parse(String(record(envelope.lease).expires_at || ''))
        if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) expired += 1
      }
    }
  }
  return { ready, expired }
}

export async function readRunnerState(db: SupabaseClient, now: Date): Promise<RunnerState> {
  const [roles, heartbeats, commands, reviews, briefs] = await Promise.all([
    db.from('video_studio_runner_roles').select(RUNNER_ROLE_COLUMNS),
    db.from('video_studio_runner_heartbeats').select(RUNNER_HEARTBEAT_COLUMNS),
    db.from('video_studio_commands').select('id', { count: 'exact', head: true }).in('status', ['queued', 'leased']),
    db.from('video_studio_review_requests').select('id, job_id').eq('status', 'pending').limit(500),
    db.from('content_ideas').select('id, transformed_outputs').not('transformed_outputs->production_briefs', 'is', null).limit(500),
  ])
  const errors = [roles, heartbeats, commands, reviews, briefs]
    .map((result) => result.error?.message)
    .filter((message): message is string => Boolean(message))

  // Reviews on retired jobs are not waiting for anyone.
  const pendingJobIds = [...new Set((reviews.data || []).map((row) => String((row as { job_id: unknown }).job_id)))]
  let retiredJobIds = new Set<string>()
  if (pendingJobIds.length) {
    const retired = await db.from('video_studio_jobs').select('job_id').in('job_id', pendingJobIds).not('retired_at', 'is', null)
    if (retired.error) errors.push(retired.error.message)
    retiredJobIds = new Set((retired.data || []).map((row) => String((row as { job_id: unknown }).job_id)))
  }
  const pendingReviews = (reviews.data || []).filter((row) => !retiredJobIds.has(String((row as { job_id: unknown }).job_id))).length
  const claimable = countClaimableBriefs((briefs.data || []) as Array<{ transformed_outputs: unknown }>, now)
  const queued = commands.count || 0
  const waiting: RunnerWaiting = {
    queued_commands: queued,
    pending_reviews: pendingReviews,
    ready_briefs: claimable.ready,
    expired_brief_leases: claimable.expired,
    total: queued + pendingReviews + claimable.ready + claimable.expired,
  }

  const roster = runnerRoster(
    (roles.data || []) as RunnerRoleRow[],
    (heartbeats.data || []) as RunnerHeartbeatRow[],
    now,
  )
  const recentSeconds = RUNNER_RECENT_DAYS * 86_400
  const recent: RunnerRoster = {
    ...roster,
    unassigned: roster.unassigned.filter((row) => row.heartbeat_age_seconds !== null && row.heartbeat_age_seconds <= recentSeconds),
  }
  return {
    roster: recent,
    waiting,
    attention: runnerAttention(recent, waiting.total, RUNNER_SILENT_AFTER_HOURS * 3600),
    errors,
  }
}

/** A roster entry without the full hash, for surfaces the export bearer can also read. */
export function publicRunner(entry: RunnerRosterEntry | null) {
  if (!entry) return null
  const { runner_id_hash: _hash, role_set_by: _setBy, role_reason: _reason, ...rest } = entry
  return rest
}
