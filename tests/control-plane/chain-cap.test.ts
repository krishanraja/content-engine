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

// The enforcement (Ruling, Krish, 2026-11-14, the proposal's last section): the existing daily sweep (the triage sweep,
// 03:00 UTC) skips optional runs, inspirationhouse tagging first, once the week passes $15, records that in the run
// ledger as job chain_cap, where inspirationhouse's 05:17 run reads it, and writes one board item saying so. It never
// stops the fact gate on a piece he picked. No new table and no new cron.
import { CHAIN_JOB, CHAIN_SKIPS, chainAllows, chainCapItem, chainCapRecord, enforceChainCap, skipKey, type ChainCapDeps } from '../../apps/control-plane/api/_chainCap.js'
import { cleanItem } from '../../apps/control-plane/api/workbench.js'
import type { ChainWeek } from '../../apps/control-plane/api/_meter.js'

const week = (usd: number, by_family: Record<string, number> = { inspirationhouse: usd }): ChainWeek =>
  ({ week: '2026-11-09', usd, by_family, cap_usd: 15, over: usd > 15 })
// What the chain measured on 14 Nov 2026 (docs/COST_GUARDS.md): $19.64 this week.
const THIS_WEEK = week(19.64, { inspirationhouse: 7.05, 'vercel-crons': 9.46, 'fact-gate': 3.13 })

describe('enforcing the $15 a week chain', () => {
  it('names the optional runs it skips, inspirationhouse tagging first, and never the fact gate', () => {
    expect(CHAIN_SKIPS[0]).toBe('inspirationhouse-tag')
    expect(CHAIN_SKIPS.every(k => !k.startsWith('fact-gate-'))).toBe(true)
    expect(cap.skip_when_over).toEqual(CHAIN_SKIPS)
    expect(CHAIN_JOB).toBe('chain_cap')
  })

  it('skips an optional run once the week passes $15, and not at or below it', () => {
    expect(chainAllows('inspirationhouse-tag', week(15.01)).runs).toBe(false)
    expect(chainAllows('inspirationhouse-tag', THIS_WEEK).runs).toBe(false)
    expect(chainAllows('inspirationhouse-tag', week(15)).runs).toBe(true)
    expect(chainAllows('inspirationhouse-tag', week(14.99)).runs).toBe(true)
    // A run it does not name goes ahead, and a meter it cannot read stops nothing.
    expect(chainAllows('judge-prosecutor', THIS_WEEK).runs).toBe(true)
    expect(chainAllows('inspirationhouse-tag', null).runs).toBe(true)
  })

  it('never stops the fact gate on a piece he picked, even if a fact-gate key were listed', () => {
    const listed = ['inspirationhouse-tag', 'fact-gate-extract', 'fact-gate-web']
    expect(chainAllows('fact-gate-extract', THIS_WEEK, { picked: true, skips: listed }).runs).toBe(true)
    expect(chainAllows('fact-gate-web', week(500), { picked: true, skips: listed })).toMatchObject({ runs: true, why: expect.stringMatching(/picked/) })
    expect(chainAllows('fact-gate-extract', THIS_WEEK, { picked: true }).runs).toBe(true)
    expect(chainAllows('fact-gate-extract', THIS_WEEK).runs).toBe(true)
  })

  it('records the week by family in the run ledger: skipped over the cap, ok under it, failed when unread', () => {
    const over = chainCapRecord(THIS_WEEK)
    expect(over.status).toBe('skipped')
    expect(over.reason).toMatch(/\$19\.64/)
    expect(over.reason).toMatch(/inspirationhouse-tag/)
    expect(over.counts).toMatchObject({ usd: 19.64, cap_usd: 15, over: 1, skips: 1, [skipKey('inspirationhouse-tag')]: 1,
      usd_inspirationhouse: 7.05, usd_vercel_crons: 9.46, usd_fact_gate: 3.13 })
    expect(skipKey('inspirationhouse-tag')).toBe('skip_inspirationhouse_tag')
    expect(Object.values(over.counts).every(v => typeof v === 'number')).toBe(true)
    const under = chainCapRecord(week(14.18))
    expect(under).toMatchObject({ status: 'ok', reason: null })
    expect(under.counts).toMatchObject({ usd: 14.18, over: 0, skips: 0 })
    expect(under.counts[skipKey('inspirationhouse-tag')]).toBeUndefined()
    expect(chainCapRecord(null)).toMatchObject({ status: 'failed', counts: {} })
  })

  it('writes a board item the board route accepts, that closes itself once the chain is back under', () => {
    const now = new Date('2026-11-15T03:00:00Z')
    const item = chainCapItem(THIS_WEEK, now)
    expect(item).toMatchObject({ id: 'chain-cap-2026-11-09', lane: 'in_progress', closes_on: 'job_ok',
      close_ref: { job: 'chain_cap', after: '2026-11-15T03:00:00.000Z' } })
    expect(item.title).toMatch(/\$19\.64/)
    expect(item.detail).toMatch(/inspirationhouse tagging/)
    expect(item.detail).toMatch(/fact gate on a piece Krish picked/)
    expect(item.detail.length).toBeLessThanOrEqual(2000)
    expect(() => cleanItem(item, true)).not.toThrow()
  })

  function fake(spent: ChainWeek | null, existing: string[] = []) {
    const rows: Array<Record<string, unknown>> = []
    const items: Array<Record<string, unknown>> = []
    const deps: ChainCapDeps = {
      spend: async () => spent,
      record: async row => { rows.push(row as unknown as Record<string, unknown>) },
      itemExists: async id => existing.includes(id) || items.some(i => i.id === id),
      insertItem: async item => { items.push(item); return null },
    }
    return { deps, rows, items }
  }

  it('on the sweep: over the cap, one ledger row that skips tagging and one board item a week', async () => {
    const now = new Date('2026-11-15T03:00:00Z')
    const f = fake(THIS_WEEK)
    const r = await enforceChainCap(now, f.deps, { scheduled: true })
    expect(r).toMatchObject({ chain_over: 1, chain_usd: 19.64, chain_skips: 1, chain_item_written: 1 })
    expect(f.rows).toHaveLength(1)
    expect(f.rows[0]).toMatchObject({ job: 'chain_cap', trigger: 'cron', status: 'skipped', counts: expect.objectContaining({ skip_inspirationhouse_tag: 1 }) })
    expect(f.items.map(i => i.id)).toEqual(['chain-cap-2026-11-09'])
    expect(f.items[0]).toMatchObject({ updated_by: 'engine: triage sweep' })
    // The next day's sweep, still over: another ledger row, never a second item.
    const again = await enforceChainCap(new Date('2026-11-16T02:59:00Z'), f.deps, { scheduled: true })
    expect(again).toMatchObject({ chain_over: 1, chain_item_written: 0 })
    expect(f.items).toHaveLength(1)
    expect(f.rows).toHaveLength(2)
  })

  it('on the sweep: under the cap, an ok ledger row and no item; an unread meter, a failed row and nothing skipped', async () => {
    const under = fake(week(14.18))
    expect(await enforceChainCap(new Date('2026-11-12T03:00:00Z'), under.deps, { scheduled: true })).toMatchObject({ chain_over: 0, chain_skips: 0, chain_item_written: 0 })
    expect(under.rows[0]).toMatchObject({ job: 'chain_cap', status: 'ok' })
    expect(under.items).toEqual([])
    const unread = fake(null)
    expect(await enforceChainCap(new Date('2026-11-12T03:00:00Z'), unread.deps, { scheduled: true })).toMatchObject({ chain_over: 0, chain_skips: 0, chain_unread: 1 })
    expect(unread.rows[0]).toMatchObject({ status: 'failed' })
    expect(unread.items).toEqual([])
  })

  it('writes nothing on a dry run, and says what it would do', async () => {
    const f = fake(THIS_WEEK)
    const r = await enforceChainCap(new Date('2026-11-15T03:00:00Z'), f.deps, { scheduled: false, write: false })
    expect(r).toMatchObject({ chain_over: 1, chain_skips: 1, chain_item_written: 0 })
    expect(f.rows).toEqual([])
    expect(f.items).toEqual([])
  })
})
