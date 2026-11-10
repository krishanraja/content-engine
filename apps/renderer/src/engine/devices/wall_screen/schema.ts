import { z } from 'zod'
const unit = z.number().finite().min(0).max(1)
const rect = z.object({ x: unit, y: unit, w: unit.positive(), h: unit.positive() }).strict()
  .refine(r => r.x + r.w <= 1 && r.y + r.h <= 1, 'rectangle must stay inside its image')
export const ParamsSchema = z.object({
  image: z.string().min(1),
  wall: z.object({ x: unit, y: unit, w: unit.positive(), h: unit.positive(), skew: z.number().finite().min(-30).max(30).default(0) }).strict()
    .refine(r => r.x + r.w <= 1 && r.y + r.h <= 1, 'wall must stay inside the slot'),
  line: rect,
  source: z.string().min(1),
  logo: z.string().min(1).optional(),
}).strict()
