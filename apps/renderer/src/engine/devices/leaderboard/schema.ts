import { z } from 'zod'
export const ParamsSchema = z.object({
  rows: z.array(z.object({ label: z.string().min(1), value: z.number().min(0).max(1), alt: z.number().min(0).max(1).optional() }).strict()).min(3).max(7),
  header: z.string().min(1), altHeader: z.string().min(1).optional(), note: z.string().optional(),
}).strict().refine(p => new Set(p.rows.map(r => r.label)).size === p.rows.length, 'Row labels must be unique')
export const RowTarget = z.object({ row: z.string().min(1) }).strict()
export const StampTarget = RowTarget.extend({ text: z.string().min(1) })
