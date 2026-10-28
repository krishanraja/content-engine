import { z } from 'zod'
export const ParamsSchema = z.object({ quote: z.string().min(1), label: z.string().min(1),
  at: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), w: z.number().min(300) }).strict() }).strict()
