import type { SupabaseClient } from '@supabase/supabase-js'
import { offdaySides } from './_offdaySides.js'
import { dayDate, type PostedDay } from './_posted.js'
import { POSTS_FOLDER_ID, driveFolderIdOf, driveFolderUrl } from './_drivePosts.js'
import { postKeys, rowKeys, samePost } from './_onePost.js'

// Moving an off-day item to any day (docs/PUBLISH_BOARDS.md, "Moving an off-day item to any day"). Ruling (Krish,
// 2026-11-12): any off-day post or idea moves to any day at his press, and the move updates every place that names its
// day. His words: "I should be able to fluidly reassign any off-day post or assign any off-day idea to any day at will,
// and that should update the single source of truth everywhere."
//
// The one place that says which day an off-day item is on is the database's offday_items (migration
// 20261129090000_offday_items.sql): one row per item, versioned. The week's ideas.json is the plan's starting point
// only: an engine option nothing has touched sits on the day the plan offered it; once he approves it, moves it or files
// it for later, its row says its day and ideas.json never moves it again. Growth's options are rows from the start,
// written through the engine's API (offerGrowth), so they reach the board with no second file to merge.
//
// One write: POST /api/board/<Monday>/move (moveItem), his press only. It saves his Approve for the new day and takes
// his approval off the old one in the same transaction as the row moves (offday_item_move), so the ideas gate holds for
// the new day and for nothing he did not press. Then every place that names the day follows the row: the live board
// (its view reads the rows, and both weeks' board_signal is bumped), Growth's read of what to make on which day
// (readPieces filters by the row; Growth's own binding reads the board's day), the post's folder in Drive (renamed to
// its new date, by ID, so it files under its new week), the research library's index rows of a piece he records, and
// a post Growth already scheduled on a platform, which this engine cannot move: the item says so plainly until Growth
// reports it moved ("Still scheduled for Tue on Instagram: move it there too").
//
// Growth writes back to the same place (POST /api/board/<Monday>/offday-posts, reportPosts): each off-day post it made,
// scheduled (with its time) or posted (with its link), from its own posting record and never anything it did not post.
// An off-day post has no piece, so the older write-back (/posted) could not take it: Tue 10 Nov's carousel went out on
// six channels and the board still said "With Growth".

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type DayKey = typeof DAYS[number]
const DAY_ABBR: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const DAY_NAME: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const OPTION_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59}$/
export const ITEM_KEY = /^(engine|growth):(\d{4}-\d{2}-\d{2}):([a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59})$/
/** How far ahead a move may go: every day from today through the next four weeks (Krish, 2026-11-12). */
export const MOVE_AHEAD_DAYS = 28
/** The operator's day, as every other board date: New York. */
export const MOVE_TZ = 'America/New_York'
/** Sunday is a rest day (Ruling, Krish, 2026-11-02: "Let's eliminate Sunday from Publishing anythign permanently"). */
export const REST_DAYS: readonly string[] = ['sun']
/** A piece he records goes out on a Tuesday, Thursday or Saturday (_contracts.ts RECORDED_DAYS). */
const RECORDED_DAYS = ['tue', 'thu', 'sat']

export type ItemState = 'offered' | 'approved' | 'later' | 'withdrawn'
/** One entry of Growth's posting record for an item, as Growth reports it: made (its files are in its post folder),
 *  scheduled on a channel for a time, live on a channel with its link, or a scheduled post taken back (cancelled). */
export type PostState = 'made' | 'scheduled' | 'live' | 'cancelled'
export interface GrowthPost { state: PostState; channel: string | null; due_at: string | null; url: string | null; at: string; buffer_post_id: string | null }
/** One row of offday_items: the one place an off-day item's day lives. */
export interface OffdayItem {
  item: string
  source: 'engine' | 'growth'
  origin_week: string
  option_id: string
  option: Body
  state: ItemState
  week: string | null
  day: string | null
  date: string | null
  doc: string | null
  piece_id: string | null
  drive_folder: string | null
  /** Growth's posting record (migration 20261129100000): made, scheduled with its time, live with its link. */
  posts: GrowthPost[]
  followed: Body
  version: number
  placed_by: string
  placed_at: string
}
const COLUMNS = 'item,source,origin_week,option_id,option,state,week,day,date,doc,piece_id,drive_folder,posts,followed,version,placed_by,placed_at'
const POST_STATES: readonly PostState[] = ['made', 'scheduled', 'live', 'cancelled']
const httpsUrl = (v: unknown) => (typeof v === 'string' && /^https:\/\/[^\s]{1,2000}$/.test(v) ? v : null)
const isoOf = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null)
/** One entry of Growth's posting record, or null when it is not one. */
export function growthPost(v: unknown): GrowthPost | null {
  if (!isObj(v) || !(POST_STATES as readonly unknown[]).includes(v.state)) return null
  const channel = typeof v.channel === 'string' && /^[a-z][a-z0-9-]{0,30}$/.test(v.channel) ? v.channel : null
  const post: GrowthPost = { state: v.state as PostState, channel, due_at: isoOf(v.due_at), url: httpsUrl(v.url), at: isoOf(v.at) || '',
    buffer_post_id: typeof v.buffer_post_id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v.buffer_post_id) ? v.buffer_post_id : null }
  if (post.state === 'scheduled' && (!channel || !post.due_at)) return null
  // Live only with the channel and the post's own link: Growth's record of a post it made go out.
  if (post.state === 'live' && (!channel || !post.url)) return null
  if (post.state === 'cancelled' && !channel) return null
  return post
}

export const itemKey = (source: 'engine' | 'growth', week: string, id: string) => `${source}:${week}:${id}`
const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : v instanceof Date ? v.toISOString().slice(0, 10) : null)
const shift = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
export const mondayOf = (d: string) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10) }
export const dayKeyOf = (d: string) => DAYS[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7]

/** A row as the database answers it, or null when it is not one. */
export function itemOf(r: unknown): OffdayItem | null {
  if (!isObj(r) || typeof r.item !== 'string' || !ITEM_KEY.test(r.item)) return null
  const state = String(r.state)
  if (!['offered', 'approved', 'later', 'withdrawn'].includes(state)) return null
  return {
    item: r.item, source: r.source === 'growth' ? 'growth' : 'engine', origin_week: ymd(r.origin_week) || '', option_id: String(r.option_id || ''),
    option: isObj(r.option) ? r.option : {}, state: state as ItemState, week: ymd(r.week), day: typeof r.day === 'string' ? r.day : null, date: ymd(r.date),
    doc: typeof r.doc === 'string' ? r.doc : null, piece_id: typeof r.piece_id === 'string' ? r.piece_id.toLowerCase() : null,
    drive_folder: typeof r.drive_folder === 'string' ? r.drive_folder : null,
    posts: Array.isArray(r.posts) ? (r.posts as unknown[]).map(growthPost).filter((x): x is GrowthPost => Boolean(x)) : [],
    followed: isObj(r.followed) ? r.followed : {}, version: Number(r.version) || 1, placed_by: String(r.placed_by || ''), placed_at: String(r.placed_at || ''),
  }
}

/** The week's items: on one of its days, or offered by its own plan. Null when they cannot be read: the view then shows
 *  the plan's options as they are and offers no move, never a guess. */
export async function readItems(db: SupabaseClient, week: string): Promise<OffdayItem[] | null> {
  try {
    const r = await db.from('offday_items').select(COLUMNS).or(`week.eq.${week},origin_week.eq.${week}`).limit(500)
    if (r.error || !Array.isArray(r.data)) return null
    return (r.data as unknown[]).map(itemOf).filter((x): x is OffdayItem => Boolean(x))
  } catch { return null }
}

/** Every item in some states, across weeks (the ideas for later read the approved and the later ones). Null when they
 *  cannot be read. */
export async function readItemsIn(db: SupabaseClient, states: ItemState[]): Promise<OffdayItem[] | null> {
  try {
    const r = await db.from('offday_items').select(COLUMNS).in('state', states).limit(2000)
    if (r.error || !Array.isArray(r.data)) return null
    return (r.data as unknown[]).map(itemOf).filter((x): x is OffdayItem => Boolean(x))
  } catch { return null }
}

/** Where an option on the board sits and how a move names it. */
export interface Placed {
  key: string
  /** The row's version; 0 for an option no press has touched (it has no row yet). */
  version: number
  source: 'engine' | 'growth'
  /** slate: an engine option no press has touched, on the day the plan offered it; unknown: the rows could not be read. */
  state: ItemState | 'slate' | 'unknown'
  origin_week: string
  row: OffdayItem | null
  /** One post, one item (_onePost.ts): this option is a post that is already an item on another day (or in his Ideas
   *  for Later) under another id. It is that item: its Approve here moves it here, never a second copy. */
  twin?: { week: string | null; day: string | null; date: string | null; state: ItemState }
}

/** An item's option as the board shows it: an engine item still in its own week's plan reads the plan's words (the
 *  same words the plan shows on any day of that week), anything else the words its row keeps. Its Drive folder rides
 *  with it. */
export function contentOf(r: OffdayItem, ideas: Body | null, week: string): Body {
  let o: Body | null = null
  if (r.source === 'engine' && r.origin_week === week && isObj(ideas) && isObj(ideas.offdays)) {
    for (const d of DAYS) {
      const list = Array.isArray(ideas.offdays[d]) ? (ideas.offdays[d] as unknown[]).filter(isObj) : []
      o = list.find(x => String(x.id) === r.option_id) || null
      if (o) break
    }
  }
  const out: Body = { ...(o || r.option), id: r.option_id }
  if (!out.drive && r.drive_folder) out.drive = driveFolderUrl(r.drive_folder)
  return out
}

/** A day's off-day options from the one place: the plan's options for the day that no row moved away, then every row
 *  that sits on the day (moved here, approved here from his Ideas for Later, or one of Growth's), each with where it
 *  is. Rows that cannot be read leave the plan's options as they are, with no move. Pure. */
/** The items a re-plan carries to another option (`"item": "<key>"` on the option that carries it), across the plans the
 *  view read: the option they were first offered as leaves its day, so one post is drawn once. Pure. */
export function carriedItems(plans: Record<string, Body | null>): Set<string> {
  const out = new Set<string>()
  for (const [week, plan] of Object.entries(plans)) {
    const offdays = isObj(plan) && isObj(plan.offdays) ? plan.offdays : {}
    for (const list of Object.values(offdays)) {
      for (const o of Array.isArray(list) ? list.filter(isObj) : []) {
        if (typeof o.item === 'string' && ITEM_KEY.test(o.item) && o.item !== itemKey('engine', week, String(o.id))) out.add(o.item)
      }
    }
  }
  return out
}

export function dayOptions(ideas: Body | null, items: OffdayItem[] | null | undefined, week: string, day: string, base?: Body[], all?: OffdayItem[] | null,
  carried?: Set<string>): Array<{ o: Body; placed: Placed }> {
  // The day's own list: the plan's options for it, or (from the view) those and his approvals carried onto it from
  // another board (_viewExtras.ts offdayList).
  const list = (base ?? (isObj(ideas) && isObj(ideas.offdays) && Array.isArray(ideas.offdays[day]) ? ideas.offdays[day] as unknown[] : []))
    .filter((x): x is Body => isObj(x) && typeof x.id === 'string' && x.id.length > 0)
  const rows = items ?? []
  const byKey = new Map(rows.map(r => [r.item, r]))
  const here = (r: OffdayItem) => (r.state === 'offered' || r.state === 'approved') && r.week === week && r.day === day
  const hereByDoc = new Map(rows.filter(here).map(r => [r.doc, r]))
  // Every item of every week that is on a day or in his Ideas for Later, for one post, one item: a plan option that is
  // the same post as one of them is that item, never a second (_onePost.ts).
  const live = [...new Map([...(all ?? []), ...rows].filter(r => r.state === 'offered' || r.state === 'approved' || r.state === 'later').map(r => [r.item, r])).values()]
  const keyed = live.map(r => ({ r, keys: rowKeys(r) }))
  const twinOf = (o: Body, own: string) => {
    const keys = postKeys(o, { item: own, week })
    return keyed.find(x => x.r.item !== own && samePost(keys, x.keys))?.r ?? null
  }
  const seen = new Set<string>()
  const out: Array<{ o: Body; placed: Placed }> = []
  for (const o of list) {
    // The row that sits on this option's own press here (an item moved or approved onto it), else the plan's own item.
    const onDoc = hereByDoc.get(`queue/off-${day}-${String(o.id)}`)
    const own = itemKey('engine', week, String(o.id))
    const key = onDoc?.item ?? own
    const r = onDoc ?? byKey.get(key)
    if (r && !here(r)) continue
    // An option a re-plan carries to another option (that one names it, `item`) leaves its day, unless a press of his
    // stands on it: one post is drawn once, and a session's words never take his press away.
    if (!r && carried?.has(own)) continue
    // One post, one item: an option no press has touched that is the same post as an item already somewhere. On this
    // day, the item is drawn and the option is not; anywhere else, the option is that item, shown as one.
    const twin = !r ? twinOf(o, own) : null
    if (twin && here(twin)) continue
    const placedKey = twin ? twin.item : key
    if (seen.has(placedKey)) continue
    seen.add(placedKey)
    if (twin) {
      out.push({ o, placed: { key: twin.item, version: twin.version, source: twin.source, state: twin.state, origin_week: twin.origin_week, row: twin,
        twin: { week: twin.week, day: twin.day, date: twin.date, state: twin.state } } })
      continue
    }
    out.push({ o: r && r.item !== own ? { ...contentOf(r, ideas, week), ...o, id: r.option_id } : o,
      placed: { key, version: r?.version ?? 0, source: r?.source ?? 'engine', state: items ? (r ? r.state : 'slate') : 'unknown', origin_week: r?.origin_week ?? week, row: r ?? null } })
  }
  for (const r of rows) {
    if (seen.has(r.item) || !here(r)) continue
    seen.add(r.item)
    out.push({ o: contentOf(r, ideas, week), placed: { key: r.item, version: r.version, source: r.source, state: r.state, origin_week: r.origin_week, row: r } })
  }
  return out
}

/** Where else the same post is put up as an idea, for an item on a day: "Thu 12 Nov also offers this post (agentnotsetup):
 *  your Approve there moves it there, so it is only ever on one day." `plans` are the week plans the view read (its own
 *  week and those beside it). Pure. */
export function twinLines(r: OffdayItem | null, plans: Record<string, Body | null>): string[] {
  if (!r || (r.state !== 'approved' && r.state !== 'offered')) return []
  const mine = rowKeys(r)
  const out: string[] = []
  for (const [week, plan] of Object.entries(plans)) {
    const offdays = isObj(plan) && isObj(plan.offdays) ? plan.offdays : {}
    for (const day of DAYS) {
      for (const o of Array.isArray(offdays[day]) ? (offdays[day] as unknown[]).filter(isObj) : []) {
        if (typeof o.id !== 'string') continue
        const own = itemKey('engine', week, o.id)
        if (own === r.item || (week === r.week && day === r.day)) continue
        if (!samePost(postKeys(o, { item: own, week }), mine)) continue
        const said = typeof o.decided === 'string' && o.decided.trim() ? ' A session wrote that it is for that day; only your press moves it.' : ''
        out.push(`${dayLabel(dayDate(week, day as PostedDay))} also has this post up as an idea (${o.id}). Your Approve there moves it there, so it is only ever on one day.${said}`)
      }
    }
  }
  return [...new Set(out)]
}

/** Today as the operator's calendar has it (YYYY-MM-DD). */
export function todayIn(now: Date, timeZone = MOVE_TZ): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
/** "Thu 19 Nov". */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${DAY_ABBR[dayKeyOf(date)]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`
}

export interface MoveDay { date: string; week: string; day: string; label: string; current?: boolean }
/** Every day a move may go to: today through the next four weeks, never a past day and never a Sunday; a weekly good
 *  news only inside its own week, a piece he records only on a Tuesday, Thursday or Saturday. */
export function moveDays(now: Date, opts: { current?: string | null; onlyWeek?: string | null; recorded?: boolean } = {}): MoveDay[] {
  const today = todayIn(now)
  const out: MoveDay[] = []
  for (let n = 0; n <= MOVE_AHEAD_DAYS; n++) {
    const date = shift(today, n), day = dayKeyOf(date), week = mondayOf(date)
    if (REST_DAYS.includes(day)) continue
    if (opts.onlyWeek && week !== opts.onlyWeek) continue
    if (opts.recorded && !RECORDED_DAYS.includes(day)) continue
    out.push({ date, week, day, label: dayLabel(date), ...(opts.current === date ? { current: true } : {}) })
  }
  return out
}

/** What the live board needs to move one item (contract 1.9.0, an option's `move`): the press, every day it may go to
 *  with its own marked, and whether it may go back to his Ideas for Later. POST /api/board/<Monday>/move with `body`
 *  and `to` ({date} or "later"). */
export interface MoveSpec {
  op: 'move'
  label: string
  item: string
  version: number
  state: 'slate' | 'offered' | 'approved' | 'later'
  from: { week: string; day: string; date: string } | null
  days: MoveDay[]
  later: boolean
  /** Why some days are not offered, in his words. */
  note: string | null
  body: { item: string; version: number; from: { week: string; day: string } | null }
}

/** The move press for an option on a day, or null when its rows could not be read (nothing is moved on a guess). */
export function moveSpec(placed: Placed, o: Body, week: string, day: string, now: Date): MoveSpec | null {
  if (placed.state === 'unknown' || placed.state === 'withdrawn') return null
  // One post, one item: an option that is an item already elsewhere moves that item from where it is.
  if (placed.twin && placed.row) {
    if (placed.twin.state === 'later' || !placed.twin.week || !placed.twin.day) return laterMoveSpec(placed.row, now)
    return moveSpec({ ...placed, twin: undefined }, placed.row.option, placed.twin.week, placed.twin.day, now)
  }
  const date = dayDate(week, day as PostedDay)
  const weekly = Boolean(o.weekly)
  const recorded = o.kind === 'recorded'
  const days = moveDays(now, { current: date, onlyWeek: weekly ? week : null, recorded })
  const note = weekly ? 'This week\'s good news stays in its week: its stories are this week\'s.'
    : recorded ? 'A piece you record goes out on a Tuesday, Thursday or Saturday.' : 'Sunday is a rest day, so it is not offered.'
  return { op: 'move', label: 'Move to…', item: placed.key, version: placed.version, state: placed.state as MoveSpec['state'], from: { week, day, date },
    days, later: !weekly, note, body: { item: placed.key, version: placed.version, from: { week, day } } }
}

/** The move press for an item in his Ideas for Later. */
export function laterMoveSpec(r: OffdayItem, now: Date): MoveSpec {
  return { op: 'move', label: 'Move to…', item: r.item, version: r.version, state: 'later', from: null, days: moveDays(now), later: false,
    note: 'Sunday is a rest day, so it is not offered.', body: { item: r.item, version: r.version, from: null } }
}

/** What Growth has scheduled for an item on a day it is no longer on, said plainly: "Still scheduled for Tue on
 *  Instagram: move it there too". This engine never moves a post on a platform; Growth's approved route does. */
export function elsewhereLines(r: OffdayItem | null, now: Date): string[] {
  if (!r || !r.posts.length) return []
  const out: string[] = []
  for (const s of r.posts) {
    if (s.state !== 'scheduled' || !s.due_at) continue
    const on = todayIn(new Date(s.due_at))
    if (r.state === 'approved' && on === r.date) continue
    if (on < todayIn(now)) continue
    const where = `${DAY_ABBR[dayKeyOf(on)]} ${new Date(`${on}T00:00:00Z`).getUTCDate()} on ${channelWord(s.channel)}`
    out.push(r.state === 'approved' ? `Still scheduled for ${where}: move it there too` : `Still scheduled for ${where}: take it off there too`)
  }
  return [...new Set(out)]
}
/** Growth's posting record as the board shows it on the item (contract 1.9.0, options[].posts): what is made,
 *  scheduled (with when) and live (with its link), newest state per channel. */
export interface ViewGrowthPost { state: PostState; channel: string | null; label: string; at: string | null; due_at: string | null; href?: string }
export function viewPosts(r: OffdayItem | null): ViewGrowthPost[] {
  return (r?.posts ?? []).filter(p => p.state !== 'cancelled').map(p => ({ state: p.state, channel: p.channel,
    label: p.state === 'made' ? 'Made by Growth' : `${p.state === 'live' ? 'Live' : 'Scheduled'} on ${channelWord(p.channel)}`, at: p.at || null, due_at: p.due_at,
    ...(p.state === 'live' && p.url ? { href: p.url } : {}) }))
}
/** The channels an item is live on, from Growth's record. */
export function liveOn(r: OffdayItem | null): GrowthPost[] {
  return (r?.posts ?? []).filter(p => p.state === 'live')
}
export const channelWord = (c: string | null) => (c ? CHANNEL_WORD[c] || c : 'a channel')
const CHANNEL_WORD: Record<string, string> = { instagram: 'Instagram', reels: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', shorts: 'YouTube Shorts',
  x: 'X', threads: 'Threads', facebook: 'Facebook', linkedin: 'LinkedIn', substack: 'Substack', 'substack-notes': 'Substack Notes' }

// ── The one write ────────────────────────────────────────────────────────────────────────────────────────────────────

export type MoveTo = { date: string } | 'later' | { restore: 'offered'; week: string; day: string }
export interface MoveRequest {
  item: string
  version: number
  from: { week: string; day: string } | null
  to: MoveTo
  /** An Undo: the move puts the item back exactly where the move before it took it from, even a day now past. */
  undo?: boolean
  words?: string | null
}
const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDay = (v: unknown): v is DayKey => typeof v === 'string' && (DAYS as readonly string[]).includes(v)
const isMonday = (v: unknown): v is string => typeof v === 'string' && DATE.test(v) && new Date(`${v}T00:00:00Z`).getUTCDay() === 1

/** The move press as the board sends it, or why not. */
export function moveInput(body: unknown): { input?: MoveRequest; problem?: string } {
  if (!isObj(body)) return { problem: 'invalid_move' }
  if (typeof body.item !== 'string' || !ITEM_KEY.test(body.item)) return { problem: 'invalid_item' }
  if (!Number.isSafeInteger(body.version) || Number(body.version) < 0) return { problem: 'invalid_version' }
  let from: MoveRequest['from'] = null
  if (body.from !== null && body.from !== undefined) {
    if (!isObj(body.from) || !isMonday(body.from.week) || !isDay(body.from.day)) return { problem: 'invalid_from' }
    from = { week: body.from.week, day: body.from.day }
  }
  let to: MoveTo
  if (body.to === 'later') to = 'later'
  else if (isObj(body.to) && typeof body.to.date === 'string' && DATE.test(body.to.date) && !Number.isNaN(Date.parse(`${body.to.date}T00:00:00Z`))) to = { date: body.to.date }
  else if (isObj(body.to) && body.to.restore === 'offered' && isMonday(body.to.week) && isDay(body.to.day)) to = { restore: 'offered', week: body.to.week, day: body.to.day }
  else return { problem: 'invalid_to' }
  if ('words' in body && body.words !== null && !(typeof body.words === 'string' && body.words.length <= 2000)) return { problem: 'invalid_words' }
  if ('undo' in body && typeof body.undo !== 'boolean') return { problem: 'invalid_undo' }
  return { input: { item: body.item, version: Number(body.version), from, to, ...(body.undo === true ? { undo: true } : {}), words: typeof body.words === 'string' ? body.words : null } }
}

/** What a move needs besides the database: the time, the week plans, and the places that follow the day. */
export interface MoveDeps {
  now: Date
  /** A week's ideas.json (its offday-revise branch first, as the view reads it), or null. */
  ideas: (week: string) => Promise<Body | null>
  /** The post's folder in Drive; null when the engine cannot sign in to Drive. */
  drive?: DriveRenamer | null
  /** The research library's index rows of a piece he records; null when it cannot be written. */
  library?: LibraryFollower | null
}
export interface MoveResult { status: number; body: Body }

type Doc = { body: Body | null; revision: number }
async function readDoc(db: SupabaseClient, week: string, id: string): Promise<Doc> {
  const r = await db.from('board_documents').select('body,revision').eq('week', week).eq('collection', 'queue').eq('doc_id', id).maybeSingle()
  if (r.error) throw new Error('board_store_unavailable')
  const d = r.data as { body?: unknown; revision?: unknown } | null
  return { body: d && isObj(d.body) ? d.body : null, revision: d ? Number(d.revision) || 0 : 0 }
}

/** The body of his Approve on an off-day option for a day, as the board's own Approve saves it (offdayOptions), bound
 *  to the words shown; his earlier direction, mock and note ride with it. */
export function approveBody(o: Body, week: string, day: string, prev: Body | null, at: string, moved: Body | null): Body {
  const s = offdaySides(o)
  const id = `off-${day}-${s.id}`
  if (o.kind === 'recorded' || prev?.kind === 'recorded') {
    const was = prev || {}
    return { ...was, pick: id, use: 'offday', day, week, option_id: s.id, approved: true, at, ...(moved ? { moved } : {}) }
  }
  const body: Body = { pick: id, use: 'offday', day, week, option_id: s.id, ...(s.format ? { format: s.format } : {}), ...(s.source ? { source: s.source } : {}),
    copy_sha256: s.copy_sha256, idea: { verdict: 'approve', words: null, sha256: s.idea_sha256, at, shown: s.shown_idea } }
  if (prev && isObj(prev.direction)) body.direction = prev.direction
  if (prev && isObj(prev.mock)) body.mock = prev.mock
  if (prev && isObj(prev.note)) body.note = prev.note
  if (moved) body.moved = moved
  return body
}

/** The body that takes his approval off the day an item leaves (the move's other half): the same press with no verdict
 *  on its idea and where it went, which the ideas gate records as withdrawn; or, back to his Ideas for Later, his File
 *  for later on it. */
export function leaveBody(o: Body, week: string, day: string, prev: Body | null, at: string, moved: Body, later: boolean): Body {
  const s = offdaySides(o)
  if (prev && (prev.kind === 'recorded' || typeof prev.approved === 'boolean')) {
    return { ...prev, pick: `off-${day}-${s.id}`, use: 'offday', day, week, option_id: s.id, approved: false, at, moved }
  }
  const was = prev || {}
  const ideaSha = isObj(was.idea) && typeof was.idea.sha256 === 'string' ? was.idea.sha256 : s.idea_sha256
  const body: Body = { pick: `off-${day}-${s.id}`, use: 'offday', day, week, option_id: s.id, ...(s.format ? { format: s.format } : {}), ...(s.source ? { source: s.source } : {}),
    copy_sha256: typeof was.copy_sha256 === 'string' ? was.copy_sha256 : s.copy_sha256,
    idea: later ? { verdict: 'next_week', words: null, sha256: ideaSha, at } : { verdict: null, words: null, sha256: ideaSha, at }, moved }
  if (isObj(was.direction)) body.direction = was.direction
  if (isObj(was.mock)) body.mock = was.mock
  if (isObj(was.note)) body.note = was.note
  return body
}

const SAY: Record<string, string> = {
  stale: 'It moved elsewhere a moment ago. The board has the new day; press again.',
  day_has_it: 'That day already has this idea.',
  out_of_window: 'Pick a day from today through the next four weeks.',
  rest_day: 'Sunday is a rest day.',
  weekly_stays: 'This week\'s good news stays in its week.',
  recorded_days: 'A piece you record goes out on a Tuesday, Thursday or Saturday.',
  already_there: 'It is already on that day.',
  item_not_found: 'That idea is no longer on the board. The board has reloaded.',
  same_post: 'That post is already on another day. It is one post: move it from there.',
}

/** Move one item, his press only (the route checks who): the one write, then every place that names the day. */
export async function moveItem(db: SupabaseClient, req: MoveRequest, deps: MoveDeps): Promise<MoveResult> {
  const m = ITEM_KEY.exec(req.item)!
  const source = m[1] as 'engine' | 'growth', origin = m[2]
  const refuse = (status: number, error: string, extra: Body = {}) => ({ status, body: { ok: false, error, line: SAY[error] || null, ...extra } })
  const read = await db.from('offday_items').select(COLUMNS).eq('item', req.item).maybeSingle()
  if (read.error) return refuse(503, 'board_store_unavailable')
  const row = itemOf(read.data)
  // The id the item's press goes under now: the option a re-plan carried it as (one post, one item), else its own.
  const optionId = row?.option_id || m[3]
  if (row && row.version !== req.version) return refuse(409, 'stale', { version: row.version, week: row.week, day: row.day })
  if (!row && req.version !== 0) return refuse(409, 'stale', { version: 0 })

  // Where it is now, and its words as the board shows them.
  let cur: { state: 'slate' | ItemState; week: string | null; day: string | null }
  let option: Body | null = null
  const originIdeas = source === 'engine' ? await deps.ideas(origin).catch(() => null) : null
  if (row) {
    cur = { state: row.state, week: row.week, day: row.day }
    option = contentOf(row, originIdeas, origin)
  } else {
    if (source !== 'engine' || !req.from || req.from.week !== origin) return refuse(404, 'item_not_found')
    const list = isObj(originIdeas) && isObj(originIdeas.offdays) && Array.isArray(originIdeas.offdays[req.from.day]) ? (originIdeas.offdays[req.from.day] as unknown[]).filter(isObj) : []
    option = list.find(x => String(x.id) === optionId) || null
    if (!option) return refuse(404, 'item_not_found')
    // An approval of his that stands on it with no row yet (a press the row could not follow) is still his approval
    // there: the move takes it off that day like any other.
    const standing = await db.rpc('board_approvals_now', { p_week: origin })
    if (standing.error || !Array.isArray(standing.data)) return refuse(503, 'board_store_unavailable')
    const approved = (standing.data as Body[]).some(a => a.doc === `queue/off-${req.from!.day}-${optionId}`)
    cur = { state: approved ? 'approved' : 'slate', week: origin, day: req.from.day }
  }
  if (row?.state === 'withdrawn') return refuse(404, 'item_not_found')

  // Where it goes.
  const today = todayIn(deps.now)
  let to: { state: 'approved' | 'later' | 'offered'; week: string | null; day: string | null; date: string | null }
  if (req.to === 'later') {
    if (cur.state === 'later') return refuse(409, 'already_there')
    if (option.weekly) return refuse(400, 'weekly_stays')
    to = { state: 'later', week: null, day: null, date: null }
  } else if ('restore' in req.to) {
    // An Undo of a move from the slate: back to being offered on the day it was offered, his approval taken back.
    const last = await db.from('offday_moves').select('version,from_state,from_week,from_day').eq('item', req.item).order('id', { ascending: false }).limit(1).maybeSingle()
    const l = last.data as Body | null
    const back = req.to
    // It was offered there before his last move: a row offered on that day, or (no row before it) the plan's option
    // on the day the plan offered it.
    const wasOffered = Boolean(l && Number(l.version) === req.version && (
      (l.from_state === 'offered' && ymd(l.from_week) === back.week && l.from_day === back.day)
      || (l.from_state === null && source === 'engine' && back.week === origin && isObj(originIdeas) && isObj(originIdeas.offdays)
        && Array.isArray(originIdeas.offdays[back.day]) && (originIdeas.offdays[back.day] as unknown[]).some(x => isObj(x) && String(x.id) === optionId))))
    if (last.error || !wasOffered) return refuse(409, 'stale', { version: row?.version ?? 0 })
    to = { state: 'offered', week: back.week, day: back.day, date: dayDate(back.week, back.day as PostedDay) }
  } else {
    const date = req.to.date, day = dayKeyOf(date), week = mondayOf(date)
    const window = date >= today && date <= shift(today, MOVE_AHEAD_DAYS)
    if (!window || REST_DAYS.includes(day)) {
      // An Undo may put it back exactly where the move before took it from, a day now past included.
      const last = req.undo ? await db.from('offday_moves').select('version,from_date').eq('item', req.item).order('id', { ascending: false }).limit(1).maybeSingle() : null
      const backTo = last && !last.error && last.data && ymd((last.data as Body).from_date) === date && Number((last.data as Body).version) === req.version
      if (!backTo) return refuse(400, REST_DAYS.includes(day) ? 'rest_day' : 'out_of_window')
    }
    if (option.weekly && week !== (cur.week || origin)) return refuse(400, 'weekly_stays')
    if ((option.kind === 'recorded' || row?.piece_id) && !RECORDED_DAYS.includes(day)) return refuse(400, 'recorded_days')
    if (cur.state === 'approved' && cur.week === week && cur.day === day) return refuse(409, 'already_there')
    to = { state: 'approved', week, day, date }
  }

  // Never two options on one press: another item on that document, or the plan's own option of that id on that day.
  if (to.week && to.day) {
    const doc = `queue/off-${to.day}-${optionId}`
    const other = await db.from('offday_items').select('item').eq('week', to.week).eq('doc', doc).in('state', ['offered', 'approved']).neq('item', req.item).limit(1)
    if (other.error) return refuse(503, 'board_store_unavailable')
    if ((other.data || []).length) return refuse(409, 'day_has_it')
    if (itemKey('engine', to.week, optionId) !== req.item) {
      const plan = to.week === origin ? originIdeas : await deps.ideas(to.week).catch(() => null)
      const theirs = isObj(plan) && isObj(plan.offdays) && Array.isArray(plan.offdays[to.day]) ? (plan.offdays[to.day] as unknown[]).filter(isObj) : []
      if (theirs.some(x => String(x.id) === optionId)) {
        const planRow = await db.from('offday_items').select('state,week,day').eq('item', itemKey('engine', to.week, optionId)).maybeSingle()
        const p = planRow.data as Body | null
        const stillThere = !p || ((p.state === 'offered' || p.state === 'approved') && ymd(p.week) === to.week && p.day === to.day)
        if (stillThere) return refuse(409, 'day_has_it')
      }
    }
  }

  // His press: the day it leaves, then the day it goes to.
  const at = deps.now.toISOString()
  const writes: Array<{ week: string; id: string; body: Body; revision: number }> = []
  const leaving = cur.week && cur.day ? { week: cur.week, id: `off-${cur.day}-${optionId}` } : null
  const arriving = to.state === 'approved' ? { week: to.week!, id: `off-${to.day}-${optionId}` } : null
  const sameDoc = leaving && arriving && leaving.week === arriving.week && leaving.id === arriving.id
  // A row approved where it is takes his approval off that day; an option he never approved has nothing to take off,
  // unless it goes to his Ideas for Later, which is his File for later on it.
  const writeLeave = leaving && !sameDoc && (cur.state === 'approved' || to.state === 'later')
  try {
    if (writeLeave) {
      const prev = await readDoc(db, leaving!.week, leaving!.id)
      const moved: Body = to.state === 'later' ? { to: 'later', at } : { to_week: to.week, to_day: to.day, at }
      writes.push({ ...leaving!, body: leaveBody(option, leaving!.week, cur.day!, prev.body, at, moved, to.state === 'later'), revision: prev.revision })
    }
    if (arriving) {
      const prev = await readDoc(db, arriving.week, arriving.id)
      const moved: Body | null = cur.week && cur.day && !sameDoc ? { from_week: cur.week, from_day: cur.day, at } : cur.state === 'later' ? { from: 'later', at } : null
      // His earlier direction, mock and note on the item travel with it.
      const carried = leaving && !sameDoc ? (await readDoc(db, leaving.week, leaving.id)).body : null
      const base = prev.body && isObj(prev.body.direction) ? prev.body : carried || prev.body
      writes.push({ ...arriving, body: approveBody(option, arriving.week, to.day!, base, at, moved), revision: prev.revision })
    }
  } catch { return refuse(503, 'board_store_unavailable') }

  const drive = row?.drive_folder || driveFolderIdOf(option.drive)
  const pieceId = row?.piece_id || (typeof option.piece_id === 'string' && /^[0-9a-f-]{36}$/i.test(option.piece_id) ? option.piece_id.toLowerCase() : null)
  const call = await db.rpc('offday_item_move', { p: {
    item: req.item, version: req.version, actor: 'Krish', source, origin_week: origin, option_id: optionId, option,
    drive_folder: drive, piece_id: pieceId, state: to.state, place: to.week ? { week: to.week, day: to.day } : null, writes, words: req.words ?? null,
  } })
  if (call.error) {
    const msg = String(call.error.message || '')
    if (/revision_conflict/.test(msg)) return refuse(409, 'stale')
    if (/not_approved_by_krish/.test(msg)) return refuse(409, 'not_approved_by_krish')
    if (/same_post/.test(msg)) return refuse(409, 'same_post')
    return refuse(503, 'board_store_unavailable')
  }
  const done = call.data as Body
  if (!isObj(done) || done.ok !== true) return refuse(409, String((done as Body)?.error || 'stale'), { version: (done as Body)?.version ?? null })

  // Every place that names its day follows the row, after it has landed. A follower that cannot reach its place is
  // said on the item, never a failed move.
  const followed: Body = { at }
  if (drive) followed.drive = await followDrive(deps.drive ?? null, drive, to.date)
  if (pieceId) followed.library = await (deps.library ? deps.library.follow(pieceId) : Promise.resolve('not_configured')).catch(() => 'failed')
  await db.from('offday_items').update({ followed }).eq('item', req.item).then(() => null, () => null)
  const after = itemOf({ ...(row || { item: req.item, source, origin_week: origin, option_id: optionId, option, placed_by: 'Krish', placed_at: at, posts: [] }),
    state: to.state, week: to.week, day: to.day, date: to.date, version: Number(done.version) })
  const undo: Body = { item: req.item, version: Number(done.version), from: to.week ? { week: to.week, day: to.day } : null, undo: true,
    to: cur.state === 'slate' || cur.state === 'offered' ? { restore: 'offered', week: cur.week, day: cur.day }
      : cur.state === 'later' ? 'later' : { date: dayDate(cur.week!, cur.day as PostedDay) } }
  return { status: 200, body: {
    ok: true, item: req.item, version: Number(done.version), state: to.state, week: to.week, day: to.day, date: to.date,
    line: to.state === 'later' ? 'Back in your Ideas for Later.' : to.state === 'offered' ? `Back as an idea for ${DAY_NAME[to.day!]}.` : `Moved to ${dayLabel(to.date!)}. Approved for that day.`,
    weeks: [...new Set([cur.week, to.week].filter(Boolean))], followed, elsewhere: elsewhereLines(after, deps.now), undo,
  } }
}

// ── Growth's options, through the engine's API ──────────────────────────────────────────────────────────────────────

export interface OfferItem { item: string; option_id: string; option: Body; day: string; drive_folder: string | null }
/** Growth's options for a week (growth-offdays/1, the file growth.py mix offdays writes, or growth-offdays/2, a list),
 *  as rows to offer, with what was left out and why. Sunday is a rest day; an option whose id the week's own plan uses
 *  on the same day is the plan's. Pure. */
export function growthItems(week: string, body: unknown, plan: Body | null): { items?: OfferItem[]; problem?: string; left: Array<{ id: string; why: string }> } {
  const left: Array<{ id: string; why: string }> = []
  if (!isObj(body)) return { problem: 'invalid_offer', left }
  const raw: Array<{ day: string; o: Body }> = []
  if (body.schema === 'growth-offdays/1' && isObj(body.days)) {
    if (String(body.week_of) !== week) return { problem: 'wrong_week', left }
    for (const [date, list] of Object.entries(body.days)) {
      if (!DATE.test(date) || mondayOf(date) !== week || !Array.isArray(list)) return { problem: 'invalid_day', left }
      for (const g of list.filter(isObj)) {
        const src = typeof g.source_url === 'string' && g.source_url.startsWith('https://') ? { label: 'Source', url: g.source_url } : (typeof g.lane === 'string' ? `Growth: ${g.lane}` : 'Growth')
        const rich = Object.fromEntries(['hook', 'pitch', 'cards', 'inspiration', 'learned_from', 'direction', 'ties_to', 'recommended', 'mock', 'slides', 'video', 'drive', 'download']
          .filter(k => g[k] !== undefined && g[k] !== null).map(k => [k, g[k]]))
        raw.push({ day: dayKeyOf(date), o: { id: g.concept_id, format: (Array.isArray(g.formats) ? g.formats.join(', ') : '') || g.lane || '', source: src, copy: g.draft ?? '',
          lane: g.lane ?? null, share_line: g.share_line ?? null, needs: Array.isArray(g.needs) ? g.needs : [], ready: g.ready === true, ...rich } })
      }
    }
  } else if (body.schema === 'growth-offdays/2' && Array.isArray(body.options)) {
    if (String(body.week) !== week) return { problem: 'wrong_week', left }
    for (const g of body.options.filter(isObj)) raw.push({ day: String(g.day), o: { ...g } })
  } else return { problem: 'invalid_schema', left }
  const items: OfferItem[] = []
  const seen = new Set<string>()
  for (const { day, o } of raw) {
    const id = String(o.id || '')
    if (!OPTION_ID.test(id)) { left.push({ id, why: 'invalid_id' }); continue }
    if (!isDay(day)) { left.push({ id, why: 'invalid_day' }); continue }
    if (REST_DAYS.includes(day)) { left.push({ id, why: 'rest_day' }); continue }
    if (typeof o.copy !== 'string' || !o.copy.trim()) { left.push({ id, why: 'no_words' }); continue }
    const planned = isObj(plan) && isObj(plan.offdays) && Array.isArray(plan.offdays[day]) && (plan.offdays[day] as unknown[]).some(x => isObj(x) && String(x.id) === id)
    if (planned) { left.push({ id, why: 'the_plans_own' }); continue }
    if (seen.has(id)) { left.push({ id, why: 'twice' }); continue }
    seen.add(id)
    const option: Body = { ...o, id, by: 'growth' }
    if (JSON.stringify(option).length > 50000) { left.push({ id, why: 'too_long' }); continue }
    items.push({ item: itemKey('growth', week, id), option_id: id, option, day, drive_folder: driveFolderIdOf(o.drive) })
  }
  return { items, left }
}

/** Offer Growth's options for the week: each a row, offered on its day; one he has pressed is his and never touched. */
export async function offerGrowth(db: SupabaseClient, week: string, body: unknown, plan: Body | null): Promise<MoveResult> {
  const { items, problem, left } = growthItems(week, body, plan)
  if (!items) return { status: 400, body: { ok: false, error: problem } }
  const r = await db.rpc('offday_items_offer', { p_week: week, p_source: 'growth', p_items: items })
  if (r.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
  return { status: 200, body: { ...(isObj(r.data) ? r.data : { ok: true }), left } }
}

/** Growth's posting record for the week's items, from its own record (POST /api/board/<Monday>/offday-posts):
 *  {posts: [{item or option (off-<day>-<id>), state: made | scheduled | live | cancelled, channel, due_at, url, at,
 *  buffer_post_id, drive?}]}. Each entry is merged into the item's record: one made, and per channel its latest
 *  scheduled or live post (a live post is never taken back by a later scheduled one; cancelled takes a scheduled one
 *  off). Live needs the channel and the post's own link. Growth never reports a post it did not post. */
export async function reportPosts(db: SupabaseClient, week: string, body: unknown, now: Date = new Date()): Promise<MoveResult> {
  if (!isObj(body) || !Array.isArray(body.posts) || body.posts.length > 200) return { status: 400, body: { ok: false, error: 'invalid_posts' } }
  // A piece's own scheduled posts (a series day's, or an off-day piece's) are kept on its day's boxes (_posted.ts
  // recordScheduled), so the board says when it goes out.
  const { pieceScheduled, recordScheduled } = await import('./_posted.js')
  const pieceEntries = (body.posts as unknown[]).filter(p => isObj(p) && typeof p.piece_id === 'string' && !p.item && !p.option)
  let pieces: { kept: number; left: number } | null = null
  if (pieceEntries.length) {
    const ok = pieceEntries.map(pieceScheduled).filter((x): x is NonNullable<ReturnType<typeof pieceScheduled>> => Boolean(x))
    const r = await recordScheduled(db, week, ok, now.toISOString())
    if (r.failed) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
    pieces = { kept: r.kept, left: r.left + (pieceEntries.length - ok.length) }
    if (pieceEntries.length === body.posts.length) return { status: 200, body: { ok: true, items: 0, unknown: 0, pieces } }
  }
  body = { ...body, posts: (body.posts as unknown[]).filter(p => !pieceEntries.includes(p)) }
  if (!isObj(body) || !Array.isArray(body.posts)) return { status: 400, body: { ok: false, error: 'invalid_posts' } }
  const items = await readItems(db, week)
  if (!items) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
  const next = new Map<string, { row: OffdayItem; posts: GrowthPost[]; drive: string | null }>()
  let unknown = 0
  for (const raw of body.posts.filter(isObj)) {
    const ref = String(raw.item || raw.option || '')
    const row = items.find(r => r.item === ref || (r.week === week && r.doc === `queue/${ref}`))
    const post = growthPost({ ...raw, at: raw.at ?? now.toISOString() })
    if (!row || !post) { unknown++; continue }
    const cur = next.get(row.item) ?? { row, posts: [...row.posts], drive: null }
    if (post.state === 'made') cur.posts = cur.posts.filter(p => p.state !== 'made')
    else if (post.state === 'cancelled') cur.posts = cur.posts.filter(p => !(p.state === 'scheduled' && p.channel === post.channel))
    else if (post.state === 'scheduled' && cur.posts.some(p => p.state === 'live' && p.channel === post.channel)) { next.set(row.item, cur); continue }
    else cur.posts = cur.posts.filter(p => !(p.channel === post.channel && (p.state === 'scheduled' || p.state === 'live')))
    if (post.state !== 'cancelled') cur.posts.push(post)
    const folder = typeof raw.drive === 'string' ? (await import('./_drivePosts.js')).driveFolderIdOf(raw.drive) : null
    if (folder && !row.drive_folder) cur.drive = folder
    next.set(row.item, cur)
  }
  for (const [item, { posts, drive }] of next) {
    const w = await db.from('offday_items').update({ posts: posts.slice(-40), ...(drive ? { drive_folder: drive } : {}) }).eq('item', item)
    if (w.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
  }
  return { status: 200, body: { ok: true, items: next.size, unknown, ...(pieces ? { pieces } : {}) } }
}

/** The week's items for Growth (GET /api/board/<Monday>/offdays): where each is now, by the one place. */
export function itemsForGrowth(items: OffdayItem[], week: string) {
  return items.filter(r => r.week === week || r.origin_week === week).map(r => ({ item: r.item, source: r.source, option_id: r.option_id, state: r.state,
    week: r.week, day: r.day, date: r.date, doc: r.doc, version: r.version, posts: r.posts, moved: r.origin_week !== r.week }))
}

/** A press saved on an off-day option through the board's own Approve (not a move): the row follows it, so an Approve
 *  anywhere and a move write the one place the same way. Only his Approve; a row already there is left as it is. */
export async function syncApprove(db: SupabaseClient, week: string, docId: string, body: Body, ideas: (w: string) => Promise<Body | null>,
  now: Date = new Date()): Promise<'placed' | 'carried' | 'already' | 'skipped' | 'failed'> {
  const approved = (isObj(body.idea) && body.idea.verdict === 'approve') || (body.kind === 'recorded' && body.approved === true)
  if (!approved) return 'skipped'
  const m = /^off-(mon|tue|wed|thu|fri|sat|sun)-([a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59})$/.exec(docId)
  if (!m) return 'skipped'
  const day = m[1], optionId = m[2], doc = `queue/${docId}`
  try {
    const here = await db.from('offday_items').select(COLUMNS).eq('week', week).eq('doc', doc).in('state', ['offered', 'approved']).maybeSingle()
    if (here.error) return 'failed'
    let row = itemOf(here.data)
    if (row?.state === 'approved') return 'already'
    let option: Body | null = row ? row.option : null
    const key = row?.item ?? itemKey('engine', week, optionId)
    if (!row) {
      const own = await db.from('offday_items').select(COLUMNS).eq('item', key).maybeSingle()
      row = itemOf(own.data)
      if (row && row.state === 'approved') return 'already'
      const plan = await ideas(week).catch(() => null)
      const list = isObj(plan) && isObj(plan.offdays) && Array.isArray(plan.offdays[day]) ? (plan.offdays[day] as unknown[]).filter(isObj) : []
      option = list.find(x => String(x.id) === optionId) || (isObj(body.idea) && isObj(body.idea.shown) ? { id: optionId, ...body.idea.shown, format: body.format ?? '', source: body.source ?? '' } : null)
      if (!option) return 'skipped'
      // One post, one item (_onePost.ts): his Approve on a post that is already an item somewhere else carries that item
      // here, taking his approval off the day it leaves, never a second item of the same post.
      if (!row) {
        const twin = await twinItem(db, option, key, week)
        if (twin === undefined) return 'failed'
        if (twin) return await carry(db, twin, { week, day, optionId, option, body }, now)
      }
    }
    const r = await db.rpc('offday_item_move', { p: { item: key, version: row?.version ?? 0, actor: 'Krish', source: row?.source ?? 'engine', origin_week: row?.origin_week ?? week,
      option_id: optionId, option, drive_folder: driveFolderIdOf(option?.drive), piece_id: typeof body.piece_id === 'string' ? body.piece_id : null,
      state: 'approved', place: { week, day }, writes: [] } })
    return r.error || !isObj(r.data) || r.data.ok !== true ? 'failed' : 'placed'
  } catch { return 'failed' }
}

/** The item a post already is, anywhere (on a day or in his Ideas for Later), other than `own`: null when it is none,
 *  undefined when the items cannot be read. */
export async function twinItem(db: SupabaseClient, option: Body, own: string, week: string): Promise<OffdayItem | null | undefined> {
  const rows = await readItemsIn(db, ['offered', 'approved', 'later'])
  if (!rows) return undefined
  const keys = postKeys(option, { item: own, week })
  return rows.find(r => r.item !== own && samePost(keys, rowKeys(r))) ?? null
}

/** His Approve on a day for a post that is already an item elsewhere: that one item moves to this day under the option
 *  he approved (its press is the one he made), and his approval comes off the day it leaves (the same document saved
 *  with `moved`, which the ideas gate records as withdrawn), in one transaction (offday_item_move). Nothing is copied
 *  and nothing of his is deleted: both presses stay in board_history, the move in offday_moves. */
export async function carry(db: SupabaseClient, twin: OffdayItem, to: { week: string; day: string; optionId: string; option: Body; body: Body }, now: Date): Promise<'carried' | 'failed'> {
  const at = now.toISOString()
  const writes: Array<{ week: string; id: string; body: Body; revision: number }> = []
  if (twin.state === 'approved' && twin.week && twin.day) {
    const leaving = { week: twin.week, id: `off-${twin.day}-${twin.option_id}` }
    const prev = await readDoc(db, leaving.week, leaving.id)
    writes.push({ ...leaving, revision: prev.revision,
      body: leaveBody(twin.option, leaving.week, twin.day, prev.body, at, { to_week: to.week, to_day: to.day, as: to.optionId, one_post: true, at }, false) })
  }
  const r = await db.rpc('offday_item_move', { p: { item: twin.item, version: twin.version, actor: 'Krish', source: twin.source, origin_week: twin.origin_week,
    option_id: to.optionId, option: to.option, drive_folder: driveFolderIdOf(to.option.drive) || twin.drive_folder,
    piece_id: typeof to.body.piece_id === 'string' ? to.body.piece_id : twin.piece_id, state: 'approved', place: { week: to.week, day: to.day }, writes,
    words: null, carry: true } })
  return r.error || !isObj(r.data) || r.data.ok !== true ? 'failed' : 'carried'
}

/** Growth's read of an approved option (readPieces' `offdays`): kept only when the one place says it is on this day of
 *  this week. An approval whose item moved away is never handed over twice. */
export function placedHere(items: OffdayItem[] | null, week: string, docId: string): { keep: boolean; item: OffdayItem | null } {
  if (!items) return { keep: true, item: null }
  const doc = `queue/${docId}`
  const here = items.find(r => r.week === week && r.doc === doc && r.state === 'approved') || null
  if (here) return { keep: true, item: here }
  const m = /^off-[a-z]{3}-(.+)$/.exec(docId)
  const own = m ? items.find(r => r.item === itemKey('engine', week, m[1])) : undefined
  // The week's own option moved elsewhere, filed for later or withdrawn: not on this day any more.
  if (own && !(own.state === 'approved' && own.week === week && own.doc === doc)) return { keep: false, item: own }
  return { keep: true, item: null }
}

// ── The post's folder in Drive ──────────────────────────────────────────────────────────────────────────────────────

/** A post folder's name with its date and day put right ("2026-11-12 Thu off.day - AI agent not set up" moved to the
 *  19th is "2026-11-19 Thu off.day - ..."), or null when its name does not start with a date (it is not a post's). */
export function postFolderName(name: string, date: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ _-](Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b)?/.exec(name)
  if (!m) return null
  return `${date} ${DAY_ABBR[dayKeyOf(date)]}${name.slice(m[0].length)}`
}

/** Drive, as the owner of his Drive, for the one thing a move does there: rename a post's folder. */
export interface DriveRenamer {
  folder(id: string): Promise<{ id: string; name: string; parents: string[]; trashed: boolean } | null>
  rename(id: string, name: string): Promise<void>
}
export type DriveFollowed = 'renamed' | 'already' | 'kept' | 'not_a_post' | 'not_found' | 'outside_posts' | 'not_configured' | 'failed'
/** The post's folder follows the row: renamed to the new date and day, by its ID, so every reader that reads it by ID
 *  keeps it and the board files it under its new week (the week's posts are read by the date the name starts with).
 *  Back to his Ideas for Later, it keeps its name. Never a move to another folder, never a deletion. */
export async function followDrive(drive: DriveRenamer | null, folderId: string, date: string | null): Promise<DriveFollowed> {
  if (!drive) return 'not_configured'
  if (!date) return 'kept'
  try {
    const f = await drive.folder(folderId)
    if (!f || f.trashed) return 'not_found'
    if (!f.parents.includes(POSTS_FOLDER_ID)) return 'outside_posts'
    const name = postFolderName(f.name, date)
    if (!name) return 'not_a_post'
    if (name === f.name) return 'already'
    await drive.rename(folderId, name)
    const back = await drive.folder(folderId)
    return back && back.name === name ? 'renamed' : 'failed'
  } catch { return 'failed' }
}

/** The renamer over Drive's API with the owner's `drive` token (the research library's sign-in). */
export function googleDriveRenamer(token: string, f: typeof fetch = fetch): DriveRenamer {
  const base = 'https://www.googleapis.com/drive/v3/files'
  const headers = { Authorization: `Bearer ${token}` }
  return {
    async folder(id) {
      const r = await f(`${base}/${encodeURIComponent(id)}?fields=id,name,parents,trashed,mimeType&supportsAllDrives=true`, { headers })
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`drive_${r.status}`)
      const j = await r.json() as { id?: string; name?: string; parents?: string[]; trashed?: boolean; mimeType?: string }
      if (j.mimeType !== 'application/vnd.google-apps.folder') return null
      return { id: String(j.id), name: String(j.name || ''), parents: Array.isArray(j.parents) ? j.parents : [], trashed: Boolean(j.trashed) }
    },
    async rename(id, name) {
      const r = await f(`${base}/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      if (!r.ok) throw new Error(`drive_rename_${r.status}`)
    },
  }
}

// ── The research library's index rows of a piece he records ────────────────────────────────────────────────────────

export interface LibraryFollower { follow(pieceId: string): Promise<string> }
export type IndexValues = string[][]
/** The index rows (sheet row numbers) that name a piece, with the Week, Day and Piece cells its new day gives them. Pure. */
export function libraryFixes(values: IndexValues, firstRow: number, pieceId: string, cells: [string, string, string]): Array<{ row: number; cells: [string, string, string] }> {
  const PIECE_AT = 11
  const out: Array<{ row: number; cells: [string, string, string] }> = []
  values.forEach((r, i) => {
    if (i === 0 && firstRow === 1) return
    if (String(r[PIECE_AT] || '').trim().toLowerCase() !== pieceId) return
    if (r[0] === cells[0] && r[1] === cells[1] && r[2] === cells[2]) return
    out.push({ row: firstRow + i, cells })
  })
  return out
}
