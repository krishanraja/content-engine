import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The writers' self-check (walk log F42 to F44).
//
// On 2026-09-30 drafting resumed after a provider outage and the writers kept
// breaking Krish's blocking rules even when told exactly what to fix. The
// fixtures are the real texts from that day: piece 1 after the engine's
// rewrite (two "Not X, Y"), and piece 3's first draft (three "Not X, Y", a
// reading age of about 13.5, and a confidence of 78% the writer set itself).
//
// Every model call here is a stubbed fetch and the database is a stub: no
// test reaches a provider or a real database.

const db = vi.hoisted(() => {
  // _supabase.ts throws at load without these. A dead local address, so a
  // missing stub fails as a connection error and never as a real write.
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
  return {
    row: null as Record<string, unknown> | null,
    updates: [] as Array<{ table: string; values: unknown }>,
    inserts: [] as Array<{ table: string; values: unknown }>,
    rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  }
})

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    rpc: async (fn: string, args: Record<string, unknown>) => { db.rpc.push({ fn, args }); return { error: null } },
    from(table: string) {
      const chain: Record<string, any> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) chain[m] = () => chain
      chain.single = async () => ({ data: table === 'content_ideas' ? db.row : null, error: null })
      chain.maybeSingle = chain.single
      chain.update = (values: unknown) => { db.updates.push({ table, values }); return chain }
      chain.insert = async (values: unknown) => { db.inserts.push({ table, values }); return { error: null } }
      chain.upsert = async () => ({ error: null })
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: table === 'content_ideas' ? [{ id: ID }] : [], error: null }).then(resolve)
      return chain
    },
  },
}))

// The config readers: the voice block and the corpus are live rows.
vi.mock('../../apps/control-plane/api/_content.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../apps/control-plane/api/_content.js')>()),
  loadVoiceBlock: async () => '',
  loadCorpus: async () => '',
}))
vi.mock('../../apps/control-plane/api/_subchannels.js', () => ({
  LIVE_SUBCHANNELS: ['follow_the_money', 'mind_the_gap', 'under_the_hood'],
  loadSubchannel: async (v?: string | null) => (v ? { slug: 'under_the_hood', label: 'under.the.hood', mandate: 'Take a shipped thing apart.' } : null),
}))

const { blockingHits, selfCheck, correctionFor, guardConfidence } = await import('../../apps/control-plane/api/_selfCheck.js')

const TOKEN = 'eot_' + 's'.repeat(40)
const ID = '00000000-0000-4000-8000-000000000042'
const LIMIT = 'You have reached your specified API usage limits. You will regain access on 2099-10-01 at 00:00 UTC.'
// Stored bodies are LF. A Windows checkout can turn the fixtures CRLF, so
// they are read line-ending blind (the CI Windows leg does exactly this).
const fixture = (name: string) => readFileSync(`tests/fixtures/control-plane/${name}`, 'utf8').replace(/\r\n?/g, '\n')

// Piece 1 after the engine's rewrite, and the same text with its two hits fixed.
const P1 = fixture('piece1-v11-engine-rewrite.md')
const P1_HIT_1 = "Those words were about Perplexity's robot, not Muse."
const P1_HIT_2 = "Reading them across to Muse is our guess, not Amazon's claim."
const P1_FIXED = P1.replace(P1_HIT_1, "Those words were about Perplexity's robot.").replace(P1_HIT_2, 'Reading them across to Muse is our guess.')

// Piece 3's first draft, and the same draft with its three hits fixed (it
// still reads above age 13).
const P3 = fixture('piece3-v1-first-draft.md')
// The placeholder in place of the 78% the draft wrote on its own.
const unset = (text: string) => text.replace('How sure we are: 78%.', 'How sure we are: [Krish to set].')
const P3_R2_FIXED = P3
  .replace('So the 27 years is a flavour, not an ingredient.', 'So the 27 years is a flavour. It never went into the dough.')
  .replace("That's not matching or exceeding the leading models. That's finishing third", 'Koa finished third')
  .replace("isn't secrecy for its own sake. It's that an independent benchmark", 'is that an independent benchmark')

// ── The fake provider ─────────────────────────────────────────────────────

type Reply = string | (() => Response)
const calls: Array<{ system: unknown; messages: Array<{ role: string; content: string }>; stream: boolean }> = []
let replies: Reply[] = []

const START = 'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":1}}}'
const sse = (text: string) => [
  START,
  `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}`,
  'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":50}}',
].join('\n\n') + '\n\n'
const refused = () => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: LIMIT } }), { status: 400 })

function provider() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body)
    calls.push({ system: body.system, messages: body.messages, stream: !!body.stream })
    const next = replies.shift()
    if (next === undefined) throw new Error('the test gave the provider no reply for this call')
    if (typeof next === 'function') return next()
    return body.stream
      ? new Response(sse(next), { status: 200 })
      : new Response(JSON.stringify({ content: [{ type: 'text', text: next }], usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200 })
  }))
}

function response() {
  const out = { status: 0, body: undefined as any, chunks: [] as string[] }
  const res: Record<string, any> = {
    statusCode: 200,
    setHeader() { return res },
    status(code: number) { out.status = code; res.statusCode = code; return res },
    json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
    writeHead(code: number) { out.status = code; return res },
    write(chunk: string) { out.chunks.push(chunk); return true },
    end() { return res },
  }
  const events = () => out.chunks.join('').split('\n\n').filter(f => f.startsWith('event:')).map(f => {
    const [head, data] = f.split('\n')
    return { event: head!.slice(6).trim(), data: JSON.parse(data!.slice(5).trim()) }
  })
  return { res, out, events }
}

async function draft(...answers: Reply[]) {
  replies = answers
  provider()
  const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/draft.js')
  const r = response()
  await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: { id: ID }, body: { instruction: 'End with "How sure we are: [Krish to set]".' } } as never, r.res as never)
  return r.out
}

async function revise(body: Record<string, unknown>, ...answers: Reply[]) {
  replies = answers
  provider()
  const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/revise.js')
  const r = response()
  await handler({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, query: { id: ID }, body: { mode: 'feedback', value: 'custom', ...body } } as never, r.res as never)
  const events = r.events()
  return { ...r.out, events, done: events.find(e => e.event === 'done')?.data }
}

const asJson = (body: string) => JSON.stringify({ body, sources_cited: ['https://example.test/paper'], labelled_inferences: [], open_questions: [] })

beforeEach(() => {
  calls.length = 0
  replies = []
  db.updates.length = 0
  db.inserts.length = 0
  db.rpc.length = 0
  db.row = { id: ID, idea: 'Koa, taken apart', thesis: null, body: null, lane: null, lane_slot: 'under_the_hood', state: 'researching', updated_at: '2026-09-30T00:00:00Z', meta: {} }
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  process.env.ANTHROPIC_API_KEY = 'sk-test-not-a-key'
})
afterEach(() => { vi.unstubAllGlobals() })

// ── Brick 1: the check and its one retry ─────────────────────────────────

describe('what the self-check finds', () => {
  it('names each "Not X, Y" in piece 1 as the whole sentence it sits in', () => {
    const hits = blockingHits(P1, { readingAge: true })
    expect(hits).toEqual([{ rule: 'R2', found: P1_HIT_1 }, { rule: 'R2', found: P1_HIT_2 }])
    expect(blockingHits(P1_FIXED, { readingAge: true })).toEqual([])
  })

  it("finds piece 3's three constructions and its reading age, and a passage is read without the age", () => {
    const hits = blockingHits(P3, { readingAge: true })
    expect(hits.filter(h => h.rule === 'R2').map(h => h.found)).toEqual([
      'So the 27 years is a flavour, not an ingredient.',
      expect.stringMatching(/^That's not matching or exceeding the leading models\. That's finishing third out of three, .*frontier models\."$/),
      expect.stringMatching(/^Guess, clearly labelled: the reason .* isn't secrecy for its own sake\. It's that an independent benchmark .* around it\.$/),
    ])
    expect(hits.find(h => h.rule === 'R7')?.found).toMatch(/^Reads at about age 13\.5\. Above 13 cannot be approved/)
    expect(blockingHits(P3, { readingAge: false }).some(h => h.rule === 'R7')).toBe(false)
  })

  it('names spellings with the British word, and exclamation marks and em dashes by their sentence', () => {
    const hits = blockingHits('The color is gray. It works! Quotes keep theirs: "Wow!" A dash — here.', { readingAge: false })
    expect(hits).toEqual(expect.arrayContaining([
      { rule: 'BRITISH_SPELLING', found: 'color', use: 'colour' },
      { rule: 'BRITISH_SPELLING', found: 'gray', use: 'grey' },
      { rule: 'NO_EXCLAMATION', found: 'It works!' },
      { rule: 'NO_EM_DASH', found: 'A dash — here.' },
    ]))
  })

  it('the correction quotes each hit, the house rule it breaks, and asks for those sentences only', () => {
    const text = correctionFor(P3, blockingHits(P3, { readingAge: true }), 'Return only the whole rewritten text.')
    expect(text).toContain('"So the 27 years is a flavour, not an ingredient."')
    expect(text).toContain('No "Not X, Y". Never use the "Not X, Y" construction')
    expect(text).toContain('Reading age 12, with humour. Write for a reading age of 12')
    expect(text).toContain('- The longest sentences:')
    expect(text).toMatch(/Rewrite only these sentences; keep every other word\. Return only the whole rewritten text\.$/)
  })
})

describe('selfCheck, the retry', () => {
  const later = () => Date.now() + 120_000

  it('does not retry a clean answer', async () => {
    const retry = vi.fn()
    const r = await selfCheck({ first: P1_FIXED, readingAge: true, answer: 'x', deadline: later(), retry })
    expect(retry).not.toHaveBeenCalled()
    expect(r).toEqual({ text: P1_FIXED, chose: 'first', self_check: { passed: true, remaining: [], retried: false } })
  })

  it('keeps the first answer when the second breaks as many rules', async () => {
    const r = await selfCheck({ first: P1, readingAge: true, answer: 'x', deadline: later(), retry: async () => P1 })
    expect(r.chose).toBe('first')
    expect(r.self_check).toMatchObject({ passed: false, retried: true, note: expect.stringMatching(/as many rules/) })
    expect(r.self_check.remaining).toHaveLength(2)
  })

  it('keeps the first answer when the second is cut short', async () => {
    const r = await selfCheck({ first: P1, readingAge: true, answer: 'x', deadline: later(), minShare: 0.7, retry: async () => P1_FIXED.slice(0, 1000) })
    expect(r.chose).toBe('first')
    expect(r.self_check.note).toMatch(/cut short/)
  })

  it('does not start a retry the request has no time left for', async () => {
    const retry = vi.fn()
    const r = await selfCheck({ first: P1, readingAge: true, answer: 'x', deadline: Date.now() + 5_000, retry })
    expect(retry).not.toHaveBeenCalled()
    expect(r.self_check).toMatchObject({ passed: false, retried: false, note: expect.stringMatching(/no time left/) })
  })
})

describe('POST /api/content-ideas/:id/draft, self-checked', () => {
  it('retries a draft that breaks a blocking rule, naming each hit, and keeps the better draft with what it still breaks', async () => {
    const out = await draft(asJson(P3), asJson(P3_R2_FIXED))
    expect(calls).toHaveLength(2)
    const [first, second] = calls
    // The same system prompt, the first request and answer, then the correction.
    expect(second!.system).toEqual(first!.system)
    expect(second!.messages.slice(0, 2)).toEqual([first!.messages[0], { role: 'assistant', content: asJson(P3) }])
    const correction = second!.messages[2]!.content
    expect(correction).toContain('"So the 27 years is a flavour, not an ingredient."')
    expect(correction).toContain("That's not matching or exceeding the leading models. That's finishing third out of three")
    expect(correction).toContain("isn't secrecy for its own sake. It's that an independent benchmark")
    expect(correction).toContain('Reads at about age 13.5.')
    expect(correction).toContain('Rewrite only these sentences; keep every other word. Return the same JSON object as before')

    expect(out.status).toBe(200)
    expect(out.body.body).toBe(unset(P3_R2_FIXED).trim())
    expect(out.body.self_check).toMatchObject({ passed: false, retried: true })
    expect(out.body.self_check.remaining.map((h: { rule: string }) => h.rule)).toEqual(['R7'])
    // Metered like any other call, on its own key.
    expect(db.rpc.map(c => c.args.p_unit_key)).toEqual(['cleo-draft', 'cleo-draft-retry'])
  })

  it('makes one call when the draft is clean', async () => {
    const out = await draft(asJson(P1_FIXED))
    expect(calls).toHaveLength(1)
    expect(out.body.self_check).toEqual({ passed: true, remaining: [], retried: false, confidence_restored: true })
  })

  it('keeps the first draft, with a note, when the provider refuses the retry', async () => {
    const out = await draft(asJson(P3), refused)
    expect(calls).toHaveLength(2)
    expect(out.status).toBe(200)
    expect(out.body.body).toBe(unset(P3).trim())
    expect(out.body.self_check).toMatchObject({ passed: false, retried: false, note: expect.stringMatching(/^The second try did not run\. Anthropic is over its usage limit/) })
    expect(out.body.self_check.remaining).toHaveLength(4)
  })
})

describe('POST /api/content-ideas/:id/revise, self-checked', () => {
  it('retries a rewrite that breaks R2 and applies the fixed one, streaming only the first', async () => {
    const r = await revise({ instruction: 'Tighten it.', source_text: P1 }, P1, P1_FIXED)
    expect(calls).toHaveLength(2)
    const correction = calls[1]!.messages[2]!.content
    expect(calls[1]!.messages[1]).toEqual({ role: 'assistant', content: P1.trim() })
    expect(correction).toContain(`"${P1_HIT_1}"`)
    expect(correction).toContain(`"${P1_HIT_2}"`)
    expect(correction).toContain('Return only the whole rewritten text.')
    expect(r.events.filter(e => e.event === 'delta')).toHaveLength(1)
    expect(r.done).toMatchObject({ ok: true, revised: P1_FIXED.trim(), self_check: { passed: true, remaining: [], retried: true } })
    expect(db.rpc.map(c => c.args.p_unit_key)).toEqual(['cleo-revise', 'cleo-revise-retry'])
  })

  it('makes one call when the rewrite is clean', async () => {
    const r = await revise({ instruction: 'Tighten it.', source_text: P1 }, P1_FIXED)
    expect(calls).toHaveLength(1)
    expect(r.done.self_check).toEqual({ passed: true, remaining: [], retried: false, confidence_restored: false })
  })

  it('answers with the first rewrite, and a note, when the provider refuses the retry', async () => {
    const r = await revise({ instruction: 'Tighten it.', source_text: P1 }, P1, refused)
    expect(r.events[r.events.length - 1]!.event).toBe('done')
    expect(r.done).toMatchObject({ ok: true, revised: P1.trim(), self_check: { passed: false, retried: false } })
    expect(r.done.self_check.note).toMatch(/usage limit/)
    expect(r.done.self_check.remaining.map((h: { found: string }) => h.found)).toEqual([P1_HIT_1, P1_HIT_2])
  })

  it('checks an in-place rewrite by its passage, and retries the construction it returned three times on 2026-09-30', async () => {
    const r = await revise(
      { instruction: 'Remove the "X, not Y" construction.', source_text: P1, selection: P1_HIT_2 },
      P1_HIT_2, 'Reading them across to Muse is our guess.',
    )
    expect(calls).toHaveLength(2)
    expect(calls[1]!.messages[2]!.content).toContain(`"${P1_HIT_2}"`)
    expect(calls[1]!.messages[2]!.content).toContain('Return only the rewritten passage.')
    expect(r.done.revised).toContain("Those words were about Perplexity's robot, not Muse. Reading them across to Muse is our guess.\n")
    expect(r.done.self_check).toEqual({ passed: true, remaining: [], retried: true, confidence_restored: false })
  })
})

// ── Brick 2: the writer never sets Krish's confidence ─────────────────────

// Piece 1's call as it was written before 2026-09-26: one paragraph with a
// bold label, ending "Confidence: 70%." (walk log F41).
const CALL_PARAGRAPH = '**The Call.** By 30 June 2027, Amazon opens an authorised route for shopping agents, and that route still shows them sponsored listings. Confidence: 70%.'
const P1_PARAGRAPH = P1.replace(/## OUR PREDICTION[\s\S]*$/, CALL_PARAGRAPH)

describe('guardConfidence', () => {
  it('a first draft says "How sure we are: [Krish to set]", whatever the model wrote', () => {
    const r = guardConfidence(P3, null)
    expect(r.restored).toBe(true)
    expect(r.text).toBe(unset(P3))
    expect(guardConfidence(unset(P3), null)).toEqual({ text: unset(P3), restored: false })
    // Under the other label too, in the house form.
    expect(guardConfidence(P1_PARAGRAPH, null).text.endsWith('sponsored listings. How sure we are: [Krish to set].')).toBe(true)
  })

  it('a first draft that dropped the line gets the placeholder back, at the end of the call', () => {
    const r = guardConfidence(P3.replace('\n\nHow sure we are: 78%.', ''), null)
    expect(r.restored).toBe(true)
    expect(r.text.endsWith("echoing exactly the Nemotron-into-Koa move.\n\nHow sure we are: [Krish to set]")).toBe(true)
  })

  it('a rewrite keeps the source\'s "How sure we are:" number, and gets it back when dropped', () => {
    expect(guardConfidence(P1.replace('How sure we are: 70%.', 'How sure we are: 75%.'), P1)).toEqual({ text: P1, restored: true })
    expect(guardConfidence(P1.replace('\n\nHow sure we are: 70%.', ''), P1)).toEqual({ text: P1, restored: true })
    expect(guardConfidence(P1, P1)).toEqual({ text: P1, restored: false })
  })

  it('a rewrite keeps the source\'s "Confidence:" label and number, and gets it back when dropped', () => {
    expect(guardConfidence(P1_PARAGRAPH.replace('Confidence: 70%.', 'Confidence: 80%.'), P1_PARAGRAPH)).toEqual({ text: P1_PARAGRAPH, restored: true })
    expect(guardConfidence(P1_PARAGRAPH.replace('Confidence: 70%.', 'How sure we are: 80%.'), P1_PARAGRAPH)).toEqual({ text: P1_PARAGRAPH, restored: true })
    expect(guardConfidence(P1_PARAGRAPH.replace(' Confidence: 70%.', ''), P1_PARAGRAPH)).toEqual({ text: P1_PARAGRAPH, restored: true })
  })

  it('a rewrite of a piece waiting on Krish keeps the placeholder', () => {
    const waiting = unset(P3)
    expect(guardConfidence(P3, waiting)).toEqual({ text: waiting, restored: true })
  })

  it('leaves a labelled number outside the call alone: it is a fact about something else', () => {
    const text = P1.replace('## WHO GETS PAID', 'Consumer confidence: 62% in August.\n\n## WHO GETS PAID')
    expect(guardConfidence(text, P1)).toEqual({ text, restored: false })
  })
})

describe('the routes put the confidence back after the model and after any retry', () => {
  it('draft: the 78% piece 3 wrote on its own, in the first answer and again in the retry, becomes the placeholder', async () => {
    const out = await draft(asJson(P3), asJson(P3_R2_FIXED))
    expect(out.body.body.endsWith('How sure we are: [Krish to set].')).toBe(true)
    expect(out.body.body).not.toContain('78%')
    expect(out.body.self_check.confidence_restored).toBe(true)
    const written = db.updates.find(u => u.table === 'content_ideas')!.values as { body: string }
    expect(written.body).toBe(out.body.body)
  })

  it("revise: the source's confidence survives a rewrite that changed it, under both labels", async () => {
    const r = await revise({ instruction: 'Tighten it.', source_text: P1 }, P1_FIXED.replace('How sure we are: 70%.', 'How sure we are: 75%.'))
    expect(r.done.revised).toBe(P1_FIXED.trim())
    expect(r.done.self_check.confidence_restored).toBe(true)

    const fixedParagraph = P1_PARAGRAPH.replace(P1_HIT_1, "Those words were about Perplexity's robot.").replace(P1_HIT_2, 'Reading them across to Muse is our guess.')
    const again = await revise({ instruction: 'Tighten it.', source_text: P1_PARAGRAPH }, fixedParagraph.replace('Confidence: 70%.', 'How sure we are: 85%.'))
    expect(again.done.revised).toBe(fixedParagraph.trim())
    expect(again.done.self_check.confidence_restored).toBe(true)
  })

  it('revise: a confidence line the rewrite dropped is put back', async () => {
    const r = await revise({ instruction: 'Cut the ending.', source_text: P1 }, P1_FIXED.replace('\n\nHow sure we are: 70%.', ''))
    expect(r.done.revised.endsWith('still shows them sponsored listings.\n\nHow sure we are: 70%.')).toBe(true)
    expect(r.done.self_check.confidence_restored).toBe(true)
  })
})

// ── Brick 3: putting an in-place rewrite back ─────────────────────────────

const { passageReplacement, spliceSelection } = await import('../../apps/control-plane/api/_selection.js')

// Piece 1 after the broken scoped fixes: asked to delete the blender
// sentence, the in-place rewrite left the sentence before it twice.
const P1_V13 = fixture('piece1-v13-scoped-fixes.md')
const MUSE = "Muse is Meta's AI helper that shops for people."
const BLENDER = 'Send it to buy a blender and it buys the blender.'
const TWICE = `${MUSE} ${MUSE}`
// The text the deletion was asked of, rebuilt from v13. Its paragraph is the
// one the engine was given (piece 1 v12), byte for byte.
const BEFORE_DELETION = P1_V13.replace(TWICE, `${MUSE} ${BLENDER}`)
const DELETED = P1_V13.replace(TWICE, MUSE)

describe('the in-place splice', () => {
  it('reproduces 2026-09-30: handed the sentence before the passage, the old splice gives v13 and its duplicate', () => {
    const oldSplice = (source: string, selection: string, reply: string) => source.replace(selection, reply)
    expect(oldSplice(BEFORE_DELETION, BLENDER, MUSE)).toBe(P1_V13)
    expect(P1_V13).toContain(TWICE)
  })

  it('takes that echo off, so the deletion deletes the passage and nothing else', () => {
    const passage = passageReplacement(BEFORE_DELETION, BLENDER, MUSE)
    expect(passage).toBe('')
    expect(spliceSelection(BEFORE_DELETION, BLENDER, passage)).toBe(DELETED)
    expect(DELETED).toContain(`${MUSE} Nothing else on the page gets a look in.`)
  })

  it('takes off an echo on either side, or the whole draft sent back, and keeps the new words', () => {
    expect(passageReplacement(BEFORE_DELETION, BLENDER, `${MUSE} It buys what it was sent for.`)).toBe('It buys what it was sent for.')
    expect(passageReplacement(BEFORE_DELETION, BLENDER, `${MUSE} Nothing else on the page gets a look in.`)).toBe('')
    expect(passageReplacement(BEFORE_DELETION, BLENDER, BEFORE_DELETION.replace(BLENDER, 'It buys what it was sent for.'))).toBe('It buys what it was sent for.')
    // The start of the sentence the passage sits in.
    expect(passageReplacement(P1, "is our guess, not Amazon's claim.", 'Reading them across to Muse is our guess.')).toBe('is our guess.')
    // F2, 2026-09-24: a heading sent back with the sentence under it.
    const heading = passageReplacement(P1, '## WHAT DECIDES IT', "WHAT DECIDES IT\n\nAmazon's ad money is real today.")
    expect(heading).toBe('WHAT DECIDES IT')
  })

  it('leaves an answer alone that only starts with the same word as the text before it', () => {
    expect(passageReplacement('The cat sat. It ran off.', 'ran off.', 'Its owner ran.')).toBe('Its owner ran.')
    expect(passageReplacement(P1, P1_HIT_2, 'Reading them across to Muse is our guess.')).toBe('Reading them across to Muse is our guess.')
  })

  it('an empty replacement leaves one space, or the paragraph break, where the passage was', () => {
    expect(spliceSelection('One. Two. Three.', 'Two.', '')).toBe('One. Three.')
    expect(spliceSelection('One.\n\nTwo.\n\nThree.', 'Two.', '')).toBe('One.\n\nThree.')
    expect(spliceSelection('One. Two.\n\nThree.', 'Two.', '')).toBe('One.\n\nThree.')
    expect(spliceSelection('Two. Three.', 'Two.', '')).toBe('Three.')
    expect(spliceSelection('One. Two.', 'Two.', '')).toBe('One.')
  })

  it('a normal replacement goes where the passage was, its edge spaces kept, and a "$" in it is text', () => {
    expect(spliceSelection(P1, P1_HIT_2, 'Reading them across to Muse is our guess.')).toBe(P1.replace(P1_HIT_2, 'Reading them across to Muse is our guess.'))
    expect(spliceSelection('One. Two. Three.', ' Two. ', 'Deux.')).toBe('One. Deux. Three.')
    expect(spliceSelection('It cost $5.', '$5', "$&$' of $68.6 billion")).toBe("It cost $&$' of $68.6 billion.")
  })
})

describe('POST /api/content-ideas/:id/revise, in place', () => {
  it('the deletion that doubled a sentence on 2026-09-30 now deletes the sentence and nothing else', async () => {
    const r = await revise({ instruction: 'Delete this sentence.', source_text: BEFORE_DELETION, selection: BLENDER }, MUSE)
    expect(calls).toHaveLength(1)
    expect(r.done.revised).toBe(DELETED.trim())
    expect(r.done.revised).not.toContain(TWICE)
    expect(r.done.self_check).toEqual({ passed: true, remaining: [], retried: false, confidence_restored: false })
  })

  it('an empty answer deletes the passage', async () => {
    const r = await revise({ instruction: 'Delete this sentence.', source_text: BEFORE_DELETION, selection: BLENDER }, '')
    expect(r.done).toMatchObject({ ok: true, revised: DELETED.trim() })
  })

  it('an answer that echoes the sentence before keeps only its new words', async () => {
    const r = await revise({ instruction: 'Say it shorter.', source_text: BEFORE_DELETION, selection: BLENDER }, `${MUSE} It buys what it was sent for.`)
    expect(r.done.revised).toBe(BEFORE_DELETION.replace(BLENDER, 'It buys what it was sent for.').trim())
  })

  it('tells the model to return only the passage, and nothing to delete it', async () => {
    await revise({ instruction: 'Delete this sentence.', source_text: BEFORE_DELETION, selection: BLENDER }, '')
    expect(calls[0]!.messages[0]!.content).toContain('return only the rewritten version of this, with none of the text around it; to delete it, return nothing')
  })
})
