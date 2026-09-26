import { z } from 'zod'

const RuntimeWordmarkSchema = z.object({
  assetFile: z.string().min(1),
  assetDataUrl: z.string().min(1).optional(),
  alphaCropDataUrl: z.string().min(1).optional(),
  letterCropDataUrl: z.string().min(1).optional(),
  pixelWidth: z.number().positive(),
  pixelHeight: z.number().positive(),
  alphaCrop: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }),
  letterRegion: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }),
})

export const CarouselRenderPropsSchema = z.object({
  reviewMode: z.boolean(),
  storyId: z.string().min(1),
  // The retired pair stays for stories made under them (packages/contracts/src/series.ts).
  series: z.enum(['money_of_ai', 'built_with_ai', 'follow_the_money', 'mind_the_gap', 'under_the_hood']),
  seriesName: z.enum(['The Money of AI', 'Built With AI', 'follow.the.money', 'mind.the.gap', 'under.the.hood']),
  slideCount: z.number().int().min(5).max(10),
  slide: z.object({
    position: z.number().int().positive(),
    role: z.enum(['cover', 'scene', 'mechanism', 'proof', 'counterpoint', 'resolution']),
    layout: z.enum(['cover', 'statement', 'split_gate', 'flow', 'evidence', 'verdict']),
    scene: z.enum(['signal_room', 'inspection_table', 'engraving_bench', 'lever_cutaway', 'xray_mismatch', 'shutter_cabinet', 'output_tray']),
    headline: z.string(),
    body: z.string().optional(),
    dataLabel: z.string().optional(),
    visualItems: z.array(z.string()),
    assetIds: z.array(z.string()),
    accent: z.enum(['none', 'mint_answer', 'amber_changed']),
  }),
  branding: z.object({
    colors: z.object({ ink: z.string(), surface: z.string(), raised: z.string(), line: z.string(), text: z.string(), secondaryText: z.string(), mutedText: z.string(), paper: z.string(), mint: z.string(), mintInk: z.string(), amber: z.string() }),
    typography: z.object({ structure: z.string(), claim: z.string(), body: z.string(), data: z.string() }),
    // A retired series: the Mindmake and series wordmarks. A live subchannel:
    // the publication's mark and logo, and the channel's name as type.
    wordmarks: z.object({ mindmake: RuntimeWordmarkSchema, series: RuntimeWordmarkSchema }).optional(),
    publication: z.object({
      mark: RuntimeWordmarkSchema,
      logo: RuntimeWordmarkSchema,
      channel: z.object({ label: z.string().min(1), color: z.string(), weight: z.number().int() }),
    }).optional(),
    assets: z.array(z.object({ assetId: z.string(), assetFile: z.string(), truthRole: z.enum(['evidence', 'owned_artifact', 'illustration', 'decoration']), attribution: z.string().optional(), illustrationLabel: z.string().optional() })),
  }).refine((branding) => Boolean(branding.wordmarks) !== Boolean(branding.publication), { message: 'a carousel carries either the series wordmarks or the publication lockup' }),
})

export type CarouselRenderProps = z.infer<typeof CarouselRenderPropsSchema>
