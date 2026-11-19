import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import {
  gdeltSeenToIso, kalshiProbability, polymarketProbability, signalsQueryFor, velocity, type NewsArticle,
} from '../../apps/control-plane/api/_signals.js'

// The outside signals (docs/ENGINE_100X.md): the pure parts, held to the
// shapes the public endpoints actually return (read live on 2026-10-09), so a
// change in how a market or a feed is read fails here first.

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

// Rulings (Krish, 2026-11-17 and 2026-11-18): the dated-prediction format is abandoned, so there is no scoreboard.
describe('the scoreboard feed is retired', () => {
  test('GET /api/calls answers with no calls and says why; the market pin and the odds cron are gone', async () => {
    const { default: handler, CALLS_RETIRED } = await import('../../apps/control-plane/api/calls.js')
    let status = 0
    let sent: any = null
    const res: any = { setHeader: () => res, status: (s: number) => { status = s; return res }, json: (b: unknown) => { sent = b; return res }, end: () => res }
    await handler({ method: 'GET', headers: {} } as any, res)
    assert.equal(status, 200)
    assert.deepEqual(sent.calls, [])
    assert.equal(sent.retired, CALLS_RETIRED)
    assert.equal(existsSync('apps/control-plane/api/content-ideas/[id]/call-market.ts'), false)
    assert.equal(existsSync('apps/control-plane/api/signals/odds.ts'), false)
    assert.doesNotMatch(readFileSync('apps/control-plane/vercel.json', 'utf8'), /signals\/odds/)
  })
})
