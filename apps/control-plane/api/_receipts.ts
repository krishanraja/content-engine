// Receipts: the fact gate's checked quotes, ready to put on screen.
//
// Krish, 2026-09-25, on an Instagram ad he liked: "I really like this
// Instagram ad, the way it's designed and styled. I think it's really
// impactful." Its proof panels show the real thing (the tweet, the price
// table) above the presenter, with one highlight on the line that matters.
// The engine already holds that proof for every piece: the fact gate keeps,
// for each claim, the source's own words it found the claim in. A receipt is
// one of those passages, with where it came from, so a Short, a carousel or a
// web edition can show the source instead of asserting it.
//
// Only what passed, and only words a source actually said: a receipt's quote
// is a passage the gate found verbatim in a source on file. The web
// checker's evidence is its own rendering of a page and is never shown as a
// quote. Nothing here is written by a model.

import { norm, numbersIn, PASSING, type CheckedClaim, type FactCheck } from './_factGate.js'
import type { Material } from './_content.js'

export interface Receipt {
  /** The piece's own sentence this receipt proves. */
  sentence: string
  /** The source's own words, one passage, verbatim, as the gate found them. */
  quote: string
  /** The same words with the page's markup taken out (link syntax, bold
   *  marks, heading lines), for putting on screen. No word is changed. */
  display: string
  words: number
  /** Short enough to read on a phone screen in a beat (30 words or fewer). */
  fits_screen: boolean
  /** Under six words: a table cell or a dateline ("Output $0.50"), proof that
   *  needs its table or page around it on screen. */
  fragment: boolean
  source: { title: string | null; url: string | null }
  /** Checked against the source on file and on the web, or on file only. */
  checked: 'twice' | 'on_file'
  /** The passage came from the source's own text, not a summary of it. */
  primary: boolean
  kind: CheckedClaim['kind']
}

const SCREEN_WORDS = 30
const FRAGMENT_WORDS = 6

/** A passage's words without the page's markup. */
export function displayText(quote: string): string {
  return quote
    .split('\n').filter(l => !/^\s*#{1,6}\s/.test(l)).join(' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The passage that best proves the claim: it carries every number the
 *  piece's sentence uses, and is the shortest that does. */
function bestPassage(c: CheckedClaim): string | null {
  const passages = String(c.on_file.quote || '').split(' | ').map(p => p.trim()).filter(p => norm(p).length >= 12)
  if (!passages.length) return null
  const want = numbersIn(c.sentence)
  const carrying = passages.filter(p => {
    const have = new Set(numbersIn(p))
    return want.every(n => have.has(n))
  })
  const pool = carrying.length ? carrying : passages
  return [...pool].sort((a, b) => a.length - b.length)[0] ?? null
}

/** The material a passage came from: the one whose text holds its opening. */
function sourceOf(passage: string, materials: Material[]): Material | null {
  const head = norm(passage).slice(0, 60)
  return materials.find(m => m.content && norm(m.content).includes(head)) || null
}

export function receipts(fc: FactCheck | null | undefined, materials: Material[]): Receipt[] {
  if (!fc?.passed) return []
  const out: Receipt[] = []
  for (const c of fc.claims) {
    if (!PASSING.has(c.verdict) || c.on_file.verdict !== 'supported') continue
    const quote = bestPassage(c)
    if (!quote) continue
    const m = sourceOf(quote, materials)
    const webAgrees = c.independent.verdict === 'supported'
    const url = m?.url || (webAgrees ? c.independent.url : null) || null
    if (!url && !m?.title) continue // a receipt with no source is an assertion
    const display = displayText(quote)
    const words = display.split(/\s+/).filter(Boolean).length
    out.push({
      sentence: c.sentence,
      quote,
      display,
      words,
      fits_screen: words <= SCREEN_WORDS,
      fragment: words < FRAGMENT_WORDS,
      source: { title: m?.title || null, url },
      checked: c.verdict === 'verified' ? 'twice' : 'on_file',
      primary: c.on_file.primary === true,
      kind: c.kind,
    })
  }
  return out
}
