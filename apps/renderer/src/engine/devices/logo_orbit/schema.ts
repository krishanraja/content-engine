import { z } from 'zod'
import { resolveLogo } from '../logo_card/schema'
export { resolveLogo }
export const ParamsSchema = z.object({
  centre: z.string().min(1).optional(),
  logos: z.array(z.object({ id: z.string().min(1).refine(id => {
    try { resolveLogo(id); return true } catch { return false }
  }, 'Logo needs an approved registry asset') }).strict()).min(1).max(8),
  chips: z.array(z.string().min(1).max(24)).max(6).default([]),
  rings: z.number().int().min(1).max(3).default(2),
}).strict()
