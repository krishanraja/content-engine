import { z } from 'zod'

/** 'strip' (the default): one mono strip across the marquee zone, as it always was.
 *  'tape' (the platform walkthrough's event tape, kept as it is: Krish, 2026-11-20): two rotated tapes in the series colour
 *  across the layout box, items[0] the display line (Anton) and items[1] the filing line (Plex Mono 600, the source,
 *  additive), sliding in from opposite sides 3 frames apart on the hero curve, then drifting so they never stop; and
 *  `chips` confetti chips that burst once on the entrance and are gone by 1.2 s. */
export const ParamsSchema = z.object({ items: z.array(z.string().min(1)).min(1),
  at: z.object({ y: z.number().nonnegative(), h: z.number().min(55) }).strict().optional(),
  mode: z.enum(['strip', 'tape']).default('strip'),
  chips: z.number().int().min(0).max(16).default(12),
}).strict().superRefine((p, ctx) => {
  if (p.mode === 'tape' && p.items.length !== 2)
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'an event tape has two items: the display line, then the filing line' })
})

/** The two tapes, as fractions of the layout box: where each sits, how it turns, and the side it comes from. */
export const TAPE = {
  display: { y: 0.2, rotate: -6, from: -1, px: 0.052 },
  filing: { y: 0.8, rotate: 5, from: 1, px: 0.026 },
  slideFrames: 10, staggerFrames: 3, driftPxPerFrame: 1.2, chipFrames: 36, chipTravel: 0.32,
} as const
