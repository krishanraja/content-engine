import React from 'react'
import { HOUSE, HOUSE_FONTS, houseLandingFrame, houseLandingHeight, type HouseSafeZones } from '../../house/geometry'
import { MOTION, progress } from '../clock'
import type { EngineBeat, EngineRenderProps } from '../props'

/** Where the why-ladder lands (Ruling, Krish, 2026-11-24: "the signature format is the 5 Whys; get rid of everything
 *  that suggests predictions, calls, dated, odds or scores"): what this shows, then the open question handed to the
 *  viewer. Never a verdict, a forecast, odds, a meter or a date. Structural and token-driven only: the final look comes
 *  from the concept stage. */
export interface LandingCardProps { props: EngineRenderProps; frame: number }

/** The card's kicker, the same words the page and the Short use (config/studio.json copy.landing_kicker). */
export const LANDING_KICKER = 'What this shows'

// Tall uses the intersection of the four delivery platforms' safe zones.
// Wide has its own 5% title-safe inset, rather than a rotated tall layout.
export const ENDING_SAFE = {
  '9:16': { leftPx: 100, rightPx: 180, topPx: 180, bottomPx: 420 },
  '16:9': { leftPx: 96, rightPx: 96, topPx: 54, bottomPx: 54 },
} satisfies Record<EngineRenderProps['aspect'], HouseSafeZones>

export function landingCardLayout(aspect: EngineRenderProps['aspect'], shows: string, openQuestion: string) {
  const c = HOUSE.landing
  const safe = ENDING_SAFE[aspect]
  const tall = aspect === '9:16'
  const width = tall ? houseLandingFrame(shows, openQuestion, { ...safe, rightPx: safe.rightPx + c.shadow }).width : 1200
  const left = tall ? safe.leftPx : (1920 - width) / 2
  const { height } = houseLandingHeight(shows, openQuestion, width)
  const canvasHeight = tall ? 1920 : 1080
  const top = tall ? Math.min(c.top, canvasHeight - safe.bottomPx - height - c.shadow) : (canvasHeight - height) / 2
  return { left, top, width, height, box: { left, top, width: width + c.shadow, height: height + c.shadow } }
}

type LandingBeat = EngineBeat & { landing: NonNullable<EngineBeat['landing']> }

/** The landing beat on screen at a frame, when it carries its landing. A landing beat without one (an archived cut's
 *  closing beat) draws captions like any other. */
export function landingBeatAt(props: EngineRenderProps, frame: number): LandingBeat | null {
  if (props.ending && frame >= props.ending.fromFrame) return null
  const beat = props.beats.find((candidate) => candidate.role === 'landing' && !!candidate.landing && frame >= candidate.fromFrame && frame < candidate.toFrame)
  return beat?.landing ? beat as LandingBeat : null
}

export function landingCardModel(props: EngineRenderProps, frame: number) {
  const beat = landingBeatAt(props, frame)
  if (!beat) return null
  return {
    ...landingCardLayout(props.aspect, beat.landing.shows, beat.landing.open_question),
    kicker: LANDING_KICKER,
    shows: beat.landing.shows,
    openQuestion: beat.landing.open_question,
    // A decelerating arrival: no bounce, overshoot or slap.
    arrival: progress(frame - beat.fromFrame, MOTION.enterFrames),
  }
}

/** The landing replaces the captions for the landing beat. Time comes from the master clock. */
export function LandingCard({ props, frame }: LandingCardProps): React.ReactElement | null {
  const model = landingCardModel(props, frame)
  if (!model) return null
  const c = HOUSE.landing
  const tokens = props.tokens
  return (
    <div data-landing="" style={{ position: 'absolute', zIndex: 905, left: model.left, top: model.top, width: model.width,
      boxSizing: 'border-box', background: tokens.cream, color: tokens.ink,
      border: `${c.border}px solid ${tokens.ink}`, boxShadow: `${c.shadow}px ${c.shadow}px 0 ${tokens.ink}`,
      padding: `${c.paddingTop}px ${c.paddingX}px ${c.paddingBottom}px`, display: 'flex', flexDirection: 'column', gap: c.gap,
      transform: `translateY(${(model.arrival - 1) * 40}px)`, opacity: model.arrival, pointerEvents: 'none' }}>
      <span style={{ fontFamily: HOUSE_FONTS.data, fontWeight: 600, fontSize: c.kickerSize, lineHeight: 1.3, letterSpacing: `${c.kickerLetterSpacingEm}em`, textTransform: 'uppercase' }}>{model.kicker}</span>
      <p style={{ margin: 0, fontFamily: HOUSE_FONTS.structure, fontWeight: c.showsWeight, fontSize: c.showsSize, lineHeight: c.showsLineHeight, letterSpacing: `${c.showsLetterSpacingEm}em`, overflowWrap: 'anywhere' }}>{model.shows}</p>
      <p data-open-question="" style={{ margin: 0, borderTop: `${c.questionRule}px solid ${tokens.ink}`, paddingTop: c.questionPaddingTop, fontFamily: HOUSE_FONTS.dek, fontStyle: 'italic', fontWeight: 400, fontSize: c.questionSize, lineHeight: c.questionLineHeight, overflowWrap: 'anywhere' }}>{model.openQuestion}</p>
    </div>
  )
}
