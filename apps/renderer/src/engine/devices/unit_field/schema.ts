import { z } from 'zod'

/** Event toState names a dataset row: drop/grey read unit counts, multiply reads a factor, stripe reads a unit count.
 *
 *  The additive unit chart Krish asked to keep as it is (Krish, 2026-11-20: "this visual was really nice in how it
 *  explained additively what I was saying in the Anthropic jobs video"; the Mon 2 Nov jobs piece) needs, all optional and
 *  off by default so every existing cut draws as before:
 *  - `mark: 'badge'`, an ID badge with its clip slot;
 *  - the `stripe` verb, a second category: the next whole units of a named subset carry a stripe in the series colour;
 *  - `plane`, the grid laid on a plane in slight 3D (rotateX 24, rotateZ -6, skewX -4 by default);
 *  - `order`, where drop and grey take their units from (`from_end`, the default and the old behaviour, or `from_start`),
 *    and `greyScope: 'striped'`, so the striped units grey from the end of the grid;
 *  - `counter`, the numeral bound to the grid's own state in the same frame (`live` units, the old one, or the `striped`
 *    units still lit), with a `suffix` and a `numeralPx` size. */
export const ParamsSchema = z.object({
  initialRow: z.string().min(1).default('initial'),
  columns: z.number().int().min(1).max(40).default(5),
  mark: z.enum(['dot', 'block', 'badge']).default('dot'),
  order: z.enum(['from_end', 'from_start']).default('from_end'),
  greyScope: z.enum(['all', 'striped']).default('all'),
  plane: z.union([z.literal(true), z.object({ rotateX: z.number().min(0).max(40), rotateZ: z.number().min(-15).max(15),
    skewX: z.number().min(-10).max(10) }).strict()]).optional(),
  counter: z.object({ of: z.enum(['live', 'striped']).default('live'), suffix: z.string().max(3).default(''),
    numeralPx: z.number().int().min(60).max(320).default(100) }).strict().optional(),
}).strict()

export const PLANE = { rotateX: 24, rotateZ: -6, skewX: -4, perspective: 1600 } as const
