import { z } from 'zod'

export const ShortPropsSchema = z.object({
  sourceFile: z.string(),
  sourceWidth: z.number().positive(),
  sourceHeight: z.number().positive(),
  crop: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }),
  cropKeyframes: z.array(z.object({ at_ms: z.number(), x: z.number(), y: z.number(), width: z.number(), height: z.number(), confidence: z.number() })),
  hook: z.string(),
  treatmentStyle: z.object({ caption_position: z.enum(['lower', 'middle']), caption_scale: z.number(), hook_card_ms: z.number(), proof_motif: z.enum(['mechanism', 'evidence', 'artifact']), caption_personality: z.enum(['clean', 'kinetic']) }),
  durationMs: z.number().positive(),
  seriesName: z.string(),
  accent: z.string(),
  captions: z.array(z.object({ start_ms: z.number(), end_ms: z.number(), text: z.string(), emphasis: z.array(z.string()) })),
  evidenceOverlays: z.array(z.object({
    overlay_id: z.string(), start_ms: z.number(), end_ms: z.number(), kind: z.enum(['screenshot', 'document', 'diagram']), assetFile: z.string(), title: z.string(), excerpt: z.string().optional(), source_label: z.string(), placement: z.enum(['upper', 'center']), fit: z.enum(['contain', 'cover']),
  })),
})

export type ShortProps = z.infer<typeof ShortPropsSchema>
