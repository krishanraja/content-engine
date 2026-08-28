import React from 'react'
import { Composition } from 'remotion'
import { MindmakeShort } from './Short'
import { ShortPropsSchema, type ShortProps } from './props'

const defaultProps: ShortProps = {
  sourceFile: 'placeholder.mp4',
  sourceWidth: 1080,
  sourceHeight: 1920,
  crop: { x: 0, y: 0, width: 1080, height: 1920 },
  cropKeyframes: [],
  hook: 'A precise opening earns attention.',
  treatmentStyle: { caption_position: 'lower', caption_scale: 1, hook_card_ms: 0, proof_motif: 'mechanism' },
  durationMs: 30_000,
  seriesName: 'The Money of AI',
  accent: '#D7FF3F',
  captions: [],
}

export function RemotionRoot() {
  return (
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
  )
}
