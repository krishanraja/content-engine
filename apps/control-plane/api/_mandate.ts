// A subchannel mandate with its old prediction close taken out.
//
// Ruling (Krish, 2026-11-24): "the signature format is the 5 Whys; get rid of
// everything that suggests predictions, calls, dated, odds or scores." The
// three venture_formats mandates still end with the clause a 2026-10-02
// migration appended ("THE CALL: every piece ends under the heading OUR
// PREDICTION ... How sure we are: N% ... ruled held or broke"). Rewriting the
// rows is a database write that waits on his yes, so until then every reader
// that hands a mandate to a model or a planner takes the clause out here.
//
// Pure: no database, no network. Idempotent: a mandate without the clause, or
// one already cleaned, comes back unchanged.

/** A sentence that belongs to the old close: "THE CALL:", "OUR PREDICTION" or
 *  "How sure we are". */
const CALL_SENTENCE = /\bTHE CALL\s*:|\bOUR PREDICTION\b|\bHow sure we are\b/i

/** A sentence that opens a new labelled part of a mandate ("NOT US:", "THE
 *  READER is", "HARD GATES, applied before scoring."). The clause runs until
 *  one of these, or to the end of its paragraph. */
const NEW_PART = /^["'(]?(?:[A-Z][A-Z'’-]+\s+)*[A-Z][A-Z'’-]+(?:\s*[:,]|\s+(?:is|are)\b)/

/** The mandate with every THE CALL / OUR PREDICTION / How sure we are clause
 *  taken out: from the sentence that opens it to the next labelled part or the
 *  end of the paragraph. Everything else is kept word for word. */
export function mandateWithoutCall(mandate: string): string {
  const text = String(mandate ?? '')
  if (!CALL_SENTENCE.test(text)) return text
  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)
  const kept = paragraphs.map((paragraph) => {
    if (!CALL_SENTENCE.test(paragraph)) return paragraph
    const out: string[] = []
    let cutting = false
    for (const sentence of paragraph.trim().split(/(?<=[.!?]["'”’)]*)\s+/)) {
      if (CALL_SENTENCE.test(sentence)) { cutting = true; continue }
      if (cutting && NEW_PART.test(sentence)) cutting = false
      if (!cutting) out.push(sentence)
    }
    return out.join(' ')
  }).filter((paragraph) => paragraph.trim())
  return kept.join('\n\n').trim()
}
