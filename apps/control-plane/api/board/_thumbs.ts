import type { SupabaseClient } from '@supabase/supabase-js'
import { patchMeta, StoreError, type StoreDb } from '../_pieceStore.js'
import {
  BOARD_PICK, BOARD_REDRAW, THUMB_CHECKS, THUMB_DRIVE_ID, thumbnailOptionsProblems,
  type MakingThumbFile, type MakingThumbnailOptions, type MakingThumbVerdictOption,
} from '../_thumbOptions.js'
import { canonical, digest } from './_contracts.js'
import { driveFileUrl } from './_drivePosts.js'

// A piece's thumbnail options on the Content board, with his pick (view contract 1.16.0; Ruling, Krish, 2026-11-15,
// approved with the specialists plan: thumbnail options carry a pick press on the Content board; docs/PUBLISH_BOARDS.md,
// "Thumbnail options and his pick").
//
// - The view: a day whose piece holds a set the critic judged, and not every option blocks
//   (meta.making.thumbnail_options, _thumbOptions.ts), carries it as `thumbs`: each option's id, its wide and tall files
//   as same-site Drive file paths (GET /api/board/<Monday>/drive/<id>, the review copies a session filed in his Drive,
//   thumb_options.py drive), each file's sha256, the critic's one line on it, and the grid mock. A set whose review
//   copies are not all in Drive yet is carried as not_in_drive, with no press: he cannot pick what he cannot see.
// - His presses, while the set waits on him: Pick on each option the critic did not hold, and Not this on the set (draw
//   them again, with his words if he gives any). Each is POST /api/board/<Monday>/thumb-pick with
//   { piece_id, set_sha256, verdict: pick | not_this, option?, words? }, his login only, a piece scheduled in that week.
// - The write: his pick lands on the making record (thumbnail_options.pick) bound to the set's hash and that option's
//   files, as his own decision ("picked on the board", the option, his press time), never as words he did not type. A
//   Not this lands as thumbnail_options.redraw. A press on a set that is no longer the one on the record is refused with
//   the making route's own 409 (thumbnail_options_unbound). The same answer twice is kept once; a different answer
//   after one is refused (409 thumbnails_answered): a session records a change of mind in his words.
// - Then the done check looks: the engine asks Control Centre's sweep to look at the piece's open items now
//   (_controlCenter.ts askChecksForPiece), and its piece_step check closes the session's ask (thumbs-<set>, closes_on
//   video) once his answer to that set is on the record. Never a cron of its own.
// - A Not this with his words also goes to his taste ledger and the rejection inbox, once each, never blocking (the path a
//   Not this on a cut takes, _cuts.ts).
// - making.py video then accepts the picked option's files as before (option_pick_problem reads pick.option and its
//   files). Nothing here files, posts or sends the thumbnail.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const SHA = /^[a-f0-9]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const OPTION = /^[abc]$/
/** The op his press posts to: POST /api/board/<Monday>/thumb-pick. */
export const THUMB_OP = 'thumb-pick'
/** The most of his words a Not this keeps. */
export const THUMB_WORDS_MAX = 2000

export interface ThumbDrive { file_id: string; url: string }
/** A press, in the shape of the view's press actions: POST /api/board/<Monday>/<op> with the body. */
export interface ThumbPress {
  kind: 'press'; label: string; op: typeof THUMB_OP; body: Body
  words?: { path: string; ask: string; required: boolean }
  choose?: { path: string; ask: string; multi: boolean; required: boolean; options: Array<{ value: string; label: string }> }
  stamp: string[]; done: string
}
export interface ThumbFileView { shape: 'wide' | 'tall'; src: string | null; drive: ThumbDrive | null; sha256: string }
export interface ThumbOptionView {
  id: string; note: string; files: ThumbFileView[]
  /** The critic's one line on this option, whether it holds it back, and whether it is the critic's pick. */
  critic: { line: string; blocking: boolean; best: boolean }
  /** His Pick, while the set waits on him and the critic does not hold this option; else null. */
  press: ThumbPress | null
}
export type ThumbState = 'awaits_pick' | 'not_in_drive' | 'picked' | 'redraw'
export interface DayThumbs {
  set_sha256: string
  headline: string
  state: ThumbState
  /** Where the set is, in his words. */
  line: string
  options: ThumbOptionView[]
  grid_mock: { src: string | null; drive: ThumbDrive | null; note: string; past_read: number }
  critic: { reviewer: string; best: string | null }
  /** His answer to this set, or null while it waits on him. */
  answer: { said: 'picked' | 'not_this'; option: string | null; how: string; words: string | null; at: string } | null
  /** Not this on the whole set, while it waits on him; else null. */
  not_this: ThumbPress | null
}

const drive = (id: string | undefined): ThumbDrive | null => (id && THUMB_DRIVE_ID.test(id) ? { file_id: id, url: driveFileUrl(id) } : null)
const src = (week: string, id: string | undefined) => (id && THUMB_DRIVE_ID.test(id) ? `/api/board/${week}/drive/${id}` : null)
const sentence = (s: string) => { const t = s.trim().replace(/\s+/g, ' '); return t ? `${t[0].toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? '' : '.'}` : '' }
/** A finding as recorded ("fix: readable_at_grid: the words are small"), as he reads it ("The words are small."). */
const findingWords = (f: string) => sentence(f.replace(/^(block|fix|note):\s*[a-z_]+:\s*/i, ''))

/** The critic's one line on an option: held, with its reason; or how many of the seven checks pass, and its first note. */
export function criticLine(v: MakingThumbVerdictOption | undefined): string {
  if (!v) return 'Not judged.'
  const passed = THUMB_CHECKS.filter(k => v.checks[k] === 'pass').length
  const lead = v.blocking ? v.findings.find(f => /^block:/i.test(f)) ?? v.findings[0] : v.findings.find(f => /^fix:/i.test(f)) ?? v.findings[0]
  const why = lead ? findingWords(lead) : ''
  if (v.blocking) return `Held by the critic. ${why || 'It falls below the bar.'}`.slice(0, 240)
  if (passed === THUMB_CHECKS.length && !why) return `Passes all ${THUMB_CHECKS.length} checks.`
  return `Passes ${passed} of ${THUMB_CHECKS.length} checks.${why ? ` ${why}` : ''}`.slice(0, 240)
}

/** The set on a piece's making record, read safely, or null. */
export function thumbsOf(piece: Body | undefined): MakingThumbnailOptions | null {
  const meta = piece && isObj(piece.meta) ? piece.meta : {}
  const making = isObj(meta.making) ? meta.making : {}
  const t = making.thumbnail_options
  return isObj(t) && typeof t.set_sha256 === 'string' && SHA.test(t.set_sha256) && Array.isArray(t.options) && t.options.length >= 2
    ? t as unknown as MakingThumbnailOptions : null
}

const IDS = (o: { id: string }) => o.id.toUpperCase()

/** The day's thumbnail options, or null: only a set the critic judged and does not hold back whole (the skill never puts
 *  options below the bar to him). */
export function dayThumbs(week: string, piece: Body | undefined): DayThumbs | null {
  const t = thumbsOf(piece)
  const id = piece && typeof piece.id === 'string' && UUID.test(piece.id) ? piece.id.toLowerCase() : null
  if (!t || !id || !isObj(t.verdict) || t.verdict.blocking) return null
  const verdict = t.verdict
  const inDrive = t.options.every(o => o.files.every(f => drive(f.drive_id))) && Boolean(drive(t.grid_mock?.drive_id))
  const pick = isObj(t.pick) ? t.pick : null
  const redraw = isObj(t.redraw) ? t.redraw : null
  const state: ThumbState = pick ? 'picked' : redraw ? 'redraw' : inDrive ? 'awaits_pick' : 'not_in_drive'
  const open = state === 'awaits_pick'
  const body = (extra: Body) => ({ piece_id: id, set_sha256: t.set_sha256, ...extra })
  const options: ThumbOptionView[] = t.options.map(o => {
    const v = verdict.options.find(x => x.id === o.id)
    const blocking = v?.blocking === true
    return {
      id: o.id, note: o.note,
      files: (['tall', 'wide'] as const).map(shape => {
        const f = o.files.find(x => x.shape === shape) as MakingThumbFile
        return { shape, src: src(week, f?.drive_id), drive: drive(f?.drive_id), sha256: f?.sha256 ?? '' }
      }),
      critic: { line: criticLine(v), blocking, best: verdict.best === o.id },
      press: open && !blocking ? { kind: 'press', label: 'Pick', op: THUMB_OP, body: body({ verdict: 'pick', option: o.id }), stamp: [],
        done: `Picked. Option ${IDS(o)} is the thumbnail; it goes out with the cuts.` } : null,
    }
  })
  const names = t.options.map(IDS)
  const line = state === 'picked' ? `You picked option ${pick!.option.toUpperCase()}${pick!.decision === BOARD_PICK ? ' on the board' : ''}. A session files it with the cuts.`
    : state === 'redraw' ? 'You said Not this to all of them. A session draws a new set.'
      : state === 'not_in_drive' ? 'The options are not in Drive yet, so the board cannot show them. A session files their review copies (thumb_options.py drive).'
        : `${names.length} options, each in a mock of your grid${verdict.best ? `. The critic's pick is ${verdict.best.toUpperCase()}` : ''}. Pick one, or say Not this to have them drawn again.`
  return {
    set_sha256: t.set_sha256, headline: t.headline, state, line, options,
    grid_mock: { src: src(week, t.grid_mock?.drive_id), drive: drive(t.grid_mock?.drive_id), note: t.grid_mock?.note ?? '', past_read: Number(t.grid_mock?.past_read) || 0 },
    critic: { reviewer: verdict.reviewer, best: verdict.best },
    answer: pick ? { said: 'picked', option: pick.option, how: pick.decision ?? 'picked in a session, in his words', words: pick.krish_words ?? null, at: pick.at }
      : redraw ? { said: 'not_this', option: null, how: redraw.decision, words: redraw.words, at: redraw.at } : null,
    not_this: open ? { kind: 'press', label: 'Not this', op: THUMB_OP, body: body({ verdict: 'not_this' }),
      words: { path: 'words', ask: 'What should the new ones do differently? (optional)', required: false }, stamp: [],
      done: 'Noted. A session draws a new set of options.' } : null,
  }
}

/** The one press the week model leads a piece's card with while its set waits on him: Pick the thumbnail, the options
 *  the critic did not hold to choose from, its pick first and marked. Null when nothing waits. */
export function thumbsPress(t: DayThumbs | null): ThumbPress | null {
  if (!t || t.state !== 'awaits_pick') return null
  const pickable = t.options.filter(o => o.press).sort((a, b) => Number(b.critic.best) - Number(a.critic.best))
  if (!pickable.length) return null
  const { option: _chosen, ...body } = pickable[0].press!.body
  return {
    kind: 'press', label: 'Pick the thumbnail', op: THUMB_OP, body,
    choose: { path: 'option', ask: 'Which thumbnail?', multi: false, required: true,
      options: pickable.map(o => ({ value: o.id, label: `Option ${IDS(o)}${o.critic.best ? " (the critic's pick)" : ''}` })) },
    stamp: [], done: 'Picked. A session files it with the cuts.',
  }
}

// ---- His press ------------------------------------------------------------------------------------------------------

export class ThumbError extends Error { constructor(public status: number, message: string, public problems: string[] = []) { super(message) } }
export interface ThumbPick { set_sha256: string; verdict: 'pick' | 'not_this'; option: string | null; words: string | null }

/** His press, checked: the set he saw, and Pick with an option, or Not this with his words if he gave any. */
export function thumbPick(body: Body): ThumbPick {
  const set = typeof body.set_sha256 === 'string' ? body.set_sha256.toLowerCase() : ''
  if (!SHA.test(set)) throw new ThumbError(400, 'invalid_set')
  if (body.verdict !== 'pick' && body.verdict !== 'not_this') throw new ThumbError(400, 'invalid_verdict')
  if (body.verdict === 'pick') {
    const option = typeof body.option === 'string' ? body.option.toLowerCase() : ''
    if (!OPTION.test(option)) throw new ThumbError(400, 'invalid_option')
    return { set_sha256: set, verdict: 'pick', option, words: null }
  }
  const words = typeof body.words === 'string' && body.words.trim() ? body.words.trim().slice(0, THUMB_WORDS_MAX) : null
  return { set_sha256: set, verdict: 'not_this', option: null, words }
}

/** The making record after his press, or why it is refused. The same answer again changes nothing (already). */
export function nextThumbs(making: Body, pick: ThumbPick, at: string): { making: Body; already: boolean; answer: DayThumbs['answer'] } {
  const prev = isObj(making.thumbnail_options) ? making.thumbnail_options as unknown as MakingThumbnailOptions : null
  if (pick.verdict === 'pick') {
    const on = prev && prev.set_sha256 === pick.set_sha256 ? prev.options.find(o => o.id === pick.option) : undefined
    const unbound = thumbnailOptionsProblems(prev, { set_sha256: pick.set_sha256, pick: { option: pick.option!, files: on?.files ?? [], decision: BOARD_PICK } })
    if (unbound.length) throw new ThumbError(409, 'thumbnail_options_unbound', unbound)
    if (prev!.verdict?.options.find(o => o.id === pick.option)?.blocking) throw new ThumbError(409, 'option_held_by_critic')
  } else if (!prev || prev.set_sha256 !== pick.set_sha256 || !Array.isArray(prev.options)) {
    throw new ThumbError(409, 'thumbnail_options_unbound', [`thumbnail_options: the record holds no set ${pick.set_sha256.slice(0, 12)} to answer`])
  } else if (!prev.verdict) {
    throw new ThumbError(409, 'thumbnail_options_unbound', ['thumbnail_options: the critic has not judged this set: the options go to Krish only after the verdict'])
  }
  const t = prev!
  if (t.pick || t.redraw) {
    const same = pick.verdict === 'pick' ? t.pick?.option === pick.option : Boolean(t.redraw)
    if (!same) throw new ThumbError(409, 'thumbnails_answered')
    const answer = t.pick ? { said: 'picked' as const, option: t.pick.option, how: t.pick.decision ?? 'picked in a session, in his words', words: t.pick.krish_words ?? null, at: t.pick.at }
      : { said: 'not_this' as const, option: null, how: t.redraw!.decision, words: t.redraw!.words, at: t.redraw!.at }
    return { making, already: true, answer }
  }
  const files = pick.verdict === 'pick' ? t.options.find(o => o.id === pick.option)!.files : []
  const next: MakingThumbnailOptions = pick.verdict === 'pick'
    ? { ...t, pick: { option: pick.option!, files, decision: BOARD_PICK, at, by: 'Krish' }, at, by: 'Krish' }
    : { ...t, redraw: { decision: BOARD_REDRAW, words: pick.words, at, by: 'Krish' }, at, by: 'Krish' }
  const answer = pick.verdict === 'pick' ? { said: 'picked' as const, option: pick.option, how: BOARD_PICK, words: null, at }
    : { said: 'not_this' as const, option: null, how: BOARD_REDRAW, words: pick.words, at }
  return { making: { ...making, thumbnail_options: next, updated_at: at, by: 'Krish' }, already: false, answer }
}

/** Record his press on the piece's making record, guarded on the row's updated_at so a write in between is kept. */
export async function saveThumbs(db: SupabaseClient, pieceId: string, pick: ThumbPick, now = new Date()): Promise<{ answer: DayThumbs['answer']; already: boolean; headline: string }> {
  let out: { answer: DayThumbs['answer']; already: boolean; headline: string } | null = null
  let result: Awaited<ReturnType<typeof patchMeta>>
  try {
    result = await patchMeta(db as unknown as StoreDb, pieceId, meta => {
      const making = isObj(meta.making) ? meta.making : {}
      const next = nextThumbs(making, pick, now.toISOString())
      const t = making.thumbnail_options as Body | undefined
      out = { answer: next.answer, already: next.already, headline: typeof t?.headline === 'string' ? t.headline : '' }
      return next.already ? meta : { ...meta, making: next.making }
    })
  } catch (e) {
    if (e instanceof StoreError) throw new ThumbError(e.status, e.message)
    throw e
  }
  if (result.ok === false) throw new ThumbError(result.reason === 'busy' ? 409 : 503, result.reason === 'busy' ? 'piece_busy' : 'board_store_unavailable')
  return out!
}

// ---- What a Not this teaches ------------------------------------------------------------------------------------------

const REPOSITORY = 'krishanraja/content-engine'
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])
export interface ThumbPlace { week: string; date: string; pieceId: string; set: string; headline: string }
export type Filed = 'filed' | 'failed' | 'waits_on_migration'
const dayKey = (date: string) => DAY_KEYS[new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay()] ?? 'week'
const onceKey = (place: ThumbPlace, words: string) => digest(canonical({ piece: place.pieceId, set: place.set, words }))

/** His Not this with words as one taste_reports row: his typed words with where and when (the cut's path, _cuts.ts). */
export function thumbReport(place: ThumbPlace, words: string | null, at: string) {
  if (!words) return null
  const day = dayKey(place.date)
  return {
    kind: 'krish_words', body: words.slice(0, 2000), said_where: `publish board, ${place.week} ${day}, thumbnail options: Not this on the set`, said_at: at,
    lane: 'production', polarity: 'dislikes', subject_ref: `piece:${place.pieceId}`,
    subject: `the thumbnail options "${place.headline}" for the ${day} piece of the week of ${place.week}`.slice(0, 300),
    session_ref: 'Control Centre publish board', repository: REPOSITORY, surface: 'publish_board', emitter_id: 'content-engine-board',
    client_report_id: `thumbs-${onceKey(place, words)}`.slice(0, 96), reported_at: at,
    meta: { press: 'thumbs_not_this', week: place.week, day, set_sha256: place.set },
  }
}

/** His Not this with words as one rejection inbox row, words alone, for the thumbnail floor (--format thumbnail). */
export function thumbInboxRow(place: ThumbPlace, words: string | null, at: string) {
  if (!words) return null
  const day = dayKey(place.date)
  return {
    kind: 'rejected', said: words, said_where: `publish board, ${place.week} ${day}, thumbnail options`, said_at: at, piece: place.pieceId,
    formats: ['thumbnail'],
    // The board's words about what was on screen: context, never his words.
    note: `Not this on the thumbnail options "${place.headline}" (set ${place.set.slice(0, 12)})`.slice(0, 2000),
    master_drive_id: null, at_ms: null, whole_cut: false,
    session_ref: `publish-board:${place.week}:thumb-pick/${place.set.slice(0, 16)}`, repository: REPOSITORY, surface: 'publish_board',
    emitter_id: 'content-engine/publish-board', client_report_id: `thumbs-${onceKey(place, words).slice(0, 40)}`,
    meta: { board: { week: place.week, op: THUMB_OP, day }, set_sha256: place.set },
  }
}

/** Files what a Not this with words teaches (his taste ledger, the rejection inbox), each once and never blocking. */
export async function fileThumbLearning(db: SupabaseClient, place: ThumbPlace, words: string | null, at: string): Promise<{ taste: Filed; inbox: Filed } | null> {
  const report = thumbReport(place, words, at), row = thumbInboxRow(place, words, at)
  if (!report || !row) return null
  const upsert = async (table: string, value: Record<string, unknown>): Promise<Filed> => {
    try {
      const filed = await db.from(table).upsert(value, { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true })
      const code = String((filed.error as { code?: string } | null)?.code || '')
      return !filed.error ? 'filed' : MISSING_TABLE.has(code) ? 'waits_on_migration' : 'failed'
    } catch {
      return 'failed'
    }
  }
  return { taste: await upsert('taste_reports', report), inbox: await upsert('taste_rejection_inbox', row) }
}

// ---- The files the drive route serves ----------------------------------------------------------------------------------

/** Every Drive id a day of these pieces shows for its thumbnail options (each option's two files and the grid mock): the
 *  only ids, beside the week's posts, that GET /api/board/<Monday>/drive/<id> serves for them. */
export function thumbDriveIds(pieces: Body[]): Set<string> {
  const out = new Set<string>()
  for (const p of pieces) {
    const t = thumbsOf(p)
    if (!t || !isObj(t.verdict) || t.verdict.blocking) continue
    for (const o of t.options) for (const f of o.files) if (f.drive_id && THUMB_DRIVE_ID.test(f.drive_id)) out.add(f.drive_id)
    if (t.grid_mock?.drive_id && THUMB_DRIVE_ID.test(t.grid_mock.drive_id)) out.add(t.grid_mock.drive_id)
  }
  return out
}
