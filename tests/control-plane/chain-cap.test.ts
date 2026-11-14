import { describe, expect, it, vi } from 'vitest'

// The $15 a week chain (Ruling, Krish, 2026-11-14: the chain cap as proposed in
// docs/proposals/2026-11-14-phase3-and-chain-cap.md). The cap is measured by its own
// unit keys from config/chain-cap.json, never by everything metered.

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: null }))

import { chainFamily, chainWeekSum, weekStartKey } from '../../apps/control-plane/api/_meter.js'
import cap from '../../config/chain-cap.json' with { type: 'json' }

const row = (unit_key: string, usd: number, day = '2026-11-10', unit_kind = 'agent', provider = 'anthropic') =>
  ({ provider, unit_kind, unit_key, day, usd })

describe('the $15 a week chain', () => {
  it('holds the cap and the ruling it came from', () => {
    expect(cap.weekly_usd).toBe(15)
    expect(cap.ruling).toContain('Ruling (Krish, 2026-11-14)')
  })

  it('counts each approved family by its own keys', () => {
    expect(chainFamily(row('inspirationhouse-tag', 0))).toBe('inspirationhouse')
    expect(chainFamily(row('inspiration-scan', 0))).toBe('inspirationhouse')
    for (const k of ['editorial-radar-money-of-ai', 'judge-prosecutor', 'ladder-expand', 'briefs-assemble', 'arcs-compose',
      'shifts-classify', 'investigations', 'standards', 'feed-ingest', 'spine-check']) {
      expect(chainFamily(row(k, 0))).toBe('vercel-crons')
    }
    expect(chainFamily(row('fact-gate-web', 0, '2026-11-10', 'agent', 'perplexity'))).toBe('fact-gate')
    expect(chainFamily(row('fact-gate-extract', 0))).toBe('fact-gate')
  })

  it('leaves out what the proposal leaves out', () => {
    for (const k of ['aeo-probe', 'ai-mirror', 'daily-move', 'nell-guest-scout', 'network-intent',
      'n8n/D4W5TF1sP9lE828c/Anthropic Extract Seeds', 'event-score', 'growth-engine-write']) {
      expect(chainFamily(row(k, 0))).toBeNull()
    }
    // Only agent units: an Apify actor or an n8n workflow never counts, whatever its key.
    expect(chainFamily(row('judge-prosecutor', 0, '2026-11-10', 'actor', 'apify'))).toBeNull()
    expect(chainFamily(row('inspirationhouse-tag', 0, '2026-11-10', 'workflow', 'n8n'))).toBeNull()
  })

  it('weeks start on Monday, UTC', () => {
    expect(weekStartKey(new Date('2026-11-14T23:00:00Z'))).toBe('2026-11-09')
    expect(weekStartKey(new Date('2026-11-09T00:00:00Z'))).toBe('2026-11-09')
    expect(weekStartKey(new Date('2026-11-15T12:00:00Z'))).toBe('2026-11-09')
    expect(weekStartKey(new Date('2026-11-16T00:00:01Z'))).toBe('2026-11-16')
  })

  it('sums only this week, only the chain, and says when it is over', () => {
    const rows = [
      row('inspirationhouse-tag', 7.05),
      row('judge-prosecutor', 4.0),
      row('fact-gate-web', 3.13, '2026-11-13', 'agent', 'perplexity'),
      row('ai-mirror', 20, '2026-11-10', 'agent', 'google'),
      row('judge-prosecutor', 9, '2026-11-08'),
      row('judge-prosecutor', 9, '2026-11-16'),
    ]
    const w = chainWeekSum(rows, '2026-11-09')
    expect(w.week).toBe('2026-11-09')
    expect(w.usd).toBeCloseTo(14.18, 6)
    expect(w.by_family).toEqual({ inspirationhouse: 7.05, 'vercel-crons': 4, 'fact-gate': 3.13 })
    expect(w.cap_usd).toBe(15)
    expect(w.over).toBe(false)
    const over = chainWeekSum([...rows, row('ladder-expand', 1)], '2026-11-09')
    expect(over.over).toBe(true)
  })
})
