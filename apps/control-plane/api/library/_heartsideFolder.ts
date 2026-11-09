import { DRIVE_READONLY_SCOPE, googleAccessToken } from '../_google.js'

// Where Heartside's social library is in Krish's Drive, found by its folder ID.
//
// Krish, 2026-11-09, after he renamed Heartside/05_Social-Library to
// 03b_Social-Schedule and every Heartside send would have stopped with
// heartside_library_root_missing until the path in config/heartside-library.json
// was changed by hand: "ideally ID so if folders move it doesnt matter".
//
// So the engine asks Google where the folder is now: it reads the folder by its
// ID, then each parent in turn up to My Drive, and hands the home computers the
// names on the way ("My Drive/Ventures/.../03b_Social-Schedule"). The library
// sync maps that onto its H: drive (scripts/library-sync.ps1,
// Resolve-HeartsideRoot). A rename or a move changes nothing.
//
// The folder belongs to krish@mindmake.co and is shared with no one, so the
// engine reads it as him (GOOGLE_DRIVE_OWNER, domain-wide delegation, the same
// identity api/ux-feedback uses), read only. It reads and never writes,
// moves, renames or creates anything.
//
// Three answers:
// - found: the path, which the sync uses;
// - gone: the folder is deleted or in the Drive bin. The sync stops with the
//   problem named and never falls back to an old path, so nothing is filed
//   into a folder Krish threw away and no folder is ever made;
// - unknown: Google could not be asked (no delegation, Drive down, a folder
//   outside My Drive). The sync falls back to config/heartside-library.json
//   root, which it still never creates.

/** Heartside > 03b_Social-Schedule (was 05_Social-Library). Verified against
 *  live Drive on 2026-11-09; config/heartside-library.json drive_id holds the
 *  same ID and a test keeps the two equal. */
export const HEARTSIDE_LIBRARY_FOLDER_ID = '1AHZLgwj1nHemNJeP56fQU6iTpgIEALzZ'

/** Deep enough for any real folder; a deeper chain is treated as a loop. */
export const FOLDER_WALK_MAX_DEPTH = 32

/** How long one answer is reused: the sync asks every pass and every round. */
export const FOLDER_CACHE_MS = 5 * 60 * 1000

export const MY_DRIVE = 'My Drive'

export interface DriveFolderMeta {
  id: string
  name?: string
  mimeType?: string
  trashed?: boolean
  parents?: string[]
}

/** One Drive lookup: the metadata, or 'missing' for a 404, or 'error'. */
export type DriveLookup = (id: string) => Promise<DriveFolderMeta | 'missing' | 'error'>

export type HeartsideFolder =
  | { state: 'found'; drive_id: string; path: string; segments: string[] }
  | { state: 'gone'; drive_id: string; problem: 'heartside_library_gone' | 'heartside_library_trashed'; reason: string }
  | { state: 'unknown'; drive_id: string; reason: string }

const FOLDER_MIME = 'application/vnd.google-apps.folder'

/** A name the sync can put on a Windows path as one folder. Drive for desktop
 *  shows a name with a character Windows refuses under another spelling, so a
 *  path with one is not guessed at: the answer is unknown and the configured
 *  root is used. */
export function isPathSafeName(name: unknown): name is string {
  return typeof name === 'string'
    && name.length > 0
    && name.length <= 255
    && name.trim() === name
    && !/[\\/:*?"<>|\u0000-\u001f]/.test(name)
    && !/^\.+$/.test(name)
    && !/\.$/.test(name)
}

/** Walks from the folder up to My Drive. `rootId` is the owner's My Drive
 *  folder ID (files/root). Pure apart from the lookups it is given. */
export async function walkFolderPath(folderId: string, rootId: string, lookup: DriveLookup): Promise<HeartsideFolder> {
  const unknown = (reason: string): HeartsideFolder => ({ state: 'unknown', drive_id: folderId, reason })
  const first = await lookup(folderId)
  if (first === 'error') return unknown('Google Drive could not be asked where the folder is')
  if (first === 'missing') {
    return { state: 'gone', drive_id: folderId, problem: 'heartside_library_gone', reason: 'the Heartside library folder (by its ID) is not in Drive: it was deleted, or emptied from the bin' }
  }
  if (first.mimeType !== FOLDER_MIME) {
    return { state: 'gone', drive_id: folderId, problem: 'heartside_library_gone', reason: 'the Heartside library ID no longer names a folder' }
  }
  if (first.trashed === true) {
    return { state: 'gone', drive_id: folderId, problem: 'heartside_library_trashed', reason: `the Heartside library folder (${first.name ?? 'by its ID'}) is in the Drive bin` }
  }

  const names: string[] = []
  const seen = new Set<string>()
  let current: DriveFolderMeta = first
  for (let depth = 0; depth < FOLDER_WALK_MAX_DEPTH; depth++) {
    if (current.id === rootId) return { state: 'found', drive_id: folderId, path: [MY_DRIVE, ...names].join('/'), segments: [MY_DRIVE, ...names] }
    if (seen.has(current.id)) return unknown('the folder\'s parents loop')
    seen.add(current.id)
    if (current.trashed === true) return { state: 'gone', drive_id: folderId, problem: 'heartside_library_trashed', reason: `a folder above the Heartside library (${current.name ?? current.id}) is in the Drive bin` }
    if (!isPathSafeName(current.name)) return unknown('a folder on the way has a name that cannot be a Windows folder name')
    names.unshift(current.name)
    const parent = current.parents?.[0]
    if (!parent) return unknown('the folder is not in My Drive (a shared drive, or shared with Krish)')
    if (parent === rootId) { current = { id: rootId }; continue }
    const next = await lookup(parent)
    if (next === 'error' || next === 'missing') return unknown('a folder above the Heartside library could not be read')
    current = next
  }
  return unknown('the folder is nested deeper than the walk goes')
}

// ── Drive ───────────────────────────────────────────────────────────────────

let cached: { at: number; answer: HeartsideFolder } | null = null

/** For tests. */
export function resetHeartsideFolderCache(): void { cached = null }

/** Where the Heartside library is now, as its owner sees it. Cached for a few
 *  minutes; an unknown answer is not cached, so the next ask tries again. */
export async function resolveHeartsideFolder(now = Date.now()): Promise<HeartsideFolder> {
  if (cached && now - cached.at < FOLDER_CACHE_MS) return cached.answer
  const folderId = HEARTSIDE_LIBRARY_FOLDER_ID
  let why = 'google_service_account_not_configured'
  const owner = process.env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co'
  const token = await googleAccessToken([DRIVE_READONLY_SCOPE], { subject: owner, onError: (r) => { why = r } })
  if (!token) return { state: 'unknown', drive_id: folderId, reason: `the engine could not read Drive as the folder's owner: ${why}` }
  const headers = { Authorization: `Bearer ${token}` }
  const get = async (id: string, fields: string): Promise<DriveFolderMeta | 'missing' | 'error'> => {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${fields}&supportsAllDrives=true`, { headers }).catch(() => null)
    if (!r) return 'error'
    if (r.status === 404) return 'missing'
    if (!r.ok) return 'error'
    const j: any = await r.json().catch(() => null)
    return j && typeof j.id === 'string' ? j as DriveFolderMeta : 'error'
  }
  const root = await get('root', 'id')
  if (root === 'error' || root === 'missing') return { state: 'unknown', drive_id: folderId, reason: 'Google Drive could not be asked for My Drive' }
  const answer = await walkFolderPath(folderId, root.id, (id) => get(id, 'id,name,mimeType,trashed,parents'))
  if (answer.state !== 'unknown') cached = { at: now, answer }
  return answer
}
