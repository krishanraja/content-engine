import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import * as signals from '../../apps/control-plane/api/_signals.js'
import { gdeltSeenToIso, signalsQueryFor, velocity, type NewsArticle } from '../../apps/control-plane/api/_signals.js'

// The outside signals (docs/ENGINE_100X.md): the pure parts, held to the
// shapes the public endpoints actually return (read live on 2026-10-09), so a
// change in how a feed is read fails here.

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

// Ruling (Krish, 2026-11-24): "the signature format is the 5 Whys; get rid of everything that suggests predictions,
// calls, dated, odds or scores." The prediction-market readers, the pinned-market route, the daily odds cron, the
// public scoreboard and the falsifier sweep all went with it.
describe('no odds, no scoreboard', () => {
  test('the signals module reads no prediction market', () => {
    for (const name of ['polymarketProbability', 'kalshiProbability', 'marketOdds', 'nextCallMarket', 'polymarketBySlug', 'kalshiByTicker']) {
      assert.equal(name in signals, false, `${name} is still exported`)
    }
    assert.doesNotMatch(readFileSync('apps/control-plane/api/_signals.ts', 'utf8'), /polymarket\.com|kalshi\.com|call_market/i)
  })
  test('the scoreboard, odds and claim-ruling routes are gone, and so are their crons', () => {
    for (const route of ['calls.ts', 'content-ideas/[id]/call-market.ts', 'signals/odds.ts', 'claims/resolve.ts', 'claims/_notice.ts', 'claims/rule.ts']) {
      assert.equal(existsSync(`apps/control-plane/api/${route}`), false, `api/${route} still exists`)
    }
    const crons = (JSON.parse(readFileSync('apps/control-plane/vercel.json', 'utf8')).crons || []).map((c: { path: string }) => c.path)
    assert.ok(!crons.includes('/api/claims/resolve'))
    assert.ok(!crons.includes('/api/signals/odds'))
  })
})
