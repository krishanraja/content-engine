import { z } from 'zod'
import { EngineImageSchema } from '../../props'
const point = z.object({ x: z.number().nonnegative(), y: z.number().nonnegative() }).strict()
export const ParamsSchema = z.object({
  screen: EngineImageSchema,
  targets: z.array(z.object({ id: z.string().min(1), x: z.number().nonnegative(), y: z.number().nonnegative(),
    w: z.number().positive(), h: z.number().positive(), text: z.string().optional() }).strict()).min(1),
  start: point,
  label: z.string().min(1),
}).strict().superRefine((p, ctx) => {
  if (new Set(p.targets.map(t => t.id)).size !== p.targets.length) ctx.addIssue({ code: 'custom', message: 'duplicate target id' })
  if (p.start.x > p.screen.pixelWidth || p.start.y > p.screen.pixelHeight || p.targets.some(t => t.x + t.w > p.screen.pixelWidth || t.y + t.h > p.screen.pixelHeight))
    ctx.addIssue({ code: 'custom', message: 'coordinates must fit capture' })
})
