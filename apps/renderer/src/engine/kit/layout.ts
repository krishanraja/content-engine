import { z } from 'zod'
import type { Box } from '../devices/types'
import { REGIONS } from '../captions/kit'

/** The layout ingredient: how a graphics-only beat uses the frame (spec style.layout; docs/ve/INGREDIENTS.md).
 *
 *  Why (Krish, 2026-11-13, of the 3D style test cuts): "the use of the screen space is terrible". A STAGE beat hands
 *  every device the whole frame, and the devices that fit themselves (`fit.ts`) only ever shrank to fit and pinned
 *  themselves to the top, so a count drew 120 px tall at the top of a 1920 px frame. On the 13 Nov house-test cut the
 *  picture used 28 to 30% of the frame against 84% in his references (`ve pace`).
 *
 *  - `house`: as before (no style.layout means the same).
 *  - `fill`: each device on a graphics-only beat gets the free region (the channel-safe area the captions leave) and a
 *    device that fits itself grows to fill it, up to 3x, centred in it.
 *  - `stack`: the free region is shared top to bottom by the beat's devices, each filling its share.
 *  - `band`, `stage`, `tray`: stagings for the beats that show his take (kit/staging.ts); their graphics-only beats
 *    fill as under `fill`.
 *
 *  Only boxes this module hands out may grow (`isRegion`), so chrome and every other user of `fit.ts` draw exactly as
 *  before. Pure: the regions are a function of the props alone. */

export const LAYOUTS = ['house', 'fill', 'stack', 'band', 'stage', 'tray'] as const
export const EngineLayoutSchema = z.object({ mode: z.enum(LAYOUTS) }).strict()
export type EngineLayout = z.infer<typeof EngineLayoutSchema>

/** How far a device in a region may grow past its natural size. */
export const MAX_GROW = 3
const GAP = 24

const regions = new WeakSet<Box>()
/** Whether a box is a layout region: only then may a device grow to fill it and centre in it. */
export const isRegion = (box: Box): boolean => regions.has(box)
const mark = (box: Box): Box => { regions.add(box); return box }
/** Mark a box as a region devices may grow into (the stagings, kit/staging.ts). */
export const markRegion = mark

type Aspect = '9:16' | '16:9'
type Placement = 'lower' | 'centre' | 'upper' | undefined

/** The free region on a graphics-only beat: the channel-safe area minus the band the captions sit in. 9:16 keeps type
 *  in x 60 to 860 (the action rail starts at 880), from y 280 under every top bar to y 1320 above the bottom band. */
export function freeRegion(aspect: Aspect, placement: Placement, themed: boolean): Box {
  if (aspect === '16:9') return { left: 96, top: 140, width: 1728, height: placement === 'upper' ? 640 : 600 }
  const top = 280, bottom = 1320, left = 60, width = 800
  if (!themed) return { left, top, width, height: 1060 - top }          // the house caption box starts at y 1090
  const band = REGIONS['9:16'][placement ?? 'lower']
  if (placement === 'upper') return { left, top: band.top + band.height + 24, width, height: bottom - (band.top + band.height + 24) }
  if (placement === 'centre') return { left, top, width, height: band.top - 24 - top }
  return { left, top, width, height: band.top - 24 - top }
}

/** The boxes for a beat's devices under a layout, or undefined to keep the layout's own slots. */
export function layoutSlots(layout: EngineLayout | undefined, aspect: Aspect, placement: Placement, themed: boolean,
  count: number): Box[] | undefined {
  if (!layout || layout.mode === 'house' || count < 1) return undefined
  const r = freeRegion(aspect, placement, themed)
  // Under a staging a graphics-only beat is a full-frame takeover: its devices fill the free region.
  if (layout.mode !== 'stack' || count === 1) return Array.from({ length: count }, () => mark({ ...r }))
  const h = (r.height - GAP * (count - 1)) / count
  return Array.from({ length: count }, (_, i) => mark({ left: r.left, top: Math.round(r.top + i * (h + GAP)), width: r.width, height: Math.floor(h) }))
}

/** The boxes for a staged beat's devices: the staging's region, shared top to bottom when there are several. */
export function regionSlots(region: Box, count: number): Box[] {
  if (count <= 1) return [mark({ ...region })]
  const h = (region.height - GAP * (count - 1)) / count
  return Array.from({ length: count }, (_, i) => mark({ left: region.left, top: Math.round(region.top + i * (h + GAP)), width: region.width, height: Math.floor(h) }))
}
