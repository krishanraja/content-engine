import type { SupabaseClient } from '@supabase/supabase-js'
import { dayDate, type PostedDay } from './_posted.js'
import { offdaySides } from './_offdaySides.js'
import { OUTCOMES, OUTCOME_OF_USE, OUTCOME_OF_VERDICT, dayShort, dayWords, goes, optionSha, readApprovals, type Approval, type Outcome } from './_gate.js'
import type { PressAction } from './_viewExtras.js'
import { todayNY } from './_itsLive.js'
import { itemKey, laterMoveSpec, moveSpec, readItemsIn, type MoveSpec, type OffdayItem } from './_offdayItems.js'

// Ideas for later (Krish, 2026-11-12: "Does my 'Ideas for Later' tab contain everything I've not approved but not
// rejected in all the previous ideas boards?"). GET /api/board/later reads every option on every ideas board so far
// and his answers on each from the engine's records, and keeps the ones he neither approved nor rejected:
//
//   - filed for later: File for later (use next_week, an off day's verdict next_week), a "Queue it for later" mark
//     from the older boards (content_ideas.queued_at), or a future-piece cue filed from his words;
//   - saved as trends: Save as a trend (wider_piece_context, the older track_over_time, an off day's trend);
//   - to improve: Improve for a future piece (use improve, an off day's improve);
//   - answered on an older board: a verdict from before the five outcomes (Curious, Cute, Story, Angle) that was
//     neither a pick, a Drop nor a queue mark, kept in his own words and never read as one of the five;
//   - never answered: on a board, and no press of his anywhere.
//
// Where they come from: every week's ideas.json (the week's branch first, as the view reads it) and Growth's
// offdays-growth.json; his presses in board_documents (picks and queue), the verdicts imported from the first
// boards (engine_operator, before the fixed layout of 26 October), idea_outcomes (append only, from 2 November), the
// cues the idea queue filed from his words (feedback_cues, his and by rule, never a model's guess), and each idea's
// own row (published or on a day means approved; queued_at means filed). The latest answer, across every board an
// idea was on, is the one that counts; nothing is inferred, and an idea with no answer stays never answered.
//
// Every item carries the five presses of the ideas gate, each saved into a week's own board through the same routes
// and checks as the view's (_viewExtras.ts): File for later, Reject, Save as a trend and Improve on the board it was
// last on, and Approve for the next free date of its own weekday (picks/<day>, or queue/off-<day>-<id>, on that
// week), the one press that puts an idea on the publish board.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SERIES_SLOT: Record<string, string> = { mon: 'follow_the_money', wed: 'under_the_hood', fri: 'mind_the_gap' }
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, n) : '')
/** The first board whose ideas the engine keeps (the week of 12 October; its options were written onto the pieces). */
export const FIRST_IDEAS_WEEK = '2026-10-19'
/** Verdicts imported from the first boards are his presses, carried by the operator before the fixed layout. */
const IMPORTED_BEFORE = '2026-10-26'
/** How many weeks ahead an Approve looks for a free day. */
const AHEAD = 4

export type LaterGroup = 'filed' | 'trend' | 'improved' | 'older' | 'never'
export const LATER_GROUPS: ReadonlyArray<{ id: LaterGroup; label: string; line: string }> = [
  { id: 'filed', label: 'Filed for later', line: 'You filed it for later, or queued it on an older board.' },
  { id: 'trend', label: 'Saved as trends', line: 'You kept it with a trend, for a wider piece.' },
  { id: 'improved', label: 'To improve', line: 'You asked for it to be better before it runs.' },
  { id: 'older', label: 'Answered on an older board', line: 'A verdict from before the five outcomes: not a pick, not a drop, not a queue mark.' },
  { id: 'never', label: 'Never answered', line: 'It was on an ideas board and you never pressed anything on it.' },
]

type Said = Outcome | 'older'
/** One answer of his on an idea, from any record. */
export interface Answer { said: Said; at: string; words: string | null; via: string; week: string; label: string }
export interface LaterItem {
  key: string
  week: string
  day: string
  date: string
  kind: 'series' | 'offday'
  doc: string
  idea_id: string | null
  title: string
  text: string
  format: string | null
  source: string | null
  group: LaterGroup
  answer: Answer | null
  /** Every board it was on, newest first. */
  boards: Array<{ week: string; day: string }>
  actions: PressAction[]
  /** Why it has no Approve, when it has none. */
  held: string | null
  /** Move to… (Ruling, Krish, 2026-11-12: any off-day idea moves to any day at his press): an off-day idea onto any day
   *  from today through four weeks, his Approve for that day (_offdayItems.ts). Null for a series idea or a week's
   *  good news, and for an option the engine cannot find in its plan. */
  move?: MoveSpec | null
}
export interface LaterView {
  ok: true
  as_of: string
  weeks: string[]
  counts: Record<LaterGroup, number> & { total: number; options: number; approved: number; rejected: number; on_slate: number }
  groups: Array<{ id: LaterGroup; label: string; line: string; items: LaterItem[] }>
}

export interface LaterInputs {
  now: Date
  /** Each week from the first ideas board to the next, with its ideas.json and Growth's offdays-growth.json. */
  boards: Array<{ week: string; ideas: Body | null; growth: Body | null }>
  /** His presses: board_documents picks and queue, every week. */
  docs: Array<{ week: string; collection: string; doc_id: string; body: Body; updated_by: string; updated_at?: string; revision?: number }>
  /** idea_outcomes rows, every week. */
  outcomes: Array<{ week: string; day: string | null; idea_id: string | null; option_ref: string | null; doc: string; outcome: string; words: string | null; decided_by: string; decided_at: string; via: string | null }>
  /** feedback_cues filed from the idea queue (venture publication). */
  cues: Array<{ subject_ref: string | null; use: string; said: string | null; said_at: string; use_origin: string | null }>
  /** The ideas' own rows (content_ideas): every id an option names, and every queued one. */
  pieces: Body[]
  /** The rows of the one place an off-day item's day lives (offday_items), approved or in his Ideas for Later. */
  items?: OffdayItem[]
  /** The approvals that stand now, for this week and the weeks an Approve may go to. */
  approvals: Record<string, Approval[] | null>
}

const weekOf = (d: string) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10) }
const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const iso = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : '')

/** One option as a board showed it. */
interface Shown {
  week: string; day: string; kind: 'series' | 'offday'; pick: string; idea_id: string | null; option_id: string; weekly: boolean
  title: string; text: string; format: string | null; source: string | null; so_what: string; story: string; o: Body
  /** An off-day option read from the week's ideas.json (the plan a move reads it back from), not Growth's older file. */
  plan?: boolean
}

/** Every option on every board, in the board's order. */
export function boardOptions(boards: LaterInputs['boards'], pieces: Body[] = []): Shown[] {
  const out: Shown[] = []
  // An option written before ideas carried a record id is linked to the piece the old queue made of it (its row names
  // the board and the option it came from: meta.queue.from_week and from_pick), never by its words.
  const from = new Map<string, string>()
  for (const p of pieces) {
    const q = isObj(p.meta) && isObj(p.meta.queue) ? p.meta.queue : null
    if (q && typeof q.from_week === 'string' && typeof q.from_pick === 'string' && typeof p.id === 'string') from.set(`${q.from_week}/${q.from_pick}`, p.id.toLowerCase())
  }
  for (const b of boards) {
    const ideas = isObj(b.ideas) ? b.ideas : {}
    const days = isObj(ideas.days) ? ideas.days : {}
    for (const day of DAYS) {
      const list = Array.isArray(days[day]) ? (days[day] as unknown[]).filter(isObj) : []
      list.forEach((o, n) => {
        const id = typeof o.id === 'string' && UUID.test(o.id) ? o.id.toLowerCase() : from.get(`${b.week}/${day}-${n + 1}`) ?? null
        const story = String(o.story || o.so_what || '')
        const question = isObj(o.pitch) ? cut(o.pitch.question, 200) : ''
        const head = /Headline:\s*(.+?)(?:\s+Hook:|$)/.exec(story)
        out.push({ week: b.week, day, kind: 'series', pick: `${day}-${n + 1}`, idea_id: id, option_id: id || `${day}-${n + 1}`, weekly: false,
          title: question || (head ? cut(head[1], 200) : '') || cut(o.so_what, 200) || `${day}-${n + 1}`, text: cut(o.so_what, 600),
          format: null, source: isObj(o.source) ? cut(o.source.label, 200) || null : typeof o.source === 'string' ? cut(o.source, 200) || null : null,
          so_what: cut(o.so_what, 2000), story, o })
      })
    }
    const off = isObj(ideas.offdays) ? ideas.offdays : {}
    const seen = new Set<string>()
    for (const day of DAYS) {
      for (const o of (Array.isArray(off[day]) ? (off[day] as unknown[]).filter(isObj) : [])) {
        if (typeof o.id !== 'string' || !o.id) continue
        seen.add(`${day}/${o.id}`)
        out.push({ ...offShown(b.week, day, o), plan: true })
      }
    }
    // Growth's file of off-day options for the week (2 November's board had no ideas.json offdays).
    const growth = isObj(b.growth) && isObj(b.growth.days) ? b.growth.days : {}
    for (const [when, list] of Object.entries(growth)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(when) || !Array.isArray(list)) continue
      const day = DAYS[(new Date(`${when}T00:00:00Z`).getUTCDay() + 6) % 7]
      for (const g of list.filter(isObj)) {
        const id = typeof g.concept_id === 'string' ? g.concept_id : ''
        if (!id || seen.has(`${day}/${id}`)) continue
        seen.add(`${day}/${id}`)
        out.push(offShown(b.week, day, { id, copy: cut(g.draft, 4000), format: Array.isArray(g.formats) ? String(g.formats[0] || '') : String(g.lane || '') }))
      }
    }
  }
  return out
}

function offShown(week: string, day: string, o: Body): Shown {
  const s = offdaySides(o)
  return { week, day, kind: 'offday', pick: `off-${day}-${s.id}`, idea_id: null, option_id: s.id, weekly: Boolean(o.weekly) || /^goodnews\b/.test(s.id),
    title: s.hook || cut(s.copy, 200) || s.id, text: cut(s.pitch ? [s.pitch.see, s.pitch.lands].filter(Boolean).join(' ') || s.copy : s.copy, 600),
    format: s.format || null, source: s.source || null, so_what: '', story: '', o }
}

/** Who an idea is, across boards: its record id, else its off-day option id (a weekly good news is its own week's). */
const identity = (s: Shown) => (s.kind === 'series' ? (s.idea_id ? `idea:${s.idea_id}` : `pick:${s.week}/${s.pick}`) : s.weekly ? `off:${s.week}/${s.option_id}` : `off:${s.option_id}`)

const LEGACY: Record<string, string> = { story: 'Story', angle: 'Angle', cute: 'Cute', curious: 'Curious, not convinced' }
const outcomeOf = (o: string): Outcome | null => (Object.hasOwn(OUTCOMES, o) ? o as Outcome : null)

/** His answers on one option, from every record, oldest first. */
export function answersFor(s: Shown, i: LaterInputs): Answer[] {
  const out: Answer[] = []
  const add = (said: Said, at: string, words: unknown, via: string, week: string) => {
    if (!at) return
    out.push({ said, at, words: typeof words === 'string' && words.trim() ? cut(words, 600) : null, via, week,
      label: said === 'older' ? LEGACY[via.replace(/^legacy_/, '')] || 'Answered' : OUTCOMES[said as Outcome] })
  }
  // idea_outcomes: append only, his presses from 2 November. A day's pick is read from the board's own document below,
  // so a pick he later moved to another idea is not read as an approval that stands.
  for (const r of i.outcomes) {
    if (r.decided_by !== 'Krish' || r.week !== s.week || r.doc !== `queue/${s.pick}`) continue
    const o = outcomeOf(r.outcome)
    if (o) add(o, iso(r.decided_at), r.words, r.via || 'outcome', r.week)
  }
  // The board's own documents: his, or a verdict imported from the first boards.
  for (const d of i.docs) {
    if (d.week !== s.week) continue
    const imported = d.updated_by === 'engine_operator' && d.week < IMPORTED_BEFORE
    if (d.updated_by !== 'Krish' && !imported) continue
    const b = d.body, at = iso(b.at) || iso(d.updated_at)
    if (s.kind === 'series' && d.collection === 'picks' && d.doc_id === s.day && !('kind' in b)
      && (b.pick === s.pick || (s.idea_id && String(b.idea_id || '').toLowerCase() === s.idea_id))) add('approved', at, b.note, 'pick', d.week)
    if (d.collection !== 'queue' || d.doc_id !== s.pick) continue
    if (s.kind === 'offday') {
      const idea = isObj(b.idea) ? b.idea : null
      const dir = isObj(b.direction) ? b.direction : null
      const v = idea && typeof idea.verdict === 'string' ? OUTCOME_OF_VERDICT[idea.verdict] : undefined
      if (v) add(v, iso(idea!.at) || at, idea!.words, 'offday', d.week)
      else if (typeof b.approved === 'boolean') add(b.approved ? 'approved' : 'rejected', at, b.note, 'offday', d.week)
      // His Reject or Improve on the option's direction, with no answer on the idea, is still his answer on the option.
      else if (dir && (dir.verdict === 'reject' || dir.verdict === 'improve')) add(dir.verdict === 'reject' ? 'rejected' : 'improved', iso(dir.at) || at, dir.words, 'offday_direction', d.week)
      continue
    }
    if (typeof b.use === 'string' && OUTCOME_OF_USE[b.use]) { add(OUTCOME_OF_USE[b.use], at, b.reason || b.note, b.use, d.week); continue }
    if (typeof b.verdict === 'string') {
      // Before the five outcomes: Drop is his no, a queue mark files it, any other verdict stays as he gave it.
      const words = b.reason || b.angle
      if (b.verdict === 'drop') add('rejected', at, words, 'legacy_drop', d.week)
      else if (b.queued === true) add('filed', at, words, `legacy_${b.verdict}`, d.week)
      else if (LEGACY[b.verdict]) add('older', at, words, `legacy_${b.verdict}`, d.week)
    }
  }
  // The cues the idea queue filed from his words (never a model's guess), and the idea's own row.
  if (s.idea_id) {
    for (const c of i.cues) {
      if (String(c.subject_ref || '').toLowerCase() !== s.idea_id || c.use_origin === 'model_guess') continue
      const said: Said | null = c.use === 'future_piece' ? 'filed' : c.use === 'wider_piece_context' || c.use === 'track_over_time' ? 'trend' : c.use === 'not_for_us' ? 'rejected' : null
      // A cue answers the board it was said on: one said within the week before this board up to its Sunday.
      const at = iso(c.said_at)
      if (said && at && at.slice(0, 10) >= addDays(s.week, -9) && at.slice(0, 10) <= addDays(s.week, 6)) add(said, at, c.said, `cue_${c.use}`, s.week)
    }
  }
  // An Approve made from this list onto another week's board: a pick naming the idea, or the same off-day option, bound to
  // the same words, on any week.
  for (const d of i.docs) {
    if (d.week === s.week || d.updated_by !== 'Krish') continue
    const b = d.body, at = iso(b.at) || iso(d.updated_at)
    if (s.kind === 'series' && s.idea_id && d.collection === 'picks' && /^(mon|wed|fri)$/.test(d.doc_id) && !('kind' in b) && String(b.idea_id || '').toLowerCase() === s.idea_id)
      add('approved', at, b.note, 'pick', d.week)
    if (s.kind === 'offday' && d.collection === 'queue' && d.doc_id === s.pick && isObj(b.idea) && b.idea.verdict === 'approve' && b.idea.sha256 === offdaySides(s.o).idea_sha256)
      add('approved', iso(b.idea.at) || at, b.idea.words, 'offday', d.week)
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/** The whole list: every option he neither approved nor rejected, grouped, newest board first. Pure. */
export function buildLater(i: LaterInputs): LaterView {
  const shown = boardOptions(i.boards, i.pieces)
  const byId = new Map(i.pieces.filter(p => typeof p.id === 'string').map(p => [String(p.id).toLowerCase(), p]))
  const groups = new Map<string, Shown[]>()
  for (const s of shown) { const k = identity(s); groups.set(k, [...(groups.get(k) || []), s]) }
  const today = todayNY(i.now)
  const items: LaterItem[] = []
  let approved = 0, rejected = 0, onSlate = 0
  for (const [key, list] of groups) {
    const boards = [...list].sort((a, b) => b.week.localeCompare(a.week) || a.pick.localeCompare(b.pick))
    const last = boards[0]
    const piece = last.idea_id ? byId.get(last.idea_id) ?? null : null
    const answers = boards.flatMap(s => answersFor(s, i)).sort((a, b) => a.at.localeCompare(b.at))
    // The idea's own row: on a day or published means one of his approvals took it there; queued means filed.
    if (piece && (piece.published_at || piece.state === 'published' || piece.scheduled_for)) { approved++; continue }
    if (piece && typeof piece.queued_at === 'string' && !answers.some(a => a.at >= iso(piece.queued_at))) {
      const q = isObj(piece.meta) && isObj(piece.meta.queue) && isObj(piece.meta.queue.triage) ? piece.meta.queue.triage : null
      answers.push({ said: 'filed', at: iso(piece.queued_at), words: q && typeof q.said === 'string' ? cut(q.said, 600) : null, via: 'queue', week: last.week, label: 'Queued for later' })
    }
    // An Approve anywhere put it on a publish board once: it is not an idea for later, whatever he said after.
    if (answers.some(a => a.said === 'approved')) { approved++; continue }
    const answer = answers[answers.length - 1] ?? null
    if (answer?.said === 'rejected' || (piece && (piece.state === 'dropped' || piece.buried_at) && answer)) { rejected++; continue }
    const group: LaterGroup = !answer ? 'never' : answer.said === 'filed' ? 'filed' : answer.said === 'trend' ? 'trend' : answer.said === 'improved' ? 'improved' : 'older'
    // A board whose week has not begun is still the Sunday slate: what he has not answered there waits on the slate.
    if (group === 'never' && last.week > weekOf(today)) { onSlate++; continue }
    // Its row in the one place its day lives: on a day already means approved there; in his Ideas for Later, its move.
    const row = last.kind === 'offday' ? (i.items ?? []).find(r => r.item === itemKey('engine', last.week, last.option_id))
      ?? (i.items ?? []).find(r => r.option_id === last.option_id && r.state === 'later') ?? null : null
    if (row && row.state === 'approved') { approved++; continue }
    const { actions, held } = laterPresses(i, last, today)
    const move = last.kind !== 'offday' || last.weekly ? null : row ? laterMoveSpec(row, i.now)
      : last.plan ? moveSpec({ key: itemKey('engine', last.week, last.option_id), version: 0, source: 'engine', state: 'slate', origin_week: last.week, row: null }, last.o, last.week, last.day, i.now)
        : null
    items.push({ key, week: last.week, day: last.day, date: dayDate(last.week, last.day as PostedDay), kind: last.kind, doc: `queue/${last.pick}`, idea_id: last.idea_id,
      title: last.title, text: last.text, format: last.format, source: last.source, group, answer,
      boards: boards.map(b => ({ week: b.week, day: b.day })), actions, held, ...(move ? { move } : {}) })
  }
  const order = (a: LaterItem, b: LaterItem) => b.week.localeCompare(a.week) || (b.answer?.at || '').localeCompare(a.answer?.at || '') || a.doc.localeCompare(b.doc)
  const out = LATER_GROUPS.map(g => ({ ...g, items: items.filter(x => x.group === g.id).sort(order) }))
  const counts = Object.fromEntries(out.map(g => [g.id, g.items.length])) as Record<LaterGroup, number>
  return { ok: true, as_of: i.now.toISOString(), weeks: i.boards.filter(b => b.ideas || b.growth).map(b => b.week),
    counts: { ...counts, total: items.length, options: groups.size, approved, rejected, on_slate: onSlate }, groups: out }
}

const rev = (i: LaterInputs, week: string, collection: string, id: string) => {
  const r = i.docs.find(d => d.week === week && d.collection === collection && d.doc_id === id)
  return r && Number.isInteger(r.revision) ? Number(r.revision) : 0
}

/** The next date of a weekday, from tomorrow, in a week whose day has no approval standing (AHEAD weeks at most). */
export function freeDay(i: LaterInputs, day: string, kind: 'series' | 'offday', today: string): string | null {
  for (let k = 0; k < AHEAD; k++) {
    const week = addDays(weekOf(today), 7 * k)
    const date = dayDate(week, day as PostedDay)
    if (date <= today) continue
    const standing = i.approvals[week]
    if (!standing) continue
    const taken = standing.some(a => a.day === day && (kind === 'series' ? !String(a.doc).startsWith('queue/off-') : String(a.doc).startsWith('queue/off-')))
    if (!taken) return week
  }
  return null
}

/** The five presses on an idea for later: four on the board it was last on, Approve onto the next free date of its day. */
export function laterPresses(i: LaterInputs, s: Shown, today: string): { actions: PressAction[]; held: string | null } {
  const actions: PressAction[] = []
  let held: string | null = null
  if (s.kind === 'series') {
    const card = { pick: s.pick, idea_id: s.idea_id, so_what: s.so_what, story: s.story, series: SERIES_SLOT[s.day], week: s.week, day: s.day, option_sha256: optionSha({ so_what: s.so_what, story: s.story }) }
    const target = s.idea_id && SERIES_SLOT[s.day] ? freeDay(i, s.day, 'series', today) : null
    if (target) {
      actions.push({ kind: 'press', label: `Approve for ${dayShort(target, s.day)}`, week: target, collection: 'picks', id: s.day, revision: rev(i, target, 'picks', s.day),
        body: { day: s.day, pick: `later-${s.idea_id!.slice(0, 8)}`, idea_id: s.idea_id, series: SERIES_SLOT[s.day], story: s.story, so_what: s.so_what, option_sha256: card.option_sha256 },
        stamp: ['at'], words: { path: 'note', ask: 'Anything the story must do? (optional)', required: false },
        done: `Approved. It is on the publish board for ${dayWords(target, s.day)}.`, outcome: 'approved', goes: goes('approved', target, s.day) })
    } else held = s.idea_id ? `Every ${dayWords(weekOf(today), s.day).split(' ')[0]} in the next ${AHEAD} weeks has its piece, so it waits for a free one.`
      : 'This idea has no record in the engine, so it cannot go on a day: an ideas run that offers it again gives it one.'
    const use = (u: string, outcome: Outcome, label: string, done: string, words: PressAction['words'], extra: Body = {}): PressAction => ({
      kind: 'press', label, week: s.week, collection: 'queue', id: s.pick, revision: rev(i, s.week, 'queue', s.pick),
      body: { ...card, queued: true, use: u, ...extra }, words, stamp: ['at'], done, outcome, goes: goes(outcome, s.week, s.day) })
    actions.push(
      use('next_week', 'filed', 'File for later', 'Filed for later. It comes back on a later ideas board.',
        { path: 'note', ask: 'Anything to remember when it comes back? (optional)', required: false }, { target_week: addDays(weekOf(today), 7) }),
      use('not_for_us', 'rejected', 'Reject', 'Rejected, with your reason. The next ideas run learns from it.',
        { path: 'reason', ask: 'Why not? The next ideas run learns from your reason.', required: true }),
      use('wider_piece_context', 'trend', 'Save as a trend', 'Saved with its trend, for a wider piece.', { path: 'note', ask: 'Which trend is it part of?', required: true }),
      use('improve', 'improved', 'Improve for a future piece', 'Kept with your note for a future piece.', { path: 'note', ask: 'What would make it a piece later?', required: true }))
    return { actions, held }
  }
  const sides = offdaySides(s.o)
  // His earlier sides on the option (a direction, a mock, his note) are kept as saved, as the board keeps them.
  const prev = (week: string) => i.docs.find(d => d.week === week && d.collection === 'queue' && d.doc_id === s.pick && d.updated_by === 'Krish')?.body
  const base = (week: string): Body => {
    const was = prev(week)
    return { pick: s.pick, use: 'offday', day: s.day, week, option_id: sides.id, ...(sides.format ? { format: sides.format } : {}),
      ...(sides.source ? { source: sides.source } : {}), copy_sha256: sides.copy_sha256,
      ...(isObj(was?.direction) ? { direction: was!.direction } : {}), ...(isObj(was?.mock) ? { mock: was!.mock } : {}), ...(isObj(was?.note) ? { note: was!.note } : {}) }
  }
  const press = (week: string, verdict: string, label: string, done: string, outcome: Outcome, ask: string | null): PressAction => ({
    kind: 'press', label, week, collection: 'queue', id: s.pick, revision: rev(i, week, 'queue', s.pick),
    body: { ...base(week), idea: { verdict, words: null, sha256: sides.idea_sha256, ...(verdict === 'approve' ? { shown: sides.shown_idea } : {}) } },
    ...(ask ? { words: { path: 'idea.words', ask, required: true } } : {}), stamp: ['at', 'idea.at'], done, outcome, goes: goes(outcome, week, s.day, true) })
  const target = !s.weekly && s.day !== 'sun' ? freeDay(i, s.day, 'offday', today) : null
  if (s.weekly) held = 'A week\'s good news is made of that week\'s stories, so it cannot go on another week; each ideas run brings a new one.'
  else if (target) actions.push(press(target, 'approve', `Approve for ${dayShort(target, s.day)}`, `Approved. It is on the publish board for ${dayWords(target, s.day)}; Growth makes it.`, 'approved', null))
  else held = s.day === 'sun' ? 'Sunday is a rest day now, so it cannot go on a Sunday.' : `Every ${dayWords(weekOf(today), s.day).split(' ')[0]} in the next ${AHEAD} weeks has an approved post, so it waits for a free one.`
  actions.push(
    press(s.week, 'next_week', 'File for later', 'Filed for later. It comes back on a later ideas board.', 'filed', null),
    press(s.week, 'reject', 'Reject', 'Rejected, with your reason. The next ideas run learns from it.', 'rejected', 'Why not? The next ideas run learns from your reason.'),
    press(s.week, 'trend', 'Save as a trend', 'Saved with its trend, for a wider piece.', 'trend', 'Which trend is it part of?'),
    press(s.week, 'improve', 'Improve for a future piece', 'Kept with your note. The revise run also brings a new version back here.', 'improved', 'What would make it a piece later?'))
  return { actions, held }
}

type Fetcher = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ status: number; text(): Promise<string> }>
const RAW = 'https://raw.githubusercontent.com/krishanraja/content-engine'

/** Read every record and build the list. A board file that cannot be read is left out, never guessed. */
export async function readLater(db: SupabaseClient, fetcher: Fetcher = fetch as unknown as Fetcher, now = new Date()): Promise<LaterView> {
  const today = todayNY(now)
  const weeks: string[] = []
  for (let w = FIRST_IDEAS_WEEK; w <= addDays(weekOf(today), 7); w = addDays(w, 7)) weeks.push(w)
  const text = async (url: string) => { try { const r = await fetcher(url); return r.status === 200 ? await r.text() : null } catch { return null } }
  const json = (t: string | null) => { try { const v = t ? JSON.parse(t) : null; return isObj(v) ? v : null } catch { return null } }
  const boards = await Promise.all(weeks.map(async week => {
    const [branch, main, growth] = await Promise.all([
      week >= weekOf(today) ? text(`${RAW}/offday-revise/${week}/docs/plans/${week}-week/ideas.json`) : Promise.resolve(null),
      text(`${RAW}/main/docs/plans/${week}-week/ideas.json`),
      text(`${RAW}/main/docs/plans/${week}-week/offdays-growth.json`),
    ])
    return { week, ideas: json(branch) ?? json(main), growth: json(growth) }
  }))
  const ids = new Set<string>()
  for (const s of boardOptions(boards)) if (s.idea_id) ids.add(s.idea_id)
  // The old queue's rows first, so an option with no record id of its own is linked to the piece made of it.
  const queuedFirst = await db.from('content_ideas').select('id,idea,state,scheduled_for,published_at,buried_at,queued_at,meta').not('meta->queue', 'is', null).limit(500)
  for (const p of (queuedFirst.error ? [] : queuedFirst.data || []) as Body[]) if (typeof p.id === 'string') ids.add(p.id.toLowerCase())
  const ahead = Array.from({ length: AHEAD }, (_, k) => addDays(weekOf(today), 7 * k))
  const [docs, outcomes, cues, named, queued, placed, ...standing] = await Promise.all([
    db.from('board_documents').select('week,collection,doc_id,body,updated_by,updated_at,revision').in('collection', ['picks', 'queue']).gte('week', FIRST_IDEAS_WEEK).limit(5000),
    db.from('idea_outcomes').select('week,day,idea_id,option_ref,doc,outcome,words,decided_by,decided_at,via').limit(5000),
    db.from('feedback_cues').select('subject_ref,use,said,said_at,use_origin').eq('venture', 'publication').eq('source', 'idea_queue').limit(2000),
    ids.size ? db.from('content_ideas').select('id,idea,state,scheduled_for,published_at,buried_at,queued_at,meta').in('id', [...ids]).limit(1000) : Promise.resolve({ data: [], error: null }),
    db.from('content_ideas').select('id,idea,state,scheduled_for,published_at,buried_at,queued_at,meta').not('queued_at', 'is', null).limit(500),
    // The one place an off-day item's day lives: what he approved onto a day, and what he sent back to later.
    readItemsIn(db, ['approved', 'later']),
    ...ahead.map(w => readApprovals(db, w)),
  ])
  for (const r of [docs, outcomes, named, queued]) if (r.error) throw new Error('later_unreadable')
  const week = (v: unknown) => String(v || '').slice(0, 10)
  const pieces = new Map<string, Body>()
  for (const p of [...((named.data || []) as Body[]), ...((queued.data || []) as Body[])]) pieces.set(String(p.id).toLowerCase(), p)
  return buildLater({
    now, boards,
    docs: ((docs.data || []) as Body[]).map(d => ({ week: week(d.week), collection: String(d.collection), doc_id: String(d.doc_id), body: isObj(d.body) ? d.body : {},
      updated_by: String(d.updated_by || ''), updated_at: typeof d.updated_at === 'string' ? d.updated_at : undefined, revision: Number(d.revision) || 0 })),
    outcomes: ((outcomes.data || []) as Body[]).map(r => ({ week: week(r.week), day: typeof r.day === 'string' ? r.day : null, idea_id: typeof r.idea_id === 'string' ? r.idea_id : null,
      option_ref: typeof r.option_ref === 'string' ? r.option_ref : null, doc: String(r.doc || ''), outcome: String(r.outcome || ''), words: typeof r.words === 'string' ? r.words : null,
      decided_by: String(r.decided_by || ''), decided_at: String(r.decided_at || ''), via: typeof r.via === 'string' ? r.via : null })),
    cues: cues.error ? [] : ((cues.data || []) as Body[]).map(c => ({ subject_ref: typeof c.subject_ref === 'string' ? c.subject_ref : null, use: String(c.use || ''),
      said: typeof c.said === 'string' ? c.said : null, said_at: String(c.said_at || ''), use_origin: typeof c.use_origin === 'string' ? c.use_origin : null })),
    pieces: [...pieces.values()],
    items: placed ?? [],
    approvals: Object.fromEntries(ahead.map((w, k) => [w, standing[k] as Approval[] | null])),
  })
}
