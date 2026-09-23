import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// The relevance classifier gained a fourth verdict on 2026-09-23: the buyer
// test. Every other gate in the system asks what a story is ABOUT. None asked
// whether the person Krish sells to would care, which is why the inspiration
// sweep's 2,000-word bar can score voice, pillar fit, evidence and novelty
// without once mentioning his customer.
//
// Two things are worth a test here and they are different. That the buyer test
// actually reaches the model, because a criterion that lives in a comment
// changes nothing. And that the fail-open contract still holds, because this
// classifier now stands in front of the corpus the synthesis engine reads, and
// a classifier outage that quietly emptied the Feed would be worse than the
// dull rows it exists to remove.

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: { rpc: async () => ({ error: null }) },
}))

let sent: any[] = []
let reply: (body: any) => { ok: boolean; status: number; json: () => Promise<any> }

beforeEach(() => {
  sent = []
  reply = () => ({ ok: true, status: 200, json: async () => ({ content: [{ text: '[]' }], usage: {} }) })
  vi.stubGlobal('fetch', async (_url: string, init: any) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    return reply(body)
  })
})
afterEach(() => { vi.unstubAllGlobals() })

const answer = (rows: unknown[]) => () => ({
  ok: true, status: 200,
  json: async () => ({ content: [{ text: JSON.stringify(rows) }], usage: { input_tokens: 10, output_tokens: 5 } }),
})

async function load() {
  return await import('../../apps/control-plane/api/_relevance.js')
}

describe('the buyer test reaches the model', () => {
  it('names who the reader is and what he is deciding', async () => {
    const { classifyRelevance } = await load()
    await classifyRelevance([{ id: '1', title: 'x' }], { apiKey: 'k' })
    const system: string = sent[0].system
    expect(system).toContain('not_interesting')
    expect(system).toContain('commercial leader')
    expect(system).toContain('thirty days')
    expect(system).toContain('buying, pricing, positioning, hiring or building with AI')
  })

  it('carries his own words for the register rather than a paraphrase', async () => {
    const { classifyRelevance } = await load()
    await classifyRelevance([{ id: '1', title: 'x' }], { apiKey: 'k' })
    const system: string = sent[0].system
    // Quoted from the edit ledger and from him directly. A paraphrase drifts,
    // and this is the one criterion nothing else in the system holds.
    expect(system).toContain('commercial, positive, and visionary')
    expect(system).toContain('crappy unimportant one off news items')
  })

  it('offers the new verdict in the response schema it asks for', async () => {
    const { classifyRelevance } = await load()
    await classifyRelevance([{ id: '1', title: 'x' }], { apiKey: 'k' })
    expect(sent[0].system).toContain('keep|off_vertical|too_technical|not_interesting')
  })
})

describe('parsing', () => {
  it('accepts not_interesting', async () => {
    const { classifyRelevance } = await load()
    reply = answer([{ id: '1', verdict: 'not_interesting', confidence: 0.9, rationale: 'personnel move, nothing to do' }])
    const [v] = await classifyRelevance([{ id: '1', title: 'OpenAI hires a VP' }], { apiKey: 'k' })
    expect(v.verdict).toBe('not_interesting')
    expect(v.confidence).toBe(0.9)
  })

  it('falls back to keep for a verdict it does not recognise', async () => {
    const { classifyRelevance } = await load()
    reply = answer([{ id: '1', verdict: 'boring', confidence: 0.99 }])
    const [v] = await classifyRelevance([{ id: '1', title: 'x' }], { apiKey: 'k' })
    expect(v.verdict).toBe('keep')
  })

  it('keeps an item the model omitted entirely', async () => {
    const { classifyRelevance } = await load()
    reply = answer([{ id: '1', verdict: 'off_vertical', confidence: 0.9, vertical: 'finance' }])
    const out = await classifyRelevance(
      [{ id: '1', title: 'bond yields' }, { id: '2', title: 'agent pricing' }], { apiKey: 'k' })
    expect(out.map(v => v.verdict)).toEqual(['off_vertical', 'keep'])
  })
})

describe('fail-open, because this now stands in front of the corpus', () => {
  it('keeps everything when the call throws', async () => {
    const { classifyRelevance } = await load()
    vi.stubGlobal('fetch', async () => { throw new Error('network down') })
    const out = await classifyRelevance([{ id: '1', title: 'x' }, { id: '2', title: 'y' }], { apiKey: 'k' })
    expect(out.every(v => v.verdict === 'keep')).toBe(true)
    expect(out[0].rationale).toBe('classifier_error_kept')
  })

  it('keeps everything when Anthropic refuses the request', async () => {
    const { classifyRelevance } = await load()
    reply = () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'usage limit reached' } }) })
    const out = await classifyRelevance([{ id: '1', title: 'x' }], { apiKey: 'k' })
    expect(out[0].verdict).toBe('keep')
    expect(out[0].rationale).toBe('classifier_error_kept')
  })

  it('a confident refusal is still only a refusal above the caller threshold', async () => {
    // The classifier reports; the caller decides. feed/ingest drops at >= 0.85
    // and content-ideas at >= 0.85, so a 0.6 off_vertical is kept by both.
    const { classifyRelevance } = await load()
    reply = answer([{ id: '1', verdict: 'off_vertical', confidence: 0.6, vertical: 'finance' }])
    const [v] = await classifyRelevance([{ id: '1', title: 'bond yields' }], { apiKey: 'k' })
    expect(v.verdict).toBe('off_vertical')
    expect(v.confidence).toBeLessThan(0.85)
  })
})

describe('reason codes', () => {
  it('spells not_interesting the way Krish bins one by hand', async () => {
    const { relevanceReasonCode } = await load()
    // BIN_REASONS in artifacts/triage-desk.html uses exactly this code, so his
    // refusals and the machine's are one vocabulary and a disagreement is a
    // group-by rather than a translation.
    expect(relevanceReasonCode('content', 'not_interesting')).toBe('content_not_interesting')
    expect(relevanceReasonCode('content', 'too_technical')).toBe('content_too_technical')
    expect(relevanceReasonCode('content', 'off_vertical')).toBe('content_off_vertical')
  })
})
