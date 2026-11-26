import { z } from 'zod'

const text = z.string().trim().min(1)
const crop = z
  .object({
    left: z.number().nonnegative(),
    top: z.number().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
    sourceWidth: z.number().positive(),
    sourceHeight: z.number().positive(),
  })
  .strict()
  .refine((c) => c.left + c.width <= c.sourceWidth && c.top + c.height <= c.sourceHeight)
const image = z.object({ src: text, crop: crop.optional() }).strict()
export type SourceImage = z.infer<typeof image>
const rung = z.union([z.literal(1), z.literal(2), z.literal(3)])
const strength = z.enum(['documented', 'inferred', 'open'])
const row = z.object({ label: text, strength }).strict()
const evidence = {
  image,
  source: text,
  note: text,
  strength,
  rung,
  kind: z.enum(['document', 'chart', 'place', 'creative-work', 'quote']),
  extract: z
    .object({ logo: crop, lines: z.array(crop).min(1) })
    .strict()
    .optional(),
  keyLine: z.number().min(0).max(1),
}
export const v5Params = {
  v5_title: z.object({ lines: z.array(text).min(1).max(3), image }).strict(),
  v5_why: z.object({ rung, lines: z.array(text).min(1).max(3), image }).strict(),
  v5_evidence: z.object(evidence).strict(),
  v5_callout: z.object({ label: text, x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict(),
  v5_challenger: z.object({ ...evidence, ending: z.enum(['parked', 'forked']), question: text }).strict(),
  v5_recap: z.object({ images: z.array(image).length(4), rows: z.array(row).min(1).max(3) }).strict(),
  v5_landing: z.object({ insight: text, question: text }).strict(),
  v5_close: z.object({ takeaway: text }).strict(),
  v5_rail: z
    .object({
      current: rung,
      rows: z.array(row.extend({ label: text.refine((s) => /^\S+(?:\s+\S+){1,3}$/.test(s)) })).length(3),
    })
    .strict(),
  v5_source: z.object({ source: text }).strict(),
}
export type V5Id = keyof typeof v5Params
export function isV5Id(id: string): id is V5Id {
  return Object.hasOwn(v5Params, id)
}
