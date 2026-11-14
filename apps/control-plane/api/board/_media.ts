import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CutAnswer, CutPresses } from './_cuts.js'
import { driveFileUrl, driveIdOf } from './_drivePosts.js'

// The rendered media on a week's board (Control Centre's Publish Board, Ruling, Krish, 2026-11-10: the Control Centre
// board is the real one, and "mock ups and rendered assets are going to actually make up a big part of the screen as
// and when they are available"). Each day of the view lists what its piece has rendered: every cut on its making record
// and that cut's thumbnail. The list carries an opaque id, a kind, the cut and a title, never a library path, a store
// link or a key, the same rule as the live overlay (_live.ts); GET /api/board/<week>/media/<id> turns one id into a short
// signed link.
//
// Contract 1.7.0 (Ruling, Krish, 2026-11-12: every cut on the board carries its Google Drive link): each item carries
// the Drive link of that exact file, from the making record (`url`, the file's own Drive link, which making.py's
// drive-link and video record by its Drive file id), or null with why ("Not in Drive yet"). And a cut the library has no
// copy of still plays: the media route copies it from Drive by that id (_drivePosts.ts servedDrive). Friday 13 Nov's
// cuts were in Drive but never sent to the library, and their record named them relative to the post's folder
// ("3 Video/fri13-5min-v3.mp4"), so the route answered 404 and the board drew an empty player.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const SHA = /^[a-f0-9]{64}$/

export type MediaKind = 'cut' | 'thumbnail'
/** The exact file in Krish's Drive, by its Drive file id. */
export interface DriveLink { file_id: string; url: string }
export interface MediaItem {
  id: string; kind: MediaKind; cut: string; title: string; at: string | null; seconds?: number; poster?: string
  /** Contract 1.7.0: the file in Drive, or null when the making record has none (then drive_why says why). */
  drive: DriveLink | null
  drive_why?: string
  /** Contract 1.6.0, a cut only (_cuts.ts): his Yes and Not this on this file, and his latest answer on it, or null. */
  presses?: CutPresses
  verdict?: CutAnswer | null
}
/** What only the server keeps: where the file is in the library, the post folder its record is relative to, and its
 *  Drive file id. */
interface MediaFile { id: string; path: string; sha256: string | null; folder: string | null; drive_id: string | null }

const idOf = (path: string, sha: unknown) => (typeof sha === 'string' && SHA.test(sha) ? sha : createHash('sha256').update(`path:${path}`).digest('hex'))
const time = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null)
const CUT_TITLE: Record<string, string> = { long: 'Long cut', short: 'Short cut' }
/** Why a file has no Drive link, in his words. */
export const NO_DRIVE_LINK = 'Not in Drive yet: the making record has no Drive link for this file. A session records it with making.py PIECE drive-link.'
const driveOf = (id: string | null): Pick<MediaItem, 'drive' | 'drive_why'> => (id ? { drive: { file_id: id, url: driveFileUrl(id) } } : { drive: null, drive_why: NO_DRIVE_LINK })

/** Every rendered file on one piece's making record: the newest asset of each cut first, then its thumbnail. */
function filesOf(piece: Body): Array<MediaItem & { file: MediaFile }> {
  const meta = isObj(piece.meta) ? piece.meta : {}
  const making = isObj(meta.making) ? meta.making : {}
  const pack = isObj(making.pack) && typeof making.pack.folder === 'string' && making.pack.folder.trim() ? making.pack.folder.trim() : null
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
    const driveId = driveIdOf(a.url), thumbDrive = isObj(a.thumbnail) ? driveIdOf(a.thumbnail.url) : null
    out.push({
      id, kind: 'cut', cut, title: CUT_TITLE[cut] || `${cut} cut`, at: time(a.at),
      ...(Number.isFinite(Number(a.seconds)) && Number(a.seconds) > 0 ? { seconds: Math.round(Number(a.seconds)) } : {}),
      ...(thumbId ? { poster: thumbId } : {}),
      ...driveOf(driveId),
      file: { id, path, sha256: typeof a.sha256 === 'string' && SHA.test(a.sha256) ? a.sha256 : null, folder: pack, drive_id: driveId },
    })
    if (thumb && thumbId) out.push({ id: thumbId, kind: 'thumbnail', cut, title: `${CUT_TITLE[cut] || cut} thumbnail`, at: time(a.at), ...driveOf(thumbDrive),
      file: { id: thumbId, path: thumb, sha256: null, folder: pack, drive_id: thumbDrive } })
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
const TOP = /^(1 Brand kit|2 Channel art|3 Posts)\b/

/** Where a recorded path is in the library: as it is, and, for a path written relative to the post's own folder
 *  ("3 Video/fri13-5min-v3.mp4"), inside that folder ("3 Posts/<pack folder>/3 Video/..."). */
export function libraryPaths(file: Pick<MediaFile, 'path' | 'folder'>): string[] {
  const p = file.path.replace(/^\/+/, '')
  return TOP.test(p) || !file.folder ? [p] : [`3 Posts/${file.folder}/${p}`, p]
}

/** A short signed link to one media id of this week, or null when the id is not on this week's pieces, the library has
 *  no copy and the file has no Drive copy the board can serve. `drive` serves a Drive file by its id (_drivePosts.ts). */
export async function signMedia(db: SupabaseClient, week: string, weekEnd: string, id: string,
  drive?: (fileId: string) => Promise<string | null>): Promise<string | null> {
  const read = await db.from('content_ideas').select('id, scheduled_for, meta').gte('scheduled_for', week).lte('scheduled_for', weekEnd)
  if (read.error) throw new Error('board_store_unavailable')
  const file = findMedia((read.data || []) as Body[], id)
  if (!file) return null
  for (const path of libraryPaths(file)) {
    let q = db.from('content_library_files').select('object_key, sha256').eq('library', LIBRARY).eq('path', path).eq('state', 'ready')
    if (file.sha256) q = q.eq('sha256', file.sha256)
    const row = await q.order('ready_at', { ascending: false }).limit(1)
    if (row.error) throw new Error('board_store_unavailable')
    const key = row.data?.[0]?.object_key
    if (typeof key !== 'string' || !key) continue
    const signed = await db.storage.from(BUCKET).createSignedUrl(key, TTL)
    if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl
  }
  // Not in the library: the same file from Drive, by the id on its record.
  return file.drive_id && drive ? drive(file.drive_id) : null
}
