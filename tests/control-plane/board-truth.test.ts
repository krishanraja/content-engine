import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { duplicatePosts } from '../../apps/control-plane/api/board/_onePost'
import { STAGE_STATES, truthProblems } from '../../apps/control-plane/api/board/_stage'

// The guard that the board cannot sprawl or go stale (docs/PUBLISH_BOARDS.md, "Where everything is"). Ruling (Krish,
// 2026-11-12): the board shows exactly where everything is, and one post is one item that can never sprawl across days
// or go stale. It runs in npm run verify (vitest) on every pull request:
//
//   - no two week plans in docs/plans/ carry one post under two ids (a re-plan names the item it carries, `item`);
//   - every view the engine builds keeps the rules (viewProblems runs truthProblems: one stage on every option and
//     piece, one day per post, a past day not out says it was missed and is never with Growth), held on every view the
//     view tests build, and here on the rules themselves.

const PLANS = new URL('../../docs/plans/', import.meta.url)

describe('where everything is', () => {
  it('no week plan carries a post another plan carries under another id', () => {
    const plans: Record<string, Record<string, unknown> | null> = {}
    for (const dir of readdirSync(PLANS).filter(d => /^\d{4}-\d{2}-\d{2}-week$/.test(d))) {
      try { plans[dir.slice(0, 10)] = JSON.parse(readFileSync(new URL(`${dir}/ideas.json`, PLANS), 'utf8')) } catch { /* a week with no ideas.json */ }
    }
    expect(Object.keys(plans).length).toBeGreaterThan(3)
    expect(duplicatePosts(plans)).toEqual([])
  })

  it('refuses a day with no stage, an unknown stage, a past day with Growth, and a past day that does not say it was missed', () => {
    const ok = { state: 'approved' as const, label: 'Approved', at: null, links: [] }
    const d = (over: Record<string, unknown>) => ({ day: 'tue', date: '2026-11-10', label: 'Tue 10', who: 'missed', next: 'Missed: Tue 10 has passed', options: [], pieces: [], ...over })
    expect(truthProblems([d({})], '2026-11-12')).toEqual([])
    expect(truthProblems([d({ who: 'growth', next: 'Approved. Growth makes it' })], '2026-11-12'))
      .toEqual(['tue: a past day shown as with Growth', 'tue: a past day not out does not say it was missed'])
    expect(truthProblems([d({ options: [{ id: 'a' }], pieces: [{ id: 'p', stage: { ...ok, state: 'someday' } }] })], '2026-11-12'))
      .toEqual(['tue a: no stage', 'tue piece p: no stage'])
    // Today and later are never missed.
    expect(truthProblems([d({ date: '2026-11-12', who: 'growth', next: 'Approved' })], '2026-11-12')).toEqual([])
    expect([...STAGE_STATES]).toEqual(['idea', 'approved', 'made', 'scheduled', 'live', 'missed'])
  })
})
