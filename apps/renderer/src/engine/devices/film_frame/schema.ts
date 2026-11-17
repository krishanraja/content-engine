import { z } from 'zod'
const Region = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict()
  .refine(r => r.x + r.width <= 1 && r.y + r.height <= 1, 'Region must fit the picture')
export const ParamsSchema = z.object({
  /** A plate image may be a supplied URI or a key into the evidence image map. */
  images: z.record(z.string(), z.string().min(1)).default({}),
  plates: z.array(z.object({ image: z.string().min(1), date: z.string().min(1), source: z.string().min(1) }).strict()).min(1),
  regions: z.record(z.string(), Region).default({}),
  mode: z.enum(['film', 'crt']).default('film'),
}).strict()
