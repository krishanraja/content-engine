import { z } from 'zod'
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const ParamsSchema = z.object({
  comment: z.string().min(1).max(80),
  agents: count.max(40).default(10),
  tokens: z.object({ from: count, to: count }).strict(),
  rank: z.object({ from: count, to: count }).strict(),
  labels: z.object({ meter: z.string().min(1).max(24), rank: z.string().min(1).max(24) }).strict(),
  annotation: z.string().min(1).max(60).refine(s => s.trim().split(/\s+/).length <= 6).optional(),
}).strict().refine(p => p.tokens.to >= p.tokens.from, 'tokens must count up')
