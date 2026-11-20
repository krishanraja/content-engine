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
  // The platform walkthrough's loops (kept as it is: Krish, 2026-11-20): 'loop' draws a hand-drawn loop round the named
  // region of the recording on the word that names it (8 f, utility), a double stroke (9 px and a 3 px echo turned 4
  // degrees, 3 f later), in the series colour or mint; keepMarks keeps every loop drawn so far. 'ring' is the old mark.
  markStyle: z.enum(['ring', 'loop']).default('ring'),
  markColour: z.enum(['mint', 'channel']).default('mint'),
  keepMarks: z.boolean().default(false),
  // A device frame for a screen recording: a 22 px radius and a 2 px cream border at 16%.
  frame: z.boolean().default(false),
}

export const ParamsSchema = z.union([
  z.object({ ...Common, image: EngineImageSchema }).strict(),
  z.object({ ...Common, video: VideoSchema }).strict(),
]).refine(params => !params.generated || params.source === undefined, {
  path: ['source'],
  message: 'Generated pictures cannot carry a source label',
})
