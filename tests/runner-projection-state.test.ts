import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MagicEditActivationV1Schema,
  MagicEditDirectionV1Schema,
  MagicEditReturnToParentV1Schema,
  RunnerCommandEnvelopeV1Schema,
  RunnerProjectRequestV1Schema,
  runnerCommandHashInputV1,
  runnerProjectProjectionHashInputV1,
  type RunnerProjectPlatformStateV1,
  type RunnerProjectProjectionV1,
  type RunnerProjectRequestV1,
} from '@mindmake/contracts'
import {
  acknowledgeRunnerCommandPlatformState,
  acknowledgeRunnerProject,
  assertRunnerCommandHasAcknowledgedCursor,
  assertRunnerPlatformCanProject,
  assertRunnerProjectHasNoPendingCommandReceipt,
  ControlPlaneRequestError,
  desiredRunnerProjectPlatformState,
  hashValue,
  inspectDurableProcessInstance,
  loadAcknowledgedRunnerProjectCursor,
  loadOrCreateRunnerIdentity,
  persistPendingRunnerProject,
  persistClaimedCommandJournal,
  quarantinePendingRunnerProject,
  resetRunnerReceiptSigningKeyProviderForTests,
  resolveRunnerProjectConflict,
  runnerJournalsPermitPreviewRetention,
  runnerProjectJournalStatus,
  runnerStatus,
  runRunnerCycle,
  runRunnerMaintenanceUnderAuthority,
  signRunnerReceipt,
  setRunnerReceiptSigningKeyProviderForTests,
  type RunnerControlPlane,
  withJobEventLock,
  withRunnerAuthorityLock,
  withRunnerProjectStateLock,
} from '@mindmake/core'

const SIGNING_KEY = Buffer.from('runner-projection-state-test-key-is-long-enough')
const JOB_ID = 'job-projection-chain'
const H = (character: string) => character.repeat(64)
const GATES = {
  truth: { status: 'passed' as const },
  rights: { status: 'passed' as const },
  confidentiality: { status: 'passed' as const },
  transcript_fidelity: { status: 'passed' as const },
  naming: { status: 'passed' as const },
}

function state(platform: 'youtube_shorts' | 'linkedin', revision: string, artifact: string, map: string): RunnerProjectPlatformStateV1 {
  return {
    platform,
    active_revision_hash: revision,
    active_artifact_hash: artifact,
    active_candidate_hash: null,
    parent_revision_hash: null,
    parent_artifact_hash: null,
    parent_candidate_hash: null,
    semantic_target_map_hash: map,
    editorial_state: 'needs_visual_review',
    route_state: 'standard',
  }
}

function projectRequest(desired: RunnerProjectPlatformStateV1, expected: RunnerProjectPlatformStateV1 | null | undefined, id: string, source = { count: 7, chain: H('c'), revision: desired.active_revision_hash }): RunnerProjectRequestV1 {
  const projection: RunnerProjectProjectionV1 = {
    job: { job_id: JOB_ID, source_event_count: source.count, source_event_chain_hash: source.chain, source_revision_hash: source.revision, series: 'built_with_ai', mode: 'solo', target_platforms: ['youtube_shorts', 'linkedin'], stage: 'treatment', status: 'active', safe_title: 'Projection test', safe_summary: 'A redacted state transition fixture.' },
    ...(expected === undefined ? {} : { expected_platform_state: expected }),
    platform_state: desired,
    review: {
      id,
      gate: 'treatment',
      safe_title: 'Projection test',
      safe_summary: 'A redacted state transition fixture.',
      parent_revision_hash: desired.active_revision_hash,
      parent_artifact_hash: desired.active_artifact_hash,
      revision_hash: desired.active_revision_hash,
      artifact_hash: desired.active_artifact_hash,
      candidate_hash: null,
      route_state: desired.route_state,
      hard_gates: GATES,
      created_at: '2026-09-05T09:00:00.000Z',
      safe_payload: {
        direction: 'Review the current treatment.',
        change_title: 'Projection test',
        change_summary: 'No private media is projected.',
        range_label: 'Full treatment',
        changes: [],
        blocking_gates: GATES,
        target: { kind: 'range', start_ms: 0, end_ms: 5_000 },
        semantic_target_map_hash: desired.semantic_target_map_hash,
      },
    },
  }
  const projectionHash = hashValue(runnerProjectProjectionHashInputV1(projection))
  return RunnerProjectRequestV1Schema.parse({ schema_version: 1, runner_id: 'runner-projection-test', software_commit: 'a'.repeat(40), idempotency_key: id, projection_hash: projectionHash, projection })
}

function activationCommand(input: { id: string; commandId: string; candidate: string; revision: string; artifact: string; prepared: string; map: string; occurredAt: string }) {
  const payload = MagicEditActivationV1Schema.parse({
    schema_version: 1,
    activation_id: input.id,
    job_id: JOB_ID,
    platform: 'youtube_shorts',
    candidate_hash: input.candidate,
    expected_parent_revision_hash: input.revision,
    expected_parent_artifact_hash: input.artifact,
    prepared_treatment_artifact_hash: input.prepared,
    decision: 'activate',
    approved_by: 'Krish',
    confirmation_ref: `control-center-confirmation:treatment:${input.prepared}:review:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:decision:${input.id}`,
    occurred_at: input.occurredAt,
  })
  const draft = RunnerCommandEnvelopeV1Schema.parse({
    schema_version: 1,
    command_id: input.commandId,
    command_kind: 'magic_edit_activate',
    job_id: JOB_ID,
    platform: 'youtube_shorts',
    candidate_hash: input.candidate,
    expected_parent_revision_hash: input.revision,
    expected_parent_artifact_hash: input.artifact,
    semantic_target_map_hash: input.map,
    idempotency_key: input.id,
    payload_hash: hashValue(payload),
    command_hash: H('0'),
    issued_at: input.occurredAt,
    expires_at: '2026-09-06T12:00:00.000Z',
    payload,
  })
  return RunnerCommandEnvelopeV1Schema.parse({ ...draft, command_hash: hashValue(runnerCommandHashInputV1(draft)) })
}

function returnCommand(input: { id: string; commandId: string; candidate: string; revision: string; artifact: string; targetRevision: string; targetArtifact: string; occurredAt: string }) {
  const payload = MagicEditReturnToParentV1Schema.parse({
    schema_version: 1,
    return_id: input.id,
    job_id: JOB_ID,
    platform: 'youtube_shorts',
    expected_parent_revision_hash: input.revision,
    expected_parent_artifact_hash: input.artifact,
    target_parent_revision_hash: input.targetRevision,
    target_parent_artifact_hash: input.targetArtifact,
    returned_by: 'Krish',
    occurred_at: input.occurredAt,
  })
  const draft = RunnerCommandEnvelopeV1Schema.parse({
    schema_version: 1,
    command_id: input.commandId,
    command_kind: 'magic_edit_return_to_parent',
    job_id: JOB_ID,
    platform: 'youtube_shorts',
    candidate_hash: input.candidate,
    expected_parent_revision_hash: input.revision,
    expected_parent_artifact_hash: input.artifact,
    semantic_target_map_hash: null,
    idempotency_key: input.id,
    payload_hash: hashValue(payload),
    command_hash: H('0'),
    issued_at: input.occurredAt,
    expires_at: '2026-09-06T12:00:00.000Z',
    payload,
  })
  return RunnerCommandEnvelopeV1Schema.parse({ ...draft, command_hash: hashValue(runnerCommandHashInputV1(draft)) })
}

function prepareCommand(revision: string, artifact: string, map: string, platform: 'youtube_shorts' | 'linkedin' = 'youtube_shorts') {
  const payload = MagicEditDirectionV1Schema.parse({
    schema_version: 1,
    direction_id: '77777777-7777-4777-8777-777777777777',
    job_id: JOB_ID,
    platform,
    expected_parent_revision_hash: revision,
    expected_parent_artifact_hash: artifact,
    semantic_target_map_hash: map,
    selection: { kind: 'range', start_ms: 0, end_ms: 2_000 },
    instruction: 'Push in slightly on the proof.',
    protections: { preserve_spoken_words: true, preserve_spoken_order: true, preserve_claims: true, preserve_evidence: true, preserve_rights: true },
    requested_profile: 'preview',
    submitted_by: 'Krish',
    submitted_at: '2026-09-05T09:04:00.000Z',
  })
  const draft = RunnerCommandEnvelopeV1Schema.parse({ schema_version: 1, command_id: '78787878-7878-4878-8878-787878787878', command_kind: 'magic_edit_prepare', job_id: JOB_ID, platform, candidate_hash: null, expected_parent_revision_hash: revision, expected_parent_artifact_hash: artifact, semantic_target_map_hash: map, idempotency_key: payload.direction_id, payload_hash: hashValue(payload), command_hash: H('0'), issued_at: payload.submitted_at, expires_at: '2026-09-06T12:00:00.000Z', payload })
  return RunnerCommandEnvelopeV1Schema.parse({ ...draft, command_hash: hashValue(runnerCommandHashInputV1(draft)) })
}

function successfulReceipt(command: ReturnType<typeof activationCommand> | ReturnType<typeof returnCommand>, revision: string, artifact: string, map: string, finishedAt: string, sourceCount: number, sourceChain: string) {
  return signRunnerReceipt({
    schema_version: 1,
    command_id: command.command_id,
    command_hash: command.command_hash,
    job_id: command.job_id,
    status: 'succeeded',
    result_revision_hash: revision,
    result_artifact_hash: artifact,
    result_refs: { semantic_target_map_hash: map, comparison_alignment: 'unavailable', result_source_event_count: sourceCount, result_source_event_chain_hash: sourceChain, result_source_revision_hash: revision },
    hard_gates: GATES,
    retryable: false,
    safe_code: null,
    started_at: command.issued_at,
    finished_at: finishedAt,
  }, SIGNING_KEY)
}

describe('signed acknowledged runner project state', () => {
  let runtimeRoot = ''

  afterEach(async () => {
    resetRunnerReceiptSigningKeyProviderForTests()
    if (runtimeRoot) await rm(runtimeRoot, { recursive: true, force: true })
    runtimeRoot = ''
  })

  it('preserves final-gate lineage and supports C1 to C2 to return to C1 to return to base without cross-platform mutation', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-cursor-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const initialPending = await persistPendingRunnerProject(projectRequest(base, null, '11111111-1111-4111-8111-111111111111'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(initialPending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)

    const linkedInBase = state('linkedin', H('1'), H('b'), H('c'))
    const linkedInPending = await persistPendingRunnerProject(projectRequest(linkedInBase, null, '12121212-1212-4212-8212-121212121212', { count: 7, chain: H('c'), revision: H('1') }), SIGNING_KEY, '2026-09-05T09:00:02.000Z', runtimeRoot)
    const linkedInCursor = await acknowledgeRunnerProject(linkedInPending, SIGNING_KEY, '2026-09-05T09:00:03.000Z', runtimeRoot)

    const c1 = H('4')
    const activateOne = activationCommand({ id: '22222222-2222-4222-8222-222222222222', commandId: '23232323-2323-4232-8232-232323232323', candidate: c1, revision: H('1'), artifact: H('2'), prepared: H('5'), map: H('3'), occurredAt: '2026-09-05T09:01:00.000Z' })
    const receiptOne = successfulReceipt(activateOne, H('6'), H('5'), H('7'), '2026-09-05T09:01:01.000Z', 8, H('8'))
    const afterOne = await acknowledgeRunnerCommandPlatformState(activateOne, receiptOne, SIGNING_KEY, runtimeRoot)
    expect(afterOne.acknowledged_platform_state).toMatchObject({ active_revision_hash: H('6'), active_artifact_hash: H('5'), active_candidate_hash: c1, parent_revision_hash: H('1'), parent_artifact_hash: H('2'), parent_candidate_hash: null })
    expect(afterOne.undo_ancestry).toEqual([{ revision_hash: H('1'), artifact_hash: H('2'), candidate_hash: null }])
    expect(await acknowledgeRunnerCommandPlatformState(activateOne, receiptOne, SIGNING_KEY, runtimeRoot)).toEqual(afterOne)
    await expect(assertRunnerPlatformCanProject(JOB_ID, 'linkedin', SIGNING_KEY, runtimeRoot)).rejects.toThrow('blocked until return to root')
    await expect(assertRunnerCommandHasAcknowledgedCursor(prepareCommand(H('1'), H('b'), H('c'), 'linkedin'), SIGNING_KEY, runtimeRoot)).rejects.toThrow('blocked until return to root')

    const finalState = desiredRunnerProjectPlatformState({ platform: 'youtube_shorts', active_revision_hash: H('8'), active_artifact_hash: H('5'), semantic_target_map_hash: H('9'), editorial_state: 'needs_final_review', route_state: 'standard' }, afterOne)
    expect(finalState).toMatchObject({ active_candidate_hash: c1, parent_revision_hash: H('1'), parent_artifact_hash: H('2') })
    const finalPending = await persistPendingRunnerProject(projectRequest(finalState, afterOne.acknowledged_platform_state, '33333333-3333-4333-8333-333333333333', { count: 9, chain: H('9'), revision: H('8') }), SIGNING_KEY, '2026-09-05T09:02:00.000Z', runtimeRoot)
    const afterFinal = await acknowledgeRunnerProject(finalPending, SIGNING_KEY, '2026-09-05T09:02:01.000Z', runtimeRoot)
    await expect(assertRunnerCommandHasAcknowledgedCursor(prepareCommand(H('8'), H('5'), H('9')), SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ cursor_hash: afterFinal.cursor_hash })

    const c2 = H('d')
    const activateTwo = activationCommand({ id: '44444444-4444-4444-8444-444444444444', commandId: '45454545-4545-4454-8454-454545454545', candidate: c2, revision: H('8'), artifact: H('5'), prepared: H('e'), map: H('9'), occurredAt: '2026-09-05T09:03:00.000Z' })
    const receiptTwo = successfulReceipt(activateTwo, H('f'), H('e'), H('0'), '2026-09-05T09:03:01.000Z', 10, H('a'))
    const afterTwo = await acknowledgeRunnerCommandPlatformState(activateTwo, receiptTwo, SIGNING_KEY, runtimeRoot)
    expect(afterTwo.undo_ancestry).toEqual([
      { revision_hash: H('8'), artifact_hash: H('5'), candidate_hash: c1 },
      { revision_hash: H('1'), artifact_hash: H('2'), candidate_hash: null },
    ])

    const returnToOne = returnCommand({ id: '55555555-5555-4555-8555-555555555555', commandId: '56565656-5656-4656-8656-565656565656', candidate: c2, revision: H('f'), artifact: H('e'), targetRevision: H('8'), targetArtifact: H('5'), occurredAt: '2026-09-05T09:05:00.000Z' })
    const returnOneReceipt = successfulReceipt(returnToOne, H('a'), H('5'), H('b'), '2026-09-05T09:05:01.000Z', 11, H('b'))
    const returnedOne = await acknowledgeRunnerCommandPlatformState(returnToOne, returnOneReceipt, SIGNING_KEY, runtimeRoot)
    expect(returnedOne.acknowledged_platform_state).toMatchObject({ active_revision_hash: H('a'), active_artifact_hash: H('5'), active_candidate_hash: c1, parent_revision_hash: H('1'), parent_artifact_hash: H('2'), parent_candidate_hash: null })
    expect(returnedOne.undo_ancestry).toEqual([{ revision_hash: H('1'), artifact_hash: H('2'), candidate_hash: null }])
    expect(await acknowledgeRunnerCommandPlatformState(returnToOne, returnOneReceipt, SIGNING_KEY, runtimeRoot)).toEqual(returnedOne)

    const returnToBase = returnCommand({ id: '66666666-6666-4666-8666-666666666666', commandId: '67676767-6767-4676-8676-676767676767', candidate: c1, revision: H('a'), artifact: H('5'), targetRevision: H('1'), targetArtifact: H('2'), occurredAt: '2026-09-05T09:06:00.000Z' })
    const returnBaseReceipt = successfulReceipt(returnToBase, H('c'), H('2'), H('d'), '2026-09-05T09:06:01.000Z', 12, H('d'))
    const returnedBase = await acknowledgeRunnerCommandPlatformState(returnToBase, returnBaseReceipt, SIGNING_KEY, runtimeRoot)
    expect(returnedBase.acknowledged_platform_state).toMatchObject({ active_revision_hash: H('c'), active_artifact_hash: H('2'), active_candidate_hash: null, parent_revision_hash: null, parent_artifact_hash: null, parent_candidate_hash: null })
    expect(returnedBase.undo_ancestry).toEqual([])
    await expect(assertRunnerPlatformCanProject(JOB_ID, 'linkedin', SIGNING_KEY, runtimeRoot)).resolves.toBeUndefined()

    expect(await loadAcknowledgedRunnerProjectCursor(JOB_ID, 'linkedin', SIGNING_KEY, runtimeRoot)).toEqual(linkedInCursor)
  })

  it('fails closed on tampered cursor state and divergent active lineage', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-cursor-tamper-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const pending = await persistPendingRunnerProject(projectRequest(base, null, '89898989-8989-4989-8989-898989898989'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    const cursor = await acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const activation = activationCommand({ id: '90909090-9090-4090-8090-909090909090', commandId: '91919191-9191-4191-8191-919191919191', candidate: H('4'), revision: H('1'), artifact: H('2'), prepared: H('5'), map: H('3'), occurredAt: '2026-09-05T09:01:00.000Z' })
    const activated = await acknowledgeRunnerCommandPlatformState(activation, successfulReceipt(activation, H('6'), H('5'), H('7'), '2026-09-05T09:01:01.000Z', 8, H('8')), SIGNING_KEY, runtimeRoot)
    expect(() => desiredRunnerProjectPlatformState({ platform: 'youtube_shorts', active_revision_hash: H('8'), active_artifact_hash: H('9'), semantic_target_map_hash: H('a'), editorial_state: 'needs_final_review', route_state: 'standard' }, activated)).toThrow('diverged')
    expect(cursor.cursor_hash).not.toBe(activated.cursor_hash)

    const path = join(runtimeRoot, 'runner', 'project-state', JOB_ID, 'youtube_shorts', 'acknowledged.json')
    const stored = JSON.parse(await readFile(path, 'utf8'))
    stored.acknowledged_platform_state.active_revision_hash = H('e')
    await writeFile(path, `${JSON.stringify(stored, null, 2)}\n`)
    await expect(loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)).rejects.toThrow('failed authentication')
    await expect(access(path)).resolves.toBeUndefined()
  })

  it('serializes a delayed project acknowledgement against command completion without regressing the cursor', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-cursor-race-'))
    const previous = state('youtube_shorts', H('1'), H('2'), H('3'))
    const first = await persistPendingRunnerProject(projectRequest(previous, null, '01010101-0101-4101-8101-010101010101'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    const previousCursor = await acknowledgeRunnerProject(first, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const projected = desiredRunnerProjectPlatformState({ platform: 'youtube_shorts', active_revision_hash: H('4'), active_artifact_hash: H('2'), semantic_target_map_hash: H('5'), editorial_state: 'needs_visual_review', route_state: 'standard' }, previousCursor)
    const pending = await persistPendingRunnerProject(projectRequest(projected, previous, '02020202-0202-4202-8202-020202020202', { count: 8, chain: H('5'), revision: H('4') }), SIGNING_KEY, '2026-09-05T09:00:02.000Z', runtimeRoot)
    const activation = activationCommand({ id: '03030303-0303-4303-8303-030303030303', commandId: '04040404-0404-4404-8404-040404040404', candidate: H('6'), revision: H('4'), artifact: H('2'), prepared: H('7'), map: H('5'), occurredAt: '2026-09-05T09:01:00.000Z' })
    const receipt = successfulReceipt(activation, H('8'), H('7'), H('9'), '2026-09-05T09:01:01.000Z', 9, H('6'))

    const raced = await Promise.allSettled([
      acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:00:03.000Z', runtimeRoot),
      acknowledgeRunnerCommandPlatformState(activation, receipt, SIGNING_KEY, runtimeRoot),
    ])
    if (raced[1]?.status === 'rejected') await acknowledgeRunnerCommandPlatformState(activation, receipt, SIGNING_KEY, runtimeRoot)
    const current = await loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)
    expect(current?.acknowledged_platform_state).toMatchObject({ active_revision_hash: H('8'), active_artifact_hash: H('7'), active_candidate_hash: H('6'), parent_revision_hash: H('4'), parent_artifact_hash: H('2') })

    await expect(acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:02:00.000Z', runtimeRoot)).rejects.toThrow('exact acknowledged cursor')
    expect((await loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot))?.cursor_hash).toBe(current?.cursor_hash)
  })

  it('replays and acknowledges a pending project before the daemon can claim a command', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-pending-replay-'))
    const initial = state('youtube_shorts', H('1'), H('2'), H('3'))
    const request = projectRequest(initial, null, '05050505-0505-4505-8505-050505050505')
    await persistPendingRunnerProject(request, SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    const calls: string[] = []
    const client: RunnerControlPlane = {
      project: async (input) => {
        calls.push('project')
        expect(input.projection).toEqual(request.projection)
        return { duplicate: true, projection_hash: request.projection_hash, job_id: JOB_ID, platform: 'youtube_shorts' }
      },
      heartbeat: async () => { calls.push('heartbeat'); return {} },
      claim: async () => { calls.push('claim'); return null },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, now: () => new Date('2026-09-05T09:00:01.000Z') })).resolves.toEqual({ state: 'idle' })
    expect(calls).toEqual(['project', 'heartbeat', 'claim'])
    await expect(access(join(runtimeRoot, 'runner', 'project-state', JOB_ID, 'youtube_shorts', 'pending.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ acknowledged_platform_state: initial })

    const replayedPending = await persistPendingRunnerProject(request, SIGNING_KEY, '2026-09-05T09:00:02.000Z', runtimeRoot)
    await acknowledgeRunnerProject(replayedPending, SIGNING_KEY, '2026-09-05T09:00:03.000Z', runtimeRoot)
    await expect(access(join(runtimeRoot, 'runner', 'project-state', JOB_ID, 'youtube_shorts', 'pending.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('blocks manual projection while an authenticated state-changing receipt is pending cloud acknowledgement', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-pending-command-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const pending = await persistPendingRunnerProject(projectRequest(base, null, '13131313-1313-4313-8313-131313131313'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const activation = activationCommand({ id: '14141414-1414-4414-8414-141414141414', commandId: '15151515-1515-4515-8515-151515151515', candidate: H('4'), revision: H('1'), artifact: H('2'), prepared: H('5'), map: H('3'), occurredAt: '2026-09-05T09:01:00.000Z' })
    const receipt = successfulReceipt(activation, H('6'), H('5'), H('7'), '2026-09-05T09:01:01.000Z', 8, H('8'))
    await persistClaimedCommandJournal(activation, 'runner-projection-test', SIGNING_KEY, '2026-09-05T09:01:00.000Z', runtimeRoot)
    const receiptDirectory = join(runtimeRoot, 'runner', 'receipts', 'pending', activation.idempotency_key)
    await mkdir(receiptDirectory, { recursive: true })
    await writeFile(join(receiptDirectory, `${activation.command_id}.json`), `${JSON.stringify({ schema_version: 1, idempotency_key: activation.idempotency_key, runner_id: 'runner-projection-test', lease_token: 'lease-token-long-enough-for-pending-test', receipt }, null, 2)}\n`)

    await expect(assertRunnerProjectHasNoPendingCommandReceipt(JOB_ID, SIGNING_KEY, runtimeRoot)).rejects.toThrow('pending command receipt')
    const oldCursor = await loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)
    expect(desiredRunnerProjectPlatformState({ platform: 'youtube_shorts', active_revision_hash: H('6'), active_artifact_hash: H('5'), semantic_target_map_hash: H('7'), editorial_state: 'needs_final_review', route_state: 'standard' }, oldCursor).active_candidate_hash).toBeNull()

    let completed = 0
    const client: RunnerControlPlane = {
      project: async () => { throw new Error('project replay must wait until the receipt is reconciled') },
      heartbeat: async () => ({}),
      claim: async () => null,
      complete: async ({ receipt: submitted }) => {
        completed += 1
        expect(submitted.receipt_hash).toBe(receipt.receipt_hash)
        return { duplicate: true, command_id: submitted.command_id, receipt_hash: submitted.receipt_hash, command_status: 'succeeded' }
      },
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, now: () => new Date('2026-09-05T09:02:00.000Z') })).resolves.toEqual({ state: 'idle' })
    expect(completed).toBe(1)
    await expect(loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ acknowledged_platform_state: { active_candidate_hash: H('4'), active_artifact_hash: H('5') } })
    await expect(access(join(receiptDirectory, `${activation.command_id}.json`))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not project or execute a different same-job prepare while an older completion acknowledgement is indeterminate', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-pending-prepare-fence-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const pending = await persistPendingRunnerProject(projectRequest(base, null, '29292929-2929-4929-8929-292929292929'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const prepare = prepareCommand(H('1'), H('2'), H('3'))
    const receipt = signRunnerReceipt({
      schema_version: 1,
      command_id: prepare.command_id,
      command_hash: prepare.command_hash,
      job_id: prepare.job_id,
      status: 'succeeded',
      result_revision_hash: H('4'),
      result_artifact_hash: H('5'),
      result_refs: { semantic_target_map_hash: H('3'), comparison_alignment: 'unavailable', result_source_event_count: 8, result_source_event_chain_hash: H('6'), result_source_revision_hash: H('1') },
      hard_gates: GATES,
      retryable: false,
      safe_code: null,
      started_at: '2026-09-05T09:01:00.000Z',
      finished_at: '2026-09-05T09:01:01.000Z',
    }, SIGNING_KEY)
    await persistClaimedCommandJournal(prepare, 'runner-projection-test', SIGNING_KEY, '2026-09-05T09:01:00.000Z', runtimeRoot)
    const receiptDirectory = join(runtimeRoot, 'runner', 'receipts', 'pending', prepare.idempotency_key)
    await mkdir(receiptDirectory, { recursive: true })
    await writeFile(join(receiptDirectory, `${prepare.command_id}.json`), `${JSON.stringify({ schema_version: 1, idempotency_key: prepare.idempotency_key, runner_id: 'runner-projection-test', lease_token: 'prepare-pending-lease-token-long-enough', receipt }, null, 2)}\n`)
    const otherPayload = MagicEditDirectionV1Schema.parse({ ...prepare.payload, direction_id: '30303030-3030-4030-8030-303030303030' })
    const otherDraft = RunnerCommandEnvelopeV1Schema.parse({ ...prepare, command_id: '31313131-3131-4131-8131-313131313131', idempotency_key: otherPayload.direction_id, payload: otherPayload, payload_hash: hashValue(otherPayload), command_hash: H('0') })
    const otherPrepare = RunnerCommandEnvelopeV1Schema.parse({ ...otherDraft, command_hash: hashValue(runnerCommandHashInputV1(otherDraft)) })
    let completions = 0
    let claims = 0
    let projections = 0
    const heartbeats: Array<{ status: string; pending_receipts: number }> = []
    const client: RunnerControlPlane = {
      project: async () => { projections += 1; throw new Error('project must remain fenced') },
      heartbeat: async (value) => { heartbeats.push(value); return {} },
      claim: async () => {
        claims += 1
        return claims === 1 ? { command: otherPrepare, lease: { token: 'different-prepare-lease-token-long-enough', expires_at: '2026-09-06T12:00:00.000Z' } } : null
      },
      complete: async ({ receipt: submitted }) => {
        completions += 1
        if (completions === 1) throw new Error('completion response is indeterminate')
        return { duplicate: true, command_id: submitted.command_id, receipt_hash: submitted.receipt_hash, command_status: 'succeeded' }
      },
    }
    const options = { client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready' as const, runtimeRoot, now: () => new Date('2026-09-05T09:02:00.000Z') }
    await expect(runRunnerCycle(options)).rejects.toThrow('conflicts with an authenticated pending receipt')
    expect({ completions, claims, projections }).toEqual({ completions: 1, claims: 1, projections: 0 })
    expect(heartbeats.at(-1)).toMatchObject({ status: 'degraded', pending_receipts: 1 })
    await expect(loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ acknowledged_source_event_count: 7 })

    await expect(runRunnerCycle(options)).resolves.toEqual({ state: 'idle' })
    expect({ completions, claims, projections }).toEqual({ completions: 2, claims: 2, projections: 0 })
    await expect(loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ acknowledged_source_event_count: 8, acknowledged_source_revision_hash: H('1') })
    await expect(access(join(receiptDirectory, `${prepare.command_id}.json`))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('allows an unrelated job to run while a verified pending receipt fences only its own job', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-pending-receipt-other-job-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const pending = await persistPendingRunnerProject(projectRequest(base, null, '32323232-3232-4232-8232-323232323232'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const blocked = prepareCommand(H('1'), H('2'), H('3'))
    const blockedReceipt = signRunnerReceipt({ schema_version: 1, command_id: blocked.command_id, command_hash: blocked.command_hash, job_id: blocked.job_id, status: 'succeeded', result_revision_hash: H('4'), result_artifact_hash: H('5'), result_refs: { semantic_target_map_hash: H('3'), comparison_alignment: 'unavailable', result_source_event_count: 8, result_source_event_chain_hash: H('6'), result_source_revision_hash: H('1') }, hard_gates: GATES, retryable: false, safe_code: null, started_at: '2026-09-05T09:01:00.000Z', finished_at: '2026-09-05T09:01:01.000Z' }, SIGNING_KEY)
    await persistClaimedCommandJournal(blocked, 'runner-projection-test', SIGNING_KEY, '2026-09-05T09:01:00.000Z', runtimeRoot)
    const blockedDirectory = join(runtimeRoot, 'runner', 'receipts', 'pending', blocked.idempotency_key)
    await mkdir(blockedDirectory, { recursive: true })
    await writeFile(join(blockedDirectory, `${blocked.command_id}.json`), `${JSON.stringify({ schema_version: 1, idempotency_key: blocked.idempotency_key, runner_id: 'runner-projection-test', lease_token: 'blocked-other-job-lease-token-long-enough', receipt: blockedReceipt }, null, 2)}\n`)

    const unrelatedPayload = MagicEditDirectionV1Schema.parse({ ...blocked.payload, direction_id: '33333333-3232-4232-8232-323232323232', job_id: 'job-unrelated-pending-receipt' })
    const unrelatedDraft = RunnerCommandEnvelopeV1Schema.parse({ ...blocked, command_id: '34343434-3434-4434-8434-343434343434', job_id: unrelatedPayload.job_id, idempotency_key: unrelatedPayload.direction_id, payload: unrelatedPayload, payload_hash: hashValue(unrelatedPayload), command_hash: H('0') })
    const unrelated = RunnerCommandEnvelopeV1Schema.parse({ ...unrelatedDraft, command_hash: hashValue(runnerCommandHashInputV1(unrelatedDraft)) })
    let dispatches = 0
    let claims = 0
    const client: RunnerControlPlane = {
      heartbeat: async () => ({}),
      claim: async () => { claims += 1; return { command: unrelated, lease: { token: 'unrelated-job-lease-token-long-enough', expires_at: '2026-09-06T12:00:00.000Z' } } },
      complete: async ({ lease_token, receipt }) => {
        if (lease_token === 'blocked-other-job-lease-token-long-enough') throw new Error('blocked job completion remains indeterminate')
        return { duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }
      },
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, now: () => new Date('2026-09-05T09:02:00.000Z'), dispatch: async () => { dispatches += 1; return { status: 'succeeded', result_revision_hash: H('7'), result_artifact_hash: H('8'), result_refs: { comparison_alignment: 'unavailable', result_source_event_count: 1, result_source_event_chain_hash: H('9'), result_source_revision_hash: H('7') }, hard_gates: GATES } } })).resolves.toMatchObject({ state: 'completed', command_id: unrelated.command_id })
    expect({ claims, dispatches }).toEqual({ claims: 1, dispatches: 1 })
    await expect(runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ pending_projects: 0, conflicted_projects: 0 })
    await expect(access(join(blockedDirectory, `${blocked.command_id}.json`))).resolves.toBeUndefined()
  })

  it('rebinds an exact reclaimed receipt to the latest lease before another lost response', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-pending-receipt-lease-rebind-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const pending = await persistPendingRunnerProject(projectRequest(base, null, '42424242-4242-4242-8242-424242424242'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const prepare = prepareCommand(H('1'), H('2'), H('3'))
    const beforePath = join(runtimeRoot, 'before-preview.mp4')
    const afterPath = join(runtimeRoot, 'after-preview.mp4')
    const beforeBytes = Buffer.from('exact-before-preview-restoration')
    const afterBytes = Buffer.from('exact-after-preview-restoration')
    await writeFile(beforePath, beforeBytes)
    await writeFile(afterPath, afterBytes)
    const beforeHash = createHash('sha256').update(beforeBytes).digest('hex')
    const afterHash = createHash('sha256').update(afterBytes).digest('hex')
    const beforeMd5 = createHash('md5').update(beforeBytes).digest('hex')
    const afterMd5 = createHash('md5').update(afterBytes).digest('hex')
    const reviewId = '42424242-4343-4434-8434-424242424242'
    const reviewPayload = projectRequest(base, base, reviewId).projection.review.safe_payload
    const receipt = signRunnerReceipt({
      schema_version: 1,
      command_id: prepare.command_id,
      command_hash: prepare.command_hash,
      job_id: prepare.job_id,
      status: 'succeeded',
      result_revision_hash: H('4'),
      result_artifact_hash: H('5'),
      result_refs: {
        semantic_target_map_hash: H('3'),
        result_source_event_count: 8,
        result_source_event_chain_hash: H('6'),
        result_source_revision_hash: H('1'),
        review_id: reviewId,
        candidate_hash: H('4'),
        safe_title: 'Exact preview restoration',
        safe_summary: 'The immutable preview objects are restored under a fresh lease.',
        review_payload: reviewPayload,
        before_preview_object_key: `commands/${prepare.command_id}/previews/before/${beforeHash}.mp4`,
        before_preview_hash: beforeHash,
        before_preview_md5: beforeMd5,
        before_preview_byte_size: beforeBytes.length,
        after_preview_object_key: `commands/${prepare.command_id}/previews/after/${afterHash}.mp4`,
        after_preview_hash: afterHash,
        after_preview_md5: afterMd5,
        after_preview_byte_size: afterBytes.length,
        comparison_alignment: 'exact',
        comparison_start_ms: 0,
        comparison_end_ms: 2_000,
      },
      hard_gates: GATES,
      retryable: false,
      safe_code: null,
      started_at: '2026-09-05T09:01:00.000Z',
      finished_at: '2026-09-05T09:01:01.000Z',
    }, SIGNING_KEY)
    await persistClaimedCommandJournal(prepare, 'runner-projection-test', SIGNING_KEY, '2026-09-05T09:01:00.000Z', runtimeRoot)
    const receiptDirectory = join(runtimeRoot, 'runner', 'receipts', 'pending', prepare.idempotency_key)
    const receiptPath = join(receiptDirectory, `${prepare.command_id}.json`)
    await mkdir(receiptDirectory, { recursive: true })
    await writeFile(receiptPath, `${JSON.stringify({ schema_version: 1, idempotency_key: prepare.idempotency_key, runner_id: 'runner-projection-test', lease_token: 'lease-l1-token-long-enough-for-test', receipt }, null, 2)}\n`)
    const completionLeases: string[] = []
    const restoredSides: string[] = []
    let claims = 0
    const client: RunnerControlPlane = {
      heartbeat: async () => ({}),
      claim: async () => { claims += 1; return claims === 1 ? { command: prepare, lease: { token: 'lease-l2-token-long-enough-for-test', expires_at: '2026-09-06T12:00:00.000Z' } } : null },
      uploadPreviewFile: async (input) => {
        restoredSides.push(input.side)
        return { object_key: `commands/${input.command_id}/previews/${input.side}/${input.sha256}.mp4` }
      },
      complete: async ({ lease_token, receipt: submitted }) => {
        completionLeases.push(lease_token)
        if (completionLeases.length < 3) throw new Error('completion response remains indeterminate')
        return { duplicate: true, command_id: submitted.command_id, receipt_hash: submitted.receipt_hash, command_status: 'succeeded' }
      },
    }
    const options = {
      client,
      runnerId: 'runner-projection-test',
      softwareCommit: 'a'.repeat(40),
      signingKey: SIGNING_KEY,
      driveState: 'ready' as const,
      runtimeRoot,
      now: () => new Date('2026-09-05T09:02:00.000Z'),
      renderComparisonPreview: async () => ({ before_path: beforePath, before_hash: beforeHash, after_path: afterPath, after_hash: afterHash, comparison_start_ms: 0, comparison_end_ms: 2_000 }),
    }
    await expect(runRunnerCycle(options)).rejects.toThrow('response remains indeterminate')
    expect(completionLeases).toEqual(['lease-l1-token-long-enough-for-test', 'lease-l2-token-long-enough-for-test'])
    expect(restoredSides).toEqual(['before', 'after'])
    expect(JSON.parse(await readFile(receiptPath, 'utf8'))).toMatchObject({ lease_token: 'lease-l2-token-long-enough-for-test', receipt: { receipt_hash: receipt.receipt_hash } })

    await expect(runRunnerCycle(options)).resolves.toEqual({ state: 'idle' })
    expect(completionLeases).toEqual(['lease-l1-token-long-enough-for-test', 'lease-l2-token-long-enough-for-test', 'lease-l2-token-long-enough-for-test'])
    await expect(access(receiptPath)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ acknowledged_source_event_count: 8, acknowledged_source_revision_hash: H('1') })
  })

  it('fails an exact pending-receipt reclaim closed across runner identities', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-pending-receipt-runner-identity-'))
    const command = prepareCommand(H('1'), H('2'), H('3'))
    const receipt = signRunnerReceipt({ schema_version: 1, command_id: command.command_id, command_hash: command.command_hash, job_id: command.job_id, status: 'succeeded', result_revision_hash: H('4'), result_artifact_hash: H('5'), result_refs: { semantic_target_map_hash: H('3'), comparison_alignment: 'unavailable', result_source_event_count: 8, result_source_event_chain_hash: H('6'), result_source_revision_hash: H('1') }, hard_gates: GATES, retryable: false, safe_code: null, started_at: '2026-09-05T09:01:00.000Z', finished_at: '2026-09-05T09:01:01.000Z' }, SIGNING_KEY)
    await persistClaimedCommandJournal(command, 'runner-original', SIGNING_KEY, command.issued_at, runtimeRoot)
    const receiptDirectory = join(runtimeRoot, 'runner', 'receipts', 'pending', command.idempotency_key)
    await mkdir(receiptDirectory, { recursive: true })
    await writeFile(join(receiptDirectory, `${command.command_id}.json`), `${JSON.stringify({ schema_version: 1, idempotency_key: command.idempotency_key, runner_id: 'runner-original', lease_token: 'original-runner-lease-token-long-enough', receipt }, null, 2)}\n`)
    const calls = { complete: 0, claim: 0 }
    const client: RunnerControlPlane = {
      heartbeat: async () => ({}),
      claim: async () => { calls.claim += 1; return { command, lease: { token: 'different-runner-lease-token-long-enough', expires_at: '2026-09-06T12:00:00.000Z' } } },
      complete: async ({ receipt: submitted }) => { calls.complete += 1; return { duplicate: false, command_id: submitted.command_id, receipt_hash: submitted.receipt_hash, command_status: 'succeeded' } },
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-different', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot })).rejects.toThrow('identity validation')
    expect(calls).toEqual({ complete: 0, claim: 0 })
  })

  it('quarantines a late receipt when an operator recovery already won and surfaces persistent path-free attention', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-receipt-recovery-conflict-'))
    const runnerId = 'runner-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const initial = await persistPendingRunnerProject(projectRequest(base, null, '43434343-4343-4343-8343-434343434343'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(initial, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const command = prepareCommand(H('1'), H('2'), H('3'))
    const receipt = signRunnerReceipt({ schema_version: 1, command_id: command.command_id, command_hash: command.command_hash, job_id: command.job_id, status: 'succeeded', result_revision_hash: H('4'), result_artifact_hash: H('5'), result_refs: { semantic_target_map_hash: H('3'), comparison_alignment: 'unavailable', result_source_event_count: 8, result_source_event_chain_hash: H('6'), result_source_revision_hash: H('1') }, hard_gates: GATES, retryable: false, safe_code: null, started_at: '2026-09-05T09:01:00.000Z', finished_at: '2026-09-05T09:01:01.000Z' }, SIGNING_KEY)
    await persistClaimedCommandJournal(command, runnerId, SIGNING_KEY, command.issued_at, runtimeRoot)
    const pendingPath = join(runtimeRoot, 'runner', 'receipts', 'pending', command.idempotency_key, `${command.command_id}.json`)
    await mkdir(join(runtimeRoot, 'runner', 'receipts', 'pending', command.idempotency_key), { recursive: true })
    await writeFile(pendingPath, `${JSON.stringify({ schema_version: 1, idempotency_key: command.idempotency_key, runner_id: runnerId, lease_token: 'recovery-conflict-lease-token-long-enough', receipt }, null, 2)}\n`)
    const blockedProject = projectRequest(base, base, '44444444-4343-4343-8343-434343434343')
    await persistPendingRunnerProject(blockedProject, SIGNING_KEY, '2026-09-05T09:01:02.000Z', runtimeRoot)
    let completions = 0
    let projections = 0
    let discoveries = 0
    let claims = 0
    const heartbeats: Array<{ status: string }> = []
    const client: RunnerControlPlane = {
      project: async () => { projections += 1; throw new Error('conflicted job must not project') },
      heartbeat: async (input) => { heartbeats.push(input); return {} },
      claim: async () => { claims += 1; return null },
      complete: async () => { completions += 1; throw new ControlPlaneRequestError('/complete', 409, 'recovery_exists') },
    }
    const options = { client, runnerId, softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready' as const, runtimeRoot, now: () => new Date('2026-09-05T09:02:00.000Z') }
    await expect(runRunnerCycle({ ...options, discoverInbox: async () => { discoveries += 1; throw new Error('receipt conflict must stop before discovery') } })).resolves.toEqual({ state: 'idle' })
    await expect(runRunnerCycle({ ...options, discoverInbox: async () => { discoveries += 1; throw new Error('receipt conflict must stop before discovery') } })).resolves.toEqual({ state: 'idle' })
    expect({ completions, projections, discoveries, claims }).toEqual({ completions: 1, projections: 0, discoveries: 0, claims: 0 })
    expect(heartbeats.at(-1)).toMatchObject({ status: 'degraded' })
    expect(runnerJournalsPermitPreviewRetention(
      { pending_receipts: 0, receipt_attention_code: 'runner_receipt_recovery_conflict' },
      { project_attention_code: null },
    )).toBe(false)
    expect(runnerJournalsPermitPreviewRetention(
      { pending_receipts: 1, receipt_attention_code: null },
      { project_attention_code: null },
    )).toBe(false)
    await expect(access(pendingPath)).rejects.toMatchObject({ code: 'ENOENT' })
    const conflictPath = join(runtimeRoot, 'runner', 'receipts', 'conflicted', command.idempotency_key, `${command.command_id}.json`)
    await expect(access(conflictPath)).resolves.toBeUndefined()

    await mkdir(join(runtimeRoot, 'runner'), { recursive: true })
    await writeFile(join(runtimeRoot, 'runner', 'identity.json'), `${JSON.stringify({ schema_version: 1, runner_id: runnerId, created_at: '2026-09-05T09:00:00.000Z' }, null, 2)}\n`)
    const priorRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
    setRunnerReceiptSigningKeyProviderForTests(() => SIGNING_KEY.toString('utf8'))
    try {
      await expect(runnerStatus()).resolves.toMatchObject({ pending_receipts: 0, receipt_journals: { pending_receipts: 0, conflicted_receipts: 1, recovery_conflicts: 1, receipt_attention_code: 'runner_receipt_recovery_conflict' } })
      const tampered = JSON.parse(await readFile(conflictPath, 'utf8'))
      tampered.quarantined_at = '2026-09-05T10:00:00.000Z'
      await writeFile(conflictPath, `${JSON.stringify(tampered, null, 2)}\n`)
      await expect(runnerStatus()).rejects.toThrow('failed authentication')
    } finally {
      if (priorRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntimeRoot
    }
  })

  it('quarantines deterministic terminal receipt conflicts and consumes no later command lease', async () => {
    for (const [safeCode, status] of [['command_in_flight', 409], ['stale_parent', 409], ['command_not_found', 404], ['job_not_found', 503]] as const) {
      runtimeRoot = await mkdtemp(join(tmpdir(), `mindmake-receipt-authority-${safeCode}-`))
      const command = prepareCommand(H('1'), H('2'), H('3'))
      const receipt = signRunnerReceipt({ schema_version: 1, command_id: command.command_id, command_hash: command.command_hash, job_id: command.job_id, status: 'succeeded', result_revision_hash: H('4'), result_artifact_hash: H('5'), result_refs: { semantic_target_map_hash: H('3'), comparison_alignment: 'unavailable', result_source_event_count: 8, result_source_event_chain_hash: H('6'), result_source_revision_hash: H('1') }, hard_gates: GATES, retryable: false, safe_code: null, started_at: '2026-09-05T09:01:00.000Z', finished_at: '2026-09-05T09:01:01.000Z' }, SIGNING_KEY)
      await persistClaimedCommandJournal(command, 'runner-projection-test', SIGNING_KEY, command.issued_at, runtimeRoot)
      const directory = join(runtimeRoot, 'runner', 'receipts', 'pending', command.idempotency_key)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, `${command.command_id}.json`), `${JSON.stringify({ schema_version: 1, idempotency_key: command.idempotency_key, runner_id: 'runner-projection-test', lease_token: 'terminal-conflict-lease-token-long-enough', receipt }, null, 2)}\n`)
      const calls = { complete: 0, project: 0, discovery: 0, claim: 0, dispatch: 0 }
      const client: RunnerControlPlane = {
        complete: async () => { calls.complete += 1; throw new ControlPlaneRequestError('/complete', status, safeCode) },
        project: async () => { calls.project += 1; throw new Error('authority conflict must stop project replay') },
        heartbeat: async () => ({}),
        claim: async () => { calls.claim += 1; throw new Error('authority conflict must not lease the different same-job command or unrelated work') },
      }
      await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, discoverInbox: async () => { calls.discovery += 1; throw new Error('authority conflict must stop discovery') }, dispatch: async () => { calls.dispatch += 1; throw new Error('authority conflict must stop dispatch') } })).resolves.toEqual({ state: 'idle' })
      expect(calls).toEqual({ complete: 1, project: 0, discovery: 0, claim: 0, dispatch: 0 })
      const conflict = JSON.parse(await readFile(join(runtimeRoot, 'runner', 'receipts', 'conflicted', command.idempotency_key, `${command.command_id}.json`), 'utf8'))
      expect(conflict).toMatchObject({ safe_code: safeCode, runner_id: 'runner-projection-test', receipt: { receipt_hash: receipt.receipt_hash } })
      await rm(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  })

  it('retires a proven uncommitted project from the cloud-claim to local-lock gap', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-command-gap-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const request = projectRequest(base, null, '24242424-2424-4424-8424-242424242424')
    await persistPendingRunnerProject(request, SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    let projectCalls = 0
    const client: RunnerControlPlane = {
      project: async () => { projectCalls += 1; throw new ControlPlaneRequestError('/project', 409, 'command_in_flight') },
      heartbeat: async () => ({}),
      claim: async () => null,
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, now: () => new Date('2026-09-05T09:00:01.000Z') })).resolves.toEqual({ state: 'idle' })
    expect(projectCalls).toBe(1)
    await expect(runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ pending_projects: 0, conflicted_projects: 0, project_attention_code: null })
    await expect(access(join(runtimeRoot, 'runner', 'project-state', JOB_ID, 'youtube_shorts', 'pending.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('aborts before mutation on an indeterminate claim-gap response, then retires and safely reclaims', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-claim-gap-network-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const basePending = await persistPendingRunnerProject(projectRequest(base, null, '25252525-2525-4525-8525-252525252525'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(basePending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const command = activationCommand({ id: '26262626-2626-4626-8626-262626262626', commandId: '27272727-2727-4727-8727-272727272727', candidate: H('4'), revision: H('1'), artifact: H('2'), prepared: H('5'), map: H('3'), occurredAt: '2026-09-05T09:01:00.000Z' })
    const racedRequest = projectRequest(base, base, '28282828-2828-4828-8828-282828282828')
    let claims = 0
    let projectCalls = 0
    let dispatches = 0
    const client: RunnerControlPlane = {
      project: async () => {
        projectCalls += 1
        if (projectCalls === 1) throw new Error('project response lost after cloud claim')
        throw new ControlPlaneRequestError('/project', 409, 'command_in_flight')
      },
      heartbeat: async () => ({}),
      claim: async () => {
        claims += 1
        if (claims === 1) await persistPendingRunnerProject(racedRequest, SIGNING_KEY, '2026-09-05T09:01:01.000Z', runtimeRoot)
        return { command, lease: { token: `claim-gap-lease-${claims}-long-enough`, expires_at: '2026-09-06T12:00:00.000Z' } }
      },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    const options = {
      client,
      runnerId: 'runner-projection-test',
      softwareCommit: 'a'.repeat(40),
      signingKey: SIGNING_KEY,
      driveState: 'ready' as const,
      runtimeRoot,
      now: () => new Date('2026-09-05T09:02:00.000Z'),
      enforceProjectState: true,
      dispatch: async () => {
        dispatches += 1
        return { status: 'succeeded' as const, result_revision_hash: H('6'), result_artifact_hash: H('5'), result_refs: { semantic_target_map_hash: H('7'), comparison_alignment: 'unavailable' as const, result_source_event_count: 8, result_source_event_chain_hash: H('8'), result_source_revision_hash: H('6') }, hard_gates: GATES }
      },
    }
    await expect(runRunnerCycle(options)).rejects.toThrow('response lost')
    expect(dispatches).toBe(0)
    await expect(runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ pending_projects: 1, conflicted_projects: 0 })

    await expect(runRunnerCycle(options)).resolves.toMatchObject({ state: 'completed', command_id: command.command_id, receipt_status: 'succeeded' })
    expect({ claims, projectCalls, dispatches }).toEqual({ claims: 2, projectCalls: 2, dispatches: 1 })
    await expect(runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ pending_projects: 0, conflicted_projects: 0, project_attention_code: null })
    await expect(loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ acknowledged_platform_state: { active_candidate_hash: H('4'), active_artifact_hash: H('5') } })
  })

  it('caps nested undo ancestry at 100 before another activation can reach the cloud', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-depth-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const pending = await persistPendingRunnerProject(projectRequest(base, null, randomUUID()), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    let cursor = await acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    for (let index = 0; index < 100; index += 1) {
      const candidate = hashValue({ candidate: index })
      const prepared = hashValue({ prepared: index })
      const nextRevision = hashValue({ revision: index })
      const nextMap = hashValue({ map: index })
      const command = activationCommand({ id: randomUUID(), commandId: randomUUID(), candidate, revision: cursor.acknowledged_platform_state.active_revision_hash, artifact: cursor.acknowledged_platform_state.active_artifact_hash, prepared, map: cursor.acknowledged_platform_state.semantic_target_map_hash, occurredAt: new Date(Date.UTC(2026, 8, 5, 9, 1, index)).toISOString() })
      const receipt = successfulReceipt(command, nextRevision, prepared, nextMap, new Date(Date.UTC(2026, 8, 5, 9, 2, index)).toISOString(), 8 + index, hashValue({ chain: index }))
      cursor = await acknowledgeRunnerCommandPlatformState(command, receipt, SIGNING_KEY, runtimeRoot)
    }
    expect(cursor.undo_ancestry).toHaveLength(100)
    const overflow = activationCommand({ id: randomUUID(), commandId: randomUUID(), candidate: H('a'), revision: cursor.acknowledged_platform_state.active_revision_hash, artifact: cursor.acknowledged_platform_state.active_artifact_hash, prepared: H('b'), map: cursor.acknowledged_platform_state.semantic_target_map_hash, occurredAt: '2026-09-05T10:00:00.000Z' })
    await expect(assertRunnerCommandHasAcknowledgedCursor(overflow, SIGNING_KEY, runtimeRoot)).rejects.toThrow('supported limit')
  }, 15_000)

  it('keeps signed projection conflicts visible until an explicit cursor-bound resolution preserves the evidence', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-conflict-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const request = projectRequest(base, null, '16161616-1616-4616-8616-161616161616')
    const pending = await persistPendingRunnerProject(request, SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await quarantinePendingRunnerProject(pending, SIGNING_KEY, 'idempotency_conflict', '2026-09-05T09:00:01.000Z', runtimeRoot)
    await expect(runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)).resolves.toEqual({ pending_projects: 0, conflicted_projects: 1, resolved_conflicts: 0, projection_conflicts: 0, idempotency_conflicts: 1, runner_identity_conflicts: 0, global_lineage_conflicts: 0, project_attention_code: 'runner_project_idempotency_conflict' })

    const repairedPending = await persistPendingRunnerProject(projectRequest(base, null, '20202020-2020-4020-8020-202020202020'), SIGNING_KEY, '2026-09-05T09:00:02.000Z', runtimeRoot)
    await acknowledgeRunnerProject(repairedPending, SIGNING_KEY, '2026-09-05T09:00:03.000Z', runtimeRoot)
    await expect(runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ conflicted_projects: 1, resolved_conflicts: 0 })
    await expect(resolveRunnerProjectConflict({ job_id: JOB_ID, platform: 'youtube_shorts', runner_id: 'runner-different-identity', journal_hash: pending.journal_hash, operator_confirmation_ref: 'operator-confirmed-cloud-cursor-reconciled', resolved_at: '2026-09-05T09:00:04.000Z' }, SIGNING_KEY, runtimeRoot)).rejects.toThrow('does not match')
    const resolution = await resolveRunnerProjectConflict({ job_id: JOB_ID, platform: 'youtube_shorts', runner_id: 'runner-projection-test', journal_hash: pending.journal_hash, operator_confirmation_ref: 'operator-confirmed-cloud-cursor-reconciled', resolved_at: '2026-09-05T09:00:04.000Z' }, SIGNING_KEY, runtimeRoot)
    await expect(runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ conflicted_projects: 0, resolved_conflicts: 1, idempotency_conflicts: 0, project_attention_code: null })
    await expect(access(join(runtimeRoot, 'runner', 'project-state', JOB_ID, 'youtube_shorts', 'conflicts', `${pending.journal_hash}.json`))).resolves.toBeUndefined()

    const resolutionPath = join(runtimeRoot, 'runner', 'project-state', JOB_ID, 'youtube_shorts', 'resolutions', `${resolution.conflict_hash}.json`)
    const tampered = JSON.parse(await readFile(resolutionPath, 'utf8'))
    tampered.operator_confirmation_ref = 'tampered-confirmation-reference'
    await writeFile(resolutionPath, `${JSON.stringify(tampered, null, 2)}\n`)
    await expect(runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)).rejects.toThrow('failed authentication')
  })

  it('globally stops before project replay, discovery, claim, or retention while a project conflict is unresolved', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-conflict-stop-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const initial = await persistPendingRunnerProject(projectRequest(base, null, '45454545-4545-4545-8545-454545454545'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(initial, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const conflicted = await persistPendingRunnerProject(projectRequest(base, base, '46464646-4646-4646-8646-464646464646'), SIGNING_KEY, '2026-09-05T09:00:02.000Z', runtimeRoot)
    await quarantinePendingRunnerProject(conflicted, SIGNING_KEY, 'projection_conflict', '2026-09-05T09:00:03.000Z', runtimeRoot)
    const replay = await persistPendingRunnerProject(projectRequest(base, base, '47474747-4747-4747-8747-474747474747'), SIGNING_KEY, '2026-09-05T09:00:04.000Z', runtimeRoot)
    expect(replay.journal_hash).toBeTruthy()
    const calls = { project: 0, discovery: 0, claim: 0 }
    const client: RunnerControlPlane = {
      project: async () => { calls.project += 1; throw new Error('unresolved conflict must stop project replay') },
      heartbeat: async () => ({}),
      claim: async () => { calls.claim += 1; return null },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, discoverInbox: async () => { calls.discovery += 1; throw new Error('unresolved conflict must stop discovery') } })).resolves.toEqual({ state: 'idle' })
    expect(calls).toEqual({ project: 0, discovery: 0, claim: 0 })
    const status = await runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)
    expect(status).toMatchObject({ pending_projects: 1, conflicted_projects: 1, project_attention_code: 'runner_project_projection_conflict' })
    expect(runnerJournalsPermitPreviewRetention({ pending_receipts: 0, receipt_attention_code: null }, status)).toBe(false)
  })

  it('holds maintenance inventory and retention under authority against a concurrent manual conflict', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-retention-authority-race-'))
    const identity = await loadOrCreateRunnerIdentity(runtimeRoot, SIGNING_KEY)
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const initial = await persistPendingRunnerProject(projectRequest(base, null, '50505050-5050-4050-8050-505050505050'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(initial, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    const pendingConflict = await persistPendingRunnerProject(projectRequest(base, base, '51515151-5151-4151-8151-515151515151'), SIGNING_KEY, '2026-09-05T09:00:02.000Z', runtimeRoot)
    let releaseRetention!: () => void
    let retentionEntered!: () => void
    const entered = new Promise<void>((resolveEntered) => { retentionEntered = resolveEntered })
    const release = new Promise<void>((resolveRelease) => { releaseRetention = resolveRelease })
    let retentionCalls = 0
    const client: RunnerControlPlane = {
      heartbeat: async () => ({}),
      claim: async () => null,
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
      previewRetention: async () => {
        retentionCalls += 1
        retentionEntered()
        await release
        return { reviewed: 1, deleted_objects: 0, cutoff: '2026-09-05T09:00:00.000Z' }
      },
    }
    const maintenance = runRunnerMaintenanceUnderAuthority({ client, runnerId: identity.runner_id, signingKey: SIGNING_KEY, runtimeRoot }, true)
    await entered
    let manualEntered = false
    const manual = withRunnerAuthorityLock(runtimeRoot, async () => {
      manualEntered = true
      await quarantinePendingRunnerProject(pendingConflict, SIGNING_KEY, 'projection_conflict', '2026-09-05T09:00:03.000Z', runtimeRoot)
    })
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 40))
    expect(manualEntered).toBe(false)
    releaseRetention()
    await expect(maintenance).resolves.toMatchObject({ retention_permitted: true, retention: { reviewed: 1 } })
    await manual
    expect(retentionCalls).toBe(1)

    const stopped = await runRunnerMaintenanceUnderAuthority({ client, runnerId: identity.runner_id, signingKey: SIGNING_KEY, runtimeRoot }, true)
    expect(stopped).toMatchObject({ retention_permitted: false, project_journals: { conflicted_projects: 1 } })
    expect(retentionCalls).toBe(1)
  })

  it('quarantines a pending projection from a different runner identity before any network replay', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-identity-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const request = RunnerProjectRequestV1Schema.parse({ ...projectRequest(base, null, '17171717-1717-4717-8717-171717171717'), runner_id: 'runner-retired-identity' })
    await persistPendingRunnerProject(request, SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    const calls = { projected: 0, discovered: 0, claimed: 0 }
    const client: RunnerControlPlane = {
      project: async () => { calls.projected += 1; throw new Error('must not replay another runner identity') },
      heartbeat: async () => ({}),
      claim: async () => { calls.claimed += 1; return null },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, now: () => new Date('2026-09-05T09:00:01.000Z'), discoverInbox: async () => { calls.discovered += 1; throw new Error('new conflict must stop discovery') } })).resolves.toEqual({ state: 'idle' })
    expect(calls).toEqual({ projected: 0, discovered: 0, claimed: 0 })
    await expect(runnerProjectJournalStatus(SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ pending_projects: 0, conflicted_projects: 1, resolved_conflicts: 0, runner_identity_conflicts: 1, project_attention_code: 'runner_project_identity_conflict' })
  })

  it('adopts one exact legacy root projection locally but never treats omission as an ongoing CAS bypass', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-adoption-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const adoptionRequest = projectRequest(base, undefined, '18181818-1818-4818-8818-181818181818')
    expect(adoptionRequest.projection.expected_platform_state).toBeUndefined()
    expect(adoptionRequest.projection.job).toMatchObject({ source_event_count: 7, source_event_chain_hash: H('c'), source_revision_hash: H('1') })
    const pending = await persistPendingRunnerProject(adoptionRequest, SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)

    const bypass = projectRequest({ ...base, active_revision_hash: H('4') }, undefined, '19191919-1919-4919-8919-191919191919', { count: 8, chain: H('5'), revision: H('4') })
    const bypassPending = await persistPendingRunnerProject(bypass, SIGNING_KEY, '2026-09-05T09:00:02.000Z', runtimeRoot)
    await expect(acknowledgeRunnerProject(bypassPending, SIGNING_KEY, '2026-09-05T09:00:03.000Z', runtimeRoot)).rejects.toThrow('legacy runner project acknowledgement cannot replace')
  })

  it('replays every initial adoption crash shape through one atomic omitted-expectation journal', async () => {
    for (const phase of ['before_http', 'after_first_conflict', 'after_cloud_success'] as const) {
      runtimeRoot = await mkdtemp(join(tmpdir(), `mindmake-project-adoption-${phase}-`))
      const base = state('youtube_shorts', H('1'), H('2'), H('3'))
      const id = phase === 'before_http' ? '21212121-2121-4121-8121-212121212121' : phase === 'after_first_conflict' ? '22222222-2121-4121-8121-212121212121' : '23232323-2121-4121-8121-212121212121'
      const request = projectRequest(base, phase === 'after_cloud_success' ? undefined : null, id)
      await persistPendingRunnerProject(request, SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
      const projected: Array<RunnerProjectProjectionV1['expected_platform_state']> = []
      const client: RunnerControlPlane = {
        project: async (input) => {
          projected.push(input.projection.expected_platform_state)
          if (input.projection.expected_platform_state === null) throw new ControlPlaneRequestError('/project', 409, 'projection_conflict')
          return { duplicate: phase === 'after_cloud_success', projection_hash: hashValue(runnerProjectProjectionHashInputV1(input.projection)), job_id: JOB_ID, platform: 'youtube_shorts' }
        },
        heartbeat: async () => ({}),
        claim: async () => null,
        complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
      }
      await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, now: () => new Date('2026-09-05T09:00:05.000Z') })).resolves.toEqual({ state: 'idle' })
      expect(projected).toEqual(phase === 'after_cloud_success' ? [undefined] : [null, undefined])
      await expect(loadAcknowledgedRunnerProjectCursor(JOB_ID, 'youtube_shorts', SIGNING_KEY, runtimeRoot)).resolves.toMatchObject({ acknowledged_platform_state: base })
      await expect(access(join(runtimeRoot, 'runner', 'project-state', JOB_ID, 'youtube_shorts', 'pending.json'))).rejects.toMatchObject({ code: 'ENOENT' })
      await rm(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  })

  it('validates job identifiers before creating any project-state path', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-path-safety-'))
    const escapedLock = join(runtimeRoot, 'runner', '.lock')
    await expect(withRunnerProjectStateLock('..', 'youtube_shorts', runtimeRoot, async () => undefined)).rejects.toThrow()
    await expect(withRunnerProjectStateLock('C:\\outside', 'youtube_shorts', runtimeRoot, async () => undefined)).rejects.toThrow()
    await expect(loadAcknowledgedRunnerProjectCursor('../escape', 'youtube_shorts', SIGNING_KEY, runtimeRoot)).rejects.toThrow()
    await expect(access(escapedLock)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reclaims project and event locks only after detecting a reused process identity', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-durable-lock-reuse-'))
    const current = await inspectDurableProcessInstance(process.pid)
    expect(current.instance_id).toBeTruthy()
    const projectLock = join(runtimeRoot, 'runner', 'project-state', JOB_ID, '.lock')
    await mkdir(join(runtimeRoot, 'runner', 'project-state', JOB_ID), { recursive: true })
    await writeFile(projectLock, `${JSON.stringify({ schema_version: 2, pid: process.pid, token: 'reused-project-owner', acquired_at: new Date().toISOString(), process_instance_id: `${current.instance_id}:reused` })}\n`)
    await expect(withRunnerProjectStateLock(JOB_ID, 'youtube_shorts', runtimeRoot, async () => 'project-lock-reclaimed')).resolves.toBe('project-lock-reclaimed')
    await expect(access(projectLock)).rejects.toMatchObject({ code: 'ENOENT' })

    const authorityLock = join(runtimeRoot, 'runner-authority.lock')
    await writeFile(authorityLock, `${JSON.stringify({ schema_version: 2, pid: process.pid, token: 'reused-authority-owner', acquired_at: new Date().toISOString(), process_instance_id: `${current.instance_id}:reused` })}\n`)
    await expect(withRunnerAuthorityLock(runtimeRoot, async () => 'authority-lock-reclaimed')).resolves.toBe('authority-lock-reclaimed')
    await expect(access(authorityLock)).rejects.toMatchObject({ code: 'ENOENT' })

    const priorRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
    const eventLock = join(runtimeRoot, 'jobs', JOB_ID, '.events.lock')
    try {
      await mkdir(join(runtimeRoot, 'jobs', JOB_ID), { recursive: true })
      await writeFile(eventLock, `${JSON.stringify({ schema_version: 2, pid: process.pid, token: 'reused-event-owner', acquired_at: new Date().toISOString(), process_instance_id: `${current.instance_id}:reused` })}\n`)
      await expect(withJobEventLock(JOB_ID, async () => 'event-lock-reclaimed')).resolves.toBe('event-lock-reclaimed')
      await expect(access(eventLock)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      if (priorRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntimeRoot
    }
  })

  it('serializes project transactions across platforms while allowing different jobs to proceed', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-project-global-lock-'))
    let releaseFirst!: () => void
    let firstEntered!: () => void
    const entered = new Promise<void>((resolveEntered) => { firstEntered = resolveEntered })
    const release = new Promise<void>((resolveRelease) => { releaseFirst = resolveRelease })
    const order: string[] = []
    const first = withRunnerProjectStateLock(JOB_ID, 'youtube_shorts', runtimeRoot, async () => {
      order.push('youtube-enter')
      firstEntered()
      await release
      order.push('youtube-exit')
    })
    await entered
    const second = withRunnerProjectStateLock(JOB_ID, 'linkedin', runtimeRoot, async () => { order.push('linkedin-enter') })
    const otherJob = withRunnerProjectStateLock('job-other-lock', 'linkedin', runtimeRoot, async () => { order.push('other-job-enter') })
    await otherJob
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 30))
    expect(order).toEqual(['youtube-enter', 'other-job-enter'])
    releaseFirst()
    await Promise.all([first, second])
    expect(order).toEqual(['youtube-enter', 'other-job-enter', 'youtube-exit', 'linkedin-enter'])
  })

  it('serializes manual authority against claim and observes the conflict before consuming a lease', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-authority-race-'))
    const base = state('youtube_shorts', H('1'), H('2'), H('3'))
    const initial = await persistPendingRunnerProject(projectRequest(base, null, '48484848-4848-4848-8848-484848484848'), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
    await acknowledgeRunnerProject(initial, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
    let releaseManual!: () => void
    let manualEntered!: () => void
    const entered = new Promise<void>((resolveEntered) => { manualEntered = resolveEntered })
    const release = new Promise<void>((resolveRelease) => { releaseManual = resolveRelease })
    const manual = withRunnerAuthorityLock(runtimeRoot, async () => {
      const pending = await persistPendingRunnerProject(projectRequest(base, base, '49494949-4949-4949-8949-494949494949'), SIGNING_KEY, '2026-09-05T09:00:02.000Z', runtimeRoot)
      await quarantinePendingRunnerProject(pending, SIGNING_KEY, 'projection_conflict', '2026-09-05T09:00:03.000Z', runtimeRoot)
      manualEntered()
      await release
    })
    await entered
    const calls = { project: 0, discovery: 0, claim: 0, dispatch: 0 }
    const client: RunnerControlPlane = {
      project: async () => { calls.project += 1; throw new Error('authority conflict must stop replay') },
      heartbeat: async () => ({}),
      claim: async () => { calls.claim += 1; return null },
      complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
    }
    const cycle = runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, discoverInbox: async () => { calls.discovery += 1; throw new Error('authority conflict must stop discovery') }, dispatch: async () => { calls.dispatch += 1; throw new Error('authority conflict must stop dispatch') } })
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 40))
    expect(calls).toEqual({ project: 0, discovery: 0, claim: 0, dispatch: 0 })
    releaseManual()
    await manual
    await expect(cycle).resolves.toEqual({ state: 'idle' })
    expect(calls).toEqual({ project: 0, discovery: 0, claim: 0, dispatch: 0 })
  })

  // A dozen scenarios, each with its own temp tree, symlinks and signed files:
  // 180 ms on Linux, 0.9 s to over 5 s on the Windows CI runner, whose disk
  // speed varies run to run (d85c3cf timed out at the 5 s default).
  it('rejects every unexpected project-state entry before project replay, discovery, heartbeat, or claim', async () => {
    for (const scenario of ['unexpected_root', 'invalid_job', 'job_symlink', 'unexpected_job_file', 'invalid_platform', 'platform_symlink', 'platform_temp', 'conflict_name', 'resolution_name', 'corrupt_cursor'] as const) {
      runtimeRoot = await mkdtemp(join(tmpdir(), `mindmake-project-layout-${scenario}-`))
      const base = state('youtube_shorts', H('1'), H('2'), H('3'))
      const pending = await persistPendingRunnerProject(projectRequest(base, null, randomUUID()), SIGNING_KEY, '2026-09-05T09:00:00.000Z', runtimeRoot)
      await acknowledgeRunnerProject(pending, SIGNING_KEY, '2026-09-05T09:00:01.000Z', runtimeRoot)
      const root = join(runtimeRoot, 'runner', 'project-state')
      const jobRoot = join(root, JOB_ID)
      const platformRoot = join(jobRoot, 'youtube_shorts')
      if (scenario === 'unexpected_root') await writeFile(join(root, 'leftover.tmp'), 'unexpected\n')
      if (scenario === 'invalid_job') await mkdir(join(root, '!invalid-job'))
      if (scenario === 'job_symlink') {
        const target = join(runtimeRoot, 'linked-job-target')
        await mkdir(target)
        await symlink(target, join(root, 'job-linked-state'), 'junction')
      }
      if (scenario === 'unexpected_job_file') await writeFile(join(jobRoot, 'leftover.tmp'), 'unexpected\n')
      if (scenario === 'invalid_platform') await mkdir(join(jobRoot, 'unsupported_platform'))
      if (scenario === 'platform_symlink') {
        const target = join(runtimeRoot, 'linked-platform-target')
        await mkdir(target)
        await symlink(target, join(jobRoot, 'linkedin'), 'junction')
      }
      if (scenario === 'platform_temp') await writeFile(join(platformRoot, 'acknowledged.json.partial.tmp'), 'unexpected\n')
      if (scenario === 'conflict_name') {
        await mkdir(join(platformRoot, 'conflicts'), { recursive: true })
        await writeFile(join(platformRoot, 'conflicts', 'renamed.json'), '{}\n')
      }
      if (scenario === 'resolution_name') {
        await mkdir(join(platformRoot, 'resolutions'), { recursive: true })
        await writeFile(join(platformRoot, 'resolutions', 'renamed.json'), '{}\n')
      }
      if (scenario === 'corrupt_cursor') {
        const cursorPath = join(platformRoot, 'acknowledged.json')
        const cursor = JSON.parse(await readFile(cursorPath, 'utf8'))
        cursor.cursor_signature = H('f')
        await writeFile(cursorPath, `${JSON.stringify(cursor, null, 2)}\n`)
      }
      const calls = { project: 0, discovery: 0, heartbeat: 0, claim: 0 }
      const client: RunnerControlPlane = {
        project: async () => { calls.project += 1; throw new Error('corrupt project inventory must stop replay') },
        heartbeat: async () => { calls.heartbeat += 1; return {} },
        claim: async () => { calls.claim += 1; return null },
        complete: async ({ receipt }) => ({ duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' }),
      }
      await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, discoverInbox: async () => { calls.discovery += 1; throw new Error('corrupt project inventory must stop discovery') } })).rejects.toThrow()
      expect(calls).toEqual({ project: 0, discovery: 0, heartbeat: 0, claim: 0 })
      if (scenario === 'unexpected_root') {
        const priorRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
        process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
        await mkdir(join(runtimeRoot, 'runner'), { recursive: true })
        await writeFile(join(runtimeRoot, 'runner', 'identity.json'), `${JSON.stringify({ schema_version: 1, runner_id: 'runner-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', created_at: '2026-09-05T09:00:00.000Z' }, null, 2)}\n`)
        setRunnerReceiptSigningKeyProviderForTests(() => SIGNING_KEY.toString('utf8'))
        try { await expect(runnerStatus()).rejects.toThrow('unexpected entry') }
        finally {
          resetRunnerReceiptSigningKeyProviderForTests()
          if (priorRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
          else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntimeRoot
        }
      }
      await rm(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  }, 15_000)

  it('rejects every unexpected or unauthenticated pending-receipt entry before project, discovery, or claim', async () => {
    for (const scenario of ['unexpected_root', 'unexpected_child', 'malformed_json', 'tampered_hmac', 'missing_claim', 'mismatched_claim', 'symlink'] as const) {
      runtimeRoot = await mkdtemp(join(tmpdir(), `mindmake-receipt-integrity-${scenario}-`))
      const command = activationCommand({ id: '35353535-3535-4535-8535-353535353535', commandId: '36363636-3636-4636-8636-363636363636', candidate: H('4'), revision: H('1'), artifact: H('2'), prepared: H('5'), map: H('3'), occurredAt: '2026-09-05T09:01:00.000Z' })
      const receipt = successfulReceipt(command, H('6'), H('5'), H('7'), '2026-09-05T09:01:01.000Z', 8, H('8'))
      if (scenario !== 'missing_claim') {
        const claimed = scenario === 'mismatched_claim'
          ? RunnerCommandEnvelopeV1Schema.parse({ ...command, semantic_target_map_hash: H('9'), command_hash: hashValue(runnerCommandHashInputV1({ ...command, semantic_target_map_hash: H('9') })) })
          : command
        await persistClaimedCommandJournal(claimed, 'runner-projection-test', SIGNING_KEY, '2026-09-05T09:01:00.000Z', runtimeRoot)
      }
      const pendingRoot = join(runtimeRoot, 'runner', 'receipts', 'pending')
      const directory = join(pendingRoot, command.idempotency_key)
      const path = join(directory, `${command.command_id}.json`)
      await mkdir(directory, { recursive: true })
      const journal = { schema_version: 1, idempotency_key: command.idempotency_key, runner_id: 'runner-projection-test', lease_token: 'integrity-test-lease-token-long-enough', receipt }
      await writeFile(path, `${JSON.stringify(journal, null, 2)}\n`)
      if (scenario === 'unexpected_root') await writeFile(join(pendingRoot, 'unexpected.txt'), 'unexpected\n')
      if (scenario === 'unexpected_child') await writeFile(join(directory, 'leftover.tmp'), 'unexpected\n')
      if (scenario === 'malformed_json') await writeFile(path, '{not-json\n')
      if (scenario === 'tampered_hmac') await writeFile(path, `${JSON.stringify({ ...journal, receipt: { ...receipt, receipt_signature: H('f') } }, null, 2)}\n`)
      if (scenario === 'symlink') {
        const target = join(runtimeRoot, 'symlink-target')
        await mkdir(target)
        await symlink(target, join(directory, '37373737-3737-4737-8737-373737373737.json'), 'junction')
      }
      const calls = { complete: 0, project: 0, discovery: 0, claim: 0 }
      const client: RunnerControlPlane = {
        complete: async ({ receipt: submitted }) => { calls.complete += 1; return { duplicate: false, command_id: submitted.command_id, receipt_hash: submitted.receipt_hash, command_status: 'succeeded' } },
        project: async () => { calls.project += 1; throw new Error('must not project') },
        heartbeat: async () => ({}),
        claim: async () => { calls.claim += 1; return null },
      }
      await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot, discoverInbox: async () => { calls.discovery += 1; throw new Error('must not discover') } })).rejects.toThrow()
      expect(calls).toEqual({ complete: 0, project: 0, discovery: 0, claim: 0 })
      await rm(runtimeRoot, { recursive: true, force: true })
      runtimeRoot = ''
    }
  })

  it('rejects duplicate authenticated pending receipts for one job before partial completion', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-receipt-duplicate-job-'))
    const first = activationCommand({ id: '38383838-3838-4838-8838-383838383838', commandId: '39393939-3939-4939-8939-393939393939', candidate: H('4'), revision: H('1'), artifact: H('2'), prepared: H('5'), map: H('3'), occurredAt: '2026-09-05T09:01:00.000Z' })
    const second = activationCommand({ id: '40404040-4040-4040-8040-404040404040', commandId: '41414141-4141-4141-8141-414141414141', candidate: H('6'), revision: H('1'), artifact: H('2'), prepared: H('7'), map: H('3'), occurredAt: '2026-09-05T09:01:02.000Z' })
    for (const [index, command] of [first, second].entries()) {
      const receipt = successfulReceipt(command, index === 0 ? H('8') : H('9'), index === 0 ? H('5') : H('7'), H('a'), `2026-09-05T09:01:0${index + 3}.000Z`, 8 + index, index === 0 ? H('b') : H('c'))
      await persistClaimedCommandJournal(command, 'runner-projection-test', SIGNING_KEY, command.issued_at, runtimeRoot)
      const directory = join(runtimeRoot, 'runner', 'receipts', 'pending', command.idempotency_key)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, `${command.command_id}.json`), `${JSON.stringify({ schema_version: 1, idempotency_key: command.idempotency_key, runner_id: 'runner-projection-test', lease_token: `duplicate-job-${index}-lease-token-long-enough`, receipt }, null, 2)}\n`)
    }
    let completions = 0
    const client: RunnerControlPlane = {
      complete: async ({ receipt }) => { completions += 1; return { duplicate: false, command_id: receipt.command_id, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' } },
      heartbeat: async () => ({}),
      claim: async () => null,
    }
    await expect(runRunnerCycle({ client, runnerId: 'runner-projection-test', softwareCommit: 'a'.repeat(40), signingKey: SIGNING_KEY, driveState: 'ready', runtimeRoot })).rejects.toThrow('multiple authenticated pending runner receipts')
    expect(completions).toBe(0)
  })

  it('uses the strict authenticated receipt inventory for runner status', async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-status-receipt-integrity-'))
    const pendingRoot = join(runtimeRoot, 'runner', 'receipts', 'pending')
    await mkdir(pendingRoot, { recursive: true })
    await writeFile(join(pendingRoot, 'unexpected.txt'), 'must not be counted as zero\n')
    const priorRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
    setRunnerReceiptSigningKeyProviderForTests(() => SIGNING_KEY.toString('utf8'))
    try {
      await expect(runnerStatus()).rejects.toThrow()
    } finally {
      if (priorRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntimeRoot
    }
  })
})
