import { z } from 'zod'

/** Cues: enter/visible shows the grey quote; enter/word:N speaks zero-based word N;
 * enter/attribution draws the source and date; highlight/word:N sweeps that answer word.
 * Each word has its own event, so a pause never becomes a fixed stagger. */
export const ParamsSchema = z.object({
  quote: z.string().trim().min(1),
  attribution: z.string().trim().min(1),
  date: z.string().trim().min(1),
}).strict()
