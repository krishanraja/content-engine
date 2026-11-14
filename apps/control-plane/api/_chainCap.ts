import chainCap from '../../../config/chain-cap.json' with { type: 'json' }
import { CHAIN_WEEKLY_USD, chainFamily, chainWeekSpend, type ChainWeek } from './_meter.js'
import type { ContentRunRecord } from './_runs.js'

// The $15 a week chain, enforced. Ruling (Krish, 2026-11-14): the chain cap as proposed in
// docs/proposals/2026-11-14-phase3-and-chain-cap.md (his words: "I agree with everything else until Batch 6"). The
// proposal's enforcement, with no new table and no new cron:
//
//   - _meter.ts sums the week over the chain's families (chainWeekSum, chainWeekSpend), Monday 00:00 UTC on.
//   - The existing daily sweep (the triage sweep, 03:00 UTC, api/triage/sweep.ts) skips optional runs once the week
//     passes $15, in the order config/chain-cap.json lists them (skip_when_over), inspirationhouse tagging first. It
//     records its verdict in the run ledger as job chain_cap: skipped over the cap, ok under it, failed when the meter
//     cannot be read. A run in another repository reads that row before it starts: inspirationhouse's daily run
//     (05:17 UTC) already writes this ledger, and skips its tagging when this week's newest chain_cap row is skipped
//     and carries skip_inspirationhouse_tag.
//   - The sweep writes one board item a week saying so, held in progress for the record, never on Krish. It closes
//     itself by the existing job_ok check (Control Center's done-check sweep) on the first chain_cap run that is ok,
//     which is the first sweep that finds the chain back under $15: the next week's, since spend only grows inside one.
//   - It never stops the fact gate on a piece he picked: chainAllows answers that before anything else.
//
// Unknown never stops a run: a meter that cannot be read skips nothing.

export const CHAIN_JOB = 'chain_cap'
/** The optional runs skipped over the cap, in order: inspirationhouse tagging first. */
export const CHAIN_SKIPS: readonly string[] = chainCap.skip_when_over
/** Where the board item points: how the cap works, in the repository. */
export const CHAIN_ITEM_LINK = 'https://github.com/krishanraja/content-engine/blob/main/docs/COST_GUARDS.md#scheduled-claude-runs-and-the-15-a-week'
const UPDATED_BY = 'engine: triage sweep'

/** The ledger count that tells a run it is skipped this week: skip_<its unit key>, in snake case. */
export function skipKey(unitKey: string): string {
  return `skip_${unitKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`
}

export interface ChainVerdict { runs: boolean; why: string }

/**
 * Whether a run with this unit key may go ahead this week. In order: the fact gate on a piece he picked always runs;
 * a week whose spend could not be read stops nothing; under the cap everything runs; over it, only the optional runs
 * listed are skipped.
 */
export function chainAllows(unitKey: string, week: ChainWeek | null, o: { picked?: boolean; skips?: readonly string[] } = {}): ChainVerdict {
  if (o.picked && chainFamily({ unit_kind: chainCap.unit_kind, unit_key: unitKey }) === 'fact-gate') {
    return { runs: true, why: 'the fact gate on a piece Krish picked is never stopped' }
  }
  if (!week) return { runs: true, why: "this week's chain spend could not be read, and unknown stops nothing" }
  if (!week.over) return { runs: true, why: `the chain is under its $${week.cap_usd} this week` }
  if (!(o.skips ?? CHAIN_SKIPS).includes(unitKey)) return { runs: true, why: 'not an optional run the cap skips' }
  return { runs: false, why: `the chain is over its $${week.cap_usd} a week: $${dollars(week.usd)} since Monday ${week.week}` }
}

const dollars = (usd: number) => usd.toFixed(2)
const familyKey = (family: string) => `usd_${family.replace(/[^a-z0-9]+/g, '_')}`

/** The optional runs this week's spend skips, in order. */
export function chainSkipped(week: ChainWeek | null): string[] {
  return CHAIN_SKIPS.filter(k => !chainAllows(k, week).runs)
}

/** The sweep's verdict as one run ledger row's status, reason and counts (numbers only, as the ledger keeps). */
export function chainCapRecord(week: ChainWeek | null): Pick<ContentRunRecord, 'status' | 'reason' | 'counts'> {
  if (!week) return { status: 'failed', reason: "the meter could not be read, so this week's chain spend is unknown and nothing is skipped", counts: {} }
  const skipped = chainSkipped(week)
  const counts: Record<string, number> = { usd: Math.round(week.usd * 100) / 100, cap_usd: week.cap_usd, over: week.over ? 1 : 0, skips: skipped.length }
  for (const [family, usd] of Object.entries(week.by_family)) counts[familyKey(family)] = Math.round(usd * 100) / 100
  for (const k of skipped) counts[skipKey(k)] = 1
  if (!week.over) return { status: 'ok', reason: null, counts }
  return {
    status: 'skipped',
    reason: `the chain is over its $${week.cap_usd} a week: $${dollars(week.usd)} since Monday ${week.week}; skipped: ${skipped.join(', ') || 'nothing listed'}`.slice(0, 600),
    counts,
  }
}

const FAMILY_WORDS: Record<string, string> = Object.fromEntries(
  Object.entries(chainCap.families as Record<string, { what: string }>).map(([k, f]) => [k, f.what]))
const SKIP_WORDS: Record<string, string> = { 'inspirationhouse-tag': 'inspirationhouse tagging' }

/** The one board item a week the sweep writes when the chain is over: in progress, closing itself on the first ok
 *  chain_cap run (job_ok, close_ref {job, after}), the shape the board route and the database accept. */
export function chainCapItem(week: ChainWeek, now: Date) {
  const skipped = chainSkipped(week)
  const families = Object.entries(week.by_family).sort((a, b) => b[1] - a[1])
    .map(([f, usd]) => `${FAMILY_WORDS[f] ?? f} $${dollars(usd)}`).join(', ')
  const skips = skipped.map(k => SKIP_WORDS[k] ?? k).join(', ') || 'nothing listed yet'
  return {
    id: `chain-cap-${week.week}`,
    lane: 'in_progress' as const,
    rank: 30,
    area: 'Costs',
    title: `The $${week.cap_usd} a week chain is over: $${dollars(week.usd)} since Monday ${week.week}`.slice(0, 200),
    detail: [
      `This week's chain spend is $${dollars(week.usd)} against the $${week.cap_usd} cap (${families}).`,
      `The daily sweep now skips ${skips} until the chain is back under, which is Monday's new week.`,
      'The fact gate on a piece Krish picked is never stopped, and nothing else is skipped.',
      'This closes itself on the first sweep that finds the chain back under the cap.',
    ].join(' ').slice(0, 2000),
    link: CHAIN_ITEM_LINK,
    link_label: 'How the cap works',
    closes_on: 'job_ok' as const,
    close_ref: { job: CHAIN_JOB, after: now.toISOString() },
  }
}

export interface ChainCapDeps {
  spend: (now: Date) => Promise<ChainWeek | null>
  record: (row: ContentRunRecord) => Promise<void>
  /** Whether the board already holds this item, in any lane; null when it cannot be read. */
  itemExists: (id: string) => Promise<boolean | null>
  /** Insert an item; the error's words, or null. */
  insertItem: (item: Record<string, unknown>) => Promise<string | null>
}

export const chainCapDeps: ChainCapDeps = {
  spend: now => chainWeekSpend(now),
  record: async row => { const { recordContentRun } = await import('./_runs.js'); await recordContentRun(row) },
  itemExists: async id => {
    const { supabase } = await import('./_supabase.js')
    const seen = await supabase.from('work_board_items').select('id').eq('id', id).maybeSingle()
    return seen.error ? null : Boolean(seen.data)
  },
  insertItem: async item => {
    const { supabase } = await import('./_supabase.js')
    const ins = await supabase.from('work_board_items').insert(item)
    return ins.error ? `${ins.error.code || ''} ${ins.error.message || ''}`.trim().slice(0, 200) : null
  },
}

export interface ChainCapResult {
  chain_usd: number; chain_cap_usd: number; chain_over: 0 | 1; chain_skips: number; chain_unread: 0 | 1
  chain_item_written: 0 | 1
  /** Why the item was not written when it should have been. */
  chain_item_note?: string
}

/** The sweep's step: read the week, record the verdict, and write the week's one board item when the chain is over. */
export async function enforceChainCap(now: Date, deps: ChainCapDeps = chainCapDeps, o: { scheduled: boolean; write?: boolean } = { scheduled: true }): Promise<ChainCapResult> {
  const write = o.write !== false
  // The ledger's trigger for a run a person started, as withContentRun records it (api/_runs.ts).
  const trigger: ContentRunRecord['trigger'] = o.scheduled ? 'cron' : 'manual'
  const started = new Date()
  const week = await deps.spend(now)
  const verdict = chainCapRecord(week)
  const result: ChainCapResult = {
    chain_usd: week ? Math.round(week.usd * 100) / 100 : 0, chain_cap_usd: CHAIN_WEEKLY_USD,
    chain_over: week?.over ? 1 : 0, chain_skips: chainSkipped(week).length, chain_unread: week ? 0 : 1, chain_item_written: 0,
  }
  if (!write) return result
  await deps.record({ job: CHAIN_JOB, trigger, ...verdict, started_at: started.toISOString(), finished_at: new Date().toISOString() })
  if (week?.over) {
    const item = chainCapItem(week, now)
    const exists = await deps.itemExists(item.id)
    if (exists === null) result.chain_item_note = 'the board could not be read'
    else if (!exists) {
      const error = await deps.insertItem({ ...item, updated_by: UPDATED_BY, updated_at: now.toISOString() })
      if (error) result.chain_item_note = `board_write_failed: ${error}`
      else result.chain_item_written = 1
    }
  }
  return result
}
