import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The weekly deep-research route's claim split (docs/plans/2026-11-11-ideas-wave1-diagnosis.md).
//
// Seven of its runs from week 38 to week 45 aborted with "grounding failed on
// both attempts (100% of claims unfound in source)", and not one of them logged
// a claim. What the live records show (read 11 November):
//
//   - the anchor's page WAS in the prompt: every run stored its anchor page, and
//     each split call's input grew with it (week 44: 2,441 characters of page,
//     about 1,820 input tokens a call; week 40: 10,966 characters, about 4,250);
//   - the replies were long and gave nothing: 1,250 to 2,430 output tokens a
//     call, against 488 for week 43's three claims, the one complete run;
//   - the publisher-beat call (limit 700) used exactly 700 and learned nothing in
//     8 of its 10 runs on claude-sonnet-5, against 547 and 8 beats on sonnet-4-6.
//
// claude-sonnet-5 thinks unless told not to (_models.ts), callMetered never told
// it, and it read the reply from content[0], which is then a thinking block with
// no text. Week 38 was a different fault, a refused API key, reported in the
// same words. These tests replay those runs' recorded inputs (week 44's anchor,
// snippet and page; the recorded token counts; week 38's error) through the
// split as it is now.

vi.hoisted(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
  process.env.ANTHROPIC_API_KEY = 'not-a-key'
})
vi.mock('../../apps/control-plane/api/_meter.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../apps/control-plane/api/_meter.js')>()),
  anthropicCall: async () => {},
}))

const { callMetered, newBudget, LADDER_MODEL, UTILITY_MODEL } = await import('../../apps/control-plane/api/_harness.js')
const inv = await import('../../apps/control-plane/api/_investigation.js')

// Week 44 (run eb8cba76), as stored: the anchor's headline and snippet, and the
// opening of the anchor page the run fetched (anthropic.com/news/s1-sec).
const W44 = {
  headline: "Anthropic's S-1 reveals the enterprise concentration risk nobody is pricing into ANT",
  snippet: "25% of Anthropic's $16.3B H1 2026 revenue comes from five customers, and 48% from cloud providers who are simultaneously its investors, competitors and distribution partners. The IPO narrative is enterprise dominance; the actual risk is a handful of relationships that could reprice overnight. That tension is the story, not the revenue growth.",
  page: 'Anthropic files S-1 with the SEC for proposed initial public offering \\ Anthropic Skip to main content News Research Policy Commitments Company Try Claude Anthropic files S-1 with the SEC for proposed initial public offering Published Oct 26, 2026 Category Announcements Today, Anthropic, PBC filed a registration statement on Form S-1 with the U.S. Securities and Exchange Commission relating to its proposed initial public offering of its Class A common stock. Anthropic intends to list its Class A common stock on the Nasdaq Global Select Market under the symbol "ANT." The number of shares of Class A common stock to be offered and the price range for the proposed offering have not yet been dete',
}
const anchorText = `${W44.headline}. ${W44.snippet}`

// Claims a split could return for week 44, each quoting the page verbatim.
const CLAIMS = {
  claims: [
    {
      id: 'c1', text: 'Anthropic filed a registration statement on Form S-1 with the SEC relating to a proposed initial public offering of its Class A common stock.',
      claim_type: 'observation', quantity: null,
      quote: 'Anthropic, PBC filed a registration statement on Form S-1 with the U.S. Securities and Exchange Commission relating to its proposed initial public offering of its Class A common stock',
      surprise: 6, verifiability: 5, falsifier: 'SEC EDGAR filing index by 30 November 2026 showing no Form S-1 from Anthropic, PBC.', mechanism_type: null,
    },
    {
      id: 'c2', text: 'Anthropic intends to list its Class A common stock on the Nasdaq Global Select Market under the symbol ANT.',
      claim_type: 'observation', quantity: null,
      quote: 'Anthropic intends to list its Class A common stock on the Nasdaq Global Select Market under the symbol "ANT."',
      surprise: 4, verifiability: 5, falsifier: 'Nasdaq listing records by Q1 2027 showing the shares listed under another symbol or exchange.', mechanism_type: null,
    },
  ],
}

type Reply = { status?: number; body: Record<string, unknown> }
let replies: Reply[] = []
let requests: Array<Record<string, any>> = []
const realFetch = globalThis.fetch

beforeEach(() => {
  replies = []
  requests = []
  globalThis.fetch = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    requests.push(JSON.parse(String(init?.body || '{}')))
    const r = replies.shift() || { body: {} }
    const status = r.status ?? 200
    return { ok: status < 400, status, json: async () => r.body } as Response
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = realFetch })

/** The shape a claude-sonnet-5 reply takes when it thinks first. */
const thoughtThenText = (text: string, usage = { input_tokens: 1824, output_tokens: 1245 }) => ({
  body: {
    content: [{ type: 'thinking', thinking: 'Splitting the anchor into claims.', signature: 'sig' }, { type: 'text', text }],
    stop_reason: 'end_turn', usage,
  },
})

describe('callMetered, the investigation\'s own client', () => {
  it('turns thinking off on a model that thinks by default, and leaves an older model\'s request alone', async () => {
    replies.push({ body: { content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn', usage: {} } })
    replies.push({ body: { content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn', usage: {} } })
    await callMetered({ system: 's', user: 'u', model: UTILITY_MODEL, maxTokens: 2600 }, newBudget())
    await callMetered({ system: 's', user: 'u', model: LADDER_MODEL, maxTokens: 1400 }, newBudget())
    expect(UTILITY_MODEL).toBe('claude-sonnet-5')
    expect(requests[0].thinking).toEqual({ type: 'disabled' })
    expect('thinking' in requests[1]).toBe(false)
  })

  it('reads the first text block, not content[0], and keeps the stop reason', async () => {
    replies.push(thoughtThenText(JSON.stringify(CLAIMS)))
    const res = await callMetered({ system: 's', user: 'u', model: UTILITY_MODEL, maxTokens: 2600 }, newBudget())
    expect(res.text).toBe(JSON.stringify(CLAIMS))
    expect(res.stopReason).toBe('end_turn')
    expect(res.outputTokens).toBe(1245)
  })

  it('a reply that spent its whole limit thinking reads as empty and says it was cut off (week 45 beats: 700 of 700)', async () => {
    replies.push({ body: { content: [{ type: 'thinking', thinking: '...', signature: 'sig' }], stop_reason: 'max_tokens', usage: { input_tokens: 1253, output_tokens: 700 } } })
    const res = await callMetered({ system: 's', user: 'u', model: UTILITY_MODEL, maxTokens: 700 }, newBudget())
    expect(res.text).toBe('')
    expect(res.stopReason).toBe('max_tokens')
  })
})

describe('what the split reads', () => {
  it('the anchor page reaches the prompt, after the headline and snippet', async () => {
    const source = inv.decomposeSource(anchorText, W44.page)
    expect(source.note).toBeNull()
    const sent: string[] = []
    await inv.splitClaims(W44.headline, source.text, [], async o => {
      sent.push(o.user)
      return { text: JSON.stringify(CLAIMS), model: String(o.model), inputTokens: 0, outputTokens: 0, costUsd: 0, stopReason: 'end_turn' }
    })
    expect(sent[0]).toContain('Anthropic intends to list its Class A common stock on the Nasdaq Global Select Market')
    expect(sent[0]).toContain('25% of Anthropic')
  })

  it('a page that gave nothing is said, not inferred (weeks 42 and 41: 0 and 69 characters)', () => {
    expect(inv.decomposeSource(anchorText, '').note).toBe('the anchor page gave 0 characters of text, so the claim split read the headline and snippet only')
    expect(inv.decomposeSource(anchorText, 'x'.repeat(69)).note).toMatch(/gave 69 characters/)
    expect(inv.decomposeSource(anchorText, undefined).note).toMatch(/was not fetched/)
    expect(inv.decomposeSource(anchorText, '').text).toBe(`${anchorText}\n\n`)
  })
})

describe('the split, replayed on week 44', () => {
  it('a reply that thinks first now gives its claims, and they ground', async () => {
    replies.push(thoughtThenText(JSON.stringify(CLAIMS)))
    const budget = newBudget()
    const out = await inv.splitClaims(W44.headline, inv.decomposeSource(anchorText, W44.page).text, [], o => callMetered(o, budget))
    expect(out.abortReason).toBeNull()
    expect(out.grounded.map(g => g.g.action)).toEqual(['pass', 'pass'])
    expect(out.failRate).toBe(0)
    expect(requests).toHaveLength(1)
    expect(requests[0].max_tokens).toBe(inv.DECOMPOSE_MAX_TOKENS)
  })

  it('an empty reply is named for what it is, never "100% of claims unfound", and is asked again as the same question', async () => {
    const cut = { body: { content: [{ type: 'thinking', thinking: '...', signature: 'sig' }], stop_reason: 'max_tokens', usage: { input_tokens: 4247, output_tokens: 2600 } } }
    replies.push(cut, cut)
    const seen: Array<{ attempt: number; system: string; reason: string | null }> = []
    const budget = newBudget()
    const out = await inv.splitClaims(W44.headline, inv.decomposeSource(anchorText, W44.page).text, [], o => callMetered(o, budget),
      async a => { seen.push({ attempt: a.attempt, system: a.prompt.system, reason: a.empty?.reason ?? null }) })
    expect(out.abortReason).toBe('no claims to check after two attempts: the claim split reply reached its 2600-token limit before writing any text')
    expect(out.abortReason).not.toMatch(/unfound/)
    expect(out.failRate).toBeNull()
    expect(seen.map(s => s.attempt)).toEqual([1, 2])
    // Nothing failed grounding, so the second attempt is not the re-ground prompt.
    expect(seen.every(s => s.system.startsWith('You decompose'))).toBe(true)
  })

  it('a refused call is named as the call failing (week 38: anthropic_401)', async () => {
    const refused = { status: 401, body: { error: { message: 'API key is invalid.' } } }
    replies.push(refused, refused)
    const budget = newBudget()
    const out = await inv.splitClaims(W44.headline, anchorText, [], o => callMetered(o, budget))
    expect(out.abortReason).toBe('no claims to check after two attempts: the claim split call failed (anthropic_401:API key is invalid.)')
  })

  it('an empty list the model chose is its answer: one call, and the run says what it found', async () => {
    replies.push({ body: { content: [{ type: 'text', text: '{"claims": []}' }], stop_reason: 'end_turn', usage: {} } })
    const budget = newBudget()
    const out = await inv.splitClaims(W44.headline, anchorText, [], o => callMetered(o, budget))
    expect(out.abortReason).toBe("the claim split found no checkable claim in the anchor's source")
    expect(requests).toHaveLength(1)
  })

  it('JSON cut off at the limit is named as cut off', () => {
    const e = inv.emptySplit({ text: '{"claims": [{"id": "c1", "text": "Anthropic filed', stopReason: 'max_tokens' }, null, 2600)
    expect(e).toEqual({ reason: 'the claim split reply was cut off at its 2600-token limit, so its JSON did not parse', answered: false })
  })

  it('quotes the source does not hold still fail grounding as before, and the retry echoes them back', async () => {
    const made = { claims: CLAIMS.claims.map(c => ({ ...c, quote: 'a sentence this page never printed about pricing' })) }
    const invented = { claims: CLAIMS.claims.map(c => ({ ...c, quote: 'the board also approved a special dividend for early holders' })) }
    replies.push({ body: { content: [{ type: 'text', text: JSON.stringify(made) }], stop_reason: 'end_turn', usage: {} } })
    replies.push({ body: { content: [{ type: 'text', text: JSON.stringify(invented) }], stop_reason: 'end_turn', usage: {} } })
    const systems: string[] = []
    const budget = newBudget()
    const out = await inv.splitClaims(W44.headline, inv.decomposeSource(anchorText, W44.page).text, [], o => callMetered(o, budget),
      async a => { systems.push(a.prompt.system) })
    expect(out.abortReason).toBe('grounding failed on both attempts (100% of claims unfound in source)')
    expect(systems[1]).toMatch(/^You previously returned claims whose quotes were NOT FOUND/)
  })
})
