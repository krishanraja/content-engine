import type { SupabaseClient } from '@supabase/supabase-js'
import { patchMeta, StoreError, type StoreDb } from '../_pieceStore.js'
import { recordIncident, type Incident } from '../_incidents.js'
import { canonical, digest } from './_contracts.js'
import { cutOn, dayMedia, type MediaItem } from './_media.js'

// His answer on each rendered cut (view contract 1.6.0; docs/PUBLISH_BOARDS.md, "His answer on each cut"). The approved
// mock M5 gives every cut in the Cuts tab its own Yes, Not this, Change it and Add a note; Change it and Add a note are
// his words on the day ("Add your thoughts"), and Yes and Not this are this press, one per cut.
//
// - Yes: this cut is right. Not this: with his words, which are required.
// - His press is POST /api/board/<Monday>/cut-verdict with { piece_id, media_id, verdict, words? }: his press only, on
//   a piece scheduled in that week, on a cut that is on that piece's own making record (the media id the view gave).
// - It is kept append only on the piece, in content_ideas.meta.cut_verdicts, one entry per press with the cut, the
//   file's sha256 and library path, his words, by and at; nothing is ever rewritten or removed. The same answer pressed
//   twice in a row on one file is kept once. The write is guarded on the row's updated_at (patchMeta), so a write that
//   lands in between is kept, and the content_ideas trigger bumps the week's board_signal.
// - It never changes the cut, never files it, never publishes, and unlocks nothing: it is not the Approve cut gate
//   (meta.making.gates.final). A new render is a new file with a new media id, so an answer stays with the file he saw.
// - The view gives each cut the two presses and his latest answer on that file (`verdict`), or null.
// - A Not this is learned from the way his other rejections on the board are (fileCutLearning): his words go to his
//   taste ledger as his own (taste_reports, krish_words, the path a Reject of the proof takes), to the rejection inbox
//   the rejection floor is compiled from (taste_rejection_inbox, the path a Reject asset takes), and to the failure loop
//   (engine_incidents, krish_reject at the cut stage). Each once: the same words on the same file file nothing twice.
//   Never blocking: a write that fails is said in the answer and the press stands. A Yes files nothing: it is his
//   press, never words.
// - A session making the next cut reads them on the piece's record: GET /api/content-ideas/<id>/making answers with
//   them (cut_verdicts), and `making.py <piece> show` prints each Not this in his words (make-piece, produce-video).

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const SHA = /^[a-f0-9]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** The most of his words one press keeps. */
export const WORDS_MAX = 4000
/** The op his press posts to: POST /api/board/<Monday>/cut-verdict. Never "cut", which is the read-only view of his
 *  Approve cut documents (GET /api/board/<Monday>/cut). */
export const CUT_OP = 'cut-verdict'

export type CutSaid = 'yes' | 'not_this'
/** One press, as kept on the piece. */
export interface CutVerdict { media_id: string; cut: string; verdict: CutSaid; words: string | null; sha256: string | null; path: string; by: 'Krish'; at: string }
/** What the view says of his latest press on a file. */
export interface CutAnswer { said: CutSaid; words: string | null; at: string }
/** A press on a cut, in the shape of the view's press actions: POST /api/board/<Monday>/<op> with the body. */
export interface CutPress {
  kind: 'press'
  label: string
  op: typeof CUT_OP
  body: Body
  words?: { path: string; ask: string; required: boolean }
  stamp: string[]
  done: string
}
export interface CutPresses { yes: CutPress; not_this: CutPress }

/** Every press kept on the piece, oldest first, read safely (an entry that is not one is skipped, never removed). */
export function cutVerdicts(meta: unknown): CutVerdict[] {
  const list = isObj(meta) && Array.isArray(meta.cut_verdicts) ? meta.cut_verdicts : []
  return list.filter(isObj).filter(v => typeof v.media_id === 'string' && SHA.test(v.media_id) && (v.verdict === 'yes' || v.verdict === 'not_this')
    && typeof v.at === 'string' && Number.isFinite(Date.parse(v.at)))
    .map(v => ({ media_id: String(v.media_id), cut: typeof v.cut === 'string' ? v.cut : '', verdict: v.verdict as CutSaid,
      words: typeof v.words === 'string' && v.words.trim() ? v.words : null, sha256: typeof v.sha256 === 'string' && SHA.test(v.sha256) ? v.sha256 : null,
      path: typeof v.path === 'string' ? v.path : '', by: 'Krish' as const, at: String(v.at) }))
}

/** His latest answer on one file, or null. */
export function answerOn(meta: unknown, mediaId: string): CutAnswer | null {
  const mine = cutVerdicts(meta).filter(v => v.media_id === mediaId)
  const last = mine[mine.length - 1]
  return last ? { said: last.verdict, words: last.words, at: last.at } : null
}

/** The two presses on one cut. */
export function cutPresses(pieceId: string, item: Pick<MediaItem, 'id' | 'title'>): CutPresses {
  const body = (verdict: CutSaid) => ({ piece_id: pieceId, media_id: item.id, verdict })
  return {
    yes: { kind: 'press', label: 'Yes', op: CUT_OP, body: body('yes'), stamp: [], done: 'Saved on the piece: this cut is right.' },
    not_this: { kind: 'press', label: 'Not this', op: CUT_OP, body: body('not_this'),
      words: { path: 'words', ask: `What is not right about the ${item.title.toLowerCase()}?`, required: true }, stamp: [],
      done: 'Saved on the piece with your words. The cut itself is unchanged.' },
  }
}

/** A day's media (_media.ts) with each cut's presses and his latest answer on it. Thumbnails carry neither. */
export function mediaWithAnswers(piece: Body | undefined): MediaItem[] {
  const items = dayMedia(piece)
  const id = piece && typeof piece.id === 'string' && UUID.test(piece.id) ? piece.id.toLowerCase() : null
  if (!piece || !id) return items
  return items.map(m => (m.kind === 'cut' ? { ...m, presses: cutPresses(id, m), verdict: answerOn(piece.meta, m.id) } : m))
}

export class CutError extends Error { constructor(public status: number, message: string) { super(message) } }
export interface CutPick { media_id: string; verdict: CutSaid; words: string | null }

/** His press, checked: a media id, Yes or Not this, and his words on a Not this. */
export function cutPick(body: Body): CutPick {
  const mediaId = typeof body.media_id === 'string' ? body.media_id.toLowerCase() : ''
  if (!SHA.test(mediaId)) throw new CutError(400, 'invalid_media')
  if (body.verdict !== 'yes' && body.verdict !== 'not_this') throw new CutError(400, 'invalid_verdict')
  const words = typeof body.words === 'string' && body.words.trim() ? body.words.trim().slice(0, WORDS_MAX) : null
  if (body.verdict === 'not_this' && !words) throw new CutError(400, 'words_required')
  return { media_id: mediaId, verdict: body.verdict, words: body.verdict === 'yes' ? null : words }
}

/** The piece's presses after one more: appended, never rewritten; the same answer twice in a row on a file is kept once.
 *  Refused when the media id is not a cut on this piece's own making record. */
export function nextVerdicts(meta: Body, pick: CutPick, at: string): { list: unknown[]; entry: CutVerdict; already: boolean } {
  const file = cutOn({ meta }, pick.media_id)
  if (!file) throw new CutError(404, 'media_not_found')
  const list = Array.isArray(meta.cut_verdicts) ? meta.cut_verdicts : []
  const last = answerOn(meta, pick.media_id)
  if (last && last.said === pick.verdict && last.words === pick.words) {
    const kept = cutVerdicts(meta).filter(v => v.media_id === pick.media_id).pop()!
    return { list, entry: kept, already: true }
  }
  const entry: CutVerdict = { media_id: file.id, cut: file.cut, verdict: pick.verdict, words: pick.words, sha256: file.sha256, path: file.path, by: 'Krish', at }
  return { list: [...list, entry], entry, already: false }
}

/** Record his press on the piece (meta.cut_verdicts), guarded on the row's updated_at so a write in between is kept. */
export async function saveCut(db: SupabaseClient, pieceId: string, pick: CutPick, now = new Date()): Promise<{ verdict: CutVerdict; already: boolean }> {
  let out: { verdict: CutVerdict; already: boolean } | null = null
  let result: Awaited<ReturnType<typeof patchMeta>>
  try {
    result = await patchMeta(db as unknown as StoreDb, pieceId, meta => {
      const next = nextVerdicts(meta, pick, now.toISOString())
      out = { verdict: next.entry, already: next.already }
      return next.already ? meta : { ...meta, cut_verdicts: next.list }
    })
  } catch (e) {
    if (e instanceof StoreError) throw new CutError(e.status, e.message)
    throw e
  }
  if (result.ok === false) throw new CutError(result.reason === 'busy' ? 409 : 503, result.reason === 'busy' ? 'piece_busy' : 'board_store_unavailable')
  return out!
}

// ---- What a Not this teaches -----------------------------------------------------------------------------------------

const REPOSITORY = 'krishanraja/content-engine'
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
/** The rejection engine's formats for a cut (inspirationhouse src/rejection/vocab.ts; week_board.py asset_formats). */
const CUT_FORMATS: Record<string, string> = { long: 'long_video', feature: 'long_video', short: 'short_video' }
const CUT_WORDS: Record<string, string> = { long: 'long cut', short: 'short cut', feature: 'feature cut' }
// The tables made by the migrations: Postgres's and PostgREST's codes for one not made yet.
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])

/** Where his press was made: the week, the piece's day on it, and the piece. */
export interface CutPlace { week: string; date: string; pieceId: string }
export type Filed = 'filed' | 'failed' | 'waits_on_migration'
export interface CutLearning { taste: Filed; inbox: Filed; incident: Filed | 'refused' }

const dayKey = (date: string) => DAY_KEYS[new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay()] ?? 'week'
const cutWords = (cut: string) => CUT_WORDS[cut] || `${cut} cut`
/** The key a Not this is filed once by: the same words on the same file file nothing twice. */
const onceKey = (place: CutPlace, v: CutVerdict) => digest(canonical({ piece: place.pieceId, media: v.media_id, words: v.words }))

/** His Not this as one taste_reports row: his typed words with where and when, never a sentence the engine wrote (the
 *  same row a Reject of the proof files, gateReport in _presses.ts). Null for a Yes or a Not this with no words. */
export function cutReport(place: CutPlace, v: CutVerdict) {
  if (v.verdict !== 'not_this' || !v.words) return null
  const day = dayKey(place.date)
  return {
    kind: 'krish_words', body: v.words.slice(0, 2000), said_where: `publish board, ${place.week} ${day}, Cuts: Not this on the ${cutWords(v.cut)}`, said_at: v.at,
    lane: 'production', polarity: 'dislikes', subject_ref: `piece:${place.pieceId}`,
    subject: `the ${cutWords(v.cut)} for the ${day} piece of the week of ${place.week}`,
    session_ref: 'Control Centre publish board', repository: REPOSITORY, surface: 'publish_board',
    emitter_id: 'content-engine-board',
    client_report_id: `cut-${onceKey(place, v)}`.slice(0, 96),
    reported_at: v.at,
    meta: { press: 'cut_not_this', week: place.week, day, cut: v.cut, media_id: v.media_id, sha256: v.sha256, path: v.path },
  }
}

/** His Not this as one rejection inbox row, words alone: the cut is reached by its library path (in meta), never by a
 *  Drive id, so the row carries no master (taste_rejection_inbox_one_shape). Null for a Yes. */
export function cutInboxRow(place: CutPlace, v: CutVerdict) {
  if (v.verdict !== 'not_this' || !v.words) return null
  const day = dayKey(place.date)
  return {
    kind: 'rejected',
    said: v.words,
    said_where: `publish board, ${place.week} ${day}, Cuts`,
    said_at: v.at,
    piece: place.pieceId,
    formats: CUT_FORMATS[v.cut] ? [CUT_FORMATS[v.cut]] : [],
    // The board's words about what was on screen: context, never his words.
    note: `Not this on the ${cutWords(v.cut)}: ${v.path}`.slice(0, 2000),
    master_drive_id: null,
    at_ms: null,
    whole_cut: false,
    session_ref: `publish-board:${place.week}:cut-verdict/${v.media_id.slice(0, 16)}`,
    repository: REPOSITORY,
    surface: 'publish_board',
    emitter_id: 'content-engine/publish-board',
    client_report_id: `cut-${onceKey(place, v).slice(0, 40)}`,
    meta: { board: { week: place.week, op: 'cut-verdict', day }, cut: v.cut, media_id: v.media_id, sha256: v.sha256, path: v.path },
  }
}

/** His Not this as one failure-loop row (engine_incidents, krish_reject at the cut stage). Null for a Yes. */
export function cutIncident(place: CutPlace, v: CutVerdict): Incident | null {
  if (v.verdict !== 'not_this' || !v.words) return null
  return {
    piece_id: place.pieceId, stage: 'cut', kind: 'krish_reject', maker: 'unknown', his_words: v.words.slice(0, 2000),
    session_ref: `publish-board:${place.week}:cut-verdict`, artifact_sha256: v.sha256, artifact_ref: `library:${v.path}`.slice(0, 500),
    meta: { week: place.week, day: dayKey(place.date), press: 'cut_not_this', cut: v.cut, media_id: v.media_id },
    client_ref: `cut-${onceKey(place, v)}`.slice(0, 120),
  }
}

/** Files what a Not this teaches (his taste ledger, the rejection inbox, the failure loop), each once and never
 *  blocking: what happened to each. Null for a Yes. */
export async function fileCutLearning(db: SupabaseClient, place: CutPlace, v: CutVerdict, now = new Date()): Promise<CutLearning | null> {
  const report = cutReport(place, v), row = cutInboxRow(place, v), incident = cutIncident(place, v)
  if (!report || !row || !incident) return null
  const upsert = async (table: string, value: Record<string, unknown>): Promise<Filed> => {
    try {
      const filed = await db.from(table).upsert(value, { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true })
      const code = String((filed.error as { code?: string } | null)?.code || '')
      return !filed.error ? 'filed' : MISSING_TABLE.has(code) ? 'waits_on_migration' : 'failed'
    } catch {
      return 'failed'
    }
  }
  const taste = await upsert('taste_reports', report)
  const inbox = await upsert('taste_rejection_inbox', row)
  const filed = await recordIncident(db, incident, now.toISOString()).catch(() => 'failed' as const)
  return { taste, inbox, incident: filed }
}
