// Locating a highlighted passage inside the markdown it came from.
//
// The brief editor sent the selection as ProseMirror plain text and the server
// tested it with `body_md.includes(selection)`. That comparison could not work,
// and it failed in six independent ways at once:
//
//   1. Plain text vs markdown. A selection over `**a bold clue lead**` arrives
//      without the asterisks. The brief's clue leads are bold by design, so
//      most of the document was unmatchable.
//   2. Block separators. textBetween(..., '\n') joins blocks with one newline;
//      markdown paragraphs are separated by two.
//   3. sanitizeVoice (api/_content.ts) rewrites every em and en dash into a
//      comma on save, so any sentence containing a dash diverged from the DB
//      copy permanently, and highlighting it always failed.
//   4. The editor migrates inline citations to endnotes on open, adding `[n]`
//      markers the stored copy does not have yet.
//   5. Reading view strips those `[n]` markers and the Sources block back out.
//   6. Links. `[text](url)` renders as `text`; the URL is in the source only.
//
// Every one of those is a difference in punctuation, whitespace or markup, and
// none of them is a difference in the words. So match on the words: reduce both
// sides to lowercase alphanumerics, find the span there, then map back to real
// offsets in the original markdown. What the caller gets back is a substring
// that genuinely exists in the draft, which is the thing the model needs.

/** Lowercase alphanumeric projection of `src`, plus a map back to source offsets. */
function project(src: string): { text: string; map: number[] } {
  const out: string[] = []
  const map: number[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    // `[12]` — a citation marker. Present in the endnote form, absent in the
    // stored inline form and in reading view. Never part of the words.
    if (c === '[') {
      const close = src.indexOf(']', i)
      if (close > i && /^\d+$/.test(src.slice(i + 1, close))) { i = close + 1; continue }
    }
    // `](url)` — a link target. The words are the label before it; the URL is
    // in the markdown only, so skipping it lets a selection span a link.
    if (c === ']' && src[i + 1] === '(') {
      let depth = 0
      let j = i + 1
      for (; j < src.length; j++) {
        if (src[j] === '(') depth++
        else if (src[j] === ')') { depth--; if (depth === 0) { j++; break } }
      }
      i = j
      continue
    }
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) { out.push(c); map.push(i) }
    else if (c >= 'A' && c <= 'Z') { out.push(c.toLowerCase()); map.push(i) }
    i++
  }
  return { text: out.join(''), map }
}

export interface SpanHit {
  /** Offsets into the ORIGINAL source. */
  start: number
  end: number
  /** The real markdown at those offsets — pass this to the model. */
  text: string
  /** True when the words appear more than once; the first is used. */
  ambiguous: boolean
}

/**
 * Find `selection` inside `source`, ignoring markup, punctuation and
 * whitespace. Returns null when the words genuinely are not there.
 *
 * `minWords` guards against a stray one-word highlight matching in the wrong
 * place; below it we would rather scope nothing than scope the wrong sentence.
 */
export function locateSpan(source: string, selection: string, minChars = 8): SpanHit | null {
  if (!source || !selection) return null
  const hay = project(source)
  const need = project(selection)
  if (need.text.length < minChars) return null

  const at = hay.text.indexOf(need.text)
  if (at < 0) return null

  const start = hay.map[at]
  const end = hay.map[at + need.text.length - 1] + 1
  return {
    start,
    end,
    text: source.slice(start, end),
    ambiguous: hay.text.indexOf(need.text, at + 1) >= 0,
  }
}

// ── Putting a rewritten passage back ─────────────────────────────────────
//
// The piece's in-place rewrite (POST /api/content-ideas/:id/revise with a
// selection) hands the model the whole draft and one passage, then splices
// the answer back where the passage was. On 2026-09-30 piece 1's "Send it to
// buy a blender and it buys the blender." went to be deleted. The only answer
// the old splice could have turned into what came back is the sentence
// before it, "Muse is Meta's AI helper that shops for people.": the model
// echoed its context (the route failed an empty answer as empty_output, so
// "nothing" was never a usable reply), and the splice put that echo where the
// passage had been. The sentence appeared twice in a row (walk log F44; F2
// saw the same on 2026-09-24, with a heading).
//
// So an answer is read for what it echoes before it is spliced. Whatever it
// repeats of the draft just before the passage (from a sentence start) or
// just after it (to a sentence end) is taken off, and what is left replaces
// the passage. Nothing is left for a deletion, and an empty replacement
// deletes the passage cleanly.

// Where a sentence can start: at the start, and after a sentence's closing
// mark or a line break.
function sentenceStarts(text: string): number[] {
  const out = [0]
  for (const m of text.matchAll(/[.!?]["'”’)\]*_]*\s+|\n+/g)) out.push((m.index ?? 0) + m[0].length)
  return out
}

// Where a sentence can end: after a closing mark, before a line break, and
// at the end.
function sentenceEnds(text: string): number[] {
  const out: number[] = []
  for (const m of text.matchAll(/[.!?]["'”’)\]*_]*(?=\s|$)|(?=\n)/g)) out.push((m.index ?? 0) + m[0].length)
  out.push(text.length)
  return out.filter(n => n > 0)
}

const wordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}'’]/u.test(c)

/**
 * The model's answer for a passage, with the neighbouring text it echoed
 * taken off: an opening that repeats the draft just before the passage, from
 * a sentence start, and a close that repeats the draft just after it, to a
 * sentence end. The longest echo on each side goes. What is left replaces the
 * passage; nothing left means the passage is deleted.
 */
export function passageReplacement(source: string, selection: string, reply: string): string {
  let out = String(reply ?? '').trim()
  const at = source.indexOf(selection)
  if (at < 0 || !out) return out
  const before = source.slice(0, at).trimEnd()
  const after = source.slice(at + selection.length).trimStart()
  for (const start of sentenceStarts(before)) {
    const echo = before.slice(start).trim()
    if (echo && out.startsWith(echo) && !(wordChar(echo[echo.length - 1]) && wordChar(out[echo.length]))) {
      out = out.slice(echo.length).trim()
      break
    }
  }
  for (const end of sentenceEnds(after).reverse()) {
    const echo = after.slice(0, end).trim()
    if (echo && out.endsWith(echo) && !(wordChar(echo[0]) && wordChar(out[out.length - echo.length - 1]))) {
      out = out.slice(0, out.length - echo.length).trim()
      break
    }
  }
  return out
}

/**
 * The draft with the passage replaced, at its first occurrence. The
 * passage's own edge spaces stay with the text around it. An empty
 * replacement deletes the passage and leaves a single space, or the line or
 * paragraph break that was there. Built by slicing: String.replace read "$&"
 * or "$'" in an answer as a pattern.
 */
export function spliceSelection(source: string, selection: string, replacement: string): string {
  const at = source.indexOf(selection)
  if (at < 0) return source
  const passage = replacement.trim()
  if (passage) {
    const lead = selection.length - selection.trimStart().length
    const trail = selection.length - selection.trimEnd().length
    return source.slice(0, at + lead) + passage + source.slice(at + selection.length - trail)
  }
  const left = source.slice(0, at).trimEnd()
  const right = source.slice(at + selection.length).trimStart()
  if (!left || !right) return left + right
  const gap = source.slice(left.length, at) + source.slice(at + selection.length, source.length - right.length)
  return left + (gap.includes('\n\n') ? '\n\n' : gap.includes('\n') ? '\n' : ' ') + right
}
