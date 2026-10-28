import type { Box } from '../devices/types'
import type { EngineBeat, EngineRenderProps } from '../props'

type Layout = EngineBeat['layout']
type Aspect = EngineRenderProps['aspect']

// These are key-content regions. The segment plate itself remains full bleed.
// Each aspect is authored in its own frame coordinates, never scaled.
const TALL: Record<Layout, readonly Box[]> = {
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

const WIDE: Record<Layout, readonly Box[]> = {
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
export function slotsFor(layout: Layout, aspect: Aspect): Box[] {
  return (aspect === '9:16' ? TALL : WIDE)[layout].map((box) => ({ ...box }))
}
