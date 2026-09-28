// POST /api/content-ideas/:id/fact-check   run the fact gate on the current body
// GET  /api/content-ideas/:id/fact-check   the last result, and whether it
//                                          still applies to the current body
//
// The gate itself, and why it exists, is in api/_factGate.ts. The PATCH that
// moves a piece to review, approved or published refuses until this has passed
// on the exact body being moved.
//
// A run whose model calls fail part-way is a failed run: it answers with the
// typed body revise uses (ModelErrorBody in api/_stream.ts, `error:
// 'model_unavailable'`, status 503, 429 or 502), writes nothing, and the piece
// keeps its last real result. docs/CONTENT_ENGINE.md has the shape.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import { callClaude, pathId, readMaterials, robustJson, type ClaudeOpts } from '../../_content.js'
import { guardEngine } from '../../_auth.js'
import { webResearch } from '../../_enrich.js'
import {
  classifyAnthropicFailure, isModelUnavailable, ModelUnavailableError, recordAnthropicFailure, refusesEveryCall, type ProviderFailure,
} from '../../_modelProvider.js'
import { publishChecks, publishStatus } from '../../_publishChecks.js'
import { receipts } from '../../_receipts.js'
import { failureAnswer } from '../../_stream.js'
import { UTILITY_MODEL } from '../../_models.js'
import {
  combine, ENTAIL_SYSTEM, EXTRACT_SYSTEM, gateStatus, INDEPENDENT_SYSTEM, isConfidenceLine, leftoversOf, norm, ON_FILE_SYSTEM, primaryText, quotesFail,
  resolveLeftovers, SECOND_LOOK_SYSTEM, sectionOf, sourcesText, summarise, sweep,
  type CheckedClaim, type Claim, type ClaimKind, type FactCheck, type IndependentVerdict, type OnFileVerdict,
} from '../../_factGate.js'

const MAX_CLAIMS = 60
const POOL = 6
// Perplexity answered 429 to six of 26 claims at six at a time (piece 2,
// first run). Its calls go through their own narrower gate, with retries.
const PERPLEXITY_POOL = 3
const RETRY_WAITS_MS = [2000, 5000, 10000, 20000]
const KINDS = new Set(['number', 'date', 'quote', 'attribution', 'event', 'name', 'other'])

// sourcesText and primaryText live in api/_factGate.ts, where they are tested
// without a database.

/** One run of the gate, and the model call that ended it, if one did.
 *
 *  A model call that gets no answer says nothing about the claim it was for.
 *  Until 2026-09-28 each helper below caught its own failures: a refused
 *  on-file check became "not found", a refused entailment "not borne out by
 *  the quoted evidence", a refused second look left its sentences to fail as
 *  claims, and a refused extract was a 500. So when the provider failed
 *  part-way, every claim the run had not reached was recorded as failing, for
 *  a reason that was wrong, over the piece's last real result (walk log F39).
 *
 *  Now every model call of a run goes through `claude`. The first failure
 *  ends the run: no new call or claim starts, the ones already running finish,
 *  and the handler answers with the provider's failure and writes nothing. A
 *  claim that was checked keeps its verdict exactly as before. Perplexity, Exa
 *  and Brave are other providers: their failures still leave a claim unclear. */
class GateRun {
  failure: ProviderFailure | null = null

  /** Throws once the run has ended, so a call queued behind it never goes out. */
  going(): void {
    if (this.failure) throw new ModelUnavailableError(this.failure, 'fact_check')
  }

  async claude(opts: ClaudeOpts): Promise<string> {
    this.going()
    try {
      return await callClaude(opts)
    } catch (e) {
      // Everything callClaude throws is a call that got no answer: a refusal,
      // a timeout, a provider it could not reach, or no key. It has already
      // metered and recorded the failure (api/_meter.ts).
      const f: ProviderFailure = { ...classifyAnthropicFailure(e), agent: opts.agent ?? null, model: opts.model ?? null }
      // Reported by the worst: a refusal of every call outranks a timeout.
      if (!this.failure || (refusesEveryCall(f.class) && !refusesEveryCall(this.failure.class))) this.failure = f
      throw new ModelUnavailableError(f, 'fact_check')
    }
  }
}

async function extract(run: GateRun, body: string): Promise<{ claims: Claim[]; setAside: Array<{ sentence: string; reason: string }> }> {
  const raw = await run.claude({
    agent: 'fact-gate-extract', model: UTILITY_MODEL, system: EXTRACT_SYSTEM, user: body,
    maxTokens: 8000, temperature: 0, timeoutMs: 90_000,
  })
  const j = robustJson(raw) || {}
  const listed: Claim[] = (Array.isArray(j.claims) ? j.claims : [])
    .filter((c: any) => typeof c?.sentence === 'string' && typeof c?.claim === 'string')
    .map((c: any) => ({ sentence: c.sentence.trim(), claim: c.claim.trim(), kind: (KINDS.has(c.kind) ? c.kind : 'other') as ClaimKind }))
  // Krish's confidence is his judgement, never a claim, whatever the model says.
  const claims = listed.filter(c => !isConfidenceLine(c.sentence))
  const setAside = (Array.isArray(j.set_aside) ? j.set_aside : [])
    .filter((a: any) => typeof a?.sentence === 'string')
    .map((a: any) => ({ sentence: a.sentence.trim(), reason: String(a.reason || '').slice(0, 60) }))
  for (const c of listed) if (isConfidenceLine(c.sentence) && !setAside.some(a => a.sentence === c.sentence)) setAside.push({ sentence: c.sentence, reason: 'prediction' })
  return { claims, setAside }
}

async function onFile(run: GateRun, c: Claim, sources: string, primary: string): Promise<CheckedClaim['on_file']> {
  if (!sources.trim()) return { verdict: 'not_found', quote: null, note: 'no sources on file' }
  try {
    const raw = await run.claude({
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
      if (!real || (await entailment(run, c, quotes.join(' | '), null)) !== 'conflicts') {
        return { verdict: 'not_found', quote, note: `a contradiction the passage does not bear out${note ? `; model said: ${note}` : ''}` }
      }
    }
    return { verdict, quote, note }
  } catch (e) {
    // The provider's failure ends the run; it is no finding about the claim.
    if (isModelUnavailable(e)) throw e
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

async function perplexityCheck(run: GateRun, key: string, c: Claim, asOf: string): Promise<CheckedClaim['independent']> {
  for (let attempt = 0; ; attempt++) {
    try {
      // A call that waited for a slot or a retry after the run ended is not sent.
      return await withPerplexitySlot(() => { run.going(); return perplexityOnce(key, c, asOf) })
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
async function searchCheck(run: GateRun, c: Claim, asOf: string): Promise<CheckedClaim['independent'] | null> {
  const found = await webResearch(c.claim).catch(() => ({ text: '', sources: [] as string[] }))
  if (!found.text || found.text.trim().length < 80) return null
  const raw = await run.claude({
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

async function independent(run: GateRun, c: Claim, asOf: string): Promise<CheckedClaim['independent']> {
  const key = process.env.PERPLEXITY_API_KEY
  try {
    if (key) return await perplexityCheck(run, key, c, asOf)
    const s = await searchCheck(run, c, asOf)
    if (s) return s
  } catch (e) {
    if (isModelUnavailable(e)) throw e
    return { verdict: 'unclear', checker: key ? 'perplexity:sonar-pro' : 'search+judge', evidence: `check failed: ${(e as Error).message.slice(0, 120)}`, url: null, correct_value: null }
  }
  return { verdict: 'unavailable', checker: null, evidence: null, url: null, correct_value: null }
}

/** A web checker's verdict counts only when its own quoted evidence bears it
 *  out, read by a second model. Perplexity "supported" two claims on piece 2
 *  with a quote about something else, and "contradicted" two with a source
 *  that only said less. */
async function entailment(run: GateRun, c: Claim, evidence: string, url: string | null): Promise<string> {
  try {
    const raw = await run.claude({
      agent: 'fact-gate-entail', model: UTILITY_MODEL, system: ENTAIL_SYSTEM,
      user: JSON.stringify({ claim: c.claim, as_written: c.sentence, evidence, source: url }),
      maxTokens: 300, temperature: 0, timeoutMs: 45_000,
    })
    return String((robustJson(raw) || {}).answer || '')
  } catch (e) {
    if (isModelUnavailable(e)) throw e
    return ''
  }
}

async function entail(run: GateRun, c: Claim, ind: CheckedClaim['independent']): Promise<CheckedClaim['independent']> {
  if (ind.verdict !== 'supported' && ind.verdict !== 'contradicted') return ind
  // Only the source's quoted words count. The checker's own reading of them
  // (correct_value) is shown to Krish, never used as evidence.
  if (!ind.evidence || ind.evidence.trim().length < 12) return { ...ind, verdict: 'unclear', evidence: `${ind.evidence || ''} [no usable quote from the source]`.trim() }
  const a = await entailment(run, c, ind.evidence, ind.url)
  const holds = ind.verdict === 'supported' ? a === 'states' : a === 'conflicts'
  return holds ? ind : { ...ind, verdict: 'unclear', evidence: `${ind.evidence} [${ind.verdict} not borne out by the quoted evidence]` }
}

/** The sweep's leftovers get one more reading before they block, twelve
 *  sentences a call, numbered from 0 within the call: a model answering the
 *  fourth batch of a piece renumbers from 0, and its answers were dropped. A
 *  sentence left unanswered is asked once more on its own. Unanswered after
 *  that, it stays a claim (fails closed), and the count is recorded. A call
 *  the provider refused ends the run instead. */
async function secondLook(run: GateRun, leftovers: Claim[], body: string): Promise<{ answers: Array<{ i: number; claims: Array<{ claim: string; kind: string }>; reason: string }>; unanswered: number }> {
  const ask = async (ids: number[]) => {
    try {
      const raw = await run.claude({
        agent: 'fact-gate-second-look', model: UTILITY_MODEL, system: SECOND_LOOK_SYSTEM,
        user: JSON.stringify(ids.map((id, i) => ({ i, section: sectionOf(body, leftovers[id].sentence), sentence: leftovers[id].sentence }))),
        maxTokens: 3000, temperature: 0, timeoutMs: 90_000,
      })
      const j = robustJson(raw) || {}
      return (Array.isArray(j.answers) ? j.answers : [])
        .filter((a: any) => Number.isInteger(a?.i) && a.i >= 0 && a.i < ids.length)
        .map((a: any) => ({ i: ids[a.i], claims: Array.isArray(a.claims) ? a.claims : [], reason: String(a.reason || '') }))
    } catch (e) {
      if (isModelUnavailable(e)) throw e
      return [] as Array<{ i: number; claims: Array<{ claim: string; kind: string }>; reason: string }>
    }
  }
  const batches: number[][] = []
  for (let k = 0; k < leftovers.length; k += 12) batches.push(leftovers.slice(k, k + 12).map((_, j) => k + j))
  const answers = (await pool(batches, 4, ask)).flat()
  const missing = leftovers.map((_, i) => i).filter(i => !answers.some(a => a.i === i))
  const retried = (await pool(missing, 6, id => ask([id]))).flat()
  const all = [...answers, ...retried]
  return { answers: all, unanswered: leftovers.filter((_, i) => !all.some(a => a.i === i)).length }
}

/** `fn` over `items`, `n` at a time. After the first failure no new item
 *  starts; those already running finish, and the failure is thrown. */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  const failures: unknown[] = []
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (failures.length === 0 && i < items.length) {
      const k = i++
      try { out[k] = await fn(items[k]) } catch (e) { failures.push(e) }
    }
  }))
  if (failures.length) throw failures[0]
  return out
}

/** Every step of a run, up to the result it would store. Throws
 *  ModelUnavailableError when a model call fails. */
async function check(run: GateRun, body: string, meta: Record<string, any>): Promise<FactCheck> {
  const asOf = new Date().toISOString().slice(0, 10)
  const listed = await extract(run, body)
  const swept = sweep(body, listed.claims, listed.setAside)
  // The lister's set-asides are read again too. It once set aside Scott Wu's
  // "Each one, no matter how expensive, will tell you it was Thomas Jefferson"
  // as inference, because of "will". Waving a sentence through now takes two
  // readings that agree.
  const leftovers = leftoversOf(swept)
  const second = await secondLook(run, leftovers, body)
  const looked = resolveLeftovers(leftovers, second.answers)
  const all = [...swept.claims.filter(c => c.kind !== 'unclassified'), ...looked.claims]
  const claims = all.slice(0, MAX_CLAIMS)
  const sources = sourcesText(meta)
  const primary = primaryText(meta)

  const checked = await pool(claims, POOL, async (c): Promise<CheckedClaim> => {
    // Both checks settle before the claim is done, so a failure in one never
    // leaves the other running after the run has ended.
    const [onFileCheck, webCheck] = await Promise.allSettled([onFile(run, c, sources, primary), independent(run, c, asOf)])
    if (onFileCheck.status === 'rejected') throw onFileCheck.reason
    if (webCheck.status === 'rejected') throw webCheck.reason
    const f = onFileCheck.value
    const ind = await entail(run, c, webCheck.value)
    return { ...c, on_file: f, independent: ind, verdict: combine(f.verdict, ind.verdict, f.primary === true) }
  })
  const checker = checked.find(c => c.independent.checker)?.independent.checker || null
  const result = summarise(checked, looked.setAside, body, checker)
  result.second_look = { sentences: leftovers.length, unanswered: second.unanswered }
  if (all.length > MAX_CLAIMS) { result.passed = false; result.blocking += all.length - MAX_CLAIMS }
  return result
}

/** A run the provider stopped: revise's typed answer, and nothing written. */
async function stopped(res: VercelResponse, f: ProviderFailure) {
  // callClaude's meter has recorded a failure that reached the provider; this
  // records one that never did (no key), and is a no-op for a repeat.
  await recordAnthropicFailure(f)
  const answer = failureAnswer('model_unavailable', 'The fact check stopped before it had checked every claim, so nothing was recorded and the piece keeps its last result.', f)
  if (answer.retryAfterSeconds) res.setHeader('Retry-After', String(answer.retryAfterSeconds))
  return res.status(answer.status).json(answer.body)
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
    const gate = gateStatus(meta, body)
    // The whole pre-publish checklist rides along, so Control Center can show
    // Krish every house rule this exact version passes or fails in one place.
    const checks = publishChecks(body, gate)
    // Receipts: the source's own words behind each checked claim, for a Short,
    // a carousel or a web edition to show on screen (api/_receipts.ts). Only
    // for the exact version that passed.
    const proof = gate.ok ? receipts(meta.fact_check, readMaterials(meta)) : []
    return res.status(200).json({ ok: true, fact_check: meta.fact_check || null, gate, checks, ready: publishStatus(checks).ok, receipts: proof })
  }

  if (body.trim().length < 200) return res.status(409).json({ ok: false, error: 'There is no draft to check yet.' })

  const run = new GateRun()
  let result: FactCheck
  try {
    result = await check(run, body, meta)
  } catch (e) {
    if (!isModelUnavailable(e)) throw e
    return stopped(res, run.failure ?? e.failure)
  }
  // Whatever a helper did with it, a failed call means this result does not
  // cover every claim, so it is never stored.
  if (run.failure) return stopped(res, run.failure)

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
