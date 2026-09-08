// How a creator's post is identified, and how close to it Krish's version is
// allowed to get.
//
// Two lanes see the same posts. The Tuesday scout scrapes them; the Drive scan
// reads the ones Krish screenshots. Until now they minted separate rows under
// different source_types and had no way to notice they were looking at the same
// thing. postHash is the shared identity: normalise the text hard enough that a
// scraped copy and a transcribed screenshot of one post agree.
//
// The verbatim check is the other half. The whole premise of taking inspiration
// from named creators is that the MOVE transfers and the wording does not, and
// that line has been held so far by a prompt telling a model not to paraphrase.
// A prompt is not a control. longestSharedRun measures the longest run of
// consecutive words Krish's version shares with the source, which is what a
// person would look for if they suspected copying.
//
// Pure: no imports beyond node:crypto, so the gate is checkable in CI rather
// than only in production, and the bound is a constant a guard can read.

import { createHash } from 'node:crypto'

/** Longer than this many consecutive shared words and it is not a move, it is
 *  the post. Eight is deliberately generous: a quoted phrase, a product name
 *  and a shared idiom all sit comfortably below it, and nothing innocent runs
 *  to nine. */
export const MAX_VERBATIM_RUN = 8

/** A run has to carry at least one word this long to count as evidence of
 *  copying. Without it, "and it is not the same as it was in the way that we do
 *  it" reads as a thirteen-word lift, and a gate that fires on grammar gets
 *  raised until it means nothing. Five letters is where English stops being
 *  connective tissue and starts naming something. */
const CONTENT_WORD_MIN = 5

export function normaliseForHash(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')      // a scrape and a screenshot disagree on tracking params
    .replace(/[‘’]/g, "'")      // smart quotes survive a scrape and not a transcription
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9' ]+/g, ' ')        // emoji, line breaks, bullets: all transcription noise
    .replace(/\s+/g, ' ')
    .trim()
}

/** The identity two lanes must agree on. Built from the first 600 normalised
 *  characters: a screenshot shows the top of a post, a scrape returns all of
 *  it, and they must still hash the same. */
export function postHash(text: string): string {
  return createHash('sha256').update(normaliseForHash(text).slice(0, 600)).digest('hex')
}

export function words(text: string): string[] {
  return normaliseForHash(text).split(' ').filter(Boolean)
}

/** The longest run of consecutive words the two texts share that carries at
 *  least one content word.
 *
 *  The content-word requirement is what keeps the gate honest. Two people
 *  writing English about one subject share long runs of connective tissue all
 *  the time; nobody accidentally shares nine words including a noun. */
export function longestSharedRun(candidate: string, source: string): { run: number; phrase: string } {
  const a = words(candidate)
  const b = words(source)
  if (!a.length || !b.length) return { run: 0, phrase: '' }

  const index = new Map<string, number[]>()
  b.forEach((w, i) => {
    const at = index.get(w)
    if (at) at.push(i)
    else index.set(w, [i])
  })

  let best = 0
  let bestAt = 0
  // Rolling longest-common-substring over word arrays. The corpus here is one
  // post against one draft, so the quadratic worst case is a few hundred
  // thousand comparisons and not worth a suffix automaton.
  let previous = new Int32Array(b.length + 1)
  for (let i = 0; i < a.length; i++) {
    const current = new Int32Array(b.length + 1)
    for (const j of index.get(a[i]) || []) {
      current[j + 1] = previous[j] + 1
      if (current[j + 1] > best) {
        const run = a.slice(i - current[j + 1] + 1, i + 1)
        // A run with no content word in it is grammar, however long.
        if (run.some(w => w.length >= CONTENT_WORD_MIN)) {
          best = current[j + 1]
          bestAt = i
        }
      }
    }
    previous = current
  }
  return { run: best, phrase: best ? a.slice(bestAt - best + 1, bestAt + 1).join(' ') : '' }
}

export interface VerbatimVerdict {
  ok: boolean
  run: number
  phrase: string
  bound: number
}

/** The gate both lanes call before writing. A failure is a rejection with a
 *  reason, never a silent trim: the point is that the machine noticed, and that
 *  the count of these is visible in the run ledger. */
export function verbatimCheck(candidate: string, source: string, bound = MAX_VERBATIM_RUN): VerbatimVerdict {
  const { run, phrase } = longestSharedRun(candidate, source)
  return { ok: run <= bound, run, phrase, bound }
}
