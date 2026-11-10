import { z } from 'zod'
const fraction = z.number().finite().min(0).max(1)
export const ParamsSchema = z.object({
  bins: z.array(fraction).min(8).max(16), target: fraction, halfTarget: fraction,
  junkShare: fraction, salesLift: z.number().finite().nonnegative(),
  labels: z.object({ questions: z.string().min(1).max(40), target: z.string().min(1).max(24),
    junk: z.string().min(1).max(32).refine(s => s.trim().split(/\s+/).length <= 6), sales: z.string().min(1).max(24) }).strict(),
  source: z.string().regex(/^.+ · \d{4}-\d{2}-\d{2}$/),
}).strict().superRefine((p, ctx) => {
  const i = Math.min(p.bins.length - 1, Math.floor(p.target * p.bins.length))
  if (p.bins[i] !== Math.max(...p.bins) || p.bins[i] === 0) ctx.addIssue({ code: 'custom', message: 'Tallest bin must sit at the target' })
  if (p.halfTarget > p.target) ctx.addIssue({ code: 'custom', message: 'halfTarget must not exceed target' })
})
