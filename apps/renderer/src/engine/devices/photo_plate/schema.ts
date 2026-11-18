import { z } from 'zod'
import { EngineImageSchema } from '../../props'

const Fraction = z.number().min(0).max(1)
const SizeFraction = z.number().positive().max(1)
const Region = z.object({ x: Fraction, y: Fraction, w: SizeFraction, h: SizeFraction }).strict()
  .refine(({ x, y, w, h }) => x + w <= 1 && y + h <= 1, 'Region must fit the picture')

const VideoSchema = EngineImageSchema.extend({ trimBeforeFrames: z.number().int().nonnegative().default(0) })
const Common = {
  focus: z.object({ x: Fraction, y: Fraction }).strict().default({ x: 0.5, y: 0.5 }),
  push: z.number().min(0).max(0.12).default(0.05),
  scrim: z.number().min(0).max(0.6).default(0),
  regions: z.record(z.string().min(1).refine(name => name !== 'none', 'Reserved mark state'), Region).default({}),
  source: z.string().trim().min(1).optional(),
  // Asset provenance lives in the spec. Set this flag on the plate when using a generated asset.
  generated: z.boolean().default(false),
}

export const ParamsSchema = z.union([
  z.object({ ...Common, image: EngineImageSchema }).strict(),
  z.object({ ...Common, video: VideoSchema }).strict(),
]).refine(params => !params.generated || params.source === undefined, {
  path: ['source'],
  message: 'Generated pictures cannot carry a source label',
})
