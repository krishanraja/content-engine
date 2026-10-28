import { ENTER, EXIT, MOTION, progress, stateAt } from '../clock'
import type { EngineEvent, EngineObject, EngineTokens } from '../props'
import { CANVAS } from './lock'

export const houseTokens = (tokens: EngineTokens) => ({ ...tokens, section: tokens.channel })
export const halftone = (tokens: EngineTokens) => ({
  backgroundColor: tokens.channel,
  backgroundImage: `radial-gradient(circle at 7px 7px, ${tokens.ink} 1.7px, ${tokens.channel} 2.1px)`,
  backgroundSize: '14px 14px',
})

/** No implicit appearance: only the latest entrance starts a new visibility cycle. */
export function overlayState(object: EngineObject, events: readonly EngineEvent[], frame: number, verb = 'enter', duration: number = MOTION.enterFrames) {
  const { fired } = stateAt(events, object.obj, frame)
  const entrance = fired.findLast(e => e.verb === verb)
  const visibility = fired.findLast(e => e.verb === verb || e.verb === 'exit')
  const age = entrance ? stateAt([entrance], object.obj, frame).sinceFrames : -1
  const exit = visibility?.verb === 'exit' ? progress(stateAt([visibility], object.obj, frame).sinceFrames, MOTION.exitFrames, EXIT) : 0
  const enter = age < 0 ? 0 : progress(age, duration, ENTER)
  return { fired, entrance, age, enter, exit, opacity: enter * (1 - exit),
    visible: !!entrance && frame >= object.fromFrame && frame < object.toFrame && exit < 1 }
}

/** Reject impossible placements rather than silently clipping approved copy. */
export function canvasRect(x: number, y: number, w: number, h: number) {
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > CANVAS.w || y + h > CANVAS.h)
    throw new Error('Overlay outside 1080x1920 canvas')
  return { position: 'absolute' as const, left: x, top: y, width: w, height: h, boxSizing: 'border-box' as const }
}

export function rotatedBounds(x: number, y: number, w: number, h: number, degrees: number, shadow = 0) {
  const a = Math.abs(degrees) * Math.PI / 180
  const rw = w * Math.cos(a) + h * Math.sin(a)
  const rh = h * Math.cos(a) + w * Math.sin(a)
  canvasRect(x + (w - rw) / 2, y + (h - rh) / 2, rw + shadow, rh + shadow)
}
