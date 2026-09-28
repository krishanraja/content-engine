import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { guardSensitiveRead } from '../_auth.js'
import { CONTENT_ENGINE_JOBS, contentEngineAttention, type ContentEngineRunRow } from '../../lib/contentEngineSchedule.js'
import { envReadiness } from './_required.js'
import { publicRunner, readRunnerState } from '../video-studio/_runnerWatch.js'
import { providerHealth, readProviderState } from '../_modelProvider.js'

// The engine says how it is. One read for the dashboard's obligation strip
// and for a person with curl: the deploy commit, whether the operator guard
// is actually configured (hasAccess fails OPEN when ACCESS_CODE is unset, so
// an engine project missing the variable would silently serve every
// cookie-guarded route; this is where that is caught), the job list this
// deployment schedules, the last run of each job, and how long the Windows
// runner has been quiet. Nothing here is pushed anywhere: the OS is
// pull-only, and this is what gets pulled.
//
// Since 2026-09-28 there are two runners, a primary and a cold standby, and
// only the one with the active role is leased work
// (supabase/migrations/20260928120000_video_studio_runner_roles.sql). The
// runner block below is the active runner's; the standby is listed beside it,
// and retired rows (old bearers, old machines) are left out. Until then this
// route selected columns the heartbeat table does not have and always said
// "never". Runners appear by the first eight characters of their hash only:
// the export bearer can read this route too.
//
// Since 2026-09-28 it also says whether the model provider is usable
// (`model_provider`, api/_modelProvider.ts): the last Anthropic failure, its
// class, the reset time the provider gave, and a plain sentence when the
// engine cannot write or check anything. The key had been over its usage
// limit for 33 hours before anyone knew. The operator bearer can read this
// route, so an agent session checks it before it spends.

const RUNNER_ABSENT_AFTER_HOURS = 48

function operatorAuthConfigured(): boolean {
  const accessCode = process.env.ACCESS_CODE || ''
  const csrf = process.env.VIDEO_STUDIO_CSRF_SECRET || ''
  let origin: string | null = null
  try {
    const url = new URL(process.env.APP_ORIGIN || '')
    origin = url.protocol === 'https:' && url.pathname === '/' ? url.origin : null
  } catch { origin = null }
  return Boolean(accessCode) && Boolean(origin) && Buffer.byteLength(csrf, 'utf8') >= 32
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardSensitiveRead(req, res, ['GET'], { operatorBearer: true })) return

  const now = new Date()
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || 'development'
  const env = envReadiness()

  // api/_supabase.ts throws at module load when the database is unconfigured,
  // which is right for a route that cannot work without it and wrong for the
  // one route whose job is to say what is missing. Import it only once those
  // two variables are there, so a half-configured deployment answers with a
  // diagnosis instead of a 500 nobody can read.
  //
  // Gate on the database alone, not on overall readiness. A deployment missing
  // only the runner token is perfectly able to report that fact, and refusing
  // to answer until everything is set would make this route useless exactly
  // when it is needed.
  const databaseConfigured = Boolean((process.env.SUPABASE_URL || '').trim())
    && Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim())
  if (!databaseConfigured) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).json({
      ok: false,
      schema_version: 1,
      engine: 'content-engine/control-plane',
      commit,
      server_time: now.toISOString(),
      error: 'database_not_configured',
      database_configured: false,
      operator_auth_configured: operatorAuthConfigured(),
      cron_secret_configured: Boolean(process.env.CRON_SECRET),
      ...env,
    })
  }
  const { supabase } = await import('../_supabase.js')

  const [runsResult, runnerState, providerState] = await Promise.all([
    supabase
      .from('content_engine_runs')
      .select('job, status, reason, finished_at')
      .order('finished_at', { ascending: false })
      .limit(400),
    readRunnerState(supabase, now),
    readProviderState(),
  ])

  const rows = (runsResult.data || []) as ContentEngineRunRow[]
  const { attention, unrecorded } = contentEngineAttention(rows, now)
  const lastRun = new Map<string, ContentEngineRunRow>()
  for (const row of rows) if (!lastRun.has(row.job)) lastRun.set(row.job, row)

  const { roster, waiting, attention: runnerAttention } = runnerState
  const active = roster.active
  const activeAgeSeconds = active?.heartbeat_age_seconds ?? null
  const heartbeatAgeHours = activeAgeSeconds === null ? null : Math.round((activeAgeSeconds / 3600) * 10) / 10
  const runner = heartbeatAgeHours === null
    ? 'never'
    : heartbeatAgeHours > RUNNER_ABSENT_AFTER_HOURS ? 'absent' : heartbeatAgeHours > 24 ? 'quiet' : 'present'

  const jobs = CONTENT_ENGINE_JOBS.map(job => ({
    job: job.job,
    path: job.path,
    label: job.label,
    every_hours: job.everyHours,
    grace_hours: job.graceHours,
    last: lastRun.get(job.job) || null,
  }))
  const scheduleHash = createHash('sha256').update(JSON.stringify(CONTENT_ENGINE_JOBS.map(j => [j.job, j.path]))).digest('hex')

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    ok: true,
    schema_version: 1,
    engine: 'content-engine/control-plane',
    commit,
    server_time: now.toISOString(),
    operator_auth_configured: operatorAuthConfigured(),
    database_configured: true,
    ...env,
    cron_secret_configured: Boolean(process.env.CRON_SECRET),
    // The active runner, in the shape Control Center has always read.
    runner: {
      state: runner,
      heartbeat_age_hours: heartbeatAgeHours,
      status: active?.runner_status ?? null,
      drive_state: active?.drive_state ?? null,
      runner_id_prefix: active?.runner_id_prefix ?? null,
      basis: roster.active_basis,
    },
    runners: {
      fenced: roster.fenced,
      active: publicRunner(active),
      standby: roster.standby.map(publicRunner),
      unassigned: roster.unassigned.map(publicRunner),
      retired_count: roster.retired_count,
      waiting,
      attention: runnerAttention,
    },
    schedule_hash: scheduleHash,
    jobs,
    attention,
    unrecorded,
    model_provider: providerHealth(providerState.failure, providerState.okAt, now),
    read_errors: [runsResult.error?.message, ...runnerState.errors, providerState.error].filter(Boolean),
  })
}
