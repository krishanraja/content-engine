import type { CSSProperties } from 'react'
import { ENTER, EXIT, HERO, MOTION, progress } from '../clock'
import type { EngineBeat, EngineTokens } from '../props'
import type { MotionProfile } from './motionProfiles'
import { entranceStyle } from './reveal'
import { followPen, zoomTarget, type Focus, type Point, type Room } from './focus'

/** What a motion style does to a whole beat: how it arrives (the style's transition, or the previous beat's own
 *  transitionOut), how it leaves (zoom_out), the camera over it and the light across its ground. Only called with a
 *  profile; with none the composition draws exactly what it drew before styles rendered. */

export interface Box { left: number; top: number; width: number; height: number }
/** layer: the beat's graphics layer. dim: the opacity of every device but the focus. fade: the opacity of the whole
 *  beat, ground included, while a crossfade carries it in (the composition fades the outgoing beat out under it). */
export interface BeatMotion { layer: CSSProperties; dim: number; fade: number }

/** What the camera can see on this beat (kit/focus.ts): a focus a device reports and the room it must stay in, the
 *  first device's box for a device that reports none, and a pen to follow. */
export interface CameraView { focus?: Focus | undefined; room?: Room | undefined; fallback?: Box | undefined; pen?: ((frame: number) => Point | undefined) | undefined }

const linear = (t: number) => t
const lerp = (a: number, b: number, q: number) => a + (b - a) * q
const fixed = (n: number) => n.toFixed(4)

/** How many frames a crossfade (or a carry's fade out) lasts: the profile's own, else its exit, held to 6 to 10. */
export function transitionFrames(profile: MotionProfile): number {
  return profile.transitionFrames ?? Math.min(10, Math.max(6, profile.exitFrames))
}

/** Whether the beat stays mounted, fading out under the next one, for that many frames after its end. */
export function keepsOutgoing(profile: MotionProfile | undefined, beat: EngineBeat, next: EngineBeat | undefined): boolean {
  return !!profile && !!next && next.fromFrame === beat.toFrame && (profile.transition === 'crossfade' || beat.transitionOut === 'carry')
}

export function beatMotion(profile: MotionProfile, beats: readonly EngineBeat[], index: number, frame: number,
  view: CameraView, width: number, height: number): BeatMotion {
  const beat = beats[index]!
  const prev = index > 0 ? beats[index - 1] : undefined
  const t = frame - beat.fromFrame
  const length = beat.toFrame - beat.fromFrame
  const transforms: string[] = []
  const layer: CSSProperties = {}
  let opacity = 1
  let fade = 1
  // Arriving. The opening beat is already landed (clock.stateAt pre-rolls opening entrances); carry means the
  // previous beat's objects continue, so nothing arrives. 'cut' leaves the choice to the style.
  if (prev && prev.transitionOut !== 'carry') {
    if (prev.transitionOut === 'cut_on_curve' || profile.transition === 'cut_on_curve') {
      const e = entranceStyle(progress(t, MOTION.enterFrames, ENTER))
      if (e.transform) transforms.push(e.transform)
      if (e.clipPath) layer.clipPath = e.clipPath
      opacity *= Number(e.opacity ?? 1)
    } else if (profile.transition === 'crossfade') {
      // A true crossfade: the whole beat fades in while the one before stays mounted and fades out under it.
      fade = progress(t, transitionFrames(profile), linear)
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
  const ox = width / 2, oy = height / 2
  const camera = profile.camera
  if (camera.kind === 'push') {
    transforms.push(`scale(${1 + (camera.scaleTo - 1) * progress(t, length, HERO)})`)
  } else if (camera.kind === 'zoomToFocus' && view.focus && view.room) {
    // Zoom to the line that proves the words (up to the profile's scale; the card's own edges may leave the frame),
    // the line kept inside the channel safe area and off his face. From line to line the camera travels.
    const { focus, room } = view
    const zoomIn = progress(Math.min(focus.since, t - MOTION.enterFrames), 12, HERO)
    const move = focus.from ? progress(focus.since, 12, HERO) : 1
    const rect = focus.from ? { left: lerp(focus.from.left, focus.rect.left, move), top: lerp(focus.from.top, focus.rect.top, move),
      width: lerp(focus.from.width, focus.rect.width, move), height: lerp(focus.from.height, focus.rect.height, move) } : focus.rect
    const target = zoomTarget(rect, room, camera.scaleTo)
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
    const s = 1 + (target.scale - 1) * zoomIn
    const mx = lerp(cx, target.centre[0], zoomIn), my = lerp(cy, target.centre[1], zoomIn)
    // About the layer's centre: the focus centre lands on (mx, my) at scale s.
    transforms.push(`translate(${fixed(mx - ox - s * (cx - ox))}px, ${fixed(my - oy - s * (cy - oy))}px) scale(${fixed(s)})`)
    if (camera.dimOthers) dim = 1 - 0.6 * zoomIn
  } else if (camera.kind === 'zoomToFocus' && view.fallback) {
    // A device that reports no line: zoom to its box, never so far that it leaves the frame.
    const focus = view.fallback
    const cx = focus.left + focus.width / 2, cy = focus.top + focus.height / 2
    const fit = Math.min(2 * Math.min(cx, width - cx) / focus.width, 2 * Math.min(cy, height - cy) / focus.height)
    const scale = Math.max(1, Math.min(camera.scaleTo, fit))
    const z = progress(t - MOTION.enterFrames, 12, HERO)
    transforms.push(`scale(${1 + (scale - 1) * z})`)
    origin = `${cx}px ${cy}px`
    if (camera.dimOthers) dim = 1 - 0.6 * z
  } else if (camera.kind === 'followPen' && view.pen) {
    // Follow the pen tip with a damped follow, closing in as it draws; never far enough to show past the canvas.
    const follow = followPen(view.pen, beat.fromFrame, frame, [ox, oy])
    const s = 1 + (camera.scaleTo - 1) * follow.amount
    const cap = (n: number, room: number) => Math.max(-room, Math.min(room, n))
    const tx = cap(-s * (follow.centre[0] - ox), (s - 1) * ox), ty = cap(-s * (follow.centre[1] - oy), (s - 1) * oy)
    transforms.push(`translate(${fixed(tx)}px, ${fixed(ty)}px) scale(${fixed(s)})`)
  } else if (camera.kind === 'followPen') {
    // No pen on this beat: eases across, slightly enlarged so no edge shows.
    const x = width * 0.015 * (1 - 2 * progress(t, length, HERO))
    transforms.push(`translateX(${x.toFixed(3)}px) scale(${camera.scaleTo})`)
  }
  if (transforms.length) { layer.transform = transforms.join(' '); layer.transformOrigin = origin }
  if (opacity !== 1) layer.opacity = opacity
  return { layer, dim, fade }
}

/** The ground a style lays behind a STAGE beat with no plate: the house radial wash, or ink_deep (dark-keynote, and the
 *  dark ground of hud-terminal and line-boil). */
export function stageGround(profile: MotionProfile | undefined, tokens: EngineTokens): CSSProperties {
  return profile?.ground.kind === 'inkDeep' || profile?.ground.kind === 'dark' ? { background: tokens.inkDeep }
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

/** The lit, vignette and hatched grounds (motion profile ground.texture), or null for the others. Pure in the frame:
 *  lit drifts its two glows on a slow sine, hatched scrolls its diagonals 1 px a frame. Brand roles only. */
export function groundTexture(texture: string | undefined, tokens: EngineTokens, frame: number): CSSProperties | null {
  if (texture === 'lit') {
    const dx = 4 * Math.sin(frame / 90), dy = 3 * Math.cos(frame / 110)
    return { backgroundImage: [
      `radial-gradient(circle at ${18 + dx}% ${14 + dy}%, color-mix(in srgb, ${tokens.channel} 34%, transparent) 0%, transparent 42%)`,
      `radial-gradient(circle at ${84 - dx}% ${86 - dy}%, color-mix(in srgb, ${tokens.mint} 26%, transparent) 0%, transparent 40%)`,
      `linear-gradient(color-mix(in srgb, ${tokens.cream} 6%, transparent) 1px, transparent 1px)`,
      `linear-gradient(90deg, color-mix(in srgb, ${tokens.cream} 6%, transparent) 1px, transparent 1px)`,
    ].join(', '), backgroundSize: '100% 100%, 100% 100%, 54px 54px, 54px 54px' }
  }
  if (texture === 'vignette') return { background: `radial-gradient(ellipse at 50% 45%, ${tokens.inkSoft} 0%, ${tokens.ink} 78%)` }
  if (texture === 'hatched') return hatched(tokens, frame)
  return null
}

/** The AI material: inkSoft diagonals scrolling slowly, a fill for any band, card or chip whose subject is made by AI. */
export function hatched(tokens: EngineTokens, frame: number): CSSProperties {
  return { backgroundImage: `repeating-linear-gradient(135deg, ${tokens.inkSoft} 0 6px, transparent 6px 18px)`,
    backgroundPosition: `${frame % 25}px 0`, opacity: 0.55 }
}
