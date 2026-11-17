import { z } from 'zod'
import { EngineImageSchema } from '../../props'
export const Cell = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
export const MoveSchema = z.object({ id: z.string(), at: Cell }).strict()
export const ParamsSchema = z.object({
  images: z.record(z.string(), EngineImageSchema),
  sprites: z.array(z.object({ id: z.string().min(1), image: z.string(), at: Cell }).strict()).min(1).max(12),
}).strict().superRefine((p, ctx) => {
  if (new Set(p.sprites.map(s => s.id)).size !== p.sprites.length) ctx.addIssue({ code: 'custom', message: 'Unique sprite ids required' })
  for (const s of p.sprites) if (!p.images[s.image]) ctx.addIssue({ code: 'custom', message: `Missing evidence image ${s.image}` })
})
