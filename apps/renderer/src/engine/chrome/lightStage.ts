import type { EngineRenderProps } from '../props'

/** face-with-proof's graphics beats sit on the light wash its SPLIT stage already uses, with the same mark tile and
 *  pill, so every beat wears one brand treatment (the signed motion standard: "a pale gradient wash, never flat white
 *  or black"; Krish, 2026-11-03: "The branding is wrong"). Other formats keep their ink STAGE and its header. */
export function lightStage(props: Pick<EngineRenderProps, 'format'>): boolean {
  return props.format === 'face-with-proof'
}
