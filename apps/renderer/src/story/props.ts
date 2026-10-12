import { z } from 'zod'

/** A logo: a data URI, an http(s) URL, or a path under the bundle's public
 *  folder (passed to staticFile). Real logo files only; nothing is drawn. */
const Logo = z.string().min(1)

const RightPlayer = z.object({
  name: z.string().min(1).max(40),
  logo: Logo,
  stampBefore: z.string().min(1).max(24),
  stampAfter: z.string().min(1).max(24).optional(),
  switchesSides: z.boolean().optional(),
}).strict()

/** Everything a story's intro and outro show. The design is fixed (the
 *  stand-off, docs/plans/2026-10-12-story-io); only these change. */
export const StoryStandoffPropsSchema = z.object({
  shape: z.enum(['16x9', '9x16']),
  seriesColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  seriesName: z.string().min(1).max(32),
  left: z.object({
    name: z.string().min(1).max(40),
    logo: Logo,
    role: z.string().min(1).max(32),
    /** Recolour a single-colour cream mark to ink on the mint corner. */
    inkLogo: z.boolean().optional(),
  }).strict(),
  right: z.array(RightPlayer).min(1).max(4),
  question: z.string().min(1).max(80),
  /** The word group set on the ink slab (must appear in `question`). */
  questionEmphasis: z.string().min(1).max(40).optional(),
  link: z.string().min(1).max(40),
  commentQuestion: z.string().min(1).max(120),
  /** "Wednesday · under.the.hood": the day, then the series. */
  nextLabel: z.string().min(1).max(48),
  /** The next series' colour; by default looked up from its name. */
  nextColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  /** The brand's own image files (data URIs or URLs), shown unaltered on ink:
   *  the one-line wordmark (3319x391) and the stacked masthead (2415x740),
   *  from makeyourmindup.ai/brand/ (scripts/pages/brand.py fetch). */
  brand: z.object({ wordmark: z.string().min(1), masthead: z.string().min(1) }).strict(),
}).strict()

export type StoryStandoffProps = z.infer<typeof StoryStandoffPropsSchema>
export type StoryRightPlayer = z.infer<typeof RightPlayer>
