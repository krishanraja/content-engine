import { access, copyFile, cp, mkdir, readFile, unlink } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { bundle } from '@remotion/bundler'
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import {
  PUBLIC_SERIES_NAMES,
  RenderManifestV2Schema,
  TreatmentRegistryV1Schema,
  type BrandThemeV1,
  type RenderManifestV1,
  type RenderManifestV2,
  type TreatmentRegistryV1,
  type VisualAssetV1,
} from '@mindmake/contracts'
import type { V2RenderProps } from '../../../apps/renderer/src/v2/props.js'
import { stageOfficialWordmarks, type StagedBrandWordmarks } from './brand-assets.js'
import { remotionLicenceEligible } from './doctor.js'
import { hashFile, hashPath, hashValue } from './hash.js'
import { loadJobV2, pinnedConfigPathV2 } from './job-store-v2.js'
import { jobPath, studioPaths } from './paths.js'
import { run } from './process.js'

const REMOTION_VERSION = '4.0.518'
const COMPOSITION_ID = 'MindmakeStoryV2'
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm'])
const AUDIO_ONLY_EXTENSIONS = new Set(['.m4a', '.aac', '.wav', '.flac', '.mp3', '.ogg', '.opus'])
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

export type V2RenderProfile = 'preview' | 'animatic' | 'master'
export type V2ReviewOverlay = 'none' | 'styleframe' | 'animatic'

export interface V2RenderOptions {
  profile?: V2RenderProfile
  previewDurationMs?: number
  previewScale?: 0.25 | 0.5 | 1
}

export interface V2StagedMedia {
  sourceFiles: Record<string, string>
  assetFiles: Record<string, string>
}

export interface V2RenderedStyleframe {
  at_ms: number
  image_path: string
  image_hash: string
  phone_preview_path: string
  phone_preview_hash: string
}

const fallbackBranding: V2RenderProps['branding'] = {
  mode: 'none',
  seriesName: '',
  colors: {
    ink: '#0A100D',
    surface: '#111A16',
    raised: '#1E2C26',
    line: '#22322B',
    text: '#E6EDE8',
    secondaryText: '#B0C0B7',
    mutedText: '#788C82',
    paper: '#F2F1EA',
    mint: '#7FE3B4',
    mintInk: '#07110C',
    amber: '#E0A44A',
  },
  typography: {
    structure: 'Archivo Variable',
    claim: 'Newsreader Variable',
    body: 'Source Serif 4 Variable',
    data: 'IBM Plex Mono',
  },
}

const normalizedExtension = (path: string): string => extname(path).toLowerCase()

function supportedVisualAsset(asset: VisualAssetV1): boolean {
  const extension = normalizedExtension(asset.path)
  return asset.media_kind === 'video' ? VIDEO_EXTENSIONS.has(extension) : IMAGE_EXTENSIONS.has(extension)
}

function activeAssetIds(manifest: RenderManifestV2): Set<string> {
  return new Set(manifest.shot_directives.flatMap((shot) => shot.layers.flatMap((layer) => layer.kind === 'asset' || layer.kind === 'subject_cutout' ? layer.target_id ? [layer.target_id] : [] : [])))
}

function activeSourceIds(manifest: RenderManifestV2): Set<string> {
  return new Set(manifest.shot_directives.flatMap((shot) => [shot.source_id, ...shot.layers.flatMap((layer) => layer.kind === 'source' && layer.target_id ? [layer.target_id] : [])]))
}

function captionLineEstimate(text: string): number {
  const explicitLines = text.split(/\r?\n/).length
  const wrappedLines = Math.ceil(text.trim().length / 38)
  return Math.max(explicitLines, wrappedLines)
}

interface NormalizedBounds { x: number; y: number; width: number; height: number }

function boundsOverlap(left: NormalizedBounds, right: NormalizedBounds): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
}

function fallbackBounds(anchor: RenderManifestV2['shot_directives'][number]['layers'][number]['anchor']): NormalizedBounds {
  if (anchor === 'top_left') return { x: 0.045, y: 0.11, width: 0.46, height: 0.38 }
  if (anchor === 'top_right') return { x: 0.495, y: 0.11, width: 0.46, height: 0.38 }
  if (anchor === 'left') return { x: 0.035, y: 0.18, width: 0.47, height: 0.58 }
  if (anchor === 'right') return { x: 0.495, y: 0.18, width: 0.47, height: 0.58 }
  if (anchor === 'center') return { x: 0.065, y: 0.2, width: 0.87, height: 0.52 }
  if (anchor === 'bottom') return { x: 0.055, y: 0.57, width: 0.89, height: 0.27 }
  if (anchor === 'gesture') return { x: 0.51, y: 0.2, width: 0.43, height: 0.42 }
  if (anchor === 'tracked_region') return { x: 0.08, y: 0.18, width: 0.84, height: 0.56 }
  return { x: 0, y: 0, width: 1, height: 1 }
}

export function brandLayerCollisionIssues(manifest: RenderManifestV2, theme: BrandThemeV1): string[] {
  const lockup = theme.wordmarks?.lockup
  if (!lockup || manifest.branding.mode === 'none') return []
  const lockupBounds = { x: lockup.offset_x / 1080, y: lockup.offset_y / 1920, width: lockup.plate_size / 1080, height: lockup.plate_size / 1920 }
  const issues: string[] = []
  for (const shot of manifest.shot_directives) {
    for (const layer of shot.layers) {
      if (['source', 'background', 'branding'].includes(layer.kind) || layer.anchor === 'full') continue
      const bounds = layer.bounds || fallbackBounds(layer.anchor)
      if (boundsOverlap(lockupBounds, bounds)) issues.push(`shot ${shot.shot_id} layer ${layer.layer_id} collides with the approved top-left wordmark lockup`)
    }
  }
  return issues
}

function primaryLayerMatches(manifest: RenderManifestV2, shot: RenderManifestV2['shot_directives'][number]): string[] {
  const target = shot.primary_attention_target
  if (target.kind === 'none' || target.kind === 'negative_space') return []
  if (target.target_id) {
    const exact = shot.layers.filter((layer) => layer.target_id === target.target_id)
    if (exact.length) return exact.map((layer) => layer.layer_id)
  }
  if (target.kind === 'presenter' || target.kind === 'guest') {
    return shot.layers.filter((layer) => (layer.kind === 'source' || layer.kind === 'subject_cutout') && (layer.target_id === shot.source_id || !layer.target_id)).map((layer) => layer.layer_id)
  }
  if (target.kind === 'typography') return shot.layers.filter((layer) => layer.kind === 'caption' || layer.kind === 'annotation').map((layer) => layer.layer_id)
  if (target.kind === 'environment') return shot.layers.filter((layer) => layer.kind === 'source' || layer.kind === 'background').slice(0, 1).map((layer) => layer.layer_id)
  const assets = new Set(manifest.assets.map((asset) => asset.asset_id))
  return shot.layers.filter((layer) => Boolean(layer.target_id && assets.has(layer.target_id))).map((layer) => layer.layer_id)
}

export function validateV2RenderReadiness(manifestInput: RenderManifestV2, reviewOverlay: V2ReviewOverlay = 'none'): string[] {
  const parsed = RenderManifestV2Schema.safeParse(manifestInput)
  if (!parsed.success) return parsed.error.issues.map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`)
  const manifest = parsed.data
  const issues: string[] = []
  const sources = new Map(manifest.sources.map((source) => [source.source_id, source]))
  const assets = new Map(manifest.assets.map((asset) => [asset.asset_id, asset]))
  const referencedAssets = activeAssetIds(manifest)
  const referencedSources = activeSourceIds(manifest)
  const finalLike = reviewOverlay !== 'styleframe'

  let coveredUntil = 0
  for (const shot of [...manifest.shot_directives].sort((left, right) => left.start_ms - right.start_ms || left.end_ms - right.end_ms)) {
    if (shot.start_ms > coveredUntil + 34) issues.push(`shot timeline has an uncovered gap from ${coveredUntil} ms to ${shot.start_ms} ms`)
    coveredUntil = Math.max(coveredUntil, shot.end_ms)
    const primaryMatches = primaryLayerMatches(manifest, shot)
    if (shot.primary_attention_target.kind !== 'none' && shot.primary_attention_target.kind !== 'negative_space' && primaryMatches.length === 0) issues.push(`shot ${shot.shot_id} has no renderable layer for its primary attention target`)
    if (primaryMatches.length > 1) issues.push(`shot ${shot.shot_id} has ${primaryMatches.length} layers competing for primary attention`)
    for (const layer of shot.layers) {
      if (layer.kind === 'source' && (!layer.target_id || !sources.has(layer.target_id))) issues.push(`shot ${shot.shot_id} source layer ${layer.layer_id} references an unknown source`)
      if (layer.kind === 'asset' && (!layer.target_id || !assets.has(layer.target_id))) issues.push(`shot ${shot.shot_id} asset layer ${layer.layer_id} references an unknown asset`)
      if (layer.kind === 'subject_cutout' && (!layer.target_id || !assets.has(layer.target_id))) issues.push(`shot ${shot.shot_id} subject layer ${layer.layer_id} requires a precomposited transparent asset`)
      if (layer.kind === 'caption' && layer.bounds) {
        const safe = manifest.output.safe_zones
        const minimumX = safe.left_px / manifest.output.width
        const maximumX = 1 - safe.right_px / manifest.output.width
        const minimumY = safe.top_px / manifest.output.height
        const maximumY = 1 - safe.bottom_px / manifest.output.height
        if (layer.bounds.x < minimumX || layer.bounds.x + layer.bounds.width > maximumX || layer.bounds.y < minimumY || layer.bounds.y + layer.bounds.height > maximumY) issues.push(`shot ${shot.shot_id} caption layer ${layer.layer_id} leaves the ${manifest.target_platform} safe zone`)
      }
    }
    const source = sources.get(shot.source_id)
    if (source && source.kind !== 'audio') {
      for (const keyframe of shot.camera_plan.keyframes) {
        const effectiveWidth = keyframe.crop.width * source.width
        if (!shot.camera_plan.quality_floor.allow_upscale && effectiveWidth < shot.camera_plan.quality_floor.minimum_effective_width_px) issues.push(`shot ${shot.shot_id} camera keyframe at ${keyframe.at_ms} ms falls below its effective-width quality floor`)
      }
    }
    for (const layer of shot.layers.filter((candidate) => candidate.kind === 'source' && candidate.target_id && candidate.target_id !== shot.source_id)) {
      const secondary = sources.get(layer.target_id!)
      if (source && secondary) {
        const canonicalStartMs = shot.source_start_ms + source.canonical_offset_ms
        const secondaryStartMs = canonicalStartMs - secondary.canonical_offset_ms
        const secondaryEndMs = secondaryStartMs + shot.end_ms - shot.start_ms
        if (secondaryStartMs < 0) issues.push(`shot ${shot.shot_id} begins before secondary source ${secondary.source_id} is available on the canonical timeline`)
        if (secondaryEndMs > secondary.duration_ms) issues.push(`shot ${shot.shot_id} exceeds secondary source ${secondary.source_id}`)
      }
    }
  }
  if (coveredUntil < manifest.duration_ms - 34) issues.push(`shot timeline ends at ${coveredUntil} ms before the ${manifest.duration_ms} ms render duration`)

  for (const assetId of referencedAssets) {
    const asset = assets.get(assetId)
    if (!asset) continue
    if (!supportedVisualAsset(asset)) issues.push(`asset ${assetId} must be a pre-rasterized PNG, JPEG, WebP, MP4, MOV or WebM file`)
    if (asset.rights === 'unverified') issues.push(`asset ${assetId} has unverified rights`)
    if (asset.approval.state === 'rejected') issues.push(`asset ${assetId} was rejected`)
    if (finalLike && asset.approval.state !== 'approved') issues.push(`asset ${assetId} lacks exact Krish approval`)
    if (finalLike && asset.approval.state === 'approved' && asset.approval.artifact_hash !== asset.sha256) issues.push(`asset ${assetId} approval is not bound to its exact file hash`)
  }

  const generatedByHash = new Map(manifest.generated_shots.map((shot) => [shot.output_hash, shot]))
  for (const asset of manifest.assets.filter((item) => referencedAssets.has(item.asset_id) && item.generated)) {
    const generated = generatedByHash.get(asset.sha256)
    if (!generated) issues.push(`generated asset ${asset.asset_id} has no generation ledger entry`)
    else if (finalLike && (generated.exact_approval.state !== 'approved' || generated.exact_approval.output_hash !== generated.output_hash)) issues.push(`generated asset ${asset.asset_id} lacks exact output approval`)
  }

  const sortedCaptions = [...manifest.captions].sort((left, right) => left.start_ms - right.start_ms)
  sortedCaptions.forEach((cue, index) => {
    if (captionLineEstimate(cue.text) > 2 || cue.text.trim().split(/\s+/).length > 13) issues.push(`caption at ${cue.start_ms} ms is too dense for two-line vertical treatment`)
    const previous = sortedCaptions[index - 1]
    if (previous && cue.start_ms < previous.end_ms) issues.push(`captions overlap at ${cue.start_ms} ms`)
  })

  if (reviewOverlay !== 'styleframe') {
    const master = sources.get(manifest.audio_plan.dialogue_master_source_id)
    if (!master) issues.push('dialogue master source is missing')
    else if (!master.audio_hz) issues.push('dialogue master source has no verified audio stream')
  }
  for (const source of manifest.sources.filter((candidate) => candidate.kind === 'audio')) {
    if (!AUDIO_ONLY_EXTENSIONS.has(normalizedExtension(source.path))) issues.push(`audio-only source ${source.source_id} must be M4A, AAC, WAV, FLAC, MP3, OGG or Opus`)
  }
  for (const sourceId of referencedSources) {
    const source = sources.get(sourceId)
    if (source?.kind === 'audio') issues.push(`visual source ${sourceId} cannot be audio-only`)
    else if (source && !VIDEO_EXTENSIONS.has(normalizedExtension(source.path))) issues.push(`visual source ${sourceId} must be MP4, MOV or WebM`)
  }
  return [...new Set(issues)]
}

function runtimeBranding(theme: BrandThemeV1 | undefined, staged: StagedBrandWordmarks | undefined, manifest: RenderManifestV2): V2RenderProps['branding'] {
  if (!theme || manifest.branding.mode === 'none') return fallbackBranding
  if (!staged) throw new Error('official wordmarks were not staged for a branded V2 render')
  return {
    mode: 'series',
    seriesName: PUBLIC_SERIES_NAMES[manifest.series],
    colors: {
      ink: theme.colors.ink,
      surface: theme.colors.surface,
      raised: theme.colors.raised,
      line: theme.colors.line,
      text: theme.colors.text,
      secondaryText: theme.colors.secondary_text,
      mutedText: theme.colors.muted_text,
      paper: theme.colors.paper,
      mint: theme.colors.mint,
      mintInk: theme.colors.mint_ink,
      amber: theme.colors.amber,
    },
    typography: theme.typography,
    wordmarks: {
      mindmake: {
        assetFile: staged.mindmake.assetFile,
        sourcePath: staged.mindmake.source_path,
        sha256: staged.mindmake.sha256,
        pixelWidth: staged.mindmake.pixel_width,
        pixelHeight: staged.mindmake.pixel_height,
        alphaCrop: staged.mindmake.alpha_crop,
      },
      series: {
        assetFile: staged.series.assetFile,
        sourcePath: staged.series.source_path,
        sha256: staged.series.sha256,
        pixelWidth: staged.series.pixel_width,
        pixelHeight: staged.series.pixel_height,
        alphaCrop: staged.series.alpha_crop,
      },
      lockup: {
        plateSize: staged.lockup.plate_size,
        offsetX: staged.lockup.offset_x,
        offsetY: staged.lockup.offset_y,
        padding: staged.lockup.padding,
        gap: staged.lockup.gap,
        mindmakeWidth: staged.lockup.mindmake_width,
        seriesWidth: staged.lockup.series_width,
      },
    },
  }
}

export function manifestToV2RenderProps(
  manifest: RenderManifestV2,
  staged: V2StagedMedia,
  options: { durationMs?: number; reviewOverlay?: V2ReviewOverlay; theme?: BrandThemeV1; wordmarks?: StagedBrandWordmarks } = {},
): V2RenderProps {
  manifest = RenderManifestV2Schema.parse(manifest)
  const durationMs = Math.min(manifest.duration_ms, options.durationMs ?? manifest.duration_ms)
  const sourceFiles = staged.sourceFiles
  const assetFiles = staged.assetFiles
  const audioTracks: V2RenderProps['audioTracks'] = []
  manifest.audio_plan.dialogue_edits.forEach((edit) => {
    const assetFile = sourceFiles[edit.source_id]
    if (!assetFile) throw new Error(`staged dialogue source ${edit.source_id} is missing`)
    if (edit.output_start_ms < durationMs) audioTracks.push({
      trackId: `dialogue-${edit.edit_id}`,
      assetFile,
      startMs: edit.output_start_ms,
      endMs: Math.min(edit.output_end_ms, durationMs),
      trimBeforeMs: edit.source_start_ms,
      gainDb: edit.gain_db,
      fadeInMs: edit.fade_in_ms,
      fadeOutMs: edit.output_end_ms > durationMs ? 0 : edit.fade_out_ms,
    })
  })

  const shots = manifest.shot_directives.filter((shot) => shot.start_ms < durationMs).map((shot) => {
    const endMs = Math.min(shot.end_ms, durationMs)
    let keyframes = shot.camera_plan.keyframes.filter((keyframe) => keyframe.at_ms <= endMs)
    if (!keyframes.length) keyframes = [{ ...shot.camera_plan.keyframes[0]!, at_ms: shot.start_ms }]
    return {
      shotId: shot.shot_id,
      startMs: shot.start_ms,
      endMs,
      sourceId: shot.source_id,
      sourceStartMs: shot.source_start_ms,
      sourceEndMs: Math.min(shot.source_end_ms, shot.source_start_ms + endMs - shot.start_ms),
      primaryAttentionTarget: { kind: shot.primary_attention_target.kind, ...(shot.primary_attention_target.target_id ? { targetId: shot.primary_attention_target.target_id } : {}) },
      treatmentLane: manifest.treatment_lane,
      camera: {
        keyframes: keyframes.map((keyframe) => ({ atMs: keyframe.at_ms, crop: keyframe.crop, zoom: keyframe.zoom, rotationDegrees: keyframe.rotation_degrees, confidence: keyframe.confidence })),
        easing: shot.camera_plan.easing,
      },
      layers: shot.layers.map((layer) => ({
        layerId: layer.layer_id,
        zIndex: layer.z_index,
        kind: layer.kind,
        ...(layer.target_id ? { targetId: layer.target_id } : {}),
        anchor: layer.anchor,
        ...(layer.bounds ? { bounds: layer.bounds } : {}),
        opacity: layer.opacity,
        blendMode: layer.blend_mode,
        protected: layer.protected,
      })),
      transitionIn: shot.transition_in,
      transitionOut: shot.transition_out,
    }
  })

  return {
    manifestId: manifest.manifest_id,
    durationMs,
    fixedSeed: manifest.fixed_seed,
    targetPlatform: manifest.target_platform,
    safeZones: {
      topPx: manifest.output.safe_zones.top_px,
      rightPx: manifest.output.safe_zones.right_px,
      bottomPx: manifest.output.safe_zones.bottom_px,
      leftPx: manifest.output.safe_zones.left_px,
    },
    sources: manifest.sources.filter((source) => source.kind !== 'audio').map((source) => {
      const assetFile = sourceFiles[source.source_id]
      if (!assetFile) throw new Error(`staged visual source ${source.source_id} is missing`)
      return { sourceId: source.source_id, assetFile, durationMs: source.duration_ms, width: source.width, height: source.height, canonicalOffsetMs: source.canonical_offset_ms }
    }),
    assets: manifest.assets.map((asset) => ({
      assetId: asset.asset_id,
      assetFile: assetFiles[asset.asset_id]!,
      mediaKind: asset.media_kind,
      contentKind: asset.content_kind,
      truthRole: asset.truth_role,
      generated: asset.generated,
      ...(asset.label ? { label: asset.label } : {}),
      ...(asset.attribution ? { attribution: asset.attribution } : {}),
      ...(asset.source_url ? { sourceDomain: new URL(asset.source_url).hostname.replace(/^www\./, '') } : {}),
    })),
    shots,
    captions: manifest.captions.filter((cue) => cue.start_ms < durationMs).map((cue) => ({ startMs: cue.start_ms, endMs: Math.min(cue.end_ms, durationMs), text: cue.text, emphasis: cue.emphasis })),
    audioTracks,
    branding: runtimeBranding(options.theme, options.wordmarks, manifest),
    reviewOverlay: options.reviewOverlay ?? 'none',
  }
}

async function stageOne(path: string, expectedHash: string, destination: string): Promise<string> {
  if (await hashFile(path) !== expectedHash) throw new Error(`render input hash mismatch: ${path}`)
  await mkdir(dirname(destination), { recursive: true })
  try {
    await access(destination)
    if (await hashFile(destination) !== expectedHash) throw new Error(`staged render input hash mismatch: ${destination}`)
  } catch (error) {
    if (error instanceof Error && /hash mismatch/.test(error.message)) throw error
    if (resolve(path) !== resolve(destination)) await copyFile(path, destination)
  }
  return basename(destination)
}

function mediaStagingKey(manifest: RenderManifestV2): string {
  return hashValue({
    sources: manifest.sources.map((source) => ({ id: source.source_id, hash: source.sha256, extension: normalizedExtension(source.path) })),
    assets: manifest.assets.map((asset) => ({ id: asset.asset_id, hash: asset.sha256, extension: normalizedExtension(asset.path) })),
    generated: manifest.generated_shots.map((shot) => ({ id: shot.generated_shot_id, hash: shot.output_hash })),
    branding: manifest.branding,
  })
}

async function stageV2Media(manifest: RenderManifestV2): Promise<{ directory: string; staged: V2StagedMedia }> {
  const directory = join(jobPath(manifest.job_id), 'render-staging', mediaStagingKey(manifest).slice(0, 20))
  await mkdir(directory, { recursive: true })
  const sourceFiles: Record<string, string> = {}
  const assetFiles: Record<string, string> = {}
  for (const source of manifest.sources) {
    const extension = normalizedExtension(source.path) || '.bin'
    const destination = join(directory, `source-${source.source_id}-${source.sha256.slice(0, 16)}${extension}`)
    sourceFiles[source.source_id] = await stageOne(source.path, source.sha256, destination)
  }
  for (const asset of manifest.assets) {
    const extension = normalizedExtension(asset.path) || '.bin'
    const destination = join(directory, `asset-${asset.asset_id}-${asset.sha256.slice(0, 16)}${extension}`)
    assetFiles[asset.asset_id] = await stageOne(asset.path, asset.sha256, destination)
  }
  for (const generated of manifest.generated_shots) {
    if (await hashFile(generated.output_path) !== generated.output_hash) throw new Error(`generated output hash mismatch: ${generated.generated_shot_id}`)
  }
  return { directory, staged: { sourceFiles, assetFiles } }
}

export async function loadPinnedRenderRegistryV2(manifest: RenderManifestV2): Promise<TreatmentRegistryV1> {
  const job = await loadJobV2(manifest.job_id)
  if (job.series !== manifest.series) throw new Error('render manifest series differs from its job snapshot')
  if (job.treatment_lane !== manifest.treatment_lane) throw new Error('render manifest treatment lane differs from its job snapshot')
  if (!job.target_platforms.includes(manifest.target_platform)) throw new Error('render manifest platform is outside its job snapshot')
  return TreatmentRegistryV1Schema.parse(JSON.parse(await readFile(pinnedConfigPathV2(job), 'utf8')))
}

async function loadBrandTheme(config: TreatmentRegistryV1, manifest: RenderManifestV2, stagingDirectory: string): Promise<{ theme?: BrandThemeV1; wordmarks?: StagedBrandWordmarks }> {
  if (manifest.branding.mode === 'none') return {}
  const theme = config.brand_themes.find((candidate) => candidate.theme_id === manifest.branding.theme_id)
  if (!theme) throw new Error(`brand theme ${manifest.branding.theme_id || 'missing'} is not available in the job-pinned configuration`)
  if (theme.status !== 'active') throw new Error(`brand theme ${theme.theme_id} is not active`)
  if (theme.version !== manifest.branding.theme_version) throw new Error(`brand theme ${theme.theme_id} version differs from the render manifest`)
  if (hashValue(theme) !== manifest.branding.theme_hash) throw new Error(`brand theme ${theme.theme_id} hash differs from the render manifest`)
  if (!theme.wordmarks?.lockup) throw new Error(`brand theme ${theme.theme_id} has no approved compact wordmark lockup`)
  const requiredWordmarkHashes = [theme.wordmarks.mindmake.sha256, theme.wordmarks.series[manifest.series].sha256].sort()
  const manifestWordmarkHashes = [...manifest.branding.wordmark_hashes].sort()
  if (requiredWordmarkHashes.join(':') !== manifestWordmarkHashes.join(':')) throw new Error('render manifest is not pinned to the exact official Mindmake and series wordmarks')
  const collisionIssues = brandLayerCollisionIssues(manifest, theme)
  if (collisionIssues.length) throw new Error(`brand lockup collision gate failed: ${collisionIssues.join('; ')}`)
  const wordmarks = await stageOfficialWordmarks({ branding: 'series', brand_theme: theme, series: manifest.series } as unknown as RenderManifestV1, stagingDirectory)
  if (!wordmarks) throw new Error('official wordmark staging returned no assets')
  return { theme, wordmarks }
}

export async function rendererImplementationHashV2(repoRoot: string): Promise<string> {
  return hashValue({
    renderer_v2: await hashPath(join(repoRoot, 'apps', 'renderer', 'src', 'v2')),
    renderer_root: await hashFile(join(repoRoot, 'apps', 'renderer', 'src', 'Root.tsx')),
    renderer_runtime: await hashFile(join(repoRoot, 'packages', 'core', 'src', 'render-v2.ts')),
    brand_runtime: await hashFile(join(repoRoot, 'packages', 'core', 'src', 'brand-assets.ts')),
    dependencies: await hashFile(join(repoRoot, 'package-lock.json')),
  })
}

export function renderV2CacheKey(manifest: unknown, profile: string, rendererHash: string, durationMs?: number): string {
  return hashValue({ manifest, profile, renderer_hash: rendererHash, duration_ms: durationMs, audio_normalization: 'loudnorm-two-pass-v2-minus-one-dbtp' })
}

export function loudnormSecondPassFilterV2(stderr: string): string {
  const json = stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0]
  if (!json) throw new Error('FFmpeg loudness measurement did not return JSON')
  const measured = JSON.parse(json) as Record<string, string>
  const fields = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'] as const
  for (const field of fields) if (!Number.isFinite(Number(measured[field]))) throw new Error(`FFmpeg loudness measurement is invalid: ${field}`)
  return [
    'loudnorm=I=-14:TP=-1:LRA=11',
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
    'print_format=summary',
  ].join(':')
}

async function normalizeRenderedAudioV2(inputPath: string, outputPath: string): Promise<void> {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', inputPath, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], { timeoutMs: 600_000 })
  const filter = loudnormSecondPassFilterV2(stderr)
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-map_metadata', '-1', '-c:v', 'copy', '-af', filter, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', outputPath], { timeoutMs: 1_800_000 })
}

async function verifyRenderedAudioV2(path: string): Promise<void> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,duration', '-show_entries', 'format=duration', '-of', 'json', path])
  const parsed = JSON.parse(stdout) as { streams?: Array<{ codec_type?: string; duration?: string }>; format?: { duration?: string } }
  const video = Number(parsed.streams?.find((stream) => stream.codec_type === 'video')?.duration || parsed.format?.duration)
  const audio = Number(parsed.streams?.find((stream) => stream.codec_type === 'audio')?.duration)
  if (!Number.isFinite(video) || !Number.isFinite(audio) || Math.abs(video - audio) > 0.15) throw new Error('V2 rendered audio does not match the video duration')
}

async function sharedBrowserExecutableV2(): Promise<string> {
  const targetDirectory = join(studioPaths().runtimeRoot, 'browser', `remotion-${REMOTION_VERSION}`, 'headless-shell')
  const targetExecutable = join(targetDirectory, 'chrome-headless-shell.exe')
  try { await access(targetExecutable); return targetExecutable } catch { /* Install or reuse the pinned Remotion browser. */ }
  const status = await ensureBrowser({ chromeMode: 'headless-shell', logLevel: 'info' })
  if (status.type !== 'local-puppeteer-browser' && status.type !== 'user-defined-path') throw new Error('Remotion browser could not be installed')
  await mkdir(dirname(targetDirectory), { recursive: true })
  await cp(dirname(status.path), targetDirectory, { recursive: true, force: true })
  const copiedExecutable = join(targetDirectory, basename(status.path))
  await access(copiedExecutable)
  return copiedExecutable
}

function profileSettings(options: V2RenderOptions, manifest: RenderManifestV2): { profile: V2RenderProfile; durationMs: number; scale: 0.25 | 0.5 | 1; crf: number; overlay: V2ReviewOverlay } {
  const profile = options.profile ?? 'master'
  if (profile === 'master') return { profile, durationMs: manifest.duration_ms, scale: 1, crf: 17, overlay: 'none' }
  if (profile === 'animatic') return { profile, durationMs: manifest.duration_ms, scale: options.previewScale ?? 0.25, crf: 28, overlay: 'animatic' }
  return { profile, durationMs: Math.min(manifest.duration_ms, Math.max(1_000, options.previewDurationMs ?? 6_000)), scale: options.previewScale ?? 0.5, crf: 24, overlay: 'none' }
}

export async function renderStoryV2(repoRoot: string, manifestInput: RenderManifestV2, options: V2RenderOptions = {}): Promise<string> {
  const manifest = RenderManifestV2Schema.parse(manifestInput)
  const pinnedRegistry = await loadPinnedRenderRegistryV2(manifest)
  const settings = profileSettings(options, manifest)
  const readinessIssues = validateV2RenderReadiness(manifest, settings.overlay)
  if (readinessIssues.length) throw new Error(`V2 render readiness failed: ${readinessIssues.join('; ')}`)
  if (!await remotionLicenceEligible(repoRoot)) throw new Error('Remotion licence eligibility is not confirmed. Run studio doctor.')
  const rendererHash = await rendererImplementationHashV2(repoRoot)
  const cacheKey = renderV2CacheKey(manifest, settings.profile, rendererHash, settings.durationMs).slice(0, 20)
  const outputDirectory = join(jobPath(manifest.job_id), 'renders', 'v2', manifest.target_platform)
  const outputPath = join(outputDirectory, `${manifest.manifest_id}-${settings.profile}-${cacheKey}.mp4`)
  const rawPath = join(outputDirectory, `${manifest.manifest_id}-${settings.profile}-${cacheKey}.raw.mp4`)
  await mkdir(outputDirectory, { recursive: true })
  try { await access(outputPath); return outputPath } catch { /* Render a missing content-addressed output. */ }

  const { directory: stagingDirectory, staged } = await stageV2Media(manifest)
  const { theme, wordmarks } = await loadBrandTheme(pinnedRegistry, manifest, stagingDirectory)
  const inputProps = manifestToV2RenderProps(manifest, staged, { durationMs: settings.durationMs, reviewOverlay: settings.overlay, ...(theme ? { theme } : {}), ...(wordmarks ? { wordmarks } : {}) })
  const browserExecutable = await sharedBrowserExecutableV2()
  const serveUrl = await bundle({ entryPoint: join(repoRoot, 'apps', 'renderer', 'src', 'index.ts'), publicDir: stagingDirectory })
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable })
  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: rawPath,
      inputProps,
      browserExecutable,
      imageFormat: 'jpeg',
      pixelFormat: 'yuv420p',
      crf: settings.crf,
      scale: settings.scale,
      concurrency: Math.max(1, Math.min(settings.profile === 'master' ? 6 : 4, availableParallelism() - 1)),
      jpegQuality: settings.profile === 'master' ? 92 : 76,
      x264Preset: settings.profile === 'master' ? 'medium' : 'veryfast',
      logLevel: 'info',
    })
    await normalizeRenderedAudioV2(rawPath, outputPath)
    await verifyRenderedAudioV2(outputPath)
  } finally {
    await unlink(rawPath).catch(() => undefined)
  }
  return outputPath
}

export async function renderV2Animatic(repoRoot: string, manifest: RenderManifestV2): Promise<string> {
  return renderStoryV2(repoRoot, manifest, { profile: 'animatic', previewScale: 0.25 })
}

export async function renderV2Styleframes(repoRoot: string, manifestInput: RenderManifestV2, atMs: number[]): Promise<V2RenderedStyleframe[]> {
  const manifest = RenderManifestV2Schema.parse(manifestInput)
  const pinnedRegistry = await loadPinnedRenderRegistryV2(manifest)
  const times = [...new Set(atMs.map((time) => Math.round(time)))].sort((left, right) => left - right)
  if (times.length < 3) throw new Error('styleframe review requires at least three distinct frames')
  if (times.some((time) => time < 0 || time >= manifest.duration_ms)) throw new Error('styleframe time is outside the render duration')
  const readinessIssues = validateV2RenderReadiness(manifest, 'styleframe')
  if (readinessIssues.length) throw new Error(`V2 styleframe readiness failed: ${readinessIssues.join('; ')}`)
  if (!await remotionLicenceEligible(repoRoot)) throw new Error('Remotion licence eligibility is not confirmed. Run studio doctor.')
  const rendererHash = await rendererImplementationHashV2(repoRoot)
  const cacheKey = renderV2CacheKey(manifest, 'styleframes', rendererHash).slice(0, 20)
  const outputDirectory = join(jobPath(manifest.job_id), 'styleframes', cacheKey)
  await mkdir(outputDirectory, { recursive: true })
  const { directory: stagingDirectory, staged } = await stageV2Media(manifest)
  const { theme, wordmarks } = await loadBrandTheme(pinnedRegistry, manifest, stagingDirectory)
  const inputProps = manifestToV2RenderProps(manifest, staged, { reviewOverlay: 'styleframe', ...(theme ? { theme } : {}), ...(wordmarks ? { wordmarks } : {}) })
  const browserExecutable = await sharedBrowserExecutableV2()
  const serveUrl = await bundle({ entryPoint: join(repoRoot, 'apps', 'renderer', 'src', 'index.ts'), publicDir: stagingDirectory })
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable })
  const frames: V2RenderedStyleframe[] = []
  for (const time of times) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(time / 1000 * composition.fps))
    const imagePath = join(outputDirectory, `${String(time).padStart(8, '0')}ms.png`)
    const phonePath = join(outputDirectory, `${String(time).padStart(8, '0')}ms-phone.png`)
    try { await access(imagePath) } catch {
      await renderStill({ composition, serveUrl, output: imagePath, frame, inputProps, browserExecutable, imageFormat: 'png', overwrite: false, scale: 1, logLevel: 'info' })
    }
    try { await access(phonePath) } catch {
      await renderStill({ composition, serveUrl, output: phonePath, frame, inputProps, browserExecutable, imageFormat: 'png', overwrite: false, scale: 1 / 3, logLevel: 'info' })
    }
    frames.push({ at_ms: time, image_path: imagePath, image_hash: await hashFile(imagePath), phone_preview_path: phonePath, phone_preview_hash: await hashFile(phonePath) })
  }
  return frames
}
