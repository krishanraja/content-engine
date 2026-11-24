import { isStaging } from './kit/staging'
import React from 'react'
import { HOUSE } from '../house/geometry'
import { SPLIT_CAPTION_ZONE } from './layouts/splitGeometry'
import { Grain } from '../house/components'
import { LandingCard, landingBeatAt } from './chrome/LandingCard'
import { WhyStep } from './chrome/WhyStep'
import { EndingBand } from './chrome/EndingBand'
import { CaptionTrack } from './chrome/CaptionTrack'
import { ChannelPill } from './chrome/ChannelPill'
import { MarkTile } from './chrome/MarkTile'
import { StageHeader } from './chrome/StageHeader'
import { lightStage } from './chrome/lightStage'
import { HeldTitle, WordCaption } from './chrome/WordCaption'
import { LeadCaption } from './chrome/LeadCaption'
import { ThemedCaption } from './chrome/ThemedCaption'
import { resolveMotion } from './kit/motionProfiles'
import type { EngineBeat, EngineRenderProps } from './props'

/** The mandatory chrome on every beat (INV-BRANDFRAME, INV-CAPTIONS): on the wide cut only, mark tile top-left with
 *  the channel shadow and the channel pill on the section beat (none on 9:16, Krish 2026-11-11); the caption track, grain behind. No ILLUSTRATION tag (Krish,
 *  28 Oct 2026: "Yes remove those.").
 *  FormatMaster draws it over every beat; no format can omit it. Built by card ve-card-brandframe. */
export interface BrandFrameProps { props: EngineRenderProps; beat: EngineBeat; frame: number }

export function BrandFrame({ props, beat, frame }: BrandFrameProps): React.ReactElement {
  // The landing card on the landing beat that carries the ladder's landing; a landing beat without one is a closing
  // beat like any other (Ruling, Krish, 2026-11-24: "the signature format is the 5 Whys").
  const landing = beat.role === 'landing' && !!beat.landing && !!landingBeatAt(props, frame)
  const ending = !!props.ending && frame >= props.ending.fromFrame
  // vertical-captions: lead captions replace the house captions for that style only.
  const lead = resolveMotion(props.motion)?.captions
  // His brand marks keep the house colours when the cut is drawn in a style's own palette (props.brandTokens).
  const house = props.brandTokens ? { ...props, tokens: props.brandTokens } : props
  const chrome = ending ? <EndingBand props={house} frame={frame} />
    : landing ? <LandingCard props={house} frame={frame} />
      : props.captionTheme ? (onFullPlate(props, beat) || props.captionTheme === 'rack-focus' || overTake(beat)
        ? <div data-caption-halo style={{ position: 'absolute', inset: 0, filter: onFullPlate(props, beat) ? CAPTION_HALO : TAKE_HALO }}><ThemedCaption props={props} theme={props.captionTheme} frame={frame} /></div>
        : <ThemedCaption props={props} theme={props.captionTheme} frame={frame} />)
      : lead?.mode === 'lead' ? <LeadCaption props={props} frame={frame} perCard={lead.wordsPerCard} />
      : props.captionStyle === 'word' ? <WordCaption props={props} frame={frame} />
      : beat.layout === 'SPLIT' ? <SplitCaptionTrack props={props} frame={frame} /> : <CaptionTrack props={props} frame={frame} />
  // A why beat's step sits over the captions, which keep running under it. Every other beat keeps the chrome's tree
  // exactly as before (houseGolden.test.ts).
  const step = beat.role === 'why' && beat.why && !ending ? <WhyStep props={house} beat={beat} frame={frame} /> : null
  return <>
    <Grain />
    {/* SPLIT keeps the mark tile and series pill of every face-with-proof beat: the horizontal logo is drawn for ink
        and cannot be read on the cream stage (Krish, 2026-11-03: "We fucking have standards for intro, background
        audio and outro"; the house mark sits at the start of every beat, Krish 2026-09-26). */}
    {/* Vertical video carries no wordmark, mark tile or series pill (Ruling, Krish, 2026-11-11: "I don't think they're
        necessary and should be permanently removed from all templates"). The wide cut keeps them. */}
    {/* The logo only on the title frame and the close (Ruling, Krish, 2026-11-17): with bodyLogo false the wide cut
        keeps its series pill and draws no mark tile and no header logo. */}
    {props.aspect === '9:16' ? null : beat.layout === 'STAGE' && !lightStage(props) ? <StageHeader props={house} /> : <>
      {props.bodyLogo === true ? <MarkTile props={house} /> : null}
      <ChannelPill props={house} beat={beat} />
    </>}
    {/* The title holds over every face-alone beat, a STAGE beat on the take included (the georgia_la build);
        graphics own the top of SPLIT and of a STAGE beat with no plate. */}
    {props.captionStyle === 'word' && !landing && !isStaging(props.layout?.mode, props.aspect) && beat.layout !== 'SPLIT' && !(beat.layout === 'STAGE' && beat.plate?.source !== 'take') && <HeldTitle props={props} frame={frame} />}
    {step ? <>{step}{chrome}</> : chrome}
  </>
}

/** True when the beat is a full-bleed scene plate: a busy photograph fills the frame behind the captions. Never his take
 *  (F1, SPLIT) and never the cream stage, whose devices sit on a plain ground. */
export function onFullPlate(props: EngineRenderProps, beat: EngineBeat): boolean {
  if (beat.layout !== 'STAGE') return false
  return beat.uses.some((id) => {
    const object = props.objects.find((o) => o.obj === id)
    return object?.device === 'scene_plate' && object.params.full !== false
  })
}

/** A tight dark halo around a themed caption's letters on a full scene plate: the step after the lift's soft shadow,
 *  which left the rack-focus words unreadable on the Wed 18 crocodile plate (ve qc captions.ocr and captions.render,
 *  18 Nov 2026). It hugs the glyphs and darkens nothing else, so the picture behind (the crocodile's eye) keeps its light,
 *  where a floor under the band would have dimmed it. */
export const CAPTION_HALO = 'drop-shadow(0 0 2px rgba(0,0,0,0.95)) drop-shadow(0 0 3px rgba(0,0,0,0.9)) drop-shadow(0 2px 14px rgba(0,0,0,0.7))'
/** The same halo over his take: the lighter one left 23 rack-focus pages unread over his light wall (Wed 18 short, ve qc
 *  captions.ocr, 19 Nov 2026). It darkens only the letters' edges, never his face. */
export const TAKE_HALO = CAPTION_HALO

/** Reuse caption timing, word layout and swipe; apply the frozen split frame's compact padding. */
export function SplitCaptionTrack({ props, frame }: { props: EngineRenderProps; frame: number }) {
  const caption = CaptionTrack({ props, frame })
  if (!caption) return null
  const height = Number(caption.props.style.height) - HOUSE.caption.paddingTop - HOUSE.caption.paddingBottom + 20
  if (height > SPLIT_CAPTION_ZONE.height) throw new Error('ve: SPLIT caption exceeds frozen zone; repaginate')
  return React.cloneElement(caption, { style: {
    ...caption.props.style, ...SPLIT_CAPTION_ZONE, height,
    padding: `10px ${HOUSE.caption.paddingX}px`,
  } })
}

/** Any caption style drawn over his take wears the take halo, not only rack-focus (Ruling, Krish, 2026-11-19: "Halo + frame
 *  me higher"; his 18 Nov "Approve halo"): art-directed words sat white on his light wall, unreadable. */
export function overTake(beat: { plate?: { source?: string | undefined } | undefined } | undefined): boolean {
  return beat?.plate?.source === 'take'
}
