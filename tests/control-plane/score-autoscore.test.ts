import assert from 'node:assert/strict'
import { beforeEach, describe, test, vi } from 'vitest'

// The autoscore exception on /api/content-ideas/:id/score.
//
// The Postgres trigger that scores a row when it first gets a body calls this
// route through pg_net with no credential. Gating the idea routes would have
// switched quality scoring off silently, so the route admits that one request
// and nothing wider. These cases pin how narrow "nothing wider" is.

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  scoredDraft: null as string | null,
  scoredModel: undefined as string | undefined,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => (state.row ? { data: state.row, error: null } : { data: null, error: { message: 'none' } }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => { state.updates.push(patch); return { error: null } },
      }),
    }),
  },
}))

vi.mock('../../apps/control-plane/api/_standards.js', () => ({
  scoreStandards: async (input: { draft: string }, opts: { model?: string }) => {
    state.scoredDraft = input.draft
    state.scoredModel = opts.model
    return { scores: {}, failing: [], notes: '', verdict: 'ok', fix: null, quality_score: 'green' }
  },
}))

vi.mock('../../apps/control-plane/api/_content.js', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  loadCorpus: async () => '',
}))

const TOKEN = 'eot_' + 'e'.repeat(40)

async function call(body: unknown, headers: Record<string, string> = {}) {
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  delete process.env.ACCESS_CODE
  const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/score.js')
  let status = 0
  const res = {
    setHeader() {},
    status(code: number) { status = code; return res },
    json() { return res },
    end() { return res },
  }
  await handler({ method: 'POST', headers, query: { id: 'row-1' }, body } as never, res as never)
  return status
}

const UNSCORED = { idea: 'An idea', thesis: 'A thesis', body: 'A stored draft long enough to score, well past forty characters.', source_type: 'manual', meta: {}, quality_score: null }

describe('score: the autoscore exception', () => {
  beforeEach(() => {
    state.row = null
    state.updates = []
    state.scoredDraft = null
    state.scoredModel = undefined
  })

  test('the trigger\'s exact request scores an unscored row with the cheap model', async () => {
    state.row = { ...UNSCORED }
    assert.equal(await call({ model: 'haiku' }), 200)
    assert.equal(state.scoredDraft, UNSCORED.body, 'it scores the stored body')
    assert.match(String(state.scoredModel), /haiku/)
    assert.equal(state.updates.length, 1)
  })

  test('an already-scored row is refused, so the exception cannot be replayed', async () => {
    state.row = { ...UNSCORED, quality_score: 'amber' }
    assert.equal(await call({ model: 'haiku' }), 401)
    assert.equal(state.updates.length, 0)
  })

  test('supplying text, or any other field, is not the trigger and needs a credential', async () => {
    state.row = { ...UNSCORED }
    assert.equal(await call({ model: 'haiku', source_text: 'text the caller chose' }), 401)
    assert.equal(await call({ model: 'sonnet' }), 401)
    assert.equal(await call({}), 401)
    assert.equal(state.updates.length, 0)
  })

  test('with the operator token, the full route is available as before', async () => {
    state.row = { ...UNSCORED, quality_score: 'amber' }
    assert.equal(await call({ source_text: 'a rescore of new text' }, { authorization: `Bearer ${TOKEN}` }), 200)
    assert.equal(state.scoredDraft, 'a rescore of new text')
  })
})
