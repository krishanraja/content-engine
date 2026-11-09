import { z } from 'zod'
export const ParamsSchema = z.object({
  figures: z.array(z.object({ id: z.string().min(1), label: z.string().max(14).optional() }).strict()).min(3).max(8)
    .refine(a => new Set(a.map(f => f.id)).size === a.length, 'unique figure ids'),
  towerLabel: z.string().min(1).max(24),
  fromCrates: z.boolean().default(false),
  target: z.number().min(0).max(1).default(1),
}).strict()
export const FillSchema = z.object({ id: z.string(), to: z.number().min(0).max(1) }).strict()
export const MoveSchema = z.object({ id: z.string(), rank: z.number().int().min(1).max(8) }).strict()
export const StampSchema = z.object({ id: z.string(), text: z.string().min(1).max(24) }).strict()
export const TargetSchema = z.number().min(0).max(1)
