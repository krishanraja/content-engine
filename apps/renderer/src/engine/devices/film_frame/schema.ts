import { z } from 'zod'
import { EngineImageSchema } from '../../props'
const Region = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict()
  .refine(r => r.x + r.width <= 1 && r.y + r.height <= 1, 'Region must fit the picture')
/** Regions are fractions of a plate's own picture, so a ring lands on the same thing whatever the slot's shape. */
export const ParamsSchema = z.object({
  /** The evidence pictures by key, each with its pixel size (the crop and the regions are worked out from it). */
  images: z.record(z.string(), EngineImageSchema),
  plates: z.array(z.object({ image: z.string().min(1), date: z.string().min(1), source: z.string().min(1) }).strict()).min(1),
  regions: z.record(z.string(), Region).default({}),
  mode: z.enum(['film', 'crt']).default('film'),
}).strict().superRefine((p, ctx) => {
  for (const plate of p.plates) if (!p.images[plate.image]) ctx.addIssue({ code: 'custom', message: `plate image ${plate.image} is not in params.images` })
})
