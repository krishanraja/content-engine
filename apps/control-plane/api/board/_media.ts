import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CutAnswer, CutPresses } from './_cuts.js'

// The rendered media on a week's board (Control Centre's Publish Board, Ruling, Krish, 2026-11-10: the Control Centre
// board is the real one, and "mock ups and rendered assets are going to actually make up a big part of the screen as
// and when they are available"). Each day of the view lists what its piece has rendered: every cut on its making record
// and that cut's thumbnail. The list carries an opaque id, a kind, the cut and a title, never a path, a link or a key,
// the same rule as the live overlay (_live.ts); GET /api/board/<week>/media/<id> turns one id into a short signed link.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const SHA = /^[a-f0-9]{64}$/

export type MediaKind = 'cut' | 'thumbnail'
export interface MediaItem {
  id: string; kind: MediaKind; cut: string; title: string; at: string | null; seconds?: number; poster?: string
  /** Contract 1.6.0, a cut only (_cuts.ts): his Yes and Not this on this file, and his latest answer on it, or null. */
  presses?: CutPresses
  verdict?: CutAnswer | null
}
/** What only the server keeps: where the file is in the library. */
interface MediaFile { id: string; path: string; sha256: string | null }

const idOf = (path: string, sha: unknown) => (typeof sha === 'string' && SHA.test(sha) ? sha : createHash('sha256').update(`path:${path}`).digest('hex'))
const time = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null)
const CUT_TITLE: Record<string, string> = { long: 'Long cut', short: 'Short cut' }

/** Every rendered file on one piece's making record: the newest asset of each cut first, then its thumbnail. */
function filesOf(piece: Body): Array<MediaItem & { file: MediaFile }> {
  const meta = isObj(piece.meta) ? piece.meta : {}
  const making = isObj(meta.making) ? meta.making : {}
  const assets = (Array.isArray(making.video_assets) ? making.video_assets : []).filter(isObj)
    .filter(a => typeof a.cut === 'string' && typeof a.path === 'string' && a.path)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
  const seen = new Set<string>()
  const out: Array<MediaItem & { file: MediaFile }> = []
  for (const a of assets) {
    const cut = String(a.cut)
    if (seen.has(cut)) continue
    seen.add(cut)
    const path = String(a.path)
    const id = idOf(path, a.sha256)
    const thumb = isObj(a.thumbnail) && typeof a.thumbnail.path === 'string' && a.thumbnail.path ? String(a.thumbnail.path) : null
    const thumbId = thumb ? idOf(thumb, null) : undefined
    out.push({
      id, kind: 'cut', cut, title: CUT_TITLE[cut] || `${cut} cut`, at: time(a.at),
      ...(Number.isFinite(Number(a.seconds)) && Number(a.seconds) > 0 ? { seconds: Math.round(Number(a.seconds)) } : {}),
      ...(thumbId ? { poster: thumbId } : {}),
      file: { id, path, sha256: typeof a.sha256 === 'string' && SHA.test(a.sha256) ? a.sha256 : null },
    })
    if (thumb && thumbId) out.push({ id: thumbId, kind: 'thumbnail', cut, title: `${CUT_TITLE[cut] || cut} thumbnail`, at: time(a.at), file: { id: thumbId, path: thumb, sha256: null } })
  }
  return out
}

/** The media list a day of the view carries: no path, no link. */
export function dayMedia(piece: Body | undefined): MediaItem[] {
  return piece ? filesOf(piece).map(({ file: _file, ...item }) => item) : []
}

/** One cut on a piece's own making record by its media id, with where it is in the library, or null (a thumbnail, or
 *  an id that is not on this piece). */
export function cutOn(piece: Body, id: string): { id: string; cut: string; title: string; path: string; sha256: string | null } | null {
  if (!SHA.test(id)) return null
  const m = filesOf(piece).find(x => x.kind === 'cut' && x.id === id)
  return m ? { id: m.id, cut: m.cut, title: m.title, path: m.file.path, sha256: m.file.sha256 } : null
}

/** The library file behind one media id, looked up only on the given pieces (the week's own). */
export function findMedia(pieces: Body[], id: string): MediaFile | null {
  if (!SHA.test(id)) return null
  for (const p of pieces) for (const m of filesOf(p)) if (m.id === id) return m.file
  return null
}

const LIBRARY = 'makeyourmindup'
const BUCKET = 'content-library'
const TTL = 600

/** A short signed link to one media id of this week, or null when the id is not on this week's pieces or not filed. */
export async function signMedia(db: SupabaseClient, week: string, weekEnd: string, id: string): Promise<string | null> {
  const read = await db.from('content_ideas').select('id, scheduled_for, meta').gte('scheduled_for', week).lte('scheduled_for', weekEnd)
  if (read.error) throw new Error('board_store_unavailable')
  const file = findMedia((read.data || []) as Body[], id)
  if (!file) return null
  let q = db.from('content_library_files').select('object_key, sha256').eq('library', LIBRARY).eq('path', file.path).eq('state', 'ready')
  if (file.sha256) q = q.eq('sha256', file.sha256)
  const row = await q.order('ready_at', { ascending: false }).limit(1)
  if (row.error) throw new Error('board_store_unavailable')
  const key = row.data?.[0]?.object_key
  if (typeof key !== 'string' || !key) return null
  const signed = await db.storage.from(BUCKET).createSignedUrl(key, TTL)
  return signed.error || !signed.data?.signedUrl ? null : signed.data.signedUrl
}
