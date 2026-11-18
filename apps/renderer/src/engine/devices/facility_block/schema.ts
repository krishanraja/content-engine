import { z } from 'zod'
import { resolveLogo } from '../logo_card/schema'
const words = z.string().trim().min(1).refine(s => s.split(/\s+/).length <= 3, 'At most three words')
export const ParamsSchema = z.object({
  kind: z.enum(['data centre', 'data_centre', 'factory', 'office', 'warehouse']).default('data centre'),
  label: words,
  logo: z.string().refine(id => { try { resolveLogo(id); return true } catch { return false } }, 'Unregistered logo').optional(),
  tag: words.optional(),
  targets: z.array(z.object({label: words}).strict()).max(2).default([]),
  copies: z.object({count: z.number().int().min(2).max(60), kept: z.number().int().min(0).max(60)}).strict().default({count: 12, kept: 3}),
  skyline: z.object({lights: z.number().int().min(6).max(40)}).strict().default({lights: 18}),
}).strict().refine(p => p.copies.kept <= p.copies.count, 'kept exceeds count')
