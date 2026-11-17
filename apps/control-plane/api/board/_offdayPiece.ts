import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { makeRoute } from './_makeRoute.js'

// One record for every off-day post the ve route makes (Krish, 2026-11-17: "at no point does a voiceover short give me
// the same controls as a mon/wed/fri piece in terms of the motion, captions etc etc. why not?"; "well ultimately all this
// feedback applies to all relevant days, i told you i do not want one off fixes but system upgrades").
//
// A voiceover short, a meme video or a good-news short made on the ve route is cut like a piece, so its card offers the
// same look, motion and caption picks (_weekModel.ts postItem, lookPresses). Those picks, his scripts approval, the making
// record, the Teleprompter send and every session's reports attach to one engine record (content_ideas), whose id is:
// - the piece id its option already names (a piece he records, Tue 17's habits voiceover, 701a2c55), or
// - one derived from the week and the option's document, the same on every read (offdayPieceId).
// The record is made by his Approve on the option (syncApprove) or, for one approved before this, by his first pick
// (linkOffdayPiece, from the look and style presses). It is linked to its week in meta.offday_link and left unscheduled,
// so it never shows as a second card on the day: placeOffday alone puts a piece he records on its day.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const OFFDAY_DOC = /^off-(mon|tue|wed|thu|fri|sat|sun)-([a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59})$/

/** Whether an off-day post is cut on the ve route, and so gets a piece's production picks. */
export function videoOffday(kind: string | null | undefined, format: string | null | undefined): boolean {
  return makeRoute(kind, format) === 'motion'
}

/** The engine record id of an off-day post: the piece id its option names, else one derived from the week and its
 *  document (a version 4 shaped UUID from a sha256), the same on every read. */
export function offdayPieceId(week: string, docId: string, raw: Body | null | undefined): string {
  const named = typeof raw?.piece_id === 'string' && UUID.test(raw.piece_id) ? raw.piece_id.toLowerCase() : null
  if (named) return named
  const h = createHash('sha256').update(`offday-piece:${week}:${docId}`).digest('hex')
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** Whether a record belongs to this week: scheduled inside it, or linked to it as an off-day post (meta.offday_link). */
export function inWeek(row: { scheduled_for?: unknown; meta?: unknown } | null | undefined, week: string): boolean {
  if (!row) return false
  const end = new Date(`${week}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 6)
  const on = typeof row.scheduled_for === 'string' ? row.scheduled_for : null
  if (on && on >= week && on <= end.toISOString().slice(0, 10)) return true
  const link = isObj(row.meta) && isObj(row.meta.offday_link) ? row.meta.offday_link : null
  return Boolean(link && link.week === week)
}

export interface OffdayLink { week: string; day: string; item: string; title: string; so_what?: string | null }

/** Makes the record of an off-day video post if it has none, and links it to its week and option. Seeded, as every idea
 *  row starts, with the option's own words; never scheduled here. True when the record exists and is linked. */
export async function linkOffdayPiece(db: SupabaseClient, pieceId: string, link: OffdayLink, now: string): Promise<boolean> {
  if (!UUID.test(pieceId) || !OFFDAY_DOC.test(link.item)) return false
  const text = (v: unknown, cap: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, cap) : null)
  const idea = text(link.title, 500)
  if (!idea) return false
  const read = await db.from('content_ideas').select('id, meta, updated_at').eq('id', pieceId).maybeSingle()
  if (read.error) return false
  const offday_link = { week: link.week, day: link.day, item: link.item, linked_at: now }
  if (!read.data) {
    const made = await db.from('content_ideas').insert({
      id: pieceId, idea, thesis: text(link.so_what, 2000), source_type: 'week_research', source_snippet: text(link.so_what, 280) ?? idea.slice(0, 280),
      source_captured_at: now, state: 'seeded', origin: 'agent', distribution: [], confidence: 0, meta: { offday_link },
    }).select('id')
    if (!made.error) return true
    if (!/duplicate key/i.test(String(made.error.message || ''))) return false
    return linkOffdayPiece(db, pieceId, link, now)
  }
  const row = read.data as { meta?: unknown; updated_at?: string }
  const meta = isObj(row.meta) ? row.meta : {}
  if (isObj(meta.offday_link) && meta.offday_link.item === link.item && meta.offday_link.week === link.week) return true
  const written = await db.from('content_ideas').update({ meta: { ...meta, offday_link }, updated_at: now }).eq('id', pieceId).eq('updated_at', row.updated_at ?? '').select('id')
  return !written.error && Boolean(written.data?.length)
}
