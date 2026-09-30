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
 *  out. Grade 7 is roughly a reading age of 12. */
export function readingGrade(body: string): number {
  const text = String(body || '')
    .replace(/^#{1,6} .*$/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/https?:\/\/\S+/g, '')
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => /[A-Za-z]/.test(s))
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

/** Where a confidence starts to read as a clear stance (Krish, 2026-09-26). */
export const CLEAR_STANCE_AT = 70

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

/** Every mechanical check a piece must pass before it can be approved or
 *  published. `factGate` is the fact gate's own verdict for this exact text. */
export function publishChecks(body: string, factGate: { ok: boolean; reason: string | null }): Check[] {
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
  const grade = readingGrade(text)
  const age = Math.max(6, Math.round((grade + 5) * 2) / 2)
  checks.push({
    id: 'R7', name: 'Reading age 12',
    blocking: grade > MAX_READING_GRADE,
    ok: grade <= TARGET_READING_GRADE,
    detail: grade <= TARGET_READING_GRADE
      ? `Reads at about age ${age}.`
      : grade <= MAX_READING_GRADE
        ? `Reads at about age ${age}, a little above 12. Shorten the longest sentences.`
        : `Reads at about age ${age}. Above 13 cannot be approved: shorten sentences and swap long words for short ones.`,
  })
  const call = predictionCheck(text)
  checks.push({ id: 'CALL', name: 'A dated prediction with a confidence', blocking: true, ok: call.ok, detail: call.detail })
  // A warning, never a block: the number is Krish's, and he may choose a
  // middling one on purpose. 70% is where "clear" starts in this check, set
  // from his own pair of examples (60% fence-sitting, 75% clear).
  // Green only on a number it has read. A confidence it cannot read is not a
  // clear stance, whatever CALL makes of the section.
  const sure = confidenceOf(text)
  checks.push({
    id: 'CLEAR_STANCE', name: 'Take a clear stance', blocking: false,
    ok: sure !== null && sure >= CLEAR_STANCE_AT,
    detail: sure === null
      ? (call.ok
        ? 'The prediction has a percentage this check cannot read as its confidence. Write it as "How sure we are: 75%".'
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
