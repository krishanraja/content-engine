import { z } from 'zod'
const point = z.object({ x: z.number().min(0).max(1920), y: z.number().min(0).max(1920) }).strict()
export const ParamsSchema = z.object({ kind: z.enum(['outline', 'block', 'dashed']), top: z.string().optional(),
  size: z.enum(['label', 'hero']).default('label'),
  paint: z.enum(['channel', 'mint']).default('channel'),
  main: z.string().min(1), tiltDeg: z.number().min(-6).max(6),
  at: point.extend({ w: z.number().positive(), h: z.number().positive() }).strict(),
  leader: z.object({ to: point, label: z.string().optional() }).strict().optional(),
}).strict().refine(({ size, main }) => size === 'label' || /^\S+(?:\s+\S+)?$/.test(main.trim()), {
  path: ['main'], message: 'Hero stamp needs one or two words',
})
