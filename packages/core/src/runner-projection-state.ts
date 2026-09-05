import { randomUUID } from 'node:crypto'
import { readFile, readdir, unlink } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import {
  IdentifierV1Schema,
  RunnerCommandEnvelopeV1Schema,
  RunnerProjectRequestV1Schema,
  RunnerProjectPlatformStateV1Schema,
  RunnerReceiptV1Schema,
  type RunnerCommandEnvelopeV1,
  type RunnerProjectPlatformStateV1,
  type RunnerProjectRequestV1,
  type RunnerReceiptV1,
  type VideoPlatformV1,
} from '@mindmake/contracts'
import { signRunnerReceiptHash, verifyRunnerReceiptHash } from './approval-signing.js'
import { withDurableFileLock } from './durable-lock.js'
import { hashValue } from './hash.js'
import { studioPaths } from './paths.js'
import { writeRunnerAuthorityJsonAtomic } from './runner-authority-files.js'

interface UndoIdentityV1 {
  revision_hash: string
  artifact_hash: string
  candidate_hash: string | null
}

interface ProjectionAcknowledgementV1 {
  kind: 'projection'
  idempotency_key: string
  projection_hash: string
}

interface CommandAcknowledgementV1 {
  kind: 'command_completion'
  command_id: string
  command_hash: string
  receipt_hash: string
}

type PlatformAcknowledgementV1 = ProjectionAcknowledgementV1 | CommandAcknowledgementV1

interface RunnerProjectCursorBodyV1 {
  schema_version: 1
  job_id: string
  platform: VideoPlatformV1
  acknowledged_source_event_count: number
  acknowledged_source_event_chain_hash: string
  acknowledged_source_revision_hash: string
  acknowledged_platform_state: RunnerProjectPlatformStateV1
  undo_ancestry: UndoIdentityV1[]
  acknowledgement: PlatformAcknowledgementV1
  acknowledged_at: string
}

export interface SignedRunnerProjectCursorV1 extends RunnerProjectCursorBodyV1 {
  cursor_hash: string
  cursor_signature: string
}

interface PendingRunnerProjectBodyV1 {
  schema_version: 1
  request: RunnerProjectRequestV1
  created_at: string
}

export interface SignedPendingRunnerProjectV1 extends PendingRunnerProjectBodyV1 {
  journal_hash: string
  journal_signature: string
}

export type RunnerProjectConflictCodeV1 = 'projection_conflict' | 'idempotency_conflict' | 'runner_identity_conflict' | 'global_lineage_conflict'

interface RunnerProjectConflictBodyV1 {
  schema_version: 1
  safe_code: RunnerProjectConflictCodeV1
  quarantined_at: string
  pending: SignedPendingRunnerProjectV1
}

export interface SignedRunnerProjectConflictV1 extends RunnerProjectConflictBodyV1 {
  conflict_hash: string
  conflict_signature: string
}

interface RunnerProjectConflictResolutionBodyV1 {
  schema_version: 1
  conflict_hash: string
  acknowledged_cursor: SignedRunnerProjectCursorV1
  operator_confirmation_ref: string
  resolved_at: string
}

export interface SignedRunnerProjectConflictResolutionV1 extends RunnerProjectConflictResolutionBodyV1 {
  resolution_hash: string
  resolution_signature: string
}

export interface RunnerProjectJournalStatusV1 {
  pending_projects: number
  conflicted_projects: number
  resolved_conflicts: number
  projection_conflicts: number
  idempotency_conflicts: number
  runner_identity_conflicts: number
  global_lineage_conflicts: number
  project_attention_code: 'runner_project_idempotency_conflict' | 'runner_project_identity_conflict' | 'runner_project_global_lineage_conflict' | 'runner_project_projection_conflict' | null
}

export class RunnerProjectGlobalLineageError extends Error {
  constructor(readonly activePlatform: VideoPlatformV1, readonly requestedPlatform: VideoPlatformV1) {
    super(`runner magic-edit lineage is already active on ${activePlatform}; ${requestedPlatform} is blocked until return to root`)
    this.name = 'RunnerProjectGlobalLineageError'
  }
}

const PROJECT_STATE_LOCK_TIMEOUT_MS = 15_000
const PROJECT_STATE_LOCK_INCOMPLETE_GRACE_MS = 2_000

function projectStateRoot(runtimeRoot = studioPaths().runtimeRoot): string {
  return join(runtimeRoot, 'runner', 'project-state')
}

function projectStatePath(jobIdInput: string, platformInput: VideoPlatformV1 | null, runtimeRoot: string | undefined, ...parts: string[]): string {
  const jobId = IdentifierV1Schema.parse(jobIdInput)
  const platform = platformInput === null ? null : RunnerProjectPlatformStateV1Schema.shape.platform.parse(platformInput)
  const root = resolve(projectStateRoot(runtimeRoot))
  const candidate = resolve(root, jobId, ...(platform ? [platform] : []), ...parts)
  const child = relative(root, candidate)
  if (!child || child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || child === '..' || isAbsolute(child)) throw new Error('runner project state path escapes its runtime root')
  return candidate
}

function cursorPath(jobId: string, platform: VideoPlatformV1, runtimeRoot?: string): string {
  return projectStatePath(jobId, platform, runtimeRoot, 'acknowledged.json')
}

function pendingPath(jobId: string, platform: VideoPlatformV1, runtimeRoot?: string): string {
  return projectStatePath(jobId, platform, runtimeRoot, 'pending.json')
}

function conflictPath(jobId: string, platform: VideoPlatformV1, journalHash: string, runtimeRoot?: string): string {
  if (!sha256(journalHash)) throw new Error('runner project conflict hash is invalid')
  return projectStatePath(jobId, platform, runtimeRoot, 'conflicts', `${journalHash}.json`)
}

function conflictResolutionPath(jobId: string, platform: VideoPlatformV1, conflictHash: string, runtimeRoot?: string): string {
  if (!sha256(conflictHash)) throw new Error('runner project conflict resolution hash is invalid')
  return projectStatePath(jobId, platform, runtimeRoot, 'resolutions', `${conflictHash}.json`)
}

function conflictCode(value: unknown): value is RunnerProjectConflictCodeV1 {
  return ['projection_conflict', 'idempotency_conflict', 'runner_identity_conflict', 'global_lineage_conflict'].includes(String(value))
}

function projectStateLockPath(jobId: string, _platform: VideoPlatformV1, runtimeRoot?: string): string {
  return projectStatePath(jobId, null, runtimeRoot, '.lock')
}

export async function withRunnerProjectStateLock<T>(jobId: string, platformInput: VideoPlatformV1, runtimeRoot: string | undefined, callback: () => Promise<T>): Promise<T> {
  const platform = RunnerProjectPlatformStateV1Schema.shape.platform.parse(platformInput)
  const path = projectStateLockPath(jobId, platform, runtimeRoot)
  return withDurableFileLock(path, callback, {
    timeoutMs: PROJECT_STATE_LOCK_TIMEOUT_MS,
    incompleteGraceMs: PROJECT_STATE_LOCK_INCOMPLETE_GRACE_MS,
  })
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort()
  const sorted = [...expected].sort()
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index])
}

function sha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function parseUndoIdentity(value: unknown): UndoIdentityV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('runner project cursor undo identity is invalid')
  const record = value as Record<string, unknown>
  if (!exactKeys(record, ['revision_hash', 'artifact_hash', 'candidate_hash'])
    || !sha256(record.revision_hash)
    || !sha256(record.artifact_hash)
    || !(record.candidate_hash === null || sha256(record.candidate_hash))) throw new Error('runner project cursor undo identity is invalid')
  return { revision_hash: record.revision_hash, artifact_hash: record.artifact_hash, candidate_hash: record.candidate_hash }
}

function activeIdentity(state: RunnerProjectPlatformStateV1): UndoIdentityV1 {
  return {
    revision_hash: state.active_revision_hash,
    artifact_hash: state.active_artifact_hash,
    candidate_hash: state.active_candidate_hash,
  }
}

function sameIdentity(left: UndoIdentityV1, right: UndoIdentityV1): boolean {
  return left.revision_hash === right.revision_hash
    && left.artifact_hash === right.artifact_hash
    && left.candidate_hash === right.candidate_hash
}

function assertAncestryMatchesState(state: RunnerProjectPlatformStateV1, ancestry: UndoIdentityV1[]): void {
  const immediate = ancestry[0]
  if (!immediate) {
    if (state.parent_revision_hash !== null || state.parent_artifact_hash !== null || state.parent_candidate_hash !== null) throw new Error('runner project cursor parent state has no matching undo ancestry')
    return
  }
  if (state.parent_revision_hash !== immediate.revision_hash
    || state.parent_artifact_hash !== immediate.artifact_hash
    || state.parent_candidate_hash !== immediate.candidate_hash) throw new Error('runner project cursor parent state does not match its undo ancestry')
  const baseIndex = ancestry.findIndex((item) => item.candidate_hash === null)
  if (baseIndex >= 0 && baseIndex !== ancestry.length - 1) throw new Error('runner project cursor undo ancestry continues beyond its base state')
}

function parseAcknowledgement(value: unknown): PlatformAcknowledgementV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('runner project cursor acknowledgement is invalid')
  const record = value as Record<string, unknown>
  if (record.kind === 'projection') {
    if (!exactKeys(record, ['kind', 'idempotency_key', 'projection_hash'])
      || typeof record.idempotency_key !== 'string'
      || !/^[0-9a-f-]{36}$/i.test(record.idempotency_key)
      || !sha256(record.projection_hash)) throw new Error('runner project cursor projection acknowledgement is invalid')
    return { kind: 'projection', idempotency_key: record.idempotency_key, projection_hash: record.projection_hash }
  }
  if (record.kind === 'command_completion') {
    if (!exactKeys(record, ['kind', 'command_id', 'command_hash', 'receipt_hash'])
      || typeof record.command_id !== 'string'
      || !/^[0-9a-f-]{36}$/i.test(record.command_id)
      || !sha256(record.command_hash)
      || !sha256(record.receipt_hash)) throw new Error('runner project cursor command acknowledgement is invalid')
    return { kind: 'command_completion', command_id: record.command_id, command_hash: record.command_hash, receipt_hash: record.receipt_hash }
  }
  throw new Error('runner project cursor acknowledgement kind is unsupported')
}

function verifyCursor(value: unknown, signingKey: Buffer): SignedRunnerProjectCursorV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('runner project cursor is invalid')
  const record = value as Record<string, unknown>
  if (!exactKeys(record, ['schema_version', 'job_id', 'platform', 'acknowledged_source_event_count', 'acknowledged_source_event_chain_hash', 'acknowledged_source_revision_hash', 'acknowledged_platform_state', 'undo_ancestry', 'acknowledgement', 'acknowledged_at', 'cursor_hash', 'cursor_signature'])
    || record.schema_version !== 1
    || typeof record.job_id !== 'string'
    || !IdentifierV1Schema.safeParse(record.job_id).success
    || typeof record.acknowledged_source_event_count !== 'number'
    || !Number.isSafeInteger(record.acknowledged_source_event_count)
    || record.acknowledged_source_event_count < 1
    || !sha256(record.acknowledged_source_event_chain_hash)
    || !sha256(record.acknowledged_source_revision_hash)
    || !Array.isArray(record.undo_ancestry)
    || record.undo_ancestry.length > 100
    || typeof record.acknowledged_at !== 'string'
    || !Number.isFinite(Date.parse(record.acknowledged_at))
    || !sha256(record.cursor_hash)
    || !sha256(record.cursor_signature)) throw new Error('runner project cursor metadata is invalid')
  const state = RunnerProjectPlatformStateV1Schema.parse(record.acknowledged_platform_state)
  if (record.platform !== state.platform) throw new Error('runner project cursor platform does not match its state')
  const ancestry = record.undo_ancestry.map(parseUndoIdentity)
  assertAncestryMatchesState(state, ancestry)
  const acknowledgement = parseAcknowledgement(record.acknowledgement)
  const body: RunnerProjectCursorBodyV1 = {
    schema_version: 1,
    job_id: record.job_id,
    platform: state.platform,
    acknowledged_source_event_count: record.acknowledged_source_event_count,
    acknowledged_source_event_chain_hash: record.acknowledged_source_event_chain_hash,
    acknowledged_source_revision_hash: record.acknowledged_source_revision_hash,
    acknowledged_platform_state: state,
    undo_ancestry: ancestry,
    acknowledgement,
    acknowledged_at: record.acknowledged_at,
  }
  if (hashValue(body) !== record.cursor_hash || !verifyRunnerReceiptHash(signingKey, record.cursor_hash, record.cursor_signature)) throw new Error('runner project cursor failed authentication')
  return { ...body, cursor_hash: record.cursor_hash, cursor_signature: record.cursor_signature }
}

function signCursor(body: RunnerProjectCursorBodyV1, signingKey: Buffer): SignedRunnerProjectCursorV1 {
  const cursorHash = hashValue(body)
  return { ...body, cursor_hash: cursorHash, cursor_signature: signRunnerReceiptHash(signingKey, cursorHash) }
}

function verifyConflict(value: unknown, signingKey: Buffer): SignedRunnerProjectConflictV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('runner project conflict journal is invalid')
  const record = value as Record<string, unknown>
  if (!exactKeys(record, ['schema_version', 'safe_code', 'quarantined_at', 'pending', 'conflict_hash', 'conflict_signature'])
    || record.schema_version !== 1
    || !conflictCode(record.safe_code)
    || typeof record.quarantined_at !== 'string'
    || !Number.isFinite(Date.parse(record.quarantined_at))
    || !sha256(record.conflict_hash)
    || !sha256(record.conflict_signature)) throw new Error('runner project conflict journal metadata is invalid')
  const pending = verifyPendingProject(record.pending, signingKey)
  const body: RunnerProjectConflictBodyV1 = {
    schema_version: 1,
    safe_code: record.safe_code,
    quarantined_at: record.quarantined_at,
    pending,
  }
  if (hashValue(body) !== record.conflict_hash || !verifyRunnerReceiptHash(signingKey, record.conflict_hash, record.conflict_signature)) throw new Error('runner project conflict journal failed authentication')
  return { ...body, conflict_hash: record.conflict_hash, conflict_signature: record.conflict_signature }
}

function signConflict(body: RunnerProjectConflictBodyV1, signingKey: Buffer): SignedRunnerProjectConflictV1 {
  const conflictHash = hashValue(body)
  return { ...body, conflict_hash: conflictHash, conflict_signature: signRunnerReceiptHash(signingKey, conflictHash) }
}

function verifyConflictResolution(value: unknown, signingKey: Buffer): SignedRunnerProjectConflictResolutionV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('runner project conflict resolution is invalid')
  const record = value as Record<string, unknown>
  if (!exactKeys(record, ['schema_version', 'conflict_hash', 'acknowledged_cursor', 'operator_confirmation_ref', 'resolved_at', 'resolution_hash', 'resolution_signature'])
    || record.schema_version !== 1
    || !sha256(record.conflict_hash)
    || typeof record.operator_confirmation_ref !== 'string'
    || record.operator_confirmation_ref.length < 8
    || record.operator_confirmation_ref.length > 240
    || /[\u0000-\u001f\u007f]/.test(record.operator_confirmation_ref)
    || typeof record.resolved_at !== 'string'
    || !Number.isFinite(Date.parse(record.resolved_at))
    || !sha256(record.resolution_hash)
    || !sha256(record.resolution_signature)) throw new Error('runner project conflict resolution metadata is invalid')
  const acknowledgedCursor = verifyCursor(record.acknowledged_cursor, signingKey)
  const body: RunnerProjectConflictResolutionBodyV1 = {
    schema_version: 1,
    conflict_hash: record.conflict_hash,
    acknowledged_cursor: acknowledgedCursor,
    operator_confirmation_ref: record.operator_confirmation_ref,
    resolved_at: record.resolved_at,
  }
  if (hashValue(body) !== record.resolution_hash || !verifyRunnerReceiptHash(signingKey, record.resolution_hash, record.resolution_signature)) throw new Error('runner project conflict resolution failed authentication')
  return { ...body, resolution_hash: record.resolution_hash, resolution_signature: record.resolution_signature }
}

function signConflictResolution(body: RunnerProjectConflictResolutionBodyV1, signingKey: Buffer): SignedRunnerProjectConflictResolutionV1 {
  const resolutionHash = hashValue(body)
  return { ...body, resolution_hash: resolutionHash, resolution_signature: signRunnerReceiptHash(signingKey, resolutionHash) }
}

export async function loadAcknowledgedRunnerProjectCursor(jobId: string, platformInput: VideoPlatformV1, signingKey: Buffer, runtimeRoot?: string): Promise<SignedRunnerProjectCursorV1 | null> {
  const platform = RunnerProjectPlatformStateV1Schema.shape.platform.parse(platformInput)
  try {
    const cursor = verifyCursor(JSON.parse(await readFile(cursorPath(jobId, platform, runtimeRoot), 'utf8')), signingKey)
    if (cursor.job_id !== jobId || cursor.platform !== platform) throw new Error('runner project cursor identity does not match its location')
    return cursor
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function strictProjectStateJobs(runtimeRoot?: string): Promise<string[]> {
  const root = projectStateRoot(runtimeRoot)
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return entries.sort((left, right) => left.name.localeCompare(right.name)).map((entry) => {
    if (!entry.isDirectory()) throw new Error('runner project state root contains an unexpected entry')
    const parsed = IdentifierV1Schema.safeParse(entry.name)
    if (!parsed.success) throw new Error('runner project state contains an invalid job directory')
    return parsed.data
  })
}

async function strictProjectStatePlatforms(jobId: string, runtimeRoot?: string): Promise<VideoPlatformV1[]> {
  const entries = await readdir(projectStatePath(jobId, null, runtimeRoot), { withFileTypes: true })
  const platforms: VideoPlatformV1[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === '.lock' && entry.isFile()) continue
    if (!entry.isDirectory()) throw new Error('runner project job directory contains an unexpected entry')
    const parsed = RunnerProjectPlatformStateV1Schema.shape.platform.safeParse(entry.name)
    if (!parsed.success) throw new Error('runner project state contains an unsupported platform directory')
    platforms.push(parsed.data)
  }
  return platforms
}

async function strictPlatformEntries(jobId: string, platform: VideoPlatformV1, runtimeRoot?: string): Promise<Set<string>> {
  const entries = await readdir(projectStatePath(jobId, platform, runtimeRoot), { withFileTypes: true })
  const names = new Set<string>()
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const validFile = ['pending.json', 'acknowledged.json'].includes(entry.name) && entry.isFile()
    const validDirectory = ['conflicts', 'resolutions'].includes(entry.name) && entry.isDirectory()
    if (!validFile && !validDirectory) throw new Error('runner project platform directory contains an unexpected entry')
    names.add(entry.name)
  }
  return names
}

async function strictContentAddressedJournalNames(path: string, label: string): Promise<string[]> {
  let entries
  try { entries = await readdir(path, { withFileTypes: true }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return entries.sort((left, right) => left.name.localeCompare(right.name)).map((entry) => {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) throw new Error(`runner project ${label} directory contains an unexpected entry`)
    return entry.name
  })
}

export async function listAcknowledgedRunnerProjectCursors(jobId: string, signingKey: Buffer, runtimeRoot?: string): Promise<SignedRunnerProjectCursorV1[]> {
  let platforms: VideoPlatformV1[]
  try { platforms = await strictProjectStatePlatforms(IdentifierV1Schema.parse(jobId), runtimeRoot) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const cursors: SignedRunnerProjectCursorV1[] = []
  for (const platform of platforms) {
    await strictPlatformEntries(jobId, platform, runtimeRoot)
    const cursor = await loadAcknowledgedRunnerProjectCursor(jobId, platform, signingKey, runtimeRoot)
    if (cursor) cursors.push(cursor)
  }
  return cursors
}

export async function assertRunnerPlatformCanProject(jobId: string, platformInput: VideoPlatformV1, signingKey: Buffer, runtimeRoot?: string): Promise<void> {
  const platform = RunnerProjectPlatformStateV1Schema.shape.platform.parse(platformInput)
  const conflicting = (await listAcknowledgedRunnerProjectCursors(jobId, signingKey, runtimeRoot))
    .find((candidate) => candidate.platform !== platform && candidate.acknowledged_platform_state.active_candidate_hash !== null)
  if (conflicting) throw new RunnerProjectGlobalLineageError(conflicting.platform, platform)
}

async function persistCursor(body: RunnerProjectCursorBodyV1, signingKey: Buffer, runtimeRoot?: string): Promise<SignedRunnerProjectCursorV1> {
  assertAncestryMatchesState(body.acknowledged_platform_state, body.undo_ancestry)
  const cursor = signCursor(body, signingKey)
  await writeRunnerAuthorityJsonAtomic(cursorPath(body.job_id, body.platform, runtimeRoot), cursor, runtimeRoot)
  return cursor
}

function verifyPendingProject(value: unknown, signingKey: Buffer): SignedPendingRunnerProjectV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('pending runner project journal is invalid')
  const record = value as Record<string, unknown>
  if (!exactKeys(record, ['schema_version', 'request', 'created_at', 'journal_hash', 'journal_signature'])
    || record.schema_version !== 1
    || typeof record.created_at !== 'string'
    || !Number.isFinite(Date.parse(record.created_at))
    || !sha256(record.journal_hash)
    || !sha256(record.journal_signature)) throw new Error('pending runner project journal metadata is invalid')
  const request = RunnerProjectRequestV1Schema.parse(record.request)
  const body: PendingRunnerProjectBodyV1 = { schema_version: 1, request, created_at: record.created_at }
  if (hashValue(body) !== record.journal_hash || !verifyRunnerReceiptHash(signingKey, record.journal_hash, record.journal_signature)) throw new Error('pending runner project journal failed authentication')
  return { ...body, journal_hash: record.journal_hash, journal_signature: record.journal_signature }
}

export async function loadPendingRunnerProject(jobId: string, platform: VideoPlatformV1, signingKey: Buffer, runtimeRoot?: string): Promise<SignedPendingRunnerProjectV1 | null> {
  try {
    const pending = verifyPendingProject(JSON.parse(await readFile(pendingPath(jobId, platform, runtimeRoot), 'utf8')), signingKey)
    if (pending.request.projection.job.job_id !== jobId || pending.request.projection.platform_state.platform !== platform) throw new Error('pending runner project journal identity does not match its location')
    return pending
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function listPendingRunnerProjects(signingKey: Buffer, runtimeRoot?: string): Promise<SignedPendingRunnerProjectV1[]> {
  const jobs = await strictProjectStateJobs(runtimeRoot)
  const pending: SignedPendingRunnerProjectV1[] = []
  for (const jobId of jobs) {
    const platforms = await strictProjectStatePlatforms(jobId, runtimeRoot)
    for (const platform of platforms) {
      await strictPlatformEntries(jobId, platform, runtimeRoot)
      const value = await loadPendingRunnerProject(jobId, platform, signingKey, runtimeRoot)
      if (value) pending.push(value)
    }
  }
  return pending
}

export async function persistPendingRunnerProject(requestInput: RunnerProjectRequestV1, signingKey: Buffer, createdAt: string, runtimeRoot?: string): Promise<SignedPendingRunnerProjectV1> {
  const request = RunnerProjectRequestV1Schema.parse(requestInput)
  const jobId = request.projection.job.job_id
  const platform = request.projection.platform_state.platform
  return withRunnerProjectStateLock(jobId, platform, runtimeRoot, async () => {
    const existing = await loadPendingRunnerProject(jobId, platform, signingKey, runtimeRoot)
    if (existing) {
      if (hashValue(existing.request) !== hashValue(request)) throw new Error('a different runner project request is still pending acknowledgement')
      return existing
    }
    if (!Number.isFinite(Date.parse(createdAt))) throw new Error('pending runner project timestamp is invalid')
    const body: PendingRunnerProjectBodyV1 = { schema_version: 1, request, created_at: createdAt }
    const journalHash = hashValue(body)
    const pending: SignedPendingRunnerProjectV1 = { ...body, journal_hash: journalHash, journal_signature: signRunnerReceiptHash(signingKey, journalHash) }
    await writeRunnerAuthorityJsonAtomic(pendingPath(jobId, platform, runtimeRoot), pending, runtimeRoot)
    return pending
  })
}

export async function replacePendingRunnerProject(pendingInput: SignedPendingRunnerProjectV1, requestInput: RunnerProjectRequestV1, signingKey: Buffer, createdAt: string, runtimeRoot?: string): Promise<SignedPendingRunnerProjectV1> {
  const pending = verifyPendingProject(pendingInput, signingKey)
  const request = RunnerProjectRequestV1Schema.parse(requestInput)
  const jobId = pending.request.projection.job.job_id
  const platform = pending.request.projection.platform_state.platform
  if (request.projection.job.job_id !== jobId || request.projection.platform_state.platform !== platform) throw new Error('replacement runner project request changed journal identity')
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('replacement runner project timestamp is invalid')
  return withRunnerProjectStateLock(jobId, platform, runtimeRoot, async () => {
    const stored = await loadPendingRunnerProject(jobId, platform, signingKey, runtimeRoot)
    if (!stored || stored.journal_hash !== pending.journal_hash) throw new Error('pending runner project changed before replacement')
    const body: PendingRunnerProjectBodyV1 = { schema_version: 1, request, created_at: createdAt }
    const journalHash = hashValue(body)
    const replacement: SignedPendingRunnerProjectV1 = { ...body, journal_hash: journalHash, journal_signature: signRunnerReceiptHash(signingKey, journalHash) }
    await writeRunnerAuthorityJsonAtomic(pendingPath(jobId, platform, runtimeRoot), replacement, runtimeRoot)
    return replacement
  })
}

export async function discardPendingRunnerProject(pending: SignedPendingRunnerProjectV1, signingKey: Buffer, runtimeRoot?: string): Promise<void> {
  const verified = verifyPendingProject(pending, signingKey)
  const jobId = verified.request.projection.job.job_id
  const platform = verified.request.projection.platform_state.platform
  await withRunnerProjectStateLock(jobId, platform, runtimeRoot, async () => {
    const path = pendingPath(jobId, platform, runtimeRoot)
    let stored: SignedPendingRunnerProjectV1
    try { stored = verifyPendingProject(JSON.parse(await readFile(path, 'utf8')), signingKey) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    if (stored.journal_hash !== verified.journal_hash) throw new Error('pending runner project changed before it could be discarded')
    await unlink(path)
  })
}

export async function quarantinePendingRunnerProject(pendingInput: SignedPendingRunnerProjectV1, signingKey: Buffer, safeCode: RunnerProjectConflictCodeV1, quarantinedAt: string, runtimeRoot?: string): Promise<void> {
  const pending = verifyPendingProject(pendingInput, signingKey)
  if (!conflictCode(safeCode) || !Number.isFinite(Date.parse(quarantinedAt))) throw new Error('runner project quarantine reason is invalid')
  const jobId = pending.request.projection.job.job_id
  const platform = pending.request.projection.platform_state.platform
  await withRunnerProjectStateLock(jobId, platform, runtimeRoot, async () => {
    const target = conflictPath(jobId, platform, pending.journal_hash, runtimeRoot)
    try {
      const existing = verifyConflict(JSON.parse(await readFile(target, 'utf8')), signingKey)
      if (existing.pending.journal_hash !== pending.journal_hash || existing.safe_code !== safeCode) throw new Error('runner project conflict journal differs from its content address')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await writeRunnerAuthorityJsonAtomic(target, signConflict({ schema_version: 1, safe_code: safeCode, quarantined_at: quarantinedAt, pending }, signingKey), runtimeRoot)
    }
    const source = pendingPath(jobId, platform, runtimeRoot)
    try {
      const stored = verifyPendingProject(JSON.parse(await readFile(source, 'utf8')), signingKey)
      if (stored.journal_hash !== pending.journal_hash) throw new Error('pending runner project changed before quarantine')
      await unlink(source)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  })
}

export async function resolveRunnerProjectConflict(input: {
  job_id: string
  platform: VideoPlatformV1
  runner_id: string
  journal_hash: string
  operator_confirmation_ref: string
  resolved_at: string
}, signingKey: Buffer, runtimeRoot?: string): Promise<SignedRunnerProjectConflictResolutionV1> {
  const platform = RunnerProjectPlatformStateV1Schema.shape.platform.parse(input.platform)
  if (!IdentifierV1Schema.safeParse(input.job_id).success || !sha256(input.journal_hash)) throw new Error('runner project conflict resolution identity is invalid')
  if (input.operator_confirmation_ref.length < 8 || input.operator_confirmation_ref.length > 240 || /[\u0000-\u001f\u007f]/.test(input.operator_confirmation_ref)) throw new Error('runner project conflict resolution requires an explicit operator confirmation reference')
  if (!Number.isFinite(Date.parse(input.resolved_at))) throw new Error('runner project conflict resolution timestamp is invalid')
  return withRunnerProjectStateLock(input.job_id, platform, runtimeRoot, async () => {
    const conflict = verifyConflict(JSON.parse(await readFile(conflictPath(input.job_id, platform, input.journal_hash, runtimeRoot), 'utf8')), signingKey)
    if (conflict.pending.journal_hash !== input.journal_hash
      || conflict.pending.request.runner_id !== input.runner_id
      || conflict.pending.request.projection.job.job_id !== input.job_id
      || conflict.pending.request.projection.platform_state.platform !== platform) throw new Error('runner project conflict does not match its requested resolution')
    const cursor = await loadAcknowledgedRunnerProjectCursor(input.job_id, platform, signingKey, runtimeRoot)
    if (!cursor) throw new Error('runner project conflict cannot be resolved without a successful acknowledged cursor')
    const conflictSource = conflict.pending.request.projection.job
    if (cursor.acknowledged_source_event_count < conflictSource.source_event_count
      || cursor.acknowledged_source_event_count === conflictSource.source_event_count
        && (cursor.acknowledged_source_event_chain_hash !== conflictSource.source_event_chain_hash
          || cursor.acknowledged_source_revision_hash !== conflictSource.source_revision_hash)) throw new Error('runner project conflict resolution cursor does not reconcile the conflicted source state')
    if (Date.parse(cursor.acknowledged_at) < Date.parse(conflict.quarantined_at)) throw new Error('runner project conflict resolution requires a successful cursor acknowledged after quarantine')
    const body: RunnerProjectConflictResolutionBodyV1 = {
      schema_version: 1,
      conflict_hash: conflict.conflict_hash,
      acknowledged_cursor: cursor,
      operator_confirmation_ref: input.operator_confirmation_ref,
      resolved_at: input.resolved_at,
    }
    const resolution = signConflictResolution(body, signingKey)
    const path = conflictResolutionPath(input.job_id, platform, conflict.conflict_hash, runtimeRoot)
    try {
      const existing = verifyConflictResolution(JSON.parse(await readFile(path, 'utf8')), signingKey)
      if (existing.resolution_hash !== resolution.resolution_hash) throw new Error('runner project conflict already has a different operator resolution')
      return existing
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await writeRunnerAuthorityJsonAtomic(path, resolution, runtimeRoot)
    return resolution
  })
}

export async function runnerProjectJournalStatus(signingKey: Buffer, runtimeRoot?: string): Promise<RunnerProjectJournalStatusV1> {
  const pending = await listPendingRunnerProjects(signingKey, runtimeRoot)
  const status: RunnerProjectJournalStatusV1 = {
    pending_projects: pending.length,
    conflicted_projects: 0,
    resolved_conflicts: 0,
    projection_conflicts: 0,
    idempotency_conflicts: 0,
    runner_identity_conflicts: 0,
    global_lineage_conflicts: 0,
    project_attention_code: null,
  }
  const jobs = await strictProjectStateJobs(runtimeRoot)
  for (const jobId of jobs) {
    const platforms = await strictProjectStatePlatforms(jobId, runtimeRoot)
    for (const platform of platforms) {
      const platformEntries = await strictPlatformEntries(jobId, platform, runtimeRoot)
      if (platformEntries.has('acknowledged.json')) await loadAcknowledgedRunnerProjectCursor(jobId, platform, signingKey, runtimeRoot)
      const conflictsRoot = projectStatePath(jobId, platform, runtimeRoot, 'conflicts')
      const resolutionsRoot = projectStatePath(jobId, platform, runtimeRoot, 'resolutions')
      const conflictNames = await strictContentAddressedJournalNames(conflictsRoot, 'conflicts')
      const resolutionNames = await strictContentAddressedJournalNames(resolutionsRoot, 'resolutions')
      const resolutions = new Map<string, SignedRunnerProjectConflictResolutionV1>()
      for (const name of resolutionNames) {
        const resolution = verifyConflictResolution(JSON.parse(await readFile(join(resolutionsRoot, name), 'utf8')), signingKey)
        if (`${resolution.conflict_hash}.json` !== name) throw new Error('runner project conflict resolution identity does not match its location')
        resolutions.set(resolution.conflict_hash, resolution)
      }
      const observedConflicts = new Set<string>()
      for (const name of conflictNames) {
        const conflict = verifyConflict(JSON.parse(await readFile(join(conflictsRoot, name), 'utf8')), signingKey)
        if (`${conflict.pending.journal_hash}.json` !== name) throw new Error('runner project conflict journal identity does not match its location')
        observedConflicts.add(conflict.conflict_hash)
        const resolution = resolutions.get(conflict.conflict_hash)
        if (resolution) {
          if (resolution.conflict_hash !== conflict.conflict_hash
            || resolution.acknowledged_cursor.job_id !== jobId
            || resolution.acknowledged_cursor.platform !== platform) throw new Error('runner project conflict resolution does not match its immutable conflict')
          const source = conflict.pending.request.projection.job
          const cursor = resolution.acknowledged_cursor
          if (cursor.acknowledged_source_event_count < source.source_event_count
            || cursor.acknowledged_source_event_count === source.source_event_count
              && (cursor.acknowledged_source_event_chain_hash !== source.source_event_chain_hash
                || cursor.acknowledged_source_revision_hash !== source.source_revision_hash)
            || Date.parse(cursor.acknowledged_at) < Date.parse(conflict.quarantined_at)) throw new Error('runner project conflict resolution is not bound to a successful reconciled cursor')
          status.resolved_conflicts += 1
          continue
        }
        status.conflicted_projects += 1
        if (conflict.safe_code === 'projection_conflict') status.projection_conflicts += 1
        if (conflict.safe_code === 'idempotency_conflict') status.idempotency_conflicts += 1
        if (conflict.safe_code === 'runner_identity_conflict') status.runner_identity_conflicts += 1
        if (conflict.safe_code === 'global_lineage_conflict') status.global_lineage_conflicts += 1
      }
      if ([...resolutions.keys()].some((conflictHash) => !observedConflicts.has(conflictHash))) throw new Error('runner project conflict resolution has no matching immutable conflict')
    }
  }
  status.project_attention_code = status.idempotency_conflicts > 0
    ? 'runner_project_idempotency_conflict'
    : status.runner_identity_conflicts > 0
      ? 'runner_project_identity_conflict'
      : status.global_lineage_conflicts > 0
        ? 'runner_project_global_lineage_conflict'
        : status.projection_conflicts > 0
          ? 'runner_project_projection_conflict'
          : null
  return status
}

export async function acknowledgeRunnerProject(pendingInput: SignedPendingRunnerProjectV1, signingKey: Buffer, acknowledgedAt: string, runtimeRoot?: string): Promise<SignedRunnerProjectCursorV1> {
  const pending = verifyPendingProject(pendingInput, signingKey)
  const request = pending.request
  const desired = request.projection.platform_state
  const jobId = request.projection.job.job_id
  return withRunnerProjectStateLock(jobId, desired.platform, runtimeRoot, async () => {
    const existing = await loadAcknowledgedRunnerProjectCursor(jobId, desired.platform, signingKey, runtimeRoot)
    let ancestry: UndoIdentityV1[] = []
    if (existing) {
      if (existing.acknowledgement.kind === 'projection'
        && existing.acknowledgement.idempotency_key === request.idempotency_key
        && existing.acknowledgement.projection_hash === request.projection_hash) {
        await discardPendingRunnerProject(pending, signingKey, runtimeRoot)
        return existing
      }
      const expected = request.projection.expected_platform_state
      if (expected === undefined) throw new Error('legacy runner project acknowledgement cannot replace an existing signed cursor')
      if (expected === null || hashValue(expected) !== hashValue(existing.acknowledged_platform_state)) throw new Error('runner project acknowledgement does not advance its exact acknowledged cursor')
      if (request.projection.job.source_event_count < existing.acknowledged_source_event_count
        || request.projection.job.source_event_count === existing.acknowledged_source_event_count
          && (request.projection.job.source_event_chain_hash !== existing.acknowledged_source_event_chain_hash
            || request.projection.job.source_revision_hash !== existing.acknowledged_source_revision_hash)) throw new Error('runner project acknowledgement would regress or fork its source event ledger')
      ancestry = existing.undo_ancestry
      if (desired.parent_revision_hash !== existing.acknowledged_platform_state.parent_revision_hash
        || desired.parent_artifact_hash !== existing.acknowledged_platform_state.parent_artifact_hash
        || desired.parent_candidate_hash !== existing.acknowledged_platform_state.parent_candidate_hash
        || desired.active_candidate_hash !== existing.acknowledged_platform_state.active_candidate_hash) throw new Error('runner project acknowledgement attempted to rewrite undo lineage')
    } else if (request.projection.expected_platform_state && desired.active_candidate_hash !== null) {
      throw new Error('runner project acknowledgement cannot create a cursor from unverified active lineage')
    }
    const cursor = await persistCursor({
      schema_version: 1,
      job_id: jobId,
      platform: desired.platform,
      acknowledged_source_event_count: request.projection.job.source_event_count,
      acknowledged_source_event_chain_hash: request.projection.job.source_event_chain_hash,
      acknowledged_source_revision_hash: request.projection.job.source_revision_hash,
      acknowledged_platform_state: desired,
      undo_ancestry: ancestry,
      acknowledgement: { kind: 'projection', idempotency_key: request.idempotency_key, projection_hash: request.projection_hash },
      acknowledged_at: acknowledgedAt,
    }, signingKey, runtimeRoot)
    await discardPendingRunnerProject(pending, signingKey, runtimeRoot)
    return cursor
  })
}

export function desiredRunnerProjectPlatformState(input: {
  platform: VideoPlatformV1
  active_revision_hash: string
  active_artifact_hash: string
  semantic_target_map_hash: string
  editorial_state: RunnerProjectPlatformStateV1['editorial_state']
  route_state: RunnerProjectPlatformStateV1['route_state']
}, cursor: SignedRunnerProjectCursorV1 | null): RunnerProjectPlatformStateV1 {
  if (cursor && cursor.platform !== input.platform) throw new Error('runner project cursor belongs to another platform')
  if (cursor && cursor.acknowledged_platform_state.active_artifact_hash !== input.active_artifact_hash
    && (cursor.acknowledged_platform_state.active_candidate_hash !== null || cursor.undo_ancestry.length > 0)) throw new Error('local platform artifact diverged from acknowledged magic-edit lineage')
  const preserveLineage = cursor?.acknowledged_platform_state.active_artifact_hash === input.active_artifact_hash
  return RunnerProjectPlatformStateV1Schema.parse({
    platform: input.platform,
    active_revision_hash: input.active_revision_hash,
    active_artifact_hash: input.active_artifact_hash,
    active_candidate_hash: preserveLineage ? cursor.acknowledged_platform_state.active_candidate_hash : null,
    parent_revision_hash: preserveLineage ? cursor.acknowledged_platform_state.parent_revision_hash : null,
    parent_artifact_hash: preserveLineage ? cursor.acknowledged_platform_state.parent_artifact_hash : null,
    parent_candidate_hash: preserveLineage ? cursor.acknowledged_platform_state.parent_candidate_hash : null,
    semantic_target_map_hash: input.semantic_target_map_hash,
    editorial_state: input.editorial_state,
    route_state: input.route_state,
  })
}

export async function assertRunnerCommandHasAcknowledgedCursor(commandInput: RunnerCommandEnvelopeV1, signingKey: Buffer, runtimeRoot?: string): Promise<SignedRunnerProjectCursorV1> {
  const command = RunnerCommandEnvelopeV1Schema.parse(commandInput)
  const cursor = await loadAcknowledgedRunnerProjectCursor(command.job_id, command.platform, signingKey, runtimeRoot)
  if (!cursor) throw new Error('runner command has no signed acknowledged platform cursor')
  const state = cursor.acknowledged_platform_state
  if (state.active_revision_hash !== command.expected_parent_revision_hash
    || state.active_artifact_hash !== command.expected_parent_artifact_hash) throw new Error('runner command does not match the signed acknowledged platform cursor')
  if (command.command_kind === 'magic_edit_activate' && cursor.undo_ancestry.length >= 100) throw new Error('runner magic-edit undo ancestry is at its supported limit')
  await assertRunnerPlatformCanProject(command.job_id, command.platform, signingKey, runtimeRoot)
  if (command.command_kind === 'magic_edit_return_to_parent' && state.active_candidate_hash !== command.candidate_hash) throw new Error('runner return command does not match the acknowledged active candidate')
  if (command.semantic_target_map_hash !== null
    && command.semantic_target_map_hash !== state.semantic_target_map_hash) throw new Error('runner command does not match the acknowledged semantic target map')
  return cursor
}

function requiredResultMap(receipt: RunnerReceiptV1): string {
  const value = receipt.result_refs?.semantic_target_map_hash
  if (!value) throw new Error('acknowledged runner command result has no semantic target map')
  return value
}

function nextStateForAcknowledgedCommand(cursor: SignedRunnerProjectCursorV1, command: RunnerCommandEnvelopeV1, receipt: RunnerReceiptV1): { state: RunnerProjectPlatformStateV1; ancestry: UndoIdentityV1[] } {
  const current = cursor.acknowledged_platform_state
  if (receipt.status === 'failed') return { state: current, ancestry: cursor.undo_ancestry }
  if (command.command_kind === 'magic_edit_prepare') {
    return {
      state: RunnerProjectPlatformStateV1Schema.parse({
        ...current,
        editorial_state: 'needs_visual_review',
        route_state: receipt.status === 'requires_editorial_route' ? 'requires_editorial_route' : 'standard',
      }),
      ancestry: cursor.undo_ancestry,
    }
  }
  if (command.command_kind === 'magic_edit_activate' && receipt.status === 'succeeded') {
    const ancestry = [activeIdentity(current), ...cursor.undo_ancestry]
    return {
      state: RunnerProjectPlatformStateV1Schema.parse({
        ...current,
        active_revision_hash: receipt.result_revision_hash,
        active_artifact_hash: receipt.result_artifact_hash,
        active_candidate_hash: command.candidate_hash,
        parent_revision_hash: current.active_revision_hash,
        parent_artifact_hash: current.active_artifact_hash,
        parent_candidate_hash: current.active_candidate_hash,
        semantic_target_map_hash: requiredResultMap(receipt),
        editorial_state: 'needs_final_review',
        route_state: 'standard',
      }),
      ancestry,
    }
  }
  if (command.command_kind === 'magic_edit_return_to_parent' && receipt.status === 'succeeded') {
    const target = cursor.undo_ancestry[0]
    if (!target
      || target.revision_hash !== command.payload.target_parent_revision_hash
      || target.artifact_hash !== command.payload.target_parent_artifact_hash) throw new Error('acknowledged return does not match the cursor immediate parent')
    const ancestry = cursor.undo_ancestry.slice(1)
    const nextParent = ancestry[0]
    return {
      state: RunnerProjectPlatformStateV1Schema.parse({
        ...current,
        active_revision_hash: receipt.result_revision_hash,
        active_artifact_hash: receipt.result_artifact_hash,
        active_candidate_hash: target.candidate_hash,
        parent_revision_hash: nextParent?.revision_hash ?? null,
        parent_artifact_hash: nextParent?.artifact_hash ?? null,
        parent_candidate_hash: nextParent?.candidate_hash ?? null,
        semantic_target_map_hash: requiredResultMap(receipt),
        editorial_state: 'approved',
        route_state: 'standard',
      }),
      ancestry,
    }
  }
  if (command.command_kind === 'review_decision_record' && receipt.status === 'succeeded') {
    const decision = command.payload
    const editorialState = decision.decision === 'keep_current'
      ? current.editorial_state
      : decision.gate === 'story'
        ? 'needs_visual_review'
        : decision.gate === 'treatment'
          ? 'needs_final_review'
          : 'approved'
    return {
      state: RunnerProjectPlatformStateV1Schema.parse({
        ...current,
        active_revision_hash: receipt.result_revision_hash,
        active_artifact_hash: receipt.result_artifact_hash,
        semantic_target_map_hash: requiredResultMap(receipt),
        editorial_state: editorialState,
        route_state: decision.decision === 'use_candidate' ? 'standard' : current.route_state,
      }),
      ancestry: cursor.undo_ancestry,
    }
  }
  if (command.command_kind === 'review_decision_record' && receipt.status === 'requires_editorial_route') {
    return { state: RunnerProjectPlatformStateV1Schema.parse({ ...current, route_state: 'requires_editorial_route' }), ancestry: cursor.undo_ancestry }
  }
  if (command.command_kind === 'review_recovery_record') return { state: current, ancestry: cursor.undo_ancestry }
  return {
    state: RunnerProjectPlatformStateV1Schema.parse({ ...current, editorial_state: 'blocked', route_state: 'requires_editorial_route' }),
    ancestry: cursor.undo_ancestry,
  }
}

function sourceEventStateForAcknowledgedCommand(cursor: SignedRunnerProjectCursorV1, command: RunnerCommandEnvelopeV1, receipt: RunnerReceiptV1): { count: number; chain_hash: string; revision_hash: string } {
  if (receipt.status === 'failed') return { count: cursor.acknowledged_source_event_count, chain_hash: cursor.acknowledged_source_event_chain_hash, revision_hash: cursor.acknowledged_source_revision_hash }
  const resultCount = receipt.result_refs?.result_source_event_count
  const resultChainHash = receipt.result_refs?.result_source_event_chain_hash
  const resultRevisionHash = receipt.result_refs?.result_source_revision_hash
  if (!resultCount || !resultChainHash || !resultRevisionHash) throw new Error('acknowledged runner command has no post-dispatch source event state')
  if (command.command_kind === 'magic_edit_prepare') {
    if (resultCount < cursor.acknowledged_source_event_count
      || resultCount === cursor.acknowledged_source_event_count
        && (resultChainHash !== cursor.acknowledged_source_event_chain_hash || resultRevisionHash !== cursor.acknowledged_source_revision_hash)) throw new Error('magic-edit preparation regressed or forked the source event ledger')
    if (resultRevisionHash !== cursor.acknowledged_source_revision_hash) throw new Error('magic-edit preparation unexpectedly changed the source revision')
    return { count: resultCount, chain_hash: resultChainHash, revision_hash: resultRevisionHash }
  }
  if (resultCount <= cursor.acknowledged_source_event_count) throw new Error('acknowledged runner command did not advance the source event ledger')
  if (resultRevisionHash !== receipt.result_revision_hash) throw new Error('acknowledged runner command source revision does not match its result revision')
  return { count: resultCount, chain_hash: resultChainHash, revision_hash: resultRevisionHash }
}

export async function acknowledgeRunnerCommandPlatformState(commandInput: RunnerCommandEnvelopeV1, receiptInput: RunnerReceiptV1, signingKey: Buffer, runtimeRoot?: string): Promise<SignedRunnerProjectCursorV1> {
  const command = RunnerCommandEnvelopeV1Schema.parse(commandInput)
  const receipt = RunnerReceiptV1Schema.parse(receiptInput)
  if (receipt.command_id !== command.command_id || receipt.command_hash !== command.command_hash || receipt.job_id !== command.job_id) throw new Error('runner command acknowledgement identity does not match its receipt')
  return withRunnerProjectStateLock(command.job_id, command.platform, runtimeRoot, async () => {
    const cursor = await loadAcknowledgedRunnerProjectCursor(command.job_id, command.platform, signingKey, runtimeRoot)
    if (!cursor) throw new Error('runner command acknowledgement has no signed platform cursor')
    if (cursor.acknowledgement.kind === 'command_completion' && cursor.acknowledgement.receipt_hash === receipt.receipt_hash) return cursor
    await assertRunnerCommandHasAcknowledgedCursor(command, signingKey, runtimeRoot)
    const next = nextStateForAcknowledgedCommand(cursor, command, receipt)
    const sourceEventState = sourceEventStateForAcknowledgedCommand(cursor, command, receipt)
    return persistCursor({
      schema_version: 1,
      job_id: command.job_id,
      platform: command.platform,
      acknowledged_source_event_count: sourceEventState.count,
      acknowledged_source_event_chain_hash: sourceEventState.chain_hash,
      acknowledged_source_revision_hash: sourceEventState.revision_hash,
      acknowledged_platform_state: next.state,
      undo_ancestry: next.ancestry,
      acknowledgement: { kind: 'command_completion', command_id: command.command_id, command_hash: command.command_hash, receipt_hash: receipt.receipt_hash },
      acknowledged_at: receipt.finished_at,
    }, signingKey, runtimeRoot)
  })
}
