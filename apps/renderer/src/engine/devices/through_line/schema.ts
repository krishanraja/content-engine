import { z } from 'zod'

const id = z.string().min(1)
const positive = z.number().finite().positive()
export const NumberSchema = z.object({
  value: z.number().finite(), unit: z.string(), producer: id, date: id,
}).strict()
const target = { part: id, annotation: z.string().refine(s => s.trim().split(/\s+/).filter(Boolean).length <= 6).optional() }
export const CommandSchema = z.discriminatedUnion('verb', [
  z.object({ ...target, verb: z.literal('count_to'), number: NumberSchema }).strict(),
  z.object({ ...target, verb: z.literal('thin'), thickness: positive.max(1) }).strict(),
  z.object({ ...target, verb: z.literal('grow'), size: positive, number: NumberSchema.optional() }).strict(),
  z.object({ ...target, verb: z.literal('multiply'), factor: positive, number: NumberSchema.optional() }).strict(),
  z.object({ ...target, verb: z.literal('drop'), count: z.number().finite().nonnegative().optional(), number: NumberSchema.optional() }).strict(),
  z.object({ ...target, verb: z.literal('light'), number: NumberSchema.optional() }).strict(),
  z.object({ ...target, verb: z.literal('connect'), to: id }).strict(),
  z.object({ ...target, verb: z.literal('rest_on') }).strict(),
])
export const ParamsSchema = z.object({
  parts: z.array(z.object({
    id, label: id, kind: z.enum(['rung', 'bar', 'units']),
    number: NumberSchema.optional(), size: positive.default(1),
    thickness: positive.max(1).default(1), count: z.number().finite().nonnegative().max(1000).default(0),
  }).strict()).min(1).max(12),
  states: z.record(id, CommandSchema),
}).strict().superRefine((p, ctx) => {
  const ids = p.parts.map(part => part.id)
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Part ids must be unique' })
  for (const c of Object.values(p.states)) {
    const part = p.parts.find(part => part.id === c.part)
    if (!part || (c.verb === 'connect' && !ids.includes(c.to)))
      ctx.addIssue({ code: 'custom', message: 'Commands must name existing parts' })
    if (part && c.verb === 'count_to' && part.number && part.number.unit !== c.number.unit)
      ctx.addIssue({ code: 'custom', message: 'A part cannot change its number unit' })
    if (part && ((c.verb === 'drop' && c.count !== undefined) || c.verb === 'multiply') && part.kind !== 'units')
      ctx.addIssue({ code: 'custom', message: 'Count drops and multiplication require unit marks' })
  }
})
