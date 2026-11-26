import { z } from 'zod'

/** Impact zoom (Krish, 2026-11-26: "Zoom for impact ... classy and subtle rather than too aggressive"): a small push onto
 *  his face on the cut's most impactful words, planned by ve compile (scripts/velib/impact.py) from
 *  config/ve/impact-zoom.json and drawn here on his take ONLY, so the captions, the graphics and the frame never move
 *  with it. The push eases out from the word's onset to peakFrame, holds to holdTo, then eases back to 1 by toFrame, or,
 *  with release 'cut', holds to toFrame and resets there under a picture cut. impactAt is velib/impact.py scale_at,
 *  frame for frame (tests/ve_impact_test.py holds the two to the same numbers). */
export const IMPACT_EASES = ['easeOutCubic', 'easeInOutCubic'] as const

const Frame = z.number().int().nonnegative()
export const EngineImpactSchema = z.object({
  pushEase: z.enum(IMPACT_EASES),
  releaseEase: z.enum(IMPACT_EASES),
  /** The cut's picture cuts (EDL joins), where a release may reset hidden. */
  joins: z.array(Frame),
  hits: z.array(z.object({
    w: z.number().int().nonnegative(), word: z.string().min(1),
    fromFrame: Frame, peakFrame: Frame, holdTo: Frame, toFrame: Frame,
    /** The library's hard cap is 1.5x (MOTION-FLOOR F14); config/ve/impact-zoom.json holds it to 1.15. */
    scale: z.number().gt(1).max(1.15),
    strength: z.enum(['normal', 'strong']),
    release: z.enum(['ease', 'cut']),
    /** The push's fixed point, his eyes, in the take box's own pixels. */
    originX: z.number().finite(), originY: z.number().finite(),
    eyeLine: z.number().finite(),
  }).strict().refine((h) => h.fromFrame < h.peakFrame && h.peakFrame <= h.holdTo && h.holdTo <= h.toFrame,
    { message: 'an impact push runs from, peak, hold, to, in order' })),
}).strict()
export type EngineImpact = z.infer<typeof EngineImpactSchema>

export function ease(name: (typeof IMPACT_EASES)[number], t: number): number {
  const x = Math.min(1, Math.max(0, t))
  if (name === 'easeOutCubic') return 1 - (1 - x) ** 3
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2
}

/** His take's scale and its fixed point on `frame`; scale 1 outside every push. */
export function impactAt(impact: EngineImpact | undefined, frame: number): { scale: number; originX: number; originY: number } {
  const hit = impact?.hits.find((h) => frame >= h.fromFrame && frame < h.toFrame)
  if (!impact || !hit) return { scale: 1, originX: 0, originY: 0 }
  const peak = hit.scale
  let scale: number
  if (frame < hit.peakFrame) scale = 1 + (peak - 1) * ease(impact.pushEase, (frame - hit.fromFrame) / Math.max(1, hit.peakFrame - hit.fromFrame))
  else if (frame < hit.holdTo || hit.release === 'cut') scale = peak
  else scale = peak - (peak - 1) * ease(impact.releaseEase, (frame - hit.holdTo) / Math.max(1, hit.toFrame - hit.holdTo))
  return { scale, originX: hit.originX, originY: hit.originY }
}

/** The wrapper style round his take's video: a scale about his eyes, nothing at all outside a push (so every cut without
 *  props.impact draws the tree it always did). */
export function impactStyle(impact: EngineImpact | undefined, frame: number): Record<string, string> | undefined {
  const at = impactAt(impact, frame)
  if (at.scale === 1) return undefined
  return { transform: `scale(${at.scale.toFixed(5)})`, transformOrigin: `${at.originX}px ${at.originY}px` }
}
