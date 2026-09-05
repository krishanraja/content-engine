import { randomUUID } from 'node:crypto'
import { access, lstat, mkdir, open, readFile, readdir, realpath, stat, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZodError } from 'zod'
import {
  MagicEditCandidateV1Schema,
  FeedbackEventV1Schema,
  FeedbackEventV2Schema,
  LegacyStoredRunnerReceiptV1Schema,
  PreferenceRuleV1Schema,
  RenderStagePayloadV2Schema,
  RunnerCommandEnvelopeV1Schema,
  RunnerProjectProjectionV1Schema,
  RunnerProjectRequestV1Schema,
  RunnerReceiptV1Schema,
  StageNameV2Schema,
  VideoPlatformV1Schema,
  runnerCommandHashInputV1,
  runnerProjectProjectionHashInputV1,
  type MagicEditCandidateV1,
  type MagicEditGateResultsV1,
  type ReviewDecisionRecordV1,
  type ReviewRecoveryRecordV1,
  type RunnerCommandEnvelopeV1,
  type RunnerHardGatesV1,
  type RunnerHeartbeatV1,
  type RunnerLocalReviewBindingV1,
  type RunnerProjectProjectionV1,
  type RunnerProjectPlatformStateV1,
  type RunnerProjectRequestV1,
  type RunnerReceiptV1,
  type RunnerResultRefsV1,
  type RunnerReviewTargetV1,
} from '@mindmake/contracts'
import { loadRunnerReceiptSigningKey, signRunnerReceiptHash, verifyRunnerReceiptHash } from './approval-signing.js'
import { CONTROL_CENTER_RUNNER_CREDENTIAL, ControlPlaneClient, ControlPlaneRequestError, type ClaimedRunnerCommand } from './control-plane-client.js'
import { readWindowsCredential } from './credentials.js'
import { durableLockOwnerIsActive, withDurableFileLock } from './durable-lock.js'
import { driveDiscoveryStatus, sanitizedDriveDiscoverySummary, scanDriveInbox, type SanitizedDriveDiscoverySummary } from './drive-discovery.js'
import { hashFile, hashFileMd5, hashValue } from './hash.js'
import { findRecordedReviewDecisionV2, hasApprovalV2, jobRevisionHashV2, loadJobProjectionSnapshotV2, loadJobV2, readStageArtifactV2, recordApprovalV2, recordReviewDecisionV2, recordReviewRecoveryV2, withJobEventLock } from './job-store-v2.js'
import {
  activateMagicEditCandidate,
  loadMagicEditCandidate,
  prepareMagicEditCandidate,
  createMagicEditTargetMap,
  renderMagicEditComparisonPreview,
  returnMagicEditToParent,
} from './magic-edits.js'
import { studioPaths } from './paths.js'
import { run } from './process.js'
import { createLocalReviewSemanticMap, deterministicRunnerReviewId, loadLocalReviewBinding, persistLocalReviewBinding } from './review-bindings.js'
import { clearRunnerAuthorityStaging, ensureRunnerAuthorityStagingRoot, writeRunnerAuthorityJsonAtomic } from './runner-authority-files.js'
import {
  acknowledgeRunnerCommandPlatformState,
  acknowledgeRunnerProject,
  assertRunnerCommandHasAcknowledgedCursor,
  assertRunnerPlatformCanProject,
  desiredRunnerProjectPlatformState,
  discardPendingRunnerProject,
  listPendingRunnerProjects,
  loadAcknowledgedRunnerProjectCursor,
  loadPendingRunnerProject,
  persistPendingRunnerProject,
  quarantinePendingRunnerProject,
  replacePendingRunnerProject,
  resolveRunnerProjectConflict as recordRunnerProjectConflictResolution,
  RunnerProjectGlobalLineageError,
  runnerProjectJournalStatus,
  type RunnerProjectJournalStatusV1,
  type SignedRunnerProjectCursorV1,
  withRunnerProjectStateLock,
} from './runner-projection-state.js'

export const DEFAULT_CONTROL_PLANE_URL = 'https://controlcenter.krishraja.com/api/video-studio/runner'
const DEFAULT_LEASE_SECONDS = 120
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000
const DEFAULT_IDLE_INTERVAL_MS = 5_000
const MAX_BACKOFF_MS = 60_000
const PREVIEW_RETENTION_INTERVAL_MS = 24 * 60 * 60_000
const PREVIEW_RETENTION_RETRY_MS = 60 * 60_000
const RUNNER_LOCK_INCOMPLETE_GRACE_MS = 2_000
const PROCESS_START_CLOCK_TOLERANCE_MS = 1_000
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

type ReceiptBody = Omit<RunnerReceiptV1, 'receipt_hash' | 'receipt_signature'>

interface LegacyRunnerIdentityFileV1 {
  schema_version: 1
  runner_id: string
  created_at: string
}

interface RunnerIdentityFile {
  schema_version: 2
  layout_version: 1
  runner_id: string
  created_at: string
}

interface RunnerAuthorityMarkerBodyV1 {
  schema_version: 1
  layout_version: 1
  state: 'initializing' | 'finalized'
  runner_id: string
  identity_hash: string
  initialized_at: string
}

interface SignedRunnerAuthorityMarkerV1 extends RunnerAuthorityMarkerBodyV1 {
  marker_hash: string
  marker_signature: string
}

interface PendingRunnerReceiptJournalV1 {
  schema_version: 1
  idempotency_key: string
  runner_id: string
  lease_token: string
  receipt: RunnerReceiptV1
}

const CLOUD_RECEIPT_AUTHORITY_CONFLICT_SAFE_CODES = [
  'receipt_conflict',
  'command_not_found',
  'job_not_found',
  'command_in_flight',
  'stale_parent',
  'stale_event_count',
  'recovery_exists',
  'cross_platform_magic_lineage',
  'invalid_lineage',
  'source_review_conflict',
  'invalid_recovery_receipt',
  'invalid_review_binding_transition',
  'invalid_receipt',
  'invalid_editorial_route',
  'invalid_preview_refs',
  'preview_slot_missing',
  'preview_object_conflict',
] as const

type CloudRunnerReceiptAuthorityConflictSafeCode = typeof CLOUD_RECEIPT_AUTHORITY_CONFLICT_SAFE_CODES[number]
type RunnerReceiptAuthorityConflictSafeCode = CloudRunnerReceiptAuthorityConflictSafeCode | 'legacy_receipt_missing_source_cursor'
const cloudReceiptAuthorityConflictSafeCodes = new Set<string>(CLOUD_RECEIPT_AUTHORITY_CONFLICT_SAFE_CODES)
const receiptAuthorityConflictSafeCodes = new Set<string>([...CLOUD_RECEIPT_AUTHORITY_CONFLICT_SAFE_CODES, 'legacy_receipt_missing_source_cursor'])

interface RunnerReceiptConflictBodyV1 {
  schema_version: 1
  safe_code: RunnerReceiptAuthorityConflictSafeCode
  quarantined_at: string
  idempotency_key: string
  runner_id: string
  lease_token_hash: string
  receipt: RunnerReceiptV1
}

interface SignedRunnerReceiptConflictV1 extends RunnerReceiptConflictBodyV1 {
  conflict_hash: string
  conflict_signature: string
}

interface RunnerReceiptJournalStatusV1 {
  pending_receipts: number
  conflicted_receipts: number
  recovery_conflicts: number
  authority_conflicts: number
  receipt_attention_code: 'runner_receipt_recovery_conflict' | 'runner_receipt_authority_conflict' | null
}

export function runnerJournalsPermitPreviewRetention(
  receiptJournals: Pick<RunnerReceiptJournalStatusV1, 'pending_receipts' | 'receipt_attention_code'>,
  projectJournals: Pick<RunnerProjectJournalStatusV1, 'project_attention_code'>,
): boolean {
  return receiptJournals.pending_receipts === 0
    && receiptJournals.receipt_attention_code === null
    && projectJournals.project_attention_code === null
}

interface ClaimedRunnerCommandJournalBodyV1 {
  schema_version: 1
  runner_id: string
  claimed_at: string
  command: RunnerCommandEnvelopeV1
}

export interface SignedClaimedRunnerCommandJournalV1 extends ClaimedRunnerCommandJournalBodyV1 {
  journal_hash: string
  journal_signature: string
}

export interface RunnerDispatchResult {
  status: 'succeeded' | 'requires_editorial_route'
  result_revision_hash: string
  result_artifact_hash: string
  result_refs?: RunnerResultRefsV1
  hard_gates: RunnerHardGatesV1
}

interface PublishedPreview {
  object_key: string
  sha256: string
  md5: string
  byte_size: number
}

export interface RunnerDispatchContext {
  repoRoot: string
  runtimeRoot?: string
  signingKey: Buffer
  publishPreview: (side: 'before' | 'after', path: string, sha256: string, byteSize: number) => Promise<PublishedPreview>
  assertLeaseActive?: () => void
}

export interface RunnerControlPlane {
  claim(input: { runner_id: string; software_commit: string; lease_seconds?: number }): Promise<ClaimedRunnerCommand | null>
  heartbeat(input: RunnerHeartbeatV1, leaseToken?: string): Promise<{ lease_expires_at?: string }>
  complete(input: { runner_id: string; lease_token: string; receipt: RunnerReceiptV1 }): Promise<{ duplicate: boolean; command_id: string; receipt_hash: string; command_status: 'succeeded' | 'failed' | 'attention' }>
  uploadPreviewFile?: ControlPlaneClient['uploadPreviewFile']
  previewRetention?: ControlPlaneClient['previewRetention']
  project?: ControlPlaneClient['project']
}

export interface RunnerCycleOptions {
  client: RunnerControlPlane
  runnerId: string
  softwareCommit: string
  signingKey: Buffer
  driveState: RunnerHeartbeatV1['drive_state'] | (() => Promise<RunnerHeartbeatV1['drive_state']>)
  leaseSeconds?: number
  heartbeatIntervalMs?: number
  now?: () => Date
  dispatch?: (command: RunnerCommandEnvelopeV1, leaseFence: { assertActive: () => void }) => Promise<RunnerDispatchResult>
  enforceProjectState?: boolean
  runtimeRoot?: string
  repoRoot?: string
  verifySourceProvenance?: () => Promise<string>
  discoverInbox?: () => Promise<SanitizedDriveDiscoverySummary>
  renderComparisonPreview?: typeof renderMagicEditComparisonPreview
}

export interface RunnerCycleResult {
  state: 'idle' | 'completed'
  command_id?: string
  receipt_status?: RunnerReceiptV1['status']
  duplicate?: boolean
  discovery?: SanitizedDriveDiscoverySummary
  project_journals?: RunnerProjectJournalStatusV1
}

export interface RunnerProjectBootstrapInput {
  job_id: string
  platform: RunnerProjectProjectionV1['platform_state']['platform']
  gate: RunnerProjectProjectionV1['review']['gate']
  idempotency_key?: string
  safe_title: string
  safe_summary: string
  review_artifact_hash?: string
}

export interface RunnerProjectBuildOptions {
  acknowledgedCursor?: SignedRunnerProjectCursorV1 | null
  omitExpectedPlatformState?: boolean
}

function deterministicUuidFromHash(hash: string): string {
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function runnerRoot(runtimeRoot = studioPaths().runtimeRoot): string {
  return join(runtimeRoot, 'runner')
}

function identityPath(runtimeRoot?: string): string {
  return join(runnerRoot(runtimeRoot), 'identity.json')
}

function lockPath(runtimeRoot?: string): string {
  return join(runnerRoot(runtimeRoot), 'runner.lock')
}

function authorityLockPath(runtimeRoot?: string): string {
  return join(runtimeRoot ?? studioPaths().runtimeRoot, 'runner-authority.lock')
}

function authorityMarkerPath(runtimeRoot?: string): string {
  return join(runtimeRoot ?? studioPaths().runtimeRoot, 'runner-authority.json')
}

export async function withRunnerAuthorityLock<T>(runtimeRoot: string | undefined, callback: () => Promise<T>): Promise<T> {
  const path = authorityLockPath(runtimeRoot)
  try {
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('runner authority lock has an invalid type')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return withDurableFileLock(path, callback)
}

function receiptPath(state: 'pending' | 'acknowledged', idempotencyKey: string, commandId: string, runtimeRoot?: string): string {
  return join(runnerRoot(runtimeRoot), 'receipts', state, idempotencyKey, `${commandId}.json`)
}

function receiptConflictPath(idempotencyKey: string, commandId: string, runtimeRoot?: string): string {
  return join(runnerRoot(runtimeRoot), 'receipts', 'conflicted', idempotencyKey, `${commandId}.json`)
}

function claimedCommandPath(commandId: string, runtimeRoot?: string): string {
  return join(runnerRoot(runtimeRoot), 'claims', `${commandId}.json`)
}

async function assertRunnerLayout(input: { runtimeRoot?: string; requireComplete: boolean; requireIdentity: boolean; allowLegacyIdentityLock?: boolean }): Promise<void> {
  const root = runnerRoot(input.runtimeRoot)
  try {
    const rootInfo = await lstat(root)
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('runner authority root has an invalid type')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !input.requireComplete && !input.requireIdentity) return
    throw error
  }
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !input.requireComplete && !input.requireIdentity) return
    throw error
  }
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  const allowedFiles = new Set(['identity.json', 'runner.lock', ...(input.allowLegacyIdentityLock ? ['identity.json.lock'] : [])])
  const allowedDirectories = new Set(['claims', 'receipts', 'project-state'])
  for (const entry of entries) {
    if (allowedFiles.has(entry.name)) {
      if (!entry.isFile()) throw new Error('runner authority file has an invalid type')
      continue
    }
    if (allowedDirectories.has(entry.name)) {
      if (!entry.isDirectory()) throw new Error('runner authority directory has an invalid type')
      continue
    }
    throw new Error('runner authority root contains an unexpected entry')
  }
  if (input.requireIdentity && !byName.get('identity.json')?.isFile()) throw new Error('runner authority identity is missing')
  if (input.requireComplete) {
    for (const directory of allowedDirectories) if (!byName.get(directory)?.isDirectory()) throw new Error(`runner authority directory is missing: ${directory}`)
  }
  const receipts = byName.get('receipts')
  if (!receipts) return
  const receiptEntries = await readdir(join(root, 'receipts'), { withFileTypes: true })
  const allowedReceiptDirectories = new Set(['pending', 'acknowledged', 'conflicted'])
  const receiptNames = new Set<string>()
  for (const entry of receiptEntries) {
    if (!allowedReceiptDirectories.has(entry.name) || !entry.isDirectory()) throw new Error('runner receipt authority root contains an unexpected entry')
    receiptNames.add(entry.name)
  }
  if (input.requireComplete) {
    for (const directory of allowedReceiptDirectories) if (!receiptNames.has(directory)) throw new Error(`runner receipt authority directory is missing: ${directory}`)
  }
}

async function assertRuntimeAuthorityTopology(runtimeRoot?: string): Promise<{ markerExists: boolean; runnerExists: boolean; stagingExists: boolean }> {
  const root = runtimeRoot ?? studioPaths().runtimeRoot
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { markerExists: false, runnerExists: false, stagingExists: false }
    throw error
  }
  let markerExists = false
  let runnerExists = false
  let stagingExists = false
  for (const entry of entries) {
    const normalized = entry.name.toLocaleLowerCase('en-GB')
    if (normalized === 'runner') {
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('runner authority root has an invalid type')
      runnerExists = true
      continue
    }
    if (normalized === 'runner-authority.json') {
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('runner authority marker has an invalid type')
      markerExists = true
      continue
    }
    if (normalized === 'runner-authority.lock') {
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('runner authority lock has an invalid type')
      continue
    }
    if (normalized === 'runner-staging') {
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('runner authority staging root has an invalid type')
      stagingExists = true
      continue
    }
    if (/^runner(?:[-_.](?:old|bak|backup|copy|previous|stale)(?:[-_.].*)?)$/i.test(entry.name)
      || /^runner-staging(?:[-_.].+)$/i.test(entry.name)
      || normalized.startsWith('runner-authority.')) throw new Error('runtime root contains an unexpected runner authority entry')
  }
  return { markerExists, runnerExists, stagingExists }
}

async function createCompleteRunnerLayout(runtimeRoot?: string): Promise<void> {
  await mkdir(runnerRoot(runtimeRoot), { recursive: true })
  await assertRunnerLayout({ ...(runtimeRoot ? { runtimeRoot } : {}), requireComplete: false, requireIdentity: false, allowLegacyIdentityLock: true })
  await retireLegacyIdentityLock(runtimeRoot)
  await Promise.all([
    mkdir(join(runnerRoot(runtimeRoot), 'claims'), { recursive: true }),
    mkdir(join(runnerRoot(runtimeRoot), 'receipts', 'pending'), { recursive: true }),
    mkdir(join(runnerRoot(runtimeRoot), 'receipts', 'acknowledged'), { recursive: true }),
    mkdir(join(runnerRoot(runtimeRoot), 'receipts', 'conflicted'), { recursive: true }),
    mkdir(join(runnerRoot(runtimeRoot), 'project-state'), { recursive: true }),
  ])
  await assertRunnerLayout({ ...(runtimeRoot ? { runtimeRoot } : {}), requireComplete: true, requireIdentity: false })
}

function verifyClaimedCommandJournal(value: unknown, signingKey: Buffer): SignedClaimedRunnerCommandJournalV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('claimed command journal is invalid')
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const expectedKeys = ['claimed_at', 'command', 'journal_hash', 'journal_signature', 'runner_id', 'schema_version']
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) throw new Error('claimed command journal contains unsupported fields')
  if (record.schema_version !== 1
    || typeof record.runner_id !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(record.runner_id)
    || typeof record.claimed_at !== 'string' || !Number.isFinite(Date.parse(record.claimed_at))
    || typeof record.journal_hash !== 'string' || !/^[a-f0-9]{64}$/.test(record.journal_hash)
    || typeof record.journal_signature !== 'string' || !/^[a-f0-9]{64}$/.test(record.journal_signature)) throw new Error('claimed command journal metadata is invalid')
  const command = RunnerCommandEnvelopeV1Schema.parse(record.command)
  if (hashValue(command.payload) !== command.payload_hash || hashValue(runnerCommandHashInputV1(command)) !== command.command_hash) throw new Error('claimed command journal contains an invalid command identity')
  const body: ClaimedRunnerCommandJournalBodyV1 = { schema_version: 1, runner_id: record.runner_id, claimed_at: record.claimed_at, command }
  if (hashValue(body) !== record.journal_hash || !verifyRunnerReceiptHash(signingKey, record.journal_hash, record.journal_signature)) throw new Error('claimed command journal failed authentication')
  return { ...body, journal_hash: record.journal_hash, journal_signature: record.journal_signature }
}

export async function persistClaimedCommandJournal(
  commandInput: RunnerCommandEnvelopeV1,
  runnerId: string,
  signingKey: Buffer,
  claimedAt: string,
  runtimeRoot?: string,
): Promise<SignedClaimedRunnerCommandJournalV1> {
  const command = RunnerCommandEnvelopeV1Schema.parse(commandInput)
  if (hashValue(command.payload) !== command.payload_hash || hashValue(runnerCommandHashInputV1(command)) !== command.command_hash) throw new Error('claimed command journal command identity is invalid')
  if (!/^[A-Za-z0-9:_-]{1,160}$/.test(runnerId) || !Number.isFinite(Date.parse(claimedAt))) throw new Error('claimed command journal metadata is invalid')
  const body: ClaimedRunnerCommandJournalBodyV1 = { schema_version: 1, runner_id: runnerId, claimed_at: claimedAt, command }
  const journal: SignedClaimedRunnerCommandJournalV1 = {
    ...body,
    journal_hash: hashValue(body),
    journal_signature: signRunnerReceiptHash(signingKey, hashValue(body)),
  }
  const path = claimedCommandPath(command.command_id, runtimeRoot)
  try {
    const existing = verifyClaimedCommandJournal(JSON.parse(await readFile(path, 'utf8')), signingKey)
    if (existing.runner_id !== runnerId || hashValue(existing.command) !== hashValue(command)) throw new Error('claimed command ID was reused for a different authenticated command')
    return existing
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await writeRunnerAuthorityJsonAtomic(path, journal, runtimeRoot)
  return journal
}

export async function loadClaimedCommandJournal(commandId: string, signingKey: Buffer, runtimeRoot?: string): Promise<SignedClaimedRunnerCommandJournalV1 | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId)) throw new Error('claimed command journal command ID is invalid')
  try {
    const journal = verifyClaimedCommandJournal(JSON.parse(await readFile(claimedCommandPath(commandId, runtimeRoot), 'utf8')), signingKey)
    if (journal.command.command_id !== commandId) throw new Error('claimed command journal identity does not match its location')
    return journal
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function isLegacyRunnerIdentity(value: unknown): value is LegacyRunnerIdentityFileV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).sort().join(',') === ['schema_version', 'runner_id', 'created_at'].sort().join(',')
    && record.schema_version === 1
    && typeof record.runner_id === 'string'
    && /^runner-[0-9a-f-]{36}$/.test(record.runner_id)
    && typeof record.created_at === 'string'
    && Number.isFinite(Date.parse(record.created_at))
}

function isRunnerIdentity(value: unknown): value is RunnerIdentityFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).sort().join(',') === ['schema_version', 'layout_version', 'runner_id', 'created_at'].sort().join(',')
    && record.schema_version === 2
    && record.layout_version === 1
    && typeof record.runner_id === 'string'
    && /^runner-[0-9a-f-]{36}$/.test(record.runner_id)
    && typeof record.created_at === 'string'
    && Number.isFinite(Date.parse(record.created_at))
}

function authorityMarkerBody(identity: RunnerIdentityFile, state: RunnerAuthorityMarkerBodyV1['state']): RunnerAuthorityMarkerBodyV1 {
  return {
    schema_version: 1,
    layout_version: identity.layout_version,
    state,
    runner_id: identity.runner_id,
    identity_hash: hashValue(identity),
    initialized_at: identity.created_at,
  }
}

function signedAuthorityMarker(identity: RunnerIdentityFile, state: RunnerAuthorityMarkerBodyV1['state'], signingKey: Buffer): SignedRunnerAuthorityMarkerV1 {
  const body = authorityMarkerBody(identity, state)
  const markerHash = hashValue(body)
  return { ...body, marker_hash: markerHash, marker_signature: signRunnerReceiptHash(signingKey, markerHash) }
}

function verifyAuthorityMarker(value: unknown, signingKey: Buffer): SignedRunnerAuthorityMarkerV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('runner authority marker is invalid')
  const record = value as Record<string, unknown>
  if (Object.keys(record).sort().join(',') !== [
    'schema_version',
    'layout_version',
    'state',
    'runner_id',
    'identity_hash',
    'initialized_at',
    'marker_hash',
    'marker_signature',
  ].sort().join(',')) throw new Error('runner authority marker contains unsupported fields')
  if (record.schema_version !== 1
    || record.layout_version !== 1
    || !['initializing', 'finalized'].includes(String(record.state))
    || typeof record.runner_id !== 'string' || !/^runner-[0-9a-f-]{36}$/.test(record.runner_id)
    || typeof record.identity_hash !== 'string' || !/^[a-f0-9]{64}$/.test(record.identity_hash)
    || typeof record.initialized_at !== 'string' || !Number.isFinite(Date.parse(record.initialized_at))
    || typeof record.marker_hash !== 'string' || !/^[a-f0-9]{64}$/.test(record.marker_hash)
    || typeof record.marker_signature !== 'string' || !/^[a-f0-9]{64}$/.test(record.marker_signature)) throw new Error('runner authority marker metadata is invalid')
  const body: RunnerAuthorityMarkerBodyV1 = {
    schema_version: 1,
    layout_version: 1,
    state: record.state as RunnerAuthorityMarkerBodyV1['state'],
    runner_id: record.runner_id,
    identity_hash: record.identity_hash,
    initialized_at: record.initialized_at,
  }
  if (hashValue(body) !== record.marker_hash
    || !verifyRunnerReceiptHash(signingKey, record.marker_hash, record.marker_signature)) throw new Error('runner authority marker failed authentication')
  return { ...body, marker_hash: record.marker_hash, marker_signature: record.marker_signature }
}

async function loadAuthorityMarker(signingKey: Buffer, runtimeRoot?: string): Promise<SignedRunnerAuthorityMarkerV1 | null> {
  const path = authorityMarkerPath(runtimeRoot)
  try {
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('runner authority marker has an invalid type')
    return verifyAuthorityMarker(JSON.parse(await readFile(path, 'utf8')), signingKey)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function assertMarkerMatchesIdentity(marker: SignedRunnerAuthorityMarkerV1, identity: RunnerIdentityFile): void {
  if (marker.runner_id !== identity.runner_id
    || marker.layout_version !== identity.layout_version
    || marker.identity_hash !== hashValue(identity)
    || marker.initialized_at !== identity.created_at) throw new Error('runner authority marker does not match the runner identity')
}

async function readRunnerIdentity(runtimeRoot?: string): Promise<RunnerIdentityFile | LegacyRunnerIdentityFileV1 | null> {
  try {
    const value: unknown = JSON.parse(await readFile(identityPath(runtimeRoot), 'utf8'))
    if (isRunnerIdentity(value) || isLegacyRunnerIdentity(value)) return value
    throw new Error('runner identity is invalid')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function assertFreshRunnerRoot(runtimeRoot?: string): Promise<void> {
  const root = runnerRoot(runtimeRoot)
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error }
  const transientFiles = new Set(['runner.lock', 'identity.json.lock'])
  for (const entry of entries) {
    if (!transientFiles.has(entry.name) || !entry.isFile() || entry.isSymbolicLink()) throw new Error('runner authority cannot initialize over unowned durable state')
  }
}

async function retireLegacyIdentityLock(runtimeRoot?: string): Promise<void> {
  const path = `${identityPath(runtimeRoot)}.lock`
  let observed = ''
  try {
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('legacy runner identity lock has an invalid type')
    observed = await readFile(path, 'utf8')
    let active: boolean | 'unknown' = 'unknown'
    let hasPid = false
    try {
      const lock = JSON.parse(observed) as Record<string, unknown>
      hasPid = typeof lock.pid === 'number' && Number.isSafeInteger(lock.pid) && lock.pid > 0
      active = await durableLockOwnerIsActive(lock)
    } catch { /* An old incomplete lock is judged only by its age below. */ }
    const fresh = Date.now() - info.mtimeMs < RUNNER_LOCK_INCOMPLETE_GRACE_MS
    if (active === true || active === 'unknown' && (hasPid || fresh)) throw new Error('legacy runner identity initialization is still active or ambiguous')
    if (await readFile(path, 'utf8') === observed) await unlink(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function assertCurrentRunnerAuthority(signingKey: Buffer, runnerId: string, runtimeRoot?: string): Promise<void> {
  const topology = await assertRuntimeAuthorityTopology(runtimeRoot)
  const marker = await loadAuthorityMarker(signingKey, runtimeRoot)
  if (marker) {
    if (!topology.stagingExists) throw new Error('authenticated runner authority staging root is missing')
    await clearRunnerAuthorityStaging(runtimeRoot)
    if (marker.state !== 'finalized') throw new Error('runner authority initialization is incomplete')
    if (!topology.runnerExists) throw new Error('authenticated runner authority root is missing')
    const identity = await readRunnerIdentity(runtimeRoot)
    if (!identity || !isRunnerIdentity(identity)) throw new Error('authenticated runner authority identity is missing or legacy')
    assertMarkerMatchesIdentity(marker, identity)
    if (identity.runner_id !== runnerId) throw new Error('runner identity does not match authenticated authority')
    await assertRunnerLayout({ ...(runtimeRoot ? { runtimeRoot } : {}), requireComplete: true, requireIdentity: true })
    return
  }
  if (topology.markerExists) throw new Error('runner authority marker could not be authenticated')
  const identity = await readRunnerIdentity(runtimeRoot)
  if (identity && isRunnerIdentity(identity)) throw new Error('runner authority marker is missing for a current runner identity')
  if (identity && identity.runner_id !== runnerId) throw new Error('legacy runner identity does not match configured runner')
  await assertRunnerLayout({ ...(runtimeRoot ? { runtimeRoot } : {}), requireComplete: false, requireIdentity: identity !== null })
}

export async function withAuthenticatedRunnerAuthority<T>(runtimeRoot: string | undefined, signingKey: Buffer, runnerId: string, callback: () => Promise<T>): Promise<T> {
  return withRunnerAuthorityLock(runtimeRoot, async () => {
    await assertCurrentRunnerAuthority(signingKey, runnerId, runtimeRoot)
    return callback()
  })
}

export async function loadOrCreateRunnerIdentity(runtimeRoot: string | undefined, signingKey: Buffer): Promise<RunnerIdentityFile> {
  if (!Buffer.isBuffer(signingKey) || signingKey.byteLength < 32) throw new Error('runner receipt signing credential is unavailable or too short')
  return withRunnerAuthorityLock(runtimeRoot, async () => {
    const topology = await assertRuntimeAuthorityTopology(runtimeRoot)
    const marker = await loadAuthorityMarker(signingKey, runtimeRoot)
    const existing = await readRunnerIdentity(runtimeRoot)

    if (marker) {
      if (!topology.stagingExists) throw new Error('authenticated runner authority staging root is missing')
      await clearRunnerAuthorityStaging(runtimeRoot)
      if (marker.state === 'finalized') {
        if (!topology.runnerExists) throw new Error('authenticated runner authority root is missing')
        await assertRunnerLayout({ ...(runtimeRoot ? { runtimeRoot } : {}), requireComplete: true, requireIdentity: true })
        if (!existing || !isRunnerIdentity(existing)) throw new Error('authenticated runner authority identity is missing or legacy')
        assertMarkerMatchesIdentity(marker, existing)
        return existing
      }

      await assertRunnerLayout({ ...(runtimeRoot ? { runtimeRoot } : {}), requireComplete: false, requireIdentity: false, allowLegacyIdentityLock: true })
      const resuming: RunnerIdentityFile = existing && isLegacyRunnerIdentity(existing)
        ? { schema_version: 2, layout_version: 1, runner_id: existing.runner_id, created_at: existing.created_at }
        : existing && isRunnerIdentity(existing)
          ? existing
          : { schema_version: 2, layout_version: 1, runner_id: marker.runner_id, created_at: marker.initialized_at }
      assertMarkerMatchesIdentity(marker, resuming)
      await createCompleteRunnerLayout(runtimeRoot)
      await writeRunnerAuthorityJsonAtomic(identityPath(runtimeRoot), resuming, runtimeRoot)
      await writeRunnerAuthorityJsonAtomic(authorityMarkerPath(runtimeRoot), signedAuthorityMarker(resuming, 'finalized', signingKey), runtimeRoot)
      await assertCurrentRunnerAuthority(signingKey, resuming.runner_id, runtimeRoot)
      return resuming
    }

    if (topology.markerExists) throw new Error('runner authority marker could not be authenticated')
    if (existing && isRunnerIdentity(existing)) throw new Error('runner authority marker is missing for a current runner identity')
    if (existing) await assertRunnerLayout({ ...(runtimeRoot ? { runtimeRoot } : {}), requireComplete: false, requireIdentity: true, allowLegacyIdentityLock: true })
    else await assertFreshRunnerRoot(runtimeRoot)

    let legacyInventory: RunnerReceiptAuthorityInventoryV1 | undefined
    if (existing) {
      legacyInventory = await inspectRunnerReceiptAuthority(signingKey, runtimeRoot, existing.runner_id)
    }
    if (!topology.stagingExists) await ensureRunnerAuthorityStagingRoot(runtimeRoot)
    await clearRunnerAuthorityStaging(runtimeRoot)
    if (legacyInventory) {
      for (const pending of legacyInventory.pending.filter((value) => value.legacy_source_cursor)) {
        await quarantinePendingReceiptConflict(pending, signingKey, 'legacy_receipt_missing_source_cursor', new Date().toISOString(), runtimeRoot)
      }
    }

    const identity: RunnerIdentityFile = existing
      ? { schema_version: 2, layout_version: 1, runner_id: existing.runner_id, created_at: existing.created_at }
      : { schema_version: 2, layout_version: 1, runner_id: `runner-${randomUUID()}`, created_at: new Date().toISOString() }
    await mkdir(runtimeRoot ?? studioPaths().runtimeRoot, { recursive: true })
    await writeRunnerAuthorityJsonAtomic(authorityMarkerPath(runtimeRoot), signedAuthorityMarker(identity, 'initializing', signingKey), runtimeRoot)
    await createCompleteRunnerLayout(runtimeRoot)
    await writeRunnerAuthorityJsonAtomic(identityPath(runtimeRoot), identity, runtimeRoot)
    await writeRunnerAuthorityJsonAtomic(authorityMarkerPath(runtimeRoot), signedAuthorityMarker(identity, 'finalized', signingKey), runtimeRoot)
    await assertRuntimeAuthorityTopology(runtimeRoot)
    await assertCurrentRunnerAuthority(signingKey, identity.runner_id, runtimeRoot)
    return identity
  })
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM' }
}

export interface ProcessInstance {
  alive: boolean
  instance_id?: string
  started_at_ms?: number
}

type ProcessInstanceCommand = typeof run

const WINDOWS_EPOCH_TICKS = 621_355_968_000_000_000n

function windowsProcessInstanceFromTicks(ticksText: string): ProcessInstance {
  if (!/^\d{17,19}$/.test(ticksText)) throw new Error('Windows process start identity is invalid')
  const ticks = BigInt(ticksText)
  const normalizedTicks = ticks - ticks % 10n
  const unixMilliseconds = Number((normalizedTicks - WINDOWS_EPOCH_TICKS) / 10_000n)
  if (!Number.isFinite(unixMilliseconds) || unixMilliseconds <= 0) throw new Error('Windows process start time is invalid')
  return { alive: true, instance_id: `win32:${normalizedTicks}`, started_at_ms: unixMilliseconds }
}

function windowsManagementCreationDateToTicks(stdout: string): string {
  const match = stdout.match(/(?:^|[\r\n])CreationDate=(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.(\d{6})([+-])(\d{3})(?:[\r\n]|$)/)
  if (!match) throw new Error('Windows Management Instrumentation process start identity is invalid')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const microsecondsText = match[7]!
  const offsetSign = match[8]!
  const offsetText = match[9]!
  const parts = [year, month, day, hour, minute, second]
  if (parts.some((part) => !Number.isSafeInteger(part))) throw new Error('Windows Management Instrumentation process start time is invalid')
  const localWholeSecondMs = Date.UTC(year, month - 1, day, hour, minute, second)
  const roundTrip = new Date(localWholeSecondMs)
  if (roundTrip.getUTCFullYear() !== year || roundTrip.getUTCMonth() !== month - 1 || roundTrip.getUTCDate() !== day
    || roundTrip.getUTCHours() !== hour || roundTrip.getUTCMinutes() !== minute || roundTrip.getUTCSeconds() !== second) {
    throw new Error('Windows Management Instrumentation process start time is invalid')
  }
  const offsetMinutes = Number(offsetText) * (offsetSign === '+' ? 1 : -1)
  const utcWholeSecondMs = localWholeSecondMs - offsetMinutes * 60_000
  return (WINDOWS_EPOCH_TICKS + BigInt(utcWholeSecondMs) * 10_000n + BigInt(microsecondsText) * 10n).toString()
}

function commandWasNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function processInstanceIdsMatch(recorded: string, observed: string): boolean {
  if (recorded === observed) return true
  const recordedWindowsTicks = recorded.match(/^win32:(\d{17,19})$/)?.[1]
  const observedWindowsTicks = observed.match(/^win32:(\d{17,19})$/)?.[1]
  if (!recordedWindowsTicks || !observedWindowsTicks) return false
  // Older runner revisions persisted all 100-nanosecond ticks from
  // Get-Process. WMIC exposes the same value at microsecond precision.
  const recordedTicks = BigInt(recordedWindowsTicks)
  const observedTicks = BigInt(observedWindowsTicks)
  return recordedTicks - recordedTicks % 10n === observedTicks - observedTicks % 10n
}

/**
 * Query Windows process creation time without making legacy Windows PowerShell
 * startup part of the normal runner-lock path. Every provider is normalized to
 * the same .NET tick identity so a later inspection can use a different
 * available provider without making a live lock look stale.
 */
export async function inspectWindowsProcessInstance(pid: number, execute: ProcessInstanceCommand = run): Promise<ProcessInstance> {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Windows process ID is invalid')
  try {
    const { stdout } = await execute('wmic.exe', ['process', 'where', `ProcessId=${pid}`, 'get', 'CreationDate', '/value'], { timeoutMs: 1_500 })
    return windowsProcessInstanceFromTicks(windowsManagementCreationDateToTicks(stdout))
  } catch {
    // WMIC is absent by default on some current Windows editions. PowerShell 7
    // remains the fast supported path on those systems and in hosted CI.
  }

  const script = `$process = Get-Process -Id ${pid} -ErrorAction Stop; [Console]::Out.Write($process.StartTime.ToUniversalTime().Ticks.ToString([System.Globalization.CultureInfo]::InvariantCulture))`
  try {
    const { stdout } = await execute('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs: 2_500 })
    return windowsProcessInstanceFromTicks(stdout.trim())
  } catch (error) {
    if (!commandWasNotFound(error)) throw error
  }

  const { stdout } = await execute('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs: 5_000 })
  return windowsProcessInstanceFromTicks(stdout.trim())
}

interface RunnerLockMetadata {
  pid?: unknown
  token?: unknown
  acquired_at?: unknown
  process_instance_id?: unknown
  process_started_at?: unknown
}

/**
 * Resolve an OS process instance, not merely a PID. PIDs are reusable after a
 * crash, so liveness alone cannot prove that the process which created a
 * durable lock is still running.
 */
async function inspectProcessInstanceUncached(pid: number): Promise<ProcessInstance> {
  if (!processIsAlive(pid)) return { alive: false }
  try {
    if (process.platform === 'win32') {
      return await inspectWindowsProcessInstance(pid)
    }

    if (process.platform === 'linux') {
      const [processStat, systemStat, bootId, clock] = await Promise.all([
        readFile(`/proc/${pid}/stat`, 'utf8'),
        readFile('/proc/stat', 'utf8'),
        readFile('/proc/sys/kernel/random/boot_id', 'utf8'),
        run('getconf', ['CLK_TCK'], { timeoutMs: 5_000 }),
      ])
      const closeParen = processStat.lastIndexOf(')')
      const fields = closeParen >= 0 ? processStat.slice(closeParen + 2).trim().split(/\s+/) : []
      const startTicksText = fields[19]
      const bootSecondsText = systemStat.match(/^btime\s+(\d+)$/m)?.[1]
      const clockTicks = Number(clock.stdout.trim())
      if (!startTicksText || !/^\d+$/.test(startTicksText) || !bootSecondsText || !Number.isFinite(clockTicks) || clockTicks <= 0) throw new Error('Linux process start identity is invalid')
      const startedAtMs = Number(bootSecondsText) * 1_000 + Number(startTicksText) * 1_000 / clockTicks
      return { alive: true, instance_id: `linux:${bootId.trim()}:${startTicksText}`, started_at_ms: startedAtMs }
    }

    const { stdout } = await run('ps', ['-o', 'lstart=', '-p', String(pid)], { timeoutMs: 5_000 })
    const startedAtMs = Date.parse(stdout.trim())
    if (!Number.isFinite(startedAtMs)) throw new Error('process start identity is unavailable')
    return { alive: true, instance_id: `${process.platform}:${startedAtMs}`, started_at_ms: startedAtMs }
  } catch {
    // A process can exit between the liveness probe and the instance query.
    // Otherwise retain an unknown live state so callers fail closed.
    return processIsAlive(pid) ? { alive: true } : { alive: false }
  }
}

let currentProcessInstancePromise: Promise<ProcessInstance> | undefined

async function inspectProcessInstance(pid: number): Promise<ProcessInstance> {
  if (pid !== process.pid) return inspectProcessInstanceUncached(pid)
  currentProcessInstancePromise ??= inspectProcessInstanceUncached(pid).then((result) => {
    if (!result.alive || !result.instance_id || result.started_at_ms === undefined) currentProcessInstancePromise = undefined
    return result
  })
  return currentProcessInstancePromise
}

async function lockOwnerIsActive(lock: RunnerLockMetadata): Promise<boolean | 'unknown'> {
  const pid = typeof lock.pid === 'number' && Number.isSafeInteger(lock.pid) && lock.pid > 0 ? lock.pid : 0
  if (!pid) return 'unknown'
  const observed = await inspectProcessInstance(pid)
  if (!observed.alive) return false

  if (typeof lock.process_instance_id === 'string' && lock.process_instance_id.length > 0) {
    if (!observed.instance_id) return 'unknown'
    return processInstanceIdsMatch(lock.process_instance_id, observed.instance_id)
  }

  // Legacy locks have no process instance ID. They are reclaimable only when
  // the currently live process demonstrably started after the lock was
  // acquired, proving that the PID has been reused. Every ambiguous case is
  // treated as active.
  const acquiredAtMs = typeof lock.acquired_at === 'string' ? Date.parse(lock.acquired_at) : Number.NaN
  if (Number.isFinite(acquiredAtMs) && observed.started_at_ms !== undefined
    && observed.started_at_ms > acquiredAtMs + PROCESS_START_CLOCK_TOLERANCE_MS) return false
  return observed.instance_id ? true : 'unknown'
}

export interface RunnerLock { release: () => Promise<void> }

export async function acquireRunnerLock(runtimeRoot?: string): Promise<RunnerLock> {
  const path = lockPath(runtimeRoot)
  const token = randomUUID()
  const ownerProcess = await inspectProcessInstance(process.pid)
  if (!ownerProcess.alive || !ownerProcess.instance_id || ownerProcess.started_at_ms === undefined) throw new Error('video studio runner could not establish a robust process instance identity')
  try {
    const rootInfo = await lstat(runnerRoot(runtimeRoot))
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('runner authority root has an invalid type')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await mkdir(dirname(path), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let handle: Awaited<ReturnType<typeof open>>
    try {
      handle = await open(path, 'wx', 0o600)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (!['EEXIST', 'EACCES', 'EPERM'].includes(code ?? '')) throw error
      try { await stat(path) }
      catch (pathError) {
        if ((pathError as NodeJS.ErrnoException).code === 'ENOENT') { attempt -= 1; continue }
        throw error
      }
      let observedLock = ''
      let incompleteIsFresh = false
      let ownerState: boolean | 'unknown' = 'unknown'
      let hasOwnerPid = false
      try {
        observedLock = await readFile(path, 'utf8')
        const lock = JSON.parse(observedLock) as RunnerLockMetadata
        hasOwnerPid = typeof lock.pid === 'number' && Number.isSafeInteger(lock.pid) && lock.pid > 0
        ownerState = await lockOwnerIsActive(lock)
        if (ownerState === 'unknown' && !hasOwnerPid) incompleteIsFresh = Date.now() - (await stat(path)).mtimeMs < RUNNER_LOCK_INCOMPLETE_GRACE_MS
      } catch {
        try { incompleteIsFresh = Date.now() - (await stat(path)).mtimeMs < RUNNER_LOCK_INCOMPLETE_GRACE_MS }
        catch { incompleteIsFresh = false }
      }
      if (ownerState === true || ownerState === 'unknown' && hasOwnerPid) throw new Error('video studio runner is already active')
      if (incompleteIsFresh) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 20))
        attempt -= 1
        continue
      }
      try {
        const currentLock = await readFile(path, 'utf8')
        if (currentLock === observedLock) await unlink(path)
      }
      catch (unlinkError) { if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') throw unlinkError }
      continue
    }
    let createdIdentity: { dev: bigint; ino: bigint } | undefined
    try {
      const created = await handle.stat({ bigint: true })
      createdIdentity = { dev: created.dev, ino: created.ino }
      await handle.writeFile(`${JSON.stringify({
        schema_version: 2,
        pid: process.pid,
        token,
        acquired_at: new Date().toISOString(),
        process_instance_id: ownerProcess.instance_id,
        process_started_at: new Date(ownerProcess.started_at_ms).toISOString(),
      })}\n`, 'utf8')
      await handle.sync()
    } catch (error) {
      try { await handle.close() } catch { /* The persistence failure is authoritative. */ }
      try {
        const current = await stat(path, { bigint: true })
        if (createdIdentity && current.dev === createdIdentity.dev && current.ino === createdIdentity.ino) await unlink(path)
      } catch (cleanupError) {
        if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') throw new AggregateError([error, cleanupError], 'runner lock persistence and cleanup failed')
      }
      throw error
    }
    let released = false
    return {
      release: async () => {
        if (released) return
        released = true
        await handle.close()
        try {
          const current = JSON.parse(await readFile(path, 'utf8')) as { token?: unknown }
          if (current.token === token) await unlink(path)
        }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      },
    }
  }
  throw new Error('video studio runner lock could not be acquired')
}

interface AuthenticatedPendingReceiptJournalV1 extends PendingRunnerReceiptJournalV1 {
  path: string
  command: RunnerCommandEnvelopeV1
  legacy_source_cursor: boolean
}

interface AuthenticatedReceiptConflictV1 extends SignedRunnerReceiptConflictV1 {
  path: string
  command: RunnerCommandEnvelopeV1
}

interface AuthenticatedAcknowledgedReceiptV1 {
  path: string
  idempotency_key: string
  receipt: RunnerReceiptV1
  command: RunnerCommandEnvelopeV1 | null
  legacy_source_cursor: boolean
}

interface AuthenticatedClaimV1 {
  path: string
  journal: SignedClaimedRunnerCommandJournalV1
}

const EXACT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

async function listAuthenticatedClaims(signingKey: Buffer, runtimeRoot?: string, runnerId?: string): Promise<Map<string, AuthenticatedClaimV1>> {
  const root = join(runnerRoot(runtimeRoot), 'claims')
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map(); throw error }
  const claims = new Map<string, AuthenticatedClaimV1>()
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const commandId = entry.name.endsWith('.json') ? entry.name.slice(0, -5) : ''
    if (!entry.isFile() || !EXACT_UUID.test(commandId)) throw new Error('runner claim authority root contains an unexpected entry')
    const path = join(root, entry.name)
    const journal = verifyClaimedCommandJournal(JSON.parse(await readFile(path, 'utf8')), signingKey)
    if (journal.command.command_id !== commandId || runnerId !== undefined && journal.runner_id !== runnerId) throw new Error('claimed command journal failed identity validation')
    claims.set(commandId, { path, journal })
  }
  return claims
}

function assertReceiptClaimBinding(
  receipt: RunnerReceiptV1,
  idempotencyKey: string,
  claim: AuthenticatedClaimV1 | undefined,
  runnerId?: string,
): RunnerCommandEnvelopeV1 {
  if (!claim
    || claim.journal.command.command_id !== receipt.command_id
    || claim.journal.command.command_hash !== receipt.command_hash
    || claim.journal.command.idempotency_key !== idempotencyKey
    || claim.journal.command.job_id !== receipt.job_id
    || runnerId !== undefined && claim.journal.runner_id !== runnerId) throw new Error('stored runner receipt has no matching authenticated command claim')
  return claim.journal.command
}

async function listAuthenticatedAcknowledgedReceipts(
  signingKey: Buffer,
  runtimeRoot?: string,
  runnerId?: string,
  claimInventory?: Map<string, AuthenticatedClaimV1>,
): Promise<AuthenticatedAcknowledgedReceiptV1[]> {
  const claims = claimInventory ?? await listAuthenticatedClaims(signingKey, runtimeRoot, runnerId)
  const root = join(runnerRoot(runtimeRoot), 'receipts', 'acknowledged')
  let directories
  try { directories = await readdir(root, { withFileTypes: true }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  const acknowledged: AuthenticatedAcknowledgedReceiptV1[] = []
  const seenCommands = new Set<string>()
  for (const directory of directories.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!directory.isDirectory() || !EXACT_UUID.test(directory.name)) throw new Error('acknowledged runner receipt root contains an unexpected entry')
    const entries = await readdir(join(root, directory.name), { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const commandId = entry.name.endsWith('.json') ? entry.name.slice(0, -5) : ''
      if (!entry.isFile() || !EXACT_UUID.test(commandId)) throw new Error('acknowledged runner receipt directory contains an unexpected entry')
      if (seenCommands.has(commandId)) throw new Error('acknowledged runner receipt command appears more than once')
      const path = join(root, directory.name, entry.name)
      const stored = verifyStoredRunnerReceipt(JSON.parse(await readFile(path, 'utf8')), signingKey)
      if (stored.receipt.command_id !== commandId) throw new Error('acknowledged runner receipt identity does not match its location')
      const matchingClaim = claims.get(commandId)
      if (!matchingClaim && stored.receipt.status !== 'failed') throw new Error('acknowledged non-failed runner receipt has no matching authenticated command claim')
      const command = matchingClaim ? assertReceiptClaimBinding(stored.receipt, directory.name, matchingClaim, runnerId) : null
      acknowledged.push({ path, idempotency_key: directory.name, receipt: stored.receipt, command, legacy_source_cursor: stored.legacy_source_cursor })
      seenCommands.add(commandId)
    }
  }
  return acknowledged
}

async function listAuthenticatedPendingReceipts(signingKey: Buffer, runtimeRoot?: string, runnerId?: string, claimInventory?: Map<string, AuthenticatedClaimV1>): Promise<AuthenticatedPendingReceiptJournalV1[]> {
  const claims = claimInventory ?? await listAuthenticatedClaims(signingKey, runtimeRoot, runnerId)
  const root = join(runnerRoot(runtimeRoot), 'receipts', 'pending')
  let directories
  try {
    directories = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const pending: AuthenticatedPendingReceiptJournalV1[] = []
  for (const directory of directories.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!directory.isDirectory() || !EXACT_UUID.test(directory.name)) throw new Error('pending runner receipt root contains an unexpected entry')
    const entries = await readdir(join(root, directory.name), { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const commandId = entry.name.endsWith('.json') ? entry.name.slice(0, -5) : ''
      if (!entry.isFile() || !EXACT_UUID.test(commandId)) throw new Error('pending runner receipt directory contains an unexpected entry')
      const path = join(root, directory.name, entry.name)
      const value: unknown = JSON.parse(await readFile(path, 'utf8'))
      if (!isPendingJournal(value)
        || value.idempotency_key !== directory.name
        || value.receipt.command_id !== commandId
        || runnerId !== undefined && value.runner_id !== runnerId) throw new Error('pending runner receipt journal failed identity validation')
      const stored = verifyStoredRunnerReceipt(value.receipt, signingKey)
      const claim = claims.get(stored.receipt.command_id)
      if (claim?.journal.runner_id !== value.runner_id) throw new Error('pending runner receipt has no matching authenticated command claim')
      const command = assertReceiptClaimBinding(stored.receipt, value.idempotency_key, claim, runnerId)
      pending.push({ ...value, receipt: stored.receipt, path, command, legacy_source_cursor: stored.legacy_source_cursor })
    }
  }
  const seenJobs = new Set<string>()
  for (const journal of pending) {
    if (seenJobs.has(journal.command.job_id)) throw new Error('multiple authenticated pending runner receipts exist for one job')
    seenJobs.add(journal.command.job_id)
  }
  return pending
}

function receiptConflictHashInput(value: RunnerReceiptConflictBodyV1): RunnerReceiptConflictBodyV1 {
  return value
}

function verifyReceiptConflict(value: unknown, signingKey: Buffer): SignedRunnerReceiptConflictV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('runner receipt conflict journal is invalid')
  const record = value as Record<string, unknown>
  if (Object.keys(record).sort().join(',') !== [
    'schema_version',
    'safe_code',
    'quarantined_at',
    'idempotency_key',
    'runner_id',
    'lease_token_hash',
    'receipt',
    'conflict_hash',
    'conflict_signature',
  ].sort().join(',')) throw new Error('runner receipt conflict journal has unexpected fields')
  if (record.schema_version !== 1
    || typeof record.safe_code !== 'string' || !receiptAuthorityConflictSafeCodes.has(record.safe_code)
    || typeof record.quarantined_at !== 'string' || !Number.isFinite(Date.parse(record.quarantined_at))
    || typeof record.idempotency_key !== 'string' || !EXACT_UUID.test(record.idempotency_key)
    || typeof record.runner_id !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(record.runner_id)
    || typeof record.lease_token_hash !== 'string' || !/^[a-f0-9]{64}$/.test(record.lease_token_hash)
    || typeof record.conflict_hash !== 'string' || !/^[a-f0-9]{64}$/.test(record.conflict_hash)
    || typeof record.conflict_signature !== 'string' || !/^[a-f0-9]{64}$/.test(record.conflict_signature)) throw new Error('runner receipt conflict journal metadata is invalid')
  const receipt = verifyStoredRunnerReceipt(record.receipt, signingKey).receipt
  const body: RunnerReceiptConflictBodyV1 = {
    schema_version: 1,
    safe_code: record.safe_code as RunnerReceiptAuthorityConflictSafeCode,
    quarantined_at: record.quarantined_at,
    idempotency_key: record.idempotency_key,
    runner_id: record.runner_id,
    lease_token_hash: record.lease_token_hash,
    receipt,
  }
  if (hashValue(receiptConflictHashInput(body)) !== record.conflict_hash
    || !verifyRunnerReceiptHash(signingKey, record.conflict_hash, record.conflict_signature)) throw new Error('runner receipt conflict journal failed authentication')
  return { ...body, conflict_hash: record.conflict_hash, conflict_signature: record.conflict_signature }
}

async function listAuthenticatedReceiptConflicts(signingKey: Buffer, runtimeRoot?: string, runnerId?: string, claimInventory?: Map<string, AuthenticatedClaimV1>): Promise<AuthenticatedReceiptConflictV1[]> {
  const claims = claimInventory ?? await listAuthenticatedClaims(signingKey, runtimeRoot, runnerId)
  const root = join(runnerRoot(runtimeRoot), 'receipts', 'conflicted')
  let directories
  try { directories = await readdir(root, { withFileTypes: true }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  const conflicts: AuthenticatedReceiptConflictV1[] = []
  for (const directory of directories.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!directory.isDirectory() || !EXACT_UUID.test(directory.name)) throw new Error('conflicted runner receipt root contains an unexpected entry')
    const entries = await readdir(join(root, directory.name), { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const commandId = entry.name.endsWith('.json') ? entry.name.slice(0, -5) : ''
      if (!entry.isFile() || !EXACT_UUID.test(commandId)) throw new Error('conflicted runner receipt directory contains an unexpected entry')
      const path = join(root, directory.name, entry.name)
      const conflict = verifyReceiptConflict(JSON.parse(await readFile(path, 'utf8')), signingKey)
      if (conflict.idempotency_key !== directory.name
        || conflict.receipt.command_id !== commandId
        || runnerId !== undefined && conflict.runner_id !== runnerId) throw new Error('conflicted runner receipt journal failed identity validation')
      const claim = claims.get(commandId)
      if (claim?.journal.runner_id !== conflict.runner_id) throw new Error('conflicted runner receipt has no matching authenticated command claim')
      const command = assertReceiptClaimBinding(conflict.receipt, conflict.idempotency_key, claim, runnerId)
      conflicts.push({ ...conflict, path, command })
    }
  }
  return conflicts
}

async function quarantinePendingReceiptConflict(
  pending: AuthenticatedPendingReceiptJournalV1,
  signingKey: Buffer,
  safeCode: RunnerReceiptAuthorityConflictSafeCode,
  quarantinedAt: string,
  runtimeRoot?: string,
): Promise<SignedRunnerReceiptConflictV1> {
  const body: RunnerReceiptConflictBodyV1 = {
    schema_version: 1,
    safe_code: safeCode,
    quarantined_at: quarantinedAt,
    idempotency_key: pending.idempotency_key,
    runner_id: pending.runner_id,
    lease_token_hash: hashValue(pending.lease_token),
    receipt: pending.receipt,
  }
  const conflictHash = hashValue(receiptConflictHashInput(body))
  const conflict: SignedRunnerReceiptConflictV1 = {
    ...body,
    conflict_hash: conflictHash,
    conflict_signature: signRunnerReceiptHash(signingKey, conflictHash),
  }
  const path = receiptConflictPath(pending.idempotency_key, pending.receipt.command_id, runtimeRoot)
  try {
    const existing = verifyReceiptConflict(JSON.parse(await readFile(path, 'utf8')), signingKey)
    if (existing.receipt.receipt_hash !== pending.receipt.receipt_hash
      || existing.runner_id !== pending.runner_id
      || existing.idempotency_key !== pending.idempotency_key
      || existing.safe_code !== safeCode) throw new Error('runner receipt conflict location contains different authenticated evidence')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await writeRunnerAuthorityJsonAtomic(path, conflict, runtimeRoot)
  }
  try { await unlink(pending.path) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  return conflict
}

interface RunnerReceiptAuthorityInventoryV1 {
  claims: Map<string, AuthenticatedClaimV1>
  pending: AuthenticatedPendingReceiptJournalV1[]
  acknowledged: AuthenticatedAcknowledgedReceiptV1[]
  conflicts: AuthenticatedReceiptConflictV1[]
}

async function inspectRunnerReceiptAuthority(signingKey: Buffer, runtimeRoot?: string, runnerId?: string): Promise<RunnerReceiptAuthorityInventoryV1> {
  const claims = await listAuthenticatedClaims(signingKey, runtimeRoot, runnerId)
  const [pending, acknowledged, conflicts] = await Promise.all([
    listAuthenticatedPendingReceipts(signingKey, runtimeRoot, runnerId, claims),
    listAuthenticatedAcknowledgedReceipts(signingKey, runtimeRoot, runnerId, claims),
    listAuthenticatedReceiptConflicts(signingKey, runtimeRoot, runnerId, claims),
  ])
  const receipts = [...pending, ...acknowledged, ...conflicts].map((value) => ({ command_id: value.receipt.command_id, receipt_hash: value.receipt.receipt_hash }))
  const byCommand = new Map<string, string>()
  for (const receipt of receipts) {
    const existing = byCommand.get(receipt.command_id)
    if (existing && existing !== receipt.receipt_hash) throw new Error('runner receipt authority contains conflicting results for one command')
    byCommand.set(receipt.command_id, receipt.receipt_hash)
  }
  return { claims, pending, acknowledged, conflicts }
}

async function runnerReceiptJournalStatus(signingKey: Buffer, runtimeRoot?: string, runnerId?: string): Promise<RunnerReceiptJournalStatusV1> {
  const { pending, conflicts } = await inspectRunnerReceiptAuthority(signingKey, runtimeRoot, runnerId)
  return {
    pending_receipts: pending.length,
    conflicted_receipts: conflicts.length,
    recovery_conflicts: conflicts.filter((conflict) => conflict.safe_code === 'recovery_exists').length,
    authority_conflicts: conflicts.filter((conflict) => conflict.safe_code !== 'recovery_exists').length,
    receipt_attention_code: conflicts.some((conflict) => conflict.safe_code !== 'recovery_exists')
      ? 'runner_receipt_authority_conflict'
      : conflicts.length > 0 ? 'runner_receipt_recovery_conflict' : null,
  }
}

export async function assertRunnerProjectHasNoPendingCommandReceipt(jobId: string, signingKey: Buffer, runtimeRoot?: string): Promise<void> {
  if ((await listAuthenticatedPendingReceipts(signingKey, runtimeRoot)).some((pending) => pending.command.job_id === jobId)) throw new Error('runner project is blocked until every pending command receipt for its job is acknowledged')
}

function heartbeat(
  options: Pick<RunnerCycleOptions, 'runnerId' | 'softwareCommit'>,
  driveState: RunnerHeartbeatV1['drive_state'],
  status: RunnerHeartbeatV1['status'],
  pendingReceipts: number,
  occurredAt: string,
  activeCommandId?: string,
): RunnerHeartbeatV1 {
  return {
    schema_version: 1,
    runner_id: options.runnerId,
    software_commit: options.softwareCommit,
    command_schema_versions: [1],
    status,
    drive_state: driveState,
    ...(activeCommandId ? { active_command_id: activeCommandId } : {}),
    pending_receipts: pendingReceipts,
    occurred_at: occurredAt,
  }
}

async function currentDriveState(options: Pick<RunnerCycleOptions, 'driveState'>): Promise<RunnerHeartbeatV1['drive_state']> {
  return typeof options.driveState === 'function' ? options.driveState() : options.driveState
}

function assertDispatchLease(context?: RunnerDispatchContext): void {
  context?.assertLeaseActive?.()
}

const GATE_NAMES = ['truth', 'rights', 'confidentiality', 'transcript_fidelity', 'naming'] as const

function pendingHardGates(detail: string): RunnerHardGatesV1 {
  return Object.fromEntries(GATE_NAMES.map((gate) => [gate, { status: 'pending', detail }])) as RunnerHardGatesV1
}

function passedHardGates(): RunnerHardGatesV1 {
  return Object.fromEntries(GATE_NAMES.map((gate) => [gate, { status: 'passed' }])) as RunnerHardGatesV1
}

function cloudHardGates(gates: MagicEditGateResultsV1): RunnerHardGatesV1 {
  return Object.fromEntries(GATE_NAMES.map((gate) => {
    const value = gates[gate]
    return [gate, { status: value.status, ...(value.codes.length ? { detail: value.codes.join(', ').slice(0, 240) } : {}) }]
  })) as RunnerHardGatesV1
}

function selectionLabel(command: Extract<RunnerCommandEnvelopeV1, { command_kind: 'magic_edit_prepare' }>): string {
  const selection = command.payload.selection
  if (selection.kind === 'moment') return `At ${(selection.at_ms / 1000).toFixed(1)}s`
  if (selection.kind === 'range') return `${(selection.start_ms / 1000).toFixed(1)}s–${(selection.end_ms / 1000).toFixed(1)}s`
  return 'Mapped selection'
}

function reviewTarget(command: Extract<RunnerCommandEnvelopeV1, { command_kind: 'magic_edit_prepare' }>, candidate?: MagicEditCandidateV1): RunnerReviewTargetV1 {
  const selection = command.payload.selection
  if (selection.kind === 'moment') return { kind: 'moment', start_ms: selection.at_ms }
  if (selection.kind === 'range') return { kind: 'range', start_ms: selection.start_ms, end_ms: selection.end_ms }
  const operation = candidate?.operations[0]?.operation
  const reference = selection.target_ids[0]!
  if (operation === 'caption_emphasis' || reference.startsWith('caption-')) return { kind: 'caption_block', ref: reference }
  if (operation?.startsWith('overlay_') || reference.startsWith('overlay-')) return { kind: 'overlay', ref: reference }
  return { kind: 'beat', ref: reference }
}

function changeDescription(candidate: MagicEditCandidateV1): { title: string; changes: string[] } {
  const descriptions: Record<MagicEditCandidateV1['change_codes'][number], string> = {
    camera_crop_changed: 'Adjusted the existing camera crop inside its approved shot.',
    caption_emphasis_changed: 'Changed emphasis styling without changing any spoken word.',
    overlay_anchor_changed: 'Moved an existing overlay to an approved face-safe anchor.',
    overlay_opacity_changed: 'Adjusted the visibility of an existing approved overlay.',
    overlay_timing_changed: 'Moved existing approved proof earlier or later inside its declared narrative beat.',
  }
  const changes = candidate.change_codes.slice(0, 4).map((code) => descriptions[code])
  const title = candidate.change_codes.length === 1 && candidate.change_codes[0] === 'overlay_timing_changed'
    ? 'Proof timing adjusted'
    : 'Bounded visual edit prepared'
  return { title, changes }
}

function candidateResultRefs(
  command: Extract<RunnerCommandEnvelopeV1, { command_kind: 'magic_edit_prepare' }>,
  candidate: MagicEditCandidateV1,
  reviewId: string,
  before: PublishedPreview,
  after: PublishedPreview,
  comparison: { start_ms: number; end_ms: number },
): RunnerResultRefsV1 {
  const hardGates = cloudHardGates(candidate.gates)
  const change = changeDescription(candidate)
  const blockCodes = [...candidate.hard_blocks, ...candidate.soft_blocks].slice(0, 4)
  return {
    review_id: reviewId,
    candidate_hash: candidate.candidate_hash,
    safe_title: change.title,
    safe_summary: `Prepared ${candidate.operations.length} schema-bounded visual edit${candidate.operations.length === 1 ? '' : 's'} without changing spoken words, claims, or evidence content.`,
    review_payload: {
      direction: command.payload.instruction,
      change_title: change.title,
      change_summary: 'This proposal changes only approved presentation controls. Activation remains a separate, exact-hash action.',
      range_label: selectionLabel(command),
      changes: change.changes,
      blocking_gates: hardGates,
      target: reviewTarget(command, candidate),
      semantic_target_map_hash: candidate.semantic_target_map_hash,
      ...(blockCodes.length ? { editorial_note: `Review required: ${blockCodes.join(', ').slice(0, 560)}` } : {}),
    },
    before_preview_object_key: before.object_key,
    before_preview_hash: before.sha256,
    before_preview_md5: before.md5,
    before_preview_byte_size: before.byte_size,
    after_preview_object_key: after.object_key,
    after_preview_hash: after.sha256,
    after_preview_md5: after.md5,
    after_preview_byte_size: after.byte_size,
    comparison_alignment: 'exact',
    comparison_start_ms: comparison.start_ms,
    comparison_end_ms: comparison.end_ms,
  }
}

function magicCandidateReviewId(command: Extract<RunnerCommandEnvelopeV1, { command_kind: 'magic_edit_prepare' }>, candidateHash: string | null): string {
  return deterministicRunnerReviewId({
    schema_version: 1,
    kind: candidateHash ? 'magic_candidate_review' : 'magic_editorial_route_review',
    command_hash: command.command_hash,
    job_id: command.job_id,
    platform: command.platform,
    candidate_hash: candidateHash,
    parent_revision_hash: command.expected_parent_revision_hash,
    parent_artifact_hash: command.expected_parent_artifact_hash,
    semantic_target_map_hash: command.semantic_target_map_hash,
  })
}

function activationReviewId(confirmationRef: string): string {
  const match = /:review:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):decision:/i.exec(confirmationRef)
  if (!match?.[1]) throw new Error('activation confirmation does not contain an exact review ID')
  return match[1].toLowerCase()
}

async function resolveLearningArtifact(artifactHash: string): Promise<{ schema: 'feedback_v1' | 'feedback_v2' | 'preference_rule_v1' }> {
  const learningRoot = join(studioPaths().runtimeRoot, 'learning')
  for (const [name, schema, parser] of [
    ['feedback.jsonl', 'feedback_v1', FeedbackEventV1Schema],
    ['feedback-v2.jsonl', 'feedback_v2', FeedbackEventV2Schema],
  ] as const) {
    try {
      const lines = (await readFile(join(learningRoot, name), 'utf8')).split(/\r?\n/).filter(Boolean)
      for (const line of lines) {
        const value = parser.parse(JSON.parse(line))
        if (hashValue(value) === artifactHash) return { schema }
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  try {
    const rules: unknown = JSON.parse(await readFile(join(learningRoot, 'rules.json'), 'utf8'))
    if (!Array.isArray(rules)) throw new Error('learning preference rule ledger is invalid')
    for (const item of rules) {
      const rule = PreferenceRuleV1Schema.parse(item)
      if (hashValue(rule) === artifactHash) return { schema: 'preference_rule_v1' }
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  throw new Error('learning review does not bind an exact schema-validated persisted artifact')
}

function assertBindingMatchesDecision(binding: RunnerLocalReviewBindingV1, decision: ReviewDecisionRecordV1): void {
  const exact = binding.job_id === decision.job_id
    && binding.platform === decision.platform
    && binding.review_id === decision.review_id
    && binding.gate === decision.gate
    && binding.parent_revision_hash === decision.expected_parent_revision_hash
    && binding.parent_artifact_hash === decision.expected_parent_artifact_hash
    && binding.review_revision_hash === decision.review_revision_hash
    && binding.review_artifact_hash === decision.review_artifact_hash
    && binding.candidate_hash === decision.candidate_hash
    && binding.semantic_target_map_hash === decision.semantic_target_map_hash
  if (!exact) throw new Error('review decision does not bind the exact authenticated local review identity')
}

async function assertGateSpecificReviewCurrent(binding: RunnerLocalReviewBindingV1): Promise<void> {
  const job = await loadJobV2(binding.job_id)
  if (!job.target_platforms.includes(binding.platform)) throw new Error('local review platform is not configured for the job')
  if (binding.provenance.kind === 'treatment') {
    if (job.stages.treatment.artifact_hash !== binding.parent_artifact_hash) throw new Error('treatment review parent is not the exact current treatment artifact')
    if (binding.review_artifact_hash !== binding.provenance.treatment_artifact_hash
      || binding.review_artifact_hash !== binding.parent_artifact_hash
      || binding.review_revision_hash !== binding.parent_revision_hash) throw new Error('treatment review identity is not the exact current treatment and revision')
    return
  }
  if (binding.provenance.kind === 'story') {
    const candidates = await readStageArtifactV2(binding.job_id, 'candidates')
    if (candidates.artifact_hash !== binding.provenance.candidates_stage_artifact_hash
      || binding.review_artifact_hash !== candidates.artifact_hash
      || binding.parent_artifact_hash !== candidates.artifact_hash) throw new Error('story review identity is not the exact current candidate projection')
    const expectedRevision = hashValue({ schema_version: 1, kind: 'story_review_revision', job_id: binding.job_id, platform: binding.platform, parent_revision_hash: binding.parent_revision_hash, parent_artifact_hash: binding.parent_artifact_hash, candidates_artifact_hash: candidates.artifact_hash })
    if (binding.review_revision_hash !== expectedRevision) throw new Error('story review revision is not deterministic for the exact candidate projection')
    return
  }
  if (binding.provenance.kind === 'learning') {
    if (job.stages.treatment.artifact_hash !== binding.parent_artifact_hash) throw new Error('learning review parent is not the exact current treatment artifact')
    const learning = await resolveLearningArtifact(binding.review_artifact_hash)
    if (binding.provenance.learning_artifact_hash !== binding.review_artifact_hash || binding.provenance.learning_artifact_schema !== learning.schema) throw new Error('learning review identity does not match its schema-validated artifact')
    const expectedRevision = hashValue({ schema_version: 1, kind: 'learning_review_revision', job_id: binding.job_id, platform: binding.platform, parent_revision_hash: binding.parent_revision_hash, parent_artifact_hash: binding.parent_artifact_hash, learning_artifact_hash: binding.review_artifact_hash, learning_artifact_schema: learning.schema })
    if (binding.review_revision_hash !== expectedRevision) throw new Error('learning review revision is not deterministic for the exact learning artifact')
    return
  }
  if (binding.provenance.kind === 'magic_candidate') {
    const candidate = await loadMagicEditCandidate(binding.job_id, binding.provenance.candidate_hash)
    if (candidate.platform !== binding.platform
      || candidate.expected_parent_revision_hash !== binding.parent_revision_hash
      || candidate.expected_parent_artifact_hash !== binding.parent_artifact_hash
      || candidate.prepared_treatment_artifact_hash !== binding.review_artifact_hash
      || candidate.semantic_target_map_hash !== binding.semantic_target_map_hash) throw new Error('magic review identity does not bind the exact prepared candidate lineage')
    const currentTreatmentHash = job.stages.treatment.artifact_hash
    if (currentTreatmentHash !== binding.parent_artifact_hash) {
      if (currentTreatmentHash !== candidate.prepared_treatment_artifact_hash
        || !hasApprovalV2(job, 'treatment', candidate.prepared_treatment_artifact_hash, 'krish')) throw new Error('magic review parent is not the exact current treatment artifact or its already activated candidate')
    }
    return
  }

  if (job.stages.treatment.artifact_hash !== binding.parent_artifact_hash) throw new Error('final review parent is not the exact current treatment artifact')
  const render = await readStageArtifactV2(binding.job_id, 'render')
  const renderPayload = RenderStagePayloadV2Schema.parse(render.payload)
  const platformRender = renderPayload.renders.find((item) => item.platform === binding.platform)
  if (!platformRender || render.artifact_hash !== binding.provenance.render_stage_artifact_hash
    || render.input_hashes.treatment !== binding.parent_artifact_hash
    || platformRender.master_hash !== binding.provenance.platform_master_hash
    || platformRender.master_hash !== binding.review_artifact_hash
    || platformRender.manifest_hash !== binding.provenance.render_manifest_hash
    || await hashFile(resolve(platformRender.master_path)) !== platformRender.master_hash) throw new Error('final review identity is not the exact current platform master')
  const qa = await readStageArtifactV2(binding.job_id, 'qa')
  if (qa.artifact_hash !== binding.provenance.qa_stage_artifact_hash
    || qa.input_hashes.render !== render.artifact_hash
    || binding.provenance.qa_render_input_hash !== render.artifact_hash
    || !qaPayloadPassed(qa.payload, binding.platform)) throw new Error('final review identity is not bound to current passing QA and render')
  const expectedRevision = hashValue({ schema_version: 1, kind: 'final_review_revision', job_id: binding.job_id, platform: binding.platform, parent_revision_hash: binding.parent_revision_hash, parent_artifact_hash: binding.parent_artifact_hash, render_artifact_hash: render.artifact_hash, render_manifest_hash: platformRender.manifest_hash, qa_artifact_hash: qa.artifact_hash, artifact_hash: platformRender.master_hash })
  if (binding.review_revision_hash !== expectedRevision) throw new Error('final review revision is not deterministic for the exact master, render, and QA')
}

async function recordRunnerReviewDecision(
  command: Extract<RunnerCommandEnvelopeV1, { command_kind: 'review_decision_record' }>,
  context: RunnerDispatchContext,
): Promise<RunnerDispatchResult> {
  return withJobEventLock(command.job_id, async () => {
  const decision = command.payload
  const job = await loadJobV2(command.job_id)
  const existing = await findRecordedReviewDecisionV2(command.job_id, decision, { command_id: command.command_id, command_hash: command.command_hash })
  const binding = await loadLocalReviewBinding(command.job_id, decision.review_id)
  assertBindingMatchesDecision(binding, decision)
  await assertGateSpecificReviewCurrent(binding)
  if (!existing) {
    if (jobRevisionHashV2(job) !== command.expected_parent_revision_hash) throw new Error('review decision is stale against the exact current parent revision')
    if (decision.gate !== 'story') {
      const targetMap = await createMagicEditTargetMap(command.job_id, command.platform)
      if (targetMap.semantic_target_map_hash !== decision.semantic_target_map_hash) throw new Error('review decision semantic target map is stale')
    }
  }
  assertDispatchLease(context)
  await recordReviewDecisionV2(command.job_id, decision, { command_id: command.command_id, command_hash: command.command_hash })
  if (decision.decision === 'use_candidate' && decision.gate !== 'learning') {
    const approvalGate = decision.gate === 'story' ? 'angle' : decision.gate
    const current = await loadJobV2(command.job_id)
    if (!hasApprovalV2(current, approvalGate, decision.review_artifact_hash, 'krish')) {
      assertDispatchLease(context)
      await recordApprovalV2(
        command.job_id,
        approvalGate,
        decision.override_reason ? 'override' : 'approved',
        decision.review_artifact_hash,
        decision.override_reason ?? undefined,
        'krish',
        `control-center-confirmation:${approvalGate}:${decision.review_artifact_hash}:review:${decision.review_id}:decision:${decision.decision_id}`,
      )
    }
  }
  const updated = await loadJobV2(command.job_id)
  const updatedRevisionHash = jobRevisionHashV2(updated)
  if (updatedRevisionHash === decision.expected_parent_revision_hash) throw new Error('signed review decision did not advance the local job revision')
  assertDispatchLease(context)
  let reboundTargetMapHash: string
  if (decision.gate === 'story') {
    reboundTargetMapHash = await createLocalReviewSemanticMap({ job_id: command.job_id, platform: command.platform, gate: 'story', parent_revision_hash: updatedRevisionHash, parent_artifact_hash: decision.expected_parent_artifact_hash, target: binding.review_target })
  } else {
    const reboundTargetMap = await createMagicEditTargetMap(command.job_id, command.platform)
    if (reboundTargetMap.expected_parent_revision_hash !== updatedRevisionHash || reboundTargetMap.expected_parent_artifact_hash !== decision.expected_parent_artifact_hash) throw new Error('review decision target map did not bind the new local revision')
    reboundTargetMapHash = reboundTargetMap.semantic_target_map_hash
  }
  return {
    status: 'succeeded',
    result_revision_hash: updatedRevisionHash,
    result_artifact_hash: decision.expected_parent_artifact_hash,
    result_refs: { semantic_target_map_hash: reboundTargetMapHash, comparison_alignment: 'unavailable' },
    hard_gates: pendingHardGates('review_decision_recorded'),
  }
  })
}

function assertRecoverySourceBinding(binding: RunnerLocalReviewBindingV1, recovery: ReviewRecoveryRecordV1): void {
  if (binding.review_id !== recovery.source_review_id
    || binding.job_id !== recovery.job_id
    || binding.platform !== recovery.platform
    || binding.gate !== recovery.gate
    || binding.parent_revision_hash !== recovery.expected_parent_revision_hash
    || binding.parent_artifact_hash !== recovery.expected_parent_artifact_hash
    || binding.review_revision_hash !== recovery.review_revision_hash
    || binding.review_artifact_hash !== recovery.review_artifact_hash
    || binding.candidate_hash !== recovery.candidate_hash
    || binding.semantic_target_map_hash !== recovery.semantic_target_map_hash) throw new Error('review recovery does not exactly clone its authenticated source review')
  if (recovery.recovery_generation > 1) {
    const prior = binding.recovery_provenance
    if (!prior || prior.recovery_generation !== recovery.recovery_generation - 1
      || prior.recovery_root_command_id !== recovery.recovery_root_command_id) throw new Error('review recovery generation does not continue the signed local recovery chain')
  }
}

function assertClaimedCommandMatchesRecoverySource(
  journal: SignedClaimedRunnerCommandJournalV1,
  binding: RunnerLocalReviewBindingV1,
  recovery: ReviewRecoveryRecordV1,
): void {
  const source = journal.command
  if (source.command_id !== recovery.source_command_id
    || source.command_hash !== recovery.source_command_hash
    || source.job_id !== recovery.job_id
    || source.platform !== recovery.platform
    || source.expected_parent_revision_hash !== recovery.expected_parent_revision_hash
    || source.expected_parent_artifact_hash !== recovery.expected_parent_artifact_hash
    || source.candidate_hash !== recovery.candidate_hash
    || source.semantic_target_map_hash !== recovery.semantic_target_map_hash) throw new Error('review recovery claim journal does not match its declared source lineage')

  if (source.command_kind === 'review_decision_record') {
    const decision = source.payload
    if (decision.review_id !== binding.review_id
      || decision.gate !== binding.gate
      || decision.review_revision_hash !== binding.review_revision_hash
      || decision.review_artifact_hash !== binding.review_artifact_hash
      || decision.candidate_hash !== binding.candidate_hash
      || decision.semantic_target_map_hash !== binding.semantic_target_map_hash) throw new Error('review recovery claim journal does not target the authenticated source review')
    return
  }

  if (source.command_kind === 'magic_edit_activate') {
    if (binding.gate !== 'treatment'
      || activationReviewId(source.payload.confirmation_ref) !== binding.review_id
      || source.payload.candidate_hash !== binding.candidate_hash
      || source.payload.candidate_hash !== binding.review_revision_hash
      || source.payload.prepared_treatment_artifact_hash !== binding.review_artifact_hash) throw new Error('review recovery activation journal does not target the authenticated source review')
    return
  }

  throw new Error('review recovery supports only terminal review decisions or activations')
}

async function recordRunnerReviewRecovery(
  command: Extract<RunnerCommandEnvelopeV1, { command_kind: 'review_recovery_record' }>,
  context: RunnerDispatchContext,
): Promise<RunnerDispatchResult> {
  return withJobEventLock(command.job_id, async () => {
    const recovery = command.payload
    const sourceBinding = await loadLocalReviewBinding(command.job_id, recovery.source_review_id)
    assertRecoverySourceBinding(sourceBinding, recovery)
    await assertGateSpecificReviewCurrent(sourceBinding)
    if (recovery.recovery_generation === 1 && recovery.source_command_id !== recovery.recovery_root_command_id) throw new Error('first review recovery generation does not bind its root command')

    let sourceEvidence: NonNullable<RunnerLocalReviewBindingV1['recovery_provenance']>['source_evidence']
    if (recovery.source_terminal_reason === 'runner_failed_receipt') {
      const sourceReceipt = await findSignedReceiptByCommandIdentity(recovery.source_command_id, recovery.source_command_hash, command.job_id, context.signingKey, context.runtimeRoot)
      if (sourceReceipt.status !== 'failed' || sourceReceipt.retryable !== false) throw new Error('review recovery source command is not an exact terminal failed receipt')
      const sourceJournal = await loadClaimedCommandJournal(recovery.source_command_id, context.signingKey, context.runtimeRoot)
      if (sourceJournal) assertClaimedCommandMatchesRecoverySource(sourceJournal, sourceBinding, recovery)
      sourceEvidence = 'signed_failed_receipt'
    } else if (recovery.source_terminal_reason === 'attempts_exhausted') {
      if (await optionallyFindSignedReceiptByCommandIdentity(recovery.source_command_id, recovery.source_command_hash, command.job_id, context.signingKey, context.runtimeRoot)) throw new Error('attempts-exhausted recovery cannot substitute for a signed terminal receipt')
      const sourceJournal = await loadClaimedCommandJournal(recovery.source_command_id, context.signingKey, context.runtimeRoot)
      if (!sourceJournal) throw new Error('attempts-exhausted recovery requires an authenticated claimed-command journal')
      assertClaimedCommandMatchesRecoverySource(sourceJournal, sourceBinding, recovery)
      sourceEvidence = 'signed_claim_journal'
    } else {
      if (await optionallyFindSignedReceiptByCommandIdentity(recovery.source_command_id, recovery.source_command_hash, command.job_id, context.signingKey, context.runtimeRoot)) throw new Error('command-expired recovery cannot substitute for a signed terminal receipt')
      if (await loadClaimedCommandJournal(recovery.source_command_id, context.signingKey, context.runtimeRoot)) throw new Error('command-expired recovery requires a source command that was never claimed locally')
      sourceEvidence = 'cloud_terminal_without_receipt'
    }

    const { binding_hash: _bindingHash, binding_signature: _bindingSignature, review_id: _sourceReviewId, recovery_provenance: _priorRecovery, ...sourceBody } = sourceBinding
    assertDispatchLease(context)
    await persistLocalReviewBinding({
      ...sourceBody,
      review_id: recovery.recovery_review_id,
      recovery_provenance: {
        recovery_id: recovery.recovery_id,
        source_review_id: recovery.source_review_id,
        source_command_id: recovery.source_command_id,
        source_command_hash: recovery.source_command_hash,
        source_terminal_reason: recovery.source_terminal_reason,
        source_evidence: sourceEvidence,
        recovery_root_command_id: recovery.recovery_root_command_id,
        recovery_generation: recovery.recovery_generation,
        bridge_command_id: command.command_id,
        bridge_command_hash: command.command_hash,
      },
    })
    assertDispatchLease(context)
    await recordReviewRecoveryV2(command.job_id, recovery, { command_id: command.command_id, command_hash: command.command_hash })
    const job = await loadJobV2(command.job_id)
    const revision = jobRevisionHashV2(job)
    if (revision !== recovery.expected_parent_revision_hash || job.stages.treatment.artifact_hash !== recovery.expected_parent_artifact_hash && recovery.gate !== 'story') throw new Error('review recovery changed active local authority unexpectedly')
    return {
      status: 'succeeded',
      result_revision_hash: recovery.expected_parent_revision_hash,
      result_artifact_hash: recovery.expected_parent_artifact_hash,
      result_refs: { comparison_alignment: 'unavailable' },
      hard_gates: sourceBinding.hard_gates,
    }
  })
}

export async function dispatchRunnerCommand(commandInput: RunnerCommandEnvelopeV1, context?: RunnerDispatchContext): Promise<RunnerDispatchResult> {
  const command = RunnerCommandEnvelopeV1Schema.parse(commandInput)
  if (hashValue(command.payload) !== command.payload_hash || hashValue(runnerCommandHashInputV1(command)) !== command.command_hash) throw new Error('runner command identity hash is invalid')
  const mutationOptions = context?.assertLeaseActive ? { assertMutationAllowed: context.assertLeaseActive } : {}
  if (command.command_kind === 'review_decision_record') {
    if (!context) throw new Error('signed review decision recorder is unavailable')
    return recordRunnerReviewDecision(command, context)
  }
  if (command.command_kind === 'review_recovery_record') {
    if (!context) throw new Error('signed review recovery recorder is unavailable')
    return recordRunnerReviewRecovery(command, context)
  }
  if (command.command_kind === 'magic_edit_prepare') {
    const prepared = await prepareMagicEditCandidate(command.job_id, command.payload, mutationOptions)
    if ('status' in prepared && prepared.status === 'requires_editorial_route') {
      const reviewId = magicCandidateReviewId(command, null)
      assertDispatchLease(context)
      await persistLocalReviewBinding({
        schema_version: 1,
        review_id: reviewId,
        job_id: command.job_id,
        platform: command.platform,
        gate: 'treatment',
        parent_revision_hash: command.expected_parent_revision_hash,
        parent_artifact_hash: command.expected_parent_artifact_hash,
        review_revision_hash: command.expected_parent_revision_hash,
        review_artifact_hash: command.expected_parent_artifact_hash,
        candidate_hash: null,
        semantic_target_map_hash: command.payload.semantic_target_map_hash,
        review_target: reviewTarget(command),
        hard_gates: pendingHardGates('editorial_review_required'),
        provenance: { kind: 'treatment', treatment_artifact_hash: command.expected_parent_artifact_hash },
        created_at: command.issued_at,
      })
      return {
        status: 'requires_editorial_route',
        result_revision_hash: command.expected_parent_revision_hash,
        result_artifact_hash: command.expected_parent_artifact_hash,
        result_refs: {
          review_id: reviewId,
          safe_title: 'Editorial route required',
          safe_summary: 'This direction could change meaning, claims, evidence, story structure, or another unsupported control.',
          review_payload: {
            direction: command.payload.instruction,
            change_title: 'Editorial route required',
            change_summary: 'No render candidate was created. Review this direction through the full editorial workflow.',
            range_label: selectionLabel(command),
            changes: [],
            blocking_gates: pendingHardGates('editorial_review_required'),
            target: reviewTarget(command),
            semantic_target_map_hash: command.payload.semantic_target_map_hash ?? command.expected_parent_artifact_hash,
            editorial_note: prepared.reason_code,
          },
          comparison_alignment: 'unavailable',
        },
        hard_gates: pendingHardGates('editorial_review_required'),
      }
    }
    if ('status' in prepared) throw new Error('compiled magic-edit direction did not produce a candidate')
    const candidate = MagicEditCandidateV1Schema.parse(prepared)
    if (!context) throw new Error('preview publisher is unavailable for prepared magic-edit review')
    const previews = await renderMagicEditComparisonPreview(context.repoRoot, command.job_id, candidate.candidate_hash)
    assertDispatchLease(context)
    const [beforeInfo, afterInfo] = await Promise.all([stat(previews.before_path), stat(previews.after_path)])
    const maximumPreviewBytes = 25 * 1024 * 1024
    if (!beforeInfo.isFile() || !afterInfo.isFile() || beforeInfo.size <= 0 || afterInfo.size <= 0 || beforeInfo.size > maximumPreviewBytes || afterInfo.size > maximumPreviewBytes) throw new Error('magic-edit comparison preview is unavailable within the upload size limit')
    const [before, after] = await Promise.all([
      context.publishPreview('before', previews.before_path, previews.before_hash, beforeInfo.size),
      context.publishPreview('after', previews.after_path, previews.after_hash, afterInfo.size),
    ])
    const reviewId = magicCandidateReviewId(command, candidate.candidate_hash)
    assertDispatchLease(context)
    await persistLocalReviewBinding({
      schema_version: 1,
      review_id: reviewId,
      job_id: command.job_id,
      platform: command.platform,
      gate: 'treatment',
      parent_revision_hash: candidate.expected_parent_revision_hash,
      parent_artifact_hash: candidate.expected_parent_artifact_hash,
      review_revision_hash: candidate.candidate_hash,
      review_artifact_hash: candidate.prepared_treatment_artifact_hash,
      candidate_hash: candidate.candidate_hash,
      semantic_target_map_hash: candidate.semantic_target_map_hash,
      review_target: reviewTarget(command, candidate),
      hard_gates: cloudHardGates(candidate.gates),
      provenance: { kind: 'magic_candidate', candidate_hash: candidate.candidate_hash, prepared_treatment_artifact_hash: candidate.prepared_treatment_artifact_hash },
      created_at: candidate.created_at,
    })
    return {
      status: 'succeeded',
      result_revision_hash: candidate.candidate_hash,
      result_artifact_hash: candidate.prepared_treatment_artifact_hash,
      result_refs: candidateResultRefs(command, candidate, reviewId, before, after, { start_ms: previews.comparison_start_ms, end_ms: previews.comparison_end_ms }),
      hard_gates: cloudHardGates(candidate.gates),
    }
  }
  if (command.command_kind === 'magic_edit_activate') {
    return withJobEventLock(command.job_id, async () => {
    const candidate = await loadMagicEditCandidate(command.job_id, command.payload.candidate_hash)
    const reviewBinding = await loadLocalReviewBinding(command.job_id, activationReviewId(command.payload.confirmation_ref))
    if (reviewBinding.provenance.kind !== 'magic_candidate'
      || reviewBinding.candidate_hash !== candidate.candidate_hash
      || reviewBinding.review_artifact_hash !== candidate.prepared_treatment_artifact_hash
      || reviewBinding.parent_revision_hash !== command.expected_parent_revision_hash
      || reviewBinding.parent_artifact_hash !== command.expected_parent_artifact_hash
      || reviewBinding.semantic_target_map_hash !== command.semantic_target_map_hash) throw new Error('activation does not bind the exact authenticated local candidate review')
    await assertGateSpecificReviewCurrent(reviewBinding)
    if (command.semantic_target_map_hash !== candidate.semantic_target_map_hash) throw new Error('activation command target map does not match the exact prepared candidate')
    const activated = await activateMagicEditCandidate(command.job_id, command.payload, {
      expected_parent_revision_hash: command.expected_parent_revision_hash,
      expected_parent_artifact_hash: command.expected_parent_artifact_hash,
      command_id: command.command_id,
      command_hash: commandSemanticHash(command),
    }, mutationOptions)
    assertDispatchLease(context)
    const activatedTargetMap = await createMagicEditTargetMap(command.job_id, command.platform)
    if (activatedTargetMap.expected_parent_revision_hash !== activated.revision_hash || activatedTargetMap.expected_parent_artifact_hash !== activated.artifact_hash) throw new Error('activated treatment target map does not bind the new local revision')
    return {
      status: 'succeeded',
      result_revision_hash: activated.revision_hash,
      result_artifact_hash: activated.artifact_hash,
      result_refs: { semantic_target_map_hash: activatedTargetMap.semantic_target_map_hash, comparison_alignment: 'unavailable' },
      hard_gates: cloudHardGates(candidate.gates),
    }
    })
  }
  return withJobEventLock(command.job_id, async () => {
    const returned = await returnMagicEditToParent(
    command.job_id,
    command.expected_parent_revision_hash,
    command.expected_parent_artifact_hash,
    command.payload,
    command.command_id,
    command.command_hash,
    { ...mutationOptions, expectedCurrentCandidateHash: command.candidate_hash },
  )
    assertDispatchLease(context)
    const returnedTargetMap = await createMagicEditTargetMap(command.job_id, command.platform)
    if (returnedTargetMap.expected_parent_revision_hash !== returned.revision_hash || returnedTargetMap.expected_parent_artifact_hash !== returned.artifact_hash) throw new Error('returned treatment target map does not bind the new local revision')
    return {
      status: 'succeeded',
      result_revision_hash: returned.revision_hash,
      result_artifact_hash: returned.artifact_hash,
      result_refs: { semantic_target_map_hash: returnedTargetMap.semantic_target_map_hash, comparison_alignment: 'unavailable' },
      hard_gates: passedHardGates(),
    }
  })
}

function safeFailure(error: unknown): { safeCode: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : ''
  if (error instanceof RunnerLocalAuthorityAdvancedError) return { safeCode: 'local_authority_pending_reconciliation', retryable: true }
  if (error instanceof ZodError || /invalid|payload hash|expired|different job|does not bind|no render change|unsupported/i.test(message)) return { safeCode: 'invalid_command', retryable: false }
  if (/stale|exact current parent|immediate parent|lineage/i.test(message)) return { safeCode: 'stale_parent', retryable: false }
  if (/approval|non-passing gates|hard blocks|rights|truth|confidential|policy/i.test(message)) return { safeCode: 'policy_block', retryable: false }
  if (/ENOENT|media|manifest.*unavailable|no .*render manifest/i.test(message)) return { safeCode: 'media_unavailable', retryable: true }
  if (/HTTP|provider|credential|network|fetch|timeout|timed out|aborted|lease fence|lease renewal|lease expired/i.test(message)) return { safeCode: 'provider_unavailable', retryable: true }
  return { safeCode: 'internal_error', retryable: false }
}

function commandSemanticHash(command: RunnerCommandEnvelopeV1): string {
  return command.command_hash
}

function receiptBody(command: RunnerCommandEnvelopeV1, startedAt: string, finishedAt: string, outcome: RunnerDispatchResult | null, failure?: { safeCode: string; retryable: boolean }): ReceiptBody {
  if (outcome) {
    return {
      schema_version: 1,
      command_id: command.command_id,
      command_hash: commandSemanticHash(command),
      job_id: command.job_id,
      status: outcome.status,
      result_revision_hash: outcome.result_revision_hash,
      result_artifact_hash: outcome.result_artifact_hash,
      ...(outcome.result_refs ? { result_refs: outcome.result_refs } : {}),
      hard_gates: outcome.hard_gates,
      retryable: false,
      safe_code: outcome.status === 'requires_editorial_route' ? 'requires_editorial_route' : null,
      started_at: startedAt,
      finished_at: finishedAt,
    }
  }
  const safe = failure ?? { safeCode: 'internal_error', retryable: false }
  return {
    schema_version: 1,
    command_id: command.command_id,
    command_hash: commandSemanticHash(command),
    job_id: command.job_id,
    status: 'failed',
    result_revision_hash: null,
    result_artifact_hash: null,
    hard_gates: pendingHardGates('evaluation_not_completed'),
    retryable: false,
    safe_code: safe.safeCode,
    started_at: startedAt,
    finished_at: finishedAt,
  }
}

class RunnerLocalAuthorityAdvancedError extends Error {
  constructor(command: RunnerCommandEnvelopeV1, cause: unknown) {
    super(`runner command ${command.command_kind} changed local event authority before dispatch failed; the exact command must be reclaimed`)
    this.name = 'RunnerLocalAuthorityAdvancedError'
    this.cause = cause
  }
}

export async function bindDispatchResultToEventLedger(command: RunnerCommandEnvelopeV1, dispatch: () => Promise<RunnerDispatchResult>): Promise<RunnerDispatchResult> {
  return withJobEventLock(command.job_id, async () => {
    const before = await loadJobProjectionSnapshotV2(command.job_id)
    let outcome: RunnerDispatchResult
    try { outcome = await dispatch() }
    catch (error) {
      let after
      try { after = await loadJobProjectionSnapshotV2(command.job_id) }
      catch { throw new RunnerLocalAuthorityAdvancedError(command, error) }
      if (after.source_event_count !== before.source_event_count
        || after.event_chain_hash !== before.event_chain_hash
        || jobRevisionHashV2(after.job) !== jobRevisionHashV2(before.job)) throw new RunnerLocalAuthorityAdvancedError(command, error)
      throw error
    }
    const snapshot = await loadJobProjectionSnapshotV2(command.job_id)
    return {
      ...outcome,
      result_refs: {
        ...(outcome.result_refs ?? { comparison_alignment: 'unavailable' as const }),
        result_source_event_count: snapshot.source_event_count,
        result_source_event_chain_hash: snapshot.event_chain_hash,
        result_source_revision_hash: jobRevisionHashV2(snapshot.job),
      },
    }
  })
}

export function signRunnerReceipt(body: ReceiptBody, signingKey: Buffer): RunnerReceiptV1 {
  const receiptHash = hashValue(body)
  return RunnerReceiptV1Schema.parse({
    ...body,
    receipt_hash: receiptHash,
    receipt_signature: signRunnerReceiptHash(signingKey, receiptHash),
  })
}

export function verifySignedRunnerReceipt(receiptInput: RunnerReceiptV1, signingKey: Buffer): RunnerReceiptV1 {
  const receipt = RunnerReceiptV1Schema.parse(receiptInput)
  const { receipt_hash: receiptHash, receipt_signature: receiptSignature, ...body } = receipt
  if (hashValue(body) !== receiptHash || !verifyRunnerReceiptHash(signingKey, receiptHash, receiptSignature)) throw new Error('stored runner receipt failed authentication')
  return receipt
}

function verifyStoredRunnerReceipt(receiptInput: unknown, signingKey: Buffer): { receipt: RunnerReceiptV1; legacy_source_cursor: boolean } {
  const current = RunnerReceiptV1Schema.safeParse(receiptInput)
  const legacy = current.success ? null : LegacyStoredRunnerReceiptV1Schema.safeParse(receiptInput)
  if (!current.success && !legacy?.success) throw new Error('stored runner receipt has an unsupported shape')
  const receipt = (current.success ? current.data : legacy!.data) as RunnerReceiptV1
  const { receipt_hash: receiptHash, receipt_signature: receiptSignature, ...body } = receipt
  if (hashValue(body) !== receiptHash || !verifyRunnerReceiptHash(signingKey, receiptHash, receiptSignature)) throw new Error('stored runner receipt failed authentication')
  return { receipt, legacy_source_cursor: !current.success }
}

async function signedReceiptsByCommandIdentity(commandId: string, commandHash: string, jobId: string, signingKey: Buffer, runtimeRoot?: string): Promise<RunnerReceiptV1[]> {
  const inventory = await inspectRunnerReceiptAuthority(signingKey, runtimeRoot)
  const matches = [...inventory.pending, ...inventory.acknowledged]
    .filter((value) => value.receipt.command_id === commandId)
    .map((value) => value.receipt)
  for (const receipt of matches) if (receipt.command_hash !== commandHash || receipt.job_id !== jobId) throw new Error('review recovery source receipt does not match its declared command identity')
  return [...new Map(matches.map((receipt) => [receipt.receipt_hash, receipt])).values()]
}

async function findSignedReceiptByCommandIdentity(commandId: string, commandHash: string, jobId: string, signingKey: Buffer, runtimeRoot?: string): Promise<RunnerReceiptV1> {
  const matches = await signedReceiptsByCommandIdentity(commandId, commandHash, jobId, signingKey, runtimeRoot)
  if (matches.length !== 1) throw new Error('review recovery requires one exact authenticated local source receipt')
  return matches[0]!
}

async function optionallyFindSignedReceiptByCommandIdentity(commandId: string, commandHash: string, jobId: string, signingKey: Buffer, runtimeRoot?: string): Promise<RunnerReceiptV1 | null> {
  const matches = await signedReceiptsByCommandIdentity(commandId, commandHash, jobId, signingKey, runtimeRoot)
  if (matches.length > 1) throw new Error('review recovery source command has conflicting authenticated local receipts')
  return matches[0] ?? null
}

async function persistedReceiptsForIdempotency(command: RunnerCommandEnvelopeV1, signingKey: Buffer, runtimeRoot?: string): Promise<RunnerReceiptV1[]> {
  const inventory = await inspectRunnerReceiptAuthority(signingKey, runtimeRoot)
  const stored = [...inventory.pending, ...inventory.acknowledged]
    .filter((value) => value.idempotency_key === command.idempotency_key)
  if (stored.some((value) => value.legacy_source_cursor)) throw new Error('legacy acknowledged runner receipt cannot be replayed under the source-cursor protocol')
  const receipts = stored.map((value) => value.receipt)
  for (const receipt of receipts) if (receipt.command_hash !== commandSemanticHash(command) || receipt.job_id !== command.job_id) throw new Error('runner idempotency key was reused for a different semantic command')
  return receipts
}

async function loadPersistedReceipt(command: RunnerCommandEnvelopeV1, signingKey: Buffer, runtimeRoot?: string): Promise<{ receipt: RunnerReceiptV1; exact_attempt: boolean } | null> {
  const receipts = await persistedReceiptsForIdempotency(command, signingKey, runtimeRoot)
  const exact = receipts.find((receipt) => receipt.command_id === command.command_id)
  if (exact) return { receipt: exact, exact_attempt: true }
  return receipts[0] ? { receipt: receipts[0], exact_attempt: false } : null
}

async function persistReceipt(
  command: RunnerCommandEnvelopeV1,
  receipt: RunnerReceiptV1,
  signingKey: Buffer,
  runnerId: string,
  leaseToken: string,
  runtimeRoot?: string,
): Promise<void> {
  const path = receiptPath('pending', command.idempotency_key, command.command_id, runtimeRoot)
  const persisted = await loadPersistedReceipt(command, signingKey, runtimeRoot)
  if (persisted?.exact_attempt) {
    if (persisted.receipt.receipt_hash !== receipt.receipt_hash) throw new Error('runner receipt is immutable for its command attempt')
    try {
      const existing: unknown = JSON.parse(await readFile(path, 'utf8'))
      if (!isPendingJournal(existing)
        || existing.idempotency_key !== command.idempotency_key
        || existing.runner_id !== runnerId
        || existing.receipt.command_id !== command.command_id) throw new Error('pending runner receipt cannot be rebound to this claim')
      const authenticated = verifySignedRunnerReceipt(existing.receipt, signingKey)
      if (authenticated.receipt_hash !== receipt.receipt_hash) throw new Error('pending runner receipt changed before lease rebinding')
      await writeRunnerAuthorityJsonAtomic(path, { ...existing, lease_token: leaseToken }, runtimeRoot)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return
  }
  const journal: PendingRunnerReceiptJournalV1 = {
    schema_version: 1,
    idempotency_key: command.idempotency_key,
    runner_id: runnerId,
    lease_token: leaseToken,
    receipt,
  }
  await writeRunnerAuthorityJsonAtomic(path, journal, runtimeRoot)
}

async function acknowledgeReceipt(idempotencyKey: string, receipt: RunnerReceiptV1, signingKey: Buffer, runtimeRoot?: string): Promise<void> {
  const pendingPath = receiptPath('pending', idempotencyKey, receipt.command_id, runtimeRoot)
  const acknowledgedPath = receiptPath('acknowledged', idempotencyKey, receipt.command_id, runtimeRoot)
  try {
    const existing = verifySignedRunnerReceipt(RunnerReceiptV1Schema.parse(JSON.parse(await readFile(acknowledgedPath, 'utf8'))), signingKey)
    if (existing.receipt_hash !== receipt.receipt_hash) throw new Error('acknowledged runner receipt differs from its immutable result')
    try { await unlink(pendingPath) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await writeRunnerAuthorityJsonAtomic(acknowledgedPath, receipt, runtimeRoot)
  try { await unlink(pendingPath) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
}

function isPendingJournal(value: unknown): value is PendingRunnerReceiptJournalV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).sort().join(',') === ['schema_version', 'idempotency_key', 'runner_id', 'lease_token', 'receipt'].sort().join(',')
    && record.schema_version === 1
    && typeof record.idempotency_key === 'string'
    && EXACT_UUID.test(record.idempotency_key)
    && typeof record.runner_id === 'string'
    && typeof record.lease_token === 'string'
    && record.lease_token.length >= 24
    && (RunnerReceiptV1Schema.safeParse(record.receipt).success || LegacyStoredRunnerReceiptV1Schema.safeParse(record.receipt).success)
}

function validateCompletionAcknowledgement(receipt: RunnerReceiptV1, response: Awaited<ReturnType<RunnerControlPlane['complete']>>): void {
  const expectedStatus = receipt.status === 'requires_editorial_route' ? 'attention' : receipt.status
  if (response.command_id !== receipt.command_id || response.receipt_hash !== receipt.receipt_hash || response.command_status !== expectedStatus) throw new Error('control-plane completion acknowledgement does not match the submitted receipt')
}

function legacyRootAdoptionRequest(pending: Awaited<ReturnType<typeof loadPendingRunnerProject>>): RunnerProjectRequestV1 | null {
  if (!pending) return null
  const projection = pending.request.projection
  const desired = projection.platform_state
  if (projection.expected_platform_state !== null
    || desired.active_candidate_hash !== null
    || desired.parent_revision_hash !== null
    || desired.parent_artifact_hash !== null
    || desired.parent_candidate_hash !== null) return null
  const { expected_platform_state: _expected, ...legacyProjectionInput } = projection
  const legacyProjection = RunnerProjectProjectionV1Schema.parse(legacyProjectionInput)
  return RunnerProjectRequestV1Schema.parse({
    ...pending.request,
    projection_hash: hashValue(runnerProjectProjectionHashInputV1(legacyProjection)),
    projection: legacyProjection,
  })
}

async function submitPendingRunnerProjectWithAdoption(input: {
  pending: NonNullable<Awaited<ReturnType<typeof loadPendingRunnerProject>>>
  project: NonNullable<RunnerControlPlane['project']>
  signingKey: Buffer
  runtimeRoot?: string
  now: () => Date
}): Promise<{ pending: NonNullable<Awaited<ReturnType<typeof loadPendingRunnerProject>>>; response: Awaited<ReturnType<NonNullable<RunnerControlPlane['project']>>> }> {
  let pending = input.pending
  const submit = (request: RunnerProjectRequestV1) => input.project({
    runner_id: request.runner_id,
    software_commit: request.software_commit,
    idempotency_key: request.idempotency_key,
    projection: request.projection,
  })
  try {
    return { pending, response: await submit(pending.request) }
  } catch (error) {
    if (!(error instanceof ControlPlaneRequestError) || error.status !== 409 || error.safeCode !== 'projection_conflict') throw error
    const adoptionRequest = legacyRootAdoptionRequest(pending)
    if (!adoptionRequest) throw error
    const jobId = pending.request.projection.job.job_id
    const platform = pending.request.projection.platform_state.platform
    if (await loadAcknowledgedRunnerProjectCursor(jobId, platform, input.signingKey, input.runtimeRoot)) throw error
    pending = await replacePendingRunnerProject(pending, adoptionRequest, input.signingKey, input.now().toISOString(), input.runtimeRoot)
    return { pending, response: await submit(pending.request) }
  }
}

function usesRunnerProjectState(options: RunnerCycleOptions): boolean {
  return !options.dispatch || options.enforceProjectState === true
}

async function reconcilePendingRunnerProjects(options: RunnerCycleOptions, onlyJobId?: string, blockedJobIds: ReadonlySet<string> = new Set()): Promise<void> {
  if (!usesRunnerProjectState(options)) return
  const pendingProjects = (await listPendingRunnerProjects(options.signingKey, options.runtimeRoot))
    .filter((pending) => (onlyJobId === undefined || pending.request.projection.job.job_id === onlyJobId)
      && !blockedJobIds.has(pending.request.projection.job.job_id))
  if (pendingProjects.length && !options.client.project) throw new Error('control-plane project provider is unavailable for pending projection reconciliation')
  for (const discovered of pendingProjects) {
    const discoveredRequest = discovered.request
    if (discoveredRequest.runner_id !== options.runnerId) {
      await quarantinePendingRunnerProject(discovered, options.signingKey, 'runner_identity_conflict', new Date().toISOString(), options.runtimeRoot)
      continue
    }
    const jobId = discoveredRequest.projection.job.job_id
    const platform = discoveredRequest.projection.platform_state.platform
    await withRunnerProjectStateLock(jobId, platform, options.runtimeRoot, async () => {
      const pending = await loadPendingRunnerProject(jobId, platform, options.signingKey, options.runtimeRoot)
      if (!pending) return
      if (pending.journal_hash !== discovered.journal_hash) throw new Error('pending runner project changed during reconciliation')
      const request = pending.request
      await assertRunnerProjectHasNoPendingCommandReceipt(jobId, options.signingKey, options.runtimeRoot)
      try { await assertRunnerPlatformCanProject(jobId, platform, options.signingKey, options.runtimeRoot) }
      catch (error) {
        if (error instanceof RunnerProjectGlobalLineageError) {
          await quarantinePendingRunnerProject(pending, options.signingKey, 'global_lineage_conflict', new Date().toISOString(), options.runtimeRoot)
          return
        }
        throw error
      }
      try {
        const submitted = await submitPendingRunnerProjectWithAdoption({
          pending,
          project: options.client.project!,
          signingKey: options.signingKey,
          ...(options.runtimeRoot ? { runtimeRoot: options.runtimeRoot } : {}),
          now: options.now ?? (() => new Date()),
        })
        await acknowledgeRunnerProject(submitted.pending, options.signingKey, (options.now ?? (() => new Date()))().toISOString(), options.runtimeRoot)
      } catch (error) {
        if (error instanceof ControlPlaneRequestError && error.status === 409 && error.safeCode === 'command_in_flight') {
          const current = await loadPendingRunnerProject(jobId, platform, options.signingKey, options.runtimeRoot)
          if (current) await discardPendingRunnerProject(current, options.signingKey, options.runtimeRoot)
          return
        }
        if (error instanceof ControlPlaneRequestError && error.status === 409 && ['projection_conflict', 'idempotency_conflict'].includes(error.safeCode ?? '')) {
          const current = await loadPendingRunnerProject(jobId, platform, options.signingKey, options.runtimeRoot)
          if (current) await quarantinePendingRunnerProject(current, options.signingKey, error.safeCode as 'projection_conflict' | 'idempotency_conflict', (options.now ?? (() => new Date()))().toISOString(), options.runtimeRoot)
          return
        }
        throw error
      }
    })
  }
}

function receiptAuthorityConflictCode(error: unknown): CloudRunnerReceiptAuthorityConflictSafeCode | null {
  if (!(error instanceof ControlPlaneRequestError)
    || !error.safeCode
    || !cloudReceiptAuthorityConflictSafeCodes.has(error.safeCode)
    || !(error.status === 409
      || error.status === 404 && error.safeCode === 'command_not_found'
      || error.status === 503 && error.safeCode === 'job_not_found')) return null
  return error.safeCode as CloudRunnerReceiptAuthorityConflictSafeCode
}

async function reconcilePendingReceipts(options: RunnerCycleOptions): Promise<void> {
  const pendingReceipts = await listAuthenticatedPendingReceipts(options.signingKey, options.runtimeRoot, options.runnerId)
  for (const value of pendingReceipts) {
      if (value.legacy_source_cursor) {
        await quarantinePendingReceiptConflict(value, options.signingKey, 'legacy_receipt_missing_source_cursor', (options.now ?? (() => new Date()))().toISOString(), options.runtimeRoot)
        continue
      }
      const receipt = value.receipt
      const reconcile = async () => {
        let response: Awaited<ReturnType<RunnerControlPlane['complete']>> | null = null
        try {
          response = await options.client.complete({ runner_id: options.runnerId, lease_token: value.lease_token, receipt })
        } catch (error) {
          const safeCode = receiptAuthorityConflictCode(error)
          if (safeCode) await quarantinePendingReceiptConflict(value, options.signingKey, safeCode, (options.now ?? (() => new Date()))().toISOString(), options.runtimeRoot)
          return /* The command may need to be reclaimed with a fresh lease or requires explicit recovery attention. */
        }
        validateCompletionAcknowledgement(receipt, response)
        if (usesRunnerProjectState(options)) {
          const claimJournal = await loadClaimedCommandJournal(receipt.command_id, options.signingKey, options.runtimeRoot)
          if (!claimJournal) throw new Error('pending runner receipt has no authenticated claimed-command journal')
          await acknowledgeRunnerCommandPlatformState(claimJournal.command, receipt, options.signingKey, options.runtimeRoot)
        }
        await acknowledgeReceipt(value.idempotency_key, receipt, options.signingKey, options.runtimeRoot)
      }
      if (!usesRunnerProjectState(options)) await reconcile()
      else {
        const claimJournal = await loadClaimedCommandJournal(receipt.command_id, options.signingKey, options.runtimeRoot)
        if (!claimJournal) throw new Error('pending runner receipt has no authenticated claimed-command journal')
        await withRunnerProjectStateLock(claimJournal.command.job_id, claimJournal.command.platform, options.runtimeRoot, reconcile)
      }
  }
}

function validateClaimedCommand(claim: ClaimedRunnerCommand, now: Date): RunnerCommandEnvelopeV1 {
  const command = RunnerCommandEnvelopeV1Schema.parse(claim.command)
  if (hashValue(command.payload) !== command.payload_hash) throw new Error('runner command payload hash does not match')
  if (hashValue(runnerCommandHashInputV1(command)) !== command.command_hash) throw new Error('runner command hash does not match its canonical envelope')
  if (Date.parse(command.expires_at) <= now.getTime()) throw new Error('runner command has expired')
  if (Date.parse(claim.lease.expires_at) <= now.getTime()) throw new Error('runner command lease has expired')
  return command
}

async function receiptForNewAttempt(
  command: RunnerCommandEnvelopeV1,
  prior: RunnerReceiptV1,
  options: RunnerCycleOptions,
  leaseToken: string,
  leaseFence: { assertActive: () => void },
): Promise<RunnerReceiptV1> {
  let resultRefs = prior.result_refs
  if (resultRefs?.before_preview_object_key || resultRefs?.after_preview_object_key) {
    if (command.command_kind !== 'magic_edit_prepare' || !resultRefs.candidate_hash || !options.client.uploadPreviewFile) throw new Error('command-bound preview replay is unavailable without the exact prepared candidate')
    const previews = await (options.renderComparisonPreview ?? renderMagicEditComparisonPreview)(options.repoRoot ?? REPO_ROOT, command.job_id, resultRefs.candidate_hash)
    const [beforeInfo, afterInfo, beforeMd5, afterMd5] = await Promise.all([
      stat(previews.before_path),
      stat(previews.after_path),
      hashFileMd5(previews.before_path),
      hashFileMd5(previews.after_path),
    ])
    if (previews.before_hash !== resultRefs.before_preview_hash || previews.after_hash !== resultRefs.after_preview_hash
      || beforeMd5 !== resultRefs.before_preview_md5 || afterMd5 !== resultRefs.after_preview_md5
      || beforeInfo.size !== resultRefs.before_preview_byte_size || afterInfo.size !== resultRefs.after_preview_byte_size) throw new Error('replayed preview media does not match the immutable semantic execution')
    leaseFence.assertActive()
    const [before, after] = await Promise.all([
      options.client.uploadPreviewFile({ schema_version: 1, runner_id: options.runnerId, command_id: command.command_id, command_hash: command.command_hash, lease_token: leaseToken, side: 'before', sha256: previews.before_hash, md5: beforeMd5, content_type: 'video/mp4', byte_size: beforeInfo.size }, previews.before_path),
      options.client.uploadPreviewFile({ schema_version: 1, runner_id: options.runnerId, command_id: command.command_id, command_hash: command.command_hash, lease_token: leaseToken, side: 'after', sha256: previews.after_hash, md5: afterMd5, content_type: 'video/mp4', byte_size: afterInfo.size }, previews.after_path),
    ])
    leaseFence.assertActive()
    resultRefs = {
      ...resultRefs,
      before_preview_object_key: before.object_key,
      after_preview_object_key: after.object_key,
    }
  }
  const { receipt_hash: _priorHash, receipt_signature: _priorSignature, ...priorBody } = prior
  return signRunnerReceipt({ ...priorBody, command_id: command.command_id, ...(resultRefs ? { result_refs: resultRefs } : {}) }, options.signingKey)
}

async function runRunnerCycleUnderAuthority(options: RunnerCycleOptions): Promise<RunnerCycleResult> {
  const now = options.now ?? (() => new Date())
  await assertCurrentRunnerAuthority(options.signingKey, options.runnerId, options.runtimeRoot)
  await inspectRunnerReceiptAuthority(options.signingKey, options.runtimeRoot, options.runnerId)
  await reconcilePendingReceipts(options)
  const pendingAfterReceiptReconciliation = await listAuthenticatedPendingReceipts(options.signingKey, options.runtimeRoot, options.runnerId)
  const receiptConflicts = await listAuthenticatedReceiptConflicts(options.signingKey, options.runtimeRoot, options.runnerId)
  const pendingBefore = pendingAfterReceiptReconciliation.length
  const receiptAttention = receiptConflicts.length > 0
  if (receiptAttention) {
    const preflightDriveState = await currentDriveState(options)
    try { await options.client.heartbeat(heartbeat(options, preflightDriveState, 'degraded', pendingBefore, now().toISOString())) }
    catch { /* Receipt conflict attention remains locally authoritative when heartbeat delivery fails. */ }
    return { state: 'idle' }
  }
  const projectStatusBefore = await runnerProjectJournalStatus(options.signingKey, options.runtimeRoot)
  if (projectStatusBefore.project_attention_code) {
    const preflightDriveState = await currentDriveState(options)
    try { await options.client.heartbeat(heartbeat(options, preflightDriveState, 'degraded', pendingBefore, now().toISOString())) }
    catch { /* Project conflict attention remains locally authoritative when heartbeat delivery fails. */ }
    return { state: 'idle' }
  }
  const pendingReceiptJobIds = new Set(pendingAfterReceiptReconciliation.map((pending) => pending.command.job_id))
  await reconcilePendingRunnerProjects(options, undefined, pendingReceiptJobIds)
  const projectStatusAfter = await runnerProjectJournalStatus(options.signingKey, options.runtimeRoot)
  if (projectStatusAfter.project_attention_code) {
    const preflightDriveState = await currentDriveState(options)
    try { await options.client.heartbeat(heartbeat(options, preflightDriveState, 'degraded', pendingBefore, now().toISOString())) }
    catch { /* Newly quarantined project conflict remains locally authoritative. */ }
    return { state: 'idle' }
  }
  const preflightDriveState = await currentDriveState(options)
  await options.client.heartbeat(heartbeat(options, preflightDriveState, preflightDriveState === 'ready' && pendingBefore === 0 ? 'idle' : 'degraded', pendingBefore, now().toISOString()))
  let discovery: SanitizedDriveDiscoverySummary | undefined
  if (options.discoverInbox) {
    let discoveryHeartbeatTail = Promise.resolve()
    const discoveryHeartbeat = setInterval(() => {
      discoveryHeartbeatTail = discoveryHeartbeatTail.then(async () => {
        const driveState = await currentDriveState(options)
        await options.client.heartbeat(heartbeat(options, driveState, driveState === 'ready' && pendingBefore === 0 && !receiptAttention ? 'working' : 'degraded', pendingBefore, now().toISOString()))
      }).catch(() => undefined)
    }, options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS)
    discoveryHeartbeat.unref?.()
    try { discovery = await options.discoverInbox() }
    finally {
      clearInterval(discoveryHeartbeat)
      await discoveryHeartbeatTail
    }
  }
  const initialDriveState = discovery
    ? discovery.drive_state === 'ready' ? await currentDriveState(options) : discovery.drive_state
    : preflightDriveState
  if (discovery) await options.client.heartbeat(heartbeat(options, initialDriveState, initialDriveState === 'ready' && pendingBefore === 0 && !receiptAttention ? 'idle' : 'degraded', pendingBefore, now().toISOString()))
  if (initialDriveState !== 'ready') return { state: 'idle', ...(discovery ? { discovery } : {}) }
  if (options.verifySourceProvenance) {
    const currentCommit = await options.verifySourceProvenance()
    if (currentCommit !== options.softwareCommit) throw new Error('runner source commit changed after startup')
  }
  const claim = await options.client.claim({ runner_id: options.runnerId, software_commit: options.softwareCommit, lease_seconds: options.leaseSeconds ?? DEFAULT_LEASE_SECONDS })
  if (!claim) return { state: 'idle', ...(discovery ? { discovery } : {}) }
  const command = validateClaimedCommand(claim, now())
  const executeClaimedCommand = async (): Promise<RunnerCycleResult> => {
  const pendingForClaimedJob = (await listAuthenticatedPendingReceipts(options.signingKey, options.runtimeRoot, options.runnerId))
    .filter((pending) => pending.command.job_id === command.job_id)
  if (pendingForClaimedJob.length > 0) {
    if (pendingForClaimedJob.length !== 1
      || pendingForClaimedJob[0]!.command.command_id !== command.command_id
      || pendingForClaimedJob[0]!.command.idempotency_key !== command.idempotency_key
      || pendingForClaimedJob[0]!.command.command_hash !== command.command_hash) throw new Error('claimed runner command conflicts with an authenticated pending receipt for its job')
  } else if (usesRunnerProjectState(options)) await reconcilePendingRunnerProjects(options, command.job_id)
  if (usesRunnerProjectState(options) && (await runnerProjectJournalStatus(options.signingKey, options.runtimeRoot)).project_attention_code) throw new Error('runner project conflict requires operator attention before command dispatch')
  await persistClaimedCommandJournal(command, options.runnerId, options.signingKey, now().toISOString(), options.runtimeRoot)
  if (usesRunnerProjectState(options)) await assertRunnerCommandHasAcknowledgedCursor(command, options.signingKey, options.runtimeRoot)
  let heartbeatFailed = false
  let leaseExpiresAt = Date.parse(claim.lease.expires_at)
  const leaseFence = {
    assertActive: () => {
      if (heartbeatFailed) throw new Error('runner lease fence closed after lease renewal failure')
      if (!Number.isFinite(leaseExpiresAt) || now().getTime() >= leaseExpiresAt) throw new Error('runner lease expired before local mutation')
    },
  }
  let heartbeatTail = Promise.resolve()
  const interval = setInterval(() => {
    heartbeatTail = heartbeatTail.then(async () => {
      const driveState = await currentDriveState(options)
      const renewed = await options.client.heartbeat(heartbeat(options, driveState, driveState === 'ready' ? 'working' : 'degraded', pendingBefore, now().toISOString(), command.command_id), claim.lease.token)
      if (renewed.lease_expires_at) {
        const nextExpiry = Date.parse(renewed.lease_expires_at)
        if (!Number.isFinite(nextExpiry) || nextExpiry <= now().getTime()) throw new Error('runner lease renewal returned an expired lease')
        leaseExpiresAt = nextExpiry
      }
    }).catch(() => { heartbeatFailed = true })
  }, options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS)
  interval.unref?.()
  try {
    const persisted = await loadPersistedReceipt(command, options.signingKey, options.runtimeRoot)
    let receipt = persisted?.receipt ?? null
    if (persisted?.exact_attempt) {
      await persistReceipt(command, persisted.receipt, options.signingKey, options.runnerId, claim.lease.token, options.runtimeRoot)
      if (command.command_kind === 'magic_edit_prepare' && persisted.receipt.status === 'succeeded') {
        const refs = persisted.receipt.result_refs
        if (!refs?.candidate_hash
          || !refs.before_preview_object_key || !refs.before_preview_hash || !refs.before_preview_md5 || refs.before_preview_byte_size === undefined
          || !refs.after_preview_object_key || !refs.after_preview_hash || !refs.after_preview_md5 || refs.after_preview_byte_size === undefined) throw new Error('persisted prepare receipt lacks immutable preview restoration references')
        const restored = await receiptForNewAttempt(command, persisted.receipt, options, claim.lease.token, leaseFence)
        if (restored.receipt_hash !== persisted.receipt.receipt_hash
          || restored.receipt_signature !== persisted.receipt.receipt_signature) throw new Error('restored prepare previews changed the immutable signed receipt')
      }
    }
    if (persisted && !persisted.exact_attempt) {
      receipt = await receiptForNewAttempt(command, persisted.receipt, options, claim.lease.token, leaseFence)
      await persistReceipt(command, receipt, options.signingKey, options.runnerId, claim.lease.token, options.runtimeRoot)
    }
    if (!receipt) {
      const startedAt = now().toISOString()
      let outcome: RunnerDispatchResult | null = null
      let failure: { safeCode: string; retryable: boolean } | undefined
      try {
        if (options.dispatch) outcome = await options.dispatch(command, leaseFence)
        else {
          if (!options.client.uploadPreviewFile) throw new Error('preview upload provider is unavailable')
          outcome = await bindDispatchResultToEventLedger(command, () => dispatchRunnerCommand(command, {
              repoRoot: options.repoRoot ?? REPO_ROOT,
              ...(options.runtimeRoot ? { runtimeRoot: options.runtimeRoot } : {}),
              signingKey: options.signingKey,
              assertLeaseActive: leaseFence.assertActive,
              publishPreview: async (side, path, sha256, byteSize) => {
                leaseFence.assertActive()
                const md5 = await hashFileMd5(path)
                const uploaded = await options.client.uploadPreviewFile!({
                  schema_version: 1,
                  runner_id: options.runnerId,
                  command_id: command.command_id,
                  command_hash: command.command_hash,
                  lease_token: claim.lease.token,
                  side,
                  sha256,
                  md5,
                  content_type: 'video/mp4',
                  byte_size: byteSize,
                }, path)
                leaseFence.assertActive()
                return { object_key: uploaded.object_key, sha256, md5, byte_size: byteSize }
              },
            }))
        }
        leaseFence.assertActive()
      }
      catch (error) {
        const safe = safeFailure(error)
        if (safe.retryable) throw error
        failure = safe
      }
      const finishedAt = now().toISOString()
      receipt = signRunnerReceipt(receiptBody(command, startedAt, finishedAt, outcome, failure), options.signingKey)
      await persistReceipt(command, receipt, options.signingKey, options.runnerId, claim.lease.token, options.runtimeRoot)
    }
    clearInterval(interval)
    await heartbeatTail
    leaseFence.assertActive()
    const completeAndAcknowledge = async () => {
      let completed: Awaited<ReturnType<RunnerControlPlane['complete']>>
      try { completed = await options.client.complete({ runner_id: options.runnerId, lease_token: claim.lease.token, receipt }) }
      catch (error) {
        const safeCode = receiptAuthorityConflictCode(error)
        if (safeCode) {
          const pending = (await listAuthenticatedPendingReceipts(options.signingKey, options.runtimeRoot, options.runnerId))
            .find((candidate) => candidate.receipt.command_id === receipt.command_id)
          if (!pending) throw new Error('runner receipt authority conflict has no authenticated pending journal')
          await quarantinePendingReceiptConflict(pending, options.signingKey, safeCode, now().toISOString(), options.runtimeRoot)
        }
        throw error
      }
      validateCompletionAcknowledgement(receipt, completed)
      if (usesRunnerProjectState(options)) await acknowledgeRunnerCommandPlatformState(command, receipt, options.signingKey, options.runtimeRoot)
      await acknowledgeReceipt(command.idempotency_key, receipt, options.signingKey, options.runtimeRoot)
      return completed
    }
    const completed = await completeAndAcknowledge()
    return { state: 'completed', command_id: command.command_id, receipt_status: receipt.status, duplicate: completed.duplicate, ...(discovery ? { discovery } : {}) }
  } finally {
    clearInterval(interval)
    await heartbeatTail
    if (heartbeatFailed) {
      try { await options.client.heartbeat(heartbeat(options, await currentDriveState(options), 'degraded', (await listAuthenticatedPendingReceipts(options.signingKey, options.runtimeRoot, options.runnerId)).length, now().toISOString())) }
      catch { /* A safe degraded heartbeat is best effort after lease processing. */ }
    }
  }
  }
  return usesRunnerProjectState(options)
    ? withRunnerProjectStateLock(command.job_id, command.platform, options.runtimeRoot, executeClaimedCommand)
    : executeClaimedCommand()
}

export async function runRunnerCycle(options: RunnerCycleOptions): Promise<RunnerCycleResult> {
  return withRunnerAuthorityLock(options.runtimeRoot, () => runRunnerCycleUnderAuthority(options))
}

export async function detectRunnerDriveState(): Promise<RunnerHeartbeatV1['drive_state']> {
  const { mediaInbox, archiveRoot } = studioPaths()
  if (!mediaInbox && !archiveRoot) return 'not_configured'
  try {
    if (mediaInbox) await access(mediaInbox)
    if (archiveRoot) await access(archiveRoot)
    return 'ready'
  } catch { return 'unavailable' }
}

export interface RunnerSourceProvenance {
  status: 'verified' | 'unknown'
  software_commit: string
  reason?: string
}

export async function inspectRunnerSourceProvenance(repoRoot = REPO_ROOT): Promise<RunnerSourceProvenance> {
  try {
    const [expectedRoot, rootResult, headResult, statusResult] = await Promise.all([
      realpath(resolve(repoRoot)),
      run('git', ['rev-parse', '--show-toplevel'], { cwd: repoRoot, timeoutMs: 10_000 }),
      run('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, timeoutMs: 10_000 }),
      run('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repoRoot, timeoutMs: 15_000 }),
    ])
    const actualRoot = await realpath(resolve(rootResult.stdout.trim()))
    if (actualRoot.toLocaleLowerCase('en-GB') !== expectedRoot.toLocaleLowerCase('en-GB')) return { status: 'unknown', software_commit: 'unknown', reason: 'configured repository root does not equal the actual Git root' }
    const commit = headResult.stdout.trim().toLowerCase()
    if (!/^[a-f0-9]{40}$/.test(commit)) return { status: 'unknown', software_commit: 'unknown', reason: 'Git HEAD is not an exact commit' }
    const configured = process.env.MINDMAKE_SOFTWARE_COMMIT?.trim().toLowerCase()
    if (configured && (!/^[a-f0-9]{40}$/.test(configured) || configured !== commit)) return { status: 'unknown', software_commit: 'unknown', reason: 'MINDMAKE_SOFTWARE_COMMIT does not equal the actual Git HEAD' }
    if (statusResult.stdout.trim()) return { status: 'unknown', software_commit: 'unknown', reason: 'repository source tree has tracked or untracked changes' }
    return { status: 'verified', software_commit: commit }
  } catch { return { status: 'unknown', software_commit: 'unknown', reason: 'repository source provenance could not be verified' } }
}

export async function requireRunnerSourceProvenance(repoRoot = REPO_ROOT): Promise<string> {
  const provenance = await inspectRunnerSourceProvenance(repoRoot)
  if (provenance.status !== 'verified') throw new Error(`runner source provenance is not clean and exact: ${provenance.reason ?? 'unknown'}`)
  return provenance.software_commit
}

export async function resolveRunnerSoftwareCommit(repoRoot = REPO_ROOT): Promise<string> {
  return (await inspectRunnerSourceProvenance(repoRoot)).software_commit
}

export function resolveProductionControlPlaneUrl(): string {
  const configured = process.env.MINDMAKE_CONTROL_PLANE_URL?.trim().replace(/\/$/, '')
  if (configured && configured !== DEFAULT_CONTROL_PLANE_URL) throw new Error('MINDMAKE_CONTROL_PLANE_URL must be absent or equal the pinned production Control Center runner URL')
  return DEFAULT_CONTROL_PLANE_URL
}

export function resolveProductionPreviewStorageOrigin(): string {
  const configured = process.env.MINDMAKE_PREVIEW_STORAGE_ORIGIN?.trim()
  if (!configured) throw new Error('MINDMAKE_PREVIEW_STORAGE_ORIGIN is required for command-bound preview uploads')
  return configured
}

function projectedJobStage(job: Awaited<ReturnType<typeof loadJobV2>>): RunnerProjectProjectionV1['job']['stage'] {
  if (job.stages.package.status === 'complete') return 'complete'
  const active = StageNameV2Schema.options.find((stage) => ['running', 'blocked', 'invalidated'].includes(job.stages[stage].status))
  if (active) return active
  const completed = StageNameV2Schema.options.filter((stage) => ['complete', 'skipped'].includes(job.stages[stage].status)).at(-1)
  return completed ?? 'brief'
}

function projectedJobStatus(job: Awaited<ReturnType<typeof loadJobV2>>): RunnerProjectProjectionV1['job']['status'] {
  if (job.stages.package.status === 'complete') return 'completed'
  if (StageNameV2Schema.options.some((stage) => job.stages[stage].status === 'blocked')) return 'blocked'
  return 'active'
}

function unavailableDiscoverySummary(safeCode: string): SanitizedDriveDiscoverySummary {
  return {
    schema_version: 1,
    scan_sequence: null,
    scanned_at: null,
    status: 'not_scanned',
    drive_state: 'unavailable',
    safe_codes: [safeCode],
    counts: { files_seen: 0, partial_files: 0, stable_files: 0, unsupported_files: 0, duplicate_files: 0, ready_candidates: 0, attention_candidates: 0, reviewed_candidates: 0 },
  }
}

function qaPayloadPassed(payload: unknown, platform?: RunnerProjectProjectionV1['platform_state']['platform']): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const value = payload as { passed?: unknown; results?: Array<{ platform?: unknown; passed?: unknown }>; verdicts?: Array<{ platform?: unknown; passed?: unknown }> }
  if (platform) return value.passed === true && Boolean((value.results ?? value.verdicts)?.find((item) => item.platform === platform && item.passed === true))
  if (value.passed === true) return true
  const children = value.results ?? value.verdicts
  return Boolean(children?.length && children.every((item) => item.passed === true))
}

export async function buildRunnerProjectProjection(input: RunnerProjectBootstrapInput, options: RunnerProjectBuildOptions = {}): Promise<RunnerProjectProjectionV1> {
  const platform = VideoPlatformV1Schema.parse(input.platform)
  if (options.omitExpectedPlatformState && options.acknowledgedCursor) throw new Error('legacy project bootstrap cannot be used with an acknowledged platform cursor')
  if (options.acknowledgedCursor && (options.acknowledgedCursor.job_id !== input.job_id || options.acknowledgedCursor.platform !== platform)) throw new Error('acknowledged project cursor belongs to another job or platform')
  const snapshot = await loadJobProjectionSnapshotV2(input.job_id)
  const job = snapshot.job
  const currentRevisionHash = jobRevisionHashV2(job)
  let parentArtifactHash: string
  let reviewRevisionHash = currentRevisionHash
  let reviewArtifactHash: string
  let reviewCreatedAt: string
  let semanticTargetMapHash: string
  let reviewTarget: RunnerReviewTargetV1
  let rangeLabel: string
  let editorialState: RunnerProjectProjectionV1['platform_state']['editorial_state'] = 'approved'
  let change = 'The current approved treatment is ready for bounded mobile presentation edits.'
  let direction = 'Review the current approved treatment and open bounded mobile presentation edits.'
  let provenance: RunnerLocalReviewBindingV1['provenance']

  if (input.gate === 'story') {
    const candidates = await readStageArtifactV2(input.job_id, 'candidates')
    parentArtifactHash = candidates.artifact_hash
    reviewArtifactHash = candidates.artifact_hash
    reviewRevisionHash = hashValue({ schema_version: 1, kind: 'story_review_revision', job_id: job.job_id, platform, parent_revision_hash: currentRevisionHash, parent_artifact_hash: parentArtifactHash, candidates_artifact_hash: candidates.artifact_hash })
    reviewCreatedAt = candidates.created_at
    reviewTarget = { kind: 'beat', ref: 'current-story-candidates' }
    semanticTargetMapHash = await createLocalReviewSemanticMap({ job_id: job.job_id, platform, gate: 'story', parent_revision_hash: currentRevisionHash, parent_artifact_hash: parentArtifactHash, target: reviewTarget })
    rangeLabel = 'Current story candidate projection'
    editorialState = 'needs_story_review'
    change = 'The exact current candidate projection is ready for story review.'
    direction = 'Review the exact current story and candidate projection.'
    provenance = { kind: 'story', candidates_stage_artifact_hash: candidates.artifact_hash }
  } else {
    const treatment = await readStageArtifactV2(input.job_id, 'treatment')
    const targetMap = await createMagicEditTargetMap(input.job_id, platform)
    if (targetMap.expected_parent_revision_hash !== currentRevisionHash || targetMap.expected_parent_artifact_hash !== treatment.artifact_hash) throw new Error('project target map is stale against the exact current treatment')
    if (!hasApprovalV2(job, 'treatment', treatment.artifact_hash, 'krish')) throw new Error('project bootstrap requires the exact current treatment approval from Krish')
    parentArtifactHash = treatment.artifact_hash
    reviewArtifactHash = treatment.artifact_hash
    reviewCreatedAt = treatment.created_at
    semanticTargetMapHash = targetMap.semantic_target_map_hash
    reviewTarget = { kind: 'range', start_ms: 0, end_ms: targetMap.duration_ms }
    rangeLabel = `Full ${(targetMap.duration_ms / 1000).toFixed(1)} second treatment`
    provenance = { kind: 'treatment', treatment_artifact_hash: treatment.artifact_hash }

    if (input.gate === 'final') {
    const render = await readStageArtifactV2(input.job_id, 'render')
    const renderPayload = RenderStagePayloadV2Schema.parse(render.payload)
    const platformRender = renderPayload.renders.find((item) => item.platform === platform)
    if (!platformRender) throw new Error(`current render has no ${platform} master`)
    if (render.input_hashes.treatment !== treatment.artifact_hash) throw new Error('project final render is not bound to the exact current treatment')
    if (await hashFile(resolve(platformRender.manifest_path)) !== platformRender.manifest_hash) throw new Error('project final render manifest no longer matches its content hash')
    if (await hashFile(resolve(platformRender.master_path)) !== platformRender.master_hash) throw new Error('project final master no longer matches its content hash')
    const qa = await readStageArtifactV2(input.job_id, 'qa')
    if (qa.input_hashes.render !== render.artifact_hash || !qaPayloadPassed(qa.payload, platform)) throw new Error('project final review requires current passing platform QA bound to the exact render')
    reviewArtifactHash = platformRender.master_hash
    reviewRevisionHash = hashValue({
      schema_version: 1,
      kind: 'final_review_revision',
      job_id: job.job_id,
      platform,
      parent_revision_hash: currentRevisionHash,
      parent_artifact_hash: parentArtifactHash,
      render_artifact_hash: render.artifact_hash,
      render_manifest_hash: platformRender.manifest_hash,
      qa_artifact_hash: qa.artifact_hash,
      artifact_hash: reviewArtifactHash,
    })
    reviewCreatedAt = qa.created_at
    editorialState = 'needs_final_review'
    change = 'The exact QA-passing master is ready for final review.'
    direction = 'Review the exact current platform master with passing QA.'
    provenance = { kind: 'final', render_stage_artifact_hash: render.artifact_hash, render_manifest_hash: platformRender.manifest_hash, qa_stage_artifact_hash: qa.artifact_hash, qa_render_input_hash: render.artifact_hash, platform_master_hash: platformRender.master_hash }
    } else if (input.gate === 'learning') {
    if (!input.review_artifact_hash) throw new Error('learning project bootstrap requires --review-artifact-hash')
    const learning = await resolveLearningArtifact(input.review_artifact_hash)
    reviewArtifactHash = input.review_artifact_hash
    reviewRevisionHash = hashValue({ schema_version: 1, kind: 'learning_review_revision', job_id: job.job_id, platform, parent_revision_hash: currentRevisionHash, parent_artifact_hash: parentArtifactHash, learning_artifact_hash: reviewArtifactHash, learning_artifact_schema: learning.schema })
    reviewCreatedAt = job.created_at
    editorialState = 'needs_learning_confirmation'
    change = 'The exact schema-validated learning artifact is ready for confirmation.'
    direction = 'Confirm, correct, or retain as observation the exact local learning inference.'
    provenance = { kind: 'learning', learning_artifact_hash: reviewArtifactHash, learning_artifact_schema: learning.schema }
    }
  }
  const hardGates = passedHardGates()
  const projectedJob = {
      job_id: job.job_id,
      source_event_count: snapshot.source_event_count,
      source_event_chain_hash: snapshot.event_chain_hash,
      source_revision_hash: currentRevisionHash,
      series: job.series,
      mode: job.mode,
      target_platforms: job.target_platforms,
      stage: projectedJobStage(job),
      status: projectedJobStatus(job),
      safe_title: input.safe_title,
      safe_summary: input.safe_summary,
  }
  const platformState: RunnerProjectPlatformStateV1 = desiredRunnerProjectPlatformState({
    platform,
    active_revision_hash: currentRevisionHash,
    active_artifact_hash: parentArtifactHash,
    semantic_target_map_hash: semanticTargetMapHash,
    editorial_state: editorialState,
    route_state: 'standard',
  }, options.acknowledgedCursor ?? null)
  const expectedPlatformState = options.acknowledgedCursor?.acknowledged_platform_state ?? null
  const reviewWithoutId = {
      gate: input.gate,
      safe_title: input.safe_title,
      safe_summary: input.safe_summary,
      parent_revision_hash: currentRevisionHash,
      parent_artifact_hash: parentArtifactHash,
      revision_hash: reviewRevisionHash,
      artifact_hash: reviewArtifactHash,
      candidate_hash: null,
      route_state: 'standard',
      safe_payload: {
        direction,
        change_title: input.safe_title,
        change_summary: input.safe_summary,
        range_label: rangeLabel,
        changes: [change],
        blocking_gates: hardGates,
        target: reviewTarget,
        semantic_target_map_hash: semanticTargetMapHash,
      },
      hard_gates: hardGates,
      created_at: reviewCreatedAt,
  }
  const reviewId = input.idempotency_key ?? deterministicRunnerReviewId({
    schema_version: 1,
    kind: 'runner_project_bootstrap',
    job: projectedJob,
    ...(options.omitExpectedPlatformState ? {} : { expected_platform_state: expectedPlatformState }),
    platform_state: platformState,
    review: reviewWithoutId,
  })
  const projection = RunnerProjectProjectionV1Schema.parse({
    job: projectedJob,
    ...(options.omitExpectedPlatformState ? {} : { expected_platform_state: expectedPlatformState }),
    platform_state: platformState,
    review: { id: reviewId, ...reviewWithoutId },
  })
  await persistLocalReviewBinding({
    schema_version: 1,
    review_id: reviewId,
    job_id: job.job_id,
    platform,
    gate: input.gate,
    parent_revision_hash: currentRevisionHash,
    parent_artifact_hash: parentArtifactHash,
    review_revision_hash: reviewRevisionHash,
    review_artifact_hash: reviewArtifactHash,
    candidate_hash: null,
    semantic_target_map_hash: semanticTargetMapHash,
    review_target: reviewTarget,
    hard_gates: hardGates,
    provenance,
    created_at: reviewCreatedAt,
  })
  return projection
}

function runnerProjectIntentHash(projection: RunnerProjectProjectionV1): string {
  const { expected_platform_state: _expected, review, ...shared } = projection
  const { id: _reviewId, ...reviewIntent } = review
  return hashValue({ ...shared, review: reviewIntent })
}

export async function acknowledgeRunnerProjectConflict(input: {
  job_id: string
  platform: RunnerProjectProjectionV1['platform_state']['platform']
  journal_hash: string
  operator_confirmation_ref: string
}): Promise<Record<string, unknown>> {
  const signingKey = await loadRunnerReceiptSigningKey()
  if (!signingKey) throw new Error('runner receipt signing credential is unavailable or too short')
  const identity = await loadOrCreateRunnerIdentity(undefined, signingKey)
  return withAuthenticatedRunnerAuthority(undefined, signingKey, identity.runner_id, async () => {
    const resolution = await recordRunnerProjectConflictResolution({
      job_id: input.job_id,
      platform: input.platform,
      runner_id: identity.runner_id,
      journal_hash: input.journal_hash,
      operator_confirmation_ref: input.operator_confirmation_ref,
      resolved_at: new Date().toISOString(),
    }, signingKey)
    return {
      schema_version: 1,
      status: 'resolved',
      job_id: input.job_id,
      platform: input.platform,
      journal_hash: input.journal_hash,
      acknowledged_cursor_hash: resolution.acknowledged_cursor.cursor_hash,
      resolution_hash: resolution.resolution_hash,
    }
  })
}

export async function publishRunnerProject(input: RunnerProjectBootstrapInput, repoRoot = REPO_ROOT): Promise<Record<string, unknown>> {
  const softwareCommit = await requireRunnerSourceProvenance(repoRoot)
  const signingKey = await loadRunnerReceiptSigningKey()
  if (!signingKey) throw new Error('runner receipt signing credential is unavailable or too short')
  const identity = await loadOrCreateRunnerIdentity(undefined, signingKey)
  const token = await readWindowsCredential(repoRoot, CONTROL_CENTER_RUNNER_CREDENTIAL)
  const client = new ControlPlaneClient({ baseUrl: resolveProductionControlPlaneUrl(), token, previewStorageOrigin: resolveProductionPreviewStorageOrigin() })
  const platform = VideoPlatformV1Schema.parse(input.platform)
  return withAuthenticatedRunnerAuthority(undefined, signingKey, identity.runner_id, () => withRunnerProjectStateLock(input.job_id, platform, undefined, async () => {
    let response: Awaited<ReturnType<ControlPlaneClient['project']>> | null = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let pending = await loadPendingRunnerProject(input.job_id, platform, signingKey)
      if (pending && pending.request.runner_id !== identity.runner_id) {
        await quarantinePendingRunnerProject(pending, signingKey, 'runner_identity_conflict', new Date().toISOString())
        throw new Error('pending runner project belongs to another runner identity and was quarantined')
      }
      await assertRunnerProjectHasNoPendingCommandReceipt(input.job_id, signingKey)
      try { await assertRunnerPlatformCanProject(input.job_id, platform, signingKey) }
      catch (error) {
        if (error instanceof RunnerProjectGlobalLineageError && pending) await quarantinePendingRunnerProject(pending, signingKey, 'global_lineage_conflict', new Date().toISOString())
        throw error
      }
      if (!pending) {
        const cursor = await loadAcknowledgedRunnerProjectCursor(input.job_id, platform, signingKey)
        const projection = await buildRunnerProjectProjection(input, { acknowledgedCursor: cursor })
        const projectionHash = hashValue(runnerProjectProjectionHashInputV1(projection))
        const request = RunnerProjectRequestV1Schema.parse({
          schema_version: 1,
          runner_id: identity.runner_id,
          software_commit: softwareCommit,
          idempotency_key: projection.review.id,
          projection_hash: projectionHash,
          projection,
        })
        pending = await persistPendingRunnerProject(request, signingKey, new Date().toISOString())
      }

      try {
        const submitted = await submitPendingRunnerProjectWithAdoption({
          pending,
          project: client.project.bind(client),
          signingKey,
          now: () => new Date(),
        })
        pending = submitted.pending
        response = submitted.response
      } catch (error) {
        if (error instanceof ControlPlaneRequestError && error.status === 409 && error.safeCode === 'command_in_flight') {
          const current = await loadPendingRunnerProject(input.job_id, platform, signingKey)
          if (current) await discardPendingRunnerProject(current, signingKey)
          throw error
        }
        if (error instanceof ControlPlaneRequestError && error.status === 409 && ['projection_conflict', 'idempotency_conflict'].includes(error.safeCode ?? '')) {
          const current = await loadPendingRunnerProject(input.job_id, platform, signingKey)
          if (current) await quarantinePendingRunnerProject(current, signingKey, error.safeCode as 'projection_conflict' | 'idempotency_conflict', new Date().toISOString())
        }
        throw error
      }

      const acknowledged = await acknowledgeRunnerProject(pending, signingKey, new Date().toISOString())
      const currentProjection = await buildRunnerProjectProjection(input, { acknowledgedCursor: acknowledged })
      const fulfillsCurrentIntent = runnerProjectIntentHash(currentProjection) === runnerProjectIntentHash(pending.request.projection)
        && (input.idempotency_key === undefined || input.idempotency_key === pending.request.idempotency_key)
      if (fulfillsCurrentIntent) return { schema_version: 1, ...response }
    }
    throw new Error('runner project could not reconcile the pending projection to the current requested review')
  }))
}

async function productionRunnerOptions(repoRoot = REPO_ROOT): Promise<Omit<RunnerCycleOptions, 'client'> & { client: ControlPlaneClient }> {
  const softwareCommit = await requireRunnerSourceProvenance(repoRoot)
  const signingKey = await loadRunnerReceiptSigningKey()
  if (!signingKey) throw new Error('runner receipt signing credential is unavailable or too short')
  const identity = await loadOrCreateRunnerIdentity(undefined, signingKey)
  const token = await readWindowsCredential(repoRoot, CONTROL_CENTER_RUNNER_CREDENTIAL)
  const client = new ControlPlaneClient({ baseUrl: resolveProductionControlPlaneUrl(), token, previewStorageOrigin: resolveProductionPreviewStorageOrigin() })
  return {
    client,
    runnerId: identity.runner_id,
    softwareCommit,
    signingKey,
    driveState: detectRunnerDriveState,
    discoverInbox: async () => {
      try { return sanitizedDriveDiscoverySummary(await scanDriveInbox({ softwareCommit, recordUnchanged: false })) }
      catch { return unavailableDiscoverySummary('discovery_scan_failed') }
    },
    repoRoot,
    verifySourceProvenance: () => requireRunnerSourceProvenance(repoRoot),
  }
}

export async function runRunnerOnce(repoRoot = REPO_ROOT): Promise<RunnerCycleResult> {
  const lock = await acquireRunnerLock()
  try { return await runRunnerCycle(await productionRunnerOptions(repoRoot)) }
  finally { await lock.release() }
}

export interface RunnerMaintenanceResult {
  receipt_journals: RunnerReceiptJournalStatusV1
  project_journals: RunnerProjectJournalStatusV1
  retention_permitted: boolean
  retention?: Awaited<ReturnType<NonNullable<RunnerControlPlane['previewRetention']>>>
  retention_failed?: true
}

export async function runRunnerMaintenanceUnderAuthority(
  options: Pick<RunnerCycleOptions, 'client' | 'runnerId' | 'signingKey' | 'runtimeRoot'>,
  requestRetention: boolean,
): Promise<RunnerMaintenanceResult> {
  return withAuthenticatedRunnerAuthority(options.runtimeRoot, options.signingKey, options.runnerId, async () => {
    const receiptJournals = await runnerReceiptJournalStatus(options.signingKey, options.runtimeRoot, options.runnerId)
    const projectJournals = await runnerProjectJournalStatus(options.signingKey, options.runtimeRoot)
    const retentionPermitted = runnerJournalsPermitPreviewRetention(receiptJournals, projectJournals)
    if (!requestRetention || !retentionPermitted || !options.client.previewRetention) {
      return { receipt_journals: receiptJournals, project_journals: projectJournals, retention_permitted: retentionPermitted }
    }
    try {
      const retention = await options.client.previewRetention({ runner_id: options.runnerId, limit: 100 })
      return { receipt_journals: receiptJournals, project_journals: projectJournals, retention_permitted: true, retention }
    } catch {
      return { receipt_journals: receiptJournals, project_journals: projectJournals, retention_permitted: true, retention_failed: true }
    }
  })
}

export async function runRunnerDaemon(input: { repoRoot?: string; signal?: AbortSignal; onStatus?: (status: Record<string, unknown>) => void } = {}): Promise<void> {
  const lock = await acquireRunnerLock()
  let backoffMs = DEFAULT_IDLE_INTERVAL_MS
  let nextPreviewRetentionAt = 0
  try {
    const options = await productionRunnerOptions(input.repoRoot ?? REPO_ROOT)
    while (!input.signal?.aborted) {
      try {
        const result = await runRunnerCycle(options)
        const maintenance = await runRunnerMaintenanceUnderAuthority(
          options,
          !input.signal?.aborted && Date.now() >= nextPreviewRetentionAt,
        )
        const projectJournals = maintenance.project_journals
        const receiptJournals = maintenance.receipt_journals
        const attentionCode = receiptJournals.receipt_attention_code ?? projectJournals.project_attention_code
        input.onStatus?.({
          ok: attentionCode === null,
          state: attentionCode ? 'attention' : result.state,
          ...(attentionCode ? { safe_code: attentionCode } : {}),
          receipt_journals: receiptJournals,
          project_journals: projectJournals,
          ...(result.command_id ? { command_id: result.command_id, receipt_status: result.receipt_status } : {}),
          ...(result.discovery ? { discovery: result.discovery } : {}),
        })
        if (maintenance.retention) {
          nextPreviewRetentionAt = Date.now() + PREVIEW_RETENTION_INTERVAL_MS
          input.onStatus?.({ ok: true, state: 'retention_checked', reviewed: maintenance.retention.reviewed, deleted_objects: maintenance.retention.deleted_objects, cutoff: maintenance.retention.cutoff })
        } else if (maintenance.retention_failed) {
          nextPreviewRetentionAt = Date.now() + PREVIEW_RETENTION_RETRY_MS
          input.onStatus?.({ ok: false, state: 'retention_degraded', safe_code: 'preview_retention_unavailable' })
        }
        backoffMs = DEFAULT_IDLE_INTERVAL_MS
      } catch {
        input.onStatus?.({ ok: false, state: 'degraded', safe_code: 'runner_cycle_failed' })
        backoffMs = Math.min(MAX_BACKOFF_MS, Math.max(DEFAULT_IDLE_INTERVAL_MS, backoffMs * 2))
      }
      if (input.signal?.aborted) break
      await new Promise<void>((resolveSleep) => {
        const timer = setTimeout(resolveSleep, backoffMs)
        input.signal?.addEventListener('abort', () => { clearTimeout(timer); resolveSleep() }, { once: true })
      })
    }
  } finally {
    await lock.release()
  }
}

export async function runnerStatus(): Promise<Record<string, unknown>> {
  const signingKey = await loadRunnerReceiptSigningKey()
  if (!signingKey) throw new Error('runner receipt signing credential is unavailable or too short')
  const identity = await loadOrCreateRunnerIdentity(undefined, signingKey)
  let active: boolean | 'unknown' = 'unknown'
  try {
    const value = JSON.parse(await readFile(lockPath(), 'utf8')) as RunnerLockMetadata
    active = typeof value.token === 'string' ? await lockOwnerIsActive(value) : 'unknown'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') active = false
  }
  const provenance = await inspectRunnerSourceProvenance()
  let discovery: SanitizedDriveDiscoverySummary
  let discoveryStateInvalid = false
  try { discovery = await driveDiscoveryStatus() }
  catch {
    discoveryStateInvalid = true
    discovery = unavailableDiscoverySummary('discovery_state_invalid')
  }
  const mountedDriveState = await detectRunnerDriveState()
  const projectJournals = await runnerProjectJournalStatus(signingKey)
  const receiptJournals = await runnerReceiptJournalStatus(signingKey, undefined, identity.runner_id)
  const effectiveDriveState = discoveryStateInvalid
    ? 'unavailable'
    : discovery.status === 'not_scanned'
    ? mountedDriveState
    : discovery.drive_state === 'ready' ? mountedDriveState : discovery.drive_state
  return {
    schema_version: 1,
    runner_id: identity.runner_id,
    active,
    software_commit: provenance.software_commit,
    source_provenance: provenance.status,
    ...(provenance.reason ? { source_provenance_reason: provenance.reason } : {}),
    drive_state: effectiveDriveState,
    discovery,
    pending_receipts: receiptJournals.pending_receipts,
    receipt_journals: receiptJournals,
    project_journals: projectJournals,
  }
}
