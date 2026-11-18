import { z } from 'zod'
export const ShotSchema = z.object({
  src: z.string().min(1), kind: z.enum(['image', 'video']).default('image'),
  width: z.number().int().positive(), height: z.number().int().positive(),
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict().default({ x: .5, y: .5 }),
  from_s: z.number().min(0).default(0),
}).strict()
export const ParamsSchema = z.object({
  shots: z.array(ShotSchema).min(1).max(4), camera: z.enum(['push', 'drift', 'handheld', 'still']).default('push'),
  full: z.boolean().default(true), grade: z.enum(['none', 'hud']).default('hud'),
}).strict()
