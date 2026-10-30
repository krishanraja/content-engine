import type { SupabaseClient } from '@supabase/supabase-js'
import { validBody } from './_contracts.js'
import type { Making, MakingChannelPost } from '../_making.js'

// Growth's write-back (Krish, 2026-10-29: "Now that the growth repo takes care of more or less ALL posting, we need
// the growth repo to keep the publish board check boxes update with what it has done and when").
//
// POST /api/board/<Monday>/posted, Authorization: Bearer GROWTH_WRITEBACK_TOKEN (or the engine operator's key), body
// { day, piece_id, channel, post_url, posted_at, buffer_post_id }. One post ticks the day's <day>-<channel> box
// (board_ticks, through board_save, actor "growth") and records the channel on the piece's making record
// (content_ideas.meta.making.channels, merged as the making route merges it, guarded on updated_at). A post already
// recorded (the same buffer_post_id on that box) writes nothing and answers duplicate: true, so Growth may replay.
// It never posts anything: it records what Growth already posted. The piece must be scheduled for that day of that
// week, or nothing is written.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUFFER_ID = /^[A-Za-z0-9_-]{1,100}$/
const DAY_OFFSET = { mon: 0, wed: 2, fri: 4 } as const
// The day's posting boxes (week_board.py STEPS, the ones with a channel), with the label each box carries.
export const POSTED_CHANNELS = {
  substack: 'Substack: video post with the article',
  youtube: 'YouTube: the 3-minute video',
  shorts: 'YouTube Shorts',
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  linkedin: 'LinkedIn',
  spotify: 'Spotify: the video episode, its clip and chapters',
} as const
export type PostedChannel = keyof typeof POSTED_CHANNELS
export const POSTED_ACTOR = 'growth'
const MAX_POSTS = 20

export interface PostedInput { day: keyof typeof DAY_OFFSET; piece_id: string; channel: PostedChannel; post_url: string; posted_at: string; buffer_post_id: string }
export interface PostedResult { status: number; body: Body }

/** The body Growth sends, checked, or the reason it is refused. */
export function postedInput(body: unknown): { input?: PostedInput; problem?: string } {
  if (!isObj(body)) return { problem: 'the body is an object' }
  const allowed = ['day', 'piece_id', 'channel', 'post_url', 'posted_at', 'buffer_post_id']
  const extra = Object.keys(body).filter(k => !allowed.includes(k))
  if (extra.length) return { problem: `unknown fields: ${extra.join(', ')}` }
  if (!Object.hasOwn(DAY_OFFSET, String(body.day))) return { problem: 'day is mon, wed or fri' }
  if (typeof body.piece_id !== 'string' || !UUID.test(body.piece_id)) return { problem: 'piece_id is the content_ideas id' }
  if (!Object.hasOwn(POSTED_CHANNELS, String(body.channel))) return { problem: `channel is one of ${Object.keys(POSTED_CHANNELS).join(', ')}` }
  if (typeof body.post_url !== 'string' || body.post_url.length > 2048 || !/^https:\/\/\S+$/.test(body.post_url)) return { problem: 'post_url is the live post, https' }
  if (typeof body.posted_at !== 'string' || body.posted_at.length > 40 || !Number.isFinite(Date.parse(body.posted_at))) return { problem: 'posted_at is when it went out, ISO 8601' }
  if (typeof body.buffer_post_id !== 'string' || !BUFFER_ID.test(body.buffer_post_id)) return { problem: 'buffer_post_id is the Buffer post id' }
  return { input: { ...(body as unknown as PostedInput), piece_id: body.piece_id.toLowerCase() } }
}

/** The date a day of a week falls on, YYYY-MM-DD. */
export function dayDate(week: string, day: keyof typeof DAY_OFFSET): string {
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
  for (let tries = 0; tries < 2; tries++) {
    const read = await db.from('content_ideas').select('id, meta, updated_at').eq('id', piece_id).maybeSingle()
    if (read.error || !read.data) break
    const meta: Body = isObj((read.data as Body).meta) ? (read.data as Body).meta as Body : {}
    const prev = isObj(meta.making) ? meta.making as unknown as Making : null
    const held = prev?.channels?.[channel]
    if (held && held.buffer_post_id === input.buffer_post_id) return { status: 200, body: { ok: true, duplicate, tick_id: tickId, tick, making_channel: held } }
    const making = mergeMaking(prev, { channels: { [channel]: entry } }, POSTED_ACTOR, now)
    const written = await db.from('content_ideas').update({ meta: { ...meta, making }, updated_at: now })
      .eq('id', piece_id).eq('updated_at', (read.data as Body).updated_at).select('id')
    if (written.error) break
    if (written.data?.length) return { status: 200, body: { ok: true, duplicate, tick_id: tickId, tick, making_channel: entry } }
  }
  return { status: 200, body: { ok: true, duplicate, tick_id: tickId, tick, making_channel: null, problem: 'the box is ticked; the piece\'s making record could not be written, so send this post again' } }
}
