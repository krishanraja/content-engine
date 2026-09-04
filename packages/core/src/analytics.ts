import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parse } from 'csv-parse/sync'
import {
  AnalyticsObservationV1Schema,
  AnalyticsObservationV2Schema,
  FeedbackEventV1Schema,
  RenderManifestV2Schema,
  SCHEMA_VERSION,
  Sha256V1Schema,
  VideoPlatformV1Schema,
  type AnalyticsObservationV1,
  type AnalyticsObservationV2,
  type JobManifestV2,
  type VideoPlatformV1,
} from '@mindmake/contracts'
import { hashFile } from './hash.js'
import { studioPaths } from './paths.js'

const ALIASES: Record<string, string[]> = {
  job_id: ['job_id', 'video id', 'video_id', 'external video id'],
  published_at: ['published_at', 'video publish time', 'publish date', 'date'],
  impressions: ['impressions'],
  views: ['views', 'video views', 'plays'],
  viewed_vs_swiped: ['viewed vs swiped away (%)', 'viewed_vs_swiped'],
  early_hold_rate: ['early hold rate', 'early_hold_rate', '3 second hold (%)'],
  average_view_duration_seconds: ['average view duration', 'average_view_duration_seconds', 'average watch time'],
  average_percentage_viewed: ['average percentage viewed (%)', 'average_percentage_viewed'],
  completion_rate: ['completion rate', 'completion_rate', 'completed (%)', 'watched full video (%)', 'full video watch rate'],
  rewatch_rate: ['rewatch rate', 'rewatch_rate'],
  shares: ['shares'],
  saves: ['saves', 'saved'],
  comments: ['comments'],
  substantive_comments: ['substantive comments', 'substantive_comments'],
  comment_quality: ['comment quality', 'comment_quality'],
  followers_gained: ['subscribers gained', 'followers gained', 'followers_gained'],
  qualified_actions: ['qualified actions', 'qualified_actions'],
  utm_actions: ['utm actions', 'utm_actions', 'mindmaker live actions'],
}

function normalizedRow(row: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value?.trim()]))
}

function pick(row: Record<string, string>, field: string): string | undefined {
  return ALIASES[field]?.map((key) => row[key]).find((value) => value !== undefined && value !== '')
}

function numberOrNull(value: string | undefined): number | null {
  if (!value) return null
  const normalized = value.replaceAll(',', '').replace('%', '').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function durationOrNull(value: string | undefined): number | null {
  if (!value) return null
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value)
  const parts = value.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}

export async function importAnalytics(path: string, platform: 'youtube' | 'linkedin', defaultJobId: string, publishedArtifactHash: string): Promise<AnalyticsObservationV1[]> {
  const rows = parse(await readFile(path, 'utf8'), { columns: true, skip_empty_lines: true, bom: true }) as Array<Record<string, string>>
  const sourceHash = await hashFile(path)
  const observations = rows.map(normalizedRow).map((row) => AnalyticsObservationV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    observation_id: randomUUID(),
    job_id: pick(row, 'job_id') || defaultJobId,
    platform,
    ...(pick(row, 'published_at') ? { published_at: pick(row, 'published_at') } : {}),
    impressions: numberOrNull(pick(row, 'impressions')),
    views: numberOrNull(pick(row, 'views')),
    viewed_vs_swiped: numberOrNull(pick(row, 'viewed_vs_swiped')),
    early_hold_rate: numberOrNull(pick(row, 'early_hold_rate')),
    average_view_duration_seconds: durationOrNull(pick(row, 'average_view_duration_seconds')),
    average_percentage_viewed: numberOrNull(pick(row, 'average_percentage_viewed')),
    completion_rate: numberOrNull(pick(row, 'completion_rate')),
    rewatch_rate: numberOrNull(pick(row, 'rewatch_rate')),
    shares: numberOrNull(pick(row, 'shares')),
    saves: numberOrNull(pick(row, 'saves')),
    comments: numberOrNull(pick(row, 'comments')),
    substantive_comments: numberOrNull(pick(row, 'substantive_comments')),
    comment_quality: numberOrNull(pick(row, 'comment_quality')),
    followers_gained: numberOrNull(pick(row, 'followers_gained')),
    qualified_actions: numberOrNull(pick(row, 'qualified_actions')),
    utm_actions: numberOrNull(pick(row, 'utm_actions')),
    published_artifact_hash: publishedArtifactHash,
    source_file_hash: sourceHash,
  }))
  const ledger = join(studioPaths().runtimeRoot, 'analytics', 'observations.jsonl')
  await mkdir(dirname(ledger), { recursive: true })
  await appendFile(ledger, observations.map((item) => JSON.stringify(item)).join('\n') + (observations.length ? '\n' : ''), 'utf8')
  return observations
}

export function normalizeVideoPlatform(value: string): VideoPlatformV1 {
  const normalized = value.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_')
  if (normalized === 'youtube' || normalized === 'youtube_short' || normalized === 'shorts') return 'youtube_shorts'
  if (normalized === 'instagram' || normalized === 'reels' || normalized === 'instagram_reel') return 'instagram_reels'
  return VideoPlatformV1Schema.parse(normalized)
}

export interface AnalyticsRenderBindingV2 {
  platform: VideoPlatformV1
  master_path: string
  master_hash: string
  manifest_path: string
  manifest_hash: string
}

export function hasCurrentApprovedFinalForPlatformV2(
  job: JobManifestV2,
  renders: readonly AnalyticsRenderBindingV2[],
  platform: VideoPlatformV1,
  artifactHash: string,
): boolean {
  const matches = renders.filter((item) => item.master_hash === artifactHash)
  const platformRenders = renders.filter((item) => item.platform === platform)
  if (matches.length !== 1 || platformRenders.length !== 1 || matches[0] !== platformRenders[0]) return false
  const latest = [...job.approvals].reverse().find((approval) => approval.gate === 'final' && approval.artifact_hash === artifactHash)
  return Boolean(latest?.actor === 'krish'
    && ['approved', 'override'].includes(latest.decision)
    && latest.confirmation_ref?.startsWith(`codex-user-confirmation:final:${artifactHash}:`))
}

export async function verifyFinalForAnalyticsV2(jobId: string, platformInput: string, publishedArtifactHash: string): Promise<string> {
  const platform = normalizeVideoPlatform(platformInput)
  const artifactHash = Sha256V1Schema.parse(publishedArtifactHash)
  const { loadJobV2, readStageArtifactV2 } = await import('./job-store-v2.js')
  const job = await loadJobV2(jobId)
  if (!job.target_platforms.includes(platform)) throw new Error(`${platform} is not a target platform for ${jobId}`)

  let approvedCurrentPlatformFinal = false
  try {
    const render = await readStageArtifactV2<{ renders: Array<{ platform: VideoPlatformV1; master_path: string; master_hash: string; manifest_path: string; manifest_hash: string }> }>(jobId, 'render')
    const rendered = render.payload.renders.find((item) => item.platform === platform)
    if (rendered && hasCurrentApprovedFinalForPlatformV2(job, render.payload.renders, platform, artifactHash)
      && await hashFile(rendered.master_path) === rendered.master_hash
      && await hashFile(rendered.manifest_path) === rendered.manifest_hash) {
      const renderManifest = RenderManifestV2Schema.parse(JSON.parse(await readFile(rendered.manifest_path, 'utf8')))
      approvedCurrentPlatformFinal = renderManifest.job_id === jobId
        && renderManifest.target_platform === platform
    }
  } catch {
    approvedCurrentPlatformFinal = false
  }
  if (approvedCurrentPlatformFinal) return artifactHash

  const { hasVerifiedExternalFinalConfirmationV2 } = await import('./feedback.js')
  if (await hasVerifiedExternalFinalConfirmationV2(jobId, artifactHash, platform)) return artifactHash
  throw new Error(`analytics final for ${platform} must match its exact current approved render or a platform-scoped confirmed external final`)
}

export async function importAnalyticsV2(path: string, platformInput: string, defaultJobId: string, publishedArtifactHash: string): Promise<AnalyticsObservationV2[]> {
  const platform = normalizeVideoPlatform(platformInput)
  const rows = parse(await readFile(path, 'utf8'), { columns: true, skip_empty_lines: true, bom: true }) as Array<Record<string, string>>
  const normalizedRows = rows.map(normalizedRow)
  for (const [index, row] of normalizedRows.entries()) {
    const rowJobId = pick(row, 'job_id')
    if (rowJobId && rowJobId !== defaultJobId) {
      throw new Error(`analytics row ${index + 2} job_id ${rowJobId} does not match requested job ${defaultJobId}`)
    }
  }
  const approvedArtifactHash = await verifyFinalForAnalyticsV2(defaultJobId, platform, publishedArtifactHash)
  const sourceHash = await hashFile(path)
  const observations = analyticsObservationsFromRowsV2(normalizedRows, platform, defaultJobId, approvedArtifactHash, sourceHash)
  const ledger = join(studioPaths().runtimeRoot, 'analytics', 'observations-v2.jsonl')
  await mkdir(dirname(ledger), { recursive: true })
  await appendFile(ledger, observations.map((item) => JSON.stringify(item)).join('\n') + (observations.length ? '\n' : ''), 'utf8')
  return observations
}

export function analyticsObservationsFromRowsV2(
  normalizedRows: Array<Record<string, string>>,
  platform: VideoPlatformV1,
  defaultJobId: string,
  approvedArtifactHash: string,
  sourceHash: string,
): AnalyticsObservationV2[] {
  return normalizedRows.map((row) => AnalyticsObservationV2Schema.parse({
    schema_version: 2,
    observation_id: randomUUID(),
    job_id: pick(row, 'job_id') || defaultJobId,
    platform,
    ...(pick(row, 'published_at') ? { published_at: pick(row, 'published_at') } : {}),
    impressions: numberOrNull(pick(row, 'impressions')),
    views: numberOrNull(pick(row, 'views')),
    viewed_vs_swiped: numberOrNull(pick(row, 'viewed_vs_swiped')),
    early_hold_rate: numberOrNull(pick(row, 'early_hold_rate')),
    average_view_duration_seconds: durationOrNull(pick(row, 'average_view_duration_seconds')),
    average_percentage_viewed: numberOrNull(pick(row, 'average_percentage_viewed')),
    completion_rate: numberOrNull(pick(row, 'completion_rate')),
    rewatch_rate: numberOrNull(pick(row, 'rewatch_rate')),
    shares: numberOrNull(pick(row, 'shares')),
    saves: numberOrNull(pick(row, 'saves')),
    comments: numberOrNull(pick(row, 'comments')),
    substantive_comments: numberOrNull(pick(row, 'substantive_comments')),
    comment_quality: numberOrNull(pick(row, 'comment_quality')),
    followers_gained: numberOrNull(pick(row, 'followers_gained')),
    qualified_actions: numberOrNull(pick(row, 'qualified_actions')),
    utm_actions: numberOrNull(pick(row, 'utm_actions')),
    published_artifact_hash: approvedArtifactHash,
    source_file_hash: sourceHash,
  }))
}

export async function verifyFinalForAnalytics(jobId: string, finalPath: string): Promise<string> {
  const { loadJob } = await import('./job-store.js')
  const job = await loadJob(jobId)
  const approvedHashes = job.approvals.filter((approval) => approval.gate === 'final' && (approval.decision === 'approved' || approval.decision === 'override')).map((approval) => approval.artifact_hash)
  if (!approvedHashes.length) throw new Error('final approval is required before analytics import')
  const finalHash = await hashFile(finalPath)
  if (approvedHashes.includes(finalHash)) return finalHash
  const feedbackPath = join(studioPaths().runtimeRoot, 'learning', 'feedback.jsonl')
  let feedback: Array<ReturnType<typeof FeedbackEventV1Schema.parse>> = []
  try { feedback = (await readFile(feedbackPath, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => FeedbackEventV1Schema.parse(JSON.parse(line))) } catch { feedback = [] }
  const acceptedReimport = feedback.some((event) => event.job_id === jobId
    && event.stage === 'render'
    && event.origin === 'user'
    && event.action !== 'reject'
    && event.after_hash === finalHash)
  if (!acceptedReimport) throw new Error('the published final differs from the approved render and must be re-imported through studio feedback import before analytics are attached')
  return finalHash
}

export function qualifiedActionsPerThousand(observation: AnalyticsObservationV1): number | null {
  if (!observation.impressions || observation.qualified_actions === null) return null
  return Math.round((observation.qualified_actions / observation.impressions) * 1_000_000) / 1_000
}

export function qualifiedActionsPerThousandV2(observation: AnalyticsObservationV2): number | null {
  if (!observation.impressions || observation.qualified_actions === null) return null
  return Math.round((observation.qualified_actions / observation.impressions) * 1_000_000) / 1_000
}
