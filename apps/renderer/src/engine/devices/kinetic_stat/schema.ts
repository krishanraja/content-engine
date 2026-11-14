import { z } from 'zod'

export const ParamsSchema = z.object({ ghost: z.boolean().optional() }).strict()
