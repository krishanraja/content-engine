import { z } from 'zod'

/** Copy only: quantities belong in dataset-backed evidence devices. */
export const ParamsSchema = z.object({
  word: z.string().min(1).max(24).regex(/^\p{L}[\p{L}\p{M}'’-]*$/u, 'Supply one word, without a numeric claim'),
  tapeText: z.string().trim().min(1).max(60).default('CAUTION'),
}).strict()
