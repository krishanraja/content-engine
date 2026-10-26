import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export interface StudioPaths {
  runtimeRoot: string
  jobsRoot: string
  cacheRoot: string
  indexPath: string
  driveRoot: string | null
  mediaInbox: string | null
  archiveRoot: string | null
  /** The MINDMAKE_* settings that named a folder that is not there while the
   *  default is, so the default was used. doctor reports them. */
  staleSettings: string[]
}

export const DEFAULT_WINDOWS_DRIVE_ROOT = 'H:\\My Drive\\Ventures\\Active Ventures\\makeyourmindup\\Video Engine'
const INVALID_WINDOWS_DRIVE_ROOT = 'G:\\My Drive\\Ventures\\Active\\Mindmaker\\04\\_Content\\Video Engine'

export function canonicalWindowsDrivePath(value: string | undefined, fallback: string): string {
  const configured = value?.trim()
  if (!configured) return fallback
  const lower = configured.toLowerCase()
  const invalid = INVALID_WINDOWS_DRIVE_ROOT.toLowerCase()
  if (lower === invalid || lower.startsWith(`${invalid}\\`)) return fallback
  return configured
}

/** A configured path, unless it is not there and the fallback is: then the
 *  fallback, and the setting is stale. Krish renamed `Active` to `Active
 *  Ventures` in October 2026; settings on both home computers kept the old
 *  path and were obeyed for two days. A setting that names a real folder is
 *  still obeyed, and so is one whose fallback is missing too (Google Drive not
 *  started yet), so nothing here guesses. */
export function resolveWindowsDrivePath(
  value: string | undefined,
  fallback: string,
  exists: (path: string) => boolean = existsSync,
): { path: string; stale: boolean } {
  const configured = canonicalWindowsDrivePath(value, fallback)
  if (configured === fallback || exists(configured) || !exists(fallback)) return { path: configured, stale: false }
  return { path: fallback, stale: true }
}

export function studioPaths(): StudioPaths {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
  const defaultRuntimeRoot = process.platform === 'win32'
    ? join(homedir(), 'Documents', 'MindmakeVideoStudio', 'runtime')
    : join(localAppData, 'MindmakeVideoStudio')
  const runtimeRoot = resolve(process.env.MINDMAKE_RUNTIME_ROOT || defaultRuntimeRoot)
  const staleSettings: string[] = []
  const windows = (name: string, fallback: string) => {
    const resolved = resolveWindowsDrivePath(process.env[name], fallback)
    if (resolved.stale) staleSettings.push(name)
    return resolved.path
  }
  const driveRoot = process.platform === 'win32'
    ? windows('MINDMAKE_DRIVE_ROOT', DEFAULT_WINDOWS_DRIVE_ROOT)
    : process.env.MINDMAKE_DRIVE_ROOT?.trim() || ''
  const mediaInbox = process.platform === 'win32'
    ? windows('MINDMAKE_MEDIA_INBOX', join(driveRoot, 'Inbox'))
    : process.env.MINDMAKE_MEDIA_INBOX?.trim() || ''
  const archive = process.platform === 'win32'
    ? windows('MINDMAKE_ARCHIVE_ROOT', join(driveRoot, 'Archive'))
    : process.env.MINDMAKE_ARCHIVE_ROOT?.trim() || (driveRoot ? join(driveRoot, 'Archive') : '')
  return {
    runtimeRoot,
    jobsRoot: join(runtimeRoot, 'jobs'),
    cacheRoot: join(runtimeRoot, 'cache'),
    indexPath: join(runtimeRoot, 'studio.sqlite'),
    driveRoot: driveRoot ? resolve(driveRoot) : null,
    mediaInbox: mediaInbox ? resolve(mediaInbox) : null,
    archiveRoot: archive ? resolve(archive) : null,
    staleSettings,
  }
}

export function jobPath(jobId: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{5,80}$/i.test(jobId)) throw new Error('invalid job id')
  return join(studioPaths().jobsRoot, jobId)
}
