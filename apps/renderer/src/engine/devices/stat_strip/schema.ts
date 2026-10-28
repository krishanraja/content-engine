import { z } from 'zod'
export const ParamsSchema = z.object({ label: z.string().min(1), numeral: z.string().min(1), unit: z.string().optional(),
  at: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), w: z.number().positive() }).strict().optional(), }).strict()
