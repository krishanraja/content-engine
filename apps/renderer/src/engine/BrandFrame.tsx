import type React from 'react'
import { Grain } from '../house/components'
import { CaptionTrack } from './chrome/CaptionTrack'
import { ChannelPill } from './chrome/ChannelPill'
import { IllustrationLabel } from './chrome/IllustrationLabel'
import { MarkTile } from './chrome/MarkTile'
import type { EngineBeat, EngineRenderProps } from './props'

/** The mandatory chrome on every beat (INV-BRANDFRAME, INV-CAPTIONS): mark tile top-left with the channel
 *  shadow, the channel pill on the section beat, the caption track, grain behind, illustration labels.
 *  FormatMaster draws it over every beat; no format can omit it. Built by card ve-card-brandframe. */
export interface BrandFrameProps { props: EngineRenderProps; beat: EngineBeat; frame: number }

export function BrandFrame({ props, beat, frame }: BrandFrameProps): React.ReactElement {
  return <>
    <Grain />
    <MarkTile props={props} />
    <ChannelPill props={props} beat={beat} />
    <IllustrationLabel props={props} frame={frame} />
    <CaptionTrack props={props} frame={frame} />
  </>
}
