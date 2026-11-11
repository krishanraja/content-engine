import type { SupabaseClient } from '@supabase/supabase-js'
import { canonical, digest } from './_contracts.js'
import { dayDate, type PostedDay } from './_posted.js'

// The ideas gate (docs/PUBLISH_BOARDS.md, "The ideas gate"). Krish, 2026-11-11: "Once I've completed it, ideas should
// either be: filed away for later, rejected and learnt from, saved as a trend for a wider piece, improved for a future
// piece cue. If they're approved, they should move into the publish board. The ideas board-to-publish board process
// should be bulletproof. I shouldn't end up seeing random ideas in the publish board that I never wanted there and that
// I didn't approve to move to the publish board. This process should be crystal clear, incorrigible, and incorruptible."
//
// Every idea on the ideas board ends in exactly one of five outcomes, each a press he makes. Only Approved crosses to the
// publish board. His answers are kept append only in idea_outcomes, written by the database from the presses he saved
// (supabase/migrations/20261126090000_ideas_gate.sql), and board_approvals_now(week) says which approvals stand. The
// same rule holds in three places: the database refuses to put a piece on a day without his approval for that piece and
// that date (content_ideas_board_gate), the view draws only approved pieces and names every other one as held (here),
// and every writer meets the database's refusal, whichever route it takes.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const SHA256 = /^[a-f0-9]{64}$/

/** The five outcomes, and the words the board uses for each. */
export const OUTCOMES = {
  approved: 'Approved',
  filed: 'Filed for later',
  rejected: 'Rejected and learnt from',
  trend: 'Saved as a trend for a wider piece',
  improved: 'Improved for a future piece',
} as const
export type Outcome = keyof typeof OUTCOMES

/** The press use (a publishing day's idea) or off-day verdict that each outcome is stored as. Older uses he pressed
 *  before 11 November read as the outcome they became: Track it over time is a trend too. */
export const OUTCOME_OF_USE: Record<string, Outcome> = {
  next_week: 'filed', not_for_us: 'rejected', wider_piece_context: 'trend', track_over_time: 'trend', improve: 'improved',
}
export const OUTCOME_OF_VERDICT: Record<string, Outcome> = {
  approve: 'approved', next_week: 'filed', reject: 'rejected', trend: 'trend', improve: 'improved',
}

/** One approval that stands now (board_approvals_now): his press, the idea and the day it puts on the board. */
export interface Approval {
  idea_id: string
  day: string
  date: string
  via: 'pick' | 'offday' | 'recorded' | 'approve_publish' | string
  doc: string
  option_ref: string | null
  revision: number
  decided_at: string
  option_sha256: string | null
  words: string | null
  source: string
}

const DAY_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** "Monday 16 November", the day a press puts an idea on. */
export function dayWords(week: string, day: string): string {
  const date = dayDate(week, day as PostedDay)
  const d = new Date(`${date}T00:00:00Z`)
  return `${DAY_NAME[day] || day} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`
}
/** "Mon 16 Nov", for a press's label. */
export function dayShort(week: string, day: string): string {
  const date = dayDate(week, day as PostedDay)
  const d = new Date(`${date}T00:00:00Z`)
  return `${(DAY_NAME[day] || day)} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()].slice(0, 3)}`
}

/** When he approved, in his time zone (the operator's default, New York): "Sun 9 Nov, 08:07". */
export function approvedWhen(at: string, timeZone = 'America/New_York'): string {
  const t = new Date(at)
  if (!Number.isFinite(t.getTime())) return at
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(t).map(p => [p.type, p.value]))
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`
}
/** "Approved by you, Sun 9 Nov, 08:07" on each piece and option his approval holds; his Approve for publish says so. */
export const approvedLabel = (a: Pick<Approval, 'decided_at'> & { via?: string }) =>
  `${a.via === 'approve_publish' ? 'Approved for publish by you' : 'Approved by you'}, ${approvedWhen(a.decided_at)}`

/** The hash of an option's text as the board shows it on a publishing day: its one-line so what and its story. The
 *  press carries the same two values, so an approval binds exactly the words he saw (preparePress works it out again). */
export function optionSha(o: { so_what?: unknown; story?: unknown }): string {
  return digest(canonical({ so_what: typeof o.so_what === 'string' ? o.so_what : '', story: typeof o.story === 'string' ? o.story : '' }))
}

/** Where each press sends an idea, said on the press before he makes it. */
export function goes(outcome: Outcome, week: string, day: string, offday = false): string {
  switch (outcome) {
    case 'approved': return offday
      ? `Goes onto the publish board for ${dayWords(week, day)}. Growth makes it from what you approved.`
      : `Goes onto the publish board for ${dayWords(week, day)} as the day's piece.`
    case 'filed': return 'Filed with today\'s date. It comes back on a later ideas board, or when you ask for it.'
    case 'rejected': return 'Rejected. Your reason is kept as a cue the next ideas run reads, and goes to your taste ledger in your words.'
    case 'trend': return 'Kept with the trend you name, for a wider piece.'
    case 'improved': return offday
      ? 'Kept with your note as a cue for a future piece. A revised version also comes back here to approve.'
      : 'Kept with your note as a cue for a future piece.'
  }
}

/** The approvals that stand now for a week, or null when they cannot be read (the view then holds every piece). */
export async function readApprovals(db: SupabaseClient, week: string): Promise<Approval[] | null> {
  try {
    const r = await db.rpc('board_approvals_now', { p_week: week })
    if (r.error || !Array.isArray(r.data)) return null
    return (r.data as Body[]).map(a => ({
      idea_id: String(a.idea_id || '').toLowerCase(), day: String(a.day || ''), date: String(a.date || '').slice(0, 10), via: String(a.via || ''),
      doc: String(a.doc || ''), option_ref: typeof a.option_ref === 'string' ? a.option_ref : null, revision: Number(a.revision) || 0,
      decided_at: a.decided_at instanceof Date ? a.decided_at.toISOString() : String(a.decided_at || ''),
      option_sha256: typeof a.option_sha256 === 'string' && SHA256.test(a.option_sha256) ? a.option_sha256 : null,
      words: typeof a.words === 'string' ? a.words : null, source: String(a.source || ''),
    }))
  } catch {
    return null
  }
}

/** The approval that holds a piece on its date: by its own id, or (an off-day option made into a piece) by the option's
 *  document its meta.offday.doc names. The same rule as board_approval_holds in the database. */
export function approvalFor(approvals: Approval[] | null, piece: Body, date: string): Approval | null {
  if (!approvals) return null
  const id = String(piece.id || '').toLowerCase()
  const doc = isObj(piece.meta) && isObj(piece.meta.offday) && typeof piece.meta.offday.doc === 'string' ? piece.meta.offday.doc : null
  return approvals.find(a => a.date === date && a.idea_id === id)
    || (doc ? approvals.find(a => a.date === date && a.doc === doc) || null : null)
}

/** A title as the start of a held line: ended with one full stop, never two ("Good things AI did this week.."). */
export function asSentence(title: string): string {
  const t = title.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}

/** A piece the board will not draw, and why. */
export interface Held { piece_id: string | null; option: string | null; title: string; text: string }
export const HELD_TITLE = 'Held: not approved by you'
export const HELD_CHANGED = 'Held: changed since you approved it'

/** The week's pieces split by the gate: the ones his approval holds on their day, and every other one as a held line,
 *  never hidden. ideas.json is read for the text check: an approval that bound the option's words holds only while
 *  the option on the board still has those words. */
export function gatePieces(week: string, pieces: Body[], approvals: Approval[] | null, ideas: Body | null) {
  const approved: Body[] = []
  const approvalOf = new Map<string, Approval>()
  const held = new Map<string, Held[]>()
  const live = pieces.filter(p => !p.buried_at && p.state !== 'dropped' && typeof p.id === 'string' && UUID.test(p.id) && typeof p.scheduled_for === 'string')
  const days = isObj(ideas) && isObj(ideas.days) ? ideas.days : {}
  for (const p of live) {
    const date = String(p.scheduled_for).slice(0, 10)
    const day = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).find(d => dayDate(week, d) === date)
    if (!day) continue
    const title = String(p.idea || p.thesis || 'Untitled').trim().replace(/\s+/g, ' ').slice(0, 140)
    const a = approvalFor(approvals, p, date)
    let why: string | null = null, heading = HELD_TITLE
    if (!approvals) why = 'Your approvals could not be read just now, so nothing is shown as approved until they can be.'
    else if (!a) why = 'Nothing you pressed on the ideas board put it on this day.'
    else if (a.via === 'pick' && a.option_sha256) {
      const opts = Array.isArray(days[day]) ? (days[day] as unknown[]).filter(isObj) : []
      const o = opts.find(x => String(x.id || '').toLowerCase() === String(p.id).toLowerCase())
      if (o && optionSha({ so_what: cutSoWhat(o.so_what), story: String(o.story || o.so_what || '') }) !== a.option_sha256) {
        why = 'Its words on the ideas board changed after you approved it, so your approval does not cover the new words.'
        heading = HELD_CHANGED
      }
    }
    if (why) {
      const list = held.get(day) || []
      list.push({ piece_id: String(p.id).toLowerCase(), option: null, title: heading, text: `${asSentence(title)} ${why}` })
      held.set(day, list)
      continue
    }
    approved.push(p)
    approvalOf.set(String(p.id).toLowerCase(), a!)
  }
  return { approved, approvalOf, held }
}

/** The so what a publishing day's press carries: the board's own cut of it (_viewExtras.ts). */
export function cutSoWhat(v: unknown): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, 2000) : ''
}
