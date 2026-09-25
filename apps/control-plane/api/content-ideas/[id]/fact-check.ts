// POST /api/content-ideas/:id/fact-check   run the fact gate on the current body
// GET  /api/content-ideas/:id/fact-check   the last result, and whether it
//                                          still applies to the current body
//
// The gate itself, and why it exists, is in api/_factGate.ts. The PATCH that
// moves a piece to review, approved or published refuses until this has passed
// on the exact body being moved.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import { callClaude, pathId, readMaterials, robustJson } from '../../_content.js'
import { guardEngine } from '../../_auth.js'
import { webResearch } from '../../_enrich.js'
import { UTILITY_MODEL } from '../../_models.js'
import {
  combine, ENTAIL_SYSTEM, EXTRACT_SYSTEM, gateStatus, INDEPENDENT_SYSTEM, norm, ON_FILE_SYSTEM, quotesFail,
  resolveLeftovers, SECOND_LOOK_SYSTEM, sectionOf, SOURCE_MARK, summarise, sweep,
  type CheckedClaim, type Claim, type ClaimKind, type IndependentVerdict, type OnFileVerdict,
} from '../../_factGate.js'

const MAX_CLAIMS = 60
const POOL = 6
// Perplexity answered 429 to six of 26 claims at six at a time (piece 2,
// first run). Its calls go through their own narrower gate, with retries.
const PERPLEXITY_POOL = 3
const RETRY_WAITS_MS = [2000, 5000, 10000, 20000]
const KINDS = new Set(['number', 'date', 'quote', 'attribution', 'event', 'name', 'other'])

/** Everything the piece was written from, as plain text the quotes must come
 *  from. Each source starts with SOURCE_MARK. A verbatim excerpt is headed by
 *  its URL alone: its title is the filer's words, and a date in it must not
 *  pass for the source's. */
export function sourcesText(meta: Record<string, any>): string {
  const parts: string[] = []
  for (const m of readMaterials(meta)) {
    const body = m.kind === 'link' ? (m.url || '') : (m.content || '')
    if (body.trim()) parts.push(`${SOURCE_MARK}${m.verbatim && m.url ? `verbatim excerpt from ${m.url}` : (m.title || m.kind)}\n${body}`)
  }
  const stories = Array.isArray(meta.adjacent_stories) ? meta.adjacent_stories : []
  for (const s of stories) parts.push(`${SOURCE_MARK}${s?.title || 'source'} (${s?.published_date_iso || 'undated'}) ${s?.url || ''}\n${s?.why_relevant || ''}\n${s?.summary || ''}`)
  const research = meta.research
  if (Array.isArray(research)) for (const r of research) parts.push(`${SOURCE_MARK}research\n${typeof r === 'string' ? r : `${r?.title || ''} ${r?.url || ''}\n${r?.summary || r?.text || ''}`}`)
  else if (typeof research === 'string') parts.push(`${SOURCE_MARK}research\n${research}`)
  const dives = Array.isArray(meta.deep_dives) ? meta.deep_dives : []
  for (const d of dives) parts.push(`${SOURCE_MARK}deep dive\n${typeof d === 'string' ? d : `${d?.question || ''}\n${d?.findings || d?.answer || ''}\n${Array.isArray(d?.sources) ? d.sources.join('\n') : ''}`}`)
  return parts.filter(p => p && p.trim()).join('\n\n').slice(0, 120_000)
}

/** Only the verbatim excerpts: the sources' own words, not anyone's summary. */
export function primaryText(meta: Record<string, any>): string {
  return readMaterials(meta).filter(m => m.verbatim === true && m.content)
    .map(m => `${SOURCE_MARK}verbatim excerpt from ${m.url}\n${m.content}`).join('\n\n')
}

async function extract(body: string): Promise<{ claims: Claim[]; setAside: Array<{ sentence: string; reason: string }> }> {
  const raw = await callClaude({
    agent: 'fact-gate-extract', model: UTILITY_MODEL, system: EXTRACT_SYSTEM, user: body,
    maxTokens: 8000, temperature: 0, timeoutMs: 90_000,
  })
  const j = robustJson(raw) || {}
  const claims: Claim[] = (Array.isArray(j.claims) ? j.claims : [])
    .filter((c: any) => typeof c?.sentence === 'string' && typeof c?.claim === 'string')
    .map((c: any) => ({ sentence: c.sentence.trim(), claim: c.claim.trim(), kind: (KINDS.has(c.kind) ? c.kind : 'other') as ClaimKind }))
  const setAside = (Array.isArray(j.set_aside) ? j.set_aside : [])
    .filter((a: any) => typeof a?.sentence === 'string')
    .map((a: any) => ({ sentence: a.sentence.trim(), reason: String(a.reason || '').slice(0, 60) }))
  return { claims, setAside }
}

async function onFile(c: Claim, sources: string, primary: string): Promise<CheckedClaim['on_file']> {
  if (!sources.trim()) return { verdict: 'not_found', quote: null, note: 'no sources on file' }
  try {
    const raw = await callClaude({
      agent: 'fact-gate-on-file', model: UTILITY_MODEL,
      systemStable: `SOURCES ON FILE:\n\n${sources}`, cache: true,
      system: ON_FILE_SYSTEM,
      user: JSON.stringify({ claim: c.claim, as_written: c.sentence }),
      maxTokens: 900, temperature: 0, timeoutMs: 60_000,
    })
    const j = robustJson(raw) || {}
    const quotes: string[] = (Array.isArray(j.quotes) ? j.quotes : [j.quote])
      .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0)
      .map((q: string) => q.trim()).slice(0, 3)
    const quote = quotes.length ? quotes.join(' | ') : null
    const note = typeof j.note === 'string' ? j.note.slice(0, 300) : null
    let verdict: OnFileVerdict = j.verdict === 'supported' || j.verdict === 'contradicted' ? j.verdict : 'not_found'
    // The model cannot vouch; the text must. A "supported" whose passages are
    // not in the sources, or do not carry the claim's numbers, is not found.
    if (verdict === 'supported') {
      const why = quotesFail(quotes, sources, c.claim)
      if (why) return { verdict: 'not_found', quote, note: `${why}${note ? `; model said: ${note}` : ''}` }
      return { verdict, quote, note, primary: !!primary && quotesFail(quotes, primary, c.claim) === null }
    }
    // A contradiction must be real text, and the text must really conflict:
    // one run called "broke on launch day" contradicted by Altman saying
    // "yesterday" the day after launch.
    if (verdict === 'contradicted') {
      const real = quotes.length && quotes.every(q => norm(sources).includes(norm(q)))
      if (!real || (await entailment(c, quotes.join(' | '), null)) !== 'conflicts') {
        return { verdict: 'not_found', quote, note: `a contradiction the passage does not bear out${note ? `; model said: ${note}` : ''}` }
      }
    }
    return { verdict, quote, note }
  } catch (e) {
    return { verdict: 'not_found', quote: null, note: `check failed: ${(e as Error).message.slice(0, 120)}` }
  }
}

let perplexityActive = 0
const perplexityQueue: Array<() => void> = []
async function withPerplexitySlot<T>(fn: () => Promise<T>): Promise<T> {
  if (perplexityActive >= PERPLEXITY_POOL) await new Promise<void>(resolve => perplexityQueue.push(resolve))
  perplexityActive++
  try { return await fn() } finally { perplexityActive--; perplexityQueue.shift()?.() }
}

async function perplexityCheck(key: string, c: Claim, asOf: string): Promise<CheckedClaim['independent']> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withPerplexitySlot(() => perplexityOnce(key, c, asOf))
    } catch (e) {
      const wait = RETRY_WAITS_MS[attempt]
      if (!/perplexity_(429|5\d\d)/.test((e as Error).message) || wait === undefined) throw e
      await new Promise(resolve => setTimeout(resolve, wait + Math.floor(Math.random() * 500)))
    }
  }
}

async function perplexityOnce(key: string, c: Claim, asOf: string): Promise<CheckedClaim['independent']> {
  const r = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar-pro', temperature: 0, max_tokens: 700,
      messages: [
        { role: 'system', content: INDEPENDENT_SYSTEM },
        { role: 'user', content: `Written on ${asOf}. Claim: ${c.claim}\nAs it appears in the piece: ${c.sentence}` },
      ],
    }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`perplexity_${r.status}`)
  const out = robustJson(j?.choices?.[0]?.message?.content || '') || {}
  const citations: string[] = Array.isArray(j?.citations) ? j.citations : []
  const verdict: IndependentVerdict = out.verdict === 'supported' || out.verdict === 'contradicted' ? out.verdict : 'unclear'
  return {
    verdict, checker: 'perplexity:sonar-pro',
    evidence: typeof out.evidence === 'string' ? out.evidence.slice(0, 500) : null,
    url: typeof out.url === 'string' && out.url ? out.url : (citations[0] || null),
    correct_value: typeof out.correct_value === 'string' && out.correct_value ? out.correct_value.slice(0, 300) : null,
  }
}

/** Without Perplexity: search results from Exa or Brave, judged by a model
 *  that must quote them. Null when no search provider is configured. */
async function searchCheck(c: Claim, asOf: string): Promise<CheckedClaim['independent'] | null> {
  const found = await webResearch(c.claim).catch(() => ({ text: '', sources: [] as string[] }))
  if (!found.text || found.text.trim().length < 80) return null
  const raw = await callClaude({
    agent: 'fact-gate-search', model: UTILITY_MODEL,
    system: `${INDEPENDENT_SYSTEM}\nUse ONLY these search results, which were fetched for this claim:\n\n${found.text.slice(0, 12000)}\n\nSource URLs: ${found.sources.join(' ')}`,
    user: `Written on ${asOf}. Claim: ${c.claim}`,
    maxTokens: 700, temperature: 0, timeoutMs: 60_000,
  })
  const out = robustJson(raw) || {}
  let verdict: IndependentVerdict = out.verdict === 'supported' || out.verdict === 'contradicted' ? out.verdict : 'unclear'
  const evidence = typeof out.evidence === 'string' ? out.evidence : null
  if (verdict !== 'unclear' && !(evidence && found.text.toLowerCase().includes(evidence.toLowerCase().slice(0, 60)))) verdict = 'unclear'
  return { verdict, checker: 'search+judge', evidence, url: typeof out.url === 'string' ? out.url : (found.sources[0] || null), correct_value: typeof out.correct_value === 'string' ? out.correct_value : null }
}

async function independent(c: Claim, asOf: string): Promise<CheckedClaim['independent']> {
  const key = process.env.PERPLEXITY_API_KEY
  try {
    if (key) return await perplexityCheck(key, c, asOf)
    const s = await searchCheck(c, asOf)
    if (s) return s
  } catch (e) {
    return { verdict: 'unclear', checker: key ? 'perplexity:sonar-pro' : 'search+judge', evidence: `check failed: ${(e as Error).message.slice(0, 120)}`, url: null, correct_value: null }
  }
  return { verdict: 'unavailable', checker: null, evidence: null, url: null, correct_value: null }
}

/** A web checker's verdict counts only when its own quoted evidence bears it
 *  out, read by a second model. Perplexity "supported" two claims on piece 2
 *  with a quote about something else, and "contradicted" two with a source
 *  that only said less. */
async function entailment(c: Claim, evidence: string, url: string | null): Promise<string> {
  try {
    const raw = await callClaude({
      agent: 'fact-gate-entail', model: UTILITY_MODEL, system: ENTAIL_SYSTEM,
      user: JSON.stringify({ claim: c.claim, as_written: c.sentence, evidence, source: url }),
      maxTokens: 300, temperature: 0, timeoutMs: 45_000,
    })
    return String((robustJson(raw) || {}).answer || '')
  } catch {
    return ''
  }
}

async function entail(c: Claim, ind: CheckedClaim['independent']): Promise<CheckedClaim['independent']> {
  if (ind.verdict !== 'supported' && ind.verdict !== 'contradicted') return ind
  // Only the source's quoted words count. The checker's own reading of them
  // (correct_value) is shown to Krish, never used as evidence.
  if (!ind.evidence || ind.evidence.trim().length < 12) return { ...ind, verdict: 'unclear', evidence: `${ind.evidence || ''} [no usable quote from the source]`.trim() }
  const a = await entailment(c, ind.evidence, ind.url)
  const holds = ind.verdict === 'supported' ? a === 'states' : a === 'conflicts'
  return holds ? ind : { ...ind, verdict: 'unclear', evidence: `${ind.evidence} [${ind.verdict} not borne out by the quoted evidence]` }
}

/** The sweep's leftovers get one more reading before they block, twelve
 *  sentences a call: the whole piece in one call came back empty, and an
 *  empty answer fails closed. */
async function secondLook(leftovers: Claim[], body: string): Promise<Array<{ i: number; claims: Array<{ claim: string; kind: string }>; reason: string }>> {
  const batches: number[][] = []
  for (let k = 0; k < leftovers.length; k += 12) batches.push(leftovers.slice(k, k + 12).map((_, j) => k + j))
  const answers = await pool(batches, 4, async (ids) => {
    try {
      const raw = await callClaude({
        agent: 'fact-gate-second-look', model: UTILITY_MODEL, system: SECOND_LOOK_SYSTEM,
        user: JSON.stringify(ids.map(i => ({ i, section: sectionOf(body, leftovers[i].sentence), sentence: leftovers[i].sentence }))),
        maxTokens: 3000, temperature: 0, timeoutMs: 90_000,
      })
      const j = robustJson(raw) || {}
      return (Array.isArray(j.answers) ? j.answers : [])
        .filter((a: any) => Number.isInteger(a?.i) && ids.includes(a.i))
        .map((a: any) => ({ i: a.i as number, claims: Array.isArray(a.claims) ? a.claims : [], reason: String(a.reason || '') }))
    } catch {
      return []
    }
  })
  return answers.flat()
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  const id = pathId(req)
  if (!id) return res.status(400).json({ ok: false, error: 'id required' })

  const { data: row, error } = await supabase.from('content_ideas').select('id,body,meta').eq('id', id).single()
  if (error || !row) return res.status(404).json({ ok: false, error: 'idea not found' })
  const meta = (row.meta || {}) as Record<string, any>
  const body = String(row.body || '')

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, fact_check: meta.fact_check || null, gate: gateStatus(meta, body) })
  }

  if (body.trim().length < 200) return res.status(409).json({ ok: false, error: 'There is no draft to check yet.' })

  const asOf = new Date().toISOString().slice(0, 10)
  const listed = await extract(body)
  const swept = sweep(body, listed.claims, listed.setAside)
  // The lister's set-asides are read again too. It once set aside Scott Wu's
  // "Each one, no matter how expensive, will tell you it was Thomas Jefferson"
  // as inference, because of "will". Waving a sentence through now takes two
  // readings that agree.
  const leftovers = [
    ...swept.claims.filter(c => c.kind === 'unclassified'),
    ...swept.setAside.map(a => ({ sentence: a.sentence, claim: a.sentence, kind: 'unclassified' as ClaimKind })),
  ]
  const looked = resolveLeftovers(leftovers, await secondLook(leftovers, body))
  const all = [...swept.claims.filter(c => c.kind !== 'unclassified'), ...looked.claims]
  const claims = all.slice(0, MAX_CLAIMS)
  const sources = sourcesText(meta)
  const primary = primaryText(meta)

  const checked = await pool(claims, POOL, async (c): Promise<CheckedClaim> => {
    const [f, raw] = await Promise.all([onFile(c, sources, primary), independent(c, asOf)])
    const ind = await entail(c, raw)
    return { ...c, on_file: f, independent: ind, verdict: combine(f.verdict, ind.verdict, f.primary === true) }
  })
  const checker = checked.find(c => c.independent.checker)?.independent.checker || null
  const result = summarise(checked, looked.setAside, body, checker)
  if (all.length > MAX_CLAIMS) { result.passed = false; result.blocking += all.length - MAX_CLAIMS }

  // A run takes minutes. Merge into the meta as it is NOW, so a material or a
  // ladder result saved meanwhile survives. If the body moved on, the stored
  // hash already says this check was of an older body, and the gate refuses.
  const fresh = await supabase.from('content_ideas').select('meta').eq('id', id).single()
  const nowMeta = (fresh.data?.meta || meta) as Record<string, any>
  const { error: upErr } = await supabase.from('content_ideas')
    .update({ meta: { ...nowMeta, fact_check: result } })
    .eq('id', id)
  if (upErr) return res.status(500).json({ ok: false, error: upErr.message })

  return res.status(200).json({
    ok: true, passed: result.passed, blocking: result.blocking, single_source: result.single_source,
    independent_checker: result.independent_checker, claims: result.claims.length, set_aside: result.set_aside.length,
    fact_check: result,
  })
}
