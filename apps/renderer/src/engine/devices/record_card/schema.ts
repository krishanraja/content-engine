import { z } from 'zod'

export const ParamsSchema = z.object({
  fields: z.array(z.object({ key: z.string().regex(/^[^=]+$/, 'Field keys cannot contain ='), label: z.string().min(1), value: z.string() }).strict()).min(1),
}).strict().refine(({ fields }) => new Set(fields.map((field) => field.key)).size === fields.length, 'Field keys must be unique')
