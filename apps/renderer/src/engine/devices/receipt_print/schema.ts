import { z } from 'zod'

/** add/fill/highlight.toState names a line key; count_to selects a dataset value. */
export const ParamsSchema = z.object({
  title: z.string().min(1).default('RECEIPT'),
  stampText: z.string().min(1).default('VOID'),
  lines: z.array(z.object({ key: z.string().min(1), row: z.string().min(1) }).strict()).min(1),
}).strict().refine(({ lines }) => new Set(lines.map(line => line.key)).size === lines.length, 'Line keys must be unique')
