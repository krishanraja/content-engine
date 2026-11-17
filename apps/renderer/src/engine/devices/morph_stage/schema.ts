import { z } from 'zod'
import { EngineImageSchema } from '../../props'
const Outline = z.enum(['rectangle', 'circle', 'triangle', 'diamond'])
const Role = z.enum(['ink', 'inkDeep', 'inkSoft', 'cream', 'mint'])
const State = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('shape'), shape: Outline, points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(3).optional(), role: Role.default('cream') }).strict(),
  z.object({ kind: z.literal('image'), image: z.number().int().nonnegative(), shape: Outline.default('rectangle'), role: Role.default('cream') }).strict(),
  z.object({ kind: z.literal('number'), row: z.number().int().nonnegative(), shape: Outline.default('rectangle'), role: Role.default('cream') }).strict(),
])
export const ParamsSchema = z.object({ states: z.array(State).min(2), images: z.array(EngineImageSchema).default([]) }).strict().superRefine((p, ctx) => {
  for (const s of p.states) if (s.kind === 'image' && !p.images[s.image]) ctx.addIssue({ code: 'custom', message: 'Image state must reference supplied evidence' })
})
export type MorphState = z.infer<typeof State>
