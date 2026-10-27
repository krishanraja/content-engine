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
    { left: 120, top: 288, width: 768, height: 552 },
    { left: 144, top: 312, width: 720, height: 232 },
    { left: 144, top: 568, width: 720, height: 248 },
  ],
  F3: [
    { left: 120, top: 376, width: 768, height: 464 },
    { left: 120, top: 288, width: 768, height: 72 },
  ],
}

const WIDE: Record<Layout, readonly Box[]> = {
  // Every wide slot ends by Y 780: the caption block sits above Y 960 and reaches up to about Y 800.
  P1: [
    { left: 96, top: 54, width: 1728, height: 726 },
    { left: 132, top: 90, width: 640, height: 200 },
  ],
  P3: [
    { left: 96, top: 54, width: 1026, height: 560 },
    { left: 1140, top: 54, width: 684, height: 726 },
    { left: 96, top: 630, width: 1026, height: 150 },
  ],
  P6: [
    { left: 96, top: 54, width: 1728, height: 726 },
    { left: 998, top: 400, width: 826, height: 380 },
  ],
  F1: [
    { left: 96, top: 54, width: 1728, height: 726 },
    { left: 132, top: 90, width: 768, height: 320 },
    { left: 1020, top: 440, width: 768, height: 320 },
  ],
  F3: [
    { left: 96, top: 150, width: 1728, height: 630 },
    { left: 96, top: 54, width: 1728, height: 80 },
  ],
}

/** Slots follow beat.uses order: plate then overlays, except P3's graphic then plate. */
export function slotsFor(layout: Layout, aspect: Aspect): Box[] {
  return (aspect === '9:16' ? TALL : WIDE)[layout].map((box) => ({ ...box }))
}
