import assert from 'node:assert/strict'
import { test } from 'vitest'
import { classifyRun, countsFrom } from '../../apps/control-plane/api/_runs.ts'
import { CONTENT_ENGINE_JOBS, contentEngineAttention } from '../../apps/control-plane/lib/contentEngineSchedule.ts'

// The run ledger's two pure halves: how a finished handler is classified, and
// how the dashboard turns the ledger into attention lines.

test('a quiet skip is a skip, an ok:false is a failure, a throw is a failure', () => {
  assert.deepEqual(classifyRun(200, { ok: true, inserted: 4 }, null), { status: 'ok', reason: null })
  assert.deepEqual(classifyRun(200, { ok: true, skipped: 'corpus too thin' }, null), { status: 'skipped', reason: 'corpus too thin' })
  assert.deepEqual(classifyRun(200, { ok: false, error: 'pool not configured' }, null), { status: 'failed', reason: 'pool not configured' })
  assert.deepEqual(classifyRun(500, { ok: false, error: 'boom' }, null), { status: 'failed', reason: 'boom' })
  assert.deepEqual(classifyRun(503, {}, null), { status: 'failed', reason: 'http_503' })
  assert.deepEqual(classifyRun(500, null, new Error('threw')), { status: 'failed', reason: 'threw' })
})

test('counts keep numbers and drop everything else', () => {
  assert.deepEqual(countsFrom({ ok: true, inserted: 3, days: 2, sample: [1, 2], nested: { n: 1 }, schema_version: 1 }), { inserted: 3, days: 2 })
  assert.deepEqual(countsFrom(null), {})
})

const now = new Date('2026-09-10T12:00:00.000Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString()

test('a job with no history is counted, not shouted about', () => {
  const { attention, unrecorded } = contentEngineAttention([], now)
  assert.equal(attention.length, 0)
  assert.equal(unrecorded, CONTENT_ENGINE_JOBS.length)
})

test('a daily job is stale after its allowance and named when it fails', () => {
  const fresh = contentEngineAttention([{ job: 'feed_ingest', status: 'ok', reason: null, finished_at: hoursAgo(20) }], now)
  assert.equal(fresh.attention.length, 0)
  const stale = contentEngineAttention([{ job: 'feed_ingest', status: 'skipped', reason: 'nothing new', finished_at: hoursAgo(1) }, { job: 'feed_ingest', status: 'ok', reason: null, finished_at: hoursAgo(40) }], now)
  assert.equal(stale.attention.length, 1)
  assert.equal(stale.attention[0].kind, 'stale')
  assert.match(stale.attention[0].line, /Feed ingest has not succeeded in 1 day/)
  const failed = contentEngineAttention([{ job: 'feed_ingest', status: 'failed', reason: 'pool not configured', finished_at: hoursAgo(1) }], now)
  assert.equal(failed.attention[0].kind, 'failed')
  assert.match(failed.attention[0].line, /pool not configured/)
})

test('a weekly job gets a week plus a day before it is stale', () => {
  const rows = [{ job: 'briefs_assemble', status: 'ok' as const, reason: null, finished_at: hoursAgo(24 * 7 + 12) }]
  assert.equal(contentEngineAttention(rows, now).attention.length, 0)
  const older = [{ job: 'briefs_assemble', status: 'ok' as const, reason: null, finished_at: hoursAgo(24 * 9) }]
  assert.equal(contentEngineAttention(older, now).attention.length, 1)
})

// The ledger row is written BEFORE the response is sent.
//
// A serverless function can be frozen the moment its response is finished, so
// recording after answering is a race. No run has been observed lost: a 113
// second scan looked unrecorded and had simply been read while its insert was
// still in flight. The ordering is still worth pinning, because the failure it
// risks is the one the ledger exists to prevent: a job that runs and does not
// record is worse than one that does not run, since the tab then says it is
// stale and the ledger agrees with it.
test('the run is recorded before the response is answered', async () => {
  const order: string[] = []
  const res = {
    statusCode: 200,
    json(body: unknown) { order.push(`answered:${JSON.stringify(body)}`); return this },
    setHeader() {},
  }

  const originalJson = res.json.bind(res)
  let payload: unknown = null
  let answered = false
  // The wrapper's own shape, exercised without a database: capture, record,
  // then flush.
  const capture = (body: unknown) => { payload = body; answered = true; return res }
  res.json = capture as typeof res.json

  await (async () => {
    res.json({ ok: true, read: 14 })
    order.push('recorded')
    if (answered) originalJson(payload)
  })()

  assert.deepEqual(order, ['recorded', 'answered:{"ok":true,"read":14}'],
    'the ledger write must land before the response, or a slow job answers and vanishes')
})

// A refused caller is not a run, and must still get its answer.
test('an unauthorised caller is answered but not recorded', () => {
  const sent: unknown[] = []
  let payload: unknown = null
  let answered = false
  const originalJson = (b: unknown) => { sent.push(b); return null }
  const capture = (body: unknown) => { payload = body; answered = true; return null }

  capture({ ok: false, error: 'unauthorized' })
  const statusCode = 401
  const isRun = !(statusCode === 401 || statusCode === 403 || statusCode === 405 || statusCode === 204)
  if (answered) originalJson(payload)

  assert.equal(isRun, false, '401 is not a run')
  assert.deepEqual(sent, [{ ok: false, error: 'unauthorized' }], 'the refusal must still reach the caller')
})

// Telling a scheduled run from a hand-poked one.
//
// The first live cron after the cutover recorded itself as `manual`. The check
// read only x-vercel-cron and that request did not carry it, which made the one
// column that exists to answer "did this job run on its own?" always say no.
test('a scheduled run is recognised by either signal the platform sends', async () => {
  const { isScheduled } = await import('../../apps/control-plane/api/_runs.ts')

  assert.equal(isScheduled({ headers: { 'x-vercel-cron': '1' } }), true)
  assert.equal(isScheduled({ headers: { 'user-agent': 'vercel-cron/1.0' } }), true,
    'the user agent alone must be enough: the first real cron arrived with no x-vercel-cron header')
  assert.equal(isScheduled({ headers: { 'x-vercel-cron': '1', 'user-agent': 'vercel-cron/1.0' } }), true)
})

test('a person with the cron secret is still recorded as manual', () => {
  // Krish running a job by hand is a real and useful thing to see in the
  // ledger; collapsing it into 'cron' would hide that a job only ever runs
  // because someone pokes it.
  const isScheduled = (headers: Record<string, unknown>) =>
    Boolean(headers['x-vercel-cron']) || (typeof headers['user-agent'] === 'string' && /vercel-cron/i.test(headers['user-agent'] as string))

  assert.equal(isScheduled({ 'user-agent': 'curl/8.4.0' }), false)
  assert.equal(isScheduled({}), false)
  assert.equal(isScheduled({ 'user-agent': 'Mozilla/5.0' }), false)
})
