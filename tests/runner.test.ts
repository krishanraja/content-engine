import { createHmac } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { RunnerCommandEnvelopeV1Schema, type RunnerCommandEnvelopeV1, type RunnerHeartbeatV1, type RunnerReceiptV1 } from '@mindmake/contracts'
import { acquireRunnerLock, DEFAULT_CONTROL_PLANE_URL, hashValue, inspectRunnerSourceProvenance, loadOrCreateRunnerIdentity, resolveProductionControlPlaneUrl, runRunnerCycle, signRunnerReceipt, type RunnerControlPlane } from '@mindmake/core'

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
  return { status: 'succeeded' as const, result_revision_hash: 'd'.repeat(64), result_artifact_hash: 'e'.repeat(64), hard_gates: hardGates }
}

describe('Codex-independent runner', () => {
  let runtimeRoot = ''

  afterEach(async () => {
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

  it('enforces one local runner process and releases the singleton lock cleanly', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-lock-'))
    const first = await acquireRunnerLock(runtimeRoot)
    await expect(acquireRunnerLock(runtimeRoot)).rejects.toThrow('already active')
    await first.release()
    const next = await acquireRunnerLock(runtimeRoot)
    await next.release()
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
    const [lock, identity] = await Promise.all([acquireRunnerLock(runtimeRoot), loadOrCreateRunnerIdentity(runtimeRoot)])
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
    const identities = await Promise.all(Array.from({ length: 12 }, () => loadOrCreateRunnerIdentity(runtimeRoot)))
    expect(new Set(identities.map((identity) => identity.runner_id)).size).toBe(1)
    expect(JSON.parse(await readFile(join(runtimeRoot, 'runner', 'identity.json'), 'utf8'))).toEqual(identities[0])
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
