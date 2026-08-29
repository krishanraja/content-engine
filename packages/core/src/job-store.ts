import { randomUUID } from 'node:crypto'
import { appendFile, cp, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative } from 'node:path'
import {
  ApprovalGateSchema,
  JobManifestV1Schema,
  SCHEMA_VERSION,
  SourceModeSchema,
  StageArtifactV1Schema,
  StageNameSchema,
  StudioEventV1Schema,
  type ApprovalGate,
  type JobManifestV1,
  type JobPurpose,
  type Series,
  type SourceMode,
  type StageArtifactV1,
  type StageName,
} from '@mindmake/contracts'
import { hashFile, hashPath, hashValue, stableJson } from './hash.js'
import { jobPath, studioPaths } from './paths.js'

const STAGES = StageNameSchema.options

const DESCENDANTS: Record<StageName, StageName[]> = {
  brief: ['script', 'recording_brief', 'ingest', 'normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  script: ['recording_brief', 'ingest', 'normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  recording_brief: ['ingest', 'normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  ingest: ['normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  normalize: ['transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  transcript: ['candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  candidates: ['claims', 'treatment', 'render', 'qa', 'package'],
  claims: ['treatment', 'render', 'qa', 'package'],
  treatment: ['render', 'qa', 'package'],
  render: ['qa', 'package'],
  qa: ['package'],
  package: [],
}

function descendantsFor(job: JobManifestV1, stage: StageName): StageName[] {
  if (job.mode !== 'short_native') return DESCENDANTS[stage]
  if (stage === 'ingest') return ['normalize', 'transcript', 'treatment', 'render', 'qa', 'package']
  if (stage === 'normalize') return ['transcript', 'treatment', 'render', 'qa', 'package']
  if (stage === 'transcript') return ['treatment', 'render', 'qa', 'package']
  return DESCENDANTS[stage]
}

function nowIso(): string {
  return new Date().toISOString()
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temp = `${path}.${randomUUID()}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temp, path)
}

async function appendEvent(jobId: string, type: 'job_created' | 'stage_started' | 'stage_completed' | 'stage_invalidated' | 'approval_recorded' | 'feedback_recorded' | 'rule_promoted', payload: Record<string, unknown>): Promise<void> {
  const event = StudioEventV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    event_id: randomUUID(),
    job_id: jobId,
    type,
    occurred_at: nowIso(),
    payload,
  })
  await appendFile(join(jobPath(jobId), 'events.jsonl'), `${stableJson(event)}\n`, 'utf8')
}

export async function recordJobEvent(jobId: string, type: 'feedback_recorded' | 'rule_promoted', payload: Record<string, unknown>): Promise<void> {
  await loadJob(jobId)
  await appendEvent(jobId, type, payload)
}

export interface CreateJobInput {
  series: Series
  mode: SourceMode
  sourceRef: string
  sourceKind?: 'file' | 'youtube' | 'radar' | 'script'
  rights?: 'owned' | 'permissioned' | 'commentary_exception' | 'unverified'
  consentNote?: string
  purpose?: JobPurpose
  presenterName?: string
  configPath: string
  skillPaths: string[]
}

export async function createJob(input: CreateJobInput): Promise<JobManifestV1> {
  SourceModeSchema.parse(input.mode)
  const createdAt = nowIso()
  const jobId = `${createdAt.slice(0, 10).replaceAll('-', '')}-${input.series}-${randomUUID().slice(0, 8)}`
  const root = jobPath(jobId)
  await mkdir(join(root, 'artifacts'), { recursive: true })

  const pinsRoot = join(root, 'pinned')
  const pinnedSkillsRoot = join(pinsRoot, 'skills')
  await mkdir(pinnedSkillsRoot, { recursive: true })
  const pinnedConfigPath = join(pinsRoot, `studio${extname(input.configPath) || '.json'}`)
  await cp(input.configPath, pinnedConfigPath)
  const skillHashes: Record<string, string> = {}
  const pinnedSkillPaths: Record<string, string> = {}
  for (const path of input.skillPaths) {
    const info = await stat(path)
    const name = info.isDirectory() ? basename(path) : basename(dirname(path))
    skillHashes[name] = await hashPath(path)
    const destination = join(pinnedSkillsRoot, name)
    await cp(path, destination, { recursive: info.isDirectory() })
    pinnedSkillPaths[name] = relative(root, destination).replaceAll('\\', '/')
  }
  const configHash = await hashFile(input.configPath)
  const skipped = new Set<StageName>(input.mode === 'short_native' ? [] : ['brief', 'script', 'recording_brief'])
  const stages = Object.fromEntries(STAGES.map((stage) => [stage, { status: skipped.has(stage) ? 'skipped' : 'pending', updated_at: createdAt }]))
  const source = {
    kind: input.sourceKind ?? (input.mode === 'short_native' ? 'script' : 'file'),
    ref: input.sourceRef,
    rights: input.rights ?? 'unverified',
    ...(input.consentNote ? { consent_note: input.consentNote } : {}),
  }
  const manifest = JobManifestV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    job_id: jobId,
    created_at: createdAt,
    updated_at: createdAt,
    series: input.series,
    mode: input.mode,
    purpose: input.purpose ?? 'production',
    ...(input.presenterName ? { presenter_name: input.presenterName } : {}),
    source,
    config_hash: configHash,
    skill_hashes: skillHashes,
    pinned_inputs: {
      config_path: relative(root, pinnedConfigPath).replaceAll('\\', '/'),
      skill_paths: pinnedSkillPaths,
    },
    stages,
    approvals: [],
  })
  await writeJsonAtomic(join(root, 'job.json'), manifest)
  await writeFile(join(root, 'events.jsonl'), '', 'utf8')
  await appendEvent(jobId, 'job_created', { series: input.series, mode: input.mode, source_kind: source.kind })
  return manifest
}

export async function loadJob(jobId: string): Promise<JobManifestV1> {
  const body = await readFile(join(jobPath(jobId), 'job.json'), 'utf8')
  return JobManifestV1Schema.parse(JSON.parse(body))
}

async function saveJob(job: JobManifestV1): Promise<void> {
  job.updated_at = nowIso()
  await writeJsonAtomic(join(jobPath(job.job_id), 'job.json'), JobManifestV1Schema.parse(job))
}

export async function startStage(jobId: string, stage: StageName): Promise<JobManifestV1> {
  const job = await loadJob(jobId)
  const parsedStage = StageNameSchema.parse(stage)
  job.stages[parsedStage] = { status: 'running', updated_at: nowIso() }
  await saveJob(job)
  await appendEvent(jobId, 'stage_started', { stage: parsedStage })
  return job
}

export async function completeStage(
  jobId: string,
  stage: StageName,
  payload: unknown,
  inputHashes: Record<string, string>,
  toolVersions: Record<string, string>,
): Promise<StageArtifactV1> {
  const job = await loadJob(jobId)
  const parsedStage = StageNameSchema.parse(stage)
  const semantic = {
    schema_version: SCHEMA_VERSION,
    job_id: jobId,
    stage: parsedStage,
    input_hashes: inputHashes,
    config_hash: job.config_hash,
    tool_versions: toolVersions,
    payload,
  }
  let artifact = StageArtifactV1Schema.parse({ ...semantic, created_at: nowIso(), artifact_hash: hashValue(semantic) })
  const stageDir = join(jobPath(jobId), 'artifacts', parsedStage)
  await mkdir(stageDir, { recursive: true })
  const artifactFile = join(stageDir, `${artifact.artifact_hash}.json`)
  try { artifact = StageArtifactV1Schema.parse(JSON.parse(await readFile(artifactFile, 'utf8'))) }
  catch { await writeJsonAtomic(artifactFile, artifact) }
  const previousHash = job.stages[parsedStage].artifact_hash
  job.stages[parsedStage] = {
    status: 'complete',
    artifact_hash: artifact.artifact_hash,
    artifact_path: relative(jobPath(jobId), artifactFile).replaceAll('\\', '/'),
    updated_at: nowIso(),
  }
  if (previousHash && previousHash !== artifact.artifact_hash) {
    for (const child of descendantsFor(job, parsedStage)) {
      if (job.stages[child].status === 'pending' || job.stages[child].status === 'skipped') continue
      job.stages[child] = { status: 'invalidated', updated_at: nowIso(), reason: `${parsedStage} artifact changed` }
      await appendEvent(jobId, 'stage_invalidated', { stage: child, cause: parsedStage, reason: `${parsedStage} artifact changed` })
    }
  }
  await saveJob(job)
  await appendEvent(jobId, 'stage_completed', { stage: parsedStage, artifact_hash: artifact.artifact_hash })
  return artifact
}

export async function readStageArtifact<T = unknown>(jobId: string, stage: StageName): Promise<StageArtifactV1 & { payload: T }> {
  const job = await loadJob(jobId)
  const state = job.stages[stage]
  if (state.status !== 'complete' || !state.artifact_path) throw new Error(`stage ${stage} is not complete`)
  const body = await readFile(join(jobPath(jobId), state.artifact_path), 'utf8')
  return StageArtifactV1Schema.parse(JSON.parse(body)) as StageArtifactV1 & { payload: T }
}

export async function readReusableStage<T = unknown>(jobId: string, stage: StageName, inputHashes: Record<string, string>, toolVersions: Record<string, string> = {}): Promise<(StageArtifactV1 & { payload: T }) | null> {
  try {
    const artifact = await readStageArtifact<T>(jobId, stage)
    const inputsMatch = hashValue(artifact.input_hashes) === hashValue(inputHashes)
    const toolsMatch = Object.entries(toolVersions).every(([key, value]) => artifact.tool_versions[key] === value)
    return inputsMatch && toolsMatch ? artifact : null
  } catch { return null }
}

export async function invalidateAfter(jobId: string, stage: StageName, reason: string): Promise<JobManifestV1> {
  const job = await loadJob(jobId)
  for (const child of descendantsFor(job, stage)) {
    if (job.stages[child].status === 'pending') continue
    job.stages[child] = { status: 'invalidated', updated_at: nowIso(), reason }
    await appendEvent(jobId, 'stage_invalidated', { stage: child, cause: stage, reason })
  }
  await saveJob(job)
  return job
}

export async function recordApproval(
  jobId: string,
  gate: ApprovalGate,
  decision: 'approved' | 'rejected' | 'override',
  artifactHash: string,
  reason?: string,
  actor: 'krish' | 'codex' | 'system' = 'krish',
): Promise<JobManifestV1> {
  ApprovalGateSchema.parse(gate)
  if (decision === 'override' && !reason?.trim()) throw new Error('override requires a reason')
  const job = await loadJob(jobId)
  const approval = {
    gate,
    decision,
    artifact_hash: artifactHash,
    ...(reason ? { reason } : {}),
    actor,
    occurred_at: nowIso(),
  }
  job.approvals.push(approval)
  await saveJob(job)
  await appendEvent(jobId, 'approval_recorded', approval)
  return job
}

export function hasApproval(job: JobManifestV1, gate: ApprovalGate, artifactHash: string): boolean {
  return job.approvals.some((approval) => approval.gate === gate && approval.artifact_hash === artifactHash && (approval.decision === 'approved' || approval.decision === 'override'))
}

export async function ensureRuntime(): Promise<void> {
  const paths = studioPaths()
  await mkdir(paths.jobsRoot, { recursive: true })
  await mkdir(paths.cacheRoot, { recursive: true })
}

export function pinnedConfigPath(job: JobManifestV1): string {
  return join(jobPath(job.job_id), job.pinned_inputs.config_path)
}

export { hashFile, hashPath, hashValue }
