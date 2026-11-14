import { z } from 'zod'

/** add/highlight.toState names a line key. row names a dataset row; figures never live in params. */
export const ParamsSchema = z.object({
  title: z.string().min(1).default('RECEIPT'),
  lines: z.array(z.object({ key: z.string().min(1), row: z.string().min(1) }).strict()).min(1),
}).strict().refine(({ lines }) => new Set(lines.map(line => line.key)).size === lines.length, 'Line keys must be unique')
