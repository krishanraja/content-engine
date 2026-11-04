import { lightStage } from './lightStage'
import React from 'react'
import { HOUSE_FONTS } from '../../house/geometry'
import type { EngineRenderProps } from '../props'
import { FWP_SPLIT_SEAM_Y } from '../mocks/face-with-proof'
import { captionPageAt } from './CaptionTrack'

/** The word build (Krish, 2026-11-03: "its the georgia subtitles build"; inspiration card instagram_DePHDr_jRed):
 *  one word at a time in white, on the split seam, at chest height on face beats, or at 66% on graphics, the emphasized word in the serif, and the piece's title held at the top. */
export const WORD_CAPTION = {
  tall: { centerY: 1500, splitCenterY: FWP_SPLIT_SEAM_Y, graphicsCenterY: 1920 * 0.66, size: 88, titleTop: 250, titleSize: 66, width: 1080 },
  wide: { centerY: 830, splitCenterY: FWP_SPLIT_SEAM_Y, graphicsCenterY: 1080 * 0.66, size: 72, titleTop: 120, titleSize: 54, width: 1920 },
  /** The reference's pale title yellow; the one colour here that is not a house token. */
  titleColour: '#F4EC86',
  popFrames: 4,
} as const

const SHADOW = '0 3px 14px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.6)'

export function WordCaption({ props, frame }: { props: EngineRenderProps; frame: number }) {
  if ((props.ending && frame >= props.ending.fromFrame)
    || props.beats.some((beat) => beat.role === 'call' && frame >= beat.fromFrame && frame < beat.toFrame)) return null
  const page = captionPageAt(props.captions, frame)
  const word = page?.words[0]
  if (!page || !word || word.atFrame > frame) return null
  const g = props.aspect === '16:9' ? WORD_CAPTION.wide : WORD_CAPTION.tall
  const beat = props.beats.find((beat) => beat.fromFrame <= frame && frame < beat.toFrame)
  const centerY = beat?.layout === 'SPLIT' ? g.splitCenterY
    : beat?.plate?.source === 'none' ? g.graphicsCenterY : g.centerY
  const pop = Math.min(1, (frame - word.atFrame) / WORD_CAPTION.popFrames)
  const loud = page.swipeIndex === 0
  return <div data-word-caption style={{
    position: 'absolute', left: 0, width: g.width, top: centerY - g.size * 0.6, height: g.size * 1.2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
  }}>
    <span style={{
      // The heavy sans, with the page's loud word in the upright house serif (Krish, 2026-11-03: "add the upright
      // Fraunces to the kit"), as the reference reel sets its quoted word.
      fontFamily: loud ? HOUSE_FONTS.dek : HOUSE_FONTS.structure, fontWeight: loud ? 700 : 800,
      fontStyle: 'normal',
      // On the light graphics wash the word is ink; over a face plate it stays white with its shadow.
      fontSize: g.size, lineHeight: 1, ...(lightStage(props) && beat?.layout === 'STAGE' && beat.plate?.source === 'none'
        ? { color: props.tokens.ink, textShadow: 'none' } : { color: '#FFFFFF', textShadow: SHADOW }), whiteSpace: 'nowrap',
      letterSpacing: loud ? '-0.01em' : '-0.005em',
      transform: `scale(${0.9 + 0.1 * pop})`,
    }}>{word.text}</span>
  </div>
}

export function HeldTitle({ props, frame }: { props: EngineRenderProps; frame: number }) {
  if (!props.title || (props.ending && frame >= props.ending.fromFrame)) return null
  const g = props.aspect === '16:9' ? WORD_CAPTION.wide : WORD_CAPTION.tall
  return <div data-held-title style={{
    position: 'absolute', left: 80, width: g.width - 160, top: g.titleTop, textAlign: 'center',
    fontFamily: HOUSE_FONTS.structure, fontWeight: 800, fontSize: g.titleSize, lineHeight: 1.04,
    letterSpacing: '-0.02em', color: WORD_CAPTION.titleColour, textShadow: SHADOW, pointerEvents: 'none',
  }}>{props.title}</div>
}
