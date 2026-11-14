// The one state every item on a day is in (docs/PUBLISH_BOARDS.md, "Where everything is"). Ruling (Krish, 2026-11-12):
// the board shows exactly where everything is, and one post is one item that can never sprawl across days or go stale.
//
// Every off-day option and every piece on a day carries exactly one `stage` (contract 1.10.0), derived from the records
// and never typed by hand:
//
//   idea       on the ideas board: waiting on his answer, or answered with anything but Approve (its outcome says which)
//   approved   his Approve stands on it for the day
//   made       its files are made: Growth's record says made, or its post folder in Drive holds them, or its cuts exist
//   scheduled  Growth has it scheduled on a channel, with when
//   live       out on a channel, with each post's link (Growth's record, his It's live, or the piece's own record)
//   missed     its day has passed and it is not marked live
//
// "back in Ideas for Later" is the sixth: an item in that state is not on a day, so it is drawn in GET /api/board/later
// and never here. A past day that is not out is never "with Growth" or "ready" without saying it was missed (buildView;
// held by tests/control-plane/board-truth.test.ts). Pure.

import { approvedWhen } from './_gate.js'
import { channelWord, dayLabel, type ViewGrowthPost } from './_offdayItems.js'

export const STAGE_STATES = ['idea', 'approved', 'made', 'scheduled', 'live', 'missed'] as const
export type StageState = typeof STAGE_STATES[number]
export interface ViewStage {
  state: StageState
  label: string
  /** When it got there, where the record says (his approval, the post going out, the time it is scheduled for). */
  at: string | null
  /** A live item's posts, each with its own link. */
  links: Array<{ label: string; href: string }>
}

const list = (xs: string[]) => [...new Set(xs)].join(', ')

/** What an approved item has reached, from the records it carries. Pure. */
export function postedStage(input: {
  date: string
  today: string
  approvedAt: string | null
  approvedLabel: string
  growth: ViewGrowthPost[]
  /** Posts out on the day for it (Growth's ticks, his It's live), each with its channel and link. */
  out: Array<{ label: string; href?: string; at: string | null }>
  scheduled: Array<{ label: string; due_at: string }>
  made: boolean
}): ViewStage {
  const live = [...input.growth.filter(p => p.state === 'live').map(p => ({ label: channelWord(p.channel), href: p.href, at: p.at })), ...input.out]
  if (live.length) {
    const at = live.map(p => p.at).filter((x): x is string => Boolean(x)).sort().pop() ?? null
    return { state: 'live', label: `Live on ${list(live.map(p => p.label))}`, at,
      links: live.filter(p => p.href).map(p => ({ label: p.label, href: p.href! })) }
  }
  const scheduled = [...input.growth.filter(p => p.state === 'scheduled' && p.due_at).map(p => ({ label: channelWord(p.channel), due_at: p.due_at! })), ...input.scheduled]
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
  // A post scheduled to go out after its day is not missed: it says when it goes (Fri 13 Nov's "Your AI thinks it's the
  // best" was scheduled in Buffer for Tue 17; only his Move to… changes its day on the board).
  const ahead = scheduled.filter(s => s.due_at.slice(0, 10) >= input.today)
  if (input.date < input.today && !ahead.length) {
    return { state: 'missed', label: `Missed: ${dayLabel(input.date)} passed and it is not marked live`, at: null, links: [] }
  }
  if (scheduled.length) {
    const now = input.date < input.today ? ahead : scheduled
    const first = now[0].due_at
    return { state: 'scheduled', label: `Scheduled on ${list(now.map(s => s.label))} for ${approvedWhen(first)}${input.date < input.today ? `, after its day (${dayLabel(input.date)})` : ''}`, at: first, links: [] }
  }
  if (input.made || input.growth.some(p => p.state === 'made')) return { state: 'made', label: 'Made: its files are made and filed', at: null, links: [] }
  return { state: 'approved', label: input.approvedLabel, at: input.approvedAt, links: [] }
}

/** An idea's stage: on the ideas board, with his answer when he gave one. */
/** An idea's answer in his words when the outcome is not on the record but the status is (a direction rejected, an
 *  answer from before the ideas gate). */
const STATUS_WORD: Record<string, string> = { held: 'waiting on your Approve', revised: 'revised, waiting on your answer', rejected: 'Rejected and learnt from',
  filed: 'Filed for later', trend: 'Saved as a trend for a wider piece', improved: 'Improved for a future piece' }
export function ideaStage(outcome: { label: string; at: string | null } | null | undefined, status: string, samePost?: string | null): ViewStage {
  const label = samePost ? `Idea: ${samePost}`
    : outcome ? `Idea: ${outcome.label.toLowerCase().startsWith('approved') ? 'approved, then changed' : outcome.label}`
      : `Idea: ${STATUS_WORD[status] ?? 'waiting on your answer'}`
  return { state: 'idea', label, at: outcome?.at ?? null, links: [] }
}

/** Every rule the stages must keep, for the guard: exactly one known stage on every option and piece; a past day not out
 *  says it was missed and is never with Growth; an item on a day is on one day only. Pure. */
export function truthProblems(days: Array<{ day: string; date: string; label: string; who: string; next: string; options: Array<{ id: string; stage?: ViewStage; same_post?: unknown; item?: { key: string; state: string } }>; pieces: Array<{ id: string; stage?: ViewStage }> }>, today: string): string[] {
  const out: string[] = []
  const placed = new Map<string, string>()
  for (const d of days) {
    for (const o of d.options) {
      if (!o.stage || !(STAGE_STATES as readonly string[]).includes(o.stage.state)) out.push(`${d.day} ${o.id}: no stage`)
      // An item placed on a day (approved, made, scheduled, live, missed) is on that day only, across every week.
      if (o.item && o.stage && o.stage.state !== 'idea' && !o.same_post) {
        const was = placed.get(o.item.key)
        if (was && was !== d.date) out.push(`${o.item.key}: on ${was} and ${d.date}`)
        placed.set(o.item.key, d.date)
      }
    }
    for (const p of d.pieces) if (!p.stage || !(STAGE_STATES as readonly string[]).includes(p.stage.state)) out.push(`${d.day} piece ${p.id}: no stage`)
    if (d.date < today && d.who !== 'done') {
      if (d.who === 'growth') out.push(`${d.day}: a past day shown as with Growth`)
      if (!/^Missed/.test(d.next)) out.push(`${d.day}: a past day not out does not say it was missed`)
    }
  }
  return out
}
