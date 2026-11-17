import { z } from 'zod'
import { EngineImageSchema } from '../../props'
export const ParamsSchema = z.object({
  parts: z.array(z.object({ id: z.string().min(1), image: z.string().optional(), label: z.string().max(24).optional() }).strict()).min(1).max(8),
  links: z.array(z.object({ from: z.string(), to: z.string() }).strict()).default([]),
  images: z.record(z.string(), EngineImageSchema).default({}),
}).strict().superRefine((p, ctx) => {
  const ids = new Set(p.parts.map(b => b.id))
  if (ids.size !== p.parts.length) ctx.addIssue({code:'custom',message:'duplicate part id'})
  for (const b of p.parts) if (b.image && !p.images[b.image]) ctx.addIssue({code:'custom',message:'missing evidence image'})
  for (const l of p.links) if (!ids.has(l.from) || !ids.has(l.to)) ctx.addIssue({code:'custom',message:'unknown link endpoint'})
})
export const FillSchema = z.object({id:z.string(), level:z.number().min(0).max(1)}).strict()
