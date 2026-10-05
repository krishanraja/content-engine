import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, test, vi } from 'vitest'
import { ControlPlaneClient, runRunnerCycle } from '@mindmake/core'
import { ProductionBriefClaimResponseV1Schema, RunnerClaimResponseV1Schema } from '@mindmake/contracts'

// The runner-role fence, from the routes' side. Ruling (Krish, 2026-09-28): a
// second Windows machine is a cold standby with its task disabled. Only the
// active runner is leased new work; every other runner gets the exact empty
// answer it already gets from an empty queue, so the installed runners
// (6bf7862, whose runner, client and contracts are byte-identical to this
// tree's) need no change. The database half is in
// tests/fixtures/control-plane/runner-roles-regression.sql.

const state = vi.hoisted(() => ({
  roles: [] as Array<{ runner_id_hash: string; role: string }>,
  rolesError: null as null | { message: string },
  ideas: [] as Array<Record<string, unknown>>,
  ideaReads: 0,
  roleReads: 0,
  leaseResult: 'leased' as string,
  leaseCalls: [] as Array<Record<string, unknown>>,
  claimRows: [] as unknown[],
  claimCalls: [] as Array<Record<string, unknown>>,
  rpcRefusal: null as null | string,
  roleRpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  ideaUpdates: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  const awaitable = (result: unknown) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'in', 'not', 'order', 'limit', 'maybeSingle']) chain[method] = () => chain
    chain.single = async () => result
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
    return chain
  }
  return {
    supabase: {
      from(table: string) {
        if (table === 'video_studio_runner_roles') {
          state.roleReads += 1
          return awaitable(state.rolesError ? { data: null, error: state.rolesError } : { data: state.roles, error: null })
        }
        if (table === 'content_ideas') {
          return {
            ...awaitable({ data: state.ideas, error: null }),
            select: () => {
              state.ideaReads += 1
              const chain = awaitable({ data: state.ideas, error: null })
              // The completion route reads one row by id.
              chain.single = async () => ({ data: state.ideas[0] ?? null, error: state.ideas[0] ? null : { message: 'none' } })
              return chain
            },
            update: (patch: Record<string, unknown>) => {
              state.ideaUpdates.push(patch)
              return awaitable({ data: [{ id: 'updated' }], error: null })
            },
          }
        }
        if (table === 'video_studio_runner_heartbeats' || table === 'video_studio_runner_role_events') {
          return awaitable({ data: [], error: null })
        }
        throw new Error(`unexpected table ${table}`)
      },
      async rpc(name: string, args: Record<string, unknown>) {
        if (name === 'video_studio_take_rate_limit') return { data: { allowed: true }, error: null }
        if (name === 'video_studio_lease_production_brief') {
          state.leaseCalls.push(args)
          return { data: state.leaseResult, error: null }
        }
        if (name === 'video_studio_claim_command') {
          state.claimCalls.push(args)
          return { data: state.claimRows, error: null }
        }
        if (name === 'video_studio_switch_active_runner' || name === 'video_studio_set_runner_role') {
          state.roleRpcCalls.push({ name, args })
          if (state.rpcRefusal) return { data: null, error: { code: 'P0001', message: state.rpcRefusal } }
          return { data: [{}], error: null }
        }
        throw new Error(`unexpected rpc ${name}`)
      },
    },
  }
})

const TOKEN = 'unit-test-runner-bearer-that-is-long-enough'
const RUNNER_A = 'primary-runner'
const RUNNER_B = 'standby-runner'
const hashOf = (runnerId: string) => createHash('sha256').update(['runner', TOKEN, runnerId].join('\u0000')).digest('hex')

const { buildProductionBrief, createProductionApproval, productionBriefHash } = await import('../../apps/control-plane/api/_productionBrief.ts')
const { default: briefClaim } = await import('../../apps/control-plane/api/video-studio/runner/production-brief-claim.ts')
const { default: commandClaim } = await import('../../apps/control-plane/api/video-studio/runner/claim.ts')
const { default: briefComplete } = await import('../../apps/control-plane/api/video-studio/runner/production-brief-complete.ts')
const { default: runnerRoles } = await import('../../apps/control-plane/api/video-studio/runner-roles.ts')
const { issueVideoStudioCsrfToken, hashVideoStudioIdentity } = await import('../../apps/control-plane/api/_videoStudioAuth.ts')
const roles = await import('../../apps/control-plane/api/video-studio/_runnerRoles.ts')

function response() {
  const out = { status: 0, body: undefined as unknown, headers: new Map<string, unknown>() }
  const res = {
    statusCode: 200,
    setHeader(name: string, value: unknown) { out.headers.set(name.toLowerCase(), value); return res },
    status(code: number) { out.status = code; res.statusCode = code; return res },
    json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  return { res, out }
}

async function call(handler: (req: never, res: never) => unknown, body: unknown, headers: Record<string, string> = {}) {
  const { res, out } = response()
  await handler({
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...headers },
    query: {},
    body,
  } as never, res as never)
  return out
}

const claimBody = (runnerId: string) => ({
  schema_version: 1,
  runner_id: runnerId,
  software_commit: '6bf78628a481a61bf16ea3b4deec0d326281eee6',
  command_schema_versions: [1],
  series_supported: ['money_of_ai', 'built_with_ai', 'follow_the_money', 'mind_the_gap', 'under_the_hood'],
  editorial_formats_supported: ['money_trace', 'third_why', 'the_fork'],
})

function readyBriefRow() {
  const row = {
    id: '22222222-2222-4222-8222-222222222222',
    idea: 'Who picks your AI?',
    thesis: 'More and more, software picks which AI answers you, and the price list is why.',
    body: 'On 7 August 2025, OpenAI made GPT-5 the new default in ChatGPT and called it a single auto-switching system. The app decides which model answers each question.',
    lane: 'publication',
    lane_slot: 'follow_the_money',
    source_url: 'https://help.openai.com/en/articles/6825453-chatgpt-release-notes',
  }
  const approval = createProductionApproval(row, '2026-09-28T12:00:00.000Z')
  const brief = buildProductionBrief({ row: { ...row, meta: {} }, approval, productionKinds: ['video'], sourceMode: 'solo', editorialFormat: 'money_trace' })
  return {
    ...row,
    meta: { production_approval: approval },
    transformed_outputs: {
      production_briefs: {
        [brief.brief_id]: { brief, brief_hash: productionBriefHash(brief), status: 'ready_for_studio', requested_by: 'Krish', created_at: '2026-09-28T12:00:00.000Z' },
      },
    },
    updated_at: '2026-09-28T12:00:01.123456+00:00',
  }
}

beforeEach(() => {
  process.env.VIDEO_STUDIO_RUNNER_TOKEN = TOKEN
  state.roles = [
    { runner_id_hash: hashOf(RUNNER_A), role: 'active' },
    { runner_id_hash: hashOf(RUNNER_B), role: 'standby' },
    { runner_id_hash: 'd'.repeat(64), role: 'retired' },
  ]
  state.rolesError = null
  state.ideas = [readyBriefRow()]
  state.ideaReads = 0
  state.roleReads = 0
  state.leaseResult = 'leased'
  state.leaseCalls = []
  state.claimRows = []
  state.claimCalls = []
  state.rpcRefusal = null
  state.roleRpcCalls = []
  state.ideaUpdates = []
})

describe('the brief claim under the runner-role fence', () => {
  test('active runner claims: the active runner is leased the ready brief through the fenced write', async () => {
    const out = await call(briefClaim, claimBody(RUNNER_A))
    assert.equal(out.status, 200)
    const parsed = ProductionBriefClaimResponseV1Schema.parse(out.body)
    assert.ok(parsed.item, 'the active runner must receive the brief')
    assert.equal(state.leaseCalls.length, 1)
    const lease = state.leaseCalls[0]!
    assert.equal(lease.p_runner_id_hash, hashOf(RUNNER_A))
    assert.equal(lease.p_expected_updated_at, '2026-09-28T12:00:01.123456+00:00', 'the write is still compare-and-set on updated_at')
    assert.equal((lease.p_envelope as { lease: { runner_id_hash: string } }).lease.runner_id_hash, hashOf(RUNNER_A))
    assert.equal(state.ideaUpdates.length, 0, 'the claim never writes content_ideas around the fence')
  })

  test('standby gets item: null for briefs, in the exact shape the installed runner parses', async () => {
    const out = await call(briefClaim, claimBody(RUNNER_B))
    assert.equal(out.status, 200)
    assert.deepEqual(out.body, { ok: true, schema_version: 1, item: null })
    assert.deepEqual(ProductionBriefClaimResponseV1Schema.parse(out.body), { ok: true, schema_version: 1, item: null })
    assert.equal(state.ideaReads, 0, 'a fenced runner does not walk the queue')
    assert.equal(state.leaseCalls.length, 0)
  })

  test('unassigned and retired runners are refused the same way', async () => {
    for (const runnerId of ['unassigned-runner']) {
      const out = await call(briefClaim, claimBody(runnerId))
      assert.deepEqual(out.body, { ok: true, schema_version: 1, item: null })
    }
    // A retired hash: make RUNNER_B's hash retired.
    state.roles = [{ runner_id_hash: hashOf(RUNNER_A), role: 'active' }, { runner_id_hash: hashOf(RUNNER_B), role: 'retired' }]
    const retired = await call(briefClaim, claimBody(RUNNER_B))
    assert.deepEqual(retired.body, { ok: true, schema_version: 1, item: null })
    assert.equal(state.leaseCalls.length, 0)
  })

  test('before the seed every runner still claims (unfenced), exactly as before', async () => {
    state.roles = []
    const out = await call(briefClaim, claimBody('any-runner'))
    assert.ok(ProductionBriefClaimResponseV1Schema.parse(out.body).item)
  })

  test('a switch between the early check and the write still withholds the lease token', async () => {
    state.leaseResult = 'fenced'
    const out = await call(briefClaim, claimBody(RUNNER_A))
    assert.deepEqual(out.body, { ok: true, schema_version: 1, item: null })
  })

  test('the roles cannot be read: fail closed, lease nothing', async () => {
    state.rolesError = { message: 'relation does not exist' }
    const out = await call(briefClaim, claimBody(RUNNER_A))
    assert.equal(out.status, 503)
    assert.equal(state.leaseCalls.length, 0)
  })

  test('a brief lease already held completes after a role change: completion reads no role', async () => {
    const row = readyBriefRow()
    const [briefId, envelope] = Object.entries((row.transformed_outputs as { production_briefs: Record<string, Record<string, unknown>> }).production_briefs)[0]!
    const leaseToken = 'lease-token-long-enough-for-production-briefs'
    const leased = {
      ...envelope,
      status: 'leased',
      lease: {
        runner_id_hash: hashOf(RUNNER_B),
        token_hash: createHash('sha256').update(leaseToken).digest('hex'),
        software_commit: '6bf78628a481a61bf16ea3b4deec0d326281eee6',
        claimed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    }
    state.ideas = [{ ...row, transformed_outputs: { production_briefs: { [briefId]: leased } } }]
    // RUNNER_B is only a standby now.
    const out = await call(briefComplete, {
      schema_version: 1,
      runner_id: RUNNER_B,
      content_idea_id: row.id,
      brief_id: briefId,
      brief_hash: envelope.brief_hash,
      lease_token: leaseToken,
      status: 'imported',
      job_id: 'job-imported-after-switch',
      safe_code: null,
    })
    assert.equal(out.status, 200, JSON.stringify(out.body))
    assert.equal((out.body as { ok: boolean }).ok, true)
    assert.equal(state.roleReads, 0, 'completion must never consult the roles')
  })
})

describe('the command claim under the runner-role fence', () => {
  test('standby gets command: null for commands, in the exact shape the installed runner parses', async () => {
    // The database fences inside video_studio_claim_command and returns no row.
    state.claimRows = []
    const out = await call(commandClaim, { schema_version: 1, runner_id: RUNNER_B, software_commit: '6bf78628a481a61bf16ea3b4deec0d326281eee6', command_schema_versions: [1] })
    assert.equal(out.status, 200)
    assert.deepEqual(out.body, { ok: true, schema_version: 1, command: null })
    assert.deepEqual(RunnerClaimResponseV1Schema.parse(out.body), { ok: true, schema_version: 1, command: null })
    assert.equal(state.claimCalls[0]!.p_runner_id_hash, hashOf(RUNNER_B), 'the fence is decided on the same hash the heartbeat records')
  })

  test('the fenced answers are the constants the migration comment promises', () => {
    assert.deepEqual({ ...roles.NOTHING_TO_CLAIM_BRIEF }, { ok: true, schema_version: 1, item: null })
    assert.deepEqual({ ...roles.NOTHING_TO_CLAIM_COMMAND }, { ok: true, schema_version: 1, command: null })
  })
})

describe('the installed runner and the fence', () => {
  let runtimeRoot = ''
  afterEach(async () => {
    if (runtimeRoot) await rm(runtimeRoot, { recursive: true, force: true })
    runtimeRoot = ''
  })

  test('a runner at 6bf7862 idles on the fenced answers: no dispatch, no completion, heartbeats continue', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-fenced-'))
    const calls: string[] = []
    const client = new ControlPlaneClient({
      baseUrl: 'https://control.example/api/video-studio/runner',
      token: TOKEN,
      fetchImpl: async (input, init) => {
        const path = String(input).split('/').at(-1)!
        calls.push(path)
        const body = JSON.parse(String(init?.body ?? '{}'))
        if (path === 'heartbeat') return Response.json({ ok: true, schema_version: 1, accepted: true, server_time: new Date().toISOString() })
        // The real routes answer, with the standby's own runner id.
        if (path === 'production-brief-claim') return Response.json((await call(briefClaim, body)).body)
        if (path === 'claim') return Response.json((await call(commandClaim, body)).body)
        throw new Error(`a fenced runner must not call ${path}`)
      },
    })
    let dispatched = 0
    const result = await runRunnerCycle({
      client,
      runnerId: RUNNER_B,
      softwareCommit: '6bf78628a481a61bf16ea3b4deec0d326281eee6',
      signingKey: Buffer.from('unit-test-runner-signing-material-at-least-32-bytes'),
      driveState: 'ready',
      runtimeRoot,
      dispatch: async () => { dispatched += 1; throw new Error('must not dispatch') },
    })
    assert.deepEqual(result, { state: 'idle' })
    assert.equal(dispatched, 0)
    assert.deepEqual(calls, ['heartbeat', 'production-brief-claim', 'claim'])
    assert.equal(state.leaseCalls.length, 0)
  })
})

describe('the operator switch', () => {
  const accessCode = 'synthetic-access-code-for-runner-roles'
  const cookie = createHash('sha256').update(accessCode).digest('hex')
  beforeEach(() => {
    process.env.ACCESS_CODE = accessCode
    process.env.APP_ORIGIN = 'https://control.example.test'
    process.env.VIDEO_STUDIO_CSRF_SECRET = 'c'.repeat(32)
  })

  async function operatorPost(body: unknown, overrides: Record<string, string | undefined> = {}) {
    const readReq = { method: 'GET', headers: { cookie: `cc_access=${cookie}` } } as never
    const csrf = issueVideoStudioCsrfToken(readReq)!
    const headers: Record<string, string> = {
      cookie: `cc_access=${cookie}`,
      origin: 'https://control.example.test',
      'content-type': 'application/json',
      'x-video-studio-csrf': csrf.token,
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete headers[key]
      else headers[key] = value
    }
    const { res, out } = response()
    await runnerRoles({ method: 'POST', headers, query: {}, body } as never, res as never)
    return out
  }

  const switchBody = {
    schema_version: 1,
    action: 'switch_active',
    to_runner_id_hash: 'b'.repeat(64),
    expected_active_runner_id_hash: 'a'.repeat(64),
    reason: 'Failover drill: the primary is stopped and disabled.',
  }

  test('switching the active runner needs Control Center\'s cookie, origin and CSRF token', async () => {
    assert.equal((await operatorPost(switchBody, { cookie: undefined })).status, 401)
    assert.equal((await operatorPost(switchBody, { origin: 'https://elsewhere.example' })).status, 403)
    assert.equal((await operatorPost(switchBody, { 'x-video-studio-csrf': undefined })).status, 403)
    assert.equal(state.roleRpcCalls.length, 0, 'nothing reaches the database without all three')
  })

  test('the audit records the operator identity and the reason', async () => {
    const out = await operatorPost(switchBody)
    assert.equal(out.status, 200, JSON.stringify(out.body))
    assert.equal(state.roleRpcCalls.length, 1)
    const { name, args } = state.roleRpcCalls[0]!
    assert.equal(name, 'video_studio_switch_active_runner')
    assert.equal(args.p_set_by, `operator:${hashVideoStudioIdentity('operator', cookie)}`)
    assert.equal(args.p_reason, switchBody.reason)
    assert.equal(args.p_expected_active_runner_id_hash, 'a'.repeat(64))
  })

  test('a switch refused while work is leased comes back by name with 409', async () => {
    state.rpcRefusal = 'active_runner_holds_work'
    const out = await operatorPost(switchBody)
    assert.equal(out.status, 409)
    assert.deepEqual(out.body, { ok: false, error: { code: 'active_runner_holds_work' } })
  })

  test('the request is exact: a short reason, an extra field or active by the side door is refused before the database', async () => {
    assert.equal((await operatorPost({ ...switchBody, reason: 'short' })).status, 400)
    assert.equal((await operatorPost({ ...switchBody, force: true })).status, 400)
    assert.equal((await operatorPost({ schema_version: 1, action: 'set_role', runner_id_hash: 'c'.repeat(64), role: 'active', reason: 'Make it active without the switch.' })).status, 400)
    assert.equal((await operatorPost({ ...switchBody, to_runner_id_hash: 'a'.repeat(64) })).status, 400)
    assert.equal(state.roleRpcCalls.length, 0)
  })
})

describe('the roster and its alerts', () => {
  const now = new Date('2026-09-28T18:30:00.000Z')
  const beat = (hash: string, secondsAgo: number, extra: Partial<Record<string, unknown>> = {}) => ({
    runner_id_hash: hash,
    runner_status: 'idle',
    drive_state: 'ready',
    software_commit: '6bf78628a481a61bf16ea3b4deec0d326281eee6',
    active_command_id: null,
    pending_receipts: 0,
    occurred_at: new Date(now.getTime() - secondsAgo * 1000).toISOString(),
    received_at: new Date(now.getTime() - secondsAgo * 1000).toISOString(),
    ...extra,
  })
  const A = 'a'.repeat(64)
  const B = 'b'.repeat(64)
  const R = 'd'.repeat(64)

  test('the active runner is the role, the standby is listed apart, retired rows are counted and never listed', () => {
    const roster = roles.runnerRoster(
      [{ runner_id_hash: A, role: 'active' }, { runner_id_hash: B, role: 'standby' }, { runner_id_hash: R, role: 'retired' }],
      [beat(A, 5), beat(B, 1400), beat(R, 3)],
      now,
    )
    assert.equal(roster.active?.runner_id_prefix, 'aaaaaaaa')
    assert.equal(roster.active?.fresh, true)
    assert.deepEqual(roster.standby.map((row) => row.runner_id_prefix), ['bbbbbbbb'])
    assert.equal(roster.standby[0]!.fresh, false)
    assert.equal(roster.unassigned.length, 0, 'a retired row never reads as a machine')
    assert.equal(roster.retired_count, 1)
    assert.equal(roster.active_basis, 'role')
  })

  test('silence with nothing queued is fine; the active runner silent with work waiting is an alert; a standby\'s silence never is', () => {
    const quiet = roles.runnerRoster([{ runner_id_hash: A, role: 'active' }, { runner_id_hash: B, role: 'standby' }], [beat(A, 90_000), beat(B, 900_000)], now)
    assert.deepEqual(roles.runnerAttention(quiet, 0, 86_400), [])
    assert.deepEqual(roles.runnerAttention(quiet, 2, 86_400).map((item) => item.code), ['active_runner_silent_with_work_waiting'])
    const standbySilent = roles.runnerRoster([{ runner_id_hash: A, role: 'active' }, { runner_id_hash: B, role: 'standby' }], [beat(A, 5), beat(B, 900_000)], now)
    assert.deepEqual(roles.runnerAttention(standbySilent, 3, 86_400), [])
  })

  test('a heartbeating standby or an unassigned runner while the active one is down says what to switch', () => {
    const failover = roles.runnerRoster([{ runner_id_hash: A, role: 'active' }, { runner_id_hash: B, role: 'standby' }], [beat(A, 600), beat(B, 3)], now)
    assert.deepEqual(roles.runnerAttention(failover, 0, 86_400).map((item) => item.code), ['standby_heartbeating_while_active_down'])
    const rotated = roles.runnerRoster([{ runner_id_hash: A, role: 'active' }], [beat(A, 600), beat('e'.repeat(64), 4)], now)
    assert.deepEqual(roles.runnerAttention(rotated, 0, 86_400).map((item) => item.code), ['unassigned_runner_heartbeating'])
  })

  test('before the seed, the runner heard last stands in for the active one, and two runners up is a hazard', () => {
    const unseeded = roles.runnerRoster([], [beat(A, 5), beat(B, 20), beat(R, 90_000)], now)
    assert.equal(unseeded.fenced, false)
    assert.equal(unseeded.active?.runner_id_prefix, 'aaaaaaaa')
    assert.equal(unseeded.active_basis, 'latest_heartbeat_unfenced')
    assert.deepEqual(roles.runnerAttention(unseeded, 0, 86_400).map((item) => item.code), ['several_runners_unfenced'])
  })

  test('standing mirrors the database: unfenced until seeded, then only active may start new work', () => {
    assert.equal(roles.runnerStanding([], A), 'unfenced')
    assert.equal(roles.mayStartNewWork(roles.runnerStanding([], A)), true)
    const seeded = [{ runner_id_hash: A, role: 'active' as const }, { runner_id_hash: B, role: 'standby' as const }, { runner_id_hash: R, role: 'retired' as const }]
    assert.equal(roles.mayStartNewWork(roles.runnerStanding(seeded, A)), true)
    for (const hash of [B, R, 'e'.repeat(64)]) assert.equal(roles.mayStartNewWork(roles.runnerStanding(seeded, hash)), false)
  })
})
