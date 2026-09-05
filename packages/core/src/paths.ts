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
}

export const DEFAULT_WINDOWS_DRIVE_ROOT = 'G:\\My Drive\\Ventures\\Active\\Mindmaker\\04_Content\\Video Engine'
const INVALID_WINDOWS_DRIVE_ROOT = 'G:\\My Drive\\Ventures\\Active\\Mindmaker\\04\\_Content\\Video Engine'

export function canonicalWindowsDrivePath(value: string | undefined, fallback: string): string {
  const configured = value?.trim()
  if (!configured) return fallback
  const lower = configured.toLowerCase()
  const invalid = INVALID_WINDOWS_DRIVE_ROOT.toLowerCase()
  if (lower === invalid || lower.startsWith(`${invalid}\\`)) return fallback
  return configured
}

export function studioPaths(): StudioPaths {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
  const runtimeRoot = resolve(process.env.MINDMAKE_RUNTIME_ROOT || join(localAppData, 'MindmakeVideoStudio'))
  const driveRoot = process.platform === 'win32'
    ? canonicalWindowsDrivePath(process.env.MINDMAKE_DRIVE_ROOT, DEFAULT_WINDOWS_DRIVE_ROOT)
    : process.env.MINDMAKE_DRIVE_ROOT?.trim() || ''
  const mediaInbox = process.platform === 'win32'
    ? canonicalWindowsDrivePath(process.env.MINDMAKE_MEDIA_INBOX, join(driveRoot, 'Inbox'))
    : process.env.MINDMAKE_MEDIA_INBOX?.trim() || ''
  const archive = process.platform === 'win32'
    ? canonicalWindowsDrivePath(process.env.MINDMAKE_ARCHIVE_ROOT, join(driveRoot, 'Archive'))
    : process.env.MINDMAKE_ARCHIVE_ROOT?.trim() || (driveRoot ? join(driveRoot, 'Archive') : '')
  return {
    runtimeRoot,
    jobsRoot: join(runtimeRoot, 'jobs'),
    cacheRoot: join(runtimeRoot, 'cache'),
    indexPath: join(runtimeRoot, 'studio.sqlite'),
    driveRoot: driveRoot ? resolve(driveRoot) : null,
    mediaInbox: mediaInbox ? resolve(mediaInbox) : null,
    archiveRoot: archive ? resolve(archive) : null,
  }
}

export function jobPath(jobId: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{5,80}$/i.test(jobId)) throw new Error('invalid job id')
  return join(studioPaths().jobsRoot, jobId)
}
