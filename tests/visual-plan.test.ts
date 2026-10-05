import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SourceVisualAnalysisV1Schema,
  VisualNarrativePlanV1Schema,
  type SourceVisualAnalysisV1,
  type VisualNarrativePlanV1,
} from '@mindmake/contracts'
import { BUILT_WITH_AI_EDITORIAL_RULE_ID, hashFile, INVESTIGATIVE_SHORT_REFERENCE_RULE_ID, loadTechniqueRegistry, reviewVisualPlan, selectDevicesForBeat, verifyVisualAssets } from '@mindmake/core'

const H = 'a'.repeat(64)

function analysis(): SourceVisualAnalysisV1 {
  return SourceVisualAnalysisV1Schema.parse({
    schema_version: 1,
    analysis_id: 'analysis-1',
    job_id: 'job-1',
    source_bundle_hash: H,
    coordinate_space: 'normalized_0_1',
    timebase: 'source_local_ms',
    generated_at: '2026-09-04T10:00:00.000Z',
    capabilities: { tier: 1, analyzers: { tracking: 'test' }, unavailable: [], fallbacks: [] },
    sources: [{ source_id: 'camera-main', source_hash: H, duration_ms: 20_000, width: 3840, height: 2160, fps: 30, audio_hz: 48_000, canonical_offset_ms: 0 }],
    shots: [{ shot_id: 'source-shot-1', source_id: 'camera-main', start_ms: 0, end_ms: 20_000, transition: 'source_start', confidence: 1 }],
    subjects: [{ track_id: 'subject-1', source_id: 'camera-main', role: 'unknown', start_ms: 0, end_ms: 20_000, face_keyframes: [{ at_ms: 0, bounds: { x: 0.4, y: 0.2, width: 0.2, height: 0.2 }, confidence: 0.9 }], body_keyframes: [], hand_keyframes: [], detection_confidence: 0.9 }],
    active_speakers: [], gestures: [], gaze: [], negative_space: [],
    protected_regions: [{ region_id: 'face-safe-1', source_id: 'camera-main', start_ms: 0, end_ms: 20_000, bounds: { x: 0.35, y: 0.15, width: 0.3, height: 0.4 }, reason: 'Keep evidence clear of the presenter face.', confidence: 0.9 }],
    sidecars: [], quality_issues: [],
  })
}

function plan(overrides: Record<string, unknown> = {}): VisualNarrativePlanV1 {
  return VisualNarrativePlanV1Schema.parse({
    schema_version: 1,
    plan_id: 'plan-1', job_id: 'job-1', candidate_id: 'candidate-1',
    candidate_hash: H, claims_artifact_hash: H, source_analysis_artifact_hash: H,
    technique_registry_hash: H, preference_snapshot_hash: H,
    duration_ms: 20_000, treatment_lane: 'restrained',
    beats: [{ beat_id: 'beat-1', start_ms: 0, end_ms: 20_000, transcript: 'The useful point lands here.', source_spans: [{ source_id: 'camera-main', start_ms: 0, end_ms: 20_000 }], claim_ids: [], narrative_function: 'payoff', viewer_task: 'land_payoff', emotional_function: 'trust', visual_density: 'rest', proof_dependency: false, primary_attention_target: { kind: 'presenter' }, rationale: 'End clearly on Krish and let the conclusion land.' }],
    asset_requirements: [], resolved_assets: [],
    shot_directives: [{
      shot_id: 'shot-1', beat_id: 'beat-1', start_ms: 0, end_ms: 20_000, source_id: 'camera-main', source_start_ms: 0, source_end_ms: 20_000, subject_track_ids: ['subject-1'], primary_attention_target: { kind: 'presenter' }, technique_ids: ['stable-semantic-crop'],
      camera_plan: { camera_plan_id: 'camera-1', source_id: 'camera-main', subject_track_ids: ['subject-1'], start_ms: 0, end_ms: 20_000, framing: 'medium_close', movement: 'locked', lead_room: 'none', protected_region_ids: ['face-safe-1'], keyframes: [{ at_ms: 0, crop: { x: 0, y: 0, width: 1, height: 1 }, zoom: 1, rotation_degrees: 0, confidence: 1 }], easing: 'hold', max_velocity: 1, max_acceleration: 1, minimum_hold_ms: 250, quality_floor: { minimum_effective_width_px: 1080, allow_upscale: false }, confidence: 1, fallback: 'Hold a stable full-height presenter crop.' },
      layers: [{ layer_id: 'source-layer', z_index: 0, kind: 'source', target_id: 'camera-main', anchor: 'full', opacity: 1, blend_mode: 'normal', protected: false }], transition_in: 'none', transition_out: 'none', audio_continuity: 'direct', rationale: 'A stable presenter frame gives the payoff room to land.',
    }],
    budget: { estimated_cost_gbp: 0, maximum_cost_gbp: 15, exception_approved: false },
    disclosures: [{ platform: 'youtube_shorts', decision: 'not_required', rationale: 'No meaningfully altered media is present.' }],
    fallbacks: [], strategy_summary: 'A restrained presenter-led conclusion with no decorative clutter.',
    ...overrides,
  })
}

/** The shape a production plan actually has: a hook that leaves a question open and a payoff that answers it. */
function loopedPlan(overrides: Record<string, unknown> = {}): VisualNarrativePlanV1 {
  const base = plan()
  const shot = base.shot_directives[0]!
  const span = (id: string, start: number, end: number) => ({
    ...shot, shot_id: `shot-${id}`, beat_id: `beat-${id}`, start_ms: start, end_ms: end, source_start_ms: start, source_end_ms: end,
    camera_plan: { ...shot.camera_plan, camera_plan_id: `camera-${id}`, start_ms: start, end_ms: end, keyframes: [{ at_ms: start, crop: { x: 0, y: 0, width: 1, height: 1 }, zoom: 1, rotation_degrees: 0, confidence: 1 }] },
  })
  return VisualNarrativePlanV1Schema.parse({
    ...base,
    beats: [
      { ...base.beats[0]!, beat_id: 'beat-hook', start_ms: 0, end_ms: 6_000, source_spans: [{ source_id: 'camera-main', start_ms: 0, end_ms: 6_000 }], narrative_function: 'hook', viewer_task: 'feel_stakes', emotional_function: 'curiosity', transcript: 'The number everyone quotes is the wrong one.', rationale: 'Confirm the promise and leave the real number unsaid.', opens_question: true },
      { ...base.beats[0]!, beat_id: 'beat-payoff', start_ms: 6_000, end_ms: 20_000, source_spans: [{ source_id: 'camera-main', start_ms: 6_000, end_ms: 20_000 }], answers_beat_id: 'beat-hook' },
    ],
    shot_directives: [span('hook', 0, 6_000), span('payoff', 6_000, 20_000)],
    strategy_summary: 'A hook that withholds the real number and a payoff that supplies it.',
    ...overrides,
  })
}

describe('visual narrative planning gates', () => {
  it('accepts a bound, conservative plan and requires review artifacts for a new treatment', async () => {
    const registryPath = resolve('config/techniques.json')
    const registry = await loadTechniqueRegistry(registryPath)
    const reviewed = reviewVisualPlan({ plan: plan(), analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H })
    expect(reviewed.review.hard_blocks).toEqual([])
    expect(reviewed.review.soft_blocks).toEqual([])
    expect(reviewed.review.requires_styleframes).toBe(true)
    expect(reviewed.review.requires_animatic).toBe(true)
  })

  it('blocks unknown techniques and flags an overlay on protected presenter space', async () => {
    const registry = await loadTechniqueRegistry(resolve('config/techniques.json'))
    const base = plan()
    const altered = {
      ...base,
      shot_directives: [{
        ...base.shot_directives[0]!,
        technique_ids: ['unregistered-effect'],
        layers: [...base.shot_directives[0]!.layers, { layer_id: 'evidence-layer', z_index: 1, kind: 'annotation' as const, anchor: 'center' as const, bounds: { x: 0.4, y: 0.2, width: 0.2, height: 0.2 }, opacity: 1, blend_mode: 'normal' as const, protected: false }],
      }],
    }
    const reviewed = reviewVisualPlan({ plan: altered, analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H })
    expect(reviewed.review.hard_blocks).toContain('unknown visual techniques: unregistered-effect')
    expect(reviewed.review.soft_blocks.some((issue) => issue.includes('protected presenter space'))).toBe(true)
  })

  it('requires each proof-dependent claim to use matching evidence in a shot for that beat', async () => {
    const registry = await loadTechniqueRegistry(resolve('config/techniques.json'))
    const base = plan()
    const proofBeat = { ...base.beats[0]!, claim_ids: ['claim-a', 'claim-b'], proof_dependency: true }
    const unrelatedEvidence = {
      asset_id: 'unrelated-proof',
      content_kind: 'evidence_screenshot' as const,
      truth_role: 'evidence' as const,
      narrative_job: 'prove' as const,
      claim_ids: ['claim-c'],
      brief: 'Show evidence for a different claim in the wider story.',
      generated_allowed: false,
      required: true,
      fallback: 'Remove the unsupported claim.',
    }
    const unrelatedLayer = { layer_id: 'unrelated-layer', z_index: 1, kind: 'asset' as const, target_id: 'unrelated-proof', anchor: 'right' as const, opacity: 1, blend_mode: 'normal' as const, protected: true }
    const unrelatedPlan = plan({
      beats: [proofBeat],
      asset_requirements: [unrelatedEvidence],
      shot_directives: [{ ...base.shot_directives[0]!, layers: [...base.shot_directives[0]!.layers, unrelatedLayer] }],
    })
    const unrelatedReview = reviewVisualPlan({ plan: unrelatedPlan, analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H })
    expect(unrelatedReview.review.hard_blocks).toContain('beat beat-1 claim claim-a needs proof but has no required evidence asset requirement')
    expect(unrelatedReview.review.hard_blocks).toContain('beat beat-1 claim claim-b needs proof but has no required evidence asset requirement')

    const claimARequirement = { ...unrelatedEvidence, asset_id: 'proof-a', claim_ids: ['claim-a'] }
    const claimBRequirement = { ...unrelatedEvidence, asset_id: 'proof-b', claim_ids: ['claim-b'] }
    const unplacedPlan = plan({ beats: [proofBeat], asset_requirements: [claimARequirement, claimBRequirement] })
    const unplacedReview = reviewVisualPlan({ plan: unplacedPlan, analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H })
    expect(unplacedReview.review.hard_blocks).toContain('beat beat-1 claim claim-a needs proof but no matching evidence asset is placed in a shot for that beat')
    expect(unplacedReview.review.hard_blocks).toContain('beat beat-1 claim claim-b needs proof but no matching evidence asset is placed in a shot for that beat')

    const fullyLinkedPlan = plan({
      beats: [proofBeat],
      asset_requirements: [claimARequirement, claimBRequirement],
      shot_directives: [{
        ...base.shot_directives[0]!,
        layers: [
          ...base.shot_directives[0]!.layers,
          { ...unrelatedLayer, layer_id: 'proof-a-layer', target_id: 'proof-a' },
          { ...unrelatedLayer, layer_id: 'proof-b-layer', target_id: 'proof-b', z_index: 2 },
        ],
      }],
    })
    const fullyLinkedReview = reviewVisualPlan({ plan: fullyLinkedPlan, analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H })
    expect(fullyLinkedReview.review.hard_blocks).toEqual([])
  })

  it('requires early receipts and rejects generic B-roll as proof for the confirmed investigative rule', async () => {
    const registry = await loadTechniqueRegistry(resolve('config/techniques.json'))
    const preference = {
      schema_version: 1 as const,
      rule_id: INVESTIGATIVE_SHORT_REFERENCE_RULE_ID,
      assertion: 'Lead with receipts and finish on an earned verdict.',
      scope: { level: 'series' as const, key: 'money_of_ai' },
      evidence_feedback_ids: ['feedback-reference-videos-20260908-01'],
      counterexamples: [],
      regression_cases: [],
      status: 'active' as const,
      approved_by: 'Krish',
      approved_at: '2026-09-08T07:35:45.761Z',
    }
    const reviewInput = {
      analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H,
      techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H,
      activePreferences: [preference], preferenceContext: { series: 'money_of_ai', mode: 'solo', jobId: 'job-1' },
    }
    const missingReceipt = reviewVisualPlan({ ...reviewInput, plan: plan() })
    expect(missingReceipt.review.soft_blocks).toContain('The Money of AI standard expects a sourced receipt or artifact in the first five seconds')

    const base = plan()
    const evidenceRequirement = { asset_id: 'opening-receipt', content_kind: 'evidence_screenshot' as const, truth_role: 'evidence' as const, narrative_job: 'prove' as const, claim_ids: ['claim-a'], brief: 'Show the exact source receipt for the opening claim.', generated_allowed: false, required: true, fallback: 'Remove the unsupported opening claim.' }
    const evidencePlan = plan({
      beats: [{ ...base.beats[0]!, claim_ids: ['claim-a'], proof_dependency: true }],
      asset_requirements: [evidenceRequirement],
      shot_directives: [{ ...base.shot_directives[0]!, layers: [...base.shot_directives[0]!.layers, { layer_id: 'opening-receipt-layer', z_index: 1, kind: 'asset', target_id: 'opening-receipt', anchor: 'right', opacity: 1, blend_mode: 'normal', protected: true }] }],
    })
    expect(reviewVisualPlan({ ...reviewInput, plan: evidencePlan }).review.soft_blocks).not.toContain('The Money of AI standard expects a sourced receipt or artifact in the first five seconds')

    const genericPlan = plan({
      beats: [{ ...base.beats[0]!, proof_dependency: true }],
      asset_requirements: [{ ...evidenceRequirement, asset_id: 'generic-ai', content_kind: 'licensed_b_roll', truth_role: 'illustration', narrative_job: 'evoke', claim_ids: [] }],
      shot_directives: [{ ...base.shot_directives[0]!, layers: [...base.shot_directives[0]!.layers, { layer_id: 'generic-ai-layer', z_index: 1, kind: 'asset', target_id: 'generic-ai', anchor: 'right', opacity: 1, blend_mode: 'normal', protected: false }] }],
    })
    expect(reviewVisualPlan({ ...reviewInput, plan: genericPlan }).review.soft_blocks).toContain('confirmed editorial standard rejects generic licensed B-roll as proof in beats: beat-1')
  })

  it('requires early artifacts for build formats but permits a human-led Third Why opening', async () => {
    const registry = await loadTechniqueRegistry(resolve('config/techniques.json'))
    const preference = { schema_version: 1 as const, rule_id: BUILT_WITH_AI_EDITORIAL_RULE_ID, assertion: 'Make the build concrete.', scope: { level: 'series' as const, key: 'built_with_ai' }, evidence_feedback_ids: ['feedback-cross-series-format-expansion-20260908-01'], counterexamples: [], regression_cases: [], status: 'active' as const, approved_by: 'Krish', approved_at: '2026-09-08T12:00:00.000Z' }
    const baseInput = { plan: plan(), analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H, activePreferences: [preference] }
    const build = reviewVisualPlan({ ...baseInput, preferenceContext: { series: 'built_with_ai', mode: 'solo', jobId: 'job-1', editorialFormat: 'build_itself' } })
    expect(build.review.soft_blocks).toContain('build_itself expects a concrete build or artifact in the first eight seconds')
    const human = reviewVisualPlan({ ...baseInput, preferenceContext: { series: 'built_with_ai', mode: 'extract', jobId: 'job-1', editorialFormat: 'third_why' } })
    expect(human.review.soft_blocks).not.toContain('third_why expects a concrete build or artifact in the first eight seconds')
  })

  it('binds asset approval to the exact file hash', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mindmake-asset-'))
    const path = join(directory, 'proof.png')
    await writeFile(path, 'approved pixels', 'utf8')
    const sha256 = await hashFile(path)
    const base = plan()
    const withAsset = plan({
      asset_requirements: [{ asset_id: 'proof-1', content_kind: 'evidence_screenshot', truth_role: 'evidence', narrative_job: 'prove', claim_ids: [], brief: 'Show the exact source supporting the spoken point.', generated_allowed: false, required: true, fallback: 'Hold on Krish and state that proof is unavailable.' }],
      resolved_assets: [{ asset_id: 'proof-1', media_kind: 'image', content_kind: 'evidence_screenshot', truth_role: 'evidence', path, sha256, source_url: 'https://example.com/source', rights: 'third_party_commentary_excerpt', attribution: 'Example source', rights_rationale: 'Short attributed excerpt used to substantiate the claim.', generated: false, approval: { state: 'approved', approved_by: 'Krish', approved_at: '2026-09-04T10:00:00.000Z', artifact_hash: sha256 } }],
      shot_directives: base.shot_directives,
    })
    expect(await verifyVisualAssets(withAsset)).toMatchObject({ passed: true, hard_blocks: [] })
    await writeFile(path, 'changed pixels', 'utf8')
    expect((await verifyVisualAssets(withAsset)).hard_blocks).toContain('asset proof-1 changed after planning')
  })

  it('requires implementable tracked labels and staged value reveals', async () => {
    const registry = await loadTechniqueRegistry(resolve('config/techniques.json'))
    const base = plan()
    const tracked = plan({
      shot_directives: [{
        ...base.shot_directives[0]!,
        technique_ids: ['tracked-object-label'],
        layers: [...base.shot_directives[0]!.layers, {
          layer_id: 'tracked-label', z_index: 1, kind: 'annotation', target_id: 'verified-value', anchor: 'tracked_region', opacity: 1, blend_mode: 'normal', protected: true,
        }],
      }],
    })
    const invalidTracked = reviewVisualPlan({ plan: tracked, analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H })
    expect(invalidTracked.review.hard_blocks).toContain('shot shot-1 uses tracked-object-label without ordered tracking keyframes on an annotation layer')

    const progressive = plan({
      shot_directives: [{
        ...base.shot_directives[0]!,
        technique_ids: ['progressive-value-reveal'],
        layers: [
          ...base.shot_directives[0]!.layers,
          { layer_id: 'value-one', z_index: 1, kind: 'annotation', target_id: 'value-one', anchor: 'left', opacity: 1, blend_mode: 'normal', protected: true, visible_start_ms: 2_000, visible_end_ms: 18_000 },
          { layer_id: 'value-two', z_index: 2, kind: 'annotation', target_id: 'value-two', anchor: 'right', opacity: 1, blend_mode: 'normal', protected: true, visible_start_ms: 7_000, visible_end_ms: 18_000 },
        ],
      }],
    })
    const validProgressive = reviewVisualPlan({ plan: progressive, analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H })
    expect(validProgressive.review.hard_blocks.some((issue) => issue.includes('progressive-value-reveal'))).toBe(false)
  })

  it('requires a deterministic device trace for every production beat under registry v2', async () => {
    const registry = await loadTechniqueRegistry(resolve('config/techniques.json'))
    const reviewed = reviewVisualPlan({ plan: plan(), analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H, production: true })
    expect(reviewed.review.hard_blocks).toContain('production visual plans require one deterministic device selection trace per beat')

    const trace = selectDevicesForBeat(registry, {
      traceId: 'trace-beat-1',
      beatId: 'beat-1',
      series: 'built_with_ai',
      sourceMode: 'solo',
      narrativeFunction: 'payoff',
      viewerTask: 'land_payoff',
      narrativeJob: 'explain',
      treatmentLane: 'restrained',
      availableInputs: ['subject_tracks', 'shot_boundaries'],
      proofRequired: false,
      prohibitedTechniqueIds: registry.techniques.map((device) => device.technique_id).filter((id) => id !== 'stable-semantic-crop'),
      registryHash: H,
    })
    const bound = reviewVisualPlan({ plan: plan({ device_selection_traces: [trace] }), analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H, production: true })
    expect(bound.review.hard_blocks).toEqual([])
    const wrongHash = reviewVisualPlan({ plan: plan({ device_selection_traces: [{ ...trace, registry_hash: 'b'.repeat(64) }] }), analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H, production: true })
    expect(wrongHash.review.hard_blocks).toContain('device selection trace trace-beat-1 references a different technique registry hash')

    const invention = selectDevicesForBeat(registry, {
      traceId: 'trace-invention', beatId: 'beat-1', series: 'built_with_ai', sourceMode: 'solo', narrativeFunction: 'payoff', viewerTask: 'land_payoff', narrativeJob: 'delight', treatmentLane: 'experimental', availableInputs: [], proofRequired: false, registryHash: H,
    })
    const approvedInvention = { ...invention, invention: { ...invention.invention!, approval_state: 'approved' as const, approved_by: 'Krish' as const, approval_ref: 'studio-user-confirmation:codex:invention:trace-invention' } }
    const wrongLane = reviewVisualPlan({ plan: plan({ device_selection_traces: [approvedInvention] }), analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H, production: true })
    expect(wrongLane.review.hard_blocks).toContain('invented devices require the experimental treatment lane')
  })
  it('reviews a two-beat plan that keeps a question open past the hook', async () => {
    const registry = await loadTechniqueRegistry(resolve('config/techniques.json'))
    const reviewed = reviewVisualPlan({ plan: loopedPlan(), analysis: analysis(), sourceAnalysisArtifactHash: H, candidateHash: H, claimsArtifactHash: H, techniqueRegistry: registry, techniqueRegistryHash: H, preferenceSnapshotHash: H })
    expect(reviewed.review.hard_blocks).toEqual([])

    const unlooped = loopedPlan()
    expect(() => VisualNarrativePlanV1Schema.parse({
      ...unlooped,
      beats: unlooped.beats.map(({ opens_question, answers_beat_id, ...beat }) => beat),
    })).toThrow('the hook must leave a question open that a later beat answers')
  })
})
