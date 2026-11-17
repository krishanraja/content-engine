import { z } from 'zod'
import { EngineImageSchema } from '../../props'
const Cell = z.tuple([z.number().int().min(0).max(5), z.number().int().min(0).max(5)])
export const ParamsSchema = z.object({
  blocks: z.array(z.object({ id: z.string().min(1), cell: Cell, height: z.number().positive().max(4), image: z.string().optional(), label: z.string().max(18).optional() }).strict()).min(1).max(12),
  routes: z.array(z.object({ id: z.string().min(1), cells: z.array(Cell).min(2).max(20) }).strict()).default([]),
  images: z.record(z.string(), EngineImageSchema).default({}),
}).strict().superRefine((p, ctx) => {
  for (const key of ['id', 'cell'] as const) if (new Set(p.blocks.map(b => String(b[key]))).size !== p.blocks.length) ctx.addIssue({ code: 'custom', message: `unique block ${key}` })
  if (new Set(p.routes.map(r => r.id)).size !== p.routes.length) ctx.addIssue({ code: 'custom', message: 'unique route ids' })
  for (const b of p.blocks) if (b.image && !p.images[b.image]) ctx.addIssue({ code: 'custom', message: `missing image ${b.image}` })
})
export const FillSchema = z.object({ id: z.string(), height: z.number().positive().max(4) }).strict()
