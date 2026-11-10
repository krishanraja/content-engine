import { z } from 'zod'
export const Kind = z.enum(['human', 'synth', 'sample', 'ai', 'both'])
export const ParamsSchema = z.object({
  lanes: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(24), kind: Kind,
    who: z.string().max(28).optional(), region: z.enum(['wave', 'midi']).default('wave'), hidden: z.boolean().default(false) })).min(1).max(12),
  title: z.string().max(60).default('Arrangement'), bpm: z.number().positive().default(124), fromWave: z.boolean().default(false),
}).superRefine((p, c) => { if (new Set(p.lanes.map(l => l.id)).size !== p.lanes.length) c.addIssue({ code: 'custom', message: 'Duplicate lane id' }) })
