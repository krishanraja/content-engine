import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RenderManifestV2Schema, TreatmentRegistryV1Schema, type BrandThemeV1, type RenderManifestV2 } from '@mindmake/contracts'
import { brandLayerCollisionIssues, createJobV2, hashValue, loadPinnedRenderRegistryV2, loudnormSecondPassFilterV2, manifestToV2RenderProps, renderV2CacheKey, validateV2RenderReadiness } from '@mindmake/core'
import studioConfig from '../config/studio.json'
import { brandLockupRenderModel } from '../apps/renderer/src/v2/MindmakeStory'
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
      mindmake: { ...theme.wordmarks.mindmake, assetFile: `brand-mindmake-${theme.wordmarks.mindmake.sha256.slice(0, 16)}.png` },
      series: { ...series, assetFile: `brand-built_with_ai-${series.sha256.slice(0, 16)}.png` },
      lockup: theme.wordmarks.lockup,
    },
  }
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

  it('blocks a bounded visual from occupying the approved top-left lockup area', () => {
    const base = evidenceManifest('approved')
    const shot = base.shot_directives[0]!
    const branded = RenderManifestV2Schema.parse({
      ...base,
      branding: { mode: 'series', theme_id: 'theme-v1', theme_version: 1, theme_hash: HASH_A, wordmark_hashes: [HASH_A, HASH_B] },
      shot_directives: [{ ...shot, layers: shot.layers.map((layer) => layer.layer_id === 'proof-layer' ? { ...layer, anchor: 'top_left', bounds: { x: 0.04, y: 0.04, width: 0.42, height: 0.34 } } : layer) }],
    })
    const theme = { wordmarks: { lockup: { offset_x: 52, offset_y: 54, plate_size: 250 } } } as unknown as BrandThemeV1
    expect(brandLayerCollisionIssues(branded, theme)).toContain('shot shot-main layer proof-layer collides with the approved top-left wordmark lockup')
  })

  it('carries the exact approved GitHub wordmarks through branded styleframe and render props in one legible stacked top-left plate', () => {
    const { theme, wordmarks } = officialBrandFixture()
    const expectedHashes = [wordmarks.mindmake.sha256, wordmarks.series.sha256].sort()
    const branded = RenderManifestV2Schema.parse({
      ...manifest(),
      branding: { mode: 'series', theme_id: theme.theme_id, theme_version: theme.version, theme_hash: hashValue(theme), wordmark_hashes: expectedHashes },
    })

    for (const reviewOverlay of ['styleframe', 'none'] as const) {
      const props = manifestToV2RenderProps(branded, { sourceFiles: { 'camera-main': 'source-camera.mp4' }, assetFiles: {} }, { theme, wordmarks, reviewOverlay })
      expect(props.reviewOverlay).toBe(reviewOverlay)
      expect(props.branding.mode).toBe('series')
      expect(props.branding.wordmarks?.mindmake).toMatchObject({ sourcePath: 'src/assets/mindmake-wordmark-ink.png', sha256: 'd2a0417df41119775d8f6c5c25134f2414ce2f5144b6e8b5433b2109d95645e1' })
      expect(props.branding.wordmarks?.series).toMatchObject({ sourcePath: 'src/assets/builtwithai-logo-wordmark.png', sha256: '271ab965dc51714be8c13c8a6bb8c7b2b60f4bf22caf51dda5a2928e295fd29f' })
      expect([...branded.branding.wordmark_hashes].sort()).toEqual(expectedHashes)

      const model = brandLockupRenderModel(props.branding)
      expect(model).not.toBeNull()
      expect(model).toMatchObject({ corner: 'top_left', plate: { count: 1, width: 250, height: 250, top: 54, left: 52 }, wordmarks: [{ role: 'mindmake', displayWidth: 180 }, { role: 'series', displayWidth: 210 }] })
      const [mindmake, series] = model!.wordmarks
      const mindmakeHeight = mindmake!.displayWidth * mindmake!.asset.alphaCrop.height / mindmake!.asset.alphaCrop.width
      const seriesHeight = series!.displayWidth * series!.asset.alphaCrop.height / series!.asset.alphaCrop.width
      expect(mindmakeHeight).toBeGreaterThanOrEqual(29)
      expect(seriesHeight).toBeGreaterThanOrEqual(122)
      expect(mindmakeHeight + model!.plate.gap + seriesHeight).toBeLessThanOrEqual(model!.plate.height - model!.plate.padding * 2)
    }
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
