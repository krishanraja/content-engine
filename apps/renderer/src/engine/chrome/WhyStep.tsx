import React from 'react'
import { HOUSE, HOUSE_FONTS } from '../../house/geometry'
import { MOTION, progress } from '../clock'
import type { EngineBeat, EngineRenderProps } from '../props'
import { ENDING_SAFE } from './LandingCard'

/** One rung of the why-ladder on a why beat (Ruling, Krish, 2026-11-24: "the signature format is the 5 Whys"): the
 *  small-caps WHY n label and the rung's question, held for about 1.5 s from the beat's start, with the rung's strength
 *  marker: solid when documented, an outline when inferred, dashed when the why is still open. Structural and
 *  token-driven only: the final look comes from the concept stage. The captions keep running under it. */
export interface WhyStepProps { props: EngineRenderProps; beat: EngineBeat; frame: number }

/** How long the step holds from its beat's start, in seconds. */
export const WHY_STEP_HOLD_S = 1.5

export type WhyStrength = NonNullable<EngineBeat['why']>['strength']

/** The strength marker's border: solid fill for documented, an outline for inferred, dashed for open. */
export function whyStrengthMarker(strength: WhyStrength, ink: string): React.CSSProperties {
  const w = HOUSE.whyStep
  if (strength === 'documented') return { background: ink, border: `${w.markerBorder}px solid ${ink}` }
  if (strength === 'inferred') return { background: 'transparent', border: `${w.markerBorder}px solid ${ink}` }
  return { background: 'transparent', border: `${w.markerBorder}px dashed ${ink}` }
}

/** The words beside the marker, so the strength reads without colour. */
export const WHY_STRENGTH_WORDS: Record<WhyStrength, string> = { documented: 'documented', inferred: 'inferred', open: 'open question' }

export function whyStepModel(props: EngineRenderProps, beat: EngineBeat, frame: number) {
  const why = beat.why
  if (beat.role !== 'why' || !why) return null
  if (props.ending && frame >= props.ending.fromFrame) return null
  const since = frame - beat.fromFrame
  const hold = Math.round(WHY_STEP_HOLD_S * props.fps)
  if (since < 0 || frame >= beat.toFrame || since >= hold + MOTION.exitFrames) return null
  const safe = ENDING_SAFE[props.aspect]
  const tall = props.aspect === '9:16'
  const left = safe.leftPx
  const width = (tall ? 1080 : 1920) - safe.leftPx - safe.rightPx
  const arrival = progress(since, MOTION.enterFrames)
  const leaving = since >= hold ? progress(since - hold, MOTION.exitFrames) : 0
  return { left, top: safe.topPx, width: tall ? width : Math.min(width, 1200), n: why.n, label: `Why ${why.n}`, question: why.question,
    strength: why.strength, strengthWords: WHY_STRENGTH_WORDS[why.strength], opacity: arrival * (1 - leaving), arrival }
}

export function WhyStep({ props, beat, frame }: WhyStepProps): React.ReactElement | null {
  const model = whyStepModel(props, beat, frame)
  if (!model) return null
  const w = HOUSE.whyStep
  const tokens = props.tokens
  return (
    <div data-why-step={model.n} data-strength={model.strength} style={{ position: 'absolute', zIndex: 904, left: model.left, top: model.top,
      width: model.width, boxSizing: 'border-box', background: tokens.cream, color: tokens.ink,
      border: `${w.border}px ${model.strength === 'open' ? 'dashed' : 'solid'} ${tokens.ink}`,
      padding: `${w.paddingY}px ${w.paddingX}px`, display: 'flex', flexDirection: 'column', gap: w.gap,
      transform: `translateY(${(model.arrival - 1) * 24}px)`, opacity: model.opacity, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: w.gap, fontFamily: HOUSE_FONTS.data, fontWeight: 600, fontSize: w.labelSize,
        lineHeight: 1.3, letterSpacing: `${w.labelLetterSpacingEm}em`, textTransform: 'uppercase' }}>
        <span data-strength-marker="" style={{ display: 'inline-block', boxSizing: 'border-box', width: w.markerSize, height: w.markerSize, ...whyStrengthMarker(model.strength, tokens.ink) }} />
        <span>{model.label}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{model.strengthWords}</span>
      </div>
      <p style={{ margin: 0, fontFamily: HOUSE_FONTS.dek, fontWeight: 400, fontSize: w.questionSize, lineHeight: w.questionLineHeight, overflowWrap: 'anywhere' }}>{model.question}</p>
    </div>
  )
}
