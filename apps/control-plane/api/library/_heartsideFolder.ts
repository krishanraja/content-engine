import {
  FOLDER_CACHE_MS,
  FOLDER_WALK_MAX_DEPTH,
  MY_DRIVE,
  isPathSafeName,
  resetDriveFolderCache,
  resolveDriveFolders,
  walkDriveFolder,
  type DriveFolderMeta,
  type DriveLookup,
  type FolderSubject,
} from './_driveFolder.js'

// Where Heartside's social library is in Krish's Drive, found by its folder ID.
// The walk itself is _driveFolder.ts, shared since 14 Nov with the runtime
// folders in config/studio.json (_runtimeFolders.ts).
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

export { FOLDER_CACHE_MS, FOLDER_WALK_MAX_DEPTH, MY_DRIVE, isPathSafeName }
export type { DriveFolderMeta, DriveLookup }

export type HeartsideFolder =
  | { state: 'found'; drive_id: string; path: string; segments: string[] }
  | { state: 'gone'; drive_id: string; problem: 'heartside_library_gone' | 'heartside_library_trashed'; reason: string }
  | { state: 'unknown'; drive_id: string; reason: string }

export const HEARTSIDE_SUBJECT: FolderSubject = { label: 'the Heartside library', gone: 'heartside_library_gone', trashed: 'heartside_library_trashed' }

/** Walks from the folder up to My Drive, with Heartside's problem codes. */
export async function walkFolderPath(folderId: string, rootId: string, lookup: DriveLookup): Promise<HeartsideFolder> {
  return await walkDriveFolder(folderId, rootId, lookup, HEARTSIDE_SUBJECT) as HeartsideFolder
}

/** For tests: forgets every folder answer, Heartside's and the runtime folders'. */
export function resetHeartsideFolderCache(): void { resetDriveFolderCache() }

/** Where the Heartside library is now, as its owner sees it. */
export async function resolveHeartsideFolder(now = Date.now()): Promise<HeartsideFolder> {
  const [answer] = await resolveDriveFolders([{ id: HEARTSIDE_LIBRARY_FOLDER_ID, subject: HEARTSIDE_SUBJECT }], now)
  return answer as HeartsideFolder
}
