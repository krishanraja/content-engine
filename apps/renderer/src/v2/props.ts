import { z } from 'zod'

const NormalizedRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
})

const CameraKeyframeSchema = z.object({
  atMs: z.number().nonnegative(),
  crop: NormalizedRectSchema,
  zoom: z.number().min(1).max(4),
  rotationDegrees: z.number().min(-10).max(10),
  confidence: z.number().min(0).max(1),
})

const RuntimeWordmarkSchema = z.object({
  assetFile: z.string().min(1),
  sourcePath: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  pixelWidth: z.number().positive(),
  pixelHeight: z.number().positive(),
  alphaCrop: z.object({
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  letterRegion: z.object({
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
})

const RuntimeBrandingSchema = z.object({
  mode: z.enum(['series', 'none']),
  seriesName: z.string(),
  colors: z.object({
    ink: z.string(),
    surface: z.string(),
    raised: z.string(),
    line: z.string(),
    text: z.string(),
    secondaryText: z.string(),
    mutedText: z.string(),
    paper: z.string(),
    mint: z.string(),
    mintInk: z.string(),
    amber: z.string(),
  }),
  typography: z.object({
    structure: z.string(),
    claim: z.string(),
    body: z.string(),
    data: z.string(),
  }),
  wordmarks: z.object({
    mindmake: RuntimeWordmarkSchema,
    series: RuntimeWordmarkSchema,
    lockup: z.object({
      offsetX: z.number().nonnegative(),
      offsetY: z.number().nonnegative(),
      identity: z.object({ durationMs: z.number().positive(), plateWidth: z.number().positive(), plateHeight: z.number().positive(), padding: z.number().nonnegative(), gap: z.number().nonnegative(), mindmakeWidth: z.number().positive(), seriesWidth: z.number().positive() }),
      seriesOnly: z.object({ plateWidth: z.number().positive(), plateHeight: z.number().positive(), padding: z.number().nonnegative(), seriesWidth: z.number().positive() }),
      anchor: z.object({ plateWidth: z.number().positive(), plateHeight: z.number().positive(), padding: z.number().nonnegative(), mindmakeWidth: z.number().positive() }),
    }),
  }).optional(),
})

const RuntimeSourceSchema = z.object({
  sourceId: z.string().min(1),
  assetFile: z.string().min(1),
  durationMs: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  canonicalOffsetMs: z.number(),
})

const RuntimeAssetSchema = z.object({
  assetId: z.string().min(1),
  assetFile: z.string().min(1),
  mediaKind: z.enum(['image', 'video', 'document']),
  contentKind: z.string().min(1),
  truthRole: z.enum(['evidence', 'owned_artifact', 'illustration', 'decoration']),
  generated: z.boolean(),
  label: z.string().optional(),
  attribution: z.string().optional(),
  sourceDomain: z.string().optional(),
})

const RuntimeLayerSchema = z.object({
  layerId: z.string().min(1),
  zIndex: z.number().int(),
  kind: z.enum(['source', 'subject_cutout', 'asset', 'caption', 'branding', 'annotation', 'background']),
  targetId: z.string().optional(),
  anchor: z.enum(['full', 'top_left', 'top_right', 'left', 'right', 'center', 'bottom', 'gesture', 'tracked_region']),
  bounds: NormalizedRectSchema.optional(),
  opacity: z.number().min(0).max(1),
  blendMode: z.enum(['normal', 'multiply', 'screen', 'overlay']),
  protected: z.boolean(),
  visibleStartMs: z.number().nonnegative().optional(),
  visibleEndMs: z.number().positive().optional(),
})

const RuntimeShotSchema = z.object({
  shotId: z.string().min(1),
  startMs: z.number().nonnegative(),
  endMs: z.number().positive(),
  sourceId: z.string().min(1),
  sourceStartMs: z.number().nonnegative(),
  sourceEndMs: z.number().positive(),
  primaryAttentionTarget: z.object({
    kind: z.enum(['presenter', 'guest', 'evidence', 'owned_artifact', 'sketch', 'generated_illustration', 'screen', 'environment', 'typography', 'negative_space', 'none']),
    targetId: z.string().optional(),
  }),
  treatmentLane: z.enum(['restrained', 'premium', 'experimental']),
  brandCues: z.array(z.object({
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
    mode: z.enum(['stacked_identity', 'series_only', 'mindmake_only']),
    corner: z.enum(['top_left', 'top_right']),
    topPx: z.number().nonnegative(),
    leftPx: z.number().nonnegative(),
  })).optional(),
  camera: z.object({
    keyframes: z.array(CameraKeyframeSchema).min(1),
    easing: z.enum(['linear', 'ease_in', 'ease_out', 'ease_in_out', 'spring', 'hold']),
  }),
  layers: z.array(RuntimeLayerSchema).min(1),
  transitionIn: z.enum(['cut', 'match_cut', 'smash_cut', 'dissolve', 'fade', 'whip', 'portal', 'none']),
  transitionOut: z.enum(['cut', 'match_cut', 'smash_cut', 'dissolve', 'fade', 'whip', 'portal', 'none']),
})

const RuntimeAudioTrackSchema = z.object({
  trackId: z.string().min(1),
  assetFile: z.string().min(1),
  startMs: z.number().nonnegative(),
  endMs: z.number().positive().optional(),
  trimBeforeMs: z.number().nonnegative(),
  gainDb: z.number().max(0),
  fadeInMs: z.number().nonnegative(),
  fadeOutMs: z.number().nonnegative(),
})

export const V2RenderPropsSchema = z.object({
  manifestId: z.string().min(1),
  durationMs: z.number().positive(),
  fixedSeed: z.string().min(16),
  targetPlatform: z.enum(['youtube_shorts', 'linkedin', 'tiktok', 'instagram_reels']),
  safeZones: z.object({
    topPx: z.number().nonnegative(),
    rightPx: z.number().nonnegative(),
    bottomPx: z.number().nonnegative(),
    leftPx: z.number().nonnegative(),
  }),
  sources: z.array(RuntimeSourceSchema).min(1),
  assets: z.array(RuntimeAssetSchema),
  shots: z.array(RuntimeShotSchema).min(1),
  captions: z.array(z.object({
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
    text: z.string().min(1),
    emphasis: z.array(z.string()),
  })),
  audioTracks: z.array(RuntimeAudioTrackSchema),
  branding: RuntimeBrandingSchema,
  reviewOverlay: z.enum(['none', 'styleframe', 'animatic']),
})

export type V2RenderProps = z.infer<typeof V2RenderPropsSchema>
export type V2RuntimeLayer = V2RenderProps['shots'][number]['layers'][number]
export type V2RuntimeShot = V2RenderProps['shots'][number]
