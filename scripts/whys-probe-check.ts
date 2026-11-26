// The whys probe check: does a story hold the five whys before Krish picks it?
//
// Before the board is built, a blind whys-prober subagent reads one candidate's own sources and writes a why-ladder/1
// probe (the brief is .agents/skills/plan-week/references/story-score.md). It caches every page it read under
// docs/plans/<Monday>-week/probe/pages/. This check reads the probe with the same reader as the post-pick ladder
// (checkWhyLadder, landingVetoes and siteOf from packages/contracts/src/whys.ts) and then holds every quote to its page:
//
//   - a rung counts as documented only when quotes found verbatim in their cached pages span at least two sites;
//   - a rung with one verbatim quote, or verbatim quotes on one site only, counts as inferred (a paraphrase is
//     downgraded, never upgraded: a rung the probe labelled inferred stays inferred);
//   - a rung none of whose quotes is in its page counts as neither, and says so;
//   - a rung whose pages could not be read is reported in unreadable[], apart from a story that cannot hold the whys.
//
// It prints {documented, inferred, sites, mechanism_rungs, counter_rungs, landing_ok, unreadable[], problems[]} (plus
// the per-rung reading) as JSON for scripts/post-pack/story_score.py, which applies the floors in
// config/story-score.json. It reads no taste, no picks and no verdicts: only the probe and the pages.
//
// Usage:
//   npx tsx scripts/whys-probe-check.ts <Monday>                every probe in docs/plans/<Monday>-week/probe/
//   npx tsx scripts/whys-probe-check.ts <Monday> <option_id>    probe/<option_id>.whys.json
//   npx tsx scripts/whys-probe-check.ts --ladder <file> --pages <dir>
// Exit 0 when the check ran (the result says whether the story holds), 2 when it could not run (no probe, no ladder,
// a pages index that is not JSON). Exit 2 is never a pass.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  checkWhyLadder, domainOf, landingVetoes, parseWhyLadder, siteOf,
  type WhyEvidence, type WhyLadder, type WhyRung,
} from '../packages/contracts/src/whys.js'

export const PROBE_SCHEMA = 'whys-probe/1'
/** The suffix of a probe file in docs/plans/<Monday>-week/probe/. */
export const PROBE_SUFFIX = '.whys.json'
/** The cached pages and their index, inside the probe folder. */
export const PAGES_DIR = 'pages'
export const PAGES_INDEX = 'index.json'

export type Counted = 'documented' | 'inferred' | 'unsupported' | 'unread' | 'open'

export interface RungReading {
  n: number
  claimed: WhyRung['strength']
  counted: Counted
  verified_sites: string[]
  mechanism: boolean
  counter: boolean
}

export interface ProbeResult {
  schema: typeof PROBE_SCHEMA
  documented: number
  inferred: number
  sites: number
  mechanism_rungs: number
  counter_rungs: number
  landing_ok: boolean
  unreadable: Array<{ url: string; reason: string }>
  problems: string[]
  rungs: RungReading[]
}

/** A cached page: its text, or why it could not be read. */
export type Page = { text: string } | { unreadable: string }
/** The pages a probe may be checked against, by url as the probe cites it. */
export type Pages = (url: string) => Page

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: '-', mdash: '-', hellip: '...' }

/** Text as it is compared: tags, markdown emphasis and links stripped, quotes, dashes, ellipses and whitespace made
 *  plain. Case is kept: a quote is verbatim or it is not. */
export function normalise(s: string): string {
  return String(s || '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&([a-z]+|#39);/gi, (m, k: string) => ENTITIES[k.toLowerCase()] ?? m)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A url as it is looked up: no fragment, no trailing slash, host lower case without www. */
export function urlKey(url: string): string {
  try {
    const u = new URL(String(url || '').trim())
    u.hash = ''
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.replace(/\/+$/, '')
    return `${u.protocol}//${host}${u.port ? `:${u.port}` : ''}${path}${u.search}`
  } catch {
    return String(url || '').trim()
  }
}

function quoteIn(quote: string, text: string): boolean {
  const q = normalise(quote)
  // Leading and trailing quote marks or an ellipsis are the citer's, not the page's.
  const core = q.replace(/^["'.\s]+|["'.\s]+$/g, '')
  return core.length > 0 && normalise(text).includes(core)
}

/** The sources a rung stands on: its own, or the branch answer it follows. */
function sourcesOf(r: WhyRung): WhyEvidence[] {
  const followed = r.branch?.answers[r.branch.followed]
  return followed && followed.evidence.length ? followed.evidence : (r.evidence || [])
}

/** Reads a probe against its pages. Pure: the pages come in as a lookup, so a test can hand it fakes. */
export function probeCheck(ladder: WhyLadder, pages: Pages, parseProblems: string[] = []): ProbeResult {
  const problems: string[] = [...parseProblems]
  for (const p of checkWhyLadder(ladder)) problems.push(p.rung === null ? p.problem : (p.problem.startsWith(`Why ${p.rung}`) ? p.problem : `Why ${p.rung}: ${p.problem}`))
  const unreadable = new Map<string, string>()
  const ladderSites = new Set<string>()
  const rungs: RungReading[] = []
  for (const r of Array.isArray(ladder.rungs) ? ladder.rungs : []) {
    const mechanism = Boolean(r.mechanism_type)
    const counter = Boolean((r.counter?.text || '').trim())
    if (r.strength === 'open') {
      rungs.push({ n: r.n, claimed: r.strength, counted: 'open', verified_sites: [], mechanism, counter })
      continue
    }
    const verified = new Set<string>()
    let read = 0, unread = 0
    for (const e of sourcesOf(r)) {
      if (!e.url) continue
      const page = pages(e.url)
      if ('unreadable' in page) {
        unread++
        unreadable.set(e.url, page.unreadable)
        continue
      }
      read++
      const site = siteOf(e.domain || domainOf(e.url))
      if (e.quote && quoteIn(e.quote, page.text)) {
        verified.add(site)
        ladderSites.add(site)
      } else {
        problems.push(`Why ${r.n}: the quote from ${e.domain || domainOf(e.url) || e.url} is not in its page word for word${e.quote ? '' : ' (no quote given)'}`)
      }
    }
    let counted: Counted
    if (verified.size >= 2 && r.strength === 'documented') counted = 'documented'
    else if (verified.size >= 1) counted = 'inferred'
    else if (read === 0 && unread > 0) counted = 'unread'
    else counted = 'unsupported'
    if (counted === 'inferred' && r.strength === 'documented') problems.push(`Why ${r.n}: labelled documented, counted inferred (verbatim quotes on ${verified.size} site${verified.size === 1 ? '' : 's'}, two needed)`)
    if (counted === 'unsupported') problems.push(`Why ${r.n}: no quote survives its page, so the rung does not count`)
    rungs.push({ n: r.n, claimed: r.strength, counted, verified_sites: [...verified].sort(), mechanism, counter })
  }
  if (ladderSites.size < 2) problems.push(`The ladder stands on ${ladderSites.size === 0 ? 'no verified site' : `one site (${[...ladderSites][0]})`}: verbatim quotes on two sites at least`)
  const landing = ladder.landing || { shows: '', open_question: '' }
  const landing_ok = Boolean((landing.shows || '').trim()) && /\?["'\u201D\u2019)]*$/.test((landing.open_question || '').trim()) && landingVetoes(landing).length === 0
  const doc = rungs.filter(r => r.counted === 'documented')
  return {
    schema: PROBE_SCHEMA,
    documented: doc.length,
    inferred: rungs.filter(r => r.counted === 'inferred').length,
    sites: ladderSites.size,
    mechanism_rungs: doc.filter(r => r.mechanism).length,
    counter_rungs: doc.filter(r => r.counter).length,
    landing_ok,
    unreadable: [...unreadable].map(([url, reason]) => ({ url, reason })),
    problems,
    rungs,
  }
}

/** A probe file's ladder: a why-ladder/1 object, an object carrying it as `whys`, or text with a fenced block. */
export function ladderFromText(text: string): { ladder: WhyLadder | null; problems: string[] } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return parseWhyLadder(text)
  }
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  const inner = obj && obj.schema === undefined && obj.whys && typeof obj.whys === 'object' ? obj.whys : obj
  if (!inner) return { ladder: null, problems: ['The probe is not a why-ladder/1 object'] }
  return parseWhyLadder('```why-ladder\n' + JSON.stringify(inner) + '\n```')
}

/** The cached pages of a probe folder: pages/index.json maps each url to {file} or {unreadable: reason}. A url the
 *  index does not name, or whose file is missing or empty, is unreadable. */
export function pagesFrom(dir: string): Pages {
  const indexPath = join(dir, PAGES_INDEX)
  const index: Record<string, { file?: string; unreadable?: string }> = {}
  if (existsSync(indexPath)) {
    const raw = JSON.parse(readFileSync(indexPath, 'utf8')) as unknown
    const entries = raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.entries(raw as Record<string, unknown>) : []
    for (const [url, v] of entries) if (v && typeof v === 'object') index[urlKey(url)] = v as { file?: string; unreadable?: string }
  }
  return (url: string): Page => {
    const entry = index[urlKey(url)]
    if (!entry) return { unreadable: 'not cached' }
    if (entry.unreadable) return { unreadable: entry.unreadable }
    const file = entry.file ? join(dir, entry.file) : ''
    if (!file || !existsSync(file)) return { unreadable: 'cached file missing' }
    const text = readFileSync(file, 'utf8')
    return text.trim() ? { text } : { unreadable: 'cached page is empty' }
  }
}

function weekProbeDir(root: string, monday: string): string {
  return join(root, 'docs', 'plans', `${monday}-week`, 'probe')
}

function checkFile(file: string, pagesDir: string): ProbeResult | { error: string } {
  if (!existsSync(file)) return { error: `no probe at ${file}` }
  const { ladder, problems } = ladderFromText(readFileSync(file, 'utf8'))
  if (!ladder) return { error: problems.join('; ') || 'no why-ladder in the probe' }
  return probeCheck(ladder, pagesFrom(pagesDir), problems)
}

export function main(argv: string[], root: string): { code: number; out: unknown } {
  const flag = (name: string) => {
    const k = argv.indexOf(name)
    return k >= 0 ? argv[k + 1] : undefined
  }
  const positional = argv.filter((a, k) => !a.startsWith('--') && !(k > 0 && (argv[k - 1] === '--ladder' || argv[k - 1] === '--pages')))
  try {
    const ladderFile = flag('--ladder')
    if (ladderFile) {
      const pagesDir = flag('--pages')
      if (!pagesDir) return { code: 2, out: { error: '--ladder needs --pages <dir>' } }
      const r = checkFile(resolve(ladderFile), resolve(pagesDir))
      return 'error' in r ? { code: 2, out: r } : { code: 0, out: r }
    }
    const [monday, option] = positional
    if (!monday || !/^\d{4}-\d{2}-\d{2}$/.test(monday)) return { code: 2, out: { error: 'usage: whys-probe-check.ts <Monday> [option_id] | --ladder <file> --pages <dir>' } }
    const dir = weekProbeDir(root, monday)
    const pagesDir = join(dir, PAGES_DIR)
    if (option) {
      const r = checkFile(join(dir, `${option}${PROBE_SUFFIX}`), pagesDir)
      return 'error' in r ? { code: 2, out: r } : { code: 0, out: r }
    }
    if (!existsSync(dir)) return { code: 2, out: { error: `no probe folder at ${dir}` } }
    const files = readdirSync(dir).filter(f => f.endsWith(PROBE_SUFFIX)).sort()
    if (!files.length) return { code: 2, out: { error: `no probes in ${dir}` } }
    const out: Record<string, ProbeResult | { error: string }> = {}
    for (const f of files) out[f.slice(0, -PROBE_SUFFIX.length)] = checkFile(join(dir, f), pagesDir)
    return { code: Object.values(out).some(r => 'error' in r) ? 2 : 0, out }
  } catch (e) {
    return { code: 2, out: { error: e instanceof Error ? e.message : String(e) } }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { code, out } = main(process.argv.slice(2), resolve(fileURLToPath(new URL('..', import.meta.url))))
  process.stdout.write(JSON.stringify(out, null, 2) + '\n')
  process.exitCode = code
}
