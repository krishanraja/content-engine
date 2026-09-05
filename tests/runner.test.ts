import { createHmac } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { RunnerCommandEnvelopeV1Schema, type RunnerCommandEnvelopeV1, type RunnerHeartbeatV1, type RunnerReceiptV1 } from '@mindmake/contracts'
import { acquireRunnerLock, DEFAULT_CONTROL_PLANE_URL, hashValue, inspectRunnerSourceProvenance, inspectWindowsProcessInstance, loadOrCreateRunnerIdentity, persistClaimedCommandJournal, resetRunnerReceiptSigningKeyProviderForTests, resolveProductionControlPlaneUrl, runnerStatus, runRunnerCycle, setRunnerReceiptSigningKeyProviderForTests, signRunnerReceipt, withAuthenticatedRunnerAuthority, withDurableFileLock, type RunnerControlPlane } from '@mindmake/core'

const SIGNING_KEY = Buffer.from('unit-test-runner-signing-material-at-least-32-bytes')
const FIXTURE_PATH = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'control-plane', 'runner-command-prepare-v1.json')
const execFileAsync = promisify(execFile)

const hardGates = {
  truth: { status: 'passed' as const }, rights: { status: 'passed' as const }, confidentiality: { status: 'passed' as const }, transcript_fidelity: { status: 'passed' as const }, naming: { status: 'passed' as const },
}

async function commandFixture(): Promise<RunnerCommandEnvelopeV1> {
  return RunnerCommandEnvelopeV1Schema.parse(JSON.parse(await readFile(FIXTURE_PATH, 'utf8')))
}

function dispatchResult() {
  return { status: 'succeeded' as const, result_revision_hash: 'd'.repeat(64), result_artifact_hash: 'e'.repeat(64), result_refs: { result_source_event_count: 2, result_source_event_chain_hash: 'f'.repeat(64), result_source_revision_hash: 'd'.repeat(64), comparison_alignment: 'unavailable' as const }, hard_gates: hardGates }
}

function legacySucceededReceipt(command: RunnerCommandEnvelopeV1): RunnerReceiptV1 {
  const body = {
    schema_version: 1 as const,
    command_id: command.command_id,
    command_hash: command.command_hash,
    job_id: command.job_id,
    status: 'succeeded' as const,
    result_revision_hash: 'd'.repeat(64),
    result_artifact_hash: 'e'.repeat(64),
    result_refs: { comparison_alignment: 'unavailable' as const },
    hard_gates: hardGates,
    retryable: false as const,
    safe_code: null,
    started_at: '2026-09-04T10:00:00.000Z',
    finished_at: '2026-09-04T10:00:01.000Z',
  }
  const receiptHash = hashValue(body)
  return { ...body, receipt_hash: receiptHash, receipt_signature: createHmac('sha256', SIGNING_KEY).update(receiptHash).digest('hex') } as RunnerReceiptV1
}

function currentSucceededReceipt(command: RunnerCommandEnvelopeV1): RunnerReceiptV1 {
  const result = dispatchResult()
  return signRunnerReceipt({
    schema_version: 1,
    command_id: command.command_id,
    command_hash: command.command_hash,
    job_id: command.job_id,
    status: result.status,
    result_revision_hash: result.result_revision_hash,
    result_artifact_hash: result.result_artifact_hash,
    result_refs: result.result_refs,
    hard_gates: result.hard_gates,
    retryable: false,
    safe_code: null,
    started_at: '2026-09-04T10:00:00.000Z',
    finished_at: '2026-09-04T10:00:01.000Z',
  }, SIGNING_KEY)
}

function signedAuthorityMarker(identity: { schema_version: 2; layout_version: 1; runner_id: string; created_at: string }, state: 'initializing' | 'finalized' = 'initializing') {
  const body = { schema_version: 1, layout_version: 1, state, runner_id: identity.runner_id, identity_hash: hashValue(identity), initialized_at: identity.created_at }
  const markerHash = hashValue(body)
  return { ...body, marker_hash: markerHash, marker_signature: createHmac('sha256', SIGNING_KEY).update(markerHash).digest('hex') }
}

describe('Codex-independent runner', () => {
  let runtimeRoot = ''

  afterEach(async () => {
    resetRunnerReceiptSigningKeyProviderForTests()
    if (runtimeRoot) await rm(runtimeRoot, { recursive: true, force: true })
    runtimeRoot = ''
  })

  it('signs the canonical receipt hash with a distinct HMAC over its lowercase hash', () => {
    const body = {
      schema_version: 1 as const,
      command_id: '11111111-1111-4111-8111-111111111111',
      command_hash: 'a'.repeat(64),
      job_id: 'job-runner-test',
      status: 'succeeded' as const,
      result_revision_hash: 'b'.repeat(64),
      result_artifact_hash: 'c'.repeat(64),
      result_refs: { result_source_event_count: 2, result_source_event_chain_hash: 'd'.repeat(64), result_source_revision_hash: 'b'.repeat(64), comparison_alignment: 'unavailable' as const },
      hard_gates: hardGates,
      retryable: false as const,
      safe_code: null,
      started_at: '2026-09-04T10:00:00.000Z',
      finished_at: '2026-09-04T10:00:01.000Z',
    }
    const receipt = signRunnerReceipt(body, SIGNING_KEY)
    expect(receipt.receipt_hash).toBe(hashValue(body))
    expect(receipt.receipt_signature).toBe(createHmac('sha256', SIGNING_KEY).update(receipt.receipt_hash).digest('hex'))
    expect(JSON.stringify(receipt)).not.toContain(SIGNING_KEY.toString('utf8'))
  })

  it('normalizes the direct Windows process query without starting PowerShell', async () => {
    const commands: string[] = []
    const instance = await inspectWindowsProcessInstance(1234, async (command) => {
      commands.push(command)
      return { stdout: '\r\nCreationDate=20260904222647.599266+060\r\n', stderr: '' }
    })
    expect(commands).toEqual(['wmic.exe'])
    expect(instance).toEqual({
      alive: true,
      instance_id: 'win32:639241540075992660',
      started_at_ms: Date.parse('2026-09-04T21:26:47.599Z'),
    })
  })

  it('keeps one Windows process identity across direct and PowerShell 7 providers', async () => {
    const direct = await inspectWindowsProcessInstance(1234, async () => ({ stdout: '\r\nCreationDate=20260904222647.599266+060\r\n', stderr: '' }))
    const commands: string[] = []
    const fallback = await inspectWindowsProcessInstance(1234, async (command) => {
      commands.push(command)
      if (command === 'wmic.exe') throw Object.assign(new Error('not installed'), { code: 'ENOENT' })
      return { stdout: '639241540075992662', stderr: '' }
    })
    expect(commands).toEqual(['wmic.exe', 'pwsh.exe'])
    expect(fallback).toEqual(direct)
  })

  it('uses legacy Windows PowerShell only when PowerShell 7 is unavailable', async () => {
    const commands: string[] = []
    const instance = await inspectWindowsProcessInstance(1234, async (command) => {
      commands.push(command)
      if (command !== 'powershell.exe') throw Object.assign(new Error('not installed'), { code: 'ENOENT' })
      return { stdout: '639241540075992662', stderr: '' }
    })
    expect(commands).toEqual(['wmic.exe', 'pwsh.exe', 'powershell.exe'])
    expect(instance.instance_id).toBe('win32:639241540075992660')
  })

  it('does not compound a failed PowerShell 7 inspection with a legacy shell retry', async () => {
    const commands: string[] = []
    await expect(inspectWindowsProcessInstance(1234, async (command) => {
      commands.push(command)
      if (command === 'wmic.exe') throw Object.assign(new Error('not installed'), { code: 'ENOENT' })
      throw Object.assign(new Error('process inspection timed out'), { code: 'ETIMEDOUT' })
    })).rejects.toThrow('timed out')
    expect(commands).toEqual(['wmic.exe', 'pwsh.exe'])
  })

  it('rejects an invalid Windows process ID before constructing a process query', async () => {
    let executed = false
    await expect(inspectWindowsProcessInstance(Number.NaN, async () => {
      executed = true
      return { stdout: '', stderr: '' }
    })).rejects.toThrow('process ID is invalid')
    expect(executed).toBe(false)
  })

  it('enforces one local runner process and releases the singleton lock cleanly', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-lock-'))
    const first = await acquireRunnerLock(runtimeRoot)
    await expect(acquireRunnerLock(runtimeRoot)).rejects.toThrow('already active')
    await first.release()
    const next = await acquireRunnerLock(runtimeRoot)
    await next.release()
  })

  it('never owns a durable lock when metadata persistence fails after exclusive open', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-durable-lock-persist-'))
    for (const code of ['EACCES', 'ENOSPC'] as const) {
      const path = join(runtimeRoot, `${code.toLocaleLowerCase('en-GB')}.lock`)
      let callbacks = 0
      await expect(withDurableFileLock(path, async () => { callbacks += 1 }, {
        persistMetadata: async (handle, content) => {
          await handle.writeFile(content, 'utf8')
          throw Object.assign(new Error(`injected ${code}`), { code })
        },
      })).rejects.toMatchObject({ code })
      expect(callbacks).toBe(0)
      await expect(access(path)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(withDurableFileLock(path, async () => 'recovered')).resolves.toBe('recovered')
      await expect(access(path)).rejects.toMatchObject({ code: 'ENOENT' })
    }
  })

  it.runIf(process.platform === 'win32')('keeps a live lock written with prior-revision Windows precision', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-prior-windows-lock-'))
    const runnerLock = join(runtimeRoot, 'runner', 'runner.lock')
    const owned = await acquireRunnerLock(runtimeRoot)
    const current = JSON.parse(await readFile(runnerLock, 'utf8')) as { process_instance_id: string; process_started_at: string }
    await owned.release()

    const normalizedTicks = BigInt(current.process_instance_id.slice('win32:'.length))
    await writeFile(runnerLock, `${JSON.stringify({ schema_version: 2, pid: process.pid, token: 'prior-revision-owner', acquired_at: new Date().toISOString(), process_instance_id: `win32:${normalizedTicks + 2n}`, process_started_at: current.process_started_at })}\n`)
    await expect(acquireRunnerLock(runtimeRoot)).rejects.toThrow('already active')
    await rm(runnerLock, { force: true })
  })

  it('reclaims a crashed lock after PID reuse while failing closed for the genuine process instance', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-pid-reuse-'))
    const runnerDirectory = join(runtimeRoot, 'runner')
    const runnerLock = join(runnerDirectory, 'runner.lock')
    await mkdir(runnerDirectory, { recursive: true })

    // The current PID cannot have owned a lock acquired before this process
    // started. This models a crashed runner whose numeric PID was later reused.
    await writeFile(runnerLock, `${JSON.stringify({ schema_version: 1, pid: process.pid, token: 'crashed-owner', acquired_at: '2000-01-01T00:00:00.000Z' })}\n`)
    const reclaimedLegacy = await acquireRunnerLock(runtimeRoot)
    const current = JSON.parse(await readFile(runnerLock, 'utf8')) as { schema_version: number; process_instance_id: string; process_started_at: string; token: string }
    expect(current).toMatchObject({ schema_version: 2, process_instance_id: expect.any(String), process_started_at: expect.any(String) })
    expect(current.token).not.toBe('crashed-owner')
    await reclaimedLegacy.release()

    // Even a fresh-looking lock is stale when its durable process-instance ID
    // differs from the live process currently holding that numeric PID.
    await writeFile(runnerLock, `${JSON.stringify({ schema_version: 2, pid: process.pid, token: 'reused-pid-owner', acquired_at: new Date().toISOString(), process_instance_id: `${current.process_instance_id}:different`, process_started_at: current.process_started_at })}\n`)
    const reclaimedInstance = await acquireRunnerLock(runtimeRoot)
    await reclaimedInstance.release()

    // A legacy lock acquired after this process started is ambiguous without an
    // instance ID, so singleton safety wins and the runner fails closed.
    await writeFile(runnerLock, `${JSON.stringify({ schema_version: 1, pid: process.pid, token: 'genuine-or-ambiguous-owner', acquired_at: new Date().toISOString() })}\n`)
    await expect(acquireRunnerLock(runtimeRoot)).rejects.toThrow('already active')
    await rm(runnerLock, { force: true })
  })

  it('recovers old incomplete runner and identity locks without deleting fresh ones', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-incomplete-lock-'))
    const runnerDirectory = join(runtimeRoot, 'runner')
    await mkdir(runnerDirectory, { recursive: true })
    const runnerLock = join(runnerDirectory, 'runner.lock')
    const identityLock = join(runnerDirectory, 'identity.json.lock')
    await writeFile(runnerLock, '')
    await writeFile(identityLock, '{"schema_version":1')
    const old = new Date(Date.now() - 5_000)
    await utimes(runnerLock, old, old)
    await utimes(identityLock, old, old)
    const [lock, identity] = await Promise.all([acquireRunnerLock(runtimeRoot), loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)])
    expect(identity.runner_id).toMatch(/^runner-/)
    await lock.release()

    await writeFile(runnerLock, '')
    const freshAttempt = acquireRunnerLock(runtimeRoot).then(async (fresh) => { await fresh.release(); return 'acquired' })
    await expect(Promise.race([
      freshAttempt,
      new Promise((resolve) => setTimeout(() => resolve('still_waiting'), 100)),
    ])).resolves.toBe('still_waiting')
    await rm(runnerLock, { force: true })
    await expect(freshAttempt).resolves.toBe('acquired')

    const owned = await acquireRunnerLock(runtimeRoot)
    const replacement = { schema_version: 1, pid: process.pid, token: 'replacement-owner', acquired_at: new Date().toISOString() }
    await writeFile(runnerLock, `${JSON.stringify(replacement)}\n`)
    await owned.release()
    await expect(readFile(runnerLock, 'utf8')).resolves.toContain('replacement-owner')
    await rm(runnerLock, { force: true })
  })

  it('creates one stable runner identity under concurrent first start', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-identity-'))
    const identities = await Promise.all(Array.from({ length: 12 }, () => loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)))
    expect(new Set(identities.map((identity) => identity.runner_id)).size).toBe(1)
    expect(JSON.parse(await readFile(join(runtimeRoot, 'runner', 'identity.json'), 'utf8'))).toEqual(identities[0])
    const marker = JSON.parse(await readFile(join(runtimeRoot, 'runner-authority.json'), 'utf8')) as Record<string, unknown>
    const { marker_hash: markerHash, marker_signature: markerSignature, ...markerBody } = marker
    expect(marker).toMatchObject({ schema_version: 1, layout_version: 1, state: 'finalized', runner_id: identities[0]!.runner_id, identity_hash: hashValue(identities[0]), initialized_at: identities[0]!.created_at })
    expect(markerHash).toBe(hashValue(markerBody))
    expect(markerSignature).toBe(createHmac('sha256', SIGNING_KEY).update(String(markerHash)).digest('hex'))
    for (const path of ['claims', 'receipts/pending', 'receipts/acknowledged', 'receipts/conflicted', 'project-state']) {
      await expect(access(join(runtimeRoot, 'runner', ...path.split('/')))).resolves.toBeUndefined()
    }
  })

  it('migrates a valid legacy identity into one authenticated complete authority layout', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-identity-migration-'))
    const legacy = { schema_version: 1, runner_id: 'runner-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', created_at: '2026-09-05T09:00:00.000Z' }
    await mkdir(join(runtimeRoot, 'runner'), { recursive: true })
    await writeFile(join(runtimeRoot, 'runner', 'identity.json'), `${JSON.stringify(legacy)}\n`)
    const command = await commandFixture()
    await persistClaimedCommandJournal(command, legacy.runner_id, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const receipt = legacySucceededReceipt(command)
    const acknowledgedPath = join(runtimeRoot, 'runner', 'receipts', 'acknowledged', command.idempotency_key, `${command.command_id}.json`)
    await mkdir(join(acknowledgedPath, '..'), { recursive: true })
    await writeFile(acknowledgedPath, `${JSON.stringify(receipt, null, 2)}\n`)
    const identityBefore = await readFile(join(runtimeRoot, 'runner', 'identity.json'), 'utf8')
    const claimBefore = await readFile(join(runtimeRoot, 'runner', 'claims', `${command.command_id}.json`), 'utf8')
    const receiptBefore = await readFile(acknowledgedPath, 'utf8')
    await expect(loadOrCreateRunnerIdentity(runtimeRoot, Buffer.from('different-authority-signing-key-material-32'))).rejects.toThrow('authentication')
    await expect(access(join(runtimeRoot, 'runner-authority.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(runtimeRoot, 'runner', 'identity.json'), 'utf8')).resolves.toBe(identityBefore)
    await expect(readFile(join(runtimeRoot, 'runner', 'claims', `${command.command_id}.json`), 'utf8')).resolves.toBe(claimBefore)
    await expect(readFile(acknowledgedPath, 'utf8')).resolves.toBe(receiptBefore)
    const priorRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    let migratedStatus: Record<string, unknown> | undefined
    try {
      process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
      setRunnerReceiptSigningKeyProviderForTests(() => SIGNING_KEY.toString('utf8'))
      migratedStatus = await runnerStatus()
    } finally {
      resetRunnerReceiptSigningKeyProviderForTests()
      if (priorRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntimeRoot
    }
    expect(migratedStatus).toMatchObject({ runner_id: legacy.runner_id, pending_receipts: 0 })
    const identity = await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
    expect(identity).toEqual({ ...legacy, schema_version: 2, layout_version: 1 })
    await expect(loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)).resolves.toEqual(identity)
    const identityText = await readFile(join(runtimeRoot, 'runner', 'identity.json'), 'utf8')
    const markerText = await readFile(join(runtimeRoot, 'runner-authority.json'), 'utf8')
    await expect(loadOrCreateRunnerIdentity(runtimeRoot, Buffer.from('different-authority-signing-key-material-32'))).rejects.toThrow('authentication')
    await expect(loadOrCreateRunnerIdentity(runtimeRoot, Buffer.from('too-short'))).rejects.toThrow('unavailable or too short')
    await expect(readFile(join(runtimeRoot, 'runner', 'identity.json'), 'utf8')).resolves.toBe(identityText)
    await expect(readFile(join(runtimeRoot, 'runner-authority.json'), 'utf8')).resolves.toBe(markerText)
  })

  it('authenticates immutable legacy success and failed receipts without rewriting history', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-legacy-receipts-'))
    const identity = await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
    const command = await commandFixture()
    await persistClaimedCommandJournal(command, identity.runner_id, SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    const legacyReceipt = legacySucceededReceipt(command)
    const legacyPath = join(runtimeRoot, 'runner', 'receipts', 'acknowledged', command.idempotency_key, `${command.command_id}.json`)
    await mkdir(join(legacyPath, '..'), { recursive: true })
    await writeFile(legacyPath, `${JSON.stringify(legacyReceipt, null, 2)}\n`)
    const failedIdempotency = '42424242-4242-4242-8242-424242424242'
    const failedReceipt = signRunnerReceipt({
      schema_version: 1,
      command_id: '43434343-4343-4343-8343-434343434343',
      command_hash: '4'.repeat(64),
      job_id: command.job_id,
      status: 'failed',
      result_revision_hash: null,
      result_artifact_hash: null,
      hard_gates: hardGates,
      retryable: false,
      safe_code: 'stale_parent',
      started_at: '2026-09-05T09:00:00.000Z',
      finished_at: '2026-09-05T09:00:01.000Z',
    }, SIGNING_KEY)
    const failedPath = join(runtimeRoot, 'runner', 'receipts', 'acknowledged', failedIdempotency, `${failedReceipt.command_id}.json`)
    await mkdir(join(failedPath, '..'), { recursive: true })
    await writeFile(failedPath, `${JSON.stringify(failedReceipt, null, 2)}\n`)
    const before = await readFile(legacyPath, 'utf8')
    let claims = 0
    const client: RunnerControlPlane = {
      heartbeat: async () => ({}),
      claim: async () => { claims += 1; return null },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    await expect(runRunnerCycle({ client, runnerId: identity.runner_id, softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, dispatch: async () => dispatchResult() })).resolves.toEqual({ state: 'idle' })
    expect(claims).toBe(1)
    await expect(readFile(legacyPath, 'utf8')).resolves.toBe(before)

    const reissued = RunnerCommandEnvelopeV1Schema.parse({ ...command, command_id: '44444444-4444-4444-8444-444444444444' })
    let dispatches = 0
    let completions = 0
    const replayClient: RunnerControlPlane = {
      heartbeat: async () => ({}),
      claim: async () => ({ command: reissued, lease: { token: 'legacy-reissue-token-long-enough-test', expires_at: '2026-09-04T10:10:00.000Z' } }),
      complete: async ({ receipt: submitted }) => { completions += 1; return { duplicate: false, command_id: submitted.command_id, receipt_hash: submitted.receipt_hash, command_status: 'succeeded' } },
    }
    await expect(runRunnerCycle({ client: replayClient, runnerId: identity.runner_id, softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, now: () => new Date('2026-09-04T10:00:00.000Z'), dispatch: async () => { dispatches += 1; return dispatchResult() } })).rejects.toThrow('legacy acknowledged runner receipt cannot be replayed')
    expect({ dispatches, completions }).toEqual({ dispatches: 0, completions: 0 })
  })

  it('quarantines an authenticated legacy pending success before any network or discovery work', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-legacy-pending-'))
    const identity = await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
    const command = await commandFixture()
    await persistClaimedCommandJournal(command, identity.runner_id, SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    const receipt = legacySucceededReceipt(command)
    const pendingPath = join(runtimeRoot, 'runner', 'receipts', 'pending', command.idempotency_key, `${command.command_id}.json`)
    await mkdir(join(pendingPath, '..'), { recursive: true })
    await writeFile(pendingPath, `${JSON.stringify({ schema_version: 1, idempotency_key: command.idempotency_key, runner_id: identity.runner_id, lease_token: 'legacy-lease-token-long-enough-for-test', receipt }, null, 2)}\n`)
    const calls = { complete: 0, heartbeat: 0, project: 0, discovery: 0, claim: 0, dispatch: 0 }
    const client: RunnerControlPlane = {
      complete: async ({ receipt: submitted }) => { calls.complete += 1; return { duplicate: false, command_id: submitted.command_id, receipt_hash: submitted.receipt_hash, command_status: 'succeeded' } },
      heartbeat: async () => { calls.heartbeat += 1; return {} },
      project: async () => { calls.project += 1; throw new Error('legacy pending receipt must stop projection') },
      claim: async () => { calls.claim += 1; return null },
    }
    await expect(runRunnerCycle({ client, runnerId: identity.runner_id, softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, enforceProjectState: true, discoverInbox: async () => { calls.discovery += 1; throw new Error('legacy pending receipt must stop discovery') }, dispatch: async () => { calls.dispatch += 1; return dispatchResult() } })).resolves.toEqual({ state: 'idle' })
    expect(calls).toEqual({ complete: 0, heartbeat: 1, project: 0, discovery: 0, claim: 0, dispatch: 0 })
    await expect(access(pendingPath)).rejects.toMatchObject({ code: 'ENOENT' })
    const conflictPath = join(runtimeRoot, 'runner', 'receipts', 'conflicted', command.idempotency_key, `${command.command_id}.json`)
    await expect(readFile(conflictPath, 'utf8')).resolves.toContain('legacy_receipt_missing_source_cursor')
  })

  it('strictly authenticates every retained claim and acknowledged receipt before network work', async () => {
    const scenarios = ['unexpected_claim', 'renamed_claim', 'tampered_claim', 'unexpected_acknowledged', 'renamed_acknowledged_directory', 'linked_acknowledged_directory', 'renamed_acknowledged_receipt', 'tampered_acknowledged_receipt', 'mismatched_idempotency'] as const
    for (const scenario of scenarios) {
      runtimeRoot = await mkdtemp(join(tmpdir(), `mindmake-runner-retained-${scenario}-`))
      const identity = await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
      const command = await commandFixture()
      await persistClaimedCommandJournal(command, identity.runner_id, SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
      const claimPath = join(runtimeRoot, 'runner', 'claims', `${command.command_id}.json`)
      const acknowledgedRoot = join(runtimeRoot, 'runner', 'receipts', 'acknowledged')
      const acknowledgedDirectory = join(acknowledgedRoot, command.idempotency_key)
      const acknowledgedPath = join(acknowledgedDirectory, `${command.command_id}.json`)
      await mkdir(acknowledgedDirectory, { recursive: true })
      await writeFile(acknowledgedPath, `${JSON.stringify(currentSucceededReceipt(command), null, 2)}\n`)
      if (scenario === 'unexpected_claim') await writeFile(join(runtimeRoot, 'runner', 'claims', 'leftover.tmp'), 'unexpected\n')
      if (scenario === 'renamed_claim') await rename(claimPath, `${claimPath}.old`)
      if (scenario === 'tampered_claim') {
        const claim = JSON.parse(await readFile(claimPath, 'utf8'))
        claim.journal_signature = 'f'.repeat(64)
        await writeFile(claimPath, `${JSON.stringify(claim)}\n`)
      }
      if (scenario === 'unexpected_acknowledged') await writeFile(join(acknowledgedRoot, 'leftover.tmp'), 'unexpected\n')
      if (scenario === 'renamed_acknowledged_directory') await rename(acknowledgedDirectory, `${acknowledgedDirectory}-old`)
      if (scenario === 'linked_acknowledged_directory') {
        const target = join(runtimeRoot, 'acknowledged-target')
        await rename(acknowledgedDirectory, target)
        await symlink(target, acknowledgedDirectory, 'junction')
      }
      if (scenario === 'renamed_acknowledged_receipt') await rename(acknowledgedPath, `${acknowledgedPath}.old`)
      if (scenario === 'tampered_acknowledged_receipt') {
        const receipt = JSON.parse(await readFile(acknowledgedPath, 'utf8'))
        receipt.receipt_signature = 'f'.repeat(64)
        await writeFile(acknowledgedPath, `${JSON.stringify(receipt)}\n`)
      }
      if (scenario === 'mismatched_idempotency') await rename(acknowledgedDirectory, join(acknowledgedRoot, '45454545-4545-4545-8545-454545454545'))
      const calls = { heartbeat: 0, discovery: 0, claim: 0, complete: 0 }
      const client: RunnerControlPlane = {
        heartbeat: async () => { calls.heartbeat += 1; return {} },
        claim: async () => { calls.claim += 1; return null },
        complete: async ({ receipt }) => { calls.complete += 1; return { duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' } },
      }
      await expect(runRunnerCycle({ client, runnerId: identity.runner_id, softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, discoverInbox: async () => { calls.discovery += 1; throw new Error('must not discover') } })).rejects.toThrow()
      expect(calls).toEqual({ heartbeat: 0, discovery: 0, claim: 0, complete: 0 })
      await rm(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  })

  it('resumes every authenticated first-start initialization crash phase without changing identity', async () => {
    for (const phase of ['before_marker', 'marker_staged', 'after_marker', 'partial_layout', 'identity_staged', 'identity_written', 'legacy_identity_retained'] as const) {
      runtimeRoot = await mkdtemp(join(tmpdir(), `mindmake-runner-init-${phase}-`))
      const identity = { schema_version: 2 as const, layout_version: 1 as const, runner_id: 'runner-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', created_at: '2026-09-05T09:00:00.000Z' }
      const markerCommitted = !['before_marker', 'marker_staged'].includes(phase)
      if (phase !== 'before_marker') await mkdir(join(runtimeRoot, 'runner-staging'), { recursive: true })
      if (phase === 'marker_staged') await writeFile(join(runtimeRoot, 'runner-staging', '11111111-1111-4111-8111-111111111111.tmp'), `${JSON.stringify(signedAuthorityMarker(identity))}\n`)
      if (markerCommitted) await writeFile(join(runtimeRoot, 'runner-authority.json'), `${JSON.stringify(signedAuthorityMarker(identity))}\n`)
      if (phase === 'partial_layout') await mkdir(join(runtimeRoot, 'runner', 'claims'), { recursive: true })
      if (phase === 'identity_staged') await writeFile(join(runtimeRoot, 'runner-staging', '22222222-2222-4222-8222-222222222222.tmp'), `${JSON.stringify(identity)}\n`)
      if (phase === 'identity_written') {
        await mkdir(join(runtimeRoot, 'runner'), { recursive: true })
        await writeFile(join(runtimeRoot, 'runner', 'identity.json'), `${JSON.stringify(identity)}\n`)
      }
      if (phase === 'legacy_identity_retained') {
        await mkdir(join(runtimeRoot, 'runner'), { recursive: true })
        await writeFile(join(runtimeRoot, 'runner', 'identity.json'), `${JSON.stringify({ schema_version: 1, runner_id: identity.runner_id, created_at: identity.created_at })}\n`)
      }
      const loaded = await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
      if (['before_marker', 'marker_staged'].includes(phase)) expect(loaded.runner_id).toMatch(/^runner-/)
      else expect(loaded).toEqual(identity)
      await expect(loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)).resolves.toEqual(loaded)
      await expect(readFile(join(runtimeRoot, 'runner-authority.json'), 'utf8')).resolves.toContain('"state": "finalized"')
      await expect(readdir(join(runtimeRoot, 'runner-staging'))).resolves.toEqual([])
      await rm(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  })

  it('fails closed when authenticated authority is hidden, deleted, replaced, or tampered', async () => {
    for (const scenario of ['renamed_root', 'deleted_root', 'root_junction', 'renamed_marker', 'deleted_marker', 'marker_junction', 'renamed_identity', 'deleted_identity', 'tampered_marker'] as const) {
      runtimeRoot = await mkdtemp(join(tmpdir(), `mindmake-runner-authority-${scenario}-`))
      await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
      const runner = join(runtimeRoot, 'runner')
      const marker = join(runtimeRoot, 'runner-authority.json')
      if (scenario === 'renamed_root') await rename(runner, join(runtimeRoot, 'runner-old'))
      if (scenario === 'deleted_root') await rm(runner, { recursive: true, force: true })
      if (scenario === 'root_junction') {
        const target = join(runtimeRoot, 'authority-root-target')
        await rename(runner, target)
        await symlink(target, runner, 'junction')
      }
      if (scenario === 'marker_junction') {
        await rm(marker)
        const target = join(runtimeRoot, 'authority-marker-target')
        await mkdir(target)
        await symlink(target, marker, 'junction')
      }
      if (scenario === 'renamed_marker') await rename(marker, join(runtimeRoot, 'runner-authority.json-old'))
      if (scenario === 'deleted_marker') await rm(marker)
      if (scenario === 'renamed_identity') await rename(join(runner, 'identity.json'), join(runner, 'identity-old.json'))
      if (scenario === 'deleted_identity') await rm(join(runner, 'identity.json'))
      if (scenario === 'tampered_marker') {
        const value = JSON.parse(await readFile(marker, 'utf8'))
        value.initialized_at = '2026-09-05T10:00:00.000Z'
        await writeFile(marker, `${JSON.stringify(value)}\n`)
      }
      await expect(loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)).rejects.toThrow()
      if (!['deleted_root', 'renamed_marker', 'deleted_marker'].includes(scenario)) await expect(access(marker)).resolves.toBeUndefined()
      await rm(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  })

  it('revalidates authority after reacquiring the manual-operation gate', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-authority-recheck-'))
    const identity = await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
    const markerPath = join(runtimeRoot, 'runner-authority.json')
    const marker = JSON.parse(await readFile(markerPath, 'utf8'))
    marker.identity_hash = 'f'.repeat(64)
    await writeFile(markerPath, `${JSON.stringify(marker)}\n`)
    let mutations = 0
    await expect(withAuthenticatedRunnerAuthority(runtimeRoot, SIGNING_KEY, identity.runner_id, async () => { mutations += 1 })).rejects.toThrow('authentication')
    expect(mutations).toBe(0)
  })

  it('rejects missing, renamed, or linked authority roots before any runner network or discovery work', async () => {
    const authorityRoots = ['staging', 'claims', 'receipts', 'receipts_pending', 'receipts_acknowledged', 'receipts_conflicted', 'project_state'] as const
    const mutations = ['missing', 'renamed', 'linked'] as const
    for (const rootName of authorityRoots) for (const mutation of mutations) {
      const scenario = `${mutation}_${rootName}`
      runtimeRoot = await mkdtemp(join(tmpdir(), `mindmake-runner-layout-${scenario}-`))
      const identity = await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
      const segments = rootName === 'staging'
        ? ['runner-staging']
        : rootName === 'project_state'
        ? ['project-state']
        : rootName.startsWith('receipts_') ? ['receipts', rootName.slice('receipts_'.length)] : [rootName]
      const authorityPath = rootName === 'staging' ? join(runtimeRoot, ...segments) : join(runtimeRoot, 'runner', ...segments)
      const parent = join(authorityPath, '..')
      const name = segments.at(-1)!
      if (mutation === 'missing') await rm(authorityPath, { recursive: true, force: true })
      if (mutation === 'renamed') await rename(authorityPath, join(parent, `${name}-old`))
      if (mutation === 'linked') {
        await rm(authorityPath, { recursive: true, force: true })
        const target = join(runtimeRoot, `${rootName}-target`)
        await mkdir(target)
        await symlink(target, authorityPath, 'junction')
      }
      const calls = { heartbeat: 0, discovery: 0, claim: 0, complete: 0 }
      const client: RunnerControlPlane = {
        heartbeat: async () => { calls.heartbeat += 1; return {} },
        claim: async () => { calls.claim += 1; return null },
        complete: async ({ receipt }) => { calls.complete += 1; return { duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' } },
      }
      await expect(runRunnerCycle({ client, runnerId: identity.runner_id, softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, discoverInbox: async () => { calls.discovery += 1; throw new Error('must not discover') } })).rejects.toThrow()
      expect(calls).toEqual({ heartbeat: 0, discovery: 0, claim: 0, complete: 0 })
      await rm(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  })

  it('rejects misnamed or linked authority staging residue before any runner network or discovery work', async () => {
    for (const scenario of ['misnamed', 'linked'] as const) {
      runtimeRoot = await mkdtemp(join(tmpdir(), `mindmake-runner-staging-residue-${scenario}-`))
      const identity = await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
      const stagingRoot = join(runtimeRoot, 'runner-staging')
      if (scenario === 'misnamed') await writeFile(join(stagingRoot, 'not-an-authority-uuid.tmp'), 'unexpected\n')
      else {
        const target = join(runtimeRoot, 'staging-residue-target')
        await mkdir(target)
        await symlink(target, join(stagingRoot, '11111111-1111-4111-8111-111111111111.tmp'), 'junction')
      }
      const calls = { heartbeat: 0, discovery: 0, claim: 0, complete: 0 }
      const client: RunnerControlPlane = {
        heartbeat: async () => { calls.heartbeat += 1; return {} },
        claim: async () => { calls.claim += 1; return null },
        complete: async ({ receipt }) => { calls.complete += 1; return { duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' } },
      }
      await expect(runRunnerCycle({
        client,
        runnerId: identity.runner_id,
        softwareCommit: 'a'.repeat(40),
        signingKey: SIGNING_KEY,
        driveState: 'ready',
        runtimeRoot,
        discoverInbox: async () => { calls.discovery += 1; throw new Error('must not discover') },
      })).rejects.toThrow('unexpected entry')
      expect(calls).toEqual({ heartbeat: 0, discovery: 0, claim: 0, complete: 0 })
      await rm(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  })

  it('executes one semantic idempotency key once even when the server issues a new command attempt ID', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-semantic-idempotency-'))
    const first = await commandFixture()
    const second = RunnerCommandEnvelopeV1Schema.parse({ ...first, command_id: '22222222-2222-4222-8222-222222222222' })
    const queue = [first, second]
    let dispatches = 0
    const completed: RunnerReceiptV1[] = []
    const client: RunnerControlPlane = {
      claim: async () => {
        const command = queue.shift()
        return command ? { command, lease: { token: `lease-${command.command_id}-long-enough`, expires_at: '2026-09-04T10:10:00.000Z' } } : null
      },
      heartbeat: async () => ({}),
      complete: async ({ receipt }) => {
        completed.push(receipt)
        return { duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }
      },
    }
    const options = { client, runnerId: 'runner-semantic-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready' as const, now: () => new Date('2026-09-04T10:00:00.000Z'), dispatch: async () => { dispatches += 1; return dispatchResult() }, runtimeRoot }
    await expect(runRunnerCycle(options)).resolves.toMatchObject({ state: 'completed', command_id: first.command_id })
    const claimJournal = JSON.parse(await readFile(join(runtimeRoot, 'runner', 'claims', `${first.command_id}.json`), 'utf8')) as Record<string, unknown>
    expect(claimJournal).toMatchObject({ runner_id: 'runner-semantic-test', command: { command_id: first.command_id, command_hash: first.command_hash } })
    expect(JSON.stringify(claimJournal)).not.toContain('lease-')
    await expect(runRunnerCycle(options)).resolves.toMatchObject({ state: 'completed', command_id: second.command_id })
    expect(dispatches).toBe(1)
    expect(completed.map((receipt) => receipt.command_id)).toEqual([first.command_id, second.command_id])
    expect(completed[0]?.result_artifact_hash).toBe(completed[1]?.result_artifact_hash)
  })

  it('replays a committed completion after its response is lost, even with the prior lease expired', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-replay-'))
    const command = await commandFixture()
    const calls: string[] = []
    const heartbeats: RunnerHeartbeatV1[] = []
    let claimCount = 0
    let committedReceipt: RunnerReceiptV1 | undefined
    const client: RunnerControlPlane = {
      claim: async () => {
        calls.push('claim')
        claimCount += 1
        return claimCount === 1 ? { command, lease: { token: 'old-lease-token-long-enough-for-test', expires_at: '2026-09-04T10:01:00.000Z' } } : null
      },
      heartbeat: async (heartbeat) => { calls.push('heartbeat'); heartbeats.push(heartbeat); return {} },
      complete: async ({ lease_token, receipt }) => {
        calls.push(`complete:${lease_token}`)
        if (!committedReceipt) {
          committedReceipt = receipt
          throw new Error('response lost after commit')
        }
        expect(receipt).toEqual(committedReceipt)
        expect(lease_token).toBe('old-lease-token-long-enough-for-test')
        return { duplicate: true, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' as const }
      },
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-replay-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', now: () => new Date('2026-09-04T10:00:00.000Z'), dispatch: async () => dispatchResult(), runtimeRoot })).rejects.toThrow('response lost')
    const pending = join(runtimeRoot, 'runner', 'receipts', 'pending', command.idempotency_key, `${command.command_id}.json`)
    await expect(access(pending)).resolves.toBeUndefined()

    const beforeSecondCycle = calls.length
    await expect(runRunnerCycle({ client, runnerId: 'runner-replay-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', now: () => new Date('2026-09-04T10:05:00.000Z'), dispatch: async () => dispatchResult(), runtimeRoot })).resolves.toEqual({ state: 'idle' })
    expect(calls.slice(beforeSecondCycle, beforeSecondCycle + 3)).toEqual(['complete:old-lease-token-long-enough-for-test', 'heartbeat', 'claim'])
    expect(heartbeats.at(-1)?.pending_receipts).toBe(0)
    await expect(access(pending)).rejects.toMatchObject({ code: 'ENOENT' })
    const acknowledged = join(runtimeRoot, 'runner', 'receipts', 'acknowledged', command.idempotency_key, `${command.command_id}.json`)
    expect(JSON.parse(await readFile(acknowledged, 'utf8'))).toEqual(committedReceipt)
  })

  it('heartbeats honestly and does not claim media work while Drive is unavailable', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-drive-'))
    let drive: RunnerHeartbeatV1['drive_state'] = 'unavailable'
    let claims = 0
    const heartbeats: RunnerHeartbeatV1[] = []
    const client: RunnerControlPlane = {
      claim: async () => { claims += 1; return null },
      heartbeat: async (heartbeat) => { heartbeats.push(heartbeat); return {} },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    const options = { client, runnerId: 'runner-drive-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: async () => drive, now: () => new Date('2026-09-04T10:00:00.000Z'), runtimeRoot }
    await expect(runRunnerCycle(options)).resolves.toEqual({ state: 'idle' })
    expect(claims).toBe(0)
    expect(heartbeats.at(-1)).toMatchObject({ drive_state: 'unavailable', status: 'degraded' })
    drive = 'ready'
    await expect(runRunnerCycle(options)).resolves.toEqual({ state: 'idle' })
    expect(claims).toBe(1)
    expect(heartbeats.at(-1)).toMatchObject({ drive_state: 'ready', status: 'idle' })
  })

  it('finishes Inbox discovery before claim and pauses claims on degraded discovery', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-discovery-order-'))
    const calls: string[] = []
    let claims = 0
    const client: RunnerControlPlane = {
      claim: async () => { calls.push('claim'); claims += 1; return null },
      heartbeat: async () => { calls.push('heartbeat'); return {} },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    const unavailableDiscovery = {
      schema_version: 1 as const,
      scan_sequence: 4,
      scanned_at: '2026-09-04T10:00:00.000Z',
      status: 'permission_denied' as const,
      drive_state: 'unavailable' as const,
      safe_codes: ['file_permission_denied'],
      counts: { files_seen: 1, partial_files: 0, stable_files: 0, unsupported_files: 0, duplicate_files: 0, ready_candidates: 0, attention_candidates: 0, reviewed_candidates: 0 },
    }
    const result = await runRunnerCycle({
      client,
      runnerId: 'runner-discovery-test',
      softwareCommit: 'a'.repeat(40),
      signingKey: SIGNING_KEY,
      driveState: async () => { calls.push('drive'); return 'ready' },
      discoverInbox: async () => { calls.push('discover'); return unavailableDiscovery },
      now: () => new Date('2026-09-04T10:00:00.000Z'),
      runtimeRoot,
    })
    expect(result).toEqual({ state: 'idle', discovery: unavailableDiscovery })
    expect(calls).toEqual(['drive', 'heartbeat', 'discover', 'heartbeat'])
    expect(claims).toBe(0)

    calls.length = 0
    const readyDiscovery = { ...unavailableDiscovery, status: 'ready' as const, drive_state: 'ready' as const, safe_codes: [], scan_sequence: 5 }
    await runRunnerCycle({
      client,
      runnerId: 'runner-discovery-test',
      softwareCommit: 'a'.repeat(40),
      signingKey: SIGNING_KEY,
      driveState: async () => { calls.push('drive'); return 'ready' },
      discoverInbox: async () => { calls.push('discover'); return readyDiscovery },
      now: () => new Date('2026-09-04T10:00:01.000Z'),
      runtimeRoot,
    })
    expect(calls).toEqual(['drive', 'heartbeat', 'discover', 'drive', 'heartbeat', 'claim'])
    expect(claims).toBe(1)
  })

  it('heartbeats before and during a slow Inbox scan so discovery cannot make the runner appear offline', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-slow-discovery-'))
    const heartbeats: RunnerHeartbeatV1[] = []
    let claims = 0
    const client: RunnerControlPlane = {
      claim: async () => { claims += 1; return null },
      heartbeat: async (value) => { heartbeats.push(value); return {} },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    const result = await runRunnerCycle({
      client,
      runnerId: 'runner-slow-discovery-test',
      softwareCommit: 'a'.repeat(40),
      signingKey: SIGNING_KEY,
      driveState: 'ready',
      heartbeatIntervalMs: 2,
      discoverInbox: async () => {
        await new Promise((resolve) => setTimeout(resolve, 15))
        return {
          schema_version: 1,
          scan_sequence: 2,
          scanned_at: '2026-09-04T10:00:00.000Z',
          status: 'ready',
          drive_state: 'ready',
          safe_codes: [],
          counts: { files_seen: 1, partial_files: 0, stable_files: 1, unsupported_files: 0, duplicate_files: 0, ready_candidates: 1, attention_candidates: 0, reviewed_candidates: 0 },
        }
      },
      runtimeRoot,
    })
    expect(result.state).toBe('idle')
    expect(claims).toBe(1)
    expect(heartbeats[0]).toMatchObject({ status: 'idle', drive_state: 'ready' })
    expect(heartbeats.some((value) => value.status === 'working' && !value.active_command_id)).toBe(true)
  })

  it('lets a transient dispatch lease expire and succeeds when the same command is reclaimed', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-reclaim-'))
    const command = await commandFixture()
    let claims = 0
    let dispatches = 0
    let completions = 0
    const client: RunnerControlPlane = {
      claim: async () => ({ command, lease: { token: `lease-${++claims}-token-long-enough-for-test`, expires_at: '2026-09-04T10:10:00.000Z' } }),
      heartbeat: async () => ({}),
      complete: async ({ receipt }) => { completions += 1; return { duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' } },
    }
    const options = { client, runnerId: 'runner-reclaim-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready' as const, now: () => new Date('2026-09-04T10:00:00.000Z'), dispatch: async () => { dispatches += 1; if (dispatches === 1) throw new Error('provider network unavailable'); return dispatchResult() }, runtimeRoot }
    await expect(runRunnerCycle(options)).rejects.toThrow('provider network unavailable')
    expect(completions).toBe(0)
    await expect(runRunnerCycle(options)).resolves.toMatchObject({ state: 'completed', receipt_status: 'succeeded' })
    expect({ claims, dispatches, completions }).toEqual({ claims: 2, dispatches: 2, completions: 1 })
  })

  it('rechecks Drive during active work and reports mount loss without changing the command result', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-heartbeat-'))
    const command = await commandFixture()
    let claims = 0
    let driveChecks = 0
    const heartbeats: RunnerHeartbeatV1[] = []
    const client: RunnerControlPlane = {
      claim: async () => (++claims === 1 ? { command, lease: { token: 'active-lease-token-long-enough-test', expires_at: '2026-09-04T10:10:00.000Z' } } : null),
      heartbeat: async (heartbeat) => { heartbeats.push(heartbeat); return {} },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    const result = await runRunnerCycle({
      client, runnerId: 'runner-heartbeat-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY,
      driveState: async () => (++driveChecks === 1 ? 'ready' : 'unavailable'),
      heartbeatIntervalMs: 2,
      now: () => new Date('2026-09-04T10:00:00.000Z'),
      dispatch: async () => { await new Promise((resolve) => setTimeout(resolve, 15)); return dispatchResult() },
      runtimeRoot,
    })
    expect(result).toMatchObject({ state: 'completed', receipt_status: 'succeeded' })
    expect(heartbeats.some((heartbeat) => heartbeat.active_command_id === command.command_id && heartbeat.drive_state === 'unavailable' && heartbeat.status === 'degraded')).toBe(true)
  })

  it('closes the mutation fence when lease renewal fails and leaves the command unacknowledged for reclaim', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-fence-'))
    const command = await commandFixture()
    let completions = 0
    let heartbeatCalls = 0
    const client: RunnerControlPlane = {
      claim: async () => ({ command, lease: { token: 'lease-fence-token-long-enough-test', expires_at: '2026-09-04T10:10:00.000Z' } }),
      heartbeat: async (_heartbeat, leaseToken) => {
        heartbeatCalls += 1
        if (leaseToken) throw new Error('lease renewal network failure')
        return {}
      },
      complete: async ({ receipt }) => { completions += 1; return { duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' } },
    }
    await expect(runRunnerCycle({
      client, runnerId: 'runner-fence-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', heartbeatIntervalMs: 2,
      now: () => new Date('2026-09-04T10:00:00.000Z'), runtimeRoot,
      dispatch: async (_command, fence) => { await new Promise((resolve) => setTimeout(resolve, 15)); fence.assertActive(); return dispatchResult() },
    })).rejects.toThrow('lease fence closed')
    expect(heartbeatCalls).toBeGreaterThan(1)
    expect(completions).toBe(0)
    await expect(access(join(runtimeRoot, 'runner', 'receipts', 'pending', command.idempotency_key))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps a receipt pending when the completion acknowledgement does not echo its exact identity', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-ack-fence-'))
    const command = await commandFixture()
    const client: RunnerControlPlane = {
      claim: async () => ({ command, lease: { token: 'lease-ack-token-long-enough-test', expires_at: '2026-09-04T10:10:00.000Z' } }),
      heartbeat: async () => ({}),
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: 'f'.repeat(64), command_status: 'succeeded' }),
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-ack-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', now: () => new Date('2026-09-04T10:00:00.000Z'), dispatch: async () => dispatchResult(), runtimeRoot })).rejects.toThrow('acknowledgement does not match')
    await expect(access(join(runtimeRoot, 'runner', 'receipts', 'pending', command.idempotency_key, `${command.command_id}.json`))).resolves.toBeUndefined()
  })

  it('fails source provenance closed for the wrong root, an override mismatch, or any tracked or untracked change', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-source-'))
    const repository = join(runtimeRoot, 'repo')
    await mkdir(repository)
    await execFileAsync('git', ['init'], { cwd: repository })
    await execFileAsync('git', ['config', 'user.email', 'runner-test@example.invalid'], { cwd: repository })
    await execFileAsync('git', ['config', 'user.name', 'Runner Test'], { cwd: repository })
    await writeFile(join(repository, 'runner.ts'), 'export const clean = true\n')
    await execFileAsync('git', ['add', 'runner.ts'], { cwd: repository })
    await execFileAsync('git', ['commit', '-m', 'fixture'], { cwd: repository })
    const clean = await inspectRunnerSourceProvenance(repository)
    expect(clean).toMatchObject({ status: 'verified', software_commit: expect.stringMatching(/^[a-f0-9]{40}$/) })
    const priorOverride = process.env.MINDMAKE_SOFTWARE_COMMIT
    try {
      process.env.MINDMAKE_SOFTWARE_COMMIT = 'f'.repeat(40)
      await expect(inspectRunnerSourceProvenance(repository)).resolves.toMatchObject({ status: 'unknown', reason: expect.stringContaining('does not equal') })
    } finally {
      if (priorOverride === undefined) delete process.env.MINDMAKE_SOFTWARE_COMMIT
      else process.env.MINDMAKE_SOFTWARE_COMMIT = priorOverride
    }
    await writeFile(join(repository, 'untracked.ts'), 'export const unsafe = true\n')
    await expect(inspectRunnerSourceProvenance(repository)).resolves.toMatchObject({ status: 'unknown', reason: expect.stringContaining('untracked') })
    await rm(join(repository, 'untracked.ts'))
    await writeFile(join(repository, 'runner.ts'), 'export const clean = false\n')
    await expect(inspectRunnerSourceProvenance(repository)).resolves.toMatchObject({ status: 'unknown', reason: expect.stringContaining('tracked') })
    await execFileAsync('git', ['restore', 'runner.ts'], { cwd: repository })
    const nested = join(repository, 'nested')
    await mkdir(nested)
    await expect(inspectRunnerSourceProvenance(nested)).resolves.toMatchObject({ status: 'unknown', reason: expect.stringContaining('does not equal') })
  }, 20_000)

  it('reports an invalid discovery ledger as unavailable even when the mounted folders are reachable', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-invalid-discovery-'))
    const driveRoot = join(runtimeRoot, 'drive')
    const inbox = join(driveRoot, 'Inbox')
    const archive = join(driveRoot, 'Archive')
    await Promise.all([mkdir(inbox, { recursive: true }), mkdir(archive, { recursive: true }), mkdir(join(runtimeRoot, 'discovery'), { recursive: true })])
    await writeFile(join(runtimeRoot, 'discovery', 'events.jsonl'), '{"tampered":true}\n')
    const names = ['MINDMAKE_RUNTIME_ROOT', 'MINDMAKE_DRIVE_ROOT', 'MINDMAKE_MEDIA_INBOX', 'MINDMAKE_ARCHIVE_ROOT'] as const
    const prior = Object.fromEntries(names.map((name) => [name, process.env[name]]))
    try {
      process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
      process.env.MINDMAKE_DRIVE_ROOT = driveRoot
      process.env.MINDMAKE_MEDIA_INBOX = inbox
      process.env.MINDMAKE_ARCHIVE_ROOT = archive
      setRunnerReceiptSigningKeyProviderForTests(() => SIGNING_KEY.toString('utf8'))
      const status = await runnerStatus() as { drive_state: string; discovery: { drive_state: string; safe_codes: string[] } }
      expect(status.drive_state).toBe('unavailable')
      expect(status.discovery).toMatchObject({ drive_state: 'unavailable', safe_codes: ['discovery_state_invalid'] })
    } finally {
      for (const name of names) {
        if (prior[name] === undefined) delete process.env[name]
        else process.env[name] = prior[name]
      }
    }
  })

  it('pins the production Control Center runner origin instead of accepting an environment redirect', () => {
    const prior = process.env.MINDMAKE_CONTROL_PLANE_URL
    try {
      delete process.env.MINDMAKE_CONTROL_PLANE_URL
      expect(resolveProductionControlPlaneUrl()).toBe(DEFAULT_CONTROL_PLANE_URL)
      process.env.MINDMAKE_CONTROL_PLANE_URL = 'https://attacker.example/api/video-studio/runner'
      expect(() => resolveProductionControlPlaneUrl()).toThrow('pinned production')
    } finally {
      if (prior === undefined) delete process.env.MINDMAKE_CONTROL_PLANE_URL
      else process.env.MINDMAKE_CONTROL_PLANE_URL = prior
    }
  })
})
