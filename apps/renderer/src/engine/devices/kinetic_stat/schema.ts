import { z } from 'zod'

export const ParamsSchema = z.object({ ghost: z.boolean().optional(),
  // A soft ink panel behind the figure, for a count drawn over his take (Fri 20 Nov: cream on his light wall, unreadable).
  panel: z.boolean().optional(),
  // Shown as money: a prefix ('$') and thousands commas on a whole count ($195,000, never 195000).
  prefix: z.string().max(3).optional(), group: z.boolean().optional(),
  // The figure is the frame's hero: bigger number and a source line of at least 30 px (key_figure_fills_frame).
  hero: z.boolean().optional(),
  // A later count starts from the value on screen (a count down), with no faded old figure (the ghost).
  carry: z.boolean().optional() }).strict()
