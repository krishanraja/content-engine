import { z } from 'zod'

export const ParamsSchema = z.object({
  kind: z.enum(['chat', 'notification', 'order', 'email', 'choice']),
  rows: z.array(z.object({
    who: z.string().min(1).max(40).optional(),
    text: z.string().min(1).max(80),
    side: z.enum(['left', 'right']).optional(),
  }).strict()).min(1).max(6),
  status: z.string().min(1).max(40).optional(),
  options: z.array(z.string().min(1).max(80)).min(2).max(4).optional(),
  picked: z.number().int().nonnegative().optional(),
}).strict().superRefine((p, ctx) => {
  if (p.kind === 'choice' && !p.options) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'choice requires options', path: ['options'] })
  if (p.kind !== 'choice' && (p.options || p.picked !== undefined)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'options and picked belong to choice' })
  if (p.picked !== undefined && (!p.options || p.picked >= p.options.length)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'picked must index an option', path: ['picked'] })
})
