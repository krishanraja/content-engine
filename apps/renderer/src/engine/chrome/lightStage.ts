import type { EngineRenderProps } from '../props'
import { resolveMotion } from '../kit/motionProfiles'

/** face-with-proof's graphics beats sit on the light wash its SPLIT stage already uses, with the same mark tile and
 *  pill, so every beat wears one brand treatment (the signed motion standard: "a pale gradient wash, never flat white
 *  or black"; Krish, 2026-11-03: "The branding is wrong"). Other formats keep their ink STAGE and its header, and so
 *  does a motion style that brings its own dark ground; a style on the house ground (living-ui) keeps the wash. */
export function lightStage(props: Pick<EngineRenderProps, 'format'> & Partial<Pick<EngineRenderProps, 'motion'>>): boolean {
  if (props.format !== 'face-with-proof') return false
  const profile = resolveMotion(props.motion)
  return !profile || profile.ground.kind === 'house'
}
