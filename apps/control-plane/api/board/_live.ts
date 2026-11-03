import type { SupabaseClient } from '@supabase/supabase-js'
import { dayDate, piecesByDay, type PostedDay } from './_posted.js'
import { MAKING_CHANNELS, SCRIPT_SHA256, makingSteps, pieceVerdict, teleprompterStates, type Making, type MakingCut, type MakingStepState, type TeleprompterState } from '../_making.js'

// The board's live overlay (Ruling, Krish, 2026-11-03: "The Publish Board should just be makeyourmindup weekly content
// calendar, always up to date"). The board page is an immutable snapshot of its build; on every poll it reads
// GET /api/board?week=..&op=state, and this is the part of that answer that comes from the pieces' making records: for
// each day of the week that has a piece (the same day-to-piece rule Growth reads, piecesByDay), the piece's making
// steps, its verdict, where its scripts are in Teleprompter, which cuts and thumbnails are on the record, the channels
// it was posted to, and the hash of each cut's checked words. The page redraws its step notes from it and compares
// the hashes with the ones it was built with; it never replaces a word or a file it shows (his presses bind the hash
// of the words he saw, _presses.ts). Nothing here carries an address, a link, a path, a secret or a transcript.
//
// rebuild_needed is true when any piece of the week was written (its row or its making record) after the live build
// was made, so the page can say a rebuild would show more than the overlay can.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const NOTE_MAX = 200
// A step note that can name a folder or a path is left out: the pack's note is its Drive folder.
const NO_NOTE = new Set(['pack'])

export interface LiveStep { key: string; state: MakingStepState; note?: string }
export interface LiveCut { cut: MakingCut; thumbnail: boolean }
export interface LiveDay {
  piece_id: string
  date: string
  steps: LiveStep[]
  verdict: 'done' | 'moot' | null
  teleprompter: Partial<Record<MakingCut, TeleprompterState>>
  cuts: LiveCut[]
  posted: string[]
  script_hashes: Partial<Record<MakingCut, string>>
  written_at: string | null
}
export interface WeekLive { live: Partial<Record<PostedDay, LiveDay>>; rebuild_needed: boolean }

const time = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null)
const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b)

/** One day's live block from its piece's row. */
export function liveDay(piece: Body, date: string): LiveDay {
  const meta = isObj(piece.meta) ? piece.meta : {}
  const m = (isObj(meta.making) ? meta.making : {}) as Partial<Making>
  const row = { id: String(piece.id), state: piece.state as string | null, body: piece.body as string | null, meta }
  const steps = makingSteps(row)
  const cuts = new Map<MakingCut, boolean>()
  for (const a of Array.isArray(m.video_assets) ? m.video_assets : []) {
    if (!isObj(a) || typeof a.cut !== 'string') continue
    cuts.set(a.cut as MakingCut, cuts.get(a.cut as MakingCut) || Boolean(isObj(a.thumbnail) && a.thumbnail.path))
  }
  const hashes: Partial<Record<MakingCut, string>> = {}
  const held = isObj(m.script_check) && isObj(m.script_check.hashes) ? m.script_check.hashes : {}
  for (const [cut, sha] of Object.entries(held)) if (typeof sha === 'string' && SCRIPT_SHA256.test(sha)) hashes[cut as MakingCut] = sha
  return {
    piece_id: String(piece.id).toLowerCase(),
    date,
    steps: steps.map(s => ({ key: s.key, state: s.state, ...(s.note && !NO_NOTE.has(s.key) ? { note: s.note.slice(0, NOTE_MAX) } : {}) })),
    verdict: pieceVerdict({ id: String(piece.id), state: piece.state as string | null, buried_at: piece.buried_at as string | null, meta }, 'published', steps),
    teleprompter: teleprompterStates(m),
    cuts: [...cuts].map(([cut, thumbnail]) => ({ cut, thumbnail })).sort((a, b) => a.cut.localeCompare(b.cut)),
    posted: MAKING_CHANNELS.filter(c => isObj(m.channels) && m.channels[c]),
    script_hashes: hashes,
    written_at: later(time(piece.updated_at), time(m.updated_at)),
  }
}

/** The week's live blocks, from one read of the week's pieces, and whether any was written after builtAt. */
export async function weekLive(db: SupabaseClient, week: string, builtAt: string | null): Promise<WeekLive> {
  const read = await db.from('content_ideas').select('id, scheduled_for, lane_slot, state, buried_at, body, meta, updated_at')
    .gte('scheduled_for', week).lte('scheduled_for', dayDate(week, 'sun'))
  if (read.error) throw new Error('board_store_unavailable')
  const live: Partial<Record<PostedDay, LiveDay>> = {}
  let rebuild = false
  for (const { day, date, piece } of piecesByDay(week, (read.data || []) as Body[])) {
    const entry = liveDay(piece, date)
    live[day] = entry
    if (builtAt && entry.written_at && Date.parse(entry.written_at) > Date.parse(builtAt)) rebuild = true
  }
  return { live, rebuild_needed: rebuild }
}
