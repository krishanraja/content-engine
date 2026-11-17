import { z } from 'zod'
import { EngineImageSchema } from '../../props'

const Box = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().positive().max(1), z.number().positive().max(1)])
// Paths, boxes and regions use the unit square of the picture as it is drawn (one picture), or of the picture
// region (several), so a circle round a figure stays round that figure in either shape.
export const ParamsSchema = z.object({
  images: z.array(EngineImageSchema).min(1).max(8),
  strokes: z.array(z.object({ id: z.string().min(1), d: z.string().min(1).optional(), shape: z.enum(['circle', 'underline']).optional(), box: Box.optional() }).strict()).default([]),
  regions: z.array(z.object({ id: z.string().min(1), x: z.number().min(0).max(1), y: z.number().min(0).max(1),
    rx: z.number().positive().max(1), ry: z.number().positive().max(1) }).strict()).default([]),
}).strict().superRefine((p, ctx) => {
  for (const stroke of p.strokes) {
    if (!stroke.d && !(stroke.shape && stroke.box)) ctx.addIssue({ code: 'custom', message: 'Stroke needs d or shape and box' })
  }
  for (const items of [p.strokes, p.regions]) {
    if (new Set(items.map(i => i.id)).size !== items.length) ctx.addIssue({ code: 'custom', message: 'IDs must be unique within strokes and regions' })
  }
})
