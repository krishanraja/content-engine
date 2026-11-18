import { z } from 'zod'
const label = z.string().trim().min(1).refine(s => s.split(/\s+/).length <= 3, 'At most three words')
const layer = z.object({ label, row: z.string().min(1) }).strict()
export const ParamsSchema = z.object({
  plan: layer, bonus: layer, days: z.number().int().min(1).max(90),
  // compile resolves src against the assets folder (velib/compile.py _params), as for evidence_card
  src: z.string().min(1).refine(s => !s.split(/[\\/]/).includes('..'), 'no parent-folder steps').optional(),
  source: z.object({ outlet: z.string().min(1), date: z.string().min(1) }).strict(),
}).strict()
