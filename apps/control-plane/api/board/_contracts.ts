import { createHash, timingSafeEqual } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { hasEngineAccess, operatorBearerAllowed } from '../_auth.js'

export const collections = ['ticks', 'links', 'edits', 'picks', 'queue', 'comments'] as const
export type Collection = typeof collections[number]
// Read-only views of his day decisions, which are stored in picks (board_documents takes no other collection without a
// migration): approvals lists his Approve scripts presses (config/teleprompter.json approval.collection, read by
// teleprompter_send.py), titles his Titles presses. Each is the picks documents of that kind; nothing writes to a view.
export const views = { approvals: 'approve_scripts', titles: 'titles' } as const
export type View = keyof typeof views
export const MAX_HTML = 16 * 1024 * 1024
export const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value)
}
export function monday(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(+d) && d.toISOString().slice(0, 10) === value && d.getUTCDay() === 1
}
export const validId = (id: string) => /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(id)
export const revision = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0
/** Growth's write-back key (POST /api/board/<Monday>/posted, _posted.ts): `Bearer GROWTH_WRITEBACK_TOKEN`, a key that
 *  opens that one route and nothing else, or the engine operator's key. Never a match while the variable is unset. */
export function growthWriter(req: VercelRequest): boolean {
  const token = process.env.GROWTH_WRITEBACK_TOKEN || ''
  const got = String(req.headers.authorization || '')
  const want = `Bearer ${token}`
  const same = Boolean(token) && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want))
  return same || operatorBearerAllowed(req)
}
export function actor(req: VercelRequest, operatorOnly = false): string | null {
  if (operatorBearerAllowed(req)) return 'engine_operator'
  if (operatorOnly || !hasEngineAccess(req)) return null
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    const origins = ['https://content.krishraja.com', 'https://controlcenter.krishraja.com', process.env.APP_ORIGIN].filter(Boolean)
    if (!origins.includes(String(req.headers.origin || ''))) return null
  }
  return 'Krish'
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const SHA256 = /^[a-f0-9]{64}$/
const TP_ID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/
// Krish's five presses on an idea (Krish, 2026-10-28: "pick an idea for a specific day AND add any optional comments
// easily, which can be saved, or I can: mark an idea as being useful in a future wider piece OR mark it as being an
// idea that should be stored for a future trend OR queue it for next week OR reject it"). The pick is picks/<day>; the
// other four are queue/<pick> with one of these uses (null takes a press back).
export const PRESS_USES = ['wider_piece_context', 'track_over_time', 'next_week', 'not_for_us'] as const
// The off days (Krish, 2026-10-28: "I'm happy to plan the Tuesday, Thursday, Saturday, and Sunday content within the
// Sunday ideas session if you give me a few options to approve as you do the Mon/wed/fri"): queue/off-<day>-<option>.
// Growth's off-day lane runs every day (Krish, 2026-10-29: "Mix wins: every day"), so its options may sit on any day;
// a piece he records stays a Tuesday, Thursday, Saturday or Sunday piece (recordedOffday).
export const OFFDAY_ID = /^off-(mon|tue|wed|thu|fri|sat|sun)-[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59}$/
const RECORDED_DAYS = ['tue', 'thu', 'sat', 'sun']
// His decisions on a day's tab, stored in picks beside the day's pick: <day>-scripts (Approve scripts), <day>-titles
// (Titles), <day>-publish (Approve for publish) and <day>-reject-<asset> (Reject asset).
export const DECISION_ID = /^(mon|wed|fri)-(scripts|titles|publish|reject-([a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}))$/
export const DECISION_KIND = { scripts: 'approve_scripts', titles: 'titles', publish: 'approve_publish', reject: 'reject_asset' } as const
// His scores for a piece (Krish, 2026-10-29: "allow me to add a score out of 10 for narrative quality and production
// quality"), pressed on a day tab or in the Archive: picks/score-<piece uuid>. The server files each save as one
// piece_scores row (afterPress); the document keeps his latest press for the board to show.
export const SCORE_ID = /^score-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
export const SCORE_BASES = ['at_publish', 'hindsight'] as const
export function scoreBody(id: string, body: Record<string, unknown>): boolean {
  const m = SCORE_ID.exec(id)
  const mark = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 1 && Number(v) <= 10
  return !!m && body.kind === 'scores' && body.piece_id === m[1] && mark(body.narrative) && mark(body.production)
    && (SCORE_BASES as readonly unknown[]).includes(body.basis) && !('send' in body)
    && (!('note' in body) || body.note === null || typeof body.note === 'string' && body.note.length <= 4000)
}
export const SCRIPT_CUTS = ['long', 'short', 'feature'] as const
export const TITLE_SURFACES = ['long_title', 'short_title', 'long_thumbnail', 'short_thumbnail'] as const
const oneLine = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\x00-\x1f\x7f]/.test(v)
/** An object whose keys are some of `keys` (at least one) and whose every value passes `ok`. */
function keyed(v: unknown, keys: readonly string[], ok: (x: unknown) => boolean): v is Record<string, unknown> {
  return object(v) && Object.keys(v).length > 0 && Object.entries(v).every(([k, x]) => keys.includes(k) && ok(x))
}
/** A day decision (DECISION_ID): what each of his presses on a day's tab must carry. The server adds send to an
 *  approval of scripts, so a write that brings its own is refused. */
function decisionBody(id: string, body: Record<string, unknown>): boolean {
  const m = DECISION_ID.exec(id)
  if (!m || body.day !== m[1] || 'send' in body) return false
  const kind = m[2].startsWith('reject-') ? DECISION_KIND.reject : DECISION_KIND[m[2] as 'scripts' | 'titles' | 'publish']
  if (body.kind !== kind) return false
  const piece = typeof body.piece_id === 'string' && UUID.test(body.piece_id)
  if (kind === 'titles') return (!('piece_id' in body) || piece) && keyed(body.picks, TITLE_SURFACES, x => oneLine(x, 300))
  if (!piece) return false
  if (kind === 'approve_publish') return typeof body.approved === 'boolean' && (!('manifest_sha256' in body) || SHA256.test(String(body.manifest_sha256)))
  if (kind === 'reject_asset') {
    return body.asset === m[3] && oneLine(body.label, 300) && typeof body.reason === 'string' && body.reason.trim().length > 0 && body.reason.length <= 4000
      && (!('drive_id' in body) || /^[A-Za-z0-9_-]{10,80}$/.test(String(body.drive_id)))
      && (!('at_ms' in body) || Number.isSafeInteger(body.at_ms) && Number(body.at_ms) >= 0 && Number(body.at_ms) <= 86_400_000)
      && (!('formats' in body) || Array.isArray(body.formats) && body.formats.length <= 16 && body.formats.every(f => typeof f === 'string' && /^[a-z][a-z0-9_]{1,40}$/.test(f)))
  }
  // approve_scripts: the exact words of each cut he approved (texts), as he saw them on the Drafts step, with the
  // Teleprompter names they go under; scripts, when given, is the hash of each (the server checks it, or fills it).
  if (typeof body.approved !== 'boolean') return false
  if (body.approved === false) return true
  const cuts = object(body.texts) ? Object.keys(body.texts) : []
  const same = (v: unknown) => object(v) && Object.keys(v).every(k => cuts.includes(k))
  return keyed(body.texts, SCRIPT_CUTS, x => typeof x === 'string' && x.trim().length > 0 && x.length <= 100_000)
    && keyed(body.titles, SCRIPT_CUTS, x => oneLine(x, 200)) && same(body.titles) && Object.keys(body.titles as object).length === cuts.length
    && (!('scripts' in body) || keyed(body.scripts, SCRIPT_CUTS, x => SHA256.test(String(x))) && same(body.scripts))
    && oneLine(body.folder_title, 200) && (!('folder_id' in body) || TP_ID.test(String(body.folder_id)))
    && (!('script_ids' in body) || keyed(body.script_ids, SCRIPT_CUTS, x => TP_ID.test(String(x))) && same(body.script_ids))
}
export function validBody(collection: string, id: string, body: unknown): boolean {
  if (!validId(id) || !object(body) || Buffer.byteLength(JSON.stringify(body)) > 256 * 1024) return false
  if ('at' in body && (typeof body.at !== 'string' || !Number.isFinite(Date.parse(body.at)))) return false
  const day = (v: unknown) => ['mon', 'wed', 'fri'].includes(String(v))
  // A box may sit on any day: an off-day post Growth makes has its own boxes (2026-10-30).
  const anyDay = (v: unknown) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(String(v))
  const text = (k: string, max = 150000) => typeof body[k] === 'string' && (body[k] as string).length <= max
  if (collection === 'ticks') return typeof body.done === 'boolean' && anyDay(body.day) && text('piece_id', 100) && text('step', 80) && text('label', 300) && id === `${body.day}-${body.step}`
  if (collection === 'links') return day(id) && ['article', 'youtube'].every(k => text(k, 2048) && (!body[k] || /^https?:\/\//.test(body[k] as string)))
  if (collection === 'edits') return text('text') && day(body.day) && text('item', 100) && id === `${body.day}-${body.item}`
  // His pick for a day, with his optional saved note; or one of his decisions on a day's tab (decisionBody).
  if (collection === 'picks' && DECISION_ID.test(id)) return decisionBody(id, body)
  if (collection === 'picks' && (SCORE_ID.test(id) || body.kind === 'scores')) return scoreBody(id, body)
  if (collection === 'picks') return day(id) && day(body.day) && text('pick', 160) && text('story') && !('kind' in body)
    && (!('note' in body) || body.note === null || text('note', 2000))
  // A Combine tap on the Queue tab's "Could combine" card: his choice only, recorded as queue/combine-<n>; the next
  // session runs synthesize on his word (Krish, 2026-10-21: nothing in the queue is combined without it).
  if (collection === 'queue' && body.combine !== undefined) return /^combine-\d{1,3}$/.test(id) && body.combine === true && body.pick === id
    && Array.isArray(body.members) && body.members.length >= 2 && body.members.length <= 5
    && body.members.every(m => typeof m === 'string' && UUID.test(m)) && new Set(body.members).size === body.members.length
  // An off-day option he approved or skipped: queue/off-<day>-<option>, bound to the copy he was shown (copy_sha256).
  if (collection === 'queue' && (OFFDAY_ID.test(id) || body.use === 'offday')) return OFFDAY_ID.test(id) && body.use === 'offday'
    && body.pick === id && id.startsWith(`off-${String(body.day)}-`) && typeof body.approved === 'boolean'
    && SHA256.test(String(body.copy_sha256)) && ['format', 'source', 'option_id'].every(k => !(k in body) || text(k, 1000))
    && !('send' in body) && (body.kind === undefined || recordedOffday(body))
  // One of the four presses on an idea (PRESS_USES), or null to take it back: queue/<pick>, his optional note (a
  // theme or a note for a wider piece), his reason on a Reject (required, so every rejection carries his words to learn
  // from), and the Monday a Next week mark is for.
  if (collection === 'queue' && 'use' in body) return body.pick === id && text('pick', 160) && typeof body.queued === 'boolean'
    && (body.use === null || (PRESS_USES as readonly unknown[]).includes(body.use))
    && ['note', 'reason'].every(k => !(k in body) || body[k] === null || text(k, 2000)) && (!('theme' in body) || body.theme === null || text('theme', 120))
    && (body.use !== 'not_for_us' || typeof body.reason === 'string' && body.reason.trim().length > 0)
    && (body.use === 'next_week' ? monday(String(body.target_week)) : !('target_week' in body) || body.target_week === null)
  if (collection === 'queue') return text('pick', 160) && typeof body.queued === 'boolean'
  if (collection === 'comments') return text('text', 30000) && text('thread_id', 160) && validId(String(body.thread_id)) && text('anchor', 160) && validId(String(body.anchor))
    && commentExtras(body)
  return false
}
// An off-day piece he records (Ruling, Krish, 2026-10-29: an idea he drops in can be a Tuesday, Thursday, Saturday or
// Sunday piece, one short cut, said to camera or a voiceover): his press on its option carries the piece, its series
// and style, the exact words he saw and the names they go under in Teleprompter. The server works out the words' hash
// itself (preparePress) and adds send, so a write that brings its own send is refused above.
export const RECORDED_STYLES = ['to_camera', 'voiceover'] as const
export const RECORDED_SERIES = ['follow_the_money', 'under_the_hood', 'mind_the_gap'] as const
function recordedOffday(body: Record<string, unknown>): boolean {
  return body.kind === 'recorded' && RECORDED_DAYS.includes(String(body.day)) && typeof body.piece_id === 'string' && UUID.test(body.piece_id)
    && (RECORDED_SERIES as readonly unknown[]).includes(body.series) && (RECORDED_STYLES as readonly unknown[]).includes(body.style)
    && typeof body.script === 'string' && body.script.trim().length > 0 && body.script.length <= 20_000
    && (!('script_sha256' in body) || SHA256.test(String(body.script_sha256)))
    && oneLine(body.folder_title, 200) && oneLine(body.title, 200)
    && (!('readers' in body) || Array.isArray(body.readers) && body.readers.length <= 6 && body.readers.every(r => oneLine(r, 200)))
}
// What a comment may carry beyond its words (Krish, 2026-10-21: comment on any passage of a draft, and his taps on
// "Also changed" and "What I learned from your edits"): where in which draft and the words he picked, or one of his
// taps (act) on one change or proposal (ref). Each optional, each bounded; nothing else is checked here.
export const COMMENT_ACTS = ['undo', 'apply', 'lesson_yes', 'lesson_no'] as const
function commentExtras(body: Record<string, unknown>): boolean {
  if ('box' in body && !(typeof body.box === 'string' && validId(body.box))) return false
  if ('paragraph' in body && !(Number.isSafeInteger(body.paragraph) && Number(body.paragraph) >= 0 && Number(body.paragraph) < 10000)) return false
  if ('quote' in body && !(typeof body.quote === 'string' && body.quote.length > 0 && body.quote.length <= 2000)) return false
  if ('act' in body || 'ref' in body) {
    if (!(COMMENT_ACTS as readonly string[]).includes(String(body.act))) return false
    if (!(typeof body.ref === 'string' && validId(body.ref))) return false
  }
  return true
}
/** A Combine tap is his word to combine queued ideas, so only Krish writes one (the access-cookie actor); a session
 *  holding the operator key could otherwise write a tap that the next session relays as his. */
export function combineWriterRefused(collection: string, body: unknown, who: string | null): boolean {
  return collection === 'queue' && object(body) && body.combine !== undefined && who !== 'Krish'
}
/** The writes a session relays as his words: a Combine tap, a saved edit of a draft (edit_sweep.py carries it into
 *  every other draft and the ledger as decided_by Krish), his taps on a change or a lesson (a comment with act), his
 *  note on a pick, a press on an idea or an off-day option (a queue document with use), and his decisions on a day's
 *  tab (a picks document with kind: Approve scripts, Titles, Approve for publish, Reject asset, and his Scores). Only Krish writes
 *  them; any other writer gets the code to refuse with. A plain comment stays open to the engine. */
export function hisOnlyRefusal(collection: string, body: unknown, who: string | null): string | null {
  if (who === 'Krish') return null
  if (combineWriterRefused(collection, body, who)) return 'combine_is_his_tap'
  if (collection === 'edits') return 'edit_is_his_save'
  if (collection === 'comments' && object(body) && 'act' in body) return 'tap_is_his'
  if (collection === 'picks' && object(body) && 'kind' in body) return 'decision_is_his'
  if (collection === 'picks' && object(body) && 'note' in body) return 'pick_note_is_his'
  if (collection === 'queue' && object(body) && 'use' in body) return 'press_is_his'
  return null
}
// Source archives retain the export's selectors, missing anchors and synthesized
// reply identifiers verbatim. Canonical comments still use validBody above.
export function validSourceBody(collection: string, id: unknown, body: unknown): boolean {
  if (collection !== 'comments') return typeof id === 'string' && validBody(collection, id, body)
  const sourceId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 300 && !/[\x00-\x1f]/.test(value)
  return sourceId(id) && object(body) && Buffer.byteLength(JSON.stringify(body)) <= 256 * 1024
    && sourceId(body.thread_id) && (body.anchor === null || typeof body.anchor === 'string' && body.anchor.length <= 1000)
    && typeof body.text === 'string' && body.text.length <= 30000
    && (!('at' in body) || typeof body.at === 'string' && Number.isFinite(Date.parse(body.at)))
}
export type BoardFile = { sha256: string; bytes: number; type: string; name: string; key: string }
export type Manifest = { version: 1; week: string; html: BoardFile; assets: Record<string, BoardFile>; delivery_review?: unknown }
export function fileSpec(week: string, v: unknown, html = false): v is BoardFile {
  if (!object(v) || !/^[a-f0-9]{64}$/.test(String(v.sha256)) || !Number.isSafeInteger(v.bytes) || Number(v.bytes) <= 0) return false
  if (Number(v.bytes) > (html ? MAX_HTML : 2 * 1024 ** 3)) return false
  if (typeof v.type !== 'string' || !/^[a-z]+\/[a-z0-9.+-]+$/.test(v.type)) return false
  if (html && v.type !== 'text/html') return false
  if (typeof v.name !== 'string' || !/^[^/\\\x00-\x1f]{1,200}$/.test(v.name)) return false
  return v.key === `boards/${week}/${v.sha256}`
}
export function validManifest(week: string, v: unknown): v is Manifest {
  return object(v) && v.version === 1 && v.week === week && fileSpec(week, v.html, true) && object(v.assets)
    && Object.keys(v.assets).length <= 250 && Object.entries(v.assets).every(([id, f]) => validId(id) && fileSpec(week, f))
}
