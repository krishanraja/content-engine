import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BrandThemeV1Schema, PENDING_BRAND_SOURCE_COMMIT, RenderManifestV2Schema, SourceVisualAnalysisV1Schema, TreatmentRegistryV1Schema, VisualNarrativePlanV1Schema, type BrandThemeV1, type RenderManifestV2, type SourceVisualAnalysisV1 } from '@mindmake/contracts'
import { brandGeometryContextIssues, brandLayerCollisionIssues, brandThemeRefusal, officialWordmarkUrl, publicationLegibilityReport, completeStageV2, createJobV2, hashValue, loadExactBrandGeometryContextV2, loadPinnedRenderRegistryV2, loudnormSecondPassFilterV2, manifestToV2RenderProps, renderV2CacheKey, resolveBrandPlacementForShot, resolveBrandTimeline, validateV2RenderReadiness, type BrandGeometryContextV2 } from '@mindmake/core'
import studioConfig from '../config/studio.json'
import { brandLockupRenderModel, publicationLockupRenderModel } from '../apps/renderer/src/v2/MindmakeStory'
import { houseBandModel, houseCallModel, houseCaptionHidden, houseCaptionModel, houseMarkModel, houseStickerModel } from '../apps/renderer/src/v2/HouseShort'
import { houseCallFrame, houseSwipeIndex } from '../apps/renderer/src/house/geometry'
import { cameraCropAt, defaultLayerBounds, deterministicUnit, primaryAttentionLayerId, sourceStartForShot, transitionOpacity } from '../apps/renderer/src/v2/timeline'
import type { V2RuntimeShot } from '../apps/renderer/src/v2/props'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

function manifest(): RenderManifestV2 {
  return RenderManifestV2Schema.parse({
    schema_version: 2,
    manifest_id: 'manifest-render-v2',
    job_id: 'job-render-v2',
    candidate_id: 'candidate-v2',
    candidate_hash: HASH_A,
    visual_plan_artifact_hash: HASH_B,
    series: 'built_with_ai',
    treatment_id: 'premium-evidence-v2',
    treatment_lane: 'premium',
    target_platform: 'youtube_shorts',
    output: { platform: 'youtube_shorts', width: 1080, height: 1920, fps: 30, audio_hz: 48000, safe_zones: { top_px: 100, right_px: 70, bottom_px: 300, left_px: 70 }, maximum_duration_ms: 180_000 },
    duration_ms: 2_000,
    sources: [{ source_id: 'camera-main', kind: 'video', path: 'camera.mp4', sha256: HASH_A, duration_ms: 10_000, width: 3840, height: 2160, fps: 30, audio_hz: 48000, canonical_offset_ms: 0 }],
    shot_directives: [{
      shot_id: 'shot-main',
      beat_id: 'beat-main',
      start_ms: 0,
      end_ms: 2_000,
      source_id: 'camera-main',
      source_start_ms: 4_000,
      source_end_ms: 6_000,
      subject_track_ids: ['krish-track'],
      primary_attention_target: { kind: 'presenter' },
      technique_ids: ['semantic-push'],
      camera_plan: {
        camera_plan_id: 'camera-plan-main',
        source_id: 'camera-main',
        subject_track_ids: ['krish-track'],
        start_ms: 0,
        end_ms: 2_000,
        framing: 'medium_close',
        movement: 'push',
        lead_room: 'none',
        protected_region_ids: [],
        keyframes: [
          { at_ms: 0, crop: { x: 0.21875, y: 0, width: 0.5625, height: 1 }, zoom: 1, rotation_degrees: 0, confidence: 0.95 },
          { at_ms: 2_000, crop: { x: 0.25, y: 0.05, width: 0.5, height: 0.888889 }, zoom: 1.125, rotation_degrees: 0, confidence: 0.93 },
        ],
        easing: 'ease_in_out',
        max_velocity: 1,
        max_acceleration: 1,
        minimum_hold_ms: 250,
        quality_floor: { minimum_effective_width_px: 1080, allow_upscale: false },
        confidence: 0.93,
        fallback: 'Hold a stable portrait centre crop.',
      },
      layers: [
        { layer_id: 'background-main', z_index: -1, kind: 'background', anchor: 'full', opacity: 1, blend_mode: 'normal', protected: false },
        { layer_id: 'source-main', z_index: 0, kind: 'source', target_id: 'camera-main', anchor: 'full', opacity: 1, blend_mode: 'normal', protected: true },
        { layer_id: 'caption-main', z_index: 20, kind: 'caption', anchor: 'bottom', bounds: { x: 0.065, y: 0.62, width: 0.87, height: 0.18 }, opacity: 1, blend_mode: 'normal', protected: true },
      ],
      transition_in: 'none',
      transition_out: 'none',
      audio_continuity: 'direct',
      rationale: 'Keep Krish primary while the camera makes one purposeful push.',
    }],
    assets: [],
    generated_shots: [],
    captions: [
      { start_ms: 0, end_ms: 1_000, text: 'This changes the outcome.', emphasis: ['changes'] },
      { start_ms: 1_000, end_ms: 2_000, text: 'Here is why.', emphasis: ['why'] },
    ],
    caption_provenance: { transcript_hash: HASH_A, verified: true, exact_word_fidelity: true, source_token_count: 7, caption_token_count: 7 },
    audio_plan: { dialogue_source_ids: ['camera-main'], dialogue_master_source_id: 'camera-main', dialogue_edits: [{ edit_id: 'dialogue-main', source_id: 'camera-main', output_start_ms: 0, output_end_ms: 2_000, source_start_ms: 4_000, source_end_ms: 6_000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 }], transitions: [], music: [], effects: [], target_lufs: -14, maximum_true_peak_dbtp: -1 },
    branding: { mode: 'none', wordmark_hashes: [] },
    disclosures: [{ platform: 'youtube_shorts', decision: 'not_required', rationale: 'No synthetic or meaningfully altered material is used.' }],
    fixed_seed: 'fixed-render-seed-v2',
  })
}

function evidenceManifest(approval: 'unreviewed' | 'approved' = 'unreviewed'): RenderManifestV2 {
  const base = manifest()
  const asset = {
    asset_id: 'proof-card',
    media_kind: 'image' as const,
    content_kind: 'evidence_screenshot' as const,
    truth_role: 'evidence' as const,
    path: 'proof.png',
    sha256: HASH_B,
    source_url: 'https://example.com/proof',
    rights: 'third_party_commentary_excerpt' as const,
    attribution: 'Example source',
    rights_rationale: 'A short attributed excerpt directly supports the spoken claim.',
    generated: false,
    approval: approval === 'approved' ? { state: 'approved' as const, approved_by: 'Krish' as const, approved_at: '2026-09-04T10:00:00.000Z', artifact_hash: HASH_B } : { state: 'unreviewed' as const },
  }
  const shot = base.shot_directives[0]!
  return RenderManifestV2Schema.parse({
    ...base,
    assets: [asset],
    shot_directives: [{
      ...shot,
      primary_attention_target: { kind: 'evidence', target_id: 'proof-card' },
      layers: [...shot.layers, { layer_id: 'proof-layer', z_index: 10, kind: 'asset', target_id: 'proof-card', anchor: 'right', bounds: { x: 0.5, y: 0.18, width: 0.46, height: 0.48 }, opacity: 1, blend_mode: 'normal', protected: true }],
    }],
  })
}

function officialBrandFixture() {
  const registry = TreatmentRegistryV1Schema.parse(studioConfig)
  const theme = registry.brand_themes.find((candidate) => candidate.theme_id === registry.default_brand_theme)
  if (!theme?.wordmarks?.lockup) throw new Error('active GitHub theme is missing its approved wordmark lockup')
  const series = theme.wordmarks.series.built_with_ai
  return {
    theme,
    wordmarks: {
      mindmake: { ...theme.wordmarks.mindmake, assetFile: `brand-mindmake-${theme.wordmarks.mindmake.sha256.slice(0, 16)}.svg` },
      series: { ...series, assetFile: `brand-built_with_ai-${series.sha256.slice(0, 16)}.png` },
      lockup: theme.wordmarks.lockup,
    },
  }
}

function brandableManifest(base: RenderManifestV2 = manifest()): RenderManifestV2 {
  const { theme } = officialBrandFixture()
  return RenderManifestV2Schema.parse({
    ...base,
    branding: {
      mode: 'series',
      theme_id: theme.theme_id,
      theme_version: theme.version,
      theme_hash: hashValue(theme),
      wordmark_hashes: [theme.wordmarks!.mindmake.sha256, theme.wordmarks!.series[base.series]!.sha256],
    },
    shot_directives: base.shot_directives.map((shot) => ({
      ...shot,
      layers: shot.layers.map((layer) => layer.kind === 'source' ? { ...layer, protected: false } : layer),
    })),
  })
}

function sourceAnalysisFor(base: RenderManifestV2, overrides: Partial<SourceVisualAnalysisV1> = {}): SourceVisualAnalysisV1 {
  const visualSources = base.sources.filter((source) => source.kind !== 'audio')
  return SourceVisualAnalysisV1Schema.parse({
    schema_version: 1,
    analysis_id: 'analysis-render-v2',
    job_id: base.job_id,
    source_bundle_hash: HASH_A,
    coordinate_space: 'normalized_0_1',
    timebase: 'source_local_ms',
    generated_at: '2026-09-04T10:00:00.000Z',
    capabilities: { tier: 2, analyzers: { face_tracking: 'fixture-v1' }, unavailable: [], fallbacks: [] },
    sources: visualSources.map((source) => ({ source_id: source.source_id, source_hash: source.sha256, duration_ms: source.duration_ms, width: source.width, height: source.height, fps: source.fps, audio_hz: source.audio_hz, canonical_offset_ms: source.canonical_offset_ms })),
    shots: [],
    subjects: [{
      track_id: 'krish-track',
      source_id: 'camera-main',
      role: 'krish',
      profile_id: 'krish-profile',
      profile_version_hash: HASH_B,
      start_ms: 0,
      end_ms: 10_000,
      face_keyframes: [
        { at_ms: 0, bounds: { x: 0.45, y: 0.6, width: 0.1, height: 0.1 }, confidence: 0.99 },
        { at_ms: 10_000, bounds: { x: 0.45, y: 0.6, width: 0.1, height: 0.1 }, confidence: 0.99 },
      ],
      body_keyframes: [
        { at_ms: 0, bounds: { x: 0.4, y: 0.73, width: 0.2, height: 0.25 }, confidence: 0.99 },
        { at_ms: 10_000, bounds: { x: 0.4, y: 0.73, width: 0.2, height: 0.25 }, confidence: 0.99 },
      ],
      hand_keyframes: [],
      detection_confidence: 0.99,
    }],
    active_speakers: [],
    gestures: [],
    gaze: [],
    negative_space: [],
    protected_regions: [],
    sidecars: [],
    quality_issues: [],
    ...overrides,
  })
}

function brandGeometryFor(base: RenderManifestV2, analysis: SourceVisualAnalysisV1 = sourceAnalysisFor(base)): BrandGeometryContextV2 {
  return { analysis, artifactHash: HASH_B, expectedArtifactHash: HASH_B }
}

describe('V2 render readiness', () => {
  it('accepts a fully covered, exact-transcript render', () => {
    expect(validateV2RenderReadiness(manifest())).toEqual([])
  })

  it('permits unreviewed evidence in styleframes but blocks it from animatics and finals', () => {
    const proposed = evidenceManifest()
    expect(validateV2RenderReadiness(proposed, 'styleframe')).toEqual([])
    expect(validateV2RenderReadiness(proposed, 'animatic')).toContain('asset proof-card lacks exact Krish approval')
    expect(validateV2RenderReadiness(evidenceManifest('approved'), 'animatic')).toEqual([])
  })

  it('blocks competing layers for one primary attention target', () => {
    const base = evidenceManifest('approved')
    const shot = base.shot_directives[0]!
    const duplicated = RenderManifestV2Schema.parse({ ...base, shot_directives: [{ ...shot, layers: [...shot.layers, { ...shot.layers.at(-1), layer_id: 'proof-layer-two', z_index: 11 }] }] })
    expect(validateV2RenderReadiness(duplicated)).toContain('shot shot-main has 2 layers competing for primary attention')
  })

  it('blocks caption phrases too dense for two lines', () => {
    const base = manifest()
    const dense = RenderManifestV2Schema.parse({ ...base, captions: [{ start_ms: 0, end_ms: 2_000, text: 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen', emphasis: [] }] })
    expect(validateV2RenderReadiness(dense)).toContain('caption at 0 ms is too dense for two-line vertical treatment')
  })

  it('blocks explicit caption placement outside the platform safe zone', () => {
    const base = manifest()
    const shot = base.shot_directives[0]!
    const unsafe = RenderManifestV2Schema.parse({ ...base, shot_directives: [{ ...shot, layers: shot.layers.map((layer) => layer.kind === 'caption' ? { ...layer, bounds: { x: 0.01, y: 0.8, width: 0.98, height: 0.18 } } : layer) }] })
    expect(validateV2RenderReadiness(unsafe)).toContain('shot shot-main caption layer caption-main leaves the youtube_shorts safe zone')
  })

  it('does not silently pretend a tracked source is a transparent subject cutout', () => {
    const base = manifest()
    const shot = base.shot_directives[0]!
    const unsupported = RenderManifestV2Schema.parse({ ...base, shot_directives: [{ ...shot, layers: [...shot.layers, { layer_id: 'cutout-layer', z_index: 5, kind: 'subject_cutout', target_id: 'krish-track', anchor: 'right', opacity: 1, blend_mode: 'normal', protected: true }] }] })
    expect(validateV2RenderReadiness(unsupported)).toContain('shot shot-main subject layer cutout-layer requires a precomposited transparent asset')
  })

  it('blocks dialogue overlaps, gaps and incomplete duration coverage', () => {
    const base = manifest()
    const edits = [
      { edit_id: 'dialogue-first', source_id: 'camera-main', output_start_ms: 0, output_end_ms: 1_000, source_start_ms: 4_000, source_end_ms: 5_000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 },
      { edit_id: 'dialogue-second', source_id: 'camera-main', output_start_ms: 1_000, output_end_ms: 2_000, source_start_ms: 5_000, source_end_ms: 6_000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 },
    ]
    expect(validateV2RenderReadiness({ ...base, audio_plan: { ...base.audio_plan, dialogue_edits: [{ ...edits[0]!, output_end_ms: 1_100, source_end_ms: 5_100 }, { ...edits[1]!, output_start_ms: 1_000 }] } } as RenderManifestV2)).toContain('audio_plan.dialogue_edits.1.output_start_ms: dialogue timeline overlaps from 1000 ms to 1100 ms')
    expect(validateV2RenderReadiness({ ...base, audio_plan: { ...base.audio_plan, dialogue_edits: [{ ...edits[0]!, output_end_ms: 900, source_end_ms: 4_900 }, edits[1]!] } } as RenderManifestV2)).toContain('audio_plan.dialogue_edits.1.output_start_ms: dialogue timeline has a gap from 900 ms to 1000 ms')
    expect(validateV2RenderReadiness({ ...base, audio_plan: { ...base.audio_plan, dialogue_edits: [{ ...edits[0]!, output_end_ms: 1_900, source_end_ms: 5_900 }] } } as RenderManifestV2)).toContain('audio_plan.dialogue_edits: dialogue timeline ends at 1900 ms before render duration 2000 ms')
  })

  it('blocks audio transition metadata, non-direct shot continuity, music and effects until they are implemented with governed assets', () => {
    const base = manifest()
    expect(validateV2RenderReadiness({ ...base, audio_plan: { ...base.audio_plan, transitions: [{ at_ms: 1_000, kind: 'crossfade', duration_ms: 100 }] } } as RenderManifestV2)).toContain('audio_plan.transitions: audio transition metadata is not implemented; use contiguous direct dialogue edits')
    expect(validateV2RenderReadiness({ ...base, shot_directives: [{ ...base.shot_directives[0]!, audio_continuity: 'j_cut' }] } as RenderManifestV2)).toContain('shot_directives.0.audio_continuity: non-direct shot audio continuity is not implemented; use direct')
    expect(validateV2RenderReadiness({ ...base, audio_plan: { ...base.audio_plan, music: [{ asset_id: 'music-bed', start_ms: 0, end_ms: 2_000, gain_db: -18, rights: 'owned' }] } } as RenderManifestV2)).toContain('audio_plan.music: music is blocked until a governed approved audio-asset ledger exists')
    expect(validateV2RenderReadiness({ ...base, audio_plan: { ...base.audio_plan, effects: [{ asset_id: 'impact-hit', at_ms: 500, gain_db: -12, purpose: 'Mark the key reveal.', rights: 'owned' }] } } as RenderManifestV2)).toContain('audio_plan.effects: sound effects are blocked until a governed approved audio-asset ledger exists')
  })
})

describe('V2 runtime props', () => {
  it('keeps the deterministic camera, layer, caption and audio decisions', () => {
    const input = manifest()
    const props = manifestToV2RenderProps(input, { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} })
    expect(props.shots[0]?.camera.keyframes).toHaveLength(2)
    expect(props.shots[0]?.layers.map((layer) => layer.kind)).toEqual(['background', 'source', 'caption'])
    expect(props.shots[0]).toMatchObject({ sourceStartMs: 4_000, sourceEndMs: 6_000 })
    expect(props.audioTracks[0]).toMatchObject({ trackId: 'dialogue-dialogue-main', assetFile: 'source-camera.mp4', startMs: 0, trimBeforeMs: 4_000 })
    expect(props.branding.mode).toBe('none')
  })

  it('truncates only time-dependent runtime decisions for a preview', () => {
    const props = manifestToV2RenderProps(manifest(), { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }, { durationMs: 1_200 })
    expect(props.durationMs).toBe(1_200)
    expect(props.shots[0]?.endMs).toBe(1_200)
    expect(props.captions.at(-1)?.endMs).toBe(1_200)
    expect(props.audioTracks[0]?.endMs).toBe(1_200)
  })

  it('renders dialogue from explicit ISO source spans with authored fades', () => {
    const base = manifest()
    const iso = { source_id: 'dialogue-iso', kind: 'audio' as const, path: 'dialogue.m4a', sha256: HASH_B, duration_ms: 12_000, width: null, height: null, fps: null, audio_hz: 48000, canonical_offset_ms: 0 }
    const edited = RenderManifestV2Schema.parse({
      ...base,
      sources: [...base.sources, iso],
      audio_plan: {
        ...base.audio_plan,
        dialogue_source_ids: ['camera-main', 'dialogue-iso'],
        dialogue_master_source_id: 'dialogue-iso',
        dialogue_edits: [{ edit_id: 'iso-edit', source_id: 'dialogue-iso', output_start_ms: 0, output_end_ms: 2_000, source_start_ms: 7_000, source_end_ms: 9_000, gain_db: -1, fade_in_ms: 80, fade_out_ms: 120 }],
      },
    })
    const props = manifestToV2RenderProps(edited, { sourceFiles: { 'camera-main': 'source-camera.mp4', 'dialogue-iso': 'dialogue.m4a' }, assetFiles: {} })
    expect(props.sources.map((source) => source.sourceId)).toEqual(['camera-main'])
    expect(props.audioTracks[0]).toMatchObject({ trackId: 'dialogue-iso-edit', assetFile: 'dialogue.m4a', trimBeforeMs: 7_000, fadeInMs: 80, fadeOutMs: 120 })
  })

  it('does not silently omit a missing staged dialogue source', () => {
    expect(() => manifestToV2RenderProps(manifest(), { sourceFiles: {}, assetFiles: {} })).toThrow('staged dialogue source camera-main is missing')
  })

  it('keeps evidence attribution and source domain in the render payload', () => {
    const props = manifestToV2RenderProps(evidenceManifest('approved'), { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: { 'proof-card': 'proof.png' } })
    expect(props.assets[0]).toMatchObject({ attribution: 'Example source', sourceDomain: 'example.com', truthRole: 'evidence' })
  })

  it('binds cache identity to profile, implementation and duration', () => {
    const input = manifest()
    const base = renderV2CacheKey(input, 'preview', 'renderer-a', 1_000)
    expect(base).not.toBe(renderV2CacheKey(input, 'preview', 'renderer-b', 1_000))
    expect(base).not.toBe(renderV2CacheKey(input, 'master', 'renderer-a', 1_000))
    expect(base).not.toBe(renderV2CacheKey(input, 'preview', 'renderer-a', 2_000))
  })

  it('normalizes V2 audio to the contracted true peak', () => {
    const filter = loudnormSecondPassFilterV2('{"input_i":"-20","input_tp":"-3","input_lra":"2","input_thresh":"-30","target_offset":"0"}')
    expect(filter).toContain('TP=-1')
    expect(filter).toContain('measured_TP=-3')
  })
})

describe('V2 renderer timeline helpers', () => {
  const shot = manifestToV2RenderProps(manifest(), { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }).shots[0] as V2RuntimeShot

  it('interpolates an approved camera move deterministically', () => {
    const midpoint = cameraCropAt(shot, 1_000)
    expect(midpoint.width).toBeGreaterThan(0.5)
    expect(midpoint.width).toBeLessThan(0.5625)
    expect(cameraCropAt(shot, 1_000)).toEqual(midpoint)
  })

  it('resolves exactly one primary visual layer', () => {
    expect(primaryAttentionLayerId(shot)).toBe('source-main')
  })

  it('uses stable layout and transition functions', () => {
    expect(defaultLayerBounds(shot.layers.find((layer) => layer.kind === 'caption')!)).toMatchObject({ x: 0.065, y: 0.62, width: 0.87, height: 0.18 })
    expect(transitionOpacity({ ...shot, transitionIn: 'fade' }, 0)).toBe(0)
    expect(transitionOpacity({ ...shot, transitionIn: 'fade' }, 160)).toBe(1)
    expect(deterministicUnit('fixed-seed')).toBe(deterministicUnit('fixed-seed'))
  })

  it('synchronizes a secondary camera from the selected primary source span', () => {
    const sources = [
      { sourceId: 'camera-main', assetFile: 'main.mp4', durationMs: 10_000, width: 3840, height: 2160, canonicalOffsetMs: 0 },
      { sourceId: 'camera-guest', assetFile: 'guest.mp4', durationMs: 10_000, width: 3840, height: 2160, canonicalOffsetMs: 500 },
    ]
    expect(sourceStartForShot(shot, 'camera-main', sources)).toBe(4_000)
    expect(sourceStartForShot(shot, 'camera-guest', sources)).toBe(3_500)
  })
})

describe('V2 brand lockup protection', () => {
  it('loads treatment and brand configuration from an older job pin after checkout config changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mindmake-render-pin-v2-'))
    const priorRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
    try {
      const checkoutConfig = join(root, 'studio.json')
      const expectedRegistry = TreatmentRegistryV1Schema.parse(studioConfig)
      await writeFile(checkoutConfig, `${JSON.stringify(expectedRegistry, null, 2)}\n`)
      const job = await createJobV2({
        series: 'built_with_ai',
        mode: 'short_native',
        presenterName: 'Krish',
        configPath: checkoutConfig,
        skillPaths: [],
      })

      await writeFile(checkoutConfig, '{"schema_version":1,"checkout_revision":"incompatible-new-config"}\n')
      const pinnedRegistry = await loadPinnedRenderRegistryV2(RenderManifestV2Schema.parse({ ...manifest(), job_id: job.job_id }))

      expect(hashValue(pinnedRegistry)).toBe(hashValue(expectedRegistry))
      expect(pinnedRegistry.default_brand_theme).toBe(expectedRegistry.default_brand_theme)
      expect(pinnedRegistry.brand_themes).toEqual(expectedRegistry.brand_themes)
    } finally {
      if (priorRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntimeRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  it('loads brand geometry only through the current content-addressed source-analysis lineage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mindmake-brand-analysis-v2-'))
    const priorRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
    try {
      const bundle = {
        schema_version: 1 as const,
        bundle_id: 'bundle-brand-analysis',
        primary_source_id: 'camera-main',
        sources: [{ source_id: 'camera-main', kind: 'video' as const, role: 'primary_camera' as const, ref: 'camera.mp4', content_hash: HASH_A, rights: 'owned' as const, sync: { strategy: 'already_mixed' as const, offset_ms: 0 }, include_in_edit: true }],
      }
      const job = await createJobV2({
        series: 'built_with_ai',
        mode: 'solo',
        presenterName: 'Krish',
        sourceBundle: bundle,
        targetPlatforms: ['youtube_shorts'],
        configPath: join(process.cwd(), 'config', 'studio.json'),
        skillPaths: [],
      })
      const base = RenderManifestV2Schema.parse({ ...manifest(), job_id: job.job_id })
      await completeStageV2(job.job_id, 'ingest', { fixture: true }, {}, { fixture: '1' })
      await completeStageV2(job.job_id, 'normalize', { fixture: true }, { ingest: HASH_A }, { fixture: '1' })
      await completeStageV2(job.job_id, 'transcript', { fixture: true }, { normalize: HASH_A }, { fixture: '1' })
      await completeStageV2(job.job_id, 'candidates', { fixture: true }, { transcript: HASH_A }, { fixture: '1' })
      await completeStageV2(job.job_id, 'claims', { fixture: true }, { candidates: HASH_A }, { fixture: '1' })
      const analysis = sourceAnalysisFor(base, { job_id: job.job_id, source_bundle_hash: hashValue(bundle) })
      const analysisArtifact = await completeStageV2(job.job_id, 'source_analysis', analysis, { normalize: HASH_A }, { fixture: '1' })
      const visualPlan = VisualNarrativePlanV1Schema.parse({
        schema_version: 1,
        plan_id: 'plan-brand-analysis',
        job_id: job.job_id,
        candidate_id: base.candidate_id,
        candidate_hash: base.candidate_hash,
        claims_artifact_hash: HASH_A,
        source_analysis_artifact_hash: analysisArtifact.artifact_hash,
        technique_registry_hash: HASH_A,
        preference_snapshot_hash: HASH_A,
        duration_ms: base.duration_ms,
        treatment_lane: base.treatment_lane,
        beats: [{ beat_id: 'beat-main', start_ms: 0, end_ms: 2_000, transcript: 'This changes the outcome. Here is why.', source_spans: [{ source_id: 'camera-main', start_ms: 4_000, end_ms: 6_000 }], claim_ids: [], narrative_function: 'ending', viewer_task: 'land_payoff', emotional_function: 'trust', visual_density: 'rest', proof_dependency: false, primary_attention_target: { kind: 'presenter' }, rationale: 'Let the useful conclusion land clearly on Krish.' }],
        asset_requirements: [],
        resolved_assets: [],
        shot_directives: base.shot_directives,
        budget: { estimated_cost_gbp: 0, maximum_cost_gbp: 15, exception_approved: false },
        disclosures: base.disclosures,
        fallbacks: [],
        strategy_summary: 'A restrained presenter-led close that keeps the conclusion clear.',
      })
      const planArtifact = await completeStageV2(job.job_id, 'visual_plan', visualPlan, { source_analysis: analysisArtifact.artifact_hash, candidate: HASH_A, claims: HASH_A }, { fixture: '1' })
      const branded = brandableManifest(RenderManifestV2Schema.parse({ ...base, visual_plan_artifact_hash: planArtifact.artifact_hash }))
      await expect(loadExactBrandGeometryContextV2(branded)).resolves.toMatchObject({ artifactHash: analysisArtifact.artifact_hash, expectedArtifactHash: analysisArtifact.artifact_hash, analysis: { analysis_id: 'analysis-render-v2', job_id: job.job_id } })
      await expect(loadExactBrandGeometryContextV2(RenderManifestV2Schema.parse({ ...branded, visual_plan_artifact_hash: HASH_B }))).rejects.toThrow('render manifest is not bound to the exact current visual_plan artifact')
    } finally {
      if (priorRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = priorRuntimeRoot
      await rm(root, { recursive: true, force: true })
    }
  })

  it('moves the compact Mindmake anchor to the other safe corner when evidence occupies top-left', () => {
    const { theme } = officialBrandFixture()
    const base = evidenceManifest('approved')
    const shot = base.shot_directives[0]!
    const branded = brandableManifest(RenderManifestV2Schema.parse({
      ...base,
      shot_directives: [{ ...shot, layers: shot.layers.map((layer) => layer.layer_id === 'proof-layer' ? { ...layer, anchor: 'top_left', bounds: { x: 0.04, y: 0.04, width: 0.42, height: 0.34 } } : layer) }],
    }))
    expect(resolveBrandPlacementForShot(branded, theme, branded.shot_directives[0]!, 'mindmake_only', 0, 2_000, brandGeometryFor(branded))).toMatchObject({ placement: { mode: 'mindmake_only', corner: 'top_right', topPx: 140, leftPx: 720 }, issues: [] })
  })

  it('renders a phone-legible series identity moment, then collapses to the official Mindmake anchor', () => {
    const { theme, wordmarks } = officialBrandFixture()
    const expectedHashes = [wordmarks.mindmake.sha256, wordmarks.series.sha256].sort()
    const branded = brandableManifest()
    expect([...branded.branding.wordmark_hashes].sort()).toEqual(expectedHashes)
    const brandGeometry = brandGeometryFor(branded)

    for (const reviewOverlay of ['styleframe', 'none'] as const) {
      const props = manifestToV2RenderProps(branded, { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }, { theme, wordmarks, reviewOverlay, brandGeometry })
      expect(props.reviewOverlay).toBe(reviewOverlay)
      expect(props.branding.mode).toBe('series')
      expect(props.branding.wordmarks?.mindmake).toMatchObject({ sourcePath: 'src/assets/mindmake-wordmark.svg', sha256: '57fd2cdef929de2035baf5b0405a152878b26f7eba39b17b1d4c03f2470b9737' })
      expect(props.branding.wordmarks?.series).toMatchObject({ sourcePath: 'src/assets/builtwithai-logo-wordmark.png', sha256: '271ab965dc51714be8c13c8a6bb8c7b2b60f4bf22caf51dda5a2928e295fd29f' })
      expect(props.shots[0]?.brandCues).toEqual([
        { startMs: 0, endMs: 1_200, mode: 'stacked_identity', corner: 'top_left', topPx: 140, leftPx: 80 },
        { startMs: 1_200, endMs: 2_000, mode: 'mindmake_only', corner: 'top_left', topPx: 140, leftPx: 80 },
      ])
      const model = brandLockupRenderModel(props.branding, props.shots[0]?.brandCues?.[0])
      expect(model).not.toBeNull()
      expect(model).toMatchObject({ mode: 'stacked_identity', corner: 'top_left', plate: { count: 1, width: 700, height: 520, top: 140, left: 80 }, wordmarks: [{ role: 'mindmake', displayWidth: 230 }, { role: 'series', displayWidth: 650 }] })
      const [mindmake, series] = model!.wordmarks
      const mindmakeHeight = mindmake!.displayWidth * mindmake!.asset.alphaCrop.height / mindmake!.asset.alphaCrop.width
      const seriesLetterHeight = series!.displayWidth * series!.asset.letterRegion.height / series!.asset.alphaCrop.width
      expect(mindmakeHeight).toBeGreaterThanOrEqual(32)
      expect(seriesLetterHeight).toBeGreaterThanOrEqual(50)
      expect(seriesLetterHeight * 375 / 1080).toBeGreaterThanOrEqual(17)
      expect(brandLockupRenderModel(props.branding, props.shots[0]?.brandCues?.[1])).toMatchObject({
        mode: 'mindmake_only',
        plate: { width: 280, height: 90 },
        wordmarks: [{ role: 'mindmake', displayWidth: 230 }],
      })
    }
  })

  it('reserves a clear identity moment and uses the compact Mindmake anchor while evidence is active', () => {
    const { theme, wordmarks } = officialBrandFixture()
    const base = evidenceManifest('approved')
    const branded = brandableManifest(RenderManifestV2Schema.parse({
      ...base,
      shot_directives: base.shot_directives.map((shot) => ({ ...shot, layers: shot.layers.map((layer) => layer.layer_id === 'proof-layer' ? { ...layer, visible_start_ms: 1_200, visible_end_ms: 2_000 } : layer) })),
    }))
    const props = manifestToV2RenderProps(branded, { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: { 'proof-card': 'proof.png' } }, { theme, wordmarks, brandGeometry: brandGeometryFor(branded) })
    expect(props.shots[0]?.brandCues).toEqual([
      { startMs: 0, endMs: 1_200, mode: 'stacked_identity', corner: 'top_left', topPx: 140, leftPx: 80 },
      { startMs: 1_200, endMs: 2_000, mode: 'mindmake_only', corner: 'top_left', topPx: 140, leftPx: 80 },
    ])
  })

  it('uses the official series-only identity fallback without shrinking its lettering', () => {
    const { theme } = officialBrandFixture()
    const fallbackTheme = { ...theme, wordmarks: { ...theme.wordmarks!, lockup: { ...theme.wordmarks!.lockup!, identity: { ...theme.wordmarks!.lockup!.identity, series_width: 400 } } } } as BrandThemeV1
    const base = brandableManifest()
    const branded = RenderManifestV2Schema.parse({ ...base, branding: { mode: 'series', theme_id: fallbackTheme.theme_id, theme_version: fallbackTheme.version, theme_hash: hashValue(fallbackTheme), wordmark_hashes: [fallbackTheme.wordmarks!.mindmake.sha256, fallbackTheme.wordmarks!.series.built_with_ai.sha256] } })
    const timeline = resolveBrandTimeline(branded, fallbackTheme, brandGeometryFor(branded))
    expect(timeline.issues).toEqual([])
    expect(timeline.identity_cue).toMatchObject({ mode: 'series_only', startMs: 0, endMs: 1_200 })
    const letterHeight = fallbackTheme.wordmarks!.lockup!.series_only_fallback.series_width * fallbackTheme.wordmarks!.series.built_with_ai.letter_region.height / fallbackTheme.wordmarks!.series.built_with_ai.alpha_crop.width
    expect(letterHeight).toBeGreaterThanOrEqual(50)
    expect(letterHeight * 375 / 1080).toBeGreaterThanOrEqual(17)
  })

  it('uses authored lead room or a branding directive to keep the lockup away from the presenter', () => {
    const { theme } = officialBrandFixture()
    const base = brandableManifest()
    const shot = base.shot_directives[0]!
    const leadRoom = RenderManifestV2Schema.parse({ ...base, shot_directives: [{ ...shot, camera_plan: { ...shot.camera_plan, lead_room: 'right' } }] })
    expect(resolveBrandPlacementForShot(leadRoom, theme, leadRoom.shot_directives[0]!, 'mindmake_only', 0, 2_000, brandGeometryFor(leadRoom)).placement?.corner).toBe('top_right')
    const directed = RenderManifestV2Schema.parse({ ...base, shot_directives: [{ ...shot, layers: [...shot.layers, { layer_id: 'brand-placement', z_index: 30, kind: 'branding', anchor: 'top_right', opacity: 1, blend_mode: 'normal', protected: true }] }] })
    expect(resolveBrandPlacementForShot(directed, theme, directed.shot_directives[0]!, 'mindmake_only', 0, 2_000, brandGeometryFor(directed)).placement?.corner).toBe('top_right')
  })

  it('fails the placement gate when protected visuals occupy both approved corners', () => {
    const { theme } = officialBrandFixture()
    const base = brandableManifest()
    const shot = base.shot_directives[0]!
    const blocked = RenderManifestV2Schema.parse({
      ...base,
      shot_directives: [{
        ...shot,
        layers: [
          ...shot.layers,
          { layer_id: 'protected-left', z_index: 30, kind: 'annotation', anchor: 'top_left', bounds: { x: 0.03, y: 0.05, width: 0.45, height: 0.4 }, opacity: 1, blend_mode: 'normal', protected: true },
          { layer_id: 'protected-right', z_index: 31, kind: 'annotation', anchor: 'top_right', bounds: { x: 0.52, y: 0.05, width: 0.45, height: 0.4 }, opacity: 1, blend_mode: 'normal', protected: true },
        ],
      }],
    })
    expect(brandLayerCollisionIssues(blocked, theme, brandGeometryFor(blocked))).toEqual(['no opening, ending, or safe beat can host the required phone-legible series identity moment'])
  })

  it.each(['source', 'background'] as const)('fails closed when a protected full-frame %s layer would sit beneath the brand plate', (kind) => {
    const { theme } = officialBrandFixture()
    const base = brandableManifest()
    const blocked = RenderManifestV2Schema.parse({
      ...base,
      shot_directives: base.shot_directives.map((shot) => ({
        ...shot,
        layers: shot.layers.map((layer) => layer.kind === kind ? { ...layer, protected: true } : layer),
      })),
    })
    expect(brandLayerCollisionIssues(blocked, theme, brandGeometryFor(blocked))).toEqual(['no opening, ending, or safe beat can host the required phone-legible series identity moment'])
  })

  it('moves the identity cue away from analyzed face geometry', () => {
    const { theme } = officialBrandFixture()
    const branded = brandableManifest()
    const baseline = sourceAnalysisFor(branded)
    const subject = baseline.subjects[0]!
    const leftFace = SourceVisualAnalysisV1Schema.parse({
      ...baseline,
      subjects: [{
        ...subject,
        face_keyframes: [
          { at_ms: 0, bounds: { x: 0.35, y: 0.08, width: 0.08, height: 0.14 }, confidence: 0.99 },
          { at_ms: 10_000, bounds: { x: 0.35, y: 0.08, width: 0.08, height: 0.14 }, confidence: 0.99 },
        ],
      }],
    })
    const timeline = resolveBrandTimeline(branded, theme, brandGeometryFor(branded, leftFace))
    expect(timeline.issues).toEqual([])
    expect(timeline.identity_cue?.corner).toBe('top_right')
  })

  it('moves the identity cue away from camera-plan protected geometry', () => {
    const { theme } = officialBrandFixture()
    const base = brandableManifest()
    const shot = base.shot_directives[0]!
    const branded = RenderManifestV2Schema.parse({
      ...base,
      shot_directives: [{ ...shot, camera_plan: { ...shot.camera_plan, protected_region_ids: ['headline-left'] } }],
    })
    const analysis = sourceAnalysisFor(branded, {
      protected_regions: [{ region_id: 'headline-left', source_id: 'camera-main', start_ms: 0, end_ms: 10_000, bounds: { x: 0.35, y: 0.08, width: 0.08, height: 0.14 }, reason: 'Keep the authored headline visible.', confidence: 0.99 }],
    })
    const timeline = resolveBrandTimeline(branded, theme, brandGeometryFor(branded, analysis))
    expect(timeline.issues).toEqual([])
    expect(timeline.identity_cue?.corner).toBe('top_right')
  })

  it('moves the identity moment to a later clear window when the opening is blocked', () => {
    const { theme } = officialBrandFixture()
    const base = brandableManifest()
    const shot = base.shot_directives[0]!
    const branded = RenderManifestV2Schema.parse({
      ...base,
      shot_directives: [{ ...shot, camera_plan: { ...shot.camera_plan, protected_region_ids: ['opening-centre'] } }],
    })
    const analysis = sourceAnalysisFor(branded, {
      protected_regions: [{ region_id: 'opening-centre', source_id: 'camera-main', start_ms: 4_000, end_ms: 4_600, bounds: { x: 0.48, y: 0.08, width: 0.04, height: 0.14 }, reason: 'Protect the central opening evidence.', confidence: 0.99 }],
    })
    const timeline = resolveBrandTimeline(branded, theme, brandGeometryFor(branded, analysis))
    expect(timeline.issues).toEqual([])
    expect(timeline.identity_cue).toMatchObject({ startMs: 800, endMs: 2_000 })
  })

  it('rejects a cue when different protected intervals occupy both corners', () => {
    const { theme } = officialBrandFixture()
    const base = brandableManifest()
    const shot = base.shot_directives[0]!
    const blocked = RenderManifestV2Schema.parse({
      ...base,
      shot_directives: [{ ...shot, camera_plan: { ...shot.camera_plan, protected_region_ids: ['left-beat', 'right-beat'] } }],
    })
    const analysis = sourceAnalysisFor(blocked, {
      protected_regions: [
        { region_id: 'left-beat', source_id: 'camera-main', start_ms: 4_000, end_ms: 5_000, bounds: { x: 0.35, y: 0.08, width: 0.08, height: 0.14 }, reason: 'Protect the left-side evidence beat.', confidence: 0.99 },
        { region_id: 'right-beat', source_id: 'camera-main', start_ms: 5_000, end_ms: 6_000, bounds: { x: 0.57, y: 0.08, width: 0.08, height: 0.14 }, reason: 'Protect the right-side evidence beat.', confidence: 0.99 },
      ],
    })
    expect(resolveBrandTimeline(blocked, theme, brandGeometryFor(blocked, analysis)).issues).toEqual(['no opening, ending, or safe beat can host the required phone-legible series identity moment'])
  })

  it('uses source-local subject timing and the authored moving camera crop for every cue frame', () => {
    const { theme } = officialBrandFixture()
    const base = brandableManifest()
    const shot = base.shot_directives[0]!
    const moving = RenderManifestV2Schema.parse({
      ...base,
      shot_directives: [{
        ...shot,
        camera_plan: {
          ...shot.camera_plan,
          movement: 'pan',
          easing: 'linear',
          keyframes: [
            { at_ms: 0, crop: { x: 0.2, y: 0, width: 0.31640625, height: 1 }, zoom: 1, rotation_degrees: 0, confidence: 0.99 },
            { at_ms: 2_000, crop: { x: 0.4, y: 0, width: 0.31640625, height: 1 }, zoom: 1, rotation_degrees: 0, confidence: 0.99 },
          ],
        },
      }],
    })
    const baseline = sourceAnalysisFor(moving)
    const subject = baseline.subjects[0]!
    const timed = SourceVisualAnalysisV1Schema.parse({
      ...baseline,
      subjects: [{
        ...subject,
        face_keyframes: [
          { at_ms: 0, bounds: { x: 0.8, y: 0.75, width: 0.04, height: 0.08 }, confidence: 0.99 },
          { at_ms: 4_000, bounds: { x: 0.45, y: 0.08, width: 0.04, height: 0.1 }, confidence: 0.99 },
          { at_ms: 6_000, bounds: { x: 0.45, y: 0.08, width: 0.04, height: 0.1 }, confidence: 0.99 },
          { at_ms: 10_000, bounds: { x: 0.8, y: 0.75, width: 0.04, height: 0.08 }, confidence: 0.99 },
        ],
      }],
    })
    const geometry = brandGeometryFor(moving, timed)
    expect(resolveBrandPlacementForShot(moving, theme, moving.shot_directives[0]!, 'mindmake_only', 0, 200, geometry).placement?.corner).toBe('top_left')
    expect(resolveBrandPlacementForShot(moving, theme, moving.shot_directives[0]!, 'mindmake_only', 1_800, 2_000, geometry).placement?.corner).toBe('top_right')
  })

  it('blocks branded props without exact analysis and rejects stale or unknown geometry', () => {
    const { theme, wordmarks } = officialBrandFixture()
    const branded = brandableManifest()
    expect(() => manifestToV2RenderProps(branded, { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }, { theme, wordmarks })).toThrow('branded rendering requires the exact content-addressed source_analysis artifact')
    expect(brandGeometryContextIssues(branded, { ...brandGeometryFor(branded), expectedArtifactHash: HASH_A })).toContain('source_analysis artifact binding is stale or unknown')
    const missingTrack = sourceAnalysisFor(branded, { subjects: [] })
    expect(brandGeometryContextIssues(branded, brandGeometryFor(branded, missingTrack))).toContain('shot shot-main references unknown subject geometry krish-track')
    const baseline = sourceAnalysisFor(branded)
    const subject = baseline.subjects[0]!
    const incompleteTrack = SourceVisualAnalysisV1Schema.parse({
      ...baseline,
      subjects: [{
        ...subject,
        face_keyframes: [{ at_ms: 5_000, bounds: { x: 0.45, y: 0.08, width: 0.1, height: 0.12 }, confidence: 0.99 }],
        body_keyframes: [{ at_ms: 5_000, bounds: { x: 0.4, y: 0.4, width: 0.2, height: 0.5 }, confidence: 0.99 }],
      }],
    })
    expect(resolveBrandPlacementForShot(branded, theme, branded.shot_directives[0]!, 'mindmake_only', 0, 200, brandGeometryFor(branded, incompleteTrack)).issues).toContain('shot shot-main subject geometry krish-track is unknown at source time 4000 ms')
    const shot = branded.shot_directives[0]!
    const missingRegion = RenderManifestV2Schema.parse({ ...branded, shot_directives: [{ ...shot, camera_plan: { ...shot.camera_plan, protected_region_ids: ['missing-region'] } }] })
    expect(brandGeometryContextIssues(missingRegion, brandGeometryFor(missingRegion))).toContain('shot shot-main references unknown protected geometry missing-region')
  })

  it('does not add branding to an explicitly unbranded calibration styleframe', () => {
    const { theme, wordmarks } = officialBrandFixture()
    const calibrationProps = manifestToV2RenderProps(manifest(), { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }, { theme, wordmarks, reviewOverlay: 'styleframe' })
    expect(calibrationProps.reviewOverlay).toBe('styleframe')
    expect(calibrationProps.branding).toMatchObject({ mode: 'none', seriesName: '' })
    expect(calibrationProps.branding.wordmarks).toBeUndefined()
    expect(brandLockupRenderModel(calibrationProps.branding)).toBeNull()
  })
})

// Krish, 2026-09-26: "Make your mind up, Mark, plus the channel name", then
// "placement approved": the publication's mark on every beat, and once, at
// the end, its logo with the channel's name. Never an opening title card: a
// Short opens straight on its claim. Krish rejected the first look on
// 2026-09-28 and approved the house style mock the same day ("yes,
// approved"): the mark on an ink tile, captions on an ink block, the
// channel sticker, the call card and the ending band.
function publicationBrandFixture() {
  const registry = TreatmentRegistryV1Schema.parse(studioConfig)
  const candidate = registry.brand_themes.find((theme) => theme.theme_id === 'makeyourmindup-video-v1')
  if (!candidate?.publication?.house_style || !candidate.publication.stacked) throw new Error('the makeyourmindup theme is missing its house style')
  // The committed theme is a candidate with no approval and its control-center
  // commit still pending. This active copy, with a placeholder approval and
  // commit, exercises the path it takes once Krish's approval is captured as
  // Studio feedback on his machine and the commit is recorded.
  const theme = { ...candidate, status: 'active', source: { ...candidate.source, commit: 'c'.repeat(40) }, publication: { ...candidate.publication, approval: { feedback_id: '00000000-0000-4000-8000-000000000000', approved_by: 'Krish', approved_at: '2026-09-28T00:00:00.000Z' } } } as BrandThemeV1
  const lockup = theme.publication!
  return {
    candidate,
    theme,
    wordmarks: {
      mark: { ...lockup.mark, assetFile: `brand-publication-mark-${lockup.mark.sha256.slice(0, 16)}.png` },
      logo: { ...lockup.logo, assetFile: `brand-publication-logo-${lockup.logo.sha256.slice(0, 16)}.png` },
      stacked: { ...lockup.stacked!, assetFile: `brand-publication-stacked-${lockup.stacked!.sha256.slice(0, 16)}.png` },
      lockup,
      channelLabel: 'mind.the.gap',
      channelColor: '#FF6A4D',
      channelCopy: lockup.house_style!.channels.mind_the_gap,
    },
  }
}

const STATEMENT = 'By 30 September 2027, at least two of OpenAI, Anthropic and Google will have their software pick the brain automatically, by default, for businesses that build apps on their AI.'

function liveTwoShotManifest(lateMs = 2_000, series: RenderManifestV2['series'] = 'mind_the_gap', theme: BrandThemeV1 = publicationBrandFixture().theme, extra: Partial<RenderManifestV2> = {}): RenderManifestV2 {
  const base = manifest()
  const shot = base.shot_directives[0]!
  const end = 2_000 + lateMs
  const late = {
    ...shot,
    shot_id: 'shot-late',
    beat_id: 'beat-late',
    start_ms: 2_000,
    end_ms: end,
    source_start_ms: 6_000,
    source_end_ms: 6_000 + lateMs,
    camera_plan: { ...shot.camera_plan, camera_plan_id: 'camera-plan-late', start_ms: 2_000, end_ms: end, keyframes: [{ ...shot.camera_plan.keyframes[0]!, at_ms: 2_000 }, { ...shot.camera_plan.keyframes[1]!, at_ms: end }] },
    layers: shot.layers.map((layer) => ({ ...layer, layer_id: `${layer.layer_id}-late`, ...(layer.kind === 'source' ? { protected: false } : {}) })),
  }
  const publication = theme.publication
  return RenderManifestV2Schema.parse({
    ...base,
    series,
    duration_ms: end,
    shot_directives: [{ ...shot, layers: shot.layers.map((layer) => layer.kind === 'source' ? { ...layer, protected: false } : layer) }, late],
    captions: [...base.captions, { start_ms: 2_000, end_ms: end, text: 'Our call.', emphasis: ['call'] }],
    caption_provenance: { ...base.caption_provenance, source_token_count: 9, caption_token_count: 9 },
    audio_plan: { ...base.audio_plan, dialogue_edits: [{ ...base.audio_plan.dialogue_edits[0]!, output_end_ms: end, source_end_ms: base.audio_plan.dialogue_edits[0]!.source_start_ms + end }] },
    branding: { mode: 'series', theme_id: theme.theme_id, theme_version: theme.version, theme_hash: hashValue(theme), wordmark_hashes: [publication?.mark.sha256 ?? HASH_A, publication?.logo.sha256 ?? HASH_B, ...(publication?.stacked ? [publication.stacked.sha256] : [])] },
    ...extra,
  })
}

// The presenter's face high in frame, as in the mock, and the torso under it.
function clearFaceAnalysis(m: RenderManifestV2, face = { x: 0.45, y: 0.3, width: 0.1, height: 0.08 }): SourceVisualAnalysisV1 {
  const subject = sourceAnalysisFor(m).subjects[0]!
  return sourceAnalysisFor(m, { subjects: [{ ...subject, face_keyframes: [{ at_ms: 0, bounds: face, confidence: 0.99 }, { at_ms: 10_000, bounds: face, confidence: 0.99 }], body_keyframes: [{ at_ms: 0, bounds: { x: 0.35, y: 0.4, width: 0.3, height: 0.6 }, confidence: 0.99 }, { at_ms: 10_000, bounds: { x: 0.35, y: 0.4, width: 0.3, height: 0.6 }, confidence: 0.99 }] }] })
}

function houseProps(m: RenderManifestV2, analysis: SourceVisualAnalysisV1 = clearFaceAnalysis(m)) {
  const { theme, wordmarks } = publicationBrandFixture()
  return manifestToV2RenderProps(m, { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }, { theme, wordmarks, brandGeometry: brandGeometryFor(m, analysis) })
}

const cueAt = (props: ReturnType<typeof houseProps>, atMs: number) => props.shots.flatMap((shot) => shot.brandCues ?? []).find((cue) => cue.startMs <= atMs && cue.endMs > atMs)

describe('makeyourmindup house style', () => {
  it('pins the stacked logo and the house tokens, and stays a candidate', () => {
    const { candidate } = publicationBrandFixture()
    expect(candidate).toMatchObject({ version: 2, status: 'candidate', source: { repository: 'krishanraja/control-center', contract_path: 'src/assets/brand/makeyourmindup/README.md' } })
    // PENDING_CC_COMMIT until the commit that adds the stacked logo reaches
    // control-center main; then that commit.
    expect(candidate.source.commit).toMatch(/^(?:[a-f0-9]{40}|PENDING_CC_COMMIT)$/)
    expect(candidate.publication?.approval).toBeUndefined()
    expect(candidate.typography).toEqual({ display: 'Anton', structure: 'Archivo', dek: 'Fraunces', data: 'IBM Plex Mono' })
    expect(candidate.colors).toMatchObject({ ink: '#0C1512', text: '#F4EFE4', paper: '#F4EFE4', mint: '#7EF0C0', mint_ink: '#0C1512' })
    expect(candidate.publication?.stacked).toMatchObject({ source_path: 'src/assets/brand/makeyourmindup/makeyourmindup-stacked.png', sha256: '5a0e8a08d3ff027feac0e505162318e4095add2466f1096305031d8a1f29a4fc', pixel_width: 2415, pixel_height: 740, alpha_crop: { x: 1, y: 0, width: 2414, height: 740 } })
    expect(candidate.publication?.channel_colors).toEqual({ follow_the_money: '#FFD84D', mind_the_gap: '#FF6A4D', under_the_hood: '#B7A6FF' })
    expect(candidate.publication?.house_style?.tokens).toEqual({ ink: '#0C1512', ink_deep: '#070D0B', ink_soft: '#16221D', cream: '#F4EFE4', mint: '#7EF0C0' })
    expect(candidate.publication?.house_style?.channels).toEqual({
      under_the_hood: { day: 'Mondays', sticker: 'Screwdriver included', promise: 'Free from jargon', question: 'What actually goes together in a shipped thing, and why did this one work?' },
      follow_the_money: { day: 'Wednesdays', sticker: 'Bring a calculator', promise: 'No added sermons', question: 'Where does the money move, and who ends up better or worse off?' },
      mind_the_gap: { day: 'Fridays', sticker: 'The headliner', promise: 'Every call scored in public', question: 'What is the pattern, and what does it mean is coming?' },
    })
    const report = publicationLegibilityReport(candidate)
    expect(report.failures).toEqual([])
    expect(report.logo_letter_height_at_375_css_px).toBeGreaterThanOrEqual(17)
    expect(report.label_cap_height_at_375_css_px).toBeGreaterThanOrEqual(9.5)
    // An active theme can never carry the pending commit.
    expect(BrandThemeV1Schema.safeParse({ ...candidate, status: 'active', source: { ...candidate.source, commit: PENDING_BRAND_SOURCE_COMMIT } }).success).toBe(false)
  })

  it('refuses while a candidate, while its commit is pending, and for a retired series', () => {
    const { candidate, theme } = publicationBrandFixture()
    expect(brandThemeRefusal(candidate, 'mind_the_gap')).toMatch(/is a candidate: it goes live only when Krish's approval is captured/)
    const pending = { ...theme, source: { ...theme.source, commit: PENDING_BRAND_SOURCE_COMMIT } } as BrandThemeV1
    expect(brandThemeRefusal(pending, 'mind_the_gap')).toMatch(/control-center commit that is not recorded yet \(PENDING_CC_COMMIT\)/)
    expect(() => officialWordmarkUrl(pending, pending.publication!.stacked!)).toThrow(/no recorded source commit yet/)
    expect(brandThemeRefusal(theme, 'built_with_ai')).toMatch(/brands only the live subchannels; built_with_ai keeps the theme it was approved under/)
    expect(brandThemeRefusal(theme, 'mind_the_gap')).toBeNull()
    const asCandidate = liveTwoShotManifest(2_000, 'mind_the_gap', candidate)
    expect(resolveBrandTimeline(asCandidate, candidate, brandGeometryFor(asCandidate)).issues[0]).toMatch(/is a candidate/)
    const retired = liveTwoShotManifest(2_000, 'built_with_ai', theme)
    expect(resolveBrandTimeline(retired, theme, brandGeometryFor(retired)).issues[0]).toMatch(/brands only the live subchannels/)
  })

  it('puts the mark tile on every beat and the band once, at the end, for the same moment as before', () => {
    const live = liveTwoShotManifest()
    const props = houseProps(live)
    const house = props.branding.publication?.house
    expect(props.branding.typography).toEqual({ structure: 'Archivo', claim: 'Anton', body: 'Archivo', data: 'IBM Plex Mono' })
    expect(house).toMatchObject({ tokens: { ink: '#0C1512', cream: '#F4EFE4', mint: '#7EF0C0', section: '#FF6A4D' }, day: 'Fridays', promise: 'Every call scored in public', site: 'makeyourmindup.ai', tile: { size: 136, markWidth: 96, shadowPx: 10 }, band: { topPx: 1060, heightPx: 408, logoWidth: 520 } })
    const opening = props.shots.find((shot) => shot.shotId === 'shot-main')!.brandCues!
    const ending = props.shots.find((shot) => shot.shotId === 'shot-late')!.brandCues!
    expect(opening.every((cue) => cue.mode === 'mindmake_only')).toBe(true)
    // The mock's .mark: left 72, top 150 (the fixture's safe zone is 70 and 100).
    expect(houseMarkModel(props.branding, opening[0])).toEqual({ left: 72, top: 150, size: 136, imageWidth: 96, shadow: { px: 10, color: '#FF6A4D' }, background: '#0C1512', grain: true })
    // The ending: the same two seconds at the end the first lockup used.
    expect(ending).toHaveLength(1)
    expect(ending[0]).toMatchObject({ mode: 'stacked_identity', corner: 'band', topPx: 1060, leftPx: 0, startMs: 2_000, endMs: 4_000 })
    expect(houseMarkModel(props.branding, ending[0])).toBeNull()
    const band = houseBandModel(props.branding, ending[0], props.safeZones, 3_000)
    expect(band).toMatchObject({ top: 1060, insets: { left: 72, right: 72 }, logoWidth: 520, day: 'Fridays', site: 'makeyourmindup.ai', pill: { label: 'mind.the.gap', background: '#FF6A4D', color: '#0C1512' }, background: '#0C1512' })
    expect(band!.ticker.items.slice(0, 4)).toEqual(['Every call scored in public', '*', 'Fridays', '*'])
    // Still until the band has arrived, then the ticker moves (and only it).
    expect(houseBandModel(props.branding, ending[0], props.safeZones, 2_200)!.ticker.offsetPx).toBe(0)
    expect(houseBandModel(props.branding, ending[0], props.safeZones, 3_900)!.ticker.offsetPx).toBeGreaterThan(0)
    expect(houseCaptionHidden(props.branding, cueAt(props, 3_000), props.safeZones, 3_000)).toBe(true)
    expect(houseCaptionHidden(props.branding, cueAt(props, 500), props.safeZones, 500)).toBe(false)
    // Wider platform safe zones pull the house elements in.
    const youtube = { topPx: 140, rightPx: 120, bottomPx: 360, leftPx: 80 }
    expect(houseBandModel(props.branding, ending[0], youtube, 3_000)!.insets).toEqual({ left: 80, right: 120 })
    expect(brandLockupRenderModel(props.branding, opening[0])).toBeNull()
  })

  it('sets captions as the mock: an ink block, cream heavy type, one mint swipe and the channel shadow', () => {
    const props = houseProps(liveTwoShotManifest())
    const cue = { startMs: 0, endMs: 1_000, text: 'This changes the outcome, and here is why.', emphasis: ['changes', 'why'] }
    const fallback = { topPx: 100, rightPx: 70, bottomPx: 300, leftPx: 70 }
    const model = houseCaptionModel(props.branding, cue, fallback)
    // The mock's .cap: left 72, right 108, top 1180; at most one loud word.
    expect(model).toMatchObject({ left: 72, top: 1180, width: 900, background: '#0C1512', color: '#F4EFE4', shadow: { px: 12, color: '#FF6A4D' }, swipeIndex: 2 })
    expect(cue.text.split(/(\s+)/)[model!.swipeIndex]).toBe('changes')
    expect(houseSwipeIndex('Two years ago, you chose the flavour.', ['you'])).toBe(6)
    expect(houseSwipeIndex('Nothing loud here.', [])).toBe(-1)
    // Where the director placed the caption layer, it sits there.
    expect(houseCaptionModel(props.branding, cue, fallback, { x: 72 / 1080, y: 1180 / 1920, width: 900 / 1080 })).toMatchObject({ left: 72, top: 1180, width: 900 })
    expect(houseCaptionModel(props.branding, cue, { topPx: 140, rightPx: 120, bottomPx: 360, leftPx: 80 })).toMatchObject({ left: 80, width: 880 })
    expect(houseCaptionModel({ ...props.branding, publication: { ...props.branding.publication!, house: undefined } } as never, cue, fallback)).toBeNull()
  })

  it('puts the channel sticker on the second beat only, and leaves it out where it would cover the face', () => {
    const long = liveTwoShotManifest(4_000)
    const props = houseProps(long)
    expect(props.branding.publication?.house?.sticker).toEqual({ text: 'The headliner', startMs: 2_000, endMs: 4_000 })
    expect(houseStickerModel(props.branding, props.safeZones, 3_000)).toMatchObject({ text: 'The headliner', right: 84, top: 190, rotateDegrees: -6, background: '#FF6A4D' })
    expect(houseStickerModel(props.branding, props.safeZones, 1_000)).toBeNull()
    // The band takes the last two seconds; the sticker never shares them.
    expect(houseStickerModel(props.branding, props.safeZones, 4_500)).toBeNull()
    const faceTopRight = houseProps(long, clearFaceAnalysis(long, { x: 0.62, y: 0.06, width: 0.12, height: 0.1 }))
    expect(faceTopRight.branding.publication?.house?.sticker).toBeUndefined()
  })

  it('draws the call card on the beat the manifest names, in place of the caption', () => {
    const call = { beat_id: 'beat-main', statement: STATEMENT, due: '2027-09-30', confidence_percent: 75 }
    const live = liveTwoShotManifest(2_000, 'mind_the_gap', publicationBrandFixture().theme, { call })
    const props = houseProps(live)
    expect(props.branding.publication?.house?.call).toEqual({ startMs: 0, endMs: 2_000, kicker: 'The call', headline: 'Our call.', statement: STATEMENT, due: '2027-09-30', confidencePercent: 75 })
    const model = houseCallModel(props.branding, props.safeZones, 1_000)
    expect(model).toMatchObject({ left: 72, top: 930, width: 924, kicker: 'The call', headline: 'Our call.', swipeIndex: 2, due: 'Due 2027-09-30', sure: '75% sure' })
    expect(houseCallFrame(STATEMENT, { topPx: 100, rightPx: 70, bottomPx: 300, leftPx: 70 }).lines).toBe(5)
    expect(houseCaptionHidden(props.branding, cueAt(props, 1_000), props.safeZones, 1_000)).toBe(true)
    expect(houseCallModel(props.branding, props.safeZones, 2_500)).toBeNull()
    // Without a call in the manifest there is no card.
    expect(houseProps(liveTwoShotManifest()).branding.publication?.house?.call).toBeUndefined()
    // A call must name a beat a shot carries.
    expect(() => liveTwoShotManifest(2_000, 'mind_the_gap', publicationBrandFixture().theme, { call: { ...call, beat_id: 'beat-missing' } })).toThrow(/the call names a beat no shot carries/)
  })

  it('refuses a call card that would cover the face or run into the platform safe zone', () => {
    const { theme } = publicationBrandFixture()
    const call = { beat_id: 'beat-main', statement: STATEMENT, due: '2027-09-30', confidence_percent: 75 }
    const live = liveTwoShotManifest(2_000, 'mind_the_gap', theme, { call })
    const lowFace = clearFaceAnalysis(live, { x: 0.45, y: 0.49, width: 0.1, height: 0.04 })
    expect(resolveBrandTimeline(live, theme, brandGeometryFor(live, lowFace)).issues.join('; ')).toMatch(/the call card on beat beat-main would cover krish-track:face/)
    const longCall = liveTwoShotManifest(2_000, 'mind_the_gap', theme, { call: { ...call, statement: `${STATEMENT} ${STATEMENT}` } })
    expect(resolveBrandTimeline(longCall, theme, brandGeometryFor(longCall, clearFaceAnalysis(longCall))).issues.join('; ')).toMatch(/runs into the youtube_shorts safe zone at the foot of the frame/)
    const onEnding = liveTwoShotManifest(2_000, 'mind_the_gap', theme, { call: { ...call, beat_id: 'beat-late' } })
    expect(resolveBrandTimeline(onEnding, theme, brandGeometryFor(onEnding, clearFaceAnalysis(onEnding))).issues.join('; ')).toMatch(/would share the screen with the ending band/)
  })

  it('lets the band sit over the torso and keeps it clear of the face', () => {
    const { theme } = publicationBrandFixture()
    const live = liveTwoShotManifest()
    expect(resolveBrandTimeline(live, theme, brandGeometryFor(live, clearFaceAnalysis(live))).issues).toEqual([])
    // The fixture's face sits low in frame, where the band would go.
    const timeline = resolveBrandTimeline(live, theme, brandGeometryFor(live))
    expect(timeline.issues).toEqual(['no ending or late beat can host the publication logo and channel name'])
    // The band replaces the caption, so a caption layer does not block it.
    const band = resolveBrandPlacementForShot(live, theme, live.shot_directives[1]!, 'stacked_identity', 2_000, 4_000, brandGeometryFor(live, clearFaceAnalysis(live)))
    expect(band.placement).toEqual({ mode: 'stacked_identity', corner: 'band', topPx: 1060, leftPx: 0 })
  })

  it('never falls back to an opening title card', () => {
    const { theme } = publicationBrandFixture()
    const short = liveTwoShotManifest(1_000)
    expect(resolveBrandTimeline(short, theme, brandGeometryFor(short, clearFaceAnalysis(short))).issues).toEqual(['no ending or late beat can host the publication logo and channel name'])
  })

  it('keeps the first publication lockup readable for a job that pinned it', () => {
    // A job pinned before the house style keeps its version 1 theme, which
    // parses and hashes as it did and still draws its plate.
    const version1 = structuredClone(publicationBrandFixture().candidate) as unknown as Record<string, any>
    version1.version = 1
    version1.source.commit = 'bb08cc835b8a6ed7a4ebfc307a89adebecf40d26'
    version1.typography = { structure: 'Archivo Variable', claim: 'Newsreader Variable', body: 'Source Serif 4 Variable', data: 'IBM Plex Mono' }
    delete version1.publication.stacked
    delete version1.publication.house_style
    delete version1.publication.anchor.shadow_px
    version1.publication.channel_label.weight = 500
    version1.publication.identity = { mode: 'publication_logo_with_channel', moment: 'ending', duration_ms: 2000, plate_width: 704, plate_height: 220, padding: 32, gap: 20, logo_width: 640, corners: ['bottom_left', 'top_left'] }
    version1.publication.anchor = { mode: 'publication_mark', plate_width: 120, plate_height: 110, padding: 16, mark_width: 88, corners: ['top_left', 'top_right'] }
    version1.publication.minimum_effective.label_cap_height_css_px = 12
    version1.publication.channel_label.size_px = 52
    const parsed = BrandThemeV1Schema.parse(version1)
    expect(hashValue(parsed)).toBe(hashValue(version1))
    const branding = { mode: 'series', seriesName: 'mind.the.gap', colors: {}, typography: {}, publication: { mark: {}, logo: {}, channel: { label: 'mind.the.gap', color: '#FF6A4D', sizePx: 52, weight: 500 }, lockup: { offsetX: 80, offsetY: 140, identity: { durationMs: 2000, plateWidth: 704, plateHeight: 220, padding: 32, gap: 20, logoWidth: 640 }, anchor: { plateWidth: 120, plateHeight: 110, padding: 16, markWidth: 88 } } } } as never
    expect(houseMarkModel(branding, { startMs: 0, endMs: 1, mode: 'mindmake_only', corner: 'top_left', topPx: 140, leftPx: 80 })).toBeNull()
    expect(publicationLockupRenderModel(branding, { startMs: 0, endMs: 1, mode: 'mindmake_only', corner: 'top_left', topPx: 140, leftPx: 80 })).toMatchObject({ identity: false, plate: { width: 120, height: 110 } })
  })
})

describe('retired series render exactly as before', () => {
  // Hashes of the render props at 518b5fe, before the house style.
  it('builds byte-identical props for the Mindmake theme, branded, unbranded and with evidence', () => {
    const { theme, wordmarks } = officialBrandFixture()
    expect(hashValue(theme)).toBe('9d1f8cb1382181e5724482798cad9db099793b3adaf72df5b3a363ef14d27f52')
    const branded = brandableManifest()
    expect(hashValue(manifestToV2RenderProps(branded, { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }, { theme, wordmarks, brandGeometry: brandGeometryFor(branded) }))).toBe('c54839c63056993457a9e150afae5e8a2c2482c0f63e77f29c849f51c89c3060')
    expect(hashValue(manifestToV2RenderProps(manifest(), { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }))).toBe('e79f374e0a6c337a2d9f78ba0b5a3524abf662c112cd663dc2c5473c1ccae5cf')
    expect(hashValue(manifestToV2RenderProps(evidenceManifest('approved'), { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: { 'proof-card': 'asset-proof.png' } }))).toBe('a63973abbeb727ef6ee37f1ddfbc237b4b83501c3262db257a43e6b0bf2b0b08')
  })

  it('draws no house element for a retired theme', () => {
    const { theme, wordmarks } = officialBrandFixture()
    const branded = brandableManifest()
    const props = manifestToV2RenderProps(branded, { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }, { theme, wordmarks, brandGeometry: brandGeometryFor(branded) })
    const cue = props.shots[0]!.brandCues![0]
    expect(props.branding.publication).toBeUndefined()
    expect(houseMarkModel(props.branding, cue)).toBeNull()
    expect(houseBandModel(props.branding, cue, props.safeZones, 0)).toBeNull()
    expect(houseCaptionModel(props.branding, props.captions[0]!, props.safeZones)).toBeNull()
    expect(houseCaptionHidden(props.branding, cue, props.safeZones, 0)).toBe(false)
    expect(brandLockupRenderModel(props.branding, cue)).not.toBeNull()
  })
})
