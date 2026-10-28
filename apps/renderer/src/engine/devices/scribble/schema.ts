import { z } from 'zod'

const num = z.number().finite()
const point = z.tuple([num, num])
const target = z.object({ x: num, y: num, w: num.positive(), h: num.positive() }).strict()
const common = { colour: z.enum(['cream', 'mint']), seed: z.string() }
const loop = z.object({ ...common, shape: z.literal('loop'), cx: num.optional(), cy: num.optional(),
  u: point.optional(), v: point.optional(), target: target.optional(), turns: num.positive().max(4).optional(),
  sq: num.positive().optional(), perspective: z.object({ u: point, v: point }).strict().optional() }).strict()
  .refine(p => (p.target !== undefined || (p.cx !== undefined && p.cy !== undefined)) &&
    (p.target !== undefined || p.perspective !== undefined || (p.u !== undefined && p.v !== undefined)),
    'loop needs a target or centre and both half-axis vectors')
const underline = z.object({ ...common, shape: z.literal('underline'), from: point.optional(), to: point.optional(),
  target: target.optional(), amp: num.nonnegative().optional(), double: z.boolean().optional() }).strict()
  .refine(p => p.target !== undefined || (p.from !== undefined && p.to !== undefined), 'underline needs a target or endpoints')
export const ParamsSchema = z.discriminatedUnion('shape', [loop, underline,
  z.object({ ...common, shape: z.literal('arrow'), from: point, to: point, bend: num.optional(), head: num.positive().optional() }).strict(),
  z.object({ ...common, shape: z.literal('bracket'), x: num, y0: num, y1: num, depth: num.positive().optional(), side: z.union([z.literal(1), z.literal(-1)]).optional() }).strict(),
  z.object({ ...common, shape: z.literal('tick'), cx: num, cy: num, size: num.positive() }).strict(),
  z.object({ ...common, shape: z.literal('cross'), cx: num, cy: num, size: num.positive() }).strict(),
])
