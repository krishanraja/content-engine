import { z } from 'zod'
const point = z.object({ x: z.number().min(0).max(1920), y: z.number().min(0).max(1920) }).strict()
export const ParamsSchema = z.object({ kind: z.enum(['outline', 'block', 'dashed']), top: z.string().optional(),
  main: z.string().min(1), tiltDeg: z.number().min(-6).max(6),
  at: point.extend({ w: z.number().positive(), h: z.number().positive() }).strict(),
  leader: z.object({ to: point, label: z.string().optional() }).strict().optional(), }).strict()
