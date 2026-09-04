import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  broadenRule,
  captureFeedbackV2,
  confirmFeedbackV2,
  createJobV2,
  diffExternalFinalArtifacts,
  feedbackEventHashV2,
  hasVerifiedExternalFinalConfirmationV2,
  proposeRuleV2,
} from '@mindmake/core'

const confirmationRefFor = (event: Parameters<typeof feedbackEventHashV2>[0], message = 'Krish confirmed this inference.') =>
  `codex-user-confirmation:feedback:${feedbackEventHashV2(event)}:${message}`

describe('V2 feedback learning boundary', () => {
  let root = ''
  let jobId = ''
  let previousRuntimeRoot: string | undefined

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mindmake-feedback-v2-'))
    previousRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
    const configPath = join(root, 'studio.json')
    const skillPath = join(root, 'mindmake-video', 'SKILL.md')
    await mkdir(join(root, 'mindmake-video'), { recursive: true })
    await writeFile(configPath, '{"schema_version":1}\n', 'utf8')
    await writeFile(skillPath, '# Test skill\n', 'utf8')
    const job = await createJobV2({
      series: 'built_with_ai',
      mode: 'solo',
      configPath,
      skillPaths: [skillPath],
      sourceBundle: {
        schema_version: 1,
        bundle_id: 'feedback-source',
        primary_source_id: 'camera-main',
        sources: [{
          source_id: 'camera-main',
          kind: 'video',
          role: 'primary_camera',
          ref: 'source.mp4',
          rights: 'owned',
          sync: { strategy: 'already_mixed', offset_ms: 0 },
          include_in_edit: true,
        }],
      },
    })
    jobId = job.job_id
  })

  afterEach(async () => {
    if (previousRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
    else process.env.MINDMAKE_RUNTIME_ROOT = previousRuntimeRoot
    await rm(root, { recursive: true, force: true })
  })

  it('turns an exact edit into a confirmable, narrowly scoped rule without activating config', async () => {
    const event = await captureFeedbackV2({
      jobId,
      artifactId: 'visual-plan-revision',
      artifactKind: 'visual_plan',
      stage: 'visual_plan',
      action: 'revise',
      before: { shots: [{ camera: { zoom: 1.3 }, protected: false }] },
      after: { shots: [{ camera: { zoom: 1.08 }, protected: true }] },
      scope: { level: 'mode', key: 'solo' },
    })
    expect(event.origin).toBe('user')
    expect(event.confirmation).toBe('pending')
    expect(event.inferred_rationale).toContain('stable subject visibility')

    const confirmed = await confirmFeedbackV2(event, 'Keep automatic solo reframing subtle whenever stronger movement competes with the point.', confirmationRefFor(event))
    const rule = await proposeRuleV2(confirmed)
    expect(confirmed.confirmation).toBe('corrected')
    expect(rule.scope).toEqual({ level: 'mode', key: 'solo' })
    expect(rule.status).toBe('confirmed')
    expect(rule.approved_by).toBeUndefined()
  })

  it('keeps Codex observations out of personal taste rules', async () => {
    const event = await captureFeedbackV2({
      jobId,
      artifactId: 'diagnostic',
      artifactKind: 'render',
      stage: 'render',
      action: 'reject',
      origin: 'codex',
      before: { audio: { lufs: -20 } },
      after: { audio: { lufs: -14 } },
      scope: { level: 'job', key: jobId },
    })
    expect(event.confirmation).toBe('observation_only')
    await expect(confirmFeedbackV2(event, undefined, confirmationRefFor(event))).rejects.toThrow('only user feedback')
    await expect(proposeRuleV2(event)).rejects.toThrow('system and Codex observations')
  })

  it('binds an accepted external final to its exact media hash', async () => {
    const exactHash = 'c'.repeat(64)
    const event = await captureFeedbackV2({
      jobId,
      artifactId: 'external-final',
      artifactKind: 'external_final',
      stage: 'render',
      action: 'revise',
      before: { artifact_file_sha256: 'b'.repeat(64), duration_seconds: 42 },
      after: { artifact: { artifact_file_sha256: exactHash, duration_seconds: 34 } },
      scope: { level: 'job', key: jobId },
      exactExternalFinal: true,
    })
    expect(event.after_hash).toBe(exactHash)
    expect(event.exact_external_final).toBe(true)
    expect(event.delta_features.map((delta) => delta.feature)).toContain('external_final.duration_and_trims')
    expect(event.inferred_rationale).toContain('shortened the accepted final by 8.0 seconds')
  })

  it('trusts only the exact captured event and its hash-bound user confirmation receipt', async () => {
    const exactHash = 'd'.repeat(64)
    const event = await captureFeedbackV2({
      jobId,
      artifactId: 'youtube-external-final',
      artifactKind: 'external_final',
      stage: 'render',
      action: 'accept',
      before: { artifact_file_sha256: 'e'.repeat(64) },
      after: { artifact_file_sha256: exactHash },
      note: 'Use this exact external final for the YouTube observation.',
      scope: { level: 'platform', key: 'youtube_shorts' },
      exactExternalFinal: true,
    })
    const forged = { ...event, user_note: 'Changed outside the captured ledger.' }
    await expect(confirmFeedbackV2(forged, undefined, confirmationRefFor(forged)))
      .rejects.toThrow('exact event captured')
    await expect(confirmFeedbackV2(event, undefined, `codex-user-confirmation:feedback:${'f'.repeat(64)}:Krish confirmed.`))
      .rejects.toThrow('event-bound user receipt')

    const jobFeedbackDirectory = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'jobs', jobId, 'feedback')
    await mkdir(jobFeedbackDirectory, { recursive: true })
    await writeFile(join(jobFeedbackDirectory, `${event.feedback_id}.confirmed.json`), `${JSON.stringify({ ...event, confirmation: 'confirmed' })}\n`, 'utf8')
    expect(await hasVerifiedExternalFinalConfirmationV2(jobId, exactHash, 'youtube_shorts')).toBe(false)

    const confirmed = await confirmFeedbackV2(event, undefined, confirmationRefFor(event, 'Confirmed for the YouTube final.'))
    expect(confirmed.confirmation).toBe('confirmed')
    expect(await hasVerifiedExternalFinalConfirmationV2(jobId, exactHash, 'youtube_shorts')).toBe(true)
    expect(await hasVerifiedExternalFinalConfirmationV2(jobId, exactHash, 'linkedin')).toBe(false)
    expect(await hasVerifiedExternalFinalConfirmationV2('different-job', exactHash, 'youtube_shorts')).toBe(false)

    const receipts = (await readFile(join(process.env.MINDMAKE_RUNTIME_ROOT!, 'learning', 'confirmations-v2.jsonl'), 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line))
    expect(receipts).toHaveLength(1)
    expect(receipts[0]).toMatchObject({ feedback_id: event.feedback_id, job_id: jobId, event_hash: feedbackEventHashV2(event), confirmation: 'confirmed' })
  })

  it('summarizes analyzed external-final changes as deterministic editorial deltas', async () => {
    const word = (text: string, start_ms: number, end_ms: number) => ({ text, start_ms, end_ms, probability: 0.99 })
    const before = {
      artifact_file_sha256: '1'.repeat(64),
      probe: { duration_seconds: 42, width: 1080, height: 1920, average_fps: 30 },
      loudness: { integrated_lufs: -18.5, true_peak_dbtp: -2.4 },
      scene_cuts_ms: [5_000, 15_000],
      frame_ahashes: ['0'.repeat(64), 'f'.repeat(64), 'a'.repeat(64), '5'.repeat(64)],
      transcript_status: 'complete',
      transcript: { segments: [{ words: [
        word('Well', 0, 400),
        word('the', 500, 800),
        word('proof', 900, 1_200),
        word('arrives', 1_300, 1_700),
        word('after', 1_800, 2_100),
        word('seven', 2_200, 2_600),
        word('steps', 2_700, 3_100),
        word('actually', 40_000, 40_500),
      ] }] },
      caption_ocr_status: 'not_run',
    }
    const after = {
      artifact: {
        artifact_file_sha256: '2'.repeat(64),
        probe: { duration_seconds: 34, width: 1080, height: 1920, average_fps: 30 },
        loudness: { integrated_lufs: -14.1, true_peak_dbtp: -1.1 },
        scene_cuts_ms: [3_000, 8_000, 19_000],
        frame_ahashes: ['f'.repeat(64), 'a'.repeat(64), '5'.repeat(64)],
        transcript_status: 'complete',
        transcript: { segments: [{ words: [
          word('the', 200, 500),
          word('proof', 600, 900),
          word('arrives', 1_000, 1_400),
          word('after', 1_500, 1_800),
          word('three', 1_900, 2_300),
          word('steps', 2_400, 2_800),
        ] }] },
        caption_ocr_status: 'not_run',
      },
      sidecars: { srt: '1\n00:00:00,200 --> 00:00:02,800\nThe proof arrives after three steps.\n' },
    }

    const first = diffExternalFinalArtifacts(before, after)
    const second = diffExternalFinalArtifacts(before, after)
    expect(second).toEqual(first)
    expect(first.map((delta) => delta.feature)).toEqual([
      'external_final.media_sha256',
      'external_final.duration_and_trims',
      'external_final.transcript_ordered_token_edits',
      'external_final.scene_cuts',
      'external_final.integrated_lufs',
      'external_final.true_peak_dbtp',
      'external_final.frame_crop_fingerprint',
      'external_final.sidecars.srt',
    ])
    const transcriptDelta = first.find((delta) => delta.feature === 'external_final.transcript_ordered_token_edits')?.after as Record<string, unknown>
    expect(transcriptDelta).toMatchObject({
      token_count: 6,
      removed_token_count: 2,
      added_token_count: 0,
      substitution_count: 1,
      substituted_before_token_count: 1,
      substituted_after_token_count: 1,
    })
    expect(transcriptDelta.edits).toEqual([
      { kind: 'remove', before_index: 0, after_index: 0, before_tokens: ['Well'], after_tokens: [] },
      { kind: 'substitute', before_index: 5, after_index: 4, before_tokens: ['seven'], after_tokens: ['three'] },
      { kind: 'remove', before_index: 7, after_index: 6, before_tokens: ['actually'], after_tokens: [] },
    ])
    const trim = first.find((delta) => delta.feature === 'external_final.duration_and_trims')?.after as Record<string, unknown>
    expect(trim).toMatchObject({ duration_delta_ms: -8_000, leading_removed_token_count: 1, trailing_removed_token_count: 1, frame_inferred_head_offset_ms: 5_000 })
    const visual = first.find((delta) => delta.feature === 'external_final.frame_crop_fingerprint')?.after as { best_temporal_alignment: Record<string, unknown> }
    expect(visual.best_temporal_alignment).toMatchObject({ before_sample_offset: 1, compared_samples: 3, normalized_median_distance: 0, confidence: 'high' })

    const event = await captureFeedbackV2({
      jobId,
      artifactId: 'accepted-external-final',
      artifactKind: 'external_final',
      stage: 'render',
      action: 'revise',
      before,
      after,
      scope: { level: 'job', key: jobId },
      exactExternalFinal: true,
    })
    expect(event.before_hash).toBe('1'.repeat(64))
    expect(event.after_hash).toBe('2'.repeat(64))
    expect(event.inferred_rationale).toContain('removed 2 spoken words')
    expect(event.inferred_rationale).toContain('made 1 ordered-token substitution')
    expect(event.inferred_rationale).toContain('sampled visual fingerprint')
    expect(event.confirmation).toBe('pending')
  })

  it('compacts diagnostic caption OCR and region samples without treating them as confirmed caption evidence', async () => {
    const captionAnalysis = (sourceHash: string, text: string, pixel: string, perceptual: string, method = 'python_opencv', implementationHash = 'a'.repeat(64)) => ({
      analysis_version: 1,
      analyzer: 'mindmake-caption-region-v1',
      method,
      source_sha256: sourceHash,
      implementation_file_sha256: implementationHash,
      analysis_artifact_path: `C:/runtime/${sourceHash}/caption-analysis.json`,
      implementation: { python: '3.12', tesseract: '5.4' },
      caption_ocr: { status: 'complete', engine: 'tesseract', precision: 'diagnostic_only' },
      sampling: { interval_ms: 750, region_normalized: { x: 0.04, y: 0.48, width: 0.92, height: 0.46 } },
      samples: [{
        at_ms: 0,
        relative_path: 'private-runtime-frame.pgm',
        normalized_pixel_sha256: pixel,
        perceptual_hash: perceptual,
        ocr: { status: 'complete', text, mean_confidence: 0.91 },
      }],
    })
    const beforeHash = '3'.repeat(64)
    const afterHash = '4'.repeat(64)
    const before = { artifact_file_sha256: beforeHash, caption_ocr_status: 'complete', caption_region_analysis: captionAnalysis(beforeHash, 'Seven slow steps', '5'.repeat(64), '0'.repeat(64)) }
    const after = { artifact: { artifact_file_sha256: afterHash, caption_ocr_status: 'complete', caption_region_analysis: captionAnalysis(afterHash, 'Three clear steps', '6'.repeat(64), 'f'.repeat(64)) } }
    const deltas = diffExternalFinalArtifacts(before, after)
    expect(deltas.map((delta) => delta.feature)).toEqual([
      'external_final.media_sha256',
      'external_final.caption_ocr_diagnostic',
      'external_final.caption_region_fingerprint',
    ])
    const ocr = deltas[1]?.after as Record<string, unknown>
    expect(ocr).toMatchObject({ status: 'complete', precision: 'diagnostic_only', phrase_count: 1 })
    expect(ocr.phrases).toEqual([{ at_ms: 0, text: 'Three clear steps', mean_confidence: 0.91 }])
    const serialized = JSON.stringify(deltas)
    expect(serialized).not.toContain('analysis_artifact_path')
    expect(serialized).not.toContain('private-runtime-frame.pgm')
    expect(serialized).not.toContain('implementation')
    expect(serialized).toContain('pixels also include the moving background')

    const event = await captureFeedbackV2({
      jobId,
      artifactId: 'caption-diagnostic-only',
      artifactKind: 'external_final',
      stage: 'render',
      action: 'revise',
      before,
      after,
      scope: { level: 'job', key: jobId },
      exactExternalFinal: true,
    })
    expect(event.confidence).toBe(0.45)
    expect(event.confirmation).toBe('observation_only')
    expect(event.inferred_rationale).toContain('only diagnostic')
    expect(event.inferred_rationale).toContain('SRT sidecar')

    const incompatible = diffExternalFinalArtifacts(
      { artifact_file_sha256: beforeHash, caption_ocr_status: 'complete', caption_region_analysis: captionAnalysis(beforeHash, 'Same phrase', '5'.repeat(64), '0'.repeat(64), 'python_opencv', 'a'.repeat(64)) },
      { artifact: { artifact_file_sha256: afterHash, caption_ocr_status: 'complete', caption_region_analysis: captionAnalysis(afterHash, 'Same phrase', '6'.repeat(64), 'f'.repeat(64), 'ffmpeg_fallback', 'b'.repeat(64)) } },
    )
    expect(incompatible.map((delta) => delta.feature)).toContain('external_final.caption_analysis_compatibility')
    expect(incompatible.map((delta) => delta.feature)).not.toContain('external_final.caption_region_fingerprint')
    expect(JSON.stringify(incompatible)).toContain('fingerprints were not compared')
  })

  it('broadens only from three unique confirmation-ledger records across jobs', async () => {
    const secondJob = await createJobV2({
      series: 'built_with_ai',
      mode: 'solo',
      configPath: join(root, 'studio.json'),
      skillPaths: [join(root, 'mindmake-video', 'SKILL.md')],
      sourceBundle: {
        schema_version: 1,
        bundle_id: 'feedback-source-two',
        primary_source_id: 'camera-main',
        sources: [{
          source_id: 'camera-main',
          kind: 'video',
          role: 'primary_camera',
          ref: 'source-two.mp4',
          rights: 'owned',
          sync: { strategy: 'already_mixed', offset_ms: 0 },
          include_in_edit: true,
        }],
      },
    })
    const scope = { level: 'treatment' as const, key: 'proof-led' }
    const note = 'Keep proof visible while the claim lands.'
    const capture = (eventJobId: string, artifactId: string) => captureFeedbackV2({
      jobId: eventJobId,
      artifactId,
      artifactKind: 'visual_plan',
      stage: 'visual_plan',
      action: 'revise',
      before: { layers: ['presenter'] },
      after: { layers: ['presenter', 'proof'] },
      note,
      scope,
    })
    const first = await capture(jobId, 'visual-plan-one')
    const pending = await capture(jobId, 'visual-plan-two')
    const third = await capture(secondJob.job_id, 'visual-plan-three')
    const rule = await proposeRuleV2(await confirmFeedbackV2(first, undefined, confirmationRefFor(first)))
    await proposeRuleV2(await confirmFeedbackV2(third, undefined, confirmationRefFor(third)))

    const rulesPath = join(process.env.MINDMAKE_RUNTIME_ROOT!, 'learning', 'rules.json')
    const rules = JSON.parse(await readFile(rulesPath, 'utf8')) as Array<{ rule_id: string; evidence_feedback_ids: string[] }>
    const storedRule = rules.find((item) => item.rule_id === rule.rule_id)!
    storedRule.evidence_feedback_ids.push(first.feedback_id, pending.feedback_id)
    await writeFile(rulesPath, `${JSON.stringify(rules, null, 2)}\n`, 'utf8')

    await expect(broadenRule(rule.rule_id, { level: 'global', key: 'all' }))
      .rejects.toThrow('three confirmed instances across at least two jobs')
    expect(JSON.parse(await readFile(rulesPath, 'utf8'))).toHaveLength(1)

    await confirmFeedbackV2(pending, undefined, confirmationRefFor(pending))
    const broadened = await broadenRule(rule.rule_id, { level: 'global', key: 'all' })
    expect(broadened).toMatchObject({ status: 'eligible', scope: { level: 'global', key: 'all' } })
    expect(broadened.rule_id).not.toBe(rule.rule_id)
    const finalRules = JSON.parse(await readFile(rulesPath, 'utf8')) as Array<{ rule_id: string; status: string }>
    expect(finalRules).toHaveLength(2)
    expect(finalRules.find((item) => item.rule_id === rule.rule_id)?.status).toBe('confirmed')
  })
})
