import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MagicEditActivationV1Schema,
  LegacyStoredRunnerReceiptV1Schema,
  ReviewDecisionRecordV1Schema,
  ReviewRecoveryRecordV1Schema,
  RunnerCommandEnvelopeV1Schema,
  RunnerProjectProjectionV1Schema,
  RunnerPreviewRetentionRequestV1Schema,
  RunnerPreviewRetentionResponseV1Schema,
  RunnerReceiptV1Schema,
  RunnerReviewTargetV1Schema,
  runnerCommandHashInputV1,
} from '@mindmake/contracts'
import { hashValue } from '@mindmake/core'

const FIXTURES = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'control-plane')
const H = {
  revision: 'a'.repeat(64),
  artifact: 'b'.repeat(64),
  map: 'c'.repeat(64),
  candidate: 'd'.repeat(64),
}

const hardGates = {
  truth: { status: 'passed' as const },
  rights: { status: 'passed' as const },
  confidentiality: { status: 'passed' as const },
  transcript_fidelity: { status: 'passed' as const },
  naming: { status: 'passed' as const },
}

function projectProjection() {
  return {
    job: {
      job_id: 'job-video-fixture',
      source_event_count: 7,
      source_event_chain_hash: H.map,
      source_revision_hash: H.revision,
      series: 'built_with_ai' as const,
      mode: 'solo' as const,
      target_platforms: ['youtube_shorts' as const],
      stage: 'treatment' as const,
      status: 'active' as const,
      safe_title: 'Approved treatment',
      safe_summary: 'Ready for exact, bounded mobile presentation edits.',
    },
    platform_state: {
      platform: 'youtube_shorts' as const,
      active_revision_hash: H.revision,
      active_artifact_hash: H.artifact,
      active_candidate_hash: null,
      parent_revision_hash: null,
      parent_artifact_hash: null,
      parent_candidate_hash: null,
      semantic_target_map_hash: H.map,
      editorial_state: 'approved' as const,
      route_state: 'standard' as const,
    },
    review: {
      id: '11111111-1111-4111-8111-111111111111',
      gate: 'treatment' as const,
      safe_title: 'Approved treatment',
      safe_summary: 'Ready for exact, bounded mobile presentation edits.',
      parent_revision_hash: H.revision,
      parent_artifact_hash: H.artifact,
      revision_hash: H.revision,
      artifact_hash: H.artifact,
      candidate_hash: null,
      route_state: 'standard' as const,
      safe_payload: {
        direction: 'Review the current approved treatment.',
        change_title: 'Approved treatment',
        change_summary: 'No editorial content changed.',
        range_label: 'Full treatment',
        changes: [],
        blocking_gates: hardGates,
        target: { kind: 'range' as const, start_ms: 0, end_ms: 12_000 },
        semantic_target_map_hash: H.map,
      },
      hard_gates: hardGates,
      created_at: '2026-09-04T10:00:00.000Z',
    },
  }
}

describe('control-plane v1 contracts', () => {
  it('shares one retry-stable canonical prepare command hash fixture', async () => {
    const fixture = RunnerCommandEnvelopeV1Schema.parse(JSON.parse(await readFile(join(FIXTURES, 'runner-command-prepare-v1.json'), 'utf8')))
    const expected = (await readFile(join(FIXTURES, 'runner-command-prepare-v1.sha256'), 'utf8')).trim()
    expect(hashValue(fixture.payload)).toBe(fixture.payload_hash)
    expect(hashValue(runnerCommandHashInputV1(fixture))).toBe(expected)
    expect(fixture.command_hash).toBe(expected)

    const retryRow = RunnerCommandEnvelopeV1Schema.parse({
      ...fixture,
      command_id: '99999999-9999-4999-8999-999999999999',
      issued_at: '2026-09-04T13:00:00.000Z',
      expires_at: '2026-09-04T15:00:00.000Z',
    })
    expect(hashValue(runnerCommandHashInputV1(retryRow))).toBe(expected)
  })

  it('binds activation confirmation to the treatment, review and decision IDs across UUID versions', () => {
    const activation = {
      schema_version: 1,
      activation_id: '22222222-2222-4222-8222-222222222222',
      job_id: 'job-video-fixture',
      platform: 'youtube_shorts',
      candidate_hash: H.candidate,
      expected_parent_revision_hash: H.revision,
      expected_parent_artifact_hash: H.artifact,
      prepared_treatment_artifact_hash: H.candidate,
      decision: 'activate',
      approved_by: 'Krish',
      confirmation_ref: `control-center-confirmation:treatment:${H.candidate}:review:33333333-3333-8333-8333-333333333333:decision:22222222-2222-4222-8222-222222222222`,
      occurred_at: '2026-09-04T10:00:00.000Z',
    }
    expect(MagicEditActivationV1Schema.parse(activation).approved_by).toBe('Krish')
    const envelope = {
      schema_version: 1,
      command_id: '44444444-4444-4444-8444-444444444444',
      command_kind: 'magic_edit_activate',
      job_id: activation.job_id,
      platform: activation.platform,
      candidate_hash: activation.candidate_hash,
      expected_parent_revision_hash: activation.expected_parent_revision_hash,
      expected_parent_artifact_hash: activation.expected_parent_artifact_hash,
      semantic_target_map_hash: H.map,
      idempotency_key: activation.activation_id,
      payload_hash: hashValue(activation),
      command_hash: H.revision,
      issued_at: '2026-09-04T10:00:00.000Z',
      expires_at: '2026-09-04T12:00:00.000Z',
      payload: activation,
    }
    expect(RunnerCommandEnvelopeV1Schema.parse(envelope).semantic_target_map_hash).toBe(H.map)
    expect(() => RunnerCommandEnvelopeV1Schema.parse({ ...envelope, semantic_target_map_hash: null })).toThrow('requires the prepared candidate target map')
    expect(() => MagicEditActivationV1Schema.parse({
      ...activation,
      confirmation_ref: `control-center-confirmation:treatment:${H.candidate}:review:33333333-3333-9333-8333-333333333333:decision:22222222-2222-4222-8222-222222222222`,
    })).toThrow('activation confirmation')
  })

  it('uses strict kind-specific browser review targets', () => {
    expect(RunnerReviewTargetV1Schema.parse({ kind: 'moment', start_ms: 1200 })).toEqual({ kind: 'moment', start_ms: 1200 })
    expect(RunnerReviewTargetV1Schema.parse({ kind: 'overlay', ref: 'overlay-1' })).toEqual({ kind: 'overlay', ref: 'overlay-1' })
    expect(() => RunnerReviewTargetV1Schema.parse({ kind: 'overlay', ref: 'overlay-1', start_ms: 0, end_ms: 1000 })).toThrow()
    expect(() => RunnerReviewTargetV1Schema.parse({ kind: 'range', start_ms: 1000 })).toThrow()
  })

  it('binds non-activation review decisions to one exact review and routes candidate activation separately', () => {
    const payload = ReviewDecisionRecordV1Schema.parse({
      schema_version: 1,
      decision_id: '44444444-4444-4444-8444-444444444444',
      job_id: 'job-video-fixture',
      platform: 'youtube_shorts',
      review_id: '55555555-5555-4555-8555-555555555555',
      gate: 'final',
      candidate_hash: null,
      semantic_target_map_hash: H.map,
      expected_parent_revision_hash: H.revision,
      expected_parent_artifact_hash: H.artifact,
      review_revision_hash: 'e'.repeat(64),
      review_artifact_hash: 'f'.repeat(64),
      decision: 'use_candidate',
      feedback: 'The ending lands cleanly.',
      override_reason: null,
      learning_confirmation: null,
      decided_by: 'Krish',
      occurred_at: '2026-09-04T10:00:00.000Z',
    })
    const draft = RunnerCommandEnvelopeV1Schema.parse({
      schema_version: 1,
      command_id: '66666666-6666-4666-8666-666666666666',
      command_kind: 'review_decision_record',
      job_id: payload.job_id,
      platform: payload.platform,
      candidate_hash: null,
      expected_parent_revision_hash: payload.expected_parent_revision_hash,
      expected_parent_artifact_hash: payload.expected_parent_artifact_hash,
      semantic_target_map_hash: payload.semantic_target_map_hash,
      idempotency_key: payload.decision_id,
      payload_hash: hashValue(payload),
      command_hash: '0'.repeat(64),
      issued_at: '2026-09-04T10:00:00.000Z',
      expires_at: '2026-09-04T12:00:00.000Z',
      payload,
    })
    const command = RunnerCommandEnvelopeV1Schema.parse({ ...draft, command_hash: hashValue(runnerCommandHashInputV1(draft)) })
    expect(command.command_kind).toBe('review_decision_record')
    expect(() => RunnerCommandEnvelopeV1Schema.parse({ ...command, idempotency_key: '77777777-7777-4777-8777-777777777777' })).toThrow('idempotency')
    expect(() => ReviewDecisionRecordV1Schema.parse({ ...payload, candidate_hash: H.candidate })).toThrow('dedicated activation')
    expect(() => ReviewDecisionRecordV1Schema.parse({ ...payload, gate: 'learning' })).toThrow('learning decisions require')
  })

  it('keeps return commands map-free while passing through the exact current candidate lineage', () => {
    const payload = {
      schema_version: 1 as const,
      return_id: '88888888-8888-4888-8888-888888888888',
      job_id: 'job-video-fixture',
      platform: 'youtube_shorts' as const,
      expected_parent_revision_hash: H.revision,
      expected_parent_artifact_hash: H.candidate,
      target_parent_revision_hash: 'e'.repeat(64),
      target_parent_artifact_hash: H.artifact,
      returned_by: 'Krish' as const,
      occurred_at: '2026-09-04T10:00:00.000Z',
    }
    const command = {
      schema_version: 1 as const,
      command_id: '99999999-9999-4999-8999-999999999999',
      command_kind: 'magic_edit_return_to_parent' as const,
      job_id: payload.job_id,
      platform: payload.platform,
      candidate_hash: H.candidate,
      expected_parent_revision_hash: payload.expected_parent_revision_hash,
      expected_parent_artifact_hash: payload.expected_parent_artifact_hash,
      semantic_target_map_hash: null,
      idempotency_key: payload.return_id,
      payload_hash: hashValue(payload),
      command_hash: H.map,
      issued_at: '2026-09-04T10:00:00.000Z',
      expires_at: '2026-09-04T12:00:00.000Z',
      payload,
    }
    expect(RunnerCommandEnvelopeV1Schema.parse(command).candidate_hash).toBe(H.candidate)
    expect(() => RunnerCommandEnvelopeV1Schema.parse({ ...command, semantic_target_map_hash: H.map })).toThrow('cannot substitute a semantic target map')
  })

  it('binds review recovery to an exact source command, review clone, root, and bounded generation', () => {
    const payload = ReviewRecoveryRecordV1Schema.parse({
      schema_version: 1,
      recovery_id: '91919191-9191-4191-8191-919191919191',
      job_id: 'job-video-fixture', platform: 'youtube_shorts',
      source_review_id: '92929292-9292-4292-8292-929292929292', recovery_review_id: '93939393-9393-4393-8393-939393939393',
      source_command_id: '94949494-9494-4494-8494-949494949494', source_command_hash: H.revision, source_terminal_reason: 'runner_failed_receipt', recovery_root_command_id: '94949494-9494-4494-8494-949494949494', recovery_generation: 1,
      gate: 'treatment', expected_parent_revision_hash: H.revision, expected_parent_artifact_hash: H.artifact,
      review_revision_hash: H.revision, review_artifact_hash: H.artifact, candidate_hash: null, semantic_target_map_hash: H.map,
      recovered_by: 'Krish', occurred_at: '2026-09-04T10:00:00.000Z',
    })
    const draft = RunnerCommandEnvelopeV1Schema.parse({
      schema_version: 1, command_id: '95959595-9595-4595-8595-959595959595', command_kind: 'review_recovery_record', job_id: payload.job_id, platform: payload.platform,
      candidate_hash: null, expected_parent_revision_hash: payload.expected_parent_revision_hash, expected_parent_artifact_hash: payload.expected_parent_artifact_hash, semantic_target_map_hash: payload.semantic_target_map_hash,
      idempotency_key: payload.recovery_id, payload_hash: hashValue(payload), command_hash: '0'.repeat(64), issued_at: payload.occurred_at, expires_at: '2026-09-04T12:00:00.000Z', payload,
    })
    expect(RunnerCommandEnvelopeV1Schema.parse({ ...draft, command_hash: hashValue(runnerCommandHashInputV1(draft)) }).command_kind).toBe('review_recovery_record')
    expect(() => ReviewRecoveryRecordV1Schema.parse({ ...payload, recovery_generation: 4 })).toThrow()
    expect(() => ReviewRecoveryRecordV1Schema.parse({ ...payload, source_terminal_reason: 'unknown' })).toThrow()
    expect(() => ReviewRecoveryRecordV1Schema.parse({ ...payload, recovery_review_id: payload.source_review_id })).toThrow('distinct review identity')
    expect(() => ReviewRecoveryRecordV1Schema.parse({ ...payload, recovery_root_command_id: '96969696-9696-4696-8696-969696969696' })).toThrow('source command as the root')
  })

  it('shares one canonical attempts-exhausted recovery bridge fixture', async () => {
    const fixture = RunnerCommandEnvelopeV1Schema.parse(JSON.parse(await readFile(join(FIXTURES, 'runner-command-review-recovery-v1.json'), 'utf8')))
    const expected = (await readFile(join(FIXTURES, 'runner-command-review-recovery-v1.sha256'), 'utf8')).trim()
    expect(fixture.command_kind).toBe('review_recovery_record')
    expect(fixture.payload).toMatchObject({ source_terminal_reason: 'attempts_exhausted', recovery_generation: 1 })
    expect(hashValue(fixture.payload)).toBe(fixture.payload_hash)
    expect(hashValue(runnerCommandHashInputV1(fixture))).toBe(expected)
    expect(fixture.command_hash).toBe(expected)
  })

  it('binds complete preview reference groups to the receipt command and content hashes', () => {
    const commandId = '11111111-1111-4111-8111-111111111111'
    const beforeHash = 'e'.repeat(64)
    const afterHash = 'f'.repeat(64)
    const receipt = {
      schema_version: 1,
      command_id: commandId,
      command_hash: H.revision,
      job_id: 'job-video-fixture',
      status: 'succeeded',
      result_revision_hash: H.candidate,
      result_artifact_hash: H.artifact,
      result_refs: {
        result_source_event_count: 8,
        result_source_event_chain_hash: H.map,
        result_source_revision_hash: H.revision,
        review_id: '55555555-5555-4555-8555-555555555555',
        candidate_hash: H.candidate,
        safe_title: 'Proof timing adjusted',
        safe_summary: 'One bounded presentation change is ready for review.',
        review_payload: projectProjection().review.safe_payload,
        before_preview_object_key: `commands/${commandId}/previews/before/${beforeHash}.mp4`,
        before_preview_hash: beforeHash,
        before_preview_md5: '3'.repeat(32),
        before_preview_byte_size: 100,
        after_preview_object_key: `commands/${commandId}/previews/after/${afterHash}.mp4`,
        after_preview_hash: afterHash,
        after_preview_md5: '4'.repeat(32),
        after_preview_byte_size: 120,
        comparison_alignment: 'exact',
        comparison_start_ms: 0,
        comparison_end_ms: 5000,
      },
      hard_gates: hardGates,
      retryable: false,
      safe_code: null,
      started_at: '2026-09-04T10:00:00.000Z',
      finished_at: '2026-09-04T10:00:01.000Z',
      receipt_hash: '1'.repeat(64),
      receipt_signature: '2'.repeat(64),
    }
    expect(RunnerReceiptV1Schema.parse(receipt).result_refs?.candidate_hash).toBe(H.candidate)
    expect(() => RunnerReceiptV1Schema.parse({ ...receipt, command_id: '99999999-9999-4999-8999-999999999999' })).toThrow('must bind the receipt command')
    const { after_preview_byte_size: _missing, ...incompleteAfter } = receipt.result_refs
    expect(() => RunnerReceiptV1Schema.parse({ ...receipt, result_refs: incompleteAfter })).toThrow('requires object key, hashes, and byte size')
    expect(() => RunnerReceiptV1Schema.parse({ ...receipt, retryable: true })).toThrow()
    expect(() => RunnerReceiptV1Schema.parse({ ...receipt, result_refs: { ...receipt.result_refs, comparison_alignment: 'unavailable' } })).toThrow('cannot contain timing bounds')
  })

  it('keeps the pre-cursor receipt shape storage-only and exact', () => {
    const current = RunnerReceiptV1Schema.parse({
      schema_version: 1,
      command_id: '41414141-4141-4141-8141-414141414141',
      command_hash: H.revision,
      job_id: 'job-video-fixture',
      status: 'succeeded',
      result_revision_hash: H.revision,
      result_artifact_hash: H.artifact,
      result_refs: {
        result_source_event_count: 8,
        result_source_event_chain_hash: H.map,
        result_source_revision_hash: H.revision,
        comparison_alignment: 'unavailable',
      },
      hard_gates: hardGates,
      retryable: false,
      safe_code: null,
      started_at: '2026-09-04T10:00:00.000Z',
      finished_at: '2026-09-04T10:00:01.000Z',
      receipt_hash: '1'.repeat(64),
      receipt_signature: '2'.repeat(64),
    })
    const { result_source_event_count: _count, result_source_event_chain_hash: _chain, result_source_revision_hash: _sourceRevision, ...legacyRefs } = current.result_refs!
    const legacy = { ...current, result_refs: legacyRefs }
    expect(() => RunnerReceiptV1Schema.parse(legacy)).toThrow('post-dispatch source event count')
    expect(LegacyStoredRunnerReceiptV1Schema.parse(legacy).result_refs).toEqual({ comparison_alignment: 'unavailable' })
    expect(() => LegacyStoredRunnerReceiptV1Schema.parse(current)).toThrow()
    expect(() => LegacyStoredRunnerReceiptV1Schema.parse({ ...legacy, untrusted_field: true })).toThrow()
  })

  it('bounds preview retention without accepting caller-selected paths or cutoffs', () => {
    expect(RunnerPreviewRetentionRequestV1Schema.parse({ schema_version: 1, runner_id: 'runner-contract-test', limit: 100 })).toMatchObject({ limit: 100 })
    expect(() => RunnerPreviewRetentionRequestV1Schema.parse({ schema_version: 1, runner_id: 'runner-contract-test', limit: 101 })).toThrow()
    expect(() => RunnerPreviewRetentionRequestV1Schema.parse({ schema_version: 1, runner_id: 'runner-contract-test', limit: 1, object_key: 'commands/private.mp4' })).toThrow()
    expect(RunnerPreviewRetentionResponseV1Schema.parse({ ok: true, schema_version: 1, reviewed: 2, deleted_objects: 1, cutoff: '2026-07-29T10:00:00.000Z' })).toMatchObject({ deleted_objects: 1 })
  })

  it('accepts only a redacted internally consistent bootstrap projection', () => {
    expect(RunnerProjectProjectionV1Schema.parse(projectProjection()).platform_state.active_artifact_hash).toBe(H.artifact)
    expect(() => RunnerProjectProjectionV1Schema.parse({
      ...projectProjection(),
      platform_state: { ...projectProjection().platform_state, parent_revision_hash: H.revision },
    })).toThrow('complete pair')
    expect(() => RunnerProjectProjectionV1Schema.parse({
      ...projectProjection(),
      review: { ...projectProjection().review, parent_artifact_hash: H.candidate },
    })).toThrow('must match the active platform artifact')
    expect(() => RunnerProjectProjectionV1Schema.parse({
      ...projectProjection(),
      job: { ...projectProjection().job, media_path: 'G:\\private\\source.mp4' },
    })).toThrow()
  })

  it('represents original-to-candidate, candidate-to-candidate, and return lineage without inventing a candidate hash', () => {
    const base = projectProjection()
    const firstCandidate = RunnerProjectProjectionV1Schema.parse({
      ...base,
      job: { ...base.job, source_revision_hash: 'e'.repeat(64) },
      platform_state: { ...base.platform_state, active_revision_hash: 'e'.repeat(64), active_artifact_hash: 'f'.repeat(64), active_candidate_hash: H.candidate, parent_revision_hash: H.revision, parent_artifact_hash: H.artifact, parent_candidate_hash: null },
      review: { ...base.review, parent_revision_hash: 'e'.repeat(64), parent_artifact_hash: 'f'.repeat(64), revision_hash: 'e'.repeat(64), artifact_hash: 'f'.repeat(64) },
    })
    expect(firstCandidate.platform_state.parent_candidate_hash).toBeNull()

    const nextCandidate = RunnerProjectProjectionV1Schema.parse({
      ...base,
      job: { ...base.job, source_revision_hash: '1'.repeat(64) },
      platform_state: { ...base.platform_state, active_revision_hash: '1'.repeat(64), active_artifact_hash: '2'.repeat(64), active_candidate_hash: '3'.repeat(64), parent_revision_hash: 'e'.repeat(64), parent_artifact_hash: 'f'.repeat(64), parent_candidate_hash: H.candidate },
      review: { ...base.review, parent_revision_hash: '1'.repeat(64), parent_artifact_hash: '2'.repeat(64), revision_hash: '1'.repeat(64), artifact_hash: '2'.repeat(64) },
    })
    expect(nextCandidate.platform_state.parent_candidate_hash).toBe(H.candidate)

    const returned = RunnerProjectProjectionV1Schema.parse({
      ...base,
      job: { ...base.job, source_revision_hash: '4'.repeat(64) },
      platform_state: { ...base.platform_state, active_revision_hash: '4'.repeat(64), active_artifact_hash: 'f'.repeat(64), active_candidate_hash: H.candidate, parent_revision_hash: H.revision, parent_artifact_hash: H.artifact, parent_candidate_hash: null },
      review: { ...base.review, parent_revision_hash: '4'.repeat(64), parent_artifact_hash: 'f'.repeat(64), revision_hash: '4'.repeat(64), artifact_hash: 'f'.repeat(64) },
    })
    expect(returned.platform_state).toMatchObject({ active_revision_hash: '4'.repeat(64), active_artifact_hash: 'f'.repeat(64), active_candidate_hash: H.candidate, parent_revision_hash: H.revision, parent_artifact_hash: H.artifact, parent_candidate_hash: null })
    expect(returned.platform_state.active_revision_hash).not.toBe(H.revision)
    expect(() => RunnerProjectProjectionV1Schema.parse({
      ...base,
      platform_state: { ...base.platform_state, parent_revision_hash: H.revision, parent_artifact_hash: H.artifact },
    })).toThrow('base platform state cannot retain')
  })
})
