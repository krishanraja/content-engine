import React from 'react'
import { Composition } from 'remotion'
import { MindmakeShort } from './Short'
import { ShortPropsSchema, type ShortProps } from './props'
import { MindmakeStoryV2 } from './v2/MindmakeStory'
import { V2RenderPropsSchema, type V2RenderProps } from './v2/props'
import { MindmakeCarouselSlide } from './carousel/MindmakeCarouselSlide'
import { CarouselRenderPropsSchema, type CarouselRenderProps } from './carousel/props'

const defaultProps: ShortProps = {
  sourceFile: 'placeholder.mp4',
  sourceWidth: 1080,
  sourceHeight: 1920,
  crop: { x: 0, y: 0, width: 1080, height: 1920 },
  cropKeyframes: [],
  hook: 'A precise opening earns attention.',
  treatmentStyle: { caption_position: 'lower', caption_scale: 1, hook_card_ms: 0, proof_motif: 'mechanism', caption_personality: 'clean' },
  durationMs: 30_000,
  seriesName: '',
  accent: '#D7FF3F',
  captions: [],
  evidenceOverlays: [],
}

const v2DefaultProps: V2RenderProps = {
  manifestId: 'v2-placeholder',
  durationMs: 30_000,
  fixedSeed: 'mindmake-v2-placeholder-seed',
  targetPlatform: 'youtube_shorts',
  safeZones: { topPx: 100, rightPx: 70, bottomPx: 300, leftPx: 70 },
  sources: [{ sourceId: 'placeholder-source', assetFile: 'placeholder.mp4', durationMs: 30_000, width: 1080, height: 1920, canonicalOffsetMs: 0 }],
  assets: [],
  shots: [{
    shotId: 'placeholder-shot',
    startMs: 0,
    endMs: 30_000,
    sourceId: 'placeholder-source',
    sourceStartMs: 0,
    sourceEndMs: 30_000,
    primaryAttentionTarget: { kind: 'presenter' },
    treatmentLane: 'restrained',
    camera: {
      keyframes: [{ atMs: 0, crop: { x: 0, y: 0, width: 1, height: 1 }, zoom: 1, rotationDegrees: 0, confidence: 1 }],
      easing: 'hold',
    },
    layers: [{ layerId: 'placeholder-source-layer', zIndex: 0, kind: 'source', targetId: 'placeholder-source', anchor: 'full', opacity: 1, blendMode: 'normal', protected: false }],
    transitionIn: 'none',
    transitionOut: 'none',
  }],
  captions: [],
  audioTracks: [],
  branding: {
    mode: 'none',
    seriesName: '',
    colors: { ink: '#0A100D', surface: '#111A16', raised: '#1E2C26', line: '#22322B', text: '#E6EDE8', secondaryText: '#B0C0B7', mutedText: '#788C82', paper: '#F2F1EA', mint: '#7FE3B4', mintInk: '#07110C', amber: '#E0A44A' },
    typography: { structure: 'Archivo Variable', claim: 'Newsreader Variable', body: 'Source Serif 4 Variable', data: 'IBM Plex Mono' },
  },
  reviewOverlay: 'none',
}

const carouselDefaultProps: CarouselRenderProps = {
  reviewMode: true,
  storyId: 'carousel-placeholder',
  series: 'built_with_ai',
  seriesName: 'Built With AI',
  slideCount: 5,
  slide: { position: 1, role: 'cover', layout: 'cover', scene: 'signal_room', headline: 'A green tick can outlive the thing it checked.', visualItems: [], assetIds: [], accent: 'none' },
  branding: {
    colors: { ink: '#0A100D', surface: '#111A16', raised: '#1E2C26', line: '#22322B', text: '#E6EDE8', secondaryText: '#B0C0B7', mutedText: '#788C82', paper: '#F2F1EA', mint: '#7FE3B4', mintInk: '#07110C', amber: '#E0A44A' },
    typography: { structure: 'Archivo Variable', claim: 'Newsreader Variable', body: 'Source Serif 4 Variable', data: 'IBM Plex Mono' },
    wordmarks: {
      mindmake: { assetFile: 'placeholder.svg', pixelWidth: 648, pixelHeight: 109, alphaCrop: { x: 0, y: 0, width: 648, height: 109 }, letterRegion: { x: 0, y: 0, width: 648, height: 109 } },
      series: { assetFile: 'placeholder.png', pixelWidth: 1200, pixelHeight: 630, alphaCrop: { x: 287, y: 114, width: 626, height: 395 }, letterRegion: { x: 287, y: 452, width: 626, height: 57 } },
    },
    assets: [],
  },
}

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="MindmakeShort"
        component={MindmakeShort}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={900}
        schema={ShortPropsSchema}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.ceil(props.durationMs / 1000 * 30)) })}
      />
      <Composition
        id="MindmakeCarouselSlide"
        component={MindmakeCarouselSlide}
        width={1080}
        height={1350}
        fps={30}
        durationInFrames={1}
        schema={CarouselRenderPropsSchema}
        defaultProps={carouselDefaultProps}
      />
      <Composition
        id="MindmakeStoryV2"
        component={MindmakeStoryV2}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={900}
        schema={V2RenderPropsSchema}
        defaultProps={v2DefaultProps}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.ceil(props.durationMs / 1000 * 30)) })}
      />
    </>
  )
}
