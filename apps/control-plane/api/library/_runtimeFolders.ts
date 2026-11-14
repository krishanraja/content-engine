import studio from '../../../../config/studio.json' with { type: 'json' }
import { resolveDriveFolders, type DriveFolder } from './_driveFolder.js'

// Where each of the engine's runtime folders is in Krish's Drive now, found by
// the folder IDs in config/studio.json drive_ids (Krish, 2026-10-24: found by
// ID, never by path). On 11 Nov the library and music roots broke on both home
// computers when a folder above them was renamed, because they were found by
// the paths in runtime.*. The answer rides on the library pending list
// (GET /api/library/pending?folders=1); the library sync maps each found path
// onto its Google Drive for desktop drive, uses it, and writes them all to
// %LOCALAPPDATA%\makeyourmindup\drive-paths.json for the other readers on that
// computer (music, the archive, krish-clone, content-watcher, filearchives).
// runtime.* in config/studio.json stays the fallback when Drive cannot be asked.

/** The runtime folders, by the names config/studio.json gives them. */
export const RUNTIME_FOLDER_NAMES = ['drive_root', 'media_inbox', 'archive_root', 'library_root', 'music_root'] as const
export type RuntimeFolderName = typeof RUNTIME_FOLDER_NAMES[number]

const LABELS: Record<RuntimeFolderName, string> = {
  drive_root: 'the Video Engine',
  media_inbox: 'the Video Engine Inbox',
  archive_root: 'the video archive',
  library_root: 'the makeyourmindup library',
  music_root: 'the brand kit\'s Music',
}

export type RuntimeFolder = DriveFolder & { name: RuntimeFolderName }

/** The IDs as config/studio.json holds them. A name without a usable ID is left out. */
export function runtimeFolderIds(config: unknown = studio): Array<{ name: RuntimeFolderName; id: string }> {
  const ids = (config as { drive_ids?: Record<string, unknown> } | null)?.drive_ids ?? {}
  const out: Array<{ name: RuntimeFolderName; id: string }> = []
  for (const name of RUNTIME_FOLDER_NAMES) {
    const id = ids[name]
    if (typeof id === 'string' && /^[A-Za-z0-9_-]{10,80}$/.test(id)) out.push({ name, id })
  }
  return out
}

/** Where every runtime folder is now. Never throws: a folder that could not be
 *  asked is unknown, and the home computers use their configured path. */
export async function resolveRuntimeFolders(now = Date.now()): Promise<RuntimeFolder[]> {
  const wanted = runtimeFolderIds()
  const subjects = wanted.map(({ name, id }) => ({ id, subject: { label: LABELS[name], gone: `${name}_gone`, trashed: `${name}_trashed` } }))
  let answers: DriveFolder[]
  try {
    answers = await resolveDriveFolders(subjects, now)
  } catch {
    answers = wanted.map(({ id }) => ({ state: 'unknown', drive_id: id, reason: 'the folder lookup failed' }))
  }
  return wanted.map(({ name }, i) => ({ name, ...answers[i] }))
}
