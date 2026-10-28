import { z } from 'zod'

export const ParamsSchema = z.object({ text: z.string().min(1) }).strict()
