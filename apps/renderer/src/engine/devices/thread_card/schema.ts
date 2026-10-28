import { z } from 'zod'

const coordinate = z.number().finite()
const point = z.object({ x: coordinate, y: coordinate })
export const ParamsSchema = z.object({
  stations: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), x: coordinate }).strict()),
  axis: z.object({ y: coordinate, x0: coordinate, x1: coordinate }).strict().default({ y: 240, x0: 72, x1: 946 }),
  threads: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), tally: z.string().optional(), y: coordinate,
    style: z.enum(['solid', 'dashed']), marks: z.array(z.object({ station: z.string().min(1), state: z.enum(['planted', 'bare', 'parted']) }).strict()) }).strict()).min(1),
  knot: point.extend({ label: z.string().optional() }).strict().optional(),
  end: point.extend({ label: z.string().min(1) }).strict().optional(),
  tone: z.enum(['cream', 'channel']),
}).strict().superRefine((p, ctx) => {
  const error = (message: string) => ctx.addIssue({ code: 'custom', message })
  if (new Set(p.stations.map(s => s.id)).size !== p.stations.length || new Set(p.threads.map(t => t.id)).size !== p.threads.length) error('Station and thread ids must be unique')
  if (p.axis.x1 <= p.axis.x0) error('Axis must run left to right')
  for (const t of p.threads) {
    if (new Set(t.marks.map(m => m.station)).size !== t.marks.length) error('Duplicate thread mark')
    for (const m of t.marks) if (!p.stations.some(s => s.id === m.station)) error('Unknown mark station')
  }
  if (p.end && !p.knot) error('An end requires a knot')
})
