import { z } from 'zod'
import registry from '../../../../../../config/logo-registry.json'

// The existing registry identifies approved marks by company and variant.
// Full-colour is the default; company:variant selects an explicit variant.
export function resolveLogo(id: string): string {
  const marks = registry.marks as { company: string; variant: string; file: string }[]
  const mark = marks.find(m => `${m.company}:${m.variant}` === id ||
    (m.company === id && m.variant === 'full_colour'))
  if (!mark || !mark.file || /^(?:[a-z]+:|\/)|(?:^|\/)\.\.(?:\/|$)/i.test(mark.file)) {
    throw new Error(`Unregistered logo asset: ${id}`)
  }
  return mark.file
}
export const ParamsSchema = z.object({
  logos: z.array(z.object({ id: z.string().min(1).refine(id => {
    try { resolveLogo(id); return true } catch { return false }
  }, 'Logo needs an approved mark in config/logo-registry.json') }).strict()).min(1).max(4),
  label: z.string().min(1).max(100).optional(),
}).strict()
