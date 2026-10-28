import { z } from 'zod'
export const ParamsSchema = z.object({
  lines: z.array(z.string().trim().min(1)).min(1).max(2),
  swipe: z.object({ line: z.number().int().min(0).max(1), word: z.number().int().nonnegative() }).strict().optional(),
  dek: z.string().min(1).optional(),
  dekAt: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), w: z.number().positive() }).strict().optional(),
  // `h` is the room the lines may fill: the 270 px headline zone by default, taller only for a splash title.
  at: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), w: z.number().positive(), h: z.number().min(270).max(420).optional() }).strict().optional(),
}).strict().superRefine((p, ctx) => {
  if (p.swipe && !p.lines[p.swipe.line]?.split(/\s+/)[p.swipe.word])
    ctx.addIssue({ code: 'custom', message: 'Swipe must address one existing word' })
})
