import { z } from 'zod'

export const ParamsSchema = z.object({
  kind: z.enum(['screenshot', 'recording', 'document', 'quote']),
  src: z.string().min(1).optional(),
  quote: z.string().min(1).optional(),
  outlet: z.string().min(1),
  date: z.string().min(1),
  trimBefore: z.number().int().nonnegative().default(0),
}).strict().superRefine((params, ctx) => {
  if ((params.kind === 'screenshot' || params.kind === 'recording') && !params.src) ctx.addIssue({ code: 'custom', message: 'Media evidence needs src', path: ['src'] })
  if (params.kind === 'quote' && !params.quote) ctx.addIssue({ code: 'custom', message: 'Quote evidence needs quote', path: ['quote'] })
  if (params.kind === 'document' && !params.src && !params.quote) ctx.addIssue({ code: 'custom', message: 'Document evidence needs src or quote' })
})
