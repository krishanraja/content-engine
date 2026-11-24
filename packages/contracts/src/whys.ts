// The why-ladder: the signature format of every makeyourmindup piece (Ruling, Krish, 2026-11-24: the signature format
// is the 5 Whys; get rid of everything that suggests predictions, calls, dated, odds or scores). A piece climbs a
// ladder of Whys the viewer follows step by step. Each Why gets one sourced answer, its strongest counter-evidence and
// how strong the answer is; the ladder stops honestly where the evidence runs out, and it lands on what this shows plus
// an open question handed to the viewer, never a verdict, a forecast, odds or a lesson for leaders.
//
// This file is the one reader of a ladder. Research comes back from Perplexity (apps/control-plane/api/board/
// _researchPrompt.ts asks for it) as a fenced why-ladder block beside the Markdown; parseWhyLadder finds and reads the
// block, checkWhyLadder says where each rung falls short ("Why 3 needs a second source"). A failing rung is kept and
// shown as a problem, never dropped.
//
// Pure and dependency free: the control plane imports this file by its relative path (as it does call.ts), so it must
// stay clear of zod and the rest of the contracts.

export const WHY_LADDER_SCHEMA = 'why-ladder/1'

export type WhyStrength = 'documented' | 'inferred' | 'open'
export type WhyStop = 'evidence_exhausted' | 'motive_not_mechanism' | 'restatement' | 'abstraction_drift' | 'out_of_scope' | 'cap'

export interface WhyEvidence { url: string; domain: string; date: string; quote: string; tier?: string }
export interface WhyBranch { join: 'AND' | 'OR'; answers: { answer: string; evidence: WhyEvidence[] }[]; followed: number }
export interface WhyRung {
  n: number
  question: string
  answer: string
  evidence: WhyEvidence[]
  strength: WhyStrength
  counter: { text?: string; none_found_scope?: string }
  branch?: WhyBranch
  mechanism_type?: string
  stop: WhyStop | null
}
export interface WhyLanding { shows: string; open_question: string }
export interface WhyLadder {
  schema: 'why-ladder/1'
  question: string
  series?: 'follow_the_money' | 'under_the_hood' | 'mind_the_gap' | string
  rungs: WhyRung[]
  landing: WhyLanding
}

export const WHY_STRENGTHS: readonly WhyStrength[] = ['documented', 'inferred', 'open']
export const WHY_STOPS: readonly WhyStop[] = ['evidence_exhausted', 'motive_not_mechanism', 'restatement', 'abstraction_drift', 'out_of_scope', 'cap']
/** Five is the target, not a rule: a ladder climbs 3 to 7 Whys, fewer than 3 only when it says why it stopped. */
export const WHY_LADDER_TARGET = 5
export const WHY_LADDER_MIN = 3
export const WHY_LADDER_MAX = 7
export const WHY_ANSWER_MAX_WORDS = 60
/** What parseWhyLadder says when the text holds no ladder at all (research pasted without one is still filed). */
export const NO_WHY_LADDER = 'No why-ladder block found: the research has no fenced why-ladder JSON block.'

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const wordsIn = (s: string) => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length

/** The host a link points at, without www, or '' when it is not a link. */
export function domainOf(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** The site a domain belongs to, so ir.oracle.com and oracle.com count as one domain and bbc.co.uk stays whole. */
export function siteOf(domain: string): string {
  const labels = domain.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean)
  if (labels.length <= 2) return labels.join('.')
  const sld = labels[labels.length - 2] ?? '', tld = labels[labels.length - 1] ?? ''
  const keep = tld.length === 2 && ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'].includes(sld) ? 3 : 2
  return labels.slice(-keep).join('.')
}

// The fenced blocks in a text: ```why-ladder or ```json (any case), with the info string's first word as the language.
const FENCE = /(^|\n)[ \t]*```[ \t]*([A-Za-z][\w-]*)?[^\n]*\n([\s\S]*?)\n[ \t]*```/g

function parseJson(body: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(body) }
  } catch (e) {
    // A trailing comma is the one slip a model makes often; nothing else is repaired.
    try {
      return { ok: true, value: JSON.parse(body.replace(/,(\s*[}\]])/g, '$1')) }
    } catch {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
}

function evidenceOf(raw: unknown, where: string, problems: string[]): WhyEvidence[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    problems.push(`${where}: "evidence" is not a list`)
    return []
  }
  const out: WhyEvidence[] = []
  raw.forEach((e, k) => {
    if (!isObj(e)) {
      problems.push(`${where}: source ${k + 1} is not an object with url, domain, date and quote`)
      return
    }
    const url = str(e.url)
    const tier = str(e.tier)
    out.push({ url, domain: str(e.domain).toLowerCase().replace(/^www\./, '') || domainOf(url), date: str(e.date), quote: str(e.quote), ...(tier ? { tier } : {}) })
  })
  return out
}

function counterOf(raw: unknown): WhyRung['counter'] {
  if (typeof raw === 'string') return raw.trim() ? { text: raw.trim() } : {}
  if (!isObj(raw)) return {}
  const text = str(raw.text)
  // "none found" may come as none_found_scope, or as none_found with its scope beside it.
  const scope = str(raw.none_found_scope) || (raw.none_found === true || typeof raw.none_found === 'string' ? str(raw.scope) || str(raw.none_found) : '')
  return { ...(text ? { text } : {}), ...(scope ? { none_found_scope: scope } : {}) }
}

function branchOf(raw: unknown, where: string, problems: string[]): WhyBranch | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!isObj(raw)) {
    problems.push(`${where}: "branch" is not an object`)
    return undefined
  }
  const join = str(raw.join).toUpperCase()
  if (join !== 'AND' && join !== 'OR') problems.push(`${where}: the branch's join is "${str(raw.join)}", not AND or OR`)
  const answers = (Array.isArray(raw.answers) ? raw.answers : []).filter(isObj)
    .map((a, k) => ({ answer: str(a.answer), evidence: evidenceOf(a.evidence, `${where}, branch answer ${k + 1}`, problems) }))
  const followed = typeof raw.followed === 'number' && Number.isInteger(raw.followed) ? raw.followed : 0
  return { join: join === 'AND' ? 'AND' : 'OR', answers, followed }
}

function rungOf(raw: Raw, k: number, problems: string[]): WhyRung {
  const where = `Why ${k + 1}`
  let n = k + 1
  if (typeof raw.n === 'number' && Number.isInteger(raw.n) && raw.n > 0) n = raw.n
  else problems.push(`${where}: "n" is missing or not a whole number, read as ${k + 1}`)
  const evidence = evidenceOf(raw.evidence, where, problems)
  let strength: WhyStrength
  if ((WHY_STRENGTHS as readonly string[]).includes(str(raw.strength))) strength = str(raw.strength) as WhyStrength
  else {
    strength = evidence.length ? 'inferred' : 'open'
    problems.push(`${where}: "strength" is "${str(raw.strength)}", not documented, inferred or open; read as ${strength}`)
  }
  let stop: WhyStop | null = null
  if (raw.stop !== undefined && raw.stop !== null && raw.stop !== '') {
    if ((WHY_STOPS as readonly string[]).includes(str(raw.stop))) stop = str(raw.stop) as WhyStop
    else problems.push(`${where}: "stop" is "${str(raw.stop)}", not one of ${WHY_STOPS.join(', ')}`)
  }
  const branch = branchOf(raw.branch, where, problems)
  const mechanism = str(raw.mechanism_type)
  return {
    n, question: str(raw.question), answer: str(raw.answer), evidence, strength, counter: counterOf(raw.counter),
    ...(branch ? { branch } : {}), ...(mechanism ? { mechanism_type: mechanism } : {}), stop,
  }
}

/** A ladder from its parsed JSON, kept whole: what is missing or malformed is read as plainly as it can be and named in
 *  problems, so a failing rung is shown, never dropped. */
function ladderOf(raw: Raw, problems: string[]): WhyLadder {
  const rungs: WhyRung[] = []
  if (!Array.isArray(raw.rungs)) problems.push('The ladder has no "rungs" list')
  else raw.rungs.forEach((r, k) => {
    if (isObj(r)) rungs.push(rungOf(r, k, problems))
    else problems.push(`Why ${k + 1} is not an object, so it was left out`)
  })
  const landing = isObj(raw.landing) ? raw.landing : {}
  if (!isObj(raw.landing)) problems.push('The ladder has no "landing" (what this shows, and the open question)')
  const series = str(raw.series)
  return {
    schema: WHY_LADDER_SCHEMA, question: str(raw.question), ...(series ? { series } : {}), rungs,
    landing: { shows: str(landing.shows), open_question: str(landing.open_question) },
  }
}

/** Finds a fenced ```why-ladder or ```json block whose schema is why-ladder/1 and reads it. No block at all gives
 *  { ladder: null, problems: [NO_WHY_LADDER] }; a block that is not valid JSON gives ladder null with the reason. */
export function parseWhyLadder(text: string): { ladder: WhyLadder | null; problems: string[] } {
  const found: Array<{ value: Raw } | { error: string }> = []
  for (const m of String(text || '').matchAll(FENCE)) {
    const lang = (m[2] || '').toLowerCase()
    const body = m[3] || ''
    if (lang !== 'why-ladder' && lang !== 'json') continue
    const parsed = parseJson(body)
    if (parsed.ok === false) {
      if (lang === 'why-ladder' || body.includes(WHY_LADDER_SCHEMA)) found.push({ error: `The why-ladder block is not valid JSON (${parsed.error})` })
      continue
    }
    const value = parsed.value
    if (!isObj(value)) {
      if (lang === 'why-ladder') found.push({ error: 'The why-ladder block is not a JSON object' })
      continue
    }
    const schema = value.schema
    if (schema === WHY_LADDER_SCHEMA || (lang === 'why-ladder' && (schema === undefined || schema === null))) found.push({ value })
    else if (lang === 'why-ladder') found.push({ error: `The why-ladder block names schema "${str(schema)}", not ${WHY_LADDER_SCHEMA}` })
  }
  const first = found[0]
  if (!first) return { ladder: null, problems: [NO_WHY_LADDER] }
  const problems: string[] = []
  if (found.length > 1) problems.push(`The research holds ${found.length} why-ladder blocks: the first is read`)
  if ('error' in first) return { ladder: null, problems: [first.error, ...problems] }
  const ladder = ladderOf(first.value, problems)
  return { ladder, problems }
}

/** The earlier Why a rung's answer loops back to ("back to Why 2"), or null. A loop is allowed, and can be the insight. */
export function loopTarget(rung: Pick<WhyRung, 'answer'>): number | null {
  const m = /\b(?:back to|returns? to|loops? back to|feeds? back into|feeds? into)\s+why\s+(\d+)\b/i.exec(rung.answer || '')
  return m ? Number(m[1]) : null
}

// The landing never reads as a verdict, a forecast, odds, a confidence number or a lesson for leaders (the
// makeyourmindup kill list blocks those under preach_pattern, which is unappealable).
export const WHY_LANDING_VETO: ReadonlyArray<{ kind: string; pattern: RegExp }> = [
  { kind: 'a forecast', pattern: /\b(?:predict(?:s|ed|ion|ions)?|forecast(?:s|ed|ing)?|(?:is|are) (?:going|set|poised|likely|expected|bound) to|will (?:soon|likely|probably|eventually|inevitably|definitely|certainly|replace|kill|win|lose|collapse|dominate|disappear|overtake|become)|by (?:the end of )?(?:19|20)\d\d\b|in the (?:next|coming) (?:few )?(?:\d+ )?(?:days|weeks|months|years|decades?))/i },
  { kind: 'odds', pattern: /\b(?:odds|long shot|sure thing|chances? (?:are|of|that)|probabilit(?:y|ies)|likelihood)\b|\d{1,3}(?:\.\d+)?\s?(?:%|per ?cent)\s*(?:chance|likely|probability)/i },
  { kind: 'a confidence number', pattern: /\b(?:how sure|confidence|confident|certainty|we(?:'re| are) (?:sure|certain))\b|\d{1,3}(?:\.\d+)?\s?(?:%|per ?cent)\s*(?:sure|confident|certain)/i },
  { kind: 'a verdict or a lesson', pattern: /\b(?:lessons? for (?:leaders|executives|ceos|founders|boards|managers|business(?:es)?)|the real question for leaders|(?:leaders|executives|ceos|founders|businesses|companies|you) (?:should|must|need to|have to|ought to)|(?:the|our) verdict|our call|the call is|the takeaway|the bottom line)\b/i },
]

/** The words in a landing that read as a verdict, forecast, odds, confidence or a lesson: [{ kind, said }]. */
export function landingVetoes(landing: WhyLanding): Array<{ kind: string; said: string }> {
  const text = `${landing.shows || ''}\n${landing.open_question || ''}`
  const out: Array<{ kind: string; said: string }> = []
  for (const v of WHY_LANDING_VETO) {
    const m = v.pattern.exec(text)
    if (m) out.push({ kind: v.kind, said: m[0].trim() })
  }
  return out
}

function sourceProblems(evidence: WhyEvidence[], where: string): string[] {
  const out: string[] = []
  evidence.forEach((e, k) => {
    const name = `${where} source ${k + 1}${e.domain ? ` (${e.domain})` : ''}`
    if (!domainOf(e.url)) out.push(`${name} has no working link`)
    if (!e.date) out.push(`${name} has no date`)
    if (!e.quote) out.push(`${name} has no verbatim quote`)
  })
  return out
}

/** Why an answer is not yet backed: fewer than two sources, or two on one domain. [] when it is. */
function backingProblems(n: number, evidence: WhyEvidence[], what: string): string[] {
  const linked = evidence.filter(e => domainOf(e.url) || e.domain)
  if (linked.length === 0) return [`Why ${n} needs two sources${what}`]
  if (linked.length === 1) return [`Why ${n} needs a second source${what}`]
  const sites = new Set(linked.map(e => siteOf(e.domain || domainOf(e.url))))
  if (sites.size < 2) return [`Why ${n} needs a second source on a different domain${what}`]
  return []
}

/** Where a ladder falls short, rung by rung (rung null for the ladder as a whole). [] when it stands: 3 to 7 Whys (fewer
 *  than 3 only when the last says why it stopped), every Why that is not open backed by at least two sources on two
 *  domains with its strongest counter-evidence or "none found" and the scope searched, an answer of 60 words or fewer,
 *  never climbing past an open Why or a stop, and a landing with no forecast, odds, confidence or preaching. */
export function checkWhyLadder(l: WhyLadder): { rung: number | null; problem: string }[] {
  const out: { rung: number | null; problem: string }[] = []
  const add = (rung: number | null, problem: string) => out.push({ rung, problem })
  const rungs = Array.isArray(l?.rungs) ? l.rungs : []
  const count = rungs.length
  if (!str(l?.question)) add(null, 'The ladder has no title question')
  if (count === 0) add(null, 'The ladder has no Whys')
  else {
    if (count > WHY_LADDER_MAX) add(null, `The ladder climbs ${count} Whys: merge sub-steps so it climbs ${WHY_LADDER_MAX} at most (five is the target)`)
    const last = rungs[count - 1]
    if (last && count < WHY_LADDER_MIN && !last.stop) add(last.n, `The ladder stops at Why ${last.n} without saying why: fewer than ${WHY_LADDER_MIN} Whys needs a stop on the last one (evidence_exhausted, out_of_scope and so on), never padding`)
    const numbers = rungs.map(r => r.n)
    if (numbers.some((x, k) => x !== k + 1)) add(null, `The Whys are numbered ${numbers.join(', ')}: number them 1 to ${count} in order`)
  }
  rungs.forEach((r, k) => {
    const n = r.n
    const isLast = k === count - 1
    if (!str(r.question)) add(n, `Why ${n} has no question`)
    const words = wordsIn(r.answer || '')
    if (!words && r.strength !== 'open') add(n, `Why ${n} has no answer`)
    if (words > WHY_ANSWER_MAX_WORDS) add(n, `Why ${n}'s answer is ${words} words: ${WHY_ANSWER_MAX_WORDS} at most`)
    for (const p of sourceProblems(r.evidence || [], `Why ${n}`)) add(n, p)
    const followed = r.branch && r.branch.answers[r.branch.followed]
    if (r.strength !== 'open') {
      // A split Why is backed by the branch it follows; one that does not split, by its own sources.
      for (const p of backingProblems(n, [...(r.evidence || []), ...(followed ? followed.evidence : [])], '')) add(n, p)
      const c = r.counter || {}
      if (!str(c.text) && !str(c.none_found_scope)) add(n, `Why ${n} needs its strongest counter-evidence, or "none found" with the scope searched`)
    } else if (!isLast && !r.branch) {
      add(n, `Why ${n} is an open question, so the ladder stops there: never climb past it (stop on it, or follow the evidenced branch)`)
    } else if (isLast && !r.stop) {
      add(n, `Why ${n} is an open question: give it its stop (evidence_exhausted) so the ladder ends there honestly`)
    }
    if (r.stop && !isLast) add(n, `Why ${n} stops the ladder (${r.stop}) but Why ${rungs[k + 1]?.n ?? n + 1} climbs past it`)
    if (r.branch) {
      const b = r.branch
      if (b.answers.length !== 2) add(n, `Why ${n}'s branch needs two answers (it splits into two at most), not ${b.answers.length}`)
      if (!followed) add(n, `Why ${n}'s branch follows answer ${b.followed + 1}, which is not there`)
      else {
        for (const [k2, a] of b.answers.entries()) for (const p of sourceProblems(a.evidence, `Why ${n} branch ${k2 + 1}`)) add(n, p)
        for (const p of backingProblems(n, followed.evidence, ' for the branch it follows')) add(n, p)
        const other = b.answers.find((_a, k2) => k2 !== b.followed)
        if (other && b.join === 'OR' && other.evidence.length > followed.evidence.length)
          add(n, `Why ${n} follows the less-evidenced branch: follow the better-evidenced one and mark the other parked`)
        if (other && b.join === 'AND' && !other.evidence.length) add(n, `Why ${n} says both causes were needed (AND) but the second has no source`)
      }
    }
    const loop = loopTarget(r)
    if (loop !== null && !rungs.some(x => x.n === loop && x.n < n)) add(n, `Why ${n} loops back to Why ${loop}, which is not an earlier Why on this ladder`)
  })
  const landing = l?.landing || { shows: '', open_question: '' }
  if (!str(landing.shows)) add(null, 'The landing does not say what this shows')
  if (!str(landing.open_question)) add(null, 'The landing hands the viewer no open question')
  else if (!/\?["'”’)]*$/.test(str(landing.open_question))) add(null, 'The landing\'s open question is not a question: end it with "?"')
  for (const v of landingVetoes(landing))
    add(null, `The landing reads as ${v.kind} ("${v.said}"): land on what this shows and an open question for the viewer, never a verdict, forecast, odds or a lesson`)
  return out
}
