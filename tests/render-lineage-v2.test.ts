import {
  CandidateV1Schema,
  JobManifestV2Schema,
  RenderManifestV2Schema,
  StageNameV2Schema,
  VisualNarrativePlanV1Schema,
  type SourceModeV2,
} from '@mindmake/contracts'
import { hashValue, validateRenderLineageV2, type ValidateRenderLineageV2Input } from '@mindmake/core'
import { describe, expect, it } from 'vitest'

const CANDIDATES_ARTIFACT = '1'.repeat(64)
const CANDIDATE_HASH = '2'.repeat(64)
const VISUAL_PLAN_ARTIFACT = '3'.repeat(64)
const NORMALIZE_ARTIFACT = '4'.repeat(64)
const TRANSCRIPT_ARTIFACT = '5'.repeat(64)
const ASSETS_ARTIFACT = '6'.repeat(64)
const CLAIMS_ARTIFACT = '7'.repeat(64)
const ANALYSIS_ARTIFACT = '8'.repeat(64)
const CAMERA_HASH = 'a'.repeat(64)
const DIALOGUE_HASH = 'b'.repeat(64)
const PROOF_HASH = 'c'.repeat(64)
const OTHER_HASH = 'd'.repeat(64)

function fixture(mode: SourceModeV2 = 'extract'): ValidateRenderLineageV2Input {
  const isNative = mode === 'short_native'
  const script = 'Build the workflow before buying a smarter AI model.'
  const sourceText = script
  const sourceBundle = {
    schema_version: 1 as const,
    bundle_id: 'bundle-main',
    primary_source_id: 'camera-main',
    sources: [
      { source_id: 'camera-main', kind: 'video' as const, role: 'primary_camera' as const, ref: 'camera-original.mp4', content_hash: CAMERA_HASH, rights: 'owned' as const, sync: { strategy: 'manual_offset' as const, offset_ms: 1_000 }, include_in_edit: true },
      { source_id: 'dialogue-iso', kind: 'audio' as const, role: 'isolated_audio' as const, ref: 'dialogue-original.wav', content_hash: DIALOGUE_HASH, rights: 'owned' as const, sync: { strategy: 'manual_offset' as const, offset_ms: 500, reference_source_id: 'camera-main' }, include_in_edit: true },
    ],
  }
  const now = '2026-09-04T10:00:00.000Z'
  const stageHashes: Partial<Record<(typeof StageNameV2Schema.options)[number], string>> = {
    candidates: CANDIDATES_ARTIFACT,
    claims: CLAIMS_ARTIFACT,
    normalize: NORMALIZE_ARTIFACT,
    transcript: TRANSCRIPT_ARTIFACT,
    source_analysis: ANALYSIS_ARTIFACT,
    visual_plan: VISUAL_PLAN_ARTIFACT,
    assets: ASSETS_ARTIFACT,
  }
  const job = JobManifestV2Schema.parse({
    schema_version: 2,
    job_id: 'job-lineage',
    created_at: now,
    updated_at: now,
    series: 'built_with_ai',
    mode,
    purpose: 'production',
    presenter_name: 'Krish',
    source_bundle: sourceBundle,
    target_platforms: ['youtube_shorts'],
    treatment_lane: 'premium',
    consent_refs: [],
    config_hash: 'e'.repeat(64),
    skill_hashes: {},
    pinned_inputs: { config_path: 'pinned/studio.json', skill_paths: {} },
    stages: Object.fromEntries(StageNameV2Schema.options.map((stage) => [stage, stageHashes[stage]
      ? { status: 'complete', artifact_hash: stageHashes[stage], updated_at: now }
      : { status: 'pending', updated_at: now }])),
    approvals: [],
  })
  const candidate = CandidateV1Schema.parse({
    schema_version: 1,
    candidate_id: 'candidate-main',
    job_id: job.job_id,
    series: job.series,
    mode,
    ...(isNative ? {} : { start_ms: 1_000, end_ms: 5_000 }),
    transcript: script,
    hook: 'Build the workflow first.',
    payoff: 'Buy a smarter model only after the workflow works.',
    scores: { truth: 0.9, evidence: 0.9, clarity: 0.9, tension: 0.9, payoff: 0.9, visual_proof: 0.9, qualified_fit: 0.9, novelty: 0.9 },
    claims: [],
    challenge: { strongest_objection: 'The proof still needs to be shown.', safer_version: 'Use the direct continuous take.', stretch_version: 'Open on the workflow artifact.', recommendation: 'Use the direct mechanism and proof.', hard_blocks: [], soft_blocks: [] },
    ...(!isNative ? {
      edit_plan: {
        structure: 'continuous',
        segments: [{ segment_id: 'main', start_ms: 1_000, end_ms: 5_000, role: 'ending', transcript: script, selection_reason: 'This is the complete self-contained mechanism and payoff.' }],
        caption_script: script,
        semantic_throughline: 'A working workflow matters before a more capable model purchase.',
        continuity_rationale: 'The continuous source span is already the strongest coherent version.',
        continuous_baseline: { start_ms: 1_000, end_ms: 5_000, verdict: 'selected', rationale: 'The complete source window is the strongest continuous version.' },
        cold_open: { decision: 'not_used', rationale: 'The opening reaches the mechanism immediately.' },
        source_order: { decision: 'preserved', rationale: 'The continuous edit retains source order.' },
        meaning_preservation: [],
        retained_disfluencies: [],
        total_duration_ms: 4_000,
      },
    } : {}),
    editorial: {
      disposition: 'publishable',
      scores: { semantic_coherence: 0.9, impact: 0.9, relevance: 0.9, insight: 0.9, specificity: 0.9, audience_value: 0.9, hook_strength: 0.9, ending_strength: 0.9 },
      semantic_checks: { standalone_without_source: true, referents_resolved: true, claim_boundaries_preserved: true, causal_chain_preserved: true, visual_dependencies_available: true, audience_payoff_specific: true, ending_complete: true },
      semantic_failure_notes: [],
      strongest_reason_to_reject: 'The claim is concise enough to need visual proof.',
      selection_rationale: 'This is the strongest complete mechanism in the available source.',
      audience_payoff: 'Operators learn which dependency to improve before buying another model.',
    },
    identity_mentions: [],
    source_refs: ['dialogue-iso'],
  })
  const transcript = {
    language: 'en',
    source: 'faster_whisper' as const,
    verified: true,
    segments: [
      ...(!isNative ? [{ start_ms: 0, end_ms: 900, text: 'Um' }] : []),
      { start_ms: 1_000, end_ms: 5_000, text: sourceText },
    ],
  }
  const proof = {
    asset_id: 'proof-card',
    media_kind: 'image' as const,
    content_kind: 'owned_photo' as const,
    truth_role: 'owned_artifact' as const,
    path: 'proof.png',
    sha256: PROOF_HASH,
    rights: 'owned' as const,
    rights_rationale: 'Mindmake owns this exact workflow artifact and may show it.',
    generated: false,
    approval: { state: 'approved' as const, approved_by: 'Krish' as const, approved_at: now, artifact_hash: PROOF_HASH },
  }
  const shot = {
    shot_id: 'shot-main',
    beat_id: 'beat-main',
    start_ms: 0,
    end_ms: 4_000,
    source_id: 'camera-main',
    source_start_ms: 500,
    source_end_ms: 4_500,
    subject_track_ids: [],
    primary_attention_target: { kind: 'presenter' as const },
    technique_ids: [],
    camera_plan: {
      camera_plan_id: 'camera-plan-main',
      source_id: 'camera-main',
      subject_track_ids: [],
      start_ms: 0,
      end_ms: 4_000,
      framing: 'medium_close' as const,
      movement: 'locked' as const,
      lead_room: 'auto' as const,
      protected_region_ids: [],
      keyframes: [{ at_ms: 0, crop: { x: 0.2, y: 0, width: 0.6, height: 1 }, zoom: 1, rotation_degrees: 0, confidence: 0.9 }],
      easing: 'hold' as const,
      max_velocity: 1,
      max_acceleration: 1,
      minimum_hold_ms: 500,
      quality_floor: { minimum_effective_width_px: 800, allow_upscale: false },
      confidence: 0.9,
      fallback: 'Hold the measured medium-close crop if tracking is unavailable.',
    },
    layers: [
      { layer_id: 'source-main', z_index: 0, kind: 'source' as const, target_id: 'camera-main', anchor: 'full' as const, opacity: 1, blend_mode: 'normal' as const, protected: true },
      { layer_id: 'asset-proof', z_index: 10, kind: 'asset' as const, target_id: 'proof-card', anchor: 'right' as const, bounds: { x: 0.6, y: 0.2, width: 0.3, height: 0.3 }, opacity: 1, blend_mode: 'normal' as const, protected: true },
      { layer_id: 'caption-main', z_index: 20, kind: 'caption' as const, anchor: 'bottom' as const, bounds: { x: 0.08, y: 0.65, width: 0.84, height: 0.15 }, opacity: 1, blend_mode: 'normal' as const, protected: true },
    ],
    transition_in: 'none' as const,
    transition_out: 'none' as const,
    audio_continuity: 'direct' as const,
    rationale: 'Keep Krish primary while the owned artifact supports the mechanism.',
  }
  const plan = VisualNarrativePlanV1Schema.parse({
    schema_version: 1,
    plan_id: 'plan-main',
    job_id: job.job_id,
    candidate_id: candidate.candidate_id,
    candidate_hash: CANDIDATE_HASH,
    claims_artifact_hash: CLAIMS_ARTIFACT,
    source_analysis_artifact_hash: ANALYSIS_ARTIFACT,
    technique_registry_hash: 'f'.repeat(64),
    preference_snapshot_hash: '0'.repeat(64),
    duration_ms: 4_000,
    treatment_lane: 'premium',
    beats: [{ beat_id: 'beat-main', start_ms: 0, end_ms: 4_000, transcript: script, source_spans: [{ source_id: 'camera-main', start_ms: 500, end_ms: 4_500 }], claim_ids: [], narrative_function: 'ending', viewer_task: 'land_payoff', emotional_function: 'trust', visual_density: 'low', proof_dependency: false, primary_attention_target: { kind: 'presenter' }, rationale: 'Land the complete mechanism and payoff directly with Krish.' }],
    asset_requirements: [{ asset_id: 'proof-card', content_kind: 'owned_photo', truth_role: 'owned_artifact', narrative_job: 'explain', claim_ids: [], brief: 'Show the exact owned workflow artifact alongside Krish.', generated_allowed: false, required: true, fallback: 'Keep Krish full-frame if the artifact is unavailable.' }],
    resolved_assets: [],
    shot_directives: [shot],
    budget: { estimated_cost_gbp: 0, maximum_cost_gbp: 15, exception_approved: false },
    disclosures: [{ platform: 'youtube_shorts', decision: 'not_required', rationale: 'No synthetic or meaningfully altered content is used.' }],
    fallbacks: [],
    strategy_summary: 'Krish leads while an exact owned artifact supports the spoken mechanism.',
  })
  const normalizedSources = [
    { source_id: 'camera-main', kind: 'video' as const, input_path: 'camera-original.mp4', input_hash: CAMERA_HASH, normalized_path: 'camera-normalized.mp4', normalized_hash: CAMERA_HASH, duration_ms: 10_000, width: 1920, height: 1080, fps: 30, audio_hz: 48_000, video_codec: 'h264', audio_codec: 'aac', canonical_offset_ms: 1_000, ffmpeg_version: 'ffmpeg 8' },
    { source_id: 'dialogue-iso', kind: 'audio' as const, input_path: 'dialogue-original.wav', input_hash: DIALOGUE_HASH, normalized_path: 'dialogue-normalized.m4a', normalized_hash: DIALOGUE_HASH, duration_ms: 10_000, width: null, height: null, fps: null, audio_hz: 48_000, video_codec: null, audio_codec: 'aac', canonical_offset_ms: 500, ffmpeg_version: 'ffmpeg 8' },
  ]
  const manifest = RenderManifestV2Schema.parse({
    schema_version: 2,
    manifest_id: 'manifest-main',
    job_id: job.job_id,
    candidate_id: candidate.candidate_id,
    candidate_hash: CANDIDATE_HASH,
    visual_plan_artifact_hash: VISUAL_PLAN_ARTIFACT,
    series: job.series,
    treatment_id: 'premium-main',
    treatment_lane: job.treatment_lane,
    target_platform: 'youtube_shorts',
    output: { platform: 'youtube_shorts', width: 1080, height: 1920, fps: 30, audio_hz: 48_000, safe_zones: { top_px: 100, right_px: 100, bottom_px: 300, left_px: 70 }, maximum_duration_ms: 60_000 },
    duration_ms: 4_000,
    sources: [
      { source_id: 'camera-main', kind: 'video', path: 'camera-normalized.mp4', sha256: CAMERA_HASH, duration_ms: 10_000, width: 1920, height: 1080, fps: 30, audio_hz: 48_000, canonical_offset_ms: 1_000 },
      { source_id: 'dialogue-iso', kind: 'audio', path: 'dialogue-normalized.m4a', sha256: DIALOGUE_HASH, duration_ms: 10_000, width: null, height: null, fps: null, audio_hz: 48_000, canonical_offset_ms: 500 },
    ],
    shot_directives: [shot],
    assets: [proof],
    generated_shots: [],
    captions: [{ start_ms: 0, end_ms: 4_000, text: script, emphasis: ['workflow'] }],
    caption_provenance: { transcript_hash: TRANSCRIPT_ARTIFACT, verified: true, exact_word_fidelity: true, source_token_count: 9, caption_token_count: 9 },
    audio_plan: { dialogue_source_ids: ['dialogue-iso'], dialogue_master_source_id: 'dialogue-iso', dialogue_edits: [{ edit_id: 'dialogue-main', source_id: 'dialogue-iso', output_start_ms: 0, output_end_ms: 4_000, source_start_ms: 1_000, source_end_ms: 5_000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 }], transitions: [], music: [], effects: [], target_lufs: -14, maximum_true_peak_dbtp: -1 },
    branding: { mode: 'series', wordmark_hashes: [] },
    disclosures: plan.disclosures,
    fixed_seed: '0123456789abcdef',
  })

  return {
    job,
    manifest,
    candidateArtifact: { artifact_hash: CANDIDATES_ARTIFACT, job_id: job.job_id, stage: 'candidates', payload: { candidates: [{ hash: CANDIDATE_HASH, candidate }] } },
    visualPlanArtifact: { artifact_hash: VISUAL_PLAN_ARTIFACT, job_id: job.job_id, stage: 'visual_plan', payload: plan },
    normalizeArtifact: { artifact_hash: NORMALIZE_ARTIFACT, job_id: job.job_id, stage: 'normalize', payload: { source_bundle_hash: hashValue(job.source_bundle), sources: normalizedSources } },
    transcriptArtifact: { artifact_hash: TRANSCRIPT_ARTIFACT, job_id: job.job_id, stage: 'transcript', payload: { source_id: 'dialogue-iso', source_role: 'isolated_audio', canonical_offset_ms: 500, normalized_source_hash: DIALOGUE_HASH, transcript, ...(isNative ? { recording_alignment: { start_ms: 1_000, end_ms: 5_000, similarity: 1 } } : {}) } },
    assetsArtifact: { artifact_hash: ASSETS_ARTIFACT, job_id: job.job_id, stage: 'assets', payload: { visual_plan_artifact_hash: VISUAL_PLAN_ARTIFACT, assets: [proof], generated_shots: [] } },
  }
}

function stitchedFixture(): ValidateRenderLineageV2Input {
  const input = fixture()
  const firstText = 'Build the workflow before'
  const secondText = 'buying a smarter AI model.'
  const candidate = CandidateV1Schema.parse({
    ...input.candidateArtifact.payload.candidates[0]!.candidate,
    edit_plan: {
      structure: 'stitched',
      segments: [
        { segment_id: 'opening', start_ms: 1_000, end_ms: 2_500, role: 'hook', transcript: firstText, selection_reason: 'This opening states the operating priority without a preamble.' },
        { segment_id: 'ending', start_ms: 3_000, end_ms: 5_000, role: 'ending', transcript: secondText, selection_reason: 'This later span lands the specific purchasing consequence cleanly.' },
      ],
      caption_script: `${firstText} ${secondText}`,
      semantic_throughline: 'A working workflow matters before a more capable model purchase.',
      continuity_rationale: 'Removing the middle pause creates the clearest complete statement without reordering it.',
      continuous_baseline: { start_ms: 1_000, end_ms: 5_000, verdict: 'rejected', rationale: 'The continuous version contains a dead pause that weakens the mechanism.' },
      cold_open: { decision: 'used', rationale: 'The first selected source beat is the strongest direct opening.' },
      source_order: { decision: 'preserved', rationale: 'Both selected spans remain in their source order.' },
      meaning_preservation: [],
      retained_disfluencies: [],
      total_duration_ms: 3_500,
    },
  })
  input.candidateArtifact.payload = { candidates: [{ hash: CANDIDATE_HASH, candidate }] }
  input.transcriptArtifact.payload = {
    ...input.transcriptArtifact.payload,
    transcript: {
      language: 'en',
      source: 'faster_whisper',
      verified: true,
      segments: [
        { start_ms: 1_000, end_ms: 2_500, text: firstText },
        { start_ms: 3_000, end_ms: 5_000, text: secondText },
      ],
    },
  }
  const baseShot = input.visualPlanArtifact.payload.shot_directives[0]!
  const firstShot = {
    ...baseShot,
    shot_id: 'shot-opening',
    beat_id: 'beat-opening',
    end_ms: 1_500,
    source_end_ms: 2_000,
    camera_plan: { ...baseShot.camera_plan, camera_plan_id: 'camera-plan-opening', end_ms: 1_500, keyframes: [{ ...baseShot.camera_plan.keyframes[0]!, at_ms: 0 }] },
  }
  const secondShot = {
    ...baseShot,
    shot_id: 'shot-ending',
    beat_id: 'beat-ending',
    start_ms: 1_500,
    end_ms: 3_500,
    source_start_ms: 2_500,
    source_end_ms: 4_500,
    camera_plan: { ...baseShot.camera_plan, camera_plan_id: 'camera-plan-ending', start_ms: 1_500, end_ms: 3_500, keyframes: [{ ...baseShot.camera_plan.keyframes[0]!, at_ms: 1_500 }] },
  }
  const plan = VisualNarrativePlanV1Schema.parse({
    ...input.visualPlanArtifact.payload,
    duration_ms: 3_500,
    beats: [
      { beat_id: 'beat-opening', start_ms: 0, end_ms: 1_500, transcript: firstText, source_spans: [{ source_id: 'camera-main', start_ms: 500, end_ms: 2_000 }], claim_ids: [], narrative_function: 'hook', viewer_task: 'connect_with_speaker', emotional_function: 'curiosity', visual_density: 'low', proof_dependency: false, primary_attention_target: { kind: 'presenter' }, rationale: 'Open directly on the operating priority with Krish.', opens_question: true },
      { beat_id: 'beat-ending', start_ms: 1_500, end_ms: 3_500, transcript: secondText, source_spans: [{ source_id: 'camera-main', start_ms: 2_500, end_ms: 4_500 }], claim_ids: [], narrative_function: 'ending', viewer_task: 'land_payoff', emotional_function: 'trust', visual_density: 'low', proof_dependency: false, primary_attention_target: { kind: 'presenter' }, rationale: 'Land the specific model-purchasing consequence clearly.', answers_beat_id: 'beat-opening' },
    ],
    shot_directives: [firstShot, secondShot],
  })
  input.visualPlanArtifact.payload = plan
  input.manifest = RenderManifestV2Schema.parse({
    ...input.manifest,
    duration_ms: 3_500,
    shot_directives: plan.shot_directives,
    captions: [
      { start_ms: 0, end_ms: 1_500, text: firstText, emphasis: ['workflow'] },
      { start_ms: 1_500, end_ms: 3_500, text: secondText, emphasis: ['smarter'] },
    ],
    caption_provenance: { ...input.manifest.caption_provenance, source_token_count: 9, caption_token_count: 9 },
    audio_plan: {
      ...input.manifest.audio_plan,
      dialogue_edits: [
        { edit_id: 'dialogue-opening', source_id: 'dialogue-iso', output_start_ms: 0, output_end_ms: 1_500, source_start_ms: 1_000, source_end_ms: 2_500, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 },
        { edit_id: 'dialogue-ending', source_id: 'dialogue-iso', output_start_ms: 1_500, output_end_ms: 3_500, source_start_ms: 3_000, source_end_ms: 5_000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 },
      ],
    },
  })
  return input
}

describe('V2 exact render lineage', () => {
  it('accepts an extracted edit whose precise source boundary removes the filler', () => {
    const result = validateRenderLineageV2(fixture())
    expect(result.issues).toEqual([])
    expect(result.recomputed_caption_provenance).toEqual({ transcript_hash: TRANSCRIPT_ARTIFACT, verified: true, exact_word_fidelity: true, source_token_count: 9, caption_token_count: 9 })
  })

  it('rejects captions that hide filler still audible inside an approved source span', () => {
    const input = fixture()
    input.transcriptArtifact.payload.transcript = {
      ...input.transcriptArtifact.payload.transcript,
      segments: [{ start_ms: 1_000, end_ms: 5_000, text: `Um ${input.candidateArtifact.payload.candidates[0]!.candidate.transcript}` }],
    }
    expect(validateRenderLineageV2(input).issues).toEqual(expect.arrayContaining([
      'approved edit_plan segment main hides spoken words inside its selected audio span',
      'approved extract caption script does not account for every spoken word in the selected audio',
      'render captions omit spoken words that remain audible in the selected source spans',
      'caption provenance token counts disagree with recomputation',
    ]))
  })

  it('rejects substituted captions even when their manifest provenance asserts fidelity', () => {
    const input = fixture()
    input.manifest = RenderManifestV2Schema.parse({ ...input.manifest, captions: [{ ...input.manifest.captions[0], text: 'Build the system before buying a smarter AI model.' }] })
    const result = validateRenderLineageV2(input)
    expect(result.issues).toEqual(expect.arrayContaining([
      'render captions invent, substitute, duplicate, or reorder words outside the current selected transcript',
      'render captions do not equal the exact approved candidate wording',
      'caption fidelity provenance is self-asserted and disagrees with recomputation',
    ]))
    expect(result.recomputed_caption_provenance.exact_word_fidelity).toBe(false)
  })

  it('binds the exact current candidate, visual decisions, normalized sources, and assets', () => {
    const input = fixture()
    input.manifest = RenderManifestV2Schema.parse({
      ...input.manifest,
      candidate_hash: OTHER_HASH,
      sources: input.manifest.sources.map((source) => source.source_id === 'camera-main' ? { ...source, sha256: OTHER_HASH } : source),
      shot_directives: input.manifest.shot_directives.map((shot) => ({ ...shot, rationale: 'A changed visual decision that was never part of the current plan.' })),
      assets: input.manifest.assets.map((asset) => ({ ...asset, path: 'different-proof.png', sha256: OTHER_HASH, approval: { ...asset.approval, artifact_hash: OTHER_HASH } })),
    })
    expect(validateRenderLineageV2(input).issues).toEqual(expect.arrayContaining([
      'render manifest is not bound to the exact current candidate hash',
      'render shot directives differ from the exact current visual plan',
      'render source camera-main hash is not the current normalized hash',
      'render asset ledger differs from the exact current assets artifact',
    ]))
  })

  it('rejects dialogue edits whose local timing does not resolve to the approved canonical timeline', () => {
    const input = fixture()
    input.manifest = RenderManifestV2Schema.parse({
      ...input.manifest,
      audio_plan: { ...input.manifest.audio_plan, dialogue_edits: input.manifest.audio_plan.dialogue_edits.map((edit) => ({ ...edit, source_start_ms: edit.source_start_ms + 200, source_end_ms: edit.source_end_ms + 200 })) },
    })
    expect(validateRenderLineageV2(input).issues).toContain('dialogue edit dialogue-main does not match the approved main canonical timing')
  })

  it('independently verifies short-native recording alignment and exact wording', () => {
    const input = fixture('short_native')
    expect(validateRenderLineageV2(input).issues).toEqual([])
    input.transcriptArtifact.payload = {
      ...input.transcriptArtifact.payload,
      recording_alignment: { start_ms: 1_000, end_ms: 5_000, similarity: 0.9 },
      transcript: { ...input.transcriptArtifact.payload.transcript, segments: [{ start_ms: 1_000, end_ms: 5_000, text: `Well ${input.transcriptArtifact.payload.transcript.segments[0]!.text}` }] },
    }
    expect(validateRenderLineageV2(input).issues).toEqual(expect.arrayContaining([
      'short-native recording alignment does not match the independently recomputed alignment',
      'short-native recording wording is not an exact ordered match for the approved script',
    ]))
  })

  it('tracks every stitched edit span and blocks dialogue that bridges deleted source time', () => {
    const input = stitchedFixture()
    expect(validateRenderLineageV2(input).issues).toEqual([])
    input.manifest = RenderManifestV2Schema.parse({
      ...input.manifest,
      audio_plan: {
        ...input.manifest.audio_plan,
        dialogue_edits: [{ edit_id: 'hidden-bridge', source_id: 'dialogue-iso', output_start_ms: 0, output_end_ms: 3_500, source_start_ms: 1_000, source_end_ms: 4_500, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 }],
      },
    })
    expect(validateRenderLineageV2(input).issues).toContain('dialogue edit hidden-bridge crosses or leaves an approved editorial source span')
  })

  it('requires official series branding in production and no branding in calibration', () => {
    const production = fixture()
    production.manifest = RenderManifestV2Schema.parse({ ...production.manifest, branding: { mode: 'none', wordmark_hashes: [] } })
    expect(validateRenderLineageV2(production).issues).toContain('production render manifest must use official series branding')

    const calibration = fixture()
    calibration.job = JobManifestV2Schema.parse({ ...calibration.job, purpose: 'calibration' })
    calibration.manifest = RenderManifestV2Schema.parse({ ...calibration.manifest, branding: { mode: 'none', wordmark_hashes: [] } })
    expect(validateRenderLineageV2(calibration).issues).toEqual([])
    calibration.manifest = RenderManifestV2Schema.parse({ ...calibration.manifest, branding: { mode: 'series', wordmark_hashes: [] } })
    expect(validateRenderLineageV2(calibration).issues).toContain('calibration render manifest must remain analysis-only and unbranded')
  })
})
