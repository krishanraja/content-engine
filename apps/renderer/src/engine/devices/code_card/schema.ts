import { z } from 'zod'

export const ParamsSchema = z.object({
  file: z.object({
    path: z.string().min(1), revision: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), label: z.string().min(1),
  }).strict(),
  lines: z.array(z.object({ id: z.string().min(1), text: z.string(), typed: z.boolean() }).strict()).min(1).max(10),
}).strict().superRefine((p, ctx) => {
  if (new Set(p.lines.map(l => l.id)).size !== p.lines.length)
    ctx.addIssue({ code: 'custom', message: 'code_card line ids must be unique' })
  for (const l of p.lines) if (/[\r\n\t]/.test(l.text))
    ctx.addIssue({ code: 'custom', message: `code_card line ${l.id} must be one line with spaces` })
})
