import { randomUUID } from 'node:crypto'
import { access, lstat, mkdir, readFile, realpath, readdir, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import type { Command } from 'commander'
import {
  ApprovalGateV2Schema,
  CandidateV1Schema,
  FeedbackEventV2Schema,
  GeneratedShotV1Schema,
  JobPurposeSchema,
  MagicEditActivationV1Schema,
  MagicEditDirectionV1Schema,
  MagicEditReturnToParentV1Schema,
  RenderManifestV2Schema,
  SourceBundleV1Schema,
  SourceModeSchema,
  StageNameV2Schema,
  StoryboardReviewPacketV1Schema,
  TreatmentLaneV1Schema,
  VideoPlatformV1Schema,
  VisualAssetV1Schema,
  VisualNarrativePlanV1Schema,
  mediaSourceParticipantRoster,
  normalizeSeries,
  type CandidateV1,
  type DraftPackageV2,
  type FeedbackEventV2,
  type GeneratedShotV1,
  type JobManifestV2,
  type JobManifestV1,
  type RenderManifestV2,
  type StoryboardReviewPacketV1,
  type StageNameV2,
  type VideoPlatformV1,
  type VisualAssetV1,
  type VisualNarrativePlanV1,
} from '@mindmake/contracts'
import {
  analyzeSourceBundle,
  analyzeMediaArtifactForFeedback,
  analyzeLoudness,
  brandLayerCollisionIssues,
  brandWordmarkLegibilityReport,
  alignScriptToTranscript,
  applyPresenterIdentityCorrections,
  acknowledgeRunnerProjectConflict,
  archiveJob,
  assessTranscriptQuality,
  assertRenderLineageV2,
  attachSourceBundleV2,
  blockStageV2,
  completeStageV2,
  confirmFeedbackV2,
  captureFeedbackV2,
  createDraftPackageV2,
  createDriveSourceBundleDraft,
  createExperimentV2,
  createJobV2,
  createMagicEditTargetMap,
  captionSidecarLooksLikeDjiTelemetry,
  detectClaimLikeSentences,
  driveDiscoveryStatus,
  driveDiscoverySidecarByteLimit,
  driveInboxRebindProposal,
  driveIntakeCandidateDetail,
  draftPackageFileIssuesV2,
  enrollKrishIdentity,
  ensureRuntime,
  evaluateStoredExperimentV2,
  exactWordFidelity,
  feedbackEventHashV2,
  framePerceptualHashes,
  generateCandidates,
  generateWindowsCredential,
  hashFile,
  hashValue,
  hasApprovalV2,
  jobPath,
  KRISH_IDENTITY_CREDENTIAL,
  krishIdentityStatus,
  loadCaptionTranscript,
  loadImportedProductionBrief,
  loadJobV2,
  loadExactBrandGeometryContextV2,
  loadKrishIdentity,
  loadPinnedRenderRegistryV2,
  loadTechniqueRegistry,
  materializeProductionBriefJob,
  activateMagicEditCandidate,
  listExperimentsV2,
  normalizeMediaSourceV2,
  importAnalyticsV2,
  importProductionBrief,
  initializeDriveInbox,
  pinnedConfigPathV2,
  pinnedTechniqueRegistryPathV2,
  prepareEvidenceApprovalPacket,
  probeMedia,
  probeMediaSourceV2,
  proposeRuleV2,
  readStageArtifactV2,
  readReusableStageV2,
  readWindowsCredential,
  recordApprovalV2,
  requireRunnerSourceProvenance,
  renderStoryV2,
  prepareMagicEditCandidate,
  publishRunnerProject,
  rendererImplementationHashV2,
  renderV2Animatic,
  renderV2Styleframes,
  reviewDriveIntakeCandidate,
  rebindDriveInbox,
  revokeKrishIdentity,
  returnMagicEditToParent,
  runRunnerDaemon,
  runRunnerOnce,
  runnerStatus,
  sanitizedDriveDiscoverySummary,
  scanDriveInbox,
  reviewVisualPlan,
  sliceTranscript,
  solveVisualPlanCameras,
  studioPaths,
  uploadPrivateYoutubeVideo,
  validateV2RenderReadiness,
  v2PrerequisitesFor,
  v2RunnableStages,
  verifyVisualAssets,
  validateEditorialCandidate,
  validateShortNativeEditorialCandidate,
  verifyEvidenceApprovalPacket,
  windowsCredentialExists,
  transcribeMedia,
  type EditorialThresholds,
  type NormalizedMediaSourceV2,
  type TranscriptDocument,
} from '@mindmake/core'

const V2_CLI_VERSION = 'visual-story-director-cli-v2.0.0'
const SHA256 = /^[a-f0-9]{64}$/
const ALL_PLATFORMS = ['youtube_shorts', 'linkedin', 'tiktok', 'instagram_reels'] as const satisfies readonly VideoPlatformV1[]
const FEEDBACK_KINDS = ['script', 'candidate', 'caption', 'visual_plan', 'asset', 'styleframe', 'animatic', 'treatment', 'render', 'copy', 'external_final', 'approval'] as const

export interface V2CliContext {
  repoRoot: string
  configPath: string
  skillPaths: string[]
  out: (value: unknown) => void
}

export interface EvidenceReviewPacketV2 {
  schema_version: 2
  packet_id: string
  job_id: string
  visual_plan_artifact_hash: string
  assets: VisualAssetV1[]
  generated_shots: GeneratedShotV1[]
  editorial_evidence?: {
    packet_path: string
    packet_hash: string
    contact_sheet_path: string
    contact_sheet_hash: string
  }
}

interface TreatmentPayload {
  manifests: Array<{ platform: VideoPlatformV1; manifest_path: string; manifest_hash: string }>
}

interface RenderPayload {
  renders: Array<{ platform: VideoPlatformV1; master_path: string; master_hash: string; manifest_path: string; manifest_hash: string }>
}

interface PackagePayload {
  packages: DraftPackageV2[]
}

interface IngestPayloadV2 {
  source_bundle_hash: string
  sources: Array<{
    source_id: string
    path: string
    file_hash: string
    duration_ms: number
    kind: 'video' | 'audio' | 'screen_recording'
  }>
  sidecars?: Array<{
    sidecar_id: string
    source_id: string
    path: string
    file_hash: string
    kind: 'captions' | 'edit_decisions'
    format: 'srt' | 'vtt' | 'edl' | 'fcpxml'
  }>
}

interface NormalizePayloadV2 {
  source_bundle_hash: string
  sources: NormalizedMediaSourceV2[]
}

interface RecordingBriefPayloadV2 {
  candidate_id: string
  candidate_hash: string
  script: string
  guidance: {
    hook: string
    missing_proof: string
    structure: string
    delivery: string
    ending: string
    duration: string
  }
}

interface TranscriptStagePayloadV2 {
  source_id: string
  source_role: string
  canonical_offset_ms: number
  normalized_source_hash: string
  transcript: TranscriptDocument
  recording_alignment?: { start_ms: number; end_ms: number; similarity: number }
}

interface ClaimLedgerEntryV2 {
  claim_id: string
  candidate_id: string
  text: string
  kind: 'fact' | 'inference' | 'judgment'
  evidence_urls: string[]
  verification: 'verified' | 'needs_review' | 'unsupported'
}

interface ClaimsStagePayloadV2 {
  schema_version: 2
  job_id: string
  candidates_artifact_hash: string
  claims: ClaimLedgerEntryV2[]
}

interface PinnedStudioConfigV2 {
  transcription?: { local_model?: string; vocabulary?: string[] }
  identity?: { presenter_name?: string; asr_aliases?: string[] }
  editorial_thresholds: EditorialThresholds
}

async function readJson<T = unknown>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), 'utf8')) as T
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, path)
}

async function readFeedbackArtifact(context: V2CliContext, job: JobManifestV2, path: string, label: string): Promise<unknown> {
  const extension = extname(path).toLowerCase()
  if (['.mp4', '.mov', '.mkv', '.webm'].includes(extension)) {
    const config = await readJson<{ transcription?: { local_model?: string; vocabulary?: string[] } }>(pinnedConfigPathV2(job))
    return analyzeMediaArtifactForFeedback(
      context.repoRoot,
      resolve(path),
      join(jobPath(job.job_id), 'feedback', 'analysis'),
      label,
      config.transcription?.local_model || 'base.en',
      config.transcription?.vocabulary || [],
    )
  }
  const body = await readFile(resolve(path), 'utf8')
  if (extension === '.json') return JSON.parse(body)
  return body
}

export async function resolveApprovalArtifactHash(value: string): Promise<string> {
  if (SHA256.test(value)) return value
  return hashFile(resolve(value))
}

export function assertYoutubePrivateOnly(platform: string, privacy: string): void {
  if (platform !== 'youtube_shorts') throw new Error('publishing policy only permits private YouTube Shorts uploads; LinkedIn, TikTok, and Instagram remain local draft packages')
  if (privacy !== 'private') throw new Error('the engine only permits private YouTube uploads')
}

export function qaPassed(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as { passed?: unknown; results?: Array<{ passed?: unknown }>; verdicts?: Array<{ passed?: unknown }> }
  if (value.passed === true) return true
  const children = value.results || value.verdicts
  return Boolean(children?.length && children.every((item) => item.passed === true))
}

function parseRecord(values: string[] | undefined, label: string): Record<string, string> {
  const keys = new Set<string>()
  const entries = (values || []).map((value) => {
    const separator = value.indexOf('=')
    if (separator <= 0 || separator === value.length - 1) throw new Error(`${label} values must use key=value`)
    const key = value.slice(0, separator)
    if (keys.has(key)) throw new Error(`${label} contains duplicate key ${key}`)
    keys.add(key)
    return [key, value.slice(separator + 1)] as const
  })
  return Object.fromEntries(entries)
}

function currentArtifactHash(job: JobManifestV2, stage: StageNameV2): string {
  const state = job.stages[stage]
  if (state.status !== 'complete' || !state.artifact_hash) throw new Error(`stage ${stage} is not complete`)
  return state.artifact_hash
}

function requireSourceBundle(job: JobManifestV2): NonNullable<JobManifestV2['source_bundle']> {
  if (!job.source_bundle) throw new Error('this job has no recorded source bundle yet; attach the completed recording before ingest')
  return job.source_bundle
}

function sourceRightsIssues(job: JobManifestV2): string[] {
  const bundle = requireSourceBundle(job)
  const issues = bundle.sources
    .filter((source) => source.include_in_edit && source.rights === 'unverified')
    .map((source) => `source rights are unverified for ${source.source_id}`)
  for (const source of bundle.sources.filter((item) => item.include_in_edit)) {
    const roster = mediaSourceParticipantRoster(source)
    if (source.role === 'guest_camera' && !roster.some((participant) => participant.kind === 'job_local')) issues.push(`guest camera ${source.source_id} has no source-bound guest roster`)
    if (source.role === 'mixed_program' && !roster.length) issues.push(`mixed programme ${source.source_id} has no participant roster`)
    for (const participant of roster) {
      if (participant.kind === 'job_local' && !participant.consent_ref.trim()) issues.push(`participant ${participant.label} has no source-bound consent reference for ${source.source_id}`)
    }
  }
  return [...new Set(issues)]
}

function normalizedSourceBundle(job: JobManifestV2, normalized: NormalizePayloadV2): NonNullable<JobManifestV2['source_bundle']> {
  const originals = requireSourceBundle(job)
  const { intake_provenance: _intakeProvenance, ...normalizedBase } = originals
  const outputs = new Map(normalized.sources.map((source) => [source.source_id, source]))
  return SourceBundleV1Schema.parse({
    ...normalizedBase,
    sources: originals.sources.map((source) => {
      const output = outputs.get(source.source_id)
      return output ? { ...source, ref: output.normalized_path, content_hash: output.normalized_hash } : source
    }),
  })
}

function candidateCompatibilityJob(job: JobManifestV2, sourceId?: string): JobManifestV1 {
  const bundle = requireSourceBundle(job)
  const source = bundle.sources.find((item) => item.source_id === sourceId) || bundle.sources.find((item) => item.source_id === bundle.primary_source_id) || bundle.sources[0]!
  return {
    ...job,
    schema_version: 1,
    source: { kind: source.kind, ref: source.ref, rights: source.rights, ...(source.consent_ref ? { consent_note: source.consent_ref } : {}) },
  } as unknown as JobManifestV1
}

async function saveCandidateSet(job: JobManifestV2, candidates: CandidateV1[]): Promise<Array<{ path: string; hash: string; candidate: CandidateV1 }>> {
  const directory = join(jobPath(job.job_id), 'candidates', 'v2')
  await mkdir(directory, { recursive: true })
  const saved = []
  for (const candidate of candidates) {
    const path = join(directory, `${candidate.candidate_id}.json`)
    await writeJson(path, candidate)
    saved.push({ path, hash: hashValue(candidate), candidate })
  }
  return saved
}

export function candidateSemanticHash(candidate: CandidateV1): string {
  return hashValue(CandidateV1Schema.parse(candidate))
}

function parseTranscriptDocument(value: unknown): TranscriptDocument {
  if (!value || typeof value !== 'object') throw new Error('transcript must be a TranscriptDocument object')
  const raw = value as Partial<TranscriptDocument>
  if (typeof raw.language !== 'string' || !['captions', 'faster_whisper', 'manual'].includes(String(raw.source)) || !Array.isArray(raw.segments) || !raw.segments.length) {
    throw new Error('transcript requires language, source, and at least one timed segment')
  }
  const segments = raw.segments.map((segment, segmentIndex) => {
    if (!segment || typeof segment !== 'object' || !Number.isInteger(segment.start_ms) || !Number.isInteger(segment.end_ms) || segment.start_ms < 0 || segment.end_ms <= segment.start_ms || typeof segment.text !== 'string' || !segment.text.trim()) {
      throw new Error(`transcript segment ${segmentIndex} is invalid`)
    }
    const words = segment.words?.map((word, wordIndex) => {
      if (!Number.isInteger(word.start_ms) || !Number.isInteger(word.end_ms) || word.start_ms < segment.start_ms || word.end_ms > segment.end_ms || word.end_ms <= word.start_ms || typeof word.text !== 'string' || !word.text.trim()) {
        throw new Error(`transcript word ${segmentIndex}:${wordIndex} is invalid or outside its segment`)
      }
      return { ...word }
    })
    return { ...segment, ...(words ? { words } : {}) }
  })
  for (let index = 1; index < segments.length; index += 1) {
    if (segments[index]!.start_ms < segments[index - 1]!.start_ms) throw new Error('transcript segments must remain in source-time order')
  }
  return { ...raw, language: raw.language, source: raw.source!, segments } as TranscriptDocument
}

function sourceBundleIdentityIssues(job: JobManifestV2, bundle: NonNullable<JobManifestV2['source_bundle']>): string[] {
  const issues: string[] = []
  for (const source of bundle.sources) {
    for (const participant of mediaSourceParticipantRoster(source).filter((item) => item.kind === 'krish_profile')) {
      if (!job.identity_profile) issues.push(`source ${source.source_id} declares Krish but the job has no pinned encrypted Krish identity profile`)
      else if (participant.profile_id !== job.identity_profile.profile_id || participant.version_hash !== job.identity_profile.version_hash) {
        issues.push(`source ${source.source_id} references a different Krish identity profile version`)
      }
    }
  }
  return issues
}

function buildClaimLedger(job: JobManifestV2, candidatesArtifactHash: string, candidates: CandidateV1[]): ClaimsStagePayloadV2 {
  return {
    schema_version: 2,
    job_id: job.job_id,
    candidates_artifact_hash: candidatesArtifactHash,
    claims: candidates.flatMap((candidate) => candidate.claims.map((claim, index) => ({
      claim_id: `claim-${hashValue({ candidate_id: candidate.candidate_id, index, claim }).slice(0, 20)}`,
      candidate_id: candidate.candidate_id,
      ...claim,
    }))),
  }
}

function withEditorialValidation(candidate: CandidateV1, validation: { hard_blocks: string[]; soft_blocks: string[] }, shortNative: boolean): CandidateV1 {
  const claimIssues = independentClaimIssues(candidate)
  return CandidateV1Schema.parse({
    ...candidate,
    challenge: {
      ...candidate.challenge,
      hard_blocks: [...new Set([...candidate.challenge.hard_blocks, ...validation.hard_blocks, ...claimIssues])],
      soft_blocks: [...new Set([...candidate.challenge.soft_blocks, ...validation.soft_blocks])],
      recommendation: validation.hard_blocks.length
        ? shortNative
          ? 'Do not record. Revise or reject this script before creating a recording brief.'
          : 'Do not proceed. Revise, reject, or request a specific rerecord.'
        : candidate.challenge.recommendation,
    },
  })
}

function normalizedClaimText(value: string): string {
  return (value.toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) || []).join(' ')
}

function canonicalEvidenceUrl(value: string): string {
  const url = new URL(value)
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '')
  url.searchParams.sort()
  return url.toString()
}

export function evidenceClaimUrlIssues(
  requirements: VisualNarrativePlanV1['asset_requirements'],
  assets: VisualAssetV1[],
  claims: ClaimLedgerEntryV2[],
  candidateId: string,
): string[] {
  const evidenceById = new Map(assets.filter((asset) => asset.truth_role === 'evidence').map((asset) => [asset.asset_id, asset]))
  const claimsById = new Map(claims.filter((claim) => claim.candidate_id === candidateId).map((claim) => [claim.claim_id, claim]))
  const issues: string[] = []
  for (const requirement of requirements.filter((item) => item.required && item.truth_role === 'evidence')) {
    const asset = evidenceById.get(requirement.asset_id)
    if (!asset?.source_url) {
      issues.push(`required evidence asset ${requirement.asset_id} has no reviewable source URL`)
      continue
    }
    const sourceUrl = canonicalEvidenceUrl(asset.source_url)
    for (const claimId of requirement.claim_ids) {
      const claim = claimsById.get(claimId)
      if (!claim) issues.push(`evidence requirement ${requirement.asset_id} references a claim outside the approved candidate ledger: ${claimId}`)
      else if (!claim.evidence_urls.some((url) => canonicalEvidenceUrl(url) === sourceUrl)) issues.push(`evidence asset ${requirement.asset_id} is not sourced from the approved evidence URL for claim ${claimId}`)
    }
  }
  return [...new Set(issues)]
}

function independentClaimIssues(candidate: CandidateV1): string[] {
  const declared = candidate.claims.map((claim) => normalizedClaimText(claim.text))
  const issues = detectClaimLikeSentences(candidate.transcript)
    .filter((sentence) => {
      const normalized = normalizedClaimText(sentence)
      return !declared.some((claim) => claim === normalized)
    })
    .map((sentence) => `claim-like statement is missing from the claim ledger: ${sentence}`)
  if (candidate.claims.some((claim) => claim.kind === 'fact' && claim.verification !== 'verified')) issues.push('factual claims remain unverified')
  return [...new Set(issues)]
}

function prerequisiteHashes(job: JobManifestV2, stage: StageNameV2): Record<string, string> {
  const result: Record<string, string> = {}
  for (const name of v2PrerequisitesFor(stage, job.mode)) {
    const state = job.stages[name]
    if (state.status === 'complete' && state.artifact_hash) result[name] = state.artifact_hash
  }
  return result
}

async function preferenceSnapshotHash(job: JobManifestV2): Promise<string> {
  const config = await readJson<{ active_preferences?: unknown[] }>(pinnedConfigPathV2(job))
  return hashValue(config.active_preferences || [])
}

function assertKrishDecision(actor: string, decision: string): asserts actor is 'krish' | 'codex' | 'system' {
  if (!['krish', 'codex', 'system'].includes(actor)) throw new Error('actor must be krish, codex, or system')
  if (decision !== 'rejected' && actor !== 'krish') throw new Error('production approvals and overrides require Krish')
}

function parseEvidencePacket(value: unknown): EvidenceReviewPacketV2 {
  if (!value || typeof value !== 'object') throw new Error('evidence approval requires a V2 evidence review packet')
  const packet = value as Partial<EvidenceReviewPacketV2>
  if (packet.schema_version !== 2 || typeof packet.packet_id !== 'string' || typeof packet.job_id !== 'string' || !SHA256.test(packet.visual_plan_artifact_hash || '')) {
    throw new Error('evidence approval requires a valid V2 evidence review packet')
  }
  if (packet.editorial_evidence && (
    typeof packet.editorial_evidence.packet_path !== 'string'
    || !SHA256.test(packet.editorial_evidence.packet_hash || '')
    || typeof packet.editorial_evidence.contact_sheet_path !== 'string'
    || !SHA256.test(packet.editorial_evidence.contact_sheet_hash || '')
  )) throw new Error('evidence approval packet has invalid editorial evidence provenance')
  return {
    schema_version: 2,
    packet_id: packet.packet_id,
    job_id: packet.job_id,
    visual_plan_artifact_hash: packet.visual_plan_artifact_hash!,
    assets: (packet.assets || []).map((asset) => VisualAssetV1Schema.parse(asset)),
    generated_shots: (packet.generated_shots || []).map((shot) => GeneratedShotV1Schema.parse(shot)),
    ...(packet.editorial_evidence ? {
      editorial_evidence: {
        packet_path: String(packet.editorial_evidence.packet_path),
        packet_hash: String(packet.editorial_evidence.packet_hash),
        contact_sheet_path: String(packet.editorial_evidence.contact_sheet_path),
        contact_sheet_hash: String(packet.editorial_evidence.contact_sheet_hash),
      },
    } : {}),
  }
}

export interface CurrentEvidencePacketRefV2 {
  schema_version: 2
  job_id: string
  packet_path: string
  packet_hash: string
  visual_plan_artifact_hash: string
}

function pathIsInsideOrEqual(root: string, candidate: string): boolean {
  const relation = relative(resolve(root), resolve(candidate))
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
}

export async function assertCanonicalEvidencePacketPathV2(jobId: string, packetPathInput: string, packetId?: string): Promise<string> {
  const evidenceRoot = resolve(jobPath(jobId), 'reviews', 'evidence')
  const packetPath = resolve(packetPathInput)
  if (!pathIsInsideOrEqual(evidenceRoot, packetPath) || dirname(packetPath) !== evidenceRoot) throw new Error('evidence packet must be directly contained in the current job reviews/evidence directory')
  if (packetId && basename(packetPath) !== `${packetId}.json`) throw new Error('evidence packet path does not match its canonical packet ID')
  const file = await lstat(packetPath)
  if (!file.isFile() || file.isSymbolicLink()) throw new Error('evidence packet must be a regular canonical file, not a link')
  const [actualJobRoot, actualRoot, actualPacket] = await Promise.all([realpath(jobPath(jobId)), realpath(evidenceRoot), realpath(packetPath)])
  if (actualRoot !== resolve(actualJobRoot, 'reviews', 'evidence') || !pathIsInsideOrEqual(actualRoot, actualPacket) || dirname(actualPacket) !== actualRoot) {
    throw new Error('evidence packet real path escapes the exact current job reviews/evidence directory')
  }
  return packetPath
}

export function evidenceApprovalCurrentnessIssuesV2(input: {
  job: JobManifestV2
  packet: EvidenceReviewPacketV2
  packet_path: string
  packet_hash: string
  current_ref: CurrentEvidencePacketRefV2
  current_visual_plan_hash: string
}): string[] {
  const { job, packet, packet_path: packetPath, packet_hash: packetHash, current_ref: current, current_visual_plan_hash: visualPlanHash } = input
  const issues: string[] = []
  if (packet.job_id !== job.job_id || current.job_id !== job.job_id) issues.push('evidence packet belongs to a different job')
  if (packet.visual_plan_artifact_hash !== visualPlanHash || current.visual_plan_artifact_hash !== visualPlanHash) issues.push('evidence packet is stale for the current visual plan')
  if (current.packet_hash !== packetHash || resolve(current.packet_path) !== resolve(packetPath)) issues.push('evidence packet is not the current prepared packet')
  if (!v2RunnableStages(job.stages, job.mode).includes('assets')) issues.push('assets stage is not ready for evidence approval')
  return [...new Set(issues)]
}

async function assertCurrentEvidenceApprovalPacketV2(job: JobManifestV2, packetPathInput: string): Promise<{ packet: EvidenceReviewPacketV2; packetPath: string; packetHash: string; visualPlanArtifactHash: string }> {
  const packetPath = await assertCanonicalEvidencePacketPathV2(job.job_id, packetPathInput)
  const packet = parseEvidencePacket(await readJson(packetPath))
  await assertCanonicalEvidencePacketPathV2(job.job_id, packetPath, packet.packet_id)
  const packetHash = await hashFile(packetPath)
  const currentPath = resolve(jobPath(job.job_id), 'reviews', 'evidence', 'current.json')
  const currentPathStat = await lstat(currentPath)
  if (!currentPathStat.isFile() || currentPathStat.isSymbolicLink()) throw new Error('current evidence review pointer must be a regular canonical file')
  const current = await readJson<CurrentEvidencePacketRefV2>(currentPath)
  if (current.schema_version !== 2 || !SHA256.test(current.packet_hash) || !SHA256.test(current.visual_plan_artifact_hash)) throw new Error('current evidence review pointer is invalid')
  const visualPlanArtifact = await readStageArtifactV2<VisualNarrativePlanV1>(job.job_id, 'visual_plan')
  for (const stage of v2PrerequisitesFor('assets', job.mode)) await readStageArtifactV2(job.job_id, stage)
  const issues = evidenceApprovalCurrentnessIssuesV2({ job, packet, packet_path: packetPath, packet_hash: packetHash, current_ref: current, current_visual_plan_hash: visualPlanArtifact.artifact_hash })
  if (issues.length) throw new Error(issues.join('; '))
  await verifyEvidencePacketFiles(packet)
  return { packet, packetPath, packetHash, visualPlanArtifactHash: visualPlanArtifact.artifact_hash }
}

function candidatesInPayload(payload: unknown): CandidateV1[] {
  const rootValues = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { candidates?: unknown[] }).candidates)
      ? (payload as { candidates: unknown[] }).candidates
      : [payload]
  const candidates: CandidateV1[] = []
  for (const value of rootValues) {
    const nested = value && typeof value === 'object' && 'candidate' in value ? (value as { candidate: unknown }).candidate : value
    const parsed = CandidateV1Schema.safeParse(nested)
    if (parsed.success) candidates.push(parsed.data)
  }
  return candidates
}

async function assertCandidateIsCurrent(jobId: string, candidate: CandidateV1): Promise<void> {
  const artifact = await readStageArtifactV2(jobId, 'candidates')
  const current = candidatesInPayload(artifact.payload)
  if (!current.some((item) => item.candidate_id === candidate.candidate_id && hashValue(item) === hashValue(candidate))) {
    throw new Error('candidate is not an exact member of the current candidates stage')
  }
}

async function verifyEvidencePacketFiles(packet: EvidenceReviewPacketV2): Promise<void> {
  for (const asset of packet.assets) {
    const actual = await hashFile(resolve(asset.path))
    if (actual !== asset.sha256) throw new Error(`hard block: evidence asset ${asset.asset_id} changed after review packet creation`)
    if (asset.rights === 'unverified') throw new Error(`hard rights block: asset ${asset.asset_id} has unverified rights`)
  }
  for (const shot of packet.generated_shots) {
    const actual = await hashFile(resolve(shot.output_path))
    if (actual !== shot.output_hash) throw new Error(`hard block: generated illustration ${shot.generated_shot_id} changed after review packet creation`)
  }
  if (packet.editorial_evidence) {
    if (!SHA256.test(packet.editorial_evidence.packet_hash) || !SHA256.test(packet.editorial_evidence.contact_sheet_hash)) throw new Error('editorial evidence packet contains an invalid checksum')
    if (await hashFile(resolve(packet.editorial_evidence.packet_path)) !== packet.editorial_evidence.packet_hash) throw new Error('editorial evidence packet changed after review preparation')
    const editorial = await verifyEvidenceApprovalPacket(packet.editorial_evidence.packet_path)
    if (resolve(editorial.contact_sheet_path) !== resolve(packet.editorial_evidence.contact_sheet_path) || editorial.contact_sheet_sha256 !== packet.editorial_evidence.contact_sheet_hash) {
      throw new Error('editorial evidence contact sheet provenance does not match the V2 review packet')
    }
  }
}

async function verifyReviewPacketFiles(payload: unknown): Promise<void> {
  if (!payload || typeof payload !== 'object') return
  const packet = payload as { styleframes?: Array<{ image_path: string; image_hash: string; phone_preview_path: string; phone_preview_hash: string }>; animatic?: { path: string; sha256: string } }
  for (const frame of packet.styleframes || []) {
    if (await hashFile(resolve(frame.image_path)) !== frame.image_hash) throw new Error('styleframe image hash does not match its file')
    if (await hashFile(resolve(frame.phone_preview_path)) !== frame.phone_preview_hash) throw new Error('styleframe phone preview hash does not match its file')
  }
  if (packet.animatic && await hashFile(resolve(packet.animatic.path)) !== packet.animatic.sha256) throw new Error('animatic hash does not match its file')
}

async function verifyTreatmentPayload(payload: TreatmentPayload): Promise<void> {
  for (const item of payload.manifests) {
    VideoPlatformV1Schema.parse(item.platform)
    const manifest = RenderManifestV2Schema.parse(await readJson(item.manifest_path))
    if (manifest.target_platform !== item.platform) throw new Error(`treatment manifest platform mismatch for ${item.platform}`)
    if (await hashFile(resolve(item.manifest_path)) !== item.manifest_hash) throw new Error(`treatment manifest changed for ${item.platform}`)
  }
}

async function verifyRenderPayload(payload: RenderPayload): Promise<void> {
  for (const item of payload.renders) {
    VideoPlatformV1Schema.parse(item.platform)
    if (await hashFile(resolve(item.master_path)) !== item.master_hash) throw new Error(`render master changed for ${item.platform}`)
    if (await hashFile(resolve(item.manifest_path)) !== item.manifest_hash) throw new Error(`render manifest changed for ${item.platform}`)
  }
}

async function verifyPackagePayload(payload: PackagePayload, job?: JobManifestV2): Promise<void> {
  const currentRender = job ? await readStageArtifactV2<RenderPayload>(job.job_id, 'render') : undefined
  const renderByPlatform = new Map(currentRender?.payload.renders.map((item) => [item.platform, item]) ?? [])
  if (job) {
    const platforms = payload.packages.map((item) => item.platform).sort()
    if (hashValue(platforms) !== hashValue([...job.target_platforms].sort())) throw new Error('package stage must contain exactly one package for every target platform')
  }
  for (const draft of payload.packages) {
    if (job && draft.job_id !== job.job_id) throw new Error(`package ${draft.package_id} belongs to a different job`)
    const rendered = job ? renderByPlatform.get(draft.platform) : undefined
    if (job && !rendered) throw new Error(`package ${draft.package_id} has no current ${draft.platform} render`)
    if (job && rendered) {
      if (await hashFile(resolve(rendered.master_path)) !== rendered.master_hash) throw new Error(`current render master changed for ${draft.platform}`)
      if (await hashFile(resolve(rendered.manifest_path)) !== rendered.manifest_hash) throw new Error(`current render manifest changed for ${draft.platform}`)
      const renderManifest = RenderManifestV2Schema.parse(await readJson(rendered.manifest_path))
      if (renderManifest.target_platform !== draft.platform) throw new Error(`current render manifest targets a different platform from package ${draft.package_id}`)
      if (!hasApprovalV2(job, 'final', rendered.master_hash, 'krish')) throw new Error(`current ${draft.platform} master lacks exact final approval from Krish`)
    }
    const issues = await draftPackageFileIssuesV2(draft, rendered ? {
      job_id: job!.job_id,
      platform: draft.platform,
      render_manifest_hash: rendered.manifest_hash,
      master_hash: rendered.master_hash,
    } : undefined)
    if (issues.length) throw new Error(`package ${draft.package_id} failed exact-file verification: ${issues.join('; ')}`)
  }
}

async function assertCurrentRenderLineage(job: JobManifestV2, manifest: RenderManifestV2): Promise<void> {
  const [candidateArtifact, visualPlanArtifact, normalizeArtifact, transcriptArtifact, assetsArtifact] = await Promise.all([
    readStageArtifactV2<{ candidates: Array<{ path?: string; hash: string; candidate: CandidateV1 }> }>(job.job_id, 'candidates'),
    readStageArtifactV2<VisualNarrativePlanV1>(job.job_id, 'visual_plan'),
    readStageArtifactV2<NormalizePayloadV2>(job.job_id, 'normalize'),
    readStageArtifactV2<TranscriptStagePayloadV2>(job.job_id, 'transcript'),
    readStageArtifactV2<{ visual_plan_artifact_hash: string; assets: VisualAssetV1[]; generated_shots: GeneratedShotV1[] }>(job.job_id, 'assets'),
  ])
  assertRenderLineageV2({ job, manifest, candidateArtifact, visualPlanArtifact, normalizeArtifact, transcriptArtifact, assetsArtifact })
  if (manifest.branding.mode === 'series') await loadExactBrandGeometryContextV2(manifest)
}

async function loadReviewManifest(job: JobManifestV2, manifestPath: string, storyboardHash?: string): Promise<{ manifest: RenderManifestV2; manifestHash: string }> {
  const manifestHash = await hashFile(resolve(manifestPath))
  const manifest = RenderManifestV2Schema.parse(await readJson(manifestPath))
  const visualPlanHash = currentArtifactHash(job, 'visual_plan')
  const assetArtifact = await readStageArtifactV2<{ assets: VisualAssetV1[]; generated_shots: GeneratedShotV1[] }>(job.job_id, 'assets')
  if (job.purpose === 'production' && manifest.branding.mode !== 'series') throw new Error('production render manifests must use the official Mindmake and series wordmarks')
  if (job.purpose === 'calibration' && manifest.branding.mode !== 'none') throw new Error('calibration render manifests must remain analysis-only and unbranded')
  await assertCurrentRenderLineage(job, manifest)
  if (manifest.job_id !== job.job_id || manifest.series !== job.series || manifest.treatment_lane !== job.treatment_lane) throw new Error('render manifest does not match the current job identity, series, and treatment lane')
  if (!job.target_platforms.includes(manifest.target_platform)) throw new Error('render manifest targets a platform outside the job')
  if (!hasApprovalV2(job, 'angle', manifest.candidate_hash, 'krish')) throw new Error('render manifest is not bound to a Krish-approved candidate')
  if (manifest.visual_plan_artifact_hash !== visualPlanHash) throw new Error('render manifest is not bound to the current visual plan')
  if (storyboardHash !== undefined && manifest.storyboard_artifact_hash !== storyboardHash) throw new Error('render manifest is not bound to the current approved storyboard')
  if (storyboardHash !== undefined) {
    const storyboard = await readStageArtifactV2(job.job_id, 'styleframes')
    if (storyboard.artifact_hash !== storyboardHash) throw new Error('render manifest references a non-current storyboard')
    await verifyReviewPacketFiles(storyboard.payload)
  }
  if (hashValue(manifest.assets) !== hashValue(assetArtifact.payload.assets) || hashValue(manifest.generated_shots) !== hashValue(assetArtifact.payload.generated_shots)) throw new Error('render manifest is not bound to the exact approved asset ledger')
  const readiness = validateV2RenderReadiness(manifest, storyboardHash === undefined ? 'styleframe' : 'none')
  if (readiness.length) throw new Error(`hard block: V2 render readiness failed: ${readiness.join('; ')}`)
  return { manifest, manifestHash }
}

function exactAssetHashes(payload: { assets: VisualAssetV1[]; generated_shots: GeneratedShotV1[] }): string[] {
  return [...new Set([...payload.assets.map((asset) => asset.sha256), ...payload.generated_shots.map((shot) => shot.output_hash)])].sort()
}

function stageHint(stage: StageNameV2, jobId: string): string {
  if (stage === 'brief' || stage === 'script' || stage === 'candidates' || stage === 'claims') return `studio v2 candidates --job ${jobId} --brief <brief.json> --input <candidate.json>`
  if (stage === 'recording_brief') return `studio v2 recording-brief create --job ${jobId} --candidate <approved-candidate.json>`
  if (stage === 'ingest' || stage === 'normalize') return `studio v2 ingest --job ${jobId}${stage === 'ingest' ? ' --source-bundle <source-bundle.json>' : ''}`
  if (stage === 'transcript') return `studio v2 transcribe --job ${jobId}`
  if (stage === 'source_analysis') return `studio v2 source analyze --job ${jobId}`
  if (stage === 'visual_plan') return `studio v2 visual-plan context --job ${jobId} --candidate <candidate.json>, author the plan, then studio v2 visual-plan import`
  if (stage === 'assets') return `studio v2 assets prepare --job ${jobId} --assets <assets.json>`
  if (stage === 'styleframes') return `studio v2 styleframes create --job ${jobId} --manifest <review-manifest.json> --at <milliseconds...>`
  if (stage === 'animatic') return `studio v2 animatic create --job ${jobId} --manifest <storyboard-bound-manifest.json>`
  if (stage === 'treatment') return `studio v2 treatment register --job ${jobId} --manifest <platform=manifest.json...>`
  if (stage === 'render') return `studio v2 render --job ${jobId}`
  if (stage === 'qa') return `studio v2 qa --job ${jobId}`
  if (stage === 'package') return `studio v2 package create --job ${jobId} --candidate <candidate.json>`
  return `studio v2 job resume --job ${jobId}`
}

export function registerV2Commands(program: Command, context: V2CliContext): void {
  const v2 = program.command('v2').description('V2 deterministic visual-story director')

  const productionBrief = v2.command('production-brief').description('Import an exact approved Control Center production brief')
  productionBrief.command('import')
    .requiredOption('--input <path>', 'ProductionBriefV1 JSON exported by Control Center')
    .action(async (options) => {
      await ensureRuntime()
      const imported = await importProductionBrief(await readJson(resolve(options.input)))
      let materialized: Awaited<ReturnType<typeof materializeProductionBriefJob>> | null = null
      if (imported.brief.production_kinds.includes('video') && imported.brief.source_mode === 'short_native') {
        materialized = await materializeProductionBriefJob({
          imported,
          configPath: context.configPath,
          skillPaths: context.skillPaths,
          techniqueRegistryPath: join(context.repoRoot, 'config', 'techniques.json'),
        })
      }
      context.out({
        brief_id: imported.brief.brief_id,
        brief_hash: imported.brief_hash,
        imported: imported.created,
        production_kinds: imported.brief.production_kinds,
        source_mode: imported.brief.source_mode,
        ...(materialized ? {
          job_id: materialized.job.job_id,
          brief_artifact_hash: materialized.brief_artifact_hash,
          next_stage: 'script',
        } : imported.brief.production_kinds.includes('video') ? {
          next_stage: 'source_bundle',
          next_command: `studio v2 production-brief materialize --brief-id ${imported.brief.brief_id} --source-bundle <source-bundle.json>`,
        } : {
          next_stage: 'carousel_direction',
        }),
      })
    })

  productionBrief.command('materialize')
    .requiredOption('--brief-id <briefId>')
    .option('--source-bundle <path>', 'reviewed SourceBundleV1 for extract or solo production')
    .action(async (options) => {
      await ensureRuntime()
      const imported = await loadImportedProductionBrief(options.briefId)
      const sourceBundle = options.sourceBundle ? SourceBundleV1Schema.parse(await readJson(resolve(options.sourceBundle))) : undefined
      const materialized = await materializeProductionBriefJob({
        imported,
        ...(sourceBundle ? { sourceBundle } : {}),
        configPath: context.configPath,
        skillPaths: context.skillPaths,
        techniqueRegistryPath: join(context.repoRoot, 'config', 'techniques.json'),
      })
      context.out({
        brief_id: imported.brief.brief_id,
        brief_hash: imported.brief_hash,
        job_id: materialized.job.job_id,
        brief_artifact_hash: materialized.brief_artifact_hash,
        next_stage: v2RunnableStages(materialized.job.stages, materialized.job.mode)[0] || null,
      })
    })

  const identity = v2.command('identity').description('Encrypted, Krish-only persistent face identity')
  identity.command('status').action(async () => {
    const status = await krishIdentityStatus()
    const credentialAvailable = status.enrolled && await windowsCredentialExists(context.repoRoot, KRISH_IDENTITY_CREDENTIAL)
    let usable = false
    if (credentialAvailable) {
      try {
        const loaded = await loadKrishIdentity(await readWindowsCredential(context.repoRoot, KRISH_IDENTITY_CREDENTIAL))
        usable = loaded.reference.version_hash === status.version_hash
      } catch {
        usable = false
      }
    }
    context.out({ ...status, credential_available: Boolean(credentialAvailable), usable })
  })
  identity.command('enroll')
    .requiredOption('--input <paths...>', 'one to twelve clear Krish-only video or image sources')
    .option('--replace', 'replace an existing encrypted Krish identity profile')
    .action(async (options) => {
      const prior = await krishIdentityStatus()
      if (prior.enrolled && !options.replace) throw new Error('Krish identity is already enrolled; use --replace only after intentionally reviewing the new sources')
      if (!await windowsCredentialExists(context.repoRoot, KRISH_IDENTITY_CREDENTIAL)) await generateWindowsCredential(context.repoRoot, KRISH_IDENTITY_CREDENTIAL)
      const secret = await readWindowsCredential(context.repoRoot, KRISH_IDENTITY_CREDENTIAL)
      const reference = await enrollKrishIdentity(context.repoRoot, options.input, secret, new Date().toISOString())
      context.out({ enrolled: true, profile_id: reference.profile_id, version_hash: reference.version_hash, display_name: reference.display_name })
    })
  identity.command('revoke').action(async () => {
    await revokeKrishIdentity()
    context.out({ enrolled: false, revoked_profile_id: 'krish-face-v1', credential_retained: true })
  })

  const jobs = v2.command('job')
  jobs.command('create')
    .requiredOption('--series <series>')
    .requiredOption('--mode <mode>')
    .option('--source-bundle <path>', 'SourceBundleV1 JSON; may be attached after recording for short-native work')
    .option('--purpose <purpose>', 'production or calibration', 'production')
    .option('--lane <lane>', 'restrained, premium, or experimental', 'premium')
    .option('--platforms <platforms...>', 'target packages', [...ALL_PLATFORMS])
    .option('--identity-profile <path>', 'Krish-only enrolled identity profile reference JSON')
    .option('--no-identity', 'do not pin the currently enrolled Krish face profile')
    .option('--consent-refs <refs...>', 'job-local participant consent references')
    .option('--techniques <path>', 'versioned technique registry', join(context.repoRoot, 'config', 'techniques.json'))
    .option('--no-presenter', 'create a job without declaring Krish as presenter')
    .action(async (options) => {
      await ensureRuntime()
      const mode = SourceModeSchema.parse(options.mode)
      const sourceBundle = options.sourceBundle ? SourceBundleV1Schema.parse(await readJson(options.sourceBundle)) : undefined
      if (mode !== 'short_native' && !sourceBundle) throw new Error('--source-bundle is required for extract and solo jobs')
      const enrolledIdentity = options.identity === false ? { enrolled: false as const } : await krishIdentityStatus()
      let identityProfile = options.identityProfile
        ? await readJson(options.identityProfile) as { profile_id: string; version_hash: string; display_name: 'Krish' }
        : undefined
      if (!identityProfile && enrolledIdentity.enrolled) {
        const loaded = await loadKrishIdentity(await readWindowsCredential(context.repoRoot, KRISH_IDENTITY_CREDENTIAL))
        if (loaded.reference.version_hash !== enrolledIdentity.version_hash) throw new Error('encrypted Krish identity profile integrity check failed')
        identityProfile = loaded.reference
      }
      for (const sourceItem of sourceBundle?.sources ?? []) {
        for (const participant of mediaSourceParticipantRoster(sourceItem).filter((item) => item.kind === 'krish_profile')) {
          if (!identityProfile) throw new Error(`source ${sourceItem.source_id} declares Krish but no encrypted Krish identity profile is pinned`)
          if (participant.profile_id !== identityProfile.profile_id || participant.version_hash !== identityProfile.version_hash) {
            throw new Error(`source ${sourceItem.source_id} references a different Krish identity profile version`)
          }
        }
      }
      const manifest = await createJobV2({
        series: normalizeSeries(options.series),
        mode,
        purpose: JobPurposeSchema.parse(options.purpose),
        ...(sourceBundle ? { sourceBundle } : {}),
        targetPlatforms: options.platforms.map((platform: string) => VideoPlatformV1Schema.parse(platform)),
        treatmentLane: TreatmentLaneV1Schema.parse(options.lane),
        ...(options.presenter ? { presenterName: 'Krish' as const } : {}),
        ...(identityProfile ? { identityProfile } : {}),
        consentRefs: options.consentRefs || [],
        configPath: context.configPath,
        skillPaths: context.skillPaths,
        techniqueRegistryPath: resolve(options.techniques),
      })
      context.out({ job: manifest, next_stage: v2RunnableStages(manifest.stages, manifest.mode)[0] || null })
    })

  jobs.command('status')
    .option('--job <jobId>')
    .action(async (options) => {
      if (options.job) {
        const manifest = await loadJobV2(options.job)
        context.out({ job: manifest, runnable_stages: v2RunnableStages(manifest.stages, manifest.mode) })
        return
      }
      const paths = studioPaths()
      const found: unknown[] = []
      try {
        const entries = await readdir(paths.jobsRoot, { withFileTypes: true })
        for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
          if (!entry.isDirectory()) continue
          try {
            const raw = await readJson<{ schema_version?: number }>(join(paths.jobsRoot, entry.name, 'job.json'))
            if (raw.schema_version !== 2) continue
            const manifest = await loadJobV2(entry.name)
            found.push({ job_id: manifest.job_id, series: manifest.series, mode: manifest.mode, runnable_stages: v2RunnableStages(manifest.stages, manifest.mode), stages: manifest.stages })
          } catch {
            found.push({ job_id: entry.name, invalid_v2_job: true })
          }
        }
      } catch {
        // A missing runtime is an empty queue, not an error.
      }
      context.out({ runtime_root: paths.runtimeRoot, jobs: found })
    })

  jobs.command('resume')
    .requiredOption('--job <jobId>')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      const runnable = v2RunnableStages(manifest.stages, manifest.mode)
      const blocked = Object.entries(manifest.stages).filter(([, state]) => state.status === 'blocked').map(([stage, state]) => ({ stage, reason: state.reason }))
      const next = runnable[0]
      context.out({ job_id: manifest.job_id, next_stage: next || null, command: next ? stageHint(next, manifest.job_id) : null, runnable_stages: runnable, blocked })
    })

  v2.command('ingest')
    .requiredOption('--job <jobId>')
    .option('--source-bundle <path>', 'attach the exact recorded SourceBundleV1 JSON')
    .option('--replace-source-bundle', 'replace a previously attached short-native recording bundle')
    .action(async (options) => {
      let manifest = await loadJobV2(options.job)
      if (options.replaceSourceBundle && !options.sourceBundle) throw new Error('--replace-source-bundle requires --source-bundle')
      if (options.sourceBundle) {
        const supplied = SourceBundleV1Schema.parse(await readJson(options.sourceBundle))
        const identityIssues = sourceBundleIdentityIssues(manifest, supplied)
        if (identityIssues.length) throw new Error(`hard identity block: ${identityIssues.join('; ')}`)
        const previousHash = manifest.source_bundle ? hashValue(manifest.source_bundle) : undefined
        const suppliedHash = hashValue(supplied)
        if (previousHash && previousHash !== suppliedHash && !options.replaceSourceBundle) {
          throw new Error('a different source bundle is already attached; use --replace-source-bundle only after intentionally selecting a new short-native recording')
        }
        manifest = await attachSourceBundleV2(manifest.job_id, supplied)
      }
      const bundle = requireSourceBundle(manifest)
      const identityIssues = sourceBundleIdentityIssues(manifest, bundle)
      if (identityIssues.length) throw new Error(`hard identity block: ${identityIssues.join('; ')}`)
      if (manifest.mode === 'short_native' && manifest.stages.recording_brief.status !== 'complete') {
        throw new Error('short-native recording ingest requires an approved-script recording brief first')
      }

      const included = bundle.sources.filter((sourceItem) => sourceItem.include_in_edit)
      if (!included.length) throw new Error('source bundle has no sources included in the edit')
      const probed: IngestPayloadV2['sources'] = []
      for (const sourceItem of included) {
        const probe = await probeMediaSourceV2(sourceItem.ref)
        if (sourceItem.content_hash && sourceItem.content_hash !== probe.file_hash) throw new Error(`source hash changed for ${sourceItem.source_id}`)
        if (probe.duration_seconds <= 0) throw new Error(`source ${sourceItem.source_id} has no measurable duration`)
        probed.push({
          source_id: sourceItem.source_id,
          path: probe.path,
          file_hash: probe.file_hash,
          duration_ms: Math.max(1, Math.round(probe.duration_seconds * 1000)),
          kind: sourceItem.kind,
        })
      }
      const verifiedSidecars: NonNullable<IngestPayloadV2['sidecars']> = []
      for (const sidecar of bundle.sidecars ?? []) {
        const sidecarPath = resolve(sidecar.ref)
        const sidecarInfo = await lstat(sidecarPath)
        if (!sidecarInfo.isFile()) throw new Error(`sidecar ${sidecar.sidecar_id} is not a regular file`)
        if (sidecarInfo.size > driveDiscoverySidecarByteLimit()) throw new Error(`sidecar ${sidecar.sidecar_id} exceeds the configured safe byte limit`)
        const fileHash = await hashFile(sidecarPath)
        if (fileHash !== sidecar.content_hash) throw new Error(`sidecar hash changed for ${sidecar.sidecar_id}`)
        verifiedSidecars.push({
          sidecar_id: sidecar.sidecar_id,
          source_id: sidecar.source_id,
          path: sidecarPath,
          file_hash: fileHash,
          kind: sidecar.kind,
          format: sidecar.format,
        })
      }
      const bundleHash = hashValue(bundle)
      const sourceFilesHash = hashValue({
        sources: probed.map(({ source_id, file_hash }) => ({ source_id, file_hash })).sort((left, right) => left.source_id.localeCompare(right.source_id)),
        sidecars: verifiedSidecars.map(({ sidecar_id, file_hash }) => ({ sidecar_id, file_hash })).sort((left, right) => left.sidecar_id.localeCompare(right.sidecar_id)),
      })
      const ingestInputs = { source_bundle: bundleHash, source_files: sourceFilesHash }
      const ingestTools = { probe: 'ffprobe-system', cli: V2_CLI_VERSION }
      const ingestPayload: IngestPayloadV2 = { source_bundle_hash: bundleHash, sources: probed, ...(verifiedSidecars.length ? { sidecars: verifiedSidecars } : {}) }
      const ingestArtifact = await readReusableStageV2<IngestPayloadV2>(manifest.job_id, 'ingest', ingestInputs, ingestTools)
        || await completeStageV2(manifest.job_id, 'ingest', ingestPayload, ingestInputs, ingestTools)

      const normalizeInputs = { ingest: ingestArtifact.artifact_hash, source_bundle: bundleHash, source_files: sourceFilesHash }
      const normalizeTools = { normalizer: 'ffmpeg-cfr-source-preserving-v2', cli: V2_CLI_VERSION }
      const reusableNormalize = await readReusableStageV2<NormalizePayloadV2>(manifest.job_id, 'normalize', normalizeInputs, normalizeTools)
      if (reusableNormalize) {
        const intact = (await Promise.all(reusableNormalize.payload.sources.map(async (sourceItem) => {
          try { return await hashFile(sourceItem.normalized_path) === sourceItem.normalized_hash } catch { return false }
        }))).every(Boolean)
        if (intact) {
          context.out({ job_id: manifest.job_id, ingest_artifact_hash: ingestArtifact.artifact_hash, normalize_artifact_hash: reusableNormalize.artifact_hash, sources: reusableNormalize.payload.sources, reused: true })
          return
        }
      }

      const normalized: NormalizedMediaSourceV2[] = []
      for (const sourceItem of included) normalized.push(await normalizeMediaSourceV2(manifest.job_id, sourceItem))
      const normalizePayload: NormalizePayloadV2 = { source_bundle_hash: bundleHash, sources: normalized }
      const normalizeArtifact = await completeStageV2(manifest.job_id, 'normalize', normalizePayload, normalizeInputs, normalizeTools)
      context.out({
        job_id: manifest.job_id,
        ingest_artifact_hash: ingestArtifact.artifact_hash,
        normalize_artifact_hash: normalizeArtifact.artifact_hash,
        sources: normalized,
        next: [
          `studio v2 transcribe --job ${manifest.job_id}`,
          `studio v2 source analyze --job ${manifest.job_id}`,
        ],
      })
    })

  v2.command('transcribe')
    .requiredOption('--job <jobId>')
    .option('--source-id <sourceId>', 'normalized source carrying the authoritative speech track')
    .option('--model <model>', 'faster-whisper model; defaults to the job-pinned configuration')
    .option('--captions <path>', 'existing SRT or VTT for coarse search')
    .option('--verified <path>', 'human-verified TranscriptDocument JSON')
    .action(async (options) => {
      if (options.captions && options.verified) throw new Error('choose either --captions or --verified, not both')
      const manifest = await loadJobV2(options.job)
      const bundle = requireSourceBundle(manifest)
      const normalizedArtifact = await readStageArtifactV2<NormalizePayloadV2>(manifest.job_id, 'normalize')
      const normalizedById = new Map(normalizedArtifact.payload.sources.map((sourceItem) => [sourceItem.source_id, sourceItem]))
      const isolatedAudio = bundle.sources.find((sourceItem) => sourceItem.include_in_edit && sourceItem.role === 'isolated_audio' && normalizedById.get(sourceItem.source_id)?.audio_hz)
      const primary = bundle.sources.find((sourceItem) => sourceItem.source_id === bundle.primary_source_id)
      const primaryWithAudio = primary && normalizedById.get(primary.source_id)?.audio_hz ? primary : undefined
      const fallback = bundle.sources.find((sourceItem) => sourceItem.include_in_edit && normalizedById.get(sourceItem.source_id)?.audio_hz)
      const selected = options.sourceId
        ? bundle.sources.find((sourceItem) => sourceItem.source_id === options.sourceId)
        : isolatedAudio || primaryWithAudio || fallback
      if (!selected || !selected.include_in_edit) throw new Error('the selected transcript source is missing or excluded from the edit')
      const captionTimelineSourceIds = new Set([
        selected.source_id,
        ...(selected.role === 'isolated_audio' && selected.sync.reference_source_id ? [selected.sync.reference_source_id] : []),
      ])
      const bundledCaptions = (bundle.sidecars ?? []).filter((sidecar) => sidecar.kind === 'captions' && captionTimelineSourceIds.has(sidecar.source_id))
      if (!options.captions && !options.verified && bundledCaptions.length > 1) throw new Error('multiple bundled caption sidecars match the transcript source; choose one explicitly with --captions')
      const bundledCaption = !options.captions && !options.verified ? bundledCaptions[0] : undefined
      const captionPath = options.captions ? resolve(options.captions) : bundledCaption?.ref
      if (captionPath) {
        const captionInfo = await lstat(resolve(captionPath))
        if (!captionInfo.isFile()) throw new Error('caption input is not a regular file')
        if (captionInfo.size > driveDiscoverySidecarByteLimit()) throw new Error('caption input exceeds the configured safe byte limit')
      }
      if (bundledCaption && await captionSidecarLooksLikeDjiTelemetry(resolve(bundledCaption.ref))) {
        throw new Error(`bundled caption ${bundledCaption.sidecar_id} resembles DJI telemetry rather than speech; inspect it and supply an explicit --captions file or a human-verified transcript`)
      }
      if (bundledCaption && await hashFile(resolve(bundledCaption.ref)) !== bundledCaption.content_hash) {
        throw new Error(`bundled caption ${bundledCaption.sidecar_id} changed after ingest; restore it or rerun ingest with an explicitly reviewed SourceBundle`)
      }
      const normalized = normalizedById.get(selected.source_id)
      if (!normalized) throw new Error(`normalized source ${selected.source_id} is unavailable`)
      if (await hashFile(resolve(normalized.normalized_path)) !== normalized.normalized_hash) throw new Error(`normalized source ${selected.source_id} changed after the normalize stage; rerun ingest instead of transcribing untracked bytes`)
      if (!normalized.audio_hz) {
        if (fallback && fallback.source_id !== selected.source_id) throw new Error(`source ${selected.source_id} has no audio; retry with --source-id ${fallback.source_id}`)
        throw new Error(`source ${selected.source_id} has no audio track to transcribe`)
      }

      const config = await readJson<PinnedStudioConfigV2>(pinnedConfigPathV2(manifest))
      const model = options.model || config.transcription?.local_model || 'base.en'
      const vocabulary = config.transcription?.vocabulary || []
      const importHash = options.verified ? await hashFile(options.verified) : captionPath ? await hashFile(captionPath) : normalized.normalized_hash
      const inputs = { normalize: normalizedArtifact.artifact_hash, transcript_source: normalized.normalized_hash, import: importHash }
      const tools = options.verified
        ? { transcript_pipeline: 'human-verified-v2', cli: V2_CLI_VERSION }
        : captionPath
          ? { transcript_pipeline: `caption-import-${extname(captionPath).slice(1).toLowerCase()}-v2`, cli: V2_CLI_VERSION }
          : { transcript_pipeline: 'faster-whisper-int8-v2', model, vocabulary: vocabulary.join('|'), cli: V2_CLI_VERSION }
      const outputPath = join(jobPath(manifest.job_id), 'transcript', `${selected.source_id}.json`)
      const reusable = await readReusableStageV2<TranscriptStagePayloadV2>(manifest.job_id, 'transcript', inputs, tools)
      if (reusable) {
        await writeJson(outputPath, reusable.payload.transcript)
        context.out({ job_id: manifest.job_id, artifact_hash: reusable.artifact_hash, transcript_path: outputPath, ...reusable.payload, reused: true })
        return
      }

      const imported = options.verified
        ? await readJson(options.verified)
        : captionPath
          ? await loadCaptionTranscript(resolve(captionPath))
          : await transcribeMedia(context.repoRoot, normalized.normalized_path, outputPath, model, vocabulary)
      const importedTranscript = imported && typeof imported === 'object' && 'transcript' in imported
        ? (imported as { transcript: unknown }).transcript
        : imported
      let transcript = parseTranscriptDocument(importedTranscript)
      if (options.verified) transcript = { ...transcript, source: 'manual', verified: true }
      const transcriptEnd = Math.max(...transcript.segments.map((segment) => segment.end_ms))
      if (transcriptEnd > normalized.duration_ms + 250) throw new Error('transcript timing exceeds the exact normalized source duration')
      const selectedParticipants = mediaSourceParticipantRoster(selected)
      const unambiguouslyKrish = selectedParticipants.length === 1 && selectedParticipants[0]?.kind === 'krish_profile'
      if (!options.verified && unambiguouslyKrish && manifest.presenter_name === 'Krish' && (config.identity?.presenter_name || 'Krish') === 'Krish') {
        transcript = applyPresenterIdentityCorrections(transcript, 'Krish', config.identity?.asr_aliases || ['Chris'])
      }
      transcript.quality = assessTranscriptQuality(transcript)
      await writeJson(outputPath, transcript)

      let recordingAlignment: TranscriptStagePayloadV2['recording_alignment']
      if (manifest.mode === 'short_native') {
        const recordingBrief = await readStageArtifactV2<RecordingBriefPayloadV2>(manifest.job_id, 'recording_brief')
        try { recordingAlignment = alignScriptToTranscript(recordingBrief.payload.script, transcript) }
        catch (error) {
          const detail = error instanceof Error ? error.message : 'approved script could not be matched to this take'
          await blockStageV2(manifest.job_id, 'transcript', detail)
          throw new Error(`recording does not faithfully match the approved script: ${detail}. Re-record with the recording brief, or create a new extracted editorial candidate from the actual take.`)
        }
        if (recordingAlignment.similarity < 0.72) {
          await blockStageV2(manifest.job_id, 'transcript', `approved-script similarity ${recordingAlignment.similarity.toFixed(2)} is below 0.72`)
          throw new Error(`recording similarity ${recordingAlignment.similarity.toFixed(2)} is too low for the approved script. Re-record or deliberately re-brief the actual take; do not silently treat it as the approved wording.`)
        }
        const recordedWindow = sliceTranscript(transcript, recordingAlignment.start_ms, recordingAlignment.end_ms)
        const fidelity = exactWordFidelity(recordingBrief.payload.script, recordedWindow)
        if (!fidelity.exact_word_fidelity || fidelity.caption_token_count !== fidelity.source_token_count) {
          await blockStageV2(manifest.job_id, 'transcript', 'recorded wording differs from the exact approved short-native script')
          throw new Error('recording contains omitted, added, substituted, or reordered words relative to the approved script. Re-record the affected beat, or create a new extracted-edit job from the actual take; do not silently preserve the old approval.')
        }
      }

      const payload: TranscriptStagePayloadV2 = {
        source_id: selected.source_id,
        source_role: selected.role,
        canonical_offset_ms: normalized.canonical_offset_ms,
        normalized_source_hash: normalized.normalized_hash,
        transcript,
        ...(recordingAlignment ? { recording_alignment: recordingAlignment } : {}),
      }
      const artifact = await completeStageV2(manifest.job_id, 'transcript', payload, inputs, tools)
      context.out({
        job_id: manifest.job_id,
        artifact_hash: artifact.artifact_hash,
        transcript_path: outputPath,
        source_id: selected.source_id,
        quality: transcript.quality,
        verified: transcript.verified === true,
        ...(recordingAlignment ? { recording_alignment: recordingAlignment } : {}),
        human_verification_required: transcript.verified !== true,
      })
    })

  v2.command('candidates')
    .requiredOption('--job <jobId>')
    .option('--input <path>', 'Codex-authored CandidateV1 JSON, array, or {candidates: []}')
    .option('--brief <path>', 'short-native evidence and audience brief JSON')
    .option('--limit <number>', 'maximum discovery candidates', '8')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      const config = await readJson<PinnedStudioConfigV2>(pinnedConfigPathV2(manifest))
      if (!config.editorial_thresholds) throw new Error('job-pinned configuration is missing editorial_thresholds')
      const limit = Number(options.limit)
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('--limit must be an integer between 1 and 20')
      let candidates: CandidateV1[]
      let candidatesInputs: Record<string, string>
      let generator: string

      if (manifest.mode === 'short_native') {
        if (!options.input) throw new Error('short-native work requires --input with a Codex-authored, editorially assessed CandidateV1 script')
        let briefArtifact
        if (options.brief) {
          const brief = await readJson(options.brief)
          if (!brief || typeof brief !== 'object' || Array.isArray(brief) || !Object.keys(brief as object).length) throw new Error('short-native brief must be a non-empty JSON object')
          const briefHash = await hashFile(options.brief)
          briefArtifact = await completeStageV2(manifest.job_id, 'brief', { brief, source_hash: briefHash }, { brief_file: briefHash }, { author: 'codex', cli: V2_CLI_VERSION })
        } else {
          try { briefArtifact = await readStageArtifactV2(manifest.job_id, 'brief') }
          catch { throw new Error('the first short-native candidate pass requires --brief with the evidence and audience brief') }
        }
        const raw = await readJson(options.input)
        const parsed = candidatesInPayload(raw)
        if (!parsed.length) throw new Error('short-native input contains no valid CandidateV1 scripts')
        candidates = parsed.map((candidate) => {
          if (candidate.job_id !== manifest.job_id || candidate.series !== manifest.series || candidate.mode !== manifest.mode) throw new Error('short-native candidate job, series, and mode must match the job manifest')
          return withEditorialValidation(candidate, validateShortNativeEditorialCandidate(candidate, config.editorial_thresholds, manifest.presenter_name), true)
        })
        const inputHash = await hashFile(options.input)
        const scriptArtifact = await completeStageV2(manifest.job_id, 'script', {
          brief_artifact_hash: briefArtifact.artifact_hash,
          source_file_hash: inputHash,
          scripts: candidates.map((candidate) => ({ candidate_id: candidate.candidate_id, script: candidate.transcript, hook: candidate.hook, payoff: candidate.payoff })),
        }, { brief: briefArtifact.artifact_hash, script_file: inputHash }, { author: 'codex', validator: 'short-native-editorial-v2' })
        candidatesInputs = { script: scriptArtifact.artifact_hash, candidate_file: inputHash }
        generator = 'codex-short-native-editorial-v2'
      } else {
        const transcriptArtifact = await readStageArtifactV2<TranscriptStagePayloadV2>(manifest.job_id, 'transcript')
        const transcript = parseTranscriptDocument(transcriptArtifact.payload.transcript)
        if (options.input) {
          const raw = await readJson(options.input)
          const parsed = candidatesInPayload(raw)
          if (!parsed.length) throw new Error('candidate input contains no valid CandidateV1 objects')
          const compatibilityJob = candidateCompatibilityJob(manifest, transcriptArtifact.payload.source_id)
          candidates = parsed.map((candidate) => {
            if (candidate.job_id !== manifest.job_id || candidate.series !== manifest.series || candidate.mode !== manifest.mode) throw new Error('candidate job, series, and mode must match the job manifest')
            return withEditorialValidation(candidate, validateEditorialCandidate(candidate, transcript, compatibilityJob, config.editorial_thresholds), false)
          })
          candidatesInputs = { transcript: transcriptArtifact.artifact_hash, candidate_file: await hashFile(options.input) }
          generator = 'codex-excerpt-editorial-v2'
        } else {
          candidates = generateCandidates(candidateCompatibilityJob(manifest, transcriptArtifact.payload.source_id), transcript, limit)
          candidatesInputs = { transcript: transcriptArtifact.artifact_hash }
          generator = 'mindmake-discovery-v2'
        }
      }

      const saved = await saveCandidateSet(manifest, candidates)
      const candidateArtifact = await completeStageV2(manifest.job_id, 'candidates', { candidates: saved }, candidatesInputs, { generator, cli: V2_CLI_VERSION })
      const claimLedger = buildClaimLedger(manifest, candidateArtifact.artifact_hash, candidates)
      const claimsArtifact = await completeStageV2(manifest.job_id, 'claims', claimLedger, { candidates: candidateArtifact.artifact_hash }, { extractor: 'mindmake-claims-ledger-v2' })
      const recordable = saved.filter(({ candidate }) => !candidate.challenge.hard_blocks.length)
      context.out({
        job_id: manifest.job_id,
        candidates_artifact_hash: candidateArtifact.artifact_hash,
        claims_artifact_hash: claimsArtifact.artifact_hash,
        candidates: saved,
        claim_ledger: claimLedger,
        next_actions: recordable.length
          ? recordable.map(({ path, hash }) => `studio v2 approve --job ${manifest.job_id} --gate angle --artifact "${path}" --confirmation-ref "studio-user-confirmation:<client>:angle:${hash}:<exact Krish approval message>"`)
          : [manifest.mode === 'short_native'
              ? 'Do not record. Revise the script against its hard blocks or reject the idea.'
              : 'These are discovery windows only. Author an exact semantic edit plan and editorial assessment, then rerun with --input.'],
      })
    })

  const recordingBrief = v2.command('recording-brief')
  recordingBrief.command('create')
    .requiredOption('--job <jobId>')
    .requiredOption('--candidate <path>', 'exact Krish-approved short-native CandidateV1 JSON')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      if (manifest.mode !== 'short_native') throw new Error('recording briefs are created here only for short-native jobs')
      const candidate = CandidateV1Schema.parse(await readJson(options.candidate))
      const candidateHash = candidateSemanticHash(candidate)
      await assertCandidateIsCurrent(manifest.job_id, candidate)
      if (!hasApprovalV2(manifest, 'angle', candidateHash, 'krish')) throw new Error('the exact script requires Krish angle approval before a recording brief is created')
      if (candidate.challenge.hard_blocks.length) throw new Error(`do not record: ${candidate.challenge.hard_blocks.join('; ')}`)
      const specific = candidate.editorial?.rerecord_guidance
      const estimatedSeconds = Math.max(20, Math.min(60, Math.ceil(candidate.transcript.split(/\s+/).filter(Boolean).length / 2.5)))
      const payload: RecordingBriefPayloadV2 = {
        candidate_id: candidate.candidate_id,
        candidate_hash: candidateHash,
        script: candidate.transcript,
        guidance: {
          hook: specific?.hook || `Deliver this exact approved opening without a preamble: ${candidate.hook}`,
          missing_proof: specific?.missing_proof || (candidate.claims.length
            ? 'Capture the approved supporting artifact or screenshot cleanly enough to verify every factual claim on screen.'
            : 'Capture the concrete interface, sketch, object, or action that makes the mechanism visible rather than merely decorative.'),
          structure: specific?.structure || 'Record a clean opening, mechanism, concrete proof, consequence, and complete ending; leave a short pause between beats for editorial options.',
          delivery: specific?.delivery || 'Look into lens for the claim, slow slightly on the mechanism, vary emphasis naturally, and repeat any weak beat as a complete sentence.',
          ending: specific?.ending || `Finish decisively on this approved payoff: ${candidate.payoff}`,
          duration: specific ? `${specific.target_duration_seconds.min}-${specific.target_duration_seconds.max} seconds` : `Target approximately ${estimatedSeconds} seconds; quality and a complete ending matter more than filling time.`,
        },
      }
      const artifact = await completeStageV2(manifest.job_id, 'recording_brief', payload, {
        candidates: currentArtifactHash(manifest, 'candidates'),
        claims: currentArtifactHash(manifest, 'claims'),
        candidate: candidateHash,
      }, { director: 'mindmake-recording-brief-v2', cli: V2_CLI_VERSION })
      const outputPath = join(jobPath(manifest.job_id), 'recording', `${candidate.candidate_id}.brief.json`)
      await writeJson(outputPath, payload)
      context.out({
        job_id: manifest.job_id,
        artifact_hash: artifact.artifact_hash,
        recording_brief_path: outputPath,
        recording_brief: payload,
        next: `studio v2 ingest --job ${manifest.job_id} --source-bundle <recorded-source-bundle.json>`,
      })
    })

  const stages = v2.command('stage')
  stages.command('import')
    .requiredOption('--job <jobId>')
    .requiredOption('--stage <stage>')
    .requiredOption('--input <path>', 'exact JSON stage payload')
    .option('--tool <entries...>', 'additional tool versions as key=value')
    .action(async (options) => {
      const stage = StageNameV2Schema.parse(options.stage)
      const dedicatedStages: StageNameV2[] = ['recording_brief', 'ingest', 'normalize', 'transcript', 'source_analysis', 'candidates', 'claims', 'visual_plan', 'assets', 'styleframes', 'animatic', 'treatment', 'render', 'qa', 'package']
      if (dedicatedStages.includes(stage)) throw new Error(`stage ${stage} has a dedicated validated V2 command and cannot use generic import`)
      const job = await loadJobV2(options.job)
      const payload = await readJson(options.input)
      if (stage === 'styleframes') {
        const visualPlanHash = currentArtifactHash(job, 'visual_plan')
        if (!hasApprovalV2(job, 'visual_plan', visualPlanHash, 'krish')) throw new Error('exact visual plan approval from Krish is required before styleframes')
        await verifyReviewPacketFiles(payload)
        const packet = StoryboardReviewPacketV1Schema.parse(payload)
        if (packet.review_kind !== 'styleframes' || packet.job_id !== job.job_id || packet.visual_plan_artifact_hash !== visualPlanHash) throw new Error('styleframes packet is not bound to the current job and visual plan')
        const approvedAssets = await readStageArtifactV2<{ assets: VisualAssetV1[]; generated_shots: GeneratedShotV1[] }>(job.job_id, 'assets')
        const expectedHashes = [...approvedAssets.payload.assets.map((asset) => asset.sha256), ...approvedAssets.payload.generated_shots.map((shot) => shot.output_hash)].sort()
        if (hashValue([...packet.exact_asset_hashes].sort()) !== hashValue(expectedHashes)) throw new Error('styleframes packet is not bound to the exact approved assets')
      }
      if (stage === 'candidates') {
        const candidates = candidatesInPayload(payload)
        if (!candidates.length) throw new Error('candidates import requires at least one valid CandidateV1')
        if (candidates.some((candidate) => candidate.job_id !== job.job_id || candidate.series !== job.series || candidate.mode !== job.mode)) throw new Error('every imported candidate must match the job, series, and mode')
      }
      if (stage === 'animatic') {
        const styleframeHash = currentArtifactHash(job, 'styleframes')
        if (!hasApprovalV2(job, 'storyboard', styleframeHash, 'krish')) throw new Error('exact storyboard approval from Krish is required before the animatic')
        await verifyReviewPacketFiles(payload)
        const packet = StoryboardReviewPacketV1Schema.parse(payload)
        if (packet.review_kind !== 'animatic' || packet.job_id !== job.job_id || packet.visual_plan_artifact_hash !== currentArtifactHash(job, 'visual_plan')) throw new Error('animatic packet is not bound to the current job and visual plan')
      }
      if (stage === 'treatment') {
        const animaticHash = currentArtifactHash(job, 'animatic')
        if (!hasApprovalV2(job, 'animatic', animaticHash, 'krish')) throw new Error('exact animatic approval from Krish is required before treatment')
        await verifyTreatmentPayload(payload as TreatmentPayload)
        const treatmentPayload = payload as TreatmentPayload
        const platforms = treatmentPayload.manifests.map((item) => item.platform).sort()
        if (hashValue(platforms) !== hashValue([...job.target_platforms].sort())) throw new Error('treatment must contain exactly one manifest for every target platform')
        const visualPlanHash = currentArtifactHash(job, 'visual_plan')
        const styleframesHash = currentArtifactHash(job, 'styleframes')
        const approvedAssets = await readStageArtifactV2<{ assets: VisualAssetV1[]; generated_shots: GeneratedShotV1[] }>(job.job_id, 'assets')
        for (const item of treatmentPayload.manifests) {
          const renderManifest = RenderManifestV2Schema.parse(await readJson(item.manifest_path))
          if (renderManifest.job_id !== job.job_id || renderManifest.series !== job.series || renderManifest.treatment_lane !== job.treatment_lane) throw new Error(`treatment manifest identity mismatch for ${item.platform}`)
          if (renderManifest.visual_plan_artifact_hash !== visualPlanHash || renderManifest.storyboard_artifact_hash !== styleframesHash) throw new Error(`treatment manifest provenance mismatch for ${item.platform}`)
          if (hashValue(renderManifest.assets) !== hashValue(approvedAssets.payload.assets) || hashValue(renderManifest.generated_shots) !== hashValue(approvedAssets.payload.generated_shots)) throw new Error(`treatment manifest asset ledger mismatch for ${item.platform}`)
        }
      }
      if (stage === 'render') {
        const treatmentHash = currentArtifactHash(job, 'treatment')
        if (!hasApprovalV2(job, 'treatment', treatmentHash, 'krish')) throw new Error('exact treatment approval from Krish is required before final rendering')
        await verifyRenderPayload(payload as RenderPayload)
        const treatmentPayload = await readStageArtifactV2<TreatmentPayload>(job.job_id, 'treatment')
        const approvedManifests = new Map(treatmentPayload.payload.manifests.map((item) => [item.platform, item]))
        const renderPayload = payload as RenderPayload
        if (hashValue(renderPayload.renders.map((item) => item.platform).sort()) !== hashValue([...job.target_platforms].sort())) throw new Error('render stage must contain exactly one master for every target platform')
        for (const item of renderPayload.renders) {
          const approved = approvedManifests.get(item.platform)
          if (!approved || approved.manifest_hash !== item.manifest_hash || resolve(approved.manifest_path) !== resolve(item.manifest_path)) throw new Error(`render for ${item.platform} does not use the approved treatment manifest`)
        }
      }
      const sourceHash = await hashFile(resolve(options.input))
      const artifact = await completeStageV2(options.job, stage, payload, { ...prerequisiteHashes(job, stage), import_file: sourceHash }, { cli_import: V2_CLI_VERSION, ...parseRecord(options.tool, '--tool') })
      context.out({ job_id: options.job, stage, artifact_hash: artifact.artifact_hash, next_gate: stage === 'styleframes' ? 'storyboard' : stage === 'animatic' ? 'animatic' : stage === 'treatment' ? 'treatment' : stage === 'render' ? 'final per master hash after QA' : null })
    })

  const source = v2.command('source')
  source.command('analyze')
    .requiredOption('--job <jobId>')
    .option('--sample-fps <number>', 'visual analysis samples per second', '4')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      const sampleFps = Number(options.sampleFps)
      if (!Number.isFinite(sampleFps) || sampleFps <= 0 || sampleFps > 30) throw new Error('--sample-fps must be between 0 and 30')
      const normalizeHash = currentArtifactHash(manifest, 'normalize')
      const normalizedArtifact = await readStageArtifactV2<NormalizePayloadV2>(manifest.job_id, 'normalize')
      for (const sourceItem of normalizedArtifact.payload.sources) {
        if (await hashFile(resolve(sourceItem.normalized_path)) !== sourceItem.normalized_hash) throw new Error(`normalized source ${sourceItem.source_id} changed after ingest; source analysis cannot reuse or analyze untracked bytes`)
      }
      const analysisBundle = normalizedSourceBundle(manifest, normalizedArtifact.payload)
      const sourceFilesHash = hashValue(normalizedArtifact.payload.sources.map((sourceItem) => ({ source_id: sourceItem.source_id, sha256: sourceItem.normalized_hash })).sort((left, right) => left.source_id.localeCompare(right.source_id)))
      const analyzerHash = hashValue({
        source_analysis: await hashFile(join(context.repoRoot, 'packages', 'core', 'src', 'source-analysis.ts')),
        visual_analyzer: await hashFile(join(context.repoRoot, 'scripts', 'analyze-visual.py')),
        face_identity: await hashFile(join(context.repoRoot, 'scripts', 'face-identity.py')),
      })
      const inputs = { normalize: normalizeHash, source_bundle: hashValue(analysisBundle), source_files: sourceFilesHash, sampling: hashValue({ sample_fps: sampleFps }) }
      const tools = { visual_analyzer: analyzerHash, sample_fps: String(sampleFps), cli: V2_CLI_VERSION }
      const reusable = await readReusableStageV2(options.job, 'source_analysis', inputs, tools)
      if (reusable) {
        context.out({ job_id: options.job, artifact_hash: reusable.artifact_hash, analysis: reusable.payload, reused: true })
        return
      }
      let identityTemplate: Awaited<ReturnType<typeof loadKrishIdentity>> | undefined
      if (manifest.identity_profile) {
        const secret = await readWindowsCredential(context.repoRoot, KRISH_IDENTITY_CREDENTIAL)
        identityTemplate = await loadKrishIdentity(secret)
        if (identityTemplate.reference.version_hash !== manifest.identity_profile.version_hash) throw new Error('the job-pinned Krish identity version is unavailable; resume with the original encrypted profile or create a new job')
      }
      const analysis = await analyzeSourceBundle(context.repoRoot, manifest.job_id, analysisBundle, {
        generatedAt: new Date().toISOString(),
        ...(manifest.identity_profile ? { identityProfile: manifest.identity_profile } : {}),
        ...(identityTemplate ? { identityTemplate: identityTemplate.profile } : {}),
        sampleFps,
      })
      const artifact = await completeStageV2(options.job, 'source_analysis', analysis, inputs, tools)
      context.out({ job_id: options.job, artifact_hash: artifact.artifact_hash, analysis, unavailable_capabilities: analysis.capabilities.unavailable, fallbacks: analysis.capabilities.fallbacks })
    })

  const visualPlan = v2.command('visual-plan')
  visualPlan.command('context')
    .requiredOption('--job <jobId>')
    .requiredOption('--candidate <path>')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      const candidate = CandidateV1Schema.parse(await readJson(options.candidate))
      if (candidate.job_id !== manifest.job_id) throw new Error('candidate belongs to a different job')
      await assertCandidateIsCurrent(manifest.job_id, candidate)
      const analysis = await readStageArtifactV2(options.job, 'source_analysis')
      const claims = await readStageArtifactV2<ClaimsStagePayloadV2>(options.job, 'claims')
      const techniquePath = pinnedTechniqueRegistryPathV2(manifest)
      if (!techniquePath) throw new Error('job has no pinned technique registry')
      context.out({
        job_id: manifest.job_id,
        candidate_id: candidate.candidate_id,
        candidate_hash: candidateSemanticHash(candidate),
        source_analysis_artifact_hash: analysis.artifact_hash,
        claims_artifact_hash: claims.artifact_hash,
        claims: claims.payload.claims.filter((claim) => claim.candidate_id === candidate.candidate_id),
        technique_registry_hash: await hashFile(techniquePath),
        preference_snapshot_hash: await preferenceSnapshotHash(manifest),
        treatment_lane: manifest.treatment_lane,
        maximum_cost_gbp: 15,
      })
    })

  visualPlan.command('import')
    .requiredOption('--job <jobId>')
    .requiredOption('--candidate <path>')
    .requiredOption('--input <path>', 'VisualNarrativePlanV1 JSON')
    .option('--proven-treatment', 'apply reduced review requirements for an unchanged proven treatment')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      const candidate = CandidateV1Schema.parse(await readJson(options.candidate))
      const candidateHash = candidateSemanticHash(candidate)
      if (candidate.job_id !== manifest.job_id) throw new Error('candidate belongs to a different job')
      await assertCandidateIsCurrent(manifest.job_id, candidate)
      if (!hasApprovalV2(manifest, 'angle', candidateHash, 'krish')) throw new Error('exact angle approval from Krish is required before visual planning')
      const rightsIssues = sourceRightsIssues(manifest)
      if (rightsIssues.length) {
        await blockStageV2(manifest.job_id, 'visual_plan', rightsIssues.join('; '))
        throw new Error(`hard rights or consent block cannot be overridden: ${rightsIssues.join('; ')}`)
      }
      const analysisArtifact = await readStageArtifactV2(options.job, 'source_analysis')
      const claimsArtifact = await readStageArtifactV2<ClaimsStagePayloadV2>(options.job, 'claims')
      const candidatesArtifact = await readStageArtifactV2(options.job, 'candidates')
      const expectedClaimLedger = buildClaimLedger(manifest, candidatesArtifact.artifact_hash, candidatesInPayload(candidatesArtifact.payload))
      if (hashValue(claimsArtifact.payload) !== hashValue(expectedClaimLedger)) throw new Error('claim ledger does not exactly match the current candidate artifact')
      const analysis = analysisArtifact.payload as Parameters<typeof solveVisualPlanCameras>[1]
      const techniquePath = pinnedTechniqueRegistryPathV2(manifest)
      if (!techniquePath) throw new Error('job has no pinned technique registry')
      const techniqueRegistry = await loadTechniqueRegistry(techniquePath)
      const techniqueRegistryHash = await hashFile(techniquePath)
      const preferencesHash = await preferenceSnapshotHash(manifest)
      const reviewed = reviewVisualPlan({
        plan: await readJson(options.input),
        analysis,
        sourceAnalysisArtifactHash: analysisArtifact.artifact_hash,
        candidateHash,
        claimsArtifactHash: claimsArtifact.artifact_hash,
        techniqueRegistry,
        techniqueRegistryHash,
        preferenceSnapshotHash: preferencesHash,
        production: manifest.purpose === 'production',
        provenTreatment: Boolean(options.provenTreatment),
      })
      const candidateClaimIds = new Set(claimsArtifact.payload.claims.filter((claim) => claim.candidate_id === candidate.candidate_id).map((claim) => claim.claim_id))
      const referencedClaimIds = new Set([
        ...reviewed.plan.beats.flatMap((beat) => beat.claim_ids),
        ...reviewed.plan.asset_requirements.flatMap((requirement) => requirement.claim_ids),
      ])
      const unknownClaims = [...referencedClaimIds].filter((claimId) => !candidateClaimIds.has(claimId))
      if (unknownClaims.length) reviewed.review.hard_blocks.push(`visual plan references claims outside the approved candidate ledger: ${unknownClaims.join(', ')}`)
      if (reviewed.plan.job_id !== manifest.job_id || reviewed.plan.candidate_id !== candidate.candidate_id) throw new Error('visual plan job or candidate does not match')
      if (reviewed.plan.treatment_lane !== manifest.treatment_lane) throw new Error('visual plan treatment lane does not match the job')
      if (reviewed.review.hard_blocks.length) {
        await blockStageV2(options.job, 'visual_plan', reviewed.review.hard_blocks.join('; '))
        throw new Error(`hard block cannot be overridden in the visual plan: ${reviewed.review.hard_blocks.join('; ')}`)
      }
      const solved = solveVisualPlanCameras(VisualNarrativePlanV1Schema.parse({ ...reviewed.plan, editorial_review: reviewed.review }), analysis)
      const artifact = await completeStageV2(options.job, 'visual_plan', solved, { source_analysis: analysisArtifact.artifact_hash, candidate: candidateHash, claims: claimsArtifact.artifact_hash, techniques: techniqueRegistryHash, preferences: preferencesHash }, { visual_director: V2_CLI_VERSION })
      const reviewPath = join(jobPath(options.job), 'reviews', 'visual-plan', `${artifact.artifact_hash}.json`)
      await writeJson(reviewPath, { artifact_hash: artifact.artifact_hash, ...reviewed.review })
      context.out({
        job_id: options.job,
        artifact_hash: artifact.artifact_hash,
        plan: solved,
        review: reviewed.review,
        review_path: reviewPath,
        next_gate: reviewed.review.soft_blocks.length
          ? `studio v2 approve --job ${options.job} --gate visual_plan --artifact ${artifact.artifact_hash} --decision override --reason <editorial reason> --confirmation-ref "studio-user-confirmation:<client>:visual_plan:${artifact.artifact_hash}:<exact Krish approval message>"`
          : `studio v2 approve --job ${options.job} --gate visual_plan --artifact ${artifact.artifact_hash} --confirmation-ref "studio-user-confirmation:<client>:visual_plan:${artifact.artifact_hash}:<exact Krish approval message>"`,
      })
    })

  const assets = v2.command('assets')
  assets.command('prepare')
    .requiredOption('--job <jobId>')
    .requiredOption('--assets <path>', 'VisualAssetV1 JSON object, array, or {assets: []}')
    .option('--generated-shots <path>', 'GeneratedShotV1 JSON object, array, or {generated_shots: []}')
    .option('--evidence-overlays <path>', 'orchestrated evidence-overlay JSON with source-quality assessments')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      if (!v2RunnableStages(manifest.stages, manifest.mode).includes('assets')) throw new Error('assets stage prerequisites are not complete or evidence preparation is out of order')
      const visualPlanArtifact = await readStageArtifactV2<VisualNarrativePlanV1>(options.job, 'visual_plan')
      if (!hasApprovalV2(manifest, 'visual_plan', visualPlanArtifact.artifact_hash, 'krish')) throw new Error('exact visual plan approval from Krish is required before evidence preparation')
      const rawAssets = await readJson(options.assets) as unknown
      const assetValues = Array.isArray(rawAssets) ? rawAssets : (rawAssets as { assets?: unknown[] }).assets || [rawAssets]
      const parsedAssets = assetValues.map((asset) => VisualAssetV1Schema.parse(asset))
      const rawShots = options.generatedShots ? await readJson(options.generatedShots) as unknown : []
      const shotValues = Array.isArray(rawShots) ? rawShots : (rawShots as { generated_shots?: unknown[] }).generated_shots || [rawShots]
      const parsedShots = shotValues.map((shot) => GeneratedShotV1Schema.parse(shot))
      const plan = VisualNarrativePlanV1Schema.parse(visualPlanArtifact.payload)
      const claimsArtifact = await readStageArtifactV2<ClaimsStagePayloadV2>(options.job, 'claims')
      if (plan.claims_artifact_hash !== claimsArtifact.artifact_hash) throw new Error('visual plan is not bound to the current claim ledger')
      const requirements = new Map(plan.asset_requirements.map((item) => [item.asset_id, item]))
      const resolved = new Map(plan.resolved_assets.map((item) => [item.asset_id, item]))
      if (new Set(parsedAssets.map((asset) => asset.asset_id)).size !== parsedAssets.length) throw new Error('evidence packet asset IDs must be unique')
      if (new Set(parsedShots.map((shot) => shot.generated_shot_id)).size !== parsedShots.length) throw new Error('generated shot IDs must be unique')
      const providedIds = new Set(parsedAssets.map((asset) => asset.asset_id))
      const missingRequired = plan.asset_requirements.filter((requirement) => requirement.required && !providedIds.has(requirement.asset_id))
      if (missingRequired.length) throw new Error(`required visual assets are unresolved: ${missingRequired.map((item) => item.asset_id).join(', ')}`)
      const generatedCost = parsedShots.reduce((total, shot) => total + shot.cost_gbp, 0)
      if (generatedCost > plan.budget.maximum_cost_gbp) throw new Error(`hard block: generated media cost GBP ${generatedCost.toFixed(2)} exceeds the approved GBP ${plan.budget.maximum_cost_gbp.toFixed(2)} ceiling`)
      for (const asset of parsedAssets) {
        const requirement = requirements.get(asset.asset_id)
        const planned = resolved.get(asset.asset_id)
        if (!requirement && !planned) throw new Error(`asset ${asset.asset_id} is not part of the approved visual plan`)
        if (requirement && (requirement.content_kind !== asset.content_kind || requirement.truth_role !== asset.truth_role)) throw new Error(`asset ${asset.asset_id} changes its approved content kind or truth role`)
        if (planned && (planned.path !== asset.path || planned.sha256 !== asset.sha256)) throw new Error(`asset ${asset.asset_id} differs from the exact asset in the approved visual plan`)
        if (await hashFile(resolve(asset.path)) !== asset.sha256) throw new Error(`asset ${asset.asset_id} hash does not match its file`)
      }
      for (const shot of parsedShots) {
        if (shot.job_id !== manifest.job_id) throw new Error(`generated shot ${shot.generated_shot_id} belongs to a different job`)
        if (await hashFile(resolve(shot.output_path)) !== shot.output_hash) throw new Error(`generated shot ${shot.generated_shot_id} hash does not match its file`)
        const disclosures = new Set(shot.disclosure.map((item) => item.platform))
        for (const platform of manifest.target_platforms) if (!disclosures.has(platform)) throw new Error(`generated shot ${shot.generated_shot_id} lacks a ${platform} disclosure decision`)
        if (!parsedAssets.some((asset) => asset.sha256 === shot.output_hash && asset.generated)) throw new Error(`generated shot ${shot.generated_shot_id} is missing from the visual asset ledger`)
      }
      const evidenceAssets = parsedAssets.filter((asset) => asset.truth_role === 'evidence')
      const evidenceBindingIssues = evidenceClaimUrlIssues(plan.asset_requirements, parsedAssets, claimsArtifact.payload.claims, plan.candidate_id)
      if (evidenceBindingIssues.length) throw new Error(`hard evidence provenance block: ${evidenceBindingIssues.join('; ')}`)
      let editorialEvidence: EvidenceReviewPacketV2['editorial_evidence']
      if (evidenceAssets.length) {
        if (!options.evidenceOverlays) throw new Error('evidence assets require --evidence-overlays so Krish can approve source quality, headline choice, timing, and placement from a contact sheet')
        const rawOverlays = await readJson(options.evidenceOverlays) as unknown
        const overlays = Array.isArray(rawOverlays) ? rawOverlays : (rawOverlays as { overlays?: unknown[] }).overlays || [rawOverlays]
        const overlayPaths = new Set(overlays.flatMap((value) => value && typeof value === 'object' && typeof (value as { asset_path?: unknown }).asset_path === 'string' ? [resolve((value as { asset_path: string }).asset_path)] : []))
        const missingEvidence = evidenceAssets.filter((asset) => !overlayPaths.has(resolve(asset.path)))
        if (missingEvidence.length) throw new Error(`every evidence asset needs a source-assessed screen placement: ${missingEvidence.map((asset) => asset.asset_id).join(', ')}`)
        for (const overlay of overlays) {
          if (!overlay || typeof overlay !== 'object' || typeof (overlay as { asset_path?: unknown }).asset_path !== 'string') throw new Error('every evidence overlay requires an asset_path')
          const matching = evidenceAssets.find((asset) => resolve(asset.path) === resolve((overlay as { asset_path: string }).asset_path))
          if (!matching) throw new Error(`evidence overlay references an unapproved-plan asset: ${(overlay as { asset_path: string }).asset_path}`)
          if (matching.media_kind !== 'image') throw new Error(`evidence asset ${matching.asset_id} must be rendered to an exact reviewable screenshot before approval`)
          const overlaySourceUrl = (overlay as { source_url?: unknown }).source_url
          if (matching.source_url !== overlaySourceUrl) throw new Error(`evidence overlay source URL does not match asset ${matching.asset_id}`)
          const overlayAttribution = (overlay as { attribution?: unknown }).attribution
          if (matching.attribution !== overlayAttribution) throw new Error(`evidence overlay attribution does not match asset ${matching.asset_id}`)
          if (await hashFile(matching.path) !== matching.sha256) throw new Error(`evidence asset ${matching.asset_id} changed before editorial review`)
        }
        const prepared = await prepareEvidenceApprovalPacket({
          jobId: manifest.job_id,
          candidateHash: plan.candidate_hash,
          overlays,
          durationMs: plan.duration_ms,
          strategySummary: plan.strategy_summary,
          endingReturnToPresenter: true,
        })
        editorialEvidence = {
          packet_path: prepared.packetPath,
          packet_hash: prepared.packetHash,
          contact_sheet_path: prepared.packet.contact_sheet_path,
          contact_sheet_hash: prepared.packet.contact_sheet_sha256,
        }
      } else if (options.evidenceOverlays) {
        throw new Error('--evidence-overlays was supplied but the approved visual plan contains no evidence assets')
      }
      const packetSemantic = {
        schema_version: 2 as const,
        job_id: manifest.job_id,
        visual_plan_artifact_hash: visualPlanArtifact.artifact_hash,
        assets: parsedAssets.map((asset) => ({ ...asset, approval: { state: 'unreviewed' as const } })),
        generated_shots: parsedShots.map((shot) => ({ ...shot, exact_approval: { state: 'unreviewed' as const } })),
        ...(editorialEvidence ? { editorial_evidence: editorialEvidence } : {}),
      }
      const packet: EvidenceReviewPacketV2 = { ...packetSemantic, packet_id: `evidence-${hashValue(packetSemantic).slice(0, 16)}` }
      const packetPath = join(jobPath(options.job), 'reviews', 'evidence', `${packet.packet_id}.json`)
      await writeJsonAtomic(packetPath, packet)
      const packetHash = await hashFile(packetPath)
      await writeJsonAtomic(join(jobPath(options.job), 'reviews', 'evidence', 'current.json'), {
        schema_version: 2,
        job_id: manifest.job_id,
        packet_path: packetPath,
        packet_hash: packetHash,
        visual_plan_artifact_hash: visualPlanArtifact.artifact_hash,
      } satisfies CurrentEvidencePacketRefV2)
      context.out({
        job_id: options.job,
        packet_path: packetPath,
        packet_hash: packetHash,
        assets: packet.assets,
        generated_shots: packet.generated_shots,
        ...(packet.editorial_evidence ? { contact_sheet_path: packet.editorial_evidence.contact_sheet_path, source_quality_packet_path: packet.editorial_evidence.packet_path } : {}),
        next_gate: `studio v2 approve --job ${options.job} --gate evidence --artifact "${packetPath}" --confirmation-ref "studio-user-confirmation:<client>:evidence:${packetHash}:<exact Krish approval message>"`,
      })
    })

  assets.command('verify')
    .requiredOption('--job <jobId>')
    .requiredOption('--packet <path>', 'exact evidence packet approved by Krish')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      const currentEvidence = await assertCurrentEvidenceApprovalPacketV2(manifest, options.packet)
      const { packet, packetHash } = currentEvidence
      if (!hasApprovalV2(manifest, 'evidence', packetHash, 'krish')) throw new Error('the exact evidence packet does not have Krish approval')
      const visualPlanArtifact = await readStageArtifactV2<VisualNarrativePlanV1>(options.job, 'visual_plan')
      if (packet.visual_plan_artifact_hash !== currentEvidence.visualPlanArtifactHash || visualPlanArtifact.artifact_hash !== currentEvidence.visualPlanArtifactHash) throw new Error('evidence packet belongs to a different visual plan revision')
      const approval = [...manifest.approvals].reverse().find((item) => item.gate === 'evidence' && item.artifact_hash === packetHash && item.actor === 'krish' && ['approved', 'override'].includes(item.decision))
      if (!approval) throw new Error('the exact evidence packet does not have Krish approval')
      const approvedAssets = packet.assets.map((asset) => ({ ...asset, approval: { state: 'approved' as const, approved_by: 'Krish' as const, approved_at: approval.occurred_at, artifact_hash: asset.sha256 } }))
      const approvedShots = packet.generated_shots.map((shot) => ({ ...shot, exact_approval: { state: 'approved' as const, approved_by: 'Krish' as const, approved_at: approval.occurred_at, output_hash: shot.output_hash } }))
      const plan = VisualNarrativePlanV1Schema.parse({ ...visualPlanArtifact.payload, resolved_assets: approvedAssets })
      const verdict = await verifyVisualAssets(plan)
      if (!verdict.passed) {
        await blockStageV2(options.job, 'assets', verdict.hard_blocks.join('; '))
        throw new Error(`hard block cannot be overridden for evidence: ${verdict.hard_blocks.join('; ')}`)
      }
      const artifact = await completeStageV2(options.job, 'assets', {
        visual_plan_artifact_hash: visualPlanArtifact.artifact_hash,
        assets: approvedAssets,
        generated_shots: approvedShots,
        ...(packet.editorial_evidence ? { editorial_evidence: packet.editorial_evidence } : {}),
      }, { visual_plan: visualPlanArtifact.artifact_hash, evidence_packet: packetHash }, { asset_verifier: V2_CLI_VERSION })
      context.out({ job_id: options.job, artifact_hash: artifact.artifact_hash, verified_asset_hashes: verdict.verified_hashes, generated_shot_hashes: approvedShots.map((shot) => shot.output_hash) })
    })

  const styleframes = v2.command('styleframes')
  styleframes.command('create')
    .requiredOption('--job <jobId>')
    .requiredOption('--manifest <path>', 'review RenderManifestV2 JSON')
    .requiredOption('--at <milliseconds...>', 'at least three frame times in milliseconds')
    .action(async (options) => {
      const job = await loadJobV2(options.job)
      const visualPlan = await readStageArtifactV2<VisualNarrativePlanV1>(job.job_id, 'visual_plan')
      if (!hasApprovalV2(job, 'visual_plan', visualPlan.artifact_hash, 'krish')) throw new Error('exact visual plan approval from Krish is required before styleframes')
      const assetsArtifact = await readStageArtifactV2<{ assets: VisualAssetV1[]; generated_shots: GeneratedShotV1[] }>(job.job_id, 'assets')
      const { manifest, manifestHash } = await loadReviewManifest(job, options.manifest)
      const frameTimes = options.at.map((value: string) => Number(value))
      if (frameTimes.some((value: number) => !Number.isFinite(value))) throw new Error('--at values must be integer milliseconds')
      const rendered = await renderV2Styleframes(context.repoRoot, manifest, frameTimes)
      const plan = VisualNarrativePlanV1Schema.parse(visualPlan.payload)
      const frames = rendered.map((frame, index) => {
        const beat = plan.beats.find((item) => item.start_ms <= frame.at_ms && item.end_ms > frame.at_ms) || plan.beats.at(-1)!
        return {
          frame_id: `styleframe-${index + 1}-${frame.image_hash.slice(0, 8)}`,
          beat_id: beat.beat_id,
          at_ms: frame.at_ms,
          image_path: frame.image_path,
          image_hash: frame.image_hash,
          pixel_width: 1080,
          pixel_height: 1920,
          phone_preview_path: frame.phone_preview_path,
          phone_preview_hash: frame.phone_preview_hash,
          asset_hashes: exactAssetHashes(assetsArtifact.payload),
          primary_attention_target: beat.primary_attention_target,
          legibility: { passed: true, notes: ['Automated full-size and phone-size frames rendered successfully. Krish visual approval is still required.'] },
        }
      })
      const packetCore = {
        schema_version: 1 as const,
        job_id: job.job_id,
        visual_plan_artifact_hash: visualPlan.artifact_hash,
        created_at: visualPlan.created_at,
        exact_asset_hashes: exactAssetHashes(assetsArtifact.payload),
        review_kind: 'styleframes' as const,
        styleframes: frames,
      }
      const packet = StoryboardReviewPacketV1Schema.parse({ ...packetCore, packet_id: `styleframes-${hashValue(packetCore).slice(0, 16)}` })
      const rendererHash = await rendererImplementationHashV2(context.repoRoot)
      const artifact = await completeStageV2(job.job_id, 'styleframes', packet, { visual_plan: visualPlan.artifact_hash, assets: assetsArtifact.artifact_hash, manifest: manifestHash }, { renderer: rendererHash, profile: 'styleframes' })
      context.out({ job_id: job.job_id, artifact_hash: artifact.artifact_hash, packet, next_gate: `studio v2 approve --job ${job.job_id} --gate storyboard --artifact ${artifact.artifact_hash} --confirmation-ref "studio-user-confirmation:<client>:storyboard:${artifact.artifact_hash}:<exact Krish approval message>"` })
    })

  const animatic = v2.command('animatic')
  animatic.command('create')
    .requiredOption('--job <jobId>')
    .requiredOption('--manifest <path>', 'RenderManifestV2 JSON bound to the approved storyboard')
    .action(async (options) => {
      const job = await loadJobV2(options.job)
      const styleframeArtifact = await readStageArtifactV2<StoryboardReviewPacketV1>(job.job_id, 'styleframes')
      if (!hasApprovalV2(job, 'storyboard', styleframeArtifact.artifact_hash, 'krish')) throw new Error('exact storyboard approval from Krish is required before the animatic')
      await verifyReviewPacketFiles(styleframeArtifact.payload)
      const assetsArtifact = await readStageArtifactV2<{ assets: VisualAssetV1[]; generated_shots: GeneratedShotV1[] }>(job.job_id, 'assets')
      const { manifest, manifestHash } = await loadReviewManifest(job, options.manifest, styleframeArtifact.artifact_hash)
      const animaticPath = await renderV2Animatic(context.repoRoot, manifest)
      const [animaticHash, probe] = await Promise.all([hashFile(animaticPath), probeMedia(animaticPath)])
      const styleframePacket = StoryboardReviewPacketV1Schema.parse(styleframeArtifact.payload)
      if (styleframePacket.review_kind !== 'styleframes') throw new Error('current styleframes artifact is not a styleframe packet')
      const packetCore = {
        schema_version: 1 as const,
        job_id: job.job_id,
        visual_plan_artifact_hash: styleframePacket.visual_plan_artifact_hash,
        created_at: styleframeArtifact.created_at,
        exact_asset_hashes: exactAssetHashes(assetsArtifact.payload),
        review_kind: 'animatic' as const,
        styleframes: styleframePacket.styleframes,
        animatic: {
          path: animaticPath,
          sha256: animaticHash,
          duration_ms: Math.round(probe.duration_seconds * 1000),
          width: probe.width,
          height: probe.height,
          fps: probe.average_fps,
          includes_audio: probe.audio_hz !== null,
        },
      }
      const packet = StoryboardReviewPacketV1Schema.parse({ ...packetCore, packet_id: `animatic-${hashValue(packetCore).slice(0, 16)}` })
      const rendererHash = await rendererImplementationHashV2(context.repoRoot)
      const artifact = await completeStageV2(job.job_id, 'animatic', packet, { styleframes: styleframeArtifact.artifact_hash, manifest: manifestHash }, { renderer: rendererHash, profile: 'animatic' })
      context.out({ job_id: job.job_id, artifact_hash: artifact.artifact_hash, packet, next_gate: `studio v2 approve --job ${job.job_id} --gate animatic --artifact ${artifact.artifact_hash} --confirmation-ref "studio-user-confirmation:<client>:animatic:${artifact.artifact_hash}:<exact Krish approval message>"` })
    })

  const treatment = v2.command('treatment')
  treatment.command('register')
    .requiredOption('--job <jobId>')
    .requiredOption('--manifest <platformEqualsPath...>', 'one platform=RenderManifestV2 path for every target')
    .action(async (options) => {
      const job = await loadJobV2(options.job)
      const animaticArtifact = await readStageArtifactV2(job.job_id, 'animatic')
      if (!hasApprovalV2(job, 'animatic', animaticArtifact.artifact_hash, 'krish')) throw new Error('exact animatic approval from Krish is required before treatment registration')
      await verifyReviewPacketFiles(animaticArtifact.payload)
      const styleframeHash = currentArtifactHash(job, 'styleframes')
      const manifestEntries = parseRecord(options.manifest, '--manifest')
      const manifests: TreatmentPayload['manifests'] = []
      for (const [platformInput, path] of Object.entries(manifestEntries)) {
        const platform = VideoPlatformV1Schema.parse(platformInput)
        const reviewed = await loadReviewManifest(job, path, styleframeHash)
        if (reviewed.manifest.target_platform !== platform) throw new Error(`manifest key ${platform} does not match its target platform`)
        manifests.push({ platform, manifest_path: resolve(path), manifest_hash: reviewed.manifestHash })
      }
      if (hashValue(manifests.map((item) => item.platform).sort()) !== hashValue([...job.target_platforms].sort())) throw new Error('treatment registration requires exactly one manifest for every target platform')
      const payload: TreatmentPayload = { manifests: manifests.sort((left, right) => left.platform.localeCompare(right.platform)) }
      const artifact = await completeStageV2(job.job_id, 'treatment', payload, { animatic: animaticArtifact.artifact_hash, manifests: hashValue(payload) }, { registrar: V2_CLI_VERSION })
      context.out({ job_id: job.job_id, artifact_hash: artifact.artifact_hash, manifests: payload.manifests, preview_command: `studio v2 render --job ${job.job_id} --profile preview`, next_gate: `studio v2 approve --job ${job.job_id} --gate treatment --artifact ${artifact.artifact_hash} --confirmation-ref "studio-user-confirmation:<client>:treatment:${artifact.artifact_hash}:<exact Krish approval message>"` })
    })

  v2.command('render')
    .requiredOption('--job <jobId>')
    .option('--profile <profile>', 'master or preview', 'master')
    .option('--platform <platform>', 'preview a single target platform')
    .option('--preview-seconds <number>', 'preview duration', '6')
    .action(async (options) => {
      if (!['master', 'preview'].includes(options.profile)) throw new Error('--profile must be master or preview')
      const job = await loadJobV2(options.job)
      if (job.purpose === 'calibration' && options.profile === 'master') throw new Error('calibration jobs are analysis-only and cannot create final renders')
      const treatment = await readStageArtifactV2<TreatmentPayload>(job.job_id, 'treatment')
      if (options.profile === 'master' && !hasApprovalV2(job, 'treatment', treatment.artifact_hash, 'krish')) throw new Error('exact treatment approval from Krish is required before final rendering')
      const selectedPlatform = options.platform ? VideoPlatformV1Schema.parse(options.platform) : undefined
      if (selectedPlatform && options.profile === 'master') throw new Error('--platform is preview-only because a complete master stage must render every target platform')
      const previewSeconds = Number(options.previewSeconds)
      if (options.profile === 'preview' && (!Number.isFinite(previewSeconds) || previewSeconds <= 0)) throw new Error('--preview-seconds must be a positive number')
      const selected = selectedPlatform ? treatment.payload.manifests.filter((item) => item.platform === selectedPlatform) : treatment.payload.manifests
      if (!selected.length) throw new Error('no treatment manifest matches the requested platform')
      const rendererHash = await rendererImplementationHashV2(context.repoRoot)
      const tools = { renderer: rendererHash, remotion: '4.0.518', profile: options.profile }
      if (options.profile === 'master') {
        const reusable = await readReusableStageV2<RenderPayload>(job.job_id, 'render', { treatment: treatment.artifact_hash }, tools)
        if (reusable) {
          await verifyRenderPayload(reusable.payload)
          for (const rendered of reusable.payload.renders) {
            const manifest = RenderManifestV2Schema.parse(await readJson(rendered.manifest_path))
            await assertCurrentRenderLineage(job, manifest)
          }
          context.out({ job_id: job.job_id, artifact_hash: reusable.artifact_hash, renders: reusable.payload.renders, reused: true })
          return
        }
      }
      const rendered: RenderPayload['renders'] = []
      for (const item of selected) {
        if (await hashFile(resolve(item.manifest_path)) !== item.manifest_hash) throw new Error(`treatment manifest changed for ${item.platform}`)
        const manifest = RenderManifestV2Schema.parse(await readJson(item.manifest_path))
        await assertCurrentRenderLineage(job, manifest)
        const masterPath = await renderStoryV2(context.repoRoot, manifest, options.profile === 'preview'
          ? { profile: 'preview', previewDurationMs: previewSeconds * 1000, previewScale: 0.5 }
          : { profile: 'master' })
        rendered.push({ platform: item.platform, master_path: masterPath, master_hash: await hashFile(masterPath), manifest_path: resolve(item.manifest_path), manifest_hash: item.manifest_hash })
      }
      if (options.profile === 'preview') {
        context.out({ job_id: job.job_id, profile: 'preview', renders: rendered, next_gate: `studio v2 approve --job ${job.job_id} --gate treatment --artifact ${treatment.artifact_hash} --confirmation-ref "studio-user-confirmation:<client>:treatment:${treatment.artifact_hash}:<exact Krish approval message>"` })
        return
      }
      if (hashValue(rendered.map((item) => item.platform).sort()) !== hashValue([...job.target_platforms].sort())) throw new Error('master render must produce every target platform')
      const artifact = await completeStageV2(job.job_id, 'render', { renders: rendered }, { treatment: treatment.artifact_hash }, tools)
      context.out({ job_id: job.job_id, artifact_hash: artifact.artifact_hash, renders: rendered, next_step: `studio v2 qa --job ${job.job_id}` })
    })

  v2.command('qa')
    .requiredOption('--job <jobId>')
    .option('--force', 'repeat media analysis even when the current render already has a validated QA artifact')
    .action(async (options) => {
      const job = await loadJobV2(options.job)
      const renderArtifact = await readStageArtifactV2<RenderPayload>(job.job_id, 'render')
      const lineageManifests = new Map<VideoPlatformV1, RenderManifestV2>()
      for (const rendered of renderArtifact.payload.renders) {
        if (await hashFile(resolve(rendered.manifest_path)) !== rendered.manifest_hash) throw new Error(`render manifest changed for ${rendered.platform}`)
        const manifest = RenderManifestV2Schema.parse(await readJson(rendered.manifest_path))
        await assertCurrentRenderLineage(job, manifest)
        lineageManifests.set(rendered.platform, manifest)
      }
      const qaTools = { qa: 'visual-story-director-qa-v2' }
      const reusable = options.force ? null : await readReusableStageV2(job.job_id, 'qa', { render: renderArtifact.artifact_hash }, qaTools)
      if (reusable) {
        await verifyRenderPayload(renderArtifact.payload)
        context.out({ job_id: job.job_id, artifact_hash: reusable.artifact_hash, ...(reusable.payload as Record<string, unknown>), reused: true })
        if (!qaPassed(reusable.payload)) process.exitCode = 20
        return
      }
      const results = []
      for (const rendered of renderArtifact.payload.renders) {
        const manifest = lineageManifests.get(rendered.platform)
        if (!manifest) throw new Error(`render manifest is unavailable for ${rendered.platform}`)
        const [actualHash, probe, loudness, frameHashes] = await Promise.all([
          hashFile(rendered.master_path),
          probeMedia(rendered.master_path),
          analyzeLoudness(rendered.master_path),
          framePerceptualHashes(rendered.master_path),
        ])
        const readiness = validateV2RenderReadiness(manifest)
        const pinnedRegistry = await loadPinnedRenderRegistryV2(manifest)
        const brandTheme = manifest.branding.mode === 'series'
          ? pinnedRegistry.brand_themes.find((theme) => theme.theme_id === manifest.branding.theme_id && theme.version === manifest.branding.theme_version && hashValue(theme) === manifest.branding.theme_hash)
          : undefined
        const brandFailures: string[] = []
        const brandWarnings: string[] = []
        if (manifest.branding.mode === 'series') {
          const brandGeometry = await loadExactBrandGeometryContextV2(manifest)
          if (!brandTheme) brandFailures.push('manifest brand theme does not match the exact job-pinned active theme')
          else {
            const report = brandWordmarkLegibilityReport(brandTheme)
            brandFailures.push(...report.failures, ...brandLayerCollisionIssues(manifest, brandTheme, brandGeometry))
            brandWarnings.push(...report.warnings)
          }
        }
        const checks = [
          { name: 'master_hash', passed: actualHash === rendered.master_hash, detail: actualHash },
          { name: 'dimensions', passed: probe.width === 1080 && probe.height === 1920, detail: `${probe.width}x${probe.height}` },
          { name: 'frame_rate', passed: Math.abs(probe.average_fps - 30) < 0.01, detail: `${probe.average_fps.toFixed(3)} fps` },
          { name: 'audio_rate', passed: probe.audio_hz === 48_000, detail: `${probe.audio_hz ?? 'missing'} Hz` },
          { name: 'duration', passed: Math.abs(probe.duration_seconds * 1000 - manifest.duration_ms) <= 150, detail: `${probe.duration_seconds.toFixed(3)} seconds` },
          { name: 'integrated_loudness', passed: loudness.integrated_lufs !== null && Math.abs(loudness.integrated_lufs + 14) <= 1, detail: `${loudness.integrated_lufs ?? 'unmeasured'} LUFS` },
          { name: 'true_peak', passed: loudness.true_peak_dbtp !== null && loudness.true_peak_dbtp <= -0.8, detail: `${loudness.true_peak_dbtp ?? 'unmeasured'} dBTP` },
          { name: 'manifest_readiness', passed: readiness.length === 0, detail: readiness.length ? readiness.join('; ') : 'passed' },
          {
            name: 'brand_wordmark_legibility',
            passed: brandFailures.length === 0,
            status: brandFailures.length ? 'fail' : brandWarnings.length ? 'warn' : 'pass',
            detail: brandFailures.length ? brandFailures.join('; ') : brandWarnings.length ? brandWarnings.join('; ') : manifest.branding.mode === 'series' ? 'official responsive wordmarks are legible and safely placed' : 'not applicable to unbranded calibration',
          },
        ]
        results.push({ platform: rendered.platform, passed: checks.every((check) => check.passed), checks, functional_fingerprint: { frame_ahashes: frameHashes, integrated_lufs: loudness.integrated_lufs, true_peak_dbtp: loudness.true_peak_dbtp } })
      }
      const payload = { passed: results.length === job.target_platforms.length && results.every((item) => item.passed), results, checked_at: new Date().toISOString() }
      const artifact = await completeStageV2(job.job_id, 'qa', payload, { render: renderArtifact.artifact_hash }, qaTools)
      context.out({ job_id: job.job_id, artifact_hash: artifact.artifact_hash, ...payload })
      if (!payload.passed) process.exitCode = 20
    })

  v2.command('approve')
    .requiredOption('--job <jobId>')
    .requiredOption('--gate <gate>')
    .requiredOption('--artifact <hashOrPath>')
    .option('--decision <decision>', 'approved, rejected, or override', 'approved')
    .option('--reason <reason>')
    .option('--actor <actor>', 'krish, codex, or system', 'krish')
    .option('--confirmation-ref <reference>', 'artifact-bound user-confirmation receipt from the studio client for a positive Krish decision')
    .action(async (options) => {
      const gate = ApprovalGateV2Schema.parse(options.gate)
      if (!['approved', 'rejected', 'override'].includes(options.decision)) throw new Error('decision must be approved, rejected, or override')
      assertKrishDecision(options.actor, options.decision)
      const manifest = await loadJobV2(options.job)
      let artifactHash = gate === 'evidence' ? '' : await resolveApprovalArtifactHash(options.artifact)
      let evidenceBindingHash: string | undefined
      if (gate === 'angle') {
        if (SHA256.test(options.artifact)) throw new Error('angle approval requires the path to the exact CandidateV1 JSON')
        const candidate = CandidateV1Schema.parse(await readJson(options.artifact))
        if (candidate.job_id !== manifest.job_id) throw new Error('candidate belongs to a different job')
        await assertCandidateIsCurrent(manifest.job_id, candidate)
        artifactHash = candidateSemanticHash(candidate)
        const config = await readJson<PinnedStudioConfigV2>(pinnedConfigPathV2(manifest))
        if (!config.editorial_thresholds) throw new Error('job-pinned configuration is missing editorial_thresholds')
        const independentEditorial = manifest.mode === 'short_native'
          ? validateShortNativeEditorialCandidate(candidate, config.editorial_thresholds, manifest.presenter_name)
          : validateEditorialCandidate(
              candidate,
              parseTranscriptDocument((await readStageArtifactV2<TranscriptStagePayloadV2>(manifest.job_id, 'transcript')).payload.transcript),
              candidateCompatibilityJob(manifest),
              config.editorial_thresholds,
            )
        const hardBlocks = [
          ...candidate.challenge.hard_blocks,
          ...independentEditorial.hard_blocks,
          ...independentClaimIssues(candidate),
          ...(manifest.source_bundle ? sourceRightsIssues(manifest) : []),
        ]
        if (hardBlocks.length && options.decision !== 'rejected') throw new Error(`hard editorial block cannot be overridden: ${[...new Set(hardBlocks)].join('; ')}`)
        if (candidate.challenge.soft_blocks.length && options.decision === 'approved') throw new Error('soft editorial blocks require --decision override and a recorded --reason')
      }
      if (gate === 'evidence') {
        if (SHA256.test(options.artifact)) throw new Error('evidence approval requires the exact packet path so files and rights can be reverified')
        evidenceBindingHash = (await assertCurrentEvidenceApprovalPacketV2(manifest, options.artifact)).packetHash
        artifactHash = evidenceBindingHash
      }
      const gatedStage: Partial<Record<typeof gate, StageNameV2>> = { visual_plan: 'visual_plan', storyboard: 'styleframes', animatic: 'animatic', treatment: 'treatment', package: 'package' }
      const stage = gatedStage[gate]
      const currentGateBinding = gate === 'evidence' ? evidenceBindingHash : stage ? currentArtifactHash(manifest, stage) : undefined
      if (currentGateBinding && artifactHash !== currentGateBinding) throw new Error(`${gate} approval must bind the current prepared artifact`)
      if (stage && ['storyboard', 'animatic'].includes(gate) && options.decision !== 'rejected') {
        const reviewArtifact = await readStageArtifactV2(manifest.job_id, stage)
        await verifyReviewPacketFiles(reviewArtifact.payload)
      }
      if (gate === 'visual_plan' && options.decision !== 'rejected') {
        const visualPlanArtifact = await readStageArtifactV2<VisualNarrativePlanV1>(manifest.job_id, 'visual_plan')
        const review = VisualNarrativePlanV1Schema.parse(visualPlanArtifact.payload).editorial_review
        if (!review) throw new Error('visual plan artifact has no immutable editorial review snapshot')
        if (review.hard_blocks.length) throw new Error(`hard block cannot be overridden in the visual plan: ${review.hard_blocks.join('; ')}`)
        if (review.soft_blocks.length && options.decision === 'approved') throw new Error('soft visual-plan blocks require --decision override and a recorded --reason')
      }
      if (gate === 'final') {
        const render = await readStageArtifactV2<RenderPayload>(options.job, 'render')
        if (!render.payload.renders.some((item) => item.master_hash === artifactHash)) throw new Error('final approval must bind an exact current rendered master hash')
        const qa = await readStageArtifactV2(options.job, 'qa')
        if (!qaPassed(qa.payload)) throw new Error('QA did not pass and cannot be overridden')
      }
      if (gate === 'package' && options.decision !== 'rejected') {
        const packageArtifact = await readStageArtifactV2<PackagePayload>(options.job, 'package')
        await verifyPackagePayload(packageArtifact.payload, manifest)
      }
      const updated = await recordApprovalV2(options.job, gate, options.decision, artifactHash, options.reason, options.actor, options.confirmationRef)
      const feedbackStage: Record<typeof gate, StageNameV2> = { angle: 'candidates', evidence: 'assets', visual_plan: 'visual_plan', storyboard: 'styleframes', animatic: 'animatic', treatment: 'treatment', final: 'render', package: 'package' }
      const feedbackKind: Record<typeof gate, FeedbackEventV2['artifact_kind']> = { angle: 'candidate', evidence: 'asset', visual_plan: 'visual_plan', storyboard: 'styleframe', animatic: 'animatic', treatment: 'treatment', final: 'render', package: 'approval' }
      const feedback = await captureFeedbackV2({
        jobId: options.job,
        artifactId: artifactHash,
        artifactKind: feedbackKind[gate],
        stage: feedbackStage[gate],
        action: options.decision === 'rejected' ? 'reject' : 'accept',
        origin: options.actor === 'krish' ? 'user' : options.actor,
        before: { artifact_hash: artifactHash },
        ...(options.reason ? { note: options.reason } : {}),
        scope: { level: 'job', key: options.job },
      })
      const feedbackPath = join(jobPath(options.job), 'feedback', `${feedback.feedback_id}.json`)
      await writeJson(feedbackPath, feedback)
      const feedbackHash = feedbackEventHashV2(feedback)
      context.out({
        job_id: options.job,
        gate,
        artifact_hash: artifactHash,
        decision: options.decision,
        approval_count: updated.approvals.length,
        feedback,
        feedback_path: feedbackPath,
        ...(feedback.confirmation === 'pending' ? { confirmation_prompt: feedback.inferred_rationale, next_step: `studio v2 feedback confirm --event "${feedbackPath}" --confirmation-ref "studio-user-confirmation:<client>:feedback:${feedbackHash}:<exact Krish confirmation message>"` } : {}),
      })
    })

  const feedback = v2.command('feedback')
  feedback.command('import')
    .requiredOption('--job <jobId>')
    .requiredOption('--artifact-id <id>')
    .requiredOption('--kind <kind>', FEEDBACK_KINDS.join(', '))
    .requiredOption('--stage <stage>')
    .requiredOption('--action <action>', 'accept, reject, revise, or praise')
    .requiredOption('--before <path>')
    .option('--after <path>')
    .option('--note <note>')
    .option('--srt <path>', 'accepted-final caption sidecar')
    .option('--edl <path>', 'accepted-final edit decision list')
    .option('--fcpxml <path>', 'accepted-final Final Cut XML')
    .option('--scope-level <level>', 'global, series, mode, treatment, platform, or job', 'job')
    .option('--scope-key <key>')
    .option('--origin <origin>', 'user, codex, or system', 'user')
    .action(async (options) => {
      const job = await loadJobV2(options.job)
      if (!FEEDBACK_KINDS.includes(options.kind)) throw new Error(`feedback kind must be one of: ${FEEDBACK_KINDS.join(', ')}`)
      if (!['accept', 'reject', 'revise', 'praise'].includes(options.action)) throw new Error('feedback action must be accept, reject, revise, or praise')
      if (!['user', 'codex', 'system'].includes(options.origin)) throw new Error('feedback origin must be user, codex, or system')
      if (!['global', 'series', 'mode', 'treatment', 'platform', 'job'].includes(options.scopeLevel)) throw new Error('invalid feedback scope')
      if (options.kind === 'external_final' && !options.after) throw new Error('external-final feedback requires --after with the exact accepted final')
      if (options.scopeLevel !== 'job' && !options.scopeKey) throw new Error('non-job feedback scopes require --scope-key')
      if (options.kind === 'external_final') {
        if (options.scopeLevel !== 'platform') throw new Error('external-final feedback must use --scope-level platform and --scope-key with its exact publishing platform')
        const feedbackPlatform = VideoPlatformV1Schema.parse(options.scopeKey)
        if (!job.target_platforms.includes(feedbackPlatform)) throw new Error('external-final feedback platform is not part of this job')
      }
      const before = await readFeedbackArtifact(context, job, options.before, 'before')
      const afterArtifact = options.after ? await readFeedbackArtifact(context, job, options.after, 'after') : undefined
      const sidecars: Record<string, string> = {}
      for (const kind of ['srt', 'edl', 'fcpxml'] as const) if (options[kind]) sidecars[kind] = await readFile(resolve(options[kind]), 'utf8')
      const after = afterArtifact === undefined ? undefined : Object.keys(sidecars).length ? { artifact: afterArtifact, sidecars } : afterArtifact
      const event = await captureFeedbackV2({
        jobId: job.job_id,
        artifactId: options.artifactId,
        artifactKind: options.kind,
        stage: StageNameV2Schema.parse(options.stage),
        action: options.action,
        origin: options.origin,
        before,
        ...(after === undefined ? {} : { after }),
        ...(options.note ? { note: options.note } : {}),
        scope: { level: options.scopeLevel, key: options.scopeKey || job.job_id },
        exactExternalFinal: options.kind === 'external_final',
      })
      const eventPath = join(jobPath(job.job_id), 'feedback', `${event.feedback_id}.json`)
      await writeJson(eventPath, event)
      const eventHash = feedbackEventHashV2(event)
      context.out({ feedback: event, event_path: eventPath, event_hash: eventHash, confirmation_prompt: event.inferred_rationale, next_step: `studio v2 feedback confirm --event "${eventPath}" --confirmation-ref "studio-user-confirmation:<client>:feedback:${eventHash}:<exact Krish confirmation message>"` })
    })

  feedback.command('confirm')
    .requiredOption('--event <path>')
    .requiredOption('--confirmation-ref <reference>', 'event-bound user-confirmation receipt from the studio client')
    .option('--correction <text>')
    .option('--propose-rule', 'create a narrowly scoped candidate rule after explicit confirmation')
    .action(async (options) => {
      const event = FeedbackEventV2Schema.parse(await readJson(options.event))
      await loadJobV2(event.job_id)
      const confirmed = await confirmFeedbackV2(event, options.correction, options.confirmationRef)
      const confirmedPath = join(jobPath(event.job_id), 'feedback', `${event.feedback_id}.confirmed.json`)
      await writeJson(confirmedPath, confirmed)
      const rule = options.proposeRule ? await proposeRuleV2(confirmed) : undefined
      context.out({ feedback: confirmed, confirmed_path: confirmedPath, ...(rule ? { proposed_rule: rule } : {}) })
    })

  const packages = v2.command('package')
  packages.command('create')
    .requiredOption('--job <jobId>')
    .requiredOption('--candidate <path>')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      if (manifest.purpose === 'calibration') throw new Error('calibration jobs are analysis-only and cannot create platform packages')
      const candidate = CandidateV1Schema.parse(await readJson(options.candidate))
      const candidateHash = candidateSemanticHash(candidate)
      if (candidate.job_id !== manifest.job_id) throw new Error('candidate belongs to a different job')
      await assertCandidateIsCurrent(manifest.job_id, candidate)
      if (!hasApprovalV2(manifest, 'angle', candidateHash, 'krish')) throw new Error('the exact candidate requires Krish angle approval')
      const treatment = await readStageArtifactV2<TreatmentPayload>(options.job, 'treatment')
      if (!hasApprovalV2(manifest, 'treatment', treatment.artifact_hash, 'krish')) throw new Error('the exact treatment requires Krish approval')
      const render = await readStageArtifactV2<RenderPayload>(options.job, 'render')
      const qa = await readStageArtifactV2(options.job, 'qa')
      if (!qaPassed(qa.payload)) throw new Error('QA did not pass')
      const visualPlan = await readStageArtifactV2<VisualNarrativePlanV1>(options.job, 'visual_plan')
      const styleframes = await readStageArtifactV2(options.job, 'styleframes')
      await verifyReviewPacketFiles(styleframes.payload)
      const assetsArtifact = await readStageArtifactV2<{ assets: VisualAssetV1[]; generated_shots: GeneratedShotV1[] }>(options.job, 'assets')
      const assetVerdict = await verifyVisualAssets(VisualNarrativePlanV1Schema.parse({ ...visualPlan.payload, resolved_assets: assetsArtifact.payload.assets }))
      if (!assetVerdict.passed) throw new Error(`hard block cannot be overridden for evidence: ${assetVerdict.hard_blocks.join('; ')}`)
      const treatmentByPlatform = new Map(treatment.payload.manifests.map((item) => [item.platform, item]))
      const renderByPlatform = new Map(render.payload.renders.map((item) => [item.platform, item]))
      const approvedAssetsHash = hashValue(assetsArtifact.payload.assets)
      const approvedGeneratedHash = hashValue(assetsArtifact.payload.generated_shots)
      const created: DraftPackageV2[] = []
      for (const platform of manifest.target_platforms) {
        const treatmentItem = treatmentByPlatform.get(platform)
        const renderItem = renderByPlatform.get(platform)
        if (!treatmentItem || !renderItem) throw new Error(`missing treatment or render for ${platform}`)
        if (treatmentItem.manifest_hash !== renderItem.manifest_hash || resolve(treatmentItem.manifest_path) !== resolve(renderItem.manifest_path)) throw new Error(`render for ${platform} is not bound to the approved treatment manifest`)
        if (await hashFile(resolve(renderItem.manifest_path)) !== renderItem.manifest_hash) throw new Error(`render manifest changed for ${platform}`)
        if (await hashFile(resolve(renderItem.master_path)) !== renderItem.master_hash) throw new Error(`render master changed for ${platform}`)
        if (!hasApprovalV2(manifest, 'final', renderItem.master_hash, 'krish')) throw new Error(`exact final master approval from Krish is required for ${platform}`)
        const renderManifest = RenderManifestV2Schema.parse(await readJson(renderItem.manifest_path))
        await assertCurrentRenderLineage(manifest, renderManifest)
        if (renderManifest.candidate_hash !== candidateHash || renderManifest.candidate_id !== candidate.candidate_id) throw new Error(`render manifest for ${platform} is not bound to the approved candidate`)
        if (renderManifest.visual_plan_artifact_hash !== visualPlan.artifact_hash) throw new Error(`render manifest for ${platform} is not bound to the approved visual plan`)
        if (renderManifest.storyboard_artifact_hash !== styleframes.artifact_hash) throw new Error(`render manifest for ${platform} is not bound to the approved storyboard`)
        if (hashValue(renderManifest.assets) !== approvedAssetsHash || hashValue(renderManifest.generated_shots) !== approvedGeneratedHash) throw new Error(`render manifest for ${platform} is not bound to the exact approved asset ledger`)
        for (const sourceItem of renderManifest.sources) if (await hashFile(resolve(sourceItem.path)) !== sourceItem.sha256) throw new Error(`render source ${sourceItem.source_id} changed for ${platform}`)
        if (!renderManifest.disclosures.some((item) => item.platform === platform)) throw new Error(`render manifest for ${platform} lacks a platform disclosure decision`)
        created.push(await createDraftPackageV2(options.job, platform, renderItem.master_path, candidate, renderManifest, qa.payload, { render_manifest_hash: renderItem.manifest_hash, master_path: renderItem.master_path, master_hash: renderItem.master_hash }))
      }
      await verifyPackagePayload({ packages: created }, manifest)
      const artifact = await completeStageV2(options.job, 'package', { packages: created }, { render: render.artifact_hash, qa: qa.artifact_hash }, { packager: V2_CLI_VERSION })
      context.out({
        job_id: options.job,
        artifact_hash: artifact.artifact_hash,
        packages: created,
        public_publish_allowed: false,
        next_gate: `studio v2 approve --job ${options.job} --gate package --artifact ${artifact.artifact_hash} --confirmation-ref "studio-user-confirmation:<client>:package:${artifact.artifact_hash}:<exact Krish approval message>"`,
      })
    })

  packages.command('archive')
    .requiredOption('--job <jobId>')
    .action(async (options) => {
      const manifest = await loadJobV2(options.job)
      if (manifest.purpose === 'calibration') throw new Error('calibration jobs cannot be archived as approved deliverables')
      const packageArtifact = await readStageArtifactV2<PackagePayload>(options.job, 'package')
      if (!hasApprovalV2(manifest, 'package', packageArtifact.artifact_hash, 'krish')) throw new Error('the exact four-platform package requires Krish approval before archive')
      await verifyPackagePayload(packageArtifact.payload, manifest)
      const archivePath = await archiveJob(options.job)
      context.out({ job_id: options.job, package_artifact_hash: packageArtifact.artifact_hash, archive_path: archivePath })
    })

  const publish = v2.command('publish').description('Private YouTube upload only; every other platform remains a local package')
  publish.command('youtube')
    .requiredOption('--job <jobId>')
    .requiredOption('--privacy <privacy>')
    .action(async (options) => {
      assertYoutubePrivateOnly('youtube_shorts', options.privacy)
      const manifest = await loadJobV2(options.job)
      if (manifest.purpose === 'calibration') throw new Error('calibration jobs cannot be uploaded')
      const packagesArtifact = await readStageArtifactV2<PackagePayload>(options.job, 'package')
      if (!hasApprovalV2(manifest, 'package', packagesArtifact.artifact_hash, 'krish')) throw new Error('the exact four-platform package requires Krish approval before private upload')
      await verifyPackagePayload(packagesArtifact.payload, manifest)
      const draft = packagesArtifact.payload.packages.find((item) => item.platform === 'youtube_shorts')
      if (!draft) throw new Error('YouTube Shorts package is missing')
      if (draft.delivery.mode !== 'private_upload' || draft.delivery.privacy !== 'private' || draft.delivery.public_publish_allowed) throw new Error('package violates the private-only upload boundary')
      if (!hasApprovalV2(manifest, 'final', draft.master_hash, 'krish')) throw new Error('exact final master approval from Krish is required')
      const accessToken = await readWindowsCredential(context.repoRoot, 'MindmakeVideoStudio/youtube-access-token')
      const result = await uploadPrivateYoutubeVideo({ accessToken, videoPath: draft.master_path, title: draft.titles[0]!, description: draft.description })
      context.out({ job_id: options.job, platform: 'youtube_shorts', privacy: 'private', result })
    })

  const magic = v2.command('magic').description('Exact-hash, schema-bounded presentation edits; editorial changes use the full workflow')
  magic.command('targets')
    .requiredOption('--job <jobId>')
    .requiredOption('--platform <platform>')
    .action(async (options) => context.out(await createMagicEditTargetMap(options.job, VideoPlatformV1Schema.parse(options.platform))))

  magic.command('prepare')
    .requiredOption('--job <jobId>')
    .requiredOption('--direction <path>', 'MagicEditDirectionV1 JSON')
    .action(async (options) => context.out(await prepareMagicEditCandidate(options.job, MagicEditDirectionV1Schema.parse(await readJson(resolve(options.direction))))))

  magic.command('activate')
    .requiredOption('--job <jobId>')
    .requiredOption('--activation <path>', 'MagicEditActivationV1 JSON')
    .requiredOption('--command-id <uuid>', 'Control Center command UUID')
    .requiredOption('--command-hash <sha256>', 'canonical Control Center command hash')
    .action(async (options) => {
      if (!SHA256.test(options.commandHash)) throw new Error('--command-hash must be lowercase SHA-256')
      const activation = MagicEditActivationV1Schema.parse(await readJson(resolve(options.activation)))
      context.out(await activateMagicEditCandidate(options.job, activation, {
        expected_parent_revision_hash: activation.expected_parent_revision_hash,
        expected_parent_artifact_hash: activation.expected_parent_artifact_hash,
        command_id: options.commandId,
        command_hash: options.commandHash,
      }))
    })

  magic.command('return-to-parent')
    .requiredOption('--job <jobId>')
    .requiredOption('--request <path>', 'MagicEditReturnToParentV1 JSON')
    .requiredOption('--command-id <uuid>', 'Control Center command UUID')
    .requiredOption('--command-hash <sha256>', 'canonical Control Center command hash')
    .action(async (options) => {
      if (!SHA256.test(options.commandHash)) throw new Error('--command-hash must be lowercase SHA-256')
      const request = MagicEditReturnToParentV1Schema.parse(await readJson(resolve(options.request)))
      context.out(await returnMagicEditToParent(options.job, request.expected_parent_revision_hash, request.expected_parent_artifact_hash, request, options.commandId, options.commandHash))
    })

  const inbox = v2.command('inbox').description('Mounted Google Drive intake discovery with explicit human review')
  inbox.command('init')
    .description('Create the dedicated Inbox only when its configured Drive root is reachable')
    .action(async () => context.out({ schema_version: 1, ...await initializeDriveInbox() }))
  inbox.command('scan')
    .description('Record one bounded stability scan without starting production')
    .action(async () => {
      const softwareCommit = await requireRunnerSourceProvenance(context.repoRoot)
      const state = await scanDriveInbox({ softwareCommit })
      context.out({
        discovery: sanitizedDriveDiscoverySummary(state),
        candidates: (state.scan?.candidates ?? []).map((candidate) => ({
          candidate_id: candidate.candidate_id,
          candidate_hash: candidate.candidate_hash,
          display_name: candidate.display_name,
          classification: candidate.classification,
          availability: candidate.availability,
          sequence_kind: candidate.sequence_kind,
          media_files: candidate.total_media_files,
          sidecar_files: candidate.total_sidecar_files,
          omitted_components: candidate.omitted_component_count,
          safe_codes: candidate.safe_codes,
          review: state.reviews[candidate.candidate_id]?.candidate_hash === candidate.candidate_hash
            ? state.reviews[candidate.candidate_id]?.decision
            : null,
        })),
        next_action: 'Review a ready candidate explicitly. Discovery never renders, packages, uploads, or publishes media.',
      })
    })
  inbox.command('status')
    .description('Show cached, path-free discovery health')
    .action(async () => context.out(await driveDiscoveryStatus()))
  inbox.command('rebind')
    .description('Inspect or explicitly approve a changed resolved Inbox identity')
    .option('--confirmation-ref <receipt>', 'exact old-and-new identity confirmation returned by the proposal')
    .action(async (options) => {
      const softwareCommit = await requireRunnerSourceProvenance(context.repoRoot)
      const proposal = await driveInboxRebindProposal({ softwareCommit })
      if (!options.confirmationRef) {
        context.out({
          ...proposal,
          next_action: `After verifying the mounted Drive account and folder, rerun with --confirmation-ref "${proposal.confirmation_prefix}<Krish confirmation>".`,
        })
        return
      }
      const result = await rebindDriveInbox({ confirmation_ref: options.confirmationRef }, { softwareCommit })
      context.out({
        schema_version: 1,
        rebind: result.rebind,
        discovery: sanitizedDriveDiscoverySummary(result.state),
        next_action: 'Leave all files unchanged for the configured stability interval, then scan again. Rebinding does not accept a candidate or create a job.',
      })
    })
  inbox.command('candidate')
    .description('Show one local candidate and its inbox-relative files')
    .requiredOption('--id <candidateId>')
    .option('--hash <sha256>', 'load an exact historical content-addressed candidate')
    .action(async (options) => context.out(await driveIntakeCandidateDetail(options.id, undefined, options.hash)))
  inbox.command('review')
    .description('Record Krish\'s exact-hash intake decision without starting production')
    .requiredOption('--candidate <candidateId>')
    .requiredOption('--hash <sha256>')
    .requiredOption('--decision <decision>', 'accepted, rejected, or held')
    .requiredOption('--note <text>')
    .requiredOption('--confirmation-ref <receipt>', 'artifact-bound studio client or Control Center confirmation receipt')
    .action(async (options) => {
      if (!SHA256.test(options.hash)) throw new Error('--hash must be lowercase SHA-256')
      if (!['accepted', 'rejected', 'held'].includes(options.decision)) throw new Error('--decision must be accepted, rejected, or held')
      const softwareCommit = await requireRunnerSourceProvenance(context.repoRoot)
      const state = await reviewDriveIntakeCandidate({
        candidate_id: options.candidate,
        candidate_hash: options.hash,
        decision: options.decision as 'accepted' | 'rejected' | 'held',
        note: options.note,
        confirmation_ref: options.confirmationRef,
      }, { softwareCommit })
      context.out({
        discovery: sanitizedDriveDiscoverySummary(state),
        review: state.reviews[options.candidate],
        next_action: options.decision === 'accepted'
          ? 'Use inbox source-bundle for one video, optional audio, and unambiguous typed sidecars. Explicitly author split-file bundles. Inspect the result before creating a job.'
          : 'No production job was created.',
      })
    })
  inbox.command('source-bundle')
    .description('Create a local SourceBundleV1 draft only from an accepted current intake candidate')
    .requiredOption('--candidate <candidateId>')
    .requiredOption('--hash <sha256>')
    .requiredOption('--rights <rights>', 'owned or permissioned')
    .option('--consent-ref <text>', 'optional recorded consent reference')
    .option('--output <path>', 'local JSON output path; defaults to ignored runtime storage')
    .action(async (options) => {
      if (!SHA256.test(options.hash)) throw new Error('--hash must be lowercase SHA-256')
      if (!['owned', 'permissioned'].includes(options.rights)) throw new Error('--rights must be owned or permissioned')
      const softwareCommit = await requireRunnerSourceProvenance(context.repoRoot)
      const bundle = await createDriveSourceBundleDraft({
        candidate_id: options.candidate,
        candidate_hash: options.hash,
        rights: options.rights as 'owned' | 'permissioned',
        ...(options.consentRef ? { consent_ref: options.consentRef } : {}),
      }, { softwareCommit })
      const outputPath = resolve(options.output ?? join(studioPaths().runtimeRoot, 'discovery', 'source-bundles', `${bundle.bundle_id}.json`))
      await writeJsonAtomic(outputPath, bundle)
      context.out({
        schema_version: 1,
        bundle_path: outputPath,
        bundle_hash: hashValue(bundle),
        source_bundle: bundle,
        next_action: 'Inspect the rights, consent, roles, sync, and intake provenance before explicitly creating or attaching a job.',
      })
    })

  const runner = v2.command('runner').description('Codex-independent Windows control-plane runner')
  runner.command('once').action(async () => context.out(await runRunnerOnce(context.repoRoot)))
  runner.command('status').action(async () => context.out(await runnerStatus()))
  runner.command('resolve-project-conflict')
    .description('Acknowledge one reconciled signed project conflict without deleting its evidence')
    .requiredOption('--job <jobId>')
    .requiredOption('--platform <platform>')
    .requiredOption('--journal-hash <sha256>')
    .requiredOption('--confirmation-ref <reference>', 'explicit operator confirmation after cloud and local cursor verification')
    .action(async (options) => {
      if (!SHA256.test(options.journalHash)) throw new Error('--journal-hash must be lowercase SHA-256')
      context.out(await acknowledgeRunnerProjectConflict({
        job_id: options.job,
        platform: VideoPlatformV1Schema.parse(options.platform),
        journal_hash: options.journalHash,
        operator_confirmation_ref: options.confirmationRef,
      }))
    })
  runner.command('project')
    .description('Publish one redacted, exact-hash local review launcher to Control Center')
    .requiredOption('--job <jobId>')
    .requiredOption('--platform <platform>')
    .requiredOption('--gate <gate>', 'story, treatment, final, or learning')
    .option('--review-artifact-hash <sha256>', 'required exact persisted learning artifact hash for the learning gate')
    .option('--idempotency-key <uuid>', 'optional stable UUID override for recovery or contract testing')
    .requiredOption('--safe-title <title>', 'non-sensitive review title')
    .requiredOption('--safe-summary <summary>', 'non-sensitive review summary')
    .action(async (options) => {
      if (!['story', 'treatment', 'final', 'learning'].includes(options.gate)) throw new Error('--gate must be story, treatment, final, or learning')
      if (options.reviewArtifactHash && !SHA256.test(options.reviewArtifactHash)) throw new Error('--review-artifact-hash must be lowercase SHA-256')
      context.out(await publishRunnerProject({
        job_id: options.job,
        platform: VideoPlatformV1Schema.parse(options.platform),
        gate: options.gate as 'story' | 'treatment' | 'final' | 'learning',
        ...(options.idempotencyKey ? { idempotency_key: options.idempotencyKey } : {}),
        ...(options.reviewArtifactHash ? { review_artifact_hash: options.reviewArtifactHash } : {}),
        safe_title: options.safeTitle,
        safe_summary: options.safeSummary,
      }, context.repoRoot))
    })
  runner.command('daemon').action(async () => {
    const controller = new AbortController()
    const stop = () => controller.abort()
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    try { await runRunnerDaemon({ repoRoot: context.repoRoot, signal: controller.signal, onStatus: context.out }) }
    finally {
      process.removeListener('SIGINT', stop)
      process.removeListener('SIGTERM', stop)
    }
  })

  const analytics = v2.command('analytics')
  analytics.command('import')
    .requiredOption('--platform <platform>')
    .requiredOption('--file <path>', 'YouTube Studio or platform CSV export')
    .requiredOption('--job <jobId>')
    .requiredOption('--final <path>', 'the exact published video file')
    .action(async (options) => {
      const job = await loadJobV2(options.job)
      const platform = VideoPlatformV1Schema.parse(options.platform)
      if (!job.target_platforms.includes(platform)) throw new Error('analytics platform is not part of this job')
      const publishedHash = await hashFile(resolve(options.final))
      context.out(await importAnalyticsV2(options.file, platform, job.job_id, publishedHash))
    })

  const experiment = v2.command('experiment').description('Controlled V2 performance experiments with editorial and qualification guards')
  experiment.command('create')
    .requiredOption('--hypothesis <text>')
    .requiredOption('--variable <name>', 'one primary creative variable')
    .requiredOption('--control <jobIds...>')
    .requiredOption('--treatment <jobIds...>')
    .requiredOption('--platform <platform>')
    .requiredOption('--metric <metric>')
    .option('--editorial-guards <metrics...>', 'editorial score dimensions that must not degrade', ['semantic_coherence', 'impact', 'relevance', 'insight', 'specificity', 'audience_value', 'hook_strength', 'ending_strength'])
    .option('--qualified-guard <metric>', 'qualified_actions, utm_actions, or followers_gained', 'qualified_actions')
    .option('--confounds <items...>', 'unavoidable experiment confounds')
    .action(async (options) => context.out(await createExperimentV2({
      hypothesis: options.hypothesis,
      primary_variable: options.variable,
      control_job_ids: options.control,
      treatment_job_ids: options.treatment,
      platform: VideoPlatformV1Schema.parse(options.platform),
      target_metric: options.metric,
      editorial_guard_metrics: options.editorialGuards,
      qualified_guard_metric: options.qualifiedGuard,
      confounds: options.confounds || [],
    })))
  experiment.command('evaluate')
    .requiredOption('--id <experimentId>')
    .action(async (options) => context.out(await evaluateStoredExperimentV2(options.id)))
  experiment.command('list').action(async () => context.out(await listExperimentsV2()))
}
