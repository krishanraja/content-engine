import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  guardVideoStudioOperatorMutation,
  guardVideoStudioOperatorRead,
  videoStudioOperatorIdentity,
} from '../_videoStudioAuth.js'
import { supabase } from '../_supabase.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from './_contracts.js'
import { enforceVideoStudioRateLimit } from './_data.js'
import {
  parseRunnerRoleRequest,
  RUNNER_HEARTBEAT_COLUMNS,
  RUNNER_ROLE_COLUMNS,
  runnerRoleRefusal,
  runnerRoster,
  type RunnerHeartbeatRow,
  type RunnerRoleRow,
} from './_runnerRoles.js'

// GET  /api/video-studio/runner-roles   the Windows runners, their roles and the audit
// POST /api/video-studio/runner-roles   switch the active runner, or mark one standby or retired
//
// Ruling (Krish, 2026-09-28): a second Windows machine is a cold standby with
// its task disabled. The cloud leases work only to the active runner
// (supabase/migrations/20260928120000_video_studio_runner_roles.sql), so a
// failover ends with this switch. It is the operator's action: Control
// Center's cookie, its exact origin and a CSRF token, never anonymous. The
// database refuses the switch while the outgoing runner is running or holds
// any work, and records who asked and why; the refusal comes back by name.

async function readRoster() {
  const [roles, heartbeats, events] = await Promise.all([
    supabase.from('video_studio_runner_roles').select(RUNNER_ROLE_COLUMNS),
    supabase.from('video_studio_runner_heartbeats').select(RUNNER_HEARTBEAT_COLUMNS),
    supabase.from('video_studio_runner_role_events')
      .select('runner_id_hash,from_role,to_role,set_by,reason,occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(20),
  ])
  if (roles.error || heartbeats.error || events.error) return null
  return {
    roles: (roles.data || []) as RunnerRoleRow[],
    heartbeats: (heartbeats.data || []) as RunnerHeartbeatRow[],
    events: events.data || [],
  }
}

async function sendRoster(res: VercelResponse, extras: Record<string, unknown> = {}) {
  const read = await readRoster()
  if (!read) return sendVideoStudioError(res, 503, 'runner_roles_unavailable')
  const roster = runnerRoster(read.roles, read.heartbeats, new Date())
  const retired = read.roles.filter((row) => row.role === 'retired').map((row) => row.runner_id_hash)
  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    ...extras,
    fenced: roster.fenced,
    active: roster.active,
    active_basis: roster.active_basis,
    standby: roster.standby,
    unassigned: roster.unassigned,
    retired,
    events: read.events,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    if (guardVideoStudioOperatorMutation(req, res, ['POST'])) return
    const operator = videoStudioOperatorIdentity(req)
    if (await enforceVideoStudioRateLimit(res, 'operator:runner-roles', operator, 10, 60)) return
    const body = parseRunnerRoleRequest(req.body)
    if (!body) return sendVideoStudioError(res, 400, 'invalid_runner_role_request')
    const setBy = `operator:${operator}`

    const result = body.action === 'switch_active'
      ? await supabase.rpc('video_studio_switch_active_runner', {
        p_to_runner_id_hash: body.to_runner_id_hash,
        p_expected_active_runner_id_hash: body.expected_active_runner_id_hash,
        p_set_by: setBy,
        p_reason: body.reason,
      })
      : await supabase.rpc('video_studio_set_runner_role', {
        p_runner_id_hash: body.runner_id_hash,
        p_role: body.role,
        p_set_by: setBy,
        p_reason: body.reason,
      })
    if (result.error) {
      const refusal = runnerRoleRefusal(result.error)
      if (refusal) return sendVideoStudioError(res, 409, refusal)
      return sendVideoStudioError(res, 503, 'runner_roles_unavailable')
    }
    return sendRoster(res, { changed: body.action })
  }

  if (guardVideoStudioOperatorRead(req, res, ['GET'])) return
  if (await enforceVideoStudioRateLimit(res, 'operator:runner-roles-read', videoStudioOperatorIdentity(req), 60, 60)) return
  return sendRoster(res)
}
