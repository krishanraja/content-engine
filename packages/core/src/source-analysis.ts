import { access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  SourceBundleV1Schema,
  SourceVisualAnalysisV1Schema,
  mediaSourceParticipantRoster,
  type MediaSourceV1,
  type SourceBundleV1,
  type SourceVisualAnalysisV1,
} from '@mindmake/contracts'
import { detectSceneCuts, probeMedia } from './media.js'
import { hashValue } from './hash.js'
import { resolvePythonCommand } from './python-runtime.js'
import { run, runWithInput } from './process.js'
import type { KrishFaceIdentityProfileV1 } from './identity.js'

interface VisualAnalyzerOutput {
  subjects: SourceVisualAnalysisV1['subjects']
  gestures: SourceVisualAnalysisV1['gestures']
  gaze: SourceVisualAnalysisV1['gaze']
  negative_space: SourceVisualAnalysisV1['negative_space']
  protected_regions: SourceVisualAnalysisV1['protected_regions']
  active_speakers?: SourceVisualAnalysisV1['active_speakers']
  sample_fps: number
  identity_match?: { attempted: boolean; matched_track_id: string | null; score: number | null; ambiguous: boolean }
}

export interface AnalyzeSourceBundleOptions {
  generatedAt: string
  identityProfile?: { profile_id: string; version_hash: string; display_name: 'Krish' }
  identityTemplate?: KrishFaceIdentityProfileV1
  sampleFps?: number
}

function sourceRole(source: MediaSourceV1, options: AnalyzeSourceBundleOptions): { role: 'krish' | 'guest' | 'unknown'; profile_id?: string; profile_version_hash?: string } {
  const roster = mediaSourceParticipantRoster(source)
  if (roster.length !== 1) return { role: 'unknown' }
  const participant = roster[0]!
  if (participant.kind === 'krish_profile') return { role: 'krish', profile_id: participant.profile_id, profile_version_hash: participant.version_hash }
  if (participant.kind === 'job_local') return { role: 'guest' }
  return { role: 'unknown' }
}

export function createShotBoundaries(sourceId: string, durationMs: number, cutsMs: number[]): SourceVisualAnalysisV1['shots'] {
  const points = [0, ...cutsMs.filter((point) => point > 0 && point < durationMs), durationMs]
  const unique = [...new Set(points)].sort((left, right) => left - right)
  return unique.slice(0, -1).map((start, index) => ({
    shot_id: `${sourceId}-shot-${index + 1}`,
    source_id: sourceId,
    start_ms: start,
    end_ms: unique[index + 1]!,
    transition: index === 0 ? 'source_start' : 'hard_cut',
    confidence: index === 0 ? 1 : 0.85,
  }))
}

async function runVisualAnalyzer(repoRoot: string, source: MediaSourceV1, options: AnalyzeSourceBundleOptions): Promise<VisualAnalyzerOutput> {
  const python = await resolvePythonCommand(repoRoot)
  const role = sourceRole(source, options)
  const args = [
    join(repoRoot, 'scripts', 'analyze-visual.py'),
    '--input', resolve(source.ref),
    '--source-id', source.source_id,
    '--role', role.role,
    '--sample-fps', String(options.sampleFps ?? 4),
  ]
  if (role.profile_id) args.push('--profile-id', role.profile_id)
  if (role.profile_version_hash) args.push('--profile-version-hash', role.profile_version_hash)
  if (options.identityTemplate && options.identityProfile) {
    args.push('--identity-profile-stdin')
    if (!role.profile_id) args.push('--profile-id', options.identityProfile.profile_id)
    if (!role.profile_version_hash) args.push('--profile-version-hash', options.identityProfile.version_hash)
  }
  const { stdout } = options.identityTemplate && options.identityProfile
    ? await runWithInput(python, args, JSON.stringify(options.identityTemplate), { timeoutMs: 3_600_000 })
    : await run(python, args, { timeoutMs: 3_600_000 })
  return JSON.parse(stdout) as VisualAnalyzerOutput
}

export async function analyzeSourceBundle(repoRoot: string, jobId: string, input: SourceBundleV1, options: AnalyzeSourceBundleOptions): Promise<SourceVisualAnalysisV1> {
  const bundle = SourceBundleV1Schema.parse(input)
  const visualSources = bundle.sources.filter((source) => source.include_in_edit && source.kind !== 'audio')
  if (!visualSources.length) throw new Error('source bundle contains no included visual source')

  const sources: SourceVisualAnalysisV1['sources'] = []
  const shots: SourceVisualAnalysisV1['shots'] = []
  const subjects: SourceVisualAnalysisV1['subjects'] = []
  const gestures: SourceVisualAnalysisV1['gestures'] = []
  const gaze: SourceVisualAnalysisV1['gaze'] = []
  const negativeSpace: SourceVisualAnalysisV1['negative_space'] = []
  const protectedRegions: SourceVisualAnalysisV1['protected_regions'] = []
  const activeSpeakers: SourceVisualAnalysisV1['active_speakers'] = []
  const qualityIssues: SourceVisualAnalysisV1['quality_issues'] = []
  const unavailable = new Set<string>(['speaker_diarisation', 'depth_estimation', 'subject_segmentation'])
  const fallbacks = new Set<string>(['Use a stable crop when subject tracking is uncertain.', 'Use the mixed programme view when active-speaker selection is uncertain.'])
  if (!options.identityTemplate) unavailable.add('krish_face_identity')

  for (const source of visualSources) {
    await access(resolve(source.ref))
    const probe = await probeMedia(source.ref)
    if (source.content_hash && source.content_hash !== probe.file_hash) throw new Error(`source hash changed for ${source.source_id}`)
    const durationMs = Math.max(1, Math.round(probe.duration_seconds * 1000))
    sources.push({
      source_id: source.source_id,
      source_hash: probe.file_hash,
      duration_ms: durationMs,
      width: probe.width,
      height: probe.height,
      fps: probe.average_fps,
      audio_hz: probe.audio_hz,
      canonical_offset_ms: source.sync.offset_ms,
    })

    let cuts: number[] = []
    try { cuts = await detectSceneCuts(source.ref) }
    catch {
      unavailable.add(`scene_detection:${source.source_id}`)
      qualityIssues.push({ issue_id: `${source.source_id}-scene-detection`, source_id: source.source_id, kind: 'other', severity: 'warn', detail: 'Scene detection failed. Camera smoothing will not reset at internal cuts.' })
    }
    shots.push(...createShotBoundaries(source.source_id, durationMs, cuts))

    try {
      const output = await runVisualAnalyzer(repoRoot, source, options)
      subjects.push(...output.subjects)
      gestures.push(...output.gestures)
      gaze.push(...output.gaze)
      negativeSpace.push(...output.negative_space)
      protectedRegions.push(...output.protected_regions)
      const roles = new Map(output.subjects.map((subject) => [subject.track_id, subject.role]))
      activeSpeakers.push(...(output.active_speakers ?? []).map((interval) => ({
        ...interval,
        speaker_label: roles.get(interval.track_id || '') === 'krish'
          ? 'Krish'
          : roles.get(interval.track_id || '') === 'guest' ? 'Guest' : interval.speaker_label,
      })))
      if (output.identity_match?.attempted) {
        if (!output.identity_match.matched_track_id) {
          unavailable.add(`krish_face_identity:${source.source_id}`)
          qualityIssues.push({
            issue_id: `${source.source_id}-identity-${output.identity_match.ambiguous ? 'ambiguous' : 'unmatched'}`,
            source_id: source.source_id,
            kind: 'identity_ambiguity',
            severity: 'warn',
            detail: output.identity_match.ambiguous
              ? 'More than one subject matched the Krish profile too closely. No durable identity was assigned.'
              : 'No subject passed the conservative Krish identity threshold. No durable identity was assigned.',
          })
        }
      }
      if (!output.subjects.length) {
        unavailable.add(`subject_tracking:${source.source_id}`)
        qualityIssues.push({ issue_id: `${source.source_id}-tracking-loss`, source_id: source.source_id, kind: 'tracking_loss', severity: 'warn', detail: 'No stable subject track was found. The virtual camera must use a conservative crop.' })
      }
    } catch (error) {
      unavailable.add(`subject_tracking:${source.source_id}`)
      unavailable.add(`gesture_and_gaze:${source.source_id}`)
      qualityIssues.push({ issue_id: `${source.source_id}-analysis-failed`, source_id: source.source_id, kind: 'tracking_loss', severity: 'warn', detail: `Local visual analysis failed: ${error instanceof Error ? error.message : 'unknown analyzer error'}` })
    }

    const outputAspect = 9 / 16
    const verticalPixels = probe.width / outputAspect
    if (verticalPixels < 1920 && probe.height < 1920) {
      qualityIssues.push({ issue_id: `${source.source_id}-resolution`, source_id: source.source_id, kind: 'other', severity: 'warn', detail: 'Source resolution limits clean digital zoom for a 1080 by 1920 output.' })
    }
  }

  for (const source of sources) {
    const sourceSubjects = subjects.filter((subject) => subject.source_id === source.source_id)
    const hasVisualSpeaker = activeSpeakers.some((interval) => interval.source_id === source.source_id)
    if (!hasVisualSpeaker && sourceSubjects.length === 1 && source.audio_hz) {
      const subject = sourceSubjects[0]!
      activeSpeakers.push({ interval_id: `${source.source_id}-speaker-1`, source_id: source.source_id, track_id: subject.track_id, speaker_label: subject.role === 'krish' ? 'Krish' : subject.role === 'guest' ? 'Guest' : 'Job-local speaker', start_ms: 0, end_ms: source.duration_ms, overlap: false, confidence: 0.55 })
    } else if (!hasVisualSpeaker && sourceSubjects.length > 1) {
      unavailable.add(`active_speaker:${source.source_id}`)
    }
  }

  return SourceVisualAnalysisV1Schema.parse({
    schema_version: 1,
    analysis_id: `analysis-${hashValue({ jobId, bundle }).slice(0, 16)}`,
    job_id: jobId,
    source_bundle_hash: hashValue(bundle),
    coordinate_space: 'normalized_0_1',
    timebase: 'source_local_ms',
    generated_at: options.generatedAt,
    capabilities: {
      tier: 1,
      analyzers: { media_probe: 'ffprobe-system', scene_detection: 'ffmpeg-scene-v1', subject_tracking: 'mediapipe-local-v1', active_speaker: 'mediapipe-mouth-motion-v1', krish_face_identity: options.identityTemplate ? 'opencv-dct-face-v1' : 'unavailable', virtual_camera: 'mindmake-solver-v1' },
      unavailable: [...unavailable].sort(),
      fallbacks: [...fallbacks].sort(),
    },
    sources,
    shots,
    subjects,
    active_speakers: activeSpeakers,
    gestures,
    gaze,
    negative_space: negativeSpace,
    protected_regions: protectedRegions,
    sidecars: [],
    quality_issues: qualityIssues,
  })
}
