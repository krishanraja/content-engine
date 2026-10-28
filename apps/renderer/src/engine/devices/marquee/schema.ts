import { z } from 'zod'
export const ParamsSchema = z.object({ items: z.array(z.string().min(1)).min(1),
  at: z.object({ y: z.number().nonnegative(), h: z.number().min(55) }).strict().optional(), }).strict()
