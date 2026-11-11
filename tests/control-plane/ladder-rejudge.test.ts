import { beforeEach, describe, expect, it, vi } from 'vitest'

// An idea whose score is current is not judged again (docs/plans/2026-11-11-ideas-wave1-diagnosis.md).
//
// Measured 11 November on sweep 8903e989: four ideas (9eda3e4a, 428d8b21,
// 0224fe5f, 3575b38b) were judged one morning and judged again first thing the
// next, though nobody had touched them. Each had been repaired, and each
// repair's words carried an em dash. The ladder hashed the repair's raw words
// into its record and then stored them cleaned (sanitizeVoice turns a dash into
// a comma), so the record named text that was not on the row, needsJudging read
// that as an edit, and the next sweep paid for the whole panel again. Here the
// repair is cleaned as it arrives, so the panel judges, the row stores and the
// record hashes the same words.

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

const ladder = await import('../../apps/control-plane/api/judge/ladder.js')
const { artifactHash } = await import('../../apps/control-plane/api/_judges/panel.js')

const MANDATES = ['follow_the_money', 'under_the_hood', 'mind_the_gap'].map(slug => ({ slug, label: slug, mandate: `the ${slug} mandate` }))
const BODY = 'Salesforce took an open model, trained it on invented customers, and sold it as twenty seven years of wisdom. The weights are the part it owns.'
const ROW = {
  id: 'i-9eda', idea: 'Salesforce retrained an open model and called it its own', thesis: 'The weights are the moat and the benchmark is the marketing.',
  body: BODY, lane_slot: 'under_the_hood', meta: {}, updated_at: '2026-11-02T04:00:00.000Z',
}

// The repair's reply as the model wrote it on 2 November: dashes and all.
const REPAIR = {
  idea: 'Salesforce owns the weights it retrained — not the twenty seven years of wisdom its launch claimed',
  thesis: 'Salesforce retrained an open model on synthetic customers and sells the result as its own judgement — the part it can prove it owns is the weights. ' +
    'This is wrong if its filing names a customer dataset the model was trained on.',
  what_i_changed: 'Named the one thing it owns.',
  cannot_fix: null,
}

/** Judges score the first reading 6 (repairable) and the repaired words 8. */
function model() {
  const seen: Array<{ agent: string; user: string }> = []
  const call = async (o: { agent?: string; user: string }) => {
    const agent = String(o.agent || '')
    seen.push({ agent, user: o.user })
    if (agent === 'ladder-repair') return JSON.stringify(REPAIR)
    if (agent === 'ladder-router') return '{}'
    if (agent.startsWith('judge-')) {
      const repaired = o.user.includes('owns the weights it retrained')
      return JSON.stringify({
        verdict: repaired ? 'pass' : 'revise', score: repaired ? 8 : 6,
        the_one_fix: 'Name what Salesforce can prove it owns.', evidence: ['"called it its own"'], confidence: 0.8,
      })
    }
    throw new Error(`unexpected call: ${agent}`)
  }
  return { seen, call }
}

const deps = (call: unknown) => ({
  call: call as never, research: async () => null,
  persist: async () => 'run', commit: async () => {}, abandon: () => {}, deferrable: false,
})

beforeEach(() => {
  db.updates.length = 0
  db.tables = {
    venture_formats: MANDATES,
    agents: [{ brief_content: 'what Krish does' }],
    system_config: [],
    content_ideas: [structuredClone(ROW)],
  }
})

describe('a repaired idea', () => {
  it('is stored, judged and recorded as the same cleaned words', async () => {
    const { seen, call } = model()
    const report = await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: deps(call) })
    expect(report.repairs).toBe(1)
    expect(report.ready).toBe(1)

    const write = db.updates.find(u => u.table === 'content_ideas')!
    const { idea, thesis, meta } = write.values
    expect(idea).toBe('Salesforce owns the weights it retrained, not the twenty seven years of wisdom its launch claimed')
    expect(thesis).not.toMatch(/[—–]/)
    // The record names exactly the text on the row.
    expect(meta.ladder.artifact_hash).toBe(artifactHash(`${idea}\n\n${thesis}`))
    // And the panel read those words, not the dashed ones.
    const rejudged = seen.filter(s => s.agent.startsWith('judge-') && s.user.includes('owns the weights it retrained'))
    expect(rejudged.length).toBeGreaterThan(0)
    expect(rejudged.every(s => !/[—–]/.test(s.user))).toBe(true)
  })

  it('is not judged again by the next sweep, and nothing is paid for it', async () => {
    await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: deps(model().call) })
    const write = db.updates.find(u => u.table === 'content_ideas')!.values
    const stored = { ...ROW, idea: write.idea, thesis: write.thesis, meta: write.meta }
    expect(ladder.needsJudging(stored)).toBe(false)

    db.updates.length = 0
    db.tables.content_ideas = [stored]
    const next = model()
    const again = await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: deps(next.call) })
    expect(again.skipped).toBe(1)
    expect(again.judged).toBe(0)
    expect(next.seen).toHaveLength(0)
    expect(db.updates).toHaveLength(0)
  })

  it('is judged again once its words really change', async () => {
    await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: deps(model().call) })
    const write = db.updates.find(u => u.table === 'content_ideas')!.values
    expect(ladder.needsJudging({ idea: write.idea, thesis: `${write.thesis} Krish added a line.`, meta: write.meta })).toBe(true)
  })

  it('an idea with no repair keeps the record of its own words, untouched', async () => {
    const pass = async (o: { agent?: string }) => String(o.agent).startsWith('judge-')
      ? JSON.stringify({ verdict: 'pass', score: 8, the_one_fix: '', evidence: ['"its own"'], confidence: 0.9 })
      : '{}'
    await ladder.runLadder({ limit: 10, ids: [], dryRun: false, deps: deps(pass) })
    const write = db.updates.find(u => u.table === 'content_ideas')!.values
    expect(write.idea).toBeUndefined()
    expect(write.meta.ladder.artifact_hash).toBe(artifactHash(`${ROW.idea}\n\n${ROW.thesis}`))
    expect(ladder.needsJudging({ ...ROW, meta: write.meta })).toBe(false)
  })
})
