import { access, copyFile, cp, mkdir, readFile, unlink } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { bundle } from '@remotion/bundler'
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import {
  PUBLIC_SERIES_NAMES,
  RenderManifestV2Schema,
  SourceVisualAnalysisV1Schema,
  TreatmentRegistryV1Schema,
  VisualNarrativePlanV1Schema,
  type BrandThemeV1,
  type RenderManifestV1,
  type RenderManifestV2,
  type SourceVisualAnalysisV1,
  type TreatmentRegistryV1,
  type VisualAssetV1,
} from '@mindmake/contracts'
import type { V2RenderProps } from '../../../apps/renderer/src/v2/props.js'
import { brandWordmarkLegibilityReport, officialSeriesMark, stageOfficialWordmarks, type BrandLockupMode, type StagedBrandWordmarks } from './brand-assets.js'
import { remotionLicenceEligible } from './doctor.js'
import { hashFile, hashPath, hashValue } from './hash.js'
import { loadJobV2, pinnedConfigPathV2, readStageArtifactV2 } from './job-store-v2.js'
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
  previewStartMs?: number
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

export interface BrandPlacementV2 {
  mode: BrandLockupMode
  corner: 'top_left' | 'top_right'
  topPx: number
  leftPx: number
}

export interface BrandCueV2 extends BrandPlacementV2 {
  shotId: string
  startMs: number
  endMs: number
}

export interface BrandPlacementResolutionV2 {
  placement?: BrandPlacementV2
  issues: string[]
}

export interface BrandTimelineResolutionV2 {
  cues: BrandCueV2[]
  identity_cue?: BrandCueV2
  issues: string[]
}

export interface BrandGeometryContextV2 {
  analysis: SourceVisualAnalysisV1
  artifactHash: string
  expectedArtifactHash: string
}

function boundsOverlap(left: NormalizedBounds, right: NormalizedBounds): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
}

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))

function cameraEasingProgress(progress: number, easing: RenderManifestV2['shot_directives'][number]['camera_plan']['easing']): number {
  const bounded = clamp(progress, 0, 1)
  if (easing === 'hold') return 0
  if (easing === 'ease_in') return bounded * bounded
  if (easing === 'ease_out') return 1 - (1 - bounded) * (1 - bounded)
  if (easing === 'ease_in_out' || easing === 'spring') return bounded * bounded * (3 - 2 * bounded)
  return bounded
}

function cameraCropAtOutputTime(shot: RenderManifestV2['shot_directives'][number], atMs: number): NormalizedBounds & { rotationDegrees: number } {
  const ordered = shot.camera_plan.keyframes
  const before = [...ordered].reverse().find((keyframe) => keyframe.at_ms <= atMs) ?? ordered[0]!
  const after = ordered.find((keyframe) => keyframe.at_ms >= atMs) ?? ordered.at(-1)!
  const span = after.at_ms - before.at_ms
  const progress = cameraEasingProgress(span <= 0 ? 0 : (atMs - before.at_ms) / span, shot.camera_plan.easing)
  const between = (left: number, right: number) => left + (right - left) * progress
  return {
    x: between(before.crop.x, after.crop.x),
    y: between(before.crop.y, after.crop.y),
    width: between(before.crop.width, after.crop.width),
    height: between(before.crop.height, after.crop.height),
    rotationDegrees: between(before.rotation_degrees, after.rotation_degrees),
  }
}

function cueFrameTimes(shot: RenderManifestV2['shot_directives'][number], fps: number, startMs: number, endMs: number): number[] {
  const times = new Set<number>([startMs, Math.max(startMs, endMs - 0.001)])
  const frameDurationMs = 1000 / fps
  for (let atMs = shot.start_ms; atMs < shot.end_ms; atMs += frameDurationMs) {
    if (atMs >= startMs && atMs < endMs) times.add(atMs)
  }
  for (let frame = Math.ceil(startMs / frameDurationMs); frame * frameDurationMs < endMs; frame += 1) times.add(frame * frameDurationMs)
  return [...times].sort((left, right) => left - right)
}

function interpolateTimedBounds(
  keyframes: SourceVisualAnalysisV1['subjects'][number]['face_keyframes'],
  atMs: number,
): NormalizedBounds | undefined {
  if (!keyframes.length) return undefined
  if (atMs < keyframes[0]!.at_ms || atMs > keyframes.at(-1)!.at_ms) return undefined
  const before = [...keyframes].reverse().find((keyframe) => keyframe.at_ms <= atMs) ?? keyframes[0]!
  const after = keyframes.find((keyframe) => keyframe.at_ms >= atMs) ?? keyframes.at(-1)!
  const span = after.at_ms - before.at_ms
  const progress = clamp(span <= 0 ? 0 : (atMs - before.at_ms) / span, 0, 1)
  const between = (left: number, right: number) => left + (right - left) * progress
  return {
    x: between(before.bounds.x, after.bounds.x),
    y: between(before.bounds.y, after.bounds.y),
    width: between(before.bounds.width, after.bounds.width),
    height: between(before.bounds.height, after.bounds.height),
  }
}

function centeredCoverCrop(sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number): NormalizedBounds & { rotationDegrees: number } {
  const sourceAspect = sourceWidth / sourceHeight
  const boxAspect = boxWidth / boxHeight
  if (sourceAspect > boxAspect) {
    const width = boxAspect / sourceAspect
    return { x: (1 - width) / 2, y: 0, width, height: 1, rotationDegrees: 0 }
  }
  const height = sourceAspect / boxAspect
  return { x: 0, y: (1 - height) / 2, width: 1, height, rotationDegrees: 0 }
}

function projectedSourceBounds(
  sourceBounds: NormalizedBounds,
  crop: NormalizedBounds & { rotationDegrees: number },
  sourceWidth: number,
  sourceHeight: number,
  layerBounds: NormalizedBounds,
  outputWidth: number,
  outputHeight: number,
): NormalizedBounds | undefined {
  const boxWidth = layerBounds.width * outputWidth
  const boxHeight = layerBounds.height * outputHeight
  const scale = Math.max(boxWidth / (crop.width * sourceWidth), boxHeight / (crop.height * sourceHeight))
  const visibleWidth = crop.width * sourceWidth * scale
  const visibleHeight = crop.height * sourceHeight * scale
  const sourceLeft = (boxWidth - visibleWidth) / 2 - crop.x * sourceWidth * scale
  const sourceTop = (boxHeight - visibleHeight) / 2 - crop.y * sourceHeight * scale
  const originX = sourceLeft + (crop.x + crop.width / 2) * sourceWidth * scale
  const originY = sourceTop + (crop.y + crop.height / 2) * sourceHeight * scale
  const radians = crop.rotationDegrees * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const corners = [
    [sourceBounds.x, sourceBounds.y],
    [sourceBounds.x + sourceBounds.width, sourceBounds.y],
    [sourceBounds.x, sourceBounds.y + sourceBounds.height],
    [sourceBounds.x + sourceBounds.width, sourceBounds.y + sourceBounds.height],
  ].map(([x, y]) => {
    const localX = sourceLeft + x! * sourceWidth * scale
    const localY = sourceTop + y! * sourceHeight * scale
    return {
      x: originX + (localX - originX) * cosine - (localY - originY) * sine,
      y: originY + (localX - originX) * sine + (localY - originY) * cosine,
    }
  })
  const minimumX = Math.max(0, Math.min(...corners.map((point) => point.x)))
  const maximumX = Math.min(boxWidth, Math.max(...corners.map((point) => point.x)))
  const minimumY = Math.max(0, Math.min(...corners.map((point) => point.y)))
  const maximumY = Math.min(boxHeight, Math.max(...corners.map((point) => point.y)))
  if (maximumX <= minimumX || maximumY <= minimumY) return undefined
  return {
    x: layerBounds.x + minimumX / outputWidth,
    y: layerBounds.y + minimumY / outputHeight,
    width: (maximumX - minimumX) / outputWidth,
    height: (maximumY - minimumY) / outputHeight,
  }
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

function brandPlateDimensions(theme: BrandThemeV1, mode: BrandLockupMode): { width: number; height: number } {
  const lockup = theme.wordmarks?.lockup
  if (!lockup) return { width: 0, height: 0 }
  if (mode === 'stacked_identity') return { width: lockup.identity.plate_width, height: lockup.identity.plate_height }
  if (mode === 'series_only') return { width: lockup.series_only_fallback.plate_width, height: lockup.series_only_fallback.plate_height }
  return { width: lockup.anchor.plate_width, height: lockup.anchor.plate_height }
}

function placementBounds(manifest: RenderManifestV2, theme: BrandThemeV1, mode: BrandLockupMode, corner: BrandPlacementV2['corner']): { placement: BrandPlacementV2; normalized: NormalizedBounds; insideSafeZone: boolean } {
  const lockup = theme.wordmarks!.lockup!
  const dimensions = brandPlateDimensions(theme, mode)
  const safe = manifest.output.safe_zones
  const topPx = Math.max(lockup.offset_y, safe.top_px)
  const leftPx = corner === 'top_left'
    ? Math.max(lockup.offset_x, safe.left_px)
    : manifest.output.width - Math.max(lockup.offset_x, safe.right_px) - dimensions.width
  const insideSafeZone = leftPx >= safe.left_px
    && leftPx + dimensions.width <= manifest.output.width - safe.right_px
    && topPx >= safe.top_px
    && topPx + dimensions.height <= manifest.output.height - safe.bottom_px
  return {
    placement: { mode, corner, topPx, leftPx },
    normalized: { x: leftPx / manifest.output.width, y: topPx / manifest.output.height, width: dimensions.width / manifest.output.width, height: dimensions.height / manifest.output.height },
    insideSafeZone,
  }
}

function layerVisibleDuring(
  layer: RenderManifestV2['shot_directives'][number]['layers'][number],
  shot: RenderManifestV2['shot_directives'][number],
  startMs: number,
  endMs: number,
): boolean {
  const layerStart = layer.visible_start_ms ?? shot.start_ms
  const layerEnd = layer.visible_end_ms ?? shot.end_ms
  return layer.opacity > 0 && startMs < layerEnd && endMs > layerStart
}

function layerVisibleAt(
  layer: RenderManifestV2['shot_directives'][number]['layers'][number],
  shot: RenderManifestV2['shot_directives'][number],
  atMs: number,
): boolean {
  const layerStart = layer.visible_start_ms ?? shot.start_ms
  const layerEnd = layer.visible_end_ms ?? shot.end_ms
  return layer.opacity > 0 && atMs >= layerStart && atMs < layerEnd
}

function collidingBrandLayers(shot: RenderManifestV2['shot_directives'][number], bounds: NormalizedBounds, startMs: number, endMs: number): string[] {
  return shot.layers.filter((layer) => {
    if (layer.kind === 'branding' || !layerVisibleDuring(layer, shot, startMs, endMs)) return false
    if ((layer.kind === 'source' || layer.kind === 'background') && !layer.protected) return false
    return boundsOverlap(bounds, layer.bounds || fallbackBounds(layer.anchor))
  }).map((layer) => layer.layer_id)
}

export function brandGeometryContextIssues(manifest: RenderManifestV2, context?: BrandGeometryContextV2): string[] {
  if (manifest.branding.mode === 'none') return []
  if (!context) return ['branded rendering requires the exact content-addressed source_analysis artifact']
  const parsed = SourceVisualAnalysisV1Schema.safeParse(context.analysis)
  if (!parsed.success) return ['source_analysis geometry is missing or invalid']
  const analysis = parsed.data
  const issues: string[] = []
  if (!/^[a-f0-9]{64}$/.test(context.artifactHash) || context.artifactHash !== context.expectedArtifactHash) issues.push('source_analysis artifact binding is stale or unknown')
  if (analysis.job_id !== manifest.job_id) issues.push('source_analysis belongs to a different job')
  const analyzedSources = new Map(analysis.sources.map((source) => [source.source_id, source]))
  for (const source of manifest.sources.filter((item) => item.kind !== 'audio')) {
    const analyzed = analyzedSources.get(source.source_id)
    if (!analyzed) {
      issues.push(`source_analysis has no geometry source ${source.source_id}`)
      continue
    }
    if (
      analyzed.source_hash !== source.sha256
      || analyzed.duration_ms !== source.duration_ms
      || analyzed.width !== source.width
      || analyzed.height !== source.height
      || analyzed.fps !== source.fps
      || analyzed.canonical_offset_ms !== source.canonical_offset_ms
    ) issues.push(`source_analysis geometry for ${source.source_id} is stale against the render source`)
  }
  const tracks = new Map(analysis.subjects.map((track) => [track.track_id, track]))
  const regions = new Map<string, SourceVisualAnalysisV1['protected_regions']>()
  for (const region of analysis.protected_regions) regions.set(region.region_id, [...(regions.get(region.region_id) ?? []), region])
  for (const shot of manifest.shot_directives) {
    const referencedTracks = new Set([...shot.subject_track_ids, ...shot.camera_plan.subject_track_ids])
    for (const trackId of referencedTracks) {
      const track = tracks.get(trackId)
      if (!track) issues.push(`shot ${shot.shot_id} references unknown subject geometry ${trackId}`)
      else if (track.source_id !== shot.source_id) issues.push(`shot ${shot.shot_id} subject geometry ${trackId} belongs to a different source`)
      else if (!track.face_keyframes.length && !track.body_keyframes.length) issues.push(`shot ${shot.shot_id} subject geometry ${trackId} has no face or body keyframes`)
    }
    if ((shot.primary_attention_target.kind === 'presenter' || shot.primary_attention_target.kind === 'guest') && !referencedTracks.size) {
      const detected = analysis.subjects.some((track) => track.source_id === shot.source_id && track.start_ms < shot.source_end_ms && track.end_ms > shot.source_start_ms && (track.face_keyframes.length || track.body_keyframes.length))
      if (!detected) issues.push(`shot ${shot.shot_id} has no known visible subject geometry`)
    }
    for (const regionId of shot.camera_plan.protected_region_ids) {
      const matches = regions.get(regionId) ?? []
      if (matches.length !== 1) issues.push(`shot ${shot.shot_id} references unknown protected geometry ${regionId}`)
      else if (matches[0]!.source_id !== shot.source_id) issues.push(`shot ${shot.shot_id} protected geometry ${regionId} belongs to a different source`)
    }
    for (const layer of shot.layers.filter((item) => item.kind === 'source')) {
      const sourceId = layer.target_id ?? shot.source_id
      if (!analyzedSources.has(sourceId)) issues.push(`shot ${shot.shot_id} source layer ${layer.layer_id} has no exact analyzed geometry source`)
    }
  }
  return [...new Set(issues)]
}

function sourceLocalTimeAt(
  manifest: RenderManifestV2,
  shot: RenderManifestV2['shot_directives'][number],
  sourceId: string,
  atMs: number,
): number | undefined {
  const primary = manifest.sources.find((source) => source.source_id === shot.source_id)
  const target = manifest.sources.find((source) => source.source_id === sourceId)
  if (!primary || !target) return undefined
  return shot.source_start_ms + (atMs - shot.start_ms) + primary.canonical_offset_ms - target.canonical_offset_ms
}

function brandAnalysisCollisions(
  manifest: RenderManifestV2,
  shot: RenderManifestV2['shot_directives'][number],
  brandBounds: NormalizedBounds,
  startMs: number,
  endMs: number,
  context: BrandGeometryContextV2,
): { labels: string[]; issues: string[] } {
  const labels = new Set<string>()
  const issues = new Set<string>()
  const analysis = context.analysis
  const analyzedSources = new Map(analysis.sources.map((source) => [source.source_id, source]))
  const manifestSources = new Map(manifest.sources.map((source) => [source.source_id, source]))
  const referencedTrackIds = new Set([...shot.subject_track_ids, ...shot.camera_plan.subject_track_ids])
  const referencedRegions = shot.camera_plan.protected_region_ids.map((regionId) => analysis.protected_regions.find((region) => region.region_id === regionId)!)
  const sourceLayers = shot.layers.filter((layer) => layer.kind === 'source')

  for (const atMs of cueFrameTimes(shot, manifest.output.fps, startMs, endMs)) {
    for (const layer of sourceLayers) {
      if (!layerVisibleAt(layer, shot, atMs)) continue
      const sourceId = layer.target_id ?? shot.source_id
      const source = manifestSources.get(sourceId)
      const analyzedSource = analyzedSources.get(sourceId)
      const sourceTime = sourceLocalTimeAt(manifest, shot, sourceId, atMs)
      if (!source || source.kind === 'audio' || !analyzedSource || sourceTime === undefined) {
        issues.add(`shot ${shot.shot_id} has unknown source geometry at ${Math.round(atMs)} ms`)
        continue
      }
      const layerBounds = layer.bounds || fallbackBounds(layer.anchor)
      const crop = sourceId === shot.source_id
        ? cameraCropAtOutputTime(shot, atMs)
        : centeredCoverCrop(source.width, source.height, layerBounds.width * manifest.output.width, layerBounds.height * manifest.output.height)
      const activeTracks = analysis.subjects.filter((track) => track.source_id === sourceId && sourceTime >= track.start_ms && sourceTime < track.end_ms)
      const expectedTracks = [...referencedTrackIds].map((trackId) => analysis.subjects.find((track) => track.track_id === trackId)).filter((track) => track?.source_id === sourceId)
      for (const track of expectedTracks) {
        if (!track || sourceTime < track.start_ms || sourceTime >= track.end_ms) issues.add(`shot ${shot.shot_id} subject geometry ${track?.track_id ?? 'unknown'} does not cover ${Math.round(sourceTime)} ms`)
      }
      if ((shot.primary_attention_target.kind === 'presenter' || shot.primary_attention_target.kind === 'guest') && sourceId === shot.source_id && !activeTracks.length) {
        issues.add(`shot ${shot.shot_id} has no visible subject geometry at source time ${Math.round(sourceTime)} ms`)
      }
      for (const track of activeTracks) {
        const geometries = [
          ['face', interpolateTimedBounds(track.face_keyframes, sourceTime)] as const,
          ['body', interpolateTimedBounds(track.body_keyframes, sourceTime)] as const,
        ]
        if (!geometries.some(([, bounds]) => bounds)) issues.add(`shot ${shot.shot_id} subject geometry ${track.track_id} is unknown at source time ${Math.round(sourceTime)} ms`)
        for (const [kind, sourceBounds] of geometries) {
          if (!sourceBounds) continue
          const projected = projectedSourceBounds(sourceBounds, crop, source.width, source.height, layerBounds, manifest.output.width, manifest.output.height)
          if (projected && boundsOverlap(brandBounds, projected)) labels.add(`${track.track_id}:${kind}`)
        }
      }
      if (sourceId === shot.source_id) {
        for (const region of referencedRegions) {
          if (!region || sourceTime < region.start_ms || sourceTime >= region.end_ms) continue
          const projected = projectedSourceBounds(region.bounds, crop, source.width, source.height, layerBounds, manifest.output.width, manifest.output.height)
          if (projected && boundsOverlap(brandBounds, projected)) labels.add(region.region_id)
        }
      }
    }
  }
  return { labels: [...labels], issues: [...issues] }
}

export function resolveBrandPlacementForShot(
  manifest: RenderManifestV2,
  theme: BrandThemeV1,
  shot: RenderManifestV2['shot_directives'][number],
  mode: BrandLockupMode = 'mindmake_only',
  startMs = shot.start_ms,
  endMs = shot.end_ms,
  geometryContext?: BrandGeometryContextV2,
): BrandPlacementResolutionV2 {
  if (manifest.branding.mode === 'none') return { issues: [] }
  const geometryIssues = brandGeometryContextIssues(manifest, geometryContext)
  if (geometryIssues.length) return { issues: geometryIssues }
  const lockup = theme.wordmarks?.lockup
  if (!lockup) return { issues: [`shot ${shot.shot_id} cannot place branding because the approved responsive lockup is missing`] }
  const report = brandWordmarkLegibilityReport(theme)
  if (report.failures.length) return { issues: report.failures }
  const authored = shot.layers.filter((layer) => layer.kind === 'branding')
  if (authored.length > 1) return { issues: [`shot ${shot.shot_id} has more than one branding placement directive`] }
  const authoredAnchor = authored[0]?.anchor
  if (authoredAnchor && authoredAnchor !== 'top_left' && authoredAnchor !== 'top_right') return { issues: [`shot ${shot.shot_id} branding placement must use top_left or top_right`] }
  const inferredCorner: BrandPlacementV2['corner'] = shot.camera_plan.lead_room === 'right' ? 'top_right' : 'top_left'
  const preferredCorner = (authoredAnchor || inferredCorner) as BrandPlacementV2['corner']
  const corners = authoredAnchor
    ? [preferredCorner]
    : [preferredCorner, ...lockup.placement.allowed_corners.filter((corner) => corner !== preferredCorner)]
  const modes: BrandLockupMode[] = mode === 'stacked_identity' ? ['stacked_identity', 'series_only'] : [mode]

  for (const candidateMode of modes) {
    for (const corner of corners) {
      const candidate = placementBounds(manifest, theme, candidateMode, corner)
      if (!candidate.insideSafeZone) continue
      const authoredCollisions = collidingBrandLayers(shot, candidate.normalized, startMs, endMs)
      const analysisCollisions = brandAnalysisCollisions(manifest, shot, candidate.normalized, startMs, endMs, geometryContext!)
      if (analysisCollisions.issues.length) return { issues: analysisCollisions.issues }
      if (!authoredCollisions.length && !analysisCollisions.labels.length) return { placement: candidate.placement, issues: [] }
    }
  }
  const collisionLabels = modes.flatMap((candidateMode) => corners.flatMap((corner) => {
    const candidate = placementBounds(manifest, theme, candidateMode, corner)
    return [
      ...collidingBrandLayers(shot, candidate.normalized, startMs, endMs),
      ...brandAnalysisCollisions(manifest, shot, candidate.normalized, startMs, endMs, geometryContext!).labels,
    ]
  }))
  return { issues: [`shot ${shot.shot_id} has no safe, legible wordmark placement${collisionLabels.length ? ` because it collides with ${[...new Set(collisionLabels)].join(', ')}` : ' inside the platform safe zone'}`] }
}

function identityWindows(manifest: RenderManifestV2, durationMs: number): Array<{ shot: RenderManifestV2['shot_directives'][number]; startMs: number; endMs: number }> {
  const shots = [...manifest.shot_directives].sort((left, right) => left.start_ms - right.start_ms || left.end_ms - right.end_ms)
  const first = shots[0]
  const last = shots.at(-1)
  const opening = first && first.end_ms - first.start_ms >= durationMs ? [{ shot: first, startMs: first.start_ms, endMs: first.start_ms + durationMs }] : []
  const ending = last && last.end_ms - last.start_ms >= durationMs ? [{ shot: last, startMs: last.end_ms - durationMs, endMs: last.end_ms }] : []
  const safeBeats = shots.filter((shot) => shot.end_ms - shot.start_ms >= durationMs).map((shot) => ({ shot, startMs: shot.start_ms, endMs: shot.start_ms + durationMs }))
  const ordered = [...opening, ...ending, ...safeBeats]
  const seen = new Set<string>()
  return ordered.filter((item) => {
    const key = `${item.shot.shot_id}:${item.startMs}:${item.endMs}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function resolveBrandTimeline(manifest: RenderManifestV2, theme: BrandThemeV1, geometryContext?: BrandGeometryContextV2): BrandTimelineResolutionV2 {
  if (manifest.branding.mode === 'none') return { cues: [], issues: [] }
  const geometryIssues = brandGeometryContextIssues(manifest, geometryContext)
  if (geometryIssues.length) return { cues: [], issues: geometryIssues }
  const lockup = theme.wordmarks?.lockup
  if (!lockup) return { cues: [], issues: ['approved responsive wordmark lockup is missing'] }
  const report = brandWordmarkLegibilityReport(theme)
  if (report.failures.length) return { cues: [], issues: report.failures }
  const preferredIdentityMode = report.recommended_identity_mode[manifest.series]
  if (!preferredIdentityMode) return { cues: [], issues: [`${manifest.series} has no approved official wordmark yet; a branded render needs one pinned in studio.json`] }
  let identityCue: BrandCueV2 | undefined
  for (const window of identityWindows(manifest, lockup.identity.duration_ms)) {
    const resolved = resolveBrandPlacementForShot(manifest, theme, window.shot, preferredIdentityMode, window.startMs, window.endMs, geometryContext)
    if (resolved.placement) {
      identityCue = { ...resolved.placement, shotId: window.shot.shot_id, startMs: window.startMs, endMs: window.endMs }
      break
    }
  }
  if (!identityCue) return { cues: [], issues: ['no opening, ending, or safe beat can host the required phone-legible series identity moment'] }

  const cues: BrandCueV2[] = [identityCue]
  const issues: string[] = []
  for (const shot of manifest.shot_directives) {
    const intervals: Array<{ startMs: number; endMs: number }> = identityCue.shotId !== shot.shot_id
      ? [{ startMs: shot.start_ms, endMs: shot.end_ms }]
      : [
          { startMs: shot.start_ms, endMs: identityCue.startMs },
          { startMs: identityCue.endMs, endMs: shot.end_ms },
        ].filter((interval) => interval.endMs > interval.startMs)
    for (const interval of intervals) {
      const resolved = resolveBrandPlacementForShot(manifest, theme, shot, 'mindmake_only', interval.startMs, interval.endMs, geometryContext)
      if (!resolved.placement) issues.push(...resolved.issues)
      else cues.push({ ...resolved.placement, shotId: shot.shot_id, ...interval })
    }
  }
  return { cues: cues.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs), identity_cue: identityCue, issues: [...new Set(issues)] }
}

export function brandLayerCollisionIssues(manifest: RenderManifestV2, theme: BrandThemeV1, geometryContext?: BrandGeometryContextV2): string[] {
  if (manifest.branding.mode === 'none') return []
  return resolveBrandTimeline(manifest, theme, geometryContext).issues
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
  if (manifest.branding.mode === 'none') return fallbackBranding
  if (!theme) throw new Error('branded V2 renders require their exact job-pinned brand theme')
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
        letterRegion: staged.mindmake.letter_region,
      },
      series: {
        assetFile: staged.series.assetFile,
        sourcePath: staged.series.source_path,
        sha256: staged.series.sha256,
        pixelWidth: staged.series.pixel_width,
        pixelHeight: staged.series.pixel_height,
        alphaCrop: staged.series.alpha_crop,
        letterRegion: staged.series.letter_region,
      },
      lockup: {
        offsetX: staged.lockup.offset_x,
        offsetY: staged.lockup.offset_y,
        identity: {
          durationMs: staged.lockup.identity.duration_ms,
          plateWidth: staged.lockup.identity.plate_width,
          plateHeight: staged.lockup.identity.plate_height,
          padding: staged.lockup.identity.padding,
          gap: staged.lockup.identity.gap,
          mindmakeWidth: staged.lockup.identity.mindmake_width,
          seriesWidth: staged.lockup.identity.series_width,
        },
        seriesOnly: {
          plateWidth: staged.lockup.series_only_fallback.plate_width,
          plateHeight: staged.lockup.series_only_fallback.plate_height,
          padding: staged.lockup.series_only_fallback.padding,
          seriesWidth: staged.lockup.series_only_fallback.series_width,
        },
        anchor: {
          plateWidth: staged.lockup.anchor.plate_width,
          plateHeight: staged.lockup.anchor.plate_height,
          padding: staged.lockup.anchor.padding,
          mindmakeWidth: staged.lockup.anchor.mindmake_width,
        },
      },
    },
  }
}

export function manifestToV2RenderProps(
  manifest: RenderManifestV2,
  staged: V2StagedMedia,
  options: { durationMs?: number; reviewOverlay?: V2ReviewOverlay; theme?: BrandThemeV1; wordmarks?: StagedBrandWordmarks; brandGeometry?: BrandGeometryContextV2 } = {},
): V2RenderProps {
  manifest = RenderManifestV2Schema.parse(manifest)
  const durationMs = Math.min(manifest.duration_ms, options.durationMs ?? manifest.duration_ms)
  const sourceFiles = staged.sourceFiles
  const assetFiles = staged.assetFiles
  const brandGeometryIssues = brandGeometryContextIssues(manifest, options.brandGeometry)
  if (brandGeometryIssues.length) throw new Error(`brand geometry gate failed: ${brandGeometryIssues.join('; ')}`)
  const brandTimeline = options.theme && manifest.branding.mode === 'series' ? resolveBrandTimeline(manifest, options.theme, options.brandGeometry) : undefined
  if (brandTimeline?.issues.length) throw new Error(`brand lockup placement gate failed: ${brandTimeline.issues.join('; ')}`)
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
    const brandCues = brandTimeline?.cues.filter((cue) => cue.shotId === shot.shot_id && cue.startMs < endMs).map((cue) => ({
      startMs: cue.startMs,
      endMs: Math.min(cue.endMs, endMs),
      mode: cue.mode,
      corner: cue.corner,
      topPx: cue.topPx,
      leftPx: cue.leftPx,
    })).filter((cue) => cue.endMs > cue.startMs)
    return {
      shotId: shot.shot_id,
      startMs: shot.start_ms,
      endMs,
      sourceId: shot.source_id,
      sourceStartMs: shot.source_start_ms,
      sourceEndMs: Math.min(shot.source_end_ms, shot.source_start_ms + endMs - shot.start_ms),
      primaryAttentionTarget: { kind: shot.primary_attention_target.kind, ...(shot.primary_attention_target.target_id ? { targetId: shot.primary_attention_target.target_id } : {}) },
      treatmentLane: manifest.treatment_lane,
      ...(brandCues?.length ? { brandCues } : {}),
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
        ...(layer.tracking_keyframes ? { trackingKeyframes: layer.tracking_keyframes.map((keyframe) => ({ atMs: keyframe.at_ms, bounds: keyframe.bounds, confidence: keyframe.confidence })) } : {}),
        opacity: layer.opacity,
        blendMode: layer.blend_mode,
        protected: layer.protected,
        ...(layer.visible_start_ms === undefined ? {} : { visibleStartMs: layer.visible_start_ms }),
        ...(layer.visible_end_ms === undefined ? {} : { visibleEndMs: layer.visible_end_ms }),
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

export async function loadExactBrandGeometryContextV2(manifest: RenderManifestV2): Promise<BrandGeometryContextV2 | undefined> {
  if (manifest.branding.mode === 'none') return undefined
  const job = await loadJobV2(manifest.job_id)
  if (!job.source_bundle) throw new Error('branded rendering requires a current source bundle')
  const visualPlanArtifact = await readStageArtifactV2(manifest.job_id, 'visual_plan')
  if (visualPlanArtifact.artifact_hash !== manifest.visual_plan_artifact_hash) throw new Error('render manifest is not bound to the exact current visual_plan artifact')
  const visualPlan = VisualNarrativePlanV1Schema.parse(visualPlanArtifact.payload)
  if (visualPlan.job_id !== manifest.job_id) throw new Error('current visual_plan belongs to a different job')
  const sourceAnalysisArtifact = await readStageArtifactV2(manifest.job_id, 'source_analysis')
  if (visualPlan.source_analysis_artifact_hash !== sourceAnalysisArtifact.artifact_hash) throw new Error('current visual_plan is not bound to the exact current source_analysis artifact')
  const analysis = SourceVisualAnalysisV1Schema.parse(sourceAnalysisArtifact.payload)
  if (analysis.source_bundle_hash !== hashValue(job.source_bundle)) throw new Error('source_analysis is stale against the current source bundle')
  const context = {
    analysis,
    artifactHash: sourceAnalysisArtifact.artifact_hash,
    expectedArtifactHash: visualPlan.source_analysis_artifact_hash,
  }
  const issues = brandGeometryContextIssues(manifest, context)
  if (issues.length) throw new Error(`brand geometry gate failed: ${issues.join('; ')}`)
  return context
}

async function loadBrandTheme(
  config: TreatmentRegistryV1,
  manifest: RenderManifestV2,
  stagingDirectory: string,
  brandGeometry?: BrandGeometryContextV2,
): Promise<{ theme?: BrandThemeV1; wordmarks?: StagedBrandWordmarks }> {
  if (manifest.branding.mode === 'none') return {}
  const theme = config.brand_themes.find((candidate) => candidate.theme_id === manifest.branding.theme_id)
  if (!theme) throw new Error(`brand theme ${manifest.branding.theme_id || 'missing'} is not available in the job-pinned configuration`)
  if (theme.status !== 'active') throw new Error(`brand theme ${theme.theme_id} is not active`)
  if (theme.version !== manifest.branding.theme_version) throw new Error(`brand theme ${theme.theme_id} version differs from the render manifest`)
  if (hashValue(theme) !== manifest.branding.theme_hash) throw new Error(`brand theme ${theme.theme_id} hash differs from the render manifest`)
  if (!theme.wordmarks?.lockup) throw new Error(`brand theme ${theme.theme_id} has no approved compact wordmark lockup`)
  const requiredWordmarkHashes = [theme.wordmarks.mindmake.sha256, officialSeriesMark(theme, manifest.series).sha256].sort()
  const manifestWordmarkHashes = [...manifest.branding.wordmark_hashes].sort()
  if (requiredWordmarkHashes.join(':') !== manifestWordmarkHashes.join(':')) throw new Error('render manifest is not pinned to the exact official Mindmake and series wordmarks')
  const collisionIssues = brandLayerCollisionIssues(manifest, theme, brandGeometry)
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

export function renderV2CacheKey(manifest: unknown, profile: string, rendererHash: string, durationMs?: number, startMs?: number, sourceAnalysisArtifactHash?: string): string {
  return hashValue({ manifest, profile, renderer_hash: rendererHash, duration_ms: durationMs, start_ms: startMs, source_analysis_artifact_hash: sourceAnalysisArtifactHash ?? null, audio_normalization: 'loudnorm-two-pass-v2-minus-one-dbtp' })
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

function profileSettings(options: V2RenderOptions, manifest: RenderManifestV2): { profile: V2RenderProfile; startMs: number; durationMs: number; scale: 0.25 | 0.5 | 1; crf: number; overlay: V2ReviewOverlay } {
  const profile = options.profile ?? 'master'
  if (profile === 'master') return { profile, startMs: 0, durationMs: manifest.duration_ms, scale: 1, crf: 17, overlay: 'none' }
  if (profile === 'animatic') return { profile, startMs: 0, durationMs: manifest.duration_ms, scale: options.previewScale ?? 0.25, crf: 28, overlay: 'animatic' }
  const requestedStart = Math.max(0, Math.floor(options.previewStartMs ?? 0))
  const startMs = Math.min(requestedStart, Math.max(0, manifest.duration_ms - 1_000))
  const previewDuration = Math.max(1_000, Math.floor(options.previewDurationMs ?? 6_000))
  return { profile, startMs, durationMs: Math.min(manifest.duration_ms, startMs + previewDuration), scale: options.previewScale ?? 0.5, crf: 24, overlay: 'none' }
}

export async function renderStoryV2(repoRoot: string, manifestInput: RenderManifestV2, options: V2RenderOptions = {}): Promise<string> {
  const manifest = RenderManifestV2Schema.parse(manifestInput)
  const pinnedRegistry = await loadPinnedRenderRegistryV2(manifest)
  const settings = profileSettings(options, manifest)
  const readinessIssues = validateV2RenderReadiness(manifest, settings.overlay)
  if (readinessIssues.length) throw new Error(`V2 render readiness failed: ${readinessIssues.join('; ')}`)
  const brandGeometry = await loadExactBrandGeometryContextV2(manifest)
  if (!await remotionLicenceEligible(repoRoot)) throw new Error('Remotion licence eligibility is not confirmed. Run studio doctor.')
  const rendererHash = await rendererImplementationHashV2(repoRoot)
  const cacheKey = renderV2CacheKey(manifest, settings.profile, rendererHash, settings.durationMs, settings.startMs, brandGeometry?.artifactHash).slice(0, 20)
  const outputDirectory = join(jobPath(manifest.job_id), 'renders', 'v2', manifest.target_platform)
  const outputPath = join(outputDirectory, `${manifest.manifest_id}-${settings.profile}-${cacheKey}.mp4`)
  const rawPath = join(outputDirectory, `${manifest.manifest_id}-${settings.profile}-${cacheKey}.raw.mp4`)
  await mkdir(outputDirectory, { recursive: true })
  try { await access(outputPath); return outputPath } catch { /* Render a missing content-addressed output. */ }

  const { directory: stagingDirectory, staged } = await stageV2Media(manifest)
  const { theme, wordmarks } = await loadBrandTheme(pinnedRegistry, manifest, stagingDirectory, brandGeometry)
  const inputProps = manifestToV2RenderProps(manifest, staged, { durationMs: settings.durationMs, reviewOverlay: settings.overlay, ...(theme ? { theme } : {}), ...(wordmarks ? { wordmarks } : {}), ...(brandGeometry ? { brandGeometry } : {}) })
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
      ...(settings.startMs > 0 ? {
        frameRange: [
          Math.floor(settings.startMs * composition.fps / 1000),
          Math.max(Math.floor(settings.startMs * composition.fps / 1000), Math.ceil(settings.durationMs * composition.fps / 1000) - 1),
        ] as [number, number],
      } : {}),
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
  const brandGeometry = await loadExactBrandGeometryContextV2(manifest)
  if (!await remotionLicenceEligible(repoRoot)) throw new Error('Remotion licence eligibility is not confirmed. Run studio doctor.')
  const rendererHash = await rendererImplementationHashV2(repoRoot)
  const cacheKey = renderV2CacheKey(manifest, 'styleframes', rendererHash, undefined, undefined, brandGeometry?.artifactHash).slice(0, 20)
  const outputDirectory = join(jobPath(manifest.job_id), 'styleframes', cacheKey)
  await mkdir(outputDirectory, { recursive: true })
  const { directory: stagingDirectory, staged } = await stageV2Media(manifest)
  const { theme, wordmarks } = await loadBrandTheme(pinnedRegistry, manifest, stagingDirectory, brandGeometry)
  const inputProps = manifestToV2RenderProps(manifest, staged, { reviewOverlay: 'styleframe', ...(theme ? { theme } : {}), ...(wordmarks ? { wordmarks } : {}), ...(brandGeometry ? { brandGeometry } : {}) })
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
