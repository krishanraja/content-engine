import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import {
  ConfigChangeProposalV1Schema,
  FeedbackConfirmationV2Schema,
  FeedbackEventV2Schema,
  FeedbackEventV1Schema,
  PreferenceRuleV1Schema,
  SCHEMA_VERSION,
  type ConfigChangeProposalV1,
  type FeedbackConfirmationV2,
  type FeedbackEventV1,
  type FeedbackEventV2,
  type PreferenceRuleV1,
  type StageName,
  type StageNameV2,
  type VideoPlatformV1,
} from '@mindmake/contracts'
import { hashFile, hashValue } from './hash.js'
import { jobPath, studioPaths } from './paths.js'
import { analyzeLoudness, detectSceneCuts, framePerceptualHashes, probeMedia, transcribeMedia } from './media.js'
import { analyzeCaptionRegions } from './caption-analysis.js'
import { recordJobEvent } from './job-store.js'
import { recordJobEventV2 } from './job-store-v2.js'

export async function analyzeMediaArtifactForFeedback(repoRoot: string, path: string, outputDirectory: string, label: string, transcriptionModel = 'base.en', vocabulary: string[] = []): Promise<Record<string, unknown>> {
  const [artifactFileSha256, probe, loudness, cuts, frameHashes] = await Promise.all([
    hashFile(path),
    probeMedia(path),
    analyzeLoudness(path),
    detectSceneCuts(path),
    framePerceptualHashes(path),
  ])
  let transcript: unknown = null
  let transcriptStatus = 'complete'
  try {
    transcript = await transcribeMedia(repoRoot, path, join(outputDirectory, `${label}-transcript.json`), transcriptionModel, vocabulary)
  } catch { transcriptStatus = 'unavailable' }
  const captionRegionAnalysis = await analyzeCaptionRegions(
    repoRoot,
    path,
    outputDirectory,
    label,
    artifactFileSha256,
    Math.max(1, Math.round(probe.duration_seconds * 1000)),
  )
  if (await hashFile(path) !== artifactFileSha256) throw new Error('media changed during feedback analysis; retry with a stable file')
  return {
    artifact_file_sha256: artifactFileSha256,
    probe,
    loudness,
    scene_cuts_ms: cuts,
    frame_ahashes: frameHashes,
    transcript,
    transcript_status: transcriptStatus,
    caption_ocr_status: captionRegionAnalysis.caption_ocr.status,
    caption_region_analysis: captionRegionAnalysis,
  }
}

function mediaArtifactHash(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (typeof record.artifact_file_sha256 === 'string' && /^[a-f0-9]{64}$/.test(record.artifact_file_sha256)) return record.artifact_file_sha256
  return mediaArtifactHash(record.artifact)
}

const feedbackLedgerPathV2 = (): string => join(studioPaths().runtimeRoot, 'learning', 'feedback-v2.jsonl')
const confirmationLedgerPathV2 = (): string => join(studioPaths().runtimeRoot, 'learning', 'confirmations-v2.jsonl')

async function readFeedbackLedgerV2(): Promise<FeedbackEventV2[]> {
  let body: string
  try {
    body = await readFile(feedbackLedgerPathV2(), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return body.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try {
      const parsed = FeedbackEventV2Schema.safeParse(JSON.parse(line))
      return parsed.success ? [parsed.data] : []
    } catch {
      return []
    }
  })
}

async function readConfirmationLedgerV2(): Promise<FeedbackConfirmationV2[]> {
  let body: string
  try {
    body = await readFile(confirmationLedgerPathV2(), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return body.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try {
      const parsed = FeedbackConfirmationV2Schema.safeParse(JSON.parse(line))
      return parsed.success ? [parsed.data] : []
    } catch {
      return []
    }
  })
}

export function feedbackEventHashV2(event: FeedbackEventV2): string {
  return hashValue(FeedbackEventV2Schema.parse(event))
}

function confirmedEventForReceipt(canonical: FeedbackEventV2, receipt: FeedbackConfirmationV2): FeedbackEventV2 {
  return FeedbackEventV2Schema.parse({
    ...canonical,
    inferred_rationale: receipt.confirmed_rationale,
    confidence: 1,
    confirmation: receipt.confirmation,
  })
}

function receiptMatchesCanonicalEvent(receipt: FeedbackConfirmationV2, canonical: FeedbackEventV2): boolean {
  return receipt.feedback_id === canonical.feedback_id
    && receipt.job_id === canonical.job_id
    && receipt.event_hash === feedbackEventHashV2(canonical)
}

async function verifiedConfirmationForEventV2(event: FeedbackEventV2): Promise<FeedbackConfirmationV2 | undefined> {
  const canonicalEvents = await readFeedbackLedgerV2()
  const receipts = await readConfirmationLedgerV2()
  for (const receipt of [...receipts].reverse()) {
    const canonical = canonicalEvents.find((candidate) => receiptMatchesCanonicalEvent(receipt, candidate))
    if (!canonical || canonical.feedback_id !== event.feedback_id) continue
    if (hashValue(confirmedEventForReceipt(canonical, receipt)) === hashValue(event)) return receipt
  }
  return undefined
}

export async function hasVerifiedExternalFinalConfirmationV2(jobId: string, artifactHash: string, platform?: VideoPlatformV1): Promise<boolean> {
  const canonicalEvents = await readFeedbackLedgerV2()
  const receipts = await readConfirmationLedgerV2()
  return receipts.some((receipt) => {
    const event = canonicalEvents.find((candidate) => receiptMatchesCanonicalEvent(receipt, candidate))
    if (!event) return false
    if (event.job_id !== jobId || event.artifact_kind !== 'external_final' || !event.exact_external_final) return false
    if (event.after_hash !== artifactHash || event.origin !== 'user' || event.action === 'reject') return false
    if (platform && (event.scope.level !== 'platform' || event.scope.key !== platform)) return false
    return true
  })
}

interface FlatValue { path: string; value: unknown }

const rulesPath = (): string => join(studioPaths().runtimeRoot, 'learning', 'rules.json')

export async function listRules(): Promise<PreferenceRuleV1[]> {
  try { return PreferenceRuleV1Schema.array().parse(JSON.parse(await readFile(rulesPath(), 'utf8'))) }
  catch { return [] }
}

async function saveRules(rules: PreferenceRuleV1[]): Promise<void> {
  const path = rulesPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(rules, null, 2)}\n`, 'utf8')
}

function flatten(value: unknown, prefix = ''): FlatValue[] {
  if (Array.isArray(value)) return value.flatMap((child, index) => flatten(child, `${prefix}[${index}]`))
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key))
  return [{ path: prefix || '$', value }]
}

export function diffArtifacts(before: unknown, after: unknown): FeedbackEventV1['delta_features'] {
  const left = new Map(flatten(before).map((item) => [item.path, item.value]))
  const right = new Map(flatten(after).map((item) => [item.path, item.value]))
  const keys = [...new Set([...left.keys(), ...right.keys()])].sort()
  return keys
    .filter((key) => hashValue(left.get(key)) !== hashValue(right.get(key)))
    .map((key) => ({ feature: key, before: left.get(key), after: right.get(key) }))
}

type FeedbackDeltaV2 = FeedbackEventV2['delta_features'][number]

interface ComparedTranscriptToken {
  normalized: string
  display: string
  start_ms?: number
  end_ms?: number
}

interface OrderedTokenEdit {
  kind: 'remove' | 'add' | 'substitute'
  before_index: number
  after_index: number
  before_tokens: string[]
  after_tokens: string[]
}

interface OrderedTokenComparison {
  before_tokens: ComparedTranscriptToken[]
  after_tokens: ComparedTranscriptToken[]
  matches: Array<{ before_index: number; after_index: number }>
  edits: OrderedTokenEdit[]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function externalMediaRecord(value: unknown): Record<string, unknown> {
  const record = asRecord(value) || {}
  return asRecord(record.artifact) || record
}

function externalSidecars(value: unknown): Record<string, unknown> {
  return asRecord(asRecord(value)?.sidecars) || {}
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function rounded(value: number, digits = 3): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function feedbackDelta(feature: string, before: unknown, after: unknown): FeedbackDeltaV2 {
  return {
    feature,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  }
}

function mediaDurationMs(record: Record<string, unknown>): number | undefined {
  const probe = asRecord(record.probe)
  const seconds = finiteNumber(probe?.duration_seconds) ?? finiteNumber(record.duration_seconds)
  return seconds === undefined ? undefined : Math.max(0, Math.round(seconds * 1000))
}

function transcriptTokens(record: Record<string, unknown>): ComparedTranscriptToken[] {
  const transcript = asRecord(record.transcript)
  if (!transcript) return []
  const segments = Array.isArray(transcript.segments) ? transcript.segments : []
  const result: ComparedTranscriptToken[] = []
  const addText = (value: unknown, timing?: { start_ms?: number; end_ms?: number }): void => {
    if (typeof value !== 'string') return
    for (const match of value.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)) {
      const display = match[0] as string
      result.push({
        normalized: display.normalize('NFKC').replaceAll('’', "'").toLocaleLowerCase('en-GB'),
        display,
        ...(timing?.start_ms === undefined ? {} : { start_ms: timing.start_ms }),
        ...(timing?.end_ms === undefined ? {} : { end_ms: timing.end_ms }),
      })
    }
  }
  for (const segmentValue of segments) {
    const segment = asRecord(segmentValue)
    if (!segment) continue
    const words = Array.isArray(segment.words) ? segment.words : []
    if (words.length) {
      for (const wordValue of words) {
        const word = asRecord(wordValue)
        if (!word) continue
        addText(word.text, {
          ...(finiteNumber(word.start_ms) === undefined ? {} : { start_ms: Math.round(finiteNumber(word.start_ms) as number) }),
          ...(finiteNumber(word.end_ms) === undefined ? {} : { end_ms: Math.round(finiteNumber(word.end_ms) as number) }),
        })
      }
    } else {
      addText(segment.text, {
        ...(finiteNumber(segment.start_ms) === undefined ? {} : { start_ms: Math.round(finiteNumber(segment.start_ms) as number) }),
        ...(finiteNumber(segment.end_ms) === undefined ? {} : { end_ms: Math.round(finiteNumber(segment.end_ms) as number) }),
      })
    }
  }
  if (!segments.length) addText(transcript.text)
  return result
}

function compareOrderedTokens(beforeTokens: ComparedTranscriptToken[], afterTokens: ComparedTranscriptToken[]): OrderedTokenComparison {
  const rows = Array.from({ length: beforeTokens.length + 1 }, () => new Uint32Array(afterTokens.length + 1))
  for (let left = beforeTokens.length - 1; left >= 0; left -= 1) {
    const row = rows[left] as Uint32Array
    const next = rows[left + 1] as Uint32Array
    for (let right = afterTokens.length - 1; right >= 0; right -= 1) {
      row[right] = beforeTokens[left]?.normalized === afterTokens[right]?.normalized
        ? 1 + (next[right + 1] as number)
        : Math.max(next[right] as number, row[right + 1] as number)
    }
  }

  const matches: Array<{ before_index: number; after_index: number }> = []
  const edits: OrderedTokenEdit[] = []
  let beforeIndex = 0
  let afterIndex = 0
  let removed: string[] = []
  let added: string[] = []
  let blockBeforeIndex = 0
  let blockAfterIndex = 0
  const flush = (): void => {
    if (!removed.length && !added.length) return
    edits.push({
      kind: removed.length && added.length ? 'substitute' : removed.length ? 'remove' : 'add',
      before_index: blockBeforeIndex,
      after_index: blockAfterIndex,
      before_tokens: removed,
      after_tokens: added,
    })
    removed = []
    added = []
  }

  while (beforeIndex < beforeTokens.length || afterIndex < afterTokens.length) {
    if (beforeIndex < beforeTokens.length && afterIndex < afterTokens.length && beforeTokens[beforeIndex]?.normalized === afterTokens[afterIndex]?.normalized) {
      flush()
      matches.push({ before_index: beforeIndex, after_index: afterIndex })
      beforeIndex += 1
      afterIndex += 1
      continue
    }
    if (!removed.length && !added.length) {
      blockBeforeIndex = beforeIndex
      blockAfterIndex = afterIndex
    }
    const removeScore = rows[beforeIndex + 1]?.[afterIndex] ?? 0
    const addScore = rows[beforeIndex]?.[afterIndex + 1] ?? 0
    if (beforeIndex < beforeTokens.length && (afterIndex >= afterTokens.length || removeScore >= addScore)) {
      removed.push(beforeTokens[beforeIndex]?.display as string)
      beforeIndex += 1
    } else if (afterIndex < afterTokens.length) {
      added.push(afterTokens[afterIndex]?.display as string)
      afterIndex += 1
    }
  }
  flush()
  return { before_tokens: beforeTokens, after_tokens: afterTokens, matches, edits }
}

function numericArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(finiteNumber).filter((item): item is number => item !== undefined).map(Math.round).sort((left, right) => left - right)
    : []
}

function hashArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && /^[a-f\d]+$/i.test(item)) : []
}

const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4] as const

function perceptualHashDistance(left: string, right: string): number | undefined {
  if (left.length !== right.length || !left.length) return undefined
  let distance = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftNibble = Number.parseInt(left[index] as string, 16)
    const rightNibble = Number.parseInt(right[index] as string, 16)
    if (!Number.isInteger(leftNibble) || !Number.isInteger(rightNibble)) return undefined
    distance += NIBBLE_BITS[leftNibble ^ rightNibble] as number
  }
  return distance
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  if (ordered.length % 2) return ordered[middle] as number
  return ((ordered[middle - 1] as number) + (ordered[middle] as number)) / 2
}

interface FrameAlignment {
  before_sample_offset: number
  compared_samples: number
  median_hamming_distance: number
  normalized_median_distance: number
  confidence: 'high' | 'medium' | 'low'
}

function bestFrameAlignment(before: string[], after: string[]): FrameAlignment | undefined {
  if (!before.length || !after.length) return undefined
  let best: Omit<FrameAlignment, 'confidence'> | undefined
  for (let offset = -(after.length - 1); offset <= before.length - 1; offset += 1) {
    const beforeStart = Math.max(0, offset)
    const afterStart = Math.max(0, -offset)
    const overlap = Math.min(before.length - beforeStart, after.length - afterStart)
    if (overlap <= 0) continue
    const distances: number[] = []
    for (let index = 0; index < overlap; index += 1) {
      const distance = perceptualHashDistance(before[beforeStart + index] as string, after[afterStart + index] as string)
      if (distance !== undefined) distances.push(distance)
    }
    if (!distances.length) continue
    const bitCount = (before[beforeStart] as string).length * 4
    const candidate = {
      before_sample_offset: offset,
      compared_samples: distances.length,
      median_hamming_distance: rounded(median(distances), 2),
      normalized_median_distance: rounded(median(distances) / bitCount, 4),
    }
    if (!best
      || candidate.normalized_median_distance < best.normalized_median_distance
      || (candidate.normalized_median_distance === best.normalized_median_distance && candidate.compared_samples > best.compared_samples)
      || (candidate.normalized_median_distance === best.normalized_median_distance && candidate.compared_samples === best.compared_samples && Math.abs(candidate.before_sample_offset) < Math.abs(best.before_sample_offset))) best = candidate
  }
  if (!best) return undefined
  const confidence = best.compared_samples >= 3 && best.normalized_median_distance <= 0.15
    ? 'high'
    : best.compared_samples >= 2 && best.normalized_median_distance <= 0.25 ? 'medium' : 'low'
  return { ...best, confidence }
}

function videoGeometry(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const probe = asRecord(record.probe) || record
  const width = finiteNumber(probe.width)
  const height = finiteNumber(probe.height)
  const fps = finiteNumber(probe.average_fps)
  if (width === undefined && height === undefined && fps === undefined) return undefined
  return {
    ...(width === undefined ? {} : { width: Math.round(width) }),
    ...(height === undefined ? {} : { height: Math.round(height) }),
    ...(width === undefined || height === undefined || height === 0 ? {} : { aspect_ratio: rounded(width / height, 6) }),
    ...(fps === undefined ? {} : { average_fps: rounded(fps, 3) }),
  }
}

function captionOcrDiagnostic(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const analysis = asRecord(record.caption_region_analysis)
  const ocrSummary = asRecord(analysis?.caption_ocr)
  const status = typeof record.caption_ocr_status === 'string'
    ? record.caption_ocr_status
    : typeof ocrSummary?.status === 'string' ? ocrSummary.status : undefined
  const samples = Array.isArray(analysis?.samples) ? analysis.samples : []
  const phrases: Array<{ at_ms: number | null; text: string; mean_confidence?: number }> = []
  let previousNormalized = ''
  for (const sampleValue of samples) {
    const sample = asRecord(sampleValue)
    const ocr = asRecord(sample?.ocr)
    const text = typeof ocr?.text === 'string' ? ocr.text.normalize('NFKC').replace(/\s+/g, ' ').trim() : ''
    const normalized = text.toLocaleLowerCase('en-GB')
    if (!text || normalized === previousNormalized) continue
    previousNormalized = normalized
    const confidence = finiteNumber(ocr?.mean_confidence)
    phrases.push({
      at_ms: finiteNumber(sample?.at_ms) === undefined ? null : Math.round(finiteNumber(sample?.at_ms) as number),
      text,
      ...(confidence === undefined ? {} : { mean_confidence: rounded(confidence, 3) }),
    })
  }
  if (status === undefined && !analysis) return undefined
  return {
    status: status || 'unknown',
    engine: typeof ocrSummary?.engine === 'string' ? ocrSummary.engine : null,
    engine_version: typeof ocrSummary?.engine_version === 'string' ? ocrSummary.engine_version : null,
    precision: 'diagnostic_only',
    phrase_count: phrases.length,
    phrase_sequence_sha256: hashValue(phrases.map((phrase) => phrase.text.toLocaleLowerCase('en-GB'))),
    phrases,
  }
}

function captionRegionFingerprint(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const analysis = asRecord(record.caption_region_analysis)
  if (!analysis) return undefined
  const sampling = asRecord(analysis.sampling) || {}
  const analysisContract = {
    analyzer: typeof analysis.analyzer === 'string' ? analysis.analyzer : null,
    method: typeof analysis.method === 'string' ? analysis.method : null,
    analyzer_file_sha256: typeof analysis.implementation_file_sha256 === 'string' ? analysis.implementation_file_sha256 : null,
    tool_versions_sha256: hashValue(asRecord(analysis.implementation) || null),
    region_normalized: asRecord(sampling.region_normalized) || null,
    interval_ms: finiteNumber(sampling.interval_ms) === undefined ? null : Math.round(finiteNumber(sampling.interval_ms) as number),
  }
  const samples = Array.isArray(analysis.samples) ? analysis.samples.map(asRecord).filter((item): item is Record<string, unknown> => item !== undefined) : []
  const pixelSequence = samples.map((sample) => sample.normalized_pixel_sha256).filter((value): value is string => typeof value === 'string' && /^[a-f\d]{64}$/i.test(value))
  const perceptualSequence = samples.map((sample) => sample.perceptual_hash).filter((value): value is string => typeof value === 'string' && /^[a-f\d]+$/i.test(value))
  if (!pixelSequence.length && !perceptualSequence.length) return undefined
  return {
    compatibility_sha256: hashValue(analysisContract),
    analysis_contract: analysisContract,
    sample_count: samples.length,
    interval_ms: finiteNumber(sampling.interval_ms) === undefined ? null : Math.round(finiteNumber(sampling.interval_ms) as number),
    region_normalized: asRecord(sampling.region_normalized) || null,
    normalized_pixel_sequence_sha256: hashValue(pixelSequence),
    perceptual_sequence_sha256: hashValue(perceptualSequence),
    perceptual_sequence: perceptualSequence,
  }
}

function analysisExtras(record: Record<string, unknown>): Record<string, unknown> {
  const excluded = new Set(['artifact_file_sha256', 'duration_seconds', 'probe', 'loudness', 'scene_cuts_ms', 'frame_ahashes', 'transcript', 'transcript_status', 'caption_ocr_status', 'caption_region_analysis'])
  return Object.fromEntries(Object.entries(record).filter(([key]) => !excluded.has(key)))
}

/**
 * Compare the two analyzed media objects used for an external-final import. The
 * comparison deliberately describes editorial changes instead of persisting a
 * noisy field-by-field diff of ASR segments and sampled frames. Exact media hashes,
 * exact sidecar changes, and any analysis fields this version does not yet
 * understand are still retained.
 */
export function diffExternalFinalArtifacts(before: unknown, after: unknown): FeedbackEventV2['delta_features'] {
  const beforeMedia = externalMediaRecord(before)
  const afterMedia = externalMediaRecord(after)
  const deltas: FeedbackEventV2['delta_features'] = []

  const beforeHash = mediaArtifactHash(before)
  const afterHash = mediaArtifactHash(after)
  if (beforeHash !== afterHash) deltas.push(feedbackDelta('external_final.media_sha256', beforeHash, afterHash))

  const beforeDuration = mediaDurationMs(beforeMedia)
  const afterDuration = mediaDurationMs(afterMedia)
  const tokenComparison = compareOrderedTokens(transcriptTokens(beforeMedia), transcriptTokens(afterMedia))
  const firstMatch = tokenComparison.matches[0]
  const lastMatch = tokenComparison.matches.at(-1)
  const beforeFrames = hashArray(beforeMedia.frame_ahashes)
  const afterFrames = hashArray(afterMedia.frame_ahashes)
  const frameAlignment = bestFrameAlignment(beforeFrames, afterFrames)
  const leadingRemovedTokens = firstMatch?.before_index ?? tokenComparison.before_tokens.length
  const leadingAddedTokens = firstMatch?.after_index ?? tokenComparison.after_tokens.length
  const trailingRemovedTokens = lastMatch ? tokenComparison.before_tokens.length - lastMatch.before_index - 1 : tokenComparison.before_tokens.length
  const trailingAddedTokens = lastMatch ? tokenComparison.after_tokens.length - lastMatch.after_index - 1 : tokenComparison.after_tokens.length
  const matchedBeforeStart = firstMatch === undefined ? undefined : tokenComparison.before_tokens[firstMatch.before_index]?.start_ms
  const matchedAfterStart = firstMatch === undefined ? undefined : tokenComparison.after_tokens[firstMatch.after_index]?.start_ms
  const matchedBeforeEnd = lastMatch === undefined ? undefined : tokenComparison.before_tokens[lastMatch.before_index]?.end_ms
  const matchedAfterEnd = lastMatch === undefined ? undefined : tokenComparison.after_tokens[lastMatch.after_index]?.end_ms
  const estimatedHeadTrimMs = matchedBeforeStart === undefined || matchedAfterStart === undefined ? undefined : Math.max(0, matchedBeforeStart - matchedAfterStart)
  const estimatedTailTrimMs = beforeDuration === undefined || afterDuration === undefined || matchedBeforeEnd === undefined || matchedAfterEnd === undefined
    ? undefined
    : Math.max(0, (beforeDuration - matchedBeforeEnd) - (afterDuration - matchedAfterEnd))
  const durationChanged = beforeDuration !== afterDuration
  const boundaryTokensChanged = leadingRemovedTokens > 0 || leadingAddedTokens > 0 || trailingRemovedTokens > 0 || trailingAddedTokens > 0
  const reliableFrameOffset = frameAlignment && frameAlignment.confidence !== 'low' && frameAlignment.before_sample_offset !== 0
  if (durationChanged || boundaryTokensChanged || reliableFrameOffset) {
    deltas.push(feedbackDelta('external_final.duration_and_trims',
      { duration_ms: beforeDuration },
      {
        duration_ms: afterDuration,
        ...(beforeDuration === undefined || afterDuration === undefined ? {} : { duration_delta_ms: afterDuration - beforeDuration }),
        leading_removed_token_count: leadingRemovedTokens,
        leading_added_token_count: leadingAddedTokens,
        trailing_removed_token_count: trailingRemovedTokens,
        trailing_added_token_count: trailingAddedTokens,
        ...(estimatedHeadTrimMs === undefined ? {} : { estimated_head_trim_ms: estimatedHeadTrimMs }),
        ...(estimatedTailTrimMs === undefined ? {} : { estimated_tail_trim_ms: estimatedTailTrimMs }),
        ...(!frameAlignment || frameAlignment.confidence === 'low' ? {} : { frame_inferred_head_offset_ms: frameAlignment.before_sample_offset * 5_000 }),
        inference_basis: 'duration, ordered transcript alignment, and reliable five-second frame samples where available; trim estimates may include retiming',
      }))
  }

  if (tokenComparison.edits.length) {
    const removedCount = tokenComparison.edits.filter((edit) => edit.kind === 'remove').reduce((total, edit) => total + edit.before_tokens.length, 0)
    const addedCount = tokenComparison.edits.filter((edit) => edit.kind === 'add').reduce((total, edit) => total + edit.after_tokens.length, 0)
    const substitutions = tokenComparison.edits.filter((edit) => edit.kind === 'substitute')
    deltas.push(feedbackDelta('external_final.transcript_ordered_token_edits',
      { token_count: tokenComparison.before_tokens.length, ordered_token_sha256: hashValue(tokenComparison.before_tokens.map((token) => token.normalized)) },
      {
        token_count: tokenComparison.after_tokens.length,
        ordered_token_sha256: hashValue(tokenComparison.after_tokens.map((token) => token.normalized)),
        removed_token_count: removedCount,
        added_token_count: addedCount,
        substitution_count: substitutions.length,
        substituted_before_token_count: substitutions.reduce((total, edit) => total + edit.before_tokens.length, 0),
        substituted_after_token_count: substitutions.reduce((total, edit) => total + edit.after_tokens.length, 0),
        edits: tokenComparison.edits,
      }))
  }

  const beforeCuts = numericArray(beforeMedia.scene_cuts_ms)
  const afterCuts = numericArray(afterMedia.scene_cuts_ms)
  if (hashValue(beforeCuts) !== hashValue(afterCuts)) {
    deltas.push(feedbackDelta('external_final.scene_cuts', { count: beforeCuts.length, timing_ms: beforeCuts }, { count: afterCuts.length, timing_ms: afterCuts }))
  }

  const beforeLoudness = asRecord(beforeMedia.loudness) || {}
  const afterLoudness = asRecord(afterMedia.loudness) || {}
  const beforeLufs = finiteNumber(beforeLoudness.integrated_lufs)
  const afterLufs = finiteNumber(afterLoudness.integrated_lufs)
  if (beforeLufs !== afterLufs) deltas.push(feedbackDelta('external_final.integrated_lufs', beforeLufs ?? null, afterLufs ?? null))
  const beforePeak = finiteNumber(beforeLoudness.true_peak_dbtp)
  const afterPeak = finiteNumber(afterLoudness.true_peak_dbtp)
  if (beforePeak !== afterPeak) deltas.push(feedbackDelta('external_final.true_peak_dbtp', beforePeak ?? null, afterPeak ?? null))

  if (hashValue(beforeFrames) !== hashValue(afterFrames)) {
    deltas.push(feedbackDelta('external_final.frame_crop_fingerprint',
      { sample_count: beforeFrames.length, sequence_sha256: hashValue(beforeFrames), sample_interval_ms: 5_000 },
      {
        sample_count: afterFrames.length,
        sequence_sha256: hashValue(afterFrames),
        sample_interval_ms: 5_000,
        ...(frameAlignment ? { best_temporal_alignment: frameAlignment } : {}),
        interpretation: 'perceptual-frame change may reflect a trim, crop, reframing, overlay, grade, or different shot; it is not crop proof by itself',
      }))
  }

  const beforeGeometry = videoGeometry(beforeMedia)
  const afterGeometry = videoGeometry(afterMedia)
  if (hashValue(beforeGeometry) !== hashValue(afterGeometry)) deltas.push(feedbackDelta('external_final.video_geometry', beforeGeometry, afterGeometry))
  if (beforeMedia.transcript_status !== afterMedia.transcript_status) deltas.push(feedbackDelta('external_final.transcript_status', beforeMedia.transcript_status, afterMedia.transcript_status))

  const beforeCaptionOcr = captionOcrDiagnostic(beforeMedia)
  const afterCaptionOcr = captionOcrDiagnostic(afterMedia)
  if (hashValue(beforeCaptionOcr) !== hashValue(afterCaptionOcr)) {
    deltas.push(feedbackDelta('external_final.caption_ocr_diagnostic', beforeCaptionOcr, {
      ...(afterCaptionOcr || {}),
      interpretation: 'OCR phrases are diagnostic only and may be wrong; an SRT sidecar is required for exact caption learning',
    }))
  }
  const beforeCaptionRegion = captionRegionFingerprint(beforeMedia)
  const afterCaptionRegion = captionRegionFingerprint(afterMedia)
  const captionAnalyzersCompatible = beforeCaptionRegion !== undefined
    && afterCaptionRegion !== undefined
    && beforeCaptionRegion.compatibility_sha256 === afterCaptionRegion.compatibility_sha256
  if ((beforeCaptionRegion || afterCaptionRegion) && !captionAnalyzersCompatible) {
    deltas.push(feedbackDelta('external_final.caption_analysis_compatibility',
      beforeCaptionRegion ? { compatibility_sha256: beforeCaptionRegion.compatibility_sha256, analysis_contract: beforeCaptionRegion.analysis_contract } : undefined,
      {
        ...(afterCaptionRegion ? { compatibility_sha256: afterCaptionRegion.compatibility_sha256, analysis_contract: afterCaptionRegion.analysis_contract } : {}),
        interpretation: 'caption-region fingerprints were not compared because the analyzer, implementation, tool versions, crop, or sampling interval differed',
      }))
  } else if (captionAnalyzersCompatible && hashValue(beforeCaptionRegion) !== hashValue(afterCaptionRegion)) {
    const beforeCaptionHashes = Array.isArray(beforeCaptionRegion?.perceptual_sequence) ? beforeCaptionRegion.perceptual_sequence as string[] : []
    const afterCaptionHashes = Array.isArray(afterCaptionRegion?.perceptual_sequence) ? afterCaptionRegion.perceptual_sequence as string[] : []
    const captionAlignment = bestFrameAlignment(beforeCaptionHashes, afterCaptionHashes)
    const stripSequence = (value: Record<string, unknown> | undefined): Record<string, unknown> | undefined => value === undefined
      ? undefined
      : Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'perceptual_sequence'))
    deltas.push(feedbackDelta('external_final.caption_region_fingerprint', stripSequence(beforeCaptionRegion), {
      ...(stripSequence(afterCaptionRegion) || {}),
      ...(captionAlignment ? { best_temporal_alignment: captionAlignment } : {}),
      interpretation: 'caption-region pixels also include the moving background and are diagnostic, not proof that caption styling changed',
    }))
  }

  const sidecarDeltas = diffArtifacts(externalSidecars(before), externalSidecars(after))
  deltas.push(...sidecarDeltas.map((delta) => feedbackDelta(`external_final.sidecars.${delta.feature}`, delta.before, delta.after)))
  const extraDeltas = diffArtifacts(analysisExtras(beforeMedia), analysisExtras(afterMedia))
  deltas.push(...extraDeltas.map((delta) => feedbackDelta(`external_final.analysis.${delta.feature}`, delta.before, delta.after)))
  return deltas
}

export function inferRationale(deltas: FeedbackEventV1['delta_features'], note?: string): { rationale: string; confidence: number } {
  if (note?.trim()) return { rationale: note.trim(), confidence: 1 }
  const paths = deltas.map((delta) => delta.feature).join(' ')
  if (/hook|start_ms|trim/i.test(paths)) return { rationale: 'You changed the opening or trim, so I infer that this version should reach the tension and proof sooner.', confidence: 0.72 }
  if (/caption|emphasis|text/i.test(paths)) return { rationale: 'You changed caption selection or emphasis, so I infer that readability and selective emphasis mattered while preserving exact spoken-word fidelity.', confidence: 0.68 }
  if (/crop|position|scale/i.test(paths)) return { rationale: 'You changed the framing, so I infer that presenter stability and composition mattered more than automatic movement.', confidence: 0.65 }
  if (/audio|volume|music|lufs/i.test(paths)) return { rationale: 'You changed the audio balance, so I infer that speech clarity should take priority over production energy.', confidence: 0.66 }
  if (/scene_cuts|frame_ahashes|duration_seconds/i.test(paths)) return { rationale: 'You changed trims or shot timing, so I infer that the accepted version needed a tighter visual rhythm or different proof timing.', confidence: 0.64 }
  if (/transcript|srt|edl|fcpxml/i.test(paths)) return { rationale: 'You changed spoken wording, captions, or the edit decision list, so I infer that the accepted version improved clarity or meaning at those exact points.', confidence: 0.7 }
  return { rationale: 'You changed this artifact, but the intent is ambiguous. Keep this as an observation until you confirm the reason.', confidence: 0.35 }
}

function externalFinalInference(deltas: FeedbackEventV2['delta_features']): { rationale: string; confidence: number } {
  const find = (feature: string): FeedbackDeltaV2 | undefined => deltas.find((delta) => delta.feature === feature)
  const trim = asRecord(find('external_final.duration_and_trims')?.after)
  const transcript = asRecord(find('external_final.transcript_ordered_token_edits')?.after)
  const sceneCutDelta = find('external_final.scene_cuts')
  const cutsBefore = asRecord(sceneCutDelta?.before)
  const cutsAfter = asRecord(sceneCutDelta?.after)
  const lufsBefore = finiteNumber(find('external_final.integrated_lufs')?.before)
  const lufsAfter = finiteNumber(find('external_final.integrated_lufs')?.after)
  const peakBefore = finiteNumber(find('external_final.true_peak_dbtp')?.before)
  const peakAfter = finiteNumber(find('external_final.true_peak_dbtp')?.after)
  const hasFrames = Boolean(find('external_final.frame_crop_fingerprint'))
  const hasSidecar = deltas.some((delta) => delta.feature.startsWith('external_final.sidecars.'))
  const captionOcrBefore = asRecord(find('external_final.caption_ocr_diagnostic')?.before)
  const captionOcrAfter = asRecord(find('external_final.caption_ocr_diagnostic')?.after)
  const hasCaptionRegionChange = Boolean(find('external_final.caption_region_fingerprint'))
  const observations: string[] = []

  const durationDeltaMs = finiteNumber(trim?.duration_delta_ms)
  if (durationDeltaMs !== undefined && durationDeltaMs !== 0) {
    observations.push(durationDeltaMs < 0
      ? `You shortened the accepted final by ${(Math.abs(durationDeltaMs) / 1000).toFixed(1)} seconds`
      : `You lengthened the accepted final by ${(durationDeltaMs / 1000).toFixed(1)} seconds`)
  }
  const removed = finiteNumber(transcript?.removed_token_count) || 0
  const added = finiteNumber(transcript?.added_token_count) || 0
  const substitutions = finiteNumber(transcript?.substitution_count) || 0
  const transcriptChanges: string[] = []
  if (removed) transcriptChanges.push(`removed ${removed} spoken ${removed === 1 ? 'word' : 'words'}`)
  if (added) transcriptChanges.push(`added ${added} spoken ${added === 1 ? 'word' : 'words'}`)
  if (substitutions) transcriptChanges.push(`made ${substitutions} ordered-token ${substitutions === 1 ? 'substitution' : 'substitutions'}`)
  if (transcriptChanges.length) observations.push(`You ${transcriptChanges.join(', ')}`)
  const beforeCutCount = finiteNumber(cutsBefore?.count)
  const afterCutCount = finiteNumber(cutsAfter?.count)
  if (beforeCutCount !== undefined && afterCutCount !== undefined && beforeCutCount !== afterCutCount) {
    observations.push(`You changed detected scene cuts from ${beforeCutCount} to ${afterCutCount}`)
  } else if (sceneCutDelta && beforeCutCount !== undefined && afterCutCount !== undefined) {
    observations.push(`You retimed ${afterCutCount} detected scene ${afterCutCount === 1 ? 'cut' : 'cuts'}`)
  }
  if (lufsBefore !== undefined && lufsAfter !== undefined && lufsBefore !== lufsAfter) {
    observations.push(`You changed integrated loudness from ${lufsBefore.toFixed(1)} to ${lufsAfter.toFixed(1)} LUFS`)
  }
  if (peakBefore !== undefined && peakAfter !== undefined && peakBefore !== peakAfter) {
    observations.push(`You changed true peak from ${peakBefore.toFixed(1)} to ${peakAfter.toFixed(1)} dBTP`)
  }
  if (hasFrames) observations.push('You materially changed the sampled visual fingerprint')
  if (hasSidecar) observations.push('You supplied or changed an exact edit sidecar')
  if (captionOcrBefore || captionOcrAfter) {
    observations.push(`Diagnostic caption OCR changed from ${finiteNumber(captionOcrBefore?.phrase_count) || 0} to ${finiteNumber(captionOcrAfter?.phrase_count) || 0} distinct phrases`)
  }
  if (hasCaptionRegionChange) observations.push('The sampled caption-region fingerprint changed')

  let lesson = 'the intended lesson is ambiguous, so this should remain an observation until you confirm why the accepted file changed'
  let confidence = 0.35
  if (transcriptChanges.length && durationDeltaMs !== undefined) {
    lesson = 'you preferred a tighter spoken edit while preserving only the words and ordering actually present in the accepted final'
    confidence = 0.8
  } else if (transcriptChanges.length) {
    lesson = 'the exact spoken selection and semantic flow mattered more than preserving the proposed wording density'
    confidence = 0.76
  } else if (sceneCutDelta) {
    lesson = 'the accepted story needed a different visual rhythm and proof timing'
    confidence = 0.7
  } else if (hasSidecar) {
    lesson = 'the exact caption or edit decisions in the supplied sidecar mattered'
    confidence = 0.64
  } else if (captionOcrBefore || captionOcrAfter || hasCaptionRegionChange) {
    lesson = 'the caption treatment may differ, but OCR and caption-region pixels are only diagnostic; confirm the exact lesson from an SRT sidecar before treating this as a preference'
    confidence = 0.45
  } else if (hasFrames) {
    lesson = 'the accepted composition, crop, overlays, grade, or shot selection differed materially; confirm which visual cause mattered before promoting a preference'
    confidence = 0.62
  } else if ((lufsBefore !== undefined && lufsAfter !== undefined) || (peakBefore !== undefined && peakAfter !== undefined)) {
    lesson = 'speech level and audio finish mattered in the accepted version'
    confidence = 0.66
  } else if (durationDeltaMs !== undefined) {
    lesson = 'the accepted pacing and overall duration were preferable'
    confidence = 0.66
  }
  const prefix = observations.length ? `${observations.join('; ')}. ` : ''
  return { rationale: `${prefix}I infer that ${lesson}.`, confidence }
}

export function inferRationaleV2(deltas: FeedbackEventV2['delta_features'], note?: string): { rationale: string; confidence: number } {
  if (note?.trim()) return { rationale: note.trim(), confidence: 1 }
  const paths = deltas.map((delta) => delta.feature).join(' ')
  if (/external_final\./i.test(paths)) return externalFinalInference(deltas)
  if (/primary_attention|layers|asset|evidence|styleframe/i.test(paths)) return { rationale: 'You changed what the viewer should look at, so I infer that the proof, presenter, and frame hierarchy needed a clearer single focus.', confidence: 0.74 }
  if (/source_start_ms|source_end_ms|hook|start_ms|trim/i.test(paths)) return { rationale: 'You changed the selected moment or opening, so I infer that this version should reach the tension or proof sooner without losing meaning.', confidence: 0.74 }
  if (/caption|emphasis|text/i.test(paths)) return { rationale: 'You changed caption selection or emphasis, so I infer that readability and visual personality mattered while preserving exact spoken words in source order.', confidence: 0.72 }
  if (/camera|crop|zoom|framing|position|bounds|protected/i.test(paths)) return { rationale: 'You changed the virtual camera or placement, so I infer that stable subject visibility and intentional composition mattered more than automatic movement.', confidence: 0.7 }
  if (/transition|shot|animatic|duration/i.test(paths)) return { rationale: 'You changed shot rhythm or transitions, so I infer that each visual move must be motivated by the story rather than added for motion alone.', confidence: 0.68 }
  if (/audio|dialogue|gain|music|lufs/i.test(paths)) return { rationale: 'You changed the audio edit, so I infer that natural, intelligible speech continuity should take priority over production energy.', confidence: 0.7 }
  if (/title|description|post_copy|cover/i.test(paths)) return { rationale: 'You changed the platform framing, so I infer that the promise needs to be more specific and native to that audience surface.', confidence: 0.66 }
  return { rationale: 'You changed this artifact, but the intended lesson is ambiguous. Keep it as an observation until you confirm the reason.', confidence: 0.35 }
}

export interface CaptureFeedbackInput {
  jobId: string
  artifactId: string
  stage: StageName
  action: 'accept' | 'reject' | 'revise' | 'praise'
  origin?: 'user' | 'codex' | 'system'
  before: unknown
  after?: unknown
  note?: string
  scope: FeedbackEventV1['scope']
}

export interface CaptureFeedbackV2Input {
  jobId: string
  artifactId: string
  artifactKind: FeedbackEventV2['artifact_kind']
  stage: StageNameV2
  action: FeedbackEventV2['action']
  origin?: FeedbackEventV2['origin']
  before: unknown
  after?: unknown
  note?: string
  scope: FeedbackEventV2['scope']
  exactExternalFinal?: boolean
}

export async function captureFeedback(input: CaptureFeedbackInput): Promise<FeedbackEventV1> {
  const deltas = input.after === undefined ? [] : diffArtifacts(input.before, input.after)
  const inference = inferRationale(deltas, input.note)
  const event = FeedbackEventV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    feedback_id: randomUUID(),
    job_id: input.jobId,
    artifact_id: input.artifactId,
    stage: input.stage,
    action: input.action,
    origin: input.origin ?? 'user',
    before_hash: mediaArtifactHash(input.before) ?? hashValue(input.before),
    ...(input.after === undefined ? {} : { after_hash: mediaArtifactHash(input.after) ?? hashValue(input.after) }),
    delta_features: deltas,
    ...(input.note ? { user_note: input.note } : {}),
    inferred_rationale: inference.rationale,
    confidence: inference.confidence,
    scope: input.scope,
    confirmation: input.origin && input.origin !== 'user' ? 'observation_only' : inference.confidence < 0.5 ? 'observation_only' : 'pending',
    occurred_at: new Date().toISOString(),
  })
  const path = join(studioPaths().runtimeRoot, 'learning', 'feedback.jsonl')
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8')
  await recordJobEvent(input.jobId, 'feedback_recorded', { feedback_id: event.feedback_id, stage: event.stage, action: event.action, confirmation: event.confirmation })
  return event
}

export async function captureFeedbackV2(input: CaptureFeedbackV2Input): Promise<FeedbackEventV2> {
  const deltas = input.after === undefined
    ? []
    : input.artifactKind === 'external_final' ? diffExternalFinalArtifacts(input.before, input.after) : diffArtifacts(input.before, input.after)
  const inference = inferRationaleV2(deltas, input.note)
  const origin = input.origin ?? 'user'
  const event = FeedbackEventV2Schema.parse({
    schema_version: 2,
    feedback_id: randomUUID(),
    job_id: input.jobId,
    artifact_id: input.artifactId,
    artifact_kind: input.artifactKind,
    stage: input.stage,
    action: input.action,
    origin,
    evidence_class: 'taste',
    before_hash: mediaArtifactHash(input.before) ?? hashValue(input.before),
    ...(input.after === undefined ? {} : { after_hash: mediaArtifactHash(input.after) ?? hashValue(input.after) }),
    delta_features: deltas,
    ...(input.note?.trim() ? { user_note: input.note.trim() } : {}),
    inferred_rationale: inference.rationale,
    confidence: inference.confidence,
    scope: input.scope,
    confirmation: origin !== 'user' || inference.confidence < 0.5 ? 'observation_only' : 'pending',
    occurred_at: new Date().toISOString(),
    exact_external_final: input.exactExternalFinal ?? false,
  })
  const path = feedbackLedgerPathV2()
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8')
  await recordJobEventV2(input.jobId, 'feedback_recorded', { feedback_id: event.feedback_id, artifact_kind: event.artifact_kind, stage: event.stage, action: event.action, confirmation: event.confirmation })
  return event
}

export async function proposeRule(event: FeedbackEventV1): Promise<PreferenceRuleV1> {
  if (event.origin !== 'user') throw new Error('system and Codex observations cannot become taste preferences')
  if (event.confirmation !== 'confirmed' && event.confirmation !== 'corrected') throw new Error('feedback must be confirmed before a rule can be proposed')
  const rules = await listRules()
  const existing = rules.find((item) => item.assertion.toLowerCase() === event.inferred_rationale.toLowerCase() && item.scope.level === event.scope.level && item.scope.key === event.scope.key && item.status !== 'retired')
  if (existing) {
    if (!existing.evidence_feedback_ids.includes(event.feedback_id)) existing.evidence_feedback_ids.push(event.feedback_id)
    await saveRules(rules)
    return existing
  }
  const rule = PreferenceRuleV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    rule_id: randomUUID(),
    assertion: event.inferred_rationale,
    scope: event.scope,
    evidence_feedback_ids: [event.feedback_id],
    counterexamples: [],
    regression_cases: [`preserve approved behaviour for ${event.scope.level}:${event.scope.key}`],
    status: 'confirmed',
  })
  rules.push(rule)
  await saveRules(rules)
  return rule
}

export async function proposeRuleV2(event: FeedbackEventV2): Promise<PreferenceRuleV1> {
  if (event.origin !== 'user') throw new Error('system and Codex observations cannot become taste preferences')
  if (event.confirmation !== 'confirmed' && event.confirmation !== 'corrected') throw new Error('feedback must be confirmed before a rule can be proposed')
  if (!await verifiedConfirmationForEventV2(event)) throw new Error('feedback rule requires a verified event-bound user confirmation receipt')
  const rules = await listRules()
  const existing = rules.find((item) => item.assertion.toLowerCase() === event.inferred_rationale.toLowerCase() && item.scope.level === event.scope.level && item.scope.key === event.scope.key && item.status !== 'retired')
  if (existing) {
    if (!existing.evidence_feedback_ids.includes(event.feedback_id)) existing.evidence_feedback_ids.push(event.feedback_id)
    await saveRules(rules)
    return existing
  }
  const rule = PreferenceRuleV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    rule_id: randomUUID(),
    assertion: event.inferred_rationale,
    scope: event.scope,
    evidence_feedback_ids: [event.feedback_id],
    counterexamples: [],
    regression_cases: [`preserve approved behaviour for ${event.scope.level}:${event.scope.key}`],
    status: 'confirmed',
  })
  rules.push(rule)
  await saveRules(rules)
  return rule
}

async function feedbackJobs(feedbackIds: string[]): Promise<Set<string>> {
  const rows: Array<FeedbackEventV1 | FeedbackEventV2> = []
  for (const [name, parser] of [['feedback.jsonl', FeedbackEventV1Schema], ['feedback-v2.jsonl', FeedbackEventV2Schema]] as const) {
    try {
      rows.push(...(await readFile(join(studioPaths().runtimeRoot, 'learning', name), 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => parser.parse(JSON.parse(line))))
    } catch { /* A version with no feedback yet contributes no evidence. */ }
  }
  return new Set(rows.filter((row) => feedbackIds.includes(row.feedback_id)).map((row) => row.job_id))
}

interface ConfirmedPreferenceEvidence {
  feedbackIds: Set<string>
  jobIds: Set<string>
}

async function confirmationIds(name: string): Promise<Set<string>> {
  let lines: string[]
  try {
    lines = (await readFile(join(studioPaths().runtimeRoot, 'learning', name), 'utf8')).split(/\r?\n/).filter(Boolean)
  } catch {
    return new Set()
  }

  const ids = new Set<string>()
  for (const line of lines) {
    try {
      const record = JSON.parse(line) as Record<string, unknown>
      if (typeof record.feedback_id === 'string' && (record.confirmation === 'confirmed' || record.confirmation === 'corrected')) {
        ids.add(record.feedback_id)
      }
    } catch { /* A malformed confirmation cannot contribute preference evidence. */ }
  }
  return ids
}

async function confirmedPreferenceEvidence(feedbackIds: string[]): Promise<ConfirmedPreferenceEvidence> {
  const requested = new Set(feedbackIds)
  const confirmed = new Map<string, string>()
  const confirmedV1Ids = await confirmationIds('confirmations.jsonl')
  if (confirmedV1Ids.size) {
    try {
      const events = (await readFile(join(studioPaths().runtimeRoot, 'learning', 'feedback.jsonl'), 'utf8'))
        .split(/\r?\n/).filter(Boolean).map((line) => FeedbackEventV1Schema.parse(JSON.parse(line)))
      for (const event of events) {
        if (requested.has(event.feedback_id) && confirmedV1Ids.has(event.feedback_id) && event.origin === 'user') confirmed.set(event.feedback_id, event.job_id)
      }
    } catch { /* Missing or malformed V1 evidence cannot contribute. */ }
  }

  const [eventsV2, receiptsV2] = await Promise.all([readFeedbackLedgerV2(), readConfirmationLedgerV2()])
  for (const event of eventsV2) {
    if (!requested.has(event.feedback_id) || event.origin !== 'user') continue
    if (receiptsV2.some((receipt) => receiptMatchesCanonicalEvent(receipt, event))) confirmed.set(event.feedback_id, event.job_id)
  }

  return { feedbackIds: new Set(confirmed.keys()), jobIds: new Set(confirmed.values()) }
}

async function recordLearningJobEvent(jobId: string, ruleId: string, status: string, scope: PreferenceRuleV1['scope']): Promise<void> {
  const raw = JSON.parse(await readFile(join(jobPath(jobId), 'job.json'), 'utf8')) as { schema_version?: number }
  const payload = { rule_id: ruleId, status, scope }
  if (raw.schema_version === 2) await recordJobEventV2(jobId, 'rule_promoted', payload)
  else await recordJobEvent(jobId, 'rule_promoted', payload)
}

export async function broadenRule(ruleId: string, scope: PreferenceRuleV1['scope']): Promise<PreferenceRuleV1> {
  const rules = await listRules()
  const source = rules.find((rule) => rule.rule_id === ruleId)
  if (!source) throw new Error('preference rule not found')
  const evidence = await confirmedPreferenceEvidence(source.evidence_feedback_ids)
  if (evidence.feedbackIds.size < 3 || evidence.jobIds.size < 2) throw new Error('broader scope requires three confirmed instances across at least two jobs')
  const broadened = PreferenceRuleV1Schema.parse({
    ...source,
    rule_id: randomUUID(),
    scope,
    status: 'eligible',
    approved_by: undefined,
    approved_at: undefined,
  })
  rules.push(broadened)
  await saveRules(rules)
  return broadened
}

const transitions: Record<PreferenceRuleV1['status'], PreferenceRuleV1['status'][]> = {
  observed: ['inferred', 'retired'],
  inferred: ['confirmed', 'retired'],
  confirmed: ['trial', 'retired'],
  trial: ['eligible', 'retired'],
  eligible: ['user_approved', 'retired'],
  user_approved: ['active', 'retired'],
  active: ['retired'],
  retired: [],
}

export type RulePromotionResult = PreferenceRuleV1 & { activation_proposal?: ConfigChangeProposalV1; activation_proposal_path?: string }

function sameRule(left: PreferenceRuleV1, right: PreferenceRuleV1): boolean {
  return hashValue(left) === hashValue(right)
}

async function readActivePreferences(activeConfigPath: string): Promise<PreferenceRuleV1[]> {
  const config = JSON.parse(await readFile(activeConfigPath, 'utf8')) as { active_preferences?: unknown[] }
  return (config.active_preferences || []).map((value) => PreferenceRuleV1Schema.parse(value))
}

async function writeActivationProposal(activeConfigPath: string, rule: PreferenceRuleV1, fromStatus: 'eligible' | 'user_approved'): Promise<{ proposal: ConfigChangeProposalV1; path: string }> {
  const core = {
    schema_version: SCHEMA_VERSION,
    rule_id: rule.rule_id,
    from_status: fromStatus,
    requested_status: 'active' as const,
    base_config_path: `config/${basename(activeConfigPath)}`,
    base_config_hash: await hashFile(activeConfigPath),
    proposed_by: 'Krish' as const,
    patch: { operation: 'append_active_preference' as const, value: rule },
    activation_boundary: 'reviewed_git_commit' as const,
  }
  const proposedAt = rule.approved_at
  if (!proposedAt) throw new Error('active preference proposal requires a recorded user approval time')
  const proposalId = `config-change-${hashValue(core).slice(0, 16)}`
  const proposalHash = hashValue({ ...core, proposal_id: proposalId, proposed_at: proposedAt })
  const proposalPath = join(studioPaths().runtimeRoot, 'learning', 'config-proposals', `${proposalHash}.json`)
  try {
    return { proposal: ConfigChangeProposalV1Schema.parse(JSON.parse(await readFile(proposalPath, 'utf8'))), path: proposalPath }
  } catch {
    const proposal = ConfigChangeProposalV1Schema.parse({
      ...core,
      proposal_id: proposalId,
      proposal_hash: proposalHash,
      proposed_at: proposedAt,
    })
    await mkdir(dirname(proposalPath), { recursive: true })
    await writeFile(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8')
    return { proposal, path: proposalPath }
  }
}

export async function promoteRule(ruleId: string, target: PreferenceRuleV1['status'], activeConfigPath: string, approvedBy?: string): Promise<RulePromotionResult> {
  const rules = await listRules()
  const index = rules.findIndex((rule) => rule.rule_id === ruleId)
  if (index < 0) throw new Error('preference rule not found')
  const rule = rules[index] as PreferenceRuleV1
  if (!transitions[rule.status].includes(target)) throw new Error(`invalid rule transition ${rule.status} -> ${target}`)
  if ((target === 'user_approved' || target === 'active') && !approvedBy?.trim()) throw new Error(`${target} requires --approved-by`)
  const canonicalApprover = approvedBy?.trim().toLowerCase() === 'krish' ? 'Krish' : approvedBy?.trim()
  if ((target === 'user_approved' || target === 'active') && canonicalApprover !== 'Krish') throw new Error(`${target} requires Krish approval`)
  const updated = PreferenceRuleV1Schema.parse({
    ...rule,
    status: target,
    ...(target === 'user_approved' ? { approved_by: canonicalApprover, approved_at: new Date().toISOString() } : {}),
    ...(target === 'active' ? { approved_by: canonicalApprover, approved_at: rule.approved_at } : {}),
  })

  if (target === 'active') {
    const committedRules = await readActivePreferences(activeConfigPath)
    if (!committedRules.some((item) => sameRule(item, updated))) {
      const activation = await writeActivationProposal(activeConfigPath, updated, rule.status as 'eligible' | 'user_approved')
      return { ...rule, activation_proposal: activation.proposal, activation_proposal_path: activation.path }
    }
  }

  rules[index] = updated
  await saveRules(rules)
  if (target === 'active') {
    const jobs = await feedbackJobs(updated.evidence_feedback_ids)
    for (const jobId of jobs) await recordLearningJobEvent(jobId, updated.rule_id, updated.status, updated.scope)
  }
  return updated
}

export async function confirmFeedback(event: FeedbackEventV1, correction?: string): Promise<FeedbackEventV1> {
  if (event.origin !== 'user') throw new Error('only user feedback can be confirmed as a preference')
  const confirmed = FeedbackEventV1Schema.parse({
    ...event,
    inferred_rationale: correction?.trim() || event.inferred_rationale,
    confidence: 1,
    confirmation: correction?.trim() ? 'corrected' : 'confirmed',
  })
  const path = join(studioPaths().runtimeRoot, 'learning', 'confirmations.jsonl')
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify({ feedback_id: event.feedback_id, confirmation: confirmed.confirmation, rationale: confirmed.inferred_rationale, occurred_at: new Date().toISOString() })}\n`, 'utf8')
  return confirmed
}

export async function confirmFeedbackV2(event: FeedbackEventV2, correction: string | undefined, confirmationRef: string): Promise<FeedbackEventV2> {
  const supplied = FeedbackEventV2Schema.parse(event)
  const eventHash = feedbackEventHashV2(supplied)
  const canonical = (await readFeedbackLedgerV2()).find((candidate) => candidate.feedback_id === supplied.feedback_id && feedbackEventHashV2(candidate) === eventHash)
  if (!canonical) throw new Error('feedback confirmation requires the exact event captured in the append-only V2 feedback ledger')
  if (canonical.origin !== 'user') throw new Error('only user feedback can be confirmed as a preference')
  const correctedRationale = correction?.trim()
  const receipt = FeedbackConfirmationV2Schema.parse({
    schema_version: 2,
    confirmation_id: randomUUID(),
    feedback_id: canonical.feedback_id,
    job_id: canonical.job_id,
    event_hash: eventHash,
    confirmation: correctedRationale ? 'corrected' : 'confirmed',
    confirmed_rationale: correctedRationale || canonical.inferred_rationale,
    confirmation_ref: confirmationRef,
    confirmed_at: new Date().toISOString(),
  })
  const confirmed = confirmedEventForReceipt(canonical, receipt)
  const existing = (await readConfirmationLedgerV2()).find((candidate) => candidate.feedback_id === receipt.feedback_id
    && candidate.event_hash === receipt.event_hash
    && candidate.confirmation === receipt.confirmation
    && candidate.confirmed_rationale === receipt.confirmed_rationale
    && candidate.confirmation_ref === receipt.confirmation_ref)
  if (!existing) {
    const path = confirmationLedgerPathV2()
    await mkdir(dirname(path), { recursive: true })
    await appendFile(path, `${JSON.stringify(receipt)}\n`, 'utf8')
  }
  return confirmed
}
