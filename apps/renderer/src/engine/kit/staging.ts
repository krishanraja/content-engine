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
 *  - `stage` (AI music): an ink stage over y 0 to 1236 with rounded bottom corners on a cream band, and his take in a
 *    rounded window bottom right that crosses the stage edge.
 *  - `tray` (eating its own jobs): his take stays full frame and the graphics rise in a cream tray from bottom left
 *    over his chest, with a hard ink drop. His face is left clear, so the captions go in the upper strip.
 *
 *  A SPLIT or WINDOW beat keeps its own lock, and a graphics-only beat stays a full-frame takeover (the `fill` region).
 *  Pure: geometry is a function of the props alone, and every box handed to devices is a layout region they may grow
 *  into (`kit/layout.ts`, `isRegion`). */

export const STAGINGS = ['band', 'stage', 'tray'] as const
export type Staging = typeof STAGINGS[number]
export const isStaging = (mode: string | undefined): mode is Staging => (STAGINGS as readonly string[]).includes(mode ?? '')

type Aspect = '9:16' | '16:9'
type Placement = 'lower' | 'centre' | 'upper' | undefined

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

export function stagingGeometry(mode: Staging, aspect: Aspect, placement: Placement, themed: boolean): StagingGeometry {
  if (aspect === '9:16') {
    if (mode === 'band') {
      const seam = 1000
      return { take: { left: 0, top: seam, width: 1080, height: 1920 - seam, radius: 0, border: false },
        panel: { left: 0, top: 0, width: 1080, height: seam, radius: '0' }, hairline: { left: 0, top: seam - 10, width: 1080, height: 10 },
        region: clearOfCaptions({ left: 60, top: 280, width: 800, height: seam - 40 - 280 }, aspect, placement, themed), rises: false }
    }
    if (mode === 'stage') {
      const edge = 1236
      return { take: { left: 600, top: 980, width: 420, height: 700, radius: 44, border: true },
        panel: { left: 0, top: 0, width: 1080, height: edge, radius: '0 0 56px 56px' }, under: 'cream',
        region: clearOfCaptions({ left: 60, top: 280, width: 800, height: 980 - GAP - 280 }, aspect, placement, themed), rises: false }
    }
    // Over his chest, clear of his face: the tray needs the captions in the upper strip (compile refuses others).
    const r = clearOfCaptions({ left: 60, top: 900, width: 600, height: 600 }, aspect, placement, themed)
    return { take: { left: 0, top: 0, width: 1080, height: 1920, radius: 0, border: false },
      panel: { ...r, radius: '28px' }, region: { left: r.left + GAP, top: r.top + GAP, width: r.width - 2 * GAP, height: r.height - 2 * GAP }, rises: true }
  }
  if (mode === 'band') {
    const seam = 1152
    return { take: { left: seam, top: 0, width: 1920 - seam, height: 1080, radius: 0, border: false },
      panel: { left: 0, top: 0, width: seam, height: 1080, radius: '0' }, hairline: { left: seam - 10, top: 0, width: 10, height: 1080 },
      region: clearOfCaptions({ left: 96, top: 140, width: seam - 96 - 60, height: 800 }, aspect, placement, themed), rises: false }
  }
  if (mode === 'stage') {
    const edge = 880
    return { take: { left: 1400, top: 560, width: 440, height: 460, radius: 44, border: true },
      panel: { left: 0, top: 0, width: 1920, height: edge, radius: '0 0 56px 56px' }, under: 'cream',
      region: clearOfCaptions({ left: 96, top: 120, width: 1260, height: edge - 60 - 120 }, aspect, placement, themed), rises: false }
  }
  const r = clearOfCaptions({ left: 96, top: 480, width: 900, height: 540 }, aspect, placement, themed)
  return { take: { left: 0, top: 0, width: 1920, height: 1080, radius: 0, border: false },
    panel: { ...r, radius: '28px' }, region: { left: r.left + GAP, top: r.top + GAP, width: r.width - 2 * GAP, height: r.height - 2 * GAP }, rises: true }
}

/** Whether a beat is staged: it shows his take and keeps no lock of its own. */
export function staged(beat: { layout: string; plate?: { source: string } | undefined }): boolean {
  return beat.layout !== 'SPLIT' && beat.layout !== 'WINDOW' && !(beat.layout === 'STAGE' && beat.plate?.source === 'none')
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
