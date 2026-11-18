import { boundPostFolder, mergeMaking, type Making } from './_making.js'
import { LIBRARY_BUCKET, LIBRARY_DEFAULT, LIBRARY_OFF_DAY, LIBRARY_PART_MAX, LIBRARY_PATH_MAX, LIBRARY_SUBCHANNELS, checkLibraryPath, libraryObjectKey } from './library/_library.js'

// One piece, one folder in Krish's Drive, and every file he gets himself for it filed there (Krish, 2026-11-18: "when
// I drop stuff in there, it needs to be filed properly in my Drive in the right place, so its easily accessible later
// on. every resource along the way for a single piece needs to be bound to the piece in a bullet proof way").
//
// The binding. A piece's folder in `makeyourmindup > 3 Posts` is named once, by the first writer that needs it, and
// held on its making record (meta.making.post_folder; _making.ts boundPostFolder). Until 18 Nov only the pack bound it
// (pack.folder), so a file that arrived before the pack had nowhere bound to go and ve file and build.py could each
// name a folder from their own subject. Now: the pack binds it when it comes first; a file he drops on the production
// plan binds it when it comes first (bindPostFolder, named here exactly as scripts/post-pack/library.py post_folder
// names it, tested on config/library-paths.cases.json); every later pack under another name is refused
// (post_folder_bound); build.py and ve file read the binding and use it.
//
// The filing. The bytes are stored once, by their sha256, in the library's private bucket; the piece materials store
// (its record of truth: piece_id, sha256, every version, never deleted) and the asset library (content_library_files,
// the one writer into `3 Posts`: the library sync on his always-on home computer, which checks the sha256 again before
// a file reaches Drive) both point at that one object. A dropped file is a material on the piece and a library row at
// `3 Posts/<bound folder>/3 Video/Your materials/<beats> - <name>`, so it is in his Drive beside the cuts it is for.

/** Where his own files for a piece go inside its post folder: beside the video they are for. A video may only live
 *  under 3 Video (the library's path rule), and photos, screenshots and PDFs are allowed there too. */
export const MATERIALS_SECTION = '3 Video'
export const MATERIALS_FOLDER = 'Your materials'
/** A file he got himself for a piece (the production plan's "What you get yourself"). */
export const GOT_ROLE = 'krish_got'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** The days with no series (library.py OFF_WEEKDAYS): an off-day post's folder carries off.day. */
const OFF_WEEKDAYS = new Set(['Tue', 'Thu', 'Sat'])
/** A folder name is one path part (library.py POST_FOLDER_MAX = PART_MAX). */
export const POST_FOLDER_MAX = LIBRARY_PART_MAX
// archive.py SPACE_LIKE and UNSAFE, character for character.
const SPACE_LIKE = /[\u0000-\u001f\u007f-\u009f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/g
const UNSAFE = /[<>:"/\\|?*]/g

export class PostFolderError extends Error {}

/** archive.py safe_text: everything a Windows or Drive name cannot hold taken out. */
export function safeText(text: string): string {
  const t = text.replace(SPACE_LIKE, ' ').replace(UNSAFE, '').replace(/ {2,}/g, ' ').replace(/^ +| +$/g, '')
  return t.replace(/[. ]+$/, '')
}

/** archive.py _shorten: cut at the last space that fits (counted in characters, as Python counts them), or mid-word when
 *  one word is too long, with no space, dot, comma, semicolon or dash left at the end. */
export function shorten(subject: string, budget: number): string {
  const chars = Array.from(subject)
  if (chars.length <= budget) return subject
  let cut = chars.slice(0, budget).join('')
  if (chars[budget] !== ' ') {
    const space = cut.lastIndexOf(' ')
    if (space > 0) cut = cut.slice(0, space)
  }
  return cut.replace(/[ .,;\-\u2013\u2014]+$/, '') || chars.slice(0, budget).join('').replace(/[. ]+$/, '')
}

/** library.py subchannel_name: 'follow.the.money' from 'follow.the.money', 'follow_the_money' or any capitals. */
export function subchannelName(value: unknown): string {
  const wanted = String(value ?? '').trim().toLowerCase().replace(/_/g, '.')
  const found = [...LIBRARY_SUBCHANNELS, LIBRARY_OFF_DAY].find(n => n === wanted)
  if (!found) throw new PostFolderError(`"${String(value)}" is not a subchannel: use ${LIBRARY_SUBCHANNELS.join(', ')}, or ${LIBRARY_OFF_DAY} for an off-day post`)
  return found
}

/** library.py post_folder: "2026-10-05 Mon follow.the.money - Who gets paid", or "2026-10-05 Launch - Hello". */
export function postFolderName(p: { date: string; subject: string; subchannel?: string | null; launch?: boolean; day?: string | null }): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.date || '')
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null
  if (!m || !d || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new PostFolderError(`${p.date} is not a date like 2026-10-05`)
  const weekday = WEEKDAYS[d.getUTCDay()]
  if (p.day != null && String(p.day).slice(0, 3).replace(/^./, c => c.toUpperCase()).replace(/(?<=^.)(.+)/, s => s.toLowerCase()) !== weekday) {
    throw new PostFolderError(`${p.date} falls on a ${weekday}, so its day is ${weekday}, not ${p.day}`)
  }
  if (p.launch && p.subchannel) throw new PostFolderError('a launch post has no subchannel in its folder name')
  if (!p.launch && !p.subchannel) throw new PostFolderError('a post needs its subchannel, or launch')
  let name = p.launch ? null : subchannelName(p.subchannel)
  if (name && OFF_WEEKDAYS.has(weekday)) name = LIBRARY_OFF_DAY
  const head = p.launch ? `${p.date} Launch - ` : `${p.date} ${weekday} ${name} - `
  const clean = safeText(p.subject || '')
  if (!clean) throw new PostFolderError('the subject has nothing a folder name can keep')
  return head + shorten(clean, POST_FOLDER_MAX - Array.from(head).length)
}

type Body = Record<string, any>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** The folder a piece would be bound to now: its date, its day, its series (off.day on a day with no series) and its
 *  working title, else its idea. Pure. */
export function folderForPiece(row: { scheduled_for?: unknown; lane_slot?: unknown; idea?: unknown; meta?: unknown }): string {
  const date = typeof row.scheduled_for === 'string' ? row.scheduled_for.slice(0, 10) : ''
  if (!date) throw new PostFolderError('the piece has no day yet, so it has no post folder')
  const meta = isObj(row.meta) ? row.meta : {}
  const subject = [meta.working_title, row.idea].find(v => typeof v === 'string' && safeText(v)) as string | undefined
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
  const series = typeof row.lane_slot === 'string' && row.lane_slot ? row.lane_slot : OFF_WEEKDAYS.has(weekday) ? LIBRARY_OFF_DAY : null
  return postFolderName({ date, subject: subject ?? '', subchannel: series })
}

/** The store's database client, as _pieceStore.ts uses it (only the calls made here). */
export interface FolderDb {
  from(table: string): any
}

/** The piece's post folder, bound now when nothing bound it yet: the same compare-and-set on the row's updated_at as
 *  every meta write (_pieceStore.ts patchMeta), so two drops at once bind one folder, and a pack that bound one first
 *  wins. Throws PostFolderError when the piece has no day yet, or the row could not be written. */
export async function bindPostFolder(db: FolderDb, pieceId: string, by: string, now = new Date(), tries = 6): Promise<{ folder: string; bound: 'already' | 'now' }> {
  for (let i = 0; i < tries; i++) {
    const read = await db.from('content_ideas').select('id,idea,scheduled_for,lane_slot,meta,updated_at').eq('id', pieceId).maybeSingle()
    if (read.error) throw new PostFolderError('the piece could not be read')
    if (!read.data) throw new PostFolderError('piece_not_found')
    const meta: Body = isObj(read.data.meta) ? read.data.meta : {}
    const making = (isObj(meta.making) ? meta.making : null) as Making | null
    const held = boundPostFolder(making)
    // A record from before the binding was kept holds its pack's folder: that is its binding; nothing is written.
    if (held) return { folder: held, bound: 'already' }
    const folder = folderForPiece(read.data)
    const at = now.toISOString()
    const next = mergeMaking(making, { post_folder: { folder, bound_at: at, by } }, by, at)
    const write = await db.from('content_ideas').update({ meta: { ...meta, making: next }, updated_at: at })
      .eq('id', pieceId).eq('updated_at', read.data.updated_at).select('id')
    if (write.error) throw new PostFolderError('the piece could not be written')
    if (write.data?.length) return { folder, bound: 'now' }
    await new Promise(r => setTimeout(r, 40 + Math.random() * 120 * (i + 1)))
  }
  throw new PostFolderError('the piece is busy; drop it again')
}

/** The beat ids a file is for, as he tagged it: "s8", "l9". At most eight, each a plan beat id. */
export const BEAT = /^[a-z][a-z0-9_-]{0,15}$/i
export function beatsOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,+]+/) : []
  return [...new Set(list.filter((b): b is string => typeof b === 'string' && BEAT.test(b)).map(b => b.toLowerCase()))].slice(0, 8)
}

/** The material key of a file he dropped: its beats and its bytes, so the same file on the same beats is one material
 *  (a second drop is a duplicate), and the plan reads which beats it is for from the key. */
export function gotKey(beats: string[], sha256: string): string {
  return `got:${beats.length ? beats.join('+') : 'plan'}:${sha256.slice(0, 16)}`
}
/** The beats a material key names, or null when it is not a dropped file's key. */
export function beatsOfKey(key: unknown): string[] | null {
  const m = typeof key === 'string' ? /^got:([^:]+):[a-f0-9]{16}$/.exec(key) : null
  if (!m) return null
  return m[1] === 'plan' ? [] : m[1].split('+').filter(b => BEAT.test(b))
}

/** The file's name in his Drive: its beats first ("S8 L9 - bill.jpg"), made safe for Windows and Drive, short enough
 *  that the whole path fits the library's 180 characters. Pure. */
export function driveName(folder: string, original: string, beats: string[], ext: string, copy = 1): string {
  const prefix = beats.length ? `${beats.map(b => b.toUpperCase()).join(' ')} - ` : ''
  const stem = safeText(original.replace(/\.[A-Za-z0-9]{1,8}$/, '')) || 'file'
  const tail = `${copy > 1 ? ` (${copy})` : ''}.${ext}`
  const base = `3 Posts/${folder}/${MATERIALS_SECTION}/${MATERIALS_FOLDER}/`
  const room = Math.min(LIBRARY_PART_MAX, LIBRARY_PATH_MAX - Array.from(base).length) - Array.from(prefix + tail).length
  if (room < 4) throw new PostFolderError('the post folder name leaves no room for the file name')
  return `${prefix}${shorten(stem, room)}${tail}`
}

/** One file of his, filed into the piece's post folder through the asset library: the row the library sync on his home
 *  computer writes into Drive, pointing at the bytes the store already holds and has read back whole. Idempotent: the
 *  same bytes at the same path are one row; another file already at the name gets " (2)" and on. The answer is the
 *  library path, or why it waits. */
export async function fileToPostFolder(db: FolderDb, f: {
  folder: string; name: string; beats: string[]; ext: string; contentType: string; sha256: string; md5: string; bytes: number; purpose: string; sentBy: string; now?: Date
}): Promise<{ path: string; state: 'filed' | 'already' }> {
  const objectKey = libraryObjectKey(f.sha256, f.ext)
  for (let copy = 1; copy <= 20; copy++) {
    const path = `3 Posts/${f.folder}/${MATERIALS_SECTION}/${MATERIALS_FOLDER}/${driveName(f.folder, f.name, f.beats, f.ext, copy)}`
    const checked = checkLibraryPath(path)
    if (checked.ok === false) throw new PostFolderError(`the library refuses ${path}: ${checked.refusal}`)
    if (checked.contentType !== f.contentType) throw new PostFolderError('the file type does not match its name')
    const here = await db.from('content_library_files').select('sha256,state').eq('library', LIBRARY_DEFAULT).eq('path', path)
    if (here.error) throw new PostFolderError('the library index could not be read')
    const rows = (Array.isArray(here.data) ? here.data : []) as Array<{ sha256: string; state: string }>
    const mine = rows.find(r => r.sha256 === f.sha256)
    if (mine?.state === 'ready') return { path, state: 'already' }
    // Another file holds the name: the next name, never a second version over his first file.
    if (!mine && rows.length) continue
    const at = (f.now ?? new Date()).toISOString()
    const row = { library: LIBRARY_DEFAULT, path, sha256: f.sha256, md5: f.md5, bytes: f.bytes, content_type: f.contentType, object_key: objectKey,
      purpose: f.purpose.slice(0, 200), sent_by: f.sentBy, state: 'ready', ready_at: at }
    const put = mine
      ? await db.from('content_library_files').update({ state: 'ready', ready_at: at }).eq('library', LIBRARY_DEFAULT).eq('path', path).eq('sha256', f.sha256)
      : await db.from('content_library_files').upsert(row, { onConflict: 'library,path,sha256', ignoreDuplicates: true })
    if (put.error) throw new PostFolderError('the library index could not be written')
    return { path, state: 'filed' }
  }
  throw new PostFolderError('twenty files already hold that name')
}

export { LIBRARY_BUCKET }
