import type { CSSProperties } from 'react'
import { ENTER, EXIT, HERO, MOTION, progress } from '../clock'
import type { EngineBeat, EngineTokens } from '../props'
import type { MotionProfile } from './motionProfiles'
import { entranceStyle } from './reveal'

/** What a motion style does to a whole beat: how it arrives (the style's transition, or the previous beat's own
 *  transitionOut), how it leaves (zoom_out), the camera over it and the light across its ground. Only called with a
 *  profile; with none the composition draws exactly what it drew before styles rendered. */

export interface Box { left: number; top: number; width: number; height: number }
export interface BeatMotion { layer: CSSProperties; dim: number }

const linear = (t: number) => t

export function beatMotion(profile: MotionProfile, beats: readonly EngineBeat[], index: number, frame: number,
  focus: Box | undefined, width: number, height: number): BeatMotion {
  const beat = beats[index]!
  const prev = index > 0 ? beats[index - 1] : undefined
  const t = frame - beat.fromFrame
  const length = beat.toFrame - beat.fromFrame
  const transforms: string[] = []
  const layer: CSSProperties = {}
  let opacity = 1
  // Arriving. The opening beat is already landed (clock.stateAt pre-rolls opening entrances); carry means the
  // previous beat's objects continue, so nothing arrives. 'cut' leaves the choice to the style.
  if (prev && prev.transitionOut !== 'carry') {
    if (prev.transitionOut === 'cut_on_curve' || profile.transition === 'cut_on_curve') {
      const e = entranceStyle(progress(t, MOTION.enterFrames, ENTER))
      if (e.transform) transforms.push(e.transform)
      if (e.clipPath) layer.clipPath = e.clipPath
      opacity *= Number(e.opacity ?? 1)
    } else if (profile.transition === 'crossfade') {
      opacity *= progress(t, MOTION.enterFrames, linear)
    }
  }
  // Leaving: a zoom_out beat pulls back and fades over its last exit frames instead of unmounting hard.
  if (beat.transitionOut === 'zoom_out' && index < beats.length - 1) {
    const q = progress(t - (length - MOTION.exitFrames), MOTION.exitFrames, EXIT)
    transforms.push(`scale(${1 - 0.06 * q})`)
    opacity *= 1 - q
  }
  let dim = 1
  let origin = `${width / 2}px ${height / 2}px`
  const camera = profile.camera
  if (camera.kind === 'push') {
    transforms.push(`scale(${1 + (camera.scaleTo - 1) * progress(t, length, HERO)})`)
  } else if (camera.kind === 'zoomToFocus' && focus) {
    // Zoom to the one element that proves the words, never so far that it leaves the frame.
    const cx = focus.left + focus.width / 2, cy = focus.top + focus.height / 2
    const fit = Math.min(2 * Math.min(cx, width - cx) / focus.width, 2 * Math.min(cy, height - cy) / focus.height)
    const scale = Math.max(1, Math.min(camera.scaleTo, fit))
    const z = progress(t - MOTION.enterFrames, 12, HERO)
    transforms.push(`scale(${1 + (scale - 1) * z})`)
    origin = `${cx}px ${cy}px`
    if (camera.dimOthers) dim = 1 - 0.6 * z
  } else if (camera.kind === 'followPen') {
    // Eases across with the drawing, slightly enlarged so no edge shows.
    const x = width * 0.015 * (1 - 2 * progress(t, length, HERO))
    transforms.push(`translateX(${x.toFixed(3)}px) scale(${camera.scaleTo})`)
  }
  if (transforms.length) { layer.transform = transforms.join(' '); layer.transformOrigin = origin }
  if (opacity !== 1) layer.opacity = opacity
  return { layer, dim }
}

/** The ground a style lays behind a STAGE beat with no plate: the house radial wash, or ink_deep. */
export function stageGround(profile: MotionProfile | undefined, tokens: EngineTokens): CSSProperties {
  return profile?.ground.kind === 'inkDeep' ? { background: tokens.inkDeep }
    : { background: `radial-gradient(ellipse at center, ${tokens.inkSoft} 0%, ${tokens.inkDeep} 100%)` }
}

/** One soft light sweep across a graphic beat's ground, at most one a beat (dark-keynote). Brand roles only. */
export function sweepStyle(profile: MotionProfile, tokens: EngineTokens, beat: EngineBeat, frame: number): CSSProperties | null {
  const frames = profile.ground.sweepFrames
  if (!frames) return null
  const q = progress(frame - beat.fromFrame, frames, linear)
  if (q <= 0 || q >= 1) return null
  const at = -20 + 140 * q
  return { background: `linear-gradient(105deg, transparent ${at - 16}%, color-mix(in srgb, ${tokens.cream} 16%, transparent) ${at}%, transparent ${at + 16}%)` }
}

/** The halftone a riso style lays on images only (his take): soft ink dots at 8 px, type left crisp. */
export function halftoneTexture(tokens: EngineTokens): CSSProperties {
  return { backgroundImage: `radial-gradient(circle at 4px 4px, ${tokens.ink} 1.6px, transparent 2.4px)`, backgroundSize: '8px 8px',
    opacity: 0.32, mixBlendMode: 'multiply' }
}
