import React from 'react'
import { HOUSE_FONTS } from '../../house/geometry'
import type { EngineRenderProps } from '../props'
import { captionPageAt } from './CaptionTrack'

/** The word build (Krish, 2026-11-03: "its the georgia subtitles build"; inspiration card instagram_DePHDr_jRed):
 *  one word at a time in white, at chest height so it never sits on the face, a serif word with the page's
 *  swiped word set in the heavy sans, and the piece's title held at the top. */
export const WORD_CAPTION = {
  tall: { centerY: 1440, size: 88, titleTop: 250, titleSize: 66, width: 1080 },
  wide: { centerY: 830, size: 72, titleTop: 120, titleSize: 54, width: 1920 },
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
  const pop = Math.min(1, (frame - word.atFrame) / WORD_CAPTION.popFrames)
  const loud = page.swipeIndex === 0
  return <div data-word-caption style={{
    position: 'absolute', left: 0, width: g.width, top: g.centerY - g.size * 0.6, height: g.size * 1.2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
  }}>
    <span style={{
      fontFamily: loud ? HOUSE_FONTS.structure : HOUSE_FONTS.dek, fontWeight: loud ? 900 : 700,
      fontSize: g.size, lineHeight: 1, color: '#FFFFFF', textShadow: SHADOW, whiteSpace: 'nowrap',
      letterSpacing: loud ? '-0.01em' : '-0.005em',
      transform: `scale(${0.9 + 0.1 * pop})`, opacity: 0.4 + 0.6 * pop,
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
