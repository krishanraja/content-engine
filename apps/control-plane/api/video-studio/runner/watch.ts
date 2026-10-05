import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../../_auth.js'
import { supabase } from '../../_supabase.js'
import { withContentRun } from '../../_runs.js'
import { readRunnerState } from '../_runnerWatch.js'

// GET /api/video-studio/runner/watch   daily
//
// The media executor is a hidden Scheduled Task on a Windows machine: a
// primary whose task runs, and since 2026-09-28 a cold standby whose task is
// disabled. Only the runner with the active role is leased work
// (supabase/migrations/20260928120000_video_studio_runner_roles.sql). This
// watch turns the active runner's silence into a ledger row when there is
// work waiting for it: queued commands, pending reviews, or claimable
// production briefs. The row surfaces in the alert drawer through the same
// path as every other failed job.
//
// Whose silence counts changed on 2026-09-28: it used to be the newest
// heartbeat row of any runner, so a standby's drill could mask a dead
// primary, and it counted briefs in meta.production_brief, where none are
// stored. The standby is reported beside the active runner; retired rows are
// ignored.
//
// It never wakes anything. The OS is pull-only; the fix is on the machine.

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return
  const now = new Date()
  const state = await readRunnerState(supabase, now)
  if (state.errors.length) {
    return res.status(503).json({ ok: false, error: `runner watch read failed: ${state.errors[0]}` })
  }

  const { roster, waiting, attention } = state
  const active = roster.active
  const silentHours = active?.heartbeat_age_seconds === null || active?.heartbeat_age_seconds === undefined
    ? null
    : active.heartbeat_age_seconds / 3600
  const counts = {
    queued_commands: waiting.queued_commands,
    pending_reviews: waiting.pending_reviews,
    ready_briefs: waiting.ready_briefs,
    expired_brief_leases: waiting.expired_brief_leases,
    silent_hours: silentHours === null ? -1 : Math.round(silentHours),
    fenced: roster.fenced,
    active_runner: active?.runner_id_prefix ?? null,
    active_basis: roster.active_basis,
    active_drive_state: active?.drive_state ?? null,
    standby: roster.standby.map((row) => ({
      runner: row.runner_id_prefix,
      heartbeat_age_hours: row.heartbeat_age_seconds === null ? null : Math.round(row.heartbeat_age_seconds / 360) / 10,
      drive_state: row.drive_state,
    })),
    attention: attention.map((item) => item.code),
  }

  const alarm = attention.find((item) =>
    item.code === 'active_runner_silent_with_work_waiting' || item.code === 'no_runner_with_work_waiting')
  if (alarm) {
    // ok:false makes this a failed run in the ledger, which is the point.
    return res.status(200).json({ ok: false, error: alarm.line, ...counts })
  }
  const silent = silentHours === null || silentHours > 24
  if (silent) return res.status(200).json({ ok: true, skipped: 'runner silent, nothing waiting for it', ...counts })
  return res.status(200).json({ ok: true, drive_state: active?.drive_state, runner_status: active?.runner_status, ...counts })
}

export default withContentRun('runner_watch', handler)
