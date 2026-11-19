import { z } from 'zod'

export const ParamsSchema = z.object({ ghost: z.boolean().optional(),
  // A soft ink panel behind the figure, for a count drawn over his take (Fri 20 Nov: cream on his light wall, unreadable).
  panel: z.boolean().optional() }).strict()
