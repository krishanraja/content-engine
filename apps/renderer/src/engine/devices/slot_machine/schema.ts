import { z } from 'zod'
export const ParamsSchema = z.object({
  lyrics: z.string().max(240).refine(s => s.split('\n').length <= 4 && s.split('\n').every(l => l.length <= 60), 'Up to four short lines'),
  style: z.string().min(1).max(120),
  source: z.string().min(1).max(100),
  songs: z.tuple([z.object({ title: z.string().min(1).max(40), length: z.string().min(1).max(12) }).strict(),
    z.object({ title: z.string().min(1).max(40), length: z.string().min(1).max(12) }).strict()]),
  logo: z.string().min(1).optional(),
}).strict()
