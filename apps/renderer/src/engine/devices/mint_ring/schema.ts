import { z } from 'zod'

/** Target rectangle in the layout box's local pixel coordinates. No screenshot or value is redrawn. */
export const ParamsSchema = z.object({
  at: z.object({ x: z.number().finite(), y: z.number().finite(),
    w: z.number().finite().positive(), h: z.number().finite().positive() }).strict(),
}).strict()
