import { z } from 'zod'

const RuntimeWordmarkSchema = z.object({
  assetFile: z.string().min(1),
  pixelWidth: z.number().positive(),
  pixelHeight: z.number().positive(),
  alphaCrop: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }),
})

export const CarouselRenderPropsSchema = z.object({
  reviewMode: z.boolean(),
  storyId: z.string().min(1),
  series: z.enum(['money_of_ai', 'built_with_ai']),
  seriesName: z.enum(['The Money of AI', 'Built With AI']),
  slideCount: z.number().int().min(5).max(10),
  slide: z.object({
    position: z.number().int().positive(),
    role: z.enum(['cover', 'scene', 'mechanism', 'proof', 'counterpoint', 'resolution']),
    layout: z.enum(['cover', 'statement', 'split_gate', 'flow', 'evidence', 'verdict']),
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
    wordmarks: z.object({ mindmake: RuntimeWordmarkSchema, series: RuntimeWordmarkSchema }),
    assets: z.array(z.object({ assetId: z.string(), assetFile: z.string(), truthRole: z.enum(['evidence', 'owned_artifact', 'illustration', 'decoration']), attribution: z.string().optional(), illustrationLabel: z.string().optional() })),
  }),
})

export type CarouselRenderProps = z.infer<typeof CarouselRenderPropsSchema>
