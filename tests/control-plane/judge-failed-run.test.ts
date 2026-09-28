import { beforeEach, describe, expect, it, vi } from 'vitest'

// A judge panel that could not reach the model is a failed run (walk log F28).
//
// From 2026-09-27 10:00 UTC the Anthropic account was over its usage limit.
// Every judge's refusal became an abstention, judge_verdicts gained 8,046
// blank rows that day and 11,079 the next, and the judge sweep logged `ok`
// every ten minutes while walking the same nine ideas. These tests hold the
// four properties that end that: a failed run writes no verdicts, says what
// the provider said, stops the pass when every call will be refused, and
// leaves each idea it reached a time to try again. A judge that ran and
// declined still abstains, and is still written.

// The voice block and the corpus are read from system_config through a
// dynamic import the database mock below does not reach, so they are stubbed
// here: without this the walk read the live database whenever the session had
// credentials, and failed in CI, which has none. The dead local address is a
// second guard, so nothing in this file can reach a real database.
vi.hoisted(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})
vi.mock('../../apps/control-plane/api/_content.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../apps/control-plane/api/_content.js')>()),
  loadVoiceBlock: async () => '',
  loadCorpus: async () => '',
}))

const db = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  updates: [] as Array<{ table: string; values: Record<string, any>; filters: Array<[string, unknown]> }>,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    from(table: string) {
      let pending: { values: Record<string, any>; filters: Array<[string, unknown]> } | null = null
      const chain: Record<string, any> = {}
      chain.select = () => chain
      for (const m of ['not', 'in', 'is', 'order', 'limit', 'neq']) chain[m] = () => chain
      chain.eq = (col: string, val: unknown) => { pending?.filters.push([col, val]); return chain }
      chain.update = (values: Record<string, any>) => { pending = { values, filters: [] }; return chain }
      chain.maybeSingle = async () => ({ data: (db.tables[table] || [])[0] ?? null, error: null })
      chain.single = chain.maybeSingle
      chain.then = (resolve: (v: unknown) => unknown) => {
        if (pending) { db.updates.push({ table, ...pending }); return Promise.resolve({ error: null }).then(resolve) }
        return Promise.resolve({ data: db.tables[table] || [], error: null }).then(resolve)
      }
      return chain
    },
  },
}))

const LIMIT = 'You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC.'
const refuse = (message: string, status = 400) => async () => { throw Object.assign(new Error(`anthropic_${status}:${message}`), { status }) }

const { runPanel, standing } = await import('../../apps/control-plane/api/_judges/panel.js')
const { rosterFor } = await import('../../apps/control-plane/api/_judges/roster.js')
const provider = await import('../../apps/control-plane/api/_modelProvider.js')
const ladder = await import('../../apps/control-plane/api/judge/ladder.js')
const { artifactHash } = await import('../../apps/control-plane/api/_judges/panel.js')

const ARTIFACT = 'Salesforce retrained an open model and called it its own. What it owns is the weights, and that is the story.'

describe('the panel', () => {
  it('every judge refused is a failed run, with the provider\'s words and reset time', async () => {
    const err = await runPanel({ gate: 'idea', subjectTable: 'content_ideas', subjectId: 'i1', artifact: ARTIFACT, context: 'c', call: refuse(LIMIT) })
      .then(() => null, (e: unknown) => e)
    expect(provider.isModelUnavailable(err)).toBe(true)
    const e = err as InstanceType<typeof provider.ModelUnavailableError>
    expect(e.stage).toBe('panel')
    expect(e.judges).toBe(rosterFor('idea').length)
    expect(e.failure.class).toBe('usage_limit')
    expect(e.failure.message).toBe(LIMIT)
    expect(e.failure.reset_at).toBe('2026-10-01T00:00:00.000Z')
  })

  it('an overload on every judge fails the run too, and says so', async () => {
    const err = await runPanel({ gate: 'draft', subjectTable: 'content_ideas', subjectId: 'i1', artifact: ARTIFACT, context: 'c', call: refuse('Overloaded', 529) })
      .then(() => null, (e: unknown) => e)
    expect(provider.isModelUnavailable(err)).toBe(true)
    expect((err as InstanceType<typeof provider.ModelUnavailableError>).failure.class).toBe('overload')
  })

  it('judges that ran and declined still abstain, and the panel is still a result', async () => {
    const declined = async () => JSON.stringify({ verdict: 'abstain', the_one_fix: 'I cannot judge a seed this thin.' })
    const panel = await runPanel({ gate: 'idea', subjectTable: 'content_ideas', subjectId: 'i1', artifact: ARTIFACT, context: 'c', call: declined })
    expect(panel.verdicts.every(v => v.verdict === 'abstain')).toBe(true)
    expect(panel.verdicts.some(v => /cannot judge a seed this thin/.test(String(v.the_one_fix)))).toBe(true)
    expect(standing(panel.verdicts).band).toBe('unjudged')
  })

  it('a free check that kills still ends the panel before any call', async () => {
    const call = vi.fn(refuse(LIMIT))
    const panel = await runPanel({
      gate: 'idea', subjectTable: 'content_ideas', subjectId: 'i1', artifact: ARTIFACT, context: 'c', call,
      deterministic: [{ judge: 'duplicate', verdict: 'kill', score: 0, the_one_fix: 'duplicate', evidence: ['same idea'] }],
    })
    expect(panel.short_circuited).toBe(true)
    expect(call).not.toHaveBeenCalled()
  })
})

describe('when an idea is tried again', () => {
  const NOW = new Date('2026-09-28T12:00:00Z')
  const hash = 'h'.repeat(64)

  it('a usage limit waits for the reset the provider named', () => {
    const f = ladder.nextLadderFailure(null, { reason: 'provider', class: 'usage_limit', message: LIMIT, status: 400, reset_at: '2026-10-01T00:00:00.000Z' }, hash, NOW)
    expect(f.retry_after).toBe('2026-10-01T00:00:00.000Z')
    expect(f.attempts).toBe(1)
  })

  it('a refusal with no reset waits an hour; a transient failure half an hour, doubling, up to a day', () => {
    expect(ladder.nextLadderFailure(null, { reason: 'provider', class: 'auth', message: 'invalid x-api-key', status: 401, reset_at: null }, hash, NOW).retry_after)
      .toBe('2026-09-28T13:00:00.000Z')
    const first = ladder.nextLadderFailure(null, { reason: 'provider', class: 'overload', message: 'Overloaded', status: 529, reset_at: null }, hash, NOW)
    expect(first.retry_after).toBe('2026-09-28T12:30:00.000Z')
    const second = ladder.nextLadderFailure(first, { reason: 'provider', class: 'overload', message: 'Overloaded', status: 529, reset_at: null }, hash, NOW)
    expect(second.attempts).toBe(2)
    expect(second.retry_after).toBe('2026-09-28T13:00:00.000Z')
    let f = second
    for (let i = 0; i < 10; i++) f = ladder.nextLadderFailure(f, { reason: 'abstained', class: 'all_abstained', message: 'x', status: null, reset_at: null }, hash, NOW)
    expect(Date.parse(f.retry_after) - NOW.getTime()).toBe(24 * 3_600_000)
  })

  it('the sweep leaves a backing-off idea alone until its time, and at once when its text changes', () => {
    const row = { idea: 'An idea', thesis: 'Its thesis', meta: {} as Record<string, unknown> }
    const own = artifactHash(`${row.idea}\n\n${row.thesis}`)
    row.meta = { ladder: { final: { band: 'unjudged' }, artifact_hash: own }, ladder_failure: { retry_after: '2026-10-01T00:00:00.000Z', artifact_hash: own } }
    expect(ladder.needsJudging(row, NOW)).toBe(false)
    expect(ladder.needsJudging(row, new Date('2026-10-01T00:00:01Z'))).toBe(true)
    expect(ladder.needsJudging({ ...row, thesis: 'Krish rewrote the thesis' }, NOW)).toBe(true)
  })

  it('an expansion refused for the account stops the walk; a model that declines, or an overload, does not', () => {
    const base = { angle: '', implications: [], scenarios: [], decision_rule: null, known: [], inferred: [], ok: false }
    expect(ladder.expansionRefusal({ ...base, why_not: `the expansion call failed: anthropic_400:${LIMIT}` })?.class).toBe('usage_limit')
    expect(ladder.expansionRefusal({ ...base, why_not: 'the seed could not be expanded' })).toBeNull()
    expect(ladder.expansionRefusal({ ...base, why_not: 'the expansion call failed: anthropic_529:Overloaded' })).toBeNull()
  })
})

describe('the run ledger hears it', () => {
  it('a pass stopped by a refusal of every call fails, in the provider\'s words', () => {
    const stopped = provider.classifyAnthropicFailure(new Error(`anthropic_400:${LIMIT}`))
    const out = ladder.ladderOutcome({ stopped, failed: 1, judged: 0 })
    expect(out.ok).toBe(false)
    expect(out.error).toMatch(/over its usage limit/)
    expect(out.error).toMatch(/2026-10-01 00:00 UTC/)
  })
  it('a pass that judged nothing it tried fails; one that judged some is a success with a warning', () => {
    expect(ladder.ladderOutcome({ stopped: null, failed: 3, judged: 0 }).ok).toBe(false)
    expect(ladder.ladderOutcome({ stopped: null, failed: 1, judged: 4 }).ok).toBe(true)
    expect(ladder.ladderOutcome({ stopped: null, failed: 0, judged: 0 }).ok).toBe(true)
  })
})

describe('the walk', () => {
  const MANDATES = ['follow_the_money', 'under_the_hood', 'mind_the_gap'].map(slug => ({ slug, label: slug, mandate: `the ${slug} mandate` }))
  const idea = (id: string, body: string | null) => ({
    id, idea: `Idea ${id} about who owns the weights`, thesis: 'The weights are the moat, and the benchmark is the marketing.',
    body, lane_slot: 'under_the_hood', meta: { ladder: { final: { band: 'ready' }, artifact_hash: 'old' } }, updated_at: '2026-09-28T09:00:00.000Z',
  })
  const deps = (call: (o: unknown) => Promise<string>) => {
    const persisted: unknown[] = []
    return {
      persisted,
      deps: {
        call: call as never, research: async () => null,
        persist: async (_id: string, panel: unknown) => { persisted.push(panel); return 'run' },
        commit: async () => {}, abandon: () => {}, deferrable: false,
      },
    }
  }
  const BODY = 'Salesforce took an open model, trained it on invented customers, and sold it as twenty seven years of wisdom. The weights are the part it owns.'

  beforeEach(() => {
    db.updates.length = 0
    db.tables = {
      venture_formats: MANDATES,
      agents: [{ brief_content: 'what Krish does' }],
      system_config: [],
      content_ideas: [idea('a', BODY), idea('b', BODY)],
    }
  })

  it('a usage limit stops the pass at the first idea, writes no verdict and no band, only when to try again', async () => {
    const { deps: d, persisted } = deps(refuse(LIMIT))
    const report = await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: d })
    expect(report.failed).toBe(1)
    expect(report.stopped?.class).toBe('usage_limit')
    expect(report.judged).toBe(0)
    expect(persisted).toHaveLength(0)
    expect(db.updates).toHaveLength(1)
    const u = db.updates[0]!
    expect(u.values.meta.ladder_failure.retry_after).toBe('2026-10-01T00:00:00.000Z')
    expect(u.values.meta.ladder).toEqual({ final: { band: 'ready' }, artifact_hash: 'old' })
    expect(u.filters).toContainEqual(['updated_at', '2026-09-28T09:00:00.000Z'])
    expect(ladder.ladderOutcome(report).ok).toBe(false)
  })

  it('a seed whose expansion is refused for the account stops before any judge is called', async () => {
    db.tables.content_ideas = [idea('a', null), idea('b', null)]
    const call = vi.fn(refuse(LIMIT))
    const report = await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: deps(call).deps })
    expect(call).toHaveBeenCalledTimes(1)
    expect(report.stopped?.class).toBe('usage_limit')
  })

  it('an overload fails each idea on its own and backs it off, without stopping the pass', async () => {
    const report = await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: deps(refuse('Overloaded', 529)).deps })
    expect(report.failed).toBe(2)
    expect(report.stopped).toBeNull()
    expect(db.updates.map(u => u.values.meta.ladder_failure.class)).toEqual(['overload', 'overload'])
    expect(ladder.ladderOutcome(report).ok).toBe(false)
  })

  it('an idea still backing off is skipped without a call', async () => {
    const waiting = idea('a', BODY)
    const own = artifactHash(`${waiting.idea}\n\n${waiting.thesis}`)
    ;(waiting.meta as Record<string, unknown>).ladder_failure = { retry_after: new Date(Date.now() + 3_600_000).toISOString(), artifact_hash: own }
    db.tables.content_ideas = [waiting]
    const call = vi.fn(refuse(LIMIT))
    const report = await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: deps(call).deps })
    expect(call).not.toHaveBeenCalled()
    expect(report.backed_off).toBe(1)
  })

  it('judges that ran and declined are written as a reading, counted as unjudged and never as escalated', async () => {
    db.tables.content_ideas = [idea('a', BODY)]
    const declined = async () => JSON.stringify({ verdict: 'abstain', the_one_fix: 'I cannot judge this.' })
    const { deps: d, persisted } = deps(declined)
    const report = await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: d })
    expect(persisted).toHaveLength(1)
    expect(report.unjudged).toBe(1)
    expect(report.escalated).toBe(0)
    expect(report.failed).toBe(0)
    const u = db.updates[0]!
    expect(u.values.meta.ladder.final.band).toBe('unjudged')
    expect(u.values.meta.ladder_failure.reason).toBe('abstained')
    expect(ladder.ladderOutcome(report).ok).toBe(true)
  })
})

describe('the sweep\'s pause', () => {
  it('a usage limit pauses the sweep until the reset; after it, the next tick may try once', () => {
    const f = provider.classifyAnthropicFailure(new Error(`anthropic_400:${LIMIT}`), new Date('2026-09-27T10:00:00Z'))
    const before = new Date('2026-09-28T19:00:00Z')
    const h = provider.providerHealth(f, null, before)
    expect(h.state).toBe('unavailable')
    expect(provider.providerRefusing(h, before)).toBe(true)
    const after = new Date('2026-10-01T00:10:00Z')
    expect(provider.providerRefusing(provider.providerHealth(f, null, after), after)).toBe(false)
  })
  it('a refused key pauses for an hour, then lets one tick try; a success ends the pause', () => {
    const f = provider.classifyAnthropicFailure(new Error('anthropic_401:invalid x-api-key'), new Date('2026-09-28T10:00:00Z'))
    expect(provider.providerRefusing(provider.providerHealth(f, null, new Date('2026-09-28T10:30:00Z')), new Date('2026-09-28T10:30:00Z'))).toBe(true)
    expect(provider.providerRefusing(provider.providerHealth(f, null, new Date('2026-09-28T11:01:00Z')), new Date('2026-09-28T11:01:00Z'))).toBe(false)
    const ok = provider.providerHealth(f, '2026-09-28T10:20:00.000Z', new Date('2026-09-28T10:30:00Z'))
    expect(ok.usable).toBe(true)
    expect(provider.providerRefusing(ok, new Date('2026-09-28T10:30:00Z'))).toBe(false)
  })
})

describe('the sweep route', () => {
  const failure = (at: string) => JSON.stringify({ ...provider.classifyAnthropicFailure(new Error(`anthropic_400:${LIMIT}`), new Date(at)), agent: 'judge-novelty' })
  const secret = ['synthetic', 'cron', 'secret', 'for', 'the', 'sweep'].join('-')

  async function tick() {
    process.env.CRON_SECRET = secret
    const { default: handler } = await import('../../apps/control-plane/api/judge/sweep.js')
    const out = { status: 0, body: undefined as any }
    const res: Record<string, any> = {
      statusCode: 200,
      setHeader() { return res },
      status(code: number) { out.status = code; res.statusCode = code; return res },
      json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
      end() { return res },
    }
    await handler({ method: 'GET', headers: { authorization: `Bearer ${secret}` }, query: {}, body: {} } as never, res as never)
    return out
  }

  beforeEach(() => { db.updates.length = 0; db.tables = { judge_sweeps: [], system_config: [], content_ideas: [] } })

  it('a recorded usage limit pauses the tick before any sweep, and fails it in the provider\'s words', async () => {
    // The route reads the real clock, so the reset is placed two days ahead of it.
    const reset = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
    const said = `You have reached your specified API usage limits. You will regain access on ${reset} at 00:00 UTC.`
    db.tables.system_config = [{ key: provider.FAILURE_KEY, value: JSON.stringify(provider.classifyAnthropicFailure(new Error(`anthropic_400:${said}`), new Date(Date.now() - 3_600_000))) }]
    const { providerPause } = await import('../../apps/control-plane/api/judge/sweep.js')
    const paused = await providerPause()
    expect(paused?.ok).toBe(false)
    expect(paused?.retry_after).toBe(`${reset}T00:00:00.000Z`)
    const out = await tick()
    expect(out.status).toBe(503)
    expect(out.body.ok).toBe(false)
    expect(out.body.state).toBe('provider_unavailable')
    expect(String(out.body.error)).toMatch(/cannot write or check anything/)
  })

  it('a success recorded after the failure lets the sweep run', async () => {
    db.tables.system_config = [
      { key: provider.FAILURE_KEY, value: failure('2026-09-28T10:00:00Z') },
      { key: provider.OK_KEY, value: '2026-09-28T11:00:00.000Z' },
    ]
    const { providerPause } = await import('../../apps/control-plane/api/judge/sweep.js')
    expect(await providerPause(new Date('2026-09-28T12:00:00Z'))).toBeNull()
    const out = await tick()
    expect(out.body).toEqual({ ok: true, state: 'idle', ideas: 0 })
  })
})
