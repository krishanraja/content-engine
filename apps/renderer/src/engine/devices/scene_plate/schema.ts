import { z } from 'zod'
export const ShotSchema = z.object({
  src: z.string().min(1), kind: z.enum(['image', 'video']).default('image'),
  width: z.number().int().positive(), height: z.number().int().positive(),
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict().default({ x: .5, y: .5 }),
  from_s: z.number().min(0).default(0),
  // A video waits on its first frame this long after it enters, so its action lands on the word that names it (Fri 20 Nov:
  // the cash came out of the sofa 2.5 s before 'missing money').
  hold_s: z.number().min(0).max(10).default(0),
}).strict()
export const ParamsSchema = z.object({
  shots: z.array(ShotSchema).min(1).max(4), camera: z.enum(['push', 'drift', 'handheld', 'still']).default('push'),
  full: z.boolean().default(true), grade: z.enum(['none', 'hud']).default('hud'),
}).strict()
