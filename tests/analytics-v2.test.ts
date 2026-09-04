import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { analyticsObservationsFromRowsV2, hasCurrentApprovedFinalForPlatformV2, importAnalyticsV2, normalizeVideoPlatform } from '@mindmake/core'
import { AnalyticsObservationV2Schema, type JobManifestV2 } from '@mindmake/contracts'

describe('four-platform analytics import', () => {
  let root: string
  let previousRuntimeRoot: string | undefined

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mindmake-analytics-v2-'))
    previousRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
  })

  afterEach(async () => {
    if (previousRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
    else process.env.MINDMAKE_RUNTIME_ROOT = previousRuntimeRoot
    await rm(root, { recursive: true, force: true })
  })

  it('normalizes user-facing platform names without conflating platforms', () => {
    expect(normalizeVideoPlatform('YouTube')).toBe('youtube_shorts')
    expect(normalizeVideoPlatform('Instagram Reels')).toBe('instagram_reels')
    expect(normalizeVideoPlatform('TikTok')).toBe('tiktok')
    expect(normalizeVideoPlatform('LinkedIn')).toBe('linkedin')
  })

  it('keeps unavailable export metrics null instead of estimating them', async () => {
    const observations = analyticsObservationsFromRowsV2(
      [{ job_id: 'job-analytics-v2', views: '1250', shares: '19', saves: '44' }],
      'instagram_reels',
      'job-analytics-v2',
      'a'.repeat(64),
      'b'.repeat(64),
    )
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({
      schema_version: 2,
      platform: 'instagram_reels',
      job_id: 'job-analytics-v2',
      views: 1250,
      shares: 19,
      saves: 44,
      impressions: null,
      completion_rate: null,
      qualified_actions: null,
    })
  })

  it('uses the requested job for blank normalized rows', () => {
    const observations = analyticsObservationsFromRowsV2([{ job_id: '', views: '250' }], 'youtube_shorts', 'fallback-job', 'b'.repeat(64), 'c'.repeat(64))
    expect(observations[0]?.job_id).toBe('fallback-job')
  })

  it('rejects a mismatched nonempty job before writing any observations', async () => {
    const csvPath = join(root, 'mixed-jobs.csv')
    await writeFile(csvPath, 'job_id,views\nexpected-job,250\ndifferent-job,500\n', 'utf8')
    await expect(importAnalyticsV2(csvPath, 'youtube', 'expected-job', 'c'.repeat(64)))
      .rejects.toThrow('analytics row 3 job_id different-job does not match requested job expected-job')
    await expect(readFile(join(process.env.MINDMAKE_RUNTIME_ROOT!, 'analytics', 'observations-v2.jsonl'), 'utf8'))
      .rejects.toThrow()
  })

  it('rejects a final approval borrowed from a different platform', () => {
    const youtubeHash = 'a'.repeat(64)
    const linkedinHash = 'b'.repeat(64)
    const job = {
      approvals: [{ gate: 'final', decision: 'approved', artifact_hash: youtubeHash, actor: 'krish', confirmation_ref: `codex-user-confirmation:final:${youtubeHash}:approved`, occurred_at: '2026-09-04T10:00:00.000Z' }],
    } as JobManifestV2
    const renders = [
      { platform: 'youtube_shorts', master_path: 'youtube.mp4', master_hash: youtubeHash, manifest_path: 'youtube.json', manifest_hash: 'c'.repeat(64) },
      { platform: 'linkedin', master_path: 'linkedin.mp4', master_hash: linkedinHash, manifest_path: 'linkedin.json', manifest_hash: 'd'.repeat(64) },
    ] as const
    expect(hasCurrentApprovedFinalForPlatformV2(job, renders, 'youtube_shorts', youtubeHash)).toBe(true)
    expect(hasCurrentApprovedFinalForPlatformV2(job, renders, 'linkedin', youtubeHash)).toBe(false)
    expect(hasCurrentApprovedFinalForPlatformV2(job, renders, 'linkedin', linkedinHash)).toBe(false)
  })

  it('rejects one ambiguous approval hash reused by several platform renders', () => {
    const sharedHash = 'e'.repeat(64)
    const job = {
      approvals: [{ gate: 'final', decision: 'approved', artifact_hash: sharedHash, actor: 'krish', confirmation_ref: `codex-user-confirmation:final:${sharedHash}:approved`, occurred_at: '2026-09-04T10:00:00.000Z' }],
    } as JobManifestV2
    const renders = [
      { platform: 'youtube_shorts', master_path: 'youtube.mp4', master_hash: sharedHash, manifest_path: 'youtube.json', manifest_hash: 'f'.repeat(64) },
      { platform: 'linkedin', master_path: 'linkedin.mp4', master_hash: sharedHash, manifest_path: 'linkedin.json', manifest_hash: '0'.repeat(64) },
    ] as const
    expect(hasCurrentApprovedFinalForPlatformV2(job, renders, 'youtube_shorts', sharedHash)).toBe(false)
  })

  it('rejects impossible normalized rates while preserving valid looping-video percentages', () => {
    const valid = {
      schema_version: 2 as const,
      observation_id: '00000000-0000-4000-8000-000000000111',
      job_id: 'analytics-range-job',
      platform: 'youtube_shorts' as const,
      impressions: 1000,
      views: 800,
      viewed_vs_swiped: 70,
      early_hold_rate: 68,
      average_view_duration_seconds: 35,
      average_percentage_viewed: 140,
      completion_rate: 75,
      rewatch_rate: 125,
      shares: 12,
      saves: 14,
      comments: 8,
      substantive_comments: 3,
      comment_quality: 0.8,
      followers_gained: 5,
      qualified_actions: 10,
      utm_actions: 2,
      published_artifact_hash: 'a'.repeat(64),
      source_file_hash: 'b'.repeat(64),
    }
    expect(AnalyticsObservationV2Schema.parse(valid)).toMatchObject({ average_percentage_viewed: 140, rewatch_rate: 125 })
    expect(() => AnalyticsObservationV2Schema.parse({ ...valid, viewed_vs_swiped: -1 })).toThrow()
    expect(() => AnalyticsObservationV2Schema.parse({ ...valid, early_hold_rate: 101 })).toThrow()
    expect(() => AnalyticsObservationV2Schema.parse({ ...valid, average_percentage_viewed: -0.1 })).toThrow()
    expect(() => AnalyticsObservationV2Schema.parse({ ...valid, completion_rate: 999999 })).toThrow()
    expect(() => AnalyticsObservationV2Schema.parse({ ...valid, rewatch_rate: -1 })).toThrow()
    expect(() => AnalyticsObservationV2Schema.parse({ ...valid, comment_quality: 1.01 })).toThrow()
  })
})
