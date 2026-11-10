import { z } from 'zod'
export const ParamsSchema = z.object({
  tiles: z.number().int().min(100).max(600),
  aiShare: z.number().min(0).max(1).optional(),
  listensShare: z.number().min(0).max(1).optional(),
  query: z.string().min(1).max(100),
  answer: z.object({ title: z.string().min(1).max(100), artist: z.string().min(1).max(100) }).strict(),
}).strict()
