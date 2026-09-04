import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { cp, mkdir, open, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  ApprovalV2Schema,
  ApprovalGateV2Schema,
  JobManifestV2Schema,
  JOB_SCHEMA_VERSION_V2,
  ReviewDecisionRecordV1Schema,
  ReviewRecoveryRecordV1Schema,
  SourceBundleV1Schema,
  StageArtifactV2Schema,
  StageNameV2Schema,
  StudioEventV2Schema,
  type ApprovalGateV2,
  type JobManifestV2,
  type ReviewDecisionRecordV1,
  type ReviewRecoveryRecordV1,
  type SourceBundleV1,
  type StageArtifactV2,
  type StageNameV2,
  type StudioEventV2,
  type TreatmentLaneV1,
  type VideoPlatformV1,
} from '@mindmake/contracts'
import type { JobPurpose, Series, SourceMode } from '@mindmake/contracts'
import { loadApprovalSigningKey, signApprovalReceiptBody, signRunnerLedgerEventBody, verifyApprovalReceiptBody, verifyRunnerLedgerEventBody } from './approval-signing.js'
import { hashFile, hashPath, hashValue, stableJson } from './hash.js'
import { jobPath } from './paths.js'
import { v2DescendantsFor, v2PrerequisitesFor, v2StageOrder } from './stage-graphs.js'

function nowIso(): string { return new Date().toISOString() }

const APPROVAL_EVENT_CHAIN_GENESIS = hashValue({ domain: 'MindmakeVideoStudio/EventChain/v1', schema_version: JOB_SCHEMA_VERSION_V2 })
const JOB_EVENT_LOCK_TIMEOUT_MS = 15_000
const JOB_EVENT_LOCK_INCOMPLETE_GRACE_MS = 2_000
const heldJobLocks = new AsyncLocalStorage<Map<string, string>>()

interface EventLedgerTailV2 {
  event_count: number
  last_event_id: string | null
  event_chain_hash: string
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM' }
}

function jobEventLockPath(jobId: string): string {
  return join(jobPath(jobId), '.events.lock')
}

export async function withJobEventLock<T>(jobId: string, callback: () => Promise<T>): Promise<T> {
  const canonicalJobId = String(jobId)
  const inherited = heldJobLocks.getStore()
  if (inherited?.has(canonicalJobId)) return callback()
  const path = jobEventLockPath(canonicalJobId)
  await mkdir(dirname(path), { recursive: true })
  const token = randomUUID()
  const deadline = Date.now() + JOB_EVENT_LOCK_TIMEOUT_MS
  let handle: Awaited<ReturnType<typeof open>> | undefined
  while (!handle) {
    try {
      handle = await open(path, 'wx', 0o600)
      await handle.writeFile(`${JSON.stringify({ schema_version: 1, pid: process.pid, token, acquired_at: new Date().toISOString() })}\n`, 'utf8')
      await handle.sync()
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (!['EEXIST', 'EACCES', 'EPERM'].includes(code ?? '')) throw error
      try { await stat(path) }
      catch (pathError) {
        if ((pathError as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      let stale = false
      let observedLock = ''
      try {
        observedLock = await readFile(path, 'utf8')
        const lock = JSON.parse(observedLock) as { pid?: unknown; acquired_at?: unknown }
        const pid = typeof lock.pid === 'number' ? lock.pid : 0
        const acquiredAt = typeof lock.acquired_at === 'string' ? Date.parse(lock.acquired_at) : Number.NaN
        if (processIsAlive(pid)) stale = false
        else if (pid > 0) stale = true
        else if (Number.isFinite(acquiredAt)) stale = Date.now() - acquiredAt > JOB_EVENT_LOCK_INCOMPLETE_GRACE_MS
        else stale = Date.now() - (await stat(path)).mtimeMs > JOB_EVENT_LOCK_INCOMPLETE_GRACE_MS
      } catch {
        try { stale = Date.now() - (await stat(path)).mtimeMs > JOB_EVENT_LOCK_INCOMPLETE_GRACE_MS }
        catch { stale = true }
      }
      if (stale) {
        try {
          const currentLock = await readFile(path, 'utf8')
          if (currentLock === observedLock) await unlink(path)
        }
        catch (unlinkError) { if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') throw unlinkError }
        continue
      }
      if (Date.now() >= deadline) throw new Error(`job ${canonicalJobId} event ledger lock timed out`)
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 15 + Math.floor(Math.random() * 25)))
    }
  }
  const context = new Map(inherited ?? [])
  context.set(canonicalJobId, token)
  try {
    return await heldJobLocks.run(context, callback)
  } finally {
    await handle.close()
    try {
      const current = JSON.parse(await readFile(path, 'utf8')) as { token?: unknown }
      if (current.token === token) await unlink(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

async function assertJobEventLockOwner(jobId: string): Promise<void> {
  const expectedToken = heldJobLocks.getStore()?.get(jobId)
  if (!expectedToken) throw new Error('job event append requires the per-job ledger lock')
  let actualToken: unknown
  try { actualToken = (JSON.parse(await readFile(jobEventLockPath(jobId), 'utf8')) as { token?: unknown }).token }
  catch { throw new Error('job event ledger lock ownership could not be verified') }
  if (actualToken !== expectedToken) throw new Error('job event ledger lock ownership changed before append')
}

type ApprovalRecordV2 = JobManifestV2['approvals'][number]

interface ApprovalReceiptV1 {
  version: 1
  algorithm: 'hmac-sha256'
  prior_event_chain_hash: string
  signature: string
}

interface SignedApprovalPayloadV1 {
  approval: ApprovalRecordV2
  receipt: ApprovalReceiptV1
}

interface RunnerLedgerReceiptV1 {
  version: 1
  algorithm: 'hmac-sha256'
  prior_event_chain_hash: string
  signature: string
}

interface SignedReviewDecisionPayloadV1 {
  decision: ReviewDecisionRecordV1
  command: { command_id: string; command_hash: string }
  receipt: RunnerLedgerReceiptV1
}

interface SignedReviewRecoveryPayloadV1 {
  recovery: ReviewRecoveryRecordV1
  command: { command_id: string; command_hash: string }
  receipt: RunnerLedgerReceiptV1
}

function pathIsInside(root: string, candidate: string): boolean {
  const relation = relative(root, candidate)
  return relation !== '' && relation !== '..' && !relation.startsWith(`..${sep}`) && !isAbsolute(relation)
}

function resolvePinnedPath(job: Pick<JobManifestV2, 'job_id'>, value: string, subtree: 'pinned' | 'skills', label: string): string {
  if (isAbsolute(value)) throw new Error(`${label} must use a job-relative pinned path`)
  const root = resolve(jobPath(job.job_id))
  const allowedRoot = resolve(root, 'pinned', ...(subtree === 'skills' ? ['skills'] : []))
  const candidate = resolve(root, value)
  if (!pathIsInside(allowedRoot, candidate)) throw new Error(`${label} escapes its job-pinned directory`)
  return candidate
}

async function assertRealPathContained(candidate: string, allowedRoot: string, label: string): Promise<void> {
  const [actual, actualRoot] = await Promise.all([realpath(candidate), realpath(allowedRoot)])
  if (!pathIsInside(actualRoot, actual)) throw new Error(`${label} resolves outside its job-pinned directory`)
}

export async function verifyPinnedInputsV2(job: JobManifestV2): Promise<void> {
  const root = resolve(jobPath(job.job_id))
  const pinsRoot = resolve(root, 'pinned')
  const skillsRoot = resolve(pinsRoot, 'skills')
  const configPath = resolvePinnedPath(job, job.pinned_inputs.config_path, 'pinned', 'pinned config path')
  await assertRealPathContained(configPath, pinsRoot, 'pinned config path')
  if (!(await stat(configPath)).isFile()) throw new Error('pinned config path must resolve to a file')
  if (await hashFile(configPath) !== job.config_hash) throw new Error('pinned config hash does not match the job manifest')

  const hashNames = Object.keys(job.skill_hashes).sort()
  const pathNames = Object.keys(job.pinned_inputs.skill_paths).sort()
  if (hashValue(hashNames) !== hashValue(pathNames)) throw new Error('pinned skill paths do not match the recorded skill hash names')
  const seenSkillPaths = new Set<string>()
  for (const name of hashNames) {
    if (!/^[a-z0-9][a-z0-9_.-]{0,95}$/i.test(name)) throw new Error(`pinned skill name is invalid: ${name}`)
    const configuredPath = job.pinned_inputs.skill_paths[name]
    if (!configuredPath) throw new Error(`pinned skill path is missing for ${name}`)
    const path = resolvePinnedPath(job, configuredPath, 'skills', `pinned skill path ${name}`)
    if (basename(path).toLocaleLowerCase('en-GB') !== name.toLocaleLowerCase('en-GB')) throw new Error(`pinned skill path does not match its recorded name: ${name}`)
    await assertRealPathContained(path, skillsRoot, `pinned skill path ${name}`)
    const canonicalPath = await realpath(path)
    if (seenSkillPaths.has(canonicalPath)) throw new Error(`pinned skill path is duplicated: ${name}`)
    seenSkillPaths.add(canonicalPath)
    if (await hashPath(path) !== job.skill_hashes[name]) throw new Error(`pinned skill hash does not match the job manifest: ${name}`)
  }

  const techniquePathValue = job.pinned_inputs.technique_registry_path
  const techniqueHash = job.pinned_inputs.technique_registry_hash
  if (Boolean(techniquePathValue) !== Boolean(techniqueHash)) throw new Error('pinned technique registry path and hash must be recorded together')
  if (techniquePathValue && techniqueHash) {
    const techniquePath = resolvePinnedPath(job, techniquePathValue, 'pinned', 'pinned technique registry path')
    await assertRealPathContained(techniquePath, pinsRoot, 'pinned technique registry path')
    if (!(await stat(techniquePath)).isFile()) throw new Error('pinned technique registry path must resolve to a file')
    if (await hashFile(techniquePath) !== techniqueHash) throw new Error('pinned technique registry hash does not match the job manifest')
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temp = `${path}.${randomUUID()}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temp, path)
}

function eventLedgerTailV2(events: StudioEventV2[]): EventLedgerTailV2 {
  return { event_count: events.length, last_event_id: events.at(-1)?.event_id ?? null, event_chain_hash: eventChainHash(events) }
}

async function appendStudioEventV2(event: StudioEventV2, expectedTail: EventLedgerTailV2): Promise<void> {
  await assertJobEventLockOwner(event.job_id)
  const current = await readEventsV2(event.job_id, true)
  if (hashValue(eventLedgerTailV2(current)) !== hashValue(expectedTail)) throw new Error('job event ledger tail changed before append')
  await assertJobEventLockOwner(event.job_id)
  const handle = await open(join(jobPath(event.job_id), 'events.jsonl'), 'a', 0o600)
  try {
    await handle.writeFile(`${stableJson(event)}\n`, 'utf8')
    await handle.sync()
  } finally { await handle.close() }
}

async function appendEventV2(jobId: string, type: StudioEventV2['type'], payload: Record<string, unknown>): Promise<void> {
  const events = await readEventsV2(jobId, true)
  const event = StudioEventV2Schema.parse({ schema_version: JOB_SCHEMA_VERSION_V2, event_id: randomUUID(), job_id: jobId, type, occurred_at: nowIso(), payload })
  await appendStudioEventV2(event, eventLedgerTailV2(events))
}

export async function recordJobEventV2(jobId: string, type: 'feedback_recorded' | 'rule_promoted' | 'capability_downgraded' | 'asset_approved' | 'identity_enrolled' | 'identity_revoked' | 'magic_edit_intent_received' | 'magic_edit_candidate_created' | 'magic_edit_activated', payload: Record<string, unknown>): Promise<StudioEventV2> {
  return withJobEventLock(jobId, async () => {
    await loadJobV2(jobId)
    const events = await readEventsV2(jobId)
    const event = StudioEventV2Schema.parse({ schema_version: JOB_SCHEMA_VERSION_V2, event_id: randomUUID(), job_id: jobId, type, occurred_at: nowIso(), payload })
    await appendStudioEventV2(event, eventLedgerTailV2(events))
    return event
  })
}

export async function recordJobEventOnceV2(
  jobId: string,
  type: 'magic_edit_intent_received' | 'magic_edit_candidate_created' | 'magic_edit_activated',
  idempotencyKey: string,
  payload: Record<string, unknown>,
): Promise<StudioEventV2> {
  return withJobEventLock(jobId, async () => {
    if (!idempotencyKey.trim()) throw new Error('job event idempotency key is required')
    await loadJobV2(jobId)
    const eventPayload = { ...payload, idempotency_key: idempotencyKey }
    const events = await readEventsV2(jobId)
    const existing = events.find((event) => event.type === type && event.payload.idempotency_key === idempotencyKey)
    if (existing) {
      if (hashValue(existing.payload) !== hashValue(eventPayload)) throw new Error('job event idempotency key was reused for different content')
      return existing
    }
    const event = StudioEventV2Schema.parse({ schema_version: JOB_SCHEMA_VERSION_V2, event_id: randomUUID(), job_id: jobId, type, occurred_at: nowIso(), payload: eventPayload })
    await appendStudioEventV2(event, eventLedgerTailV2(events))
    return event
  })
}

const AUDIT_TIMESTAMP_KEYS = new Set(['created_at', 'updated_at', 'generated_at', 'occurred_at', 'approved_at', 'confirmed_at', 'proposed_at'])

export function withoutAuditTimestamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutAuditTimestamps)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !AUDIT_TIMESTAMP_KEYS.has(key))
      .map(([key, child]) => [key, withoutAuditTimestamps(child)]))
  }
  return value
}

export function stageArtifactSemanticHashV2(artifact: Pick<StageArtifactV2, 'schema_version' | 'job_id' | 'stage' | 'input_hashes' | 'config_hash' | 'tool_versions' | 'payload'>): string {
  return hashValue({
    schema_version: artifact.schema_version,
    job_id: artifact.job_id,
    stage: artifact.stage,
    input_hashes: artifact.input_hashes,
    config_hash: artifact.config_hash,
    tool_versions: artifact.tool_versions,
    payload: withoutAuditTimestamps(artifact.payload),
  })
}

function assertArtifactIdentity(artifact: StageArtifactV2, job: JobManifestV2, stage: StageNameV2, expectedHash?: string): void {
  const recomputed = stageArtifactSemanticHashV2(artifact)
  if (artifact.job_id !== job.job_id || artifact.stage !== stage) throw new Error(`stage ${stage} artifact belongs to a different job or stage`)
  if (artifact.config_hash !== job.config_hash) throw new Error(`stage ${stage} artifact is not bound to the job-pinned configuration`)
  if (artifact.artifact_hash !== recomputed) throw new Error(`stage ${stage} artifact content no longer matches its semantic hash`)
  if (expectedHash && artifact.artifact_hash !== expectedHash) throw new Error(`stage ${stage} artifact does not match the expected content address`)
}

async function saveJobV2(job: JobManifestV2): Promise<void> {
  job.updated_at = nowIso()
  await writeJsonAtomic(join(jobPath(job.job_id), 'job.json'), JobManifestV2Schema.parse(job))
}

export interface CreateJobV2Input {
  series: Series
  mode: SourceMode
  purpose?: JobPurpose
  sourceBundle?: SourceBundleV1
  targetPlatforms?: VideoPlatformV1[]
  treatmentLane?: TreatmentLaneV1
  presenterName?: 'Krish'
  identityProfile?: { profile_id: string; version_hash: string; display_name: 'Krish' }
  consentRefs?: string[]
  configPath: string
  skillPaths: string[]
  techniqueRegistryPath?: string
}

export async function createJobV2(input: CreateJobV2Input): Promise<JobManifestV2> {
  const sourceBundle = input.sourceBundle === undefined ? undefined : SourceBundleV1Schema.parse(input.sourceBundle)
  if (input.mode !== 'short_native' && !sourceBundle) throw new Error('extract and solo jobs require a source bundle')
  const createdAt = nowIso()
  const jobId = `${createdAt.slice(0, 10).replaceAll('-', '')}-${input.series}-${randomUUID().slice(0, 8)}`
  const root = jobPath(jobId)
  const pinsRoot = join(root, 'pinned')
  const pinnedSkillsRoot = join(pinsRoot, 'skills')
  await mkdir(join(root, 'artifacts'), { recursive: true })
  await mkdir(pinnedSkillsRoot, { recursive: true })

  const pinnedConfigPath = join(pinsRoot, `studio${extname(input.configPath) || '.json'}`)
  await cp(input.configPath, pinnedConfigPath)
  const skillHashes: Record<string, string> = {}
  const pinnedSkillPaths: Record<string, string> = {}
  for (const path of input.skillPaths) {
    const info = await stat(path)
    const name = info.isDirectory() ? basename(path) : basename(dirname(path))
    const destination = join(pinnedSkillsRoot, name)
    await cp(path, destination, { recursive: info.isDirectory() })
    skillHashes[name] = await hashPath(destination)
    pinnedSkillPaths[name] = relative(root, destination).replaceAll('\\', '/')
  }

  let techniquePin: { technique_registry_path: string; technique_registry_hash: string } | undefined
  if (input.techniqueRegistryPath) {
    const destination = join(pinsRoot, `techniques${extname(input.techniqueRegistryPath) || '.json'}`)
    await cp(input.techniqueRegistryPath, destination)
    techniquePin = { technique_registry_path: relative(root, destination).replaceAll('\\', '/'), technique_registry_hash: await hashFile(destination) }
  }

  const skipped = new Set<StageNameV2>(input.mode === 'short_native' ? [] : ['brief', 'script', 'recording_brief'])
  const stages = Object.fromEntries(v2StageOrder(input.mode).map((stage) => [stage, { status: skipped.has(stage) ? 'skipped' : 'pending', updated_at: createdAt }]))
  const manifest = JobManifestV2Schema.parse({
    schema_version: JOB_SCHEMA_VERSION_V2,
    job_id: jobId,
    created_at: createdAt,
    updated_at: createdAt,
    series: input.series,
    mode: input.mode,
    purpose: input.purpose ?? 'production',
    ...(input.presenterName ? { presenter_name: input.presenterName } : {}),
    ...(sourceBundle ? { source_bundle: sourceBundle } : {}),
    target_platforms: input.targetPlatforms ?? ['youtube_shorts', 'linkedin', 'tiktok', 'instagram_reels'],
    treatment_lane: input.treatmentLane ?? 'premium',
    ...(input.identityProfile ? { identity_profile: input.identityProfile } : {}),
    consent_refs: input.consentRefs ?? [],
    config_hash: await hashFile(pinnedConfigPath),
    skill_hashes: skillHashes,
    pinned_inputs: { config_path: relative(root, pinnedConfigPath).replaceAll('\\', '/'), skill_paths: pinnedSkillPaths, ...techniquePin },
    stages,
    approvals: [],
  })
  await writeJsonAtomic(join(root, 'job.json'), manifest)
  await writeFile(join(root, 'events.jsonl'), '', 'utf8')
  await withJobEventLock(jobId, async () => appendEventV2(jobId, 'job_created', {
    series: manifest.series,
    mode: manifest.mode,
    purpose: manifest.purpose,
    presenter_name: manifest.presenter_name ?? null,
    ...(sourceBundle ? { source_bundle_id: sourceBundle.bundle_id, source_bundle_hash: hashValue(sourceBundle) } : {}),
    target_platforms: manifest.target_platforms,
    treatment_lane: manifest.treatment_lane,
    config_hash: manifest.config_hash,
    skill_hashes: manifest.skill_hashes,
    pinned_inputs_hash: hashValue(manifest.pinned_inputs),
  }))
  return manifest
}

export async function attachSourceBundleV2(jobId: string, input: SourceBundleV1): Promise<JobManifestV2> {
  return withJobEventLock(jobId, async () => {
    const bundle = SourceBundleV1Schema.parse(input)
    const job = await loadJobV2(jobId)
    const previousHash = job.source_bundle ? hashValue(job.source_bundle) : undefined
    const nextHash = hashValue(bundle)
    if (previousHash === nextHash) return job
    if (job.mode !== 'short_native' && job.source_bundle) throw new Error('source bundles are immutable for extract and solo jobs; create a new job for different source media')
    job.source_bundle = bundle
    if (previousHash) {
      job.stages.ingest = { status: 'pending', updated_at: nowIso(), reason: 'recorded source bundle replaced' }
      for (const child of v2DescendantsFor('ingest', job.mode)) {
        if (['pending', 'skipped'].includes(job.stages[child].status)) continue
        job.stages[child] = { status: 'invalidated', updated_at: nowIso(), reason: 'recorded source bundle replaced' }
        await appendEventV2(jobId, 'stage_invalidated', { stage: child, cause: 'ingest', reason: 'recorded source bundle replaced' })
      }
    }
    await saveJobV2(job)
    await appendEventV2(jobId, 'source_bundle_attached', { bundle_id: bundle.bundle_id, source_bundle_hash: nextHash, replaced: Boolean(previousHash) })
    return job
  })
}

function initialStageStates(mode: SourceMode, createdAt: string): JobManifestV2['stages'] {
  const skipped = new Set<StageNameV2>(mode === 'short_native' ? [] : ['brief', 'script', 'recording_brief'])
  return Object.fromEntries(v2StageOrder(mode).map((stage) => [stage, { status: skipped.has(stage) ? 'skipped' : 'pending', updated_at: createdAt }])) as JobManifestV2['stages']
}

async function readEventsV2(jobId: string, allowEmpty = false): Promise<StudioEventV2[]> {
  const body = await readFile(join(jobPath(jobId), 'events.jsonl'), 'utf8')
  const events: StudioEventV2[] = []
  const ids = new Set<string>()
  for (const [index, line] of body.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    let event: StudioEventV2
    try { event = StudioEventV2Schema.parse(JSON.parse(line)) }
    catch { throw new Error(`job event ledger contains an invalid event at line ${index + 1}`) }
    if (event.job_id !== jobId) throw new Error(`job event ledger line ${index + 1} belongs to a different job`)
    if (ids.has(event.event_id)) throw new Error(`job event ledger reuses event ID ${event.event_id}`)
    ids.add(event.event_id)
    events.push(event)
  }
  if (!events.length && allowEmpty) return events
  if (!events.length || events[0]?.type !== 'job_created') throw new Error('job event ledger must begin with exactly one job_created event')
  if (events.filter((event) => event.type === 'job_created').length !== 1) throw new Error('job event ledger must contain exactly one job_created event')
  return events
}

function nextEventChainHash(previousHash: string, event: StudioEventV2): string {
  return hashValue({ domain: 'MindmakeVideoStudio/EventChain/v1', previous_hash: previousHash, event })
}

function eventChainHash(events: StudioEventV2[]): string {
  return events.reduce(nextEventChainHash, APPROVAL_EVENT_CHAIN_GENESIS)
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort()
  return hashValue(actual) === hashValue([...expected].sort())
}

function signedApprovalPayload(event: StudioEventV2): SignedApprovalPayloadV1 | undefined {
  if (!hasExactKeys(event.payload, ['approval', 'receipt'])) return undefined
  const approvalResult = ApprovalV2Schema.safeParse(event.payload.approval)
  const receipt = event.payload.receipt
  if (!approvalResult.success || !receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return undefined
  const record = receipt as Record<string, unknown>
  if (!hasExactKeys(record, ['version', 'algorithm', 'prior_event_chain_hash', 'signature'])) return undefined
  if (record.version !== 1 || record.algorithm !== 'hmac-sha256') return undefined
  if (typeof record.prior_event_chain_hash !== 'string' || !/^[a-f0-9]{64}$/.test(record.prior_event_chain_hash)) return undefined
  if (typeof record.signature !== 'string' || !/^[a-f0-9]{64}$/.test(record.signature)) return undefined
  return {
    approval: approvalResult.data,
    receipt: {
      version: 1,
      algorithm: 'hmac-sha256',
      prior_event_chain_hash: record.prior_event_chain_hash,
      signature: record.signature,
    },
  }
}

function approvalReceiptBody(event: Pick<StudioEventV2, 'schema_version' | 'event_id' | 'job_id' | 'type' | 'occurred_at'>, approval: ApprovalRecordV2, priorEventChainHash: string): unknown {
  return {
    schema_version: event.schema_version,
    event_id: event.event_id,
    job_id: event.job_id,
    type: event.type,
    occurred_at: event.occurred_at,
    approval,
    prior_event_chain_hash: priorEventChainHash,
  }
}

function signedReviewDecisionPayload(event: StudioEventV2): SignedReviewDecisionPayloadV1 | undefined {
  if (event.type !== 'review_decision_recorded' || !hasExactKeys(event.payload, ['decision', 'command', 'receipt'])) return undefined
  const decision = ReviewDecisionRecordV1Schema.safeParse(event.payload.decision)
  const command = event.payload.command
  const receipt = event.payload.receipt
  if (!decision.success || !command || typeof command !== 'object' || Array.isArray(command) || !receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return undefined
  const commandRecord = command as Record<string, unknown>
  const receiptRecord = receipt as Record<string, unknown>
  if (!hasExactKeys(commandRecord, ['command_id', 'command_hash']) || !hasExactKeys(receiptRecord, ['version', 'algorithm', 'prior_event_chain_hash', 'signature'])) return undefined
  if (typeof commandRecord.command_id !== 'string' || !zUuid(commandRecord.command_id) || typeof commandRecord.command_hash !== 'string' || !/^[a-f0-9]{64}$/.test(commandRecord.command_hash)) return undefined
  if (receiptRecord.version !== 1 || receiptRecord.algorithm !== 'hmac-sha256'
    || typeof receiptRecord.prior_event_chain_hash !== 'string' || !/^[a-f0-9]{64}$/.test(receiptRecord.prior_event_chain_hash)
    || typeof receiptRecord.signature !== 'string' || !/^[a-f0-9]{64}$/.test(receiptRecord.signature)) return undefined
  return {
    decision: decision.data,
    command: { command_id: commandRecord.command_id, command_hash: commandRecord.command_hash },
    receipt: { version: 1, algorithm: 'hmac-sha256', prior_event_chain_hash: receiptRecord.prior_event_chain_hash, signature: receiptRecord.signature },
  }
}

function signedReviewRecoveryPayload(event: StudioEventV2): SignedReviewRecoveryPayloadV1 | undefined {
  if (event.type !== 'review_recovery_recorded' || !hasExactKeys(event.payload, ['recovery', 'command', 'receipt'])) return undefined
  const recovery = ReviewRecoveryRecordV1Schema.safeParse(event.payload.recovery)
  const command = event.payload.command
  const receipt = event.payload.receipt
  if (!recovery.success || !command || typeof command !== 'object' || Array.isArray(command) || !receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return undefined
  const commandRecord = command as Record<string, unknown>
  const receiptRecord = receipt as Record<string, unknown>
  if (!hasExactKeys(commandRecord, ['command_id', 'command_hash']) || !hasExactKeys(receiptRecord, ['version', 'algorithm', 'prior_event_chain_hash', 'signature'])) return undefined
  if (typeof commandRecord.command_id !== 'string' || !zUuid(commandRecord.command_id) || typeof commandRecord.command_hash !== 'string' || !/^[a-f0-9]{64}$/.test(commandRecord.command_hash)) return undefined
  if (receiptRecord.version !== 1 || receiptRecord.algorithm !== 'hmac-sha256'
    || typeof receiptRecord.prior_event_chain_hash !== 'string' || !/^[a-f0-9]{64}$/.test(receiptRecord.prior_event_chain_hash)
    || typeof receiptRecord.signature !== 'string' || !/^[a-f0-9]{64}$/.test(receiptRecord.signature)) return undefined
  return {
    recovery: recovery.data,
    command: { command_id: commandRecord.command_id, command_hash: commandRecord.command_hash },
    receipt: { version: 1, algorithm: 'hmac-sha256', prior_event_chain_hash: receiptRecord.prior_event_chain_hash, signature: receiptRecord.signature },
  }
}

function zUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function reviewDecisionReceiptBody(
  event: Pick<StudioEventV2, 'schema_version' | 'event_id' | 'job_id' | 'type' | 'occurred_at'>,
  decision: ReviewDecisionRecordV1,
  command: { command_id: string; command_hash: string },
  priorEventChainHash: string,
): unknown {
  return {
    schema_version: event.schema_version,
    event_id: event.event_id,
    job_id: event.job_id,
    type: event.type,
    occurred_at: event.occurred_at,
    decision,
    command,
    prior_event_chain_hash: priorEventChainHash,
  }
}

function reviewRecoveryReceiptBody(
  event: Pick<StudioEventV2, 'schema_version' | 'event_id' | 'job_id' | 'type' | 'occurred_at'>,
  recovery: ReviewRecoveryRecordV1,
  command: { command_id: string; command_hash: string },
  priorEventChainHash: string,
): unknown {
  return { schema_version: event.schema_version, event_id: event.event_id, job_id: event.job_id, type: event.type, occurred_at: event.occurred_at, recovery, command, prior_event_chain_hash: priorEventChainHash }
}

function verifiedReviewDecision(event: StudioEventV2, priorEventChainHash: string, key: Buffer | null): SignedReviewDecisionPayloadV1 | undefined {
  const signed = signedReviewDecisionPayload(event)
  if (!signed || !key || event.occurred_at !== signed.decision.occurred_at || signed.receipt.prior_event_chain_hash !== priorEventChainHash) return undefined
  const body = reviewDecisionReceiptBody(event, signed.decision, signed.command, priorEventChainHash)
  return verifyRunnerLedgerEventBody(key, body, signed.receipt.signature) ? signed : undefined
}

function verifiedReviewRecovery(event: StudioEventV2, priorEventChainHash: string, key: Buffer | null): SignedReviewRecoveryPayloadV1 | undefined {
  const signed = signedReviewRecoveryPayload(event)
  if (!signed || !key || event.occurred_at !== signed.recovery.occurred_at || signed.receipt.prior_event_chain_hash !== priorEventChainHash) return undefined
  return verifyRunnerLedgerEventBody(key, reviewRecoveryReceiptBody(event, signed.recovery, signed.command, priorEventChainHash), signed.receipt.signature) ? signed : undefined
}

function createSignedApprovalEvent(jobId: string, approval: ApprovalRecordV2, previousEvents: StudioEventV2[], key: Buffer): StudioEventV2 {
  const priorEventChainHash = eventChainHash(previousEvents)
  const eventIdentity = {
    schema_version: JOB_SCHEMA_VERSION_V2,
    event_id: randomUUID(),
    job_id: jobId,
    type: 'approval_recorded' as const,
    occurred_at: approval.occurred_at,
  }
  const receipt: ApprovalReceiptV1 = {
    version: 1,
    algorithm: 'hmac-sha256',
    prior_event_chain_hash: priorEventChainHash,
    signature: signApprovalReceiptBody(key, approvalReceiptBody(eventIdentity, approval, priorEventChainHash)),
  }
  return StudioEventV2Schema.parse({ ...eventIdentity, payload: { approval, receipt } })
}

function createSignedReviewDecisionEvent(
  jobId: string,
  decision: ReviewDecisionRecordV1,
  command: { command_id: string; command_hash: string },
  previousEvents: StudioEventV2[],
  key: Buffer,
): StudioEventV2 {
  const priorEventChainHash = eventChainHash(previousEvents)
  const eventIdentity = {
    schema_version: JOB_SCHEMA_VERSION_V2,
    event_id: randomUUID(),
    job_id: jobId,
    type: 'review_decision_recorded' as const,
    occurred_at: decision.occurred_at,
  }
  const receipt: RunnerLedgerReceiptV1 = {
    version: 1,
    algorithm: 'hmac-sha256',
    prior_event_chain_hash: priorEventChainHash,
    signature: signRunnerLedgerEventBody(key, reviewDecisionReceiptBody(eventIdentity, decision, command, priorEventChainHash)),
  }
  return StudioEventV2Schema.parse({ ...eventIdentity, payload: { decision, command, receipt } })
}

function createSignedReviewRecoveryEvent(
  jobId: string,
  recovery: ReviewRecoveryRecordV1,
  command: { command_id: string; command_hash: string },
  previousEvents: StudioEventV2[],
  key: Buffer,
): StudioEventV2 {
  const priorEventChainHash = eventChainHash(previousEvents)
  const eventIdentity = { schema_version: JOB_SCHEMA_VERSION_V2, event_id: randomUUID(), job_id: jobId, type: 'review_recovery_recorded' as const, occurred_at: recovery.occurred_at }
  const receipt: RunnerLedgerReceiptV1 = {
    version: 1,
    algorithm: 'hmac-sha256',
    prior_event_chain_hash: priorEventChainHash,
    signature: signRunnerLedgerEventBody(key, reviewRecoveryReceiptBody(eventIdentity, recovery, command, priorEventChainHash)),
  }
  return StudioEventV2Schema.parse({ ...eventIdentity, payload: { recovery, command, receipt } })
}

export async function recordReviewDecisionV2(
  jobId: string,
  decisionInput: ReviewDecisionRecordV1,
  commandInput: { command_id: string; command_hash: string },
): Promise<StudioEventV2> {
  return withJobEventLock(jobId, async () => {
    const decision = ReviewDecisionRecordV1Schema.parse(decisionInput)
    const command = {
      command_id: typeof commandInput.command_id === 'string' && zUuid(commandInput.command_id) ? commandInput.command_id : '',
      command_hash: typeof commandInput.command_hash === 'string' && /^[a-f0-9]{64}$/.test(commandInput.command_hash) ? commandInput.command_hash : '',
    }
    if (!command.command_id || !command.command_hash) throw new Error('review decision command identity is invalid')
    const signingKey = await loadApprovalSigningKey()
    if (!signingKey) throw new Error('review decision signing credential is unavailable or too short')
    if (decision.job_id !== jobId) throw new Error('review decision belongs to a different job')
    const existingEvent = await findRecordedReviewDecisionV2(jobId, decision, command)
    if (existingEvent) return existingEvent
    const job = await loadJobV2(jobId)
    const events = await readEventsV2(jobId)
    if (!job.target_platforms.includes(decision.platform)) throw new Error('review decision platform is not configured for the job')
    if (jobRevisionHashV2(job) !== decision.expected_parent_revision_hash) throw new Error('review decision is stale against the exact current parent revision')
    const event = createSignedReviewDecisionEvent(jobId, decision, command, events, signingKey)
    await appendStudioEventV2(event, eventLedgerTailV2(events))
    const appended = (await readEventsV2(jobId)).at(-1)
    if (!appended || appended.event_id !== event.event_id || !verifiedReviewDecision(appended, eventChainHash(events), signingKey)) throw new Error('review decision event could not be authenticated after recording')
    return event
  })
}

export async function findRecordedReviewDecisionV2(
  jobId: string,
  decisionInput: ReviewDecisionRecordV1,
  commandInput: { command_id: string; command_hash: string },
): Promise<StudioEventV2 | null> {
  return withJobEventLock(jobId, async () => {
    const decision = ReviewDecisionRecordV1Schema.parse(decisionInput)
    const command = { command_id: commandInput.command_id, command_hash: commandInput.command_hash }
    if (!zUuid(command.command_id) || !/^[a-f0-9]{64}$/.test(command.command_hash)) throw new Error('review decision command identity is invalid')
    const signingKey = await loadApprovalSigningKey()
    if (!signingKey) throw new Error('review decision signing credential is unavailable or too short')
    await loadJobV2(jobId)
    const events = await readEventsV2(jobId)
    let priorEventChainHash = APPROVAL_EVENT_CHAIN_GENESIS
    for (const event of events) {
      const existing = signedReviewDecisionPayload(event)
      if (existing?.decision.decision_id === decision.decision_id) {
        const verified = verifiedReviewDecision(event, priorEventChainHash, signingKey)
        if (!verified) throw new Error('existing review decision event failed authentication')
        // command_id identifies one delivery attempt. command_hash identifies the
        // immutable semantic command and deliberately excludes the attempt UUID
        // and delivery timestamps. A crash after this signed event is appended
        // must therefore be replayable under a fresh attempt UUID, while any
        // payload or lineage fork still changes command_hash and fails closed.
        if (hashValue(verified.decision) !== hashValue(decision) || verified.command.command_hash !== command.command_hash) throw new Error('review decision idempotency key was reused for different semantic content')
        return event
      }
      priorEventChainHash = nextEventChainHash(priorEventChainHash, event)
    }
    return null
  })
}

export async function recordReviewRecoveryV2(
  jobId: string,
  recoveryInput: ReviewRecoveryRecordV1,
  commandInput: { command_id: string; command_hash: string },
): Promise<StudioEventV2> {
  return withJobEventLock(jobId, async () => {
    const recovery = ReviewRecoveryRecordV1Schema.parse(recoveryInput)
    const command = { command_id: commandInput.command_id, command_hash: commandInput.command_hash }
    if (!zUuid(command.command_id) || !/^[a-f0-9]{64}$/.test(command.command_hash)) throw new Error('review recovery command identity is invalid')
    const signingKey = await loadApprovalSigningKey()
    if (!signingKey) throw new Error('review recovery signing credential is unavailable or too short')
    if (recovery.job_id !== jobId) throw new Error('review recovery belongs to a different job')
    const existing = await findRecordedReviewRecoveryV2(jobId, recovery, command)
    if (existing) return existing
    const job = await loadJobV2(jobId)
    if (!job.target_platforms.includes(recovery.platform)) throw new Error('review recovery platform is not configured for the job')
    if (jobRevisionHashV2(job) !== recovery.expected_parent_revision_hash) throw new Error('review recovery is stale against the exact current parent revision')
    const events = await readEventsV2(jobId)
    const event = createSignedReviewRecoveryEvent(jobId, recovery, command, events, signingKey)
    await appendStudioEventV2(event, eventLedgerTailV2(events))
    const appended = (await readEventsV2(jobId)).at(-1)
    if (!appended || appended.event_id !== event.event_id || !verifiedReviewRecovery(appended, eventChainHash(events), signingKey)) throw new Error('review recovery event could not be authenticated after recording')
    return event
  })
}

export async function findRecordedReviewRecoveryV2(
  jobId: string,
  recoveryInput: ReviewRecoveryRecordV1,
  commandInput: { command_id: string; command_hash: string },
): Promise<StudioEventV2 | null> {
  return withJobEventLock(jobId, async () => {
    const recovery = ReviewRecoveryRecordV1Schema.parse(recoveryInput)
    const command = { command_id: commandInput.command_id, command_hash: commandInput.command_hash }
    if (!zUuid(command.command_id) || !/^[a-f0-9]{64}$/.test(command.command_hash)) throw new Error('review recovery command identity is invalid')
    const signingKey = await loadApprovalSigningKey()
    if (!signingKey) throw new Error('review recovery signing credential is unavailable or too short')
    await loadJobV2(jobId)
    const events = await readEventsV2(jobId)
    let priorEventChainHash = APPROVAL_EVENT_CHAIN_GENESIS
    for (const event of events) {
      const existing = signedReviewRecoveryPayload(event)
      if (existing?.recovery.recovery_id === recovery.recovery_id) {
        const verified = verifiedReviewRecovery(event, priorEventChainHash, signingKey)
        if (!verified) throw new Error('existing review recovery event failed authentication')
        // Recovery commands use the same semantic-attempt split as decisions.
        // Keep the originally signed attempt as provenance, but accept a retry
        // only when the complete recovery record and semantic hash are exact.
        if (hashValue(verified.recovery) !== hashValue(recovery) || verified.command.command_hash !== command.command_hash) throw new Error('review recovery idempotency key was reused for different semantic content')
        return event
      }
      priorEventChainHash = nextEventChainHash(priorEventChainHash, event)
    }
    return null
  })
}

function verifiedSignedApproval(event: StudioEventV2, priorEventChainHash: string, key: Buffer | null): ApprovalRecordV2 | undefined {
  const signed = signedApprovalPayload(event)
  if (!signed || !key) return undefined
  if (event.type !== 'approval_recorded' || event.occurred_at !== signed.approval.occurred_at) return undefined
  if (signed.receipt.prior_event_chain_hash !== priorEventChainHash) return undefined
  const body = approvalReceiptBody(event, signed.approval, priorEventChainHash)
  return verifyApprovalReceiptBody(key, body, signed.receipt.signature) ? signed.approval : undefined
}

function requiredEventString(event: StudioEventV2, key: string): string {
  const value = event.payload[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`job event ${event.type} is missing ${key}`)
  return value
}

function verifyCreationEvent(job: JobManifestV2, event: StudioEventV2): void {
  if (event.payload.series !== job.series || event.payload.mode !== job.mode) throw new Error('job manifest identity differs from its creation event')
  if (event.payload.treatment_lane !== job.treatment_lane || hashValue(event.payload.target_platforms) !== hashValue(job.target_platforms)) throw new Error('job manifest production targets differ from its creation event')
  if (event.payload.purpose !== undefined && event.payload.purpose !== job.purpose) throw new Error('job manifest purpose differs from its creation event')
  if (event.payload.presenter_name !== undefined && event.payload.presenter_name !== (job.presenter_name ?? null)) throw new Error('job manifest presenter differs from its creation event')
  if (event.payload.config_hash !== undefined && event.payload.config_hash !== job.config_hash) throw new Error('job manifest config hash differs from its creation event')
  if (event.payload.skill_hashes !== undefined && hashValue(event.payload.skill_hashes) !== hashValue(job.skill_hashes)) throw new Error('job manifest skill hashes differ from its creation event')
  if (event.payload.pinned_inputs_hash !== undefined && event.payload.pinned_inputs_hash !== hashValue(job.pinned_inputs)) throw new Error('job manifest pinned paths differ from its creation event')
}

async function reconcileJobEvents(job: JobManifestV2, events: StudioEventV2[]): Promise<JobManifestV2> {
  verifyCreationEvent(job, events[0] as StudioEventV2)
  const stages = initialStageStates(job.mode, job.created_at)
  const approvals: JobManifestV2['approvals'] = []
  const reviewDecisionHashes: string[] = []
  let expectedSourceBundleHash = typeof events[0]?.payload.source_bundle_hash === 'string' ? events[0].payload.source_bundle_hash : undefined
  const hasSignedApproval = events.some((event) => event.type === 'approval_recorded' && signedApprovalPayload(event) !== undefined)
  const approvalKey = hasSignedApproval ? await loadApprovalSigningKey() : null
  const hasRunnerDecision = events.some((event) => event.type === 'review_decision_recorded')
  const hasRunnerRecovery = events.some((event) => event.type === 'review_recovery_recorded')
  const runnerLedgerKey = hasRunnerDecision || hasRunnerRecovery ? (approvalKey ?? await loadApprovalSigningKey()) : null
  if ((hasRunnerDecision || hasRunnerRecovery) && !runnerLedgerKey) throw new Error('runner ledger signing credential is unavailable; review decisions and recoveries cannot be authenticated')
  let priorEventChainHash = APPROVAL_EVENT_CHAIN_GENESIS

  for (const [index, event] of events.entries()) {
    if (index === 0) {
      priorEventChainHash = nextEventChainHash(priorEventChainHash, event)
      continue
    }
    if (event.type === 'source_bundle_attached') {
      const bundleHash = requiredEventString(event, 'source_bundle_hash')
      if (!/^[a-f0-9]{64}$/.test(bundleHash)) throw new Error('source bundle event contains an invalid hash')
      expectedSourceBundleHash = bundleHash
      if (event.payload.replaced === true) stages.ingest = { status: 'pending', updated_at: event.occurred_at, reason: 'recorded source bundle replaced' }
    } else if (event.type === 'approval_recorded') {
      const approval = verifiedSignedApproval(event, priorEventChainHash, approvalKey)
      if (approval) approvals.push(approval)
    } else if (event.type === 'review_decision_recorded') {
      const signedDecision = verifiedReviewDecision(event, priorEventChainHash, runnerLedgerKey)
      if (!signedDecision) throw new Error('job event ledger contains an unauthenticated review decision')
      reviewDecisionHashes.push(hashValue(signedDecision.decision))
    } else if (event.type === 'review_recovery_recorded') {
      if (!verifiedReviewRecovery(event, priorEventChainHash, runnerLedgerKey)) throw new Error('job event ledger contains an unauthenticated review recovery')
    } else if (['stage_started', 'stage_completed', 'stage_invalidated', 'stage_blocked'].includes(event.type)) {
      const stage = StageNameV2Schema.parse(requiredEventString(event, 'stage'))
      if (event.type === 'stage_started') stages[stage] = { status: 'running', updated_at: event.occurred_at }
      if (event.type === 'stage_completed') {
        const artifactHash = requiredEventString(event, 'artifact_hash')
        if (!/^[a-f0-9]{64}$/.test(artifactHash)) throw new Error(`stage ${stage} completion event contains an invalid artifact hash`)
        stages[stage] = { status: 'complete', artifact_hash: artifactHash, artifact_path: `artifacts/${stage}/${artifactHash}.json`, updated_at: event.occurred_at }
      }
      if (event.type === 'stage_invalidated') stages[stage] = { status: 'invalidated', updated_at: event.occurred_at, reason: requiredEventString(event, 'reason') }
      if (event.type === 'stage_blocked') stages[stage] = { status: 'blocked', updated_at: event.occurred_at, reason: requiredEventString(event, 'reason') }
    }
    priorEventChainHash = nextEventChainHash(priorEventChainHash, event)
  }

  if (expectedSourceBundleHash) {
    if (!job.source_bundle || hashValue(job.source_bundle) !== expectedSourceBundleHash) throw new Error('job source bundle differs from its event-ledger hash')
  } else if (job.source_bundle) {
    throw new Error('job source bundle is not recorded in its event ledger')
  }
  return JobManifestV2Schema.parse({ ...job, stages, approvals, review_decision_hashes: reviewDecisionHashes, updated_at: events.at(-1)?.occurred_at ?? job.created_at })
}

export async function loadJobV2(jobId: string): Promise<JobManifestV2> {
  return withJobEventLock(jobId, async () => {
    const raw = JSON.parse(await readFile(join(jobPath(jobId), 'job.json'), 'utf8')) as Record<string, unknown>
    const createdAt = typeof raw.created_at === 'string' ? raw.created_at : ''
    const mode = raw.mode as SourceMode
    const job = JobManifestV2Schema.parse({ ...raw, updated_at: createdAt, stages: initialStageStates(mode, createdAt), approvals: [], review_decision_hashes: [] })
    if (job.job_id !== jobId) throw new Error('job manifest belongs to a different job directory')
    await verifyPinnedInputsV2(job)
    return reconcileJobEvents(job, await readEventsV2(jobId))
  })
}

export async function startStageV2(jobId: string, stage: StageNameV2): Promise<JobManifestV2> {
  return withJobEventLock(jobId, async () => {
    const job = await loadJobV2(jobId)
    const parsedStage = StageNameV2Schema.parse(stage)
    const incomplete = v2PrerequisitesFor(parsedStage, job.mode).filter((dependency) => !['complete', 'skipped'].includes(job.stages[dependency].status))
    if (incomplete.length) throw new Error(`stage ${parsedStage} is waiting for: ${incomplete.join(', ')}`)
    job.stages[parsedStage] = { status: 'running', updated_at: nowIso() }
    await saveJobV2(job)
    await appendEventV2(jobId, 'stage_started', { stage: parsedStage })
    return job
  })
}

export async function blockStageV2(jobId: string, stage: StageNameV2, reason: string): Promise<JobManifestV2> {
  return withJobEventLock(jobId, async () => {
    if (!reason.trim()) throw new Error('blocked stage requires a reason')
    const job = await loadJobV2(jobId)
    job.stages[stage] = { status: 'blocked', updated_at: nowIso(), reason: reason.trim() }
    await saveJobV2(job)
    await appendEventV2(jobId, 'stage_blocked', { stage, reason: reason.trim() })
    return job
  })
}

export async function completeStageV2(jobId: string, stage: StageNameV2, payload: unknown, inputHashes: Record<string, string>, toolVersions: Record<string, string>): Promise<StageArtifactV2> {
  return withJobEventLock(jobId, async () => {
  const job = await loadJobV2(jobId)
  const parsedStage = StageNameV2Schema.parse(stage)
  const incomplete = v2PrerequisitesFor(parsedStage, job.mode).filter((dependency) => !['complete', 'skipped'].includes(job.stages[dependency].status))
  if (incomplete.length) throw new Error(`stage ${parsedStage} is waiting for: ${incomplete.join(', ')}`)
  const artifactBody = { schema_version: JOB_SCHEMA_VERSION_V2, job_id: jobId, stage: parsedStage, input_hashes: inputHashes, config_hash: job.config_hash, tool_versions: toolVersions, payload }
  const artifactHash = stageArtifactSemanticHashV2(artifactBody)
  let artifact = StageArtifactV2Schema.parse({ ...artifactBody, created_at: nowIso(), artifact_hash: artifactHash })
  const stageDir = join(jobPath(jobId), 'artifacts', parsedStage)
  await mkdir(stageDir, { recursive: true })
  const artifactFile = join(stageDir, `${artifact.artifact_hash}.json`)
  try {
    const existing = StageArtifactV2Schema.parse(JSON.parse(await readFile(artifactFile, 'utf8')))
    assertArtifactIdentity(existing, job, parsedStage, artifactHash)
    artifact = existing
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await writeJsonAtomic(artifactFile, artifact)
  }
  const previousHash = job.stages[parsedStage].artifact_hash
  job.stages[parsedStage] = { status: 'complete', artifact_hash: artifact.artifact_hash, artifact_path: relative(rootPath(jobId), artifactFile).replaceAll('\\', '/'), updated_at: nowIso() }
  if (previousHash && previousHash !== artifact.artifact_hash) {
    for (const child of v2DescendantsFor(parsedStage, job.mode)) {
      if (['pending', 'skipped'].includes(job.stages[child].status)) continue
      job.stages[child] = { status: 'invalidated', updated_at: nowIso(), reason: `${parsedStage} artifact changed` }
      await appendEventV2(jobId, 'stage_invalidated', { stage: child, cause: parsedStage, reason: `${parsedStage} artifact changed` })
    }
  }
  await saveJobV2(job)
  await appendEventV2(jobId, 'stage_completed', { stage: parsedStage, artifact_hash: artifact.artifact_hash })
  return artifact
  })
}

function rootPath(jobId: string): string { return jobPath(jobId) }

export async function readStageArtifactV2<T = unknown>(jobId: string, stage: StageNameV2): Promise<StageArtifactV2 & { payload: T }> {
  return withJobEventLock(jobId, async () => {
    const job = await loadJobV2(jobId)
    const state = job.stages[stage]
    if (state.status !== 'complete' || !state.artifact_path || !state.artifact_hash) throw new Error(`stage ${stage} is not complete`)
    const root = resolve(jobPath(jobId))
    const artifactPath = resolve(root, state.artifact_path)
    if (!artifactPath.startsWith(`${root}${sep}`) || basename(artifactPath) !== `${state.artifact_hash}.json`) throw new Error(`stage ${stage} artifact path is outside its content-addressed job location`)
    const artifact = StageArtifactV2Schema.parse(JSON.parse(await readFile(artifactPath, 'utf8')))
    assertArtifactIdentity(artifact, job, stage, state.artifact_hash)
    return artifact as StageArtifactV2 & { payload: T }
  })
}

export async function readReusableStageV2<T = unknown>(jobId: string, stage: StageNameV2, inputHashes: Record<string, string>, toolVersions: Record<string, string> = {}): Promise<(StageArtifactV2 & { payload: T }) | null> {
  try {
    const artifact = await readStageArtifactV2<T>(jobId, stage)
    const inputsMatch = hashValue(artifact.input_hashes) === hashValue(inputHashes)
    const toolsMatch = Object.entries(toolVersions).every(([key, value]) => artifact.tool_versions[key] === value)
    return inputsMatch && toolsMatch ? artifact : null
  } catch { return null }
}

export async function recordApprovalV2(jobId: string, gate: ApprovalGateV2, decision: 'approved' | 'rejected' | 'override', artifactHash: string, reason?: string, actor: 'krish' | 'codex' | 'system' = 'krish', confirmationRef?: string): Promise<JobManifestV2> {
  return withJobEventLock(jobId, async () => {
  ApprovalGateV2Schema.parse(gate)
  if (decision === 'override' && !reason?.trim()) throw new Error('override requires a reason')
  if (['evidence', 'visual_plan', 'storyboard', 'animatic', 'final', 'package'].includes(gate) && actor !== 'krish' && decision !== 'rejected') throw new Error(`${gate} requires Krish approval`)
  if (actor === 'krish' && decision !== 'rejected') {
    const prefixes = [`codex-user-confirmation:${gate}:${artifactHash}:`, `control-center-confirmation:${gate}:${artifactHash}:`]
    if (!confirmationRef || !prefixes.some((prefix) => confirmationRef.startsWith(prefix) && confirmationRef.slice(prefix.length).trim())) throw new Error(`Krish approval requires an artifact-bound confirmation reference beginning ${prefixes.join(' or ')}`)
  }
  await loadJobV2(jobId)
  const signingKey = await loadApprovalSigningKey()
  if (!signingKey) throw new Error('approval signing credential is unavailable or too short; approval was not recorded')
  const approval = ApprovalV2Schema.parse({ gate, decision, artifact_hash: artifactHash, ...(reason ? { reason } : {}), actor, ...(confirmationRef ? { confirmation_ref: confirmationRef } : {}), occurred_at: nowIso() })
  const events = await readEventsV2(jobId)
  const event = createSignedApprovalEvent(jobId, approval, events, signingKey)
  await appendStudioEventV2(event, eventLedgerTailV2(events))
  const updated = await loadJobV2(jobId)
  if (!updated.approvals.some((candidate) => hashValue(candidate) === hashValue(approval))) throw new Error('approval event could not be authenticated after recording')
  await saveJobV2(updated)
  return updated
  })
}

export function hasApprovalV2(job: JobManifestV2, gate: ApprovalGateV2, artifactHash: string, actor?: 'krish' | 'codex' | 'system'): boolean {
  const latest = [...job.approvals].reverse().find((approval) => approval.gate === gate && approval.artifact_hash === artifactHash)
  if (!latest || (actor && latest.actor !== actor) || !['approved', 'override'].includes(latest.decision)) return false
  if (latest.actor === 'krish') return Boolean(
    latest.confirmation_ref?.startsWith(`codex-user-confirmation:${gate}:${artifactHash}:`)
    || latest.confirmation_ref?.startsWith(`control-center-confirmation:${gate}:${artifactHash}:`),
  )
  return true
}

export async function invalidateAfterV2(jobId: string, stage: StageNameV2, reason: string): Promise<JobManifestV2> {
  return withJobEventLock(jobId, async () => {
    const job = await loadJobV2(jobId)
    for (const child of v2DescendantsFor(stage, job.mode)) {
      if (job.stages[child].status === 'pending') continue
      job.stages[child] = { status: 'invalidated', updated_at: nowIso(), reason }
      await appendEventV2(jobId, 'stage_invalidated', { stage: child, cause: stage, reason })
    }
    await saveJobV2(job)
    return job
  })
}

export function pinnedConfigPathV2(job: JobManifestV2): string {
  return resolvePinnedPath(job, job.pinned_inputs.config_path, 'pinned', 'pinned config path')
}

export function pinnedTechniqueRegistryPathV2(job: JobManifestV2): string | undefined {
  return job.pinned_inputs.technique_registry_path
    ? resolvePinnedPath(job, job.pinned_inputs.technique_registry_path, 'pinned', 'pinned technique registry path')
    : undefined
}

export function jobRevisionHashV2(job: JobManifestV2): string {
  return hashValue({
    schema_version: job.schema_version,
    job_id: job.job_id,
    series: job.series,
    mode: job.mode,
    purpose: job.purpose,
    source_bundle_hash: job.source_bundle ? hashValue(job.source_bundle) : null,
    target_platforms: job.target_platforms,
    treatment_lane: job.treatment_lane,
    config_hash: job.config_hash,
    skill_hashes: job.skill_hashes,
    stages: v2StageOrder(job.mode).map((stage) => ({
      stage,
      status: job.stages[stage].status,
      artifact_hash: job.stages[stage].artifact_hash ?? null,
    })),
    approvals: job.approvals.map((approval) => ({
      gate: approval.gate,
      decision: approval.decision,
      artifact_hash: approval.artifact_hash,
      reason: approval.reason ?? null,
      actor: approval.actor,
      confirmation_ref: approval.confirmation_ref ?? null,
    })),
    ...(job.review_decision_hashes.length ? { review_decision_hashes: job.review_decision_hashes } : {}),
  })
}
