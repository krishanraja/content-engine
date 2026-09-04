import { resolve } from 'node:path'
import {
  CandidateV1Schema,
  JobManifestV2Schema,
  RenderManifestV2Schema,
  VisualNarrativePlanV1Schema,
  type CandidateV1,
  type GeneratedShotV1,
  type JobManifestV2,
  type RenderManifestV2,
  type StageNameV2,
  type VisualAssetV1,
  type VisualNarrativePlanV1,
} from '@mindmake/contracts'
import { composeEditTranscript, exactWordFidelity, normalizeSpokenToken } from './editorial.js'
import { hashValue } from './hash.js'
import type { NormalizedMediaSourceV2 } from './media.js'
import { sliceTranscript } from './captions.js'
import { alignScriptToTranscript, type TranscriptDocument } from './candidates.js'

const FRAME_TOLERANCE_MS = 34
const SHA256 = /^[a-f0-9]{64}$/

/**
 * The validator deliberately accepts current, content-addressed stage artifacts rather
 * than loose payloads. `readStageArtifactV2()` remains responsible for verifying each
 * artifact's semantic hash on disk; this module verifies that the supplied artifact is
 * still the one selected by job.json and that the render repeats its exact decisions.
 */
export type RenderLineageStageV2<S extends StageNameV2, T> = {
  artifact_hash: string
  job_id: string
  stage: StageNameV2
  payload: T
}

export interface RenderLineageCandidateEntryV2 {
  hash: string
  candidate: CandidateV1
}

export interface RenderLineageTranscriptPayloadV2 {
  source_id: string
  source_role: string
  canonical_offset_ms: number
  normalized_source_hash: string
  transcript: TranscriptDocument
  recording_alignment?: { start_ms: number; end_ms: number; similarity: number }
}

export interface RenderLineageNormalizePayloadV2 {
  source_bundle_hash: string
  sources: NormalizedMediaSourceV2[]
}

export interface RenderLineageAssetsPayloadV2 {
  visual_plan_artifact_hash: string
  assets: VisualAssetV1[]
  generated_shots: GeneratedShotV1[]
}

export interface ValidateRenderLineageV2Input {
  job: JobManifestV2
  manifest: RenderManifestV2
  candidateArtifact: RenderLineageStageV2<'candidates', { candidates: RenderLineageCandidateEntryV2[] }>
  visualPlanArtifact: RenderLineageStageV2<'visual_plan', VisualNarrativePlanV1>
  normalizeArtifact: RenderLineageStageV2<'normalize', RenderLineageNormalizePayloadV2>
  transcriptArtifact: RenderLineageStageV2<'transcript', RenderLineageTranscriptPayloadV2>
  assetsArtifact: RenderLineageStageV2<'assets', RenderLineageAssetsPayloadV2>
}

export interface RecomputedCaptionProvenanceV2 {
  transcript_hash: string
  verified: boolean
  exact_word_fidelity: boolean
  source_token_count: number
  caption_token_count: number
}

export interface RenderLineageValidationV2 {
  passed: boolean
  issues: string[]
  recomputed_caption_provenance: RecomputedCaptionProvenanceV2
}

interface EditorialTimelineRange {
  outputStartMs: number
  outputEndMs: number
  canonicalStartMs: number
  canonicalEndMs: number
  label: string
}

function tokens(value: string): string[] {
  return value.split(/\s+/).map(normalizeSpokenToken).filter(Boolean)
}

function sameTokens(left: string, right: string): boolean {
  return hashValue(tokens(left)) === hashValue(tokens(right))
}

function closeEnough(left: number, right: number): boolean {
  return Math.abs(left - right) <= FRAME_TOLERANCE_MS
}

function exactStageBinding<T, S extends StageNameV2>(
  job: JobManifestV2,
  expectedStage: S,
  artifact: RenderLineageStageV2<S, T>,
  issues: string[],
): void {
  if (artifact.job_id !== job.job_id) issues.push(`${expectedStage} artifact belongs to a different job`)
  if (artifact.stage !== expectedStage) issues.push(`${expectedStage} lineage input declares stage ${artifact.stage}`)
  const current = job.stages[expectedStage]
  if (current.status !== 'complete' || !current.artifact_hash) issues.push(`current ${expectedStage} stage is not complete`)
  else if (current.artifact_hash !== artifact.artifact_hash) issues.push(`${expectedStage} artifact is not the current job artifact`)
}

function findTimelineRange(ranges: EditorialTimelineRange[], startMs: number, endMs: number): EditorialTimelineRange | undefined {
  return ranges.find((range) => startMs >= range.outputStartMs - FRAME_TOLERANCE_MS && endMs <= range.outputEndMs + FRAME_TOLERANCE_MS)
}

function expectedCanonicalAt(range: EditorialTimelineRange, outputMs: number): number {
  return range.canonicalStartMs + outputMs - range.outputStartMs
}

function validateTranscriptDocument(transcript: TranscriptDocument, sourceDurationMs: number, issues: string[]): void {
  if (!transcript.segments.length) {
    issues.push('current transcript contains no timed segments')
    return
  }
  let previousStart = -1
  transcript.segments.forEach((segment, segmentIndex) => {
    if (!Number.isInteger(segment.start_ms) || !Number.isInteger(segment.end_ms) || segment.start_ms < 0 || segment.end_ms <= segment.start_ms) {
      issues.push(`transcript segment ${segmentIndex} has invalid source timing`)
    }
    if (segment.start_ms < previousStart) issues.push('transcript segments are not in source-time order')
    if (segment.end_ms > sourceDurationMs + 250) issues.push(`transcript segment ${segmentIndex} exceeds the normalized transcript source`)
    previousStart = segment.start_ms
    segment.words?.forEach((word, wordIndex) => {
      if (word.start_ms < segment.start_ms || word.end_ms > segment.end_ms || word.end_ms <= word.start_ms) {
        issues.push(`transcript word ${segmentIndex}:${wordIndex} falls outside its segment`)
      }
    })
    if (segment.words?.length && !sameTokens(segment.text, segment.words.map((word) => word.text).join(' '))) {
      issues.push(`transcript segment ${segmentIndex} text disagrees with its authoritative timed words`)
    }
  })
}

function editorialTimeline(
  job: JobManifestV2,
  candidate: CandidateV1,
  transcriptPayload: RenderLineageTranscriptPayloadV2,
  issues: string[],
): { ranges: EditorialTimelineRange[]; expectedCaptionScript: string; selectedTranscript: TranscriptDocument } | undefined {
  if (job.mode === 'short_native') {
    if (candidate.edit_plan) issues.push('short-native lineage cannot silently substitute an extracted edit plan for its approved recording')
    let alignment: { start_ms: number; end_ms: number; similarity: number }
    try {
      alignment = alignScriptToTranscript(candidate.transcript, transcriptPayload.transcript)
    } catch (error) {
      issues.push(`approved short-native script cannot be independently aligned to the current recording: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
    if (alignment.similarity < 0.72) issues.push(`recomputed short-native recording similarity ${alignment.similarity.toFixed(2)} is below 0.72`)
    const asserted = transcriptPayload.recording_alignment
    if (!asserted) issues.push('short-native transcript lacks a recorded alignment decision')
    else if (asserted.start_ms !== alignment.start_ms || asserted.end_ms !== alignment.end_ms || Math.abs(asserted.similarity - alignment.similarity) > 1e-9) {
      issues.push('short-native recording alignment does not match the independently recomputed alignment')
    }
    const selectedTranscript = sliceTranscript(transcriptPayload.transcript, alignment.start_ms, alignment.end_ms)
    const recordingFidelity = exactWordFidelity(candidate.transcript, selectedTranscript)
    if (!recordingFidelity.exact_word_fidelity || recordingFidelity.source_token_count !== recordingFidelity.caption_token_count) {
      issues.push('short-native recording wording is not an exact ordered match for the approved script')
    }
    return {
      ranges: [{
        outputStartMs: 0,
        outputEndMs: alignment.end_ms - alignment.start_ms,
        canonicalStartMs: alignment.start_ms + transcriptPayload.canonical_offset_ms,
        canonicalEndMs: alignment.end_ms + transcriptPayload.canonical_offset_ms,
        label: 'short-native-recording',
      }],
      expectedCaptionScript: candidate.transcript,
      selectedTranscript,
    }
  }

  if (transcriptPayload.recording_alignment) issues.push('extract/solo transcript contains short-native recording-alignment provenance')
  const editPlan = candidate.edit_plan
  if (!editPlan) {
    issues.push('extract/solo render lineage requires the exact approved edit_plan')
    return undefined
  }
  const ranges: EditorialTimelineRange[] = []
  if (editPlan.structure === 'continuous' && editPlan.segments.length !== 1) issues.push('continuous render lineage requires exactly one approved source span')
  if (editPlan.structure === 'stitched' && editPlan.segments.length < 2) issues.push('stitched render lineage requires at least two approved source spans')
  const chronological = [...editPlan.segments].sort((left, right) => left.start_ms - right.start_ms || left.end_ms - right.end_ms)
  for (let index = 1; index < chronological.length; index += 1) {
    if (chronological[index]!.start_ms < chronological[index - 1]!.end_ms) issues.push('approved edit_plan source spans overlap or repeat source material')
  }
  const reordered = editPlan.segments.some((segment, index) => segment.segment_id !== chronological[index]?.segment_id)
  if (reordered !== (editPlan.source_order.decision === 'reordered')) issues.push('approved edit_plan source-order declaration disagrees with its source spans')
  let outputCursor = 0
  for (const segment of editPlan.segments) {
    const duration = segment.end_ms - segment.start_ms
    ranges.push({
      outputStartMs: outputCursor,
      outputEndMs: outputCursor + duration,
      canonicalStartMs: segment.start_ms + transcriptPayload.canonical_offset_ms,
      canonicalEndMs: segment.end_ms + transcriptPayload.canonical_offset_ms,
      label: segment.segment_id,
    })
    outputCursor += duration
    const segmentTranscript = composeEditTranscript(transcriptPayload.transcript, [segment])
    const segmentFidelity = exactWordFidelity(segment.transcript, segmentTranscript)
    if (!segmentFidelity.exact_word_fidelity) issues.push(`approved edit_plan segment ${segment.segment_id} is not source-faithful`)
    else if (segmentFidelity.source_token_count !== segmentFidelity.caption_token_count) issues.push(`approved edit_plan segment ${segment.segment_id} hides spoken words inside its selected audio span`)
  }
  if (outputCursor !== editPlan.total_duration_ms) issues.push('approved edit_plan duration does not equal its selected source spans')
  const selectedTranscript = composeEditTranscript(transcriptPayload.transcript, editPlan.segments)
  const approvedFidelity = exactWordFidelity(editPlan.caption_script, selectedTranscript)
  if (!approvedFidelity.exact_word_fidelity) issues.push('approved extract caption script is no longer deletion-only and source-ordered against the current transcript')
  else if (approvedFidelity.source_token_count !== approvedFidelity.caption_token_count) issues.push('approved extract caption script does not account for every spoken word in the selected audio')
  if (!sameTokens(editPlan.segments.map((segment) => segment.transcript).join(' '), editPlan.caption_script)) issues.push('approved edit_plan segment wording does not equal its caption script in output order')
  if (!sameTokens(candidate.transcript, editPlan.caption_script)) issues.push('current candidate wording no longer matches its approved edit_plan caption script')
  return { ranges, expectedCaptionScript: editPlan.caption_script, selectedTranscript }
}

function validateNormalizedSources(
  job: JobManifestV2,
  manifest: RenderManifestV2,
  normalizePayload: RenderLineageNormalizePayloadV2,
  issues: string[],
): Map<string, NormalizedMediaSourceV2> {
  const sourceBundle = job.source_bundle
  if (!sourceBundle) {
    issues.push('job has no current source bundle')
    return new Map()
  }
  if (normalizePayload.source_bundle_hash !== hashValue(sourceBundle)) issues.push('normalize artifact is not bound to the current source bundle')
  const included = sourceBundle.sources.filter((source) => source.include_in_edit)
  const includedIds = [...included.map((source) => source.source_id)].sort()
  const normalizedIds = [...normalizePayload.sources.map((source) => source.source_id)].sort()
  if (hashValue(includedIds) !== hashValue(normalizedIds)) issues.push('normalize artifact does not contain exactly the current included source set')
  if (new Set(normalizedIds).size !== normalizedIds.length) issues.push('normalize artifact contains duplicate source IDs')

  const normalized = new Map(normalizePayload.sources.map((source) => [source.source_id, source]))
  for (const source of included) {
    const current = normalized.get(source.source_id)
    if (!current) continue
    if (current.kind !== source.kind) issues.push(`normalized source ${source.source_id} changed media kind`)
    if (current.canonical_offset_ms !== source.sync.offset_ms) issues.push(`normalized source ${source.source_id} changed its canonical offset`)
    if (source.content_hash && current.input_hash !== source.content_hash) issues.push(`normalized source ${source.source_id} is not derived from the source-bundle hash`)
  }

  const renderIds = [...manifest.sources.map((source) => source.source_id)].sort()
  if (hashValue(renderIds) !== hashValue(normalizedIds)) issues.push('render manifest does not contain exactly the current normalized source set')
  for (const renderSource of manifest.sources) {
    const current = normalized.get(renderSource.source_id)
    if (!current) continue
    if (resolve(renderSource.path) !== resolve(current.normalized_path)) issues.push(`render source ${renderSource.source_id} path is not the current normalized output`)
    if (renderSource.sha256 !== current.normalized_hash) issues.push(`render source ${renderSource.source_id} hash is not the current normalized hash`)
    if (renderSource.duration_ms !== current.duration_ms) issues.push(`render source ${renderSource.source_id} duration differs from normalization`)
    if (renderSource.audio_hz !== current.audio_hz) issues.push(`render source ${renderSource.source_id} audio rate differs from normalization`)
    if (renderSource.canonical_offset_ms !== current.canonical_offset_ms) issues.push(`render source ${renderSource.source_id} canonical offset differs from normalization`)
    if (renderSource.kind !== current.kind) issues.push(`render source ${renderSource.source_id} media kind differs from normalization`)
    if (current.kind === 'audio') {
      if (renderSource.width !== null || renderSource.height !== null || renderSource.fps !== null) issues.push(`audio-only render source ${renderSource.source_id} cannot invent visual geometry`)
    } else {
      if (current.width === null || current.height === null || current.fps === null) issues.push(`normalized visual source ${renderSource.source_id} lacks measured video geometry`)
      else {
        if (renderSource.width !== current.width || renderSource.height !== current.height) issues.push(`render source ${renderSource.source_id} geometry differs from normalization`)
        if (renderSource.fps === null || Math.abs(renderSource.fps - current.fps) > 0.001) issues.push(`render source ${renderSource.source_id} frame rate differs from normalization`)
      }
    }
  }
  return normalized
}

function validateDialogueTimeline(
  manifest: RenderManifestV2,
  normalized: Map<string, NormalizedMediaSourceV2>,
  ranges: EditorialTimelineRange[],
  issues: string[],
): void {
  for (const sourceId of manifest.audio_plan.dialogue_source_ids) {
    const source = normalized.get(sourceId)
    if (!source) issues.push(`dialogue source ${sourceId} is not a current normalized source`)
    else if (!source.audio_hz) issues.push(`dialogue source ${sourceId} has no normalized audio stream`)
  }
  const master = normalized.get(manifest.audio_plan.dialogue_master_source_id)
  if (!master?.audio_hz) issues.push('dialogue master is not a current normalized audio source')

  const authoredOrder = manifest.audio_plan.dialogue_edits
  const sorted = [...authoredOrder].sort((left, right) => left.output_start_ms - right.output_start_ms || left.output_end_ms - right.output_end_ms)
  if (hashValue(authoredOrder) !== hashValue(sorted)) issues.push('dialogue edits are not authored in output order')
  let coveredUntil = 0
  for (const edit of sorted) {
    if (edit.output_start_ms > coveredUntil + FRAME_TOLERANCE_MS) issues.push(`dialogue timeline has an uncovered gap before ${edit.edit_id}`)
    if (edit.output_start_ms < coveredUntil - FRAME_TOLERANCE_MS) issues.push(`dialogue timeline overlaps before ${edit.edit_id}`)
    coveredUntil = Math.max(coveredUntil, edit.output_end_ms)
    const source = normalized.get(edit.source_id)
    if (!source) continue
    const range = findTimelineRange(ranges, edit.output_start_ms, edit.output_end_ms)
    if (!range) {
      issues.push(`dialogue edit ${edit.edit_id} crosses or leaves an approved editorial source span`)
      continue
    }
    const actualCanonicalStart = edit.source_start_ms + source.canonical_offset_ms
    const actualCanonicalEnd = edit.source_end_ms + source.canonical_offset_ms
    const expectedStart = expectedCanonicalAt(range, edit.output_start_ms)
    const expectedEnd = expectedCanonicalAt(range, edit.output_end_ms)
    if (!closeEnough(actualCanonicalStart, expectedStart) || !closeEnough(actualCanonicalEnd, expectedEnd)) {
      issues.push(`dialogue edit ${edit.edit_id} does not match the approved ${range.label} canonical timing`)
    }
  }
  if (coveredUntil < manifest.duration_ms - FRAME_TOLERANCE_MS) issues.push('dialogue timeline does not cover the full render duration')
  if (coveredUntil > manifest.duration_ms + FRAME_TOLERANCE_MS) issues.push('dialogue timeline extends beyond the render duration')
}

function validatePlanTranscriptLineage(
  plan: VisualNarrativePlanV1,
  expectedCaptionScript: string,
  ranges: EditorialTimelineRange[],
  normalized: Map<string, NormalizedMediaSourceV2>,
  issues: string[],
): void {
  if (!sameTokens(plan.beats.map((beat) => beat.transcript).join(' '), expectedCaptionScript)) {
    issues.push('visual-plan beat transcript does not equal the exact approved caption wording in output order')
  }
  for (const beat of plan.beats) {
    const range = findTimelineRange(ranges, beat.start_ms, beat.end_ms)
    if (!range) {
      issues.push(`visual-plan beat ${beat.beat_id} crosses or leaves an approved editorial source span`)
      continue
    }
    let hasCanonicalSpeechSpan = false
    for (const span of beat.source_spans) {
      const source = normalized.get(span.source_id)
      if (!source) {
        issues.push(`visual-plan beat ${beat.beat_id} references non-current source ${span.source_id}`)
        continue
      }
      if (span.end_ms > source.duration_ms) issues.push(`visual-plan beat ${beat.beat_id} source span exceeds ${span.source_id}`)
      const expectedStart = expectedCanonicalAt(range, beat.start_ms)
      const expectedEnd = expectedCanonicalAt(range, beat.end_ms)
      if (closeEnough(span.start_ms + source.canonical_offset_ms, expectedStart) && closeEnough(span.end_ms + source.canonical_offset_ms, expectedEnd)) {
        hasCanonicalSpeechSpan = true
      }
    }
    if (!hasCanonicalSpeechSpan) issues.push(`visual-plan beat ${beat.beat_id} lacks a source span on the approved canonical speech timeline`)
  }
}

export function validateRenderLineageV2(input: ValidateRenderLineageV2Input): RenderLineageValidationV2 {
  const issues: string[] = []
  const parsedJob = JobManifestV2Schema.safeParse(input.job)
  const parsedManifest = RenderManifestV2Schema.safeParse(input.manifest)
  if (!parsedJob.success) issues.push(...parsedJob.error.issues.map((issue) => `job.${issue.path.join('.')}: ${issue.message}`))
  if (!parsedManifest.success) issues.push(...parsedManifest.error.issues.map((issue) => `manifest.${issue.path.join('.')}: ${issue.message}`))
  const fallback: RecomputedCaptionProvenanceV2 = {
    transcript_hash: input.transcriptArtifact.artifact_hash,
    verified: false,
    exact_word_fidelity: false,
    source_token_count: 0,
    caption_token_count: 0,
  }
  if (!parsedJob.success || !parsedManifest.success) return { passed: false, issues: [...new Set(issues)], recomputed_caption_provenance: fallback }
  const job = parsedJob.data
  const manifest = parsedManifest.data

  exactStageBinding(job, 'candidates', input.candidateArtifact, issues)
  exactStageBinding(job, 'visual_plan', input.visualPlanArtifact, issues)
  exactStageBinding(job, 'normalize', input.normalizeArtifact, issues)
  exactStageBinding(job, 'transcript', input.transcriptArtifact, issues)
  exactStageBinding(job, 'assets', input.assetsArtifact, issues)

  if (manifest.job_id !== job.job_id || manifest.series !== job.series || manifest.treatment_lane !== job.treatment_lane) issues.push('render manifest does not match the current job identity')
  if (!job.target_platforms.includes(manifest.target_platform)) issues.push('render manifest targets a platform outside the current job')
  if (job.purpose === 'production' && manifest.branding.mode !== 'series') issues.push('production render manifest must use official series branding')
  if (job.purpose === 'calibration' && manifest.branding.mode !== 'none') issues.push('calibration render manifest must remain analysis-only and unbranded')

  const matchingEntries = input.candidateArtifact.payload.candidates.filter((entry) => entry.candidate.candidate_id === manifest.candidate_id)
  if (matchingEntries.length !== 1) issues.push('render candidate is not a unique member of the current candidates artifact')
  const entry = matchingEntries.find((candidate) => candidate.hash === manifest.candidate_hash) || matchingEntries[0]
  if (!entry) return { passed: false, issues: [...new Set(issues)], recomputed_caption_provenance: fallback }
  if (!SHA256.test(entry.hash)) issues.push('current candidate entry has an invalid content hash')
  if (manifest.candidate_hash !== entry.hash) issues.push('render manifest is not bound to the exact current candidate hash')
  const parsedCandidate = CandidateV1Schema.safeParse(entry.candidate)
  if (!parsedCandidate.success) {
    issues.push(...parsedCandidate.error.issues.map((issue) => `candidate.${issue.path.join('.')}: ${issue.message}`))
    return { passed: false, issues: [...new Set(issues)], recomputed_caption_provenance: fallback }
  }
  const candidate = parsedCandidate.data
  if (candidate.job_id !== job.job_id || candidate.series !== job.series || candidate.mode !== job.mode) issues.push('current candidate identity does not match the current job')

  const parsedPlan = VisualNarrativePlanV1Schema.safeParse(input.visualPlanArtifact.payload)
  if (!parsedPlan.success) {
    issues.push(...parsedPlan.error.issues.map((issue) => `visual_plan.${issue.path.join('.')}: ${issue.message}`))
    return { passed: false, issues: [...new Set(issues)], recomputed_caption_provenance: fallback }
  }
  const plan = parsedPlan.data
  if (manifest.visual_plan_artifact_hash !== input.visualPlanArtifact.artifact_hash) issues.push('render manifest is not bound to the exact current visual-plan artifact')
  if (plan.job_id !== job.job_id || plan.candidate_id !== candidate.candidate_id || plan.candidate_hash !== entry.hash) issues.push('current visual plan is not bound to the exact current candidate')
  if (plan.claims_artifact_hash !== job.stages.claims.artifact_hash || job.stages.claims.status !== 'complete') issues.push('current visual plan is not bound to the current claims artifact')
  if (plan.source_analysis_artifact_hash !== job.stages.source_analysis.artifact_hash || job.stages.source_analysis.status !== 'complete') issues.push('current visual plan is not bound to the current source-analysis artifact')
  if (manifest.duration_ms !== plan.duration_ms) issues.push('render duration differs from the exact current visual plan')
  if (hashValue(manifest.shot_directives) !== hashValue(plan.shot_directives)) issues.push('render shot directives differ from the exact current visual plan')
  if (input.assetsArtifact.payload.visual_plan_artifact_hash !== input.visualPlanArtifact.artifact_hash) issues.push('current assets artifact is not bound to the current visual plan')
  if (hashValue(manifest.assets) !== hashValue(input.assetsArtifact.payload.assets)) issues.push('render asset ledger differs from the exact current assets artifact')
  if (hashValue(manifest.generated_shots) !== hashValue(input.assetsArtifact.payload.generated_shots)) issues.push('render generated-shot ledger differs from the exact current assets artifact')

  const normalized = validateNormalizedSources(job, manifest, input.normalizeArtifact.payload, issues)
  const transcriptSource = normalized.get(input.transcriptArtifact.payload.source_id)
  if (!transcriptSource) issues.push('current transcript source is not in the current normalized source set')
  else {
    if (input.transcriptArtifact.payload.normalized_source_hash !== transcriptSource.normalized_hash) issues.push('current transcript is not bound to its exact normalized source hash')
    if (input.transcriptArtifact.payload.canonical_offset_ms !== transcriptSource.canonical_offset_ms) issues.push('current transcript canonical offset differs from normalization')
    const sourceRole = job.source_bundle?.sources.find((source) => source.source_id === transcriptSource.source_id)?.role
    if (sourceRole && input.transcriptArtifact.payload.source_role !== sourceRole) issues.push('current transcript source role differs from the source bundle')
    if (!transcriptSource.audio_hz) issues.push('current transcript source has no normalized audio stream')
    validateTranscriptDocument(input.transcriptArtifact.payload.transcript, transcriptSource.duration_ms, issues)
  }

  const selection = editorialTimeline(job, candidate, input.transcriptArtifact.payload, issues)
  let recomputed = fallback
  if (selection) {
    const orderedCaptions = [...manifest.captions].sort((left, right) => left.start_ms - right.start_ms || left.end_ms - right.end_ms)
    if (hashValue(manifest.captions) !== hashValue(orderedCaptions)) issues.push('caption cues are not authored in output order')
    const captionText = orderedCaptions.map((caption) => caption.text).join(' ')
    const fidelity = exactWordFidelity(captionText, selection.selectedTranscript)
    if (!fidelity.exact_word_fidelity) issues.push('render captions invent, substitute, duplicate, or reorder words outside the current selected transcript')
    else if (fidelity.source_token_count !== fidelity.caption_token_count) issues.push('render captions omit spoken words that remain audible in the selected source spans')
    if (!sameTokens(captionText, selection.expectedCaptionScript)) issues.push('render captions do not equal the exact approved candidate wording')
    const completeFidelity = fidelity.exact_word_fidelity && fidelity.source_token_count === fidelity.caption_token_count
    recomputed = {
      transcript_hash: input.transcriptArtifact.artifact_hash,
      verified: completeFidelity && sameTokens(captionText, selection.expectedCaptionScript),
      exact_word_fidelity: completeFidelity,
      source_token_count: fidelity.source_token_count,
      caption_token_count: fidelity.caption_token_count,
    }
    const asserted = manifest.caption_provenance
    if (asserted.transcript_hash !== recomputed.transcript_hash) issues.push('caption provenance does not reference the exact current transcript artifact')
    if (asserted.exact_word_fidelity !== recomputed.exact_word_fidelity || asserted.verified !== recomputed.verified) issues.push('caption fidelity provenance is self-asserted and disagrees with recomputation')
    if (asserted.source_token_count !== recomputed.source_token_count || asserted.caption_token_count !== recomputed.caption_token_count) issues.push('caption provenance token counts disagree with recomputation')
    const editorialDuration = selection.ranges.at(-1)?.outputEndMs || 0
    if (manifest.duration_ms !== editorialDuration) issues.push('render duration differs from the exact approved editorial selection')
    validatePlanTranscriptLineage(plan, selection.expectedCaptionScript, selection.ranges, normalized, issues)
    validateDialogueTimeline(manifest, normalized, selection.ranges, issues)
  }

  const uniqueIssues = [...new Set(issues)]
  return { passed: uniqueIssues.length === 0, issues: uniqueIssues, recomputed_caption_provenance: recomputed }
}

export function assertRenderLineageV2(input: ValidateRenderLineageV2Input): RenderLineageValidationV2 {
  const result = validateRenderLineageV2(input)
  if (!result.passed) throw new Error(`render lineage validation failed: ${result.issues.join('; ')}`)
  return result
}
