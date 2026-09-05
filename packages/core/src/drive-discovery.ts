import { randomUUID } from 'node:crypto'
import { access, mkdir, open, opendir, readFile, realpath, rename, stat, truncate, unlink } from 'node:fs/promises'
import { basename, dirname, extname, join, parse, relative, resolve, sep } from 'node:path'
import {
  DRIVE_DISCOVERY_SCHEMA_VERSION_V1,
  DriveDiscoveryEventV1Schema,
  DriveDiscoveryFileV1Schema,
  DriveDiscoveryScanSnapshotV1Schema,
  DriveDiscoveryStateV1Schema,
  DriveIntakeCandidateV1Schema,
  DriveIntakeProofV1Schema,
  DriveIntakeReviewV1Schema,
  DriveInboxRebindV1Schema,
  SourceBundleV1Schema,
  driveDiscoveryEventHashInputV1,
  driveDiscoveryStateHashInputV1,
  driveIntakeCandidateHashInputV1,
  type DriveDiscoveryEventV1,
  type DriveDiscoveryFileV1,
  type DriveDiscoveryHealthStatusV1,
  type DriveDiscoveryKnownContentV1,
  type DriveDiscoveryScanSnapshotV1,
  type DriveDiscoveryStateV1,
  type DriveIntakeCandidateV1,
  type DriveIntakeProofV1,
  type DriveIntakeReviewV1,
  type DriveInboxRebindV1,
  type SourceBundleV1,
} from '@mindmake/contracts'
import { hashFile, hashValue } from './hash.js'
import { studioPaths } from './paths.js'
import { run } from './process.js'

const DISCOVERY_EVENT_GENESIS = hashValue({ domain: 'MindmakeVideoStudio/DriveDiscoveryEventChain/v1', schema_version: 1 })
const DEFAULT_STABILITY_SECONDS = 30
const DEFAULT_MAX_FILES = 500
const DEFAULT_MAX_ENTRIES = 2_000
const DEFAULT_MAX_DEPTH = 4
const DEFAULT_MAX_HASH_BYTES_PER_SCAN = 68_719_476_736
const DEFAULT_MAX_SIDECAR_BYTES = 16_777_216
const DEFAULT_HISTORY_RETENTION_DAYS = 365
const DEFAULT_CONTENT_REVERIFICATION_SECONDS = 86_400
const DISCOVERY_ALGORITHM_VERSION = 'drive-discovery-v1.2.0' as const
const MAX_DJI_SPLIT_PARTS = 16
const VIDEO_EXTENSIONS = new Set(['.avi', '.m2ts', '.m4v', '.mkv', '.mov', '.mp4', '.mts', '.mxf', '.webm'])
const AUDIO_EXTENSIONS = new Set(['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.opus', '.wav'])
const CAPTION_SIDECAR_EXTENSIONS = new Set(['.srt', '.vtt'])
const EDIT_SIDECAR_EXTENSIONS = new Set(['.edl', '.fcpxml'])

type FileKind = DriveDiscoveryFileV1['kind']

interface DiscoveryRuntimePaths {
  root: string
  events: string
  state: string
  lock: string
  candidates: string
}

export interface DriveDiscoveryScanOptions {
  inboxPath?: string | null
  driveRoot?: string | null
  archiveRoot?: string | null
  runtimeRoot?: string
  now?: () => Date
  stabilitySeconds?: number
  maxFiles?: number
  maxEntries?: number
  maxDepth?: number
  maxHashBytesPerScan?: number
  maxSidecarBytes?: number
  historyRetentionDays?: number
  contentReverificationSeconds?: number
  softwareCommit?: string
  recordUnchanged?: boolean
  forceContentHash?: boolean
}

export interface DriveDiscoveryReviewInput {
  candidate_id: string
  candidate_hash: string
  decision: DriveIntakeReviewV1['decision']
  note: string
  confirmation_ref: string
}

export interface SanitizedDriveDiscoverySummary {
  schema_version: 1
  scan_sequence: number | null
  scanned_at: string | null
  status: DriveDiscoveryScanSnapshotV1['health']['status'] | 'not_scanned'
  drive_state: DriveDiscoveryScanSnapshotV1['health']['drive_state']
  safe_codes: string[]
  counts: {
    files_seen: number
    partial_files: number
    stable_files: number
    unsupported_files: number
    duplicate_files: number
    ready_candidates: number
    attention_candidates: number
    reviewed_candidates: number
  }
}

interface WalkResult {
  files: string[]
  safeCodes: string[]
  limited: boolean
}

interface ScanSettings {
  stabilitySeconds: number
  maxFiles: number
  maxEntries: number
  maxDepth: number
  maxHashBytesPerScan: number
  maxSidecarBytes: number
  historyRetentionDays: number
  contentReverificationSeconds: number
  softwareCommit: string
  configurationHash: string
}

interface SplitIdentity {
  groupKey: string
  groupDisplayName: string
  groupStem: string
  part: number
}

type WithoutEventHash<T> = T extends unknown ? Omit<T, 'event_hash'> : never
type DriveDiscoveryEventInput = WithoutEventHash<DriveDiscoveryEventV1>

function discoveryPaths(runtimeRoot = studioPaths().runtimeRoot): DiscoveryRuntimePaths {
  const root = join(runtimeRoot, 'discovery')
  return {
    root,
    events: join(root, 'events.jsonl'),
    state: join(root, 'state.json'),
    lock: join(root, 'discovery.lock'),
    candidates: join(root, 'candidates'),
  }
}

function configuredInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const text = process.env[name]?.trim()
  if (!text) return fallback
  const value = Number(text)
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`)
  return value
}

function scanSettings(options: DriveDiscoveryScanOptions): ScanSettings {
  const stabilitySeconds = options.stabilitySeconds ?? configuredInteger('MINDMAKE_DISCOVERY_STABILITY_SECONDS', DEFAULT_STABILITY_SECONDS, 0, 86_400)
  const maxFiles = options.maxFiles ?? configuredInteger('MINDMAKE_DISCOVERY_MAX_FILES', DEFAULT_MAX_FILES, 1, 5_000)
  const maxEntries = options.maxEntries ?? configuredInteger('MINDMAKE_DISCOVERY_MAX_ENTRIES', DEFAULT_MAX_ENTRIES, 1, 20_000)
  const maxDepth = options.maxDepth ?? configuredInteger('MINDMAKE_DISCOVERY_MAX_DEPTH', DEFAULT_MAX_DEPTH, 0, 12)
  const maxHashBytesPerScan = options.maxHashBytesPerScan ?? configuredInteger('MINDMAKE_DISCOVERY_MAX_HASH_BYTES_PER_SCAN', DEFAULT_MAX_HASH_BYTES_PER_SCAN, 1, Number.MAX_SAFE_INTEGER)
  const maxSidecarBytes = options.maxSidecarBytes ?? configuredInteger('MINDMAKE_DISCOVERY_MAX_SIDECAR_BYTES', DEFAULT_MAX_SIDECAR_BYTES, 1, 1_073_741_824)
  const historyRetentionDays = options.historyRetentionDays ?? configuredInteger('MINDMAKE_DISCOVERY_HISTORY_RETENTION_DAYS', DEFAULT_HISTORY_RETENTION_DAYS, 1, 3_650)
  const contentReverificationSeconds = options.contentReverificationSeconds ?? configuredInteger('MINDMAKE_DISCOVERY_REVERIFY_SECONDS', DEFAULT_CONTENT_REVERIFICATION_SECONDS, 60, 604_800)
  const softwareCommit = options.softwareCommit?.trim().toLowerCase() || process.env.MINDMAKE_SOFTWARE_COMMIT?.trim().toLowerCase() || 'unknown'
  if (!Number.isSafeInteger(stabilitySeconds) || stabilitySeconds < 0 || stabilitySeconds > 86_400) throw new Error('discovery stability seconds are outside the safe range')
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > 5_000) throw new Error('discovery maximum files are outside the safe range')
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 20_000) throw new Error('discovery maximum entries are outside the safe range')
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || maxDepth > 12) throw new Error('discovery maximum depth is outside the safe range')
  if (!Number.isSafeInteger(maxHashBytesPerScan) || maxHashBytesPerScan < 1) throw new Error('discovery hash-byte budget is outside the safe range')
  if (!Number.isSafeInteger(maxSidecarBytes) || maxSidecarBytes < 1 || maxSidecarBytes > 1_073_741_824) throw new Error('discovery sidecar byte limit is outside the safe range')
  if (!Number.isSafeInteger(historyRetentionDays) || historyRetentionDays < 1 || historyRetentionDays > 3_650) throw new Error('discovery history retention is outside the safe range')
  if (!Number.isSafeInteger(contentReverificationSeconds) || contentReverificationSeconds < 60 || contentReverificationSeconds > 604_800) throw new Error('discovery content reverification interval is outside the safe range')
  if (!/^(?:[a-f0-9]{40}|unknown)$/.test(softwareCommit)) throw new Error('discovery software commit must be an exact Git commit or unknown')
  const configurationHash = discoveryConfigurationHash({
    stability_seconds: stabilitySeconds,
    maximum_files: maxFiles,
    maximum_entries: maxEntries,
    maximum_depth: maxDepth,
    maximum_hash_bytes_per_scan: maxHashBytesPerScan,
    maximum_sidecar_bytes: maxSidecarBytes,
    history_retention_days: historyRetentionDays,
    content_reverification_seconds: contentReverificationSeconds,
  })
  return { stabilitySeconds, maxFiles, maxEntries, maxDepth, maxHashBytesPerScan, maxSidecarBytes, historyRetentionDays, contentReverificationSeconds, softwareCommit, configurationHash }
}

function discoveryConfigurationHash(settings: {
  stability_seconds: number
  maximum_files: number
  maximum_entries: number
  maximum_depth: number
  maximum_hash_bytes_per_scan: number
  maximum_sidecar_bytes: number
  history_retention_days: number
  content_reverification_seconds: number
}): string {
  return hashValue({
    algorithm_version: DISCOVERY_ALGORITHM_VERSION,
    stability_seconds: settings.stability_seconds,
    maximum_files: settings.maximum_files,
    maximum_entries: settings.maximum_entries,
    maximum_depth: settings.maximum_depth,
    maximum_hash_bytes_per_scan: settings.maximum_hash_bytes_per_scan,
    maximum_sidecar_bytes: settings.maximum_sidecar_bytes,
    history_retention_days: settings.history_retention_days,
    content_reverification_seconds: settings.content_reverification_seconds,
    maximum_dji_split_parts: MAX_DJI_SPLIT_PARTS,
    video_extensions: [...VIDEO_EXTENSIONS].sort(),
    audio_extensions: [...AUDIO_EXTENSIONS].sort(),
    caption_sidecar_extensions: [...CAPTION_SIDECAR_EXTENSIONS].sort(),
    edit_sidecar_extensions: [...EDIT_SIDECAR_EXTENSIONS].sort(),
  })
}

function emptyState(): DriveDiscoveryStateV1 {
  const body = {
    schema_version: DRIVE_DISCOVERY_SCHEMA_VERSION_V1,
    latest_event_hash: DISCOVERY_EVENT_GENESIS,
    scan: null,
    reviews: {},
  } as const
  return DriveDiscoveryStateV1Schema.parse({ ...body, state_hash: hashValue(driveDiscoveryStateHashInputV1({ ...body })) })
}

function eventWithoutHash(event: DriveDiscoveryEventV1): Omit<DriveDiscoveryEventV1, 'event_hash'> {
  const { event_hash: _eventHash, ...body } = event
  return body
}

function stateWithoutHash(state: DriveDiscoveryStateV1): Omit<DriveDiscoveryStateV1, 'state_hash'> {
  const { state_hash: _stateHash, ...body } = state
  return body
}

function reviewVerificationHash(candidate: DriveIntakeCandidateV1): string {
  return hashValue({
    domain: 'MindmakeVideoStudio/DriveIntakeVerification/v1',
    candidate_hash: candidate.candidate_hash,
    inbox_fingerprint: candidate.inbox_fingerprint,
    components: candidate.components.map((component) => ({
      file_id: component.file_id,
      kind: component.kind,
      role: component.role,
      ordinal: component.ordinal,
      content_hash: component.content_hash,
    })),
  })
}

function assertSnapshotIntegrity(snapshot: DriveDiscoveryScanSnapshotV1, reviews: Record<string, DriveIntakeReviewV1>): void {
  const expectedConfigurationHash = discoveryConfigurationHash(snapshot.settings)
  if (snapshot.settings.configuration_hash !== expectedConfigurationHash) throw new Error('Drive discovery scan settings hash no longer matches its content')
  if (Object.keys(snapshot.known_content).length > 5_000) throw new Error('Drive discovery known-content history exceeds its bounded capacity')
  const byFileId = new Map(snapshot.files.map((file) => [file.file_id, file]))
  for (const candidate of snapshot.candidates) {
    const { candidate_hash: _candidateHash, ...body } = candidate
    if (candidate.candidate_hash !== hashValue(driveIntakeCandidateHashInputV1(body))) throw new Error(`Drive intake candidate ${candidate.candidate_id} hash no longer matches its content`)
    if (candidate.availability === 'available') {
      for (const component of candidate.components) {
        const file = byFileId.get(component.file_id)
        if (!file || file.relative_path !== component.relative_path || file.kind !== component.kind || file.content_hash !== component.content_hash) {
          throw new Error(`Drive intake candidate ${candidate.candidate_id} component no longer matches its scan file`)
        }
      }
    }
  }
  for (const [contentHash, known] of Object.entries(snapshot.known_content)) {
    if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error('Drive discovery known-content key is invalid')
    if (Date.parse(known.last_seen_at) < Date.parse(known.first_seen_at)) throw new Error('Drive discovery known-content timestamps are inverted')
  }
  const expected = healthForScan({ status: snapshot.health.status, safeCodes: snapshot.health.safe_codes, files: snapshot.files, candidates: snapshot.candidates, reviews })
  const countKeys = ['files_seen', 'partial_files', 'stable_files', 'unsupported_files', 'duplicate_files', 'ready_candidates', 'attention_candidates', 'reviewed_candidates'] as const
  for (const key of countKeys) {
    if (snapshot.health[key] !== expected[key]) throw new Error(`Drive discovery health count ${key} does not match the scan`)
  }
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  const handle = await open(temporary, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, path)
}

async function appendEvent(path: string, event: DriveDiscoveryEventV1): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const handle = await open(path, 'a', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function reduceEvents(events: DriveDiscoveryEventV1[]): DriveDiscoveryStateV1 {
  let state = emptyState()
  let latestScanEventHash: string | null = null
  let trustedInboxFingerprint: string | null = null
  for (const event of events) {
    if (event.previous_event_hash !== state.latest_event_hash) throw new Error('Drive discovery event chain is discontinuous')
    const expectedHash = hashValue(driveDiscoveryEventHashInputV1(eventWithoutHash(event)))
    if (event.event_hash !== expectedHash) throw new Error('Drive discovery event hash no longer matches its content')
    const reviews = { ...state.reviews }
    let scan = state.scan
    if (event.type === 'scan_completed') {
      assertSnapshotIntegrity(event.scan, reviews)
      if (event.scan.health.status === 'ready') {
        if (trustedInboxFingerprint && trustedInboxFingerprint !== event.scan.inbox_fingerprint) throw new Error('healthy Drive discovery scan changed Inbox identity without an approved rebind')
        trustedInboxFingerprint ??= event.scan.inbox_fingerprint
      }
      scan = event.scan
      latestScanEventHash = event.event_hash
    } else if (event.type === 'review_recorded') {
      if (!scan || latestScanEventHash === null) throw new Error('Drive intake review has no discovery scan lineage')
      const candidate = scan.candidates.find((item) => item.candidate_id === event.review.candidate_id)
      if (!candidate || candidate.candidate_hash !== event.review.candidate_hash) throw new Error('Drive intake review does not match the current discovery candidate')
      if (event.review.inbox_fingerprint !== scan.inbox_fingerprint || event.review.scan_sequence !== scan.scan_sequence || event.review.discovery_event_hash !== latestScanEventHash) {
        throw new Error('Drive intake review does not match its discovery scan lineage')
      }
      if (event.review.verification_hash !== reviewVerificationHash(candidate)) throw new Error('Drive intake review verification hash no longer matches its candidate')
      if (event.review.decision === 'accepted' && (scan.health.status !== 'ready' || candidate.availability !== 'available' || candidate.classification !== 'ready_for_review')) {
        throw new Error('accepted Drive intake review does not reference a healthy ready candidate')
      }
      reviews[event.review.candidate_id] = event.review
    } else {
      if (!trustedInboxFingerprint || event.rebind.previous_inbox_fingerprint !== trustedInboxFingerprint) throw new Error('Drive Inbox rebind does not match the current trusted identity')
      trustedInboxFingerprint = event.rebind.next_inbox_fingerprint
    }
    const body = { schema_version: 1 as const, latest_event_hash: event.event_hash, scan, reviews }
    state = DriveDiscoveryStateV1Schema.parse({ ...body, state_hash: hashValue(driveDiscoveryStateHashInputV1(body)) })
  }
  return state
}

function trustedInboxFingerprintFromEvents(events: DriveDiscoveryEventV1[]): string | null {
  let trusted: string | null = null
  for (const event of events) {
    if (event.type === 'scan_completed' && event.scan.health.status === 'ready') {
      if (trusted && trusted !== event.scan.inbox_fingerprint) throw new Error('healthy Drive discovery scan changed Inbox identity without an approved rebind')
      trusted ??= event.scan.inbox_fingerprint
    } else if (event.type === 'inbox_rebound') {
      if (!trusted || event.rebind.previous_inbox_fingerprint !== trusted) throw new Error('Drive Inbox rebind does not match the current trusted identity')
      trusted = event.rebind.next_inbox_fingerprint
    }
  }
  return trusted
}

async function readEvents(runtimeRoot?: string, recoverPartialTail = false): Promise<DriveDiscoveryEventV1[]> {
  const paths = discoveryPaths(runtimeRoot)
  let raw: Buffer
  try { raw = await readFile(paths.events) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const body = raw.toString('utf8')
  const events: DriveDiscoveryEventV1[] = []
  const eventIds = new Set<string>()
  const lines = body.split(/\r?\n/)
  let truncatedIncompleteTail = false
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue
    let event: DriveDiscoveryEventV1
    try { event = DriveDiscoveryEventV1Schema.parse(JSON.parse(line)) }
    catch {
      const isIncompleteTail = index === lines.length - 1 && !body.endsWith('\n')
      if (recoverPartialTail && isIncompleteTail) {
        const lastNewline = raw.lastIndexOf(0x0a)
        await truncate(paths.events, lastNewline < 0 ? 0 : lastNewline + 1)
        truncatedIncompleteTail = true
        break
      }
      throw new Error(`Drive discovery event ledger contains invalid JSON or schema at line ${index + 1}`)
    }
    if (eventIds.has(event.event_id)) throw new Error(`Drive discovery event ledger repeats event ${event.event_id}`)
    eventIds.add(event.event_id)
    events.push(event)
  }
  if (recoverPartialTail && raw.length > 0 && !body.endsWith('\n') && !truncatedIncompleteTail) {
    const handle = await open(paths.events, 'a', 0o600)
    try {
      await handle.writeFile('\n', 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
  }
  return events
}

export async function loadDriveDiscoveryState(runtimeRoot?: string): Promise<DriveDiscoveryStateV1> {
  const state = reduceEvents(await readEvents(runtimeRoot))
  const paths = discoveryPaths(runtimeRoot)
  try {
    const materialized = DriveDiscoveryStateV1Schema.parse(JSON.parse(await readFile(paths.state, 'utf8')))
    if (materialized.state_hash !== hashValue(driveDiscoveryStateHashInputV1(stateWithoutHash(materialized)))) return state
    if (materialized.state_hash !== state.state_hash) return state
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return state
  }
  return state
}

async function persistEvent(eventInput: DriveDiscoveryEventInput, runtimeRoot?: string): Promise<DriveDiscoveryStateV1> {
  const paths = discoveryPaths(runtimeRoot)
  const events = await readEvents(runtimeRoot, true)
  const state = reduceEvents(events)
  if (eventInput.previous_event_hash !== state.latest_event_hash) throw new Error('Drive discovery event was prepared against a stale ledger tail')
  const event = DriveDiscoveryEventV1Schema.parse({
    ...eventInput,
    event_hash: hashValue(driveDiscoveryEventHashInputV1(eventInput)),
  })
  const next = reduceEvents([...events, event])
  await appendEvent(paths.events, event)
  await atomicJson(paths.state, next)
  return next
}

function processAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM' }
}

let ownProcessInstancePromise: Promise<string> | undefined
const activeDiscoveryLockTokens = new Set<string>()

async function processInstanceIdentity(pid: number): Promise<string | null> {
  if (!processAlive(pid)) return null
  try {
    if (process.platform === 'win32') {
      const command = `$process = Get-Process -Id ${pid} -ErrorAction Stop; [Console]::Out.Write($process.StartTime.ToUniversalTime().Ticks.ToString())`
      const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeoutMs: 5_000 })
      const ticks = result.stdout.trim()
      if (!/^\d{17,19}$/.test(ticks)) throw new Error('process start identity is invalid')
      return `win32-ticks:${ticks}`
    }
    const info = await stat(`/proc/${pid}`)
    return `proc:${Math.trunc(info.ctimeMs)}`
  } catch {
    return processAlive(pid) ? 'unknown' : null
  }
}

function ownProcessInstance(): Promise<string> {
  ownProcessInstancePromise ??= processInstanceIdentity(process.pid).then((identity) => identity ?? 'unknown')
  return ownProcessInstancePromise
}

function processInstancesMatch(recorded: string, observed: string): boolean {
  return recorded === observed
}

async function withDiscoveryLock<T>(runtimeRoot: string | undefined, callback: () => Promise<T>): Promise<T> {
  const paths = discoveryPaths(runtimeRoot)
  await mkdir(paths.root, { recursive: true })
  const token = randomUUID()
  const instanceId = await ownProcessInstance()
  const deadline = Date.now() + 10_000
  let handle: Awaited<ReturnType<typeof open>> | undefined
  while (!handle) {
    let candidate: Awaited<ReturnType<typeof open>> | undefined
    try {
      candidate = await open(paths.lock, 'wx', 0o600)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      let stale = false
      let observedLock = ''
      try {
        observedLock = await readFile(paths.lock, 'utf8')
        const lock = JSON.parse(observedLock) as { pid?: unknown; process_instance_id?: unknown; token?: unknown }
        if (typeof lock.pid !== 'number' || typeof lock.process_instance_id !== 'string') {
          stale = Date.now() - (await stat(paths.lock)).mtimeMs >= 2_000
        } else {
          const observed = await processInstanceIdentity(lock.pid)
          stale = observed === null || (observed !== 'unknown' && lock.process_instance_id !== 'unknown' && !processInstancesMatch(lock.process_instance_id, observed))
          if (lock.pid === process.pid && processInstancesMatch(lock.process_instance_id, instanceId) && typeof lock.token === 'string' && !activeDiscoveryLockTokens.has(lock.token)) stale = true
        }
      } catch {
        try { stale = Date.now() - (await stat(paths.lock)).mtimeMs >= 2_000 } catch { stale = false }
      }
      if (stale) {
        try {
          const currentLock = await readFile(paths.lock, 'utf8')
          if (currentLock === observedLock) await unlink(paths.lock)
        } catch (unlinkError) { if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') throw unlinkError }
        continue
      }
      if (Date.now() >= deadline) throw new Error('Drive discovery scan is already active')
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
      continue
    }
    let createdIdentity: { dev: bigint; ino: bigint } | undefined
    try {
      const created = await candidate.stat({ bigint: true })
      createdIdentity = { dev: created.dev, ino: created.ino }
      await candidate.writeFile(`${JSON.stringify({ schema_version: 1, pid: process.pid, process_instance_id: instanceId, token, acquired_at: new Date().toISOString() })}\n`, 'utf8')
      await candidate.sync()
      handle = candidate
      activeDiscoveryLockTokens.add(token)
    } catch (error) {
      try { await candidate.close() } catch { /* The persistence failure is authoritative. */ }
      try {
        const current = await stat(paths.lock, { bigint: true })
        if (createdIdentity && current.dev === createdIdentity.dev && current.ino === createdIdentity.ino) await unlink(paths.lock)
      } catch (cleanupError) {
        if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') throw new AggregateError([error, cleanupError], 'Drive discovery lock persistence and cleanup failed')
      }
      throw error
    }
  }
  try { return await callback() }
  finally {
    activeDiscoveryLockTokens.delete(token)
    await handle.close()
    let releaseError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const current = JSON.parse(await readFile(paths.lock, 'utf8')) as { token?: unknown }
        if (current.token !== token) { releaseError = undefined; break }
        await unlink(paths.lock)
        releaseError = undefined
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') { releaseError = undefined; break }
        releaseError = error
        if (attempt < 2) await new Promise((resolveDelay) => setTimeout(resolveDelay, 25 * (attempt + 1)))
      }
    }
    if (releaseError) throw releaseError
  }
}

function fileKind(extension: string): FileKind {
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio'
  if (CAPTION_SIDECAR_EXTENSIONS.has(extension)) return 'caption_sidecar'
  if (EDIT_SIDECAR_EXTENSIONS.has(extension)) return 'edit_sidecar'
  return 'unsupported'
}

function portableRelativePath(root: string, path: string): string {
  const value = relative(root, path).replaceAll('\\', '/')
  if (!value || value.startsWith('../') || value === '..' || value.startsWith('/') || /^[a-z]:/i.test(value)) throw new Error('discovered file escaped the configured inbox')
  return value
}

function pathKey(relativePath: string): string {
  return hashValue({ domain: 'MindmakeVideoStudio/InboxPath/v1', relative_path: relativePath.toLocaleLowerCase('en-GB') })
}

function inboxFingerprint(inboxPath: string | null): string {
  return hashValue({ domain: 'MindmakeVideoStudio/Inbox/v1', configured: Boolean(inboxPath), path: inboxPath ? resolve(inboxPath).toLocaleLowerCase('en-GB') : null })
}

async function resolvedInboxFingerprint(inboxPath: string): Promise<string> {
  const actualPath = await realpath(inboxPath)
  const info = await stat(actualPath)
  if (!info.isDirectory()) throw new Error('configured Drive inbox is not a directory')
  return hashValue({
    domain: 'MindmakeVideoStudio/Inbox/v1',
    configured: true,
    path: resolve(inboxPath).toLocaleLowerCase('en-GB'),
    actual_path: resolve(actualPath).toLocaleLowerCase('en-GB'),
    device: String(info.dev),
    inode: String(info.ino),
    created_ms: Math.trunc(Number(info.birthtimeMs)),
  })
}

function pathIsInside(parent: string, child: string): boolean {
  const canonicalParent = resolve(parent).toLocaleLowerCase('en-GB')
  const canonicalChild = resolve(child).toLocaleLowerCase('en-GB')
  return canonicalChild !== canonicalParent && canonicalChild.startsWith(`${canonicalParent}${sep}`)
}

function pathsOverlap(left: string, right: string): boolean {
  const canonicalLeft = resolve(left).toLocaleLowerCase('en-GB')
  const canonicalRight = resolve(right).toLocaleLowerCase('en-GB')
  return canonicalLeft === canonicalRight
    || canonicalLeft.startsWith(`${canonicalRight}${sep}`)
    || canonicalRight.startsWith(`${canonicalLeft}${sep}`)
}

async function inboxOverlapsArchive(inboxPath: string, archiveRoot: string | null): Promise<boolean> {
  if (!archiveRoot) return false
  if (pathsOverlap(inboxPath, archiveRoot)) return true
  try {
    const [actualInbox, actualArchive] = await Promise.all([realpath(inboxPath), realpath(archiveRoot)])
    return pathsOverlap(actualInbox, actualArchive)
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false
    throw error
  }
}

async function configuredInboxBoundary(driveRoot: string | null, inboxPath: string): Promise<'valid' | 'invalid' | 'unavailable'> {
  if (!driveRoot || !pathIsInside(driveRoot, inboxPath)) return 'invalid'
  try {
    const [actualRoot, actualInbox] = await Promise.all([realpath(driveRoot), realpath(inboxPath)])
    return pathIsInside(actualRoot, actualInbox) ? 'valid' : 'invalid'
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return 'unavailable'
    throw error
  }
}

function errorCode(error: unknown): string {
  return String((error as NodeJS.ErrnoException).code ?? '')
}

async function walkInbox(root: string, maximumFiles: number, maximumEntries: number, maximumDepth: number): Promise<WalkResult> {
  const files: string[] = []
  const safeCodes = new Set<string>()
  let limited = false
  let entriesSeen = 0
  async function walk(directory: string, depth: number): Promise<void> {
    const entries = []
    const directoryHandle = await opendir(directory)
    for await (const entry of directoryHandle) {
      if (entry.isFile() && entry.name.toLocaleLowerCase('en-GB') === 'desktop.ini') continue
      entriesSeen += 1
      if (entriesSeen > maximumEntries) { limited = true; safeCodes.add('scan_entry_limit_reached'); break }
      entries.push(entry)
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en-GB'))
    for (const entry of entries) {
      if (limited && entriesSeen > maximumEntries) return
      if (files.length >= maximumFiles) { limited = true; safeCodes.add('scan_file_limit_reached'); return }
      if (entry.isSymbolicLink()) { safeCodes.add('symbolic_link_ignored'); continue }
      const child = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (depth >= maximumDepth) { limited = true; safeCodes.add('scan_depth_limit_reached'); continue }
        await walk(child, depth + 1)
        if (limited && entriesSeen > maximumEntries) return
      } else if (entry.isFile()) files.push(child)
      else safeCodes.add('unsupported_directory_entry_ignored')
    }
  }
  await walk(root, 0)
  return { files, safeCodes: [...safeCodes].sort(), limited }
}

async function readProbe(path: string): Promise<'stable' | 'changed'> {
  const before = await stat(path)
  if (!before.isFile()) throw new Error('discovery path is no longer a regular file')
  const handle = await open(path, 'r')
  try {
    if (before.size > 0) {
      const first = Buffer.alloc(1)
      const firstRead = await handle.read(first, 0, 1, 0)
      if (firstRead.bytesRead !== 1) return 'changed'
      if (before.size > 1) {
        const last = Buffer.alloc(1)
        const lastRead = await handle.read(last, 0, 1, before.size - 1)
        if (lastRead.bytesRead !== 1) return 'changed'
      }
    }
  } finally {
    await handle.close()
  }
  const after = await stat(path)
  return before.size === after.size
    && Math.trunc(Number(before.mtimeMs)) === Math.trunc(Number(after.mtimeMs))
    && filesystemIdentityHash(before) === filesystemIdentityHash(after)
    ? 'stable'
    : 'changed'
}

export function driveDiscoverySidecarByteLimit(): number {
  return configuredInteger('MINDMAKE_DISCOVERY_MAX_SIDECAR_BYTES', DEFAULT_MAX_SIDECAR_BYTES, 1, 1_073_741_824)
}

async function boundedTextPrefix(path: string, maximumBytes = 65_536): Promise<string> {
  const info = await stat(path)
  const length = Math.min(info.size, maximumBytes)
  if (length <= 0) return ''
  const buffer = Buffer.alloc(length)
  const handle = await open(path, 'r')
  try {
    const result = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, result.bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

export async function captionSidecarLooksLikeDjiTelemetry(path: string): Promise<boolean> {
  if (extname(path).toLowerCase() !== '.srt') return false
  const sample = await boundedTextPrefix(path)
  const indicators = [
    /\bframecnt\s*:/i,
    /\bdifftime\s*:/i,
    /\bshutter\s*:/i,
    /\bfnum\s*:/i,
    /\biso\s*:/i,
    /\b(?:latitude|longitude|rel_alt|abs_alt|gb_yaw)\s*:/i,
    /\bdrone[-_ ]?dji\b/i,
  ]
  return indicators.filter((pattern) => pattern.test(sample)).length >= 2
}

function observationBase(path: string, root: string, now: string, previous?: DriveDiscoveryFileV1): Omit<DriveDiscoveryFileV1, 'byte_size' | 'modified_ms' | 'status' | 'safe_code' | 'filesystem_identity_hash'> {
  const relativePath = portableRelativePath(root, path)
  const key = pathKey(relativePath)
  const rawExtension = extname(path).toLowerCase()
  const extension = /^\.[a-z0-9]{1,12}$/.test(rawExtension) ? rawExtension : '.other'
  return {
    schema_version: 1,
    file_id: `file_${key.slice(0, 24)}`,
    path_key: key,
    relative_path: relativePath,
    display_name: basename(path),
    extension: extension || '.none',
    kind: fileKind(extension),
    first_seen_at: previous?.first_seen_at ?? now,
    last_seen_at: now,
    unchanged_since_at: previous?.unchanged_since_at ?? now,
    consecutive_unchanged_scans: previous ? previous.consecutive_unchanged_scans + 1 : 1,
  }
}

function filesystemIdentityHash(info: Awaited<ReturnType<typeof stat>>): string {
  return hashValue({
    domain: 'MindmakeVideoStudio/FilesystemIdentity/v1',
    size: info.size,
    modified_ms: Math.trunc(Number(info.mtimeMs)),
    changed_ms: Math.trunc(Number(info.ctimeMs)),
    created_ms: Math.trunc(Number(info.birthtimeMs)),
    device: String(info.dev),
    inode: String(info.ino),
  })
}

async function observeFile(
  path: string,
  root: string,
  previous: DriveDiscoveryFileV1 | undefined,
  now: Date,
  stabilitySeconds: number,
  contentReverificationSeconds: number,
  forceContentHash: boolean,
  maxSidecarBytes: number,
  hashBudget: { maximumBytes: number; remainingBytes: number },
): Promise<DriveDiscoveryFileV1> {
  const nowIso = now.toISOString()
  const info = await stat(path)
  const partialBase = observationBase(path, root, nowIso, previous)
  const byteSize = info.size
  const modifiedMs = Math.trunc(Number(info.mtimeMs))
  const identityHash = filesystemIdentityHash(info)
  const metadataUnchanged = Boolean(previous && previous.byte_size === byteSize && previous.modified_ms === modifiedMs && previous.filesystem_identity_hash === identityHash)
  const base = {
    ...partialBase,
    byte_size: byteSize,
    modified_ms: modifiedMs,
    filesystem_identity_hash: identityHash,
    unchanged_since_at: metadataUnchanged ? previous!.unchanged_since_at : nowIso,
    consecutive_unchanged_scans: metadataUnchanged ? previous!.consecutive_unchanged_scans + 1 : 1,
  }
  if (base.kind === 'unsupported') return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'unsupported', safe_code: 'unsupported_file_type' })
  if (!info.isFile()) return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'partial', safe_code: 'not_a_regular_file' })
  if (byteSize === 0) return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'partial', safe_code: 'empty_file' })
  try {
    if (await readProbe(path) === 'changed') return DriveDiscoveryFileV1Schema.parse({ ...base, unchanged_since_at: nowIso, consecutive_unchanged_scans: 1, status: 'partial', safe_code: 'file_changed_during_probe' })
  } catch (error) {
    if (['EACCES', 'EPERM'].includes(errorCode(error))) return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'permission_denied', safe_code: 'file_permission_denied' })
    return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'partial', safe_code: 'file_temporarily_unreadable' })
  }
  const stableForMs = now.getTime() - Date.parse(base.unchanged_since_at)
  if (!metadataUnchanged || base.consecutive_unchanged_scans < 2 || stableForMs < stabilitySeconds * 1000) {
    return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'partial', safe_code: 'awaiting_stability' })
  }
  if (['caption_sidecar', 'edit_sidecar'].includes(base.kind) && byteSize > maxSidecarBytes) {
    return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'partial', safe_code: 'sidecar_size_limit_exceeded' })
  }
  const priorVerificationAgeMs = previous?.content_verified_at ? now.getTime() - Date.parse(previous.content_verified_at) : Number.POSITIVE_INFINITY
  if (!forceContentHash && priorVerificationAgeMs < contentReverificationSeconds * 1_000 && previous?.content_hash && previous.filesystem_identity_hash === identityHash) {
    return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'stable', safe_code: previous.safe_code === 'dji_telemetry_srt_requires_manual_review' ? previous.safe_code : 'stable', content_hash: previous.content_hash, content_verified_at: previous.content_verified_at })
  }
  if (byteSize > hashBudget.maximumBytes) return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'partial', safe_code: 'file_exceeds_hash_budget' })
  if (byteSize > hashBudget.remainingBytes) return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'partial', safe_code: 'hash_byte_budget_deferred' })
  hashBudget.remainingBytes -= byteSize
  try {
    const contentHash = await hashFile(path)
    const telemetry = base.kind === 'caption_sidecar' && await captionSidecarLooksLikeDjiTelemetry(path)
    const after = await stat(path)
    if (after.size !== byteSize || Math.trunc(Number(after.mtimeMs)) !== modifiedMs || filesystemIdentityHash(after) !== identityHash) {
      return DriveDiscoveryFileV1Schema.parse({ ...base, unchanged_since_at: nowIso, consecutive_unchanged_scans: 1, status: 'partial', safe_code: 'file_changed_during_hash' })
    }
    return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'stable', safe_code: telemetry ? 'dji_telemetry_srt_requires_manual_review' : 'stable', content_hash: contentHash, content_verified_at: nowIso })
  } catch (error) {
    if (['EACCES', 'EPERM'].includes(errorCode(error))) return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'permission_denied', safe_code: 'file_permission_denied' })
    return DriveDiscoveryFileV1Schema.parse({ ...base, status: 'partial', safe_code: 'file_temporarily_unreadable' })
  }
}

function explicitDjiSplitIdentity(file: DriveDiscoveryFileV1): SplitIdentity | null {
  if (file.kind !== 'video' || !file.display_name.toLowerCase().startsWith('dji_')) return null
  const stem = parse(file.display_name).name
  const match = stem.match(/^(.*?)(?:[_. -](?:part|pt|split|segment|seg))0*(\d{1,3})$/i)
  if (!match?.[1] || !match[2]) return null
  const part = Number(match[2])
  if (!Number.isSafeInteger(part) || part < 1) return null
  const directory = dirname(file.relative_path).replaceAll('\\', '/')
  const groupStem = match[1]
  return {
    groupKey: `${directory.toLocaleLowerCase('en-GB')}/${groupStem.toLocaleLowerCase('en-GB')}`,
    groupDisplayName: groupStem,
    groupStem,
    part,
  }
}

function fileStemKey(file: DriveDiscoveryFileV1): string {
  const directory = dirname(file.relative_path).replaceAll('\\', '/').toLocaleLowerCase('en-GB')
  return `${directory}/${parse(file.display_name).name.toLocaleLowerCase('en-GB')}`
}

function makeCandidate(input: {
  inboxFingerprint: string
  displayName: string
  classification: DriveIntakeCandidateV1['classification']
  availability?: DriveIntakeCandidateV1['availability']
  sequenceKind: DriveIntakeCandidateV1['sequence_kind']
  media: DriveDiscoveryFileV1[]
  sidecars: DriveDiscoveryFileV1[]
  safeCodes: string[]
}): DriveIntakeCandidateV1 {
  const boundedMedia = input.media.slice(0, 32)
  const boundedSidecars = input.sidecars.slice(0, 32)
  const omittedComponentCount = input.media.length + input.sidecars.length - boundedMedia.length - boundedSidecars.length
  const safeCodes = [...new Set([...input.safeCodes, ...(omittedComponentCount ? ['candidate_component_limit_exceeded'] : [])])].sort()
  const classification = omittedComponentCount ? 'attention' : input.classification
  const fingerprint = hashValue({
    domain: 'MindmakeVideoStudio/DriveIntakeCandidate/v1',
    sequence_kind: input.sequenceKind,
    media: input.media.map((file) => ({ kind: file.kind, content_hash: file.content_hash })),
    sidecars: input.sidecars.map((file) => ({ kind: file.kind, content_hash: file.content_hash })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), 'en-GB')),
  })
  const body = {
    schema_version: 1 as const,
    candidate_id: `intake_${fingerprint.slice(0, 24)}`,
    candidate_fingerprint: fingerprint,
    inbox_fingerprint: input.inboxFingerprint,
    display_name: input.displayName,
    classification,
    availability: input.availability ?? 'available',
    sequence_kind: input.sequenceKind,
    total_media_files: input.media.length,
    total_sidecar_files: input.sidecars.length,
    omitted_component_count: omittedComponentCount,
    media_file_ids: boundedMedia.map((file) => file.file_id),
    sidecar_file_ids: boundedSidecars.map((file) => file.file_id),
    components: [
      ...boundedMedia.map((file, index) => ({
        file_id: file.file_id,
        relative_path: file.relative_path,
        kind: file.kind as 'video' | 'audio',
        role: file.kind === 'audio' ? 'isolated_audio' as const : input.sequenceKind === 'dji_explicit_split' ? 'sequence_video' as const : 'primary_video' as const,
        ordinal: index,
        content_hash: file.content_hash!,
      })),
      ...boundedSidecars.map((file, index) => ({
        file_id: file.file_id,
        relative_path: file.relative_path,
        kind: file.kind as 'caption_sidecar' | 'edit_sidecar',
        role: file.kind as 'caption_sidecar' | 'edit_sidecar',
        ordinal: index,
        content_hash: file.content_hash!,
      })),
    ],
    safe_codes: safeCodes,
  }
  return DriveIntakeCandidateV1Schema.parse({ ...body, candidate_hash: hashValue(driveIntakeCandidateHashInputV1(body)) })
}

function buildCandidates(files: DriveDiscoveryFileV1[], previous: DriveIntakeCandidateV1[], currentInboxFingerprint: string): { candidates: DriveIntakeCandidateV1[]; safeCodes: string[] } {
  const available = files.filter((file) => ['stable', 'duplicate'].includes(file.status) && file.content_hash)
  const videos = available.filter((file) => file.kind === 'video')
  const pendingVideos = files.filter((file) => file.kind === 'video' && !['stable', 'duplicate'].includes(file.status))
  const audio = available.filter((file) => file.kind === 'audio')
  const sidecars = available.filter((file) => ['caption_sidecar', 'edit_sidecar'].includes(file.kind))
  const pendingAssociations = files.filter((file) => ['audio', 'caption_sidecar', 'edit_sidecar'].includes(file.kind) && !['stable', 'duplicate'].includes(file.status))
  const candidateSafeCodes = new Set<string>()
  const candidates: DriveIntakeCandidateV1[] = []
  const usedVideoIds = new Set<string>()
  const splitGroups = new Map<string, Array<{ file: DriveDiscoveryFileV1; identity: SplitIdentity }>>()
  const pendingSplitGroups = new Map<string, DriveDiscoveryFileV1[]>()
  for (const video of videos) {
    const identity = explicitDjiSplitIdentity(video)
    if (!identity) continue
    const group = splitGroups.get(identity.groupKey) ?? []
    group.push({ file: video, identity })
    splitGroups.set(identity.groupKey, group)
  }
  for (const video of pendingVideos) {
    const identity = explicitDjiSplitIdentity(video)
    if (!identity) continue
    const group = pendingSplitGroups.get(identity.groupKey) ?? []
    group.push(video)
    pendingSplitGroups.set(identity.groupKey, group)
  }

  const exactAssociations = (stems: Set<string>, groupStem?: string): { audioFiles: DriveDiscoveryFileV1[]; sidecarFiles: DriveDiscoveryFileV1[]; safeCodes: string[] } => {
    const audioFiles = audio.filter((file) => stems.has(fileStemKey(file))).sort((left, right) => left.relative_path.localeCompare(right.relative_path, 'en-GB'))
    const sidecarFiles = sidecars.filter((file) => stems.has(fileStemKey(file))).sort((left, right) => left.relative_path.localeCompare(right.relative_path, 'en-GB'))
    const pendingFiles = pendingAssociations.filter((file) => stems.has(fileStemKey(file)))
    const safeCodes: string[] = []
    if (pendingFiles.length) safeCodes.push('matching_association_not_stable')
    if (sidecarFiles.some((file) => file.safe_code === 'dji_telemetry_srt_requires_manual_review')) safeCodes.push('dji_telemetry_srt_requires_manual_review')
    if (audioFiles.length > 1) safeCodes.push('multiple_isolated_audio_matches')
    const captions = sidecarFiles.filter((file) => file.kind === 'caption_sidecar')
    const edits = sidecarFiles.filter((file) => file.kind === 'edit_sidecar')
    if (captions.length > 1) safeCodes.push('multiple_caption_sidecar_matches')
    if (edits.length > 1) safeCodes.push('multiple_edit_sidecar_matches')
    if (groupStem) {
      const hasGroupCaption = captions.some((file) => fileStemKey(file) === groupStem)
      const hasPartCaption = captions.some((file) => fileStemKey(file) !== groupStem)
      const hasGroupEdit = edits.some((file) => fileStemKey(file) === groupStem)
      const hasPartEdit = edits.some((file) => fileStemKey(file) !== groupStem)
      if (hasGroupCaption && hasPartCaption) safeCodes.push('mixed_group_and_part_caption_sidecars')
      if (hasGroupEdit && hasPartEdit) safeCodes.push('mixed_group_and_part_edit_sidecars')
    }
    return { audioFiles, sidecarFiles, safeCodes: [...new Set(safeCodes)].sort() }
  }

  for (const group of [...splitGroups.values()].sort((left, right) => left[0]!.identity.groupKey.localeCompare(right[0]!.identity.groupKey, 'en-GB'))) {
    group.sort((left, right) => left.identity.part - right.identity.part || left.file.relative_path.localeCompare(right.file.relative_path, 'en-GB'))
    group.forEach(({ file }) => usedVideoIds.add(file.file_id))
    const media = group.map(({ file }) => file)
    const parts = group.map(({ identity }) => identity.part)
    const uniqueParts = new Set(parts)
    const contiguous = uniqueParts.size === parts.length && parts[0] === 1 && parts.every((part, index) => part === index + 1)
    const safeCodes: string[] = []
    if (group.length < 2) safeCodes.push('dji_split_sequence_incomplete')
    if (group.length > MAX_DJI_SPLIT_PARTS) safeCodes.push('dji_split_sequence_too_large')
    if (uniqueParts.size !== parts.length) safeCodes.push('dji_split_part_number_ambiguous')
    if (!contiguous) safeCodes.push('dji_split_sequence_has_gaps')
    if ((pendingSplitGroups.get(group[0]!.identity.groupKey)?.length ?? 0) > 0) safeCodes.push('dji_split_part_not_stable')
    const stems = new Set(group.map(({ file }) => fileStemKey(file)))
    stems.add(group[0]!.identity.groupKey)
    const groupStem = group[0]!.identity.groupKey
    const associated = exactAssociations(stems, groupStem)
    safeCodes.push(...associated.safeCodes)
    if ([...media, ...associated.audioFiles, ...associated.sidecarFiles].some((file) => file.status === 'duplicate')) safeCodes.push('duplicate_media_content')
    const classification = safeCodes.some((code) => code !== 'duplicate_media_content') ? 'attention' : safeCodes.length ? 'duplicate' : 'ready_for_review'
    safeCodes.forEach((code) => candidateSafeCodes.add(code))
    candidates.push(makeCandidate({
      inboxFingerprint: currentInboxFingerprint,
      displayName: group[0]!.identity.groupDisplayName,
      classification,
      sequenceKind: 'dji_explicit_split',
      media: [...media, ...associated.audioFiles],
      sidecars: associated.sidecarFiles,
      safeCodes,
    }))
  }

  const standalone = videos.filter((file) => !usedVideoIds.has(file.file_id))
  const byStem = new Map<string, DriveDiscoveryFileV1[]>()
  for (const video of standalone) {
    const key = fileStemKey(video)
    const grouped = byStem.get(key) ?? []
    grouped.push(video)
    byStem.set(key, grouped)
  }
  for (const [stem, media] of [...byStem.entries()].sort(([left], [right]) => left.localeCompare(right, 'en-GB'))) {
    media.sort((left, right) => left.relative_path.localeCompare(right.relative_path, 'en-GB'))
    const associated = exactAssociations(new Set([stem]))
    const safeCodes: string[] = []
    if (media.length > 1) safeCodes.push('ambiguous_primary_media')
    if (pendingVideos.some((file) => fileStemKey(file) === stem)) safeCodes.push('matching_primary_media_not_stable')
    safeCodes.push(...associated.safeCodes)
    if ([...media, ...associated.audioFiles, ...associated.sidecarFiles].some((file) => file.status === 'duplicate')) safeCodes.push('duplicate_media_content')
    const classification = safeCodes.some((code) => code !== 'duplicate_media_content') ? 'attention' : safeCodes.length ? 'duplicate' : 'ready_for_review'
    safeCodes.forEach((code) => candidateSafeCodes.add(code))
    candidates.push(makeCandidate({
      inboxFingerprint: currentInboxFingerprint,
      displayName: media.length === 1 ? media[0]!.display_name : parse(media[0]!.display_name).name,
      classification,
      sequenceKind: 'standalone',
      media: [...media, ...associated.audioFiles],
      sidecars: associated.sidecarFiles,
      safeCodes,
    }))
  }

  const attachedFileIds = new Set(candidates.flatMap((candidate) => [...candidate.media_file_ids, ...candidate.sidecar_file_ids]))
  if (audio.some((file) => !attachedFileIds.has(file.file_id))) candidateSafeCodes.add('orphan_audio_requires_manual_bundle')
  if (sidecars.some((file) => !attachedFileIds.has(file.file_id))) candidateSafeCodes.add('orphan_sidecar_requires_manual_match')

  const initialByCandidateId = new Map<string, DriveIntakeCandidateV1>()
  const rank = { ready_for_review: 3, attention: 2, duplicate: 1 } as const
  for (const candidate of candidates) {
    const existing = initialByCandidateId.get(candidate.candidate_id)
    if (!existing) {
      initialByCandidateId.set(candidate.candidate_id, candidate)
      continue
    }
    const allCodes = [...new Set([...existing.safe_codes, ...candidate.safe_codes])].sort()
    const attentionCodes = allCodes.filter((code) => code !== 'duplicate_media_content')
    if (attentionCodes.length) {
      const preferred = rank[candidate.classification] > rank[existing.classification] ? candidate : existing
      const { candidate_hash: _candidateHash, ...preferredBody } = preferred
      const amended = { ...preferredBody, classification: 'attention' as const, safe_codes: allCodes }
      initialByCandidateId.set(candidate.candidate_id, DriveIntakeCandidateV1Schema.parse({ ...amended, candidate_hash: hashValue(driveIntakeCandidateHashInputV1(amended)) }))
      attentionCodes.forEach((code) => candidateSafeCodes.add(code))
    } else if (rank[candidate.classification] > rank[existing.classification]) {
      initialByCandidateId.set(candidate.candidate_id, candidate)
    }
  }
  const current = [...initialByCandidateId.values()]
  const associationOwners = new Map<string, string[]>()
  for (const candidate of current) {
    for (const component of candidate.components.filter((item) => item.kind !== 'video')) {
      const owners = associationOwners.get(component.file_id) ?? []
      owners.push(candidate.candidate_id)
      associationOwners.set(component.file_id, owners)
    }
  }
  for (const [index, candidate] of current.entries()) {
    if (!candidate.components.some((component) => component.kind !== 'video' && (associationOwners.get(component.file_id)?.length ?? 0) > 1)) continue
    const { candidate_hash: _candidateHash, ...body } = candidate
    const amended = {
      ...body,
      classification: 'attention' as const,
      safe_codes: [...new Set([...body.safe_codes, 'association_matches_multiple_candidates'])].sort(),
    }
    current[index] = DriveIntakeCandidateV1Schema.parse({ ...amended, candidate_hash: hashValue(driveIntakeCandidateHashInputV1(amended)) })
    candidateSafeCodes.add('association_matches_multiple_candidates')
  }

  const currentIds = new Set(current.map((candidate) => candidate.candidate_id))
  for (const missing of previous.filter((candidate) => candidate.availability === 'available' && !currentIds.has(candidate.candidate_id))) {
    const body = {
      ...missing,
      classification: 'attention' as const,
      availability: 'missing' as const,
      safe_codes: ['source_missing_or_changed'],
    }
    const { candidate_hash: _candidateHash, ...hashBody } = body
    current.push(DriveIntakeCandidateV1Schema.parse({ ...hashBody, candidate_hash: hashValue(driveIntakeCandidateHashInputV1(hashBody)) }))
    candidateSafeCodes.add('source_missing_or_changed')
  }
  current.flatMap((candidate) => candidate.safe_codes).forEach((code) => candidateSafeCodes.add(code))
  return { candidates: current.sort((left, right) => left.candidate_id.localeCompare(right.candidate_id, 'en-GB')), safeCodes: [...candidateSafeCodes].sort() }
}

function healthForScan(input: {
  status: DriveDiscoveryHealthStatusV1
  safeCodes: string[]
  files: DriveDiscoveryFileV1[]
  candidates: DriveIntakeCandidateV1[]
  reviews: Record<string, DriveIntakeReviewV1>
}): DriveDiscoveryScanSnapshotV1['health'] {
  const reviewed = input.candidates.filter((candidate) => input.reviews[candidate.candidate_id]?.candidate_hash === candidate.candidate_hash).length
  return {
    schema_version: 1,
    status: input.status,
    drive_state: input.status === 'ready' ? 'ready' : input.status === 'not_configured' ? 'not_configured' : 'unavailable',
    safe_codes: [...new Set(input.safeCodes)].sort().slice(0, 32),
    files_seen: input.files.length,
    partial_files: input.files.filter((file) => file.status === 'partial').length,
    stable_files: input.files.filter((file) => file.status === 'stable').length,
    unsupported_files: input.files.filter((file) => file.status === 'unsupported').length,
    duplicate_files: input.files.filter((file) => file.status === 'duplicate').length,
    ready_candidates: input.candidates.filter((candidate) => candidate.classification === 'ready_for_review' && candidate.availability === 'available').length,
    attention_candidates: input.candidates.filter((candidate) => candidate.classification !== 'ready_for_review' || candidate.availability !== 'available').length,
    reviewed_candidates: reviewed,
  }
}

function unavailableSnapshot(input: {
  previous: DriveDiscoveryStateV1
  status: DriveDiscoveryHealthStatusV1
  safeCode: string
  currentInboxFingerprint: string
  scannedAt: string
  settings: ScanSettings
}): DriveDiscoveryScanSnapshotV1 {
  const prior = input.previous.scan
  const sameInbox = prior?.inbox_fingerprint === input.currentInboxFingerprint
  const files = sameInbox ? prior.files : []
  const candidates = sameInbox ? prior.candidates.map((candidate) => {
    const { candidate_hash: _candidateHash, ...body } = candidate
    const unavailable = {
      ...body,
      classification: 'attention' as const,
      availability: 'missing' as const,
      safe_codes: [input.safeCode],
    }
    return DriveIntakeCandidateV1Schema.parse({ ...unavailable, candidate_hash: hashValue(driveIntakeCandidateHashInputV1(unavailable)) })
  }) : []
  return DriveDiscoveryScanSnapshotV1Schema.parse({
    schema_version: 1,
    scan_sequence: (prior?.scan_sequence ?? 0) + 1,
    scanned_at: input.scannedAt,
    inbox_fingerprint: input.currentInboxFingerprint,
    settings: snapshotSettings(input.settings),
    health: healthForScan({ status: input.status, safeCodes: [input.safeCode], files, candidates, reviews: input.previous.reviews }),
    files,
    candidates,
    known_content: sameInbox ? prior.known_content : {},
  })
}

function snapshotSettings(settings: ScanSettings): DriveDiscoveryScanSnapshotV1['settings'] {
  return {
    stability_seconds: settings.stabilitySeconds,
    maximum_files: settings.maxFiles,
    maximum_entries: settings.maxEntries,
    maximum_depth: settings.maxDepth,
    maximum_hash_bytes_per_scan: settings.maxHashBytesPerScan,
    maximum_sidecar_bytes: settings.maxSidecarBytes,
    history_retention_days: settings.historyRetentionDays,
    content_reverification_seconds: settings.contentReverificationSeconds,
    algorithm_version: DISCOVERY_ALGORITHM_VERSION,
    software_commit: settings.softwareCommit,
    configuration_hash: settings.configurationHash,
  }
}

function semanticallyEquivalentScan(left: DriveDiscoveryScanSnapshotV1 | null, right: DriveDiscoveryScanSnapshotV1): boolean {
  if (!left) return false
  const semantic = (scan: DriveDiscoveryScanSnapshotV1) => ({
    inbox_fingerprint: scan.inbox_fingerprint,
    settings: scan.settings,
    health: scan.health,
    files: scan.files.map(({ last_seen_at: _lastSeen, consecutive_unchanged_scans: _unchangedScans, ...file }) => file),
    candidates: scan.candidates,
    known_content: Object.fromEntries(Object.entries(scan.known_content).map(([hash, { last_seen_at: _lastSeen, ...known }]) => [hash, known])),
  })
  return hashValue(semantic(left)) === hashValue(semantic(right))
}

async function writeCandidateArtifacts(snapshot: DriveDiscoveryScanSnapshotV1, runtimeRoot?: string): Promise<void> {
  const paths = discoveryPaths(runtimeRoot)
  await mkdir(paths.candidates, { recursive: true })
  for (const candidate of snapshot.candidates) {
    const path = join(paths.candidates, `${candidate.candidate_hash}.json`)
    try {
      const existing = DriveIntakeCandidateV1Schema.parse(JSON.parse(await readFile(path, 'utf8')))
      if (existing.candidate_hash !== candidate.candidate_hash || hashValue(existing) !== hashValue(candidate)) throw new Error('content-addressed Drive intake candidate differs from its existing artifact')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await atomicJson(path, candidate)
    }
  }
}

async function persistScanSnapshot(
  snapshot: DriveDiscoveryScanSnapshotV1,
  previous: DriveDiscoveryStateV1,
  options: DriveDiscoveryScanOptions,
): Promise<DriveDiscoveryStateV1> {
  await writeCandidateArtifacts(snapshot, options.runtimeRoot)
  if (options.recordUnchanged === false && semanticallyEquivalentScan(previous.scan, snapshot)) return previous
  const eventBase = {
    schema_version: 1 as const,
    event_id: randomUUID(),
    type: 'scan_completed' as const,
    occurred_at: snapshot.scanned_at,
    previous_event_hash: previous.latest_event_hash,
    scan: snapshot,
  }
  return persistEvent(eventBase, options.runtimeRoot)
}

async function scanWithinLock(options: DriveDiscoveryScanOptions): Promise<DriveDiscoveryStateV1> {
  const paths = studioPaths()
  const inboxPath = options.inboxPath === undefined ? paths.mediaInbox : options.inboxPath
  const driveRoot = options.driveRoot === undefined ? paths.driveRoot : options.driveRoot
  const archiveRoot = options.archiveRoot === undefined ? paths.archiveRoot : options.archiveRoot
  const runtimeRoot = options.runtimeRoot
  const requestedNow = options.now?.() ?? new Date()
  const events = await readEvents(runtimeRoot, true)
  const previous = reduceEvents(events)
  const previousScanTime = previous.scan ? Date.parse(previous.scan.scanned_at) : Number.NEGATIVE_INFINITY
  const now = new Date(Math.max(requestedNow.getTime(), previousScanTime))
  const scannedAt = now.toISOString()
  const trustedInboxFingerprint = trustedInboxFingerprintFromEvents(events)
  const settings = scanSettings(options)
  let snapshot: DriveDiscoveryScanSnapshotV1
  if (!inboxPath) {
    snapshot = unavailableSnapshot({ previous, status: 'not_configured', safeCode: 'inbox_not_configured', currentInboxFingerprint: trustedInboxFingerprint ?? inboxFingerprint(inboxPath), scannedAt, settings })
  } else {
    let walk: WalkResult
    let currentInboxFingerprint = trustedInboxFingerprint ?? inboxFingerprint(inboxPath)
    try {
      if (await inboxOverlapsArchive(inboxPath, archiveRoot)) {
        snapshot = unavailableSnapshot({ previous, status: 'error', safeCode: 'inbox_archive_overlap', currentInboxFingerprint, scannedAt, settings })
        return persistScanSnapshot(snapshot, previous, options)
      }
      const boundary = await configuredInboxBoundary(driveRoot, inboxPath)
      if (boundary === 'invalid') {
        snapshot = unavailableSnapshot({ previous, status: 'error', safeCode: 'inbox_configuration_invalid', currentInboxFingerprint, scannedAt, settings })
        return persistScanSnapshot(snapshot, previous, options)
      }
      const observedInboxFingerprint = await resolvedInboxFingerprint(inboxPath)
      if (trustedInboxFingerprint && observedInboxFingerprint !== trustedInboxFingerprint) {
        snapshot = unavailableSnapshot({ previous, status: 'error', safeCode: 'inbox_identity_changed_requires_rebind', currentInboxFingerprint: trustedInboxFingerprint, scannedAt, settings })
        return persistScanSnapshot(snapshot, previous, options)
      }
      currentInboxFingerprint = observedInboxFingerprint
      walk = await walkInbox(resolve(inboxPath), settings.maxFiles, settings.maxEntries, settings.maxDepth)
    } catch (error) {
      const code = errorCode(error)
      let status: DriveDiscoveryHealthStatusV1 = 'error'
      let safeCode = 'inbox_scan_failed'
      if (['EACCES', 'EPERM'].includes(code)) { status = 'permission_denied'; safeCode = 'inbox_permission_denied' }
      else if (code === 'ENOENT') {
        let rootAvailable = false
        if (driveRoot) {
          try { await access(driveRoot); rootAvailable = true } catch { rootAvailable = false }
        }
        status = rootAvailable ? 'inbox_missing' : 'offline'
        safeCode = rootAvailable ? 'inbox_folder_missing' : 'drive_mount_offline'
      }
      snapshot = unavailableSnapshot({ previous, status, safeCode, currentInboxFingerprint, scannedAt, settings })
      return persistScanSnapshot(snapshot, previous, options)
    }

    const sameInbox = previous.scan?.inbox_fingerprint === currentInboxFingerprint
    const previousFiles = sameInbox ? previous.scan?.files ?? [] : []
    const previousCandidates = sameInbox ? previous.scan?.candidates ?? [] : []
    const previousByPath = new Map(previousFiles.map((file) => [file.path_key, file]))
    const observations: DriveDiscoveryFileV1[] = []
    const scanCodes = new Set(walk.safeCodes)
    const hashBudget = { maximumBytes: settings.maxHashBytesPerScan, remainingBytes: settings.maxHashBytesPerScan }
    for (const path of walk.files) {
      const relativePath = portableRelativePath(resolve(inboxPath), path)
      if (relativePath.length > 1_024 || basename(path).length > 260) {
        walk.limited = true
        scanCodes.add('inbox_path_too_long')
        continue
      }
      const prior = previousByPath.get(pathKey(relativePath))
      try { observations.push(await observeFile(path, resolve(inboxPath), prior, now, settings.stabilitySeconds, settings.contentReverificationSeconds, options.forceContentHash === true, settings.maxSidecarBytes, hashBudget)) }
      catch (error) {
        const base = observationBase(path, resolve(inboxPath), scannedAt, prior)
        const permission = ['EACCES', 'EPERM'].includes(errorCode(error))
        observations.push(DriveDiscoveryFileV1Schema.parse({
          ...base,
          byte_size: prior?.byte_size ?? 0,
          modified_ms: prior?.modified_ms ?? 0,
          filesystem_identity_hash: prior?.filesystem_identity_hash ?? hashValue({ domain: 'MindmakeVideoStudio/UnavailableFilesystemIdentity/v1', path_key: base.path_key }),
          status: permission ? 'permission_denied' : 'partial',
          safe_code: permission ? 'file_permission_denied' : 'file_stat_unavailable',
        }))
        scanCodes.add(permission ? 'file_permission_denied' : 'file_stat_unavailable')
      }
    }
    observations.sort((left, right) => left.relative_path.localeCompare(right.relative_path, 'en-GB'))
    for (const file of observations) {
      if (['file_exceeds_hash_budget', 'hash_byte_budget_deferred', 'sidecar_size_limit_exceeded', 'dji_telemetry_srt_requires_manual_review'].includes(file.safe_code)) scanCodes.add(file.safe_code)
    }

    const retentionCutoff = now.getTime() - settings.historyRetentionDays * 86_400_000
    const retainedKnown = sameInbox
      ? Object.entries(previous.scan?.known_content ?? {})
        .filter(([, known]) => Date.parse(known.last_seen_at) >= retentionCutoff)
        .sort((left, right) => Date.parse(right[1].last_seen_at) - Date.parse(left[1].last_seen_at) || left[0].localeCompare(right[0], 'en-GB'))
        .slice(0, 5_000)
      : []
    const knownContent: Record<string, DriveDiscoveryKnownContentV1> = Object.fromEntries(retainedKnown)
    const stableByHash = new Map<string, DriveDiscoveryFileV1[]>()
    for (const file of observations.filter((item) => item.status === 'stable' && item.content_hash)) {
      const group = stableByHash.get(file.content_hash!) ?? []
      group.push(file)
      stableByHash.set(file.content_hash!, group)
    }
    const replacements = new Map<string, DriveDiscoveryFileV1>()
    for (const [contentHash, group] of [...stableByHash.entries()].sort(([left], [right]) => left.localeCompare(right, 'en-GB'))) {
      group.sort((left, right) => left.relative_path.localeCompare(right.relative_path, 'en-GB'))
      const known = knownContent[contentHash]
      const canonical = group.find((file) => file.path_key === known?.first_path_key) ?? group[0]!
      if (known && known.first_path_key !== canonical.path_key) scanCodes.add('content_location_rebased')
      knownContent[contentHash] = {
        first_file_id: canonical.file_id,
        first_path_key: canonical.path_key,
        first_seen_at: known?.first_seen_at ?? canonical.first_seen_at,
        last_seen_at: scannedAt,
      }
      replacements.set(canonical.file_id, canonical)
      for (const file of group.filter((item) => item.file_id !== canonical.file_id)) {
        scanCodes.add('duplicate_media_or_sidecar')
        replacements.set(file.file_id, DriveDiscoveryFileV1Schema.parse({ ...file, status: 'duplicate', safe_code: 'duplicate_content', duplicate_of_file_id: canonical.file_id }))
      }
    }
    const deduplicated = observations.map((file) => replacements.get(file.file_id) ?? file)
    const currentContentHashes = new Set(stableByHash.keys())
    const currentKnownEntries = [...currentContentHashes].sort().map((contentHash) => [contentHash, knownContent[contentHash]!] as const)
    const historicalKnownEntries = Object.entries(knownContent)
      .filter(([contentHash]) => !currentContentHashes.has(contentHash))
      .sort((left, right) => Date.parse(right[1].last_seen_at) - Date.parse(left[1].last_seen_at) || left[0].localeCompare(right[0], 'en-GB'))
      .slice(0, Math.max(0, 5_000 - currentKnownEntries.length))
    const boundedKnownContent: Record<string, DriveDiscoveryKnownContentV1> = Object.fromEntries([...currentKnownEntries, ...historicalKnownEntries])

    const built = buildCandidates(deduplicated, previousCandidates, currentInboxFingerprint)
    built.safeCodes.forEach((code) => scanCodes.add(code))
    if (deduplicated.some((file) => file.status === 'partial')) scanCodes.add('files_awaiting_stability')
    if (deduplicated.some((file) => file.status === 'unsupported')) scanCodes.add('unsupported_files_present')
    const hasPermissionFailure = deduplicated.some((file) => file.status === 'permission_denied')
    const status: DriveDiscoveryHealthStatusV1 = hasPermissionFailure ? 'permission_denied' : walk.limited ? 'scan_limited' : 'ready'
    snapshot = DriveDiscoveryScanSnapshotV1Schema.parse({
      schema_version: 1,
      scan_sequence: (previous.scan?.scan_sequence ?? 0) + 1,
      scanned_at: scannedAt,
      inbox_fingerprint: currentInboxFingerprint,
      settings: snapshotSettings(settings),
      health: healthForScan({ status, safeCodes: [...scanCodes], files: deduplicated, candidates: built.candidates, reviews: previous.reviews }),
      files: deduplicated,
      candidates: built.candidates,
      known_content: boundedKnownContent,
    })
  }
  return persistScanSnapshot(snapshot, previous, options)
}

export async function scanDriveInbox(options: DriveDiscoveryScanOptions = {}): Promise<DriveDiscoveryStateV1> {
  return withDiscoveryLock(options.runtimeRoot, () => scanWithinLock(options))
}

export interface DriveInboxRebindProposal {
  schema_version: 1
  previous_inbox_fingerprint: string
  next_inbox_fingerprint: string
  confirmation_prefix: string
}

async function resolveInboxRebindProposal(options: DriveDiscoveryScanOptions): Promise<DriveInboxRebindProposal> {
  const paths = studioPaths()
  const inboxPath = options.inboxPath === undefined ? paths.mediaInbox : options.inboxPath
  const driveRoot = options.driveRoot === undefined ? paths.driveRoot : options.driveRoot
  const archiveRoot = options.archiveRoot === undefined ? paths.archiveRoot : options.archiveRoot
  if (!inboxPath || !driveRoot) throw new Error('Drive root and Inbox must be configured before rebinding')
  if (await inboxOverlapsArchive(inboxPath, archiveRoot)) throw new Error('Drive Inbox and Archive must not overlap')
  if (await configuredInboxBoundary(driveRoot, inboxPath) !== 'valid') throw new Error('Drive Inbox must be reachable inside the configured Drive root before rebinding')
  const events = await readEvents(options.runtimeRoot, true)
  reduceEvents(events)
  const previousFingerprint = trustedInboxFingerprintFromEvents(events)
  if (!previousFingerprint) throw new Error('Drive discovery has no established Inbox identity; run a normal scan instead')
  const nextFingerprint = await resolvedInboxFingerprint(inboxPath)
  if (nextFingerprint === previousFingerprint) throw new Error('configured Drive Inbox already matches the trusted identity')
  return {
    schema_version: 1,
    previous_inbox_fingerprint: previousFingerprint,
    next_inbox_fingerprint: nextFingerprint,
    confirmation_prefix: `codex-user-confirmation:inbox-rebind:${previousFingerprint}:${nextFingerprint}:`,
  }
}

export async function driveInboxRebindProposal(options: DriveDiscoveryScanOptions = {}): Promise<DriveInboxRebindProposal> {
  return withDiscoveryLock(options.runtimeRoot, () => resolveInboxRebindProposal(options))
}

export async function rebindDriveInbox(input: { confirmation_ref: string }, options: DriveDiscoveryScanOptions = {}): Promise<{ rebind: DriveInboxRebindV1; state: DriveDiscoveryStateV1 }> {
  return withDiscoveryLock(options.runtimeRoot, async () => {
    const proposal = await resolveInboxRebindProposal(options)
    const existingState = reduceEvents(await readEvents(options.runtimeRoot, true))
    const requestedRebindTime = options.now?.() ?? new Date()
    const reboundAt = new Date(Math.max(requestedRebindTime.getTime(), existingState.scan ? Date.parse(existingState.scan.scanned_at) : Number.NEGATIVE_INFINITY)).toISOString()
    const rebind = DriveInboxRebindV1Schema.parse({
      schema_version: 1,
      previous_inbox_fingerprint: proposal.previous_inbox_fingerprint,
      next_inbox_fingerprint: proposal.next_inbox_fingerprint,
      confirmed_by: 'Krish',
      confirmation_ref: input.confirmation_ref,
      rebound_at: reboundAt,
    })
    await persistEvent({
      schema_version: 1,
      event_id: randomUUID(),
      type: 'inbox_rebound',
      occurred_at: reboundAt,
      previous_event_hash: existingState.latest_event_hash,
      rebind,
    }, options.runtimeRoot)
    return { rebind, state: await scanWithinLock({ ...options, recordUnchanged: false }) }
  })
}

async function revalidateCandidateComponents(candidate: DriveIntakeCandidateV1, inboxPath: string): Promise<Map<string, string>> {
  const actualInbox = await realpath(resolve(inboxPath))
  const resolvedComponents = new Map<string, string>()
  for (const component of candidate.components) {
    const configuredPath = resolve(inboxPath, ...component.relative_path.split('/'))
    if (!pathIsInside(resolve(inboxPath), configuredPath)) throw new Error('Drive intake component escaped the configured Inbox')
    const actualPath = await realpath(configuredPath)
    if (!pathIsInside(actualInbox, actualPath)) throw new Error('Drive intake component resolves outside the configured Inbox')
    const before = await stat(actualPath)
    if (!before.isFile()) throw new Error('Drive intake component is no longer a regular file')
    const beforeIdentity = filesystemIdentityHash(before)
    const contentHash = await hashFile(actualPath)
    const after = await stat(actualPath)
    if (filesystemIdentityHash(after) !== beforeIdentity || contentHash !== component.content_hash) {
      throw new Error('Drive intake component changed after discovery and must be scanned again')
    }
    resolvedComponents.set(component.file_id, actualPath)
  }
  return resolvedComponents
}

function latestScanEventHash(events: DriveDiscoveryEventV1[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === 'scan_completed') return events[index]!.event_hash
  }
  return null
}

export async function reviewDriveIntakeCandidate(input: DriveDiscoveryReviewInput, options: DriveDiscoveryScanOptions = {}): Promise<DriveDiscoveryStateV1> {
  return withDiscoveryLock(options.runtimeRoot, async () => {
    const paths = studioPaths()
    const inboxPath = options.inboxPath === undefined ? paths.mediaInbox : options.inboxPath
    if (!inboxPath) throw new Error('MINDMAKE_MEDIA_INBOX is not configured')
    await scanWithinLock({ ...options, recordUnchanged: false })
    let events = await readEvents(options.runtimeRoot, true)
    let state = reduceEvents(events)
    if (state.scan?.health.status !== 'ready') throw new Error('Drive intake cannot be reviewed while Inbox discovery is unavailable or incomplete')
    let candidate = state.scan?.candidates.find((item) => item.candidate_id === input.candidate_id)
    if (!candidate) throw new Error('Drive intake candidate does not exist in the latest discovery scan')
    if (candidate.candidate_hash !== input.candidate_hash) throw new Error('Drive intake review is stale against the latest candidate hash')
    if (candidate.inbox_fingerprint !== state.scan.inbox_fingerprint) throw new Error('Drive intake candidate belongs to a different Inbox')
    if (candidate.availability !== 'available') throw new Error('missing Drive intake media cannot be reviewed')
    if (input.decision === 'accepted' && candidate.classification !== 'ready_for_review') throw new Error('attention or duplicate intake candidates cannot be accepted without first resolving their safe codes')
    const existing = state.reviews[candidate.candidate_id]
    if (existing
      && existing.candidate_hash === candidate.candidate_hash
      && existing.decision === input.decision
      && existing.note === input.note.trim()
      && existing.confirmation_ref === input.confirmation_ref.trim()) {
      try { await revalidateCandidateComponents(candidate, inboxPath) }
      catch (error) {
        await scanWithinLock({ ...options, forceContentHash: true, recordUnchanged: false })
        throw error
      }
      return state
    }

    await scanWithinLock({ ...options, recordUnchanged: true })
    events = await readEvents(options.runtimeRoot, true)
    state = reduceEvents(events)
    if (state.scan?.health.status !== 'ready') throw new Error('Drive intake cannot be reviewed while Inbox discovery is unavailable or incomplete')
    candidate = state.scan.candidates.find((item) => item.candidate_id === input.candidate_id)
    if (!candidate || candidate.candidate_hash !== input.candidate_hash || candidate.inbox_fingerprint !== state.scan.inbox_fingerprint || candidate.availability !== 'available') {
      throw new Error('Drive intake review became stale before its fresh review scan')
    }
    if (input.decision === 'accepted' && candidate.classification !== 'ready_for_review') throw new Error('attention or duplicate intake candidates cannot be accepted without first resolving their safe codes')
    try { await revalidateCandidateComponents(candidate, inboxPath) }
    catch (error) {
      await scanWithinLock({ ...options, forceContentHash: true, recordUnchanged: false })
      throw error
    }
    const discoveryEventHash = latestScanEventHash(events)
    if (!discoveryEventHash) throw new Error('Drive intake review has no current scan event')
    const requestedReviewTime = options.now?.() ?? new Date()
    const reviewedAt = new Date(Math.max(requestedReviewTime.getTime(), Date.parse(state.scan.scanned_at))).toISOString()
    const review = DriveIntakeReviewV1Schema.parse({
      schema_version: 1,
      review_id: randomUUID(),
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.candidate_hash,
      inbox_fingerprint: state.scan.inbox_fingerprint,
      scan_sequence: state.scan.scan_sequence,
      discovery_event_hash: discoveryEventHash,
      verification_hash: reviewVerificationHash(candidate),
      decision: input.decision,
      note: input.note,
      reviewed_by: 'Krish',
      confirmation_ref: input.confirmation_ref,
      reviewed_at: reviewedAt,
    })
    const eventBase = { schema_version: 1 as const, event_id: randomUUID(), type: 'review_recorded' as const, occurred_at: reviewedAt, previous_event_hash: state.latest_event_hash, review }
    return persistEvent(eventBase, options.runtimeRoot)
  })
}

export async function createDriveSourceBundleDraft(input: {
  candidate_id: string
  candidate_hash: string
  rights: 'owned' | 'permissioned'
  consent_ref?: string
}, options: DriveDiscoveryScanOptions = {}): Promise<SourceBundleV1> {
  return withDiscoveryLock(options.runtimeRoot, async () => {
    const paths = studioPaths()
    const inboxPath = options.inboxPath === undefined ? paths.mediaInbox : options.inboxPath
    if (!inboxPath) throw new Error('MINDMAKE_MEDIA_INBOX is not configured')
    await scanWithinLock({ ...options, recordUnchanged: false })
    const state = reduceEvents(await readEvents(options.runtimeRoot, true))
    if (state.scan?.health.status !== 'ready') throw new Error('a SourceBundle draft requires a current healthy Inbox scan')
    const candidate = state.scan.candidates.find((item) => item.candidate_id === input.candidate_id)
    if (!candidate || candidate.candidate_hash !== input.candidate_hash) throw new Error('SourceBundle request is stale against the latest Drive intake candidate')
    if (candidate.classification !== 'ready_for_review' || candidate.availability !== 'available' || candidate.omitted_component_count !== 0) {
      throw new Error('only a complete ready Drive intake candidate can become a SourceBundle draft')
    }
    if (candidate.sequence_kind !== 'standalone') throw new Error('DJI split recordings require an explicitly authored concat or multi-source bundle')
    const review = state.reviews[candidate.candidate_id]
    if (!review || review.candidate_hash !== candidate.candidate_hash || review.decision !== 'accepted') throw new Error('Drive intake candidate requires exact-hash acceptance before SourceBundle drafting')
    let pathsByFileId: Map<string, string>
    try { pathsByFileId = await revalidateCandidateComponents(candidate, inboxPath) }
    catch (error) {
      await scanWithinLock({ ...options, forceContentHash: true, recordUnchanged: false })
      throw error
    }
    const videos = candidate.components.filter((component) => component.kind === 'video')
    const audio = candidate.components.filter((component) => component.kind === 'audio')
    const sidecars = candidate.components.filter((component) => ['caption_sidecar', 'edit_sidecar'].includes(component.kind))
    if (videos.length !== 1 || audio.length > 1) throw new Error('automatic SourceBundle drafting supports one primary video and at most one exact-stem audio source')
    const primary = videos[0]!
    const primarySourceId = 'camera-main'
    const sources: SourceBundleV1['sources'] = [{
      source_id: primarySourceId,
      kind: 'video',
      role: 'primary_camera',
      ref: pathsByFileId.get(primary.file_id)!,
      content_hash: primary.content_hash,
      rights: input.rights,
      ...(input.consent_ref?.trim() ? { consent_ref: input.consent_ref.trim() } : {}),
      sync: { strategy: 'already_mixed', offset_ms: 0 },
      include_in_edit: true,
    }]
    if (audio[0]) {
      sources.push({
        source_id: 'audio-isolated',
        kind: 'audio',
        role: 'isolated_audio',
        ref: pathsByFileId.get(audio[0].file_id)!,
        content_hash: audio[0].content_hash,
        rights: input.rights,
        ...(input.consent_ref?.trim() ? { consent_ref: input.consent_ref.trim() } : {}),
        sync: { strategy: 'audio_waveform', offset_ms: 0, reference_source_id: primarySourceId },
        include_in_edit: true,
      })
    }
    const typedSidecars: NonNullable<SourceBundleV1['sidecars']> = sidecars.map((component, index) => ({
      sidecar_id: `${component.kind === 'caption_sidecar' ? 'captions' : 'edit'}-${index + 1}`,
      source_id: primarySourceId,
      kind: component.kind === 'caption_sidecar' ? 'captions' : 'edit_decisions',
      format: parse(component.relative_path).ext.slice(1).toLowerCase() as 'srt' | 'vtt' | 'edl' | 'fcpxml',
      ref: pathsByFileId.get(component.file_id)!,
      content_hash: component.content_hash,
    }))
    return SourceBundleV1Schema.parse({
      schema_version: 1,
      bundle_id: `intake-${candidate.candidate_id.slice('intake_'.length)}`,
      primary_source_id: primarySourceId,
      sources,
      ...(typedSidecars.length ? { sidecars: typedSidecars } : {}),
      intake_provenance: {
        candidate_id: candidate.candidate_id,
        candidate_hash: candidate.candidate_hash,
        review_id: review.review_id,
        review_hash: hashValue(review),
        inbox_fingerprint: candidate.inbox_fingerprint,
        discovery_event_hash: review.discovery_event_hash,
        media_hashes: candidate.components.filter((component) => ['video', 'audio'].includes(component.kind)).map((component) => component.content_hash),
        sidecar_hashes: candidate.components.filter((component) => ['caption_sidecar', 'edit_sidecar'].includes(component.kind)).map((component) => component.content_hash),
        verified_at: (options.now?.() ?? new Date()).toISOString(),
      },
    })
  })
}

function sortedHashes(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right, 'en-GB'))
}

function assertSameHashes(label: string, declared: string[], authoritative: string[]): void {
  if (JSON.stringify(sortedHashes(declared)) !== JSON.stringify(sortedHashes(authoritative))) {
    throw new Error(`Drive intake provenance ${label} do not match the authoritative discovery ledger`)
  }
}

export function assertPortableDriveIntakeProof(bundleInput: SourceBundleV1, proofInput: DriveIntakeProofV1): DriveIntakeProofV1 {
  const bundle = SourceBundleV1Schema.parse(bundleInput)
  const provenance = bundle.intake_provenance
  if (!provenance) throw new Error('a portable Drive intake proof requires source-bundle intake provenance')
  const proof = DriveIntakeProofV1Schema.parse(proofInput)
  const reviewEvent = proof.review_event
  const candidate = proof.candidate
  const { candidate_hash: _candidateHash, ...candidateBody } = candidate
  if (candidate.candidate_hash !== hashValue(driveIntakeCandidateHashInputV1(candidateBody)) || candidate.candidate_id !== provenance.candidate_id || candidate.candidate_hash !== provenance.candidate_hash || candidate.availability !== 'available' || candidate.classification !== 'ready_for_review') {
    throw new Error('Drive intake provenance does not reference an authoritative ready candidate')
  }
  if (reviewEvent.type !== 'review_recorded' || reviewEvent.event_hash !== hashValue(driveDiscoveryEventHashInputV1(eventWithoutHash(reviewEvent))) || reviewEvent.review.review_id !== provenance.review_id || reviewEvent.review.decision !== 'accepted') {
    throw new Error('Drive intake provenance does not reference an authoritative accepted review')
  }
  if (reviewEvent.previous_event_hash !== proof.scan_attestation.discovery_event_hash) {
    throw new Error('Drive intake proof review does not immediately follow its attested discovery scan')
  }
  const review = reviewEvent.review
  if (
    hashValue(review) !== provenance.review_hash
    || review.candidate_id !== candidate.candidate_id
    || review.candidate_hash !== candidate.candidate_hash
    || review.inbox_fingerprint !== provenance.inbox_fingerprint
    || review.inbox_fingerprint !== candidate.inbox_fingerprint
    || review.discovery_event_hash !== proof.scan_attestation.discovery_event_hash
    || review.scan_sequence !== proof.scan_attestation.scan_sequence
    || proof.scan_attestation.inbox_fingerprint !== candidate.inbox_fingerprint
    || review.verification_hash !== reviewVerificationHash(candidate)
    || Date.parse(provenance.verified_at) < Date.parse(review.reviewed_at)
  ) {
    throw new Error('Drive intake provenance review lineage does not match the authoritative discovery ledger')
  }

  const visualHashes = candidate.components.filter((component) => component.kind === 'video').map((component) => component.content_hash)
  const audioHashes = candidate.components.filter((component) => component.kind === 'audio').map((component) => component.content_hash)
  const captionHashes = candidate.components.filter((component) => component.kind === 'caption_sidecar').map((component) => component.content_hash)
  const editHashes = candidate.components.filter((component) => component.kind === 'edit_sidecar').map((component) => component.content_hash)
  for (const component of candidate.components) {
    const file = proof.component_files.find((item) => item.file_id === component.file_id)
    if (!file || !['stable', 'duplicate'].includes(file.status) || file.relative_path !== component.relative_path || file.kind !== component.kind || file.content_hash !== component.content_hash) {
      throw new Error('Drive intake proof component does not match the accepted candidate')
    }
  }
  assertSameHashes('visual hashes', bundle.sources.filter((source) => source.kind !== 'audio').map((source) => source.content_hash!), visualHashes)
  assertSameHashes('audio hashes', bundle.sources.filter((source) => source.kind === 'audio').map((source) => source.content_hash!), audioHashes)
  assertSameHashes('caption hashes', (bundle.sidecars ?? []).filter((sidecar) => sidecar.kind === 'captions').map((sidecar) => sidecar.content_hash), captionHashes)
  assertSameHashes('edit-decision hashes', (bundle.sidecars ?? []).filter((sidecar) => sidecar.kind === 'edit_decisions').map((sidecar) => sidecar.content_hash), editHashes)
  return proof
}

export async function assertDriveSourceBundleProvenance(bundleInput: SourceBundleV1, runtimeRoot?: string): Promise<DriveIntakeProofV1 | undefined> {
  const bundle = SourceBundleV1Schema.parse(bundleInput)
  const provenance = bundle.intake_provenance
  if (!provenance) return undefined

  const events = await readEvents(runtimeRoot)
  const state = reduceEvents(events)
  const latestReview = state.reviews[provenance.candidate_id]
  if (!latestReview || latestReview.review_id !== provenance.review_id || latestReview.decision !== 'accepted' || latestReview.candidate_hash !== provenance.candidate_hash) {
    throw new Error('Drive intake provenance is no longer the latest accepted review for this candidate')
  }
  const scanEvent = events.find((event) => event.type === 'scan_completed' && event.event_hash === provenance.discovery_event_hash)
  const reviewEvent = events.find((event) => event.type === 'review_recorded' && event.review.review_id === provenance.review_id)
  if (!scanEvent || !reviewEvent) throw new Error('Drive intake provenance events are missing from the authoritative discovery ledger')
  return assertPortableDriveIntakeProof(bundle, DriveIntakeProofV1Schema.parse({
    schema_version: 1,
    candidate: scanEvent.type === 'scan_completed'
      ? scanEvent.scan.candidates.find((candidate) => candidate.candidate_id === provenance.candidate_id && candidate.candidate_hash === provenance.candidate_hash)
      : undefined,
    component_files: scanEvent.type === 'scan_completed'
      ? scanEvent.scan.files.filter((file) => scanEvent.scan.candidates.find((candidate) => candidate.candidate_id === provenance.candidate_id && candidate.candidate_hash === provenance.candidate_hash)?.components.some((component) => component.file_id === file.file_id))
      : [],
    scan_attestation: scanEvent.type === 'scan_completed' ? {
      discovery_event_hash: scanEvent.event_hash,
      scan_sequence: scanEvent.scan.scan_sequence,
      scanned_at: scanEvent.scan.scanned_at,
      inbox_fingerprint: scanEvent.scan.inbox_fingerprint,
      health_status: scanEvent.scan.health.status,
      health_hash: hashValue(scanEvent.scan.health),
      configuration_hash: scanEvent.scan.settings.configuration_hash,
      software_commit: scanEvent.scan.settings.software_commit,
    } : undefined,
    review_event: reviewEvent,
    captured_at: new Date(Math.max(Date.parse(provenance.verified_at), Date.parse(reviewEvent.occurred_at))).toISOString(),
  }))
}

export function sanitizedDriveDiscoverySummary(state: DriveDiscoveryStateV1): SanitizedDriveDiscoverySummary {
  const health = state.scan?.health
  const reviewedCandidates = (state.scan?.candidates ?? []).filter((candidate) => {
    const review = state.reviews[candidate.candidate_id]
    return review?.candidate_hash === candidate.candidate_hash
  }).length
  return {
    schema_version: 1,
    scan_sequence: state.scan?.scan_sequence ?? null,
    scanned_at: state.scan?.scanned_at ?? null,
    status: health?.status ?? 'not_scanned',
    drive_state: health?.drive_state ?? (studioPaths().mediaInbox ? 'unavailable' : 'not_configured'),
    safe_codes: health?.safe_codes ?? ['discovery_not_scanned'],
    counts: {
      files_seen: health?.files_seen ?? 0,
      partial_files: health?.partial_files ?? 0,
      stable_files: health?.stable_files ?? 0,
      unsupported_files: health?.unsupported_files ?? 0,
      duplicate_files: health?.duplicate_files ?? 0,
      ready_candidates: health?.ready_candidates ?? 0,
      attention_candidates: health?.attention_candidates ?? 0,
      reviewed_candidates: reviewedCandidates,
    },
  }
}

export async function driveDiscoveryStatus(runtimeRoot?: string): Promise<SanitizedDriveDiscoverySummary> {
  return sanitizedDriveDiscoverySummary(await loadDriveDiscoveryState(runtimeRoot))
}

export async function driveIntakeCandidateDetail(candidateId: string, runtimeRoot?: string, candidateHash?: string): Promise<{ candidate: DriveIntakeCandidateV1; files: DriveDiscoveryFileV1[]; review: DriveIntakeReviewV1 | null }> {
  if (!/^intake_[a-f0-9]{24}$/.test(candidateId)) throw new Error('Drive intake candidate ID is invalid')
  if (candidateHash !== undefined && !/^[a-f0-9]{64}$/.test(candidateHash)) throw new Error('Drive intake candidate hash is invalid')
  const state = await loadDriveDiscoveryState(runtimeRoot)
  let candidate = state.scan?.candidates.find((item) => item.candidate_id === candidateId && (!candidateHash || item.candidate_hash === candidateHash))
  if (!candidate && candidateHash) {
    const artifactPath = join(discoveryPaths(runtimeRoot).candidates, `${candidateHash}.json`)
    candidate = DriveIntakeCandidateV1Schema.parse(JSON.parse(await readFile(artifactPath, 'utf8')))
    if (candidate.candidate_id !== candidateId || candidate.candidate_hash !== candidateHash) throw new Error('content-addressed Drive intake candidate identity does not match the request')
    const { candidate_hash: _candidateHash, ...candidateBody } = candidate
    if (hashValue(driveIntakeCandidateHashInputV1(candidateBody)) !== candidate.candidate_hash) throw new Error('content-addressed Drive intake candidate hash no longer matches its content')
  }
  if (!candidate) throw new Error('Drive intake candidate was not found')
  const ids = new Set([...candidate.media_file_ids, ...candidate.sidecar_file_ids])
  const files = (state.scan?.files ?? []).filter((file) => ids.has(file.file_id))
  const review = state.reviews[candidate.candidate_id]
  return { candidate, files, review: review?.candidate_hash === candidate.candidate_hash ? review : null }
}

export async function initializeDriveInbox(input: { inboxPath?: string | null; driveRoot?: string | null; archiveRoot?: string | null } = {}): Promise<{ created: boolean; inbox_fingerprint: string }> {
  const paths = studioPaths()
  const inbox = input.inboxPath === undefined ? paths.mediaInbox : input.inboxPath
  const driveRoot = input.driveRoot === undefined ? paths.driveRoot : input.driveRoot
  const archiveRoot = input.archiveRoot === undefined ? paths.archiveRoot : input.archiveRoot
  if (!inbox) throw new Error('MINDMAKE_MEDIA_INBOX is not configured')
  if (!driveRoot) throw new Error('MINDMAKE_DRIVE_ROOT is not configured')
  const resolvedRoot = resolve(driveRoot)
  const resolvedInbox = resolve(inbox)
  if (!pathIsInside(resolvedRoot, resolvedInbox)) throw new Error('Drive inbox must be a dedicated folder inside the configured Drive root')
  if (archiveRoot && pathsOverlap(resolvedInbox, archiveRoot)) throw new Error('Drive Inbox and Archive must be separate, non-overlapping folders')
  await access(resolvedRoot)
  let created = false
  try { await access(resolvedInbox) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await mkdir(resolvedInbox, { recursive: false })
    created = true
  }
  const inboxInfo = await stat(resolvedInbox)
  if (!inboxInfo.isDirectory()) throw new Error('configured Drive inbox is not a directory')
  const [actualRoot, actualInbox] = await Promise.all([realpath(resolvedRoot), realpath(resolvedInbox)])
  if (!pathIsInside(actualRoot, actualInbox)) throw new Error('configured Drive inbox resolves outside the Drive root')
  if (await inboxOverlapsArchive(actualInbox, archiveRoot)) throw new Error('Drive Inbox and Archive resolve to overlapping folders')
  return { created, inbox_fingerprint: await resolvedInboxFingerprint(resolvedInbox) }
}
