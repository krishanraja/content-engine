import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'

// Whose event is it.
//
// The weekly compiler learns Krish's taste from content_edit_events, whose
// actor column defaults to 'Krish'. Before 2026-09-24 an agent session driving
// the engine on the operator token wrote rows that took that default, so its
// own drafts and rewrites would have been learned as his. Found on the
// three-piece walk. These cases pin the rule the Studio already holds: an
// event whose origin is not Krish is an observation, never a preference.

process.env.SUPABASE_URL = 'http://127.0.0.1:9'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
delete process.env.ANTHROPIC_API_KEY

const TOKEN = 'eot_' + 'c'.repeat(40)
const BEARER = { authorization: `Bearer ${TOKEN}` }

function fakeRes() {
  const out = { status: 0, body: undefined as unknown }
  const res = {
    setHeader() {},
    status(code: number) { out.status = code; return res },
    json(b: unknown) { out.body = b; return res },
    end() { return res },
  }
  return { res, out }
}

async function call(path: string, req: Record<string, unknown>) {
  const prev = process.env.ENGINE_OPERATOR_TOKEN
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  try {
    const mod = await import(path)
    const { res, out } = fakeRes()
    await mod.default({ method: 'POST', headers: {}, query: {}, ...req } as never, res as never)
    return out
  } finally {
    if (prev === undefined) delete process.env.ENGINE_OPERATOR_TOKEN
    else process.env.ENGINE_OPERATOR_TOKEN = prev
  }
}

describe('operatorAttribution', () => {
  test('a browser request is not an operator, so its events stay his', async () => {
    const { operatorAttribution } = await import('../../apps/control-plane/api/_editEvents.js')
    assert.equal(operatorAttribution(undefined, {}), null)
  })

  test('an operator session acts as itself, and its events are observations', async () => {
    const { operatorAttribution } = await import('../../apps/control-plane/api/_editEvents.js')
    assert.deepEqual(operatorAttribution(BEARER.authorization, {}), { surface: 'api', client: 'claude_code', actor: 'claude_code', observation: true })
    assert.equal(operatorAttribution(BEARER.authorization, { client: 'codex' })?.actor, 'codex')
  })

  test('an operator cannot pass for a device', async () => {
    const { operatorAttribution } = await import('../../apps/control-plane/api/_editEvents.js')
    assert.equal(operatorAttribution(BEARER.authorization, { client: 'desktop' })?.client, 'claude_code')
  })

  test("relaying Krish's decision is explicit, and only then is the row his", async () => {
    const { operatorAttribution } = await import('../../apps/control-plane/api/_editEvents.js')
    assert.deepEqual(operatorAttribution(BEARER.authorization, { decided_by: 'Krish' }), { surface: 'api', client: 'claude_code', actor: 'Krish', observation: false })
    assert.equal(operatorAttribution(BEARER.authorization, { decided_by: 'krish' })?.observation, true, 'no near-miss spelling counts')
  })
})

describe('an operator session cannot take a decision', () => {
  const approve = {
    idempotency_key: '00000000-0000-4000-8000-000000000001',
    subject_table: 'content_ideas', subject_id: 'x', artifact_kind: 'draft',
    action: 'approved', surface: 'api', client: 'claude_code',
  }

  test('the ledger refuses an approval the session did not relay', async () => {
    const out = await call('../../apps/control-plane/api/content-edits.js', { headers: BEARER, body: approve })
    assert.equal(out.status, 403)
    assert.equal((out.body as { error: string }).error, 'a_decision_needs_krish')
  })

  test('PATCH refuses to approve, drop or publish on the session\'s own say', async () => {
    for (const state of ['approved', 'dropped', 'published']) {
      const out = await call('../../apps/control-plane/api/content-ideas.js', { method: 'PATCH', headers: BEARER, body: { id: 'x', state } })
      assert.equal(out.status, 403, state)
    }
  })

  test('moving a piece to review is not a decision, so it is not refused here', async () => {
    // It goes on to read the row, which the dead local database refuses.
    const out = await call('../../apps/control-plane/api/content-ideas.js', { method: 'PATCH', headers: BEARER, body: { id: 'x', state: 'review' } })
    assert.notEqual(out.status, 403)
    assert.ok(out.status >= 400, 'reached the database read, which is the point past the gate')
  }, 30_000)
})

describe('the rows that are written say whose they are', () => {
  const src = (p: string) => readFileSync(p, 'utf8')

  test('PATCH does not log an accepted rewrite as a hand edit', () => {
    assert.match(src('apps/control-plane/api/content-ideas.ts'), /if \(bodyChanged && !fromRewrite\)/)
  })

  test('draft and revise attribute their invocation to whoever made it', () => {
    for (const p of ['apps/control-plane/api/content-ideas/[id]/draft.ts', 'apps/control-plane/api/content-ideas/[id]/revise.ts']) {
      assert.match(src(p), /operatorAttribution\(req\.headers\.authorization, req\.body\)/, p)
      assert.match(src(p), /observation_only/, p)
    }
  })

  test('the compiler learns from his hand only', () => {
    const s = src('apps/control-plane/api/learning/compile.ts')
    assert.match(s, /\.eq\('actor', 'Krish'\)/)
    assert.match(s, /\.neq\('confirmation_state', 'observation_only'\)/)
  })
})
