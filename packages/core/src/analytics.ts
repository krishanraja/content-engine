import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parse } from 'csv-parse/sync'
import { AnalyticsObservationV1Schema, SCHEMA_VERSION, type AnalyticsObservationV1 } from '@mindmake/contracts'
import { hashFile } from './hash.js'
import { studioPaths } from './paths.js'

const ALIASES: Record<string, string[]> = {
  job_id: ['job_id', 'video id', 'video_id', 'external video id'],
  published_at: ['published_at', 'video publish time', 'publish date', 'date'],
  impressions: ['impressions'],
  views: ['views', 'video views'],
  viewed_vs_swiped: ['viewed vs swiped away (%)', 'viewed_vs_swiped'],
  early_hold_rate: ['early hold rate', 'early_hold_rate', '3 second hold (%)'],
  average_view_duration_seconds: ['average view duration', 'average_view_duration_seconds'],
  average_percentage_viewed: ['average percentage viewed (%)', 'average_percentage_viewed'],
  completion_rate: ['completion rate', 'completion_rate', 'completed (%)'],
  rewatch_rate: ['rewatch rate', 'rewatch_rate'],
  shares: ['shares'],
  saves: ['saves'],
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

export async function verifyFinalForAnalytics(jobId: string, finalPath: string): Promise<string> {
  const { loadJob } = await import('./job-store.js')
  const job = await loadJob(jobId)
  const approvedHashes = job.approvals.filter((approval) => approval.gate === 'final' && (approval.decision === 'approved' || approval.decision === 'override')).map((approval) => approval.artifact_hash)
  if (!approvedHashes.length) throw new Error('final approval is required before analytics import')
  const finalHash = await hashFile(finalPath)
  if (approvedHashes.includes(finalHash)) return finalHash
  const feedbackPath = join(studioPaths().runtimeRoot, 'learning', 'feedback.jsonl')
  let feedback: Array<{ job_id?: string; after_hash?: string }> = []
  try { feedback = (await readFile(feedbackPath, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) } catch { feedback = [] }
  if (!feedback.some((event) => event.job_id === jobId && event.after_hash === finalHash)) throw new Error('the published final differs from the approved render and must be re-imported through studio feedback import before analytics are attached')
  return finalHash
}

export function qualifiedActionsPerThousand(observation: AnalyticsObservationV1): number | null {
  if (!observation.impressions || observation.qualified_actions === null) return null
  return Math.round((observation.qualified_actions / observation.impressions) * 1_000_000) / 1_000
}
