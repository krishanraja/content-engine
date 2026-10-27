import { z } from 'zod'

export const ParamsSchema = z.object({
  kind: z.enum(['screenshot', 'recording', 'document', 'quote']),
  src: z.string().min(1).optional(),
  quote: z.string().min(1).optional(),
  outlet: z.string().min(1),
  date: z.string().min(1),
  /** Source display ratio; recordings default to the landscape capture format. */
  sourceAspectRatio: z.number().positive().default(16 / 9),
  crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1),
    w: z.number().positive().max(1), h: z.number().positive().max(1) }).strict().optional(),
  trimBefore: z.number().int().nonnegative().default(0),
}).strict().superRefine((params, ctx) => {
  if (params.crop && (params.crop.x + params.crop.w > 1 || params.crop.y + params.crop.h > 1)) ctx.addIssue({ code: 'custom', message: 'Crop must stay inside source frame', path: ['crop'] })
  if ((params.kind === 'screenshot' || params.kind === 'recording') && !params.src) ctx.addIssue({ code: 'custom', message: 'Media evidence needs src', path: ['src'] })
  if (params.kind === 'quote' && !params.quote) ctx.addIssue({ code: 'custom', message: 'Quote evidence needs quote', path: ['quote'] })
  if (params.kind === 'document' && !params.src && !params.quote) ctx.addIssue({ code: 'custom', message: 'Document evidence needs src or quote' })
})
