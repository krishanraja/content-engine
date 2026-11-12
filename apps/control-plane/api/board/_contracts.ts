import { createHash, timingSafeEqual } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { hasEngineAccess, operatorBearerAllowed } from '../_auth.js'

export const collections = ['ticks', 'links', 'edits', 'picks', 'queue', 'comments'] as const
export type Collection = typeof collections[number]
// Read-only views of his day decisions, which are stored in picks (board_documents takes no other collection without a
// migration): approvals lists his Approve scripts presses (config/teleprompter.json approval.collection, read by
// teleprompter_send.py), titles his Titles presses. Each is the picks documents of that kind; nothing writes to a view.
// The production gates (GATE_KINDS) are views too, so GET /api/board/<Monday>/storyboard (style, proof, cut) lists his
// presses on each gate, one per day: storyboard/<day> is the picks document <day>-storyboard.
export const views = { approvals: 'approve_scripts', titles: 'titles', storyboard: 'sign_storyboard', style: 'pick_style', proof: 'approve_proof', cut: 'approve_cut', creative: 'sign_creative' } as const
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
// other four are queue/<pick> with one of these uses (null takes a press back). Since 11 November they are four of the
// five outcomes (Krish, 2026-11-11: "filed away for later, rejected and learnt from, saved as a trend for a wider piece,
// improved for a future piece cue"; _gate.ts OUTCOME_OF_USE): next_week is Filed for later, not_for_us Rejected and
// learnt from, wider_piece_context (and the older track_over_time) Saved as a trend, improve Improved for a future piece.
export const PRESS_USES = ['wider_piece_context', 'track_over_time', 'next_week', 'not_for_us', 'improve'] as const
// The off days (Krish, 2026-10-28: "I'm happy to plan the Tuesday, Thursday, Saturday, and Sunday content within the
// Sunday ideas session if you give me a few options to approve as you do the Mon/wed/fri"): queue/off-<day>-<option>.
// Growth's off-day lane runs every day (Krish, 2026-10-29: "Mix wins: every day"), so its options may sit on any day;
// a piece he records stays a Tuesday, Thursday, Saturday or Sunday piece (recordedOffday).
// A refused subject's line on the ideas board (ideas.json vetoes): queue/veto-<the subject, lower case, dashed>.
export const VETO_ID = /^veto-[a-z0-9][a-z0-9-]{0,59}$/
export const OFFDAY_ID = /^off-(mon|tue|wed|thu|fri|sat|sun)-[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59}$/
// Sunday is a rest day (Ruling, Krish, 2026-11-02: "Let's eliminate Sunday from Publishing anythign permanently").
const RECORDED_DAYS = ['tue', 'thu', 'sat']
// His decisions on a day's tab, stored in picks beside the day's pick: <day>-scripts (Approve scripts), <day>-titles
// (Titles), <day>-publish (Approve for publish) and <day>-reject-<asset> (Reject asset).
// The production gates on a day's tab (docs/PUBLISH_BOARDS.md, "The production gates on a day's tab"; Krish,
// 2026-11-04: "Can I select a visual style now that we have different style skills? Do I get shown mocks at the right
// moment?"): <day>-storyboard (Sign storyboard), <day>-style (Pick a style), <day>-proof (Approve or Reject the moving
// proof) and <day>-cut (Approve cut). Each is bound to the sha256 of what the tab showed him (GATE_KINDS, gateBody).
export const DECISION_ID = /^(mon|wed|fri)-(scripts|titles|publish|storyboard|style|proof|cut|reject-([a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}))$/
export const DECISION_KIND = { scripts: 'approve_scripts', titles: 'titles', publish: 'approve_publish', reject: 'reject_asset',
  storyboard: 'sign_storyboard', style: 'pick_style', proof: 'approve_proof', cut: 'approve_cut' } as const
/** Each production gate's press kind, and the key it is written under on the piece's making record (meta.making.gates). */
export const GATE_KINDS = { sign_storyboard: 'storyboard', pick_style: 'style', approve_proof: 'proof', approve_cut: 'final' } as const
export type GateKind = keyof typeof GATE_KINDS
export const STYLE_VERDICTS = ['picked', 'seen', 'not_for_us'] as const
export const PROOF_VERDICTS = ['approve', 'reject'] as const
const MODULE_ID = /^[a-z0-9][a-z0-9_.-]{0,79}$/
const words = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 2000
/** A press on a production gate: the day's piece, the sha256 of what the tab showed, and what each gate needs.
 *  - sign_storyboard: approved true, the hash of the storyboard and expectations text shown.
 *  - pick_style: the hash of the styles.json shown; module (the picked motion style id) or null for "None of these",
 *    which needs his words (reason); his verdict on every style shown (verdicts), exactly one picked when he picked one.
 *  - approve_proof: the proof clip's file hash; verdict approve, or reject with his words.
 *  - approve_cut: approved true, the hash of the cut file shown (or of the cuts map, when both are), and cuts. */
function gateBody(kind: GateKind, body: Record<string, unknown>): boolean {
  if (!SHA256.test(String(body.sha256))) return false
  if (kind === 'sign_storyboard') return body.approved === true
  if (kind === 'approve_proof') {
    if (!(PROOF_VERDICTS as readonly unknown[]).includes(body.verdict)) return false
    if ('cut' in body && !(SCRIPT_CUTS as readonly unknown[]).includes(body.cut)) return false
    if (body.verdict === 'reject') return words(body.words)
    return !('words' in body) || body.words === null || words(body.words)
  }
  if (kind === 'approve_cut') {
    if (body.approved !== true) return false
    if (!('cuts' in body)) return true
    if (!keyed(body.cuts, SCRIPT_CUTS, x => SHA256.test(String(x)))) return false
    const cuts = body.cuts as Record<string, string>, shas = Object.values(cuts)
    // One cut shown: its own file hash. Both: the hash of the cuts map (canonical), so the press binds both files.
    return shas.length === 1 ? body.sha256 === shas[0] : body.sha256 === digest(canonical(cuts))
  }
  // pick_style
  const list = body.verdicts
  if (!Array.isArray(list) || list.length < 1 || list.length > 6) return false
  const seen = new Set<string>()
  for (const v of list) {
    if (!object(v) || Object.keys(v).some(k => !['module', 'verdict', 'sha256'].includes(k))) return false
    if (typeof v.module !== 'string' || !MODULE_ID.test(v.module) || seen.has(v.module)) return false
    if (!(STYLE_VERDICTS as readonly unknown[]).includes(v.verdict)) return false
    if ('sha256' in v && !SHA256.test(String(v.sha256))) return false
    seen.add(v.module)
  }
  const picked = list.filter(v => (v as Record<string, unknown>).verdict === 'picked')
  if (!('module' in body)) return false
  if (body.module === null) return picked.length === 0 && words(body.reason)
  return typeof body.module === 'string' && MODULE_ID.test(body.module) && picked.length === 1
    && (picked[0] as Record<string, unknown>).module === body.module
    && (!('reason' in body) || body.reason === null || words(body.reason))
}
// His retrospective thoughts on a day's post (the Today view, layout A; Krish, 2026-10-29: "yes, go with A and your
// recommendations and my feedback"; 2026-10-30: "the two feedback buttons need to just be an open text box for my
// retrospective thoughts and feedback rather than Y/N buttons"): picks/<day>-feel, any day of the week, his words, with
// the older Liked or Not it press still read. The server files each save as one taste_reports row (afterPress).
// His one press on the week's filler (Ruling, Krish, 2026-10-30: "approve the week's mix once, let Growth fill it"):
// picks/mix, the mix by day exactly as the board showed it and its sha256. Growth reads it with the week's pieces
// (readPieces) and makes and posts within it; a piece he records keeps its own press on its exact words.
export const MIX_ID = 'mix'
const MIX_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export function mixBody(body: Record<string, unknown>): boolean {
  const days = body.days
  return body.kind === 'mix' && typeof body.approved === 'boolean' && SHA256.test(String(body.mix_sha256)) && !('send' in body)
    && !!days && typeof days === 'object' && !Array.isArray(days) && Object.keys(days).length > 0
    && Object.entries(days as Record<string, unknown>).every(([d, v]) => MIX_DAYS.includes(d) && Array.isArray(v) && v.length > 0 && v.length <= 12
      && v.every(x => typeof x === 'string' && x.length > 0 && x.length <= 200))
    && (!('note' in body) || body.note === null || typeof body.note === 'string' && body.note.length <= 2000)
}
export const FEEL_ID = /^(mon|tue|wed|thu|fri|sat|sun)-feel(?:-[1-9])?$/
export const FEELS = ['liked', 'not_it'] as const
export function feelBody(id: string, body: Record<string, unknown>): boolean {
  const m = FEEL_ID.exec(id)
  const words = typeof body.note === 'string' && body.note.trim().length > 0
  return !!m && body.kind === 'feel' && body.day === m[1] && !('send' in body)
    && ('feel' in body ? (FEELS as readonly unknown[]).includes(body.feel) : words)
    && (!('piece_id' in body) || typeof body.piece_id === 'string' && UUID.test(body.piece_id))
    && (!('title' in body) || typeof body.title === 'string' && body.title.length <= 300)
    && (!('note' in body) || body.note === null || typeof body.note === 'string' && body.note.length <= 2000)
}
// His scores for a piece (Krish, 2026-10-29: "allow me to add a score out of 10 for narrative quality and production
// quality"), pressed on a day tab or in the Archive: picks/score-<piece uuid>. The server files each save as one
// piece_scores row (afterPress); the document keeps his latest press for the board to show.
export const SCORE_ID = /^score-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
export const SCORE_BASES = ['at_publish', 'hindsight'] as const
// Layout v4 (Krish, 2026-11-07: "It also doesn't allow me to give feedback for every day of publishing stuff last week,
// say, for example, the off days"): a post with no piece yet (an off day Growth made) is scored on the board as
// picks/score-<date>[-<slot>], with its date and title; it files no piece_scores row until it has a piece.
export const SCORE_DATE_ID = /^score-(\d{4}-\d{2}-\d{2})(?:-([a-z0-9][a-z0-9_-]{0,39}))?$/
const SCORE_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export function scoreBody(id: string, body: Record<string, unknown>): boolean {
  const m = SCORE_ID.exec(id)
  const dated = SCORE_DATE_ID.exec(id)
  const mark = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 1 && Number(v) <= 10
  const common = body.kind === 'scores' && mark(body.narrative) && mark(body.production)
    && (SCORE_BASES as readonly unknown[]).includes(body.basis) && !('send' in body)
    && (!('note' in body) || body.note === null || typeof body.note === 'string' && body.note.length <= 4000)
    && (!('day' in body) || SCORE_DAYS.includes(String(body.day)))
  if (m) return common && body.piece_id === m[1]
  if (!dated || !common) return false
  const day = new Date(`${dated[1]}T00:00:00Z`)
  return !isNaN(+day) && day.toISOString().slice(0, 10) === dated[1] && body.date === dated[1]
    && typeof body.title === 'string' && body.title.trim().length > 0 && body.title.length <= 300 && !/[\x00-\x1f\x7f]/.test(body.title)
    && (!('piece_id' in body) || typeof body.piece_id === 'string' && UUID.test(body.piece_id))
}
// Layout v4's Creative step (docs/PUBLISH_BOARDS.md, "Layout v4"; Krish, 2026-11-07: "I want to be able to answer all
// the questions up front on what we should do in terms of creative production... It's important we have mockups and
// really clear ideas before full production"): picks/<day>-creative, any day Monday to Saturday. Sign creative carries
// his pick in each of the four sections, bound to the sha256 of the sheet shown; Change it carries his words.
export const CREATIVE_ID = /^(mon|tue|wed|thu|fri|sat)-creative$/
export const CREATIVE_PICKS = ['opener', 'captions', 'motion', 'thumbnail'] as const
const PICK_VALUE = /^[a-z0-9][a-z0-9_.-]{0,79}$/
export function creativeBody(id: string, body: Record<string, unknown>): boolean {
  const m = CREATIVE_ID.exec(id)
  if (!m || body.kind !== 'sign_creative' || body.day !== m[1] || 'send' in body) return false
  if (!(typeof body.piece_id === 'string' && UUID.test(body.piece_id)) || !SHA256.test(String(body.sha256))) return false
  if (typeof body.approved !== 'boolean') return false
  const picks = body.picks
  if (!object(picks) || Object.keys(picks).some(k => !(CREATIVE_PICKS as readonly string[]).includes(k))
    || Object.values(picks).some(v => typeof v !== 'string' || !PICK_VALUE.test(v))) return false
  if ('storyboard_sha256' in body && !SHA256.test(String(body.storyboard_sha256))) return false
  if ('shown' in body && !(Array.isArray(body.shown) && body.shown.length <= 6 && body.shown.every(x => typeof x === 'string' && MODULE_ID.test(x)))) return false
  const said = 'words' in body && body.words !== null
  if (said && !words(body.words)) return false
  if (body.approved === false) return said
  // Signed: one pick in every section, the motion pick a style the sheet showed, and the storyboard hash ve binds.
  return CREATIVE_PICKS.every(k => k in picks) && MODULE_ID.test(String(picks.motion)) && SHA256.test(String(body.storyboard_sha256))
    && (!('shown' in body) || (body.shown as string[]).includes(String(picks.motion)))
}
// One yes anywhere (Ruling, Krish, 2026-11-02: "yes, start with one yes anywhere"; "the reason I dont press approve is
// cos this board is crap and outdated all the time, and yet you refuse to do work until i press approve"). His yes to
// a day is one record readable by the board, the piece manifest and Growth's scheduler, from either place he gives it:
//   picks/yes-<day>-board  his press on the board (Yes, or Undo), written only through his own login;
//   picks/yes-<day>-words  his exact typed words from a session, carried by the engine with when and where he typed
//                          them and the session link, so it can never pass for a press he did not make.
// The later of the two by `at` is his answer for the day; his Undo on the board beats an earlier chat yes.
export const YES_ID = /^yes-(mon|tue|wed|thu|fri|sat|sun)-(board|words)$/
export function yesBody(id: string, body: Record<string, unknown>): boolean {
  const m = YES_ID.exec(id)
  if (!m || body.kind !== 'yes' || body.day !== m[1] || body.via !== m[2] || typeof body.approved !== 'boolean' || 'send' in body) return false
  if (typeof body.at !== 'string' || !Number.isFinite(Date.parse(body.at))) return false
  if (m[2] === 'board') return !('words' in body) || body.words === null || typeof body.words === 'string' && body.words.length <= 2000
  // From his words: the words themselves, verbatim, when and where he typed them, and the session they came from.
  return body.approved === true && typeof body.words === 'string' && body.words.trim().length > 0 && body.words.length <= 2000
    && typeof body.said_at === 'string' && Number.isFinite(Date.parse(body.said_at))
    && oneLine(body.said_where, 300) && typeof body.session_ref === 'string' && /^https:\/\/[^\s]{1,290}$/.test(body.session_ref)
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
  const kind = m[2].startsWith('reject-') ? DECISION_KIND.reject : DECISION_KIND[m[2] as Exclude<keyof typeof DECISION_KIND, 'reject'>]
  if (body.kind !== kind) return false
  const piece = typeof body.piece_id === 'string' && UUID.test(body.piece_id)
  if (kind === 'titles') return (!('piece_id' in body) || piece) && keyed(body.picks, TITLE_SURFACES, x => oneLine(x, 300))
  if (!piece) return false
  if (Object.hasOwn(GATE_KINDS, kind)) return gateBody(kind as GateKind, body)
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
  if (collection === 'picks' && (YES_ID.test(id) || body.kind === 'yes')) return yesBody(id, body)
  if (collection === 'picks' && FEEL_ID.test(id)) return feelBody(id, body)
  if (collection === 'picks' && (id === MIX_ID || body.kind === 'mix')) return id === MIX_ID && mixBody(body)
  if (collection === 'picks' && (CREATIVE_ID.test(id) || body.kind === 'sign_creative')) return creativeBody(id, body)
  if (collection === 'picks' && DECISION_ID.test(id)) return decisionBody(id, body)
  if (collection === 'picks' && (SCORE_ID.test(id) || SCORE_DATE_ID.test(id) || body.kind === 'scores')) return scoreBody(id, body)
  // His Approve on a publishing day's idea: the idea it names (idea_id), and the hash of the words he saw
  // (option_sha256, worked out again by preparePress from so_what and story).
  if (collection === 'picks') return day(id) && day(body.day) && text('pick', 160) && text('story') && !('kind' in body)
    && (!('note' in body) || body.note === null || text('note', 2000))
    && (!('idea_id' in body) || body.idea_id === null || typeof body.idea_id === 'string' && UUID.test(body.idea_id))
    && (!('so_what' in body) || text('so_what', 4000)) && (!('option_sha256' in body) || SHA256.test(String(body.option_sha256)))
  // A Combine tap on the Queue tab's "Could combine" card: his choice only, recorded as queue/combine-<n>; the next
  // session runs synthesize on his word (Krish, 2026-10-21: nothing in the queue is combined without it).
  if (collection === 'queue' && body.combine !== undefined) return /^combine-\d{1,3}$/.test(id) && body.combine === true && body.pick === id
    && Array.isArray(body.members) && body.members.length >= 2 && body.members.length <= 5
    && body.members.every(m => typeof m === 'string' && UUID.test(m)) && new Set(body.members).size === body.members.length
  // An off-day option he approved or skipped: queue/off-<day>-<option>, bound to the copy he was shown (copy_sha256).
  // His comment on any option (Krish, 2026-10-31: every option takes a comment box) rides as its note: with his Approve
  // or Skip, alone on an option he has not pressed (approved null), or added to one he pressed (note_only: the handler
  // keeps the press as saved and only the note changes, so nothing it did runs again).
  // His verdicts on an off-day option, side by side (Ruling, Krish, 2026-11-01: "Mock looks right, lock it and build
  // it"; he asked for "Ideas and a suggested creative direction to approve or improve or flat out reject for a
  // reason"): the idea, the direction and the mock Growth returns, each {verdict, words, sha256, at, shown}. Improve
  // and Reject carry his words (required), and each side is bound to what it showed him (sha256).
  if (collection === 'queue' && OFFDAY_ID.test(id) && (OFFDAY_SIDES.some(k => k in body) || object(body.note))) return offdayVerdicts(id, body)
  if (collection === 'queue' && (OFFDAY_ID.test(id) || body.use === 'offday')) {
    const words = typeof body.note === 'string' && body.note.trim().length > 0
    return OFFDAY_ID.test(id) && body.use === 'offday'
    && body.pick === id && id.startsWith(`off-${String(body.day)}-`)
    && (typeof body.approved === 'boolean' || body.approved === null && words && body.kind === undefined)
    && SHA256.test(String(body.copy_sha256)) && ['format', 'source', 'option_id'].every(k => !(k in body) || text(k, 1000))
    && (!('note' in body) || body.note === null || text('note', 2000))
    && (!('note_only' in body) || body.note_only === true && typeof body.note === 'string')
    && !('send' in body) && (body.kind === undefined || recordedOffday(body))
  }
  // One of the four presses on an idea (PRESS_USES), or null to take it back: queue/<pick>, his optional note (a
  // theme or a note for a wider piece), his reason on a Reject (required, so every rejection carries his words to learn
  // from), and the Monday a Next week mark is for.
  if (collection === 'queue' && 'use' in body) return body.pick === id && text('pick', 160) && typeof body.queued === 'boolean'
    && (body.use === null || (PRESS_USES as readonly unknown[]).includes(body.use))
    && ['note', 'reason'].every(k => !(k in body) || body[k] === null || text(k, 2000)) && (!('theme' in body) || body.theme === null || text('theme', 120))
    // A No pressed on Control Center's one list (via 'list') carries no words, and none are made up for it: a
    // reason is his typed words or absent, never a line written for him (Ruling, Krish, 2026-11-03: Control Center's
    // Content tab approves ideas).
    && (!('via' in body) || body.via === 'list')
    && (body.use !== 'not_for_us' || typeof body.reason === 'string' && body.reason.trim().length > 0 || body.via === 'list')
    // Improved for a future piece is his note: the cue a future slate reads.
    && (body.use !== 'improve' || typeof body.note === 'string' && body.note.trim().length > 0)
    && (!('option_sha256' in body) || SHA256.test(String(body.option_sha256)))
    && (body.use === 'next_week' ? monday(String(body.target_week)) : !('target_week' in body) || body.target_week === null)
  // "Offer it again" on a veto line (the ideas quality plan, item 1): queue/veto-<subject>, the subject he gives back.
  if (collection === 'queue' && 'unveto' in body) return VETO_ID.test(id) && body.pick === id && body.queued === false && text('unveto', 120)
  if (collection === 'queue') return text('pick', 160) && typeof body.queued === 'boolean'
  if (collection === 'comments') return text('text', 30000) && text('thread_id', 160) && validId(String(body.thread_id)) && text('anchor', 160) && validId(String(body.anchor))
    && commentExtras(body)
  return false
}
export const OFFDAY_SIDES = ['idea', 'direction', 'mock'] as const
// The five outcomes on an off-day option's idea (Krish, 2026-11-11): approve, next_week (Filed for later), reject,
// trend (Saved as a trend, his words name it) and improve. The direction and the mock take approve, improve and reject.
export const OFFDAY_VERDICTS = ['approve', 'improve', 'reject', 'next_week', 'trend'] as const
function offdayVerdicts(id: string, body: Record<string, unknown>): boolean {
  const line = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max
  if (body.use !== 'offday' || body.pick !== id || !id.startsWith(`off-${String(body.day)}-`) || 'send' in body || 'kind' in body
    || 'approved' in body) return false
  // His open words on the option (Krish, 2026-11-02: "feedback on anything in open text format"), exactly as typed.
  if ('note' in body && body.note !== null && !(object(body.note) && Object.keys(body.note).every(k => ['words', 'at'].includes(k))
    && typeof body.note.words === 'string' && body.note.words.trim().length > 0 && body.note.words.length <= 2000)) return false
  if (!SHA256.test(String(body.copy_sha256)) || !['format', 'source', 'option_id'].every(k => !(k in body) || line(body[k], 1000))) return false
  if ('week' in body && !(typeof body.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.week))) return false
  const sides = OFFDAY_SIDES.filter(k => k in body)
  return (sides.length > 0 || object(body.note)) && sides.every(k => {
    const v = body[k]
    if (!object(v) || Object.keys(v).some(x => !['verdict', 'words', 'sha256', 'at', 'shown'].includes(x))) return false
    const verdict = v.verdict
    if (verdict !== null && !(OFFDAY_VERDICTS as readonly unknown[]).includes(verdict)) return false
    if ((verdict === 'next_week' || verdict === 'trend') && k !== 'idea') return false
    const words = typeof v.words === 'string' && v.words.trim().length > 0
    if ((verdict === 'improve' || verdict === 'reject' || verdict === 'trend') && !words) return false
    if (v.words !== null && v.words !== undefined && !line(v.words, 2000)) return false
    if (!SHA256.test(String(v.sha256))) return false
    if ('shown' in v && v.shown !== null && !(object(v.shown) && JSON.stringify(v.shown).length <= 16000)) return false
    return true
  })
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
  // His typed yes, carried from a session: the engine may write it, only as his words (yesBody holds them verbatim
  // with where, when and the session link), and only a yes; a board press, or taking a yes back, is his alone.
  if (collection === 'picks' && object(body) && body.kind === 'yes') return body.via === 'words' && body.approved === true ? null : 'yes_press_is_his'
  if (combineWriterRefused(collection, body, who)) return 'combine_is_his_tap'
  if (collection === 'edits') return 'edit_is_his_save'
  if (collection === 'comments' && object(body) && 'act' in body) return 'tap_is_his'
  if (collection === 'picks' && object(body) && 'kind' in body) return 'decision_is_his'
  if (collection === 'picks' && object(body) && 'note' in body) return 'pick_note_is_his'
  // His Approve on a publishing day's idea puts it on the publish board (the ideas gate): only he makes it, with or
  // without a note.
  if (collection === 'picks' && object(body) && 'pick' in body) return 'pick_is_his'
  if (collection === 'queue' && object(body) && 'use' in body) return 'press_is_his'
  // "Offer it again" on a "Not offered again" line gives a subject he refused back to the next ideas run: his alone.
  if (collection === 'queue' && object(body) && 'unveto' in body) return 'press_is_his'
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
