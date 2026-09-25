// The mechanical checks a piece must pass before it can be approved or
// published: the part of Krish's house rules (api/_houseRules.ts) a machine
// can check without judgement. The PATCH that moves a piece to approved or
// published refuses until every blocking check passes; Control Center shows
// the list as a checklist. Pure: no database, no network.

import { notXYConstructions } from './_judges/deterministic.js'

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

/** The prediction section: a heading, a date to check by, and a confidence. */
export function predictionCheck(body: string): { ok: boolean; detail: string } {
  // Either a section ("## OUR PREDICTION") or a paragraph that opens with a
  // bold label ("**The Call.** By 30 June 2027 ... Confidence: 70%.").
  const text = String(body || '')
  const heading = text.match(/^#{1,3}\s*(OUR PREDICTION|THE CALL|PREDICTION)\b[^\n]*\n([\s\S]*?)(?=^#{1,3}\s|$(?![\s\S]))/im)
  const para = text.match(/^\*\*(The Call|Our prediction)\.?\*\*[^\n]*(?:\n(?!\n)[^\n]*)*/im)
  const section = heading ? heading[2] : para ? para[0] : null
  if (section === null) return { ok: false, detail: 'No prediction section. Every piece ends with what will happen, a date to check it by, and how sure we are.' }
  const date = /\b(by|on|before)\s+\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i.test(section)
  const sure = /\b\d{1,3}%/.test(section.replace(/\[[^\]]*\]/g, ''))
  if (!date) return { ok: false, detail: 'The prediction has no date to check it by.' }
  if (!sure) return { ok: false, detail: 'The prediction has no confidence yet. Krish sets how sure we are, as a percentage.' }
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
  const dashes = (text.match(/[—―]/g) || []).length
  checks.push({ id: 'NO_EM_DASH', name: 'No em dashes', blocking: true, ok: dashes === 0, detail: dashes ? `${dashes} found.` : 'None found.' })
  const bangs = text.replace(/"[^"\n]*"|“[^”\n]*”/g, '').match(/[A-Za-z0-9)\]'’]!/g) || []
  checks.push({ id: 'NO_EXCLAMATION', name: 'No exclamation marks', blocking: true, ok: bangs.length === 0, detail: bangs.length ? `${bangs.length} found outside quotations.` : 'None found.' })
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
