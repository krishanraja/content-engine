import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export interface StudioPaths {
  runtimeRoot: string
  jobsRoot: string
  cacheRoot: string
  indexPath: string
  mediaInbox: string | null
  archiveRoot: string | null
}

const WINDOWS_MEDIA_BASE = 'G:\\My Drive\\Ventures\\Active\\Mindmaker\\04\\_Content\\Video Engine'
const LEGACY_WINDOWS_MEDIA_BASE = 'G:\\My Drive\\Ventures\\Active\\Mindmaker\\04_Content\\Video Engine'

function configuredWindowsPath(value: string | undefined, fallback: string): string {
  const configured = value?.trim()
  if (!configured) return fallback
  const lower = configured.toLowerCase()
  const legacy = LEGACY_WINDOWS_MEDIA_BASE.toLowerCase()
  if (lower === legacy || lower.startsWith(`${legacy}\\`)) return fallback
  return configured
}

export function studioPaths(): StudioPaths {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
  const runtimeRoot = resolve(process.env.MINDMAKE_RUNTIME_ROOT || join(localAppData, 'MindmakeVideoStudio'))
  const mediaInbox = process.platform === 'win32'
    ? configuredWindowsPath(process.env.MINDMAKE_MEDIA_INBOX, WINDOWS_MEDIA_BASE)
    : process.env.MINDMAKE_MEDIA_INBOX?.trim() || ''
  const archive = process.platform === 'win32'
    ? configuredWindowsPath(process.env.MINDMAKE_ARCHIVE_ROOT, join(mediaInbox, 'Archive'))
    : process.env.MINDMAKE_ARCHIVE_ROOT?.trim() || (mediaInbox ? join(mediaInbox, 'Archive') : '')
  return {
    runtimeRoot,
    jobsRoot: join(runtimeRoot, 'jobs'),
    cacheRoot: join(runtimeRoot, 'cache'),
    indexPath: join(runtimeRoot, 'studio.sqlite'),
    mediaInbox: mediaInbox ? resolve(mediaInbox) : null,
    archiveRoot: archive ? resolve(archive) : null,
  }
}

export function jobPath(jobId: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{5,80}$/i.test(jobId)) throw new Error('invalid job id')
  return join(studioPaths().jobsRoot, jobId)
}
