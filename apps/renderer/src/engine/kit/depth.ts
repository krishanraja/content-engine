import { textWidth } from '../../house/metrics'
import type { Box } from '../devices/types'

/** Depth: type set in his world, behind him, through the subject matte of his take (shot grammar step 5; study shots 5
 *  and 6; docs/ve/INGREDIENTS.md, "Shot grammar"). The Athletic's "8 facts about Man United's finances" sets its giant
 *  numbers and its title on the set behind the presenter, and his head and body cross in front of them; Krish's anchor
 *  cuts drew flat cards over his chest instead (20 Nov 2026 reference: "Cards sit on his chest and arms; the title
 *  shrinks to a small box over his torso").
 *
 *  Three kinds, compiled from the spec into `props.depth` (velib/compile.py `depth_items`):
 *  - `number`: the in-world number or word, its glyphs 0.4 to 0.6 of the frame's height (IN_WORLD), at head height,
 *    behind him, slamming in on the word he says it on, 1 to 6 s;
 *  - `chapter`: a numeral beside or behind him, at most 1.5 s, him on screen, a different arrangement each time
 *    (CHAPTER_ARRANGEMENTS), all in the house type and palette;
 *  - the title on an anchor cut is drawn by TitleMoment (`behind`), in the box above and behind his head (titleBox).
 *  Fast hand motion has a soft halo in the matte (velib/matte.py clips it by confidence): so the type sits at head and
 *  torso height, where the matte is surest, never where his hands move.
 *  Pure: every position is a function of the item, the frame size and his head (compile measures it from the matte). */

/** The in-world glyph height as a share of the frame's height (the study's 0.4 to 0.6; The Athletic's "8" and "7"). */
export const IN_WORLD = { min: 0.4, target: 0.5, max: 0.6 } as const
/** Anton's cap height in ems (its digits and capitals, measured from the brand kit's file). */
export const ANTON_CAP = 0.86
export const CHAPTER_ARRANGEMENTS = ['beside_left', 'beside_right', 'rotated', 'behind'] as const
export type ChapterArrangement = typeof CHAPTER_ARRANGEMENTS[number]

/** His head in the frame over the item's frames (compile, from the matte's silhouette and the take box). */
export type Head = { top: number; left: number; right: number; centreY: number }

export type InWorld = { fontSize: number; capHeight: number; centreX: number; centreY: number; width: number }

/** The in-world number's size and place: its glyphs `target` of the frame's height, shrunk to fit 94% of the width (a
 *  text too long to stay at `min` is refused by lint, grammar.depth), centred at his head's height, to the side of his
 *  head with more wall, so his head crosses its edge rather than hiding its middle. */
export function inWorldLayout(text: string, width: number, height: number, head: Head): InWorld {
  const up = text.toUpperCase()
  const perEm = Math.max(1, textWidth('anton', up, 1000)) / 1000
  const byHeight = IN_WORLD.target * height / ANTON_CAP
  const byWidth = width * 0.94 / perEm
  const fontSize = Math.min(byHeight, byWidth, IN_WORLD.max * height / ANTON_CAP)
  const glyphWidth = perEm * fontSize
  const headX = (head.left + head.right) / 2
  const side = headX < width / 2 ? 1 : -1
  const centreX = Math.min(width - glyphWidth / 2 - width * 0.03, Math.max(glyphWidth / 2 + width * 0.03, width / 2 + side * width * 0.12))
  // His head height: the glyphs' middle at his eyes, kept inside the frame.
  const capHeight = ANTON_CAP * fontSize
  const centreY = Math.min(height - capHeight / 2 - height * 0.04, Math.max(capHeight / 2 + height * 0.04, head.centreY))
  return { fontSize, capHeight, centreX, centreY, width: glyphWidth }
}

/** The glyph height as a share of the frame for a text at this frame size (lint's measure, the same rule). */
export function inWorldShare(text: string, width: number, height: number): number {
  const perEm = Math.max(1, textWidth('anton', text.toUpperCase(), 1000)) / 1000
  const fontSize = Math.min(IN_WORLD.target * height / ANTON_CAP, width * 0.94 / perEm, IN_WORLD.max * height / ANTON_CAP)
  return ANTON_CAP * fontSize / height
}

/** The slam: in over 5 frames from 1.25x and transparent, landing on the spoken word; out hard at its end. */
export function slam(frame: number, at: number, to: number): { scale: number; opacity: number } {
  if (frame < at || frame >= to) return { scale: 1, opacity: 0 }
  const t = Math.min(1, (frame - at) / 5)
  const eased = 1 - (1 - t) ** 3
  return { scale: 1.25 - 0.25 * eased, opacity: Math.min(1, t * 2.5) }
}

export type ChapterPlace = { left: number; top: number; fontSize: number; rotate: number; align: 'left' | 'right' | 'center'; behind: boolean }

/** Where a chapter numeral sits for each arrangement: beside his head on the left or right, rotated a quarter turn
 *  beside him, or huge behind him (needs the matte). Each is clear of his head box when beside him. */
export function chapterPlace(arrangement: ChapterArrangement, width: number, height: number, head: Head): ChapterPlace {
  const tall = height > width
  const gap = width * 0.03
  if (arrangement === 'behind') {
    const fontSize = IN_WORLD.target * height / ANTON_CAP
    return { left: (head.left + head.right) / 2, top: head.centreY, fontSize, rotate: 0, align: 'center', behind: true }
  }
  // Beside him: a numeral 0.22 to 0.3 of the frame tall at the frame's edge on that side; drawn behind him through the matte,
  // so where he stands close to that edge his head and shoulder cross it rather than it crossing his face.
  const fontSize = (tall ? 0.26 : 0.42) * height / ANTON_CAP
  if (arrangement === 'rotated') {
    // A quarter turn, reading upwards, at the left edge (The Athletic's "Fact 2" and "Fact 4").
    const size = fontSize * 0.8, half = size * ANTON_CAP / 2
    return { left: gap + half, top: head.centreY, fontSize: size, rotate: -90, align: 'center', behind: false }
  }
  if (arrangement === 'beside_left') return { left: gap, top: head.centreY, fontSize, rotate: 0, align: 'left', behind: false }
  return { left: width - gap, top: head.centreY, fontSize, rotate: 0, align: 'right', behind: false }
}

/** The box the title builds in on an anchor cut: the wall above and behind his head, from under the platforms' top band
 *  down to a little past the top of his head, so his head crosses the lockup's lower edge (The Athletic's "Man Utd
 *  finances" over the presenter's head). */
export function titleBox(width: number, height: number, head: Head): Box {
  const top = height > width ? 270 : 60
  const bottom = Math.min(height * 0.62, head.top + height * 0.12)
  return { left: 0, top, width, height: Math.max(height * 0.18, bottom - top) }
}
