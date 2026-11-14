import { z } from 'zod'

/** fill.toState names a slot id. Displayed ordinals live in dataset.rows, keyed by that id. */
export const ParamsSchema = z.object({
  slots: z.array(z.object({ id: z.string().min(1), line: z.string().min(1) }).strict()).min(1).max(6),
}).strict().superRefine(({ slots }, ctx) => {
  if (new Set(slots.map(slot => slot.id)).size !== slots.length) {
    ctx.addIssue({ code: 'custom', path: ['slots'], message: 'Slot ids must be unique' })
  }
})
