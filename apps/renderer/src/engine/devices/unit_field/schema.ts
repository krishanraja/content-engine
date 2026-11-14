import { z } from 'zod'

/** Event toState names a dataset row: drop/grey read unit counts, multiply reads a factor. */
export const ParamsSchema = z.object({
  initialRow: z.string().min(1).default('initial'),
  columns: z.number().int().min(1).max(40).default(5),
  mark: z.enum(['dot', 'block']).default('dot'),
}).strict()
