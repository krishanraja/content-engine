import { z } from 'zod'

const At = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()
export const FieldSchema = z.object({
  id: z.string().min(1), label: z.string().min(1), at: At,
  state: z.enum(['stamped', 'sample', 'blank']),
  top: z.string().optional(), main: z.string().max(16).optional(),
  flag: z.enum(['usa', 'china', 'unknown']).optional(),
  tiltDeg: z.number().min(-8).max(5).default(0),
}).strict()

export const ParamsSchema = z.object({
  spine: z.enum(['left', 'right']), at: At, label: z.string().optional(),
  portrait: z.boolean().default(false), fields: z.array(FieldSchema).max(3),
  mrz: z.tuple([z.string(), z.string()]).optional(),
  ghostAI: z.boolean().default(false),
}).strict().superRefine((params, ctx) => {
  if (new Set(params.fields.map((field) => field.id)).size !== params.fields.length) {
    ctx.addIssue({ code: 'custom', path: ['fields'], message: 'Field ids must be unique' })
  }
})

export type PassportParams = z.infer<typeof ParamsSchema>
