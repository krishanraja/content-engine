import type { SupabaseClient } from '@supabase/supabase-js'
import { validBody, LIVE_ID, OFFDAY_ID } from './_contracts.js'
import { DAYS, OFF_DAY_CHANNELS, POSTED_CHANNELS, SERIES_DAYS, SERIES_DAY_CHANNELS, dayDate, type PostedChannel, type PostedDay } from './_posted.js'
import type { Making, MakingChannel, MakingChannelPost } from '../_making.js'
import type { PressAction } from './_viewExtras.js'

// "It's live" (Krish, 2026-11-12: "How do I indicate that Tuesday the 10th was posted correctly?"). One press on any
// piece on the publish board, series days and off days alike: the post's link and the channels it went out on,
// recorded as his, append only, so the day moves to Live and Done and the week's published count rises at once.
//
// POST /api/board/<Monday>/live, his login only (an operator key or Growth's key is refused: a session never says a
// post went out for him), body { day, piece_id | option, channels, url, note?, at }:
//   - the subject is the day's piece (scheduled for that date, held there by his approval) or an off-day option his
//     Approve stands on (queue/off-<day>-<id>); anything else is refused;
//   - it appends one post to picks/live-<day> (board_documents, through board_save as Krish, so board_history keeps
//     every revision and the board's change signal moves): posts are only ever added, never changed or removed;
//   - on a piece it records each channel on the piece's making record (meta.making.channels, actor Krish) where no
//     post is recorded yet, so the publish step, Control Centre's done-check sweep (piece_step, week_published) and
//     the publish watcher (a Substack link on the record is matched by address) all see it. A channel Growth already
//     recorded keeps Growth's entry.
// Growth reads every live post with the week's pieces (GET /api/board/<Monday>/pieces, `live`), for its learning.
// Where Growth already recorded a post (its ticks, /posted), the board shows it with its link and needs no press.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const LIVE_OP = 'live'
export const LIVE_ACTOR = 'Krish'
/** The most posts one day's record keeps (append only: the oldest is never dropped below this; a 41st is refused). */
export const MAX_LIVE_POSTS = 40
/** The making record's name for a channel, where it differs (as Growth's write-back names it). */
const MAKING_NAME: Partial<Record<PostedChannel, MakingChannel>> = { 'substack-notes': 'notes' }

/** One post he marked live. */
export interface LivePost {
  channels: PostedChannel[]
  url: string
  at: string
  by: 'Krish'
  piece_id?: string
  option?: string
  title?: string
  note?: string
}
export interface LiveInput { day: PostedDay; piece_id?: string; option?: string; channels: PostedChannel[]; url: string; note?: string; at?: string }

/** The channels a post can go out on: a series day's piece has the series boxes; an off-day option, on any day, and a
 *  piece on an off day have the off-day boxes (a short cut or a still, never the article). */
export function liveChannels(day: PostedDay, offday = !SERIES_DAYS.includes(day)): PostedChannel[] {
  return [...(offday ? OFF_DAY_CHANNELS : SERIES_DAY_CHANNELS)]
}

/** The channel a post's address belongs to, when its host says so; null when it does not. Never a guess from words. */
export function channelOfUrl(url: string): PostedChannel | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '')
  const path = u.pathname.toLowerCase()
  if (host === 'youtube.com' || host === 'youtu.be') return path.startsWith('/shorts/') ? 'shorts' : 'youtube'
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok'
  if (host === 'instagram.com') return path.startsWith('/reel') ? 'reels' : 'instagram'
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin'
  if (host === 'x.com' || host === 'twitter.com') return 'x'
  if (host === 'threads.net' || host === 'threads.com') return 'threads'
  if (host === 'facebook.com' || host === 'fb.watch' || host.endsWith('.facebook.com')) return 'facebook'
  if (host === 'open.spotify.com' || host === 'spotify.com') return 'spotify'
  if (host === 'substack.com' || host.endsWith('.substack.com') || host === 'makeyourmindup.ai' || host.endsWith('.makeyourmindup.ai'))
    return /\/note\/|\/notes\b|\/c-\d/.test(path) ? 'substack-notes' : 'substack'
  return null
}

/** The body he sends, checked, or the reason it is refused. */
export function liveInput(body: unknown): { input?: LiveInput; problem?: string } {
  if (!isObj(body)) return { problem: 'the body is an object' }
  const allowed = ['day', 'piece_id', 'option', 'channels', 'url', 'note', 'at', 'title']
  const extra = Object.keys(body).filter(k => !allowed.includes(k))
  if (extra.length) return { problem: `unknown fields: ${extra.join(', ')}` }
  if (!DAYS.includes(body.day as PostedDay) || body.day === 'sun') return { problem: 'day is one of mon, tue, wed, thu, fri, sat' }
  const day = body.day as PostedDay
  const piece = typeof body.piece_id === 'string' && UUID.test(body.piece_id) ? body.piece_id.toLowerCase() : undefined
  const option = typeof body.option === 'string' && OFFDAY_ID.test(body.option) && body.option.startsWith(`off-${day}-`) ? body.option : undefined
  if (Boolean(piece) === Boolean(option)) return { problem: 'name the day\'s piece (piece_id) or one of its off-day options (option), one of the two' }
  if (!Array.isArray(body.channels) || !body.channels.length || body.channels.length > 12) return { problem: 'channels lists where it went out, one or more' }
  const allowedHere = liveChannels(day, Boolean(option) || !SERIES_DAYS.includes(day))
  const channels: PostedChannel[] = []
  for (const c of body.channels) {
    if (typeof c !== 'string' || !Object.hasOwn(POSTED_CHANNELS, c)) return { problem: `channels are some of ${allowedHere.join(', ')}` }
    if (!allowedHere.includes(c as PostedChannel)) return { problem: `${c} is not a channel ${option || !SERIES_DAYS.includes(day) ? 'an off-day post' : 'a series piece'} goes out on` }
    if (!channels.includes(c as PostedChannel)) channels.push(c as PostedChannel)
  }
  if (typeof body.url !== 'string' || body.url.length > 2048 || !/^https:\/\/[^\s]+$/.test(body.url.trim())) return { problem: 'url is the live post, https' }
  const url = body.url.trim()
  if ('note' in body && body.note !== null && !(typeof body.note === 'string' && body.note.length <= 2000)) return { problem: 'note is his words, at most 2000 characters' }
  if ('at' in body && body.at !== null && !(typeof body.at === 'string' && Number.isFinite(Date.parse(body.at)))) return { problem: 'at is when he pressed, ISO 8601' }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : undefined
  return { input: { day, ...(piece ? { piece_id: piece } : {}), ...(option ? { option } : {}), channels, url, ...(note ? { note } : {}), ...(typeof body.at === 'string' ? { at: body.at } : {}) } }
}

/** His live posts on each day of a week, from picks/live-<day> (his documents only), oldest first. */
export function liveByDay(picks: Array<{ doc_id: string; body: Body; updated_by: string }>): Partial<Record<PostedDay, LivePost[]>> {
  const out: Partial<Record<PostedDay, LivePost[]>> = {}
  for (const p of picks) {
    const m = LIVE_ID.exec(p.doc_id)
    if (!m || p.updated_by !== LIVE_ACTOR || !isObj(p.body) || p.body.kind !== 'live' || !Array.isArray(p.body.posts)) continue
    out[m[1] as PostedDay] = (p.body.posts as unknown[]).filter((x): x is LivePost => isObj(x) && typeof x.url === 'string' && Array.isArray(x.channels))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
  }
  return out
}

/** The posts of a day that are about one subject (a piece, or an off-day option). */
export function postsFor(posts: LivePost[] | undefined, subject: { piece_id?: string | null; option?: string | null }): LivePost[] {
  return (posts || []).filter(p => (subject.piece_id && p.piece_id === subject.piece_id) || (subject.option && p.option === subject.option))
}

/** "Instagram, LinkedIn", the channels of some posts in the order they first went out. */
export function channelWords(posts: LivePost[]): string {
  const seen: PostedChannel[] = []
  for (const p of posts) for (const c of p.channels) if (!seen.includes(c)) seen.push(c)
  return seen.map(c => POSTED_CHANNELS[c].split(':')[0]).join(', ')
}

/** When he marked it live, as the board says it in New York time: "Tue 10 Nov, 13:05". */
export function liveWhen(at: string): string {
  const t = new Date(at)
  if (!Number.isFinite(t.getTime())) return at
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(t).map(p => [p.type, p.value]))
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`
}

/** The day's line once he marked it live. */
export function liveLine(posts: LivePost[]): string {
  const last = posts[posts.length - 1]
  return `Live on ${channelWords(posts)}. You marked it live, ${liveWhen(last.at)}`
}

/** Today in New York, YYYY-MM-DD: a day is due once its date is today or before. */
export function todayNY(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** The "It's live" press for one subject on a day (contract 1.8.0): POST /api/board/<Monday>/live. The board asks for
 *  the post's link (words) and the channels it went to (choose, several, the link's own channel ticked for him). */
export function livePress(day: PostedDay, subject: { piece_id?: string | null; option?: string | null; title?: string | null }, label = "It's live"): PressAction {
  const channels = liveChannels(day, Boolean(subject.option) || !SERIES_DAYS.includes(day))
  return {
    kind: 'press', label, op: LIVE_OP,
    body: { day, ...(subject.piece_id ? { piece_id: subject.piece_id } : { option: subject.option }), ...(subject.title ? { title: subject.title.slice(0, 300) } : {}) },
    words: { path: 'url', ask: 'The post\'s link', required: true },
    choose: { path: 'channels', ask: 'Where did it go out?', multi: true, required: true, from_link: true,
      options: channels.map(c => ({ value: c, label: POSTED_CHANNELS[c].split(':')[0], ...(hostsOf(c).length ? { hosts: hostsOf(c) } : {}) })) },
    stamp: ['at'],
    done: 'Recorded as live. The day is done, and Growth learns from the post.',
  }
}

/** The hosts whose links belong to a channel, so the board can tick the link's own channel before he chooses. */
function hostsOf(c: PostedChannel): string[] {
  switch (c) {
    case 'youtube': return ['youtube.com/watch', 'youtu.be']
    case 'shorts': return ['youtube.com/shorts']
    case 'tiktok': return ['tiktok.com']
    case 'reels': return ['instagram.com/reel']
    case 'instagram': return ['instagram.com/p']
    case 'linkedin': return ['linkedin.com']
    case 'x': return ['x.com', 'twitter.com']
    case 'threads': return ['threads.net', 'threads.com']
    case 'facebook': return ['facebook.com', 'fb.watch']
    case 'spotify': return ['open.spotify.com']
    case 'substack': return ['makeyourmindup.ai', 'substack.com/p']
    case 'substack-notes': return ['substack.com/note', 'substack.com/@']
    default: return []
  }
}

export interface LiveResult { status: number; body: Body }

/** Records one post he marked live: append only on picks/live-<day>, and each new channel on the piece's record. */
export async function recordLive(db: SupabaseClient, week: string, raw: unknown, who: string, now: string): Promise<LiveResult> {
  if (who !== LIVE_ACTOR) return { status: 403, body: { ok: false, error: 'live_is_his' } }
  const { input, problem } = liveInput(raw)
  if (!input) return { status: 400, body: { ok: false, error: 'invalid_live', problem } }
  const { day } = input
  const date = dayDate(week, day)
  const { readApprovals, approvalFor } = await import('./_gate.js')
  const approvals = await readApprovals(db, week)
  if (!approvals) return { status: 503, body: { ok: false, error: 'approvals_unavailable' } }
  let title: string | undefined
  if (input.piece_id) {
    const piece = await db.from('content_ideas').select('id, idea, scheduled_for, state, buried_at, meta').eq('id', input.piece_id).maybeSingle()
    if (piece.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
    if (!piece.data) return { status: 404, body: { ok: false, error: 'piece_not_found' } }
    const row = piece.data as Body
    if (String(row.scheduled_for || '').slice(0, 10) !== date || row.buried_at || row.state === 'dropped')
      return { status: 409, body: { ok: false, error: 'not_this_day', problem: `the piece is not on ${date}` } }
    if (!approvalFor(approvals, row, date)) return { status: 409, body: { ok: false, error: 'not_approved_by_krish', problem: 'only a piece his approval holds on the day can be marked live' } }
    title = String(row.idea || '').trim().replace(/\s+/g, ' ').slice(0, 300) || undefined
  } else if (!approvals.some(a => a.doc === `queue/${input.option}`)) {
    return { status: 409, body: { ok: false, error: 'not_approved_by_krish', problem: 'only an off-day option his Approve stands on can be marked live' } }
  }
  const raw_title = isObj(raw) && typeof raw.title === 'string' ? raw.title.trim().replace(/\s+/g, ' ').slice(0, 300) : ''
  const at = input.at && Date.parse(input.at) <= Date.parse(now) + 5 * 60_000 ? new Date(input.at).toISOString() : now
  const post: LivePost = { channels: input.channels, url: input.url, at, by: LIVE_ACTOR,
    ...(input.piece_id ? { piece_id: input.piece_id } : { option: input.option }),
    ...(title || raw_title ? { title: title || raw_title } : {}), ...(input.note ? { note: input.note } : {}) }
  const docId = `live-${day}`
  let saved: Body | null = null, duplicate = false
  for (let tries = 0; tries < 2 && !saved; tries++) {
    const read = await db.from('board_documents').select('body, revision, updated_by').eq('week', week).eq('collection', 'picks').eq('doc_id', docId).maybeSingle()
    if (read.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
    const held: Body = isObj(read.data?.body) && read.data!.updated_by === LIVE_ACTOR ? read.data!.body : {}
    const posts = Array.isArray(held.posts) ? (held.posts as Body[]).filter(isObj) as unknown as LivePost[] : []
    const same = posts.find(p => p.url === post.url && (p.piece_id ?? null) === (post.piece_id ?? null) && (p.option ?? null) === (post.option ?? null)
      && post.channels.every(c => p.channels.includes(c)))
    if (same) { saved = held; duplicate = true; break }
    if (posts.length >= MAX_LIVE_POSTS) return { status: 409, body: { ok: false, error: 'too_many_live_posts', problem: `a day keeps at most ${MAX_LIVE_POSTS}` } }
    const body: Body = { kind: 'live', day, at: post.at, posts: [...posts, post] }
    if (!validBody('picks', docId, body)) return { status: 400, body: { ok: false, error: 'invalid_live' } }
    const result = await db.rpc('board_save', { p_week: week, p_collection: 'picks', p_id: docId, p_body: body, p_revision: Number(read.data?.revision || 0), p_actor: LIVE_ACTOR })
    if (result.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
    if (result.data?.ok) saved = body
    else if (result.data?.error !== 'revision_conflict') return { status: 409, body: { ok: false, error: String(result.data?.error || 'board_save_refused') } }
  }
  if (!saved) return { status: 409, body: { ok: false, error: 'revision_conflict', problem: 'the day changed twice while this was written; press it again' } }
  if (!input.piece_id) return { status: 200, body: { ok: true, duplicate, day, post, making_channels: [] } }

  // The piece's making record: where the piece counts (AGENTS.md rule 14). A channel already recorded (Growth's post, an
  // earlier press) keeps its entry; the link goes on the channel it belongs to, or on the one channel he chose.
  const { mergeMaking } = await import('../_making.js')
  const linkChannel = channelOfUrl(post.url)
  for (let tries = 0; tries < 2; tries++) {
    const read = await db.from('content_ideas').select('id, meta, updated_at').eq('id', input.piece_id).maybeSingle()
    if (read.error || !read.data) break
    const meta: Body = isObj((read.data as Body).meta) ? (read.data as Body).meta as Body : {}
    const prev = isObj(meta.making) ? meta.making as unknown as Making : null
    const add: Partial<Record<MakingChannel, MakingChannelPost>> = {}
    for (const c of post.channels) {
      const name: MakingChannel = MAKING_NAME[c] ?? c as MakingChannel
      if (prev?.channels?.[name]) continue
      add[name] = { posted_at: post.at, ...(linkChannel === c || post.channels.length === 1 ? { url: post.url } : {}) }
    }
    if (!Object.keys(add).length) return { status: 200, body: { ok: true, duplicate, day, post, making_channels: [] } }
    const making = mergeMaking(prev, { channels: add }, LIVE_ACTOR, now)
    const written = await db.from('content_ideas').update({ meta: { ...meta, making }, updated_at: now })
      .eq('id', input.piece_id).eq('updated_at', (read.data as Body).updated_at).select('id')
    if (written.error) break
    if (written.data?.length) return { status: 200, body: { ok: true, duplicate, day, post, making_channels: Object.keys(add) } }
  }
  return { status: 200, body: { ok: true, duplicate, day, post, making_channels: [], problem: 'recorded as live; the piece\'s making record could not be written, so press it again to copy it there' } }
}

/** The publication's three series: a piece in one of them counts as published (Control Centre's reader of the North
 *  Star number, readPublicationPublished, counts the same rows). */
export const PUBLICATION_SERIES = ['follow_the_money', 'under_the_hood', 'mind_the_gap'] as const

/**
 * What has gone out in the last seven days, now (contract 1.8.0: the board's "published this week"): every piece of the
 * publication's series with published_at in the window (the North Star reader's own rule), and every post he marked
 * live in the window that the rule does not count yet: an off-day post (it has no piece), or a piece whose Substack
 * post the publish watcher has not matched. One subject counts once. Null when the pieces cannot be read: the board
 * then keeps the measured number from NOW.md.
 */
export async function publishedNow(db: SupabaseClient, now: Date): Promise<number | null> {
  const since = now.getTime() - 7 * 864e5
  const from = new Date(since - 7 * 864e5)
  from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7))
  const [pub, docs] = await Promise.all([
    db.from('content_ideas').select('id').gte('published_at', new Date(since).toISOString()).in('lane_slot', [...PUBLICATION_SERIES]).limit(500),
    db.from('board_documents').select('week,doc_id,body,updated_by').eq('collection', 'picks').like('doc_id', 'live-%').gte('week', from.toISOString().slice(0, 10)).limit(200),
  ])
  if (pub.error || !Array.isArray(pub.data)) return null
  const counted = new Set((pub.data as Body[]).map(r => String(r.id).toLowerCase()))
  const more = new Set<string>()
  for (const d of (docs.error ? [] : docs.data || []) as Body[]) {
    if (d.updated_by !== LIVE_ACTOR || !isObj(d.body) || !Array.isArray(d.body.posts)) continue
    for (const p of d.body.posts as Body[]) {
      if (!isObj(p) || !(Date.parse(String(p.at)) >= since)) continue
      const key = typeof p.piece_id === 'string' ? p.piece_id.toLowerCase() : typeof p.option === 'string' ? `${String(d.week).slice(0, 10)}/${p.option}` : ''
      if (key && !counted.has(key)) more.add(key)
    }
  }
  return counted.size + more.size
}
