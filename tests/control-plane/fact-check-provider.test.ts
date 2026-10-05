import { beforeEach, describe, expect, it, vi } from 'vitest'

// A provider failure in the middle of a fact check is a failed run (walk log
// F39).
//
// Each model call of the gate used to catch its own failure: a refused on-file
// check was recorded as "not found", a refused entailment as "not borne out by
// the quoted evidence", a refused second look left its sentences to fail as
// claims, and a refused extract was a 500. So a usage limit reached part-way
// through recorded every claim the run never checked as failing, for a wrong
// reason, over the piece's last real result, and cost a fact-gate run. Now the
// run answers with revise's typed body and writes nothing. A claim that was
// checked keeps its verdict exactly as before, and a failure of the web
// checker (a different provider) still leaves a claim unclear.

// A dead local address before anything loads, so nothing here can reach a
// real database; the database client below is a mock besides.
vi.hoisted(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})

const db = vi.hoisted(() => ({
  row: null as null | { id: string; body: string; meta: Record<string, any> },
  updates: [] as Array<{ table: string; values: any }>,
  upserts: [] as Array<{ table: string; values: any }>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    rpc: async () => ({ error: null }),
    from(table: string) {
      const chain: Record<string, any> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) chain[m] = () => chain
      chain.single = async () => ({ data: table === 'content_ideas' ? db.row : null, error: null })
      chain.maybeSingle = chain.single
      chain.update = (values: unknown) => { db.updates.push({ table, values }); return chain }
      chain.insert = async () => ({ error: null })
      chain.upsert = async (values: unknown) => { db.upserts.push({ table, values }); return { error: null } }
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
      return chain
    },
  },
}))

const TOKEN = 'eot_' + 'f'.repeat(40)
const ID = '00000000-0000-4000-8000-00000000fc01'
const LIMIT = 'You have reached your specified API usage limits. You will regain access on 2099-10-01 at 00:00 UTC.'

const S1 = "Cisco's Jeetu Patel said a company with 90,000 employees is looking at $900 million annually."
const S2 = 'Glean CEO Arvind Jain has estimated that roughly 95% of enterprise AI usage runs on the most expensive models.'
const S3 = 'Amazon filed its amended complaint against Perplexity on 21 September 2026.'
const BODY = `${S1} ${S2}\n\n${S3}`

const CLAIMS = [
  { sentence: S1, claim: 'A company with 90,000 employees is looking at $900 million annually, per Cisco.', kind: 'number',
    quote: 'With 90,000 employees, a company is looking at $900 million annually.' },
  { sentence: S2, claim: 'Glean\'s CEO estimated that about 95% of enterprise AI usage runs on the most expensive models.', kind: 'number',
    quote: 'Glean CEO Arvind Jain has estimated that roughly 95% of enterprise AI usage is still running on the most expensive frontier models.' },
  { sentence: S3, claim: 'Amazon filed an amended complaint against Perplexity on 21 September 2026.', kind: 'event',
    quote: 'Amazon filed an amended complaint against Perplexity on 21 September 2026.' },
]

// Two sources: the Cisco and Glean passages word for word, and the Amazon
// filing only in a summary, so that claim needs the web to agree.
const MATERIALS = [
  { id: 'm1', kind: 'paste', title: 'Cisco and Glean', url: 'https://example.test/costs', verbatim: true,
    content: `Cisco's Jeetu Patel laid out the math. ${CLAIMS[0]!.quote}\n\n${CLAIMS[1]!.quote}` },
  { id: 'm2', kind: 'research', title: 'Research summary', content: `${CLAIMS[2]!.quote} The complaint adds a contract claim.` },
]
// The piece's last real result, which a failed run must leave exactly as it is.
const LAST = { version: 1, ran_at: '2026-09-27T08:00:00.000Z', body_hash: 'the-last-real-check', passed: false, blocking: 2, claims: [], set_aside: [], independent_checker: 'perplexity:sonar-pro', single_source: 0 }

type Stage = 'extract' | 'second_look' | 'on_file' | 'entail' | 'other'
interface Plan {
  /** Which calls the provider refuses. */
  refuse?: (stage: Stage, claim: string | null) => boolean
  extract?: () => unknown
  onFile?: (claim: string) => unknown
  /** The web checker's answer; undefined for the default, which supports the claim. */
  perplexity?: (claim: string) => { status: number; out?: unknown } | undefined
}

const calls = { anthropic: [] as Array<{ stage: Stage; claim: string | null }>, perplexity: [] as string[] }

function stageOf(system: string): Stage {
  if (system.includes('You list the factual claims')) return 'extract'
  if (system.includes('nobody has listed a factual claim')) return 'second_look'
  if (system.includes('You check ONE claim against the sources')) return 'on_file'
  if (system.includes('A fact checker quoted a source')) return 'entail'
  return 'other'
}

const text = (t: string) => new Response(JSON.stringify({ content: [{ type: 'text', text: t }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 })

function upstream(plan: Plan) {
  return async (url: string, init: { body: string }) => {
    // Now and then a dynamic import of the database client in
    // _modelProvider.ts misses the mock above and gets the real client, whose
    // address is the dead one set at the top. Its request lands here, never
    // on a network, and a write it carries is counted like the mock's.
    if (String(url).startsWith('http://127.0.0.1:9/')) {
      const table = String(url).match(/\/rest\/v1\/([a-z_]+)/)?.[1] ?? ''
      if (init.body) db.upserts.push({ table, values: JSON.parse(init.body) })
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const req = JSON.parse(init.body)
    if (String(url).includes('perplexity')) {
      const claim = String(req.messages[1].content).match(/Claim: (.*)\n/)![1]!
      calls.perplexity.push(claim)
      const p = plan.perplexity?.(claim) ?? { status: 200, out: { verdict: 'supported', evidence: CLAIMS.find(c => c.claim === claim)!.quote, url: 'https://example.test/web' } }
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(p.out ?? {}) } }], citations: ['https://example.test/web'] }), { status: p.status })
    }
    const stage = stageOf(JSON.stringify(req.system))
    const user = String(req.messages[0].content)
    const claim = stage === 'on_file' || stage === 'entail' ? String(JSON.parse(user).claim) : null
    calls.anthropic.push({ stage, claim })
    if (plan.refuse?.(stage, claim)) {
      return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: LIMIT } }), { status: 400 })
    }
    if (stage === 'extract') return text(JSON.stringify(plan.extract?.() ?? { claims: CLAIMS.map(({ sentence, claim: c, kind }) => ({ sentence, claim: c, kind })), set_aside: [] }))
    if (stage === 'second_look') return text(JSON.stringify({ answers: [] }))
    if (stage === 'on_file') {
      return text(JSON.stringify(plan.onFile?.(claim!) ?? { verdict: 'supported', quotes: [CLAIMS.find(c => c.claim === claim)!.quote], note: 'stated' }))
    }
    if (stage === 'entail') return text(JSON.stringify({ answer: 'states', why: 'it says so' }))
    return text('{}')
  }
}

const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/fact-check.js')
const provider = await import('../../apps/control-plane/api/_modelProvider.js')

async function factCheck(plan: Plan, requestBody: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', vi.fn(upstream(plan)))
  const out = { status: 0, headers: {} as Record<string, string>, body: undefined as any }
  const res: Record<string, any> = {
    statusCode: 200,
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v; return res },
    status(code: number) { out.status = code; res.statusCode = code; return res },
    json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  try {
    await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: { id: ID }, body: requestBody } as never, res as never)
  } finally {
    vi.unstubAllGlobals()
  }
  return out
}

const written = () => db.updates.filter(u => u.table === 'content_ideas')
const recorded = () => db.upserts.filter(u => u.table === 'system_config' && u.values?.key === provider.FAILURE_KEY).map(u => JSON.parse(u.values.value))

beforeEach(() => {
  db.row = { id: ID, body: BODY, meta: { materials: MATERIALS, fact_check: LAST } }
  db.updates.length = 0
  db.upserts.length = 0
  calls.anthropic.length = 0
  calls.perplexity.length = 0
  provider.resetProviderMemory()
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  process.env.ANTHROPIC_API_KEY = 'sk-test-not-a-key'
  process.env.PERPLEXITY_API_KEY = 'pplx-test-not-a-key'
})

/** A failed run: revise's typed body, the provider's words and reset, and
 *  nothing written over the piece's last result. */
function expectFailedRun(r: Awaited<ReturnType<typeof factCheck>>) {
  expect(r.status).toBe(503)
  expect(r.body).toMatchObject({
    ok: false, error: 'model_unavailable', code: 'provider_usage_limit', provider_class: 'usage_limit',
    message: LIMIT, reset_at: '2099-10-01T00:00:00.000Z', retryable: false,
  })
  expect(r.body.detail).toMatch(/^The fact check stopped before it had checked every claim, so nothing was recorded and the piece keeps its last result\. Anthropic is over its usage limit/)
  expect(Number(r.headers['retry-after'])).toBeGreaterThan(0)
  expect(written()).toHaveLength(0)
  expect(db.row!.meta.fact_check).toBe(LAST)
  expect(recorded().some(f => f.class === 'usage_limit' && f.reset_at === '2099-10-01T00:00:00.000Z')).toBe(true)
}

describe('POST /api/content-ideas/:id/fact-check when the model provider fails', () => {
  it('refuses an unexpectedly broad rerun before any paid provider call', async () => {
    const r = await factCheck({}, { max_fresh_sentences: 1 })
    expect(r.status).toBe(409)
    expect(r.body).toMatchObject({
      ok: false,
      reason: 'rerun_scope',
      next_run: { ledger_usable: false, total_sentences: 3, reusable_sentences: 0, fresh_sentences: 3 },
    })
    expect(r.body.error).toMatch(/No model was called/)
    expect(calls.anthropic).toHaveLength(0)
    expect(calls.perplexity).toHaveLength(0)
    expect(written()).toHaveLength(0)
  })

  it('a refused extract is a 503 with the provider\'s class, words and reset, where it was a 500', async () => {
    const r = await factCheck({ refuse: stage => stage === 'extract' })
    expectFailedRun(r)
    expect(calls.perplexity).toHaveLength(0)
  })

  it('a usage limit reached part-way through the claims ends the run, and no unchecked claim is recorded as failing', async () => {
    const r = await factCheck({ refuse: (stage, claim) => stage === 'on_file' && claim === CLAIMS[1]!.claim })
    expectFailedRun(r)
  })

  it('a refused entailment ends the run instead of reading as "not borne out by the quoted evidence"', async () => {
    const r = await factCheck({ refuse: (stage, claim) => stage === 'entail' && claim === CLAIMS[2]!.claim })
    expectFailedRun(r)
    expect(JSON.stringify(r.body)).not.toMatch(/not borne out/)
  })

  it('a refused second look ends the run, where its sentences used to fail as claims', async () => {
    const r = await factCheck({ extract: () => ({ claims: [], set_aside: [] }), refuse: stage => stage === 'second_look' })
    expectFailedRun(r)
    expect(calls.anthropic.some(c => c.stage === 'on_file')).toBe(false)
  })

  it('no claim starts after the run has failed', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ sentence: S1, claim: `Claim ${i}: 90,000 employees cost $900 million.`, kind: 'number' }))
    const r = await factCheck({
      extract: () => ({ claims: [...many, ...CLAIMS.slice(1).map(({ sentence, claim, kind }) => ({ sentence, claim, kind }))], set_aside: [] }),
      refuse: stage => stage === 'on_file',
      perplexity: () => ({ status: 200, out: { verdict: 'unclear' } }),
    })
    expectFailedRun(r)
    // Six claims run at a time; the rest never start.
    expect(calls.anthropic.filter(c => c.stage === 'on_file').length).toBeLessThanOrEqual(6)
    expect(calls.perplexity.length).toBeLessThanOrEqual(6)
  })
})

describe('what was checked keeps its verdict, exactly as before', () => {
  it('a clean run passes and is stored', async () => {
    const r = await factCheck({})
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ ok: true, passed: true, blocking: 0, claims: 3 })
    expect(written()).toHaveLength(1)
    expect(written()[0]!.values.meta.fact_check.passed).toBe(true)
  })

  it('a claim the sources do not carry, and one the web checker could not reach, still fail and are stored', async () => {
    const r = await factCheck({
      onFile: claim => claim === CLAIMS[0]!.claim
        ? { verdict: 'not_found', quotes: [], note: 'the sources do not say this' }
        : { verdict: 'supported', quotes: [CLAIMS.find(c => c.claim === claim)!.quote], note: 'stated' },
      perplexity: claim => claim === CLAIMS[2]!.claim ? { status: 401 } : claim === CLAIMS[0]!.claim ? { status: 200, out: { verdict: 'unclear' } } : undefined,
    })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ ok: true, passed: false, blocking: 2 })
    const stored = written()[0]!.values.meta.fact_check
    const verdict = (c: { claim: string }) => stored.claims.find((x: { claim: string }) => x.claim === c.claim)
    expect(verdict(CLAIMS[0]!)).toMatchObject({ verdict: 'unverified', on_file: { verdict: 'not_found', note: 'the sources do not say this' } })
    // Perplexity is a different provider: its failure leaves the claim
    // unclear, and a claim found only in a summary needs the web to agree.
    expect(verdict(CLAIMS[2]!)).toMatchObject({ verdict: 'unverified', independent: { verdict: 'unclear', evidence: 'check failed: perplexity_401' } })
    expect(verdict(CLAIMS[1]!).verdict).toBe('verified')
    expect(recorded()).toHaveLength(0)
  })
})

describe('a sentence an earlier run settled keeps its result (walk log F52)', () => {
  // Krish, 2026-10-02: "Yes, or cut the opinion lines". The second run checks
  // only the claim that failed; the two that passed are carried, unchanged,
  // without a model or web call.
  it('stores the ledger, then spends checks only on what failed', async () => {
    const failFirst = {
      onFile: (claim: string) => claim === CLAIMS[0]!.claim
        ? { verdict: 'not_found', quotes: [], note: 'not stated' }
        : { verdict: 'supported', quotes: [CLAIMS.find(c => c.claim === claim)!.quote], note: 'stated' },
      perplexity: (claim: string) => claim === CLAIMS[0]!.claim ? { status: 200, out: { verdict: 'unclear' } } : undefined,
    }
    const first = await factCheck(failFirst)
    expect(first.body).toMatchObject({ ok: true, passed: false, blocking: 1, carried: 0 })
    const stored = written()[0]!.values.meta
    expect(Object.values(stored.fact_ledger.sentences).map((e: any) => e.status).sort()).toEqual(['passed', 'passed'])

    db.row = { id: ID, body: BODY, meta: { ...db.row!.meta, ...stored } }
    db.updates.length = 0
    calls.anthropic.length = 0
    calls.perplexity.length = 0
    const second = await factCheck({}, { max_fresh_sentences: 1 })
    expect(second.body).toMatchObject({
      ok: true,
      passed: true,
      blocking: 0,
      claims: 3,
      carried: 2,
      next_run: { ledger_usable: true, total_sentences: 3, reusable_sentences: 2, fresh_sentences: 1 },
    })
    expect(calls.perplexity).toEqual([CLAIMS[0]!.claim])
    expect(calls.anthropic.filter(c => c.stage === 'on_file').map(c => c.claim)).toEqual([CLAIMS[0]!.claim])
    const carried = written()[0]!.values.meta.fact_check.claims.filter((c: any) => c.carried_from)
    expect(carried.map((c: any) => c.claim).sort()).toEqual([CLAIMS[1]!.claim, CLAIMS[2]!.claim].sort())
  })

  it('a changed source checks everything again', async () => {
    await factCheck({})
    const stored = written()[0]!.values.meta
    db.row = { id: ID, body: BODY, meta: { ...stored, materials: [...MATERIALS, { id: 'm3', kind: 'paste', title: 'New', content: 'A new source.' }] } }
    calls.perplexity.length = 0
    const again = await factCheck({})
    expect(again.body).toMatchObject({ ok: true, passed: true, carried: 0 })
    expect(calls.perplexity).toHaveLength(3)
  })
})
