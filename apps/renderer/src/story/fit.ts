/** Fitting type into a box, as a pure function of a width measurer, so the
 *  same rule runs in the render (measured in the real faces) and in the tests.
 *
 *  The rule (Krish, 2026-10-13, on Wednesday's title card: "text that falls
 *  off the page and looks ridiculous"): a title is set as large as it can be,
 *  shrinking to a floor size; if it does not fit at the floor, nothing is
 *  rendered and the render fails with a message saying which words and where,
 *  so the words are shortened instead of the type running off the frame. */

/** The width of `text` at `size` px. */
export type Measure = (text: string, size: number) => number

export interface FitBox {
  /** The widest a line may be, px. */
  maxWidth: number
  /** The tallest the whole block may be, px. */
  maxHeight: number
  /** Line pitch as a multiple of the size. */
  lineHeight: number
  maxSize: number
  /** The floor: never set smaller than this. */
  minSize: number
  maxLines: number
  /** Extra width, as a multiple of the size, added to a line holding `keep`
   *  (the padding of the emphasis slab). */
  keepPadEm?: number
}

export interface Fitted {
  size: number
  lines: string[]
}

/** Words, with `keep` (a word group) held together as one token. */
export function tokens(text: string, keep?: string | null): string[] {
  const t = text.trim().replace(/\s+/g, ' ')
  if (keep && t.includes(keep)) {
    const i = t.indexOf(keep)
    return [...t.slice(0, i).trim().split(' ').filter(Boolean), keep, ...t.slice(i + keep.length).trim().split(' ').filter(Boolean)]
  }
  return t.split(' ').filter(Boolean)
}

function lineWidth(line: string, size: number, measure: Measure, keep: string | null | undefined, padEm: number): number {
  return measure(line, size) + (keep && line.includes(keep) ? padEm * size : 0)
}

/** Greedy breaks at `width`; null when a single token is wider than `width`. */
export function wrap(toks: string[], size: number, width: number, measure: Measure, keep?: string | null, padEm = 0): string[] | null {
  const lines: string[] = []
  let cur = ''
  for (const t of toks) {
    if (lineWidth(t, size, measure, keep, padEm) > width) return null
    const next = cur ? `${cur} ${t}` : t
    if (cur && lineWidth(next, size, measure, keep, padEm) > width) {
      lines.push(cur)
      cur = t
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

function fitAt(toks: string[], size: number, measure: Measure, box: FitBox, keep: string | null | undefined, padEm: number): string[] | null {
  const lines = wrap(toks, size, box.maxWidth, measure, keep, padEm)
  if (!lines || lines.length > box.maxLines) return null
  if (lines.length * size * box.lineHeight > box.maxHeight) return null
  // Balance: the narrowest width that still gives this many lines.
  let lo = 0, hi = box.maxWidth, best = lines
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2
    const l = wrap(toks, size, mid, measure, keep, padEm)
    if (l && l.length <= lines.length) { best = l; hi = mid } else lo = mid
  }
  return best
}

const orphan = (lines: string[]) => lines.length > 1 && !(lines[lines.length - 1] ?? '').includes(' ')

/** The largest size from maxSize down to minSize (in 2 px steps) at which the
 *  text fits the box, with its lines balanced (the narrowest width that keeps
 *  the same number of lines). A last line of one word is avoided when a size
 *  no more than 12 % smaller sets it without one. null when it does not fit
 *  at the floor. */
export function fitText(text: string, measure: Measure, box: FitBox, keep?: string | null): Fitted | null {
  const toks = tokens(text, keep)
  if (!toks.length) return null
  const padEm = box.keepPadEm ?? 0
  for (let size = Math.floor(box.maxSize); size >= box.minSize; size -= 2) {
    const lines = fitAt(toks, size, measure, box, keep, padEm)
    if (!lines) continue
    if (orphan(lines) && toks.length > 2) {
      for (let s2 = size - 2; s2 >= Math.max(box.minSize, size * 0.88); s2 -= 2) {
        const alt = fitAt(toks, s2, measure, box, keep, padEm)
        if (alt && !orphan(alt)) return { size: s2, lines: alt }
      }
    }
    return { size, lines }
  }
  return null
}

/** A one-line label: the largest size up to maxSize at which it fits
 *  maxWidth, or null below the floor. */
export function fitLine(text: string, measure: Measure, maxWidth: number, maxSize: number, minSize: number): number | null {
  const w = measure(text, 100) / 100
  if (w <= 0) return Math.floor(maxSize)
  const size = Math.min(Math.floor(maxSize), Math.floor(maxWidth / w))
  return size >= minSize ? size : null
}

/** The error a render throws when words do not fit. story_io.py finds the
 *  "STORY_FIT:" marker in Remotion's output and stops with this sentence. */
export function fitError(what: string, text: string, shape: string, box: { maxWidth: number; maxHeight?: number }, minSize: number, fix: string): Error {
  const area = box.maxHeight ? `${Math.round(box.maxWidth)} x ${Math.round(box.maxHeight)} px` : `${Math.round(box.maxWidth)} px wide`
  return new Error(`STORY_FIT: the ${what} "${text}" does not fit its ${shape} area (${area}) even at the smallest size, ${minSize} px. ${fix}`)
}

/** A question answered yes or no opens with a helping verb ("Would you let...", "Do you...").
 *  The outro shows its YES and NO only for one (Krish, 2026-10-14: "Which kind of AI do you
 *  actually use?" showed them). */
export const YES_NO = /^(do|does|did|is|are|was|were|will|would|should|shall|can|could|may|might|must|has|have|had|am)\b/i
