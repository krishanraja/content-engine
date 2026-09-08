import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, test } from 'vitest'
import {
  RunnerClaimRequestV1Schema,
  RunnerCompleteRequestV1Schema,
  RunnerHeartbeatRequestV1Schema,
  RunnerPreviewRetentionRequestV1Schema,
  RunnerPreviewUploadRequestV1Schema,
} from '../../packages/contracts/src/index.js'
import {
  parseRunnerClaimRequest,
  parseRunnerCompleteRequest,
  parseRunnerHeartbeatRequest,
  parseRunnerPreviewRetentionRequest,
  parseRunnerPreviewUploadRequest,
} from '../../apps/control-plane/api/video-studio/_runnerContracts.js'

// The runner sends these bodies validated by zod. The control plane received
// them through hand-written parsers. Two definitions of one wire format, on
// opposite sides of an HTTP call, with no test that they agree: a rule tightened
// on one end and not the other is a runner that talks to a server that will not
// answer it, discovered in production.
//
// This is the regression net for replacing the parsers. It runs both over the
// same inputs and requires the same verdict, so a swap is provably behaviour
// preserving. Where they legitimately differ the divergence is named and
// asserted, never quietly allowed: an unnamed divergence is the bug this file
// exists to catch.

const SHA = 'a'.repeat(64)
const MD5 = 'b'.repeat(32)
const COMMIT = 'c'.repeat(40)
const LEASE = 'lease-token-that-is-long-enough-to-pass'
const RUNNER = 'runner-29b875c1'

// UUID_RE in the control plane demands a v1-v8 UUID with an RFC variant nibble,
// and zod's .uuid() agrees, so randomUUID() satisfies both.
const uuid = () => randomUUID()

interface Pair {
  name: string
  parse: (value: unknown) => unknown
  schema: { safeParse: (value: unknown) => { success: boolean } }
  valid: () => Record<string, unknown>
  /** Inputs where the two legitimately disagree, each with the reason. */
  divergences?: Array<{ why: string; input: Record<string, unknown>; parser: boolean; zod: boolean }>
}

function receipt(): Record<string, unknown> {
  const commandId = uuid()
  return {
    schema_version: 1,
    command_id: commandId,
    command_hash: SHA,
    job_id: 'job-1',
    status: 'failed',
    result_revision_hash: null,
    result_artifact_hash: null,
    hard_gates: {
      truth: { status: 'passed' }, rights: { status: 'passed' },
      confidentiality: { status: 'passed' },
      transcript_fidelity: { status: 'passed' }, naming: { status: 'passed' },
    },
    retryable: false,
    safe_code: 'render_failed',
    started_at: '2026-09-08T10:00:00.000Z',
    finished_at: '2026-09-08T10:01:00.000Z',
    receipt_hash: SHA,
    receipt_signature: 'd'.repeat(64),
  }
}

const PAIRS: Pair[] = [
  {
    name: 'claim',
    parse: parseRunnerClaimRequest,
    schema: RunnerClaimRequestV1Schema,
    valid: () => ({
      schema_version: 1,
      runner_id: RUNNER,
      software_commit: COMMIT,
      command_schema_versions: [1],
      lease_seconds: 120,
    }),
  },
  {
    name: 'heartbeat',
    parse: (value: unknown) => parseRunnerHeartbeatRequest(value, Date.parse('2026-09-08T10:00:00.000Z')),
    schema: RunnerHeartbeatRequestV1Schema,
    valid: () => ({
      schema_version: 1,
      runner_id: RUNNER,
      software_commit: COMMIT,
      command_schema_versions: [1],
      status: 'idle',
      drive_state: 'ready',
      pending_receipts: 0,
      occurred_at: '2026-09-08T10:00:00.000Z',
    }),
    divergences: [
      {
        why: 'freshness is a server rule and needs a clock, so it is not in the schema. The server keeps it; see the note on RunnerHeartbeatRequestV1Schema.',
        input: {
          schema_version: 1, runner_id: RUNNER, software_commit: COMMIT,
          command_schema_versions: [1], status: 'idle', drive_state: 'ready',
          pending_receipts: 0, occurred_at: '2020-01-01T00:00:00.000Z',
        },
        parser: false,
        zod: true,
      },
    ],
  },
  {
    name: 'preview-upload',
    parse: parseRunnerPreviewUploadRequest,
    schema: RunnerPreviewUploadRequestV1Schema,
    valid: () => ({
      schema_version: 1,
      runner_id: RUNNER,
      command_id: uuid(),
      command_hash: SHA,
      lease_token: LEASE,
      side: 'before',
      sha256: SHA,
      md5: MD5,
      content_type: 'video/mp4',
      byte_size: 1024,
    }),
  },
  {
    name: 'preview-retention',
    parse: parseRunnerPreviewRetentionRequest,
    schema: RunnerPreviewRetentionRequestV1Schema,
    valid: () => ({ schema_version: 1, runner_id: RUNNER, limit: 10 }),
  },
  {
    name: 'complete',
    parse: parseRunnerCompleteRequest,
    schema: RunnerCompleteRequestV1Schema,
    valid: () => ({ schema_version: 1, runner_id: RUNNER, lease_token: LEASE, receipt: receipt() }),
  },
]

// All five wire contracts are now parsed on the server by the same schema the
// runner sends with, so there is nothing left for either side to be stricter
// about: one implementation cannot disagree with itself. An entry appearing
// here again means someone reintroduced a second parser.
//
// Kept rather than deleted because this file is the proof the unification was
// behaviour preserving, and it stays the gate on the next contract added.
const EXPECTED_TIGHTENINGS: Record<string, string[]> = {
  claim: [],
  heartbeat: [],
  'preview-upload': [],
  'preview-retention': [],
  complete: [],
}

/** Every single-field corruption worth trying on a wire body. */
function mutations(valid: Record<string, unknown>): Array<{ label: string; value: unknown }> {
  const out: Array<{ label: string; value: unknown }> = []
  for (const key of Object.keys(valid)) {
    out.push({ label: `${key} removed`, value: omit(valid, key) })
    for (const [label, replacement] of [
      ['null', null], ['a number', 12345], ['a string', 'x'],
      ['true', true], ['an array', []], ['an object', {}],
      ['an empty string', ''],
      // An over-long string is the mutation that matters most and is easiest to
      // leave out. The first version of this corpus did, and missed that the
      // upload schema bounded lease_token below and not above while the parser
      // bounded both: a loosening that would have shipped.
      ['a very long string', 'x'.repeat(1000)],
      ['a huge number', Number.MAX_SAFE_INTEGER],
      ['a negative number', -1],
      ['a fractional number', 1.5],
    ] as const) {
      out.push({ label: `${key} is ${label}`, value: { ...valid, [key]: replacement } })
    }
  }
  out.push({ label: 'an unexpected key', value: { ...valid, injected: 'x' } })
  out.push({ label: 'a prototype key', value: { ...valid, __proto__: { polluted: true } } })
  out.push({ label: 'not an object', value: 'string' })
  out.push({ label: 'null', value: null })
  out.push({ label: 'an array', value: [valid] })
  return out
}

function omit(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...record }
  delete copy[key]
  return copy
}

describe('the runner wire contracts mean the same thing on both ends', () => {
  for (const pair of PAIRS) {
    test(`${pair.name}: both accept a valid body`, () => {
      const valid = pair.valid()
      assert.notEqual(pair.parse(valid), null, `the hand-written parser rejected a body it must accept: ${pair.name}`)
      const result = pair.schema.safeParse(valid)
      assert.equal(result.success, true, `the zod schema rejected a body it must accept: ${pair.name}`)
    })

    // The property that makes the swap safe is not equality, it is that the
    // schema NEVER ACCEPTS what the parser rejected. A tightening costs a body
    // the runner does not send anyway; a loosening silently removes a check
    // that was the only thing standing between a malformed receipt and the
    // ledger. So loosenings fail the build, and tightenings are counted and
    // reported rather than ignored, because an unexplained tightening is still
    // a behaviour change nobody decided on.
    test(`${pair.name}: the schema never accepts what the parser rejected`, () => {
      const valid = pair.valid()
      const loosenings: string[] = []
      const tightenings: string[] = []
      for (const { label, value } of mutations(valid)) {
        const parserAccepted = pair.parse(value) !== null
        const zodAccepted = pair.schema.safeParse(value).success
        if (!parserAccepted && zodAccepted) loosenings.push(label)
        if (parserAccepted && !zodAccepted) tightenings.push(label)
      }
      assert.deepEqual(
        loosenings,
        [],
        `${pair.name}: the schema accepts bodies the hand-written parser refused. Each is a check that would be lost by replacing one with the other:\n  ${loosenings.join('\n  ')}`,
      )
      // Named so a new one shows up as a diff rather than passing silently.
      assert.deepEqual(
        tightenings.sort(),
        (EXPECTED_TIGHTENINGS[pair.name] || []).slice().sort(),
        `${pair.name}: the set of inputs the schema is stricter about changed. Add it to EXPECTED_TIGHTENINGS with a reason, or fix the schema.`,
      )
    })

    for (const divergence of pair.divergences || []) {
      test(`${pair.name}: named divergence, ${divergence.why}`, () => {
        assert.equal(pair.parse(divergence.input) !== null, divergence.parser, 'the parser changed behaviour on a documented divergence')
        assert.equal(pair.schema.safeParse(divergence.input).success, divergence.zod, 'the schema changed behaviour on a documented divergence')
      })
    }
  }
})

describe('the invariants that only existed on the server', () => {
  const base = {
    schema_version: 1,
    runner_id: RUNNER,
    software_commit: COMMIT,
    command_schema_versions: [1],
    status: 'working',
    drive_state: 'ready',
    pending_receipts: 0,
    occurred_at: '2026-09-08T10:00:00.000Z',
  }

  test('an active command without its lease is refused by both', () => {
    // The runner could build this and only learn it was wrong over HTTP,
    // because the rule lived in the server parser alone.
    const value = { ...base, active_command_id: uuid() }
    assert.equal(parseRunnerHeartbeatRequest(value, Date.parse(base.occurred_at)), null)
    assert.equal(RunnerHeartbeatRequestV1Schema.safeParse(value).success, false)
  })

  test('a lease with no command is refused by both', () => {
    const value = { ...base, lease_token: LEASE }
    assert.equal(parseRunnerHeartbeatRequest(value, Date.parse(base.occurred_at)), null)
    assert.equal(RunnerHeartbeatRequestV1Schema.safeParse(value).success, false)
  })

  test('both together are accepted by both', () => {
    const value = { ...base, active_command_id: uuid(), lease_token: LEASE }
    assert.notEqual(parseRunnerHeartbeatRequest(value, Date.parse(base.occurred_at)), null)
    assert.equal(RunnerHeartbeatRequestV1Schema.safeParse(value).success, true)
  })

  test('a lease token over 256 chars is refused by both', () => {
    // The parser bounded this and the bare heartbeat schema did not, so an
    // unbounded token would have been a body the runner could build and the
    // server would refuse.
    const value = { ...base, active_command_id: uuid(), lease_token: 'x'.repeat(257) }
    assert.equal(parseRunnerHeartbeatRequest(value, Date.parse(base.occurred_at)), null)
    assert.equal(RunnerHeartbeatRequestV1Schema.safeParse(value).success, false)
  })
})

// The body the runner actually builds, parsed by the server that actually
// receives it, in one process.
//
// Everything above tests each side against a corpus. This tests the join, which
// is the thing that breaks in production and nowhere else. A live runner is
// heartbeating into this route right now; the cost of getting it wrong is a
// machine that goes quiet and says nothing about why.
describe('a real heartbeat, built the way the runner builds it', () => {
  // Copied from heartbeat() in packages/core/src/runner.ts. Deliberately a copy
  // rather than an import: importing the runner would prove the two agree with
  // each other, not that the shape on the wire is the one written down there.
  function runnerHeartbeat(
    driveState: 'ready' | 'unavailable' | 'not_configured',
    status: 'idle' | 'working' | 'degraded',
    pendingReceipts: number,
    occurredAt: string,
    activeCommandId?: string,
  ): Record<string, unknown> {
    return {
      schema_version: 1,
      runner_id: 'runner-29b875c1',
      software_commit: COMMIT,
      command_schema_versions: [1],
      status,
      drive_state: driveState,
      ...(activeCommandId ? { active_command_id: activeCommandId } : {}),
      pending_receipts: pendingReceipts,
      occurred_at: occurredAt,
    }
  }

  const now = '2026-09-08T10:00:00.000Z'
  const at = Date.parse(now)

  test('idle with no lease, which is what it sends most of the time', () => {
    const body = runnerHeartbeat('ready', 'idle', 0, now)
    const parsed = parseRunnerHeartbeatRequest(body, at)
    assert.notEqual(parsed, null, 'the server must accept the ordinary heartbeat')
    assert.deepEqual(parsed, {
      schema_version: 1,
      runner_id: 'runner-29b875c1',
      status: 'idle',
      software_commit: COMMIT,
      command_schema_versions: [1],
      drive_state: 'ready',
      // Absent on the wire, null to every reader downstream and to the column.
      active_command_id: null,
      pending_receipts: 0,
      occurred_at: now,
      lease_token: null,
    })
  })

  test('working on a command, with the lease spread on the way the client does it', () => {
    const commandId = uuid()
    const body = { ...runnerHeartbeat('ready', 'working', 2, now, commandId), lease_token: LEASE }
    const parsed = parseRunnerHeartbeatRequest(body, at) as Record<string, unknown> | null
    assert.notEqual(parsed, null, 'the server must accept a heartbeat from a runner holding a lease')
    assert.equal(parsed?.active_command_id, commandId)
    assert.equal(parsed?.lease_token, LEASE)
    assert.equal(parsed?.status, 'working')
  })

  test('every drive state and status the runner can report is accepted', () => {
    for (const drive of ['ready', 'unavailable', 'not_configured'] as const) {
      for (const status of ['idle', 'working', 'degraded'] as const) {
        assert.notEqual(
          parseRunnerHeartbeatRequest(runnerHeartbeat(drive, status, 0, now), at),
          null,
          `the server refused drive_state=${drive} status=${status}, which the runner can and does send`,
        )
      }
    }
  })

  test('the client never sends lease_token as null, and the server would refuse it if it did', () => {
    // Guarding an assumption rather than trusting it: the swap moved from a
    // parser that mapped explicit null to absent, to a schema where optional
    // means absent and null is a type error. That is only safe because the
    // client omits the key.
    const body = { ...runnerHeartbeat('ready', 'idle', 0, now), lease_token: null }
    assert.equal(parseRunnerHeartbeatRequest(body, at), null)
  })
})
