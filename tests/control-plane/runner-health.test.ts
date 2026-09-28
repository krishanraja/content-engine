import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { beforeEach, describe, test, vi } from 'vitest'

// Health and the runner watch after the runner roles (2026-09-28). Both read
// the ACTIVE runner's heartbeat, list the standby apart and ignore retired
// rows. The rule that has always held stays: silence with nothing waiting is
// fine, silence with work waiting is an alert. Before this, health selected
// heartbeat columns that do not exist and always said "never", and the watch
// read whichever runner's row was newest and counted briefs where none are
// stored.

// The routes read the real clock, so the fixtures are placed relative to it.
const NOW = new Date()
const A = 'a'.repeat(64)
const B = 'b'.repeat(64)
const R = 'd'.repeat(64)

const db = vi.hoisted(() => ({
  tables: {} as Record<string, { data?: unknown; count?: number; error?: { message: string } | null }>,
  selected: {} as Record<string, string[]>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    from(table: string) {
      const result = db.tables[table] ?? { data: [], error: null }
      const chain: Record<string, unknown> = {}
      chain.select = (columns: string) => { (db.selected[table] ??= []).push(columns); return chain }
      for (const method of ['eq', 'in', 'not', 'order', 'limit']) chain[method] = () => chain
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, ...result }).then(resolve)
      return chain
    },
  },
}))

// The ledger wrapper is the runs module's concern; here the watch's own answer is under test.
vi.mock('../../apps/control-plane/api/_runs.js', () => ({
  withContentRun: (_job: string, handler: unknown) => handler,
}))

const beat = (hash: string, secondsAgo: number, extra: Record<string, unknown> = {}) => ({
  runner_id_hash: hash,
  runner_status: 'idle',
  drive_state: 'ready',
  software_commit: '6bf78628a481a61bf16ea3b4deec0d326281eee6',
  active_command_id: null,
  pending_receipts: 0,
  occurred_at: new Date(NOW.getTime() - secondsAgo * 1000).toISOString(),
  received_at: new Date(NOW.getTime() - secondsAgo * 1000).toISOString(),
  ...extra,
})

function world(input: {
  roles?: Array<{ runner_id_hash: string; role: string }>
  heartbeats?: unknown[]
  queued?: number
  briefs?: unknown[]
}) {
  db.tables = {
    video_studio_runner_roles: { data: input.roles ?? [] },
    video_studio_runner_heartbeats: { data: input.heartbeats ?? [] },
    video_studio_commands: { data: null, count: input.queued ?? 0 },
    video_studio_review_requests: { data: [] },
    content_ideas: { data: input.briefs ?? [] },
    video_studio_jobs: { data: [] },
    content_engine_runs: { data: [] },
  }
  db.selected = {}
}

const { readRunnerState, countClaimableBriefs } = await import('../../apps/control-plane/api/video-studio/_runnerWatch.ts')
const { supabase } = await import('../../apps/control-plane/api/_supabase.js')

function response() {
  const out = { status: 0, body: undefined as unknown }
  const res = {
    statusCode: 200,
    setHeader() { return res },
    status(code: number) { out.status = code; res.statusCode = code; return res },
    json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  return { res, out }
}

const seededRoles = [
  { runner_id_hash: A, role: 'active' },
  { runner_id_hash: B, role: 'standby' },
  { runner_id_hash: R, role: 'retired' },
]

describe('what counts as waiting', () => {
  test('claimable briefs are read where they are stored: transformed_outputs.production_briefs', () => {
    const rows = [
      { transformed_outputs: { production_briefs: {
        ready: { status: 'ready_for_studio' },
        held: { status: 'leased', lease: { expires_at: new Date(NOW.getTime() + 60_000).toISOString() } },
        lapsed: { status: 'leased', lease: { expires_at: new Date(NOW.getTime() - 60_000).toISOString() } },
        done: { status: 'imported' },
      } } },
      { transformed_outputs: { production_brief: { status: 'ready_for_studio' } } },
    ]
    assert.deepEqual(countClaimableBriefs(rows, NOW), { ready: 1, expired: 1 })
  })
})

describe('readRunnerState', () => {
  beforeEach(() => world({}))

  test('the active runner is the one reported; the standby is apart; retired rows are ignored', async () => {
    world({ roles: seededRoles, heartbeats: [beat(A, 5), beat(B, 1416), beat(R, 2)] })
    const state = await readRunnerState(supabase as never, NOW)
    assert.equal(state.roster.active?.runner_id_prefix, 'aaaaaaaa')
    assert.equal(state.roster.active?.heartbeat_age_seconds, 5)
    assert.deepEqual(state.roster.standby.map((row) => row.runner_id_prefix), ['bbbbbbbb'])
    assert.equal(state.roster.unassigned.length, 0)
    assert.equal(state.roster.retired_count, 1)
    assert.deepEqual(state.attention, [])
    assert.ok(db.selected.video_studio_runner_heartbeats?.[0]?.includes('received_at'), 'reads columns the table has')
  })

  test('rows with no role fade after a week, so old bearers stop reading as machines', async () => {
    world({ roles: seededRoles, heartbeats: [beat(A, 5), beat('e'.repeat(64), 8 * 86_400)] })
    const state = await readRunnerState(supabase as never, NOW)
    assert.equal(state.roster.unassigned.length, 0)
  })
})

describe('GET /api/content-engine/health', () => {
  const accessCode = 'synthetic-access-code-for-health'
  beforeEach(() => {
    process.env.ACCESS_CODE = accessCode
    process.env.SUPABASE_URL ||= 'https://health-test.invalid'
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-service-role-key-for-health-test'
  })

  async function health() {
    const { default: handler } = await import('../../apps/control-plane/api/content-engine/health.ts')
    const { res, out } = response()
    await handler({ method: 'GET', headers: { cookie: `cc_access=${createHash('sha256').update(accessCode).digest('hex')}` }, query: {} } as never, res as never)
    return out.body as Record<string, any>
  }

  test('reports the active runner\'s heartbeat age and state, lists the standby separately, ignores retired rows', async () => {
    world({ roles: seededRoles, heartbeats: [beat(A, 5), beat(B, 1416), beat(R, 2)] })
    const body = await health()
    assert.equal(body.runner.state, 'present')
    assert.equal(body.runner.runner_id_prefix, 'aaaaaaaa')
    assert.equal(body.runner.drive_state, 'ready')
    assert.equal(body.runner.status, 'idle')
    assert.equal(body.runners.fenced, true)
    assert.equal(body.runners.active.runner_id_prefix, 'aaaaaaaa')
    assert.equal(body.runners.standby.length, 1)
    assert.equal(body.runners.standby[0].runner_id_prefix, 'bbbbbbbb')
    assert.equal(body.runners.retired_count, 1)
    assert.deepEqual(body.read_errors, [])
    // The export bearer can read this route: prefixes only.
    assert.doesNotMatch(JSON.stringify(body), /a{64}|b{64}|d{64}/)
  })

  test('a standby heartbeating after the primary died does not make the runner look present', async () => {
    world({ roles: seededRoles, heartbeats: [beat(A, 3 * 86_400), beat(B, 2)], queued: 1 })
    const body = await health()
    assert.equal(body.runner.state, 'absent')
    assert.deepEqual(body.runners.attention.map((item: { code: string }) => item.code), [
      'active_runner_silent_with_work_waiting',
      'standby_heartbeating_while_active_down',
    ])
  })
})

describe('GET /api/video-studio/runner/watch', () => {
  const cronSecret = ['synthetic', 'cron', 'secret', 'for', 'the', 'watch'].join('-')
  beforeEach(() => { process.env.CRON_SECRET = cronSecret })

  async function watch() {
    const { default: handler } = await import('../../apps/control-plane/api/video-studio/runner/watch.ts')
    const { res, out } = response()
    await handler({ method: 'GET', headers: { authorization: `Bearer ${cronSecret}` }, query: {} } as never, res as never)
    return out.body as Record<string, any>
  }

  test('silence with nothing waiting is fine', async () => {
    world({ roles: seededRoles, heartbeats: [beat(A, 2 * 86_400), beat(B, 5 * 86_400)] })
    const body = await watch()
    assert.equal(body.ok, true)
    assert.equal(body.skipped, 'runner silent, nothing waiting for it')
  })

  test('the active runner silent with work waiting is an alert, counted from the briefs where they live', async () => {
    world({
      roles: seededRoles,
      heartbeats: [beat(A, 2 * 86_400), beat(B, 5)],
      briefs: [{ id: 'x', transformed_outputs: { production_briefs: { one: { status: 'ready_for_studio' } } } }],
    })
    const body = await watch()
    assert.equal(body.ok, false)
    assert.match(body.error, /active Studio runner aaaaaaaa has been silent for 48 hours with 1 item waiting/)
    assert.equal(body.ready_briefs, 1)
    assert.equal(body.active_runner, 'aaaaaaaa')
    assert.deepEqual(body.standby.map((row: { runner: string }) => row.runner), ['bbbbbbbb'])
  })

  test('a fresh retired row or a fresh standby never hides a silent active runner', async () => {
    world({ roles: seededRoles, heartbeats: [beat(A, 2 * 86_400), beat(R, 1), beat(B, 1)], queued: 2 })
    const body = await watch()
    assert.equal(body.ok, false)
    assert.equal(body.silent_hours, 48)
  })

  test('the active runner heard recently with work waiting is working and raises no alert', async () => {
    world({ roles: seededRoles, heartbeats: [beat(A, 5), beat(B, 5 * 86_400)], queued: 3 })
    const body = await watch()
    assert.equal(body.ok, true)
    assert.equal(body.runner_status, 'idle')
  })
})
