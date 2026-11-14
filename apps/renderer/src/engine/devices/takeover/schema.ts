import { z } from 'zod'

/** Authored title, not a caption or a rebuilt interface. Placement belongs to the layout. */
export const ParamsSchema = z.object({
  lines: z.array(z.string().trim().min(1).max(40)).min(1).max(2),
}).strict()
