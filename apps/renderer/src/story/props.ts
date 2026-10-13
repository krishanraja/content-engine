import { z } from 'zod'

/** A logo: a data URI, an http(s) URL, or a path under the bundle's public
 *  folder (passed to staticFile), optionally with its width / height so a row
 *  of marks can be sized optically. Real logo files only; nothing is drawn. */
const LogoRef = z.union([
  z.string().min(1),
  z.object({ src: z.string().min(1), aspect: z.number().positive().max(20) }).strict(),
])

const Tone = z.enum(['cream', 'mint', 'coral'])

/** One player in the stand-off. Every player, on either side, is drawn by the
 *  same badge: its logos (the marks people know, e.g. Meta, Instagram and
 *  WhatsApp for Muse), its name in type beside them, and its tag.
 *  `logo`, `role` and `stampBefore` / `stampAfter` are the earlier names of
 *  `logos`, `tag` and `tagAfter`, still read. */
const Player = z.object({
  name: z.string().min(1).max(40),
  logos: z.array(LogoRef).min(1).max(4).optional(),
  logo: LogoRef.optional(),
  tag: z.string().min(1).max(28).optional(),
  role: z.string().min(1).max(28).optional(),
  stampBefore: z.string().min(1).max(28).optional(),
  /** The tag's colour; cream unless the tag carries a verdict. */
  tagTone: Tone.optional(),
  /** The twist: the tag this player changes to. */
  tagAfter: z.string().min(1).max(28).optional(),
  stampAfter: z.string().min(1).max(28).optional(),
  tagAfterTone: Tone.optional(),
  /** The twist: this player crosses to the left corner. */
  switchesSides: z.boolean().optional(),
  /** Ignored (every logo now sits on its ink badge, unaltered). */
  inkLogo: z.boolean().optional(),
}).strict()

/** Everything a story's intro and outro show. The design is fixed (the
 *  stand-off, docs/plans/2026-10-12-story-io); only these change. Optional
 *  values are sent as null by story_io.py, so the Studio's default props
 *  (Monday's) can never fill a gap in another piece's. */
export const StoryStandoffPropsSchema = z.object({
  shape: z.enum(['16x9', '9x16']),
  seriesColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  seriesName: z.string().min(1).max(32),
  left: Player,
  right: z.array(Player).min(1).max(3),
  /** The title card's words: short (cover-facts.json `video_title`, else the
   *  cover's headline lines), never the article's long headline. */
  title: z.string().min(1).max(60).nullable().optional(),
  /** The word group set on the ink slab (must appear in the title). */
  titleEmphasis: z.string().min(1).max(40).nullable().optional(),
  /** The earlier names of `title` and `titleEmphasis`, still read. */
  question: z.string().min(1).max(60).nullable().optional(),
  questionEmphasis: z.string().min(1).max(40).nullable().optional(),
  /** The line-up under the title: the names the story scores or weighs, each
   *  with its real logo (cover-facts.json: the players against the first,
   *  then thumbs.strip). */
  cast: z.array(z.object({ name: z.string().min(1).max(16), logo: LogoRef }).strict()).max(6).nullable().optional(),
  link: z.string().min(1).max(40),
  commentQuestion: z.string().min(1).max(120),
  /** "Wednesday · under.the.hood": the day, then the series. */
  nextLabel: z.string().min(1).max(48),
  /** The next series' colour; by default looked up from its name. */
  nextColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  /** The brand's own image files (data URIs or URLs), shown unaltered on ink:
   *  the one-line wordmark (3319x391) and the stacked masthead (2415x740),
   *  from makeyourmindup.ai/brand/ (scripts/pages/brand.py fetch). */
  brand: z.object({ wordmark: z.string().min(1), masthead: z.string().min(1) }).strict(),
  /** Log every text and logo's bounds on every frame for story_io.py's
   *  check. Changes nothing on screen. */
  check: z.boolean().nullable().optional(),
}).strict()

export type StoryStandoffProps = z.infer<typeof StoryStandoffPropsSchema>
export type StoryPlayerInput = z.infer<typeof Player>
export type StoryLogoRef = z.infer<typeof LogoRef>
export type StoryTone = z.infer<typeof Tone>

/** A player in its one canonical form. */
export interface StoryPlayer {
  name: string
  logos: { src: string; aspect: number }[]
  tag: string | null
  tagTone: StoryTone
  tagAfter: string | null
  tagAfterTone: StoryTone
  switchesSides: boolean
}

export function normalisePlayer(p: StoryPlayerInput): StoryPlayer {
  const refs = p.logos ?? (p.logo ? [p.logo] : [])
  return {
    name: p.name,
    logos: refs.map((r) => (typeof r === 'string' ? { src: r, aspect: 1 } : r)),
    tag: p.tag ?? p.role ?? p.stampBefore ?? null,
    tagTone: p.tagTone ?? 'cream',
    tagAfter: p.tagAfter ?? p.stampAfter ?? null,
    tagAfterTone: p.tagAfterTone ?? 'mint',
    switchesSides: !!p.switchesSides,
  }
}

export function storyTitle(p: StoryStandoffProps): { text: string; emphasis: string | null } {
  const text = (p.title ?? p.question ?? '').trim()
  const em = (p.titleEmphasis ?? p.questionEmphasis ?? null)
  return { text, emphasis: em && text.includes(em) ? em : null }
}
