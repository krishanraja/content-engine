import { DRIVE_READONLY_SCOPE, googleAccessToken } from '../_google.js'

// Where a folder in Krish's Drive is now, found by its folder ID.
//
// Krish, 2026-10-24: folders are found by ID, never by path, wherever the API
// allows it. Krish, 2026-11-09: "ideally ID so if folders move it doesnt
// matter". Built first for Heartside's library (_heartsideFolder.ts), and used
// since 14 Nov for every runtime folder in config/studio.json drive_ids
// (_runtimeFolders.ts): on 11 Nov a rename of "Active" to "Active Ventures"
// broke the library and music roots on both home computers, because they were
// found by path.
//
// The engine reads the folder by its ID, then each parent in turn up to My
// Drive, and hands the home computers the names on the way ("My Drive/Ventures/
// .../makeyourmindup"). The home computers map that onto their Google Drive for
// desktop drive. A rename or a move changes nothing.
//
// It reads as the folders' owner (GOOGLE_DRIVE_OWNER, domain-wide delegation),
// read only, with GET. It never writes, moves, renames, shares or creates.
//
// Three answers:
// - found: the path;
// - gone: the folder is deleted, in the Drive bin, or no longer a folder. The
//   caller stops and never falls back to an old path, so nothing is filed into
//   a folder Krish threw away;
// - unknown: Google could not be asked. The caller uses its configured path.

/** Deep enough for any real folder; a deeper chain is treated as a loop. */
export const FOLDER_WALK_MAX_DEPTH = 32

/** How long one answer is reused: the home computers ask every pass. */
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

/** What the folder is called in a reason, and its two problem codes. */
export interface FolderSubject {
  label: string
  gone: string
  trashed: string
}

export type DriveFolder<P extends string = string> =
  | { state: 'found'; drive_id: string; path: string; segments: string[] }
  | { state: 'gone'; drive_id: string; problem: P; reason: string }
  | { state: 'unknown'; drive_id: string; reason: string }

const FOLDER_MIME = 'application/vnd.google-apps.folder'

/** A name the home computers can put on a Windows path as one folder. Drive for
 *  desktop shows a name with a character Windows refuses under another
 *  spelling, so a path with one is not guessed at: the answer is unknown and
 *  the configured path is used. */
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
export async function walkDriveFolder(folderId: string, rootId: string, lookup: DriveLookup, subject: FolderSubject): Promise<DriveFolder> {
  const unknown = (reason: string): DriveFolder => ({ state: 'unknown', drive_id: folderId, reason })
  const first = await lookup(folderId)
  if (first === 'error') return unknown('Google Drive could not be asked where the folder is')
  if (first === 'missing') {
    return { state: 'gone', drive_id: folderId, problem: subject.gone, reason: `${subject.label} folder (by its ID) is not in Drive: it was deleted, or emptied from the bin` }
  }
  if (first.mimeType !== FOLDER_MIME) {
    return { state: 'gone', drive_id: folderId, problem: subject.gone, reason: `${subject.label} ID no longer names a folder` }
  }
  if (first.trashed === true) {
    return { state: 'gone', drive_id: folderId, problem: subject.trashed, reason: `${subject.label} folder (${first.name ?? 'by its ID'}) is in the Drive bin` }
  }

  const names: string[] = []
  const seen = new Set<string>()
  let current: DriveFolderMeta = first
  for (let depth = 0; depth < FOLDER_WALK_MAX_DEPTH; depth++) {
    if (current.id === rootId) return { state: 'found', drive_id: folderId, path: [MY_DRIVE, ...names].join('/'), segments: [MY_DRIVE, ...names] }
    if (seen.has(current.id)) return unknown('the folder\'s parents loop')
    seen.add(current.id)
    if (current.trashed === true) return { state: 'gone', drive_id: folderId, problem: subject.trashed, reason: `a folder above ${subject.label} (${current.name ?? current.id}) is in the Drive bin` }
    if (!isPathSafeName(current.name)) return unknown('a folder on the way has a name that cannot be a Windows folder name')
    names.unshift(current.name)
    const parent = current.parents?.[0]
    if (!parent) return unknown('the folder is not in My Drive (a shared drive, or shared with Krish)')
    if (parent === rootId) { current = { id: rootId }; continue }
    const next = await lookup(parent)
    if (next === 'error' || next === 'missing') return unknown(`a folder above ${subject.label} could not be read`)
    current = next
  }
  return unknown('the folder is nested deeper than the walk goes')
}

// ── Drive ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { at: number; answer: DriveFolder }>()

/** For tests. */
export function resetDriveFolderCache(): void { cache.clear() }

/** Where each folder is now, as its owner sees it, asked in one sign-in with
 *  the parents they share read once. Each answer is cached for a few minutes;
 *  an unknown answer is not cached, so the next ask tries again. */
export async function resolveDriveFolders(wanted: ReadonlyArray<{ id: string; subject: FolderSubject }>, now = Date.now()): Promise<DriveFolder[]> {
  const answers = new Map<string, DriveFolder>()
  const todo = wanted.filter(({ id }) => {
    const hit = cache.get(id)
    if (hit && now - hit.at < FOLDER_CACHE_MS) { answers.set(id, hit.answer); return false }
    return true
  })
  if (todo.length) {
    const all = (reason: string) => { for (const { id } of todo) answers.set(id, { state: 'unknown', drive_id: id, reason }) }
    let why = 'google_service_account_not_configured'
    const owner = process.env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co'
    const token = await googleAccessToken([DRIVE_READONLY_SCOPE], { subject: owner, onError: (r) => { why = r } })
    if (!token) all(`the engine could not read Drive as the folder's owner: ${why}`)
    else {
      const headers = { Authorization: `Bearer ${token}` }
      const memo = new Map<string, Promise<DriveFolderMeta | 'missing' | 'error'>>()
      const get = (id: string, fields: string): Promise<DriveFolderMeta | 'missing' | 'error'> => {
        const key = `${id}?${fields}`
        let p = memo.get(key)
        if (!p) {
          p = (async () => {
            const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${fields}&supportsAllDrives=true`, { headers }).catch(() => null)
            if (!r) return 'error' as const
            if (r.status === 404) return 'missing' as const
            if (!r.ok) return 'error' as const
            const j: any = await r.json().catch(() => null)
            return j && typeof j.id === 'string' ? j as DriveFolderMeta : 'error' as const
          })()
          memo.set(key, p)
        }
        return p
      }
      const root = await get('root', 'id')
      if (root === 'error' || root === 'missing') all('Google Drive could not be asked for My Drive')
      else {
        for (const { id, subject } of todo) {
          const answer = await walkDriveFolder(id, root.id, (x) => get(x, 'id,name,mimeType,trashed,parents'), subject)
          answers.set(id, answer)
          if (answer.state !== 'unknown') cache.set(id, { at: now, answer })
        }
      }
    }
  }
  return wanted.map(({ id }) => answers.get(id)!)
}
