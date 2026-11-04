import { boxFor, WIDE as WIDE_GEOMETRY, TALL as HOUSE } from '../geometry'
import { FWP_SPLIT_SEAM_Y, FWP_POSTER_POSITIONS } from '../mocks/face-with-proof'
import type { Box } from '../devices/types'
import type { EngineBeat, EngineRenderProps } from '../props'

type Layout = EngineBeat['layout']
type Aspect = EngineRenderProps['aspect']

// These are key-content regions. The segment plate itself remains full bleed.
// Each aspect is authored in its own frame coordinates, never scaled.
const TALL: Record<Layout, readonly Box[]> = {
  SPLIT: [{ left: 60, top: 300, width: 960, height: FWP_SPLIT_SEAM_Y - 360 }],
  STAGE: [
    { left: 0, top: 0, width: 1080, height: 1920 },
  ],
  P1: [
    { left: 120, top: 288, width: 768, height: 552 },
    { left: 144, top: 312, width: 720, height: 160 },
  ],
  P3: [
    { left: 120, top: 288, width: 768, height: 324 },
    { left: 120, top: 624, width: 768, height: 216 },
    { left: 120, top: 852, width: 660, height: 290 },
  ],
  P6: [
    { left: 120, top: 288, width: 768, height: 552 },
    { left: 424, top: 576, width: 464, height: 264 },
  ],
  F1: [
    { left: 120, top: 852, width: 660, height: 290 },
    { left: 120, top: 288, width: 768, height: 400 },
    { left: 120, top: 700, width: 768, height: 140 },
  ],
  F3: [
    { left: 120, top: 376, width: 768, height: 464 },
    { left: 120, top: 288, width: 768, height: 72 },
  ],
}

const WIDE: Record<Exclude<Layout, 'SPLIT'>, readonly Box[]> = {
  STAGE: [
    { left: 0, top: 0, width: 1920, height: 1080 },
  ],
  P1: [
    { left: 96, top: 208, width: 1728, height: 572 },
    { left: 132, top: 232, width: 640, height: 200 },
  ],
  P3: [
    { left: 96, top: 208, width: 1026, height: 420 },
    { left: 1140, top: 54, width: 684, height: 726 },
    { left: 96, top: 640, width: 1026, height: 140 },
  ],
  P6: [
    { left: 96, top: 208, width: 1728, height: 572 },
    { left: 998, top: 400, width: 826, height: 380 },
  ],
  F1: [
    { left: 1176, top: 54, width: 648, height: 490 },
    { left: 96, top: 208, width: 1056, height: 572 },
    { left: 1176, top: 560, width: 648, height: 220 },
  ],
  F3: [
    { left: 96, top: 208, width: 1728, height: 572 },
    { left: 900, top: 70, width: 924, height: 96 },
  ],
}

/** Slots follow beat.uses order: plate then overlays, except P3's graphic then plate.
 * F1: slot 0 is the persistent context object (the grid), slot 1 the dominant focus object,
 * and slot 2 a stat strip. */
export function slotsFor(layout: Layout, aspect: Aspect, count = 1): Box[] {
  if (layout === 'SPLIT' && aspect === '16:9') throw new Error('ve: SPLIT has no wide lock; use 9:16')
  const boxes = aspect === '9:16' ? TALL[layout] : WIDE[layout as Exclude<Layout, 'SPLIT'>]
  if (layout === 'STAGE' || layout === 'SPLIT') return Array.from({ length: count }, () => ({ ...boxes[0]! }))
  return boxes.map((box) => ({ ...box }))
}

/** Camera geometry shares the frozen seam with stage slots. */
export function splitCameraBox(aspect: Aspect): Box {
  if (aspect !== '9:16') throw new Error('ve: SPLIT has no wide lock; use 9:16')
  return { left: 0, top: FWP_SPLIT_SEAM_Y, width: 1080, height: 1920 - FWP_SPLIT_SEAM_Y }
}

/** Named editorial crops are not CSS object positions. */
export function splitPlatePosition(crop?: string): string {
  const tokens = crop?.trim().split(/\s+/)
  return tokens && tokens.length >= 1 && tokens.length <= 4
    && tokens.every((token) => /^(?:left|right|top|bottom|center|0|-?\d+(?:\.\d+)?(?:%|px))$/.test(token))
    ? crop!.trim() : FWP_POSTER_POSITIONS.proof
}

/** Penetration in pixels into the mark exclusion box (shadow plus 24px).
 * Zero includes exact edge contact; positive values are the smaller intersecting axis.
 */
export function markClearance(box: Box, aspect: Aspect): number {
  const mark = boxFor('mark', aspect)
  const padding = (aspect === '16:9' ? WIDE_GEOMETRY.mark.shadow : HOUSE.mark.shadow) + 24
  const x = Math.min(box.left + box.width, mark.left + mark.width + padding)
    - Math.max(box.left, mark.left - padding)
  const y = Math.min(box.top + box.height, mark.top + mark.height + padding)
    - Math.max(box.top, mark.top - padding)
  return Math.max(0, Math.min(x, y))
}
