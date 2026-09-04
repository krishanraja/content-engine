import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import '@fontsource-variable/archivo'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/source-serif-4'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import type { V2RenderProps, V2RuntimeLayer, V2RuntimeShot } from './props'
import { cameraCropAt, defaultLayerBounds, deterministicUnit, primaryAttentionLayerId, sourceStartForShot, transitionOpacity } from './timeline'

const WIDTH = 1080
const HEIGHT = 1920

type RuntimeBranding = V2RenderProps['branding']
type RuntimeSource = V2RenderProps['sources'][number]
type RuntimeAsset = V2RenderProps['assets'][number]

const frameAt = (milliseconds: number, fps: number): number => Math.max(0, Math.round(milliseconds / 1000 * fps))
const framesFor = (milliseconds: number, fps: number): number => Math.max(1, Math.round(milliseconds / 1000 * fps))
const gainFromDb = (gainDb: number): number => 10 ** (gainDb / 20)

function brandFonts(branding: RuntimeBranding) {
  return {
    structure: `"${branding.typography.structure}", Arial, sans-serif`,
    claim: `"${branding.typography.claim}", Georgia, serif`,
    body: `"${branding.typography.body}", Georgia, serif`,
    data: `"${branding.typography.data}", ui-monospace, monospace`,
  }
}

function OfficialWordmark({ asset, displayWidth }: { asset: NonNullable<RuntimeBranding['wordmarks']>['mindmake']; displayWidth: number }) {
  const scale = displayWidth / asset.alphaCrop.width
  return (
    <div style={{ position: 'relative', width: displayWidth, height: asset.alphaCrop.height * scale, overflow: 'hidden' }}>
      <Img
        src={staticFile(asset.assetFile)}
        style={{
          position: 'absolute',
          width: asset.pixelWidth * scale,
          height: asset.pixelHeight * scale,
          left: -asset.alphaCrop.x * scale,
          top: -asset.alphaCrop.y * scale,
          maxWidth: 'none',
        }}
      />
    </div>
  )
}

export function brandLockupRenderModel(branding: RuntimeBranding) {
  if (branding.mode === 'none' || !branding.wordmarks) return null
  const { lockup, mindmake, series } = branding.wordmarks
  return {
    corner: 'top_left' as const,
    plate: {
      count: 1 as const,
      width: lockup.plateSize,
      height: lockup.plateSize,
      top: lockup.offsetY,
      left: lockup.offsetX,
      padding: lockup.padding,
      gap: lockup.gap,
    },
    wordmarks: [
      { role: 'mindmake' as const, asset: mindmake, displayWidth: lockup.mindmakeWidth },
      { role: 'series' as const, asset: series, displayWidth: lockup.seriesWidth },
    ],
  }
}

function BrandLockup({ branding }: { branding: RuntimeBranding }) {
  const model = brandLockupRenderModel(branding)
  if (!model) return null
  return (
    <div style={{ position: 'absolute', zIndex: 900, top: model.plate.top, left: model.plate.left }}>
      <div style={{
        width: model.plate.width,
        height: model.plate.height,
        boxSizing: 'border-box',
        padding: model.plate.padding,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: model.plate.gap,
        overflow: 'hidden',
        borderRadius: 3,
        background: 'rgba(10,16,13,.95)',
        border: `1px solid ${branding.colors.line}`,
        boxShadow: '0 14px 42px rgba(0,0,0,.38)',
      }}>
        {model.wordmarks.map((wordmark) => <OfficialWordmark key={wordmark.role} asset={wordmark.asset} displayWidth={wordmark.displayWidth} />)}
      </div>
    </div>
  )
}

function sourceCropStyle(source: RuntimeSource, shot: V2RuntimeShot, bounds: ReturnType<typeof defaultLayerBounds>, atMs: number, useCamera: boolean): React.CSSProperties {
  const boxWidth = bounds.width * WIDTH
  const boxHeight = bounds.height * HEIGHT
  const crop = useCamera ? cameraCropAt(shot, atMs) : (() => {
    const sourceAspect = source.width / source.height
    const boxAspect = boxWidth / boxHeight
    if (sourceAspect > boxAspect) {
      const width = boxAspect / sourceAspect
      return { x: (1 - width) / 2, y: 0, width, height: 1, rotationDegrees: 0 }
    }
    const height = sourceAspect / boxAspect
    return { x: 0, y: (1 - height) / 2, width: 1, height, rotationDegrees: 0 }
  })()
  const scale = Math.max(boxWidth / (crop.width * source.width), boxHeight / (crop.height * source.height))
  const visibleWidth = crop.width * source.width * scale
  const visibleHeight = crop.height * source.height * scale
  return {
    position: 'absolute',
    width: source.width * scale,
    height: source.height * scale,
    left: (boxWidth - visibleWidth) / 2 - crop.x * source.width * scale,
    top: (boxHeight - visibleHeight) / 2 - crop.y * source.height * scale,
    transform: `rotate(${crop.rotationDegrees}deg)`,
    transformOrigin: `${(crop.x + crop.width / 2) * 100}% ${(crop.y + crop.height / 2) * 100}%`,
  }
}

function AssetTruthLabel({ asset, branding, full }: { asset: RuntimeAsset; branding: RuntimeBranding; full: boolean }) {
  if (asset.truthRole === 'decoration' && !asset.label) return null
  const fonts = brandFonts(branding)
  const role = asset.generated ? 'ILLUSTRATION' : asset.truthRole === 'evidence' ? 'EVIDENCE' : asset.truthRole === 'owned_artifact' ? 'OWNED ARTIFACT' : 'VISUAL'
  const sourceLine = [asset.attribution, asset.sourceDomain].filter(Boolean).join(' · ')
  return (
    <div style={{
      position: 'absolute',
      top: full ? 74 : 18,
      right: full ? 48 : 18,
      maxWidth: full ? 650 : 'calc(100% - 36px)',
      padding: full ? '11px 16px' : '8px 11px',
      background: asset.generated ? branding.colors.amber : branding.colors.mint,
      color: branding.colors.mintInk,
      borderRadius: 2,
      fontFamily: fonts.data,
      fontSize: full ? 23 : 18,
      lineHeight: 1.15,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      boxShadow: '0 8px 24px rgba(0,0,0,.25)',
    }}>
      <div>{role}{asset.label ? ` · ${asset.label}` : ''}</div>
      {sourceLine ? <div style={{ marginTop: 5, fontSize: full ? 19 : 15, letterSpacing: 0.55, textTransform: 'none' }}>{sourceLine}</div> : null}
    </div>
  )
}

function AssetMedia({ asset, fit }: { asset: RuntimeAsset; fit: 'contain' | 'cover' }) {
  const common: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit }
  if (asset.mediaKind === 'video') {
    return <OffthreadVideo src={staticFile(asset.assetFile)} muted style={common} />
  }
  return <Img src={staticFile(asset.assetFile)} style={common} />
}

function AnnotationLayer({ layer, asset, branding }: { layer: V2RuntimeLayer; asset?: RuntimeAsset; branding: RuntimeBranding }) {
  const fonts = brandFonts(branding)
  const label = asset?.label || layer.targetId || 'DETAIL'
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 15, color: branding.colors.text, fontFamily: fonts.data, fontSize: 20, letterSpacing: 1.4, textTransform: 'uppercase' }}>
      <div style={{ width: 76, height: 3, background: branding.colors.mint }} />
      <span style={{ padding: '9px 13px', background: branding.colors.surface, border: `1px solid ${branding.colors.line}` }}>{label}</span>
    </div>
  )
}

function Layer({
  layer,
  shot,
  sources,
  assets,
  branding,
  atMs,
  primary,
  fixedSeed,
}: {
  layer: V2RuntimeLayer
  shot: V2RuntimeShot
  sources: V2RenderProps['sources']
  assets: V2RenderProps['assets']
  branding: RuntimeBranding
  atMs: number
  primary: boolean
  fixedSeed: string
}) {
  if (layer.kind === 'caption' || layer.kind === 'branding') return null
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const bounds = defaultLayerBounds(layer)
  const source = sources.find((item) => item.sourceId === layer.targetId) ?? (layer.kind === 'source' ? sources.find((item) => item.sourceId === shot.sourceId) : undefined)
  const asset = assets.find((item) => item.assetId === layer.targetId)
  const full = layer.anchor === 'full' && !layer.bounds
  const localEntrance = spring({ frame, fps, config: { damping: 22, stiffness: 190, mass: 0.7 }, durationInFrames: Math.max(8, Math.round(fps * 0.42)) })
  const laneMotion = shot.treatmentLane === 'restrained' ? 1 : interpolate(localEntrance, [0, 1], [0.965, 1])
  const random = deterministicUnit(`${fixedSeed}:${shot.shotId}:${layer.layerId}`)
  const rotation = shot.treatmentLane === 'experimental' && !full ? (random - 0.5) * 1.1 * (1 - localEntrance) : 0
  const shotOpacity = transitionOpacity(shot, atMs)
  const secondaryOpacity = primary || layer.kind === 'background' || shot.primaryAttentionTarget.kind === 'none' ? 1 : layer.kind === 'asset' || layer.kind === 'subject_cutout' ? 0.82 : 0.94
  const background = layer.kind === 'background'
  const boxStyle: React.CSSProperties = {
    position: 'absolute',
    left: bounds.x * WIDTH,
    top: bounds.y * HEIGHT,
    width: bounds.width * WIDTH,
    height: bounds.height * HEIGHT,
    zIndex: layer.zIndex,
    opacity: layer.opacity * shotOpacity * secondaryOpacity,
    mixBlendMode: layer.blendMode,
    overflow: layer.kind === 'subject_cutout' && asset ? 'visible' : 'hidden',
    borderRadius: full || background ? 0 : 4,
    background: background ? (layer.zIndex % 2 === 0 ? branding.colors.ink : branding.colors.surface) : asset?.truthRole === 'evidence' ? branding.colors.paper : 'transparent',
    boxShadow: !full && primary ? `0 22px 80px rgba(0,0,0,.44), inset 0 0 0 2px ${branding.colors.mint}` : !full && (asset || source) ? '0 18px 64px rgba(0,0,0,.34)' : undefined,
    transform: `scale(${primary ? laneMotion : 1}) rotate(${rotation}deg)`,
    transformOrigin: 'center',
  }

  if (background) return <div style={boxStyle} />
  if (layer.kind === 'annotation') return <div style={boxStyle}><AnnotationLayer layer={layer} {...(asset ? { asset } : {})} branding={branding} /></div>

  if (asset) {
    const fit = full && (asset.truthRole === 'decoration' || asset.mediaKind === 'video') ? 'cover' : 'contain'
    return (
      <div style={boxStyle}>
        <AssetMedia asset={asset} fit={fit} />
        {asset.truthRole === 'evidence' && full ? <AbsoluteFill style={{ boxShadow: 'inset 0 0 0 1px rgba(10,16,13,.18)' }} /> : null}
        <AssetTruthLabel asset={asset} branding={branding} full={full} />
      </div>
    )
  }

  if (source) {
    const sourceStartMs = sourceStartForShot(shot, source.sourceId, sources)
    return (
      <div style={boxStyle}>
        <OffthreadVideo
          src={staticFile(source.assetFile)}
          muted
          trimBefore={frameAt(sourceStartMs, fps)}
          style={sourceCropStyle(source, shot, bounds, atMs, source.sourceId === shot.sourceId)}
        />
        {full ? <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,16,13,.16) 0%, rgba(10,16,13,0) 32%, rgba(10,16,13,.05) 58%, rgba(10,16,13,.54) 100%)' }} /> : null}
      </div>
    )
  }

  return null
}

function Shot({ shot, props }: { shot: V2RuntimeShot; props: V2RenderProps }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const atMs = shot.startMs + frame / fps * 1000
  const primaryLayer = primaryAttentionLayerId(shot)
  return (
    <AbsoluteFill>
      {[...shot.layers].sort((left, right) => left.zIndex - right.zIndex).map((layer) => (
        <Layer
          key={layer.layerId}
          layer={layer}
          shot={shot}
          sources={props.sources}
          assets={props.assets}
          branding={props.branding}
          atMs={atMs}
          primary={layer.layerId === primaryLayer}
          fixedSeed={props.fixedSeed}
        />
      ))}
    </AbsoluteFill>
  )
}

function Caption({ cue, branding, lane, bounds, safeZones }: { cue: V2RenderProps['captions'][number]; branding: RuntimeBranding; lane: V2RuntimeShot['treatmentLane']; bounds?: ReturnType<typeof defaultLayerBounds>; safeZones: V2RenderProps['safeZones'] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fonts = brandFonts(branding)
  const entrance = lane === 'restrained' ? 1 : spring({ frame, fps, config: { damping: 20, stiffness: 240, mass: 0.55 }, durationInFrames: 8 })
  const emphasis = new Set(cue.emphasis.map((word) => word.toLowerCase()))
  const words = cue.text.split(/(\s+)/)
  const box = bounds ? {
    left: bounds.x * WIDTH,
    top: bounds.y * HEIGHT,
    width: bounds.width * WIDTH,
    height: bounds.height * HEIGHT,
  } : undefined
  return (
    <div style={{
      position: 'absolute',
      ...(box || { left: safeZones.leftPx, right: safeZones.rightPx, bottom: safeZones.bottomPx + 34 }),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        maxWidth: '100%',
        padding: '20px 27px 23px',
        borderRadius: 4,
        background: 'rgba(17,26,22,.94)',
        border: `1px solid ${branding.colors.line}`,
        borderLeft: `6px solid ${branding.colors.mint}`,
        boxShadow: '0 18px 56px rgba(0,0,0,.46)',
        color: branding.colors.text,
        fontFamily: fonts.structure,
        fontSize: lane === 'restrained' ? 61 : 65,
        fontWeight: 760,
        lineHeight: 1.03,
        letterSpacing: '-0.032em',
        textAlign: 'center',
        opacity: entrance,
        transform: `translateY(${interpolate(entrance, [0, 1], [24, 0])}px)`,
        textWrap: 'balance',
      }}>
        {words.map((part, index) => {
          if (/^\s+$/.test(part)) return <React.Fragment key={`space-${index}`}>{part}</React.Fragment>
          const clean = part.replace(/[^a-z0-9]/gi, '').toLowerCase()
          const active = emphasis.has(clean)
          const wordEntrance = lane === 'experimental' ? interpolate(frame - index * 0.55, [0, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1
          return (
            <span key={`${part}-${index}`} style={{
              display: 'inline-block',
              opacity: wordEntrance,
              transform: `translateY(${(1 - wordEntrance) * 9}px)`,
              ...(active ? { color: branding.colors.mintInk, background: branding.colors.mint, borderRadius: 2, padding: '0 7px 3px', margin: '0 1px' } : {}),
            }}>
              {part}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function AudioTimeline({ tracks }: { tracks: V2RenderProps['audioTracks'] }) {
  const { fps } = useVideoConfig()
  return <>{tracks.map((track) => {
    const from = frameAt(track.startMs, fps)
    const duration = track.endMs === undefined ? undefined : framesFor(track.endMs - track.startMs, fps)
    const durationMs = track.endMs === undefined ? undefined : track.endMs - track.startMs
    const baseGain = gainFromDb(track.gainDb)
    return (
      <Sequence key={track.trackId} from={from} {...(duration ? { durationInFrames: duration } : {})}>
        <Audio
          src={staticFile(track.assetFile)}
          trimBefore={frameAt(track.trimBeforeMs, fps)}
          volume={(audioFrame) => {
            const elapsedMs = audioFrame / fps * 1000
            const fadeIn = track.fadeInMs > 0 ? Math.min(1, elapsedMs / track.fadeInMs) : 1
            const fadeOut = durationMs !== undefined && track.fadeOutMs > 0 ? Math.min(1, Math.max(0, durationMs - elapsedMs) / track.fadeOutMs) : 1
            return baseGain * Math.min(fadeIn, fadeOut)
          }}
        />
      </Sequence>
    )
  })}</>
}

function ReviewBadge({ kind, branding }: { kind: V2RenderProps['reviewOverlay']; branding: RuntimeBranding }) {
  if (kind === 'none') return null
  const fonts = brandFonts(branding)
  return (
    <div style={{ position: 'absolute', zIndex: 980, top: 72, right: 48, padding: '10px 14px', color: branding.colors.mintInk, background: branding.colors.amber, borderRadius: 2, fontFamily: fonts.data, fontSize: 18, letterSpacing: 1.4, textTransform: 'uppercase' }}>
      {kind === 'styleframe' ? 'STYLEFRAME REVIEW' : 'ANIMATIC REVIEW'}
    </div>
  )
}

export function MindmakeStoryV2(props: V2RenderProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const atMs = frame / fps * 1000
  const activeShots = props.shots.filter((shot) => shot.startMs <= atMs && shot.endMs > atMs)
  const captionShot = [...activeShots].sort((left, right) => right.startMs - left.startMs)[0]
  const captionLayer = captionShot?.layers.find((layer) => layer.kind === 'caption')
  const captionBounds = captionLayer?.bounds ? defaultLayerBounds(captionLayer) : undefined
  if (props.branding.mode === 'series' && !props.branding.wordmarks) throw new Error('branded V2 renders require staged official Mindmake and series wordmarks')
  return (
    <AbsoluteFill style={{ background: props.branding.colors.ink }}>
      {props.shots.map((shot) => (
        <Sequence key={shot.shotId} from={frameAt(shot.startMs, fps)} durationInFrames={framesFor(shot.endMs - shot.startMs, fps)}>
          <Shot shot={shot} props={props} />
        </Sequence>
      ))}
      <BrandLockup branding={props.branding} />
      {props.captions.map((cue, index) => (
        <Sequence key={`${cue.startMs}-${index}`} from={frameAt(cue.startMs, fps)} durationInFrames={framesFor(cue.endMs - cue.startMs, fps)}>
          <AbsoluteFill>
            <Caption cue={cue} branding={props.branding} lane={captionShot?.treatmentLane || 'restrained'} safeZones={props.safeZones} {...(captionBounds ? { bounds: captionBounds } : {})} />
          </AbsoluteFill>
        </Sequence>
      ))}
      <ReviewBadge kind={props.reviewOverlay} branding={props.branding} />
      <AudioTimeline tracks={props.audioTracks} />
    </AbsoluteFill>
  )
}
