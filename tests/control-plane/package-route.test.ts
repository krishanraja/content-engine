import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// POST /api/content-ideas/:id/package (walk log F59 and F65).
//
// The YouTube title and description for a piece's video, and the title and
// subtitle the piece goes out under on Substack, written by the engine in one
// call, checked by lintPackage and lintSubstack (api/_packaging.ts), asked
// for once more when something fails and never a third time, and kept beside
// the channel cuts in transformed_outputs. Every model call here is a stubbed
// fetch and the database is a stub: no test reaches a provider or a real
// database.

vi.hoisted(() => {
  // _supabase.ts throws at load without these. A dead local address, so a
  // missing stub fails as a connection error and never as a real write.
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})

const db = vi.hoisted(() => ({
  row: null as null | Record<string, any>,
  /** Whether the guarded write finds the row unchanged. */
  unchanged: true,
  updates: [] as Array<{ table: string; values: any; filters: Array<[string, unknown]> }>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    rpc: async () => ({ error: null }),
    from(table: string) {
      const chain: Record<string, any> = {}
      let update: { table: string; values: any; filters: Array<[string, unknown]> } | null = null
      for (const m of ['select', 'in', 'order', 'limit']) chain[m] = () => chain
      chain.eq = (col: string, val: unknown) => { update?.filters.push([col, val]); return chain }
      chain.single = async () => ({ data: table === 'content_ideas' ? db.row : null, error: null })
      chain.maybeSingle = chain.single
      chain.update = (values: unknown) => { update = { table, values, filters: [] }; db.updates.push(update); return chain }
      chain.insert = async () => ({ error: null })
      chain.upsert = async () => ({ error: null })
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: table === 'content_ideas' && db.unchanged ? [{ id: ID }] : [], error: null }).then(resolve)
      return chain
    },
  },
}))

// The config readers: the voice block and the mandate are live rows.
vi.mock('../../apps/control-plane/api/_content.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../apps/control-plane/api/_content.js')>()),
  loadVoiceBlock: async () => 'THE VOICE BLOCK',
}))
vi.mock('../../apps/control-plane/api/_subchannels.js', () => ({
  LIVE_SUBCHANNELS: ['follow_the_money', 'mind_the_gap', 'under_the_hood'],
  loadSubchannel: async (v?: string | null) => (v === 'follow_the_money'
    ? { slug: 'follow_the_money', label: 'follow.the.money', mandate: 'Where does the money move, and who ends up better or worse off?' }
    : null),
}))

const TOKEN = 'eot_' + 'p'.repeat(40)
const ID = '00000000-0000-4000-8000-0000000f5901'
const LIMIT = 'You have reached your specified API usage limits. You will regain access on 2099-10-01 at 00:00 UTC.'
const PIECE_1 = readFileSync('tests/fixtures/control-plane/piece1-v13-scoped-fixes.md', 'utf8')
const THUMBNAIL = 'When an AI agent does your shopping, who gets paid?'
const EXISTING_CUT = { body: 'The YouTube script.', generated_at: '2026-10-05T09:00:00.000Z' }

const GOOD = {
  title: "Amazon blocked Meta's AI shopping agent. Shopify let it in.",
  alternates: [
    { title: "Why Amazon blocked Meta's AI shopping agent", why: 'For search.' },
    { title: THUMBNAIL, why: 'If the thumbnail changes.' },
  ],
  description: [
    "Amazon blocked Meta's new AI shopping agent. Shopify plugged it into its checkout. Here's who an AI agent threatens, who it pays, and where you could get stung. | 2 minute watch",
    'Our prediction: by 30 June 2027, Amazon opens an authorised route for shopping agents, and that route still shows them sponsored listings.',
    'Read the full piece free at makeyourmindup.ai',
  ].join('\n\n'),
  // 58 characters, and a first sentence of 44 that a phone's feed shows whole.
  substack_title: "Amazon blocked Meta's AI shopping agent. So who gets paid?",
  substack_subtitle: "Amazon blocked Meta's new AI shopping agent. Shopify plugged it into its checkout.",
  why: 'Names everyone knows, a plain conflict, and a question the video answers.',
}
// Krish's own first try, and a description with no line to the piece.
const BAD = { ...GOOD, title: 'AI AGENTS are Muse, Dot and the next wave of agents are now going shopping. When an AI agent does your shopping,', description: GOOD.description.replace('Read the full piece free at makeyourmindup.ai', '') }
// The title article 1 went out under on Substack, which the feed on his
// phone cut off at about 110 characters.
const SUBSTACK_122 = 'Muse, Dot and the next wave of agents are now going shopping. When an AI agent does your shopping, who actually gets paid?'
// The YouTube fields only, as the step wrote them before it wrote Substack's.
const NO_SUBSTACK = { title: GOOD.title, alternates: GOOD.alternates, description: GOOD.description, why: GOOD.why }

const calls: Array<{ agent: string | null; system: string; messages: Array<{ role: string; content: string }> }> = []
const text = (t: string) => new Response(JSON.stringify({ content: [{ type: 'text', text: t }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 })

function upstream(answers: Array<unknown | 'refuse'>) {
  return async (url: string, init: { body?: string }) => {
    // A dynamic import of the database client can miss the mock and get the
    // real one, whose address is the dead one above. Its request lands here.
    if (String(url).startsWith('http://127.0.0.1:9/')) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    const req = JSON.parse(String(init.body))
    calls.push({ agent: null, system: JSON.stringify(req.system), messages: req.messages })
    const answer = answers[calls.length - 1]
    if (answer === undefined) throw new Error(`unexpected model call ${calls.length}`)
    if (answer === 'refuse') return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: LIMIT } }), { status: 400 })
    return text(typeof answer === 'string' ? answer : JSON.stringify(answer))
  }
}

const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/package.js')
const provider = await import('../../apps/control-plane/api/_modelProvider.js')

async function pack(answers: Array<unknown | 'refuse'>, body: Record<string, unknown> = { thumbnail_text: THUMBNAIL, video_seconds: 120 }, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) {
  vi.stubGlobal('fetch', vi.fn(upstream(answers)))
  const out = { status: 0, headers: {} as Record<string, string>, body: undefined as any }
  const res: Record<string, any> = {
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v; return res },
    status(code: number) { out.status = code; return res },
    json(b: unknown) { out.body = b; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  try {
    await handler({ method: 'POST', headers, query: { id: ID }, body } as never, res as never)
  } finally {
    vi.unstubAllGlobals()
  }
  return out
}

const written = () => db.updates.filter(u => u.table === 'content_ideas')

beforeEach(() => {
  db.row = {
    id: ID, idea: 'Same agent, opposite answers', thesis: null, body: PIECE_1, lane_slot: 'follow_the_money',
    source_url: null, meta: {}, transformed_outputs: { youtube: EXISTING_CUT }, updated_at: '2026-10-05T10:00:00.000Z',
  }
  db.unchanged = true
  db.updates.length = 0
  calls.length = 0
  provider.resetProviderMemory()
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  process.env.ANTHROPIC_API_KEY = 'sk-test-not-a-key'
})

describe('POST /api/content-ideas/:id/package', () => {
  it('writes a title that passes once, keeps it beside the channel cuts, and publishes nothing', async () => {
    const r = await pack([GOOD])
    expect(r.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(r.body.ok).toBe(true)
    expect(r.body.package).toMatchObject({
      title: GOOD.title, description: GOOD.description, why: GOOD.why,
      substack_title: GOOD.substack_title, substack_subtitle: GOOD.substack_subtitle,
      thumbnail_text: THUMBNAIL, video_seconds: 120, retried: false, note: null,
      lint: { passed: true, problems: [] },
    })
    expect(r.body.package.alternates.map((a: any) => a.title)).toEqual(GOOD.alternates.map(a => a.title))
    expect(r.body.outputs).toEqual(['youtube', 'youtube_package'])
    const [w] = written()
    expect(w!.values.transformed_outputs.youtube).toEqual(EXISTING_CUT)
    expect(w!.values.transformed_outputs.youtube_package).toEqual(r.body.package)
    expect(w!.values).not.toHaveProperty('body')
    expect(w!.filters).toEqual([['id', ID], ['updated_at', '2026-10-05T10:00:00.000Z']])
  })

  it('the writer reads the voice, the house rules with the ruling, the mandate, the rules block, the thumbnail and the length', async () => {
    await pack([GOOD], { thumbnail_text: THUMBNAIL, video_seconds: 120, hint: 'lead with Shopify' })
    const { system, messages } = calls[0]!
    expect(system).toContain('THE VOICE BLOCK')
    expect(system).toContain('When writing the YouTube title and description for a video')
    expect(system).toContain('The title and subtitle the piece itself goes out under on Substack keep the same rules')
    expect(system).toContain('Where does the money move, and who ends up better or worse off?')
    expect(system).toContain("A WORKED EXAMPLE, from the piece about Amazon, Meta's AI shopping agent and Shopify")
    expect(system).toContain('THE SUBSTACK SUBTITLE')
    expect(system).toContain('The title Krish published the piece under on Substack, 122 characters')
    expect(messages[0]!.content).toContain(`THUMBNAIL TEXT, read together with the YouTube title: "${THUMBNAIL}"`)
    expect(messages[0]!.content).toContain('"substack_title": string, "substack_subtitle": string')
    expect(messages[0]!.content).toContain('" | 2 minute watch"')
    expect(messages[0]!.content).toContain('A STEER FROM THE PERSON ASKING: lead with Shopify')
  })

  it('asks once more when something fails, listing each problem, and keeps the answer that fails less', async () => {
    const r = await pack([BAD, GOOD])
    expect(r.status).toBe(200)
    expect(calls).toHaveLength(2)
    const retry = calls[1]!.messages
    expect(retry.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(retry[1]!.content).toBe(JSON.stringify(BAD))
    expect(retry[2]!.content).toMatch(/- The title: The title is 112 characters\./)
    expect(retry[2]!.content).toMatch(/- The description: The description has no "Read the full piece free at makeyourmindup\.ai" line\./)
    expect(r.body.package).toMatchObject({ title: GOOD.title, retried: true, note: null, lint: { passed: true } })
  })

  it('never asks a third time: what still fails is stored and shown', async () => {
    const r = await pack([BAD, BAD, GOOD])
    expect(calls).toHaveLength(2)
    expect(r.status).toBe(200)
    expect(r.body.package.title).toBe(BAD.title)
    expect(r.body.package.retried).toBe(true)
    expect(r.body.package.note).toBe('The second try broke as many rules as the first, so this is the first answer.')
    expect(r.body.package.lint.passed).toBe(false)
    expect(r.body.package.lint.problems.filter((p: any) => p.level === 'fail').map((p: any) => p.rule)).toEqual(['TITLE_LENGTH', 'NO_SHOUTING', 'READ_LINE'])
    expect(written()[0]!.values.transformed_outputs.youtube_package.lint.passed).toBe(false)
  })

  it('a Substack title past the cap is sent back in the same one retry, and the answer that fits is kept', async () => {
    const r = await pack([{ ...GOOD, substack_title: SUBSTACK_122 }, GOOD])
    expect(calls).toHaveLength(2)
    const correction = calls[1]!.messages[2]!.content
    expect(correction).toMatch(/- The Substack title: The Substack title is 122 characters\. Substack's feed on a phone cuts a title off at about 110/)
    expect(correction).not.toMatch(/- The title:|- The description:/)
    expect(r.status).toBe(200)
    expect(r.body.package).toMatchObject({ title: GOOD.title, substack_title: GOOD.substack_title, retried: true, note: null, lint: { passed: true } })
    expect(written()[0]!.values.transformed_outputs.youtube_package.substack_title).toBe(GOOD.substack_title)
  })

  it('an answer without the Substack title and subtitle keeps the YouTube one, asks once more, and stores what still fails', async () => {
    const r = await pack([NO_SUBSTACK, NO_SUBSTACK])
    expect(calls).toHaveLength(2)
    expect(calls[1]!.messages[2]!.content).toMatch(/- The Substack title: There is no Substack title\./)
    expect(calls[1]!.messages[2]!.content).toMatch(/- The Substack subtitle: There is no Substack subtitle\./)
    expect(r.status).toBe(200)
    expect(r.body.package).toMatchObject({
      title: GOOD.title, description: GOOD.description, substack_title: null, substack_subtitle: null,
      retried: true, note: 'The second try broke as many rules as the first, so this is the first answer.',
    })
    expect(r.body.package.lint.problems.filter((p: any) => p.level === 'fail').map((p: any) => [p.rule, p.field]))
      .toEqual([['SUBSTACK_TITLE_LENGTH', 'substack_title'], ['SUBTITLE_LENGTH', 'substack_subtitle']])
  })

  it('Krish\'s own Substack subtitle passes, with a warning that it runs past 150', async () => {
    const r = await pack([{ ...GOOD, substack_subtitle: "Amazon blocked Meta's new AI shopping agent. Shopify plugged it into its checkout. Here's who an AI agent threatens, who it pays, and where you could get stung." }])
    expect(calls).toHaveLength(1)
    expect(r.body.package.lint).toEqual({
      passed: true,
      problems: [{ rule: 'SUBTITLE_LENGTH', field: 'substack_subtitle', level: 'warn', detail: 'The subtitle is 160 characters. Aim for 150 or fewer: a line or two under the title.' }],
    })
  })

  it('a second try the provider refuses keeps the first answer, with a note', async () => {
    const r = await pack([BAD, 'refuse'])
    expect(r.status).toBe(200)
    expect(r.body.package.title).toBe(BAD.title)
    expect(r.body.package.retried).toBe(false)
    expect(r.body.package.note).toMatch(/^The second try did not run\. .*This is the first answer\.$/)
  })

  it('a refused first call is the typed failure revise gives, and nothing is written', async () => {
    const r = await pack(['refuse'])
    expect(r.status).toBe(503)
    expect(r.body).toMatchObject({ ok: false, error: 'package_failed', code: 'provider_usage_limit', provider_class: 'usage_limit', message: LIMIT })
    expect(r.body.detail).toMatch(/^The title and description did not run\./)
    expect(written()).toHaveLength(0)
  })

  it('an answer with no title or description is empty_output, and nothing is written', async () => {
    const r = await pack(['I cannot help with that.'])
    expect(r.status).toBe(502)
    expect(r.body).toMatchObject({ ok: false, error: 'package_failed', code: 'empty_output' })
    expect(written()).toHaveLength(0)
  })

  it('a piece with no body is refused before any model call, as channel-cut refuses it', async () => {
    db.row!.body = 'A headline.'
    const r = await pack([GOOD])
    expect(r.status).toBe(409)
    expect(r.body).toMatchObject({ ok: false, error: 'no_draft' })
    expect(calls).toHaveLength(0)
  })

  it('a change made during the call is never written over; the package comes back', async () => {
    db.unchanged = false
    const r = await pack([GOOD])
    expect(r.status).toBe(409)
    expect(r.body).toMatchObject({ ok: false, error: 'changed_during_package', package: { title: GOOD.title } })
  })

  it('a length that is not a length is refused before any read or call', async () => {
    const r = await pack([GOOD], { video_seconds: 'two minutes' })
    expect(r.status).toBe(400)
    expect(calls).toHaveLength(0)
    expect(written()).toHaveLength(0)
  })

  it('no credentials, no call', async () => {
    const r = await pack([GOOD], {}, {})
    expect(r.status).toBe(401)
    expect(calls).toHaveLength(0)
  })
})
