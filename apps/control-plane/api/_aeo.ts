import { sanitizeVoice } from './_content.js'
import { AEO_ENGINES, AEO_THEMES_STATUSES, PRODUCT_SLUGS, SUBJECT_KINDS, mondayOf } from './_growth.js'
// AEO-Engine's own docs/packet.schema.json, copied byte for byte: the shapes of the optional packet fields are checked against it.
import packetSchema from '../../../docs/AEO-PACKET.schema.json' with { type: 'json' }

// _aeo: the pure half of the AEO engine's landing (api/aeo/*).
//
// krishanraja/AEO-Engine runs on GitHub Actions every Sunday and POSTs one
// AeoPacket per subject per week to api/aeo/ingest.ts. This file is what the
// ingest trusts: the packet contract (docs/AEO-PACKET.schema.json is the
// machine copy, kept identical to docs/packet.schema.json in the engine
// repo), the row the content spine receives, and the source_ref that keeps a
// re-run from duplicating a week. Nothing here touches the database, so
// tests/api/aeo.test.ts and the guards can import it.
//
// Two rules the validator enforces that the schema alone cannot say:
//   Private calls stay private. themes and call_evidence are read with the
//   anon key on the Growth tab, so a packet carrying an email address or an
//   @handle is refused as a whole. Paraphrases only.
//   No em dashes. Every string passes through sanitizeVoice on the way in, so
//   what is stored equals what the house copy standard allows.

export const PACKET_SCHEMA_VERSION = 1

export const MAX_QUERIES = 60
export const MAX_PROBES = 600
export const MAX_RECOMMENDATIONS = 5
/** How many recommendations one subject may push into content_ideas in a week. */
export const MAX_IDEAS_PER_SUBJECT = 3
/** While this many aeo_signal rows sit undecided, the ingest lands the digest
 *  but adds no more ideas (the build-signal governor, same reasoning). */
export const OPEN_GOVERNOR = 12
/** An undecided recommendation expires like any seed. Three weeks matches
 *  SIGNAL_TTL_DAYS in api/_buildSignals.ts and the radar's owned-source
 *  lookback. */
export const SIGNAL_TTL_DAYS = 21

export type SubjectKind = 'venture' | 'prospect' | 'aspiration'
export type AeoEngine = 'perplexity' | 'chatgpt' | 'claude' | 'grok' | 'gemini'
export type ThemesStatus = 'ok' | 'no_calls' | 'no_attributed_calls' | 'fireflies_unavailable' | 'not_applicable'

export interface AeoEvidence { call_ref: string; date: string; paraphrase: string }

export interface AeoProbe {
  engine: AeoEngine
  model: string
  question: string
  answer_snapshot: string
  we_cited: boolean
  citations: string[]
  cost_usd: number
  /** Packet feature probe_detail: what the engine's search returned, cited or not. */
  retrieved?: string[]
  /** Packet feature probe_detail: whether the engine searched the web for this answer. */
  searched?: boolean
  /** Packet feature probe_detail: the engine's own search queries. */
  fan_out?: string[]
  /** Packet feature probe_detail: 1-based position of our first inline citation. */
  our_position?: number | null
  /** Packet feature name_mentions: the answer names the subject outside any URL. */
  name_mentioned?: boolean | null
  /** Packet feature samples: a contested question's repeat samples on this engine. */
  samples?: { n: number; first: number; cited: number } | null
}

export interface AeoQuery {
  query_id: string
  query: string
  source: 'transcript' | 'gap' | 'seed' | 'striking_distance' | 'watch_carry' | 'room_signal'
  demand_score: number
  demand_basis: { llm_demand: number; transcript_evidence: number; rising_volume: number; labels: string[] }
  call_evidence: AeoEvidence[]
  gap: { we_cited_engines: AeoEngine[]; competitor_domains: string[] }
  trend: 'new' | 'up' | 'flat' | 'down'
  status: 'watch' | 'recommend' | 'drop'
  touchpoint_id: string | null
  probes: AeoProbe[]
  /** Packet feature panel: where the question stands, run after run. */
  panel?: Record<string, unknown>
  /** Packet feature diagnosis: why the question is not won. */
  diagnosis?: Record<string, unknown>
  /** Packet feature outcome: search signals for the page a kit targets or a venture shipped. */
  outcome?: Record<string, unknown>
}

/** Packet feature cited_pages: one page the assistants cite for the venture's questions (brief, section J). */
export interface AeoCitedPage {
  url: string
  host: string
  page_type: string
  questions: number
  engines: AeoEngine[]
  times_cited: number
  times_first: number
  mention: 'link' | 'name' | 'none' | 'unchecked'
  mention_ok: boolean | null
  checked_at: string | null
  platform: boolean
  own: boolean
}

export interface AeoRecommendation {
  n: number
  title: string
  target_query: string
  query_id: string
  angle: string
  evidence: string[]
  engines: AeoEngine[]
  demand: number
  /**
   * What this business has that the sites currently cited structurally cannot
   * have, drawn from the canon. The first live digest recommended whatever the
   * machine was absent from, which is how it offered a category term a jobs
   * board already owns. Absence is not opportunity, and a recommendation that
   * cannot name the advantage is a guess.
   *
   * Nullable so a packet written before the gate still validates. The engine
   * treats a null as a bug in itself, and the tab says the reason is missing
   * rather than implying there was one.
   */
  why_you_can_win?: string | null
}

/** A question probed and scored that is not worth trying to win. */
export interface AeoNotWorthChasing {
  query_id: string
  query: string
  /** The sites that own the answer today. */
  owned_by: string[]
  /** One plain sentence. Worth more than a bad suggestion: it saves a week. */
  why_not: string
}

export interface AeoPacket {
  schema_version: 1
  run_id: string
  command_id: number | null
  subject: { id: string; kind: SubjectKind; slug: string; product_slug: string | null }
  week_start: string
  generated_at: string
  engines: AeoEngine[]
  themes_status: ThemesStatus
  themes: Array<{ theme: string; calls: number; evidence: AeoEvidence[] }>
  calls: { considered: number; attributed: number }
  queries: AeoQuery[]
  strongest_signal: string | null
  recommendations: AeoRecommendation[]
  watch_list: Array<{ query_id: string; query: string; why: string }>
  not_worth_chasing?: AeoNotWorthChasing[]
  competitor_gap: { domain: string | null; times_cited: number; questions: string[] }
  playbook: Array<{ url: string; host: string; path_pattern: string; times_cited: number; why: string }> | null
  approach_hook: string | null
  stats: {
    queries: number; probes: number; probes_failed: number; probes_skipped_cap: number
    cost_usd: number; engines: number; transcripts: number; digest_writer: 'claude' | 'fallback'
  }
  /** Packet feature kits: the venture's win kits, highest priority first. */
  kits?: Array<Record<string, unknown>>
  /** Packet feature site: each of our hosts' gates from the fetch-only site audit. */
  site?: { hosts: Array<{ host: string; gates: Array<{ gate: string; pass: boolean }> }> }
  /** Packet feature run_kind: a verify run re-asks shipped questions only and is never counted. */
  run_kind?: 'research' | 'verify'
  /** Packet feature cited_pages: the venture's cited-pages sheet. */
  cited_pages?: AeoCitedPage[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const HANDLE = /(^|[\s(])@[A-Za-z0-9_]{2,}/
const CALL_REF = /^[0-9a-f]{8}$/
const SOURCES = new Set(['transcript', 'gap', 'seed', 'striking_distance', 'watch_carry', 'room_signal'])
const TRENDS = new Set(['new', 'up', 'flat', 'down'])
const STATUSES = new Set(['watch', 'recommend', 'drop'])

type Errs = string[]

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Walk every string in the packet: sanitize in place, refuse private material. */
function sweepStrings(value: unknown, path: string, errs: Errs): unknown {
  if (typeof value === 'string') {
    if (EMAIL.test(value)) errs.push(`${path}: contains an email address`)
    if (HANDLE.test(value)) errs.push(`${path}: contains an @handle`)
    return sanitizeVoice(value)
  }
  if (Array.isArray(value)) return value.map((v, i) => sweepStrings(v, `${path}[${i}]`, errs))
  if (isObj(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = sweepStrings(v, `${path}.${k}`, errs)
    return out
  }
  return value
}

function str(v: unknown, path: string, max: number, errs: Errs, min = 1): v is string {
  if (typeof v !== 'string') { errs.push(`${path}: must be a string`); return false }
  if (v.length < min) { errs.push(`${path}: too short`); return false }
  if (v.length > max) { errs.push(`${path}: over ${max} characters`); return false }
  return true
}

function int(v: unknown, path: string, lo: number, hi: number, errs: Errs): v is number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < lo || v > hi) { errs.push(`${path}: must be an integer between ${lo} and ${hi}`); return false }
  return true
}

function arr(v: unknown, path: string, max: number, errs: Errs): v is unknown[] {
  if (!Array.isArray(v)) { errs.push(`${path}: must be an array`); return false }
  if (v.length > max) { errs.push(`${path}: more than ${max} items`); return false }
  return true
}

function evidenceOk(v: unknown, path: string, errs: Errs): void {
  if (!isObj(v)) { errs.push(`${path}: must be an object`); return }
  if (typeof v.call_ref !== 'string' || !CALL_REF.test(v.call_ref)) errs.push(`${path}.call_ref: must be an 8 hex character hash, never a transcript id`)
  if (typeof v.date !== 'string' || !YMD.test(v.date)) errs.push(`${path}.date: must be YYYY-MM-DD`)
  str(v.paraphrase, `${path}.paraphrase`, 200, errs)
}

/**
 * The whole packet, checked against the contract. Returns the sanitized
 * packet on success (strings cleaned), or every problem found, so the engine
 * sees one 400 with the full list rather than one per push.
 */
// ── The optional packet fields, checked against AEO-Engine's own schema ────
// docs/AEO-PACKET.schema.json is AEO-Engine's docs/packet.schema.json byte for
// byte. The v1 fields keep the hand checks above; the fields a packet carries
// only once the context lists them in packet_features are checked here, by the
// handful of JSON Schema keywords that file uses, so the engine and this ingest
// hold one contract.

type SchemaNode = Record<string, unknown>
const SCHEMA = packetSchema as unknown as { $defs: Record<string, SchemaNode>; properties: Record<string, SchemaNode> }
const PROBE_PROPS = (SCHEMA.$defs.probe as { properties: Record<string, SchemaNode> }).properties
const TOP_PROPS = SCHEMA.properties
/** The probe fields of packet features probe_detail, name_mentions and samples. */
export const PROBE_FEATURE_FIELDS = ['retrieved', 'searched', 'fan_out', 'our_position', 'name_mentioned', 'samples'] as const

function resolveRef(node: SchemaNode): SchemaNode {
  let n = node
  for (let i = 0; i < 8 && typeof n.$ref === 'string'; i++) {
    const m = /^#\/\$defs\/(.+)$/.exec(n.$ref)
    const def = m ? SCHEMA.$defs[m[1]] : undefined
    if (!def) throw new Error(`packet schema: unknown $ref ${n.$ref}`)
    n = def
  }
  return n
}

function typeOk(type: string, v: unknown): boolean {
  switch (type) {
    case 'string': return typeof v === 'string'
    case 'integer': return typeof v === 'number' && Number.isInteger(v)
    case 'number': return typeof v === 'number' && Number.isFinite(v)
    case 'boolean': return typeof v === 'boolean'
    case 'null': return v === null
    case 'array': return Array.isArray(v)
    case 'object': return isObj(v)
    default: return false
  }
}

/** Check a value against one node of the packet schema; push a plain error per fault, at most a few per field. */
export function schemaCheck(node: SchemaNode, v: unknown, path: string, errs: string[]): void {
  const n = resolveRef(node)
  if (Array.isArray(n.oneOf)) {
    const passing = (n.oneOf as SchemaNode[]).filter(alt => { const e: string[] = []; schemaCheck(alt, v, path, e); return e.length === 0 })
    if (passing.length !== 1) errs.push(`${path}: does not match its shape`)
    return
  }
  if (typeof n.type === 'string' && !typeOk(n.type, v)) { errs.push(`${path}: must be ${n.type === 'integer' ? 'a whole number' : `a ${n.type}`}`); return }
  if ('const' in n && v !== n.const) { errs.push(`${path}: must be ${JSON.stringify(n.const)}`); return }
  if (Array.isArray(n.enum) && !(n.enum as unknown[]).includes(v)) { errs.push(`${path}: unknown value`); return }
  if (typeof v === 'string') {
    if (typeof n.minLength === 'number' && v.length < n.minLength) errs.push(`${path}: too short`)
    if (typeof n.maxLength === 'number' && v.length > n.maxLength) errs.push(`${path}: over ${n.maxLength} characters`)
    if (typeof n.pattern === 'string' && !new RegExp(n.pattern).test(v)) errs.push(`${path}: not in the expected form`)
  }
  if (typeof v === 'number') {
    if (typeof n.minimum === 'number' && v < n.minimum) errs.push(`${path}: under ${n.minimum}`)
    if (typeof n.maximum === 'number' && v > n.maximum) errs.push(`${path}: over ${n.maximum}`)
  }
  if (Array.isArray(v)) {
    if (typeof n.minItems === 'number' && v.length < n.minItems) errs.push(`${path}: fewer than ${n.minItems}`)
    if (typeof n.maxItems === 'number' && v.length > n.maxItems) { errs.push(`${path}: over ${n.maxItems} items`); return }
    if (n.uniqueItems === true && new Set(v.map(x => JSON.stringify(x))).size !== v.length) errs.push(`${path}: repeats an item`)
    if (isObj(n.items)) for (const [i, x] of v.entries()) { schemaCheck(n.items as SchemaNode, x, `${path}[${i}]`, errs); if (errs.length > 40) return }
  }
  if (isObj(v) && (isObj(n.properties) || Array.isArray(n.required))) {
    const props = (isObj(n.properties) ? n.properties : {}) as Record<string, SchemaNode>
    for (const r of (Array.isArray(n.required) ? n.required : []) as string[]) if (!(r in v)) errs.push(`${path}.${r}: required`)
    for (const [k, x] of Object.entries(v)) {
      if (props[k]) schemaCheck(props[k], x, `${path}.${k}`, errs)
      else if (n.additionalProperties === false) errs.push(`${path}.${k}: not a field of this shape`)
      if (errs.length > 40) return
    }
  }
}

export function validatePacket(input: unknown): { ok: true; packet: AeoPacket } | { ok: false; errors: string[] } {
  const errs: Errs = []
  if (!isObj(input)) return { ok: false, errors: ['packet must be a JSON object'] }
  const p = sweepStrings(input, 'packet', errs) as Record<string, unknown>

  if (p.schema_version !== PACKET_SCHEMA_VERSION) errs.push(`packet.schema_version: must be ${PACKET_SCHEMA_VERSION}`)
  if (typeof p.run_id !== 'string' || !UUID.test(p.run_id)) errs.push('packet.run_id: must be a uuid')
  if (!(p.command_id === null || (typeof p.command_id === 'number' && Number.isInteger(p.command_id) && p.command_id >= 1))) errs.push('packet.command_id: must be a positive integer or null')

  const subject = isObj(p.subject) ? p.subject : null
  if (!subject) errs.push('packet.subject: required')
  else {
    if (typeof subject.id !== 'string' || !UUID.test(subject.id)) errs.push('packet.subject.id: must be a uuid')
    if (typeof subject.kind !== 'string' || !SUBJECT_KINDS.has(subject.kind)) errs.push('packet.subject.kind: must be venture, prospect or aspiration')
    if (typeof subject.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(subject.slug)) errs.push('packet.subject.slug: lower-case letters, digits and hyphens')
    if (!(subject.product_slug === null || (typeof subject.product_slug === 'string' && PRODUCT_SLUGS.has(subject.product_slug)))) errs.push('packet.subject.product_slug: must be a Growth product slug or null')
    if (subject.kind === 'venture' && subject.product_slug === null) errs.push('packet.subject.product_slug: a venture must name its product slug')
    if (subject.kind !== 'venture' && subject.product_slug !== null) errs.push('packet.subject.product_slug: only a venture carries a product slug')
  }

  if (typeof p.week_start !== 'string' || !YMD.test(p.week_start)) errs.push('packet.week_start: must be YYYY-MM-DD')
  else if (mondayOf(new Date(`${p.week_start}T00:00:00Z`)) !== p.week_start) errs.push('packet.week_start: must be a Monday (UTC)')
  if (typeof p.generated_at !== 'string' || Number.isNaN(Date.parse(p.generated_at))) errs.push('packet.generated_at: must be an ISO timestamp')

  if (arr(p.engines, 'packet.engines', AEO_ENGINES.size, errs)) {
    if (!p.engines.length) errs.push('packet.engines: at least one engine')
    for (const [i, e] of p.engines.entries()) if (typeof e !== 'string' || !AEO_ENGINES.has(e)) errs.push(`packet.engines[${i}]: unknown engine`)
    if (new Set(p.engines).size !== p.engines.length) errs.push('packet.engines: duplicates')
  }

  if (typeof p.themes_status !== 'string' || !AEO_THEMES_STATUSES.has(p.themes_status)) errs.push('packet.themes_status: unknown value')
  if (arr(p.themes, 'packet.themes', 10, errs)) {
    for (const [i, t] of p.themes.entries()) {
      const path = `packet.themes[${i}]`
      if (!isObj(t)) { errs.push(`${path}: must be an object`); continue }
      str(t.theme, `${path}.theme`, 200, errs)
      int(t.calls, `${path}.calls`, 1, 10_000, errs)
      if (arr(t.evidence, `${path}.evidence`, 6, errs)) t.evidence.forEach((e, j) => evidenceOk(e, `${path}.evidence[${j}]`, errs))
    }
    if (p.themes_status !== 'ok' && p.themes.length) errs.push('packet.themes: must be empty unless themes_status is ok')
  }
  if (!isObj(p.calls)) errs.push('packet.calls: required')
  else {
    int(p.calls.considered, 'packet.calls.considered', 0, 100_000, errs)
    int(p.calls.attributed, 'packet.calls.attributed', 0, 100_000, errs)
  }

  const queryIds = new Set<string>()
  let probeCount = 0
  if (arr(p.queries, 'packet.queries', MAX_QUERIES, errs)) {
    for (const [i, q] of p.queries.entries()) {
      const path = `packet.queries[${i}]`
      if (!isObj(q)) { errs.push(`${path}: must be an object`); continue }
      if (typeof q.query_id !== 'string' || !UUID.test(q.query_id)) errs.push(`${path}.query_id: must be a uuid`)
      else if (queryIds.has(q.query_id)) errs.push(`${path}.query_id: repeated`)
      else queryIds.add(q.query_id)
      str(q.query, `${path}.query`, 400, errs, 3)
      if (typeof q.source !== 'string' || !SOURCES.has(q.source)) errs.push(`${path}.source: unknown value`)
      int(q.demand_score, `${path}.demand_score`, 0, 100, errs)
      if (!isObj(q.demand_basis)) errs.push(`${path}.demand_basis: required`)
      else {
        int(q.demand_basis.llm_demand, `${path}.demand_basis.llm_demand`, 0, 40, errs)
        int(q.demand_basis.transcript_evidence, `${path}.demand_basis.transcript_evidence`, 0, 30, errs)
        int(q.demand_basis.rising_volume, `${path}.demand_basis.rising_volume`, 0, 30, errs)
        if (!Array.isArray(q.demand_basis.labels)) errs.push(`${path}.demand_basis.labels: must be an array`)
      }
      if (arr(q.call_evidence, `${path}.call_evidence`, 10, errs)) q.call_evidence.forEach((e, j) => evidenceOk(e, `${path}.call_evidence[${j}]`, errs))
      if (!isObj(q.gap)) errs.push(`${path}.gap: required`)
      else {
        if (arr(q.gap.we_cited_engines, `${path}.gap.we_cited_engines`, AEO_ENGINES.size, errs)) for (const e of q.gap.we_cited_engines) if (typeof e !== 'string' || !AEO_ENGINES.has(e)) errs.push(`${path}.gap.we_cited_engines: unknown engine`)
        arr(q.gap.competitor_domains, `${path}.gap.competitor_domains`, 12, errs)
      }
      if (typeof q.trend !== 'string' || !TRENDS.has(q.trend)) errs.push(`${path}.trend: unknown value`)
      if (typeof q.status !== 'string' || !STATUSES.has(q.status)) errs.push(`${path}.status: unknown value`)
      if (!(q.touchpoint_id === null || (typeof q.touchpoint_id === 'string' && UUID.test(q.touchpoint_id)))) errs.push(`${path}.touchpoint_id: uuid or null`)
      if (arr(q.probes, `${path}.probes`, 8, errs)) {
        probeCount += q.probes.length
        for (const [j, pr] of q.probes.entries()) {
          const pp = `${path}.probes[${j}]`
          if (!isObj(pr)) { errs.push(`${pp}: must be an object`); continue }
          if (typeof pr.engine !== 'string' || !AEO_ENGINES.has(pr.engine)) errs.push(`${pp}.engine: unknown engine`)
          str(pr.model, `${pp}.model`, 80, errs)
          str(pr.question, `${pp}.question`, 400, errs)
          str(pr.answer_snapshot, `${pp}.answer_snapshot`, 1800, errs, 0)
          if (typeof pr.we_cited !== 'boolean') errs.push(`${pp}.we_cited: must be a boolean`)
          arr(pr.citations, `${pp}.citations`, 8, errs)
          if (typeof pr.cost_usd !== 'number' || pr.cost_usd < 0) errs.push(`${pp}.cost_usd: must be a number, zero or more`)
          for (const k of PROBE_FEATURE_FIELDS) if (pr[k] !== undefined) schemaCheck(PROBE_PROPS[k], pr[k], `${pp}.${k}`, errs)
        }
      }
      for (const k of ['panel', 'diagnosis', 'outcome'] as const) if (q[k] !== undefined) schemaCheck({ $ref: `#/$defs/${k}` }, q[k], `${path}.${k}`, errs)
    }
  }
  if (probeCount > MAX_PROBES) errs.push(`packet.queries: ${probeCount} probes is over the ${MAX_PROBES} cap`)

  if (!(p.strongest_signal === null || str(p.strongest_signal, 'packet.strongest_signal', 240, errs))) { /* reported */ }
  if (arr(p.recommendations, 'packet.recommendations', MAX_RECOMMENDATIONS, errs)) {
    for (const [i, r] of p.recommendations.entries()) {
      const path = `packet.recommendations[${i}]`
      if (!isObj(r)) { errs.push(`${path}: must be an object`); continue }
      int(r.n, `${path}.n`, 1, MAX_RECOMMENDATIONS, errs)
      str(r.title, `${path}.title`, 200, errs)
      str(r.target_query, `${path}.target_query`, 400, errs)
      if (typeof r.query_id !== 'string' || !UUID.test(r.query_id)) errs.push(`${path}.query_id: must be a uuid`)
      else if (queryIds.size && !queryIds.has(r.query_id)) errs.push(`${path}.query_id: not one of the packet's queries`)
      str(r.angle, `${path}.angle`, 600, errs)
      arr(r.evidence, `${path}.evidence`, 6, errs)
      if (arr(r.engines, `${path}.engines`, AEO_ENGINES.size, errs)) for (const e of r.engines) if (typeof e !== 'string' || !AEO_ENGINES.has(e)) errs.push(`${path}.engines: unknown engine`)
      int(r.demand, `${path}.demand`, 0, 100, errs)
      // Nullable on purpose: a packet written before the winnability gate
      // still lands. A present reason has to be a real sentence.
      if (r.why_you_can_win != null && !str(r.why_you_can_win, `${path}.why_you_can_win`, 300, errs)) { /* reported */ }
    }
  }
  if (p.not_worth_chasing !== undefined && arr(p.not_worth_chasing, 'packet.not_worth_chasing', 6, errs)) {
    for (const [i, w] of p.not_worth_chasing.entries()) {
      const path = `packet.not_worth_chasing[${i}]`
      if (!isObj(w)) { errs.push(`${path}: must be an object`); continue }
      if (typeof w.query_id !== 'string' || !UUID.test(w.query_id)) errs.push(`${path}.query_id: must be a uuid`)
      else if (queryIds.size && !queryIds.has(w.query_id)) errs.push(`${path}.query_id: not one of the packet's queries`)
      str(w.query, `${path}.query`, 400, errs)
      str(w.why_not, `${path}.why_not`, 300, errs)
      if (arr(w.owned_by, `${path}.owned_by`, 8, errs)) for (const d of w.owned_by) if (typeof d !== 'string') errs.push(`${path}.owned_by: must be site names`)
    }
  }
  if (arr(p.watch_list, 'packet.watch_list', 15, errs)) {
    for (const [i, w] of p.watch_list.entries()) {
      const path = `packet.watch_list[${i}]`
      if (!isObj(w)) { errs.push(`${path}: must be an object`); continue }
      if (typeof w.query_id !== 'string' || !UUID.test(w.query_id)) errs.push(`${path}.query_id: must be a uuid`)
      str(w.query, `${path}.query`, 400, errs)
      str(w.why, `${path}.why`, 240, errs, 0)
    }
  }
  if (!isObj(p.competitor_gap)) errs.push('packet.competitor_gap: required')
  else {
    if (!(p.competitor_gap.domain === null || str(p.competitor_gap.domain, 'packet.competitor_gap.domain', 120, errs))) { /* reported */ }
    int(p.competitor_gap.times_cited, 'packet.competitor_gap.times_cited', 0, 100_000, errs)
    arr(p.competitor_gap.questions, 'packet.competitor_gap.questions', 10, errs)
  }
  if (!(p.playbook === null || arr(p.playbook, 'packet.playbook', 12, errs))) { /* reported */ }
  if (!(p.approach_hook === null || str(p.approach_hook, 'packet.approach_hook', 300, errs))) { /* reported */ }
  if (subject && subject.kind !== 'aspiration' && Array.isArray(p.playbook)) errs.push('packet.playbook: only an aspiration carries a playbook')
  if (subject && subject.kind !== 'prospect' && typeof p.approach_hook === 'string') errs.push('packet.approach_hook: only a prospect carries an approach hook')

  if (!isObj(p.stats)) errs.push('packet.stats: required')
  else {
    for (const k of ['queries', 'probes', 'probes_failed', 'probes_skipped_cap', 'engines', 'transcripts']) int(p.stats[k], `packet.stats.${k}`, 0, 1_000_000, errs)
    if (typeof p.stats.cost_usd !== 'number' || p.stats.cost_usd < 0) errs.push('packet.stats.cost_usd: must be a number, zero or more')
    if (p.stats.digest_writer !== 'claude' && p.stats.digest_writer !== 'fallback') errs.push('packet.stats.digest_writer: claude or fallback')
  }

  // The optional top-level fields (packet features kits, site, run_kind and cited_pages), each in AEO-Engine's own shape.
  for (const k of ['kits', 'site', 'run_kind', 'cited_pages'] as const) if (p[k] !== undefined) schemaCheck(TOP_PROPS[k], p[k], `packet.${k}`, errs)
  const venture = !!subject && subject.kind === 'venture'
  if (p.kits !== undefined && !venture) errs.push('packet.kits: only a venture carries win kits')
  if (p.cited_pages !== undefined && !venture) errs.push('packet.cited_pages: only a venture carries a cited-pages sheet')
  if (Array.isArray(p.kits)) {
    for (const [i, k] of p.kits.entries()) {
      if (!isObj(k)) continue
      if (typeof k.query_id === 'string' && queryIds.size && !queryIds.has(k.query_id)) errs.push(`packet.kits[${i}].query_id: not one of the packet's queries`)
      if (subject && typeof k.product_slug === 'string' && k.product_slug !== subject.product_slug) errs.push(`packet.kits[${i}].product_slug: not this subject's product`)
    }
  }

  if (errs.length) return { ok: false, errors: errs.slice(0, 40) }
  return { ok: true, packet: p as unknown as AeoPacket }
}

/** One live content_ideas source row per recommendation per subject-week. */
export function aeoSourceRef(kind: SubjectKind, slug: string, weekStart: string, n: number): string {
  return `aeo:${kind}:${slug}:${weekStart}:${n}`
}

export interface AeoSignalRow {
  idea: string
  thesis: string
  source_type: 'aeo_signal'
  source_ref: string
  source_url: string | null
  source_snippet: string | null
  source_captured_at: string
  state: 'seeded'
  origin: 'agent'
  assigned_to: 'cleo'
  /** 'publication' only for a subject on EDITORIAL_AEO_SUBJECTS. Null
   *  otherwise, because an answer-engine recommendation for a venture's search
   *  surface is growth work and claiming otherwise is what put fractional-exec
   *  directory copy in the editorial review queue. */
  lane: 'publication' | null
  horizon: 'news'
  expires_at: string
  distribution: string[]
  touchpoint_id: string | null
  meta: {
    source_label: string
    aeo: {
      subject_id: string
      subject_kind: SubjectKind
      subject_slug: string
      product_slug: string | null
      week_start: string
      run_id: string
      n: number
      target_query: string
      query_id: string
      angle: string
      evidence: string[]
      engines: AeoEngine[]
      demand: number
      /** Why this business can win this answer when the sites cited today
       *  cannot. Rides onto the routed child so a finished piece can be
       *  checked against the advantage it was written to press. */
      why_you_can_win: string | null
      approach_hook: string | null
    }
  }
}

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

/** The row the content spine receives, shaped like buildSignalRow so the
 *  radar, the route and the card treat it as one more owned source. */
/**
 * AEO subjects whose recommendations are genuinely editorial.
 *
 * Every AEO recommendation used to be stamped `lane: 'publication'` regardless
 * of subject, and `aeo_signal` sits in RADAR_SOURCE_TYPES, so answer-engine
 * copy for every venture was fed to the Money of AI and Built with AI lenses
 * and landed in the editorial review queue. On 2026-09-09 that queue's six
 * review-state pieces were ALL aeo_signal, beside recommendations reading
 * "Finding a fractional executive who has actually run your function" and
 * "Why a daily football podcast beats a weekly one". Three of the five active
 * subjects are Fractionl products; none of them is a publication.
 *
 * Empty on purpose. AEO is optimisation against search queries for a named
 * venture, and the two publications are a different job with a different
 * standard, so a subject earns a place here by an explicit decision rather than
 * by defaulting in. Nothing else about the AEO pipeline changes: the rows are
 * still written, the Growth tab still opens them, they simply stop claiming to
 * be publication stories.
 */
export const EDITORIAL_AEO_SUBJECTS: readonly string[] = []

/** True when this subject's AEO output belongs in the editorial pipeline. */
export function isEditorialAeoSubject(slug: string | null | undefined): boolean {
  return Boolean(slug && EDITORIAL_AEO_SUBJECTS.includes(slug))
}

export function aeoSignalRow(packet: AeoPacket, rec: AeoRecommendation, subjectName: string, now = new Date()): AeoSignalRow {
  const query = packet.queries.find(q => q.query_id === rec.query_id)
  const kindLabel = packet.subject.kind === 'venture' ? subjectName
    : packet.subject.kind === 'prospect' ? `to be in front of ${subjectName}`
      : `learning from ${subjectName}`
  return {
    idea: cut(rec.title, 200),
    thesis: cut(rec.angle, 500),
    source_type: 'aeo_signal',
    source_ref: aeoSourceRef(packet.subject.kind, packet.subject.slug, packet.week_start, rec.n),
    source_url: null,
    source_snippet: cut(`Target query: ${rec.target_query}. ${rec.evidence.join(' ')}`, 400),
    source_captured_at: packet.generated_at,
    state: 'seeded',
    origin: 'agent',
    assigned_to: 'cleo',
    lane: isEditorialAeoSubject(packet.subject.slug) ? 'publication' : null,
    horizon: 'news',
    expires_at: new Date(now.getTime() + SIGNAL_TTL_DAYS * 86_400_000).toISOString(),
    distribution: [],
    touchpoint_id: query?.touchpoint_id ?? null,
    meta: {
      source_label: `AEO research, ${kindLabel}`,
      aeo: {
        subject_id: packet.subject.id,
        subject_kind: packet.subject.kind,
        subject_slug: packet.subject.slug,
        product_slug: packet.subject.product_slug,
        week_start: packet.week_start,
        run_id: packet.run_id,
        n: rec.n,
        target_query: rec.target_query,
        query_id: rec.query_id,
        angle: rec.angle,
        evidence: rec.evidence,
        engines: rec.engines,
        demand: rec.demand,
        why_you_can_win: rec.why_you_can_win ?? null,
        approach_hook: packet.approach_hook,
      },
    },
  }
}

/** What the editorial radar reads for an AEO row: the question the piece is
 *  written to win, the angle, and the measured evidence, in one plain block. */
export function aeoSignalSummary(meta: AeoSignalRow['meta']['aeo'], thesis: string): string {
  const parts = [
    `Target query: ${meta.target_query}.`,
    thesis,
    meta.evidence.length ? `Evidence: ${meta.evidence.join(' ')}` : 'Evidence: none recorded.',
    meta.engines.length ? `Absent from the answer on: ${meta.engines.join(', ')}.` : '',
    `Demand ${meta.demand} of 100 (proxies, no prompt-volume corpus).`,
  ].filter(Boolean)
  return cut(parts.join(' '), 3500)
}

/** The probe rows one packet writes into growth_geo_probes. */
export function probeRows(packet: AeoPacket): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = []
  for (const q of packet.queries) {
    for (const pr of q.probes) {
      rows.push({
        product_slug: packet.subject.product_slug ?? packet.subject.slug,
        subject_id: packet.subject.id,
        subject_kind: packet.subject.kind,
        run_id: packet.run_id,
        query_id: q.query_id,
        question: pr.question,
        engine: pr.engine,
        answer_snapshot: pr.answer_snapshot.slice(0, 1800),
        we_cited: pr.we_cited,
        competitors_cited: pr.citations.slice(0, 8),
        touchpoint_id: q.touchpoint_id,
        run_at: packet.generated_at,
        // A verify run's probes never stand in for a research week (brief, section I).
        run_kind: packet.run_kind === 'verify' ? 'verify' : 'research',
        retrieved: pr.retrieved ?? null,
        searched: pr.searched ?? null,
        fan_out: pr.fan_out ?? null,
        our_position: pr.our_position ?? null,
        name_mentioned: pr.name_mentioned ?? null,
        samples: pr.samples ?? null,
      })
    }
  }
  return rows
}

/** The query rows one packet writes into growth_aeo_queries. */
export function queryRows(packet: AeoPacket): Array<Record<string, unknown>> {
  return packet.queries.map(q => ({
    run_id: packet.run_id,
    query_id: q.query_id,
    subject_id: packet.subject.id,
    week_start: packet.week_start,
    query: q.query,
    source: q.source,
    demand_score: q.demand_score,
    demand_basis: q.demand_basis,
    call_evidence: q.call_evidence,
    gap: q.gap,
    trend: q.trend,
    status: q.status,
    touchpoint_id: q.touchpoint_id,
    panel: q.panel ?? null,
    diagnosis: q.diagnosis ?? null,
    outcome: q.outcome ?? null,
  }))
}

/** A row of the cited-pages sheet as stored (growth_aeo_cited_pages), AEO's columns and the outreach status. */
export interface CitedPageRow {
  product_slug: string
  url: string
  host: string
  page_type: string
  questions: number
  engines: string[]
  times_cited: number
  times_first: number
  mention: 'link' | 'name' | 'none' | 'unchecked'
  mention_ok: boolean | null
  checked_at: string | null
  platform: boolean
  own: boolean
  status?: string
}

const MENTIONED = new Set(['link', 'name'])

/**
 * The sheet rows one packet writes (brief, section J), merged with what is
 * stored. AEO owns the measured columns. A page sent as "unchecked" (not read
 * this run) keeps the mention stored for it. A page whose mention appears where
 * it was "none" gets status "mention acquired": set from AEO's reading, never
 * by hand. The outreach columns are never touched here otherwise. Pure.
 */
export function citedPageRows(packet: AeoPacket, stored: ReadonlyArray<Pick<CitedPageRow, 'url' | 'mention' | 'mention_ok' | 'checked_at'>>, runAt = packet.generated_at): Array<CitedPageRow & { last_run_id: string; last_seen_at: string }> {
  const product = packet.subject.product_slug
  if (packet.subject.kind !== 'venture' || !product || !Array.isArray(packet.cited_pages)) return []
  const before = new Map(stored.map(r => [r.url, r]))
  return packet.cited_pages.map(c => {
    const was = before.get(c.url)
    const keep = c.mention === 'unchecked' && was
    const row: CitedPageRow & { last_run_id: string; last_seen_at: string } = {
      product_slug: product, url: c.url, host: c.host, page_type: c.page_type, questions: c.questions,
      engines: [...c.engines], times_cited: c.times_cited, times_first: c.times_first,
      mention: keep ? was.mention : c.mention,
      mention_ok: keep ? was.mention_ok : c.mention_ok,
      checked_at: keep ? was.checked_at : c.checked_at,
      platform: c.platform, own: c.own, last_run_id: packet.run_id, last_seen_at: runAt,
    }
    if (was && was.mention === 'none' && MENTIONED.has(c.mention)) row.status = 'mention acquired'
    return row
  })
}

// ── What the context tells the engine about Krish and each subject ─────────
// AEO-Engine docs/briefs/2026-11-13-aeo-specialist.md, sections B and C.

/**
 * Where Krish himself is cited: a hit on any of these counts as being in the
 * answer for a venture or a prospect read. krishraja.ai, krishraja.com and
 * themindmaker.ai are his (Ruling, Krish, 2026-11-13).
 */
export const KRISH_DOMAINS: readonly string[] = [
  'mindmake.co', 'krishraja.com', 'krishraja.ai', 'themindmaker.ai', 'mindmakerlive.substack.com',
  // His LinkedIn profile is in/krish-raja (krish-raja src/content/site.ts). Until 14 Nov 2026 this said in/krishraja,
  // a path that is not his, so a citation of his profile never counted (audit, AEO lane).
  'home.makeyourmindup.ai', 'makeyourmindup.ai', 'linkedin.com/in/krish-raja',
]

/** Whether a cited URL is one of his: its host is a listed domain (or under one), and when the entry names a path,
 *  the URL's path is that path or below it, on a whole segment (in/krish-raja, never in/krish-rajapaksa). */
export function isKrishsOwn(url: string, domains: readonly string[] = KRISH_DOMAINS): boolean {
  const bare = String(url || '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '')
  const [host = '', ...rest] = bare.split(/[?#]/)[0]!.split('/')
  const path = rest.filter(Boolean).join('/')
  if (!host || NOT_OURS.some(n => host === n || host.endsWith(`.${n}`))) return false
  return domains.some((entry) => {
    const [h = '', ...p] = entry.toLowerCase().split('/')
    const want = p.filter(Boolean).join('/')
    if (host !== h && !host.endsWith(`.${h}`)) return false
    return !want || path === want || path.startsWith(`${want}/`)
  })
}

/**
 * Never ours, whatever a list says (Ruling, Krish, 2026-11-13: fractionl.us is
 * not his). The same list as Control Center's NOT_OURS (src/lib/aiAnswers.ts)
 * and AEO-Engine's config/own-domains.json, so every count agrees.
 */
export const NOT_OURS: readonly string[] = ['fractionl.us']

/**
 * The optional packet fields this ingest accepts (AEO-Engine
 * src/schema/packet.ts, PACKET_FEATURES). The engine sends a field only when it
 * is listed; an empty list would keep every packet exactly the v1 shape. Each is
 * checked by validatePacket against AEO-Engine's schema and stored by the ingest
 * (Control Center migration 20261201092000_aeo_packet_fields.sql).
 */
export const PACKET_FEATURES: readonly string[] = [
  'probe_detail', 'name_mentions', 'samples', 'panel', 'diagnosis', 'kits', 'site', 'run_kind', 'engine_gemini', 'outcome', 'cited_pages',
]

/**
 * Context features that are not packet fields, served in the same
 * `packet_features` list because AEO-Engine reads that one list:
 *
 *   meter_billing  POST /api/aeo/meter reads provider, billing, input_tokens,
 *                  output_tokens and search_calls (AEO brief, section F), so the
 *                  engine posts its subscription and non-Anthropic rows.
 */
export const CONTEXT_FEATURES: readonly string[] = ['meter_billing']

/** A subject's brand-accuracy check (brief, B6): an answer must not say any of must_not and must say every must. */
export interface BrandCheck { question: string; must_not: string[]; must: string[] }

const strings = (v: unknown, max: number, len: number): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim().slice(0, len)).slice(0, max) : []

/** A subject's distinctive names, as stored (growth_aeo_subjects.brand_names): at most 5, never empty strings. */
export function brandNamesOf(v: unknown): string[] {
  return strings(v, 5, 60)
}

/** A subject's brand checks, as stored (growth_aeo_subjects.brand_checks): at most 3, each with a question and a phrase to test. */
export function brandChecksOf(v: unknown): BrandCheck[] {
  if (!Array.isArray(v)) return []
  const out: BrandCheck[] = []
  for (const c of v) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue
    const r = c as Record<string, unknown>
    if (typeof r.question !== 'string' || !r.question.trim()) continue
    const check = { question: r.question.trim().slice(0, 300), must_not: strings(r.must_not, 10, 80), must: strings(r.must, 10, 80) }
    if (check.must_not.length || check.must.length) out.push(check)
    if (out.length === 3) break
  }
  return out
}

/**
 * Where a research week's recommendations go (AEO lane, 14 Nov 2026).
 * - kits: the packet carries at least one win kit, so its moves reach Krish through the venture's engine (Ruling, Krish,
 *   2026-11-13) and nothing is seeded as an idea. An empty list is not kits: until then it routed every
 *   recommendation nowhere.
 * - held: Krish holds this venture's growth engine, so it puts nothing on his list (Ruling, Krish, 2026-10-29). The
 *   recommendations stay on the week's digest, where its engine reads them when he releases it.
 * - unknown: the hold could not be read, so nothing is seeded; the digest keeps them.
 * - ideas: an active venture (or a subject with no venture) with no kits yet: the existing ideas path, with its
 *   governor, cap and dedupe.
 */
export type RecommendationRoute = 'kits' | 'held' | 'unknown' | 'ideas'
export function recommendationRoute(kits: unknown, hold: 'held' | 'active' | 'unknown'): RecommendationRoute {
  if (Array.isArray(kits) && kits.length > 0) return 'kits'
  if (hold === 'held') return 'held'
  if (hold === 'unknown') return 'unknown'
  return 'ideas'
}

/** The products whose venture growth engine Krish holds (growth_engines: role venture, activation_state held). */
export function heldProducts(engines: ReadonlyArray<{ product_slug?: unknown; role?: unknown; activation_state?: unknown }>): Set<string> {
  const held = new Set<string>()
  for (const e of engines) {
    if (e.role === 'venture' && e.activation_state === 'held' && typeof e.product_slug === 'string') held.add(e.product_slug)
  }
  return held
}

/** A page a venture's engine says has shipped for one of its questions, as AEO-Engine reads it (subject.shipped). */
export interface ShippedDeclaration { question?: string; query_id?: string; url: string; shipped_at: string | null; by?: string }

/**
 * One product's shipped pages for the context, newest declaration first, at
 * most 25, one a page; a row with no https URL, or naming neither its question
 * nor its query id, is left out. Pure.
 */
export function shippedFor(rows: ReadonlyArray<Record<string, unknown>>, product: string): ShippedDeclaration[] {
  const out: ShippedDeclaration[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    if (r.product_slug !== product || typeof r.url !== 'string' || !r.url.startsWith('https://') || seen.has(r.url)) continue
    const question = typeof r.question === 'string' && r.question.trim() ? r.question.trim() : undefined
    const query_id = typeof r.query_id === 'string' && r.query_id ? r.query_id : undefined
    if (!question && !query_id) continue
    seen.add(r.url)
    out.push({
      ...(question ? { question } : {}), ...(query_id ? { query_id } : {}), url: r.url,
      shipped_at: typeof r.shipped_at === 'string' ? r.shipped_at : null,
      ...(typeof r.engine_id === 'string' ? { by: r.engine_id } : {}),
    })
    if (out.length === 25) break
  }
  return out
}

/**
 * A venture subject's own hosts: each domain's host, lower case, with no
 * scheme, www or path, and never a not-ours one. The same rule as Control
 * Center's subjectHosts (api/_searchSignals.ts), which keys the search signals
 * by these hosts.
 */
export function subjectHostsOf(domains: unknown): string[] {
  if (!Array.isArray(domains)) return []
  const out = new Set<string>()
  for (const d of domains) {
    if (typeof d !== 'string') continue
    const host = d.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
    if (host && !NOT_OURS.some(n => host === n || host.endsWith(`.${n}`))) out.add(host)
  }
  return [...out]
}

/** One read's state as Control Center recorded it (growth_search_reads): when it last worked, and why the last try failed. */
export interface SearchRead { source: string; part: string; host: string; ok: boolean; last_ok_at: string | null; reason: string | null; note: string | null }

/**
 * What AEO-Engine reads as `subject.search_signals` (its brief, section C;
 * src/schema/context.ts SearchSignals there). A list is null when no read of
 * it has ever worked on one of the subject's hosts: unknown, never zero.
 * `reads` says, per source, part and host, when it last worked and why the
 * last try failed.
 */
export interface SearchSignals {
  gsc_queries: Array<{ query: string; page: string; impressions: number; clicks: number; position: number | null; date_from: string; date_to: string }> | null
  bing: {
    queries: Array<{ query: string; impressions: number | null; clicks: number | null; position: number | null; date_from: string; date_to: string | null }> | null
    pages: Array<{ page: string; impressions: number | null; clicks: number | null; position: number | null; date_from: string; date_to: string | null }> | null
    url_info: Array<{ url: string; indexed: boolean | null; last_crawled: string | null; checked: string }> | null
    crawl_issues: Array<{ url: string; http_code: number | null; issues: unknown; in_links: number | null; checked: string }> | null
    keyword_volume: Array<{ query: string; volume: number; weeks: number; date_from: string; date_to: string }> | null
  } | null
  ai_referrals: Array<{ landing_page: string; source: string | null; sessions: number; date: string; via: 'ga4' | 'clarity' }> | null
  reads: SearchRead[]
}

type SigRow = Record<string, unknown>
const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? Number(v) : v
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}
const s = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/**
 * One subject's search signals from Control Center's rows: the read states,
 * its Search Console rows already summed into weeks (growth_search_gsc_weekly),
 * Bing's weekly query and page rows, Bing's recent index, crawl and keyword
 * rows, and the AI-referral rows. Pure.
 */
export function searchSignalsFor(hosts: readonly string[], input: { reads: readonly SigRow[]; gsc: readonly SigRow[]; bing: readonly SigRow[]; recent: readonly SigRow[]; referrals: readonly SigRow[] }): SearchSignals {
  const mine = new Set(hosts)
  const reads: SearchRead[] = input.reads.filter(r => typeof r.host === 'string' && mine.has(r.host)).map(r => ({
    source: String(r.source), part: String(r.part), host: String(r.host),
    ok: r.reason == null && !!r.last_ok_at, last_ok_at: s(r.last_ok_at), reason: s(r.reason), note: s(r.note),
  }))
  const known = (source: string, part: string) => reads.some(r => r.source === source && r.part === part && !!r.last_ok_at)
  const onMine = (r: SigRow) => typeof r.host === 'string' && mine.has(r.host)

  const gsc_queries = known('gsc', 'search_analytics')
    ? input.gsc.filter(onMine).flatMap(r => {
      const query = s(r.query), page = s(r.page), from = s(r.date_from), to = s(r.date_to)
      const impressions = n(r.impressions), clicks = n(r.clicks)
      return query && page && from && to && impressions != null && clicks != null
        ? [{ query, page, impressions, clicks, position: n(r.avg_position), date_from: from, date_to: to }] : []
    })
    : null

  const bingParts = ['queries', 'pages', 'url_info', 'crawl_issues', 'keywords'] as const
  let bing: SearchSignals['bing'] = null
  if (bingParts.some(p => known('bing', p))) {
    const weekly = input.bing.filter(onMine)
    const recent = input.recent.filter(onMine)
    const urlInfo = new Map<string, { url: string; indexed: boolean | null; last_crawled: string | null; checked: string }>()
    for (const r of recent) {
      const url = s(r.page), day = s(r.day)
      if (r.kind !== 'url_info' || !url || !day) continue
      const had = urlInfo.get(url)
      if (!had || had.checked < day) urlInfo.set(url, { url, indexed: typeof r.indexed === 'boolean' ? r.indexed : null, last_crawled: s(r.last_crawled), checked: day })
    }
    const newestCrawl = new Map<string, string>()
    for (const r of recent) if (r.kind === 'crawl_issue' && typeof r.day === 'string' && (newestCrawl.get(String(r.host)) ?? '') < r.day) newestCrawl.set(String(r.host), r.day)
    const keywords = new Map<string, Array<{ day: string; to: string; volume: number }>>()
    for (const r of recent) {
      const q = s(r.query), day = s(r.day), volume = n(r.volume)
      if (r.kind !== 'keyword' || !q || !day || volume == null) continue
      const list = keywords.get(q) ?? []
      if (!list.some(w => w.day === day)) list.push({ day, to: s(r.day_to) ?? day, volume })
      keywords.set(q, list)
    }
    bing = {
      queries: known('bing', 'queries') ? weekly.filter(r => r.kind === 'query' && s(r.query) && s(r.day)).map(r => ({
        query: String(r.query), impressions: n(r.impressions), clicks: n(r.clicks), position: n(r.position), date_from: String(r.day), date_to: s(r.day_to),
      })) : null,
      pages: known('bing', 'pages') ? weekly.filter(r => r.kind === 'page' && s(r.page) && s(r.day)).map(r => ({
        page: String(r.page), impressions: n(r.impressions), clicks: n(r.clicks), position: n(r.position), date_from: String(r.day), date_to: s(r.day_to),
      })) : null,
      url_info: known('bing', 'url_info') ? [...urlInfo.values()] : null,
      crawl_issues: known('bing', 'crawl_issues') ? recent.filter(r => r.kind === 'crawl_issue' && s(r.page) && r.day === newestCrawl.get(String(r.host))).map(r => {
        const d = r.detail && typeof r.detail === 'object' ? r.detail as SigRow : {}
        return { url: String(r.page), http_code: n(d.http_code), issues: d.issues ?? null, in_links: n(d.in_links), checked: String(r.day) }
      }) : null,
      keyword_volume: known('bing', 'keywords') ? [...keywords.entries()].map(([query, weeks]) => {
        const newest = weeks.sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 4)
        return { query, volume: newest.reduce((t, w) => t + w.volume, 0), weeks: newest.length, date_from: newest[newest.length - 1].day, date_to: newest[0].to }
      }) : null,
    }
  }

  const ai_referrals = known('ga4', 'ai_referrals') || known('clarity', 'ai_referrals')
    ? input.referrals.filter(onMine).flatMap(r => {
      const page = s(r.page), day = s(r.day), sessions = n(r.sessions)
      const via: 'ga4' | 'clarity' | null = r.source === 'ga4' ? 'ga4' : r.source === 'clarity' ? 'clarity' : null
      return page && day && sessions != null && via ? [{ landing_page: page, source: s(r.ai_source), sessions, date: day, via }] : []
    })
    : null

  return { gsc_queries, bing, ai_referrals, reads }
}
