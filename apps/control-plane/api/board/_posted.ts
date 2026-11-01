import type { SupabaseClient } from '@supabase/supabase-js'
import { validBody } from './_contracts.js'
import type { Making, MakingChannel, MakingChannelPost } from '../_making.js'

// Growth's write-back (Krish, 2026-10-29: "Now that the growth repo takes care of more or less ALL posting, we need
// the growth repo to keep the publish board check boxes update with what it has done and when").
//
// POST /api/board/<Monday>/posted, Authorization: Bearer GROWTH_WRITEBACK_TOKEN (or the engine operator's key), body
// { day, piece_id, channel, post_url, posted_at, buffer_post_id }. One post ticks the day's <day>-<channel> box
// (board_ticks, through board_save, actor "growth") and records the channel on the piece's making record
// (content_ideas.meta.making.channels, merged as the making route merges it, guarded on updated_at). A post already
// recorded (the same buffer_post_id on that box) writes nothing and answers duplicate: true, so Growth may replay.
// It never posts anything: it records what Growth already posted. The piece must be scheduled for that day of that
// week, or nothing is written. Any day of the week has boxes: an off-day post is first-class (2026-10-30).
//
// GET /api/board/<Monday>/pieces, the same key, read-only: which piece sits on which day of the week and which boxes
// it has, {days: [{day, date, piece_id, channels, slot?}]}. slot (New York HH:MM) is given for an off day only; on
// Monday, Wednesday and Friday Growth uses the series slot it already holds (12:30). Growth's board_tick.py reads it,
// so it keeps no map of its own.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUFFER_ID = /^[A-Za-z0-9_-]{1,100}$/
const DAY_OFFSET = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as const
export type PostedDay = keyof typeof DAY_OFFSET
export const DAYS = Object.keys(DAY_OFFSET) as PostedDay[]
/** The series days: the week's three pieces. Every other day is an off day. */
export const SERIES_DAYS: readonly PostedDay[] = ['mon', 'wed', 'fri']
/** The day's series, by the publication's rhythm (Monday follow.the.money, Wednesday under.the.hood, Friday mind.the.gap). */
const DAY_SERIES: Partial<Record<PostedDay, string>> = { mon: 'follow_the_money', wed: 'under_the_hood', fri: 'mind_the_gap' }
// The day's posting boxes on the board (week_board.py STEPS, the ones with a channel), with the label each box carries.
export const BOARD_CHANNELS = {
  substack: 'Substack: video post with the article',
  youtube: 'YouTube: the 3-minute video',
  shorts: 'YouTube Shorts',
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  linkedin: 'LinkedIn',
  spotify: 'Spotify: the video episode, its clip and chapters',
} as const
// The boxes Growth adds with its own posts (its board_tick.py BOXES), 2026-10-30.
export const GROWTH_CHANNELS = {
  instagram: 'Instagram',
  x: 'X',
  threads: 'Threads',
  facebook: 'Facebook',
  'substack-notes': 'Substack Notes',
} as const
export const POSTED_CHANNELS = { ...BOARD_CHANNELS, ...GROWTH_CHANNELS } as const
export type PostedChannel = keyof typeof POSTED_CHANNELS
/** The making record's name for a box's channel, where it differs. */
const MAKING_NAME: Partial<Record<PostedChannel, MakingChannel>> = { 'substack-notes': 'notes' }
/** The boxes a series day has, and the boxes an off-day post has (a short cut or a still, never the article). */
export const SERIES_DAY_CHANNELS: readonly PostedChannel[] = ['substack', 'youtube', 'shorts', 'tiktok', 'reels', 'linkedin', 'spotify', 'x', 'threads', 'facebook', 'substack-notes']
export const OFF_DAY_CHANNELS: readonly PostedChannel[] = ['shorts', 'tiktok', 'reels', 'instagram', 'linkedin', 'x', 'threads', 'facebook', 'substack-notes']
/** An off-day post's New York slot. Assumed: the series slot (Growth's mix.json reserved.time) until Krish or Growth
 *  names another; a piece's own meta.offday.slot wins. */
export const OFF_DAY_SLOT = '12:30'
export const POSTED_ACTOR = 'growth'
const MAX_POSTS = 20

export interface PostedInput { day: PostedDay; piece_id: string; channel: PostedChannel; post_url: string; posted_at: string; buffer_post_id: string }
export interface PostedResult { status: number; body: Body }

/** The body Growth sends, checked, or the reason it is refused. */
export function postedInput(body: unknown): { input?: PostedInput; problem?: string } {
  if (!isObj(body)) return { problem: 'the body is an object' }
  const allowed = ['day', 'piece_id', 'channel', 'post_url', 'posted_at', 'buffer_post_id']
  const extra = Object.keys(body).filter(k => !allowed.includes(k))
  if (extra.length) return { problem: `unknown fields: ${extra.join(', ')}` }
  if (!Object.hasOwn(DAY_OFFSET, String(body.day))) return { problem: `day is one of ${DAYS.join(', ')}` }
  if (typeof body.piece_id !== 'string' || !UUID.test(body.piece_id)) return { problem: 'piece_id is the content_ideas id' }
  if (!Object.hasOwn(POSTED_CHANNELS, String(body.channel))) return { problem: `channel is one of ${Object.keys(POSTED_CHANNELS).join(', ')}` }
  if (typeof body.post_url !== 'string' || body.post_url.length > 2048 || !/^https:\/\/\S+$/.test(body.post_url)) return { problem: 'post_url is the live post, https' }
  if (typeof body.posted_at !== 'string' || body.posted_at.length > 40 || !Number.isFinite(Date.parse(body.posted_at))) return { problem: 'posted_at is when it went out, ISO 8601' }
  if (typeof body.buffer_post_id !== 'string' || !BUFFER_ID.test(body.buffer_post_id)) return { problem: 'buffer_post_id is the Buffer post id' }
  return { input: { ...(body as unknown as PostedInput), piece_id: body.piece_id.toLowerCase() } }
}

/** The date a day of a week falls on, YYYY-MM-DD. */
export function dayDate(week: string, day: PostedDay): string {
  const d = new Date(`${week}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + DAY_OFFSET[day])
  return d.toISOString().slice(0, 10)
}

/** Ticks the day's box for one post and records it on the piece. */
export async function recordPosted(db: SupabaseClient, week: string, raw: unknown, now: string): Promise<PostedResult> {
  const { input, problem } = postedInput(raw)
  if (!input) return { status: 400, body: { ok: false, error: 'invalid_posted', problem } }
  const { day, piece_id, channel } = input
  const piece = await db.from('content_ideas').select('id, scheduled_for').eq('id', piece_id).maybeSingle()
  if (piece.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
  if (!piece.data) return { status: 404, body: { ok: false, error: 'piece_not_found' } }
  const date = dayDate(week, day)
  if (String((piece.data as Body).scheduled_for || '') !== date)
    return { status: 409, body: { ok: false, error: 'not_this_day', problem: `the piece is scheduled for ${(piece.data as Body).scheduled_for || 'no day'}, not ${date}` } }

  const tickId = `${day}-${channel}`
  const post = { buffer_post_id: input.buffer_post_id, url: input.post_url, posted_at: input.posted_at, recorded_at: now }
  let tick: Body | null = null, duplicate = false
  for (let tries = 0; tries < 2 && !tick; tries++) {
    const read = await db.from('board_ticks').select('body, revision').eq('week', week).eq('tick_id', tickId).maybeSingle()
    if (read.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
    const held: Body = isObj(read.data?.body) ? read.data!.body : {}
    const posts = Array.isArray(held.posts) ? (held.posts as Body[]).filter(isObj) : []
    if (held.piece_id && held.piece_id !== piece_id) return { status: 409, body: { ok: false, error: 'box_holds_another_piece' } }
    if (posts.some(p => p.buffer_post_id === input.buffer_post_id)) { tick = held; duplicate = true; break }
    const kept = [...posts, post].sort((a, b) => String(a.posted_at).localeCompare(String(b.posted_at))).slice(-MAX_POSTS)
    const body: Body = { ...held, done: true, day, piece_id, step: channel, channel, label: POSTED_CHANNELS[channel], at: kept[kept.length - 1].posted_at, by: POSTED_ACTOR, posts: kept }
    if (!validBody('ticks', tickId, body)) return { status: 400, body: { ok: false, error: 'invalid_posted' } }
    const saved = await db.rpc('board_save', { p_week: week, p_collection: 'ticks', p_id: tickId, p_body: body, p_revision: Number(read.data?.revision || 0), p_actor: POSTED_ACTOR })
    if (saved.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
    if (saved.data?.ok) tick = body
    else if (saved.data?.error !== 'revision_conflict') return { status: 409, body: { ok: false, error: String(saved.data?.error || 'board_save_refused') } }
  }
  if (!tick) return { status: 409, body: { ok: false, error: 'revision_conflict', problem: 'the box changed twice while this was written; send it again' } }

  // The making record: where the piece counts (AGENTS.md rule 14). The box is already ticked; a making write that
  // cannot land is said, and a replay writes it (the box answers duplicate, the record is still checked).
  const { mergeMaking } = await import('../_making.js')
  const entry: MakingChannelPost = { posted_at: input.posted_at, url: input.post_url, buffer_post_id: input.buffer_post_id }
  const making_name: MakingChannel = MAKING_NAME[channel] ?? channel as MakingChannel
  for (let tries = 0; tries < 2; tries++) {
    const read = await db.from('content_ideas').select('id, meta, updated_at').eq('id', piece_id).maybeSingle()
    if (read.error || !read.data) break
    const meta: Body = isObj((read.data as Body).meta) ? (read.data as Body).meta as Body : {}
    const prev = isObj(meta.making) ? meta.making as unknown as Making : null
    const held = prev?.channels?.[making_name]
    if (held && held.buffer_post_id === input.buffer_post_id) return { status: 200, body: { ok: true, duplicate, tick_id: tickId, tick, making_channel: held } }
    const making = mergeMaking(prev, { channels: { [making_name]: entry } }, POSTED_ACTOR, now)
    const written = await db.from('content_ideas').update({ meta: { ...meta, making }, updated_at: now })
      .eq('id', piece_id).eq('updated_at', (read.data as Body).updated_at).select('id')
    if (written.error) break
    if (written.data?.length) return { status: 200, body: { ok: true, duplicate, tick_id: tickId, tick, making_channel: entry } }
  }
  return { status: 200, body: { ok: true, duplicate, tick_id: tickId, tick, making_channel: null, problem: 'the box is ticked; the piece\'s making record could not be written, so send this post again' } }
}

export interface PieceDay { day: PostedDay; date: string; piece_id: string; channels: PostedChannel[]; slot?: string }
const SLOT = /^([01]\d|2[0-3]):[0-5]\d$/

/** Which piece sits on which day of the week, and its boxes. A piece is on a day when it is scheduled for that date
 *  and not buried or dropped. When two share a date, a series day keeps the piece of its own series, an off day the
 *  piece whose meta.offday names that date, then the one changed last; one piece a day, as Growth reads it. */
export async function readPieces(db: SupabaseClient, week: string): Promise<{ status: number; body: Body }> {
  const end = dayDate(week, 'sun')
  const read = await db.from('content_ideas').select('id, scheduled_for, lane_slot, state, buried_at, meta, updated_at')
    .gte('scheduled_for', week).lte('scheduled_for', end)
  if (read.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
  const rows = ((read.data || []) as Body[]).filter(r => !r.buried_at && r.state !== 'dropped' && typeof r.id === 'string' && UUID.test(r.id))
  const days: PieceDay[] = []
  for (const day of DAYS) {
    const date = dayDate(week, day)
    const series = SERIES_DAYS.includes(day)
    const offday = (r: Body) => isObj(r.meta) && isObj(r.meta.offday) && !r.meta.offday.withdrawn_at && r.meta.offday.date === date
    const rank = (r: Body) => (series ? (r.lane_slot === DAY_SERIES[day] ? 2 : 0) : (offday(r) ? 2 : 0))
    const here = rows.filter(r => r.scheduled_for === date)
      .sort((a, b) => rank(b) - rank(a) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || String(a.id).localeCompare(String(b.id)))
    const piece = here[0]
    if (!piece) continue
    const entry: PieceDay = { day, date, piece_id: String(piece.id).toLowerCase(), channels: [...(series ? SERIES_DAY_CHANNELS : OFF_DAY_CHANNELS)] }
    if (!series) {
      const own = isObj(piece.meta) && isObj(piece.meta.offday) ? String(piece.meta.offday.slot || '') : ''
      entry.slot = SLOT.test(own) ? own : OFF_DAY_SLOT
    }
    days.push(entry)
  }
  // His one press on the week's filler (picks/mix, Ruling, Krish, 2026-10-30): Growth makes and posts within this mix,
  // and only once approved is true. Null until he presses.
  const pressed = await db.from('board_documents').select('body').eq('week', week).eq('collection', 'picks').eq('doc_id', 'mix').maybeSingle()
  if (pressed.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
  const m = isObj(pressed.data) && isObj(pressed.data.body) ? pressed.data.body : null
  const mix = m && m.kind === 'mix' ? { approved: m.approved === true, days: m.days, mix_sha256: m.mix_sha256, at: m.at ?? null } : null
  // Each off-day option he approved (Ruling, Krish, 2026-11-01: each option is judged on its own, idea and direction):
  // Growth makes the mock from the direction he approved, exactly as it was shown (shown), and puts it back on the card.
  // An option counts once its idea is approved and its direction, if it had one, is too; a returned mock he has not
  // yet approved is said in mock.
  const off = await db.from('board_documents').select('doc_id,body').eq('week', week).eq('collection', 'queue').like('doc_id', 'off-%')
  if (off.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
  const offdays = (off.data || []).flatMap(row => {
    const b = isObj(row.body) ? row.body : null
    const idea = b && isObj(b.idea) ? b.idea : null
    if (!b || !idea || idea.verdict !== 'approve') return []
    const dir = isObj(b.direction) ? b.direction : null
    if (dir && dir.verdict !== 'approve') return []
    const mock = isObj(b.mock) ? b.mock : null
    return [{ id: String(row.doc_id), day: b.day ?? null, option_id: b.option_id ?? null, format: b.format ?? null,
      idea: idea.shown ?? null, direction: dir ? dir.shown ?? null : null,
      mock: mock ? { verdict: mock.verdict ?? null, words: mock.words ?? null } : null, approved_at: dir?.at ?? idea.at ?? null }]
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)))
  return { status: 200, body: { days, mix, offdays } }
}
