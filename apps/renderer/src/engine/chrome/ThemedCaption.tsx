import React from 'react'
import type { CaptionThemeName } from '../captions/names'
import { THEMES } from '../captions/themes'
import { ArtDirectedCaption } from './ArtDirectedCaption'
import type { EngineRenderProps } from '../props'

export { REGIONS as THEME_REGION } from '../captions/kit'

/** A chosen caption style drawn instead of the house caption (brand.caption_theme; Krish, 2026-11-11). Every style is
 *  the house's own (../captions/themes.tsx), drawn from ve's caption pages in the house faces and colours, inside every
 *  platform's safe area. */
export function ThemedCaption({ props, theme, frame = 0 }: { props: EngineRenderProps; theme: CaptionThemeName; frame?: number }): React.ReactElement | null {
  if (theme === 'art-directed') return <ArtDirectedCaption props={props} frame={frame} />
  const draw = THEMES[theme]
  if (!draw) throw new Error(`ve: unknown caption theme ${theme}`)
  return draw(props, frame)
}
