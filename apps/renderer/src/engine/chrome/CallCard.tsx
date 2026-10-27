import React from 'react'
import { SwipedText } from '../../house/components'
import { HOUSE, HOUSE_FONTS, houseCallFrame, houseDueLine, houseLastWordIndex, type HouseSafeZones } from '../../house/geometry'
import { wrapWords } from '../../house/metrics'
import { MOTION, progress } from '../clock'
import type { EngineRenderProps } from '../props'

export interface CallCardProps { props: EngineRenderProps; frame: number }

// Tall uses the intersection of the four delivery platforms' safe zones.
// Wide has its own 5% title-safe inset, rather than a rotated tall layout.
export const ENDING_SAFE = {
  '9:16': { leftPx: 100, rightPx: 180, topPx: 180, bottomPx: 420 },
  '16:9': { leftPx: 96, rightPx: 96, topPx: 54, bottomPx: 54 },
} satisfies Record<EngineRenderProps['aspect'], HouseSafeZones>

export function callCardLayout(aspect: EngineRenderProps['aspect'], statement: string) {
  const c = HOUSE.call
  const safe = ENDING_SAFE[aspect]
  const tall = aspect === '9:16'
  const width = tall ? houseCallFrame(statement, { ...safe, rightPx: safe.rightPx + c.shadow }).width : 1200
  const left = tall ? safe.leftPx : (1920 - width) / 2
  const lines = wrapWords('archivo700', statement, c.statementSize, width - 2 * (c.border + c.paddingX), c.statementLetterSpacingEm)
  const height = c.border * 2 + c.paddingTop + c.paddingBottom + c.kickerSize * 1.3
    + c.headlineSize * c.headlineLineHeight + Math.max(1, lines.length) * c.statementSize * c.statementLineHeight
    + c.dueRule + c.duePaddingTop + c.dueSize * 1.3 + c.gap * 3
  const canvasHeight = tall ? 1920 : 1080
  const top = tall ? Math.min(c.top, canvasHeight - safe.bottomPx - height - c.shadow) : (canvasHeight - height) / 2
  return { left, top, width, height, box: { left, top, width: width + c.shadow, height: height + c.shadow } }
}

export function callCardModel(props: EngineRenderProps, frame: number) {
  const beat = props.beats.find((candidate) => candidate.role === 'call' && frame >= candidate.fromFrame && frame < candidate.toFrame)
  if (!props.call || !beat || (props.ending && frame >= props.ending.fromFrame)) return null
  return {
    ...callCardLayout(props.aspect, props.call.statement),
    ...houseDueLine(props.call.due, props.call.confidencePercent),
    statement: props.call.statement,
    arrival: progress(frame - beat.fromFrame, MOTION.slapFrames),
  }
}

/** The dated call replaces the captions for the call beat. Time comes from the master clock. */
export function CallCard({ props, frame }: CallCardProps): React.ReactElement | null {
  const model = callCardModel(props, frame)
  if (!model) return null
  const c = HOUSE.call
  const tokens = { ...props.tokens, section: props.tokens.channel }
  return (
    <div style={{ position: 'absolute', zIndex: 905, left: model.left, top: model.top, width: model.width,
      boxSizing: 'border-box', background: tokens.cream, color: tokens.ink,
      border: `${c.border}px solid ${tokens.ink}`, boxShadow: `${c.shadow}px ${c.shadow}px 0 ${tokens.ink}`,
      padding: `${c.paddingTop}px ${c.paddingX}px ${c.paddingBottom}px`, display: 'flex', flexDirection: 'column', gap: c.gap,
      transform: `translateY(${(model.arrival - 1) * 60}px)`, opacity: Math.min(1, model.arrival * 1.5), pointerEvents: 'none' }}>
      <span style={{ fontFamily: HOUSE_FONTS.data, fontWeight: 600, fontSize: c.kickerSize, lineHeight: 1.3, letterSpacing: `${c.kickerLetterSpacingEm}em`, textTransform: 'uppercase' }}>The call</span>
      <h2 style={{ margin: 0, fontFamily: HOUSE_FONTS.display, fontWeight: 400, textTransform: 'uppercase', fontSize: c.headlineSize, lineHeight: c.headlineLineHeight, letterSpacing: `${c.headlineLetterSpacingEm}em` }}>
        <SwipedText text="Our call." swipeIndex={houseLastWordIndex('Our call.')} tokens={tokens} display />
      </h2>
      <p style={{ margin: 0, fontFamily: HOUSE_FONTS.structure, fontWeight: c.statementWeight, fontSize: c.statementSize, lineHeight: c.statementLineHeight, letterSpacing: `${c.statementLetterSpacingEm}em`, overflowWrap: 'anywhere' }}>{model.statement}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `${c.dueRule}px solid ${tokens.ink}`, paddingTop: c.duePaddingTop, fontFamily: HOUSE_FONTS.data, fontWeight: 600, fontSize: c.dueSize, lineHeight: 1.3, letterSpacing: `${c.dueLetterSpacingEm}em`, textTransform: 'uppercase' }}>
        <span>{model.due}</span><span>{model.sure}</span>
      </div>
    </div>
  )
}
