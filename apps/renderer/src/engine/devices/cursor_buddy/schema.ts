import { z } from 'zod'
export const MoodSchema = z.enum(['eager', 'proud', 'sulk', 'cool'])
export const ParamsSchema = z.object({
  mood: MoodSchema.default('eager'),
  prop: z.enum(['none', 'card']).default('none'),
}).strict()
export const PositionSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()
