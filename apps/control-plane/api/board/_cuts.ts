import type { SupabaseClient } from '@supabase/supabase-js'
import { patchMeta, StoreError, type StoreDb } from '../_pieceStore.js'
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
