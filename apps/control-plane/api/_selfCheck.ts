// The writer's self-check (walk log F42).
//
// On 2026-09-30, when drafting resumed after a provider outage, the writers
// kept breaking Krish's blocking rules even when told exactly what to fix.
// Piece 1's rewrite came back with two "Not X, Y" constructions ("Those words
// were about Perplexity's robot, not Muse."). A rewrite of that one sentence,
// asked to remove it, returned it three times running. Piece 3's first draft
// broke R2 three times and read at about age 13.5, above the blocking limit.
// Each cost a rewrite or a hand edit, and the prompt caching pass waits on
// three pieces in a row that need neither (docs/CONTENT_ENGINE.md).
//
// So once a writer has answered, the publish gate's own mechanical checks
// read the answer: R2, em dashes, exclamation marks outside quotes, American
// spellings, and the reading age when it is above the blocking limit. When
// any fails, the writer gets one more call: the same system prompt, its own
// first answer, and a short correction naming each hit and the rule it
// breaks. The answer with fewer failures is returned, with what it still
// breaks, so a caller never has to guess. The checks are the gate's functions
// (api/_publishChecks.ts) and the rules are the house rules
// (api/_houseRules.ts); nothing here keeps a copy of either.
//
// Pure apart from the retry the caller hands in, which is a metered model
// call like any other.

import { notXYConstructions } from './_judges/deterministic.js'
import { americanSpellings, emDashes, exclamationMarks, publishChecks } from './_publishChecks.js'
import { HOUSE_RULES } from './_houseRules.js'
import { sentences, UNSET } from './_factGate.js'
import { classifyAnthropicFailure, describeFailure } from './_modelProvider.js'
// The one reader of a piece's call, shared with the publish checks, the fact
// gate and the Studio. Imported by its relative path, as they do.
import { callSectionOf, labelledConfidences } from '../../../packages/contracts/src/call.js'

/** The blocking checks a writer can meet on its own, by the ids the approval
 *  checklist uses. The fact gate and the call need the sources and Krish. */
export const SELF_CHECKED = ['R2', 'NO_EM_DASH', 'NO_EXCLAMATION', 'BRITISH_SPELLING', 'R7'] as const
export type SelfCheckedRule = typeof SELF_CHECKED[number]

export interface SelfCheckHit {
  rule: SelfCheckedRule
  /** The sentence that breaks the rule, the American word, or the reading age. */
  found: string
  /** For a spelling, the British word to write. */
  use?: string
}

/** What a writer's answer still breaks, as every writer route reports it. */
export interface SelfCheck {
  /** Whether the text returned passes every check above. */
  passed: boolean
  /** What the text returned still breaks. Empty when it passed. */
  remaining: SelfCheckHit[]
  /** Whether a second call ran and answered. */
  retried: boolean
  /** Why the first answer was kept, when a second call was wanted. */
  note?: string
  /** Whether Krish's confidence had to be put back (guardConfidence). */
  confidence_restored?: boolean
}

/** The retry gets the rest of the request's time, and runs only with this
 *  much of it left. */
export const MIN_RETRY_MS = 20_000

// The whole sentence a hit sits in, so the correction names what to rewrite.
// A "Not X, Y" match can start mid-word or cross a full stop ("That's not
// matching the leading models. That's finishing third"), so it is widened to
// the sentence starts and ends around it.
function sentenceAround(text: string, hit: string): string {
  const at = text.indexOf(hit)
  if (at < 0) return hit
  let start = 0
  for (const m of text.slice(0, at).matchAll(/[.!?]["'”’)]*\s+|\n/g)) start = (m.index ?? 0) + m[0].length
  const rest = text.slice(at + hit.length)
  const stop = /[.!?]["'”’)]*(?=\s|$)|\n/.exec(rest)
  const end = stop ? at + hit.length + stop.index + (stop[0] === '\n' ? 0 : stop[0].length) : text.length
  return text.slice(start, end).trim()
}

/** Every blocking hit in a writer's text, by the checks the approval
 *  checklist runs. The reading age is a property of a whole piece, so a
 *  caller checking one passage leaves it out. */
export function blockingHits(text: string, opts: { readingAge: boolean }): SelfCheckHit[] {
  const body = String(text || '')
  const failing = publishChecks(body, { ok: true, reason: null })
    .filter(c => c.blocking && !c.ok && (SELF_CHECKED as readonly string[]).includes(c.id))
    .filter(c => opts.readingAge || c.id !== 'R7')
  const ids = new Set(failing.map(c => c.id))
  const hits: SelfCheckHit[] = []
  if (ids.has('R2')) for (const h of notXYConstructions(body)) hits.push({ rule: 'R2', found: sentenceAround(body, h) })
  if (ids.has('NO_EM_DASH')) for (const s of sentences(body)) if (emDashes(s).length) hits.push({ rule: 'NO_EM_DASH', found: s })
  if (ids.has('NO_EXCLAMATION')) for (const s of sentences(body)) if (exclamationMarks(s).length) hits.push({ rule: 'NO_EXCLAMATION', found: s })
  if (ids.has('BRITISH_SPELLING')) for (const w of americanSpellings(body)) hits.push({ rule: 'BRITISH_SPELLING', found: w.found, use: w.use })
  // Anything the checklist failed that no sentence above names (a dash in a
  // heading, the reading age) is reported in the checklist's own words.
  for (const c of failing) if (!hits.some(h => h.rule === c.id)) hits.push({ rule: c.id as SelfCheckedRule, found: c.detail })
  return hits.filter((h, i) => hits.findIndex(g => g.rule === h.rule && g.found === h.found) === i)
}

/** The longest sentences, the ones a shorter reading age starts with. */
function longestSentences(text: string, n: number): string[] {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length
  return sentences(text).sort((a, b) => words(b) - words(a)).slice(0, n)
}

/** The message the writer's second call gets: each hit, the rule it breaks
 *  in the house rules' own words, and how to answer. */
export function correctionFor(text: string, hits: SelfCheckHit[], answer: string): string {
  const lines = ['Your answer breaks rules that block approval. Fix each of these.']
  for (const id of SELF_CHECKED) {
    const mine = hits.filter(h => h.rule === id)
    if (!mine.length) continue
    const rule = HOUSE_RULES.find(r => r.id === id)
    lines.push('', rule ? `${rule.name}. ${rule.text}` : id)
    if (id === 'BRITISH_SPELLING') for (const h of mine) lines.push(`- "${h.found}": write "${h.use}".`)
    else if (id === 'R7') {
      lines.push(`- ${mine[0]!.found}`, '- The longest sentences:')
      for (const s of longestSentences(text, 3)) lines.push(`  "${s}"`)
    } else for (const h of mine) lines.push(`- "${h.found}"`)
  }
  lines.push('', `Rewrite only these sentences; keep every other word. ${answer}`)
  return lines.join('\n')
}

export interface SelfChecked {
  /** The answer to return: the first, or the second when it breaks fewer rules. */
  text: string
  chose: 'first' | 'retry'
  self_check: SelfCheck
}

/**
 * Check a writer's answer and, when it breaks a blocking rule, ask once more.
 *
 * `retry` makes the second call with the correction and resolves to its
 * answer, cleaned the way the first was, or null when that answer cannot be
 * used. It must end by `timeoutMs`. A provider failure on it keeps the first
 * answer with a note; the request never fails for it.
 */
export async function selfCheck(opts: {
  /** The writer's first answer, cleaned (sanitizeVoice and the rest). */
  first: string
  readingAge: boolean
  /** How the writer answers the correction ("Return only the rewritten text."). */
  answer: string
  /** When the request's time runs out, as epoch milliseconds. */
  deadline: number
  /** A second answer shorter than this share of the first reads as cut off. */
  minShare?: number
  retry: (correction: string, timeoutMs: number) => Promise<string | null>
}): Promise<SelfChecked> {
  const firstHits = blockingHits(opts.first, { readingAge: opts.readingAge })
  const keep = (retried: boolean, note?: string): SelfChecked => ({
    text: opts.first,
    chose: 'first',
    self_check: { passed: firstHits.length === 0, remaining: firstHits, retried, ...(note ? { note } : {}) },
  })
  if (!firstHits.length) return keep(false)

  const left = opts.deadline - Date.now()
  if (left < MIN_RETRY_MS) return keep(false, 'There was no time left in this request for a second try, so this is the first answer.')

  let second: string | null
  try {
    second = await opts.retry(correctionFor(opts.first, firstHits, opts.answer), left)
  } catch (e) {
    return keep(false, `The second try did not run. ${describeFailure(classifyAnthropicFailure(e))} This is the first answer.`)
  }
  if (!second || !second.trim() || second.length < opts.first.length * (opts.minShare ?? 0)) {
    return keep(true, 'The second try came back empty, unreadable or cut short, so this is the first answer.')
  }
  const secondHits = blockingHits(second, { readingAge: opts.readingAge })
  if (secondHits.length >= firstHits.length) {
    return keep(true, 'The second try broke as many rules as the first, so this is the first answer.')
  }
  return { text: second, chose: 'retry', self_check: { passed: secondHits.length === 0, remaining: secondHits, retried: true } }
}

// ── Krish's confidence ─────────────────────────────────────────────────────
//
// How sure we are is Krish's judgement and his alone (his ruling,
// 2026-09-26: "I'd rather take a clearer stance than sit on the fence all the
// time and say 60%", and he sets the number). On 2026-09-30 piece 3's first
// draft was told to end with "How sure we are: [Krish to set]" and wrote
// "How sure we are: 78%." on its own: an engine-invented number that could
// have reached a reader as his stance (walk log F43). So after the model and
// any retry, the confidence is put back in code.

/** What a first draft says until Krish sets the number. */
export const UNSET_CONFIDENCE = `How sure we are: ${UNSET}`

interface ConfidenceMention { start: number; end: number; text: string }

/** Every place a text states Krish's confidence, by the shared call reader:
 *  "How sure we are:" anywhere, and "Confidence:" inside the call only, as
 *  the fact gate reads them (a labelled number elsewhere, "Consumer
 *  confidence: 62% in August", is a fact about something else). Each with its
 *  number, or with the placeholder. */
function confidenceMentions(text: string): ConfidenceMention[] {
  const found: Array<{ start: number; end: number }> = []
  const read = (offset: number, scope: string, label: 'how_sure_we_are' | 'confidence') => {
    for (const m of labelledConfidences(scope)) {
      if (m.label !== label) continue
      const at = scope.indexOf(`${m.value}%`, m.index)
      if (at >= 0) found.push({ start: offset + m.index, end: offset + at + m.value.length + 1 })
    }
    const unset = `${label === 'how_sure_we_are' ? 'How sure we are' : 'Confidence'}: ${UNSET}`
    for (let at = scope.indexOf(unset); at >= 0; at = scope.indexOf(unset, at + 1)) found.push({ start: offset + at, end: offset + at + unset.length })
  }
  read(0, text, 'how_sure_we_are')
  const section = callSectionOf(text)
  const from = section && section.trim() ? text.indexOf(section) : -1
  if (section && from >= 0) read(from, section, 'confidence')
  return found.sort((a, b) => a.start - b.start).map(m => ({ ...m, text: text.slice(m.start, m.end) }))
}

// A confidence the writer dropped goes back at the end of the call: its own
// paragraph under a heading, the paragraph's last sentence in the bold-label
// form. With no call at all there is nowhere to put it, and the CALL check
// says so.
function putBack(text: string, line: string): string {
  const section = callSectionOf(text)
  if (section === null || !section.trim()) return text
  const from = text.indexOf(section)
  if (from < 0) return text
  const end = from + section.trimEnd().length
  return text.slice(0, end) + (section.trimStart().startsWith('**') ? ' ' : '\n\n') + line + text.slice(end)
}

/**
 * Krish's confidence, after a writer. A first draft (`source` null) says
 * "How sure we are: [Krish to set]" whatever the model wrote. A rewrite keeps
 * the source's confidence exactly, label and number ("How sure we are: 70%",
 * "Confidence: 70%", or the placeholder), and a rewrite of a source with none
 * gets the placeholder in place of any number it wrote. A confidence the
 * model dropped is put back. `restored` says whether anything changed.
 */
export function guardConfidence(text: string, source: string | null): { text: string; restored: boolean } {
  const theirs = source === null ? [] : confidenceMentions(source)
  const want = theirs[0]?.text ?? UNSET_CONFIDENCE
  const mine = confidenceMentions(text)
  let out = text
  for (const m of [...mine].reverse()) if (m.text !== want) out = out.slice(0, m.start) + want + out.slice(m.end)
  if (!mine.length && (source === null || theirs.length)) {
    out = putBack(out, want + (source !== null && source[theirs[0]!.end] === '.' ? '.' : ''))
  }
  return { text: out, restored: out !== text }
}
