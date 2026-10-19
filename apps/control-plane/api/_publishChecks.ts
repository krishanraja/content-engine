// The mechanical checks a piece must pass before it can be approved or
// published: the part of Krish's house rules (api/_houseRules.ts) a machine
// can check without judgement. The PATCH that moves a piece to approved or
// published refuses until every blocking check passes; Control Center shows
// the list as a checklist. Pure: no database, no network.

import { notXYConstructions } from './_judges/deterministic.js'
// The one reader of a piece's call, shared with the Studio. Imported by its
// relative path, as video-studio/_runnerContracts.ts explains; the file has no
// dependencies of its own.
import { labelledConfidences, readPieceCall } from '../../../packages/contracts/src/call.js'

// ── Mechanical checks before approval or publication ────────────────────────

export interface Check {
  id: string
  name: string
  ok: boolean
  /** True when a failure blocks approval and publication. */
  blocking: boolean
  detail: string
}

/** The reading grade of a piece (Flesch-Kincaid), headings and markdown left
 *  out. Grade 7 is roughly a reading age of 12. A sentence may end inside a
 *  closing quote or bracket ('...models." Tech Times reported'): until
 *  2026-09-30 those ends were missed, two sentences counted as one, and
 *  piece 3, which quotes its sources word for word, read a year older than it
 *  is and was blocked (walk log F46). */
export function readingGrade(body: string): number {
  const text = String(body || '')
    .replace(/^#{1,6} .*$/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/https?:\/\/\S+/g, '')
  const sentences = text.split(/(?<=[.!?]["'”’)]*)\s+/).filter(s => /[A-Za-z]/.test(s))
  const words: string[] = text.match(/[A-Za-z0-9$%'.-]+/g) || []
  if (!sentences.length || !words.length) return 0
  const syllables = words.reduce((n, w) => {
    const x = w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    if (!x) return n
    let k = (x.match(/[aeiouy]+/g) || []).length
    if (x.endsWith('e') && k > 1) k--
    return n + Math.max(1, k)
  }, 0)
  return 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59
}

/** The house rule is an average reading age of 12, which is grade 7 (reading
 *  age is roughly grade + 5). The formula is rough and names, prices and dates
 *  push it up, so between age 12 and 13 the check warns, and above 13 it
 *  blocks. Reported in ages only: "grade" is a word the reader of the
 *  checklist would have to interpret. */
export const TARGET_READING_GRADE = 7
export const MAX_READING_GRADE = 8

/** Words a reader may need explained. Listed, never blocking: a word can be
 *  fine when the piece explains it where it first appears. */
const JARGON = /\b(API|LLMs?|inference|latency|agentic|fine-tun\w*|parameters?|benchmarks?|GPUs?|RAG|embeddings?|model routing|frontier models?|tokens?|prompts?|multimodal|throughput)\b/gi

/** American spellings, each with the British one the house writes instead
 *  (makeyourmindup.ai promises "Contains British spelling"). Each pattern
 *  keeps its stem in group 1 and its ending in group 2. The lists are explicit
 *  so a word both countries spell the same way ("program" for software,
 *  "license" as a verb, "judgment") never trips the check. Lowercase only: a
 *  capitalised match is usually a name ("Kennedy Space Center", "Department
 *  of Defense"), which keeps its own spelling. */
const US_WORDS: Record<string, string> = {
  aluminum: 'aluminium', aging: 'ageing', artifact: 'artefact', artifacts: 'artefacts',
  jewelry: 'jewellery', cozy: 'cosy', math: 'maths',
  fulfill: 'fulfil', fulfills: 'fulfils', fulfillment: 'fulfilment',
  enroll: 'enrol', enrolls: 'enrols', enrollment: 'enrolment',
  installment: 'instalment', installments: 'instalments', skillful: 'skilful', willful: 'wilful',
  // "utilise" is on the voice kill list too, so the plain word is the fix.
  utilize: 'use', utilizes: 'uses', utilized: 'used', utilizing: 'using', utilization: 'use',
}
const US_SPELLINGS: ReadonlyArray<[RegExp, (stem: string, end: string) => string]> = [
  [/\b(col|fav|behavi|lab|hon|neighb|flav|hum|rum|harb|endeav|vap|arm|cand|rig|val)or(s|ed|ing|ful|ite|ites|able|ably|hood|hoods)?\b/g, (s, e) => `${s}our${e}`],
  [/\b(cent|theat|fib|lit|kilomet|centimet|millimet|calib|somb|meag)er(s|ed|ing)?\b/g, (s, e) => (e === 'ed' || e === 'ing' ? `${s}r${e}` : `${s}re${e}`)],
  [/\b(organ|real|recogn|priorit|optim|apolog|critic|emphas|summar|standard|monet|subsid|capital|minim|maxim|special|final|categor|custom|author|character|memor|mobil|modern|normal|penal|public|stabil|visual|jeopard|legal|central|global|industrial|commercial|personal|digit|synchron|revolution|scrutin|weapon|local|incentiv|popular|rational|harmon|sanit|social|neutral|polar|privat|civil)iz(e|es|ed|ing|ation|ations|er|ers)\b/g, (s, e) => `${s}is${e}`],
  [/\b(anal|paral|catal)yz(e|es|ed|ing|er|ers)\b/g, (s, e) => `${s}ys${e}`],
  [/\b(def|off|pret)ense(s|less)?\b/g, (s, e) => `${s}ence${e}`],
  [/\b(travel|cancel|label|model|signal|fuel|level|total|marvel|counsel|channel|tunnel|funnel|dial|equal|rival|spiral|pedal|quarrel|panel)(ed|ing|er|ers)\b/g, (s, e) => `${s}l${e}`],
  [/\b(catalog)(s|ed|ing)?\b/g, (s, e) => `${s}ue${e}`],
  [/\b(practic)(ed|ing)\b/g, (_s, e) => `practis${e}`],
  [/\b(gray)(s|er|est|ing|ish)?\b/g, (_s, e) => `grey${e}`],
  [new RegExp(`\\b(${Object.keys(US_WORDS).join('|')})()\\b`, 'g'), s => US_WORDS[s]],
]

/** American spellings outside quotations, links and code, each once, with the
 *  British spelling to use. A quotation keeps its source's spelling (FACTS). */
export function americanSpellings(body: string): Array<{ found: string; use: string }> {
  const text = String(body || '')
    .replace(/^>.*$/gm, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/"[^"\n]*"|“[^”\n]*”/g, '')
  const seen = new Map<string, string>()
  for (const [pattern, uk] of US_SPELLINGS) {
    for (const m of text.matchAll(pattern)) {
      const use = uk(m[1], m[2] ?? '')
      if (use && use !== m[0] && !seen.has(m[0])) seen.set(m[0], use)
    }
  }
  return [...seen].map(([found, use]) => ({ found, use }))
}

/** Each em dash (or horizontal bar) in the text. */
export function emDashes(body: string): string[] {
  return String(body || '').match(/[—―]/g) || []
}

/** Each exclamation mark outside a quotation, with the character before it.
 *  A quotation keeps its source's punctuation. */
export function exclamationMarks(body: string): string[] {
  return String(body || '').replace(/"[^"\n]*"|“[^”\n]*”/g, '').match(/[A-Za-z0-9)\]'’]!/g) || []
}

/** Where a confidence starts to read as a clear stance. Krish, 2026-09-26, set
 *  it at 70; on 2026-10-19 he raised it and made it hold the piece: "I'm done
 *  with sitting on the fence and putting predictions a year away: 55%. There's
 *  no point in that." */
export const CLEAR_STANCE_AT = 80

/** The furthest a prediction's date may sit from the day it is checked, in days
 *  (about three months; Krish, 2026-10-19, same words). */
export const CALL_HORIZON_DAYS = 92

/** Whether the call's date falls inside the horizon: after today, and no more
 *  than CALL_HORIZON_DAYS away. Null when the piece has no readable call. */
export function callHorizon(body: string, now: Date = new Date()): { ok: boolean; detail: string } | null {
  const reading = readPieceCall(String(body || ''))
  if ('reason' in reading) return null
  const due = new Date(`${reading.call.due}T00:00:00Z`)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (days < 1) return { ok: false, detail: `The prediction's date, ${reading.call.due}, has already passed. Name an event still to come.` }
  if (days > CALL_HORIZON_DAYS) return { ok: false, detail: `The prediction is due ${reading.call.due}, ${days} days away. Name what you believe happens within about three months (${CALL_HORIZON_DAYS} days at most), not a year away.` }
  return { ok: true, detail: `Due ${reading.call.due}, ${days} days away.` }
}

/** The confidence in the prediction, as a number, or null when unset. Reads
 *  "How sure we are: 75%" and piece 1's "Confidence: 70%", with the same
 *  label reader the Studio uses for the call (readPieceCall). It once read
 *  only the first, so piece 1's 70% came back as unset and CLEAR_STANCE showed
 *  green over a detail saying "No confidence set yet" (walk log F35). */
export function confidenceOf(body: string): number | null {
  const first = labelledConfidences(String(body || '')).find(m => m.whole)
  return first ? first.percent : null
}

/** The prediction section: a heading, a date to check by, and a confidence.
 *  Either a section ("## OUR PREDICTION") or a paragraph that opens with a
 *  bold label ("**The Call.** By 30 June 2027 ... Confidence: 70%."), found by
 *  the same reader the Studio uses. This check asks only that a date and a
 *  percentage are there; the Studio's readPieceCall also asks that each is
 *  unambiguous before it puts the call on screen. */
export function predictionCheck(body: string): { ok: boolean; detail: string } {
  // The Studio's own reader: a piece passes only with a call a Short can show
  // word for word (one dated paragraph, a real date, one labelled whole
  // percentage). The looser check it replaced let a piece be approved with a
  // call the Studio then refused (walk log H32).
  const reading = readPieceCall(String(body || ''))
  if ('reason' in reading) return { ok: false, detail: reading.reason }
  return { ok: true, detail: 'Has a date to check by and a confidence.' }
}

// ── A score with nothing to measure it against (house rule PLAIN_SCORES) ───
//
// Krish, 2026-10-16, of Friday's scripts: "What does 42 even mean?". The
// script check refused bare scores from then, but the article kept printing
// them, and on 2026-10-18 he said it again of the article's own lines: "even I
// dont know what "scored 56 against that 42.3" really even means, and we
// shouldnt have to explain it. Same for "scored 57.6% for $2.94, against 52.3%
// for $15.83"". So the article is held to it too, and a test score given as a
// percentage counts: it is a score, not a share. The same reading as
// scripts/post-pack/story_check.py score_problems; keep the two in step.
const SCORE_TALK = /\b(?:scor(?:e|es|ed|ing)|points?|rated|rank(?:s|ed)?|index|benchmark|test)\b/i
const SCORED = /\bscor(?:e|es|ed|ing)\b/i
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety'
const SCORE_NUMBER = new RegExp(`(?<![\\w$£€.])(?:\\d+(?:\\.\\d+)?(?!(?:st|nd|rd|th)\\b)|(?:${TENS})(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)(?![\\w.]*\\d)`, 'gi')
const MEASURED = /^[\s-]*(?:%|percent\b|per\s+cent\b|times\b|x\b|out\s+of\b|in\s+(?:a|every|each)\s+(?:hundred|ten|thousand)\b|(?:thousand|million|billion|hundred|dollars?|pounds?|euros?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|words?|people|users?)\b)/i
const PERCENT = /^[\s-]*(?:%|percent\b|per\s+cent\b)/i
const RELATIVE = /^[\s-]*(?:%|percent|per\s+cent)\s+(?:higher|lower|more|less|better|worse|cheaper|dearer|up|down)\b/i

/** Every sentence that gives a bare score: [the number, the sentence]. */
export function bareScores(body: string): Array<{ number: string; sentence: string }> {
  const found: Array<{ number: string; sentence: string }> = []
  let afterScore = false
  const plain = String(body || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, 'a link')
  for (const line of plain.split(/\n+/)) {
    if (/^\s*#/.test(line)) { afterScore = false; continue }
    for (const raw of line.split(/(?<=[.?!]["')]?)\s+(?=["'(]?[A-Z0-9$£€])/)) {
      const s = raw.split(/\s+/).join(' ').trim()
      if (!s) continue
      const talk = SCORE_TALK.test(s)
      const scored = SCORED.test(s)
      const bare: string[] = []
      for (const m of s.matchAll(SCORE_NUMBER)) {
        const n = m[0]
        const at = m.index ?? 0
        const before = s.slice(0, at).split(/\s+/).filter(Boolean)
        const after = s.slice(at + n.length)
        if (/^(?:19|20)\d\d$/.test(n)) continue // a year
        const last = before[before.length - 1]
        if (last && /^[A-Z]/.test(last) && !/[,.]$/.test(last)) continue // a name's number: Opus 5, GPT 6.1
        // A test score given as a percentage is still a score; "40% higher" is a comparison.
        if (scored && PERCENT.test(after) && !RELATIVE.test(after)) { bare.push(`${n}%`); continue }
        if (MEASURED.test(after) || /\bout\s+of\s*$/i.test(s.slice(0, at))) continue
        bare.push(n)
      }
      if (bare.length && (talk || afterScore)) found.push({ number: bare[0], sentence: s })
      afterScore = talk || (bare.length > 0 && afterScore)
    }
  }
  return found
}

/** Every mechanical check a piece must pass before it can be approved or
 *  published. `factGate` is the fact gate's own verdict for this exact text. */
export function publishChecks(body: string, factGate: { ok: boolean; reason: string | null }, now: Date = new Date()): Check[] {
  const text = String(body || '')
  const checks: Check[] = []
  checks.push({ id: 'FACTS', name: 'Every fact checked twice', blocking: true, ok: factGate.ok, detail: factGate.ok ? 'This exact version passed the fact check.' : (factGate.reason || 'The facts have not passed yet.') })
  const nxy = notXYConstructions(text)
  checks.push({ id: 'R2', name: 'No "Not X, Y"', blocking: true, ok: nxy.length === 0, detail: nxy.length ? `Found: ${nxy.slice(0, 3).map(h => `"${h}"`).join('; ')}` : 'None found.' })
  const dashes = emDashes(text).length
  checks.push({ id: 'NO_EM_DASH', name: 'No em dashes', blocking: true, ok: dashes === 0, detail: dashes ? `${dashes} found.` : 'None found.' })
  const bangs = exclamationMarks(text)
  checks.push({ id: 'NO_EXCLAMATION', name: 'No exclamation marks', blocking: true, ok: bangs.length === 0, detail: bangs.length ? `${bangs.length} found outside quotations.` : 'None found.' })
  const us = americanSpellings(text)
  checks.push({ id: 'BRITISH_SPELLING', name: 'British spelling', blocking: true, ok: us.length === 0, detail: us.length ? `Found: ${us.slice(0, 5).map(w => `${w.found} (write ${w.use})`).join(', ')}${us.length > 5 ? `, and ${us.length - 5} more` : ''}.` : 'None found.' })
  const scores = bareScores(text)
  checks.push({ id: 'PLAIN_SCORES', name: 'No bare scores', blocking: true, ok: scores.length === 0, detail: scores.length ? `Say these as a plain comparison, a share or a multiple: ${scores.slice(0, 3).map(f => `"${f.number}" in "${f.sentence.slice(0, 90)}"`).join('; ')}${scores.length > 3 ? `, and ${scores.length - 3} more` : ''}.` : 'None found.' })
  const grade = readingGrade(text)
  const age = Math.max(6, Math.round((grade + 5) * 2) / 2)
  checks.push({
    id: 'R7', name: 'Reading age 12',
    blocking: grade > MAX_READING_GRADE,
    ok: grade <= TARGET_READING_GRADE,
    detail: grade <= TARGET_READING_GRADE
      ? `Reads at about age ${age}.`
      : grade <= MAX_READING_GRADE
        // One decimal above the target: rounded to the half, 12.03 read "about
        // age 12, a little above 12" (piece 1, 2026-09-30) and 13.03 read "about
        // age 13. Above 13 cannot be approved", each contradicting itself.
        ? `Reads at about age ${(grade + 5).toFixed(1)}, a little above 12. Shorten the longest sentences.`
        : `Reads at about age ${(grade + 5).toFixed(1)}. Above 13 cannot be approved: shorten sentences and swap long words for short ones.`,
  })
  const call = predictionCheck(text)
  checks.push({ id: 'CALL', name: 'A dated prediction with a confidence', blocking: true, ok: call.ok, detail: call.detail })
  const horizon = callHorizon(text, now)
  checks.push({ id: 'CALL_HORIZON', name: 'A prediction due within about three months', blocking: true, ok: horizon?.ok ?? false, detail: horizon?.detail ?? 'No readable prediction date yet.' })
  // A block since 2026-10-19 (Krish: "I'm done with sitting on the fence"):
  // the call is what we believe will happen, backed at 80% or more.
  // Green only on a number it has read. A confidence it cannot read is not a
  // clear stance, whatever CALL makes of the section.
  const sure = confidenceOf(text)
  checks.push({
    id: 'CLEAR_STANCE', name: 'Take a clear stance', blocking: true,
    ok: sure !== null && sure >= CLEAR_STANCE_AT,
    detail: sure === null
      ? (call.ok
        ? 'The prediction has a percentage this check cannot read as its confidence. Write it as "How sure we are: 85%".'
        : 'No confidence set yet.')
      : sure >= CLEAR_STANCE_AT ? `${sure}% is a clear stance.`
      : `${sure}% reads as sitting on the fence. Back the outcome we believe with a clearer number.`,
  })
  // One entry per word: "token" and "tokens" are the same thing to fix.
  const jargon = [...new Set((text.match(JARGON) || []).map(w => w.toLowerCase().replace(/s$/, '')))]
    .map(w => /^(api|llm|gpu|rag)$/.test(w) ? w.toUpperCase() : w)
  checks.push({ id: 'R6', name: 'Plain words', blocking: false, ok: jargon.length === 0, detail: jargon.length ? `Make sure each is explained where it first appears: ${jargon.join(', ')}.` : 'No listed jargon found.' })
  return checks
}

/** Whether the blocking checks all pass, and the reason when they do not. */
export function publishStatus(checks: Check[]): { ok: boolean; reason: string | null; failing: Check[] } {
  const failing = checks.filter(c => c.blocking && !c.ok)
  return { ok: failing.length === 0, failing, reason: failing.length ? `Before this can be approved: ${failing.map(c => `${c.name.toLowerCase()} (${c.detail})`).join(' ')}` : null }
}
