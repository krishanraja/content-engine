import { z } from 'zod'
export const ParamsSchema = z.object({ text: z.string().min(1), tiltDeg: z.number().min(-8).max(5),
  at: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative() }).strict(),
  tone: z.enum(['channel', 'cream']), }).strict()
