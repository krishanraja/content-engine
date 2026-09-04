import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FeedbackEventV1Schema, MagicEditActivationV1Schema, MagicEditDirectionV1Schema, MagicEditReturnToParentV1Schema, RenderManifestV2Schema, RunnerCommandEnvelopeV1Schema, StageArtifactV2Schema, runnerCommandHashInputV1, type ReviewDecisionRecordV1, type ReviewRecoveryRecordV1 } from '@mindmake/contracts'
import {
  buildRunnerProjectProjection,
  completeStageV2,
  createJobV2,
  createMagicEditTargetMap,
  dispatchRunnerCommand,
  hashFile,
  hashValue,
  jobPath,
  jobRevisionHashV2,
  loadJobV2,
  loadLocalReviewBinding,
  prepareMagicEditCandidate,
  persistLocalReviewBinding,
  persistClaimedCommandJournal,
  readTreatmentArtifactByHash,
  recordApprovalV2,
  recordReviewDecisionV2,
  resetApprovalSigningKeyProviderForTests,
  resetRunnerReceiptSigningKeyProviderForTests,
  setApprovalSigningKeyProviderForTests,
  setRunnerReceiptSigningKeyProviderForTests,
  signRunnerReceipt,
  stageArtifactSemanticHashV2,
} from '@mindmake/core'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const APPROVAL_KEY = 'unit-test-only-project-approval-key-at-least-32-bytes'

function renderManifest(jobId: string) {
  return RenderManifestV2Schema.parse({
    schema_version: 2,
    manifest_id: 'manifest-project-bootstrap',
    job_id: jobId,
    candidate_id: 'candidate-project-bootstrap',
    candidate_hash: HASH_A,
    visual_plan_artifact_hash: HASH_B,
    series: 'built_with_ai',
    treatment_id: 'premium-project-bootstrap',
    treatment_lane: 'premium',
    target_platform: 'youtube_shorts',
    output: { platform: 'youtube_shorts', width: 1080, height: 1920, fps: 30, audio_hz: 48000, safe_zones: { top_px: 100, right_px: 70, bottom_px: 300, left_px: 70 }, maximum_duration_ms: 180_000 },
    duration_ms: 2_000,
    sources: [{ source_id: 'camera-main', kind: 'video', path: 'G:\\private-media\\source.mp4', sha256: HASH_A, duration_ms: 10_000, width: 3840, height: 2160, fps: 30, audio_hz: 48000, canonical_offset_ms: 0 }],
    shot_directives: [{
      shot_id: 'shot-main', beat_id: 'beat-main', start_ms: 0, end_ms: 2_000, source_id: 'camera-main', source_start_ms: 4_000, source_end_ms: 6_000, subject_track_ids: ['krish-track'], primary_attention_target: { kind: 'presenter' }, technique_ids: ['locked-medium-close'],
      camera_plan: { camera_plan_id: 'camera-plan-main', source_id: 'camera-main', subject_track_ids: ['krish-track'], start_ms: 0, end_ms: 2_000, framing: 'medium_close', movement: 'locked', lead_room: 'none', protected_region_ids: [], keyframes: [{ at_ms: 0, crop: { x: 0.21875, y: 0, width: 0.5625, height: 1 }, zoom: 1, rotation_degrees: 0, confidence: 0.95 }], easing: 'hold', max_velocity: 1, max_acceleration: 1, minimum_hold_ms: 250, quality_floor: { minimum_effective_width_px: 1080, allow_upscale: false }, confidence: 0.95, fallback: 'Hold a stable portrait centre crop.' },
      layers: [{ layer_id: 'source-main', z_index: 0, kind: 'source', target_id: 'camera-main', anchor: 'full', opacity: 1, blend_mode: 'normal', protected: true }, { layer_id: 'caption-main', z_index: 20, kind: 'caption', anchor: 'bottom', bounds: { x: 0.065, y: 0.62, width: 0.87, height: 0.18 }, opacity: 1, blend_mode: 'normal', protected: true }],
      transition_in: 'none', transition_out: 'none', audio_continuity: 'direct', rationale: 'Keep Krish primary in a stable approved portrait frame.',
    }],
    assets: [], generated_shots: [], captions: [{ start_ms: 0, end_ms: 2_000, text: 'This changes the outcome.', emphasis: [] }],
    caption_provenance: { transcript_hash: HASH_A, verified: true, exact_word_fidelity: true, source_token_count: 4, caption_token_count: 4 },
    audio_plan: { dialogue_source_ids: ['camera-main'], dialogue_master_source_id: 'camera-main', dialogue_edits: [{ edit_id: 'dialogue-main', source_id: 'camera-main', output_start_ms: 0, output_end_ms: 2_000, source_start_ms: 4_000, source_end_ms: 6_000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 }], transitions: [], music: [], effects: [], target_lufs: -14, maximum_true_peak_dbtp: -1 },
    branding: { mode: 'none', wordmark_hashes: [] },
    disclosures: [{ platform: 'youtube_shorts', decision: 'not_required', rationale: 'No synthetic or meaningfully altered material is used.' }],
    fixed_seed: 'project-bootstrap-fixed-seed',
  })
}

function reviewDecisionCommand(payload: ReviewDecisionRecordV1, commandId: string) {
  const draft = RunnerCommandEnvelopeV1Schema.parse({
    schema_version: 1,
    command_id: commandId,
    command_kind: 'review_decision_record',
    job_id: payload.job_id,
    platform: payload.platform,
    candidate_hash: payload.candidate_hash,
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
  return RunnerCommandEnvelopeV1Schema.parse({ ...draft, command_hash: hashValue(runnerCommandHashInputV1(draft)) })
}

function reviewRecoveryCommand(payload: ReviewRecoveryRecordV1, commandId: string) {
  const draft = RunnerCommandEnvelopeV1Schema.parse({
    schema_version: 1, command_id: commandId, command_kind: 'review_recovery_record', job_id: payload.job_id, platform: payload.platform,
    candidate_hash: payload.candidate_hash, expected_parent_revision_hash: payload.expected_parent_revision_hash, expected_parent_artifact_hash: payload.expected_parent_artifact_hash,
    semantic_target_map_hash: payload.semantic_target_map_hash, idempotency_key: payload.recovery_id, payload_hash: hashValue(payload), command_hash: '0'.repeat(64),
    issued_at: payload.occurred_at, expires_at: '2026-09-04T12:00:00.000Z', payload,
  })
  return RunnerCommandEnvelopeV1Schema.parse({ ...draft, command_hash: hashValue(runnerCommandHashInputV1(draft)) })
}

describe('runner project bootstrap', () => {
  let root = ''
  let config = ''
  let skills: string[] = []

  beforeEach(async () => {
    setApprovalSigningKeyProviderForTests(() => APPROVAL_KEY)
    setRunnerReceiptSigningKeyProviderForTests(() => APPROVAL_KEY)
    root = await mkdtemp(join(tmpdir(), 'mindmake-project-bootstrap-'))
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
    config = join(root, 'studio.json')
    await writeFile(config, '{"schema_version":1}\n')
    skills = []
    for (const name of ['mindmake-video', 'krish-voice', 'content-corpus']) {
      const path = join(root, name, 'SKILL.md')
      await mkdir(join(root, name), { recursive: true })
      await writeFile(path, name)
      skills.push(path)
    }
  })

  afterEach(async () => {
    resetApprovalSigningKeyProviderForTests()
    resetRunnerReceiptSigningKeyProviderForTests()
    delete process.env.MINDMAKE_RUNTIME_ROOT
    await rm(root, { recursive: true, force: true })
  })

  it('projects an exact approved local treatment without media, transcript, or path fields', async () => {
    const job = await createJobV2({
      series: 'built_with_ai', mode: 'solo', presenterName: 'Krish', configPath: config, skillPaths: skills, targetPlatforms: ['youtube_shorts'],
      sourceBundle: { schema_version: 1, bundle_id: 'bundle-project', primary_source_id: 'camera-main', sources: [{ source_id: 'camera-main', kind: 'video', role: 'primary_camera', ref: 'G:\\private-media\\source.mp4', rights: 'owned', sync: { strategy: 'already_mixed', offset_ms: 0 }, include_in_edit: true }] },
    })
    const rootPath = jobPath(job.job_id)
    const manifestPath = join(rootPath, 'media', 'project-render-manifest.json')
    await mkdir(join(rootPath, 'media'), { recursive: true })
    await writeFile(manifestPath, `${JSON.stringify(renderManifest(job.job_id), null, 2)}\n`)
    const manifestHash = await hashFile(manifestPath)
    const payload = { manifests: [{ platform: 'youtube_shorts' as const, manifest_path: manifestPath, manifest_hash: manifestHash }] }
    const artifactBody = { schema_version: 2 as const, job_id: job.job_id, stage: 'treatment' as const, created_at: '2026-09-04T10:00:00.000Z', input_hashes: { manifest: manifestHash }, config_hash: job.config_hash, tool_versions: { fixture: '1' }, payload }
    const artifact = StageArtifactV2Schema.parse({ ...artifactBody, artifact_hash: stageArtifactSemanticHashV2(artifactBody) })
    const artifactPath = join(rootPath, 'artifacts', 'treatment', `${artifact.artifact_hash}.json`)
    await mkdir(join(rootPath, 'artifacts', 'treatment'), { recursive: true })
    await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
    await appendFile(join(rootPath, 'events.jsonl'), `${JSON.stringify({ schema_version: 2, event_id: randomUUID(), job_id: job.job_id, type: 'stage_completed', occurred_at: artifact.created_at, payload: { stage: 'treatment', artifact_hash: artifact.artifact_hash } })}\n`)
    await recordApprovalV2(job.job_id, 'treatment', 'approved', artifact.artifact_hash, undefined, 'krish', `codex-user-confirmation:treatment:${artifact.artifact_hash}:approved for project bootstrap`)

    const storyBody = { schema_version: 2 as const, job_id: job.job_id, stage: 'candidates' as const, created_at: '2026-09-04T10:00:01.000Z', input_hashes: { treatment: artifact.artifact_hash }, config_hash: job.config_hash, tool_versions: { fixture: '1' }, payload: { review: 'content-verified-storyboard' } }
    const storyArtifact = StageArtifactV2Schema.parse({ ...storyBody, artifact_hash: stageArtifactSemanticHashV2(storyBody) })
    await mkdir(join(rootPath, 'artifacts', 'candidates'), { recursive: true })
    await writeFile(join(rootPath, 'artifacts', 'candidates', `${storyArtifact.artifact_hash}.json`), `${JSON.stringify(storyArtifact, null, 2)}\n`)
    await appendFile(join(rootPath, 'events.jsonl'), `${JSON.stringify({ schema_version: 2, event_id: randomUUID(), job_id: job.job_id, type: 'stage_completed', occurred_at: storyArtifact.created_at, payload: { stage: 'candidates', artifact_hash: storyArtifact.artifact_hash } })}\n`)
    await appendFile(join(rootPath, 'events.jsonl'), `${JSON.stringify({ schema_version: 2, event_id: randomUUID(), job_id: job.job_id, type: 'stage_completed', occurred_at: '2026-09-04T10:00:02.000Z', payload: { stage: 'animatic', artifact_hash: 'f'.repeat(64) } })}\n`)
    const masterPath = join(rootPath, 'media', 'approved-final.mp4')
    await writeFile(masterPath, 'content-verified-final-master')
    const masterHash = await hashFile(masterPath)
    const renderBody = { schema_version: 2 as const, job_id: job.job_id, stage: 'render' as const, created_at: '2026-09-04T10:00:03.000Z', input_hashes: { treatment: artifact.artifact_hash }, config_hash: job.config_hash, tool_versions: { fixture: '1' }, payload: { renders: [{ platform: 'youtube_shorts' as const, master_path: masterPath, master_hash: masterHash, manifest_path: manifestPath, manifest_hash: manifestHash }] } }
    const renderArtifact = StageArtifactV2Schema.parse({ ...renderBody, artifact_hash: stageArtifactSemanticHashV2(renderBody) })
    await mkdir(join(rootPath, 'artifacts', 'render'), { recursive: true })
    await writeFile(join(rootPath, 'artifacts', 'render', `${renderArtifact.artifact_hash}.json`), `${JSON.stringify(renderArtifact, null, 2)}\n`)
    await appendFile(join(rootPath, 'events.jsonl'), `${JSON.stringify({ schema_version: 2, event_id: randomUUID(), job_id: job.job_id, type: 'stage_completed', occurred_at: renderArtifact.created_at, payload: { stage: 'render', artifact_hash: renderArtifact.artifact_hash } })}\n`)
    const qaBody = { schema_version: 2 as const, job_id: job.job_id, stage: 'qa' as const, created_at: '2026-09-04T10:00:04.000Z', input_hashes: { render: renderArtifact.artifact_hash }, config_hash: job.config_hash, tool_versions: { fixture: '1' }, payload: { passed: true, results: [{ platform: 'youtube_shorts', passed: true }] } }
    const qaArtifact = StageArtifactV2Schema.parse({ ...qaBody, artifact_hash: stageArtifactSemanticHashV2(qaBody) })
    await mkdir(join(rootPath, 'artifacts', 'qa'), { recursive: true })
    await writeFile(join(rootPath, 'artifacts', 'qa', `${qaArtifact.artifact_hash}.json`), `${JSON.stringify(qaArtifact, null, 2)}\n`)
    await appendFile(join(rootPath, 'events.jsonl'), `${JSON.stringify({ schema_version: 2, event_id: randomUUID(), job_id: job.job_id, type: 'stage_completed', occurred_at: qaArtifact.created_at, payload: { stage: 'qa', artifact_hash: qaArtifact.artifact_hash } })}\n`)

    const projection = await buildRunnerProjectProjection({ job_id: job.job_id, platform: 'youtube_shorts', gate: 'treatment', idempotency_key: '11111111-1111-4111-8111-111111111111', safe_title: 'Current approved treatment', safe_summary: 'Ready for bounded mobile presentation edits.' })
    expect(projection.platform_state.active_artifact_hash).toBe(artifact.artifact_hash)
    expect(projection.review).toMatchObject({ gate: 'treatment', candidate_hash: null, revision_hash: projection.platform_state.active_revision_hash, artifact_hash: artifact.artifact_hash })
    expect(projection.review.safe_payload.target).toEqual({ kind: 'range', start_ms: 0, end_ms: 2_000 })
    expect(hashValue(projection)).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(projection)).not.toMatch(/private-media|source\.mp4|manifest_path|media_path|raw_transcript|transcript_(?:text|path)|oauth|credential/i)

    const derivedOne = await buildRunnerProjectProjection({ job_id: job.job_id, platform: 'youtube_shorts', gate: 'treatment', safe_title: 'Current approved treatment', safe_summary: 'Ready for bounded mobile presentation edits.' })
    const derivedTwo = await buildRunnerProjectProjection({ job_id: job.job_id, platform: 'youtube_shorts', gate: 'treatment', safe_title: 'Current approved treatment', safe_summary: 'Ready for bounded mobile presentation edits.' })
    expect(derivedOne.review.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(derivedTwo).toEqual(derivedOne)

    const signingKey = Buffer.from(APPROVAL_KEY)
    const keepPayload: ReviewDecisionRecordV1 = {
      schema_version: 1,
      decision_id: '33333333-3333-4333-8333-333333333333',
      job_id: job.job_id,
      platform: 'youtube_shorts',
      review_id: projection.review.id,
      gate: 'treatment',
      candidate_hash: null,
      semantic_target_map_hash: projection.platform_state.semantic_target_map_hash,
      expected_parent_revision_hash: projection.platform_state.active_revision_hash,
      expected_parent_artifact_hash: artifact.artifact_hash,
      review_revision_hash: projection.review.revision_hash,
      review_artifact_hash: artifact.artifact_hash,
      decision: 'keep_current',
      feedback: 'Keep the current treatment. The alternative does not improve the point.',
      override_reason: null,
      learning_confirmation: null,
      decided_by: 'Krish',
      occurred_at: '2026-09-04T10:01:00.000Z',
    }
    const keepCommand = reviewDecisionCommand(keepPayload, '44444444-4444-4444-8444-444444444444')
    const treatmentBindingPath = join(rootPath, 'control-plane', 'reviews', `${projection.review.id}.json`)
    const authenticTreatmentBinding = await readFile(treatmentBindingPath, 'utf8')
    const tamperedTreatmentBinding = JSON.parse(authenticTreatmentBinding)
    tamperedTreatmentBinding.review_artifact_hash = storyArtifact.artifact_hash
    await writeFile(treatmentBindingPath, `${JSON.stringify(tamperedTreatmentBinding, null, 2)}\n`)
    await expect(dispatchRunnerCommand(keepCommand, { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toThrow('failed authentication')
    await writeFile(treatmentBindingPath, authenticTreatmentBinding)

    // Simulate a process crash immediately after the signed decision append.
    await recordReviewDecisionV2(job.job_id, keepPayload, { command_id: keepCommand.command_id, command_hash: keepCommand.command_hash })
    const afterDecisionRevision = jobRevisionHashV2(await loadJobV2(job.job_id))
    expect(afterDecisionRevision).not.toBe(keepPayload.expected_parent_revision_hash)
    const keepRetryCommand = reviewDecisionCommand(keepPayload, '56565656-5656-4656-8656-565656565656')
    expect(keepRetryCommand.command_hash).toBe(keepCommand.command_hash)
    const keepResult = await dispatchRunnerCommand(keepRetryCommand, { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })
    expect(keepResult).toMatchObject({ status: 'succeeded', result_revision_hash: afterDecisionRevision, result_artifact_hash: artifact.artifact_hash, result_refs: { comparison_alignment: 'unavailable' } })
    expect(keepResult.result_refs?.semantic_target_map_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(await dispatchRunnerCommand(reviewDecisionCommand(keepPayload, '57575757-5757-4757-8757-575757575757'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).toEqual(keepResult)
    const forkedKeepPayload = { ...keepPayload, feedback: 'A different decision body must never reuse this decision ID.' }
    await expect(dispatchRunnerCommand(reviewDecisionCommand(forkedKeepPayload, '58585858-5858-4858-8858-585858585858'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toThrow('different semantic content')

    const finalProjection = await buildRunnerProjectProjection({ job_id: job.job_id, platform: 'youtube_shorts', gate: 'final', safe_title: 'Final review parent', safe_summary: 'Exact parent context for a final master decision.' })
    const finalPayload: ReviewDecisionRecordV1 = {
      schema_version: 1,
      decision_id: '12121212-1212-4212-8212-121212121212',
      job_id: job.job_id,
      platform: 'youtube_shorts',
      review_id: finalProjection.review.id,
      gate: 'final',
      candidate_hash: null,
      semantic_target_map_hash: finalProjection.platform_state.semantic_target_map_hash,
      expected_parent_revision_hash: finalProjection.platform_state.active_revision_hash,
      expected_parent_artifact_hash: finalProjection.platform_state.active_artifact_hash,
      review_revision_hash: finalProjection.review.revision_hash,
      review_artifact_hash: finalProjection.review.artifact_hash,
      decision: 'use_candidate',
      feedback: 'This is the exact platform master I approve.',
      override_reason: null,
      learning_confirmation: null,
      decided_by: 'Krish',
      occurred_at: '2026-09-04T10:01:30.000Z',
    }
    const finalCommand = reviewDecisionCommand(finalPayload, '14141414-1414-4414-8414-141414141414')
    const forgedKnownArtifact = { ...finalPayload, decision_id: '15151515-1515-4515-8515-151515151515', review_artifact_hash: storyArtifact.artifact_hash }
    await expect(dispatchRunnerCommand(reviewDecisionCommand(forgedKnownArtifact, '18181818-1818-4818-8818-181818181818'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toThrow('exact authenticated local review identity')
    const finalResult = await dispatchRunnerCommand(finalCommand, { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })
    expect(finalResult.result_artifact_hash).toBe(artifact.artifact_hash)
    expect(finalResult.result_revision_hash).not.toBe(finalPayload.expected_parent_revision_hash)
    expect((await loadJobV2(job.job_id)).approvals.some((approval) => approval.gate === 'final' && approval.artifact_hash === masterHash && approval.decision === 'approved')).toBe(true)

    const storyProjection = await buildRunnerProjectProjection({ job_id: job.job_id, platform: 'youtube_shorts', gate: 'story', safe_title: 'Story review recovery', safe_summary: 'Exact parent context for a signed story decision.' })
    const storyPayload: ReviewDecisionRecordV1 = {
      schema_version: 1,
      decision_id: '55555555-5555-4555-8555-555555555555',
      job_id: job.job_id,
      platform: 'youtube_shorts',
      review_id: storyProjection.review.id,
      gate: 'story',
      candidate_hash: null,
      semantic_target_map_hash: storyProjection.platform_state.semantic_target_map_hash,
      expected_parent_revision_hash: storyProjection.platform_state.active_revision_hash,
      expected_parent_artifact_hash: storyProjection.platform_state.active_artifact_hash,
      review_revision_hash: storyProjection.review.revision_hash,
      review_artifact_hash: storyProjection.review.artifact_hash,
      decision: 'use_candidate',
      feedback: 'The story now earns its ending.',
      override_reason: null,
      learning_confirmation: null,
      decided_by: 'Krish',
      occurred_at: '2026-09-04T10:02:00.000Z',
    }
    const storyCommand = reviewDecisionCommand(storyPayload, '77777777-7777-4777-8777-777777777777')
    await recordReviewDecisionV2(job.job_id, storyPayload, { command_id: storyCommand.command_id, command_hash: storyCommand.command_hash })
    await recordApprovalV2(job.job_id, 'angle', 'approved', storyArtifact.artifact_hash, undefined, 'krish', `control-center-confirmation:angle:${storyArtifact.artifact_hash}:review:${storyPayload.review_id}:decision:${storyPayload.decision_id}`)
    const storyResult = await dispatchRunnerCommand(storyCommand, { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })
    expect(storyResult.result_artifact_hash).toBe(storyArtifact.artifact_hash)
    expect(storyResult.result_revision_hash).not.toBe(storyPayload.expected_parent_revision_hash)

    const learningEvent = FeedbackEventV1Schema.parse({
      schema_version: 1,
      feedback_id: 'feedback-project-bootstrap',
      job_id: job.job_id,
      artifact_id: artifact.artifact_hash,
      stage: 'treatment',
      action: 'revise',
      origin: 'user',
      before_hash: artifact.artifact_hash,
      delta_features: [{ feature: 'proof_timing', before: 'late', after: 'early' }],
      inferred_rationale: 'Move verified proof earlier when it improves comprehension without changing the claim.',
      confidence: 0.9,
      scope: { level: 'treatment', key: 'premium' },
      confirmation: 'pending',
      occurred_at: '2026-09-04T10:02:30.000Z',
    })
    const learningRoot = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'learning')
    await mkdir(learningRoot, { recursive: true })
    await writeFile(join(learningRoot, 'feedback.jsonl'), `${JSON.stringify(learningEvent)}\n`)
    const learningHash = hashValue(learningEvent)
    const learningProjection = await buildRunnerProjectProjection({ job_id: job.job_id, platform: 'youtube_shorts', gate: 'learning', review_artifact_hash: learningHash, safe_title: 'Confirm proof timing learning', safe_summary: 'A schema-validated local learning observation awaits Krish.' })
    const learningPayload: ReviewDecisionRecordV1 = {
      schema_version: 1,
      decision_id: '16161616-1616-4616-8616-161616161616',
      job_id: job.job_id,
      platform: 'youtube_shorts',
      review_id: learningProjection.review.id,
      gate: 'learning',
      candidate_hash: null,
      semantic_target_map_hash: learningProjection.platform_state.semantic_target_map_hash,
      expected_parent_revision_hash: learningProjection.platform_state.active_revision_hash,
      expected_parent_artifact_hash: learningProjection.platform_state.active_artifact_hash,
      review_revision_hash: learningProjection.review.revision_hash,
      review_artifact_hash: learningProjection.review.artifact_hash,
      decision: 'keep_current',
      feedback: 'Keep this narrowly scoped as an observation.',
      override_reason: null,
      learning_confirmation: { action: 'observe_only' },
      decided_by: 'Krish',
      occurred_at: '2026-09-04T10:02:45.000Z',
    }
    const learningResult = await dispatchRunnerCommand(reviewDecisionCommand(learningPayload, '17171717-1717-4717-8717-171717171717'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })
    expect(learningResult.result_artifact_hash).toBe(artifact.artifact_hash)
    await expect(buildRunnerProjectProjection({ job_id: job.job_id, platform: 'youtube_shorts', gate: 'learning', review_artifact_hash: 'f'.repeat(64), safe_title: 'Invalid learning', safe_summary: 'This hash does not identify a schema-valid learning artifact.' })).rejects.toThrow('schema-validated persisted artifact')

    const recoverySource = await buildRunnerProjectProjection({ job_id: job.job_id, platform: 'youtube_shorts', gate: 'treatment', safe_title: 'Recover this review', safe_summary: 'The exact unchanged treatment review needs a new discoverable card.' })
    const failedCommandId = '20202020-2020-4020-8020-202020202020'
    const failedCommandHash = '8'.repeat(64)
    const failedReceipt = signRunnerReceipt({
      schema_version: 1, command_id: failedCommandId, command_hash: failedCommandHash, job_id: job.job_id, status: 'failed', result_revision_hash: null, result_artifact_hash: null,
      hard_gates: recoverySource.review.hard_gates, retryable: false, safe_code: 'stale_parent', started_at: '2026-09-04T10:02:50.000Z', finished_at: '2026-09-04T10:02:51.000Z',
    }, signingKey)
    const failedIdempotency = '21212121-2121-4121-8121-212121212121'
    const acknowledgedDirectory = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'runner', 'receipts', 'acknowledged', failedIdempotency)
    await mkdir(acknowledgedDirectory, { recursive: true })
    await writeFile(join(acknowledgedDirectory, `${failedCommandId}.json`), `${JSON.stringify(failedReceipt, null, 2)}\n`)
    const recoveryPayload: ReviewRecoveryRecordV1 = {
      schema_version: 1, recovery_id: '22222222-2222-4222-8222-222222222222', job_id: job.job_id, platform: 'youtube_shorts',
      source_review_id: recoverySource.review.id, recovery_review_id: '23232323-2323-4323-8323-232323232323', source_command_id: failedCommandId, source_command_hash: failedCommandHash, source_terminal_reason: 'runner_failed_receipt',
      recovery_root_command_id: failedCommandId, recovery_generation: 1, gate: 'treatment', expected_parent_revision_hash: recoverySource.review.parent_revision_hash,
      expected_parent_artifact_hash: recoverySource.review.parent_artifact_hash, review_revision_hash: recoverySource.review.revision_hash, review_artifact_hash: recoverySource.review.artifact_hash,
      candidate_hash: null, semantic_target_map_hash: recoverySource.review.safe_payload.semantic_target_map_hash, recovered_by: 'Krish', occurred_at: '2026-09-04T10:02:52.000Z',
    }
    const missingSourceRecovery = { ...recoveryPayload, recovery_id: '24242424-2424-4424-8424-242424242424', source_review_id: '25252525-2525-4525-8525-252525252525', recovery_review_id: '26262626-2626-4626-8626-262626262626' }
    await expect(dispatchRunnerCommand(reviewRecoveryCommand(missingSourceRecovery, '27272727-2727-4727-8727-272727272727'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toMatchObject({ code: 'ENOENT' })
    const tamperedRecovery = { ...recoveryPayload, recovery_id: '34343434-3434-4434-8434-343434343434', recovery_review_id: '35353535-3535-4535-8535-353535353535', review_artifact_hash: storyArtifact.artifact_hash }
    await expect(dispatchRunnerCommand(reviewRecoveryCommand(tamperedRecovery, '36363636-3636-4636-8636-363636363636'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toThrow('exactly clone')
    const invalidChain = { ...recoveryPayload, recovery_id: '28282828-2828-4828-8828-282828282828', recovery_review_id: '29292929-2929-4929-8929-292929292929', recovery_generation: 2 as const }
    await expect(dispatchRunnerCommand(reviewRecoveryCommand(invalidChain, '30303030-3030-4030-8030-303030303030'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toThrow('recovery chain')
    const recoveryCommand = reviewRecoveryCommand(recoveryPayload, '31313131-3131-4131-8131-313131313131')
    // Simulate a crash after the recovered review binding is durable but before
    // its signed recovery event or runner receipt exists.
    const recoverySourceBinding = await loadLocalReviewBinding(job.job_id, recoveryPayload.source_review_id)
    const { binding_hash: _sourceBindingHash, binding_signature: _sourceBindingSignature, review_id: _sourceReviewId, recovery_provenance: _sourceRecovery, ...recoverySourceBody } = recoverySourceBinding
    await persistLocalReviewBinding({
      ...recoverySourceBody,
      review_id: recoveryPayload.recovery_review_id,
      recovery_provenance: {
        recovery_id: recoveryPayload.recovery_id,
        source_review_id: recoveryPayload.source_review_id,
        source_command_id: recoveryPayload.source_command_id,
        source_command_hash: recoveryPayload.source_command_hash,
        source_terminal_reason: recoveryPayload.source_terminal_reason,
        source_evidence: 'signed_failed_receipt',
        recovery_root_command_id: recoveryPayload.recovery_root_command_id,
        recovery_generation: recoveryPayload.recovery_generation,
        bridge_command_id: recoveryCommand.command_id,
        bridge_command_hash: recoveryCommand.command_hash,
      },
    })
    const recoveryRetryCommand = reviewRecoveryCommand(recoveryPayload, '59595959-5959-4959-8959-595959595959')
    expect(recoveryRetryCommand.command_hash).toBe(recoveryCommand.command_hash)
    const recoveryResult = await dispatchRunnerCommand(recoveryRetryCommand, { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })
    expect(recoveryResult).toMatchObject({ result_revision_hash: recoveryPayload.expected_parent_revision_hash, result_artifact_hash: recoveryPayload.expected_parent_artifact_hash, result_refs: { comparison_alignment: 'unavailable' } })
    // A further fresh attempt covers the second crash window: binding and
    // signed event are present, but no runner receipt was persisted.
    expect(await dispatchRunnerCommand(reviewRecoveryCommand(recoveryPayload, '60606060-6060-4060-8060-606060606060'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).toEqual(recoveryResult)
    const recoveredBinding = await loadLocalReviewBinding(job.job_id, recoveryPayload.recovery_review_id)
    expect(recoveredBinding).toMatchObject({ review_id: recoveryPayload.recovery_review_id, parent_revision_hash: recoveryPayload.expected_parent_revision_hash, recovery_provenance: { source_review_id: recoveryPayload.source_review_id, source_terminal_reason: 'runner_failed_receipt', source_evidence: 'signed_failed_receipt', recovery_generation: 1, bridge_command_id: recoveryCommand.command_id, bridge_command_hash: recoveryCommand.command_hash } })
    const forkedRecoveryPayload = { ...recoveryPayload, occurred_at: '2026-09-04T10:02:52.500Z' }
    await expect(dispatchRunnerCommand(reviewRecoveryCommand(forkedRecoveryPayload, '61616161-6161-4161-8161-616161616161'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toThrow('different semantic content')

    const exhaustedDecision: ReviewDecisionRecordV1 = {
      schema_version: 1, decision_id: '37373737-3737-4737-8737-373737373737', job_id: job.job_id, platform: 'youtube_shorts', review_id: recoverySource.review.id,
      gate: 'treatment', candidate_hash: null, semantic_target_map_hash: recoverySource.review.safe_payload.semantic_target_map_hash,
      expected_parent_revision_hash: recoverySource.review.parent_revision_hash, expected_parent_artifact_hash: recoverySource.review.parent_artifact_hash,
      review_revision_hash: recoverySource.review.revision_hash, review_artifact_hash: recoverySource.review.artifact_hash,
      decision: 'keep_current', feedback: 'This command was claimed but exhausted before it could be safely recorded.', override_reason: null, learning_confirmation: null,
      decided_by: 'Krish', occurred_at: '2026-09-04T10:02:54.000Z',
    }
    const exhaustedSourceCommand = reviewDecisionCommand(exhaustedDecision, '38383838-3838-4838-8838-383838383838')
    await persistClaimedCommandJournal(exhaustedSourceCommand, 'runner-project-test', signingKey, '2026-09-04T10:02:55.000Z', process.env.MINDMAKE_RUNTIME_ROOT!)
    const exhaustedRecovery: ReviewRecoveryRecordV1 = {
      ...recoveryPayload,
      recovery_id: '39393939-3939-4939-8939-393939393939',
      recovery_review_id: '40404040-4040-4040-8040-404040404040',
      source_command_id: exhaustedSourceCommand.command_id,
      source_command_hash: exhaustedSourceCommand.command_hash,
      source_terminal_reason: 'attempts_exhausted',
      recovery_root_command_id: exhaustedSourceCommand.command_id,
      occurred_at: '2026-09-04T10:02:56.000Z',
    }
    const exhaustedResult = await dispatchRunnerCommand(reviewRecoveryCommand(exhaustedRecovery, '41414141-4141-4141-8141-414141414141'), { repoRoot: root, runtimeRoot: process.env.MINDMAKE_RUNTIME_ROOT!, signingKey, publishPreview: async () => { throw new Error('not used') } })
    expect(exhaustedResult.result_revision_hash).toBe(recoverySource.review.parent_revision_hash)
    expect(await loadLocalReviewBinding(job.job_id, exhaustedRecovery.recovery_review_id)).toMatchObject({ recovery_provenance: { source_terminal_reason: 'attempts_exhausted', source_evidence: 'signed_claim_journal' } })

    const missingJournalRecovery: ReviewRecoveryRecordV1 = {
      ...recoveryPayload,
      recovery_id: '42424242-4242-4242-8242-424242424242',
      recovery_review_id: '43434343-4343-4343-8343-434343434343',
      source_command_id: '44444444-4444-4444-8444-444444444444',
      source_command_hash: '4'.repeat(64),
      source_terminal_reason: 'attempts_exhausted',
      recovery_root_command_id: '44444444-4444-4444-8444-444444444444',
      occurred_at: '2026-09-04T10:02:57.000Z',
    }
    await expect(dispatchRunnerCommand(reviewRecoveryCommand(missingJournalRecovery, '45454545-4545-4545-8545-454545454545'), { repoRoot: root, runtimeRoot: process.env.MINDMAKE_RUNTIME_ROOT!, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toThrow('claimed-command journal')

    const expiredRecovery: ReviewRecoveryRecordV1 = {
      ...missingJournalRecovery,
      recovery_id: '46464646-4646-4646-8646-464646464646',
      recovery_review_id: '47474747-4747-4747-8747-474747474747',
      source_terminal_reason: 'command_expired',
      occurred_at: '2026-09-04T10:02:58.000Z',
    }
    await expect(dispatchRunnerCommand(reviewRecoveryCommand(expiredRecovery, '48484848-4848-4848-8848-484848484848'), { repoRoot: root, runtimeRoot: process.env.MINDMAKE_RUNTIME_ROOT!, signingKey, publishPreview: async () => { throw new Error('not used') } })).resolves.toMatchObject({ result_revision_hash: recoverySource.review.parent_revision_hash })
    expect(await loadLocalReviewBinding(job.job_id, expiredRecovery.recovery_review_id)).toMatchObject({ recovery_provenance: { source_terminal_reason: 'command_expired', source_evidence: 'cloud_terminal_without_receipt' } })

    const falselyExpiredRecovery: ReviewRecoveryRecordV1 = {
      ...exhaustedRecovery,
      recovery_id: '49494949-4949-4949-8949-494949494949',
      recovery_review_id: '50505050-5050-4050-8050-505050505050',
      source_terminal_reason: 'command_expired',
      occurred_at: '2026-09-04T10:02:59.000Z',
    }
    await expect(dispatchRunnerCommand(reviewRecoveryCommand(falselyExpiredRecovery, '51515151-5151-4151-8151-515151515151'), { repoRoot: root, runtimeRoot: process.env.MINDMAKE_RUNTIME_ROOT!, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toThrow('never claimed')

    const claimJournalPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'runner', 'claims', `${exhaustedSourceCommand.command_id}.json`)
    const tamperedClaimJournal = JSON.parse(await readFile(claimJournalPath, 'utf8'))
    tamperedClaimJournal.journal_signature = '0'.repeat(64)
    await writeFile(claimJournalPath, `${JSON.stringify(tamperedClaimJournal, null, 2)}\n`)
    const tamperedJournalRecovery: ReviewRecoveryRecordV1 = {
      ...exhaustedRecovery,
      recovery_id: '52525252-5252-4252-8252-525252525252',
      recovery_review_id: '53535353-5353-4353-8353-535353535353',
      occurred_at: '2026-09-04T10:02:59.500Z',
    }
    await expect(dispatchRunnerCommand(reviewRecoveryCommand(tamperedJournalRecovery, '54545454-5454-4454-8454-545454545454'), { repoRoot: root, runtimeRoot: process.env.MINDMAKE_RUNTIME_ROOT!, signingKey, publishPreview: async () => { throw new Error('not used') } })).rejects.toThrow('failed authentication')
    const recoveredDecision: ReviewDecisionRecordV1 = {
      schema_version: 1, decision_id: '32323232-3232-4232-8232-323232323232', job_id: job.job_id, platform: 'youtube_shorts', review_id: recoveryPayload.recovery_review_id,
      gate: 'treatment', candidate_hash: null, semantic_target_map_hash: recoveryPayload.semantic_target_map_hash, expected_parent_revision_hash: recoveryPayload.expected_parent_revision_hash,
      expected_parent_artifact_hash: recoveryPayload.expected_parent_artifact_hash, review_revision_hash: recoveryPayload.review_revision_hash, review_artifact_hash: recoveryPayload.review_artifact_hash,
      decision: 'keep_current', feedback: 'Keep the current treatment after recovering the exact review.', override_reason: null, learning_confirmation: null, decided_by: 'Krish', occurred_at: '2026-09-04T10:02:53.000Z',
    }
    await dispatchRunnerCommand(reviewDecisionCommand(recoveredDecision, '33333333-3333-4333-8333-333333333334'), { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })

    const firstMap = await createMagicEditTargetMap(job.job_id, 'youtube_shorts')
    const cameraTarget = firstMap.targets.find((target) => target.kind === 'camera')!
    const firstDirection = MagicEditDirectionV1Schema.parse({
      schema_version: 1,
      direction_id: '88888888-8888-4888-8888-888888888888',
      job_id: job.job_id,
      platform: 'youtube_shorts',
      expected_parent_revision_hash: firstMap.expected_parent_revision_hash,
      expected_parent_artifact_hash: firstMap.expected_parent_artifact_hash,
      semantic_target_map_hash: firstMap.semantic_target_map_hash,
      selection: { kind: 'target', target_ids: [cameraTarget.target_id] },
      instruction: 'Push in closer on this camera shot.',
      protections: { preserve_spoken_words: true, preserve_spoken_order: true, preserve_claims: true, preserve_evidence: true, preserve_rights: true },
      requested_profile: 'preview',
      submitted_by: 'Krish',
      submitted_at: '2026-09-04T10:03:00.000Z',
    })
    const prepared = await prepareMagicEditCandidate(job.job_id, firstDirection)
    if ('status' in prepared) throw new Error(`expected prepared magic candidate, got ${prepared.status}`)
    await persistLocalReviewBinding({
      schema_version: 1,
      review_id: 'aaaaaaaa-aaaa-8aaa-8aaa-aaaaaaaaaaaa',
      job_id: job.job_id,
      platform: 'youtube_shorts',
      gate: 'treatment',
      parent_revision_hash: prepared.expected_parent_revision_hash,
      parent_artifact_hash: prepared.expected_parent_artifact_hash,
      review_revision_hash: prepared.candidate_hash,
      review_artifact_hash: prepared.prepared_treatment_artifact_hash,
      candidate_hash: prepared.candidate_hash,
      semantic_target_map_hash: prepared.semantic_target_map_hash,
      review_target: { kind: 'beat', ref: cameraTarget.target_id },
      hard_gates: { truth: { status: 'passed' }, rights: { status: 'passed' }, confidentiality: { status: 'passed' }, transcript_fidelity: { status: 'passed' }, naming: { status: 'passed' } },
      provenance: { kind: 'magic_candidate', candidate_hash: prepared.candidate_hash, prepared_treatment_artifact_hash: prepared.prepared_treatment_artifact_hash },
      created_at: prepared.created_at,
    })
    const activation = MagicEditActivationV1Schema.parse({
      schema_version: 1,
      activation_id: '99999999-9999-4999-8999-999999999999',
      job_id: job.job_id,
      platform: 'youtube_shorts',
      candidate_hash: prepared.candidate_hash,
      expected_parent_revision_hash: prepared.expected_parent_revision_hash,
      expected_parent_artifact_hash: prepared.expected_parent_artifact_hash,
      prepared_treatment_artifact_hash: prepared.prepared_treatment_artifact_hash,
      decision: 'activate',
      approved_by: 'Krish',
      confirmation_ref: `control-center-confirmation:treatment:${prepared.prepared_treatment_artifact_hash}:review:aaaaaaaa-aaaa-8aaa-8aaa-aaaaaaaaaaaa:decision:99999999-9999-4999-8999-999999999999`,
      occurred_at: '2026-09-04T10:04:00.000Z',
    })
    const activationDraft = RunnerCommandEnvelopeV1Schema.parse({
      schema_version: 1, command_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', command_kind: 'magic_edit_activate', job_id: job.job_id, platform: 'youtube_shorts', candidate_hash: prepared.candidate_hash,
      expected_parent_revision_hash: prepared.expected_parent_revision_hash, expected_parent_artifact_hash: prepared.expected_parent_artifact_hash, semantic_target_map_hash: prepared.semantic_target_map_hash,
      idempotency_key: activation.activation_id, payload_hash: hashValue(activation), command_hash: '0'.repeat(64), issued_at: '2026-09-04T10:04:00.000Z', expires_at: '2026-09-04T12:00:00.000Z', payload: activation,
    })
    const activationCommand = RunnerCommandEnvelopeV1Schema.parse({ ...activationDraft, command_hash: hashValue(runnerCommandHashInputV1(activationDraft)) })
    const activated = await dispatchRunnerCommand(activationCommand, { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })
    expect(activated.result_artifact_hash).toBe(prepared.prepared_treatment_artifact_hash)
    const reboundHash = activated.result_refs?.semantic_target_map_hash
    expect(reboundHash).toMatch(/^[a-f0-9]{64}$/)
    const reboundMap = await createMagicEditTargetMap(job.job_id, 'youtube_shorts')
    expect(reboundMap.semantic_target_map_hash).toBe(reboundHash)
    expect(reboundMap.expected_parent_revision_hash).toBe(activated.result_revision_hash)
    expect(reboundMap.expected_parent_artifact_hash).toBe(activated.result_artifact_hash)
    expect(await dispatchRunnerCommand(activationCommand, { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).toEqual(activated)

    const secondDirection = MagicEditDirectionV1Schema.parse({ ...firstDirection, direction_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', expected_parent_revision_hash: reboundMap.expected_parent_revision_hash, expected_parent_artifact_hash: reboundMap.expected_parent_artifact_hash, semantic_target_map_hash: reboundMap.semantic_target_map_hash, selection: { kind: 'target', target_ids: [reboundMap.targets.find((target) => target.kind === 'camera')!.target_id] }, instruction: 'Pull out wider on this camera shot.', submitted_at: '2026-09-04T10:05:00.000Z' })
    const secondPrepared = await prepareMagicEditCandidate(job.job_id, secondDirection)
    expect('status' in secondPrepared).toBe(false)

    const returnPayload = MagicEditReturnToParentV1Schema.parse({
      schema_version: 1,
      return_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      job_id: job.job_id,
      platform: 'youtube_shorts',
      expected_parent_revision_hash: activated.result_revision_hash,
      expected_parent_artifact_hash: activated.result_artifact_hash,
      target_parent_revision_hash: prepared.expected_parent_revision_hash,
      target_parent_artifact_hash: prepared.expected_parent_artifact_hash,
      returned_by: 'Krish',
      occurred_at: '2026-09-04T10:06:00.000Z',
    })
    const returnDraft = RunnerCommandEnvelopeV1Schema.parse({
      schema_version: 1, command_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', command_kind: 'magic_edit_return_to_parent', job_id: job.job_id, platform: 'youtube_shorts', candidate_hash: prepared.candidate_hash,
      expected_parent_revision_hash: returnPayload.expected_parent_revision_hash, expected_parent_artifact_hash: returnPayload.expected_parent_artifact_hash, semantic_target_map_hash: null,
      idempotency_key: returnPayload.return_id, payload_hash: hashValue(returnPayload), command_hash: '0'.repeat(64), issued_at: '2026-09-04T10:06:00.000Z', expires_at: '2026-09-04T12:00:00.000Z', payload: returnPayload,
    })
    const returnCommand = RunnerCommandEnvelopeV1Schema.parse({ ...returnDraft, command_hash: hashValue(runnerCommandHashInputV1(returnDraft)) })
    const parentTreatment = await readTreatmentArtifactByHash(job.job_id, prepared.expected_parent_artifact_hash)
    await completeStageV2(job.job_id, 'treatment', parentTreatment.payload, parentTreatment.input_hashes, parentTreatment.tool_versions)
    const returned = await dispatchRunnerCommand(returnCommand, { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })
    expect(returned.result_artifact_hash).toBe(prepared.expected_parent_artifact_hash)
    expect(returned.result_revision_hash).not.toBe(prepared.expected_parent_revision_hash)
    expect(returned.result_refs?.semantic_target_map_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(await dispatchRunnerCommand(returnCommand, { repoRoot: root, signingKey, publishPreview: async () => { throw new Error('not used') } })).toEqual(returned)

    const eventLines = (await readFile(join(rootPath, 'events.jsonl'), 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { type: string; payload: Record<string, unknown> })
    expect(eventLines.filter((event) => event.type === 'review_decision_recorded')).toHaveLength(5)
    expect(eventLines.filter((event) => event.type === 'review_recovery_recorded')).toHaveLength(3)
    expect(eventLines.filter((event) => event.type === 'approval_recorded' && (event.payload.approval as { gate?: string } | undefined)?.gate === 'angle')).toHaveLength(1)
    expect(eventLines.find((event) => event.type === 'review_decision_recorded' && (event.payload.decision as { decision?: string } | undefined)?.decision === 'keep_current')).toBeTruthy()
    expect(eventLines.filter((event) => event.type === 'magic_edit_activated' && (event.payload as { action?: string }).action === 'return_to_parent')).toHaveLength(1)

    const tampered = eventLines.map((event) => event.type === 'review_decision_recorded' && (event.payload.decision as { decision_id?: string } | undefined)?.decision_id === keepPayload.decision_id
      ? { ...event, payload: { ...event.payload, receipt: { ...(event.payload.receipt as Record<string, unknown>), signature: '0'.repeat(64) } } }
      : event)
    await writeFile(join(rootPath, 'events.jsonl'), `${tampered.map((event) => JSON.stringify(event)).join('\n')}\n`)
    await expect(loadJobV2(job.job_id)).rejects.toThrow('unauthenticated review decision')
  }, 60_000)

  it('projects a story review before any treatment exists', async () => {
    const job = await createJobV2({
      series: 'built_with_ai', mode: 'solo', presenterName: 'Krish', configPath: config, skillPaths: skills, targetPlatforms: ['youtube_shorts'],
      sourceBundle: { schema_version: 1, bundle_id: 'bundle-story-first', primary_source_id: 'camera-main', sources: [{ source_id: 'camera-main', kind: 'video', role: 'primary_camera', ref: 'G:\\private-media\\story-first.mp4', rights: 'owned', sync: { strategy: 'already_mixed', offset_ms: 0 }, include_in_edit: true }] },
    })
    const rootPath = jobPath(job.job_id)
    const body = { schema_version: 2 as const, job_id: job.job_id, stage: 'candidates' as const, created_at: '2026-09-04T09:00:00.000Z', input_hashes: { transcript: HASH_A }, config_hash: job.config_hash, tool_versions: { fixture: '1' }, payload: { candidates: [{ candidate_id: 'story-first' }] } }
    const artifact = StageArtifactV2Schema.parse({ ...body, artifact_hash: stageArtifactSemanticHashV2(body) })
    await mkdir(join(rootPath, 'artifacts', 'candidates'), { recursive: true })
    await writeFile(join(rootPath, 'artifacts', 'candidates', `${artifact.artifact_hash}.json`), `${JSON.stringify(artifact, null, 2)}\n`)
    await appendFile(join(rootPath, 'events.jsonl'), `${JSON.stringify({ schema_version: 2, event_id: randomUUID(), job_id: job.job_id, type: 'stage_completed', occurred_at: artifact.created_at, payload: { stage: 'candidates', artifact_hash: artifact.artifact_hash } })}\n`)
    const projection = await buildRunnerProjectProjection({ job_id: job.job_id, platform: 'youtube_shorts', gate: 'story', safe_title: 'Story first', safe_summary: 'The exact candidate projection is ready before treatment.' })
    expect(projection.review).toMatchObject({ gate: 'story', artifact_hash: artifact.artifact_hash })
    expect(projection.platform_state).toMatchObject({ active_artifact_hash: artifact.artifact_hash, editorial_state: 'needs_story_review' })
    expect((await loadJobV2(job.job_id)).stages.treatment.status).toBe('pending')
  })
})
