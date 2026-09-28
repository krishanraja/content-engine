import { z } from 'zod'

/** The cover people see before they tap (the mock Krish approved on
 *  2026-09-28, frame 5). It is type and the mark on the section's colour:
 *  there is no field for a photograph, so no photo of Krish can reach it. */
export const ThumbnailPropsSchema = z.object({
  reviewMode: z.boolean(),
  series: z.enum(['follow_the_money', 'mind_the_gap', 'under_the_hood']),
  channelLabel: z.enum(['follow.the.money', 'mind.the.gap', 'under.the.hood']),
  day: z.enum(['Mondays', 'Wednesdays', 'Fridays']),
  headline: z.string().min(1).max(120),
  dek: z.string().min(1).max(220),
  sticker: z.string().min(1).max(40),
  mark: z.object({
    assetFile: z.string().min(1),
    assetDataUrl: z.string().min(1).optional(),
    pixelWidth: z.number().positive(),
    pixelHeight: z.number().positive(),
  }).strict(),
  tokens: z.object({ ink: z.string(), inkDeep: z.string(), inkSoft: z.string(), cream: z.string(), mint: z.string(), section: z.string() }).strict(),
}).strict()

export type ThumbnailProps = z.infer<typeof ThumbnailPropsSchema>
