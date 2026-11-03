import React from 'react'
import { HOUSE } from '../house/geometry'
import { FWP_SPLIT_CAPTION_ZONE } from './mocks/face-with-proof'
import { Grain } from '../house/components'
import { CallCard } from './chrome/CallCard'
import { EndingBand } from './chrome/EndingBand'
import { CaptionTrack } from './chrome/CaptionTrack'
import { ChannelPill } from './chrome/ChannelPill'
import { MarkTile } from './chrome/MarkTile'
import { StageHeader } from './chrome/StageHeader'
import type { EngineBeat, EngineRenderProps } from './props'

/** The mandatory chrome on every beat (INV-BRANDFRAME, INV-CAPTIONS): mark tile top-left with the channel
 *  shadow, the channel pill on the section beat, the caption track, grain behind. No ILLUSTRATION tag (Krish,
 *  28 Oct 2026: "Yes remove those.").
 *  FormatMaster draws it over every beat; no format can omit it. Built by card ve-card-brandframe. */
export interface BrandFrameProps { props: EngineRenderProps; beat: EngineBeat; frame: number }

export function BrandFrame({ props, beat, frame }: BrandFrameProps): React.ReactElement {
  const call = beat.role === 'call'
  if (call && !props.call) throw new Error('ve: call beat without props.call')
  const ending = !!props.ending && frame >= props.ending.fromFrame
  return <>
    <Grain />
    {/* SPLIT keeps the mark tile and series pill of every face-with-proof beat: the horizontal logo is drawn for ink
        and cannot be read on the cream stage (Krish, 2026-11-03: "We fucking have standards for intro, background
        audio and outro"; the house mark sits at the start of every beat, Krish 2026-09-26). */}
    {beat.layout === 'STAGE' ? <StageHeader props={props} /> : <>
      <MarkTile props={props} />
      <ChannelPill props={props} beat={beat} />
    </>}
    {ending ? <EndingBand props={props} frame={frame} />
      : call ? <CallCard props={props} frame={frame} />
        : beat.layout === 'SPLIT' ? <SplitCaptionTrack props={props} frame={frame} /> : <CaptionTrack props={props} frame={frame} />}
  </>
}

/** Reuse caption timing, word layout and swipe; apply the frozen split frame's compact padding. */
export function SplitCaptionTrack({ props, frame }: { props: EngineRenderProps; frame: number }) {
  const caption = CaptionTrack({ props, frame })
  if (!caption) return null
  const height = Number(caption.props.style.height) - HOUSE.caption.paddingTop - HOUSE.caption.paddingBottom + 20
  if (height > FWP_SPLIT_CAPTION_ZONE.height) throw new Error('ve: SPLIT caption exceeds frozen zone; repaginate')
  return React.cloneElement(caption, { style: {
    ...caption.props.style, ...FWP_SPLIT_CAPTION_ZONE, height,
    padding: `10px ${HOUSE.caption.paddingX}px`,
  } })
}
