// The fact gate.
//
// Krish, 2026-09-25, after the engine's first draft of piece 2 shrank Cisco's
// $900 million a year to "close to a million dollars" and gave Anthropic one
// model in 2024 when it sold three: "Stats and facts need to probably be passed
// through a separate verification gate using perplexity or something, we
// cannot afford even a chance of factual errors slipping in."
//
// So a piece cannot go to review, be approved or be published until every
// checkable claim in its exact current body has been verified, twice where it
// can be, by checkers that never saw the writer's reasoning:
//
//   1. On file. A model finds the claim in the sources the piece was written
//      from and must return the passage VERBATIM. The quote is then checked
//      against the source text in code, and every number in the claim must
//      appear in it. A paraphrase, or a quote the sources do not contain,
//      counts as not found. The model cannot vouch for a claim; only text can.
//   2. Independently. Perplexity checks the claim against the live web, with
//      citations. Without its key the Exa or Brave search is judged instead,
//      and with none of the three the gate cannot pass at all.
//
// A mechanical sweep backs up the model that lists the claims: every sentence
// with a digit or a quotation mark is either checked or explicitly set aside
// as a prediction, scenario or labelled inference, and a set-aside is only
// honoured when the sentence reads like one.
//
// The gate is honest about its limit. Two checkers that agree can both be
// wrong, so the claim table goes to Krish with each verdict, its quote and
// its link, and "one source" is said wherever there was one.

import { createHash } from 'node:crypto'
import { sanitizeVoice } from './_content.js'

export type ClaimKind = 'number' | 'date' | 'quote' | 'attribution' | 'event' | 'name' | 'other' | 'unclassified'
export type OnFileVerdict = 'supported' | 'contradicted' | 'not_found'
export type IndependentVerdict = 'supported' | 'contradicted' | 'unclear' | 'unavailable'
export type ClaimVerdict = 'verified' | 'verified_on_file' | 'verified_web' | 'contradicted' | 'unverified'

export interface Claim {
  sentence: string
  claim: string
  kind: ClaimKind
}

export interface CheckedClaim extends Claim {
  /** primary: every passage is in a verbatim excerpt of the source itself,
   *  not only in a summary someone wrote of it. */
  on_file: { verdict: OnFileVerdict; quote: string | null; note: string | null; primary?: boolean }
  independent: { verdict: IndependentVerdict; evidence: string | null; url: string | null; checker: string | null; correct_value: string | null }
  verdict: ClaimVerdict
}

export interface FactCheck {
  version: 1
  ran_at: string
  body_hash: string
  independent_checker: string | null
  claims: CheckedClaim[]
  set_aside: Array<{ sentence: string; reason: string }>
  passed: boolean
  blocking: number
  single_source: number
}

export const FACT_GATE_VERSION = 1 as const
export const PASSING: ReadonlySet<ClaimVerdict> = new Set(['verified', 'verified_on_file', 'verified_web'])

/** The hash a check is pinned to. It is taken over the text as save-draft
 *  will store it (sanitizeVoice only swaps dashes for commas), so a checked
 *  draft stays checked through that save, and any change to a word or a
 *  number breaks the match. */
export function bodyHash(body: string): string {
  return createHash('sha256').update(sanitizeVoice(String(body ?? '')).trim()).digest('hex')
}

/** Lowercase, straight quotes and apostrophes, no markdown emphasis, one space. */
export function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Sentences of a markdown body, headings left out. */
export function sentences(body: string): string[] {
  const out: string[] = []
  for (const block of String(body || '').split(/\n{2,}/)) {
    // Drop heading LINES, not blocks: a heading followed by text on the next
    // line is one block, and skipping it would hide that text from the sweep.
    const b = block.split('\n').filter(l => !/^\s*#{1,6}\s/.test(l)).join('\n').trim()
    if (!b) continue
    for (const s of b.replace(/\n/g, ' ').split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[A-Z0-9$£€])/)) {
      const t = s.trim()
      if (t) out.push(t)
    }
  }
  return out
}

/** A sentence the gate must see: it carries a number or a quotation. */
export function isCheckable(sentence: string): boolean {
  return /\d/.test(sentence) || /["“”]/.test(sentence)
}

/** Reads like something that has not happened yet, or like a labelled guess. */
export function readsAsForecast(sentence: string): boolean {
  return /\b(will|would|could|might|may|if|bet|call|forecast|predict|scenario|inference|we think|our read|going to|\w+['’]ll|by (?:\d{1,2} )?(?:january|february|march|april|may|june|july|august|september|october|november|december)?\s*\d{4})\b/i.test(sentence)
}

/** The numbers in a text, as bare digit strings: "$900 million" -> "900". */
export function numbersIn(s: string): string[] {
  return (String(s || '').match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n => n.replace(/,/g, '')).filter(n => n.length > 0)
}

/** Why a set of passages fails, or null when every one is really in the
 *  sources and together they carry every number in the claim. Up to three
 *  passages, because a fact is often split: the date in a heading, the fact
 *  below it. */
export function quotesFail(quotes: Array<string | null> | null, sourcesText: string, claim: string): string | null {
  const list = (quotes || []).filter((q): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 3)
  if (list.length === 0) return 'no passage given'
  const src = norm(sourcesText)
  for (const q of list) {
    const n = norm(q)
    if (n.length < 12) return `passage too short to trust: "${q.slice(0, 40)}"`
    if (!src.includes(n)) return `passage not found word for word in the sources: "${q.slice(0, 80)}"`
  }
  const carried = new Set(list.flatMap(numbersIn))
  const missing = numbersIn(claim).filter(n => !carried.has(n))
  return missing.length ? `the passages do not carry ${missing.join(', ')}` : null
}

/** True only when the quote really is in the sources and carries the claim's numbers. */
export function quoteHolds(quote: string | null, sourcesText: string, claim: string): boolean {
  return quotesFail([quote], sourcesText, claim) === null
}

/** The sweep's leftovers after a second look. A sentence the second look
 *  finds claims in is checked claim by claim. One it finds none in is set
 *  aside with its reason, but only when it has no digits or reads as a
 *  forecast: a number is never waved through on a model's word. Anything the
 *  second look did not answer stays a claim, so a failed call fails closed. */
export function resolveLeftovers(
  leftovers: Claim[],
  answers: Array<{ i: number; claims: Array<{ claim: string; kind: string }>; reason: string }>,
): { claims: Claim[]; setAside: Array<{ sentence: string; reason: string }> } {
  const claims: Claim[] = []
  const setAside: Array<{ sentence: string; reason: string }> = []
  leftovers.forEach((l, i) => {
    const a = answers.find(x => x.i === i)
    if (!a) { claims.push(l); return }
    const found = (a.claims || []).filter(c => typeof c?.claim === 'string' && c.claim.trim())
    if (found.length) {
      for (const c of found) claims.push({ sentence: l.sentence, claim: c.claim.trim(), kind: (KIND_SET.has(c.kind) ? c.kind : 'other') as ClaimKind })
      return
    }
    if (!/\d/.test(l.sentence) || readsAsForecast(l.sentence)) setAside.push({ sentence: l.sentence, reason: `second look: ${String(a.reason || 'no factual claim').slice(0, 80)}` })
    else claims.push(l)
  })
  return { claims, setAside }
}

const KIND_SET = new Set(['number', 'date', 'quote', 'attribution', 'event', 'name', 'other'])

/** Every checkable sentence is covered by a claim or an honoured set-aside;
 *  anything left over becomes a claim of its own. */
export function sweep(body: string, claims: Claim[], setAside: Array<{ sentence: string; reason: string }>): {
  claims: Claim[]; setAside: Array<{ sentence: string; reason: string }>
} {
  const covered = (s: string, list: Array<{ sentence: string }>) => {
    const n = norm(s)
    return list.some(c => { const m = norm(c.sentence); return m.length >= 12 && (n.includes(m) || m.includes(n)) })
  }
  const honoured = setAside.filter(a => readsAsForecast(a.sentence))
  const extra: Claim[] = []
  for (const s of sentences(body)) {
    if (!isCheckable(s)) continue
    if (covered(s, claims) || covered(s, honoured)) continue
    extra.push({ sentence: s, claim: s, kind: 'unclassified' })
  }
  return { claims: [...claims, ...extra], setAside: honoured }
}

/** One source is enough only when it is the source's own words. The engine's
 *  research on piece 2 listed GPT-6 Luna's Batch price as its standard price;
 *  a claim resting on that summary alone would have passed. So a claim found
 *  only in a summary needs the web to agree. */
export function combine(onFile: OnFileVerdict, independent: IndependentVerdict, primary = false): ClaimVerdict {
  if (onFile === 'contradicted' || independent === 'contradicted') return 'contradicted'
  if (onFile === 'supported' && independent === 'supported') return 'verified'
  if (onFile === 'supported' && primary) return 'verified_on_file'
  if (independent === 'supported') return 'verified_web'
  return 'unverified'
}

export function summarise(claims: CheckedClaim[], setAside: Array<{ sentence: string; reason: string }>, body: string, checker: string | null, at = new Date().toISOString()): FactCheck {
  const blocking = claims.filter(c => !PASSING.has(c.verdict)).length
  return {
    version: FACT_GATE_VERSION,
    ran_at: at,
    body_hash: bodyHash(body),
    independent_checker: checker,
    claims,
    set_aside: setAside,
    passed: !!checker && blocking === 0,
    blocking,
    single_source: claims.filter(c => c.verdict === 'verified_on_file' || c.verdict === 'verified_web').length,
  }
}

/** Whether a body may move on. The check must be of THIS body, and clean. */
// A plain shape rather than a union: this tsconfig runs with strict off, which
// widens `ok: true` to boolean and stops a union narrowing (see judge/ladder.ts).
export function gateStatus(meta: Record<string, any> | null, body: string): { ok: boolean; reason: string | null } {
  const fc = meta?.fact_check as FactCheck | undefined
  if (!fc || fc.version !== FACT_GATE_VERSION) return { ok: false, reason: 'The facts in this piece have not been checked yet. Run the fact check first.' }
  if (fc.body_hash !== bodyHash(body)) return { ok: false, reason: 'The words changed after the fact check. Run it again on this version.' }
  if (!fc.independent_checker) return { ok: false, reason: 'No independent fact checker was connected, so nothing can pass. Perplexity needs its key.' }
  if (!fc.passed) return { ok: false, reason: `${fc.blocking} claim${fc.blocking === 1 ? '' : 's'} failed the fact check. Fix or cut them, then run it again.` }
  return { ok: true, reason: null }
}

// ── The prompts ─────────────────────────────────────────────────────────────

export const EXTRACT_SYSTEM = [
  'You list the factual claims in a piece of writing so that each can be checked. You do not judge them.',
  'A claim is anything a reader could check as true or false: a number, price, percentage, date, a name with a role, a quotation, who said what, what a company did or released or wrote, what a document says, what happened when.',
  'Split compound sentences: one claim per checkable fact. Keep "sentence" as the EXACT sentence from the text, copied character for character, so it can be found again.',
  'Not claims: opinions, jokes, analogies, labelled inference, predictions, scenarios, and the piece\'s forecast. List any such sentence that contains a number or a quotation under "set_aside" with its reason (prediction, scenario, labelled_inference, opinion, analogy), so nothing with a number goes unaccounted for.',
  'Return JSON only: {"claims":[{"sentence":"...","claim":"the single fact, stated plainly","kind":"number|date|quote|attribution|event|name|other"}],"set_aside":[{"sentence":"...","reason":"..."}]}',
].join('\n')

export const ON_FILE_SYSTEM = [
  'You check ONE claim against the sources below, which are the only evidence you may use. You never use your own knowledge.',
  'supported: the sources state it. Return the passage or passages that state it, each copied EXACTLY, character for character. Give up to three passages only when the fact is split across them (for example the date in a heading and the fact under it); together they must contain every number in the claim.',
  'contradicted: the sources say something different (a different number, date, name, speaker or meaning). Return the exact passage that contradicts it, and say what it says.',
  'not_found: the sources do not state it. A claim that is only implied, rounded, rescaled, or said by a different person is not_found or contradicted, never supported. Words put in someone\'s mouth must be their words.',
  'Return JSON only: {"verdict":"supported|contradicted|not_found","quotes":["exact passage", "..."],"note":"one line"}',
].join('\n')

export const SECOND_LOOK_SYSTEM = [
  'These sentences come from a piece of writing. Each has a number or a quotation mark, and nobody listed a factual claim in it yet.',
  'For each sentence, list every factual claim a reader could check as true or false: a number, a date, a quotation or who said something, what a company or person did, a definition presented as fact. One claim per fact, stated plainly.',
  'A scare quote, an analogy, a joke, a made-up example line, an opinion, a hypothetical or a description of a possible future is not a claim; for such a sentence return no claims and give the reason in a few words.',
  'Return JSON only: {"answers":[{"i":0,"claims":[{"claim":"...","kind":"number|date|quote|attribution|event|name|other"}],"reason":"..."}]}',
].join('\n')

export const ENTAIL_SYSTEM = [
  'A fact checker quoted a source about a claim. Judge only from the quoted evidence, never from your own knowledge.',
  'states: the evidence, read on its own, states every part of the claim (each number, date, name and who said it), in the same meaning.',
  'conflicts: the evidence states something that cannot be true at the same time as the claim (a different number, date, speaker or meaning). A source that says less, or says nothing about part of the claim, does not conflict.',
  'neither: anything else.',
  'Return JSON only: {"answer":"states|conflicts|neither","why":"one line"}',
].join('\n')

export const INDEPENDENT_SYSTEM = [
  'You are a fact checker. Check ONE claim against reliable published sources. Be strict: supported only if a reliable source states it as written, including the numbers, dates and who said it.',
  'If a source states something different, the verdict is contradicted and correct_value says what the source says. If you cannot find it stated, the verdict is unclear.',
  'Return JSON only: {"verdict":"supported|contradicted|unclear","evidence":"a short exact quote from the source","url":"the source URL","correct_value":"only when contradicted"}',
].join('\n')
