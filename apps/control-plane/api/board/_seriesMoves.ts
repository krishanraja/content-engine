import type { SupabaseClient } from '@supabase/supabase-js'
import { dayDate, type PostedDay } from './_posted.js'
import { dayLabel, moveDays, todayIn, MOVE_AHEAD_DAYS, REST_DAYS, type LibraryFollower, type MoveDay, type MoveRequest, type MoveResult, type MoveSpec } from './_offdayItems.js'
import { optionSha, cutSoWhat } from './_gate.js'
import type { PressAction } from './_viewExtras.js'

// A series piece moves to any day, and his Approve on a day that already holds a piece replaces it (docs/PUBLISH_BOARDS.md,
// "Replacing a day's piece, and Move to… on a series piece"). Krish, 13 Nov 2026, on the live board, trying to put "The
// Great Recount" on Fri 20 and bring Fri 20's data-centre piece forward: "There is no approve button. I have to click
// through five different fucking pages for one idea, even though there are actually many ideas." Earlier the same day:
// "the great recount should be for 20 Nov, and the current 20 Nov piece should be brought forward as it is time
// sensitive", then "approved on both, get it done".
//
// Two presses, his only (hisOnlyRefusal and the route's own check; the database refuses any other actor):
//
//   Move to… on a series piece: POST /api/board/<Monday>/move with the same body as an off-day item's move, its item
//   `piece:<id>` and its version the piece's updated_at in milliseconds (the version the board read). Any day from today
//   through four weeks, never a past day or a Sunday, or back to his Ideas for Later.
//
//   Approve on a day that already holds a piece: POST /api/board/<Monday>/replace. The press says what it replaces
//   ("Approve for Fri 20 Nov, replacing <title>") and asks where the current piece goes: another day, Ideas for Later, or
//   alongside it on the same day (the press's `choose`, written at `current_to`).
//
// Each is one transaction in the database (series_piece_place, migration 20261201100000_series_piece_moves.sql): his
// new pick for the day, the placement the piece leaves (taken back, or filed for later), the placement it goes to (his
// approval of it on that day), then each piece's scheduled_for, guarded on the updated_at the board read; the ideas
// gate on content_ideas checks his approval for every new day, and idea_outcomes records each approval from the
// revision he saved. Then the research library's index rows follow each piece that moved.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
/** A series piece's item key on the board: the same field an off-day item's move names. */
export const PIECE_ITEM = /^piece:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
export const SERIES_OF: Record<string, string> = { mon: 'follow_the_money', wed: 'under_the_hood', fri: 'mind_the_gap' }
const PICKABLE = ['seeded', 'researching', 'drafting']
const DAY_ONLY = ['review', 'approved']
const PIECE_COLUMNS = 'id, idea, thesis, state, scheduled_for, lane_slot, buried_at, published_at, protected_at, meta, updated_at'

const dayKeyOf = (d: string) => DAYS[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7]
const shift = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const mondayOf = (d: string) => shift(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7))
const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)
const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, n) : '')
export const titleOf = (p: Body) => cut(p.idea || p.thesis || 'Untitled', 140)

/** The version a move names: the piece's updated_at in milliseconds, as the board read it. */
export function pieceVersion(p: Body): number {
  const t = Date.parse(String(p.updated_at || ''))
  return Number.isFinite(t) ? t : 0
}
/** A piece the engine keeps as an off-day item moves through its own row (_offdayItems.ts), never here. */
const offdayPiece = (p: Body) => isObj(p.meta) && isObj(p.meta.offday) && typeof p.meta.offday.doc === 'string' && Boolean(p.meta.offday.doc)
/** Whether a series move may move this piece: on the board, not out, not buried, not an off-day item. */
export function movable(p: Body): boolean {
  return typeof p.id === 'string' && UUID.test(p.id) && !p.buried_at && p.state !== 'dropped' && p.state !== 'published' && !p.published_at && !offdayPiece(p)
}

export const SERIES_MOVE_NOTE = 'Any day from today through four weeks. Sunday is a rest day, so it is not offered. The Tuesday, Thursday and Saturday limit is for a piece recorded on an off day, so it does not apply to this one.'

/** Move to… on a series piece (contract 1.13.0): the same shape as an off-day item's `move`. */
export function seriesMoveSpec(p: Body, now: Date): MoveSpec | null {
  if (!movable(p)) return null
  const date = ymd(p.scheduled_for)
  const id = String(p.id).toLowerCase()
  const from = date ? { week: mondayOf(date), day: dayKeyOf(date), date } : null
  const version = pieceVersion(p)
  return { op: 'move', label: 'Move to…', item: `piece:${id}`, version, state: date ? 'approved' : 'later', from,
    days: moveDays(now, { current: date }), later: Boolean(date), note: SERIES_MOVE_NOTE,
    body: { item: `piece:${id}`, version, from: from ? { week: from.week, day: from.day } : null } }
}

/** Where the piece that a replacing Approve replaces may go: every day a move may go to (but the day itself), Ideas for
 *  Later, or alongside the new piece on the same day. */
export function replaceChoices(now: Date, date: string, title: string): NonNullable<PressAction['choose']> {
  const days = moveDays(now).filter(d => d.date !== date)
  return { path: 'current_to', ask: `Where does "${cut(title, 80)}" go?`, multi: false, required: true,
    options: [...days.map(d => ({ value: d.date, label: d.label })), { value: 'later', label: 'Ideas for Later' }, { value: 'alongside', label: `Alongside it on ${dayLabel(date)}` }] }
}

/** The pick a replacing Approve saves, as an Approve on that option would save it. */
export interface PickCard { pick: string; idea_id: string; series: string; story: string; so_what: string; option_sha256: string }

/** The Approve on a day that already holds a piece (contract 1.13.0): it says what it replaces and asks where the
 *  current piece goes. POST /api/board/<week>/replace with the body and the chosen `current_to`. */
export function replacePress(o: { week: string; day: string; revision: number; card: PickCard; current: Body; now: Date; label?: string }): PressAction {
  const date = dayDate(o.week, o.day as PostedDay)
  const title = titleOf(o.current)
  return { kind: 'press', label: o.label ?? `Approve for ${dayLabel(date)}, replacing ${cut(title, 80)}`, op: 'replace', week: o.week,
    body: { day: o.day, revision: o.revision, pick: { day: o.day, ...o.card }, replaces: { item: `piece:${String(o.current.id).toLowerCase()}`, version: pieceVersion(o.current) } },
    choose: replaceChoices(o.now, date, title),
    words: { path: 'note', ask: 'Anything the story must do? (optional)', required: false },
    stamp: ['at'],
    done: `Approved. It is on the publish board for ${dayLabel(date)}, and "${cut(title, 80)}" has gone where you chose.`,
    outcome: 'approved',
    goes: `Goes onto the publish board for ${dayLabel(date)} as the day's piece, replacing "${cut(title, 80)}". You choose where that one goes: another day, Ideas for Later, or alongside it.` }
}

// ── The writes ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SeriesDeps {
  now: Date
  /** The research library's index rows of a piece; null when they cannot be written. */
  library?: LibraryFollower | null
}

const SAY: Record<string, string> = {
  stale: 'It moved a moment ago. The board has the new day; press again.',
  out_of_window: 'Pick a day from today through the next four weeks.',
  rest_day: 'Sunday is a rest day.',
  already_there: 'It is already on that day.',
  item_not_found: 'That piece is no longer on the board. The board has reloaded.',
  not_movable: 'That piece is out, buried or an off-day post, so it does not move here.',
  not_on_day: 'That day no longer holds that piece. The board has reloaded.',
  new_elsewhere: 'That idea is already on another day: move it from there.',
  new_not_pickable: 'That idea cannot go on a day now (it is buried, dropped, published or past the draft).',
  changed_words: 'Its words changed since the board was read. The board has reloaded.',
  not_approved_by_krish: 'The database found no approval of yours for it on that day, so nothing moved.',
}
const refuse = (status: number, error: string, extra: Body = {}): MoveResult => ({ status, body: { ok: false, error, line: SAY[error] || null, ...extra } })

async function readPiece(db: SupabaseClient, id: string): Promise<Body | null | 'error'> {
  const r = await db.from('content_ideas').select(PIECE_COLUMNS).eq('id', id).maybeSingle()
  if (r.error) return 'error'
  return (r.data as Body | null) ?? null
}
async function pickRevision(db: SupabaseClient, week: string, id: string): Promise<number | 'error'> {
  const r = await db.from('board_documents').select('revision').eq('week', week).eq('collection', 'picks').eq('doc_id', id).maybeSingle()
  if (r.error) return 'error'
  return r.data ? Number((r.data as Body).revision) || 0 : 0
}
/** The placement of a piece on a day: his approval of it there (placed), taken back, or filed for later. */
async function placement(db: SupabaseClient, date: string, pieceId: string, body: Body): Promise<{ week: string; id: string; body: Body; revision: number }> {
  const week = mondayOf(date), id = `place-${dayKeyOf(date)}-${pieceId}`
  const revision = await pickRevision(db, week, id)
  if (revision === 'error') throw new Error('board_store_unavailable')
  return { week, id, body: { kind: 'place_piece', piece_id: pieceId, day: dayKeyOf(date), date, ...body }, revision }
}
/** Where a piece may go: a day in the window (never Sunday), or why not. */
function checkDay(date: string, now: Date): string | null {
  const today = todayIn(now)
  if (REST_DAYS.includes(dayKeyOf(date))) return 'rest_day'
  if (date < today || date > shift(today, MOVE_AHEAD_DAYS)) return 'out_of_window'
  return null
}
async function call(db: SupabaseClient, p: Body): Promise<MoveResult | null> {
  const r = await db.rpc('series_piece_place', { p })
  if (r.error) {
    const msg = String(r.error.message || '')
    if (/revision_conflict|stale_piece/.test(msg)) return refuse(409, 'stale')
    if (/not_approved_by_krish/.test(msg)) return refuse(409, 'not_approved_by_krish')
    return refuse(503, 'board_store_unavailable')
  }
  if (!isObj(r.data) || r.data.ok !== true) return refuse(409, 'stale')
  return null
}
async function follow(deps: SeriesDeps, ids: string[]): Promise<Body> {
  const library: Body = {}
  for (const id of ids) library[id] = await (deps.library ? deps.library.follow(id) : Promise.resolve('not_configured')).catch(() => 'failed')
  return { at: deps.now.toISOString(), library }
}

/** Move one series piece, his press only (the route checks who): the one transaction, then the research library. */
export async function moveSeriesPiece(db: SupabaseClient, req: MoveRequest, deps: SeriesDeps): Promise<MoveResult> {
  const m = PIECE_ITEM.exec(req.item)
  if (!m) return refuse(400, 'invalid_item')
  const id = m[1].toLowerCase()
  const p = await readPiece(db, id)
  if (p === 'error') return refuse(503, 'board_store_unavailable')
  if (!p) return refuse(404, 'item_not_found')
  if (!movable(p)) return refuse(409, 'not_movable')
  if (pieceVersion(p) !== req.version) return refuse(409, 'stale', { version: pieceVersion(p) })
  const from = ymd(p.scheduled_for)
  const at = deps.now.toISOString()
  let to: string | null
  if (req.to === 'later') {
    if (!from) return refuse(409, 'already_there')
    to = null
  } else if ('date' in req.to) {
    to = req.to.date
    const why = checkDay(to, deps.now)
    // An Undo may put it back exactly where the move before took it from, a day now past included.
    if (why && !(req.undo && why === 'out_of_window' && await lastFrom(db, id) === to)) return refuse(400, why)
    if (to === from) return refuse(409, 'already_there')
  } else return refuse(400, 'invalid_to')

  const writes: Array<{ week: string; id: string; body: Body; revision: number }> = []
  try {
    if (from) writes.push(await placement(db, from, id, { placed: false, ...(to ? {} : { later: true }), moved: to ? { to_date: to, at } : { to: 'later', at }, words: req.words ?? null, at }))
    if (to) writes.push(await placement(db, to, id, { placed: true, moved: from ? { from_date: from, at } : { from: 'later', at }, words: req.words ?? null, at }))
  } catch { return refuse(503, 'board_store_unavailable') }
  const fail = await call(db, { actor: 'Krish', kind: 'move', words: req.words ?? null, writes,
    pieces: [{ id, updated_at: p.updated_at, scheduled_for: to, kind: 'move', from_date: from, to_place: to ? 'day' : 'later' }] })
  if (fail) return fail
  const followed = await follow(deps, [id])
  const after = await readPiece(db, id)
  const version = after && after !== 'error' ? pieceVersion(after) : 0
  const undo: Body = { item: req.item, version, from: to ? { week: mondayOf(to), day: dayKeyOf(to) } : null, undo: true, to: from ? { date: from } : 'later' }
  return { status: 200, body: { ok: true, item: req.item, version, state: to ? 'approved' : 'later', week: to ? mondayOf(to) : null, day: to ? dayKeyOf(to) : null, date: to,
    line: to ? `Moved to ${dayLabel(to)}. Approved for that day.` : 'Back in your Ideas for Later.',
    weeks: [...new Set([from && mondayOf(from), to && mondayOf(to)].filter(Boolean))], followed, elsewhere: [], undo } }
}
/** The day his last move of the piece took it from (series_moves), for an Undo onto a day now past. */
async function lastFrom(db: SupabaseClient, id: string): Promise<string | null> {
  const r = await db.from('series_moves').select('from_date').eq('piece_id', id).order('id', { ascending: false }).limit(1).maybeSingle()
  return r.error || !r.data ? null : ymd((r.data as Body).from_date)
}

// ── Approve on a day that already holds a piece ──────────────────────────────────────────────────────────────────────

export type CurrentTo = { date: string } | 'later' | 'alongside'
export interface ReplaceRequest {
  day: string
  revision: number
  pick: PickCard & { note?: string | null }
  replaces: { piece: string; version: number }
  current_to: CurrentTo
  at: string | null
}

/** The replacing Approve as the board sends it, or why not. */
export function replaceInput(body: unknown): { input?: ReplaceRequest; problem?: string } {
  if (!isObj(body)) return { problem: 'invalid_replace' }
  const day = body.day
  if (typeof day !== 'string' || !SERIES_OF[day]) return { problem: 'invalid_day' }
  if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) return { problem: 'invalid_revision' }
  const pk = body.pick
  if (!isObj(pk) || typeof pk.idea_id !== 'string' || !UUID.test(pk.idea_id) || typeof pk.pick !== 'string' || !/^[a-z0-9-]{1,40}$/.test(pk.pick)) return { problem: 'invalid_pick' }
  if (typeof pk.story !== 'string' || typeof pk.so_what !== 'string' || typeof pk.option_sha256 !== 'string') return { problem: 'invalid_pick' }
  const note = isObj(body) && typeof body.note === 'string' ? body.note : typeof pk.note === 'string' ? pk.note : null
  if (note && note.length > 2000) return { problem: 'invalid_note' }
  const rp = body.replaces
  const item = isObj(rp) && typeof rp.item === 'string' ? PIECE_ITEM.exec(rp.item) : null
  if (!item || !isObj(rp) || !Number.isSafeInteger(rp.version)) return { problem: 'invalid_replaces' }
  const raw = Array.isArray(body.current_to) ? body.current_to[0] : body.current_to
  let current_to: CurrentTo
  if (raw === 'later' || raw === 'alongside') current_to = raw
  else if (typeof raw === 'string' && DATE.test(raw)) current_to = { date: raw }
  else if (isObj(raw) && typeof raw.date === 'string' && DATE.test(raw.date)) current_to = { date: raw.date }
  else return { problem: 'invalid_current_to' }
  return { input: { day, revision: Number(body.revision), replaces: { piece: item[1].toLowerCase(), version: Number(rp.version) }, current_to,
    pick: { pick: pk.pick, idea_id: pk.idea_id.toLowerCase(), series: SERIES_OF[day], story: pk.story, so_what: pk.so_what, option_sha256: pk.option_sha256, note },
    at: typeof body.at === 'string' ? body.at : null } }
}

/** His Approve of an idea on a day that already holds a piece: the new pick, where the old piece goes, both pieces' days,
 *  in one transaction. His press only (the route checks who). */
export async function replacePick(db: SupabaseClient, week: string, req: ReplaceRequest, deps: SeriesDeps): Promise<MoveResult> {
  const date = dayDate(week, req.day as PostedDay)
  if (req.replaces.piece === req.pick.idea_id) return refuse(409, 'already_there')
  // The words he approved are the words the press carried.
  if (optionSha({ so_what: cutSoWhat(req.pick.so_what), story: req.pick.story }) !== req.pick.option_sha256
    && optionSha({ so_what: req.pick.so_what, story: req.pick.story }) !== req.pick.option_sha256) return refuse(409, 'changed_words')
  const [old, fresh] = await Promise.all([readPiece(db, req.replaces.piece), readPiece(db, req.pick.idea_id)])
  if (old === 'error' || fresh === 'error') return refuse(503, 'board_store_unavailable')
  if (!old || ymd(old.scheduled_for) !== date) return refuse(409, 'not_on_day')
  if (pieceVersion(old) !== req.replaces.version) return refuse(409, 'stale', { version: pieceVersion(old) })
  if (!fresh || fresh.buried_at || fresh.state === 'dropped' || fresh.state === 'published' || fresh.published_at) return refuse(409, 'new_not_pickable')
  if (ymd(fresh.scheduled_for) && ymd(fresh.scheduled_for) !== date) return refuse(409, 'new_elsewhere')
  const update: Body = PICKABLE.includes(String(fresh.state)) ? { state: 'drafting', lane_slot: req.pick.series, protect: true }
    : DAY_ONLY.includes(String(fresh.state)) ? {} : { refused: true }
  if (update.refused) return refuse(409, 'new_not_pickable')
  const goes = req.current_to
  if (typeof goes === 'object') {
    const why = checkDay(goes.date, deps.now)
    if (why) return refuse(400, why)
    if (goes.date === date) return refuse(409, 'already_there')
  }
  if (goes !== 'alongside' && !movable(old)) return refuse(409, 'not_movable')

  const at = req.at || deps.now.toISOString()
  const pickBody: Body = { day: req.day, pick: req.pick.pick, idea_id: req.pick.idea_id, series: req.pick.series, story: req.pick.story, so_what: req.pick.so_what,
    option_sha256: req.pick.option_sha256, at, ...(req.pick.note ? { note: req.pick.note } : {}),
    replaced: { piece_id: req.replaces.piece, to: typeof goes === 'object' ? goes.date : goes } }
  const writes: Array<{ week: string; id: string; body: Body; revision: number }> = [{ week, id: req.day, body: pickBody, revision: req.revision }]
  try {
    if (goes === 'alongside') writes.push(await placement(db, date, req.replaces.piece, { placed: true, alongside: req.pick.idea_id, at }))
    else {
      writes.push(await placement(db, date, req.replaces.piece, { placed: false, ...(goes === 'later' ? { later: true } : {}),
        moved: goes === 'later' ? { to: 'later', at } : { to_date: goes.date, at }, replaced_by: req.pick.idea_id, at }))
      if (goes !== 'later') writes.push(await placement(db, goes.date, req.replaces.piece, { placed: true, moved: { from_date: date, at }, at }))
    }
  } catch { return refuse(503, 'board_store_unavailable') }
  const oldTo = goes === 'alongside' ? date : goes === 'later' ? null : goes.date
  const fail = await call(db, { actor: 'Krish', kind: 'replace', words: req.pick.note ?? null, writes, pieces: [
    { id: req.replaces.piece, updated_at: old.updated_at, scheduled_for: oldTo, kind: 'replaced', from_date: date, to_place: goes === 'alongside' ? 'alongside' : goes === 'later' ? 'later' : 'day' },
    ...(ymd(fresh.scheduled_for) === date ? [] : [{ id: req.pick.idea_id, updated_at: fresh.updated_at, scheduled_for: date, kind: 'replace', from_date: ymd(fresh.scheduled_for), to_place: 'day', ...update }]),
  ] })
  if (fail) return fail
  const followed = await follow(deps, goes === 'alongside' ? [req.pick.idea_id] : [req.pick.idea_id, req.replaces.piece])
  const title = titleOf(old)
  const where = goes === 'alongside' ? `stays on ${dayLabel(date)} beside it` : goes === 'later' ? 'is back in your Ideas for Later' : `moved to ${dayLabel(goes.date)}, approved for that day`
  return { status: 200, body: { ok: true, day: req.day, date, piece: req.pick.idea_id, replaced: { piece: req.replaces.piece, title, to: oldTo, place: typeof goes === 'object' ? 'day' : goes },
    line: `Approved for ${dayLabel(date)}. "${cut(title, 80)}" ${where}.`,
    weeks: [...new Set([week, oldTo ? mondayOf(oldTo) : null].filter(Boolean))], followed } }
}

/** The days a series piece's move would put it on, for a test: a convenience re-export. */
export type { MoveDay }
