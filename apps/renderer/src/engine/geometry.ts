import { HOUSE } from '../house/geometry'
import type { Box } from './devices/types'
import type { EngineRenderProps } from './props'

export { HOUSE as TALL } from '../house/geometry'

/** Landscape is authored independently; its caption shadow fits the 10% title-safe inset. */
export const WIDE = {
  width: 1920,
  height: 1080,
  mark: { left: 64, top: 56, size: 112, image: 80, shadow: 10 },
  caption: { ...HOUSE.caption, maxWidth: 1400, bottom: 960, size: 54 },
  pill: { left: 208, top: 82, width: 650, height: 60 },
} as const

export type ChromeElement = 'mark' | 'caption' | 'pill' | 'illustrationLabel'
export type Aspect = EngineRenderProps['aspect']

/** Caption boxes reserve two lines plus padding. Shadows are outside the returned box. */
export function boxFor(element: ChromeElement, aspect: Aspect): Box {
  const wide = aspect === '16:9'
  const c = wide ? WIDE.caption : HOUSE.caption
  switch (element) {
    case 'mark':
      return wide
        ? { left: WIDE.mark.left, top: WIDE.mark.top, width: WIDE.mark.size, height: WIDE.mark.size }
        : { left: 72, top: 150, width: HOUSE.mark.size, height: HOUSE.mark.size }
    case 'caption': {
      const width = wide ? WIDE.caption.maxWidth : HOUSE.width - HOUSE.caption.left - HOUSE.caption.right
      const height = c.paddingTop + c.paddingBottom + 2 * c.size * c.lineHeight
      return {
        left: wide ? (WIDE.width - width) / 2 : HOUSE.caption.left,
        top: wide ? WIDE.caption.bottom - height : HOUSE.caption.top,
        width,
        height,
      }
    }
    case 'pill':
      return wide ? { ...WIDE.pill } : { left: 248, top: 188, width: 650, height: 60 }
    case 'illustrationLabel':
      return wide
        ? { left: 64, top: 204, width: 260, height: 44 }
        : { left: 72, top: 322, width: 260, height: 44 }
  }
}
