import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { guardSensitiveRead } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { CONTENT_ENGINE_JOBS, contentEngineAttention, type ContentEngineRunRow } from '../../lib/contentEngineSchedule.js'

// The engine says how it is. One read for the dashboard's obligation strip
// and for a person with curl: the deploy commit, whether the operator guard
// is actually configured (hasAccess fails OPEN when ACCESS_CODE is unset, so
// an engine project missing the variable would silently serve every
// cookie-guarded route; this is where that is caught), the job list this
// deployment schedules, the last run of each job, and how long the Windows
// runner has been quiet. Nothing here is pushed anywhere: the OS is
// pull-only, and this is what gets pulled.

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
  if (guardSensitiveRead(req, res, ['GET'])) return

  const [runsResult, heartbeatResult] = await Promise.all([
    supabase
      .from('content_engine_runs')
      .select('job, status, reason, finished_at')
      .order('finished_at', { ascending: false })
      .limit(400),
    supabase
      .from('video_studio_runner_heartbeats')
      .select('updated_at, status')
      .order('updated_at', { ascending: false })
      .limit(1),
  ])

  const rows = (runsResult.data || []) as ContentEngineRunRow[]
  const now = new Date()
  const { attention, unrecorded } = contentEngineAttention(rows, now)
  const lastRun = new Map<string, ContentEngineRunRow>()
  for (const row of rows) if (!lastRun.has(row.job)) lastRun.set(row.job, row)

  const heartbeat = heartbeatResult.data?.[0] as { updated_at?: string; status?: string } | undefined
  const heartbeatAgeHours = heartbeat?.updated_at
    ? Math.round(((now.getTime() - Date.parse(heartbeat.updated_at)) / 3_600_000) * 10) / 10
    : null
  const runner = heartbeatAgeHours === null
    ? 'never'
    : heartbeatAgeHours > RUNNER_ABSENT_AFTER_HOURS ? 'absent' : heartbeatAgeHours > 24 ? 'quiet' : 'present'

  const commit = process.env.VERCEL_GIT_COMMIT_SHA || 'development'
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
    cron_secret_configured: Boolean(process.env.CRON_SECRET),
    runner: { state: runner, heartbeat_age_hours: heartbeatAgeHours, status: heartbeat?.status ?? null },
    schedule_hash: scheduleHash,
    jobs,
    attention,
    unrecorded,
    read_errors: [runsResult.error?.message, heartbeatResult.error?.message].filter(Boolean),
  })
}
