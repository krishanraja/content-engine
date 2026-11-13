import { HOUSE_FONTS } from '../../house/geometry'
import type { EngineRenderProps } from '../props'

/** The shared kit every caption style is drawn with: where a caption may sit, which page is live, the motion curves,
 *  a width estimate for fitting type, and the hero score (Audrey's cinematic caption system, references/style-system.md
 *  section 2). Styles are pure functions of (props, frame), so a still and a render agree frame for frame. */

export type Page = EngineRenderProps['captions'][number]
export type Aspect = EngineRenderProps['aspect']
export type Box = { left: number; top: number; width: number; height: number }

/** Where caption type may sit. 9:16 is inside every platform's safe area (config/channel-safe-zones.json): clear of the
 *  270 px top band, of the action rail from x 880 below y 520, and of the bottom band from y 1320. `lower` is the
 *  talking-head caption band under the face; `upper` is the full-width strip above the rail. 16:9 is title-safe. */
export const REGIONS: Record<Aspect, { lower: Box; upper: Box; centre: Box }> = {
  '9:16': { lower: { left: 70, top: 990, width: 800, height: 330 }, upper: { left: 70, top: 290, width: 940, height: 230 },
    centre: { left: 70, top: 700, width: 800, height: 420 } },
  '16:9': { lower: { left: 192, top: 760, width: 1536, height: 266 }, upper: { left: 192, top: 108, width: 1536, height: 240 },
    centre: { left: 192, top: 380, width: 1536, height: 320 } },
}

/** The band a caption style draws in: the piece's own placement (props.captionPlacement, spec style.captions.placement),
 *  else the lower band. The placement is the captions' own choice, never the motion style's. `centre` sits the words
 *  over the middle of the picture, clear of the right rail (x 870 at most) and above the bottom band. */
export function band(props: Pick<EngineRenderProps, 'aspect' | 'captionPlacement'>): Box {
  return REGIONS[props.aspect][props.captionPlacement ?? 'lower']
}

/** Type scale per aspect: the tall sizes are designed at 1080 wide, the wide ones a little smaller. */
export const scale = (aspect: Aspect) => (aspect === '9:16' ? 1 : 0.82)

export const F = HOUSE_FONTS

/** The live page and its index, one frame early so a word never pops on late. */
export function livePage(props: Pick<EngineRenderProps, 'captions'>, frame: number): { page: Page; index: number } | null {
  // The later page wins where two overlap: the frame before a page starts (its first word lands) is also the previous
  // page's last live frame when they abut, and the old page must be gone there, never drawn over or ahead of the new one.
  let index = -1
  props.captions.forEach((p, i) => { if (frame >= p.fromFrame - 1 && frame < p.toFrame) index = i })
  return index < 0 ? null : { page: props.captions[index]!, index }
}

/** The page before the live one, when it ended within `gap` frames (for styles that keep the last line on screen). */
export function previousPage(props: Pick<EngineRenderProps, 'captions'>, index: number, frame: number, gap = 45): Page | null {
  const prev = props.captions[index - 1]
  return prev && frame - prev.toFrame <= gap ? prev : null
}

/** The word being spoken now on a page (the last word whose start has passed), or -1 before the first. */
export function spoken(page: Page, frame: number): number {
  let at = -1
  page.words.forEach((w, i) => { if (frame >= w.atFrame - 1) at = i })
  return at
}

/** Words read as spoken, without the trailing comma or full stop a caption never needs. */
export const clean = (text: string) => text.replace(/[,.;:]+$/, '')

export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x))
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
export const outExpo = (x: number) => (clamp(x) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)))
export const outBack = (x: number, c = 1.70158) => { const k = clamp(x) - 1; return 1 + (c + 1) * k * k * k + c * k * k }
/** Audrey's firm-settle: 0.88 to 1.04 to 1 over the landing. */
export const settle = (x: number) => { const t = clamp(x); return t < 0.6 ? mix(0.88, 1.04, outCubic(t / 0.6)) : mix(1.04, 1, outCubic((t - 0.6) / 0.4)) }
/** A damped spring from 0 to 1 that overshoots once and rests. */
export const spring = (x: number) => { const t = Math.max(0, x); return 1 - Math.exp(-6 * t) * Math.cos(9 * t) }

/** Seconds since a word (or any frame) began. */
export const since = (frame: number, at: number, fps: number) => (frame - at) / fps

/** Average glyph advance as a share of the font size, measured on the house faces; enough to fit a word to a width
 *  without a DOM. Upper case is wider than mixed. */
const ADVANCE = {
  anton: { upper: 0.47, mixed: 0.43 },
  archivo900: { upper: 0.66, mixed: 0.57 },
  archivo700: { upper: 0.66, mixed: 0.56 },
  archivo500: { upper: 0.63, mixed: 0.53 },
  archivoCondensed: { upper: 0.52, mixed: 0.45 },
  frauncesItalic: { upper: 0.6, mixed: 0.47 },
  mono: { upper: 0.6, mixed: 0.6 },
} as const
export type Face = keyof typeof ADVANCE

export function textWidth(text: string, size: number, face: Face, upper: boolean): number {
  return text.length * size * ADVANCE[face][upper ? 'upper' : 'mixed']
}

/** The largest size, no bigger than `max`, at which `text` fits `width`. */
export function fit(text: string, width: number, face: Face, upper: boolean, max: number, min = 40): number {
  const per = Math.max(1, text.length) * ADVANCE[face][upper ? 'upper' : 'mixed']
  return Math.round(clamp(width / per, min, max))
}

const STOP = new Set(('the a an and or but of to in on at for with from by as it its is was are were be been being have has had ' +
  'should would could will can may might must do does did they them their we our you your i me my he she his her him that this ' +
  'these those there here just so very really then than if when what which who how about into over up down out all some any ' +
  'more most much many also too even still only').split(' '))
const REVERSAL = /n't$|^(no|never|not|none|nothing|nobody|without|instead|yet)$/i

/** Audrey's hero score for one word of a page (references/style-system.md, section 2): +3 when removing it would change
 *  the claim (a number or a reversal; a plain content word gets +2, since only the speaker knows which noun carries
 *  the claim), +2 for concrete proof (a number), +2 for spoken stress, a reversal
 *  or the page's emphasis, +1 when short enough to hold at hero scale, -3 for filler. A hero needs 4 or more. */
export function heroScore(page: Page, i: number): number {
  const raw = clean(page.words[i]!.text), w = raw.toLowerCase()
  let s = 0
  const isStop = STOP.has(w)
  if (/\d/.test(raw)) s += 2 + 3
  else if (!isStop && w.length >= 4) s += 2
  if (REVERSAL.test(w)) s += 2 + 3
  if (page.swipeIndex === i) s += 2
  if (raw.length <= 10) s += 1
  if (isStop && !REVERSAL.test(w)) s -= 3
  return s
}

/** The page's hero word: the highest score of 4 or more, the later word on a tie (the decisive word usually lands
 *  last). -1 when the page has none, which is valid: a setup line carries no hero. */
export function hero(page: Page): number {
  let best = -1, bestScore = -Infinity
  page.words.forEach((_, i) => { const s = heroScore(page, i); if (s >= 4 && s >= bestScore) { best = i; bestScore = s } })
  return best
}

/** The page's key word for styles that always mark one: its hero, else its emphasis, else its longest word. */
export function key(page: Page): number {
  const h = hero(page)
  if (h >= 0) return h
  if (page.swipeIndex !== null && page.swipeIndex !== undefined) return page.swipeIndex
  let best = 0
  page.words.forEach((w, i) => { if (clean(w.text).length > clean(page.words[best]!.text).length) best = i })
  return best
}

/** A soft lift that keeps cream type legible over bright footage without a box (Audrey: shadow before a scrim). */
export const LIFT = '0 2px 3px rgba(0,0,0,.30), 0 8px 34px rgba(0,0,0,.38)'
