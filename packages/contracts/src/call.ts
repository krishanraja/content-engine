// The piece's call: the dated prediction every makeyourmindup piece ends on
// ("what will happen, a date to check it by, and how sure we are"). This file
// is the one reader of it. The control plane's publish checks
// (apps/control-plane/api/_publishChecks.ts) find the section, the date and the
// confidence with the functions below, and the Studio reads the whole call
// with readPieceCall to put on a Short's call card and to refuse a render
// whose call differs from the text Krish approved.
//
// Pure and dependency free: the control plane imports this file by its
// relative path, as apps/control-plane/api/video-studio/_runnerContracts.ts
// explains, so it must stay clear of zod and the rest of the contracts.

/** Why a piece has no call, in the words the publish check has always used. */
export const CALL_MISSING = {
  section: 'No prediction section. Every piece ends with what will happen, a date to check it by, and how sure we are.',
  date: 'The prediction has no date to check it by.',
  confidence: 'The prediction has no confidence yet. Krish sets how sure we are, as a percentage.',
} as const

/** The call as the approved text states it. */
export interface PieceCallV1 {
  /** What will happen, word for word, with markdown and line breaks taken out. */
  statement: string
  /** The date to check it by, YYYY-MM-DD. */
  due: string
  /** How sure we are, a whole percentage from 1 to 99. */
  confidence_percent: number
}

export type PieceCallReadingV1 = { ok: true; call: PieceCallV1 } | { ok: false; reason: string }

export interface CallDateMentionV1 {
  /** Where the mention starts in the text it was read from. */
  index: number
  /** The words as written, "by 30 September 2027" or "2027-09-30". */
  text: string
  /** The date as YYYY-MM-DD, or null when no such day exists (31 June). */
  iso: string | null
}

export interface CallConfidenceMentionV1 {
  index: number
  label: 'how_sure_we_are' | 'confidence'
  /** The number as written, "75" or "72.5". */
  value: string
  percent: number
  /** Whether the number is a whole percentage. */
  whole: boolean
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

// The two shapes a call takes in an approved piece. A section under a heading
// (piece 2: "## OUR PREDICTION", the statement, then "How sure we are: 75%."),
// or one paragraph that opens with a bold label (piece 1: "**The Call.** By 30
// June 2027, ... Confidence: 70%."). The heading runs to the next heading or
// the end of the text; the paragraph runs to the next blank line.
const CALL_HEADING = /^#{1,3}\s*(OUR PREDICTION|THE CALL|PREDICTION)\b[^\n]*\n([\s\S]*?)(?=^#{1,3}\s|$(?![\s\S]))/im
const CALL_PARAGRAPH = /^\*\*(The Call|Our prediction)\.?\*\*[^\n]*(?:\n(?!\n)[^\n]*)*/im
const CALL_LABEL = /^\*\*(?:The Call|Our prediction)\.?\*\*[ \t]*/i

// "by 30 September 2027" (or "on", "before"), or an ISO date.
const DATE_MENTION = new RegExp(`\\b(?:(by|on|before)\\s+(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})\\b|(\\d{4})-(\\d{2})-(\\d{2})\\b)`, 'gi')
// "How sure we are: 75%" or "Confidence: 70%", the number straight after the label.
const LABELLED_CONFIDENCE = /(How sure we are|\bConfidence):[ \t]*(\d{1,3}(?:\.\d+)?)%/gi
const ANY_PERCENTAGE = /\b\d{1,3}%/
const BRACKETED = /\[[^\]]*\]/g

/** The prediction section of a piece: the text under its heading, or its
 *  bold-labelled paragraph, label included. Null when it has neither. */
export function callSectionOf(text: string): string | null {
  const body = String(text ?? '')
  const heading = body.match(CALL_HEADING)
  if (heading) return heading[2] ?? ''
  const paragraph = body.match(CALL_PARAGRAPH)
  return paragraph ? paragraph[0] : null
}

function calendarDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Every date a call could be checked by, in the order they appear. */
export function callDateMentions(text: string): CallDateMentionV1[] {
  return [...String(text ?? '').matchAll(DATE_MENTION)].map((match) => {
    const [, keyword, longDay, monthName, longYear, isoYear, isoMonth, isoDay] = match
    const iso = keyword !== undefined
      ? calendarDate(Number(longYear), MONTHS.findIndex((month) => month.toLowerCase() === String(monthName).toLowerCase()) + 1, Number(longDay))
      : calendarDate(Number(isoYear), Number(isoMonth), Number(isoDay))
    return { index: match.index ?? 0, text: match[0], iso }
  })
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

/** Text with everything in square brackets taken out: "[Krish to set]" and
 *  the like are placeholders, never a confidence. */
export function withoutBrackets(text: string): string {
  return String(text ?? '').replace(BRACKETED, '')
}

/** Whether any percentage sits outside square brackets. */
export function hasPercentage(text: string): boolean {
  return ANY_PERCENTAGE.test(withoutBrackets(text))
}

// The statement goes on a card as plain text.
function plainStatement(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(?=\S)(.*?\S)\1/g, '$2')
    .replace(/(^|[^\w*])([*_])(?=\S)([^*_]*?\S)\2(?![\w*])/g, '$1$3')
    .replace(/`([^`]*)`/g, '$1')
    .trim()
}

const refuse = (reason: string): PieceCallReadingV1 => ({ ok: false, reason })

/** Reads the call from a piece's approved text: the statement, the date to
 *  check it by and how sure we are. Refuses, with a plain reason, whenever the
 *  text leaves any of them open to doubt; it never guesses. */
export function readPieceCall(approvedText: string): PieceCallReadingV1 {
  const section = callSectionOf(String(approvedText ?? '').replace(/\r\n?/g, '\n'))
  // First the publish check's own questions, in its order and its words.
  if (section === null) return refuse(CALL_MISSING.section)
  if (callDateMentions(section).length === 0) return refuse(CALL_MISSING.date)
  if (!hasPercentage(section)) return refuse(CALL_MISSING.confidence)
  const paragraphs = section.split(/\n[ \t]*\n/).map((paragraph) => paragraph.trim().replace(CALL_LABEL, '').trim()).filter(Boolean)

  // The confidence. Anything in square brackets is blanked out, keeping every
  // other character where it was.
  const blanked = paragraphs.map((paragraph) => paragraph.replace(BRACKETED, (inside) => ' '.repeat(inside.length)))
  const found = blanked.flatMap((paragraph, at) => labelledConfidences(paragraph).map((mention) => ({ ...mention, at })))
  const first = found[0]
  if (!first) {
    const labelled = blanked.some((paragraph) => /How sure we are:|\bConfidence:/i.test(paragraph))
    return refuse(labelled ? CALL_MISSING.confidence : 'The prediction gives a percentage without "How sure we are:" in front of it, so the Studio cannot tell which number is the confidence.')
  }
  const values = [...new Set(found.map((mention) => mention.value))]
  if (values.length > 1) return refuse(`The prediction gives more than one confidence (${values.map((value) => `${value}%`).join(', ')}).`)
  if (!first.whole) return refuse(`How sure we are is a whole percentage. The prediction says ${first.value}%.`)
  if (first.percent < 1 || first.percent > 99) return refuse(`How sure we are is between 1% and 99%. The prediction says ${first.value}%.`)

  // The statement: the one paragraph with a date, up to the confidence.
  const scope = [...paragraphs.slice(0, first.at), (paragraphs[first.at] ?? '').slice(0, first.index)].map((paragraph) => paragraph.trim()).filter(Boolean)
  const dated = scope.filter((paragraph) => callDateMentions(paragraph).length > 0)
  const raw = dated[0]
  if (raw === undefined) return refuse(CALL_MISSING.date)
  if (dated.length > 1) return refuse('More than one paragraph of the prediction has a date in it, so the Studio cannot tell which one is the call.')

  // The date to check it by is the one the call opens with, or its only date.
  const mentions = callDateMentions(raw)
  const chosen = mentions[0]!
  const opensWithDate = /^[\s*_]*(?:(?:by|on|before)\s+)?$/i.test(raw.slice(0, chosen.index))
  if (!opensWithDate) {
    const distinct = [...new Set(mentions.map((mention) => mention.iso ?? mention.text))]
    if (distinct.length > 1) return refuse(`The call names more than one date (${mentions.map((mention) => mention.text).join('; ')}) and opens with none of them, so the Studio cannot tell which one to check it by.`)
  }
  if (!chosen.iso) return refuse(`The call's date, "${chosen.text}", is not a day on the calendar.`)

  const statement = plainStatement(raw)
  if (/[[\]]/.test(statement)) return refuse('The call still has something in square brackets, which reads as a placeholder.')
  return { ok: true, call: { statement, due: chosen.iso, confidence_percent: first.percent } }
}
