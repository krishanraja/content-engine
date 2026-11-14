import { z } from 'zod'
const unit = z.number().finite().min(0).max(1)
const placement = z.object({ x: unit, y: unit, w: unit.positive(), h: unit.positive() }).strict()
  .refine(r => r.x + r.w <= 1 && r.y + r.h <= 1, 'placement must stay inside the canvas')
const clip = z.object({
  id: z.string().min(1), src: z.string().min(1), source: z.string().min(1),
  kind: z.enum(['video', 'image']).default('video'),
  trimBeforeFrames: z.number().int().nonnegative().default(0),
  tilt: z.number().finite().refine(n => Math.abs(n) >= 2 && Math.abs(n) <= 4, 'tilt must be 2 to 4 degrees').default(3),
  placement: placement.optional(),
}).strict()
/** `enter: wall` schedules the wall; `enter: <id>` and `add: <id>` place named clips.
 * `add: next` adds the next unplaced clip; `add: wall` schedules all remaining clips. */
export const ParamsSchema = z.object({
  clips: z.array(clip).min(1).max(6),
  mode: z.enum(['wall', 'placed']).default('wall'),
  intervalFrames: z.union([z.literal(6), z.literal(7)]).default(7),
}).strict().superRefine((p, ctx) => {
  if (new Set(p.clips.map(c => c.id)).size !== p.clips.length)
    ctx.addIssue({ code: 'custom', path: ['clips'], message: 'clip ids must be unique' })
  if (p.mode === 'placed' && p.clips.some(c => !c.placement))
    ctx.addIssue({ code: 'custom', path: ['clips'], message: 'placed clips need a placement' })
  if (p.clips.some(c => ['wall', 'next', 'visible'].includes(c.id)))
    ctx.addIssue({ code: 'custom', path: ['clips'], message: 'clip ids must not use reserved state names' })
})
export type Params = z.infer<typeof ParamsSchema>
