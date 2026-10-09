import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import {
  gdeltSeenToIso, kalshiProbability, nextCallMarket, polymarketProbability, signalsQueryFor, velocity, type NewsArticle,
} from '../../apps/control-plane/api/_signals.js'

// The outside signals (docs/ENGINE_100X.md): the pure parts, held to the
// shapes the public endpoints actually return (read live on 2026-10-09), so a
// change in how a market or a feed is read fails here before it reaches the
// scoreboard.

describe('prediction-market odds', () => {
  test('Polymarket prices arrive as JSON strings inside JSON, Yes first', () => {
    assert.equal(polymarketProbability({ outcomes: '["Yes","No"]', outcomePrices: '["0.205","0.795"]' }), 0.205)
    assert.equal(polymarketProbability({ outcomes: '["No","Yes"]', outcomePrices: '["0.3","0.7"]' }), 0.7)
    assert.equal(polymarketProbability({ outcomePrices: ['0.5'] }), 0.5)
    assert.equal(polymarketProbability({}), null)
    assert.equal(polymarketProbability({ outcomePrices: 'not json' }), null)
    assert.equal(polymarketProbability({ outcomePrices: '["1.7"]' }), null)
  })
  test('Kalshi quotes in cents: the bid-ask midpoint, else the last trade', () => {
    assert.equal(kalshiProbability({ yes_bid: 40, yes_ask: 44 }), 0.42)
    assert.equal(kalshiProbability({ last_price: 63 }), 0.63)
    assert.equal(kalshiProbability({ yes_bid: 0, yes_ask: 0, last_price: 12 }), 0.12)
    assert.equal(kalshiProbability({}), null)
  })
  test('a pinned Call keeps at most ninety readings and its first set_at', () => {
    const odds = { source: 'polymarket' as const, key: 'k', question: 'q', probability: 0.5, volume_usd: 1, end_date: null, url: null }
    let rec = nextCallMarket(null, odds, new Date('2026-10-09T00:00:00Z'))
    assert.equal(rec.set_at, '2026-10-09T00:00:00.000Z')
    for (let i = 1; i <= 100; i++) rec = nextCallMarket(rec, odds, new Date(Date.UTC(2026, 9, 9 + i)))
    assert.equal(rec.history.length, 90)
    assert.equal(rec.set_at, '2026-10-09T00:00:00.000Z')
    assert.equal(rec.history[rec.history.length - 1].p, 0.5)
  })
})

describe('news velocity', () => {
  test('GDELT stamps become ISO', () => {
    assert.equal(gdeltSeenToIso('20261008T053000Z'), '2026-10-08T05:30:00Z')
    assert.equal(gdeltSeenToIso('garbage'), 'garbage')
  })
  test('a subject spikes when today has five articles and twice yesterday', () => {
    const now = new Date('2026-10-09T12:00:00Z')
    const at = (d: string, domain = 'a.com'): NewsArticle => ({ title: 't', url: `https://${domain}/${d}`, domain, seen: `${d}T08:00:00Z` })
    const quiet = [at('2026-10-09'), at('2026-10-09'), at('2026-10-08'), at('2026-10-08')]
    assert.deepEqual(velocity(quiet, now), { today: 2, yesterday: 2, outlets: 1, spiking: false })
    const pile = [...Array.from({ length: 6 }, (_, i) => at('2026-10-09', `o${i}.com`)), at('2026-10-08')]
    const v = velocity(pile, now)
    assert.equal(v.spiking, true)
    assert.equal(v.outlets, 6)
    const noYesterday = Array.from({ length: 5 }, () => at('2026-10-09'))
    assert.equal(velocity(noYesterday, now).spiking, true)
  })
  test('the sweep searches for the query a session set, else the plain title', () => {
    assert.equal(signalsQueryFor({ idea: 'Who picks your AI?', meta: {} }), 'Who picks your AI')
    assert.equal(signalsQueryFor({ idea: 'x', meta: { signals: { query: '"Claude" "ChatGPT" plan' } } }), '"Claude" "ChatGPT" plan')
    assert.equal(signalsQueryFor({ idea: null, meta: null }), '')
  })
})

describe('the scoreboard feed', () => {
  test('a published piece with a call becomes one row, not due yet until its date, with its pinned market', async () => {
    process.env.SUPABASE_URL ||= 'http://127.0.0.1:9'
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'not-a-key'
    const { toScoreboardCall } = await import('../../apps/control-plane/api/calls.js')
    const body = readFileSync('editions/2026-09-who-picks-your-ai/body.md', 'utf8')
    const row = {
      id: 'abc', idea: 'Who picks your AI?', lane_slot: 'mind_the_gap', body, published_at: '2026-10-09T08:00:00Z',
      meta: { call_market: { source: 'polymarket', key: 'some-slug', question: 'Will labs route by default?', url: 'https://polymarket.com/market/some-slug', probability: 0.61, read_at: '2026-10-09T06:45:00Z' } },
    }
    const call = toScoreboardCall(row, '2026-10-09')
    assert.ok(call)
    assert.equal(call.due, '2027-09-30')
    assert.equal(call.confidence_percent, 75)
    assert.equal(call.status, 'not_due_yet')
    assert.equal(call.market?.probability, 0.61)
    assert.equal(toScoreboardCall(row, '2027-10-01')?.status, 'due')
    assert.equal(toScoreboardCall({ ...row, body: 'No call here.' }), null)
    assert.equal(toScoreboardCall({ ...row, meta: {} })?.market, null)
  })
})
