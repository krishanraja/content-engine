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
import { readMaterials, sanitizeVoice } from './_content.js'
import { stripMarkdownLinks } from './_text.js'
// The one reader of a piece's call, shared with the publish checks and the
// Studio. Imported by its relative path, as api/_publishChecks.ts does.
import { callSectionOf, labelledConfidences } from '../../../packages/contracts/src/call.js'

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
  /** When this verdict was earned on an earlier run and carried, unchanged,
   *  into this one (carryForward below): that run's time. */
  carried_from?: string
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
  /** How many sentences the second look read, and how many it never answered
   *  (each of those stayed a claim). */
  second_look?: { sentences: number; unanswered: number }
  /** How many sentences kept the result an earlier run gave them, because
   *  their words and the piece's sources had not changed (carryForward). */
  carried?: number
}

export const FACT_GATE_VERSION = 1 as const
export const PASSING: ReadonlySet<ClaimVerdict> = new Set(['verified', 'verified_on_file', 'verified_web'])

/** Krish's confidence in the piece's own prediction is his judgement, never a
 *  checked fact, so setting it must not put a passed check out of date (he set
 *  piece 2's to 75% on 2026-09-26 and it would otherwise have cost a full
 *  re-check; his ruling that day: a confidence no longer forces a fact
 *  re-check). A line that is only "How sure we are:" and a bare percentage or
 *  the placeholder is the form this first read, and is still read the same
 *  way, so every check stored before 2026-09-28 still matches its text. */
const CONFIDENCE_LINE = /^([ \t]*How sure we are:)[ \t]*(?:\d{1,3}%\.?|\[Krish to set\])[ \t]*$/gim
/** Where Krish's confidence goes until he sets it. The writers put it in a
 *  first draft (api/_selfCheck.ts, guardConfidence). */
export const UNSET = '[Krish to set]'

/** Each number the shared label reader (labelledConfidences in
 *  packages/contracts/src/call.ts) finds after "How sure we are:" or
 *  "Confidence:" becomes the placeholder. The number alone: the label and
 *  every other character stay as written. */
function unsetLabelled(text: string): string {
  let out = text
  for (const m of labelledConfidences(text).reverse()) {
    const at = text.indexOf(`${m.value}%`, m.index)
    if (at >= 0) out = out.slice(0, at) + UNSET + out.slice(at + m.value.length + 1)
  }
  return out
}

/** The text with Krish's confidence taken out, as the hash reads it. First the
 *  line form above, exactly as before. Then the confidence inside the call,
 *  under either label: piece 1 writes its call as one paragraph that ends
 *  "Confidence: 70%.", which only the first step's label missed, so re-setting
 *  it would have thrown a passed check away (walk log F41). Only the number on
 *  a labelled line inside the call (callSectionOf, the reader CALL and the
 *  Studio use) is taken out. The call's words, its date, anything written
 *  after the number, and a labelled number anywhere else in the piece
 *  ("Consumer confidence: 62% in August") are hashed as written. */
export function withoutConfidence(text: string): string {
  const lined = String(text ?? '').replace(CONFIDENCE_LINE, `$1 ${UNSET}`)
  const section = callSectionOf(lined)
  if (!section) return lined
  const start = lined.indexOf(section)
  if (start < 0) return lined
  return lined.slice(0, start) + unsetLabelled(section) + lined.slice(start + section.length)
}

/** Nothing but a confidence: a label, the placeholder, a full stop at most. */
const ONLY_CONFIDENCE = /^(?:How sure we are|Confidence):[ \t]*\[Krish to set\]\.?$/i

/** Whether a sentence is only Krish's confidence, "How sure we are: 75%." or
 *  "Confidence: 70%.". The extractor sometimes lists it as a claim; checked
 *  against the sources it can only fail, and on 2026-09-26 it blocked piece 2
 *  once while passing on the run before. Piece 1's "Confidence: 70%." was
 *  never recognised, so it would have been a claim on every run (walk log
 *  F41). A sentence with anything else in it is checked like any other. */
export function isConfidenceLine(sentence: string): boolean {
  const s = String(sentence ?? '').trim()
  return ONLY_CONFIDENCE.test(unsetLabelled(s.replace(new RegExp(CONFIDENCE_LINE.source, 'im'), `$1 ${UNSET}`)))
}

/** The hash a check is pinned to. It is taken over the text as save-draft
 *  will store it (sanitizeVoice only swaps dashes for commas), so a checked
 *  draft stays checked through that save, and any change to a word or a
 *  number breaks the match, except the number of the confidence Krish sets. */
export function bodyHash(body: string): string {
  const text = withoutConfidence(sanitizeVoice(String(body ?? ''))).trim()
  return createHash('sha256').update(text).digest('hex')
}

/** Lowercase, straight quotes and apostrophes, no markdown emphasis or link
 *  syntax ("[2025 filing](https://...)" reads "2025 filing"), one space. */
export function norm(s: string): string {
  return stripMarkdownLinks(String(s || ''))
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

/** The heading a sentence sits under, so a line read on its own ("First sign:
 *  the model picker disappears") is read as part of THE FORKS, a scenario. */
export function sectionOf(body: string, sentence: string): string {
  const at = String(body || '').indexOf(String(sentence || '').slice(0, 60))
  if (at < 0) return ''
  const before = body.slice(0, at).split('\n').filter(l => /^\s*#{1,6}\s/.test(l))
  return before.length ? before[before.length - 1].replace(/^\s*#{1,6}\s*/, '').trim() : ''
}

/** Reads like something that has not happened yet, or like a labelled guess.
 *  House rule R1 tells every writer "A guess is marked as a guess", so "our
 *  guess" is a label here too: on 2026-09-30 piece 1's "Here's our guess, in
 *  full: Amazon's real worry is the $68.6 billion." was set aside by the
 *  lister and then checked as a fact because this list did not know the word.
 *  The lister still has to set the sentence aside itself, and a number in it is
 *  still checked wherever the piece states it as fact. */
export function readsAsForecast(sentence: string): boolean {
  return /\b(will|would|could|might|may|if|bet|call|forecast|predict|scenario|inference|guess|guesses|guessing|we think|our read|going to|\w+['’]ll|by (?:\d{1,2} )?(?:january|february|march|april|may|june|july|august|september|october|november|december)?\s*\d{4})\b/i.test(sentence)
}

/** The numbers in a text, by value: "$900 million" -> "900", "$150.00" ->
 *  "150", "08" -> "8", "10,000" -> "10000". A price table and a sentence
 *  write the same number differently. */
export function numbersIn(s: string): string[] {
  return (String(s || '').match(/\d[\d,]*(?:\.\d+)?/g) || [])
    .map(n => n.replace(/,/g, ''))
    .filter(n => n.length > 0)
    .map(n => { const v = Number(n); return Number.isFinite(v) ? String(v) : n })
}

/** Where one source ends and the next begins in the text the checkers read. */
export const SOURCE_MARK = '### SOURCE: '

/** The most of the sources the checkers read. */
export const SOURCES_BUDGET = 120_000

/** Everything the piece was written from, as plain text the quotes must come
 *  from. Each source starts with SOURCE_MARK. A verbatim excerpt is headed by
 *  its URL alone: its title is the filer's words, and a date in it must not
 *  pass for the source's.
 *
 *  A research dive (dive-deeper, research-topic) is stored as
 *  `{ query, findings, citations, at }` in meta.deep_dives, and dive-deeper
 *  also files its findings as a `research` material. This read `question`
 *  and `sources`, which no writer stores, so a dive's question and its URLs
 *  never reached the checkers, and its findings came in twice, spending the
 *  budget twice (walk log F33). Each summary is now read once, under the
 *  names it is stored with; the older names are still read if a row has
 *  them. */
export function sourcesText(meta: Record<string, any>): string {
  const parts: string[] = []
  const materials = readMaterials(meta)
  for (const m of materials) {
    const body = m.kind === 'link' ? (m.url || '') : (m.content || '')
    if (body.trim()) parts.push(`${SOURCE_MARK}${m.verbatim && m.url ? `verbatim excerpt from ${m.url}` : (m.title || m.kind)}\n${body}`)
  }
  const stories = Array.isArray(meta.adjacent_stories) ? meta.adjacent_stories : []
  for (const s of stories) parts.push(`${SOURCE_MARK}${s?.title || 'source'} (${s?.published_date_iso || 'undated'}) ${s?.url || ''}\n${s?.why_relevant || ''}\n${s?.summary || ''}`)
  const research = meta.research
  if (Array.isArray(research)) for (const r of research) parts.push(`${SOURCE_MARK}research\n${typeof r === 'string' ? r : `${r?.title || ''} ${r?.url || ''}\n${r?.summary || r?.text || ''}`}`)
  else if (typeof research === 'string') parts.push(`${SOURCE_MARK}research\n${research}`)
  const dives = Array.isArray(meta.deep_dives) ? meta.deep_dives : []
  for (const d of dives) {
    if (typeof d === 'string') { parts.push(`${SOURCE_MARK}deep dive\n${d}`); continue }
    const findings = String(d?.findings || d?.answer || '')
    if (diveOnFile(d, findings, materials)) continue
    const question = String(d?.query || d?.question || '')
    const links = Array.isArray(d?.citations) ? d.citations : Array.isArray(d?.sources) ? d.sources : []
    parts.push(`${SOURCE_MARK}deep dive${question ? `: ${question}` : ''}\n${findings}${links.length ? `\n\nSources:\n${links.join('\n')}` : ''}`)
  }
  return parts.filter(p => p && p.trim()).join('\n\n').slice(0, SOURCES_BUDGET)
}

/** Whether a dive's findings are already on the piece as the material
 *  dive-deeper filed for it: the same time, or the same opening words. */
function diveOnFile(d: Record<string, any>, findings: string, materials: ReturnType<typeof readMaterials>): boolean {
  const head = findings.trim().slice(0, 200)
  return materials.some(m => m.kind === 'research' && (
    (typeof d?.at === 'string' && d.at === m.at) || (head.length >= 40 && String(m.content || '').trim().startsWith(head))
  ))
}

/** Only the verbatim excerpts: the sources' own words, not anyone's summary. */
export function primaryText(meta: Record<string, any>): string {
  return readMaterials(meta).filter(m => m.verbatim === true && m.content)
    .map(m => `${SOURCE_MARK}verbatim excerpt from ${m.url}\n${m.content}`).join('\n\n')
}

/** The dated context above a passage in its own source: the headings and
 *  "Published" lines above it, nearest first, up to and including the first
 *  one that carries a year, and never past the source's start. A release note
 *  puts the date in the heading and the fact under it. */
export function datedContext(text: string, quote: string): string[] {
  const lines = String(text || '').split('\n')
  const probe = norm(quote).slice(0, 50)
  if (probe.length < 12) return []
  const at = lines.findIndex(l => norm(l).includes(probe))
  if (at < 0) return []
  const out: string[] = []
  for (let i = at - 1; i >= 0; i--) {
    const l = lines[i]
    if (l.startsWith(SOURCE_MARK)) break
    if (!/^\s*#{1,6}\s/.test(l) && !/^\s*(published|updated)\b/i.test(l)) continue
    out.push(l.trim())
    if (/\b(19|20)\d{2}\b/.test(l)) break
  }
  return out
}

/** Why a set of passages fails, or null when every one is really in the
 *  sources and together they carry every number in the claim. Up to three
 *  passages, because a fact is often split: the date in a heading, the fact
 *  below it. */
/** The words alone: no spacing and no quotation marks (norm has already
 *  made curly quotes straight). A checker that drops the marks around a
 *  quoted term ('a real-time router that', piece 2 run 16) quotes the same
 *  words in the same order. */
const unspaced = (s: string): string => s.replace(/[\s"'`]+/g, '')

export function quotesFail(quotes: Array<string | null> | null, sourcesText: string, claim: string): string | null {
  // A passage too short to trust is dropped, never counted: one run failed a
  // correct claim because the checker added the heading "## GPT-5" as a
  // passage. Dropping one can only remove support, never add it.
  const list = (quotes || []).filter((q): q is string => typeof q === 'string' && norm(q).length >= 12).slice(0, 3)
  if (list.length === 0) return 'no passage long enough to trust'
  // Spacing is not wording. Checkers join paragraphs ("as 4o did.Altman
  // said", piece 2 run 15) and respace table rows ("| Output | $50.00 |",
  // run 14); the same words in the same order still hold.
  const src = unspaced(norm(sourcesText))
  for (const q of list) {
    if (!inOrder(unspaced(norm(q)), src)) return `passage not found word for word in the sources: "${q.slice(0, 80)}"`
  }
  // Numbers are read from the words a reader sees. A link's address is not
  // the passage: "[the filing](https://sec.gov/.../2025/68635.htm)" carries
  // neither 2025 nor 68635.
  const carried = new Set(list.flatMap(q => numbersIn(stripMarkdownLinks(q))))
  let missing = numbersIn(claim).filter(n => !carried.has(n))
  if (missing.length) {
    for (const line of datedContext(sourcesText, list[0])) numbersIn(stripMarkdownLinks(line)).forEach(n => carried.add(n))
    missing = missing.filter(n => !carried.has(n))
  }
  return missing.length ? `the passages do not carry ${missing.join(', ')}` : null
}

/** A passage the checker shortened with an ellipsis holds only when every
 *  piece is in the sources, in order. The checkers do this ("We are working
 *  to ... enable ChatGPT"), and a whole quote with "..." is never verbatim. */
export function inOrder(passage: string, text: string): boolean {
  const pieces = passage.split(/\s*(?:\.\.\.|…)\s*/).map(p => p.trim()).filter(Boolean)
  if (!pieces.length) return false
  if (pieces.length > 1 && pieces.some(p => p.length < 8)) return false
  let from = 0
  for (const p of pieces) {
    const at = text.indexOf(p, from)
    if (at < 0) return false
    from = at + p.length
  }
  return true
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

/** Every sentence is covered by a claim or an honoured set-aside; anything
 *  left over becomes a claim of its own, for the second look to read. Not only
 *  sentences with a number or a quotation: piece 2 said Anthropic sold "a
 *  small one, a middle one and a big one" in 2024, a fact with neither, and
 *  the lister missed it. */
export function sweep(body: string, claims: Claim[], setAside: Array<{ sentence: string; reason: string }>): {
  claims: Claim[]; setAside: Array<{ sentence: string; reason: string }>
} {
  const covered = (s: string, list: Array<{ sentence: string }>) => {
    const n = norm(s)
    return list.some(c => { const m = norm(c.sentence); return m.length >= 12 && (n.includes(m) || m.includes(n)) })
  }
  const honoured = setAside.filter(a => readsAsForecast(a.sentence) && !isConfidenceLine(a.sentence))
  const extra: Claim[] = []
  for (const s of sentences(body)) {
    // Krish's confidence is never a leftover to check, listed or not.
    if (isConfidenceLine(s)) continue
    if (covered(s, claims) || covered(s, honoured)) continue
    extra.push({ sentence: s, claim: s, kind: 'unclassified' })
  }
  return { claims: [...claims, ...extra], setAside: honoured }
}

/** What the second look reads: the sweep's unclassified sentences and the
 *  lister's set-asides, read again so waving a sentence through takes two
 *  readings that agree. Never Krish's confidence line: the second look turns
 *  any sentence with a number into a claim (piece 2, runs 15 to 17). */
export function leftoversOf(swept: { claims: Claim[]; setAside: Array<{ sentence: string; reason: string }> }): Claim[] {
  return [
    ...swept.claims.filter(c => c.kind === 'unclassified'),
    ...swept.setAside.map(a => ({ sentence: a.sentence, claim: a.sentence, kind: 'unclassified' as ClaimKind })),
  ].filter(l => !isConfidenceLine(l.sentence))
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

// ── A checked sentence keeps its result until it changes (walk log F52) ────
//
// Krish, 2026-10-02, on the work board, asked "Let a checked sentence keep its
// verdict until it changes?": "Yes, or cut the opinion lines". Piece 3 ran six
// checks (16, 7, 3, 4, 2 and 3 failing): the lister read a different handful of
// its commentary sentences as claims on each run, so rewording alone never
// settled it. Now a sentence that passed on an earlier run (every claim in it
// verified) or was set aside, and whose words and the piece's filed sources are
// unchanged since, keeps that result: a run checks only what changed or failed.
// The trade-off he accepted: a sentence wrongly passed once stays passed until
// its words change. A failed sentence is never carried, and any change to the
// sources or to the gate's version starts the ledger again, so new evidence is
// always checked in full.

export interface LedgerEntry {
  status: 'passed' | 'set_aside'
  /** The run that settled it. */
  at: string
  /** For a passed sentence, the claims that passed, as checked then. */
  claims?: CheckedClaim[]
  /** For a set-aside sentence, why. */
  reason?: string
}

export interface FactLedger {
  version: typeof FACT_GATE_VERSION
  /** sourcesHash() of the sources the entries were checked against. */
  sources_hash: string
  /** By sentenceKey(). */
  sentences: Record<string, LedgerEntry>
}

/** A sentence's identity: its words as norm() reads them. */
export function sentenceKey(sentence: string): string {
  return createHash('sha256').update(norm(sentence)).digest('hex').slice(0, 32)
}

/** The sources a verdict rests on. Any material added, removed or changed
 *  gives a new hash, and the ledger starts again. */
export function sourcesHash(meta: Record<string, any>): string {
  return createHash('sha256').update(sourcesText(meta || {})).digest('hex')
}

/** The body sentences a claim's or a set-aside's sentence covers. A lister's
 *  "sentence" can be part of one body sentence or run across two. */
function overlapping(sentence: string, bodySentences: string[]): string[] {
  const n = norm(sentence)
  if (!n) return []
  return bodySentences.filter(s => {
    const m = norm(s)
    // A short label such as "Guess one." is safe to settle when it is an
    // exact match. Only fuzzy containment needs the length floor that stops
    // tiny fragments from attaching themselves to unrelated sentences.
    if (m === n) return true
    return m.length >= 12 && (n.includes(m) || m.includes(n))
  })
}

function usable(ledger: FactLedger | null | undefined, hash: string): ledger is FactLedger {
  return !!ledger && ledger.version === FACT_GATE_VERSION && ledger.sources_hash === hash && !!ledger.sentences
}

export interface FactLedgerCoverage {
  ledger_usable: boolean
  total_sentences: number
  reusable_sentences: number
  fresh_sentences: number
}

/** A no-model preflight for a paid rerun. It says how much of the exact body
 * already has a settled result against the exact current sources. Operators
 * can put a hard ceiling on fresh work before the first provider call. */
export function factLedgerCoverage(
  body: string,
  ledger: FactLedger | null | undefined,
  hash: string,
): FactLedgerCoverage {
  const bodySentences = sentences(body).filter(s => !isConfidenceLine(s))
  const ledgerUsable = usable(ledger, hash)
  const reusable = ledgerUsable
    ? bodySentences.filter(s => !!ledger.sentences[sentenceKey(s)]).length
    : 0
  return {
    ledger_usable: ledgerUsable,
    total_sentences: bodySentences.length,
    reusable_sentences: reusable,
    fresh_sentences: bodySentences.length - reusable,
  }
}

/**
 * This run's claims, split into those to check and those whose every sentence
 * is settled in the ledger. A settled sentence's result is carried once, with
 * the time it was earned: a passed sentence's claims as they were checked, a
 * set-aside sentence back among the set-asides with its reason.
 */
export function carryForward(
  body: string,
  claims: Claim[],
  setAside: Array<{ sentence: string; reason: string }>,
  ledger: FactLedger | null | undefined,
  hash: string,
): { toCheck: Claim[]; carried: CheckedClaim[]; setAside: Array<{ sentence: string; reason: string }>; sentences: number } {
  if (!usable(ledger, hash)) return { toCheck: claims, carried: [], setAside, sentences: 0 }
  const bodySentences = sentences(body)
  const toCheck: Claim[] = []
  const carried: CheckedClaim[] = []
  const aside = [...setAside]
  const done = new Set<string>()
  for (const c of claims) {
    const over = overlapping(c.sentence, bodySentences)
    const entries = over.map(s => ({ s, key: sentenceKey(s), entry: ledger.sentences[sentenceKey(s)] }))
    if (!entries.length || entries.some(e => !e.entry)) { toCheck.push(c); continue }
    for (const { s, key, entry } of entries) {
      if (done.has(key)) continue
      done.add(key)
      if (entry.status === 'passed') {
        for (const x of entry.claims || []) {
          if (!carried.some(y => y.claim === x.claim && y.sentence === x.sentence)) carried.push({ ...x, carried_from: x.carried_from || entry.at })
        }
      } else if (!aside.some(a => norm(a.sentence) === norm(s))) {
        aside.push({ sentence: s, reason: `kept from ${entry.at}: ${entry.reason || 'set aside'}` })
      }
    }
  }
  return { toCheck, carried, setAside: aside, sentences: done.size }
}

/** The ledger after a run: what it already held for sentences still in the
 *  body, and every sentence this run passed or set aside. A sentence with a
 *  failing claim is not added. */
export function settle(body: string, result: FactCheck, prior: FactLedger | null | undefined, hash: string): FactLedger {
  const bodySentences = sentences(body)
  const keys = new Set(bodySentences.map(sentenceKey))
  const out: Record<string, LedgerEntry> = {}
  if (usable(prior, hash)) for (const [k, v] of Object.entries(prior.sentences)) if (keys.has(k)) out[k] = v
  for (const s of bodySentences) {
    const key = sentenceKey(s)
    if (out[key] || isConfidenceLine(s)) continue
    const mine = result.claims.filter(c => overlapping(c.sentence, [s]).length > 0)
    if (mine.length) {
      if (mine.every(c => PASSING.has(c.verdict))) out[key] = { status: 'passed', at: result.ran_at, claims: mine }
      continue
    }
    const aside = result.set_aside.find(a => overlapping(a.sentence, [s]).length > 0)
    if (aside) out[key] = { status: 'set_aside', at: result.ran_at, reason: aside.reason }
  }
  return { version: FACT_GATE_VERSION, sources_hash: hash, sentences: out }
}

// ── The prompts ─────────────────────────────────────────────────────────────

export const EXTRACT_SYSTEM = [
  'You list the factual claims in a piece of writing so that each can be checked. You do not judge them.',
  'A claim is anything a reader could check as true or false: a number, price, percentage, date, a name with a role, a quotation, who said what, what a company did or released or wrote, what a document says, what happened when.',
  'Split compound sentences: one claim per checkable fact. Keep "sentence" as the EXACT sentence from the text, copied character for character, so it can be found again.',
  'Not claims: opinions, jokes, analogies, labelled inference or guesses, predictions, scenarios, and the piece\'s own prediction or bet. List any such sentence that contains a number or a quotation under "set_aside" with its reason (prediction, scenario, labelled_inference, opinion, analogy), so nothing with a number goes unaccounted for.',
  'Return JSON only: {"claims":[{"sentence":"...","claim":"the single fact, stated plainly","kind":"number|date|quote|attribution|event|name|other"}],"set_aside":[{"sentence":"...","reason":"..."}]}',
].join('\n')

export const ON_FILE_SYSTEM = [
  'You check ONE claim against the sources below, which are the only evidence you may use. You never use your own knowledge.',
  'supported: the sources state it. Return the passage or passages that state it, each copied EXACTLY, character for character. Give up to three passages only when the fact is split across them (for example the date in a heading and the fact under it); together they must contain every number in the claim.',
  'contradicted: the sources say something different (a different number, date, name, speaker or meaning). Return the exact passage that contradicts it, and say what it says.',
  'not_found: the sources do not state it. A claim that is only implied, rounded, rescaled, or said by a different person is not_found or contradicted, never supported. Words put in someone\'s mouth must be their words.',
  'Copy passages whole: never shorten one with "...". Read a table by its column headings; a price table can list several lanes and context lengths side by side.',
  // Piece 3 (2026-09-30 to 2026-10-02, walk log F50): a PDF's Table 1, filed
  // as text, lost its grid. The reader twice read the wrong column for a true
  // score and called it not found or contradicted.
  'A table copied from a PDF loses its grid: a header line names the columns left to right, and each row gives its name and then its values in that same order. Count along the row to the column the claim names, and quote the whole row together with the header line.',
  'Return JSON only: {"verdict":"supported|contradicted|not_found","quotes":["exact passage", "..."],"note":"one line"}',
].join('\n')

export const SECOND_LOOK_SYSTEM = [
  'These sentences come from a piece of writing, and nobody has listed a factual claim in them yet. Each comes with the heading of the section it sits in: a sentence in a section about possible futures, scenarios or a forecast describes a possible future unless it states something that has already happened.',
  'For each sentence, list every factual claim a reader could check as true or false: a number, a date, a quotation or who said something, what a company or person did, a definition presented as fact. One claim per fact, stated plainly.',
  'A scare quote, an analogy, a joke, a made-up example line, an opinion, a hypothetical or a description of a possible future is not a claim; for such a sentence return no claims and give the reason in a few words.',
  'The piece\'s own prediction or bet (what the writers say will happen, often with a future date) is never a claim: it cannot be checked until its date. What a company or person SAID they will do is a claim about what they said.',
  'Return JSON only: {"answers":[{"i":0,"claims":[{"claim":"...","kind":"number|date|quote|attribution|event|name|other"}],"reason":"..."}]}',
].join('\n')

export const ENTAIL_SYSTEM = [
  'A fact checker quoted a source about a claim. Judge only from the quoted evidence, never from your own knowledge.',
  'states: the evidence, read on its own, states every part of the claim (each number, date, name and who said it), in the same meaning.',
  'conflicts: the evidence states something that cannot be true at the same time as the claim (a different number, date, speaker or meaning). A source that says less, or says nothing about part of the claim, does not conflict. A plan stated earlier ("we will soon begin") does not conflict with a later report that it happened, and a fact about one date does not conflict with a claim about another. When the claim is about what someone said or did on a stated date and the evidence carries no date, do not assume the evidence is from that date: a difference of stage (planned, begun, done) is neither.',
  // Piece 1, run 3 (2026-09-30): "Its own annual report puts the figure at
  // $68,635 million" (2025) was contradicted by "over $70 billion in TTM
  // revenue" (the twelve months to March 2026). Walk log F48.
  'Figures for different periods (a year, a quarter, a trailing twelve months) or different scopes do not conflict. When the claim names no period, do not assume it is the evidence\'s period: that is neither.',
  'neither: anything else.',
  'Return JSON only: {"answer":"states|conflicts|neither","why":"one line"}',
].join('\n')

export const INDEPENDENT_SYSTEM = [
  'You are a fact checker. Check ONE claim against reliable published sources. Be strict: supported only if a reliable source states it as written, including the numbers, dates and who said it.',
  'If a source states something different, the verdict is contradicted and correct_value says what the source says. If you cannot find it stated, the verdict is unclear.',
  'A figure for a different period (another year, a quarter, a trailing twelve months) or a different scope is not a contradiction: find the same period, or the verdict is unclear.',
  'Return JSON only: {"verdict":"supported|contradicted|unclear","evidence":"a short exact quote from the source","url":"the source URL","correct_value":"only when contradicted"}',
].join('\n')
