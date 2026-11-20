import type { CSSProperties } from 'react'
import type { Box } from '../devices/types'
import { REGIONS } from '../captions/kit'

/** Stagings: how his take and the graphics share the frame on a beat that shows his take (spec style.layout.mode
 *  band, stage or tray; docs/ve/INGREDIENTS.md, "Stagings").
 *
 *  Why: each of his three own cuts that Krish named as styles (13 Nov 2026) stages his take in a way ve could not
 *  draw, so the graphics sat as small objects over a full-frame face and most of the frame was empty ground
 *  (`ve pace`: 26% of the frame used against a median of 81% in his references). Measured from the cuts
 *  (docs/ve/styles/*.card.json, `gaps`):
 *
 *  - `band` (Character.ai): an ink graphics panel over the top of the frame, a 10 px series-colour hairline, and his
 *    take as a still face band under it (9:16: panel to y 1000, face from y 1000 to 1920).
 *  - `stage` (AI music): the ink panel takes the whole frame but his corner, and his take is LARGE bottom right (face
 *    centre x 0.78, about 0.21 of the frame wide), cut out of his wall by the subject matte when the take has one
 *    (`cutout`), else a rounded window; the region left of him is panel, never empty cream ground (20 Nov 2026 reference:
 *    "an empty cream block sits beside him").
 *  - `tray` (eating its own jobs): his take stays full frame and the graphics rise in a cream tray from bottom left
 *    over his chest, with a hard ink drop. His face is left clear, so the captions go in the upper strip.
 *  - `pillar` (a vertical take on a 16:9 cut; Krish, 19 Nov 2026, picked "Pillar: whole take on the right"): his
 *    1080x1920 take whole and uncropped as a full-height 608 px panel on the right of the wide frame, a series-colour
 *    hairline, the ink graphics panel on the left. A tall cut is not staged by it at all and draws exactly as `fill`.
 *
 *  - `anchor` (The Athletic's set, the face beats of eating its own jobs; shot grammar, 20 Nov 2026): his face is the
 *    frame, 9:16 only. Graphics sit only above his head (y 280 to 500, under the top band and over the highest his head
 *    reaches on his takes); a real image or document is a prop beside him at his scale (`props`), and a number or the
 *    title sits behind him through the matte (kit/depth.ts). Never a flat card over his chest or arms: compile keeps every
 *    box off his torso and hands (velib/keepout.py body keep-out). A graphics-only beat on an anchor cut is a PLATE.
 *
 *  A SPLIT or WINDOW beat keeps its own lock. A graphics-only beat is a full-frame takeover (the `fill` region) only where
 *  the shot grammar allows one: on an anchor cut (a PLATE), or on a cut not drawn by the grammar. Under the grammar
 *  (props.layout.grammar, Ruling, Krish, 2026-11-20: one staging per cut) a band or stage cut's graphics-only beat stays
 *  in the panel with his face on screen, so the body never switches layout.
 *  Pure: geometry is a function of the props alone, and every box handed to devices is a layout region they may grow
 *  into (`kit/layout.ts`, `isRegion`). */

export const STAGINGS = ['band', 'stage', 'tray', 'pillar', 'anchor'] as const
export type Staging = typeof STAGINGS[number]
/** Whether a layout mode stages his take on a cut of this aspect. The pillar is for a vertical take on a wide cut only:
 *  on 9:16 the take is already the frame's shape, so a pillar piece's tall cut draws exactly as under `fill`. */
export const isStaging = (mode: string | undefined, aspect?: string): mode is Staging =>
  (STAGINGS as readonly string[]).includes(mode ?? '') && !(mode === 'pillar' && aspect === '9:16') && !(mode === 'anchor' && aspect === '16:9')

type Aspect = '9:16' | '16:9'
type Placement = 'lower' | 'centre' | 'upper' | 'seam' | 'chin' | undefined

export interface StagingGeometry {
  /** Where his take is drawn, and its corner radius. */
  take: Box & { radius: number; border: boolean }
  /** The graphics panel drawn under the take (band, stage) or under the devices (tray). */
  panel: Box & { radius: string }
  /** The colour behind everything (stage's cream band), if not the house ink. */
  under?: 'cream'
  /** The series-colour hairline between panel and face (band). */
  hairline?: Box
  /** The region the beat's devices share. */
  region: Box
  /** Whether the panel rises in on each beat (tray). */
  rises: boolean
  /** Anchor: where a real image or document stands beside him, at his scale. */
  props?: Box[]
  /** Stage: his take is cut out of his wall by the subject matte (props.matte), so the panel shows round him. */
  cutout?: boolean
  /** Stage: his corner, a deeper ink block with a rounded top-left edge under him, so the panel's edge runs round his
   *  corner and his head crosses it (AI music: his head over the stage's edge). */
  corner?: Box & { radius: string }
}

const GAP = 24

/** Cut a region so it stays clear of the caption band, keeping the larger free side. */
function clearOfCaptions(region: Box, aspect: Aspect, placement: Placement, themed: boolean): Box {
  const band = themed ? REGIONS[aspect][placement ?? 'lower'] : aspect === '9:16'
    ? { left: 70, top: 1090, width: 800, height: 230 } : { left: 192, top: 790, width: 1536, height: 236 }
  const top = region.top, bottom = region.top + region.height
  const bTop = band.top - GAP, bBottom = band.top + band.height + GAP
  if (bBottom <= top || bTop >= bottom) return region
  const above = bTop - top, below = bottom - bBottom
  return above >= below ? { ...region, height: Math.max(0, above) } : { ...region, top: bBottom, height: Math.max(0, below) }
}

/** The pillar's take box on a wide cut: a 9:16 take at the frame's full height, so nothing of it is cropped. */
export const PILLAR_TAKE_WIDTH = Math.round(1080 * 9 / 16)

export function stagingGeometry(mode: Staging, aspect: Aspect, placement: Placement, themed: boolean, cutout = false): StagingGeometry {
  if (aspect === '9:16') {
    // The pillar never stages a tall cut (isStaging); if asked, it is the full-frame take of F1.
    if (mode === 'pillar') {
      return { take: { left: 0, top: 0, width: 1080, height: 1920, radius: 0, border: false },
        panel: { left: 0, top: 0, width: 1080, height: 0, radius: '0' },
        region: clearOfCaptions({ left: 60, top: 280, width: 800, height: 560 }, aspect, placement, themed), rises: false }
    }
    if (mode === 'anchor') {
      // His face is the frame. Graphics go above his head only (y 280 to 500: under the platforms' top band, over the
      // highest his head reaches on his takes, 512 lifted); a real image is a prop beside him on the left, at his scale.
      const r = clearOfCaptions({ left: 60, top: 280, width: 960, height: 220 }, aspect, placement, themed)
      return { take: { left: 0, top: 0, width: 1080, height: 1920, radius: 0, border: false },
        panel: { ...r, height: 0, radius: '0' }, region: r, rises: false,
        props: [clearOfCaptions({ left: 40, top: 860, width: 320, height: 252 }, aspect, placement, themed)] }
    }
    if (mode === 'band') {
      const seam = 1000
      return { take: { left: 0, top: seam, width: 1080, height: 1920 - seam, radius: 0, border: false },
        panel: { left: 0, top: 0, width: 1080, height: seam, radius: '0' }, hairline: { left: 0, top: seam - 10, width: 1080, height: 10 },
        region: clearOfCaptions({ left: 60, top: 280, width: 800, height: seam - 40 - 280 }, aspect, placement, themed), rises: false }
    }
    if (mode === 'stage') {
      // AI music (shot grammar, 20 Nov 2026): him LARGE bottom right, face centre x 0.78, face about 0.21 of the frame wide.
      // The ink panel is the whole frame: above him and beside him is panel, never a cream band. Cut out by the matte, his
      // head stands on the panel and the region reaches down to it (his head top is at y 1073 or lower on his takes);
      // as a window, the region ends above it.
      const take = { left: 430, top: 765, width: 650, height: 1155, radius: cutout ? 0 : 44, border: false }
      const bottom = cutout ? 1040 : take.top - GAP
      return { take, panel: { left: 0, top: 0, width: 1080, height: 1920, radius: '0' }, cutout,
        corner: { left: take.left + 40, top: 1110, width: 1080 - take.left - 40, height: 1920 - 1110, radius: '56px 0 0 0' },
        region: clearOfCaptions({ left: 60, top: 280, width: 800, height: bottom - 280 }, aspect, placement, themed), rises: false }
    }
    // Over his chest, clear of his face: the tray needs the captions in the upper strip (compile refuses others).
    const r = clearOfCaptions({ left: 60, top: 900, width: 600, height: 600 }, aspect, placement, themed)
    return { take: { left: 0, top: 0, width: 1080, height: 1920, radius: 0, border: false },
      panel: { ...r, radius: '28px' }, region: { left: r.left + GAP, top: r.top + GAP, width: r.width - 2 * GAP, height: r.height - 2 * GAP }, rises: true }
  }
  if (mode === 'pillar') {
    const seam = 1920 - PILLAR_TAKE_WIDTH
    return { take: { left: seam, top: 0, width: PILLAR_TAKE_WIDTH, height: 1080, radius: 0, border: false },
      panel: { left: 0, top: 0, width: seam, height: 1080, radius: '0' }, hairline: { left: seam - 10, top: 0, width: 10, height: 1080 },
      region: clearOfCaptions({ left: 96, top: 140, width: seam - 96 - 60, height: 800 }, aspect, placement, themed), rises: false }
  }
  if (mode === 'band') {
    // The face column is the pillar's 608 px (0.32 of the frame), on the right: the Character.ai wide cut (shot grammar).
    const seam = 1920 - PILLAR_TAKE_WIDTH
    return { take: { left: seam, top: 0, width: 1920 - seam, height: 1080, radius: 0, border: false },
      panel: { left: 0, top: 0, width: seam, height: 1080, radius: '0' }, hairline: { left: seam - 10, top: 0, width: 10, height: 1080 },
      region: clearOfCaptions({ left: 96, top: 140, width: seam - 96 - 60, height: 800 }, aspect, placement, themed), rises: false }
  }
  if (mode === 'stage') {
    // The panel fills the frame but his corner (shot grammar, 20 Nov 2026): him large bottom right, cut out by the matte
    // when the take has one, the region the rest of the frame above the caption seam.
    return { take: { left: 1360, top: 380, width: 560, height: 700, radius: cutout ? 0 : 44, border: false }, cutout,
      corner: { left: 1390, top: 600, width: 530, height: 480, radius: '48px 0 0 0' },
      panel: { left: 0, top: 0, width: 1920, height: 1080, radius: '0' },
      region: clearOfCaptions({ left: 96, top: 120, width: 1240, height: 715 }, aspect, placement, themed), rises: false }
  }
  const r = clearOfCaptions({ left: 96, top: 480, width: 900, height: 540 }, aspect, placement, themed)
  return { take: { left: 0, top: 0, width: 1920, height: 1080, radius: 0, border: false },
    panel: { ...r, radius: '28px' }, region: { left: r.left + GAP, top: r.top + GAP, width: r.width - 2 * GAP, height: r.height - 2 * GAP }, rises: true }
}

/** Whether a beat is staged: it shows his take and keeps no lock of its own. Under the shot grammar (`grammar`, a band or
 *  stage cut drawn by it) a graphics-only beat stays staged too: only an anchor cut's plate and the end card leave his
 *  face (Ruling, Krish, 2026-11-20: one staging per cut). */
export function staged(beat: { layout: string; plate?: { source: string } | undefined; shot?: string | undefined },
  grammar?: { mode: string } | undefined): boolean {
  if (beat.layout === 'SPLIT' || beat.layout === 'WINDOW') return false
  if (grammar && beat.shot) return beat.shot !== 'plate' && beat.shot !== 'end'
  return !(beat.layout === 'STAGE' && beat.plate?.source === 'none')
}

/** The tray's rise from bottom left: 9 frames, a 6% overshoot on scale, ease out. 1 once landed. */
export function trayRise(frame: number, from: number): { scale: number; ty: number; opacity: number } {
  const t = Math.min(1, Math.max(0, (frame - from) / 9))
  if (t >= 1) return { scale: 1, ty: 0, opacity: 1 }
  const back = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)   // back-out, peaks near 1.06
  return { scale: 0.6 + 0.4 * back, ty: Math.round(120 * (1 - t) * (1 - t)), opacity: Math.min(1, t * 3) }
}

export function boxStyle(box: Box): CSSProperties {
  return { position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height }
}
