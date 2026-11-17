import { z } from 'zod'
export const Params = z.object({
  object: z.enum(['capsule', 'clay', 'candy']).default('capsule'),
  parts: z.number().int().min(1).max(24).default(8),
  images: z.array(z.string().min(1)).min(1).max(1),
}).strict()
