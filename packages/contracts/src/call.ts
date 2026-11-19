// The reader of a dated call in a piece's text, now dormant.
//
// Until 2026-11-18 every makeyourmindup piece ended on a dated prediction
// ("what will happen, a date to check it by, and how sure we are"); the
// publish checks required one and the Studio drew it on a Short's call card.
// The format is abandoned. Ruling (Krish, 2026-11-17): "I don't do
// dated-and-scored make-your-mind-up pieces because it felt quite tacky and
// gimmicky. I don't really have the clout such that my opinion can hold up in
// official scores." Ruling (Krish, 2026-11-18): "get rid of that - i have
// abandoned the prediction format, it feels lame". So the whole-call reader
// (readPieceCall) and its refusals are gone, and nothing requires, checks or
// draws a call.
//
// What stays is what the fact gate's hash still reads (api/_factGate.ts,
// withoutConfidence and isConfidenceLine): finding an old call section and a
// labelled confidence, so every fact check stored before the ruling still
// matches its text. For a piece written since, they find nothing.
//
// Pure and dependency free: the control plane imports this file by its
// relative path, as apps/control-plane/api/video-studio/_runnerContracts.ts
// explains, so it must stay clear of zod and the rest of the contracts.

export interface CallConfidenceMentionV1 {
  index: number
  label: 'how_sure_we_are' | 'confidence'
  /** The number as written, "75" or "72.5". */
  value: string
  percent: number
  /** Whether the number is a whole percentage. */
  whole: boolean
}

// The two shapes a call takes in an approved piece. A section under a heading
// (piece 2: "## OUR PREDICTION", the statement, then "How sure we are: 75%."),
// or one paragraph that opens with a bold label (piece 1: "**The Call.** By 30
// June 2027, ... Confidence: 70%."). The heading runs to the next heading or
// the end of the text; the paragraph runs to the next blank line.
const CALL_HEADING = /^#{1,3}\s*(OUR PREDICTION|THE CALL|PREDICTION)\b[^\n]*\n([\s\S]*?)(?=^#{1,3}\s|$(?![\s\S]))/im
const CALL_PARAGRAPH = /^\*\*(The Call|Our prediction)\.?\*\*[^\n]*(?:\n(?!\n)[^\n]*)*/im

// "How sure we are: 75%" or "Confidence: 70%", the number straight after the label.
const LABELLED_CONFIDENCE = /(How sure we are|\bConfidence):[ \t]*(\d{1,3}(?:\.\d+)?)%/gi

/** The prediction section of a piece: the text under its heading, or its
 *  bold-labelled paragraph, label included. Null when it has neither. */
export function callSectionOf(text: string): string | null {
  const body = String(text ?? '')
  const heading = body.match(CALL_HEADING)
  if (heading) return heading[2] ?? ''
  const paragraph = body.match(CALL_PARAGRAPH)
  return paragraph ? paragraph[0] : null
}

/** Every confidence given with its label, in the order they appear. */
export function labelledConfidences(text: string): CallConfidenceMentionV1[] {
  return [...String(text ?? '').matchAll(LABELLED_CONFIDENCE)].map((match) => {
    const value = match[2] ?? ''
    return {
      index: match.index ?? 0,
      label: /^how/i.test(match[1] ?? '') ? 'how_sure_we_are' as const : 'confidence' as const,
      value,
      percent: Number(value),
      whole: /^\d+$/.test(value),
    }
  })
}
