import type { Box } from './devices/types'
import { MAX_GROW, isRegion } from './kit/layout'

/** Natural typography is authored first; the whole object then fits uniformly, never enlarged, at the top of its box.
 *  In a layout region (kit/layout.ts, spec style.layout fill or stack) it may grow to fill the region, up to MAX_GROW,
 *  and centres in it (Krish, 2026-11-13: "the use of the screen space is terrible"). */
export function fitScale(natural: { width: number; height: number }, box: Box): number {
  return Math.min(isRegion(box) ? MAX_GROW : 1, box.width / natural.width, box.height / natural.height)
}

export function fitBox(natural: { width: number; height: number }, box: Box): Box {
  const scale = fitScale(natural, box)
  const height = natural.height * scale
  return { left: box.left + (box.width - natural.width * scale) / 2, top: isRegion(box) ? box.top + (box.height - height) / 2 : box.top,
    width: natural.width * scale, height }
}
