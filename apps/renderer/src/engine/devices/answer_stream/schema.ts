import { z } from 'zod'
const box = z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), w: z.number().positive(), h: z.number().positive() }).strict()
const capture = z.object({ src: z.string().min(1), pixelWidth: z.number().positive(), pixelHeight: z.number().positive() }).strict()
export const ParamsSchema = z.object({
  answer: capture, source: capture, blank: box,
  lines: z.array(box.extend({ chars: z.number().int().positive() }).strict()).min(1),
  citation: box, passage: box, label: z.string().min(1),
}).strict().superRefine((p, ctx) => {
  for (const [name, b, c] of [ ['blank', p.blank, p.answer], ['citation', p.citation, p.answer],
    ['passage', p.passage, p.source], ...p.lines.map((b, i) => [`lines.${i}`, b, p.answer] as const)] as const) {
    if (b.x + b.w > c.pixelWidth || b.y + b.h > c.pixelHeight)
      ctx.addIssue({ code: 'custom', path: [name], message: 'Box must stay within capture pixels' })
  }
})
