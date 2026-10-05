import assert from 'node:assert/strict'
import { test } from 'vitest'
import { arcCardRows, systemicComposerFailure, type ScoredArc } from '../../apps/control-plane/api/arcs/_cards.ts'

// The shape of what one weekly surfacing writes.
//
// Every weekly run from 2026-08-26 to 2026-09-17 died with
// `arc_cards write failed: null value in column "components" of relation
// "arc_cards" violates not-null constraint`, and the constraint was never the
// problem: `components` is `jsonb not null default '[]'`, so omitting it cannot
// fail. PostgREST unions the keys across a bulk upsert and sends an explicit
// NULL for any key a row omits, and an explicit NULL defeats a DEFAULT. The
// blocked and skipped rows omitted two defaulted columns, so they arrived NULL.
//
// That makes the invariant a shape one, and it is the only thing worth pinning:
// every row in the array carries the same keys. Assert it structurally rather
// than by naming `components`, because `reserved_slot` was omitted too and a
// test that named only the column in the error message would have passed while
// the next run still failed.

const card = {
  headline: 'h', what_changed: 'w', why_now: 'y',
  the_opening: 'o', where_this_goes: 'g', reader_decision: 'd', format: 'essay',
}

const scored = (id: string, over: Partial<ScoredArc> = {}): ScoredArc => ({
  row: { id, arc_state: 'building', theme_id: null },
  card, score: 0.8, components: [{ kind: 'beat' }], blocked: false, blocks: [], ...over,
})

test('every row carries the same keys, whatever lane produced it', () => {
  const rows = arcCardRows({
    scored: [scored('won'), scored('lost'), scored('lint', { blocked: true, blocks: ['banned word'] })],
    preBlocked: [{ row: { id: 'pre' }, blocks: ['too few independent beats'] }],
    skipped: [{ row: { id: 'skip' }, reason: 'composer declined: nothing to say' }],
    surfacedIds: new Set(['won']),
    reservedIds: new Set(['won']),
    week: '2026-W38',
  })
  assert.equal(rows.length, 5)
  const keys = Object.keys(rows[0]).sort()
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), keys,
      `row ${row.shift_id} has a different key set, so PostgREST will NULL the difference`)
  }
})

test('the two columns with a NOT NULL DEFAULT are never null on an uncomposed row', () => {
  const rows = arcCardRows({
    scored: [],
    preBlocked: [{ row: { id: 'pre' }, blocks: ['too few independent beats'] }],
    skipped: [{ row: { id: 'skip' }, reason: 'composer returned nothing usable, twice' }],
    surfacedIds: new Set(), reservedIds: new Set(), week: '2026-W38',
  })
  for (const row of rows) {
    assert.deepEqual(row.components, [], 'components is not null default []')
    assert.equal(row.reserved_slot, false, 'reserved_slot is not null default false')
  }
})

test('an uncomposed row still says why it is not in the queue', () => {
  const [pre, skip] = arcCardRows({
    scored: [],
    preBlocked: [{ row: { id: 'pre' }, blocks: ['too few independent beats', 'no lens'] }],
    skipped: [{ row: { id: 'skip' }, reason: 'composer declined: nothing to say' }],
    surfacedIds: new Set(), reservedIds: new Set(), week: '2026-W38',
  })
  assert.equal(pre.blocked, true)
  assert.equal(pre.surfaced, false)
  assert.equal(pre.surface_reason, 'too few independent beats; no lens')
  assert.equal(skip.surface_reason, 'composer declined: nothing to say')
  assert.deepEqual(skip.blocks, ['composer declined: nothing to say'])
  // The headline is genuinely absent, not empty. A blank string would render
  // as a card with no title rather than as an arc that was never composed.
  assert.equal(pre.headline, null)
})

test('a losing card keeps its composition and its score, and says it lost', () => {
  const [won, lost, linted] = arcCardRows({
    scored: [scored('won'), scored('lost', { score: 0.2 }), scored('lint', { blocked: true, blocks: ['banned word: agentic'] })],
    preBlocked: [], skipped: [],
    surfacedIds: new Set(['won']), reservedIds: new Set(), week: '2026-W38',
  })
  assert.equal(won.surfaced, true)
  assert.equal(won.reserved_slot, false)
  assert.equal(won.headline, 'h')
  assert.equal(lost.surfaced, false)
  assert.equal(lost.headline, 'h', 'the composition is kept so "why is this not in my queue" has an answer')
  assert.equal(lost.surface_reason, 'scored 0.20, below the cut for this week')
  // A card that failed the lint scores zero rather than its raw score: it was
  // never eligible, and a non-zero score on a blocked row reads as a near miss.
  assert.equal(linted.score, 0)
  assert.equal(linted.surface_reason, 'banned word: agentic')
})

test('a reserved slot is marked on the row that holds it and on no other', () => {
  const rows = arcCardRows({
    scored: [scored('a'), scored('b')],
    preBlocked: [], skipped: [],
    surfacedIds: new Set(['a', 'b']), reservedIds: new Set(['b']), week: '2026-W38',
  })
  assert.deepEqual(rows.map(r => r.reserved_slot), [false, true])
})

// A broken credential is one fact about the deployment, not N editorial
// verdicts. The 2026-09-18 surfacing wrote ten blocked arc_cards reading
// `composer failed: anthropic_401:API key is invalid.` and recorded the run as
// ok, so nothing on the tab said the composer was down and every card from that
// run has `format` null.
test('an auth or config failure is systemic, a transient one is the arc\'s own', () => {
  const anthropic = (status: number, message: string) => {
    const e = new Error(`anthropic_${status}:${message}`) as Error & { status?: number }
    e.status = status
    return e
  }

  // The exact error from the 2026-09-18 run.
  assert.equal(
    systemicComposerFailure(anthropic(401, 'API key is invalid.')),
    'anthropic_401:API key is invalid.',
  )
  assert.ok(systemicComposerFailure(anthropic(403, 'forbidden')))
  assert.ok(systemicComposerFailure(anthropic(402, 'credit balance is too low')))
  assert.ok(systemicComposerFailure(new Error('ANTHROPIC_API_KEY not configured')))

  // Read off the message alone when nothing hung a status on the error.
  assert.ok(systemicComposerFailure(new Error('anthropic_401:API key is invalid.')))

  // Transient, and genuinely per arc: the next arc may well compose.
  assert.equal(systemicComposerFailure(anthropic(429, 'rate limit')), null)
  assert.equal(systemicComposerFailure(anthropic(500, 'overloaded')), null)
  assert.equal(systemicComposerFailure(anthropic(529, 'overloaded')), null)
  assert.equal(systemicComposerFailure(new Error('anthropic_timeout_45000ms')), null)
  assert.equal(systemicComposerFailure(new Error('unexpected end of JSON input')), null)
  assert.equal(systemicComposerFailure(null), null)

  // A 401 named inside prose is not a status. Only the documented shapes count.
  assert.equal(systemicComposerFailure(new Error('the model wrote about anthropic_401 in its answer')), null)
})
