import React from 'react'
import { themeRegistry } from '../captionThemes/registry'
import type { CaptionsData } from '../captionThemes/types'
import type { CaptionThemeName } from '../captionThemes/names'
import '../captionThemes/fonts'
import type { EngineRenderProps } from '../props'

/** Where a caption theme may draw: inside every platform's safe area on 9:16 (config/channel-safe-zones.json: clear
 *  of the 270 px top band, the action rail from x 880 and the bottom band from y 1320), and inside the 16:9 title-safe
 *  box. A theme fills and centres in the box it is given, so the box is the whole of its safety. */
export const THEME_REGION = {
  '9:16': { left: 60, top: 1000, width: 820, height: 300 },
  '16:9': { left: 192, top: 780, width: 1536, height: 220 },
} as const

/** The house's caption pages as the themes' word timing: one line per page, each word from its own frame to the next
 *  word's (the last to the page's end), seconds at the cut's fps; the page's one swiped word is its emphasis. */
export function themeData(props: Pick<EngineRenderProps, 'captions' | 'fps'>): CaptionsData {
  return {
    lines: props.captions.map((page) => ({
      words: page.words.map((word, i) => ({
        text: word.text,
        start: word.atFrame / props.fps,
        end: (page.words[i + 1]?.atFrame ?? page.toFrame) / props.fps,
        ...(page.swipeIndex === i ? { emphasis: true } : {}),
      })),
    })),
  }
}

/** A chosen caption theme in the house colours: cream words, the spoken or emphasised word in the series colour (the
 *  colour the house caption's shadow already carries). */
export function ThemedCaption({ props, theme }: { props: EngineRenderProps; theme: CaptionThemeName }): React.ReactElement {
  const Theme = themeRegistry[theme]
  if (!Theme) throw new Error(`ve: unknown caption theme ${theme}`)
  const box = THEME_REGION[props.aspect]
  return (
    <div data-caption-theme={theme} style={{ position: 'absolute', ...box, overflow: 'visible', pointerEvents: 'none', zIndex: 40 }}>
      <Theme data={themeData(props)} primaryColor={props.tokens.cream} secondaryColor={props.tokens.channel}
        fontSize={props.aspect === '9:16' ? 72 : 64} />
    </div>
  )
}
